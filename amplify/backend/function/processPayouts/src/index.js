/* Amplify Params - DO NOT EDIT
	API_ATUA_GRAPHQLAPIENDPOINTOUTPUT
	API_ATUA_GRAPHQLAPIIDOUTPUT
	API_ATUA_GRAPHQLAPIKEYOUTPUT
	ENV
	REGION
 Amplify Params - DO NOT EDIT */

const {
  SSMClient,
  GetParameterCommand,
} = require("@aws-sdk/client-ssm");

const https = require("https");
const crypto = require("crypto");


/* ==========================================================
   CONFIGURATION
========================================================== */

const GRAPHQL_ENDPOINT =
  process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const GRAPHQL_API_KEY =
  process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

const REGION =
  process.env.REGION ||
  process.env.AWS_REGION;


/* ==========================================================
   GET PAYSTACK SECRET
========================================================== */

const getPaystackSecretKey = async () => {

  const parameterName =
    process.env.PAYSTACK_SECRET_KEY;

  if (!parameterName) {
    throw new Error(
      "PAYSTACK_SECRET_KEY is not configured."
    );
  }

  const ssmClient =
    new SSMClient({
      region: REGION,
    });

  const command =
    new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true,
    });

  const result =
    await ssmClient.send(command);

  const secretKey =
    result?.Parameter?.Value;

  if (!secretKey) {
    throw new Error(
      "Unable to retrieve Paystack secret key."
    );
  }

  return secretKey;
};


/* ==========================================================
   GRAPHQL REQUEST
========================================================== */

const graphqlRequest = async (
  query,
  variables = {},
  operationName = "GraphQL operation"
) => {

  if (!GRAPHQL_ENDPOINT) {
    throw new Error(
      "Atua GraphQL endpoint is not configured."
    );
  }

  if (!GRAPHQL_API_KEY) {
    throw new Error(
      "Atua GraphQL API key is not configured."
    );
  }

  const endpoint =
    new URL(GRAPHQL_ENDPOINT);

  const body =
    JSON.stringify({
      query,
      variables,
    });

  const options = {
    hostname:
      endpoint.hostname,

    path:
      endpoint.pathname || "/graphql",

    method:
      "POST",

    headers: {
      "Content-Type":
        "application/json",

      "Content-Length":
        Buffer.byteLength(body),

      "x-api-key":
        GRAPHQL_API_KEY,
    },
  };

  return new Promise(
    (resolve, reject) => {

      const request =
        https.request(
          options,
          (response) => {

            let data = "";

            response.on(
              "data",
              (chunk) => {
                data += chunk;
              }
            );

            response.on(
              "end",
              () => {

                if (
                  response.statusCode < 200 ||
                  response.statusCode >= 300
                ) {

                  return reject(
                    new Error(
                      `${operationName} returned HTTP ${response.statusCode}: ${data}`
                    )
                  );
                }

                let parsed;

                try {

                  parsed =
                    JSON.parse(data);

                } catch (error) {

                  return reject(
                    new Error(
                      `${operationName} returned invalid JSON: ${data}`
                    )
                  );
                }

                if (
                  parsed?.errors?.length
                ) {

                  console.error(
                    `${operationName} GraphQL errors:`,
                    JSON.stringify(
                      parsed.errors
                    )
                  );

                  return reject(
                    new Error(
                      parsed.errors
                        .map(
                          (item) =>
                            item?.message
                        )
                        .filter(Boolean)
                        .join(" | ") ||
                      `${operationName} failed.`
                    )
                  );
                }

                resolve(
                  parsed?.data ||
                  null
                );
              }
            );
          }
        );

      request.on(
        "error",
        (error) => {

          console.error(
            `${operationName} request error:`,
            error
          );

          reject(error);
        }
      );

      request.write(body);
      request.end();
    }
  );
};


/* ==========================================================
   PAYSTACK REQUEST
========================================================== */

const paystackRequest = async ({
  method,
  path,
  secretKey,
  body = null,
}) => {

  const payload =
    body !== null
      ? JSON.stringify(body)
      : null;

  const options = {
    hostname:
      "api.paystack.co",

    path,

    method,

    headers: {
      Authorization:
        `Bearer ${secretKey}`,

      Accept:
        "application/json",
    },
  };

  if (payload) {

    options.headers[
      "Content-Type"
    ] =
      "application/json";

    options.headers[
      "Content-Length"
    ] =
      Buffer.byteLength(payload);
  }

  return new Promise(
    (resolve, reject) => {

      const request =
        https.request(
          options,
          (response) => {

            let data = "";

            response.on(
              "data",
              (chunk) => {
                data += chunk;
              }
            );

            response.on(
              "end",
              () => {

                let parsed;

                try {

                  parsed =
                    JSON.parse(data);

                } catch (error) {

                  return reject(
                    new Error(
                      `Paystack returned invalid JSON: ${data}`
                    )
                  );
                }

                resolve({
                  statusCode:
                    response.statusCode,

                  body:
                    parsed,
                });
              }
            );
          }
        );

      request.on(
        "error",
        (error) => {

          error.isPaystackNetworkError =
            true;

          reject(error);
        }
      );

      if (payload) {
        request.write(payload);
      }

      request.end();
    }
  );
};


