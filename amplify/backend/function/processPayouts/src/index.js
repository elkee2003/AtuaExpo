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
   PAYOUT FINANCIAL RULES
========================================================== */

/*
 * The ₦100 fee applies ONLY when a courier personally
 * requests a payout.
 *
 * Admin-created payouts do NOT have this fee.
 */
const COURIER_REQUESTED_PAYOUT_FEE = 100;

/*
 * Minimum payout amount when the COURIER personally
 * requests the payout.
 *
 * IMPORTANT:
 *
 * This minimum does NOT apply to admin payouts.
 *
 * Admin can pay:
 *
 *   ₦500
 *   ₦1,000
 *   ₦2,000
 *   etc.
 *
 * provided the courier has that amount available.
 */
const MIN_COURIER_REQUESTED_PAYOUT = 3000;

/* ==========================================================
   PAYOUT SOURCES
========================================================== */

const PAYOUT_SOURCE = {
  COURIER_REQUESTED: "COURIER_REQUESTED",

  ADMIN_MANUAL: "ADMIN_MANUAL",

  SYSTEM: "SYSTEM",
};

/* ==========================================================
   PAYOUT METHODS
========================================================== */

const PAYOUT_METHOD = {
  MANUAL_SINGLE: "MANUAL_SINGLE",

  MANUAL_ALL: "MANUAL_ALL",

  AUTOMATIC: "AUTOMATIC",
};

/* ==========================================================
   GET PAYSTACK SECRET KEY FROM AWS SSM
========================================================== */

const getPaystackSecretKey = async () => {
  /*
   * PAYSTACK_SECRET_KEY contains the NAME/PATH of the
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

            payoutSource

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

            payoutSource

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
   * Paystack expects NGN transfers in kobo.
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

    error.isPaystackUnknown = true;

    throw error;
  }

  return transfer;
};

/* ==========================================================
   VERIFY PAYSTACK TRANSFER
========================================================== */

const verifyPaystackTransfer = async (reference, secretKey) => {
  const encodedReference = encodeURIComponent(reference);

  const response = await paystackRequest({
    method: "GET",

    path: `/transfer/verify/${encodedReference}`,

    secretKey,
  });

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
  payoutSource,
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

          payoutSource

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

        status: "PENDING",

        bankName: courier.bankName,

        accountNumber: courier.accountNumber,

        reference,

        payoutMethod,

        payoutSource,
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

          payoutSource

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
========================================================== */

const restoreWalletBalance = async ({ courierID, amount }) => {
  const wallet = await getCourierWallet(courierID);

  if (!wallet) {
    throw new Error("Courier wallet not found during restoration.");
  }

  const currentAvailable = Number(wallet.availableBalance || 0);

  if (!Number.isFinite(currentAvailable)) {
    throw new Error("Wallet available balance is invalid.");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid wallet restoration amount.");
  }

  const newAvailable = Number((currentAvailable + amount).toFixed(2));

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

  const restoredWallet = data?.updateWallet;

  if (!restoredWallet) {
    throw new Error("Wallet restoration failed.");
  }

  return restoredWallet;
};

/* ==========================================================
   CREATE PAYOUT DEBIT TRANSACTION
========================================================== */

const createDebitTransaction = async ({
  walletID,
  amount,
  reference,
  description = "Courier payout initiated.",
}) => {
  /*
   * IMPORTANT:
   *
   * Keep this idempotency protection.
   *
   * If Lambda retries after the transaction was already
   * created, we reuse the existing transaction instead
   * of creating a second DEBIT.
   */

  const existingTransaction = await getTransactionByReference(reference);

  if (existingTransaction) {
    console.log("EXISTING PAYOUT TRANSACTION FOUND:", {
      transactionID: existingTransaction.id,

      reference: existingTransaction.reference,

      status: existingTransaction.status,
    });

    if (existingTransaction.walletID !== walletID) {
      throw new Error(
        "Existing payout transaction belongs to a different wallet.",
      );
    }

    const existingAmount = Number(existingTransaction.amount);

    if (
      Number.isFinite(existingAmount) &&
      Math.abs(existingAmount - Number(amount)) > 0.01
    ) {
      throw new Error(
        "Existing payout transaction amount does not match the requested amount.",
      );
    }

    return existingTransaction;
  }

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

        description,

        reference,

        status: "PENDING",
      },
    },

    "CreatePayoutDebitTransaction",
  );

  const transaction = data?.createTransaction;

  if (!transaction) {
    throw new Error("Payout debit transaction could not be created.");
  }

  return transaction;
};

/* ==========================================================
   MARK TRANSACTION COMPLETED
========================================================== */

const markTransactionCompleted = async (reference) => {
  const transaction = await getTransactionByReference(reference);

  if (!transaction) {
    throw new Error(`Payout transaction not found for reference: ${reference}`);
  }

  if (transaction.status === "COMPLETED") {
    return transaction;
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

    status: "COMPLETED",
  };

  if (Number.isInteger(transaction._version)) {
    input._version = transaction._version;
  }

  const data = await graphqlRequest(
    mutation,

    {
      input,
    },

    "MarkTransactionCompleted",
  );

  const updatedTransaction = data?.updateTransaction;

  if (!updatedTransaction) {
    throw new Error("Payout transaction could not be marked COMPLETED.");
  }

  return updatedTransaction;
};

/* ==========================================================
   MARK TRANSACTION FAILED
========================================================== */

/*
 * THIS IS THE ONLY markTransactionFailed()
 * IN THE ENTIRE FILE.
 *
 * Do NOT add another version in Part 2 or Part 3.
 */
const markTransactionFailed = async (reference) => {
  const transaction = await getTransactionByReference(reference);

  if (!transaction) {
    throw new Error(`Payout transaction not found for reference: ${reference}`);
  }

  if (transaction.status === "FAILED") {
    return transaction;
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
  };

  if (Number.isInteger(transaction._version)) {
    input._version = transaction._version;
  }

  const data = await graphqlRequest(
    mutation,

    {
      input,
    },

    "MarkTransactionFailed",
  );

  const updatedTransaction = data?.updateTransaction;

  if (!updatedTransaction) {
    throw new Error("Payout transaction could not be marked FAILED.");
  }

  return updatedTransaction;
};

/* ==========================================================
   MARK PAYOUT FAILED
========================================================== */

