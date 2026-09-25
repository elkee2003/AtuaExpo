/* Amplify Params - DO NOT EDIT
	API_ATUA_GRAPHQLAPIENDPOINTOUTPUT
	API_ATUA_GRAPHQLAPIIDOUTPUT
	API_ATUA_GRAPHQLAPIKEYOUTPUT
	ENV
	REGION
 Amplify Params - DO NOT EDIT */

const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

const https = require("https");
const crypto = require("crypto");

/* ==========================================================
   CONFIGURATION
========================================================== */

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const GRAPHQL_API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

const REGION = process.env.REGION || process.env.AWS_REGION;

/* ==========================================================
   GET PAYSTACK SECRET KEY FROM AWS SSM
========================================================== */

const getPaystackSecretKey = async () => {
  /*
   * PAYSTACK_SECRET_KEY should contain the NAME/PATH of the
   * SSM parameter, not the actual secret key.
   */

  const parameterName = process.env.PAYSTACK_SECRET_KEY;

  if (!parameterName) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  }

  const ssmClient = new SSMClient({
    region: REGION,
  });

  const command = new GetParameterCommand({
    Name: parameterName,
    WithDecryption: true,
  });

  const result = await ssmClient.send(command);

  const secretKey = result?.Parameter?.Value;

  if (!secretKey) {
    throw new Error("Unable to retrieve Paystack secret key.");
  }

  return secretKey;
};

/* ==========================================================
   GRAPHQL REQUEST HELPER
========================================================== */

const graphqlRequest = async (
  query,
  variables = {},
  operationName = "GraphQL operation",
) => {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error("Atua GraphQL endpoint is not configured.");
  }

  if (!GRAPHQL_API_KEY) {
    throw new Error("Atua GraphQL API key is not configured.");
  }

  const endpoint = new URL(GRAPHQL_ENDPOINT);

  const body = JSON.stringify({
    query,
    variables,
  });

  const options = {
    hostname: endpoint.hostname,

    path: `${endpoint.pathname || "/graphql"}` + `${endpoint.search || ""}`,

    method: "POST",

    headers: {
      "Content-Type": "application/json",

      "Content-Length": Buffer.byteLength(body),

      "x-api-key": GRAPHQL_API_KEY,
    },
  };

  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      let data = "";

      response.on("data", (chunk) => {
        data += chunk;
      });

      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          return reject(
            new Error(
              `${operationName} returned HTTP ${response.statusCode}: ${data}`,
            ),
          );
        }

        let parsed;

        try {
          parsed = JSON.parse(data);
        } catch (error) {
          return reject(
            new Error(`${operationName} returned invalid JSON: ${data}`),
          );
        }

        if (parsed?.errors?.length) {
          console.error(
            `${operationName} GraphQL errors:`,
            JSON.stringify(parsed.errors),
          );

          return reject(
            new Error(
              parsed.errors
                .map((item) => item?.message)
                .filter(Boolean)
                .join(" | ") || `${operationName} failed.`,
            ),
          );
        }

        resolve(parsed?.data || null);
      });
    });

    request.on("error", (error) => {
      console.error(`${operationName} request error:`, error);

      reject(error);
    });

    request.write(body);
    request.end();
  });
};

/* ==========================================================
   PAYSTACK REQUEST HELPER
========================================================== */

const paystackRequest = async ({ method, path, secretKey, body = null }) => {
  const payload = body !== null ? JSON.stringify(body) : null;

  const options = {
    hostname: "api.paystack.co",

    path,

    method,

    headers: {
      Authorization: `Bearer ${secretKey}`,

      Accept: "application/json",
    },
  };

  if (payload) {
    options.headers["Content-Type"] = "application/json";

    options.headers["Content-Length"] = Buffer.byteLength(payload);
  }

  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      let data = "";

      response.on("data", (chunk) => {
        data += chunk;
      });

      response.on("end", () => {
        let parsed;

        try {
          parsed = JSON.parse(data);
        } catch (error) {
          return reject(new Error(`Paystack returned invalid JSON: ${data}`));
        }

        resolve({
          statusCode: response.statusCode,

          body: parsed,
        });
      });
    });

    request.on("error", (error) => {
      error.isPaystackNetworkError = true;

      reject(error);
    });

    if (payload) {
      request.write(payload);
    }

    request.end();
  });
};

/* ==========================================================
   GET COURIER
========================================================== */

const getCourier = async (courierID) => {
  const query = `
    query GetCourier($id: ID!) {
      getCourier(id: $id) {
        id

        firstName
        lastName

        bankCode
        bankName
        accountName
        accountNumber

        isApproved

        walletID
      }
    }
  `;

  const data = await graphqlRequest(
    query,

    {
      id: courierID,
    },

    "GetCourier",
  );

  return data?.getCourier || null;
};

/* ==========================================================
   GET COURIER WALLET
========================================================== */

const getCourierWallet = async (courierID) => {
  const query = `
    query ListWallets(
      $filter: ModelWalletFilterInput
      $limit: Int
      $nextToken: String
    ) {
      listWallets(
        filter: $filter
        limit: $limit
        nextToken: $nextToken
      ) {
        items {
          id

          ownerID
          ownerType

          availableBalance
          pendingBalance
          lifetimeEarnings

          _version
        }

        nextToken
      }
    }
  `;

  let nextToken = null;

  do {
    const data = await graphqlRequest(
      query,

      {
        filter: {
          ownerID: {
            eq: courierID,
          },

          ownerType: {
            eq: "COURIER",
          },
        },

        limit: 1000,

        nextToken,
      },

      "GetCourierWallet",
    );

    const wallets = data?.listWallets?.items || [];

    const wallet = wallets[0];

    if (wallet) {
      return wallet;
    }

    nextToken = data?.listWallets?.nextToken || null;
  } while (nextToken);

  return null;
};

/* ==========================================================
   GET ACTIVE PAYOUTS FOR COURIER
==========================================================

   We check ALL pages instead of assuming that the first
   AppSync page contains every payout.

   An active payout is:

      PENDING
      PROCESSING

   This prevents a courier from accidentally receiving
   multiple simultaneous payouts.
========================================================== */

const getActiveCourierPayouts = async (courierID) => {
  const query = `
    query ListPayouts(
      $filter: ModelPayoutFilterInput
      $limit: Int
      $nextToken: String
    ) {
      listPayouts(
        filter: $filter
        limit: $limit
        nextToken: $nextToken
      ) {
        items {
          id

          courierID
          walletID

          amount

          status

          bankName
          accountNumber

          reference

          transferCode
          transferID

          failureReason

          payoutMethod

          processedAt
          paidAt
          failedAt

          _version
        }

        nextToken
      }
    }
  `;

  const activePayouts = [];

  let nextToken = null;

  do {
    const data = await graphqlRequest(
      query,

      {
        filter: {
          courierID: {
            eq: courierID,
          },
        },

        limit: 1000,

        nextToken,
      },

      "GetCourierPayouts",
    );

    const payouts = data?.listPayouts?.items || [];

    activePayouts.push(
      ...payouts.filter(
        (payout) =>
          payout.status === "PENDING" || payout.status === "PROCESSING",
      ),
    );

    nextToken = data?.listPayouts?.nextToken || null;
  } while (nextToken);

  return activePayouts;
};