/* ==========================================================
   GET COURIER
========================================================== */

const getCourier = async (
  courierID
) => {

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

  const data =
    await graphqlRequest(
      query,
      {
        id:
          courierID,
      },
      "GetCourier"
    );

  return (
    data?.getCourier ||
    null
  );
};


/* ==========================================================
   GET COURIER WALLET
========================================================== */

const getCourierWallet = async (
  courierID
) => {

  const query = `
    query ListWallets(
      $filter: ModelWalletFilterInput
    ) {

      listWallets(
        filter: $filter
        limit: 1
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

      }

    }
  `;

  const data =
    await graphqlRequest(
      query,
      {
        filter: {

          ownerID: {
            eq:
              courierID,
          },

          ownerType: {
            eq:
              "COURIER",
          },

        },
      },
      "GetCourierWallet"
    );

  return (
    data?.listWallets?.items?.[0] ||
    null
  );
};


/* ==========================================================
   GET PAYOUTS FOR COURIER
==========================================================

Used to prevent:

    PENDING payout + another payout

or:

    PROCESSING payout + another payout

========================================================== */

const getActiveCourierPayouts = async (
  courierID
) => {

  const query = `
    query ListPayouts(
      $filter: ModelPayoutFilterInput
    ) {

      listPayouts(
        filter: $filter
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

  const data =
    await graphqlRequest(
      query,
      {
        filter: {

          courierID: {
            eq:
              courierID,
          },

        },
      },
      "GetCourierPayouts"
    );

  const payouts =
    data?.listPayouts?.items ||
    [];

  return payouts.filter(
    (payout) =>
      payout.status ===
        "PENDING" ||
      payout.status ===
        "PROCESSING"
  );
};


/* ==========================================================
   GET PAYOUT BY REFERENCE
========================================================== */

const getPayoutByReference = async (
  reference
) => {

  const query = `
    query ListPayouts(
      $filter: ModelPayoutFilterInput
    ) {

      listPayouts(
        filter: $filter
        limit: 1
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

  const data =
    await graphqlRequest(
      query,
      {
        filter: {

          reference: {
            eq:
              reference,
          },

        },
      },
      "GetPayoutByReference"
    );

  return (
    data?.listPayouts?.items?.[0] ||
    null
  );
};


/* ==========================================================
   GET TRANSACTION BY REFERENCE
========================================================== */

const getTransactionByReference = async (
  reference
) => {

  const query = `
    query ListTransactions(
      $filter: ModelTransactionFilterInput
    ) {

      listTransactions(
        filter: $filter
        limit: 1
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

  const data =
    await graphqlRequest(
      query,
      {
        filter: {

          reference: {
            eq:
              reference,
          },

        },
      },
      "GetTransactionByReference"
    );

  return (
    data?.listTransactions?.items?.[0] ||
    null
  );
};


/* ==========================================================
   CREATE TRANSFER RECIPIENT
========================================================== */

const createTransferRecipient = async ({
  courier,
  secretKey,
}) => {

  if (
    !courier.accountNumber ||
    !courier.bankCode
  ) {

    throw new Error(
      "Courier bank account details are incomplete."
    );
  }

  if (
    !courier.accountName
  ) {

    throw new Error(
      "Courier account name is missing."
    );
  }

  const response =
    await paystackRequest({

      method:
        "POST",

      path:
        "/transferrecipient",

      secretKey,

      body: {

        type:
          "nuban",

        name:
          courier.accountName,

        account_number:
          courier.accountNumber,

        bank_code:
          courier.bankCode,

        currency:
          "NGN",

        description:
          `Atua courier ${courier.id}`,

        metadata: {

          courierID:
            courier.id,

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
      "Paystack transfer recipient could not be created."
    );
  }

  const recipient =
    response.body?.data;

  if (
    !recipient?.recipient_code
  ) {

    throw new Error(
      "Paystack did not return a recipient code."
    );
  }

  return recipient;
};


/* ==========================================================
   INITIATE TRANSFER
========================================================== */

const initiateTransfer = async ({
  amount,
  recipientCode,
  reference,
  secretKey,
  courierID,
}) => {

  const amountInKobo =
    Math.round(
      Number(amount) * 100
    );

  if (
    !Number.isFinite(
      amountInKobo
    ) ||
    amountInKobo <= 0
  ) {

    throw new Error(
      "Invalid payout amount."
    );
  }

  const response =
    await paystackRequest({

      method:
        "POST",

      path:
        "/transfer",

      secretKey,

      body: {

        source:
          "balance",

        amount:
          amountInKobo,

        recipient:
          recipientCode,

        reference,

        reason:
          `Atua courier payout - ${courierID}`,

        currency:
          "NGN",

      },

    });

  if (
    response.statusCode < 200 ||
    response.statusCode >= 300 ||
    !response.body?.status
  ) {

    const error =
      new Error(
        response.body?.message ||
        "Paystack transfer could not be initiated."
      );

    error.isPaystackRejected =
      true;

    error.paystackResponse =
      response.body;

    throw error;
  }

  const transfer =
    response.body?.data;

  if (!transfer) {

    const error =
      new Error(
        "Paystack did not return transfer data."
      );

    error.isPaystackUnknown =
      true;

    throw error;
  }

  return transfer;
};


/* ==========================================================
   VERIFY PAYSTACK TRANSFER
==========================================================

Used when transfer initiation has an uncertain outcome.

========================================================== */

const verifyPaystackTransfer =
  async (
    reference,
    secretKey
  ) => {

    const encodedReference =
      encodeURIComponent(
        reference
      );

    const response =
      await paystackRequest({

        method:
          "GET",

        path:
          `/transfer/verify/${encodedReference}`,

        secretKey,

      });

    /*
     * Paystack returns an error when the transfer doesn't
     * exist yet. That is useful information for us.
     */

    if (
      response.statusCode ===
        404 ||
      response.body?.message ===
        "Transfer not found"
    ) {

      return {
        exists:
          false,

        status:
          null,

        transfer:
          null,
      };
    }

    if (
      response.statusCode < 200 ||
      response.statusCode >= 300 ||
      !response.body?.status
    ) {

      throw new Error(
        response.body?.message ||
        "Could not verify Paystack transfer."
      );
    }

    return {

      exists:
        true,

      status:
        response.body?.data?.status ||
        null,

      transfer:
        response.body?.data ||
        null,

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

  const data =
    await graphqlRequest(
      mutation,
      {
        input: {

          courierID,

          walletID,

          amount,

          status:
            "PENDING",

          bankName:
            courier.bankName,

          accountNumber:
            courier.accountNumber,

          reference,

          payoutMethod,

        },
      },
      "CreatePayout"
    );

  return (
    data?.createPayout ||
    null
  );
};


/* ==========================================================
   UPDATE PAYOUT
========================================================== */

const updatePayout = async ({
  payout,
  fields,
}) => {

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

    id:
      payout.id,

    ...fields,

  };

  if (
    Number.isInteger(
      payout._version
    )
  ) {

    input._version =
      payout._version;
  }

  const data =
    await graphqlRequest(
      mutation,
      {
        input,
      },
      "UpdatePayout"
    );

  return (
    data?.updatePayout ||
    null
  );
};


/* ==========================================================
   UPDATE WALLET WITH VERSION LOCK
========================================================== */

const reserveWalletBalance =
  async ({
    wallet,
    amount,
  }) => {

    const currentAvailable =
      Number(
        wallet.availableBalance || 0
      );

    const newAvailable =
      Number(
        (
          currentAvailable -
          amount
        ).toFixed(2)
      );

    if (
      newAvailable < 0
    ) {

      throw new Error(
        "Insufficient available balance."
      );
    }

    const mutation = `
      mutation UpdateWallet(
        $input: UpdateWalletInput!
      ) {

        updateWallet(
          input: $input
        ) {

          id

          availableBalance
          pendingBalance
          lifetimeEarnings

          _version

        }

      }
    `;

    const input = {

      id:
        wallet.id,

      availableBalance:
        newAvailable,

    };

    /*
     * This is extremely important.

     * If another payout changes this wallet between the read
     * and this update, AppSync conflict detection rejects this
     * mutation rather than silently overwriting the other
     * payout's balance.
     */

    if (
      Number.isInteger(
        wallet._version
      )
    ) {

      input._version =
        wallet._version;
    }

    const data =
      await graphqlRequest(
        mutation,
        {
          input,
        },
        "ReserveWalletBalance"
      );

    const updatedWallet =
      data?.updateWallet;

    if (!updatedWallet) {

      throw new Error(
        "Wallet reservation failed."
      );
    }

    return updatedWallet;
  };


/* ==========================================================
   RESTORE WALLET BALANCE
========================================================== */

const restoreWalletBalance =
  async ({
    courierID,
    amount,
  }) => {

    const wallet =
      await getCourierWallet(
        courierID
      );

    if (!wallet) {

      throw new Error(
        `Cannot restore balance: wallet not found for courier ${courierID}.`
      );
    }

    const currentAvailable =
      Number(
        wallet.availableBalance || 0
      );

    const restored =
      Number(
        (
          currentAvailable +
          amount
        ).toFixed(2)
      );

    const mutation = `
      mutation UpdateWallet(
        $input: UpdateWalletInput!
      ) {

        updateWallet(
          input: $input
        ) {

          id

          availableBalance
          pendingBalance
          lifetimeEarnings

          _version

        }

      }
    `;

    const input = {

      id:
        wallet.id,

      availableBalance:
        restored,

    };

    if (
      Number.isInteger(
        wallet._version
      )
    ) {

      input._version =
        wallet._version;
    }

    const data =
      await graphqlRequest(
        mutation,
        {
          input,
        },
        "RestoreWalletBalance"
      );

    const updatedWallet =
      data?.updateWallet;

    if (!updatedWallet) {

      throw new Error(
        `Unable to restore wallet balance for courier ${courierID}.`
      );
    }

    return updatedWallet;
  };


/* ==========================================================
   CREATE DEBIT TRANSACTION
========================================================== */

const createDebitTransaction =
  async ({
    walletID,
    amount,
    reference,
  }) => {

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

    const data =
      await graphqlRequest(
        mutation,
        {
          input: {

            walletID,

            type:
              "DEBIT",

            amount,

            description:
              "Courier payout initiated.",

            reference,

            status:
              "PENDING",

          },
        },
        "CreatePayoutTransaction"
      );

    return (
      data?.createTransaction ||
      null
    );
  };


/* ==========================================================
   GET ELIGIBLE WALLETS
========================================================== */

const getEligibleWallets =
  async () => {

    const query = `
      query ListCourierWallets {

        listWallets(
          filter: {
            ownerType: {
              eq: COURIER
            }
          }
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

        }

      }
    `;

    const data =
      await graphqlRequest(
        query,
        {},
        "GetEligibleWallets"
      );

    const wallets =
      data?.listWallets?.items ||
      [];

    return wallets.filter(
      (wallet) =>
        Number(
          wallet.availableBalance || 0
        ) > 0
    );
  };


/* ==========================================================
   GENERATE VALID PAYSTACK REFERENCE
==========================================================

Paystack requires:

    16–50 characters

Allowed:

    lowercase letters
    digits
    -
    _

========================================================== */

const generatePayoutReference =
  (courierID) => {

    const courierPart =
      String(
        courierID
      )
        .toLowerCase()
        .replace(
          /[^a-z0-9]/g,
          ""
        )
        .slice(
          0,
          8
        );

    const randomPart =
      crypto
        .randomBytes(12)
        .toString("hex");

    const timestampPart =
      Date.now()
        .toString(36)
        .toLowerCase();

    const reference =
      `atua_${courierPart}_${timestampPart}_${randomPart}`;

    return reference.slice(
      0,
      50
    );
  };


/* ==========================================================
   MARK PAYOUT FAILED
========================================================== */

const markPayoutFailed =
  async ({
    payout,
    reason,
    transfer = null,
  }) => {

    const updated =
      await updatePayout({

        payout,

        fields: {

          status:
            "FAILED",

          failureReason:
            reason,

          failedAt:
            new Date().toISOString(),

          transferCode:
            transfer?.transfer_code ||
            payout.transferCode ||
            null,

          transferID:
            transfer?.id != null
              ? String(
                  transfer.id
                )
              : payout.transferID ||
                null,

        },

      });

    if (!updated) {

      throw new Error(
        `Could not mark payout ${payout.id} as FAILED.`
      );
    }

    return updated;
  };


/* ==========================================================
   FINALIZE TRANSACTION AS FAILED
========================================================== */

const markTransactionFailed =
  async (
    reference
  ) => {

    const transaction =
      await getTransactionByReference(
        reference
      );

    if (!transaction) {
      return null;
    }

    if (
      transaction.status ===
      "FAILED"
    ) {
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

        }

      }
    `;

    const data =
      await graphqlRequest(
        mutation,
        {
          input: {

            id:
              transaction.id,

            status:
              "FAILED",

            description:
              "Courier payout failed.",

          },
        },
        "MarkPayoutTransactionFailed"
      );

    return (
      data?.updateTransaction ||
      null
    );
  };


/* ==========================================================
   PROCESS ONE COURIER PAYOUT
========================================================== */

const processCourierPayout =
  async ({
    courierID,
    requestedAmount,
    payoutMethod,
    secretKey,
  }) => {

    console.log(
      "=========================================="
    );

    console.log(
      "PROCESSING COURIER PAYOUT"
    );

    console.log(
      {
        courierID,
        requestedAmount,
        payoutMethod,
      }
    );

    console.log(
      "=========================================="
    );


    /* ======================================================
       1. GET COURIER
    ====================================================== */

    const courier =
      await getCourier(
        courierID
      );

    if (!courier) {

      throw new Error(
        `Courier ${courierID} not found.`
      );
    }


    /* ======================================================
       2. APPROVAL
    ====================================================== */

    if (
      courier.isApproved ===
      false
    ) {

      throw new Error(
        "Courier is not approved for payouts."
      );
    }


    /* ======================================================
       3. BANK DETAILS
    ====================================================== */

    if (
      !courier.bankCode ||
      !courier.accountNumber ||
      !courier.accountName
    ) {

      throw new Error(
        "Courier does not have complete bank account details."
      );
    }


    /* ======================================================
       4. GET WALLET
    ====================================================== */

    const wallet =
      await getCourierWallet(
        courierID
      );

    if (!wallet) {

      throw new Error(
        "Courier wallet not found."
      );
    }


    /* ======================================================
       5. AVAILABLE BALANCE
    ====================================================== */

    const availableBalance =
      Number(
        wallet.availableBalance || 0
      );

    if (
      !Number.isFinite(
        availableBalance
      ) ||
      availableBalance <= 0
    ) {

      throw new Error(
        "Courier has no available balance for payout."
      );
    }


    /* ======================================================
       6. CHECK ACTIVE PAYOUT
    ====================================================== */

    const activePayouts =
      await getActiveCourierPayouts(
        courierID
      );

    if (
      activePayouts.length > 0
    ) {

      const active =
        activePayouts[0];

      return {

        success:
          true,

        skipped:
          true,

        status:
          "PROCESSING",

        courierID,

        payoutID:
          active.id,

        payoutReference:
          active.reference,

        amount:
          active.amount,

        message:
          "Courier already has a payout pending or processing.",

      };
    }


    /* ======================================================
       7. DETERMINE PAYOUT AMOUNT
    ====================================================== */

    let payoutAmount =
      availableBalance;


    if (
      requestedAmount !==
        undefined &&
      requestedAmount !==
        null &&
      requestedAmount !==
        ""
    ) {

      payoutAmount =
        Number(
          requestedAmount
        );

      if (
        !Number.isFinite(
          payoutAmount
        ) ||
        payoutAmount <= 0
      ) {

        throw new Error(
          "Requested payout amount is invalid."
        );
      }

      if (
        payoutAmount >
        availableBalance
      ) {

        throw new Error(
          "Requested payout amount exceeds available balance."
        );
      }
    }


    payoutAmount =
      Number(
        payoutAmount.toFixed(2)
      );


    /* ======================================================
       8. VALIDATE FINAL AMOUNT
    ====================================================== */

    if (
      payoutAmount <= 0
    ) {

      throw new Error(
        "Payout amount must be greater than zero."
      );
    }


    /* ======================================================
       9. GENERATE UNIQUE REFERENCE
    ====================================================== */

    const reference =
      generatePayoutReference(
        courierID
      );


    console.log(
      "PAYOUT REFERENCE:",
      reference
    );


    /* ======================================================
       10. CREATE PAYOUT RECORD
    ====================================================== */

    const payout =
      await createPayout({

        courierID,

        walletID:
          wallet.id,

        amount:
          payoutAmount,

        courier,

        reference,

        payoutMethod,

      });


    if (!payout?.id) {

      throw new Error(
        "Payout record could not be created."
      );
    }


    console.log(
      "PAYOUT CREATED:",
      {
        payoutID:
          payout.id,

        reference:
          payout.reference,

        amount:
          payout.amount,

        status:
          payout.status,

      }
    );


    /* ======================================================
       11. RESERVE WALLET BALANCE
    ======================================================

    Use the current wallet version.

    If another payout changed the wallet after our read,
    AppSync should reject this update.

    ====================================================== */

    let reservedWallet;

    try {

      reservedWallet =
        await reserveWalletBalance({

          wallet,

          amount:
            payoutAmount,

        });

    } catch (error) {

      await markPayoutFailed({

        payout,

        reason:
          `Wallet reservation failed: ${error.message}`,

      });

      throw error;
    }


    console.log(
      "WALLET BALANCE RESERVED:",
      {
        walletID:
          reservedWallet.id,

        availableBalance:
          reservedWallet.availableBalance,

      }
    );


    /* ======================================================
       12. CREATE DEBIT TRANSACTION
    ====================================================== */

    let transaction;

    try {

      transaction =
        await createDebitTransaction({

          walletID:
            wallet.id,

          amount:
            payoutAmount,

          reference,

        });

    } catch (error) {

      console.error(
        "DEBIT TRANSACTION CREATION FAILED:",
        error
      );

      /*
       * Because Paystack has not been called yet, the wallet
       * can safely be restored.
       */

      try {

        await restoreWalletBalance({

          courierID,

          amount:
            payoutAmount,

        });

      } catch (restoreError) {

        console.error(
          "CRITICAL: WALLET RESTORE FAILED:",
          restoreError
        );

      }

      await markPayoutFailed({

        payout,

        reason:
          `Unable to create payout transaction: ${error.message}`,

      });

      throw error;
    }


    if (!transaction?.id) {

      try {

        await restoreWalletBalance({

          courierID,

          amount:
            payoutAmount,

        });

      } catch (restoreError) {

        console.error(
          "CRITICAL: WALLET RESTORE FAILED:",
          restoreError
        );

      }

      await markPayoutFailed({

        payout,

        reason:
          "Unable to create payout transaction.",

      });

      throw new Error(
        "Unable to create payout transaction."
      );
    }


    console.log(
      "PAYOUT DEBIT TRANSACTION CREATED:",
      {
        transactionID:
          transaction.id,

        reference:
          transaction.reference,

        status:
          transaction.status,

      }
    );


    /* ======================================================
       13. CREATE / GET PAYSTACK RECIPIENT
    ====================================================== */

    let recipient;

    try {

      recipient =
        await createTransferRecipient({

          courier,

          secretKey,

        });

    } catch (error) {

      console.error(
        "TRANSFER RECIPIENT ERROR:",
        error
      );


      /*
       * No transfer has been attempted yet, so restoring the
       * reserved balance is safe.
       */

      try {

        await restoreWalletBalance({

          courierID,

          amount:
            payoutAmount,

        });

      } catch (restoreError) {

        console.error(
          "CRITICAL: WALLET RESTORE FAILED:",
          restoreError
        );

      }


      await markTransactionFailed(
        reference
      );


      await markPayoutFailed({

        payout,

        reason:
          error.message,

      });


      throw error;
    }


    console.log(
      "PAYSTACK RECIPIENT:",
      recipient.recipient_code
    );


    /* ======================================================
       14. MARK PAYOUT PROCESSING BEFORE TRANSFER
    ======================================================

    This is an important protection.

    If Lambda crashes immediately after this point, the
    payout remains PROCESSING and another invocation will not
    create a second transfer.

    ====================================================== */

    let processingPayout;

    try {

      processingPayout =
        await updatePayout({

          payout,

          fields: {

            status:
              "PROCESSING",

            processedAt:
              new Date().toISOString(),

          },

        });

    } catch (error) {

      console.error(
        "COULD NOT MARK PAYOUT PROCESSING:",
        error
      );


      /*
       * Transfer has NOT been sent yet.
       * Restore the reserved balance.
       */

      try {

        await restoreWalletBalance({

          courierID,

          amount:
            payoutAmount,

        });

      } catch (restoreError) {

        console.error(
          "CRITICAL: WALLET RESTORE FAILED:",
          restoreError
        );

      }


      await markTransactionFailed(
        reference
      );


      await markPayoutFailed({

        payout,

        reason:
          `Could not mark payout PROCESSING: ${error.message}`,

      });


      throw error;
    }


    if (!processingPayout) {

      throw new Error(
        "Payout could not be moved to PROCESSING."
      );
    }


    /* ======================================================
       15. INITIATE PAYSTACK TRANSFER
    ====================================================== */

    let transfer;


    try {

      transfer =
        await initiateTransfer({

          amount:
            payoutAmount,

          recipientCode:
            recipient.recipient_code,

          reference,

          secretKey,

          courierID,

        });

    } catch (error) {

      console.error(
        "PAYSTACK TRANSFER ERROR:",
        error
      );


      /* ====================================================
         DETERMINE WHETHER THE TRANSFER EXISTS
      ==================================================== */

      let verification = null;

      try {

        verification =
          await verifyPaystackTransfer(
            reference,
            secretKey
          );

      } catch (verifyError) {

        console.error(
          "TRANSFER VERIFICATION ALSO FAILED:",
          verifyError
        );

        /*
         * We cannot safely know whether Paystack received the
         * original request.
         *
         * DO NOT restore the wallet.
         * DO NOT create another transfer.
         *
         * Keep Payout PROCESSING.
         */

        return {

          success:
            false,

          status:
            "PROCESSING",

          reconciliationRequired:
            true,

          courierID,

          payoutID:
            payout.id,

          reference,

          amount:
            payoutAmount,

          message:
            "Transfer outcome is uncertain. Payout remains PROCESSING and requires reconciliation.",

        };
      }


      /* ====================================================
         TRANSFER DOES NOT EXIST
      ==================================================== */

      if (
        verification.exists ===
        false
      ) {

        try {

          await restoreWalletBalance({

            courierID,

            amount:
              payoutAmount,

          });

        } catch (restoreError) {

          console.error(
            "CRITICAL: WALLET RESTORE FAILED:",
            restoreError
          );

        }


        await markTransactionFailed(
          reference
        );


        await markPayoutFailed({

          payout:
            processingPayout,

          reason:
            error.message ||
            "Paystack transfer was rejected before creation.",

        });


        throw error;
      }


      /* ====================================================
         TRANSFER EXISTS
      ==================================================== */

      const transferStatus =
        String(
          verification.status ||
          ""
        ).toLowerCase();


      if (
        transferStatus ===
          "success" ||
        transferStatus ===
          "pending"
      ) {

        /*
         * Money remains reserved.
         * Webhook will finalize the payout.
         */

        await updatePayout({

          payout:
            processingPayout,

          fields: {

            transferCode:
              verification.transfer
                ?.transfer_code ||
              null,

            transferID:
              verification.transfer?.id != null
                ? String(
                    verification.transfer.id
                  )
                : null,

          },

        });


        return {

          success:
            false,

          status:
            "PROCESSING",

          reconciliationRequired:
            false,

          courierID,

          payoutID:
            payout.id,

          reference,

          amount:
            payoutAmount,

          message:
            "Paystack transfer exists and remains PROCESSING. Awaiting transfer webhook.",

        };
      }


      /* ====================================================
         TRANSFER ALREADY FAILED / REVERSED
      ==================================================== */

      if (
        transferStatus ===
          "failed" ||
        transferStatus ===
          "reversed"
      ) {

        const failureReason =
          verification
            .transfer
            ?.failures
            ? JSON.stringify(
                verification.transfer.failures
              )
            : `Paystack transfer status: ${transferStatus}`;


        try {

          await restoreWalletBalance({

            courierID,

            amount:
              payoutAmount,

          });

        } catch (restoreError) {

          console.error(
            "CRITICAL: WALLET RESTORE FAILED:",
            restoreError
          );

        }


        await markTransactionFailed(
          reference
        );


        await markPayoutFailed({

          payout:
            processingPayout,

          reason:
            failureReason,

          transfer:
            verification.transfer,

        });


        return {

          success:
            false,

          status:
            "FAILED",

          courierID,

          payoutID:
            payout.id,

          reference,

          amount:
            payoutAmount,

          message:
            "Paystack transfer failed and the wallet balance was restored.",

        };
      }


      /*
       * Unknown Paystack status:
       * keep processing rather than risking a duplicate payout.
       */

      return {

        success:
          false,

        status:
          "PROCESSING",

        reconciliationRequired:
          true,

        courierID,

        payoutID:
          payout.id,

        reference,

        amount:
          payoutAmount,

        message:
          `Unknown Paystack transfer status: ${verification.status}. Payout remains PROCESSING.`,

      };
    }


    /* ======================================================
       16. PAYSTACK ACCEPTED THE TRANSFER
    ======================================================

    A successful initiation means Paystack has queued the
    transfer. It does NOT mean the courier's bank has finally
    received it.

    The transfer webhook will finalize the payout.

    ====================================================== */

    console.log(
      "PAYSTACK TRANSFER INITIATED:",
      {
        reference,

        transferID:
          transfer?.id,

        transferCode:
          transfer?.transfer_code,

        status:
          transfer?.status,

      }
    );


    const finalProcessingPayout =
      await updatePayout({

        payout:
          processingPayout,

        fields: {

          status:
            "PROCESSING",

          transferCode:
            transfer?.transfer_code ||
            null,

          transferID:
            transfer?.id != null
              ? String(
                  transfer.id
                )
              : null,

          processedAt:
            processingPayout.processedAt ||
            new Date().toISOString(),

        },

      });


    if (!finalProcessingPayout) {

      /*
       * Paystack has accepted the transfer, therefore we must
       * NOT restore the wallet or send another transfer.
       *
       * Payout remains recoverable using the reference.
       */

      return {

        success:
          false,

        status:
          "PROCESSING",

        reconciliationRequired:
          true,

        courierID,

        payoutID:
          payout.id,

        reference,

        transferCode:
          transfer?.transfer_code ||
          null,

        transferID:
          transfer?.id != null
            ? String(
                transfer.id
              )
            : null,

        amount:
          payoutAmount,

        message:
          "Paystack transfer was initiated, but payout metadata could not be fully updated. Reconciliation required.",

      };
    }


    /* ======================================================
       17. SUCCESSFULLY INITIATED
    ====================================================== */

    return {

      success:
        true,

      status:
        "PROCESSING",

      courierID,

      payoutID:
        payout.id,

      reference,

      amount:
        payoutAmount,

      transferCode:
        transfer?.transfer_code ||
        null,

      transferID:
        transfer?.id != null
          ? String(
              transfer.id
            )
          : null,

      message:
        "Payout successfully initiated. Awaiting Paystack transfer confirmation.",

    };
  };


/* ==========================================================
   MAIN HANDLER
========================================================== */

exports.handler = async (
  event
) => {

  console.log(
    "=========================================="
  );

  console.log(
    "ATUA PROCESS PAYOUTS STARTED"
  );

  console.log(
    "EVENT:",
    JSON.stringify(
      event
    )
  );

  console.log(
    "=========================================="
  );


  try {

    /* ======================================================
       1. GET PAYSTACK SECRET
    ====================================================== */

    const secretKey =
      await getPaystackSecretKey();


    /* ======================================================
       2. GET INPUT
    ====================================================== */

    const argumentsData =
      event?.arguments ||
      event?.detail ||
      event ||
      {};


    let payoutMethod =
      argumentsData?.payoutMethod ||
      argumentsData?.method ||
      null;


    const courierID =
      argumentsData?.courierID ||
      argumentsData?.courierId ||
      null;


    const requestedAmount =
      argumentsData?.amount !== undefined &&
      argumentsData?.amount !== null &&
      argumentsData?.amount !== ""
        ? Number(
            argumentsData.amount
          )
        : null;


    /* ======================================================
       3. DEFAULT SINGLE MODE
    ====================================================== */

    if (
      !payoutMethod &&
      courierID
    ) {

      payoutMethod =
        "MANUAL_SINGLE";
    }


    if (
      !payoutMethod
    ) {

      throw new Error(
        "payoutMethod is required."
      );
    }


    payoutMethod =
      String(
        payoutMethod
      )
        .trim()
        .toUpperCase();


    /* ======================================================
       4. MANUAL SINGLE
    ====================================================== */

    if (
      payoutMethod ===
      "MANUAL_SINGLE"
    ) {

      if (!courierID) {

        throw new Error(
          "courierID is required for MANUAL_SINGLE."
        );
      }


      const result =
        await processCourierPayout({

          courierID,

          requestedAmount,

          payoutMethod:
            "MANUAL_SINGLE",

          secretKey,

        });


      return {

        statusCode:
          200,

        body:
          JSON.stringify(
            result
          ),

      };
    }


    /* ======================================================
       5. MANUAL ALL
    ====================================================== */

    if (
      payoutMethod ===
      "MANUAL_ALL"
    ) {

      const wallets =
        await getEligibleWallets();


      const results = [];


      for (
        const wallet
        of wallets
      ) {

        try {

          const result =
            await processCourierPayout({

              courierID:
                wallet.ownerID,

              requestedAmount:
                null,

              payoutMethod:
                "MANUAL_ALL",

              secretKey,

            });


          results.push(
            result
          );

        } catch (error) {

          console.error(
            "MANUAL_ALL PAYOUT ERROR:",
            {
              courierID:
                wallet.ownerID,

              error:
                error.message,
            }
          );


          results.push({

            success:
              false,

            courierID:
              wallet.ownerID,

            status:
              "FAILED",

            message:
              error.message,

          });
        }
      }


      return {

        statusCode:
          200,

        body:
          JSON.stringify({

            success:
              true,

            payoutMethod:
              "MANUAL_ALL",

            processed:
              results.length,

            successful:
              results.filter(
                (item) =>
                  item.success ===
                  true
              ).length,

            failed:
              results.filter(
                (item) =>
                  item.success ===
                  false
              ).length,

            results,

          }),

      };
    }


    /* ======================================================
       6. AUTOMATIC
    ====================================================== */

    if (
      payoutMethod ===
      "AUTOMATIC"
    ) {

      const wallets =
        await getEligibleWallets();


      const results = [];


      for (
        const wallet
        of wallets
      ) {

        try {

          const result =
            await processCourierPayout({

              courierID:
                wallet.ownerID,

              requestedAmount:
                null,

              payoutMethod:
                "AUTOMATIC",

              secretKey,

            });


          results.push(
            result
          );

        } catch (error) {

          console.error(
            "AUTOMATIC PAYOUT ERROR:",
            {
              courierID:
                wallet.ownerID,

              error:
                error.message,
            }
          );


          results.push({

            success:
              false,

            courierID:
              wallet.ownerID,

            status:
              "FAILED",

            message:
              error.message,

          });
        }
      }


      return {

        statusCode:
          200,

        body:
          JSON.stringify({

            success:
              true,

            payoutMethod:
              "AUTOMATIC",

            processed:
              results.length,

            successful:
              results.filter(
                (item) =>
                  item.success ===
                  true
              ).length,

            failed:
              results.filter(
                (item) =>
                  item.success ===
                  false
              ).length,

            results,

          }),

      };
    }


    /* ======================================================
       7. INVALID PAYOUT METHOD
    ====================================================== */

    throw new Error(
      `Unsupported payoutMethod: ${payoutMethod}`
    );


  } catch (error) {

    console.error(
      "=========================================="
    );

    console.error(
      "ATUA PROCESS PAYOUTS ERROR"
    );

    console.error(
      "MESSAGE:",
      error?.message
    );

    console.error(
      "STACK:",
      error?.stack
    );

    console.error(
      "=========================================="
    );


    return {

      statusCode:
        500,

      body:
        JSON.stringify({

          success:
            false,

          status:
            "FAILED",

          message:
            error?.message ||
            "Payout processing failed.",

        }),

    };
  }
};