const markPayoutFailed = async ({ payout, reason, transfer = null }) => {
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

          payoutSource

          processedAt
          paidAt
          failedAt

          _version
        }
      }
    `;

  const input = {
    id: payout.id,

    status: "FAILED",

    failureReason: reason || "Payout failed.",
  };

  if (transfer?.transfer_code) {
    input.transferCode = transfer.transfer_code;
  }

  if (transfer?.id != null) {
    input.transferID = String(transfer.id);
  }

  if (Number.isInteger(payout._version)) {
    input._version = payout._version;
  }

  const data = await graphqlRequest(
    mutation,

    {
      input,
    },

    "MarkPayoutFailed",
  );

  const failedPayout = data?.updatePayout;

  if (!failedPayout) {
    throw new Error("Payout could not be marked FAILED.");
  }

  return failedPayout;
};

/* ==========================================================
   MARK PAYOUT PAID
========================================================== */

const markPayoutPaid = async ({ payout, transfer = null }) => {
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

          payoutSource

          processedAt
          paidAt
          failedAt

          _version
        }
      }
    `;

  const input = {
    id: payout.id,

    status: "PAID",

    paidAt: new Date().toISOString(),
  };

  if (transfer?.transfer_code) {
    input.transferCode = transfer.transfer_code;
  }

  if (transfer?.id != null) {
    input.transferID = String(transfer.id);
  }

  if (Number.isInteger(payout._version)) {
    input._version = payout._version;
  }

  const data = await graphqlRequest(
    mutation,

    {
      input,
    },

    "MarkPayoutPaid",
  );

  const paidPayout = data?.updatePayout;

  if (!paidPayout) {
    throw new Error("Payout could not be marked PAID.");
  }

  return paidPayout;
};
/* ==========================================================
   REQUEST PAYOUT REVERSAL
==========================================================

   IMPORTANT FINANCIAL RULE:

   Once Paystack has received/created the transfer, this
   Lambda must NOT directly restore the wallet.

   Instead:

       processPayouts
            ↓
       reversePayout
            ↓
       restore wallet
            ↓
       mark transaction FAILED
            ↓
       mark payout FAILED

   This keeps wallet restoration in one controlled place
   and protects against double restoration.
========================================================== */

const requestPayoutReversal = async ({
  payout,
  transaction,
  failureReason,
  eventType,
  transfer = null,
}) => {
  if (!payout?.id) {
    throw new Error("Payout is required for reversal.");
  }

  if (!transaction?.id) {
    throw new Error("Transaction is required for payout reversal.");
  }

  /*
   * The Transaction.amount is authoritative for restoration.
   *
   * This is especially important for courier-requested
   * payouts because:
   *
   *     payout.amount
   *
   * is only the amount sent to the courier, while:
   *
   *     transaction.amount
   *
   * includes the ₦100 courier-request fee.
   *
   * Example:
   *
   *     payout.amount      = ₦5,000
   *     transaction.amount = ₦5,100
   *
   * Wallet restoration must therefore be ₦5,100.
   */

  const restorationAmount = Number(transaction.amount);

  if (!Number.isFinite(restorationAmount) || restorationAmount <= 0) {
    throw new Error("Invalid payout transaction restoration amount.");
  }

  const mutation = `
    mutation ReversePayout(
      $input: ReversePayoutInput!
    ) {
      reversePayout(
        input: $input
      ) {
        statusCode

        body
      }
    }
  `;

  const input = {
    payoutID: payout.id,

    transactionID: transaction.id,

    restorationAmount,

    failureReason: failureReason || "Paystack payout failed or was reversed.",

    eventType: eventType || "TRANSFER_FAILED",

    transferCode: transfer?.transfer_code || payout.transferCode || null,

    transferID:
      transfer?.id != null ? String(transfer.id) : payout.transferID || null,
  };

  console.log("REQUESTING PAYOUT REVERSAL:", input);

  const data = await graphqlRequest(
    mutation,

    {
      input,
    },

    "ReversePayout",
  );

  const result = data?.reversePayout;

  if (!result) {
    throw new Error("ReversePayout returned no response.");
  }

  /*
   * reversePayout is responsible for determining the actual
   * financial outcome.
   *
   * We therefore do not assume that receiving HTTP/GraphQL
   * success means the wallet has already been restored.
   */

  console.log("REVERSE PAYOUT RESPONSE:", result);

  return result;
};

/* ==========================================================
   GET INPUT ARGUMENTS
==========================================================

   AppSync function invocations normally provide:

       event.arguments

   but the existing Lambda has historically supported
   several invocation shapes.

   Keep that compatibility here.
========================================================== */

const getInputArguments = (event) => {
  return event?.arguments || event?.input || event?.detail || event || {};
};

/* ==========================================================
   GET APPSYNC FIELD NAME
==========================================================

   The same processPayouts Lambda now handles:

       adminMakePayout
       adminMakeAllPayouts

   Therefore the Lambda needs to know which GraphQL
   mutation invoked it.

   AppSync provides:

       event.info.fieldName

   We retain compatibility fallbacks as well.
========================================================== */

const getAppSyncFieldName = (event) => {
  return (
    event?.info?.fieldName ||
    event?.fieldName ||
    event?.arguments?.fieldName ||
    null
  );
};

/* ==========================================================
   NORMALIZE PAYOUT SOURCE
========================================================== */

const normalizePayoutSourceForProcessing = ({ payoutSource, payoutMethod }) => {
  /*
   * If an explicit source was supplied internally,
   * validate and preserve it.
   */

  if (payoutSource) {
    const normalized = String(payoutSource).trim().toUpperCase();

    if (
      normalized === PAYOUT_SOURCE.COURIER_REQUESTED ||
      normalized === PAYOUT_SOURCE.ADMIN_MANUAL ||
      normalized === PAYOUT_SOURCE.SYSTEM
    ) {
      return normalized;
    }

    throw new Error(`Invalid payout source: ${payoutSource}`);
  }

  /*
   * Existing courier application flow.
   *
   * BANK_TRANSFER means the courier personally requested
   * a manual bank payout.
   */

  if (
    String(payoutMethod || "")
      .trim()
      .toUpperCase() === "BANK_TRANSFER"
  ) {
    return PAYOUT_SOURCE.COURIER_REQUESTED;
  }

  /*
   * Automatic/system payout.
   */

  if (
    String(payoutMethod || "")
      .trim()
      .toUpperCase() === PAYOUT_METHOD.AUTOMATIC
  ) {
    return PAYOUT_SOURCE.SYSTEM;
  }

  /*
   * Manual single/all without an explicit courier source
   * means administrator-created payout.
   */

  if (
    String(payoutMethod || "")
      .trim()
      .toUpperCase() === PAYOUT_METHOD.MANUAL_SINGLE ||
    String(payoutMethod || "")
      .trim()
      .toUpperCase() === PAYOUT_METHOD.MANUAL_ALL
  ) {
    return PAYOUT_SOURCE.ADMIN_MANUAL;
  }

  throw new Error("Payout source could not be determined.");
};

/* ==========================================================
   NORMALIZE PAYOUT METHOD
========================================================== */

