/* Amplify Params - DO NOT EDIT
	API_ATUA_GRAPHQLAPIENDPOINTOUTPUT
	API_ATUA_GRAPHQLAPIIDOUTPUT
	API_ATUA_GRAPHQLAPIKEYOUTPUT
	ENV
	REGION
Amplify Params - DO NOT EDIT */"use strict";

const https = require("https");

const { STSClient, GetCallerIdentityCommand } = require("@aws-sdk/client-sts");

const { SignatureV4 } = require("@smithy/signature-v4");
const { HttpRequest } = require("@smithy/protocol-http");
const { Sha256 } = require("@aws-crypto/sha256-js");
const { defaultProvider } = require("@aws-sdk/credential-provider-node");
/* ==========================================================
   CONFIGURATION
========================================================== */

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;
const API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

const REGION = process.env.REGION || process.env.AWS_REGION || "eu-north-1";

/* ==========================================================
   GENERAL HELPERS
========================================================== */

const money = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error("Invalid monetary amount.");
  }

  return Number(number.toFixed(2));
};

const errorMessage = (error) => {
  if (!error) return "Unknown error.";
  if (typeof error === "string") return error;

  return error.message || JSON.stringify(error);
};

const definiteFailure = (payoutID, code, message) => ({
  success: false,
  status: "FAILED",
  walletDebited: false,
  reservationCreated: false,
  uncertain: false,
  payoutID: payoutID || null,
  code,
  message,
});

const uncertainFailure = (
  payoutID,
  message,
  reservationID = null,
  status = "PENDING",
) => ({
  success: false,
  status,
  walletDebited: null,
  reservationCreated: reservationID !== null,
  uncertain: true,
  payoutID: payoutID || null,
  reservationID,
  code: "PAYOUT_RESERVATION_UNCERTAIN",
  message,
});

/* ==========================================================
   GRAPHQL REQUEST — API KEY AUTHENTICATION
========================================================== */

