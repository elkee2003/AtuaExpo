/* ==========================================================
   ATUA — PROCESS PAYOUTS LAMBDA
   PART 1 OF 5

   This Lambda handles:

   1. Courier-requested payouts
   2. Admin single payouts
   3. Admin all payouts
   4. Automatic scheduled payouts

   IMPORTANT:
   ----------
   This file is being rebuilt as ONE clean Lambda.

   Do NOT combine this with older processPayouts versions.
========================================================== */

/* ==========================================================
   AMPLIFY PARAMS
========================================================== */

/* Amplify Params - DO NOT EDIT
    API_ATUA_GRAPHQLAPIENDPOINTOUTPUT
    API_ATUA_GRAPHQLAPIIDOUTPUT
    API_ATUA_GRAPHQLAPIKEYOUTPUT
    ENV
    REGION
 Amplify Params - DO NOT EDIT */

const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

const https = require("https");

const crypto = require("crypto");

/* ==========================================================
   CONFIGURATION
========================================================== */

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const GRAPHQL_API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

const REGION = process.env.REGION || process.env.AWS_REGION;

// The deployed Lambda function name or ARN for reservePayoutWallet.
const RESERVE_PAYOUT_WALLET_FUNCTION_NAME =
  process.env.RESERVE_PAYOUT_WALLET_FUNCTION_NAME;

// AWS Lambda client used to invoke reservePayoutWallet.
const lambdaClient = new LambdaClient({
  region: REGION,
});

/* ==========================================================
   PAYOUT FINANCIAL RULES
========================================================== */

/*
 * COURIER-REQUESTED PAYOUT FEES
 *
 * The courier receives the full requested payout amount.
 * The Atua payout fee is additionally deducted from the wallet.
 *
 * ₦3,000 – ₦50,000       → ₦100 fee
 * ₦50,001 – ₦100,000     → ₦200 fee
 * ₦100,001 – ₦250,000    → ₦250 fee
 * ₦250,001+              → ₦300 fee
 */
const getCourierRequestedPayoutFee = (amount) => {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("Invalid courier payout amount.");
  }

  if (numericAmount <= 50000) {
    return 100;
  }

  if (numericAmount <= 100000) {
    return 200;
  }

  if (numericAmount <= 250000) {
    return 250;
  }

  return 300;
};

/*
 * ADMIN MANUAL PAYOUT
 *
 * Flat Atua payout fee.
 */
const ADMIN_PAYOUT_FEE = 100;

/*
 * SYSTEM / AUTOMATIC PAYOUT
 */
/*
 * The automatic payout fee is a flat ₦100.
 *
 * This is an Atua payout fee, not the Paystack transfer fee.
 */
const SYSTEM_PAYOUT_FEE = 100;

/*
 * Paystack minimum Nigerian transfer amount.
 */
const PAYSTACK_MIN_NG_TRANSFER_AMOUNT = 50;

/*
 * Nigerian stamp duty.
 *
 * This is separate from the ₦100 Atua payout fee.
 */
const PAYSTACK_NG_STAMP_DUTY = 50;

const PAYSTACK_NG_STAMP_DUTY_THRESHOLD = 10000;

/*
 * Set to true only if Atua qualifies for the applicable
 * registered payroll merchant exemption.
 */
const PAYSTACK_REGISTERED_PAYROLL_MERCHANT = false;

/*
 * Minimum amount for a courier personally requesting
 * a payout.
 *
 * This does NOT apply to admin payouts.
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
   PAYOUT STATUSES
========================================================== */

const PAYOUT_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  PAID: "PAID",
  FAILED: "FAILED",
};

/* ==========================================================
   STATUS HELPERS
========================================================== */

const normalizeStatus = (status) => {
  if (status === undefined || status === null) {
    return "";
  }

  return String(status).trim().toLowerCase();
};

/*
 * These statuses mean Paystack has not reached a
 * definite terminal failure.
 *
 * NEVER restore the wallet simply because a transfer
 * is pending/processing.
 */
const isPendingTransferStatus = (status) => {
  const normalizedStatus = normalizeStatus(status);

  return ["pending", "processing", "otp", "received"].includes(
    normalizedStatus,
  );
};

/*
 * These statuses represent definite transfer failure.
 */
const isFailedTransferStatus = (status) => {
  const normalizedStatus = normalizeStatus(status);

  return ["failed", "reversed", "abandoned", "blocked", "rejected"].includes(
    normalizedStatus,
  );
};

/* ==========================================================
   INVOKE RESERVE PAYOUT WALLET
========================================================== */

const invokeReservePayoutWallet = async (payoutID) => {
  if (!payoutID) {
    throw new Error("Payout ID is required for wallet reservation.");
  }

  if (!RESERVE_PAYOUT_WALLET_FUNCTION_NAME) {
    throw new Error(
      "RESERVE_PAYOUT_WALLET_FUNCTION_NAME environment variable is missing.",
    );
  }

  const command = new InvokeCommand({
    FunctionName: RESERVE_PAYOUT_WALLET_FUNCTION_NAME,

    InvocationType: "RequestResponse",

    Payload: Buffer.from(
      JSON.stringify({
        payoutID,
      }),
    ),
  });

  const response = await lambdaClient.send(command);

  if (response.FunctionError) {
    throw new Error(
      `reservePayoutWallet Lambda execution failed: ${response.FunctionError}`,
    );
  }

  let result;

  try {
    result = JSON.parse(Buffer.from(response.Payload || []).toString("utf8"));
  } catch (error) {
    throw new Error("Could not parse the reservePayoutWallet Lambda response.");
  }

  console.log("RESERVE PAYOUT WALLET RESPONSE:", result);

  return result;
};

/* ==========================================================
   GENERAL HELPERS
========================================================== */

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return numericValue;
};

const requireValue = (value, message) => {
  if (value === undefined || value === null || value === "") {
    throw new Error(message);
  }

  return value;
};

const getErrorMessage = (error) => {
  if (!error) {
    return "Unknown error.";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error?.message) {
    return String(error.message);
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error.";
  }
};

/* ==========================================================
   PAYOUT REFERENCE
========================================================== */

const generatePayoutReference = (courierID) => {
  const timestamp = Date.now().toString(36);

  const randomPart = crypto.randomBytes(8).toString("hex");

  const courierPart = String(courierID || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-12);

  return `ATUA-PAYOUT-${courierPart}-` + `${timestamp}-${randomPart}`;
};

/* ==========================================================
   GET PAYSTACK SECRET KEY FROM AWS SSM
========================================================== */

const getPaystackSecretKey = async () => {
  /*
   * PAYSTACK_SECRET_KEY contains the NAME/PATH of
   * the SSM parameter.
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
              `${operationName} returned HTTP ` +
                `${response.statusCode}: ${data}`,
            ),
          );
        }

        let parsed;

        try {
          parsed = JSON.parse(data);
        } catch {
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
  if (!secretKey) {
    throw new Error("Paystack secret key is required.");
  }

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
        } catch {
          const error = new Error(`Paystack returned invalid JSON: ${data}`);

          // We cannot safely determine whether Paystack
          // processed the transfer from an unreadable response.
          error.isPaystackAmbiguousResponse = true;
          error.paystackStatusCode = response.statusCode;

          return reject(error);
        }

        resolve({
          statusCode: response.statusCode,
          body: parsed,
        });
      });
    });

    request.on("error", (error) => {
      /*
       * IMPORTANT:
       *
       * A network error does NOT necessarily mean
       * Paystack did not receive the transfer.
       *
       * The payout processor will verify the transfer
       * by reference before deciding whether to restore
       * the wallet.
       */
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
  if (!courierID) {
    throw new Error("courierID is required.");
  }

  const query = `
    query GetCourier($id: ID!) {
      getCourier(id: $id) {
        id
        sub

        firstName
        lastName

        bankCode
        bankName
        accountName
        accountNumber

        isApproved
        isBlocked

        debtDueAt
        debtBlockedAt
        debtBlockReason
        debtRestrictionActive

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
   VERIFY COURIER PAYOUT REQUESTER
========================================================== */

const assertCourierOwnsPayoutRequest = async (event, courierID) => {
  const callerSub =
    event?.identity?.sub || event?.identity?.claims?.sub || null;

  if (!callerSub) {
    throw new Error("Unauthorized: authenticated courier access is required.");
  }

  if (!courierID) {
    throw new Error("Courier ID is required.");
  }

  // courierID is the database Courier.id, not Cognito sub.
  const courier = await getCourier(courierID);

  if (!courier) {
    throw new Error("Courier account was not found.");
  }

  if (!courier.sub || courier.sub !== callerSub) {
    throw new Error(
      "Unauthorized: you cannot request a payout for another courier.",
    );
  }

  return courier;
};

/* ==========================================================
   VERIFY ADMIN PAYOUT REQUESTER
========================================================== */

const assertAdminPayoutRequester = (event) => {
  const callerSub =
    event?.identity?.sub || event?.identity?.claims?.sub || null;

  if (!callerSub) {
    throw new Error(
      "Unauthorized: authenticated administrator access is required.",
    );
  }

  const adminGroup = process.env.ADMIN_GROUP_NAME;

  if (!adminGroup) {
    throw new Error("ADMIN_GROUP_NAME environment variable is not configured.");
  }

  const rawGroups =
    event?.identity?.groups ||
    event?.identity?.claims?.["cognito:groups"] ||
    [];

  let groups = [];

  if (Array.isArray(rawGroups)) {
    groups = rawGroups;
  } else if (typeof rawGroups === "string") {
    try {
      const parsed = JSON.parse(rawGroups);
      groups = Array.isArray(parsed)
        ? parsed
        : rawGroups.split(",").map((group) => group.trim());
    } catch {
      groups = rawGroups.split(",").map((group) => group.trim());
    }
  }

  if (!groups.includes(adminGroup)) {
    throw new Error("Unauthorized: administrator privileges are required.");
  }
};

/* ==========================================================
   GET COURIER WALLET
========================================================== */

const getCourierWallet = async (courierID, preferredWalletID = null) => {
  if (!courierID) {
    throw new Error("courierID is required.");
  }

  /*
   * FIRST CHOICE:
   * If the Courier record already has walletID,
   * retrieve that exact wallet.
   */
  if (preferredWalletID) {
    const query = `
      query GetCourierWallet($id: ID!) {
        getWallet(id: $id) {
          id
          ownerID
          ownerType
          availableBalance
          pendingBalance
          lifetimeEarnings
          outstandingDebt
          _version
        }
      }
    `;

    const data = await graphqlRequest(
      query,
      { id: preferredWalletID },
      "GetCourierWalletByID",
    );

    const wallet = data?.getWallet;

    if (!wallet) {
      throw new Error(
        `Courier wallet ${preferredWalletID} could not be found.`,
      );
    }

    if (wallet.ownerID !== courierID || wallet.ownerType !== "COURIER") {
      throw new Error(
        "The wallet linked to this courier does not belong to that courier.",
      );
    }

    return wallet;
  }

  /*
   * FALLBACK:
   * If Courier.walletID is empty, search for the courier's
   * wallet. Do not arbitrarily select the first result.
   */
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
          outstandingDebt
          _version
        }
        nextToken
      }
    }
  `;

  const allWallets = [];
  let nextToken = null;

  do {
    const data = await graphqlRequest(
      query,
      {
        filter: {
          ownerID: { eq: courierID },
          ownerType: { eq: "COURIER" },
        },
        limit: 1000,
        nextToken,
      },
      "GetCourierWallet",
    );

    const wallets = data?.listWallets?.items || [];

    allWallets.push(
      ...wallets.filter(
        (wallet) =>
          wallet &&
          wallet.ownerID === courierID &&
          wallet.ownerType === "COURIER",
      ),
    );

    nextToken = data?.listWallets?.nextToken || null;
  } while (nextToken);

  if (allWallets.length === 0) {
    return null;
  }

  if (allWallets.length > 1) {
    throw new Error(
      `Multiple courier wallets found for ${courierID}. Manual wallet reconciliation is required.`,
    );
  }

  return allWallets[0];
};

/* ==========================================================
   GET ACTIVE PAYOUTS FOR COURIER
========================================================== */

const getActiveCourierPayouts = async (courierID) => {
  if (!courierID) {
    throw new Error("courierID is required.");
  }

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
      ...payouts.filter((payout) => {
        const status = normalizeStatus(payout?.status);

        return status === "pending" || status === "processing";
      }),
    );

    nextToken = data?.listPayouts?.nextToken || null;
  } while (nextToken);

  return activePayouts;
};

/* ==========================================================
   GET PAYOUT BY REFERENCE
========================================================== */