/* ==========================================================
   GET PAYOUT BY REFERENCE
========================================================== */

const getPayoutByReference = async (reference) => {
  const query = `
    query ListPayouts(
      $filter: ModelPayoutFilterInput
      $limit: Int
    ) {
      listPayouts(
        filter: $filter
        limit: $limit
      ) {
        items {
          id

          courierID
          walletID

          amount

          status

          bankName
          accountNumber

          reference

          transferCode
          transferID

          failureReason

          payoutMethod

          processedAt
          paidAt
          failedAt

          _version
        }
      }
    }
  `;

  const data = await graphqlRequest(
    query,

    {
      filter: {
        reference: {
          eq: reference,
        },
      },

      limit: 1,
    },

    "GetPayoutByReference",
  );

  return data?.listPayouts?.items?.[0] || null;
};

/* ==========================================================
   GET TRANSACTION BY REFERENCE
========================================================== */

const getTransactionByReference = async (reference) => {
  const query = `
    query ListTransactions(
      $filter: ModelTransactionFilterInput
      $limit: Int
    ) {
      listTransactions(
        filter: $filter
        limit: $limit
      ) {
        items {
          id

          walletID

          type

          amount

          description

          orderID
          paymentID

          reference

          status

          _version
        }
      }
    }
  `;

  const data = await graphqlRequest(
    query,

    {
      filter: {
        reference: {
          eq: reference,
        },
      },

      limit: 1,
    },

    "GetTransactionByReference",
  );

  return data?.listTransactions?.items?.[0] || null;
};

/* ==========================================================
   CREATE PAYSTACK TRANSFER RECIPIENT
========================================================== */

const createTransferRecipient = async ({ courier, secretKey }) => {
  if (!courier.accountNumber || !courier.bankCode) {
    throw new Error("Courier bank account details are incomplete.");
  }

  if (!courier.accountName) {
    throw new Error("Courier account name is missing.");
  }

  const response = await paystackRequest({
    method: "POST",

    path: "/transferrecipient",

    secretKey,

    body: {
      type: "nuban",

      name: courier.accountName,

      account_number: courier.accountNumber,

      bank_code: courier.bankCode,

      currency: "NGN",

      description: `Atua courier ${courier.id}`,

      metadata: {
        courierID: courier.id,
      },
    },
  });

  if (
    response.statusCode < 200 ||
    response.statusCode >= 300 ||
    !response.body?.status
  ) {
    throw new Error(
      response.body?.message ||
        "Paystack transfer recipient could not be created.",
    );
  }

  const recipient = response.body?.data;

  if (!recipient?.recipient_code) {
    throw new Error("Paystack did not return a recipient code.");
  }

  return recipient;
};

/* ==========================================================
   INITIATE PAYSTACK TRANSFER
========================================================== */

const initiateTransfer = async ({
  amount,
  recipientCode,
  reference,
  secretKey,
  courierID,
}) => {
  /*
   * Atua stores money in naira.
   *
   * Paystack expects transfer amounts in kobo.
   *
   * Example:
   *
   * ₦10,000
   *
   * becomes:
   *
   * 1,000,000 kobo
   */

  const amountInKobo = Math.round(Number(amount) * 100);

  if (!Number.isFinite(amountInKobo) || amountInKobo <= 0) {
    throw new Error("Invalid payout amount.");
  }

  const response = await paystackRequest({
    method: "POST",

    path: "/transfer",

    secretKey,

    body: {
      source: "balance",

      amount: amountInKobo,

      recipient: recipientCode,

      reference,

      reason: `Atua courier payout - ${courierID}`,

      currency: "NGN",
    },
  });

  if (
    response.statusCode < 200 ||
    response.statusCode >= 300 ||
    !response.body?.status
  ) {
    const error = new Error(
      response.body?.message || "Paystack transfer could not be initiated.",
    );

    error.isPaystackRejected = true;

    error.paystackResponse = response.body;

    throw error;
  }

  const transfer = response.body?.data;

  if (!transfer) {
    const error = new Error("Paystack did not return transfer data.");

    /*
     * We don't know whether Paystack received
     * the request successfully.
     *
     * Therefore this is treated as an
     * uncertain outcome.
     */

    error.isPaystackUnknown = true;

    throw error;
  }

  return transfer;
};

/* ==========================================================
   VERIFY PAYSTACK TRANSFER
==========================================================

   This is extremely important.

   If the initial transfer request times out or
   produces an uncertain response, we verify the
   reference with Paystack before deciding whether
   to restore the courier's wallet.

   This prevents:

      1. Paystack receives transfer
      2. Lambda thinks it failed
      3. Wallet is restored
      4. Another payout is sent

   which could result in a double payment.
========================================================== */

const verifyPaystackTransfer = async (reference, secretKey) => {
  const encodedReference = encodeURIComponent(reference);

  const response = await paystackRequest({
    method: "GET",

    path: `/transfer/verify/${encodedReference}`,

    secretKey,
  });

  /*
   * Paystack returns an error when the transfer
   * does not exist.
   *
   * That is useful information because it means
   * we can safely treat the transfer as not created.
   */

  if (
    response.statusCode === 404 ||
    response.body?.message === "Transfer not found"
  ) {
    return {
      exists: false,

      status: null,

      transfer: null,
    };
  }

  if (
    response.statusCode < 200 ||
    response.statusCode >= 300 ||
    !response.body?.status
  ) {
    throw new Error(
      response.body?.message || "Could not verify Paystack transfer.",
    );
  }

  return {
    exists: true,

    status: response.body?.data?.status || null,

    transfer: response.body?.data || null,
  };
};
/* ==========================================================
   CREATE PAYOUT
========================================================== */

const createPayout = async ({
  courierID,
  walletID,
  amount,
  courier,
  reference,
  payoutMethod,
}) => {
  const mutation = `
    mutation CreatePayout(
      $input: CreatePayoutInput!
    ) {
      createPayout(
        input: $input
      ) {
        id

        courierID
        walletID

        amount

        status

        bankName
        accountNumber

        reference

        transferCode
        transferID

        failureReason

        payoutMethod

        processedAt
        paidAt
        failedAt

        _version
      }
    }
  `;

  const data = await graphqlRequest(
    mutation,

    {
      input: {
        courierID,

        walletID,

        amount,

        /*
         * A newly created payout always begins
         * in PENDING state.
         *
         * It is only moved to PROCESSING after:
         *
         * 1. wallet reservation succeeds
         * 2. debit transaction is created
         * 3. Paystack recipient is available
         */
        status: "PENDING",

        bankName: courier.bankName,

        accountNumber: courier.accountNumber,

        reference,

        payoutMethod,
      },
    },

    "CreatePayout",
  );

  return data?.createPayout || null;
};

/* ==========================================================
   UPDATE PAYOUT
========================================================== */