const graphqlRequest = async (
  query,
  variables = {},
  operationName = "AppSync operation",
) => {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error("API_ATUA_GRAPHQLAPIENDPOINTOUTPUT is not configured.");
  }

  if (!API_KEY) {
    throw new Error("API_ATUA_GRAPHQLAPIKEYOUTPUT is not configured.");
  }

  const endpoint = new URL(GRAPHQL_ENDPOINT);

  if (endpoint.protocol !== "https:" || !endpoint.hostname) {
    throw new Error("The AppSync GraphQL endpoint is invalid.");
  }

  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
    signal: AbortSignal.timeout(15000),
  });

  const responseText = await response.text();

  let parsed;

  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new Error(
      `${operationName}: AppSync returned invalid JSON: ${responseText}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `${operationName}: HTTP ${response.status}: ${responseText}`,
    );
  }

  if (parsed.errors?.length) {
    const messages = parsed.errors
      .map((item) => item.message)
      .filter(Boolean)
      .join(" | ");

    console.error(
      "APPSYNC COMPLETE GRAPHQL ERRORS:",
      JSON.stringify(parsed.errors, null, 2),
    );

    const error = new Error(messages || `${operationName} failed.`);

    error.graphqlErrors = parsed.errors;

    throw error;
  }

  return parsed.data || null;
};

/* ==========================================================
   AWS IAM CREDENTIALS
========================================================== */

const getAwsCredentials = defaultProvider();

/* ==========================================================
   AWS SIGNATURE V4 SIGNER
========================================================== */

const appSyncSigner = new SignatureV4({
  credentials: getAwsCredentials,
  region: REGION,
  service: "appsync",
  sha256: Sha256,
});

const signAppSyncRequest = async ({ method, path, body, host }) => {
  const endpoint = new URL(GRAPHQL_ENDPOINT);

  const request = new HttpRequest({
    protocol: endpoint.protocol,
    hostname: endpoint.hostname,
    port: endpoint.port ? Number(endpoint.port) : undefined,
    method,
    path,
    headers: {
      host,
      "content-type": "application/json",
    },
    body,
  });

  return appSyncSigner.sign(request);
};

/* ==========================================================
   GRAPHQL REQUEST — AWS IAM AUTHENTICATION
========================================================== */

const graphqlRequestIAM = async (
  query,
  variables = {},
  operationName = "AppSync IAM operation",
) => {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error("API_ATUA_GRAPHQLAPIENDPOINTOUTPUT is not configured.");
  }

  const endpoint = new URL(GRAPHQL_ENDPOINT);

  if (endpoint.protocol !== "https:" || !endpoint.hostname) {
    throw new Error("The AppSync GraphQL endpoint is invalid.");
  }

  const body = JSON.stringify({
    query,
    variables,
  });

  const path = `${endpoint.pathname}${endpoint.search}`;

  const signedRequest = await signAppSyncRequest({
    method: "POST",
    path,
    body,
    host: endpoint.host,
  });

  console.log("APPSYNC IAM REQUEST CHECK:", {
    operationName,
    endpointHost: endpoint.host,
    region: REGION,
    service: "appsync",
    hasAuthorizationHeader: !!signedRequest.headers.authorization,
    hasSecurityTokenHeader: !!(
      signedRequest.headers["x-amz-security-token"] ||
      signedRequest.headers["X-Amz-Security-Token"]
    ),
  });

  const options = {
    hostname: endpoint.hostname,
    port: endpoint.port || 443,
    path,
    method: "POST",
    headers: {
      ...signedRequest.headers,
      "Content-Length": Buffer.byteLength(body),
    },
  };

  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      let responseBody = "";

      response.on("data", (chunk) => {
        responseBody += chunk;
      });

      response.on("end", () => {
        let parsed;

        try {
          parsed = JSON.parse(responseBody);
        } catch {
          return reject(
            new Error(`${operationName}: AppSync returned invalid JSON.`),
          );
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          return reject(
            new Error(
              `${operationName}: HTTP ${response.statusCode}: ${responseBody}`,
            ),
          );
        }

        if (parsed.errors?.length) {
          const messages = parsed.errors
            .map((item) => item.message)
            .filter(Boolean)
            .join(" | ");

          console.error(
            "APPSYNC IAM GRAPHQL ERRORS:",
            JSON.stringify(parsed.errors, null, 2),
          );

          const error = new Error(messages || `${operationName} failed.`);

          error.graphqlErrors = parsed.errors;

          return reject(error);
        }

        resolve(parsed.data || null);
      });
    });

    request.on("error", reject);

    request.setTimeout(15000, () => {
      request.destroy(
        new Error(`${operationName}: AppSync IAM request timed out.`),
      );
    });

    request.write(body);
    request.end();
  });
};

/* ==========================================================
   GET PAYOUT
========================================================== */

const getPayout = async (payoutID) => {
  const query = `
    query GetPayout($id: ID!) {
      getPayout(id: $id) {
        id
        courierID
        walletID
        amount
        payoutFee
        totalWalletDebit
        status
        reference
        bankName
        accountNumber
        payoutMethod
        payoutSource
        processedAt
        paidAt
        failedAt
      }
    }
  `;

  const data = await graphqlRequest(query, { id: payoutID }, "GetPayout");

  return data?.getPayout || null;
};

/* ==========================================================
   GET COURIER
========================================================== */

const getCourier = async (courierID) => {
  if (!courierID) {
    throw new Error("Payout courier ID is missing.");
  }

  const query = `
    query GetCourier($id: ID!) {
      getCourier(id: $id) {
        id
        isBlocked
        debtRestrictionActive
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    { id: courierID },
    "GetPayoutCourier",
  );

  return data?.getCourier || null;
};

/* ==========================================================
   GET WALLET
========================================================== */

const getWallet = async ({ payout, courierID }) => {
  if (payout.walletID) {
    const query = `
      query GetWallet($id: ID!) {
        getWallet(id: $id) {
          id
          ownerID
          ownerType
          availableBalance
          pendingBalance
          lifetimeEarnings
          outstandingDebt
          _version
          _deleted
        }
      }
    `;

    const data = await graphqlRequest(
      query,
      { id: payout.walletID },
      "GetPayoutWallet",
    );

    return data?.getWallet || null;
  }

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
          _deleted
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
          ownerID: { eq: courierID },
          ownerType: { eq: "COURIER" },
        },
        limit: 100,
        nextToken,
      },
      "FindCourierWallet",
    );

    const wallets = data?.listWallets?.items || [];

    const wallet = wallets.find((item) => item && item._deleted !== true);

    if (wallet) return wallet;

    nextToken = data?.listWallets?.nextToken || null;
  } while (nextToken);

  return null;
};