const getPayoutByReference = async (reference) => {
  if (!reference) {
    throw new Error("Payout reference is required.");
  }

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

const getTransactionByReference = async ({
  reference,
  walletID = null,
  maxAttempts = 5,
  retryDelayMs = 500,
} = {}) => {
  if (!reference) {
    throw new Error("Transaction reference is required.");
  }

  const safeMaxAttempts = Math.min(Math.max(Number(maxAttempts) || 1, 1), 10);

  const safeRetryDelayMs = Math.min(
    Math.max(Number(retryDelayMs) || 0, 0),
    2000,
  );

  for (let attempt = 1; attempt <= safeMaxAttempts; attempt++) {
    try {
      const filter = {
        reference: {
          eq: reference,
        },
      };

      if (walletID) {
        filter.walletID = {
          eq: walletID,
        };
      }

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

              _deleted

              _lastChangedAt

              createdAt
              updatedAt
            }
          }
        }
      `;

      const data = await graphqlRequest(
        query,
        {
          filter,

          limit: 10,
        },
        "GetTransactionByReference",
      );

      const transactions = data?.listTransactions?.items || [];

      const transaction = transactions.find((item) => {
        if (!item) {
          return false;
        }

        /*
         * Ignore DataStore tombstones.
         */
        if (item._deleted === true) {
          return false;
        }

        /*
         * Reference must match.
         */
        if (item.reference !== reference) {
          return false;
        }

        /*
         * Payout transactions must be DEBIT.
         */
        if (item.type !== "DEBIT") {
          return false;
        }

        /*
         * If walletID was supplied, verify it.
         */
        if (walletID && item.walletID !== walletID) {
          return false;
        }

        return true;
      });

      if (transaction) {
        console.log("PAYOUT TRANSACTION FOUND:", {
          attempt,

          transactionID: transaction.id,

          walletID: transaction.walletID,

          amount: transaction.amount,

          reference: transaction.reference,

          status: transaction.status,

          version: transaction._version,
        });

        return transaction;
      }

      /*
       * AppSync/DataStore propagation may mean
       * the transaction is not immediately visible.
       */
      if (attempt < safeMaxAttempts && safeRetryDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, safeRetryDelayMs));
      }
    } catch (error) {
      console.error(
        `GET TRANSACTION BY REFERENCE ` + `ATTEMPT ${attempt} FAILED:`,
        getErrorMessage(error),
      );

      if (attempt < safeMaxAttempts && safeRetryDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, safeRetryDelayMs));
      }
    }
  }

  console.warn("PAYOUT TRANSACTION NOT FOUND AFTER RETRIES:", {
    reference,
    walletID,
    maxAttempts: safeMaxAttempts,
  });

  return null;
};

/* ==========================================================
   CREATE PAYSTACK TRANSFER RECIPIENT
========================================================== */

const createTransferRecipient = async ({ courier, secretKey }) => {
  if (!courier) {
    throw new Error("Courier information is required.");
  }

  if (!secretKey) {
    throw new Error("Paystack secret key is required.");
  }

  const bankCode = courier.bankCode;

  const accountNumber = courier.accountNumber;

  const accountName =
    courier.accountName ||
    `${courier.firstName || ""} ${courier.lastName || ""}`.trim();

  if (!bankCode) {
    throw new Error("Courier bank code is required.");
  }

  if (!accountNumber) {
    throw new Error("Courier account number is required.");
  }

  if (!accountName) {
    throw new Error("Courier account name is required.");
  }

  const response = await paystackRequest({
    method: "POST",

    path: "/transferrecipient",

    secretKey,

    body: {
      type: "nuban",

      name: accountName,

      account_number: accountNumber,

      bank_code: bankCode,

      currency: "NGN",
    },
  });

  if (
    response.statusCode < 200 ||
    response.statusCode >= 300 ||
    response.body?.status !== true
  ) {
    const message =
      response.body?.message ||
      response.body?.data?.message ||
      `Unable to create Paystack transfer recipient. HTTP ${response.statusCode}.`;

    throw new Error(message);
  }

  const recipient = response.body?.data;

  if (!recipient?.recipient_code) {
    throw new Error(
      "Paystack created the transfer recipient but did not return a recipient code.",
    );
  }

  console.log("PAYSTACK TRANSFER RECIPIENT CREATED:", {
    courierID: courier.id,

    recipientCode: recipient.recipient_code,

    recipientID: recipient.id,

    bankCode,

    accountNumber: `****${String(accountNumber).slice(-4)}`,
  });

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
  if (!secretKey) {
    throw new Error("Paystack secret key is required.");
  }

  if (!recipientCode) {
    throw new Error("Paystack recipient code is required.");
  }

  if (!reference) {
    throw new Error("Payout reference is required.");
  }

  const numericAmount = toNumber(amount);

  if (
    numericAmount === null ||
    numericAmount <= 0 ||
    !Number.isInteger(numericAmount)
  ) {
    throw new Error(
      "Paystack transfer amount must be a positive whole number.",
    );
  }

  if (numericAmount < PAYSTACK_MIN_NG_TRANSFER_AMOUNT) {
    throw new Error(
      `Paystack transfer amount cannot be below ₦${PAYSTACK_MIN_NG_TRANSFER_AMOUNT.toLocaleString()}.`,
    );
  }

  const response = await paystackRequest({
    method: "POST",

    path: "/transfer",

    secretKey,

    body: {
      source: "balance",

      /*
       * Paystack expects kobo.
       */
      amount: numericAmount * 100,

      recipient: recipientCode,

      reason: "Atua courier payout",

      reference,
    },
  });

  console.log("PAYSTACK TRANSFER RESPONSE:", {
    courierID,

    reference,

    statusCode: response.statusCode,

    status: response.body?.status,

    message: response.body?.message,

    transferStatus: response.body?.data?.status,

    transferCode: response.body?.data?.transfer_code,

    transferID: response.body?.data?.id,
  });

  if (
    response.statusCode < 200 ||
    response.statusCode >= 300 ||
    response.body?.status !== true
  ) {
    const error = new Error(
      response.body?.message ||
        `Paystack transfer initiation failed. HTTP ${response.statusCode}.`,
    );

    error.paystackResponse = response.body;

    error.paystackStatusCode = response.statusCode;

    throw error;
  }

  const transfer = response.body?.data;

  if (!transfer) {
    const error = new Error(
      "Paystack accepted the transfer request but returned no transfer data.",
    );

    error.paystackResponse = response.body;

    throw error;
  }

  return transfer;
};

/* ==========================================================
   VERIFY PAYSTACK TRANSFER
========================================================== */

const verifyPaystackTransfer = async (reference, secretKey) => {
  if (!reference) {
    throw new Error("Payout reference is required.");
  }

  if (!secretKey) {
    throw new Error("Paystack secret key is required.");
  }

  const response = await paystackRequest({
    method: "GET",

    path: `/transfer?reference=${encodeURIComponent(reference)}`,

    secretKey,
  });

  console.log("PAYSTACK TRANSFER VERIFICATION RESPONSE:", {
    reference,

    statusCode: response.statusCode,

    status: response.body?.status,

    message: response.body?.message,
  });

  if (
    response.statusCode >= 200 &&
    response.statusCode < 300 &&
    response.body?.status === true
  ) {
    const transferData = response.body?.data;

    /*
     * Normalize object/list response shapes.
     */
    const transfer = Array.isArray(transferData)
      ? transferData[0]
      : transferData;

    if (!transfer) {
      return null;
    }

    return transfer;
  }

  /*
   * No transfer found.
   *
   * This does NOT mean the transfer failed.
   */
  if (response.statusCode === 404) {
    return null;
  }

  throw new Error(
    response.body?.message ||
      `Unable to verify Paystack transfer. HTTP ${response.statusCode}.`,
  );
};

/* ==========================================================
   GET PAYSTACK BALANCE
========================================================== */

const getPaystackBalance = async (secretKey) => {
  if (!secretKey) {
    throw new Error("Paystack secret key is required.");
  }

  const response = await paystackRequest({
    method: "GET",

    path: "/balance",

    secretKey,
  });

  if (
    response.statusCode < 200 ||
    response.statusCode >= 300 ||
    response.body?.status !== true
  ) {
    throw new Error(
      response.body?.message ||
        `Unable to retrieve Paystack balance. HTTP ${response.statusCode}.`,
    );
  }

  const balances = response.body?.data;

  const ngnBalance = Array.isArray(balances)
    ? balances.find(
        (item) => String(item?.currency || "").toUpperCase() === "NGN",
      )
    : null;

  if (!ngnBalance) {
    throw new Error("Paystack NGN balance was not returned.");
  }

  /*
   * Paystack returns balance in kobo.
   */
  const balanceKobo = toNumber(ngnBalance.balance);

  if (balanceKobo === null || balanceKobo < 0) {
    throw new Error("Paystack returned an invalid NGN balance.");
  }

  const balanceNaira = balanceKobo / 100;

  console.log("PAYSTACK NGN BALANCE:", {
    balanceKobo,

    balanceNaira,
  });

  return balanceNaira;
};

/* ==========================================================
   CALCULATE PAYSTACK TRANSFER FEE
========================================================== */

const calculatePaystackTransferFee = (amount) => {
  const numericAmount = toNumber(amount);

  if (
    numericAmount === null ||
    numericAmount <= 0 ||
    !Number.isFinite(numericAmount)
  ) {
    throw new Error(
      "A valid payout amount is required to calculate Paystack transfer fee.",
    );
  }

  /*
   * Paystack Nigeria transfer fee rules.
   */
  if (numericAmount <= 5000) {
    return 10;
  }

  if (numericAmount <= 50000) {
    return 25;
  }

  return 50;
};

/* ==========================================================
   CALCULATE PAYSTACK STAMP DUTY
========================================================== */

const calculatePaystackStampDuty = (amount) => {
  const numericAmount = toNumber(amount);

  if (
    numericAmount === null ||
    numericAmount <= 0 ||
    !Number.isFinite(numericAmount)
  ) {
    throw new Error(
      "A valid payout amount is required to calculate Paystack stamp duty.",
    );
  }

  /*
   * Registered payroll merchants may qualify
   * for the applicable exemption.
   */
  if (PAYSTACK_REGISTERED_PAYROLL_MERCHANT) {
    return 0;
  }

  /*
   * ₦50 stamp duty applies to transfers
   * of ₦10,000 or more under our current rules.
   */
  if (numericAmount >= PAYSTACK_NG_STAMP_DUTY_THRESHOLD) {
    return PAYSTACK_NG_STAMP_DUTY;
  }

  return 0;
};

/* ==========================================================
   CALCULATE TOTAL PAYSTACK TRANSFER COST
========================================================== */

const calculatePaystackTransferCost = (amount) => {
  const transferFee = calculatePaystackTransferFee(amount);

  const stampDuty = calculatePaystackStampDuty(amount);

  const totalPaystackCost = transferFee + stampDuty;

  return {
    transferFee,

    stampDuty,

    totalPaystackCost,
  };
};
/* ==========================================================
   APPSYNC RESPONSE HELPER
========================================================== */

const createAppSyncResponse = (result, statusCode = 200) => {
  return {
    statusCode,

    body: JSON.stringify(result ?? {}),
  };
};

/* ==========================================================
   GET INPUT ARGUMENTS
========================================================== */

const getInputArguments = (event) => {
  return event?.arguments || event?.input || event?.detail || {};
};

/* ==========================================================
   GET APPSYNC FIELD NAME
========================================================== */

/*
 * IMPORTANT:
 *
 * AppSync fieldName may appear at:
 *
 *   event.fieldName
 *   event.info.fieldName
 *   event.arguments.fieldName
 *
 * The previous implementation only relied on
 * event.info.fieldName, which caused adminMakePayout
 * to be incorrectly routed as a courier payout.
 */
const getAppSyncFieldName = (event) => {
  return (
    event?.fieldName ||
    event?.info?.fieldName ||
    event?.arguments?.fieldName ||
    null
  );
};

/* ==========================================================
   NORMALIZE PAYOUT SOURCE
========================================================== */

const normalizePayoutSourceForProcessing = ({ payoutSource, payoutMethod }) => {
  /*
   * If the caller explicitly supplied a payout source,
   * use it after validating it.
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
   * Existing courier payout flow.
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
   * Admin manual payouts.
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
   * Existing courier payout method.
   */

  if (method === "BANK_TRANSFER") {
    return PAYOUT_METHOD.MANUAL_SINGLE;
  }

  /*
   * Automatic payout.
   */

  if (
    payoutSource === PAYOUT_SOURCE.SYSTEM ||
    method === PAYOUT_METHOD.AUTOMATIC
  ) {
    return PAYOUT_METHOD.AUTOMATIC;
  }

  /*
   * Admin single payout.
   */

  if (
    payoutSource === PAYOUT_SOURCE.ADMIN_MANUAL &&
    method === PAYOUT_METHOD.MANUAL_SINGLE
  ) {
    return PAYOUT_METHOD.MANUAL_SINGLE;
  }

  /*
   * Admin all payout.
   */

  if (
    payoutSource === PAYOUT_SOURCE.ADMIN_MANUAL &&
    method === PAYOUT_METHOD.MANUAL_ALL
  ) {
    return PAYOUT_METHOD.MANUAL_ALL;
  }

  /*
   * Compatibility fallbacks.
   */

  if (method === PAYOUT_METHOD.MANUAL_SINGLE) {
    return PAYOUT_METHOD.MANUAL_SINGLE;
  }

  if (method === PAYOUT_METHOD.MANUAL_ALL) {
    return PAYOUT_METHOD.MANUAL_ALL;
  }

  if (method === PAYOUT_METHOD.AUTOMATIC) {
    return PAYOUT_METHOD.AUTOMATIC;
  }

  throw new Error(`Unsupported payout method: ${payoutMethod}`);
};

/* ==========================================================
   GET ARGUMENT VALUE
==========================================================

   Supports multiple names for backwards compatibility.

   Example:

       courierID
       courierId
       courier_id
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
   NORMALIZE REQUESTED PAYOUT AMOUNT
==========================================================

   /*
 * COURIER_REQUESTED
 * -----------------
 * - Minimum ₦3,000.
 * - Atua payout fee depends on the requested amount:
 *     ₦3,000 – ₦50,000       → ₦100
 *     ₦50,001 – ₦100,000     → ₦200
 *     ₦100,001 – ₦250,000    → ₦250
 *     ₦250,001+              → ₦300
 * - The requested amount is what the courier receives.
 * - The payout fee is additionally deducted from the wallet.
 *
 * ADMIN_MANUAL
 * ------------
 * - No ₦3,000 minimum.
 * - Flat ₦100 Atua payout fee.
 * - Admin may request any positive amount within
 *   the available balance after the fee is considered.
 * - No amount means pay the full available balance
 *   if the wallet can cover the ₦100 fee.
 */

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
     * No amount means pay the maximum amount
     * the courier can receive while still covering
     * the ₦100 Atua payout fee.
     */
    if (!hasRequestedAmount) {
      const maximumAdminPayout = Number(
        (currentAvailable - ADMIN_PAYOUT_FEE).toFixed(2),
      );

      if (maximumAdminPayout < PAYSTACK_MIN_NG_TRANSFER_AMOUNT) {
        throw new Error(
          "Admin payout requires enough available balance to cover the ₦100 Atua payout fee.",
        );
      }

      return maximumAdminPayout;
    }

    const amount = Number(requestedAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Requested payout amount must be greater than zero.");
    }

    const normalizedAmount = Number(amount.toFixed(2));

    const maximumAdminPayout = Number(
      (currentAvailable - ADMIN_PAYOUT_FEE).toFixed(2),
    );

    if (maximumAdminPayout < PAYSTACK_MIN_NG_TRANSFER_AMOUNT) {
      throw new Error(
        `Admin payout requires at least ₦${(
          ADMIN_PAYOUT_FEE + PAYSTACK_MIN_NG_TRANSFER_AMOUNT
        ).toLocaleString()} available in the wallet.`,
      );
    }

    if (normalizedAmount > maximumAdminPayout) {
      throw new Error(
        "Requested admin payout amount plus the ₦100 Atua payout fee exceeds the available balance.",
      );
    }

    if (normalizedAmount < PAYSTACK_MIN_NG_TRANSFER_AMOUNT) {
      throw new Error(
        `Admin payout must be at least ₦${PAYSTACK_MIN_NG_TRANSFER_AMOUNT.toLocaleString()}.`,
      );
    }

    return normalizedAmount;
  }

  /* ========================================================
     COURIER REQUESTED
  ======================================================== */

  if (payoutSource === PAYOUT_SOURCE.COURIER_REQUESTED) {
    /*
     * No amount means the courier wants the maximum
     * amount they can withdraw while still covering
     * the applicable Atua payout fee.
     */
    if (!hasRequestedAmount) {
      const balance = Number(currentAvailable.toFixed(2));

      if (balance < MIN_COURIER_REQUESTED_PAYOUT) {
        throw new Error(
          `Minimum courier payout is ₦${MIN_COURIER_REQUESTED_PAYOUT.toLocaleString()}.`,
        );
      }

      /*
       * Find the maximum payout amount for which:
       *
       * payout amount + applicable payout fee
       * <= available wallet balance
       *
       * We check each fee tier because the fee changes
       * at ₦50,001, ₦100,001 and ₦250,001.
       */

      const candidateAmounts = [
        Number((balance - 100).toFixed(2)),
        Number((balance - 200).toFixed(2)),
        Number((balance - 250).toFixed(2)),
        Number((balance - 300).toFixed(2)),
      ];

      const validCandidates = candidateAmounts.filter((candidate) => {
        if (candidate < MIN_COURIER_REQUESTED_PAYOUT) {
          return false;
        }

        const fee = getCourierRequestedPayoutFee(candidate);

        return Number((candidate + fee).toFixed(2)) <= balance;
      });

      if (validCandidates.length === 0) {
        throw new Error(
          "Available balance is not enough to cover the minimum courier payout and applicable Atua payout fee.",
        );
      }

      return Math.max(...validCandidates);
    }

    const amount = Number(requestedAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Payout amount must be greater than zero.");
    }

    const normalizedAmount = Number(amount.toFixed(2));

    if (normalizedAmount < MIN_COURIER_REQUESTED_PAYOUT) {
      throw new Error(
        `Minimum courier payout is ₦${MIN_COURIER_REQUESTED_PAYOUT.toLocaleString()}.`,
      );
    }

    return normalizedAmount;
  }

  /* ========================================================
     SYSTEM / AUTOMATIC
  ======================================================== */

  if (payoutSource === PAYOUT_SOURCE.SYSTEM) {
    const payoutFee = SYSTEM_PAYOUT_FEE;

    /*
     * Explicit automatic payout amount:
     *
     * The requested amount is the amount the courier
     * receives.
     *
     * The ₦100 Atua fee is added to the wallet debit later.
     */

    if (hasRequestedAmount) {
      const amount = Number(requestedAmount);

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Payout amount must be greater than zero.");
      }

      const normalizedAmount = Number(amount.toFixed(2));

      const maximumAutomaticPayout = Number(
        (currentAvailable - payoutFee).toFixed(2),
      );

      if (maximumAutomaticPayout <= 0) {
        throw new Error(
          "Automatic payout requires enough available balance to cover the ₦100 Atua payout fee.",
        );
      }

      if (normalizedAmount > maximumAutomaticPayout) {
        throw new Error(
          "Requested automatic payout amount plus the ₦100 Atua payout fee exceeds the available balance.",
        );
      }

      if (normalizedAmount < PAYSTACK_MIN_NG_TRANSFER_AMOUNT) {
        throw new Error(
          `Automatic payout must be at least ₦${PAYSTACK_MIN_NG_TRANSFER_AMOUNT.toLocaleString()}.`,
        );
      }

      return normalizedAmount;
    }

    /*
     * Normal automatic payout:
     *
     * Wallet:
     *     ₦7,000
     *
     * Atua fee:
     *     ₦100
     *
     * Courier receives:
     *     ₦6,900
     *
     * Wallet debit:
     *     ₦7,000
     */

    const minimumAutomaticWalletBalance =
      payoutFee + PAYSTACK_MIN_NG_TRANSFER_AMOUNT;

    if (currentAvailable < minimumAutomaticWalletBalance) {
      throw new Error(
        `Automatic payout requires at least ₦${minimumAutomaticWalletBalance.toLocaleString()} available in the wallet.`,
      );
    }

    const automaticPayoutAmount = Number(
      (currentAvailable - payoutFee).toFixed(2),
    );

    if (automaticPayoutAmount < PAYSTACK_MIN_NG_TRANSFER_AMOUNT) {
      throw new Error(
        `Automatic payout must be at least ₦${PAYSTACK_MIN_NG_TRANSFER_AMOUNT.toLocaleString()}.`,
      );
    }

    return automaticPayoutAmount;
  }

  throw new Error("Unable to determine payout amount.");
};

/* ==========================================================
   CALCULATE PAYOUT FINANCIALS
========================================================== */

const calculatePayoutFinancials = ({ payoutAmount, payoutSource }) => {
  const numericPayoutAmount = Number(payoutAmount);

  if (!Number.isFinite(numericPayoutAmount) || numericPayoutAmount <= 0) {
    throw new Error("Payout amount must be greater than zero.");
  }

  const normalizedAmount = Number(numericPayoutAmount.toFixed(2));

  /* ========================================================
     COURIER REQUESTED
  ======================================================== */

  if (payoutSource === PAYOUT_SOURCE.COURIER_REQUESTED) {
    /*
     * Fee depends on the amount requested by the courier.
     *
     * The courier receives the FULL payout amount.
     *
     * The fee is additionally deducted from the wallet.
     */

    const payoutFee = getCourierRequestedPayoutFee(normalizedAmount);

    const totalWalletDebit = Number((normalizedAmount + payoutFee).toFixed(2));

    return {
      payoutAmount: normalizedAmount,

      payoutFee,

      actualPaystackTransferFee: 0,

      paystackStampDuty: 0,

      totalWalletDebit,
    };
  }

  /* ========================================================
     ADMIN MANUAL
  ======================================================== */

  if (payoutSource === PAYOUT_SOURCE.ADMIN_MANUAL) {
    /*
     * Admin payouts have a flat ₦100 Atua payout fee.
     *
     * The courier receives the full payout amount.
     *
     * Wallet debit:
     *
     *     payout amount + ₦100
     */

    const payoutFee = ADMIN_PAYOUT_FEE;

    const totalWalletDebit = Number((normalizedAmount + payoutFee).toFixed(2));

    return {
      payoutAmount: normalizedAmount,

      payoutFee,

      actualPaystackTransferFee: 0,

      paystackStampDuty: 0,

      totalWalletDebit,
    };
  }

  /* ========================================================
     SYSTEM / AUTOMATIC
  ======================================================== */

  if (payoutSource === PAYOUT_SOURCE.SYSTEM) {
    /*
     * Automatic/system payouts have a flat ₦100 Atua fee.
     *
     * The courier receives payoutAmount.
     *
     * Wallet debit:
     *
     *     payout amount + ₦100
     *
     * The Paystack transfer fee is NOT included in
     * payoutAmount and is NOT deducted from the courier.
     */

    const payoutFee = SYSTEM_PAYOUT_FEE;

    /*
     * Calculate the actual Paystack cost separately.
     */
    const { transferFee, stampDuty } =
      calculatePaystackTransferCost(normalizedAmount);

    const totalWalletDebit = Number((normalizedAmount + payoutFee).toFixed(2));

    return {
      payoutAmount: normalizedAmount,

      payoutFee,

      actualPaystackTransferFee: transferFee,

      paystackStampDuty: stampDuty,

      totalWalletDebit,
    };
  }

  throw new Error(
    `Unable to calculate payout financials for payout source: ${payoutSource}`,
  );
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

  if (!Number.isFinite(totalWalletDebit) || totalWalletDebit <= 0) {
    throw new Error("Total wallet debit is invalid.");
  }

  if (totalWalletDebit > availableBalance) {
    if (payoutSource === PAYOUT_SOURCE.COURIER_REQUESTED) {
      throw new Error(
        "Payout amount plus the applicable Atua payout fee exceeds available balance.",
      );
    }

    if (payoutSource === PAYOUT_SOURCE.SYSTEM) {
      throw new Error(
        "Automatic payout amount plus the ₦100 Atua payout fee exceeds available balance.",
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

   There is intentionally NO ₦3,000 minimum here.

   The ₦3,000 minimum applies only when the courier
   personally requests a payout.
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

    for (const wallet of items) {
      const courierID = wallet?.ownerID;

      const balance = Number(wallet?.availableBalance || 0);

      if (!courierID) {
        continue;
      }

      if (!Number.isFinite(balance) || balance <= 0) {
        continue;
      }

      /*
       * Check the courier's current restriction status
       * before including the wallet in the payout plan.
       */
      const courier = await getCourier(courierID);

      if (!courier) {
        console.warn("Skipping wallet: courier not found.", {
          courierID,
          walletID: wallet.id,
        });

        continue;
      }

      if (courier.isBlocked === true) {
        console.log("Skipping administratively blocked courier:", courierID);
        continue;
      }

      if (courier.debtRestrictionActive === true) {
        console.log("Skipping debt-restricted courier:", courierID);
        continue;
      }

      wallets.push(wallet);
    }

    nextToken = data?.listWallets?.nextToken || null;
  } while (nextToken);

  return wallets;
};

/* ==========================================================
   PREPARE AUTOMATIC PAYOUT PLAN
==========================================================

   IMPORTANT:

   This function ONLY calculates the plan.

   It does NOT:

       - create payouts
       - debit wallets
       - create Paystack recipients
       - initiate transfers

   It determines exactly how much Paystack must have
   before the first automatic transfer is allowed.
========================================================== */

const prepareAutomaticPayoutPlan = async (wallets) => {
  if (!Array.isArray(wallets)) {
    throw new Error("Automatic payout wallet list is invalid.");
  }

  console.log("==================================================");

  console.log("PREPARING AUTOMATIC PAYOUT PREFLIGHT");

  console.log("==================================================");

  const plan = [];

  const minimumAutomaticWalletBalance = Number(
    (SYSTEM_PAYOUT_FEE + PAYSTACK_MIN_NG_TRANSFER_AMOUNT).toFixed(2),
  );

  let totalCourierPayout = 0;

  let totalPayoutFees = 0;

  let totalWalletDebit = 0;

  let totalPaystackTransferFees = 0;

  let totalStampDuty = 0;

  const skipped = [];

  for (const wallet of wallets) {
    const courierID = wallet?.ownerID;

    const walletID = wallet?.id;

    const availableBalance = Number(wallet?.availableBalance || 0);

    /*
     * Wallet must belong to a courier.
     */

    if (!courierID || !walletID) {
      skipped.push({
        courierID: courierID || null,

        walletID: walletID || null,

        reason: "Wallet does not have a valid courier owner.",
      });

      continue;
    }

    /*
     * Ignore invalid/empty balances.
     */

    if (!Number.isFinite(availableBalance) || availableBalance <= 0) {
      skipped.push({
        courierID,

        walletID,

        availableBalance,

        reason: "Wallet does not have a positive available balance.",
      });

      continue;
    }

    /*
     * Minimum automatic wallet balance:
     *
     *     ₦100 Atua payout fee
     *   + ₦50 Paystack minimum transfer
     *   = ₦150
     */

    if (availableBalance < minimumAutomaticWalletBalance) {
      skipped.push({
        courierID,

        walletID,

        availableBalance,

        reason: `Wallet balance is below the ₦${minimumAutomaticWalletBalance.toLocaleString()} automatic payout minimum.`,
      });

      continue;
    }

    /*
     * Automatic payout:
     *
     * The courier receives the available wallet balance
     * minus the ₦100 Atua payout fee.
     *
     * Example:
     *
     *     Wallet balance = ₦75,000
     *     Atua fee       = ₦100
     *     Courier gets   = ₦74,900
     *
     * Wallet debit:
     *
     *     ₦74,900 + ₦100 = ₦75,000
     */

    const payoutAmount = Number(
      (availableBalance - SYSTEM_PAYOUT_FEE).toFixed(2),
    );

    /*
     * Final Paystack minimum check.
     */

    if (payoutAmount < PAYSTACK_MIN_NG_TRANSFER_AMOUNT) {
      skipped.push({
        courierID,

        walletID,

        availableBalance,

        payoutAmount,

        reason: `Calculated payout is below Paystack's ₦${PAYSTACK_MIN_NG_TRANSFER_AMOUNT.toLocaleString()} minimum transfer amount.`,
      });

      continue;
    }

    /*
     * Atua payout fee.
     *
     * This is separate from Paystack's own
     * transfer fee and stamp duty.
     */

    const payoutFee = Number(SYSTEM_PAYOUT_FEE.toFixed(2));

    /*
     * Total amount removed from the courier wallet.
     *
     * payoutAmount + payoutFee
     *
     * This should equal the original
     * available balance.
     */

    const walletDebit = Number((payoutAmount + payoutFee).toFixed(2));

    /*
     * Calculate actual Paystack costs separately.
     *
     * These are NOT deducted from the courier wallet.
     */

    const paystackCost = calculatePaystackTransferCost(payoutAmount);

    const transferFee = Number(paystackCost?.transferFee || 0);

    const stampDuty = Number(paystackCost?.stampDuty || 0);

    const totalPaystackCost = Number((transferFee + stampDuty).toFixed(2));

    /*
     * Add courier to automatic payout plan.
     */

    plan.push({
      courierID,

      walletID,

      availableBalance,

      payoutAmount,

      payoutFee,

      walletDebit,

      transferFee,

      stampDuty,

      totalPaystackCost,
    });

    /*
     * Update totals.
     */

    totalCourierPayout = Number((totalCourierPayout + payoutAmount).toFixed(2));

    totalPayoutFees = Number((totalPayoutFees + payoutFee).toFixed(2));

    totalWalletDebit = Number((totalWalletDebit + walletDebit).toFixed(2));

    totalPaystackTransferFees = Number(
      (totalPaystackTransferFees + transferFee).toFixed(2),
    );

    totalStampDuty = Number((totalStampDuty + stampDuty).toFixed(2));
  }

  /*
   * IMPORTANT:
   *
   * The Paystack requirement is:
   *
   *     courier payouts
   *   + transfer fees
   *   + stamp duty
   *
   * The ₦100 Atua payout fee is NOT added
   * to the Paystack requirement.
   *
   * The payout fee is charged separately from
   * the courier wallet.
   */

  const totalPaystackRequired = Number(
    (totalCourierPayout + totalPaystackTransferFees + totalStampDuty).toFixed(
      2,
    ),
  );

  console.log("AUTOMATIC PAYOUT PREFLIGHT COMPLETE:", {
    eligibleCourierCount: plan.length,

    skippedCourierCount: skipped.length,

    totalCourierPayout,

    totalPayoutFees,

    totalWalletDebit,

    totalPaystackTransferFees,

    totalStampDuty,

    totalPaystackRequired,
  });

  return {
    plan,

    skipped,

    eligibleCourierCount: plan.length,

    skippedCourierCount: skipped.length,

    totalCourierPayout,

    totalPayoutFees,

    totalWalletDebit,

    totalPaystackTransferFees,

    totalStampDuty,

    totalPaystackRequired,

    minimumAutomaticWalletBalance,
  };
};