const normalizePayoutMethodForProcessing = ({ payoutMethod, payoutSource }) => {
  const method = String(payoutMethod || "")
    .trim()
    .toUpperCase();

  /*
   * Preserve the existing courier application.
   *
   * The courier app can continue sending:
   *
   *     BANK_TRANSFER
   *
   * Internally this becomes:
   *
   *     MANUAL_SINGLE
   */

  if (method === "BANK_TRANSFER") {
    return PAYOUT_METHOD.MANUAL_SINGLE;
  }

  if (
    method === PAYOUT_METHOD.MANUAL_SINGLE ||
    method === PAYOUT_METHOD.MANUAL_ALL ||
    method === PAYOUT_METHOD.AUTOMATIC
  ) {
    return method;
  }

  /*
   * If the source is explicitly courier-requested and
   * no method was supplied, use MANUAL_SINGLE.
   */

  if (payoutSource === PAYOUT_SOURCE.COURIER_REQUESTED) {
    return PAYOUT_METHOD.MANUAL_SINGLE;
  }

  throw new Error(`Invalid payout method: ${payoutMethod}`);
};

/* ==========================================================
   NORMALIZE REQUESTED PAYOUT AMOUNT
==========================================================

   Financial rules:

   COURIER_REQUESTED
   -----------------
   - Courier chooses amount.
   - Minimum = ₦3,000.
   - ₦100 fee applies.
   - Amount plus fee must fit inside available balance.

   ADMIN_MANUAL
   ------------
   - No ₦3,000 minimum.
   - No ₦100 fee.
   - Requested amount must not exceed current balance.
   - If amount is omitted, use the entire available balance.

   SYSTEM
   ------
   - Uses the supplied amount if present.
   - Otherwise uses the entire available balance.
========================================================== */

const normalizeRequestedPayoutAmount = ({
  requestedAmount,
  payoutSource,
  wallet,
}) => {
  const currentAvailable = Number(wallet?.availableBalance || 0);

  if (!Number.isFinite(currentAvailable) || currentAvailable < 0) {
    throw new Error("Wallet available balance is invalid.");
  }

  const hasRequestedAmount =
    requestedAmount !== undefined &&
    requestedAmount !== null &&
    requestedAmount !== "";

  /* ========================================================
     ADMIN MANUAL
  ======================================================== */

  if (payoutSource === PAYOUT_SOURCE.ADMIN_MANUAL) {
    /*
     * If no amount is supplied, empty the entire wallet.
     *
     * This is useful for the admin "Empty Wallet" action.
     */

    if (!hasRequestedAmount) {
      return Number(currentAvailable.toFixed(2));
    }

    const amount = Number(requestedAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Requested payout amount must be greater than zero.");
    }

    const normalizedAmount = Number(amount.toFixed(2));

    /*
     * Admin cannot pay more than the LIVE available
     * balance.
     */

    if (normalizedAmount > currentAvailable) {
      throw new Error("Requested payout amount exceeds available balance.");
    }

    return normalizedAmount;
  }

  /* ========================================================
     COURIER REQUESTED
  ======================================================== */

  if (payoutSource === PAYOUT_SOURCE.COURIER_REQUESTED) {
    /*
     * No supplied amount means the courier wants the
     * entire available balance.
     */

    if (!hasRequestedAmount) {
      const fullBalance = Number(currentAvailable.toFixed(2));

      if (fullBalance < MIN_COURIER_REQUESTED_PAYOUT) {
        throw new Error(
          `Minimum courier payout is ₦${MIN_COURIER_REQUESTED_PAYOUT.toLocaleString()}.`,
        );
      }

      return fullBalance;
    }

    const amount = Number(requestedAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Payout amount must be greater than zero.");
    }

    const normalizedAmount = Number(amount.toFixed(2));

    /*
     * Courier-requested minimum is ₦3,000.
     */

    if (normalizedAmount < MIN_COURIER_REQUESTED_PAYOUT) {
      throw new Error(
        `Minimum courier payout is ₦${MIN_COURIER_REQUESTED_PAYOUT.toLocaleString()}.`,
      );
    }

    return normalizedAmount;
  }

  /* ========================================================
     SYSTEM
  ======================================================== */

  if (payoutSource === PAYOUT_SOURCE.SYSTEM) {
    if (hasRequestedAmount) {
      const amount = Number(requestedAmount);

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Payout amount must be greater than zero.");
      }

      if (amount > currentAvailable) {
        throw new Error("Requested payout amount exceeds available balance.");
      }

      return Number(amount.toFixed(2));
    }

    return Number(currentAvailable.toFixed(2));
  }

  throw new Error("Unable to determine payout amount.");
};

/* ==========================================================
   CALCULATE PAYOUT FINANCIALS
========================================================== */

const calculatePayoutFinancials = ({ payoutAmount, payoutSource }) => {
  /*
   * Only courier-requested payouts carry the ₦100 fee.
   *
   * Admin payouts:
   *
   *     fee = ₦0
   */

  const payoutFee =
    payoutSource === PAYOUT_SOURCE.COURIER_REQUESTED
      ? COURIER_REQUESTED_PAYOUT_FEE
      : 0;

  /*
   * This is the total amount that leaves the courier's
   * available wallet balance.
   */

  const totalWalletDebit = Number((payoutAmount + payoutFee).toFixed(2));

  return {
    payoutAmount,

    payoutFee,

    totalWalletDebit,
  };
};

/* ==========================================================
   VALIDATE PAYOUT AGAINST WALLET
========================================================== */

const validatePayoutAgainstWallet = ({
  wallet,
  totalWalletDebit,
  payoutSource,
}) => {
  const availableBalance = Number(wallet?.availableBalance || 0);

  if (!Number.isFinite(availableBalance) || availableBalance < 0) {
    throw new Error("Wallet available balance is invalid.");
  }

  if (totalWalletDebit > availableBalance) {
    if (payoutSource === PAYOUT_SOURCE.COURIER_REQUESTED) {
      throw new Error(
        "Payout amount plus the ₦100 payout fee exceeds available balance.",
      );
    }

    throw new Error("Requested payout amount exceeds available balance.");
  }
};

/* ==========================================================
   GET ELIGIBLE WALLETS
==========================================================

   Used for:

       ADMIN_MANUAL / MANUAL_ALL
       SYSTEM / AUTOMATIC

   Only wallets with a positive available balance are
   returned.

   Each wallet is re-read again inside
   processCourierPayout() before reservation.
========================================================== */

const getEligibleWallets = async () => {
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

  const wallets = [];

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

    const items = data?.listWallets?.items || [];

    /*
     * Any courier with a positive balance is eligible.
     *
     * There is deliberately NO ₦3,000 check here.
     *
     * The ₦3,000 minimum belongs only to the
     * courier-requested payout path.
     */

    for (const wallet of items) {
      const balance = Number(wallet.availableBalance || 0);

      if (Number.isFinite(balance) && balance > 0 && wallet.ownerID) {
        wallets.push(wallet);
      }
    }

    nextToken = data?.listWallets?.nextToken || null;
  } while (nextToken);

  return wallets;
};

/* ==========================================================
   NORMALIZE TRANSFER STATUS
========================================================== */

const normalizeStatus = (status) => {
  if (status === undefined || status === null) {
    return null;
  }

  return String(status).trim().toLowerCase();
};

/* ==========================================================
   TRANSFER STATUS HELPERS
========================================================== */

