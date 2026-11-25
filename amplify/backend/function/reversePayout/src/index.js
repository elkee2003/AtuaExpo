"use strict";

const https = require("https");
const { STSClient, GetCallerIdentityCommand } = require("@aws-sdk/client-sts");
const { SignatureV4 } = require("@smithy/signature-v4");
const { HttpRequest } = require("@smithy/protocol-http");
const { Hash } = require("@smithy/hash-node");

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
   CONFIGURATION VALIDATION
========================================================== */

if (!GRAPHQL_ENDPOINT) {
  throw new Error("API_ATUA_GRAPHQLAPIENDPOINTOUTPUT is not configured.");
}

if (!API_KEY) {
  throw new Error("API_ATUA_GRAPHQLAPIKEYOUTPUT is not configured.");
}

const endpoint = new URL(GRAPHQL_ENDPOINT);

if (endpoint.protocol !== "https:" || !endpoint.hostname) {
  throw new Error("Invalid AppSync GraphQL endpoint.");
}

/* ==========================================================
   GENERAL APPSYNC REQUEST — API KEY

   Used for:
   - Payout
   - Courier
   - Wallet
   - Transaction

   Reservation operations use IAM separately.
========================================================== */

const graphqlRequest = async (
  query,
  variables = {},
  operationName = "AppSync operation",
) => {
  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15000),
  });

  const responseText = await response.text();

  let parsed;

  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new Error(`${operationName}: AppSync returned invalid JSON.`);
  }

  if (!response.ok) {
    throw new Error(
      `${operationName}: HTTP ${response.status}: ${responseText}`,
    );
  }

  if (parsed.errors?.length) {
    console.error(
      "APPSYNC GRAPHQL ERRORS:",
      JSON.stringify(parsed.errors, null, 2),
    );

    const error = new Error(
      parsed.errors.map((item) => item.message).join(" | "),
    );

    error.graphqlErrors = parsed.errors;

    throw error;
  }

  return parsed.data || null;
};

/* ==========================================================
   AWS IAM CREDENTIALS

   Uses the Lambda execution role credentials.
========================================================== */

const getAwsCredentials = () => {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "Lambda IAM credentials unavailable. Check execution role.",
    );
  }

  return {
    accessKeyId,
    secretAccessKey,
    sessionToken,
  };
};

/* ==========================================================
   APPSYNC IAM SIGNER
========================================================== */

const appSyncSigner = new SignatureV4({
  credentials: getAwsCredentials,
  region: REGION,
  service: "appsync",
  sha256: Hash.bind(null, "sha256"),
});

/* ==========================================================
   APPSYNC REQUEST — IAM

   Used ONLY for PayoutReservation operations.
========================================================== */