/* ==========================================================
   VALIDATE AUTOMATIC PAYOUT PREFLIGHT
==========================================================

   If Paystack does not have enough money:

       ZERO TRANSFERS ARE STARTED.

   This check happens before runAutomaticPayouts()
   processes the first courier.
========================================================== */

const validateAutomaticPayoutPreflight = ({ payoutPlan, paystackBalance }) => {
  if (!payoutPlan) {
    throw new Error("Automatic payout plan is required.");
  }

  const availablePaystackBalance = Number(paystackBalance || 0);

  if (
    !Number.isFinite(availablePaystackBalance) ||
    availablePaystackBalance < 0
  ) {
    throw new Error("Paystack NGN balance is invalid.");
  }

  const totalPaystackRequired = Number(payoutPlan.totalPaystackRequired || 0);

  const topUpRequired = Number(
    Math.max(0, totalPaystackRequired - availablePaystackBalance).toFixed(2),
  );

  const sufficientBalance = availablePaystackBalance >= totalPaystackRequired;

  console.log("==================================================");

  console.log("AUTOMATIC PAYOUT PAYSTACK PREFLIGHT");

  console.log("==================================================");

  console.log({
    totalCourierPayout: payoutPlan.totalCourierPayout,

    totalPayoutFees: payoutPlan.totalPayoutFees,

    totalPaystackTransferFees: payoutPlan.totalPaystackTransferFees,

    totalStampDuty: payoutPlan.totalStampDuty,

    totalPaystackRequired,

    availablePaystackBalance,

    topUpRequired,

    sufficientBalance,
  });

  /*
   * INSUFFICIENT BALANCE:
   *
   * Return without starting a transfer.
   */

  if (!sufficientBalance) {
    return {
      sufficientBalance: false,

      status: "INSUFFICIENT_PAYSTACK_BALANCE",

      transferStarted: false,

      transferCount: 0,

      eligibleCourierCount: payoutPlan.eligibleCourierCount,

      skippedCourierCount: payoutPlan.skippedCourierCount,

      totalCourierPayout: payoutPlan.totalCourierPayout,

      totalPayoutFees: payoutPlan.totalPayoutFees,

      totalWalletDebit: payoutPlan.totalWalletDebit,

      totalPaystackTransferFees: payoutPlan.totalPaystackTransferFees,

      totalStampDuty: payoutPlan.totalStampDuty,

      totalPaystackRequired,

      availablePaystackBalance,

      topUpRequired,

      message:
        "Automatic payout was NOT started because the Paystack NGN balance is insufficient.",
    };
  }

  /*
   * SUFFICIENT BALANCE:
   *
   * Automatic payout may now proceed.
   */

  return {
    sufficientBalance: true,

    status: "READY",

    transferStarted: false,

    transferCount: 0,

    eligibleCourierCount: payoutPlan.eligibleCourierCount,

    skippedCourierCount: payoutPlan.skippedCourierCount,

    totalCourierPayout: payoutPlan.totalCourierPayout,

    totalPayoutFees: payoutPlan.totalPayoutFees,

    totalWalletDebit: payoutPlan.totalWalletDebit,

    totalPaystackTransferFees: payoutPlan.totalPaystackTransferFees,

    totalStampDuty: payoutPlan.totalStampDuty,

    totalPaystackRequired,

    availablePaystackBalance,

    topUpRequired: 0,

    message:
      "Automatic payout preflight passed. Paystack has sufficient balance to begin automatic payouts.",
  };
};