const updatePayout = async ({ payout, fields }) => {
  const mutation = `
    mutation UpdatePayout(
      $input: UpdatePayoutInput!
    ) {
      updatePayout(
        input: $input
      ) {
        id

        courierID
        walletID

        amount

        status

        bankName
        accountNumber

        reference

        transferCode
        transferID

        failureReason

        payoutMethod

        processedAt
        paidAt
        failedAt

        _version
      }
    }
  `;

  const input = {
    id: payout.id,

    ...fields,
  };

  /*
   * AppSync optimistic concurrency protection.
   *
   * If the payout was changed by another Lambda/process
   * after we read it, the version supplied here will no
   * longer match and AppSync will reject the update.
   *
   * This is important for payout processing because we
   * don't want two processes updating the same payout
   * blindly.
   */

  if (Number.isInteger(payout._version)) {
    input._version = payout._version;
  }

  const data = await graphqlRequest(
    mutation,

    {
      input,
    },

    "UpdatePayout",
  );

  return data?.updatePayout || null;
};

/* ==========================================================
   RESERVE WALLET BALANCE
==========================================================

   When a payout begins, the amount is moved out of
   availableBalance.

   Example:

      availableBalance = ₦50,000

      payout = ₦20,000

   After reservation:

      availableBalance = ₦30,000

   We do NOT put the payout amount into pendingBalance.

   The money is simply reserved from the spendable
   available balance while the payout is processing.

   If Paystack later fails/reverses the transfer,
   the amount is restored to availableBalance.
========================================================== */

const reserveWalletBalance = async ({ wallet, amount }) => {
  const currentAvailable = Number(wallet.availableBalance || 0);

  if (!Number.isFinite(currentAvailable)) {
    throw new Error("Wallet available balance is invalid.");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid wallet reservation amount.");
  }

  if (amount > currentAvailable) {
    throw new Error("Insufficient available balance.");
  }

  const newAvailable = Number((currentAvailable - amount).toFixed(2));

  if (newAvailable < 0) {
    throw new Error("Wallet available balance cannot become negative.");
  }

  const mutation = `
    mutation UpdateWallet(
      $input: UpdateWalletInput!
    ) {
      updateWallet(
        input: $input
      ) {
        id

        ownerID
        ownerType

        availableBalance
        pendingBalance
        lifetimeEarnings

        _version
      }
    }
  `;

  const input = {
    id: wallet.id,

    availableBalance: newAvailable,
  };

  /*
   * VERY IMPORTANT:
   *
   * The wallet version protects against two payout
   * requests reading the same balance simultaneously.
   *
   * Example:
   *
   * Request A reads ₦50,000
   * Request B reads ₦50,000
   *
   * Both attempt ₦30,000 payouts.
   *
   * Without _version protection both could potentially
   * calculate from the same old balance.
   *
   * With AppSync conflict detection, the second stale
   * update is rejected.
   */

  if (Number.isInteger(wallet._version)) {
    input._version = wallet._version;
  }

  const data = await graphqlRequest(
    mutation,

    {
      input,
    },

    "ReserveWalletBalance",
  );

  const updatedWallet = data?.updateWallet;

  if (!updatedWallet) {
    throw new Error("Wallet reservation failed.");
  }

  return updatedWallet;
};

/* ==========================================================
   RESTORE WALLET BALANCE
==========================================================

   Used ONLY when we know the Paystack transfer was NOT
   created or the payout failed before money could leave
   Paystack.

   Example:

      availableBalance = ₦30,000

      failed payout = ₦20,000

   Restored:

      availableBalance = ₦50,000
========================================================== */

const restoreWalletBalance = async ({ courierID, amount }) => {
  const wallet = await getCourierWallet(courierID);

  if (!wallet) {
    throw new Error(
      `Cannot restore balance: wallet not found for courier ${courierID}.`,
    );
  }

  const currentAvailable = Number(wallet.availableBalance || 0);

  if (!Number.isFinite(currentAvailable)) {
    throw new Error("Current wallet available balance is invalid.");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid wallet restoration amount.");
  }

  const restored = Number((currentAvailable + amount).toFixed(2));

  const mutation = `
    mutation UpdateWallet(
      $input: UpdateWalletInput!
    ) {
      updateWallet(
        input: $input
      ) {
        id

        ownerID
        ownerType

        availableBalance
        pendingBalance
        lifetimeEarnings

        _version
      }
    }
  `;

  const input = {
    id: wallet.id,

    availableBalance: restored,
  };

  /*
   * Use the CURRENT wallet version.
   *
   * We deliberately fetch the wallet again above rather
   * than using an old wallet object because other wallet
   * activity may have happened since the original
   * reservation.
   */

  if (Number.isInteger(wallet._version)) {
    input._version = wallet._version;
  }

  const data = await graphqlRequest(
    mutation,

    {
      input,
    },

    "RestoreWalletBalance",
  );

  const updatedWallet = data?.updateWallet;

  if (!updatedWallet) {
    throw new Error(
      `Unable to restore wallet balance for courier ${courierID}.`,
    );
  }

  return updatedWallet;
};

/* ==========================================================
   CREATE DEBIT TRANSACTION
==========================================================

   The transaction represents the wallet debit associated
   with this payout.

   It begins as:

      type   = DEBIT
      status = PENDING

   It should remain PENDING while the Paystack transfer is
   processing.

   The payout webhook/finalization process should later
   change it to COMPLETED when Paystack confirms the payout.

   If the payout definitively fails, it becomes FAILED.
========================================================== */

const createDebitTransaction = async ({ walletID, amount, reference }) => {
  const mutation = `
    mutation CreateTransaction(
      $input: CreateTransactionInput!
    ) {
      createTransaction(
        input: $input
      ) {
        id

        walletID

        type

        amount

        description

        orderID
        paymentID

        reference

        status

        _version
      }
    }
  `;

  const data = await graphqlRequest(
    mutation,

    {
      input: {
        walletID,

        type: "DEBIT",

        amount,

        description: "Courier payout initiated.",

        /*
         * Payout transactions are not order transactions,
         * so orderID and paymentID are intentionally omitted.
         */

        reference,

        status: "PENDING",
      },
    },

    "CreatePayoutTransaction",
  );

  return data?.createTransaction || null;
};

/* ==========================================================
   GET ELIGIBLE COURIER WALLETS
==========================================================

   Used by:

      MANUAL_ALL
      AUTOMATIC

   We paginate through ALL wallets instead of relying on
   AppSync's first page.

   Only courier wallets with a positive available balance
   are returned.

   NOTE:
   A wallet may still be skipped later if the courier has
   an existing PENDING/PROCESSING payout.
========================================================== */