const graphqlRequestIAM = async (
  query,
  variables = {},
  operationName = "AppSync IAM operation",
) => {
  const body = JSON.stringify({ query, variables });

  const path = `${endpoint.pathname}${endpoint.search}`;

  const request = new HttpRequest({
    protocol: endpoint.protocol,
    hostname: endpoint.hostname,
    port: endpoint.port ? Number(endpoint.port) : undefined,
    method: "POST",
    path,
    headers: {
      host: endpoint.host,
      "content-type": "application/json",
    },
    body,
  });

  const signedRequest = await appSyncSigner.sign(request);

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
    const req = https.request(options, (res) => {
      let responseBody = "";

      res.on("data", (chunk) => {
        responseBody += chunk;
      });

      res.on("end", () => {
        let parsed;

        try {
          parsed = JSON.parse(responseBody);
        } catch {
          return reject(
            new Error(`${operationName}: AppSync returned invalid JSON.`),
          );
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(
            new Error(
              `${operationName}: HTTP ${res.statusCode}: ${responseBody}`,
            ),
          );
        }

        if (parsed.errors?.length) {
          console.error(
            "APPSYNC IAM GRAPHQL ERRORS:",
            JSON.stringify(parsed.errors, null, 2),
          );

          const error = new Error(
            parsed.errors.map((item) => item.message).join(" | "),
          );

          error.graphqlErrors = parsed.errors;

          return reject(error);
        }

        resolve(parsed.data || null);
      });
    });

    req.on("error", reject);

    req.setTimeout(15000, () => {
      req.destroy(new Error(`${operationName}: IAM request timed out.`));
    });

    req.write(body);
    req.end();
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
   GET PAYOUT RESERVATION — IAM

   failureReason intentionally excluded.
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
   CREATE PAYOUT RESERVATION — IAM

   failureReason is not included in the input or response.
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
   UPDATE PAYOUT RESERVATION — IAM

   failureReason is deliberately excluded.
========================================================== */

const updateReservation = async (reservation, updates) => {
  if (!reservation?.id || reservation._version == null) {
    throw new Error("Reservation ID and version are required.");
  }

  const safeUpdates = { ...updates };

  delete safeUpdates.failureReason;

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
        ...safeUpdates,
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
  if (!wallet?.id || wallet._version == null) {
    throw new Error("Wallet ID or version is missing.");
  }

  const currentBalance = money(wallet.availableBalance || 0);

  if (currentBalance < debit) {
    throw new Error("Insufficient available wallet balance.");
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
   GET PAYOUT DEBIT TRANSACTION
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
   CREATE OR RETRIEVE PAYOUT DEBIT TRANSACTION

   Deterministic ID prevents duplicate debit transactions.
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
        "Existing payout debit transaction does not match this payout.",
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
      // Required-field validation handles this.
    }
  }

  if (!payoutID) {
    return definiteFailure(null, "MISSING_PAYOUT_ID", "payoutID is required.");
  }

  /* ========================================================
     READ-ONLY DIAGNOSTIC
  ======================================================== */

  if (event?.diagnosticOnly === true) {
    try {
      const sts = new STSClient({ region: REGION });

      const callerIdentity = await sts.send(new GetCallerIdentityCommand({}));

      const payout = await getPayout(payoutID);

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
        message:
          "Read-only payout API-key and reservation IAM checks succeeded.",
      };
    } catch (error) {
      console.error("READ-ONLY DIAGNOSTIC FAILED:", {
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
        payout.id,
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

      /* ----------------------------------------------
         ALREADY RESERVED
      ---------------------------------------------- */

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

      /* ----------------------------------------------
         WALLET ALREADY DEBITED

         Resume without another deduction.
      ---------------------------------------------- */

      if (reservation.status === "WALLET_DEBITED") {
        walletDebitConfirmed = true;

        const transaction = await createPayoutDebitTransaction({
          payout,
          wallet,
          debit,
        });

        const confirmed = await updateReservation(reservation, {
          transactionID: transaction.id,
          status: "RESERVED",
          reservedAt: new Date().toISOString(),
        });

        if (!confirmed) {
          return uncertainFailure(
            payout.id,
            "Wallet debit exists, but final reservation status could not be confirmed. Reconcile before retrying.",
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

      /* ----------------------------------------------
         PENDING

         Never debit again automatically.

         A PENDING reservation could mean the wallet
         debit happened but the status update failed.
      ---------------------------------------------- */

      if (reservation.status === "PENDING") {
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
            "Reservation is PENDING. No second wallet deduction was attempted. Manual reconciliation is required.",
        };
      }

      /* ----------------------------------------------
         FAILED / REVERSED
      ---------------------------------------------- */

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
          message: `This payout reservation is ${reservation.status}. Review it before another reservation can be made.`,
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
        "This courier has overdue Atua debt. Withdrawals are frozen until the debt is repaid.",
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
        "Insufficient available wallet balance.",
      );
    }

    /* ------------------------------------------------------
       7. CREATE RESERVATION
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
      let existing;

      try {
        existing = await getReservation(payout.id);
      } catch (readError) {
        return uncertainFailure(
          payout.id,
          "Reservation creation could not be confirmed and the follow-up read failed. Reconcile before retrying. " +
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
       8. DEDUCT WALLET

       An error after this point may have an uncertain
       outcome. Never blindly repeat this operation.
    ------------------------------------------------------ */

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
        "Wallet deduction could not be confirmed. Reservation remains PENDING. Do not repeat the debit; reconcile first.",
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
      });

      if (!reservation) {
        return uncertainFailure(
          payout.id,
          "Wallet debit succeeded, but reservation update was not confirmed. Do not repeat the debit.",
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
        "Wallet debit succeeded, but reservation update failed. Do not repeat the debit. Reconcile this payout.",
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
        "Wallet debit succeeded, but debit transaction could not be confirmed. Do not deduct again.",
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
        reservedAt: new Date().toISOString(),
      });
    } catch (finalUpdateError) {
      console.error(
        "FINAL RESERVATION UPDATE FAILED:",
        errorMessage(finalUpdateError),
      );

      return uncertainFailure(
        payout.id,
        "Wallet debit and transaction are recorded, but final reservation confirmation failed. Do not deduct again.",
        reservation.id,
        "WALLET_DEBITED",
      );
    }

    if (!confirmedReservation) {
      return uncertainFailure(
        payout.id,
        "Wallet debit and transaction are recorded, but final reservation confirmation failed. Do not deduct again.",
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

    return uncertainFailure(
      payoutID,
      errorMessage(error),
      reservation?.id || null,
      reservation?.status || "PENDING",
    );
  }
};