/* ==========================================================
   CREATE PAYOUT
========================================================== */

const createPayout = async ({
  courierID,
  walletID,
  amount,
  payoutFee,
  totalWalletDebit,
  payoutMethod,
  payoutSource,
  bankName,
  accountNumber,
  reference,
}) => {
  if (!courierID) {
    throw new Error("courierID is required.");
  }

  if (!walletID) {
    throw new Error("walletID is required.");
  }

  if (!reference) {
    throw new Error("Payout reference is required.");
  }

  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("Payout amount must be greater than zero.");
  }

  const mutation = `
    mutation CreatePayout(
      $input: CreatePayoutInput!
    ) {
      createPayout(input: $input) {
        id

        courierID
        walletID

        amount
        payoutFee
        totalWalletDebit

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

        createdAt
        updatedAt

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

        amount: Number(numericAmount.toFixed(2)),

        payoutFee: Number(Number(payoutFee || 0).toFixed(2)),

        totalWalletDebit: Number(
          Number(totalWalletDebit || numericAmount).toFixed(2),
        ),

        status: "PENDING",

        bankName: bankName || null,

        accountNumber: accountNumber || null,

        reference,

        payoutMethod,

        payoutSource,

        processedAt: null,

        paidAt: null,

        failedAt: null,

        failureReason: null,

        transferCode: null,

        transferID: null,
      },
    },
    "CreatePayout",
  );

  const payout = data?.createPayout;

  if (!payout) {
    throw new Error("Payout could not be created.");
  }

  return payout;
};

/* ==========================================================
   UPDATE PAYOUT
========================================================== */

const updatePayout = async ({ payout, updates = {} }) => {
  if (!payout?.id) {
    throw new Error("Payout ID is required.");
  }

  const mutation = `
    mutation UpdatePayout(
      $input: UpdatePayoutInput!
    ) {
      updatePayout(input: $input) {
        id

        courierID
        walletID

        amount
        payoutFee
        totalWalletDebit

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

        createdAt
        updatedAt

        _version
      }
    }
  `;

  /*
   * Only send fields that were actually supplied.
   *
   * This is important because sending undefined/null
   * unnecessarily can overwrite existing values.
   */

  const input = {
    id: payout.id,

    _version: payout._version,
  };

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      input[key] = value;
    }
  }

  const data = await graphqlRequest(
    mutation,
    {
      input,
    },
    "UpdatePayout",
  );

  const updatedPayout = data?.updatePayout;

  if (!updatedPayout) {
    throw new Error("Payout update returned no payout.");
  }

  return updatedPayout;
};

/* ==========================================================
   MARK PAYOUT FAILED
========================================================== */

const markPayoutFailed = async ({ payout, reason, transfer = null }) => {
  if (!payout?.id) {
    throw new Error("Payout ID is required.");
  }

  const failureReason = reason || "Paystack transfer failed.";

  return updatePayout({
    payout,

    updates: {
      status: "FAILED",

      failureReason,

      failedAt: new Date().toISOString(),

      processedAt: new Date().toISOString(),

      transferCode:
        transfer?.transfer_code ||
        transfer?.transferCode ||
        payout.transferCode ||
        null,

      transferID:
        transfer?.id || transfer?.transferID || payout.transferID || null,
    },
  });
};

/* ==========================================================
   GET PAYOUT WALLET
========================================================== */

const getPayoutWallet = async ({ courierID, walletID = null }) => {
  if (!courierID && !walletID) {
    throw new Error("courierID or walletID is required.");
  }

  /*
   * If we already know the wallet ID, query it directly.
   */

  if (walletID) {
    const query = `
      query GetWallet($id: ID!) {
        getWallet(id: $id) {
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

    const data = await graphqlRequest(
      query,
      {
        id: walletID,
      },
      "GetPayoutWallet",
    );

    const wallet = data?.getWallet || null;

    if (!wallet) {
      throw new Error("Payout wallet could not be found.");
    }

    return wallet;
  }

  /*
   * Otherwise find the courier wallet.
   */

  const wallet = await getCourierWallet(courierID);

  if (!wallet) {
    throw new Error("Courier wallet could not be found.");
  }

  return wallet;
};

/* ==========================================================
   RESERVE WALLET BALANCE
==========================================================

   This performs the wallet debit BEFORE Paystack transfer.

   For:

       COURIER_REQUESTED
       -----------------
       availableBalance -= payout + applicable tiered fee

       ADMIN_MANUAL
       ------------
       availableBalance -= payout + ₦100

       SYSTEM / AUTOMATIC
       ------------------
       availableBalance -= payout + ₦100

   IMPORTANT:

   The automatic ₦100 is the Atua payout fee.
   Paystack transfer fees and stamp duty are calculated
   separately and are not deducted from the courier wallet.
========================================================== */