const isSuccessfulTransferStatus = (status) => {
  const normalized = normalizeStatus(status);

  return (
    normalized === "success" ||
    normalized === "successful" ||
    normalized === "completed"
  );
};

const isFailedTransferStatus = (status) => {
  const normalized = normalizeStatus(status);

  return normalized === "failed" || normalized === "reversed";
};

const isPendingTransferStatus = (status) => {
  const normalized = normalizeStatus(status);

  return (
    normalized === "pending" ||
    normalized === "processing" ||
    normalized === "otp" ||
    normalized === "queued"
  );
};

/* ==========================================================
   SIMPLE NUMBER HELPER
========================================================== */

const toNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
};

/* ==========================================================
   FIRST DEFINED VALUE
========================================================== */

const firstDefined = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
};

/* ==========================================================
   REQUIRE VALUE
========================================================== */

const requireValue = (value, message) => {
  if (value === undefined || value === null || value === "") {
    throw new Error(message);
  }

  return value;
};

/* ==========================================================
   ERROR MESSAGE HELPER
========================================================== */

const getErrorMessage = (error) => {
  if (!error) {
    return "Unknown error.";
  }

  if (typeof error === "string") {
    return error;
  }

  return error.message || "Unknown error.";
};

/* ==========================================================
   GENERATE PAYOUT REFERENCE
==========================================================

   The current source calls generatePayoutReference()
   when creating a payout, but does not define the helper.

   Keep the reference:

       - unique
       - deterministic enough for logging
       - short enough for Paystack
       - based on courier + timestamp + random suffix

   The reference is also used as the shared identifier
   between:

       Payout
       Transaction
       Paystack transfer

   Therefore it MUST remain stable once generated.
========================================================== */

const generatePayoutReference = (courierID) => {
  const timestamp = Date.now().toString(36);

  const randomPart = crypto.randomBytes(6).toString("hex");

  /*
   * Remove characters that could make the reference
   * unnecessarily complicated.
   */

  const courierPart = String(courierID || "COURIER")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-12);

  return `ATUA-PAYOUT-${courierPart}-${timestamp}-${randomPart}`;
};

/* ==========================================================
   PROCESS ONE COURIER PAYOUT
==========================================================

   This is the core payout operation.

   It is used by:

       1. Courier-requested payout
       2. Admin payout to one courier
       3. Admin payout to all couriers
       4. Automatic/system payout

   The financial rules are determined by payoutSource.
========================================================== */