/* ==========================================================
   GET PAYOUT RESERVATION

   The reservation ID is deliberately the payout ID.
   This makes the reservation idempotent for a payout.
========================================================== */

const getReservation = async (payoutID) => {
  const query = `
    query GetPayoutReservation($id: ID!) {
      getPayoutReservation(id: $id) {
        id
        payoutID
        walletID
        courierID
        totalWalletDebit
        payoutAmount
        payoutFee
        reference
        transactionID
        status
        failureReason
        reservedAt
        reversedAt
        _version
        _deleted
      }
    }
  `;

  const data = await graphqlRequestIAM(
    query,
    { id: payoutID },
    "GetPayoutReservation",
  );

  const reservation = data?.getPayoutReservation || null;

  if (reservation?._deleted === true) {
    return null;
  }

  return reservation;
};

/* ==========================================================
   CREATE PAYOUT RESERVATION
========================================================== */

const createReservation = async ({ payout, wallet, debit }) => {
  const mutation = `
    mutation CreatePayoutReservation(
      $input: CreatePayoutReservationInput!
    ) {
      createPayoutReservation(input: $input) {
        id
        payoutID
        walletID
        courierID
        totalWalletDebit
        payoutAmount
        payoutFee
        reference
        transactionID
        status
        failureReason
        reservedAt
        _version
      }
    }
  `;

  const input = {
    id: payout.id,
    payoutID: payout.id,
    walletID: wallet.id,
    courierID: payout.courierID,
    totalWalletDebit: debit,
    payoutAmount: money(payout.amount),
    payoutFee: money(payout.payoutFee || 0),
    reference: payout.reference,
    transactionID: null,
    status: "PENDING",
    failureReason: null,
    reservedAt: null,
  };

  const data = await graphqlRequestIAM(
    mutation,
    { input },
    "CreatePayoutReservation",
  );

  return data?.createPayoutReservation || null;
};

/* ==========================================================
   UPDATE PAYOUT RESERVATION
========================================================== */

const updateReservation = async (reservation, updates) => {
  if (!reservation?.id || reservation._version == null) {
    throw new Error("Reservation ID and version are required for an update.");
  }

  const mutation = `
    mutation UpdatePayoutReservation(
      $input: UpdatePayoutReservationInput!
    ) {
      updatePayoutReservation(input: $input) {
        id
        payoutID
        walletID
        courierID
        totalWalletDebit
        payoutAmount
        payoutFee
        reference
        transactionID
        status
        failureReason
        reservedAt
        reversedAt
        _version
      }
    }
  `;

  const data = await graphqlRequestIAM(
    mutation,
    {
      input: {
        id: reservation.id,
        _version: reservation._version,
        ...updates,
      },
    },
    "UpdatePayoutReservation",
  );

  return data?.updatePayoutReservation || null;
};

/* ==========================================================
   DEDUCT WALLET BALANCE
========================================================== */