const reserveWalletBalance = async ({ wallet, totalWalletDebit }) => {
  if (!wallet?.id) {
    throw new Error("Wallet ID is required.");
  }

  const debit = Number(totalWalletDebit);

  if (!Number.isFinite(debit) || debit <= 0) {
    throw new Error("Wallet debit amount is invalid.");
  }

  const currentAvailable = Number(wallet.availableBalance || 0);

  if (!Number.isFinite(currentAvailable) || currentAvailable < 0) {
    throw new Error("Wallet available balance is invalid.");
  }

  if (debit > currentAvailable) {
    throw new Error("Wallet does not have enough available balance.");
  }

  const newAvailableBalance = Number((currentAvailable - debit).toFixed(2));

  const mutation = `
    mutation UpdateWallet(
      $input: UpdateWalletInput!
    ) {
      updateWallet(input: $input) {
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

  const data = await graphqlRequest(
    mutation,
    {
      input: {
        id: wallet.id,

        availableBalance: newAvailableBalance,

        _version: wallet._version,
      },
    },
    "ReserveWalletBalance",
  );

  const updatedWallet = data?.updateWallet;

  if (!updatedWallet) {
    throw new Error("Wallet reservation failed.");
  }

  console.log("WALLET BALANCE RESERVED:", {
    walletID: wallet.id,

    previousBalance: currentAvailable,

    debit,

    newAvailableBalance,
  });

  return updatedWallet;
};

/* ==========================================================
   RESTORE PAYOUT WALLET
==========================================================

   Used ONLY when a Paystack transfer is definitely known
   to have failed/reversed.

   It restores the EXACT amount that was originally
   reserved from the wallet.

   That means:

       COURIER_REQUESTED
       -> payout + applicable tiered fee

       ADMIN_MANUAL
       -> payout + ₦100

       SYSTEM / AUTOMATIC
       -> payout + ₦100
========================================================== */

const restorePayoutWallet = async ({ wallet, amountToRestore }) => {
  if (!wallet?.id) {
    throw new Error("Wallet ID is required.");
  }

  const restoreAmount = Number(amountToRestore);

  if (!Number.isFinite(restoreAmount) || restoreAmount <= 0) {
    throw new Error("Wallet restoration amount is invalid.");
  }

  const currentAvailable = Number(wallet.availableBalance || 0);

  if (!Number.isFinite(currentAvailable) || currentAvailable < 0) {
    throw new Error("Wallet available balance is invalid.");
  }

  const restoredBalance = Number((currentAvailable + restoreAmount).toFixed(2));

  const mutation = `
    mutation UpdateWallet(
      $input: UpdateWalletInput!
    ) {
      updateWallet(input: $input) {
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

  const data = await graphqlRequest(
    mutation,
    {
      input: {
        id: wallet.id,

        availableBalance: restoredBalance,

        _version: wallet._version,
      },
    },
    "RestorePayoutWallet",
  );

  const updatedWallet = data?.updateWallet;

  if (!updatedWallet) {
    throw new Error("Wallet restoration failed.");
  }

  console.log("PAYOUT WALLET RESTORED:", {
    walletID: wallet.id,

    previousBalance: currentAvailable,

    restoredAmount: restoreAmount,

    newAvailableBalance: restoredBalance,
  });

  return updatedWallet;
};

/* ==========================================================
   CREATE DEBIT TRANSACTION
==========================================================

   Creates the transaction representing the wallet debit.

   IMPORTANT:

   This transaction uses the SAME payout reference as:

       Payout.reference
       Paystack transfer reference

   This gives us one reconciliation key across the
   entire payout lifecycle.
========================================================== */

const createDebitTransaction = async ({
  walletID,
  amount,
  payoutID,
  reference,
  description,
}) => {
  if (!walletID) {
    throw new Error("walletID is required.");
  }

  if (!reference) {
    throw new Error("Transaction reference is required.");
  }

  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("Transaction amount must be greater than zero.");
  }

  const mutation = `
    mutation CreateTransaction(
      $input: CreateTransactionInput!
    ) {
      createTransaction(input: $input) {
        id

        walletID
        payoutID

        type

        amount

        description

        orderID
        paymentID

        reference

        status

        _version

        _deleted

        _lastChangedAt

        createdAt
        updatedAt
      }
    }
  `;

  const data = await graphqlRequest(
    mutation,
    {
      input: {
        walletID,

        payoutID: payoutID || null,

        type: "DEBIT",

        amount: Number(numericAmount.toFixed(2)),

        description: description || "Atua courier payout",

        orderID: null,

        paymentID: null,

        reference,

        status: "PENDING",
      },
    },
    "CreateDebitTransaction",
  );

  const transaction = data?.createTransaction;

  if (!transaction) {
    throw new Error("Payout debit transaction could not be created.");
  }

  return transaction;
};

/* ==========================================================
   UPDATE PAYOUT TRANSACTION STATUS
========================================================== */

const updatePayoutTransactionStatus = async ({ transaction, status }) => {
  if (!transaction?.id) {
    throw new Error("Transaction ID is required.");
  }

  if (!status) {
    throw new Error("Transaction status is required.");
  }

  const mutation = `
    mutation UpdateTransaction(
      $input: UpdateTransactionInput!
    ) {
      updateTransaction(input: $input) {
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

        _deleted

        _lastChangedAt

        createdAt
        updatedAt
      }
    }
  `;

  const data = await graphqlRequest(
    mutation,
    {
      input: {
        id: transaction.id,

        status,

        _version: transaction._version,
      },
    },
    "UpdatePayoutTransactionStatus",
  );

  const updatedTransaction = data?.updateTransaction;

  if (!updatedTransaction) {
    throw new Error("Payout transaction status update failed.");
  }

  return updatedTransaction;
};

/* ==========================================================
   MARK TRANSACTION COMPLETED
========================================================== */

const markTransactionCompleted = async (reference) => {
  if (!reference) {
    throw new Error("Transaction reference is required.");
  }

  const transaction = await getTransactionByReference({
    reference,
  });

  if (!transaction) {
    console.warn(
      "Unable to mark payout transaction completed because transaction was not found:",
      reference,
    );

    return null;
  }

  return updatePayoutTransactionStatus({
    transaction,

    status: "COMPLETED",
  });
};

/* ==========================================================
   MARK TRANSACTION FAILED BY REFERENCE
========================================================== */

const markTransactionFailedByReference = async (reference) => {
  if (!reference) {
    throw new Error("Transaction reference is required.");
  }

  const transaction = await getTransactionByReference({
    reference,
  });

  if (!transaction) {
    console.warn(
      "Unable to mark payout transaction failed because transaction was not found:",
      reference,
    );

    return null;
  }

  return updatePayoutTransactionStatus({
    transaction,

    status: "FAILED",
  });
};

/* ==========================================================
   MARK TRANSACTION REVERSED BY REFERENCE
========================================================== */

/*
 * A payout transaction becomes REVERSED only after:
 *
 *     1. The payout has definitively failed
 *     2. The wallet debit has been successfully restored
 *
 * This is different from FAILED.
 *
 * FAILED:
 *     The payout transaction failed.
 *
 * REVERSED:
 *     The payout transaction failed AND the wallet money
 *     was successfully returned to the courier.
 */

const markTransactionReversedByReference = async (reference) => {
  if (!reference) {
    throw new Error("Transaction reference is required.");
  }

  const transaction = await getTransactionByReference({
    reference,
  });

  if (!transaction) {
    console.warn(
      "Unable to mark payout transaction reversed because transaction was not found:",
      reference,
    );

    return null;
  }

  return updatePayoutTransactionStatus({
    transaction,

    status: "REVERSED",
  });
};

/* ==========================================================
   MARK TRANSACTION PROCESSING
========================================================== */

/*
 * IMPORTANT:
 *
 * TransactionStatus does NOT have a PROCESSING value.
 *
 * Valid TransactionStatus values are:
 *
 *     PENDING
 *     COMPLETED
 *     FAILED
 *     REVERSED
 *
 * Therefore, when the Paystack transfer is still processing,
 * we DO NOT update the Transaction record.
 *
 * The Payout record is responsible for representing the
 * PROCESSING state.
 *
 * The Transaction remains PENDING until:
 *
 *     Paystack confirms success
 *              ↓
 *     Transaction → COMPLETED
 *
 * OR
 *
 *     Paystack definitively confirms failure
 *              ↓
 *     Wallet is restored
 *              ↓
 *     Transaction → REVERSED
 *
 * This means reconciliation can safely find the original
 * PENDING transaction later and either:
 *
 *     → mark it COMPLETED after confirmed success
 *     → restore the wallet and mark it REVERSED after
 *       confirmed failure
 */
const markTransactionProcessing = async (reference) => {
  if (!reference) {
    throw new Error("Transaction reference is required.");
  }

  const transaction = await getTransactionByReference({
    reference,
  });

  if (!transaction) {
    console.warn(
      "Unable to check payout transaction while payout is processing because transaction was not found:",
      reference,
    );

    return null;
  }

  console.log(
    "PAYOUT TRANSACTION REMAINS PENDING WHILE PAYSTACK TRANSFER IS PROCESSING:",
    {
      transactionID: transaction.id,
      reference: transaction.reference,
      status: transaction.status,
      walletID: transaction.walletID,
    },
  );

  return transaction;
};

/* ==========================================================
   GET PAYOUT TRANSACTION WITH RETRY
==========================================================

   AppSync/DataStore-backed records can take a short amount
   of time to become queryable after creation.

   Therefore this helper retries the READ.

   It NEVER creates another transaction.
========================================================== */

const getPayoutTransactionWithRetry = async ({
  reference,
  walletID = null,
  maxAttempts = 5,
  retryDelayMs = 500,
} = {}) => {
  return getTransactionByReference({
    reference,

    walletID,

    maxAttempts,

    retryDelayMs,
  });
};

/* ==========================================================
   UPDATE PAYOUT STATUS
========================================================== */

const updatePayoutStatus = async ({ payout, status, updates = {} }) => {
  if (!payout?.id) {
    throw new Error("Payout ID is required.");
  }

  if (!status) {
    throw new Error("Payout status is required.");
  }

  return updatePayout({
    payout,

    updates: {
      status,

      ...updates,
    },
  });
};

/* ==========================================================
   MARK PAYOUT PROCESSING
========================================================== */

const markPayoutProcessing = async ({ payout, transfer = null }) => {
  return updatePayoutStatus({
    payout,

    status: "PROCESSING",

    updates: {
      processedAt: new Date().toISOString(),

      transferCode:
        transfer?.transfer_code ||
        transfer?.transferCode ||
        payout.transferCode ||
        null,

      transferID:
        transfer?.id || transfer?.transferID || payout.transferID || null,

      failureReason: null,
    },
  });
};

/* ==========================================================
   MARK PAYOUT PAID
========================================================== */

const markPayoutPaid = async ({ payout, transfer = null }) => {
  return updatePayoutStatus({
    payout,

    status: "PAID",

    updates: {
      processedAt: new Date().toISOString(),

      paidAt: new Date().toISOString(),

      transferCode:
        transfer?.transfer_code ||
        transfer?.transferCode ||
        payout.transferCode ||
        null,

      transferID:
        transfer?.id || transfer?.transferID || payout.transferID || null,

      failureReason: null,
    },
  });
};

/* ==========================================================
   MARK PAYOUT FAILED WITH REASON
========================================================== */

const markPayoutFailedWithReason = async ({
  payout,
  reason,
  transfer = null,
}) => {
  return updatePayoutStatus({
    payout,

    status: "FAILED",

    updates: {
      processedAt: new Date().toISOString(),

      failedAt: new Date().toISOString(),

      failureReason: reason || "Paystack transfer failed.",

      transferCode:
        transfer?.transfer_code ||
        transfer?.transferCode ||
        payout.transferCode ||
        null,

      transferID:
        transfer?.id || transfer?.transferID || payout.transferID || null,
    },
  });
};

/* ==========================================================
   REQUEST PAYOUT REVERSAL
========================================================== */

const requestPayoutReversal = async ({
  payout,
  transaction,
  transfer = null,
  eventType = "transfer.failed",
  failureReason,
}) => {
  if (!payout?.id || !payout?.walletID || !payout?.reference) {
    throw new Error(
      "Cannot reverse payout: payout ID, wallet ID, and reference are required.",
    );
  }

  if (!transaction?.id || transaction.walletID !== payout.walletID) {
    throw new Error(
      "Cannot reverse payout: a valid debit transaction for the payout wallet is required.",
    );
  }

  const mutation = /* GraphQL */ `
    mutation ReversePayout($input: ReversePayoutInput!) {
      reversePayout(input: $input) {
        success
        payoutID
        transactionID
        walletID
        payoutStatus
        transactionStatus
        restoredAmount
        alreadyReversed
        message
      }
    }
  `;

  const input = {
    payoutID: payout.id,
    transactionID: transaction.id,
    walletID: payout.walletID,
    reference: payout.reference,
    restorationAmount: Number(transaction.amount),
    eventType,
    transferCode:
      transfer?.transfer_code ||
      transfer?.transferCode ||
      payout.transferCode ||
      null,
    transferID:
      transfer?.id != null ? String(transfer.id) : payout.transferID || null,
    failureReason: failureReason || "Paystack transfer failed.",
  };

  const data = await graphqlRequest(mutation, { input }, "ReversePayout");

  const result = data?.reversePayout;

  if (
    !result?.success ||
    result.payoutStatus !== "FAILED" ||
    result.transactionStatus !== "REVERSED"
  ) {
    throw new Error(
      result?.message ||
        "Payout reversal did not confirm the expected final statuses.",
    );
  }

  console.log("PAYOUT REVERSAL CONFIRMED:", {
    payoutID: result.payoutID,
    transactionID: result.transactionID,
    walletID: result.walletID,
    restoredAmount: result.restoredAmount,
    alreadyReversed: result.alreadyReversed,
  });

  return result;
};

/* ==========================================================
   PART 4 — PAYOUT EXECUTION
========================================================== */

/* ==========================================================
   PROCESS COURIER PAYOUT
==========================================================

   This is the central function that actually performs
   one payout.

   Supported payout sources:

       COURIER_REQUESTED
       ADMIN_MANUAL
       SYSTEM

   Supported payout methods:

       MANUAL_SINGLE
       MANUAL_ALL
       AUTOMATIC

   IMPORTANT:

   The automatic payout has a flat ₦100 Atua payout fee.

   For automatic payouts:

       Wallet = ₦7,000
       Atua fee = ₦100
       Courier receives = ₦6,900
       Wallet debit = ₦7,000

   The actual Paystack transfer fee and stamp duty
   are calculated separately.
========================================================== */

const processCourierPayout = async ({
  courierID,
  requestedAmount = null,
  payoutMethod,
  payoutSource,
  secretKey,
}) => {
  console.log("==================================================");

  console.log("PROCESSING COURIER PAYOUT");

  console.log("==================================================");

  console.log("Courier ID:", courierID);

  console.log("Requested amount:", requestedAmount);

  console.log("Payout method:", payoutMethod);

  console.log("Payout source:", payoutSource);

  /* ========================================================
     BASIC VALIDATION
  ======================================================== */

  if (!courierID) {
    throw new Error("courierID is required.");
  }

  /*
   * Determine the actual payout source.
   */
  const normalizedSource = normalizePayoutSourceForProcessing({
    payoutSource,
    payoutMethod,
  });

  /*
   * Determine the actual payout method.
   */
  const normalizedMethod = normalizePayoutMethodForProcessing({
    payoutMethod,
    payoutSource: normalizedSource,
  });

  console.log("Normalized payout source:", normalizedSource);

  console.log("Normalized payout method:", normalizedMethod);

  /* ========================================================
     GET COURIER
  ======================================================== */

  const courier = await getCourier(courierID);

  if (!courier) {
    throw new Error(`Courier not found: ${courierID}`);
  }

  /*
   * Prevent payouts to couriers who have been
   * administratively blocked.
   *
   * This remains independent of debt restrictions.
   */
  if (courier.isBlocked === true) {
    throw new Error(
      "Payout unavailable. This courier account has been blocked by administration.",
    );
  }

  /*
   * Prevent payouts when the debt-enforcement process
   * has activated the courier's debt restriction.
   *
   * IMPORTANT:
   * Outstanding debt by itself does not trigger this.
   * The 24-hour repayment period must be respected.
   */
  if (courier.debtRestrictionActive === true) {
    throw new Error(
      courier.debtBlockReason ||
        "Payout unavailable. This courier has an active outstanding-debt restriction.",
    );
  }

  /* ========================================================
     GET WALLET
  ======================================================== */

  const wallet = await getCourierWallet(courierID, courier.walletID);

  if (!wallet) {
    throw new Error(`Courier wallet not found: ${courierID}`);
  }

  const availableBalance = Number(wallet.availableBalance || 0);

  console.log("Courier wallet:", {
    walletID: wallet.id,

    availableBalance,

    pendingBalance: Number(wallet.pendingBalance || 0),
  });

  /* ========================================================
     DETERMINE PAYOUT AMOUNT
  ======================================================== */

  const payoutAmount = normalizeRequestedPayoutAmount({
    requestedAmount,
    payoutSource: normalizedSource,
    wallet,
  });

  console.log("Normalized payout amount:", payoutAmount);

  /* ========================================================
     CALCULATE FINANCIALS
  ======================================================== */

  const financials = calculatePayoutFinancials({
    payoutAmount,
    payoutSource: normalizedSource,
  });

  console.log("PAYOUT FINANCIALS:", financials);

  /* ========================================================
     VALIDATE WALLET
  ======================================================== */

  validatePayoutAgainstWallet({
    wallet,

    totalWalletDebit: financials.totalWalletDebit,

    payoutSource: normalizedSource,
  });

  /* ========================================================
     PREVENT DUPLICATE ACTIVE PAYOUTS
  ======================================================== */

  const activePayouts = await getActiveCourierPayouts(courierID);

  if (Array.isArray(activePayouts) && activePayouts.length > 0) {
    /*
     * Do not create another payout while an earlier
     * payout is still being processed.
     */
    throw new Error(
      "Courier already has an active payout that is still being processed.",
    );
  }

  /* ========================================================
     CREATE PAYOUT REFERENCE
  ======================================================== */

  const reference = `ATUA-PAYOUT-${courierID}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;

  console.log("Payout reference:", reference);

  /* ========================================================
     CREATE PAYOUT RECORD
  ======================================================== */

  // Create the payout record.
  // If AppSync creates it but the response is lost, look it up
  // using the unique reference before deciding that creation failed.

  let payout = null;

  try {
    payout = await createPayout({
      courierID,

      walletID: wallet.id,

      amount: financials.payoutAmount,

      payoutAmount: financials.payoutAmount,

      requestedAmount: financials.payoutAmount,

      payoutFee: financials.payoutFee,

      actualPaystackTransferFee: financials.actualPaystackTransferFee,

      paystackStampDuty: financials.paystackStampDuty,

      totalWalletDebit: financials.totalWalletDebit,

      payoutMethod: normalizedMethod,

      payoutSource: normalizedSource,

      bankName: courier.bankName,

      accountNumber: courier.accountNumber,

      reference,

      status: PAYOUT_STATUS.PENDING,
    });
  } catch (createError) {
    console.error(
      "PAYOUT CREATION RESPONSE FAILED. CHECKING WHETHER THE RECORD EXISTS:",
      {
        courierID,
        reference,
        error: createError?.message,
      },
    );

    try {
      // The create request may have succeeded even though
      // the Lambda did not receive its response.
      payout = await getPayoutByReference(reference);
    } catch (lookupError) {
      console.error("Could not verify payout creation:", lookupError);

      // Do not reserve wallet funds when we cannot establish
      // whether the payout record exists.
      throw new Error(
        `Payout creation is uncertain for reference ${reference}. No wallet reservation was attempted. Original error: ${createError?.message}`,
      );
    }

    if (!payout) {
      // We could not find a created payout record.
      // Stop before touching the wallet.
      throw createError;
    }

    console.log("PAYOUT RECORD RECOVERED AFTER CREATE RESPONSE FAILURE:", {
      payoutID: payout.id,
      reference: payout.reference,
      status: payout.status,
    });
  }

  if (!payout?.id) {
    throw new Error(
      `Payout record could not be confirmed for reference ${reference}.`,
    );
  }

  console.log("Payout record created:", payout?.id);

  /* ========================================================
     RESERVE WALLET BALANCE
  ========================================================

     This is intentionally done BEFORE Paystack transfer.

     Once reserved:

         availableBalance decreases.

     If the Paystack transfer definitely fails:

         the reserved amount is restored.

     If Paystack's result is uncertain:

         DO NOT automatically restore.

     This prevents double-paying the courier if Paystack
     actually received the transfer but our Lambda lost
     the response.
  ======================================================== */

  let walletReserved = false;

  let reservationAttempted = false;

  let reservation = null;

  let transaction = null;

  let transferStarted = false;

  // True when Paystack may have received the transfer request,
  // even if the Lambda did not receive a usable response.
  let transferOutcomeUncertain = false;

  try {
    /* ======================================================
     RESERVE WALLET THROUGH reservePayoutWallet
  ====================================================== */

    /*
     * Set this BEFORE invoking the Lambda.
     *
     * If the invocation times out, the reservation Lambda
     * might still have deducted the wallet.
     *
     * Therefore, we must not assume that an invocation error
     * means no wallet deduction happened.
     */
    reservationAttempted = true;

    const reservationResult = await invokeReservePayoutWallet(payout.id);

    /*
     * The reservation Lambda must explicitly confirm success.
     */
    if (!reservationResult?.success) {
      const definitelyNotReserved =
        reservationResult?.status === "FAILED" &&
        reservationResult?.walletDebited === false;

      const failureMessage =
        reservationResult?.message ||
        "Payout wallet reservation could not be confirmed.";

      if (definitelyNotReserved) {
        payout = await updatePayoutStatus({
          payout,
          status: PAYOUT_STATUS.FAILED,
          updates: {
            failedAt: new Date().toISOString(),
            processedAt: new Date().toISOString(),
            failureReason: failureMessage,
          },
        });
      } else {
        payout = await updatePayoutStatus({
          payout,
          status: PAYOUT_STATUS.PROCESSING,
          updates: {
            processedAt: new Date().toISOString(),
            failureReason: `${failureMessage} Reservation outcome requires reconciliation.`,
          },
        });
      }

      return {
        success: false,
        status: definitelyNotReserved
          ? "FAILED"
          : "FAILED_RECONCILIATION_REQUIRED",
        transferStarted: false,
        courierID,
        payout,
        transaction: null,
        reservation: reservationResult || null,
        payoutSource: normalizedSource,
        payoutMethod: normalizedMethod,
        financials,
        message: failureMessage,
      };
    }

    /*
     * At this point reservePayoutWallet has confirmed:
     *
     * 1. The wallet was debited.
     * 2. The debit transaction exists.
     * 3. The reservation status is RESERVED.
     */

    const reservedWalletID = reservationResult.walletID;
    const reservedPayoutID = reservationResult.payoutID;

    const reservedAmount = Number(
      reservationResult.totalWalletDebit ?? reservationResult.amountReserved,
    );

    if (
      reservationResult.status !== "RESERVED" ||
      !reservationResult.transactionID ||
      !reservedWalletID ||
      !reservedPayoutID ||
      reservationResult.reference !== reference ||
      reservedAmount !== Number(financials.totalWalletDebit) ||
      reservedWalletID !== wallet.id ||
      reservedPayoutID !== payout.id
    ) {
      throw new Error(
        "The reservation Lambda returned incomplete or mismatched reservation details.",
      );
    }

    walletReserved = true;

    reservation = reservationResult;

    /*
     * Reconstruct the transaction object using the exact
     * values returned by reservePayoutWallet.
     *
     * requestPayoutReversal requires:
     *
     * transaction.id
     * transaction.walletID
     * transaction.amount
     */

    transaction = {
      id: reservationResult.transactionID,
      walletID: reservedWalletID,
      payoutID: reservedPayoutID,
      type: "DEBIT",
      amount: reservedAmount,
      reference,
      status: "PENDING",
    };

    /*
     * Validate the reservation response before proceeding.
     */
    if (
      !transaction.id ||
      transaction.walletID !== wallet.id ||
      transaction.payoutID !== payout.id ||
      Number(transaction.amount) !== Number(financials.totalWalletDebit)
    ) {
      throw new Error(
        "The reservation Lambda returned transaction details that do not match the payout.",
      );
    }

    console.log("PAYOUT WALLET RESERVATION CONFIRMED:", {
      payoutID: payout.id,

      reservationID: reservationResult.reservationID,

      transactionID: transaction.id,

      walletID: transaction.walletID,

      amountReserved: transaction.amount,

      reservationStatus: reservationResult.status,
    });

    /* ======================================================
     CONTINUE WITH EXISTING PAYOUT PROCESSING
  ====================================================== */

    /*
     * Keep your existing MARK PAYOUT PROCESSING section
     * immediately below this point.
     */

    /* ======================================================
       MARK PAYOUT PROCESSING
    ====================================================== */

    payout = await markPayoutProcessing({
      payout,

      reference,

      transaction,
    });

    transaction = (await markTransactionProcessing(reference)) || transaction;

    /* ======================================================
       GET PAYSTACK SECRET
    ====================================================== */

    const resolvedSecretKey = secretKey || (await getPaystackSecretKey());

    if (!resolvedSecretKey) {
      throw new Error("Paystack secret key could not be loaded.");
    }

    /* ======================================================
       CREATE PAYSTACK TRANSFER RECIPIENT
    ====================================================== */

    const recipient = await createTransferRecipient({
      courier,

      secretKey: resolvedSecretKey,
    });

    console.log("Paystack recipient created:", {
      recipientCode: recipient?.recipient_code,
    });

    /* ======================================================
       INITIATE PAYSTACK TRANSFER
    ====================================================== */

    let transfer;

    try {
      transfer = await initiateTransfer({
        amount: financials.payoutAmount,

        recipientCode: recipient?.recipient_code,

        reference,

        secretKey: resolvedSecretKey,
      });

      transferStarted = true;
    } catch (transferError) {
      /*
       * A network error is different from a definite
       * Paystack rejection.
       *
       * If the request may have reached Paystack,
       * we MUST verify the transfer before deciding
       * whether the wallet can be restored.
       */

      if (
        transferError?.isPaystackNetworkError ||
        transferError?.isPaystackAmbiguousResponse ||
        Number(transferError?.paystackStatusCode) >= 500
      ) {
        transferOutcomeUncertain = true;

        console.warn("Paystack transfer request encountered a network error.");

        console.warn(
          "Attempting transfer verification before deciding wallet state.",
        );

        let verification = null;

        try {
          verification = await verifyPaystackTransfer(
            reference,
            resolvedSecretKey,
          );
        } catch (verificationError) {
          console.error(
            "Paystack verification also failed:",
            verificationError,
          );
        }

        /*
         * If Paystack confirms success, mark everything
         * as paid.
         */

        const verifiedStatus = String(
          verification?.status || verification?.data?.status || "",
        )
          .trim()
          .toLowerCase();

        const verifiedIsSuccess =
          verifiedStatus === "success" ||
          verifiedStatus === "successful" ||
          verifiedStatus === "completed";

        if (verifiedIsSuccess) {
          transaction = await markTransactionCompleted(reference);

          if (!transaction) {
            throw new Error(
              "Paystack confirmed the transfer, but the payout debit transaction could not be confirmed.",
            );
          }

          payout = await markPayoutPaid({
            payout,
            transfer: verification,
          });

          return {
            success: true,

            status: "PAID",

            transferStarted: true,

            courierID,

            payout,

            transaction,

            transfer: verification,

            payoutSource: normalizedSource,

            payoutMethod: normalizedMethod,

            financials,

            message:
              "Paystack transfer was confirmed as successful during verification.",
          };
        }

        /*
         * If verification says failed/reversed, the wallet
         * can safely be restored.
         */

        const verifiedIsFailure =
          verifiedStatus === "failed" ||
          verifiedStatus === "reversed" ||
          verifiedStatus === "abandoned";

        if (verifiedIsFailure) {
          try {
            const reversal = await requestPayoutReversal({
              payout,
              transaction,
              transfer: verification,
              eventType:
                verifiedStatus === "reversed"
                  ? "transfer.reversed"
                  : "transfer.failed",
              failureReason:
                "Paystack transfer was rejected or failed during verification.",
            });

            return {
              success: false,
              status: "FAILED",
              transferStarted: true,
              courierID,
              payout,
              transaction,
              transfer: verification,
              payoutSource: normalizedSource,
              payoutMethod: normalizedMethod,
              financials,
              reversal,
              message:
                "Paystack transfer failure was confirmed and the payout reversal was completed.",
            };
          } catch (reversalError) {
            console.error(
              "CRITICAL: Confirmed Paystack failure could not be fully reversed:",
              reversalError,
            );

            return {
              success: false,
              status: "FAILED_RECONCILIATION_REQUIRED",
              transferStarted: true,
              courierID,
              payout,
              transaction,
              transfer: verification,
              payoutSource: normalizedSource,
              payoutMethod: normalizedMethod,
              financials,
              message:
                "Paystack failure was confirmed, but the reversal did not complete. Reconciliation is required.",
              error: reversalError.message,
            };
          }
        }

        /*
         * No definite Paystack result.
         *
         * DO NOT restore the wallet.
         *
         * The transfer may still exist on Paystack.
         */

        payout = await updatePayoutStatus({
          payout,

          status: PAYOUT_STATUS.PROCESSING,
        });

        return {
          success: false,

          status: "PROCESSING",

          transferStarted: true,

          courierID,

          payout,

          transaction,

          transfer: verification,

          payoutSource: normalizedSource,

          payoutMethod: normalizedMethod,

          financials,

          message:
            "Paystack transfer result is uncertain. Payout remains processing so the wallet is not double-paid.",
        };
      }

      /*
       * This was a definite Paystack/application error.
       *
       * It is safe to restore the wallet.
       */

      throw transferError;
    }

    console.log("Paystack transfer initiated:", {
      transferId: transfer?.id,

      transferCode: transfer?.transfer_code,

      status: transfer?.status,

      reference,
    });

    /* ======================================================
       DETERMINE INITIAL TRANSFER STATUS
    ====================================================== */

    const transferStatus = String(
      transfer?.status || transfer?.data?.status || "",
    )
      .trim()
      .toLowerCase();

    const transferIsPending = isPendingTransferStatus(transferStatus);

    const transferIsFailed = isFailedTransferStatus(transferStatus);

    /* ======================================================
   TRANSFER INITIATED / PROCESSING
====================================================== */

    /*
     * IMPORTANT ACCOUNTING RULE:
     *
     * The response from the transfer-initiation request tells us
     * that Paystack accepted/created the transfer.
     *
     * It does NOT by itself mean the money has reached the
     * courier's bank account and the transfer can no longer be
     * reversed.
     *
     * Therefore we keep the payout in PROCESSING and the
     * transaction in PENDING until a final Paystack success
     * result is confirmed by the webhook/reconciliation flow.
     *
     * We also do NOT restore the wallet here.
     *
     * The wallet has already been debited/reserved and must remain
     * debited while the transfer is unresolved.
     */

    if (
      transferStatus === "success" ||
      transferStatus === "successful" ||
      transferStatus === "completed" ||
      transferIsPending ||
      !transferStatus
    ) {
      payout = await updatePayoutStatus({
        payout,

        status: PAYOUT_STATUS.PROCESSING,
      });

      transaction = (await markTransactionProcessing(reference)) || transaction;

      return {
        success: true,

        status: "PROCESSING",

        transferStarted: true,

        courierID,

        payoutID: payout?.id || null,

        payout,

        transaction,

        transfer,

        payoutSource: normalizedSource,

        payoutMethod: normalizedMethod,

        financials,

        message:
          "Paystack transfer was initiated successfully and is awaiting final settlement confirmation.",
      };
    }

    /* ======================================================
   DEFINITE FAILURE
====================================================== */

    /*
     * Paystack has definitively reported that the transfer
     * failed after it was initiated.
     *
     * IMPORTANT ACCOUNTING RULE:
     *
     *     Payout      → FAILED
     *     Wallet      → RESTORED
     *     Transaction → REVERSED
     *
     * REVERSED means that the original wallet debit has
     * actually been returned to the courier.
     *
     * Therefore we must NOT mark the Transaction as FAILED
     * here.
     */

    if (transferIsFailed) {
      try {
        const reversal = await requestPayoutReversal({
          payout,
          transaction,
          transfer,
          eventType:
            transferStatus === "reversed"
              ? "transfer.reversed"
              : "transfer.failed",
          failureReason: "Paystack transfer failed after initiation.",
        });

        return {
          success: false,
          status: "FAILED",
          transferStarted: true,
          courierID,
          payout,
          transaction,
          transfer,
          payoutSource: normalizedSource,
          payoutMethod: normalizedMethod,
          financials,
          reversal,
          message:
            "Paystack transfer failure was confirmed and the payout reversal was completed.",
        };
      } catch (reversalError) {
        console.error(
          "CRITICAL: Paystack transfer failed but reversal did not complete:",
          reversalError,
        );

        return {
          success: false,
          status: "FAILED_RECONCILIATION_REQUIRED",
          transferStarted: true,
          courierID,
          payout,
          transaction,
          transfer,
          payoutSource: normalizedSource,
          payoutMethod: normalizedMethod,
          financials,
          message:
            "Paystack transfer failure was confirmed, but the reversal did not complete. Reconciliation is required.",
          error: reversalError.message,
        };
      }
    }

    /* ======================================================
       UNKNOWN TRANSFER STATE
    ======================================================

       Never assume an unknown state means failure.

       Keep the payout processing so the wallet remains
       protected from a duplicate payout.
    ====================================================== */

    console.warn(
      "Unknown Paystack transfer status. Keeping payout in processing state.",
      {
        transferStatus,

        reference,
      },
    );

    payout = await updatePayoutStatus({
      payout,

      status: PAYOUT_STATUS.PROCESSING,
    });

    transaction = (await markTransactionProcessing(reference)) || transaction;

    return {
      success: true,

      status: "PROCESSING",

      transferStarted: true,

      courierID,

      payout,

      transaction,

      transfer,

      payoutSource: normalizedSource,

      payoutMethod: normalizedMethod,

      financials,

      message:
        "Paystack returned an unrecognized transfer state. Payout remains processing.",
    };
  } catch (error) {
    /*
     * Recover an ambiguous debit-transaction creation.
     *
     * AppSync may have created the transaction even if the
     * Lambda did not receive the successful response.
     *
     * Check by reference before treating the transaction
     * as missing or deciding what to do with the wallet.
     */
    if ((walletReserved || reservationAttempted) && !transaction && reference) {
      try {
        transaction = await getPayoutTransactionWithRetry({
          reference,
          walletID: wallet?.id,
          maxAttempts: 5,
          retryDelayMs: 500,
        });

        if (transaction) {
          walletReserved = true;
          console.log(
            "DEBIT TRANSACTION RECOVERED AFTER AMBIGUOUS CREATE RESPONSE:",
            {
              transactionID: transaction.id,
              reference: transaction.reference,
              status: transaction.status,
            },
          );
        } else {
          console.error(
            "DEBIT TRANSACTION NOT FOUND AFTER RETRIES:",
            reference,
          );
        }
      } catch (lookupError) {
        console.error("DEBIT TRANSACTION RECOVERY LOOKUP FAILED:", lookupError);
      }
    }

    console.error("==================================================");

    console.error("PAYOUT PROCESSING ERROR");

    console.error("==================================================");

    console.error("Courier ID:", courierID);

    console.error("Reference:", reference);

    console.error("Error:", error);

    /* ======================================================
       IMPORTANT ERROR SAFETY
    ======================================================

       If Paystack may have received the transfer, do NOT
       automatically restore the wallet.

       This prevents:

           Paystack transfer succeeds
                  +
           Lambda thinks it failed
                  +
           wallet gets restored
                  +
           courier gets paid twice
    ====================================================== */

    if (
      transferOutcomeUncertain ||
      error?.isPaystackNetworkError ||
      error?.isPaystackAmbiguousResponse ||
      Number(error?.paystackStatusCode) >= 500
    ) {
      try {
        payout = await updatePayoutStatus({
          payout,

          status: PAYOUT_STATUS.PROCESSING,
        });
      } catch (statusError) {
        console.error("Could not update payout to processing:", statusError);
      }

      try {
        await markTransactionProcessing(reference);
      } catch (transactionError) {
        console.error(
          "Could not update transaction to processing:",
          transactionError,
        );
      }

      return {
        success: false,

        status: "PROCESSING",

        transferStarted: true,

        courierID,

        payout,

        transaction,

        payoutSource: normalizedSource,

        payoutMethod: normalizedMethod,

        financials,

        message:
          "Paystack communication failed after payout processing began. Payout remains processing for reconciliation.",
      };
    }

    /* ======================================================
   DEFINITE APPLICATION / PAYSTACK FAILURE
====================================================== */

    /*
     * If Paystack transfer initiation has started, an
     * application error does NOT prove the transfer failed.
     *
     * Keep the payout PROCESSING. Do not restore the wallet
     * until Paystack's transfer outcome has been verified.
     */
    if (transferStarted) {
      console.error(
        "PAYOUT ERROR AFTER TRANSFER INITIATION; WALLET NOT RESTORED:",
        {
          reference,
          payoutID: payout?.id,
          transactionID: transaction?.id,
          error: error?.message,
        },
      );

      try {
        payout = await updatePayoutStatus({
          payout,
          status: PAYOUT_STATUS.PROCESSING,
        });
      } catch (statusError) {
        console.error(
          "Could not retain payout in PROCESSING state:",
          statusError,
        );
      }

      return {
        success: false,
        status: "PROCESSING",
        transferStarted: true,
        courierID,
        payout,
        transaction,
        payoutSource: normalizedSource,
        payoutMethod: normalizedMethod,
        financials,
        message:
          "An error occurred after transfer initiation. The wallet was not restored because the Paystack outcome must be verified.",
      };
    }

    /*
     * The wallet was reserved, but no debit transaction
     * is available to identify the exact amount to reverse.
     * Do not blindly credit the wallet.
     */
    if ((walletReserved || reservationAttempted) && !transaction) {
      console.error(
        "CRITICAL: WALLET RESERVED BUT DEBIT TRANSACTION IS MISSING:",
        {
          courierID,
          walletID: wallet?.id,
          payoutID: payout?.id,
          reference,
          amountToRestore: financials.totalWalletDebit,
        },
      );

      return {
        success: false,
        status: "FAILED_RECONCILIATION_REQUIRED",
        transferStarted: false,
        courierID,
        payout,
        transaction: null,
        payoutSource: normalizedSource,
        payoutMethod: normalizedMethod,
        financials,
        message:
          "Wallet balance was reserved, but the debit transaction could not be confirmed. Reconcile the wallet and transaction records before restoring the balance.",
      };
    }

    /*
     * A debit transaction exists and transfer initiation
     * has not started. Request reversal through reversePayout
     * instead of restoring the wallet directly.
     */
    if (walletReserved && transaction) {
      try {
        const reversal = await requestPayoutReversal({
          payout,
          transaction,
          transfer: null,
          eventType: "transfer.failed",
          failureReason:
            error?.message || "Payout failed before transfer initiation.",
        });

        walletReserved = false;

        return {
          success: false,
          status: "FAILED",
          transferStarted: false,
          courierID,
          payout,
          transaction,
          payoutSource: normalizedSource,
          payoutMethod: normalizedMethod,
          financials,
          reversal,
          message:
            "Payout failed before transfer initiation and the payout reversal was completed.",
        };
      } catch (reversalError) {
        console.error(
          "CRITICAL: Pre-transfer payout reversal did not complete:",
          reversalError,
        );

        return {
          success: false,
          status: "FAILED_RECONCILIATION_REQUIRED",
          transferStarted: false,
          courierID,
          payout,
          transaction,
          payoutSource: normalizedSource,
          payoutMethod: normalizedMethod,
          financials,
          message:
            "Payout failed before transfer initiation, but the wallet reversal did not complete. Reconciliation is required.",
          error: reversalError.message,
        };
      }
    }

    return {
      success: false,

      status: "FAILED",

      transferStarted: false,

      courierID,

      payout,

      transaction,

      payoutSource: normalizedSource,

      payoutMethod: normalizedMethod,

      financials,

      message: error?.message || "Payout processing failed.",
    };
  }
};

/* ==========================================================
   EXECUTE MANUAL ALL PAYOUTS
==========================================================

   ADMIN ONLY.

   This function pays all eligible courier wallets.

   IMPORTANT:

   Manual admin-all payouts:

    - have NO ₦3,000 courier minimum
    - have a flat ₦100 Atua payout fee
    - do NOT use an automatic reserve
    - are processed individually

   A failure for one courier does not cause already
   completed payouts to be reversed.

========================================================== */

const executeManualAllPayouts = async ({ secretKey }) => {
  console.log("==================================================");

  console.log("EXECUTING ADMIN MANUAL ALL PAYOUTS");

  console.log("==================================================");

  const wallets = await getEligibleWallets();

  if (!wallets.length) {
    console.log(
      "No courier wallets are currently eligible for manual-all payout.",
    );

    return {
      success: true,

      status: "NO_ELIGIBLE_COURIERS",

      processed: 0,

      paid: 0,

      processing: 0,

      failed: 0,

      totalRequested: 0,

      results: [],
    };
  }

  const results = [];

  let totalRequested = 0;

  let paid = 0;

  let processing = 0;

  let failed = 0;

  for (const wallet of wallets) {
    const courierID = wallet?.ownerID;

    if (!courierID) {
      results.push({
        courierID: null,

        status: "FAILED",

        message: "Wallet has no courier owner.",
      });

      failed += 1;

      continue;
    }

    const availableBalance = Number(wallet?.availableBalance || 0);

    const amount = Number((availableBalance - ADMIN_PAYOUT_FEE).toFixed(2));

    if (!Number.isFinite(amount) || amount < PAYSTACK_MIN_NG_TRANSFER_AMOUNT) {
      results.push({
        courierID,

        status: "SKIPPED",

        amount: 0,

        message: `Wallet balance is below the minimum required for an admin payout of ₦${PAYSTACK_MIN_NG_TRANSFER_AMOUNT.toLocaleString()} plus the ₦${ADMIN_PAYOUT_FEE.toLocaleString()} Atua payout fee.`,
      });

      continue;
    }

    totalRequested = Number((totalRequested + amount).toFixed(2));

    try {
      const result = await processCourierPayout({
        courierID,

        requestedAmount: amount,

        payoutMethod: PAYOUT_METHOD.MANUAL_ALL,

        payoutSource: PAYOUT_SOURCE.ADMIN_MANUAL,

        secretKey,
      });

      results.push({
        courierID,

        amount,

        status: result?.status || "UNKNOWN",

        success: result?.success !== false,

        message: result?.message || null,

        payoutID: result?.payout?.id || null,

        reference: result?.payout?.reference || null,
      });

      if (result?.status === "PAID") {
        paid += 1;
      } else if (result?.status === "PROCESSING") {
        processing += 1;
      } else {
        failed += 1;
      }
    } catch (error) {
      console.error(
        `Manual-all payout failed for courier ${courierID}:`,
        error,
      );

      failed += 1;

      results.push({
        courierID,

        amount,

        status: "FAILED",

        success: false,

        message: error?.message || "Manual-all payout failed.",
      });
    }
  }

  return {
    success: failed === 0,

    status:
      failed === 0
        ? "COMPLETED"
        : paid > 0 || processing > 0
          ? "PARTIALLY_COMPLETED"
          : "FAILED",

    processed: results.length,

    paid,

    processing,

    failed,

    totalRequested,

    results,
  };
};

/* ==========================================================
   CREATE ADMIN ALERT
==========================================================

   Creates a persistent AdminAlert record through AppSync.

   IMPORTANT:

   AdminAlert is stored in DynamoDB through the Amplify
   GraphQL API.

   This means the admin frontend can receive the alert
   through DataStore.observe(AdminAlert) without needing
   the Lambda to communicate directly with the browser.

========================================================== */

const createAdminAlert = async ({
  type,
  title,
  message,
  severity,
  status,
  payoutID = null,
  payoutMethod = null,
  payoutSource = null,
  courierID = null,
  amount = null,
  courierObligations = null,
  paystackCosts = null,
  totalRequired = null,
  paystackBalance = null,
  topUpRequired = null,
  affectedCourierCount = null,
  createdAt = new Date().toISOString(),
}) => {
  /* ========================================================
     ADMIN ALERT MUTATION
  ======================================================== */

  const mutation = `
    mutation CreateAdminAlert(
      $input: CreateAdminAlertInput!
    ) {
      createAdminAlert(
        input: $input
      ) {
        id

        type
        title
        message

        severity
        status

        payoutID
        payoutMethod
        payoutSource

        courierID

        amount
        courierObligations
        paystackCosts
        totalRequired
        paystackBalance
        topUpRequired

        affectedCourierCount

        createdAt
        readAt
        resolvedAt

        _version
      }
    }
  `;

  /* ========================================================
     BUILD INPUT
  ======================================================== */

  const input = {
    type,
    title,
    message,

    severity,
    status,

    payoutID,
    payoutMethod,
    payoutSource,

    courierID,

    amount,
    courierObligations,
    paystackCosts,
    totalRequired,
    paystackBalance,
    topUpRequired,

    affectedCourierCount,

    createdAt,
  };

  console.log("CREATING ADMIN ALERT:", {
    type,
    title,
    severity,
    status,
    payoutSource,
    payoutMethod,
    courierObligations,
    paystackCosts,
    totalRequired,
    paystackBalance,
    topUpRequired,
    affectedCourierCount,
  });

  /* ========================================================
     SEND TO APPSYNC
  ======================================================== */

  const data = await graphqlRequest(
    mutation,
    {
      input,
    },
    "CreateAdminAlert",
  );

  const alert = data?.createAdminAlert || null;

  if (!alert?.id) {
    throw new Error("AdminAlert creation did not return an alert ID.");
  }

  console.log("ADMIN ALERT CREATED:", {
    id: alert.id,
    type: alert.type,
    title: alert.title,
    severity: alert.severity,
    status: alert.status,
  });

  return alert;
};

/* ==========================================================
   NOTIFY ADMIN — AUTOMATIC PAYOUT INSUFFICIENT BALANCE
==========================================================

   IMPORTANT:

   This notification is persistent.

   When automatic payout cannot start because the
   Paystack balance is insufficient:

       1. NO transfer has started.
       2. No courier wallet has been debited.
       3. An AdminAlert record is created.
       4. The admin frontend receives it through
          DataStore.observe(AdminAlert).

   The alert contains both:

       - human-readable message
       - structured financial information

   This allows AlertCenter to display the financial
   breakdown without having to parse the message.

========================================================== */

const notifyAdminAutomaticPayoutInsufficientBalance = async ({
  totalCourierPayout,
  totalPaystackTransferFees,
  totalStampDuty,
  totalPaystackRequired,
  paystackBalance,
  topUpRequired,
  eligibleCourierCount,
}) => {
  /* ========================================================
     CALCULATE TOTAL PAYSTACK COSTS
  ======================================================== */

  const courierObligations = Number(Number(totalCourierPayout || 0).toFixed(2));

  const paystackCosts = Number(
    (
      Number(totalPaystackTransferFees || 0) + Number(totalStampDuty || 0)
    ).toFixed(2),
  );

  const totalRequired = Number(Number(totalPaystackRequired || 0).toFixed(2));

  const currentPaystackBalance = Number(
    Number(paystackBalance || 0).toFixed(2),
  );

  const requiredTopUp = Number(Number(topUpRequired || 0).toFixed(2));

  const affectedCourierCount = Number(eligibleCourierCount || 0);

  /* ========================================================
     HUMAN-READABLE ALERT MESSAGE
  ======================================================== */

  const message = `
AUTOMATIC PAYOUT NOT STARTED

Courier obligations:     ₦${courierObligations.toLocaleString()}

Paystack costs:          ₦${paystackCosts.toLocaleString()}

Total required:          ₦${totalRequired.toLocaleString()}

Paystack balance:        ₦${currentPaystackBalance.toLocaleString()}

TOP-UP REQUIRED:         ₦${requiredTopUp.toLocaleString()}

Eligible couriers:       ${affectedCourierCount}
`.trim();

  /* ========================================================
     LOG ALERT
  ======================================================== */

  console.warn("==================================================");

  console.warn("AUTOMATIC PAYOUT INSUFFICIENT PAYSTACK BALANCE");

  console.warn("==================================================");

  console.warn(message);

  /* ========================================================
     CREATE PERSISTENT ADMIN ALERT
  ======================================================== */

  let alert = null;

  try {
    alert = await createAdminAlert({
      type: "PAYOUT",

      title: "AUTOMATIC PAYOUT NOT STARTED",

      message,

      severity: "CRITICAL",

      status: "UNREAD",

      payoutID: null,

      payoutMethod: PAYOUT_METHOD.AUTOMATIC,

      payoutSource: PAYOUT_SOURCE.SYSTEM,

      courierID: null,

      amount: null,

      courierObligations,

      paystackCosts,

      totalRequired,

      paystackBalance: currentPaystackBalance,

      topUpRequired: requiredTopUp,

      affectedCourierCount,

      createdAt: new Date().toISOString(),
    });

    console.log("PERSISTENT ADMIN ALERT CREATED SUCCESSFULLY:", {
      alertID: alert?.id,
      type: alert?.type,
      title: alert?.title,
      severity: alert?.severity,
      status: alert?.status,
    });
  } catch (alertError) {
    /*
     * IMPORTANT:
     *
     * The payout was already stopped by the preflight.
     *
     * Therefore failure to create the AdminAlert must
     * NOT cause us to start the payout.
     *
     * We log the error clearly so it can be diagnosed.
     */

    console.error(
      "CRITICAL: FAILED TO CREATE PERSISTENT ADMIN ALERT:",
      alertError,
    );
  }

  /* ========================================================
     RETURN NOTIFICATION RESULT
  ======================================================== */

  return {
    notified: Boolean(alert?.id),

    alertID: alert?.id || null,

    message,

    totalCourierPayout: courierObligations,

    totalPaystackTransferFees,

    totalStampDuty,

    paystackCosts,

    totalPaystackRequired: totalRequired,

    paystackBalance: currentPaystackBalance,

    topUpRequired: requiredTopUp,

    eligibleCourierCount: affectedCourierCount,
  };
};

/* ==========================================================
   RUN AUTOMATIC PAYOUTS
==========================================================

   This is the Friday 6 PM automatic payout engine.

   FLOW:

       1. Find eligible courier wallets.
       2. Prepare complete payout plan.
       3. Calculate total Paystack requirement.
       4. Read LIVE Paystack balance.
       5. Run preflight.
       6. If insufficient:
              - pay nobody
              - send/log alert
              - stop
       7. If sufficient:
              - process couriers one by one
              - summarize results

   IMPORTANT:

   The preflight is all-or-nothing for the starting
   Paystack balance.

   Once transfers begin, individual Paystack transfers
   can still succeed/fail independently, so every payout
   is reconciled separately.

========================================================== */

const runAutomaticPayouts = async ({ secretKey }) => {
  console.log("==================================================");

  console.log("RUNNING AUTOMATIC PAYOUTS");

  console.log("==================================================");

  /* ========================================================
     GET ELIGIBLE WALLETS
  ======================================================== */

  const wallets = await getEligibleWallets();

  if (!wallets.length) {
    console.log("No courier wallets are eligible for automatic payout.");

    return {
      success: true,

      status: "NO_ELIGIBLE_COURIERS",

      eligibleCourierCount: 0,

      processed: 0,

      paid: 0,

      processing: 0,

      failed: 0,

      totalCourierPayout: 0,

      totalPayoutFees: 0,

      totalWalletDebit: 0,

      totalPaystackTransferFees: 0,

      totalStampDuty: 0,

      totalPaystackRequired: 0,

      paystackBalance: null,

      topUpRequired: 0,

      results: [],
    };
  }

  /* ========================================================
     PREPARE PLAN
  ======================================================== */

  const plan = await prepareAutomaticPayoutPlan(wallets);

  if (!plan.plan.length) {
    console.log("No courier wallets meet the automatic payout minimum.");

    return {
      success: true,

      status: "NO_ELIGIBLE_COURIERS",

      eligibleCourierCount: 0,

      skippedCourierCount: plan.skippedCourierCount,

      processed: 0,

      paid: 0,

      processing: 0,

      failed: 0,

      totalCourierPayout: 0,

      totalPayoutFees: 0,

      totalWalletDebit: 0,

      totalPaystackTransferFees: 0,

      totalStampDuty: 0,

      totalPaystackRequired: 0,

      paystackBalance: null,

      topUpRequired: 0,

      skipped: plan.skipped,

      results: [],
    };
  }

  /* ========================================================
     GET LIVE PAYSTACK BALANCE
  ======================================================== */

  const paystackBalance = await getPaystackBalance(secretKey);

  console.log("LIVE PAYSTACK BALANCE:", paystackBalance);

  /* ========================================================
     PRE-FLIGHT
  ======================================================== */

  const preflight = validateAutomaticPayoutPreflight({
    payoutPlan: plan,

    paystackBalance,
  });

  if (!preflight.sufficientBalance) {
    /*
     * THIS IS THE ALL-OR-NOTHING STOP.
     *
     * NO PAYSTACK TRANSFER HAS BEEN STARTED.
     */

    console.warn("AUTOMATIC PAYOUT STOPPED BEFORE ANY TRANSFER.");

    const notification = await notifyAdminAutomaticPayoutInsufficientBalance({
      totalCourierPayout: plan.totalCourierPayout,

      totalPaystackTransferFees: plan.totalPaystackTransferFees,

      totalStampDuty: plan.totalStampDuty,

      totalPaystackRequired: plan.totalPaystackRequired,

      paystackBalance,

      topUpRequired: preflight.topUpRequired,

      eligibleCourierCount: plan.eligibleCourierCount,
    });

    return {
      success: false,

      status: "INSUFFICIENT_PAYSTACK_BALANCE",

      transfersStarted: 0,

      eligibleCourierCount: plan.eligibleCourierCount,

      skippedCourierCount: plan.skippedCourierCount,

      totalCourierPayout: plan.totalCourierPayout,

      totalPayoutFees: plan.totalPayoutFees,

      totalWalletDebit: plan.totalWalletDebit,

      totalPaystackTransferFees: plan.totalPaystackTransferFees,

      totalStampDuty: plan.totalStampDuty,

      totalPaystackRequired: plan.totalPaystackRequired,

      paystackBalance,

      topUpRequired: preflight.topUpRequired,

      skipped: plan.skipped,

      notification,
    };
  }

  /* ========================================================
     PRE-FLIGHT PASSED
  ======================================================== */

  console.log("AUTOMATIC PAYOUT PREFLIGHT PASSED.");

  console.log("NO BALANCE SHORTFALL DETECTED.");

  /* ========================================================
     PROCESS PAYOUTS ONE BY ONE
  ======================================================== */

  const results = [];

  let paid = 0;

  let processing = 0;

  let failed = 0;

  for (const item of plan.plan) {
    console.log("--------------------------------------------------");

    console.log("PROCESSING AUTOMATIC PAYOUT:", item.courierID);

    console.log("--------------------------------------------------");

    try {
      const result = await processCourierPayout({
        courierID: item.courierID,

        /*
         * Use the exact amount calculated during
         * preflight.
         *
         * This prevents the amount from changing between
         * the preflight calculation and the transfer.
         */
        requestedAmount: item.payoutAmount,

        payoutMethod: PAYOUT_METHOD.AUTOMATIC,

        payoutSource: PAYOUT_SOURCE.SYSTEM,

        secretKey,
      });

      results.push({
        courierID: item.courierID,

        walletID: item.walletID,

        payoutAmount: item.payoutAmount,

        payoutFee: item.payoutFee,

        walletDebit: item.walletDebit,

        transferFee: item.transferFee,

        stampDuty: item.stampDuty,

        status: result?.status || "UNKNOWN",

        success: result?.success !== false,

        payoutID: result?.payout?.id || null,

        reference: result?.payout?.reference || null,

        message: result?.message || null,
      });

      if (result?.status === "PAID") {
        paid += 1;
      } else if (result?.status === "PROCESSING") {
        processing += 1;
      } else {
        failed += 1;
      }
    } catch (error) {
      console.error(
        `Automatic payout failed for courier ${item.courierID}:`,
        error,
      );

      failed += 1;

      results.push({
        courierID: item.courierID,

        walletID: item.walletID,

        payoutAmount: item.payoutAmount,

        walletDebit: item.walletDebit,

        transferFee: item.transferFee,

        stampDuty: item.stampDuty,

        status: "FAILED",

        success: false,

        payoutID: null,

        reference: null,

        message: error?.message || "Automatic payout failed.",
      });
    }
  }

  /* ========================================================
     FINAL SUMMARY
  ======================================================== */

  const finalStatus =
    failed === 0 && processing === 0
      ? "COMPLETED"
      : paid > 0 || processing > 0
        ? "PARTIALLY_COMPLETED"
        : "FAILED";

  console.log("==================================================");

  console.log("AUTOMATIC PAYOUT RUN COMPLETE");

  console.log("==================================================");

  console.log({
    eligibleCourierCount: plan.eligibleCourierCount,

    paid,

    processing,

    failed,

    totalCourierPayout: plan.totalCourierPayout,

    totalPayoutFees: plan.totalPayoutFees,

    totalWalletDebit: plan.totalWalletDebit,

    totalPaystackTransferFees: plan.totalPaystackTransferFees,

    totalStampDuty: plan.totalStampDuty,

    totalPaystackRequired: plan.totalPaystackRequired,

    paystackBalance,
  });

  return {
    success: failed === 0,

    status: finalStatus,

    transfersStarted: results.length,

    eligibleCourierCount: plan.eligibleCourierCount,

    skippedCourierCount: plan.skippedCourierCount,

    paid,

    processing,

    failed,

    totalCourierPayout: plan.totalCourierPayout,

    totalPayoutFees: plan.totalPayoutFees,

    totalWalletDebit: plan.totalWalletDebit,

    totalPaystackTransferFees: plan.totalPaystackTransferFees,

    totalStampDuty: plan.totalStampDuty,

    totalPaystackRequired: plan.totalPaystackRequired,

    paystackBalance,

    topUpRequired: 0,

    skipped: plan.skipped,

    results,
  };
};

/* ==========================================================
   DETERMINE SCHEDULED PAYOUT INVOCATION
========================================================== */

/*
 * EventBridge and EventBridge Scheduler invoke this Lambda
 * without normal AppSync arguments.
 *
 * We must detect those events BEFORE attempting to read:
 *
 *     payoutMethod
 *     courierID
 *     requestedAmount
 *
 * Supported scheduled invocation shapes:
 *
 *     EventBridge:
 *         source = "aws.events"
 *
 *     EventBridge Scheduler:
 *         source = "aws.scheduler"
 *
 *     Legacy scheduled-event shape:
 *         detail-type = "Scheduled Event"
 *
 *     Compatibility:
 *         type = "Scheduled Event"
 */

const isScheduledPayoutEvent = (event) => {
  return (
    event?.source === "aws.events" ||
    event?.source === "aws.scheduler" ||
    event?.["detail-type"] === "Scheduled Event" ||
    event?.type === "Scheduled Event"
  );
};

/* ==========================================================
   LAMBDA HANDLER
==========================================================

   SUPPORTED ROUTES
   ----------------

   1. Scheduled Event
      → SYSTEM / AUTOMATIC

   2. adminMakePayout
      → ADMIN_MANUAL / MANUAL_SINGLE

   3. adminMakeAllPayouts
      → ADMIN_MANUAL / MANUAL_ALL

   4. requestPayout
      → COURIER_REQUESTED / MANUAL_SINGLE

   5. courierRequestPayout
      → COURIER_REQUESTED / MANUAL_SINGLE


   LEGACY COMPATIBILITY
   --------------------

   BANK_TRANSFER
      → COURIER_REQUESTED

   MANUAL_SINGLE
      → COURIER_REQUESTED

   MANUAL_ALL
      → ADMIN_MANUAL


   IMPORTANT
   ---------

   Automatic payouts are NOT exposed as a normal
   AppSync payout request.

   They must be triggered by the scheduled event.

========================================================== */

exports.handler = async (event, context) => {
  console.log("==================================================");

  console.log("PROCESS PAYOUTS LAMBDA INVOKED");

  console.log("==================================================");

  console.log("EVENT:", JSON.stringify(event, null, 2));

  try {
    /* ======================================================
       1. DETECT SCHEDULED PAYOUT EVENT
    ======================================================

       THIS MUST HAPPEN BEFORE APPSYNC ARGUMENT VALIDATION.

       A scheduled EventBridge/Scheduler event does not
       contain:

           payoutMethod
           courierID
           requestedAmount

       Therefore we must recognize it first.

    ====================================================== */

    if (isScheduledPayoutEvent(event)) {
      console.warn("AUTOMATIC FRIDAY PAYOUTS ARE DISABLED.");

      return {
        success: false,
        status: "AUTOMATIC_PAYOUTS_DISABLED",
        transferStarted: false,
        message:
          "Scheduled automatic courier payouts have been disabled. Admin must initiate payouts manually.",
      };
    }

    /* ======================================================
       2. READ APPSYNC FIELD NAME
    ====================================================== */

    /*
     * IMPORTANT:
     *
     * AppSync events can expose fieldName differently
     * depending on the invocation structure.
     *
     * getAppSyncFieldName() already checks:
     *
     *   event.fieldName
     *   event.info.fieldName
     *   event.arguments.fieldName
     *
     * This fixes the previous problem where:
     *
     *   fieldName = null
     *
     * caused adminMakePayout to be incorrectly treated
     * as a courier payout.
     */

    const fieldName = getAppSyncFieldName(event);

    /* ======================================================
       3. READ APPSYNC ARGUMENTS
    ====================================================== */

    const args = getInputArguments(event);

    console.log("APPSYNC FIELD NAME:", fieldName);

    console.log("APPSYNC ARGUMENTS:", JSON.stringify(args, null, 2));

    /* ======================================================
   4. AUTHORIZE PAYOUT REQUEST
====================================================== */

    const requestedCourierID = getArgumentValue(args, [
      "courierID",
      "courierId",
      "courier_id",
    ]);

    const requestedPayoutMethod = String(
      getArgumentValue(args, ["payoutMethod", "method"]) || "",
    )
      .trim()
      .toUpperCase();

    const requestedPayoutSource = String(
      getArgumentValue(args, ["payoutSource", "source"]) || "",
    )
      .trim()
      .toUpperCase();

    /*
     * ADMIN REQUESTS
     *
     * These routes must only be accessible to administrators.
     */
    const isAdminPayoutRequest =
      fieldName === "adminMakePayout" ||
      fieldName === "adminMakeAllPayouts" ||
      requestedPayoutMethod === PAYOUT_METHOD.MANUAL_ALL ||
      requestedPayoutSource === PAYOUT_SOURCE.ADMIN_MANUAL;

    /*
     * COURIER REQUESTS
     *
     * These routes must only be accessible to the
     * authenticated courier whose Courier.sub matches
     * the Cognito identity sub.
     */
    const isCourierPayoutRequest =
      fieldName === "requestPayout" ||
      fieldName === "courierRequestPayout" ||
      requestedPayoutMethod === "BANK_TRANSFER" ||
      requestedPayoutMethod === PAYOUT_METHOD.MANUAL_SINGLE;

    if (isAdminPayoutRequest) {
      assertAdminPayoutRequester(event);
    } else if (isCourierPayoutRequest) {
      await assertCourierOwnsPayoutRequest(event, requestedCourierID);
    } else {
      throw new Error("Unauthorized or unsupported payout request.");
    }

    /* ======================================================
       4. LOAD PAYSTACK SECRET
    ====================================================== */

    const secretKey = await getPaystackSecretKey();

    /* ======================================================
       5. ADMIN SINGLE PAYOUT
    ======================================================

       GraphQL mutation:

           adminMakePayout

       Rules:

          - NO ₦3,000 courier minimum
          - FLAT ₦100 Atua payout fee
          - NO separate automatic reserve
          - Paystack minimum transfer of ₦50 still applies
          - processes eligible couriers sequentially

    ====================================================== */

    if (fieldName === "adminMakePayout") {
      console.log("ADMIN SINGLE PAYOUT REQUEST DETECTED.");

      const courierID = getArgumentValue(args, [
        "courierID",
        "courierId",
        "courier_id",
      ]);

      const requestedAmount = getArgumentValue(args, [
        "requestedAmount",
        "amount",
        "payoutAmount",
      ]);

      requireValue(courierID, "Courier ID is required for admin payout.");

      /*
       * IMPORTANT:
       *
       * We explicitly mark this as ADMIN_MANUAL.
       *
       * This prevents the ₦3,000 courier minimum and
       * ₦100 courier-requested payout fee from being
       * applied.
       */
      const result = await processCourierPayout({
        courierID,

        requestedAmount,

        payoutMethod: PAYOUT_METHOD.MANUAL_SINGLE,

        payoutSource: PAYOUT_SOURCE.ADMIN_MANUAL,

        secretKey,
      });

      console.log(
        "ADMIN SINGLE PAYOUT RESULT:",
        JSON.stringify(result, null, 2),
      );

      /*
       * AppSync requires:
       *
       *   statusCode: Int!
       *   body: String!
       *
       * Do not return the raw payout result directly.
       */
      return createAppSyncResponse(result, 200);
    }

    /* ======================================================
       6. ADMIN PAY ALL
    ======================================================

       GraphQL mutation:

           adminMakeAllPayouts

       Rules:

          - NO ₦3,000 courier minimum
          - FLAT ₦100 Atua payout fee
          - NO separate automatic reserve
          - Paystack minimum transfer of ₦50 still applies
          - processes eligible couriers sequentially

    ====================================================== */

    if (fieldName === "adminMakeAllPayouts") {
      console.log("ADMIN MAKE ALL PAYOUTS REQUEST DETECTED.");

      const result = await executeManualAllPayouts({
        secretKey,
      });

      console.log(
        "ADMIN MAKE ALL PAYOUTS RESULT:",
        JSON.stringify(result, null, 2),
      );

      /*
       * AppSync requires the ProcessPayoutsResponse shape.
       */
      return createAppSyncResponse(result, 200);
    }

    /* ======================================================
       7. COURIER REQUESTED PAYOUT
    ======================================================

       Supported mutations:

           requestPayout
           courierRequestPayout

       Rules:

           - Minimum ₦3,000
           - ₦100 Atua payout fee

    ====================================================== */

    if (fieldName === "requestPayout" || fieldName === "courierRequestPayout") {
      console.log("COURIER REQUESTED PAYOUT DETECTED.");

      const courierID = getArgumentValue(args, [
        "courierID",
        "courierId",
        "courier_id",
      ]);

      const requestedAmount = getArgumentValue(args, [
        "requestedAmount",
        "amount",
        "payoutAmount",
      ]);

      requireValue(courierID, "Courier ID is required for payout request.");

      /*
       * Explicitly mark this as COURIER_REQUESTED.
       *
       * Therefore:
       *
       *   minimum = ₦3,000
       *   Atua fee = ₦100
       */
      const result = await processCourierPayout({
        courierID,

        requestedAmount,

        payoutMethod: PAYOUT_METHOD.MANUAL_SINGLE,

        payoutSource: PAYOUT_SOURCE.COURIER_REQUESTED,

        secretKey,
      });

      console.log("COURIER PAYOUT RESULT:", JSON.stringify(result, null, 2));

      /*
       * AppSync requires the ProcessPayoutsResponse shape.
       */
      return createAppSyncResponse(result, 200);
    }

    /* ======================================================
       8. LEGACY / GENERIC ARGUMENTS
    ======================================================

       If the Lambda was called without one of the explicit
       mutation names above, inspect payoutMethod and
       payoutSource.

    ====================================================== */

    const payoutMethod = getArgumentValue(args, ["payoutMethod", "method"]);

    const payoutSource = getArgumentValue(args, ["payoutSource", "source"]);

    const courierID = getArgumentValue(args, [
      "courierID",
      "courierId",
      "courier_id",
    ]);

    const requestedAmount = getArgumentValue(args, [
      "requestedAmount",
      "amount",
      "payoutAmount",
    ]);

    console.log("GENERIC PAYOUT INPUT:", {
      courierID,

      requestedAmount,

      payoutMethod,

      payoutSource,
    });

    /* ======================================================
       9. LEGACY BANK_TRANSFER
    ====================================================== */

    if (payoutMethod === "BANK_TRANSFER") {
      console.log("LEGACY BANK_TRANSFER REQUEST DETECTED.");

      requireValue(
        courierID,
        "Courier ID is required for bank transfer payout.",
      );

      const result = await processCourierPayout({
        courierID,

        requestedAmount,

        payoutMethod: PAYOUT_METHOD.MANUAL_SINGLE,

        payoutSource: PAYOUT_SOURCE.COURIER_REQUESTED,

        secretKey,
      });

      return createAppSyncResponse(result, 200);
    }

    /* ======================================================
       10. LEGACY MANUAL_SINGLE
    ====================================================== */

    if (payoutMethod === PAYOUT_METHOD.MANUAL_SINGLE) {
      console.log("LEGACY MANUAL_SINGLE REQUEST DETECTED.");

      requireValue(
        courierID,
        "Courier ID is required for manual single payout.",
      );

      /*
       * Unless this came through adminMakePayout above,
       * MANUAL_SINGLE remains a courier-requested payout
       * for backwards compatibility.
       */
      const result = await processCourierPayout({
        courierID,

        requestedAmount,

        payoutMethod: PAYOUT_METHOD.MANUAL_SINGLE,

        payoutSource: PAYOUT_SOURCE.COURIER_REQUESTED,

        secretKey,
      });

      return createAppSyncResponse(result, 200);
    }

    /* ======================================================
       11. LEGACY MANUAL_ALL
    ====================================================== */

    if (payoutMethod === PAYOUT_METHOD.MANUAL_ALL) {
      console.log("LEGACY MANUAL_ALL REQUEST DETECTED.");

      const result = await executeManualAllPayouts({
        secretKey,
      });

      return createAppSyncResponse(result, 200);
    }

    /* ======================================================
       12. DIRECT AUTOMATIC REQUEST
    ======================================================

       We deliberately reject this.

       Automatic payouts must come from the scheduled
       EventBridge/Scheduler invocation.

       This prevents someone from accidentally calling:

           payoutMethod = AUTOMATIC

       through AppSync and bypassing the intended
       scheduled automatic payout process.

    ====================================================== */

    if (payoutMethod === PAYOUT_METHOD.AUTOMATIC) {
      throw new Error(
        "Direct automatic payout requests are not allowed. Automatic payouts must be triggered by the scheduled payout event.",
      );
    }

    /* ======================================================
       13. UNKNOWN PAYOUT REQUEST
    ====================================================== */

    throw new Error(
      `Unsupported payout request. AppSync fieldName=${fieldName || "null"}, payoutMethod=${payoutMethod || "null"}.`,
    );
  } catch (error) {
    const message = getErrorMessage(error);

    console.error("==================================================");

    console.error("PROCESS PAYOUTS LAMBDA ERROR");

    console.error("==================================================");

    console.error("Message:", message);

    console.error("Full error:", error);

    /*
     * Return a structured response.
     *
     * This is useful for AppSync testing because the
     * Lambda does not simply disappear behind an
     * unhandled exception.
     */
    return {
      statusCode: 500,

      body: JSON.stringify({
        success: false,

        status: "FAILED",

        transferStarted: false,

        message,

        error: message,
      }),
    };
  }
};

// Later we will add a proper automatic-payout retry mechanism. incase 6:00pm no sufficient money to pay, after top up, by 6:30pm or 7:00pm it should retry again

// Automatic payments of fridays has been disable, even on amazon eventbridge.Code might still remain (dormant)