const getEligibleWallets = async () => {
  const query = `
    query ListCourierWallets(
      $filter: ModelWalletFilterInput
      $limit: Int
      $nextToken: String
    ) {
      listWallets(
        filter: $filter
        limit: $limit
        nextToken: $nextToken
      ) {
        items {
          id

          ownerID
          ownerType

          availableBalance
          pendingBalance
          lifetimeEarnings

          _version
        }

        nextToken
      }
    }
  `;

  const eligibleWallets = [];

  let nextToken = null;

  do {
    const data = await graphqlRequest(
      query,

      {
        filter: {
          ownerType: {
            eq: "COURIER",
          },
        },

        limit: 1000,

        nextToken,
      },

      "GetEligibleWallets",
    );

    const wallets = data?.listWallets?.items || [];

    /*
     * Only wallets with positive available money
     * are eligible for a payout attempt.
     */

    for (const wallet of wallets) {
      const available = Number(wallet.availableBalance || 0);

      if (Number.isFinite(available) && available > 0 && wallet.ownerID) {
        eligibleWallets.push(wallet);
      }
    }

    nextToken = data?.listWallets?.nextToken || null;
  } while (nextToken);

  return eligibleWallets;
};

/* ==========================================================
   GENERATE PAYSTACK PAYOUT REFERENCE
==========================================================

   The reference is used to connect:

      Atua Payout
          ↓
      Atua Transaction
          ↓
      Paystack Transfer
          ↓
      Paystack Webhook

   The reference must therefore be unique.

   Format:

      atua_<courier>_<timestamp>_<random>

   Example:

      atua_abc123_ly4k2x_9f8e7d...
========================================================== */

const generatePayoutReference = (courierID) => {
  const courierPart = String(courierID)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8);

  const randomPart = crypto.randomBytes(12).toString("hex");

  const timestampPart = Date.now().toString(36).toLowerCase();

  const reference = `atua_${courierPart}_${timestampPart}_${randomPart}`;

  /*
   * Keep the reference within the allowed length.
   */

  return reference.slice(0, 50);
};

/* ==========================================================
   MARK PAYOUT FAILED
========================================================== */

const markPayoutFailed = async ({ payout, reason, transfer = null }) => {
  /*
   * If the payout is already FAILED, there is no need
   * to issue another update.
   */

  if (payout.status === "FAILED") {
    return payout;
  }

  const updated = await updatePayout({
    payout,

    fields: {
      status: "FAILED",

      failureReason: reason,

      failedAt: new Date().toISOString(),

      transferCode: transfer?.transfer_code || payout.transferCode || null,

      transferID:
        transfer?.id != null ? String(transfer.id) : payout.transferID || null,
    },
  });

  if (!updated) {
    throw new Error(`Could not mark payout ${payout.id} as FAILED.`);
  }

  return updated;
};

/* ==========================================================
   MARK DEBIT TRANSACTION FAILED
==========================================================

   This version includes _version so that we do not blindly
   overwrite another transaction update.

   If AppSync rejects the version because somebody already
   changed the transaction, the error is allowed to surface
   instead of silently overwriting the newer state.
========================================================== */

const markTransactionFailed = async (reference) => {
  const transaction = await getTransactionByReference(reference);

  if (!transaction) {
    /*
     * There is no transaction to update.
     *
     * This can happen if transaction creation itself failed.
     */

    return null;
  }

  if (transaction.status === "FAILED") {
    return transaction;
  }

  /*
   * A COMPLETED transaction must NEVER be changed back
   * to FAILED.
   *
   * That would corrupt the payout ledger.
   */

  if (transaction.status === "COMPLETED") {
    throw new Error(
      `Payout transaction ${transaction.id} is already COMPLETED and cannot be marked FAILED.`,
    );
  }

  const mutation = `
    mutation UpdateTransaction(
      $input: UpdateTransactionInput!
    ) {
      updateTransaction(
        input: $input
      ) {
        id

        walletID

        type

        amount

        description

        reference

        status

        _version
      }
    }
  `;

  const input = {
    id: transaction.id,

    status: "FAILED",

    description: "Courier payout failed.",
  };

  /*
   * IMPORTANT:
   *
   * Use the transaction's current _version.
   *
   * This prevents an older Lambda invocation from
   * overwriting a newer transaction state.
   */

  if (Number.isInteger(transaction._version)) {
    input._version = transaction._version;
  }

  const data = await graphqlRequest(
    mutation,

    {
      input,
    },

    "MarkPayoutTransactionFailed",
  );

  return data?.updateTransaction || null;
};

/* ==========================================================
   PROCESS ONE COURIER PAYOUT
========================================================== */