const deductWallet = async ({ wallet, debit }) => {
  if (!wallet?.id) {
    throw new Error("Wallet ID is missing.");
  }

  if (wallet._version == null) {
    throw new Error("Wallet version is missing.");
  }

  const currentBalance = money(wallet.availableBalance || 0);

  if (currentBalance < debit) {
    throw new Error("Insufficient available wallet balance for this payout.");
  }

  const newBalance = money(currentBalance - debit);

  const mutation = `
    mutation UpdateWallet($input: UpdateWalletInput!) {
      updateWallet(input: $input) {
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
    mutation,
    {
      input: {
        id: wallet.id,
        availableBalance: newBalance,
        _version: wallet._version,
      },
    },
    "DeductPayoutWallet",
  );

  const updatedWallet = data?.updateWallet;

  if (!updatedWallet) {
    throw new Error("Wallet deduction was not confirmed by AppSync.");
  }

  return updatedWallet;
};

/* ==========================================================
   GET EXISTING PAYOUT DEBIT TRANSACTION
========================================================== */

const getPayoutDebitTransaction = async (transactionID) => {
  const query = `
    query GetTransaction($id: ID!) {
      getTransaction(id: $id) {
        id
        walletID
        payoutID
        type
        amount
        description
        reference
        status
        _version
        _deleted
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    { id: transactionID },
    "GetPayoutDebitTransaction",
  );

  const transaction = data?.getTransaction || null;

  if (transaction?._deleted === true) {
    return null;
  }

  return transaction;
};

/* ==========================================================
   CREATE PAYOUT DEBIT TRANSACTION

   The transaction ID is deterministic. Retrying the same
   payout cannot create a second debit transaction.
========================================================== */

const createPayoutDebitTransaction = async ({ payout, wallet, debit }) => {
  const transactionID = `${payout.id}-PAYOUT-DEBIT`;

  const validateExisting = (existing) => {
    if (
      existing.walletID !== wallet.id ||
      existing.payoutID !== payout.id ||
      existing.type !== "DEBIT" ||
      money(existing.amount) !== debit ||
      existing.reference !== payout.reference
    ) {
      throw new Error(
        "An existing payout debit transaction does not match this payout.",
      );
    }

    return existing;
  };

  const existing = await getPayoutDebitTransaction(transactionID);

  if (existing) {
    return validateExisting(existing);
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
        reference
        status
        _version
      }
    }
  `;

  const input = {
    id: transactionID,
    walletID: wallet.id,
    payoutID: payout.id,
    type: "DEBIT",
    amount: debit,
    description: `Atua payout reservation - ${payout.id}`,
    reference: payout.reference,
    status: "PENDING",
  };

  try {
    const data = await graphqlRequest(
      mutation,
      { input },
      "CreatePayoutDebitTransaction",
    );

    const transaction = data?.createTransaction;

    if (!transaction) {
      throw new Error("Payout debit transaction was not confirmed.");
    }

    return transaction;
  } catch (error) {
    // The mutation may have succeeded even if its response
    // was lost. Read the deterministic ID before failing.

    const retryRead = await getPayoutDebitTransaction(transactionID);

    if (retryRead) {
      return validateExisting(retryRead);
    }

    throw error;
  }
};

/* ==========================================================
   VALIDATE PAYOUT AND WALLET
========================================================== */

const validatePayout = ({ payout, wallet }) => {
  if (!payout) {
    throw new Error("Payout record could not be found.");
  }

  if (!payout.id || !payout.courierID) {
    throw new Error("Payout ID or courier ID is missing.");
  }

  if (!payout.reference) {
    throw new Error("Payout reference is missing.");
  }

  if (!wallet || wallet._deleted === true) {
    throw new Error("Courier wallet could not be found.");
  }

  if (wallet.ownerID !== payout.courierID) {
    throw new Error("The payout wallet does not belong to this courier.");
  }

  if (wallet.ownerType !== "COURIER") {
    throw new Error("The selected wallet is not a courier wallet.");
  }

  const payoutAmount = money(payout.amount);
  const payoutFee = money(payout.payoutFee || 0);
  const totalWalletDebit = money(payout.totalWalletDebit);

  if (payoutAmount <= 0 || totalWalletDebit <= 0) {
    throw new Error("Payout amount or wallet debit is invalid.");
  }

  if (Math.abs(totalWalletDebit - money(payoutAmount + payoutFee)) > 0.01) {
    throw new Error(
      "Payout.totalWalletDebit does not match amount plus payoutFee.",
    );
  }

  const status = String(payout.status || "").toUpperCase();

  if (status !== "PENDING" && status !== "PROCESSING") {
    throw new Error(
      `Payout cannot be reserved while its status is ${status || "EMPTY"}.`,
    );
  }

  return {
    payoutAmount,
    payoutFee,
    totalWalletDebit,
  };
};

/* ==========================================================
   MAIN HANDLER
========================================================== */

exports.handler = async (event) => {
  console.log("RESERVE PAYOUT WALLET EVENT:", {
    payoutID:
      event?.payoutID ||
      event?.arguments?.payoutID ||
      event?.detail?.payoutID ||
      null,
    diagnosticOnly: event?.diagnosticOnly === true,
  });

  let payoutID =
    event?.payoutID || event?.arguments?.payoutID || event?.detail?.payoutID;

  if (!payoutID && event?.body) {
    try {
      const body =
        typeof event.body === "string" ? JSON.parse(event.body) : event.body;

      payoutID = body?.payoutID;
    } catch {
      // Required-field validation below handles this.
    }
  }

  if (!payoutID) {
    return definiteFailure(null, "MISSING_PAYOUT_ID", "payoutID is required.");
  }

  if (!GRAPHQL_ENDPOINT) {
    return definiteFailure(
      payoutID,
      "APPSYNC_ENDPOINT_MISSING",
      "API_ATUA_GRAPHQLAPIENDPOINTOUTPUT is not configured.",
    );
  }

  if (!API_KEY) {
    return definiteFailure(
      payoutID,
      "APPSYNC_API_KEY_MISSING",
      "API_ATUA_GRAPHQLAPIKEYOUTPUT is not configured.",
    );
  }

  // TEMPORARY READ-ONLY DIAGNOSTIC
  // Tests STS identity, API-key payout access and IAM reservation access.

  if (event?.diagnosticOnly === true) {
    try {
      const sts = new STSClient({
        region: REGION,
      });

      const callerIdentity = await sts.send(new GetCallerIdentityCommand({}));

      console.log("ACTUAL LAMBDA AWS IDENTITY:", {
        account: callerIdentity.Account,
        arn: callerIdentity.Arn,
        userId: callerIdentity.UserId,
      });

      // Test 1: API-key access to the payout.
      const payout = await getPayout(payoutID);

      // Test 2: IAM access to the payout reservation.
      const reservation = await getReservation(payoutID);

      return {
        diagnosticOnly: true,
        success: true,

        callerArn: callerIdentity.Arn,

        payoutFound: !!payout,
        payoutID,
        payoutStatus: payout?.status || null,

        reservationReadSucceeded: true,
        reservationFound: !!reservation,
        reservationID: reservation?.id || null,
        reservationStatus: reservation?.status || null,

        message: "Read-only payout and IAM reservation checks succeeded.",
      };
    } catch (error) {
      console.error("READ-ONLY APPSYNC DIAGNOSTIC FAILED:", {
        message: errorMessage(error),
        graphqlErrors: error.graphqlErrors || null,
      });

      return {
        diagnosticOnly: true,
        success: false,
        payoutID,
        message: errorMessage(error),
        graphqlErrors: error.graphqlErrors || null,
      };
    }
  }

  let reservationLookupCompleted = false;
  let reservationWasAbsent = false;
  let reservation = null;
  let walletDebitAttempted = false;
  let walletDebitConfirmed = false;

  try {
    /* ------------------------------------------------------
       1. LOAD PAYOUT
    ------------------------------------------------------ */

    const payout = await getPayout(payoutID);

    if (!payout) {
      return definiteFailure(
        payoutID,
        "PAYOUT_NOT_FOUND",
        "Payout record does not exist.",
      );
    }

    /* ------------------------------------------------------
       2. LOAD WALLET
    ------------------------------------------------------ */

    const wallet = await getWallet({
      payout,
      courierID: payout.courierID,
    });

    if (!wallet) {
      return definiteFailure(
        payoutID,
        "WALLET_NOT_FOUND",
        "Courier wallet does not exist.",
      );
    }

    /* ------------------------------------------------------
       3. VALIDATE FINANCIAL DATA
    ------------------------------------------------------ */

    const financials = validatePayout({
      payout,
      wallet,
    });

    const debit = financials.totalWalletDebit;

    /* ------------------------------------------------------
       4. CHECK EXISTING RESERVATION
    ------------------------------------------------------ */

    reservation = await getReservation(payout.id);

    reservationLookupCompleted = true;
    reservationWasAbsent = !reservation;

    if (reservation) {
      if (
        reservation.walletID !== wallet.id ||
        reservation.courierID !== payout.courierID ||
        money(reservation.totalWalletDebit) !== debit ||
        reservation.reference !== payout.reference
      ) {
        return uncertainFailure(
          payout.id,
          "Existing reservation does not match this payout. Manual reconciliation is required.",
          reservation.id,
          reservation.status,
        );
      }

      if (reservation.status === "RESERVED") {
        return {
          success: true,
          alreadyReserved: true,
          walletDebited: true,
          reservationCreated: true,
          payoutID: payout.id,
          walletID: reservation.walletID,
          reservationID: reservation.id,
          transactionID: reservation.transactionID,
          amountReserved: reservation.totalWalletDebit,
          totalWalletDebit: reservation.totalWalletDebit,
          reference: reservation.reference,
          status: reservation.status,
          message: "Payout wallet funds are already reserved.",
        };
      }

      if (reservation.status === "WALLET_DEBITED") {
        // The wallet debit already happened.
        // NEVER deduct the wallet again.

        walletDebitConfirmed = true;

        const transaction = await createPayoutDebitTransaction({
          payout,
          wallet,
          debit,
        });

        const confirmed = await updateReservation(reservation, {
          transactionID: transaction.id,
          status: "RESERVED",
          failureReason: null,
          reservedAt: new Date().toISOString(),
        });

        if (!confirmed) {
          return uncertainFailure(
            payout.id,
            "Wallet debit exists, but the final reservation status could not be confirmed. Reconcile before retrying.",
            reservation.id,
            "WALLET_DEBITED",
          );
        }

        return {
          success: true,
          resumed: true,
          walletDebited: true,
          reservationCreated: true,
          payoutID: payout.id,
          walletID: reservation.walletID,
          reservationID: confirmed.id,
          transactionID: transaction.id,
          amountReserved: debit,
          totalWalletDebit: debit,
          reference: payout.reference,
          status: confirmed.status,
          message: "Payout reservation successfully completed.",
        };
      }

      if (reservation.status === "PENDING") {
        // A previous attempt may have debited the wallet
        // but failed before updating the reservation.
        // Never blindly retry the debit.

        return {
          success: false,
          inProgress: true,
          walletDebited: null,
          reservationCreated: true,
          uncertain: true,
          payoutID: payout.id,
          reservationID: reservation.id,
          status: reservation.status,
          code: "RESERVATION_PENDING",
          message:
            "A payout reservation already exists in PENDING status. No second wallet deduction was attempted. Reconcile it before retrying.",
        };
      }

      if (
        reservation.status === "FAILED" ||
        reservation.status === "REVERSED"
      ) {
        return {
          success: false,
          walletDebited: null,
          reservationCreated: true,
          uncertain: true,
          payoutID: payout.id,
          reservationID: reservation.id,
          status: reservation.status,
          code: "RESERVATION_REQUIRES_REVIEW",
          message: `This payout reservation is ${reservation.status}. It must be reviewed before another reservation can be made.`,
        };
      }

      return uncertainFailure(
        payout.id,
        `Unsupported reservation status: ${reservation.status}`,
        reservation.id,
        reservation.status,
      );
    }

    /* ------------------------------------------------------
       5. CHECK COURIER RESTRICTIONS
    ------------------------------------------------------ */

    const courier = await getCourier(payout.courierID);

    if (!courier) {
      return definiteFailure(
        payout.id,
        "COURIER_NOT_FOUND",
        "Payout courier could not be found.",
      );
    }

    if (courier.isBlocked === true) {
      return definiteFailure(
        payout.id,
        "COURIER_ADMIN_BLOCKED",
        "This courier is administratively blocked and cannot withdraw.",
      );
    }

    if (courier.debtRestrictionActive === true) {
      return definiteFailure(
        payout.id,
        "COURIER_DEBT_RESTRICTED",
        "This courier has overdue Atua debt. Withdrawals are frozen until the overdue debt is repaid.",
      );
    }

    /* ------------------------------------------------------
       6. CHECK AVAILABLE BALANCE
    ------------------------------------------------------ */

    const currentBalance = money(wallet.availableBalance || 0);

    if (currentBalance < debit) {
      return definiteFailure(
        payout.id,
        "INSUFFICIENT_BALANCE",
        "Insufficient available wallet balance for this payout.",
      );
    }

    /* ------------------------------------------------------
       7. CREATE RESERVATION RECORD
    ------------------------------------------------------ */

    try {
      reservation = await createReservation({
        payout,
        wallet,
        debit,
      });

      if (!reservation) {
        throw new Error("Reservation creation was not confirmed.");
      }
    } catch (createError) {
      // The create operation may have succeeded even if
      // its response was lost. Read before deciding.

      let existing;

      try {
        existing = await getReservation(payout.id);
      } catch (readError) {
        return uncertainFailure(
          payout.id,
          "Reservation creation could not be confirmed and the follow-up read also failed. Reconcile before retrying. " +
            errorMessage(readError),
        );
      }

      if (existing) {
        return {
          success: false,
          inProgress: true,
          walletDebited: null,
          reservationCreated: true,
          uncertain: true,
          payoutID: payout.id,
          reservationID: existing.id,
          status: existing.status,
          code: "RESERVATION_ALREADY_EXISTS",
          message:
            "A reservation already exists. No additional wallet debit was attempted. Reconcile it before retrying.",
        };
      }

      return definiteFailure(
        payout.id,
        "RESERVATION_CREATION_FAILED",
        errorMessage(createError),
      );
    }

    /* ------------------------------------------------------
       8. DEDUCT WALLET BALANCE
    ------------------------------------------------------ */

    // From this point onward, an error may have an
    // uncertain outcome. Do not report walletDebited:false
    // unless it is established that no debit occurred.

    walletDebitAttempted = true;

    let updatedWallet;

    try {
      updatedWallet = await deductWallet({
        wallet,
        debit,
      });

      walletDebitConfirmed = true;
    } catch (walletError) {
      console.error(
        "WALLET DEDUCTION NOT CONFIRMED:",
        errorMessage(walletError),
      );

      return uncertainFailure(
        payout.id,
        "Wallet deduction could not be confirmed. The reservation remains PENDING to prevent a duplicate debit. Reconcile before retrying.",
        reservation.id,
        "PENDING",
      );
    }

    console.log("PAYOUT WALLET DEBIT CONFIRMED:", {
      payoutID: payout.id,
      walletID: updatedWallet.id,
      previousBalance: wallet.availableBalance,
      newBalance: updatedWallet.availableBalance,
      amountDebited: debit,
    });

    /* ------------------------------------------------------
       9. MARK RESERVATION WALLET_DEBITED
    ------------------------------------------------------ */

    try {
      reservation = await updateReservation(reservation, {
        status: "WALLET_DEBITED",
        failureReason: null,
      });

      if (!reservation) {
        return uncertainFailure(
          payout.id,
          "Wallet debit succeeded, but the reservation status update was not confirmed. Do not repeat the wallet debit. Reconcile this payout.",
          payout.id,
          "WALLET_DEBITED",
        );
      }
    } catch (reservationUpdateError) {
      console.error(
        "RESERVATION WALLET_DEBITED UPDATE FAILED:",
        errorMessage(reservationUpdateError),
      );

      return uncertainFailure(
        payout.id,
        "Wallet debit succeeded, but the reservation status update failed. Do not repeat the wallet debit. Reconcile this payout.",
        payout.id,
        "WALLET_DEBITED",
      );
    }

    /* ------------------------------------------------------
       10. CREATE OR RETRIEVE DEBIT TRANSACTION
    ------------------------------------------------------ */

    let transaction;

    try {
      transaction = await createPayoutDebitTransaction({
        payout,
        wallet: updatedWallet,
        debit,
      });
    } catch (transactionError) {
      console.error(
        "PAYOUT DEBIT TRANSACTION FAILED:",
        errorMessage(transactionError),
      );

      return uncertainFailure(
        payout.id,
        "Wallet debit succeeded, but the payout debit transaction could not be confirmed. Do not deduct again. Reconcile this payout.",
        reservation.id,
        "WALLET_DEBITED",
      );
    }

    /* ------------------------------------------------------
       11. MARK RESERVATION RESERVED
    ------------------------------------------------------ */

    let confirmedReservation;

    try {
      confirmedReservation = await updateReservation(reservation, {
        transactionID: transaction.id,
        status: "RESERVED",
        failureReason: null,
        reservedAt: new Date().toISOString(),
      });
    } catch (finalUpdateError) {
      console.error(
        "FINAL RESERVATION UPDATE FAILED:",
        errorMessage(finalUpdateError),
      );

      return uncertainFailure(
        payout.id,
        "Wallet debit and transaction are recorded, but final reservation confirmation failed. Do not deduct again. Reconcile this payout.",
        reservation.id,
        "WALLET_DEBITED",
      );
    }

    if (!confirmedReservation) {
      return uncertainFailure(
        payout.id,
        "Wallet debit and transaction are recorded, but final reservation confirmation failed. Do not deduct again. Reconcile this payout.",
        reservation.id,
        "WALLET_DEBITED",
      );
    }

    /* ------------------------------------------------------
       12. SUCCESS
    ------------------------------------------------------ */

    console.log("PAYOUT WALLET RESERVED SUCCESSFULLY:", {
      payoutID: payout.id,
      reservationID: confirmedReservation.id,
      walletID: wallet.id,
      transactionID: transaction.id,
      totalWalletDebit: debit,
    });

    return {
      success: true,
      walletDebited: true,
      reservationCreated: true,
      payoutID: payout.id,
      reservationID: confirmedReservation.id,
      walletID: wallet.id,
      transactionID: transaction.id,
      payoutAmount: financials.payoutAmount,
      payoutFee: financials.payoutFee,
      amountReserved: debit,
      totalWalletDebit: debit,
      reference: payout.reference,
      status: "RESERVED",
      message: "Payout wallet funds successfully reserved.",
    };
  } catch (error) {
    console.error("RESERVE PAYOUT WALLET FAILED:", errorMessage(error));

    // Only classify as a definite no-debit failure when
    // the reservation lookup confirmed there was no
    // existing reservation and no wallet debit was attempted.

    if (
      reservationLookupCompleted &&
      reservationWasAbsent &&
      !walletDebitAttempted &&
      !walletDebitConfirmed &&
      !reservation
    ) {
      return definiteFailure(
        payoutID,
        "PAYOUT_RESERVATION_FAILED",
        errorMessage(error),
      );
    }

    // If a reservation exists or a wallet debit was
    // attempted, preserve the uncertainty.

    return uncertainFailure(
      payoutID,
      errorMessage(error),
      reservation?.id || null,
      reservation?.status || "PENDING",
    );
  }
};