const processCourierPayout = async ({
  courierID,
  requestedAmount,
  payoutMethod,
  payoutSource,
  secretKey,
}) => {
  console.log("==================================================");

  console.log("PROCESSING COURIER PAYOUT");

  console.log({
    courierID,

    requestedAmount,

    payoutMethod,

    payoutSource,
  });

  console.log("==================================================");

  /* ========================================================
     1. NORMALIZE SOURCE
  ======================================================== */

  const normalizedPayoutSource = normalizePayoutSourceForProcessing({
    payoutSource,

    payoutMethod,
  });

  /* ========================================================
     2. NORMALIZE METHOD
  ======================================================== */

  const normalizedPayoutMethod = normalizePayoutMethodForProcessing({
    payoutMethod,

    payoutSource: normalizedPayoutSource,
  });

  console.log("NORMALIZED PAYOUT DETAILS:", {
    payoutSource: normalizedPayoutSource,

    payoutMethod: normalizedPayoutMethod,
  });

  /* ========================================================
     3. GET COURIER
  ======================================================== */

  const courier = await getCourier(courierID);

  if (!courier) {
    throw new Error(`Courier not found: ${courierID}`);
  }

  /* ========================================================
     4. GET FRESH WALLET
  ========================================================

     IMPORTANT:

     Never trust the balance supplied by the frontend.

     The wallet is read directly from AppSync.

     This is especially important for:

         ADMIN_MANUAL

     because an admin page may have been open for some
     time before the administrator clicks "Make Payout".
  ======================================================== */

  const wallet = await getCourierWallet(courierID);

  if (!wallet) {
    throw new Error(`Wallet not found for courier: ${courierID}`);
  }

  /* ========================================================
     5. CHECK ACTIVE PAYOUT
  ======================================================== */

  const activePayouts = await getActiveCourierPayouts(courierID);

  if (activePayouts.length > 0) {
    const activePayout = activePayouts[0];

    console.log("ACTIVE PAYOUT ALREADY EXISTS:", {
      payoutID: activePayout.id,

      reference: activePayout.reference,

      amount: activePayout.amount,

      status: activePayout.status,
    });

    return {
      success: false,

      skipped: true,

      status: activePayout.status,

      courierID,

      payoutID: activePayout.id,

      reference: activePayout.reference,

      amount: activePayout.amount,

      message: "Courier already has a payout being processed.",
    };
  }

  /* ========================================================
     6. DETERMINE PAYOUT AMOUNT
  ======================================================== */

  const payoutAmount = normalizeRequestedPayoutAmount({
    requestedAmount,

    payoutSource: normalizedPayoutSource,

    wallet,
  });

  if (!Number.isFinite(payoutAmount) || payoutAmount <= 0) {
    throw new Error("Payout amount must be greater than zero.");
  }

  /* ========================================================
     7. CALCULATE FINANCIALS
  ======================================================== */

  const { payoutFee, totalWalletDebit } = calculatePayoutFinancials({
    payoutAmount,

    payoutSource: normalizedPayoutSource,
  });

  console.log("PAYOUT FINANCIALS:", {
    payoutAmount,

    payoutFee,

    totalWalletDebit,

    payoutSource: normalizedPayoutSource,
  });

  /* ========================================================
     8. FINAL BALANCE VALIDATION
  ======================================================== */

  validatePayoutAgainstWallet({
    wallet,

    totalWalletDebit,

    payoutSource: normalizedPayoutSource,
  });

  /* ========================================================
     9. GENERATE UNIQUE PAYOUT REFERENCE
  ======================================================== */

  const reference = generatePayoutReference(courierID);

  console.log("PAYOUT REFERENCE:", reference);

  /* ========================================================
     10. CREATE PAYOUT RECORD
  ========================================================

     Payout.amount is ONLY the amount sent to the courier.

     It does NOT include the ₦100 courier-request fee.

     Example:

         payout.amount = ₦5,000
         transaction.amount = ₦5,100

     For admin:

         payout.amount = ₦5,000
         transaction.amount = ₦5,000
  ======================================================== */

  const payout = await createPayout({
    courierID,

    walletID: wallet.id,

    amount: payoutAmount,

    courier,

    reference,

    payoutMethod: normalizedPayoutMethod,

    payoutSource: normalizedPayoutSource,
  });

  if (!payout?.id) {
    throw new Error("Payout record could not be created.");
  }

  console.log("PAYOUT CREATED:", {
    payoutID: payout.id,

    reference: payout.reference,

    amount: payout.amount,

    payoutMethod: payout.payoutMethod,

    payoutSource: payout.payoutSource,

    status: payout.status,
  });

  /* ========================================================
     11. RESERVE WALLET BALANCE
  ======================================================== */

  let reservedWallet;

  try {
    reservedWallet = await reserveWalletBalance({
      wallet,

      amount: totalWalletDebit,
    });
  } catch (error) {
    console.error("WALLET RESERVATION FAILED:", error);

    /*
     * Paystack has NOT been called yet.
     *
     * Therefore there is no external transfer to
     * reconcile.
     */

    try {
      await markPayoutFailed({
        payout,

        reason: `Wallet reservation failed: ${getErrorMessage(error)}`,
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

     Transaction.amount is the TOTAL wallet deduction.

     Courier-requested:

         payout = ₦5,000
         fee    = ₦100
         transaction = ₦5,100

     Admin:

         payout = ₦5,000
         fee    = ₦0
         transaction = ₦5,000
  ======================================================== */

  let transaction;

  try {
    transaction = await createDebitTransaction({
      walletID: wallet.id,

      amount: totalWalletDebit,

      reference,

      description:
        payoutFee > 0
          ? `Courier payout initiated. Payout ₦${payoutAmount.toFixed(
              2,
            )} + ₦${payoutFee.toFixed(2)} fee.`
          : "Courier payout initiated.",
    });
  } catch (error) {
    console.error("DEBIT TRANSACTION CREATION FAILED:", error);

    /*
     * Paystack has NOT been called yet.
     *
     * Therefore it is safe to restore the reserved
     * wallet amount.
     */

    try {
      await restoreWalletBalance({
        courierID,

        amount: totalWalletDebit,
      });
    } catch (restoreError) {
      console.error("CRITICAL: WALLET RESTORE FAILED:", restoreError);
    }

    try {
      await markPayoutFailed({
        payout,

        reason: `Unable to create payout transaction: ${getErrorMessage(
          error,
        )}`,
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

        amount: totalWalletDebit,
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

    amount: transaction.amount,

    status: transaction.status,
  });

  /* ========================================================
     13. CREATE PAYSTACK TRANSFER RECIPIENT
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
     * No Paystack transfer has been attempted.
     *
     * Therefore restoring the reserved wallet amount
     * is safe.
     */

    try {
      await restoreWalletBalance({
        courierID,

        amount: totalWalletDebit,
      });
    } catch (restoreError) {
      console.error("CRITICAL: WALLET RESTORE FAILED:", restoreError);
    }

    /*
     * IMPORTANT:
     *
     * Part 1 already contains the ONLY
     * markTransactionFailed(reference) helper.
     *
     * Do NOT create another definition.
     */

    try {
      await markTransactionFailed(reference);
    } catch (transactionError) {
      console.error("COULD NOT MARK TRANSACTION FAILED:", transactionError);
    }

    try {
      await markPayoutFailed({
        payout,

        reason: getErrorMessage(error),
      });
    } catch (payoutError) {
      console.error("COULD NOT MARK PAYOUT FAILED:", payoutError);
    }

    throw error;
  }

  console.log("PAYSTACK RECIPIENT:", recipient.recipient_code);

  /* ========================================================
     14. MARK PAYOUT PROCESSING BEFORE TRANSFER
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
     * Paystack has NOT been called yet.
     *
     * Therefore restoring the reserved amount is safe.
     */

    try {
      await restoreWalletBalance({
        courierID,

        amount: totalWalletDebit,
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

        reason: `Could not mark payout PROCESSING: ${getErrorMessage(error)}`,
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
      /*
       * Paystack receives ONLY the payout amount.
       *
       * The ₦100 courier-request fee is NOT sent
       * to the courier.
       */

      amount: payoutAmount,

      recipientCode: recipient.recipient_code,

      reference,

      secretKey,

      courierID,
    });
  } catch (error) {
    console.error("PAYSTACK TRANSFER ERROR:", error);

    /* ======================================================
       15A. VERIFY TRANSFER AFTER ERROR
    ====================================================== */

    let verification = null;

    try {
      verification = await verifyPaystackTransfer(reference, secretKey);
    } catch (verifyError) {
      console.error("TRANSFER VERIFICATION ALSO FAILED:", verifyError);

      /*
       * UNCERTAIN STATE.
       *
       * We do NOT:
       *
       * - restore wallet
       * - mark transaction FAILED
       * - create another transfer
       *
       * The payout remains PROCESSING and can be resolved
       * by reconcilePayouts.
       */

      return {
        success: false,

        status: "PROCESSING",

        reconciliationRequired: true,

        courierID,

        payoutID: processingPayout.id,

        reference,

        amount: payoutAmount,

        payoutFee,

        totalWalletDebit,

        message:
          "Transfer outcome is uncertain. Payout remains PROCESSING and requires reconciliation.",
      };
    }

    /* ======================================================
       15B. TRANSFER DOES NOT EXIST
    ====================================================== */

    if (verification.exists === false) {
      /*
       * Paystack confirms that the transfer reference
       * does not exist.
       *
       * Therefore the transfer was not created.
       *
       * It is safe to restore the wallet.
       */

      try {
        await restoreWalletBalance({
          courierID,

          amount: totalWalletDebit,
        });
      } catch (restoreError) {
        console.error("CRITICAL: WALLET RESTORE FAILED:", restoreError);

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

      try {
        await markPayoutFailed({
          payout: processingPayout,

          reason: "Paystack transfer was not created.",
        });
      } catch (payoutError) {
        console.error("COULD NOT MARK PAYOUT FAILED:", payoutError);

        throw payoutError;
      }

      return {
        success: false,

        status: "FAILED",

        courierID,

        payoutID: processingPayout.id,

        reference,

        amount: payoutAmount,

        payoutFee,

        totalWalletDebit,

        message:
          "Paystack transfer was not created and the wallet balance was restored.",
      };
    }

    /* ======================================================
       15C. TRANSFER EXISTS
    ====================================================== */

    const transferStatus = normalizeStatus(verification.status);

    console.log("PAYSTACK TRANSFER VERIFICATION:", {
      reference,

      exists: verification.exists,

      status: transferStatus,

      transferID: verification.transfer?.id,
    });

    /* ======================================================
       15D. TRANSFER STILL PROCESSING
    ====================================================== */

    if (isPendingTransferStatus(transferStatus)) {
      /*
       * Paystack has the transfer, but the final outcome
       * has not yet been confirmed.
       *
       * DO NOT:
       *
       * - restore the wallet
       * - mark the transaction failed
       * - create another transfer
       */

      return {
        success: false,

        status: "PROCESSING",

        reconciliationRequired: false,

        courierID,

        payoutID: processingPayout.id,

        reference,

        amount: payoutAmount,

        payoutFee,

        totalWalletDebit,

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
       15E. TRANSFER FAILED / REVERSED
    ====================================================== */

    if (isFailedTransferStatus(transferStatus)) {
      /*
       * Paystack has explicitly confirmed failure/reversal.
       *
       * IMPORTANT:
       *
       * We DO NOT directly restore the wallet here.
       *
       * We route the operation through reversePayout.
       */

      const failureReason = verification.transfer?.failures
        ? JSON.stringify(verification.transfer.failures)
        : `Paystack transfer status: ${transferStatus}`;

      try {
        const reversalResult = await requestPayoutReversal({
          payout: processingPayout,

          transaction,

          failureReason,

          eventType:
            transferStatus === "reversed"
              ? "TRANSFER_REVERSED"
              : "TRANSFER_FAILED",

          transfer: verification.transfer,
        });

        return {
          success: false,

          status: "FAILED",

          courierID,

          payoutID: processingPayout.id,

          reference,

          amount: payoutAmount,

          payoutFee,

          totalWalletDebit,

          reversal: reversalResult,

          message:
            "Paystack transfer failed/reversed. Payout reversal was requested.",
        };
      } catch (reversalError) {
        /*
         * Paystack confirmed failure/reversal, but the
         * reversal request itself failed.
         *
         * DO NOT manually restore here.
         *
         * Reconciliation/retry must resolve it.
         */

        console.error("PAYOUT REVERSAL REQUEST FAILED:", reversalError);

        return {
          success: false,

          status: "PROCESSING",

          reconciliationRequired: true,

          courierID,

          payoutID: processingPayout.id,

          reference,

          amount: payoutAmount,

          payoutFee,

          totalWalletDebit,

          message:
            "Paystack confirmed transfer failure/reversal, but wallet reversal could not be completed. Reconciliation required.",
        };
      }
    }

    /* ======================================================
       15F. UNKNOWN TRANSFER STATUS
    ====================================================== */

    /*
     * Conservative financial handling:
     *
     * Unknown status = PROCESSING.
     *
     * Never restore the wallet merely because we do not
     * recognize a Paystack status.
     */

    return {
      success: false,

      status: "PROCESSING",

      reconciliationRequired: true,

      courierID,

      payoutID: processingPayout.id,

      reference,

      amount: payoutAmount,

      payoutFee,

      totalWalletDebit,

      message: `Unknown Paystack transfer status: ${verification.status}. Payout remains PROCESSING.`,
    };
  }

  /* ========================================================
     16. PAYSTACK TRANSFER INITIATED SUCCESSFULLY
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
         * Keep PROCESSING until Paystack confirms
         * the final outcome.
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
     * Paystack has already accepted the transfer.
     *
     * NEVER restore the wallet here.
     *
     * NEVER create another transfer.
     *
     * The payout remains recoverable through its
     * reference and reconcilePayouts.
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

      payoutFee,

      totalWalletDebit,

      message:
        "Paystack transfer was initiated, but payout metadata could not be fully updated. Reconciliation required.",
    };
  }

  if (!finalProcessingPayout) {
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

      payoutFee,

      totalWalletDebit,

      message:
        "Paystack transfer was initiated but payout update returned no record. Reconciliation required.",
    };
  }

  console.log("PAYSTACK TRANSFER DETAILS SAVED:", {
    payoutID: finalProcessingPayout.id,

    reference: finalProcessingPayout.reference,

    transferID: finalProcessingPayout.transferID,

    transferCode: finalProcessingPayout.transferCode,

    status: finalProcessingPayout.status,
  });

  /* ========================================================
     18. VERIFY TRANSACTION STILL EXISTS
  ======================================================== */

  const finalTransaction = await getTransactionByReference(reference);

  if (!finalTransaction) {
    /*
     * Paystack already accepted the transfer.
     *
     * Therefore we cannot safely restore the wallet.
     *
     * Reconciliation is required.
     */

    console.error(
      "CRITICAL: PAYOUT TRANSACTION DISAPPEARED AFTER TRANSFER INITIATION:",
      reference,
    );

    return {
      success: false,

      status: "PROCESSING",

      reconciliationRequired: true,

      courierID,

      payoutID: finalProcessingPayout.id,

      reference,

      transferCode: finalProcessingPayout.transferCode || null,

      transferID: finalProcessingPayout.transferID || null,

      amount: payoutAmount,

      payoutFee,

      totalWalletDebit,

      message:
        "Paystack transfer was initiated, but the payout transaction could not be found. Reconciliation required.",
    };
  }

  console.log("PAYOUT TRANSACTION VERIFIED:", {
    transactionID: finalTransaction.id,

    amount: finalTransaction.amount,

    status: finalTransaction.status,

    reference: finalTransaction.reference,
  });

  /* ========================================================
     19. RETURN PROCESSING RESULT
  ======================================================== */

  return {
    success: true,

    status: "PROCESSING",

    reconciliationRequired: false,

    courierID,

    payoutID: finalProcessingPayout.id,

    reference,

    amount: payoutAmount,

    payoutFee,

    totalWalletDebit,

    transferCode: finalProcessingPayout.transferCode || null,

    transferID: finalProcessingPayout.transferID || null,

    message:
      "Payout transfer was successfully initiated and is now PROCESSING. Final payout status will be confirmed by Paystack.",
  };
};
/* ==========================================================
   GET ARGUMENT VALUE
==========================================================

   AppSync gives us an arguments object.

   This helper safely checks several possible argument names
   without changing the existing firstDefined() helper from
   Part 2.

   Example:

       getArgumentValue(
         argumentsData,
         ["courierID", "courierId", "courier_id"]
       );
========================================================== */

const getArgumentValue = (argumentsData, possibleNames) => {
  if (!argumentsData) {
    return null;
  }

  for (const name of possibleNames) {
    const value = argumentsData[name];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
};

/* ==========================================================
   PROCESS ALL COURIER PAYOUTS
==========================================================

   This function processes every courier who currently has
   a positive available wallet balance.

   It is primarily used for:

       ADMIN_MANUAL / MANUAL_ALL

   and:

       SYSTEM / AUTOMATIC

   IMPORTANT:

   ADMIN_MANUAL / MANUAL_ALL has:

       - NO ₦3,000 minimum
       - NO ₦100 courier-request fee

   Therefore even a courier with:

       ₦2,500

   available can receive the full ₦2,500 when an admin
   executes "Make Payouts to All".

   Each courier is processed independently.

   If one courier fails, the remaining couriers continue.
========================================================== */

const processAllCourierPayouts = async ({
  payoutMethod,

  payoutSource,

  secretKey,
}) => {
  console.log("==================================================");

  console.log("PROCESS ALL COURIER PAYOUTS");

  console.log("==================================================");

  console.log({
    payoutMethod,

    payoutSource,
  });

  /* ========================================================
     1. GET ELIGIBLE COURIER WALLETS
  ======================================================== */

  /*
   * getEligibleWallets() is already defined earlier in
   * this Lambda.
   *
   * It deliberately does NOT apply the ₦3,000 minimum.
   *
   * That minimum belongs only to courier-requested payouts.
   */

  const wallets = await getEligibleWallets();

  console.log("ELIGIBLE PAYOUT WALLETS:", wallets.length);

  /* ========================================================
     2. PROCESS EACH COURIER
  ======================================================== */

  const results = [];

  for (const wallet of wallets) {
    const courierID = wallet.ownerID;

    /*
     * A wallet without an owner cannot be paid.
     */

    if (!courierID) {
      results.push({
        success: false,

        status: "FAILED",

        courierID: null,

        walletID: wallet.id,

        message: "Wallet has no courier ownerID.",
      });

      continue;
    }

    try {
      /*
       * requestedAmount = null deliberately means:
       *
       *     PAY THE FULL CURRENT AVAILABLE BALANCE
       *
       * processCourierPayout() re-reads the wallet before
       * reserving the funds, so the stale balance from the
       * initial wallet list is NOT trusted for the actual
       * payout.
       */

      const result = await processCourierPayout({
        courierID,

        requestedAmount: null,

        payoutMethod,

        payoutSource,

        secretKey,
      });

      results.push(result);
    } catch (error) {
      /*
       * One courier failing must not stop the entire batch.
       */

      console.error("BATCH PAYOUT ERROR:", {
        courierID,

        payoutMethod,

        payoutSource,

        error: getErrorMessage(error),
      });

      results.push({
        success: false,

        status: "FAILED",

        courierID,

        walletID: wallet.id,

        message: getErrorMessage(error),
      });
    }
  }

  /* ========================================================
     3. CALCULATE BATCH SUMMARY
  ======================================================== */

  const successful = results.filter((item) => item?.success === true);

  const failed = results.filter((item) => item?.success !== true);

  const processing = results.filter((item) => item?.status === "PROCESSING");

  /* ========================================================
     4. RETURN BATCH RESULT
  ======================================================== */

  /*
   * IMPORTANT:
   *
   * "successful" here means the payout operation was
   * successfully initiated/processed by this Lambda.
   *
   * It does NOT necessarily mean the courier has already
   * received the money.
   *
   * Paystack transfer completion happens asynchronously
   * through:
   *
   *     paystackWebhook
   *
   * and, where necessary:
   *
   *     reconcilePayouts
   */

  return {
    success: failed.length === 0,

    /*
     * If every payout was successfully submitted,
     * the overall batch is PROCESSING because Paystack
     * still has to finalize the transfers.
     *
     * If one or more failed, report PARTIAL.
     */

    status: failed.length === 0 ? "PROCESSING" : "PARTIAL",

    payoutMethod,

    payoutSource,

    processed: results.length,

    successful: successful.length,

    failed: failed.length,

    processing: processing.length,

    results,
  };
};

/* ==========================================================
   MAIN LAMBDA HANDLER
==========================================================

   SUPPORTED FLOWS
   ---------------------------------------------------------

   1. ADMIN SINGLE

      GraphQL:

        adminMakePayout(
          courierID,
          requestedAmount
        )

      Internally:

        payoutMethod = MANUAL_SINGLE
        payoutSource = ADMIN_MANUAL

      Rules:

        - no ₦3,000 minimum
        - no ₦100 fee
        - cannot exceed current available balance


   2. ADMIN ALL

      GraphQL:

        adminMakeAllPayouts(...)

      Internally:

        payoutMethod = MANUAL_ALL
        payoutSource = ADMIN_MANUAL

      Rules:

        - pay each eligible courier's full balance
        - no ₦3,000 minimum
        - no ₦100 fee


   3. COURIER REQUESTED PAYOUT

      Existing courier flow remains intact.

      Rules:

        - minimum ₦3,000
        - ₦100 fee where applicable


   4. AUTOMATIC

      Internally:

        payoutMethod = AUTOMATIC
        payoutSource = SYSTEM
========================================================== */

exports.handler = async (event) => {
  console.log("==================================================");

  console.log("ATUA PROCESS PAYOUTS STARTED");

  console.log("==================================================");

  console.log("EVENT:", JSON.stringify(event));

  try {
    /* ====================================================
         1. GET PAYSTACK SECRET
      ==================================================== */

    /*
     * The existing helper obtains the Paystack secret
     * from SSM.
     *
     * The environment variable is the configured SSM
     * parameter name/path, not the raw secret.
     */

    const secretKey = await getPaystackSecretKey();

    /* ====================================================
         2. DETERMINE APPSYNC FIELD NAME
      ==================================================== */

    /*
     * This is extremely important now that the same Lambda
     * handles multiple mutations.
     *
     * We use the actual AppSync field name to distinguish:
     *
     *     adminMakePayout
     *
     * from:
     *
     *     normal courier payout
     *
     * The frontend cannot simply claim to be an admin payout
     * by supplying payoutSource.
     */

    const fieldName = getAppSyncFieldName(event);

    console.log("APPSYNC FIELD NAME:", fieldName);

    /* ====================================================
         3. GET ARGUMENTS
      ==================================================== */

    const argumentsData = getInputArguments(event);

    console.log("PAYOUT ARGUMENTS:", JSON.stringify(argumentsData));

    /* ====================================================
         4. ADMIN MAKE PAYOUT — ONE COURIER
      ==================================================== */

    if (fieldName === "adminMakePayout") {
      console.log("ADMIN SINGLE PAYOUT REQUEST");

      /* ==================================================
           4A. GET COURIER ID
        ================================================== */

      const courierID = getArgumentValue(
        argumentsData,

        ["courierID", "courierId", "courier_id"],
      );

      requireValue(courierID, "courierID is required.");

      /* ==================================================
           4B. GET REQUESTED AMOUNT
        ================================================== */

      /*
       * The GraphQL schema uses:
       *
       *     requestedAmount
       *
       * We retain "amount" as a compatibility fallback.
       */

      const requestedAmount = getArgumentValue(
        argumentsData,

        ["requestedAmount", "amount"],
      );

      requireValue(requestedAmount, "requestedAmount is required.");

      /* ==================================================
           4C. NORMALIZE AMOUNT
        ================================================== */

      const numericAmount = toNumber(requestedAmount);

      if (numericAmount === null || numericAmount <= 0) {
        throw new Error("Admin payout amount must be greater than zero.");
      }

      /* ==================================================
           4D. PROCESS ADMIN PAYOUT
        ================================================== */

      /*
       * IMPORTANT:
       *
       * We FORCE ADMIN_MANUAL here.
       *
       * We do NOT accept payoutSource from the frontend.
       *
       * Therefore this GraphQL mutation always receives:
       *
       *     ADMIN_MANUAL
       *
       * and:
       *
       *     MANUAL_SINGLE
       */

      const result = await processCourierPayout({
        courierID,

        requestedAmount: numericAmount,

        payoutMethod: PAYOUT_METHOD.MANUAL_SINGLE,

        payoutSource: PAYOUT_SOURCE.ADMIN_MANUAL,

        secretKey,
      });

      console.log("ADMIN SINGLE PAYOUT RESULT:", JSON.stringify(result));

      return {
        statusCode: 200,

        body: JSON.stringify(result),
      };
    }

    /* ====================================================
         5. ADMIN MAKE ALL PAYOUTS
      ==================================================== */

    if (fieldName === "adminMakeAllPayouts") {
      console.log("ADMIN ALL PAYOUT REQUEST");

      /*
       * IMPORTANT:
       *
       * We intentionally do NOT allow the frontend to
       * determine the source.
       *
       * Calling this mutation means:
       *
       *     ADMIN_MANUAL
       *
       * and:
       *
       *     MANUAL_ALL
       *
       * Every eligible courier receives their entire
       * available balance.
       *
       * There is:
       *
       *     NO ₦3,000 minimum
       *     NO ₦100 fee
       */

      const result = await processAllCourierPayouts({
        payoutMethod: PAYOUT_METHOD.MANUAL_ALL,

        payoutSource: PAYOUT_SOURCE.ADMIN_MANUAL,

        secretKey,
      });

      console.log("ADMIN ALL PAYOUT RESULT:", JSON.stringify(result));

      return {
        statusCode: 200,

        body: JSON.stringify(result),
      };
    }

    /* ====================================================
         6. EXISTING / NON-ADMIN PAYOUT FLOW
      ==================================================== */

    /*
     * Everything below is the existing payout architecture.
     *
     * This is deliberately kept separate from the admin
     * mutations above.
     *
     * That means adding admin payouts does NOT silently
     * turn an ordinary courier payout into an admin payout.
     */

    let payoutMethod = getArgumentValue(
      argumentsData,

      ["payoutMethod", "method"],
    );

    /* ====================================================
         7. GET COURIER ID
      ==================================================== */

    const courierID = getArgumentValue(
      argumentsData,

      ["courierID", "courierId", "courier_id"],
    );

    /* ====================================================
         8. GET AMOUNT
      ==================================================== */

    const suppliedAmount = getArgumentValue(
      argumentsData,

      ["amount", "payoutAmount", "requestedAmount"],
    );

    /* ====================================================
         9. DEFAULT PAYOUT METHOD
      ==================================================== */

    /*
     * Preserve the existing behaviour:
     *
     * If a courier payout is invoked with a courierID but
     * no explicit method, use MANUAL_SINGLE.
     */

    if (!payoutMethod && courierID) {
      payoutMethod = PAYOUT_METHOD.MANUAL_SINGLE;
    }

    if (!payoutMethod) {
      throw new Error("payoutMethod is required.");
    }

    /*
     * Normalize method to uppercase.
     *
     * Example:
     *
     *     bank_transfer
     *
     * becomes:
     *
     *     BANK_TRANSFER
     */

    payoutMethod = String(payoutMethod).trim().toUpperCase();

    /* ====================================================
         10. BANK_TRANSFER
      ==================================================== */

    /*
     * BANK_TRANSFER is preserved for compatibility with
     * the existing courier-requested payout flow.
     */

    if (payoutMethod === "BANK_TRANSFER") {
      if (!courierID) {
        throw new Error("courierID is required for BANK_TRANSFER payout.");
      }

      requireValue(suppliedAmount, "amount is required.");

      const numericAmount = toNumber(suppliedAmount);

      if (numericAmount === null || numericAmount <= 0) {
        throw new Error("Payout amount must be greater than zero.");
      }

      /*
       * IMPORTANT:
       *
       * This is a COURIER_REQUESTED payout.
       *
       * Therefore processCourierPayout() applies:
       *
       *     ₦3,000 minimum
       *     ₦100 fee
       */

      const result = await processCourierPayout({
        courierID,

        requestedAmount: numericAmount,

        payoutMethod: PAYOUT_METHOD.MANUAL_SINGLE,

        payoutSource: PAYOUT_SOURCE.COURIER_REQUESTED,

        secretKey,
      });

      return {
        statusCode: 200,

        body: JSON.stringify(result),
      };
    }

    /* ====================================================
         11. MANUAL_SINGLE
      ==================================================== */

    /*
     * IMPORTANT:
     *
     * Direct MANUAL_SINGLE invocations remain part of the
     * existing courier-requested path.
     *
     * The ADMIN_MANUAL version is available ONLY through:
     *
     *     adminMakePayout
     *
     * above.
     */

    if (payoutMethod === PAYOUT_METHOD.MANUAL_SINGLE) {
      if (!courierID) {
        throw new Error("courierID is required for MANUAL_SINGLE payout.");
      }

      requireValue(suppliedAmount, "amount is required.");

      const numericAmount = toNumber(suppliedAmount);

      if (numericAmount === null || numericAmount <= 0) {
        throw new Error("Payout amount must be greater than zero.");
      }

      const result = await processCourierPayout({
        courierID,

        requestedAmount: numericAmount,

        payoutMethod: PAYOUT_METHOD.MANUAL_SINGLE,

        payoutSource: PAYOUT_SOURCE.COURIER_REQUESTED,

        secretKey,
      });

      return {
        statusCode: 200,

        body: JSON.stringify(result),
      };
    }

    /* ====================================================
         12. MANUAL_ALL
      ==================================================== */

    /*
     * Existing/internal MANUAL_ALL invocation.
     *
     * This is an administrator/batch operation.
     */

    if (payoutMethod === PAYOUT_METHOD.MANUAL_ALL) {
      const result = await processAllCourierPayouts({
        payoutMethod: PAYOUT_METHOD.MANUAL_ALL,

        payoutSource: PAYOUT_SOURCE.ADMIN_MANUAL,

        secretKey,
      });

      return {
        statusCode: 200,

        body: JSON.stringify(result),
      };
    }

    /* ====================================================
         13. AUTOMATIC
      ==================================================== */

    if (payoutMethod === PAYOUT_METHOD.AUTOMATIC) {
      /*
       * Automatic payouts remain SYSTEM payouts.
       *
       * They are NOT ADMIN_MANUAL.
       */

      const result = await processAllCourierPayouts({
        payoutMethod: PAYOUT_METHOD.AUTOMATIC,

        payoutSource: PAYOUT_SOURCE.SYSTEM,

        secretKey,
      });

      return {
        statusCode: 200,

        body: JSON.stringify(result),
      };
    }

    /* ====================================================
         14. UNSUPPORTED METHOD
      ==================================================== */

    throw new Error(`Unsupported payout method: ${payoutMethod}`);
  } catch (error) {
    console.error("==================================================");

    console.error("PROCESS PAYOUTS HANDLER ERROR");

    console.error("==================================================");

    console.error(error);

    /* ====================================================
         RETURN APPSYNC RESPONSE
      ==================================================== */

    /*
     * Schema:
     *
     *     type ProcessPayoutsResponse {
     *       statusCode: Int!
     *       body: String!
     *     }
     */

    return {
      statusCode: 500,

      body: JSON.stringify({
        success: false,

        status: "FAILED",

        message: getErrorMessage(error),
      }),
    };
  }
};