const processCourierPayout = async ({
  courierID,
  requestedAmount,
  payoutMethod,
  secretKey,
}) => {
  console.log("==========================================");

  console.log("PROCESSING COURIER PAYOUT");

  console.log({
    courierID,
    requestedAmount,
    payoutMethod,
  });

  console.log("==========================================");

  /* ========================================================
     1. GET COURIER
  ======================================================== */

  const courier = await getCourier(courierID);

  if (!courier) {
    throw new Error(`Courier ${courierID} not found.`);
  }

  /* ========================================================
     2. CHECK COURIER APPROVAL
  ========================================================

     Only approved couriers should be allowed to receive
     payouts.

     We specifically check for false rather than requiring
     true because this preserves the behavior of your
     existing Courier model if the field is nullable.
  ======================================================== */

  if (courier.isApproved === false) {
    throw new Error("Courier is not approved for payouts.");
  }

  /* ========================================================
     3. CHECK BANK DETAILS
  ======================================================== */

  if (!courier.bankCode || !courier.accountNumber || !courier.accountName) {
    throw new Error("Courier does not have complete bank account details.");
  }

  /* ========================================================
     4. GET COURIER WALLET
  ======================================================== */

  const wallet = await getCourierWallet(courierID);

  if (!wallet) {
    throw new Error("Courier wallet not found.");
  }

  /*
   * Make sure the wallet actually belongs to this courier.
   *
   * This is an additional safety check before moving money.
   */

  if (wallet.ownerID !== courierID) {
    throw new Error("Courier wallet ownership validation failed.");
  }

  if (wallet.ownerType !== "COURIER") {
    throw new Error("Wallet is not a courier wallet.");
  }

  /* ========================================================
     5. CHECK AVAILABLE BALANCE
  ======================================================== */

  const availableBalance = Number(wallet.availableBalance || 0);

  if (!Number.isFinite(availableBalance)) {
    throw new Error("Courier wallet available balance is invalid.");
  }

  if (availableBalance <= 0) {
    throw new Error("Courier has no available balance for payout.");
  }

  /* ========================================================
     6. CHECK FOR EXISTING ACTIVE PAYOUT
  ========================================================

     A courier must not have more than one payout
     simultaneously in:

         PENDING
         PROCESSING

     This is especially important because a payout that
     has reached PROCESSING may already exist at Paystack.

     Creating another payout could therefore result in
     duplicate money being sent.
  ======================================================== */

  const activePayouts = await getActiveCourierPayouts(courierID);

  if (activePayouts.length > 0) {
    const active = activePayouts[0];

    console.log("ACTIVE PAYOUT ALREADY EXISTS:", {
      payoutID: active.id,

      reference: active.reference,

      status: active.status,

      amount: active.amount,
    });

    return {
      success: true,

      skipped: true,

      status: active.status,

      courierID,

      payoutID: active.id,

      payoutReference: active.reference,

      amount: active.amount,

      message: "Courier already has a payout pending or processing.",
    };
  }

  /* ========================================================
     7. DETERMINE PAYOUT AMOUNT
  ========================================================

     If no amount is supplied:

         pay the entire available balance.

     If an amount is supplied:

         pay only that requested amount.
  ======================================================== */

  let payoutAmount = availableBalance;

  if (
    requestedAmount !== undefined &&
    requestedAmount !== null &&
    requestedAmount !== ""
  ) {
    payoutAmount = Number(requestedAmount);

    if (!Number.isFinite(payoutAmount) || payoutAmount <= 0) {
      throw new Error("Requested payout amount is invalid.");
    }

    if (payoutAmount > availableBalance) {
      throw new Error("Requested payout amount exceeds available balance.");
    }
  }

  /*
   * Keep all money values at two decimal places.
   */

  payoutAmount = Number(payoutAmount.toFixed(2));

  /* ========================================================
     8. FINAL AMOUNT VALIDATION
  ======================================================== */

  if (!Number.isFinite(payoutAmount) || payoutAmount <= 0) {
    throw new Error("Payout amount must be greater than zero.");
  }

  /* ========================================================
     9. GENERATE UNIQUE PAYSTACK REFERENCE
  ======================================================== */

  const reference = generatePayoutReference(courierID);

  console.log("PAYOUT REFERENCE:", reference);

  /* ========================================================
     10. CREATE PAYOUT RECORD
  ========================================================

     At this point the payout exists in Atua as:

         status = PENDING

     No money has been sent to Paystack yet.
  ======================================================== */

  const payout = await createPayout({
    courierID,

    walletID: wallet.id,

    amount: payoutAmount,

    courier,

    reference,

    payoutMethod,
  });

  if (!payout?.id) {
    throw new Error("Payout record could not be created.");
  }

  console.log("PAYOUT CREATED:", {
    payoutID: payout.id,

    reference: payout.reference,

    amount: payout.amount,

    status: payout.status,
  });

  /* ========================================================
     11. RESERVE WALLET BALANCE
  ========================================================

     The wallet reservation happens BEFORE Paystack is
     called.

     Example:

         Wallet available = ₦50,000
         Payout           = ₦20,000

     Wallet becomes:

         available = ₦30,000

     This prevents another payout from using the same
     money while this payout is being processed.

     IMPORTANT:

     We use the wallet's _version so that concurrent
     requests cannot blindly overwrite the balance.
  ======================================================== */

  let reservedWallet;

  try {
    reservedWallet = await reserveWalletBalance({
      wallet,

      amount: payoutAmount,
    });
  } catch (error) {
    console.error("WALLET RESERVATION FAILED:", error);

    /*
     * Paystack has NOT been called yet.
     *
     * Therefore there is no external transfer to
     * reconcile.
     *
     * We can safely mark the payout as failed.
     */

    try {
      await markPayoutFailed({
        payout,

        reason: `Wallet reservation failed: ${error.message}`,
      });
    } catch (payoutError) {
      console.error("COULD NOT MARK PAYOUT FAILED:", payoutError);
    }

    throw error;
  }

  console.log("WALLET BALANCE RESERVED:", {
    walletID: reservedWallet.id,

    availableBalance: reservedWallet.availableBalance,
  });

  /* ========================================================
     12. CREATE PAYOUT DEBIT TRANSACTION
  ========================================================

     The transaction starts as:

         type   = DEBIT
         status = PENDING

     It represents the money reserved for the payout.

     It will remain PENDING while Paystack is processing
     the transfer.

     The payout webhook/finalization process should later
     change it to COMPLETED when the transfer is confirmed.
  ======================================================== */

  let transaction;

  try {
    transaction = await createDebitTransaction({
      walletID: wallet.id,

      amount: payoutAmount,

      reference,
    });
  } catch (error) {
    console.error("DEBIT TRANSACTION CREATION FAILED:", error);

    /*
     * Paystack has not been called yet.
     *
     * Therefore it is safe to restore the wallet balance.
     */

    try {
      await restoreWalletBalance({
        courierID,

        amount: payoutAmount,
      });
    } catch (restoreError) {
      /*
       * This is a serious reconciliation condition.
       *
       * The wallet was reserved but the transaction could
       * not be created and the restoration also failed.
       */

      console.error("CRITICAL: WALLET RESTORE FAILED:", restoreError);
    }

    try {
      await markPayoutFailed({
        payout,

        reason: `Unable to create payout transaction: ${error.message}`,
      });
    } catch (payoutError) {
      console.error("COULD NOT MARK PAYOUT FAILED:", payoutError);
    }

    throw error;
  }

  if (!transaction?.id) {
    console.error("PAYOUT TRANSACTION WAS NOT CREATED.");

    try {
      await restoreWalletBalance({
        courierID,

        amount: payoutAmount,
      });
    } catch (restoreError) {
      console.error("CRITICAL: WALLET RESTORE FAILED:", restoreError);
    }

    try {
      await markPayoutFailed({
        payout,

        reason: "Unable to create payout transaction.",
      });
    } catch (payoutError) {
      console.error("COULD NOT MARK PAYOUT FAILED:", payoutError);
    }

    throw new Error("Unable to create payout transaction.");
  }

  console.log("PAYOUT DEBIT TRANSACTION CREATED:", {
    transactionID: transaction.id,

    reference: transaction.reference,

    status: transaction.status,
  });

  /* ========================================================
     13. CREATE PAYSTACK TRANSFER RECIPIENT
  ========================================================

     No transfer has been sent yet.

     If recipient creation fails:

         restore wallet
         mark transaction FAILED
         mark payout FAILED

     This is safe because Paystack transfer has not
     started.
  ======================================================== */

  let recipient;

  try {
    recipient = await createTransferRecipient({
      courier,

      secretKey,
    });
  } catch (error) {
    console.error("TRANSFER RECIPIENT ERROR:", error);

    /*
     * No transfer has been attempted.
     *
     * Therefore the wallet reservation can safely
     * be reversed.
     */

    try {
      await restoreWalletBalance({
        courierID,

        amount: payoutAmount,
      });
    } catch (restoreError) {
      console.error("CRITICAL: WALLET RESTORE FAILED:", restoreError);
    }

    try {
      await markTransactionFailed(reference);
    } catch (transactionError) {
      console.error("COULD NOT MARK TRANSACTION FAILED:", transactionError);
    }

    try {
      await markPayoutFailed({
        payout,

        reason: error.message,
      });
    } catch (payoutError) {
      console.error("COULD NOT MARK PAYOUT FAILED:", payoutError);
    }

    throw error;
  }

  console.log("PAYSTACK RECIPIENT:", recipient.recipient_code);

  /* ========================================================
     14. MARK PAYOUT AS PROCESSING BEFORE TRANSFER
  ========================================================

     This is an important safety step.

     From this point forward, the payout is considered
     externally sensitive.

     If Lambda crashes after this point, another payout
     request will see the PROCESSING payout and will NOT
     create another payout.

     This protects against duplicate transfers.
  ======================================================== */

  let processingPayout;

  try {
    processingPayout = await updatePayout({
      payout,

      fields: {
        status: "PROCESSING",

        processedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("COULD NOT MARK PAYOUT PROCESSING:", error);

    /*
     * The Paystack transfer has NOT been sent yet.
     *
     * Therefore restoring the reserved wallet amount
     * is safe.
     */

    try {
      await restoreWalletBalance({
        courierID,

        amount: payoutAmount,
      });
    } catch (restoreError) {
      console.error("CRITICAL: WALLET RESTORE FAILED:", restoreError);
    }

    try {
      await markTransactionFailed(reference);
    } catch (transactionError) {
      console.error("COULD NOT MARK TRANSACTION FAILED:", transactionError);
    }

    try {
      await markPayoutFailed({
        payout,

        reason: `Could not mark payout PROCESSING: ${error.message}`,
      });
    } catch (payoutError) {
      console.error("COULD NOT MARK PAYOUT FAILED:", payoutError);
    }

    throw error;
  }

  if (!processingPayout) {
    throw new Error("Payout could not be moved to PROCESSING.");
  }

  console.log("PAYOUT NOW PROCESSING:", {
    payoutID: processingPayout.id,

    reference: processingPayout.reference,

    status: processingPayout.status,
  });

  /* ========================================================
     15. INITIATE PAYSTACK TRANSFER
  ======================================================== */

  let transfer;

  try {
    transfer = await initiateTransfer({
      amount: payoutAmount,

      recipientCode: recipient.recipient_code,

      reference,

      secretKey,

      courierID,
    });
  } catch (error) {
    console.error("PAYSTACK TRANSFER ERROR:", error);

    /* ======================================================
       15A. VERIFY THE TRANSFER
    ======================================================

       We MUST NOT automatically restore the wallet merely
       because the original HTTP request failed.

       The request could have reached Paystack and the
       response could have been lost.

       Therefore we first ask Paystack whether the
       reference exists.
    ====================================================== */

    let verification = null;

    try {
      verification = await verifyPaystackTransfer(reference, secretKey);
    } catch (verifyError) {
      console.error("TRANSFER VERIFICATION ALSO FAILED:", verifyError);

      /*
       * THIS IS AN UNCERTAIN STATE.
       *
       * We do NOT know whether Paystack received the
       * transfer.
       *
       * Therefore:
       *
       * DO NOT restore wallet.
       *
       * DO NOT mark transaction FAILED.
       *
       * DO NOT create another transfer.
       *
       * Keep payout PROCESSING.
       */

      return {
        success: false,

        status: "PROCESSING",

        reconciliationRequired: true,

        courierID,

        payoutID: processingPayout.id,

        reference,

        amount: payoutAmount,

        message:
          "Transfer outcome is uncertain. Payout remains PROCESSING and requires reconciliation.",
      };
    }

    /* ======================================================
       15B. TRANSFER DOES NOT EXIST
    ====================================================== */

    if (verification.exists === false) {
      /*
       * Paystack confirms that this reference does not
       * exist.
       *
       * Therefore the transfer was not created.
       *
       * It is now safe to restore the wallet.
       */

      try {
        await restoreWalletBalance({
          courierID,

          amount: payoutAmount,
        });
      } catch (restoreError) {
        console.error("CRITICAL: WALLET RESTORE FAILED:", restoreError);

        /*
         * Do not hide this failure.
         *
         * The payout remains recoverable because the
         * payout reference exists in Atua.
         */

        throw new Error(
          `Paystack transfer was not created, but wallet restoration failed: ${restoreError.message}`,
        );
      }

      try {
        await markTransactionFailed(reference);
      } catch (transactionError) {
        console.error("COULD NOT MARK TRANSACTION FAILED:", transactionError);

        throw transactionError;
      }

      await markPayoutFailed({
        payout: processingPayout,

        reason:
          error.message || "Paystack transfer was rejected before creation.",
      });

      return {
        success: false,

        status: "FAILED",

        courierID,

        payoutID: processingPayout.id,

        reference,

        amount: payoutAmount,

        message:
          "Paystack transfer was not created. Wallet balance was restored.",
      };
    }

    /* ======================================================
       15C. TRANSFER EXISTS
    ====================================================== */

    const transferStatus = String(verification.status || "").toLowerCase();

    console.log("VERIFIED PAYSTACK TRANSFER:", {
      reference,

      status: transferStatus,

      transferID: verification.transfer?.id,

      transferCode: verification.transfer?.transfer_code,
    });

    /* ======================================================
       15D. TRANSFER IS PENDING OR SUCCESS
    ====================================================== */

    if (transferStatus === "success" || transferStatus === "pending") {
      /*
       * Paystack has the transfer.
       *
       * Therefore:
       *
       * DO NOT restore wallet.
       *
       * DO NOT create another transfer.
       *
       * DO NOT mark payout FAILED.
       *
       * Keep payout PROCESSING.
       *
       * The transfer webhook should eventually finalize
       * the payout.
       */

      let updatedPayout;

      try {
        updatedPayout = await updatePayout({
          payout: processingPayout,

          fields: {
            transferCode: verification.transfer?.transfer_code || null,

            transferID:
              verification.transfer?.id != null
                ? String(verification.transfer.id)
                : null,
          },
        });
      } catch (updateError) {
        console.error("COULD NOT SAVE PAYSTACK TRANSFER DETAILS:", updateError);

        /*
         * Do NOT restore the wallet.
         *
         * Paystack already has the transfer.
         */

        return {
          success: false,

          status: "PROCESSING",

          reconciliationRequired: true,

          courierID,

          payoutID: processingPayout.id,

          reference,

          amount: payoutAmount,

          message:
            "Paystack transfer exists, but transfer metadata could not be saved. Payout remains PROCESSING and requires reconciliation.",
        };
      }

      if (!updatedPayout) {
        return {
          success: false,

          status: "PROCESSING",

          reconciliationRequired: true,

          courierID,

          payoutID: processingPayout.id,

          reference,

          amount: payoutAmount,

          message:
            "Paystack transfer exists but payout metadata could not be updated. Payout remains PROCESSING.",
        };
      }

      return {
        success: false,

        status: "PROCESSING",

        reconciliationRequired: false,

        courierID,

        payoutID: processingPayout.id,

        reference,

        amount: payoutAmount,

        transferCode: verification.transfer?.transfer_code || null,

        transferID:
          verification.transfer?.id != null
            ? String(verification.transfer.id)
            : null,

        message:
          "Paystack transfer exists and remains PROCESSING. Awaiting transfer webhook.",
      };
    }

    /* ======================================================
       15E. TRANSFER FAILED OR REVERSED
    ====================================================== */

    if (transferStatus === "failed" || transferStatus === "reversed") {
      /*
       * Paystack explicitly confirms that the transfer
       * failed or was reversed.
       *
       * Therefore it is safe to restore the reserved
       * wallet balance.
       */

      const failureReason = verification.transfer?.failures
        ? JSON.stringify(verification.transfer.failures)
        : `Paystack transfer status: ${transferStatus}`;

      try {
        await restoreWalletBalance({
          courierID,

          amount: payoutAmount,
        });
      } catch (restoreError) {
        console.error("CRITICAL: WALLET RESTORE FAILED:", restoreError);

        /*
         * Do not silently continue.
         *
         * The transfer is confirmed failed, but the
         * courier's wallet still needs reconciliation.
         */

        throw new Error(
          `Paystack transfer ${transferStatus}, but wallet restoration failed: ${restoreError.message}`,
        );
      }

      try {
        await markTransactionFailed(reference);
      } catch (transactionError) {
        console.error("COULD NOT MARK TRANSACTION FAILED:", transactionError);

        throw transactionError;
      }

      await markPayoutFailed({
        payout: processingPayout,

        reason: failureReason,

        transfer: verification.transfer,
      });

      return {
        success: false,

        status: "FAILED",

        courierID,

        payoutID: processingPayout.id,

        reference,

        amount: payoutAmount,

        message:
          "Paystack transfer failed/reversed and the wallet balance was restored.",
      };
    }

    /* ======================================================
       15F. UNKNOWN PAYSTACK STATUS
    ======================================================

       If Paystack gives us a status that this Lambda does
       not explicitly understand, we take the conservative
       approach.

       We keep the payout PROCESSING.

       We do NOT restore the wallet.

       We do NOT send another transfer.

       This requires reconciliation rather than risking
       duplicate payment.
    ====================================================== */

    return {
      success: false,

      status: "PROCESSING",

      reconciliationRequired: true,

      courierID,

      payoutID: processingPayout.id,

      reference,

      amount: payoutAmount,

      message: `Unknown Paystack transfer status: ${verification.status}. Payout remains PROCESSING.`,
    };
  }

  /* ========================================================
     16. PAYSTACK ACCEPTED THE TRANSFER
  ========================================================

     Reaching this point means the initial Paystack request
     returned successfully.

     IMPORTANT:

     A successful transfer initiation does NOT necessarily
     mean the courier's bank account has finally received
     the money.

     Paystack may still report:

         pending

     before eventually reporting:

         success

     Therefore the Atua payout remains:

         PROCESSING

     until the Paystack transfer webhook confirms the final
     result.
  ======================================================== */

  console.log("PAYSTACK TRANSFER INITIATED:", {
    reference,

    transferID: transfer?.id,

    transferCode: transfer?.transfer_code,

    status: transfer?.status,
  });

  /* ========================================================
     17. SAVE PAYSTACK TRANSFER DETAILS
  ======================================================== */

  let finalProcessingPayout;

  try {
    finalProcessingPayout = await updatePayout({
      payout: processingPayout,

      fields: {
        /*
         * Keep the payout PROCESSING.
         */

        status: "PROCESSING",

        transferCode: transfer?.transfer_code || null,

        transferID: transfer?.id != null ? String(transfer.id) : null,

        processedAt: processingPayout.processedAt || new Date().toISOString(),
      },
    });
  } catch (updateError) {
    console.error("COULD NOT SAVE PAYSTACK TRANSFER DETAILS:", updateError);

    /*
     * VERY IMPORTANT:
     *
     * Paystack has already accepted the transfer.
     *
     * Therefore we MUST NOT restore the wallet.
     *
     * We also MUST NOT create another transfer.
     *
     * The payout can be recovered by its reference.
     */

    return {
      success: false,

      status: "PROCESSING",

      reconciliationRequired: true,

      courierID,

      payoutID: processingPayout.id,

      reference,

      transferCode: transfer?.transfer_code || null,

      transferID: transfer?.id != null ? String(transfer.id) : null,

      amount: payoutAmount,

      message:
        "Paystack transfer was initiated, but payout metadata could not be fully updated. Reconciliation required.",
    };
  }

  if (!finalProcessingPayout) {
    /*
     * Again, Paystack has already accepted the transfer.
     *
     * Never restore the wallet in this situation.
     */

    return {
      success: false,

      status: "PROCESSING",

      reconciliationRequired: true,

      courierID,

      payoutID: processingPayout.id,

      reference,

      transferCode: transfer?.transfer_code || null,

      transferID: transfer?.id != null ? String(transfer.id) : null,

      amount: payoutAmount,

      message:
        "Paystack transfer was initiated, but payout metadata could not be fully updated. Reconciliation required.",
    };
  }

  /* ========================================================
     18. SUCCESSFULLY INITIATED
  ======================================================== */

  console.log("PAYOUT SUCCESSFULLY INITIATED:", {
    payoutID: finalProcessingPayout.id,

    reference,

    amount: payoutAmount,

    transferCode: transfer?.transfer_code,

    transferID: transfer?.id,

    status: finalProcessingPayout.status,
  });

  return {
    success: true,

    status: "PROCESSING",

    courierID,

    payoutID: finalProcessingPayout.id,

    reference,

    amount: payoutAmount,

    transferCode: transfer?.transfer_code || null,

    transferID: transfer?.id != null ? String(transfer.id) : null,

    message:
      "Payout successfully initiated. Awaiting Paystack transfer confirmation.",
  };
};

/* ==========================================================
   MAIN LAMBDA HANDLER
========================================================== */

exports.handler = async (event) => {
  console.log("==========================================");

  console.log("ATUA PROCESS PAYOUTS STARTED");

  console.log("EVENT:", JSON.stringify(event));

  console.log("==========================================");

  try {
    /* ======================================================
       1. GET PAYSTACK SECRET KEY
    ====================================================== */

    const secretKey = await getPaystackSecretKey();

    /* ======================================================
       2. GET INPUT
    ======================================================

       Depending on how this Lambda is invoked, the input
       may arrive through:

           event.arguments
           event.detail
           event

       We support all three.

       Examples:

       MANUAL_SINGLE:

       {
         "courierID": "COURIER_ID",
         "amount": 10000,
         "payoutMethod": "MANUAL_SINGLE"
       }

       MANUAL_ALL:

       {
         "payoutMethod": "MANUAL_ALL"
       }

       AUTOMATIC:

       {
         "payoutMethod": "AUTOMATIC"
       }
    ====================================================== */

    const argumentsData = event?.arguments || event?.detail || event || {};

    let payoutMethod =
      argumentsData?.payoutMethod || argumentsData?.method || null;

    const courierID =
      argumentsData?.courierID || argumentsData?.courierId || null;

    /* ======================================================
       3. GET REQUESTED AMOUNT
    ====================================================== */

    const requestedAmount =
      argumentsData?.amount !== undefined &&
      argumentsData?.amount !== null &&
      argumentsData?.amount !== ""
        ? Number(argumentsData.amount)
        : null;

    /*
     * If amount was supplied but could not be converted
     * to a valid number, reject it immediately.
     *
     * This prevents values such as:
     *
     *     "abc"
     *
     * from silently becoming an invalid payout.
     */

    if (
      argumentsData?.amount !== undefined &&
      argumentsData?.amount !== null &&
      argumentsData?.amount !== ""
    ) {
      if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
        throw new Error(
          "Payout amount must be a valid number greater than zero.",
        );
      }
    }

    /* ======================================================
       4. DEFAULT TO MANUAL_SINGLE
    ======================================================

       If the caller supplies a courierID but does not
       explicitly specify a payout method, we treat the
       request as a single-courier manual payout.

       Example:

       {
         "courierID": "123"
       }

       becomes:

       {
         "courierID": "123",
         "payoutMethod": "MANUAL_SINGLE"
       }
    ====================================================== */

    if (!payoutMethod && courierID) {
      payoutMethod = "MANUAL_SINGLE";
    }

    /* ======================================================
       5. PAYOUT METHOD IS REQUIRED
    ====================================================== */

    if (!payoutMethod) {
      throw new Error("payoutMethod is required.");
    }

    /*
     * Normalize the value so that:

         manual_single
         Manual_Single
         MANUAL_SINGLE

     * all become:

         MANUAL_SINGLE
     */

    payoutMethod = String(payoutMethod).trim().toUpperCase();

    console.log("NORMALIZED PAYOUT METHOD:", payoutMethod);

    /* ======================================================
       6. MANUAL SINGLE
    ======================================================

       Processes exactly one courier.

       Example:

       {
         "payoutMethod": "MANUAL_SINGLE",
         "courierID": "courier123",
         "amount": 10000
       }

       If amount is omitted, the entire available balance
       is paid out.
    ====================================================== */

    if (payoutMethod === "MANUAL_SINGLE") {
      if (!courierID) {
        throw new Error("courierID is required for MANUAL_SINGLE.");
      }

      const result = await processCourierPayout({
        courierID,

        requestedAmount,

        payoutMethod: "MANUAL_SINGLE",

        secretKey,
      });

      return {
        statusCode: 200,

        body: JSON.stringify(result),
      };
    }

    /* ======================================================
       7. MANUAL ALL
    ======================================================

       Finds every courier wallet with available funds and
       attempts to process a payout for each courier.

       Each courier is processed independently.

       Therefore:

       Courier A fails
       ↓
       Courier B still gets processed

       instead of the first failure terminating the entire
       batch.
    ====================================================== */

    if (payoutMethod === "MANUAL_ALL") {
      /*
       * A specific amount does not make sense for MANUAL_ALL
       * because different couriers have different balances.
       *
       * MANUAL_ALL therefore pays each eligible courier's
       * entire available balance.
       */

      if (requestedAmount !== null) {
        throw new Error(
          "A specific amount cannot be supplied for MANUAL_ALL. Each courier will be paid their available balance.",
        );
      }

      const wallets = await getEligibleWallets();

      console.log("ELIGIBLE WALLETS FOR MANUAL_ALL:", wallets.length);

      const results = [];

      /*
       * Process sequentially rather than firing every payout
       * simultaneously.
       *
       * This reduces:
       *
       * - Paystack request bursts
       * - wallet concurrency conflicts
       * - Lambda/API pressure
       * - accidental duplicate processing
       */

      for (const wallet of wallets) {
        try {
          const result = await processCourierPayout({
            courierID: wallet.ownerID,

            requestedAmount: null,

            payoutMethod: "MANUAL_ALL",

            secretKey,
          });

          results.push(result);
        } catch (error) {
          console.error("MANUAL_ALL PAYOUT ERROR:", {
            courierID: wallet.ownerID,

            error: error?.message,
          });

          /*
           * One courier failing must not prevent the
           * remaining couriers from being processed.
           */

          results.push({
            success: false,

            courierID: wallet.ownerID,

            status: "FAILED",

            message: error?.message || "Payout failed.",
          });
        }
      }

      /* ====================================================
         MANUAL_ALL SUMMARY
      ==================================================== */

      const successful = results.filter((item) => item.success === true).length;

      const failed = results.filter((item) => item.success === false).length;

      const processing = results.filter(
        (item) => item.status === "PROCESSING",
      ).length;

      const skipped = results.filter((item) => item.skipped === true).length;

      return {
        statusCode: 200,

        body: JSON.stringify({
          success: true,

          payoutMethod: "MANUAL_ALL",

          processed: results.length,

          successful,

          failed,

          processing,

          skipped,

          results,
        }),
      };
    }

    /* ======================================================
       8. AUTOMATIC
    ======================================================

       Automatic payout works similarly to MANUAL_ALL.

       The difference is simply the payoutMethod recorded
       against each payout:

           AUTOMATIC

       This allows your system to distinguish automatically
       generated payouts from administrator-triggered
       MANUAL_ALL payouts.
    ====================================================== */

    if (payoutMethod === "AUTOMATIC") {
      /*
       * Automatic payouts also pay the entire available
       * balance of each eligible courier.
       */

      if (requestedAmount !== null) {
        throw new Error(
          "A specific amount cannot be supplied for AUTOMATIC payouts. Each courier will be paid their available balance.",
        );
      }

      const wallets = await getEligibleWallets();

      console.log("ELIGIBLE WALLETS FOR AUTOMATIC PAYOUT:", wallets.length);

      const results = [];

      /*
       * Process sequentially.
       *
       * This is intentionally not Promise.all().
       *
       * We want each payout to complete its wallet/version
       * checks before moving to the next courier.
       */

      for (const wallet of wallets) {
        try {
          const result = await processCourierPayout({
            courierID: wallet.ownerID,

            requestedAmount: null,

            payoutMethod: "AUTOMATIC",

            secretKey,
          });

          results.push(result);
        } catch (error) {
          console.error("AUTOMATIC PAYOUT ERROR:", {
            courierID: wallet.ownerID,

            error: error?.message,
          });

          /*
           * Do not stop the entire automatic payout run
           * because one courier failed.
           */

          results.push({
            success: false,

            courierID: wallet.ownerID,

            status: "FAILED",

            message: error?.message || "Payout failed.",
          });
        }
      }

      /* ====================================================
         AUTOMATIC PAYOUT SUMMARY
      ==================================================== */

      const successful = results.filter((item) => item.success === true).length;

      const failed = results.filter((item) => item.success === false).length;

      const processing = results.filter(
        (item) => item.status === "PROCESSING",
      ).length;

      const skipped = results.filter((item) => item.skipped === true).length;

      return {
        statusCode: 200,

        body: JSON.stringify({
          success: true,

          payoutMethod: "AUTOMATIC",

          processed: results.length,

          successful,

          failed,

          processing,

          skipped,

          results,
        }),
      };
    }

    /* ======================================================
       9. INVALID PAYOUT METHOD
    ====================================================== */

    throw new Error(`Unsupported payoutMethod: ${payoutMethod}`);
  } catch (error) {
    /* ======================================================
       GLOBAL ERROR HANDLER
    ====================================================== */

    console.error("==========================================");

    console.error("ATUA PROCESS PAYOUTS ERROR");

    console.error("MESSAGE:", error?.message);

    console.error("STACK:", error?.stack);

    console.error("==========================================");

    return {
      statusCode: 500,

      body: JSON.stringify({
        success: false,

        status: "FAILED",

        message: error?.message || "Payout processing failed.",
      }),
    };
  }
};
