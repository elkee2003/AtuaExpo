"use strict";

/**
 * ============================================================
 * ATUA - RECONCILE PAYOUTS
 * ============================================================
 *
 * PURPOSE
 * ------------------------------------------------------------
 * Safely reconciles courier payouts left in PROCESSING.
 *
 * RESPONSIBILITIES
 * ------------------------------------------------------------
 * 1. Retrieve all PROCESSING payouts.
 * 2. Verify their wallet reservations.
 * 3. Recover safe, interrupted reservation operations.
 * 4. Verify existing Paystack transfers.
 * 5. Mark successful payouts as PAID.
 * 6. Send confirmed failed/reversed transfers to reversePayout.
 *
 * IMPORTANT
 * ------------------------------------------------------------
 * This Lambda NEVER initiates a new Paystack transfer.
 *
 * It NEVER directly credits or debits a wallet.
 *
 * Uncertain wallet operations are never automatically
 * repeated.
 *
 * ============================================================
 */

const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

/* ============================================================
   CONFIGURATION
============================================================ */

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const GRAPHQL_API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

const PAYSTACK_SECRET_PARAMETER = process.env.PAYSTACK_SECRET_KEY;

const REGION = process.env.AWS_REGION || "eu-north-1";

const ssmClient = new SSMClient({
  region: REGION,
});

/* ============================================================
   VALIDATE CONFIGURATION
============================================================ */

if (!GRAPHQL_ENDPOINT) {
  throw new Error("Missing API_ATUA_GRAPHQLAPIENDPOINTOUTPUT.");
}

if (!GRAPHQL_API_KEY) {
  throw new Error("Missing API_ATUA_GRAPHQLAPIKEYOUTPUT.");
}

if (!PAYSTACK_SECRET_PARAMETER) {
  throw new Error("Missing PAYSTACK_SECRET_KEY.");
}

/* ============================================================
   GENERAL HELPERS
============================================================ */

function money(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error("Invalid monetary amount.");
  }

  return Number(number.toFixed(2));
}

function sameMoney(first, second) {
  return Math.abs(money(first) - money(second)) < 0.005;
}

function errorText(error) {
  return error?.message || String(error || "Unknown error.");
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

/* ============================================================
   GET PAYSTACK SECRET FROM SSM
============================================================ */

async function getPaystackSecret() {
  const result = await ssmClient.send(
    new GetParameterCommand({
      Name: PAYSTACK_SECRET_PARAMETER,
      WithDecryption: true,
    }),
  );

  const secret = result?.Parameter?.Value;

  if (!secret) {
    throw new Error("Paystack secret was not found in SSM.");
  }

  return secret;
}

/* ============================================================
   APPSYNC GRAPHQL REQUEST
============================================================ */

async function graphqlRequest(
  query,
  variables = {},
  operationName = "GraphQLOperation",
) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "x-api-key": GRAPHQL_API_KEY,
    },

    body: JSON.stringify({
      query,
      variables,
      operationName,
    }),

    signal: AbortSignal.timeout(20000),
  });

  const responseText = await response.text();

  let result;

  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(`${operationName}: Invalid GraphQL JSON response.`);
  }

  if (!response.ok) {
    throw new Error(
      `${operationName}: HTTP ${response.status}: ${responseText}`,
    );
  }

  if (result.errors?.length) {
    console.error(
      `APPSYNC ERRORS - ${operationName}:`,
      JSON.stringify(result.errors),
    );

    throw new Error(
      result.errors
        .map((item) => item.message)
        .filter(Boolean)
        .join(" | "),
    );
  }

  return result.data;
}

/* ============================================================
   GET PROCESSING PAYOUTS
============================================================ */

async function getProcessingPayouts() {
  const payouts = [];

  let nextToken = null;

  do {
    const query = /* GraphQL */ `
      query ListProcessingPayouts(
        $filter: ModelPayoutFilterInput
        $limit: Int
        $nextToken: String
      ) {
        listPayouts(filter: $filter, limit: $limit, nextToken: $nextToken) {
          items {
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
            walletRestoredAt

            createdAt
            updatedAt

            _version
            _deleted
          }

          nextToken
        }
      }
    `;

    const data = await graphqlRequest(
      query,
      {
        filter: {
          status: {
            eq: "PROCESSING",
          },
        },

        limit: 100,

        nextToken,
      },
      "ListProcessingPayouts",
    );

    const page = data?.listPayouts || {};

    const items = page.items || [];

    payouts.push(...items.filter((item) => item && item._deleted !== true));

    nextToken = page.nextToken || null;
  } while (nextToken);

  return payouts;
}

/* ============================================================
   GET PAYOUT BY ID
============================================================ */

async function getPayout(payoutID) {
  const query = /* GraphQL */ `
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

        transferCode
        transferID

        failureReason

        processedAt
        paidAt
        failedAt
        walletRestoredAt

        _version
        _deleted
      }
    }
  `;

  const data = await graphqlRequest(query, { id: payoutID }, "GetPayout");

  const payout = data?.getPayout || null;

  if (payout?._deleted === true) {
    return null;
  }

  return payout;
}

/* ============================================================
   GET PAYOUT RESERVATION
============================================================ */

async function getReservation(payoutID) {
  const query = /* GraphQL */ `
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

  const data = await graphqlRequest(
    query,
    { id: payoutID },
    "GetPayoutReservation",
  );

  const reservation = data?.getPayoutReservation || null;

  if (reservation?._deleted === true) {
    return null;
  }

  return reservation;
}

/* ============================================================
   GET DETERMINISTIC PAYOUT DEBIT TRANSACTION
============================================================ */

async function getPayoutDebitTransaction(transactionID) {
  const query = /* GraphQL */ `
    query GetPayoutDebitTransaction($id: ID!) {
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
}

/* ============================================================
   VALIDATE PAYOUT FINANCIAL INFORMATION
============================================================ */

function validatePayoutFinancials({ payout, reservation }) {
  if (!payout?.id) {
    throw new Error("Payout ID is missing.");
  }

  if (!payout.courierID) {
    throw new Error("Payout courierID is missing.");
  }

  if (!payout.walletID) {
    throw new Error("Payout walletID is missing.");
  }

  if (!payout.reference) {
    throw new Error("Payout reference is missing.");
  }

  const payoutAmount = money(payout.amount);

  const payoutFee = money(payout.payoutFee || 0);

  const expectedWalletDebit = money(payoutAmount + payoutFee);

  if (payoutAmount <= 0) {
    throw new Error("Payout amount must be positive.");
  }

  if (
    payout.totalWalletDebit != null &&
    !sameMoney(payout.totalWalletDebit, expectedWalletDebit)
  ) {
    throw new Error(
      "Payout totalWalletDebit does not match amount plus payoutFee.",
    );
  }

  if (
    reservation.payoutID !== payout.id ||
    reservation.walletID !== payout.walletID ||
    reservation.courierID !== payout.courierID ||
    reservation.reference !== payout.reference
  ) {
    throw new Error("Payout and reservation identity mismatch.");
  }

  if (!sameMoney(reservation.payoutAmount, payoutAmount)) {
    throw new Error("Reservation payoutAmount does not match Payout.amount.");
  }

  if (!sameMoney(reservation.payoutFee || 0, payoutFee)) {
    throw new Error("Reservation payoutFee does not match Payout.payoutFee.");
  }

  if (!sameMoney(reservation.totalWalletDebit, expectedWalletDebit)) {
    throw new Error(
      "Reservation totalWalletDebit does not match payout financials.",
    );
  }

  return expectedWalletDebit;
}

/* ============================================================
   VALIDATE DEBIT TRANSACTION
============================================================ */

function validateDebitTransaction({ payout, reservation, transaction }) {
  if (!transaction) {
    throw new Error("Payout debit transaction does not exist.");
  }

  const expectedID = `${payout.id}-PAYOUT-DEBIT`;

  if (transaction.id !== expectedID) {
    throw new Error(
      "Payout debit transaction ID is not the expected deterministic ID.",
    );
  }

  if (transaction.walletID !== payout.walletID) {
    throw new Error("Payout debit transaction walletID mismatch.");
  }

  if (transaction.payoutID !== payout.id) {
    throw new Error("Payout debit transaction payoutID mismatch.");
  }

  if (transaction.type !== "DEBIT") {
    throw new Error("Payout transaction is not a DEBIT.");
  }

  if (transaction.reference !== payout.reference) {
    throw new Error("Payout transaction reference mismatch.");
  }

  if (!sameMoney(transaction.amount, reservation.totalWalletDebit)) {
    throw new Error(
      "Payout debit transaction amount does not match reservation.",
    );
  }

  if (
    reservation.transactionID &&
    reservation.transactionID !== transaction.id
  ) {
    throw new Error(
      "Reservation transactionID does not match the debit transaction.",
    );
  }

  return true;
}

/* ============================================================
   CREATE MISSING DEBIT TRANSACTION
============================================================ */

/**
 * This function is only used when the reservation is
 * WALLET_DEBITED.
 *
 * That status confirms the wallet deduction succeeded.
 *
 * We therefore repair the missing deterministic ledger
 * transaction without deducting the wallet again.
 *
 * NEVER call this for an uncertain PENDING reservation
 * when its debit transaction is absent.
 */

async function createMissingDebitTransaction({ payout, reservation }) {
  const transactionID = `${payout.id}-PAYOUT-DEBIT`;

  const existing = await getPayoutDebitTransaction(transactionID);

  if (existing) {
    validateDebitTransaction({
      payout,
      reservation,
      transaction: existing,
    });

    return existing;
  }

  const mutation = /* GraphQL */ `
    mutation CreatePayoutDebitTransaction($input: CreateTransactionInput!) {
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

    walletID: payout.walletID,
    payoutID: payout.id,

    type: "DEBIT",

    amount: money(reservation.totalWalletDebit),

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
      throw new Error("Debit transaction creation was not confirmed.");
    }

    validateDebitTransaction({
      payout,
      reservation,
      transaction,
    });

    return transaction;
  } catch (error) {
    // The create mutation may have succeeded even if
    // the response was lost. Check the deterministic ID.

    const retryRead = await getPayoutDebitTransaction(transactionID);

    if (retryRead) {
      validateDebitTransaction({
        payout,
        reservation,
        transaction: retryRead,
      });

      return retryRead;
    }

    throw error;
  }
}

/* ============================================================
   UPDATE PAYOUT RESERVATION
============================================================ */

async function updateReservation(reservation, fields) {
  if (!reservation?.id) {
    throw new Error("Reservation ID is required.");
  }

  if (reservation._version == null) {
    throw new Error("Reservation _version is required.");
  }

  const mutation = /* GraphQL */ `
    mutation UpdatePayoutReservation($input: UpdatePayoutReservationInput!) {
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

  const data = await graphqlRequest(
    mutation,
    {
      input: {
        id: reservation.id,
        _version: reservation._version,
        ...fields,
      },
    },
    "UpdatePayoutReservation",
  );

  const updated = data?.updatePayoutReservation;

  if (!updated) {
    throw new Error("Payout reservation update was not confirmed.");
  }

  return updated;
}

/* ============================================================
   UPDATE TRANSACTION
============================================================ */

async function updateTransaction(transaction, fields) {
  if (!transaction?.id) {
    throw new Error("Transaction ID is required.");
  }

  if (transaction._version == null) {
    throw new Error("Transaction _version is required.");
  }

  const mutation = /* GraphQL */ `
    mutation UpdateTransaction($input: UpdateTransactionInput!) {
      updateTransaction(input: $input) {
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

  const data = await graphqlRequest(
    mutation,
    {
      input: {
        id: transaction.id,
        _version: transaction._version,
        ...fields,
      },
    },
    "UpdateTransaction",
  );

  const updated = data?.updateTransaction;

  if (!updated) {
    throw new Error("Transaction update was not confirmed.");
  }

  return updated;
}

/* ============================================================
   UPDATE PAYOUT
============================================================ */

async function updatePayout(payout, fields) {
  if (!payout?.id) {
    throw new Error("Payout ID is required.");
  }

  if (payout._version == null) {
    throw new Error("Payout _version is required.");
  }

  const mutation = /* GraphQL */ `
    mutation UpdatePayout($input: UpdatePayoutInput!) {
      updatePayout(input: $input) {
        id

        courierID
        walletID

        amount
        payoutFee
        totalWalletDebit

        status
        reference

        transferCode
        transferID

        failureReason

        processedAt
        paidAt
        failedAt
        walletRestoredAt

        _version
      }
    }
  `;

  const data = await graphqlRequest(
    mutation,
    {
      input: {
        id: payout.id,
        _version: payout._version,
        ...fields,
      },
    },
    "UpdatePayout",
  );

  const updated = data?.updatePayout;

  if (!updated) {
    throw new Error("Payout update was not confirmed.");
  }

  return updated;
}

/* ============================================================
   VERIFY EXISTING PAYSTACK TRANSFER
============================================================ */

/**
 * This endpoint verifies an existing transfer by reference.
 *
 * It does not initiate a transfer.
 */

async function verifyPaystackTransfer({ reference, secretKey }) {
  if (!reference) {
    throw new Error("Paystack transfer reference is required.");
  }

  const url =
    "https://api.paystack.co/transfer/verify/" + encodeURIComponent(reference);

  const response = await fetch(url, {
    method: "GET",

    headers: {
      Authorization: `Bearer ${secretKey}`,
      Accept: "application/json",
    },

    signal: AbortSignal.timeout(20000),
  });

  const responseText = await response.text();

  let result;

  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(`Paystack returned invalid JSON. HTTP ${response.status}.`);
  }

  if (!response.ok) {
    throw new Error(
      `Paystack verification HTTP ${response.status}: ${JSON.stringify(result)}`,
    );
  }

  if (result?.status !== true) {
    throw new Error(
      result?.message || "Paystack could not verify this transfer.",
    );
  }

  if (!result.data) {
    throw new Error("Paystack returned no transfer data.");
  }

  return result.data;
}

/* ============================================================
   VALIDATE PAYSTACK TRANSFER
============================================================ */

function validatePaystackTransfer({ payout, transfer }) {
  if (!transfer) {
    throw new Error("Paystack transfer information is missing.");
  }

  if (transfer.reference !== payout.reference) {
    throw new Error(
      "Paystack transfer reference does not match payout reference.",
    );
  }

  const expectedKobo = Math.round(Number(payout.amount) * 100);

  const receivedKobo = Number(transfer.amount);

  if (!Number.isSafeInteger(expectedKobo) || expectedKobo <= 0) {
    throw new Error("Invalid payout amount.");
  }

  if (!Number.isSafeInteger(receivedKobo) || receivedKobo <= 0) {
    throw new Error("Invalid Paystack transfer amount.");
  }

  if (receivedKobo !== expectedKobo) {
    throw new Error(
      `Paystack amount mismatch. Expected ${expectedKobo} kobo, received ${receivedKobo} kobo.`,
    );
  }

  if (String(transfer.currency || "").toUpperCase() !== "NGN") {
    throw new Error(`Unexpected Paystack currency: ${transfer.currency}`);
  }

  if (
    payout.transferID &&
    transfer.id != null &&
    String(payout.transferID) !== String(transfer.id)
  ) {
    throw new Error(
      "Paystack transfer ID does not match the saved payout transferID.",
    );
  }

  if (
    payout.transferCode &&
    transfer.transfer_code &&
    payout.transferCode !== transfer.transfer_code
  ) {
    throw new Error(
      "Paystack transfer code does not match the saved payout transferCode.",
    );
  }

  return true;
}

/* ============================================================
   REQUEST PAYOUT REVERSAL
============================================================ */

async function requestPayoutReversal({
  payout,
  transaction,
  transfer,
  eventType,
  failureReason,
}) {
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

    transferCode: transfer?.transfer_code || payout.transferCode || null,

    transferID:
      transfer?.id != null ? String(transfer.id) : payout.transferID || null,

    failureReason:
      failureReason || `Paystack ${eventType} during payout reconciliation.`,
  };

  if (!input.transferCode && !input.transferID) {
    throw new Error(
      "No Paystack transfer identifier is available for reversal.",
    );
  }

  console.log("REQUESTING PAYOUT REVERSAL:", {
    payoutID: input.payoutID,
    transactionID: input.transactionID,
    walletID: input.walletID,
    reference: input.reference,
    eventType: input.eventType,
  });

  const data = await graphqlRequest(mutation, { input }, "ReversePayout");

  const result = data?.reversePayout;

  if (!result) {
    throw new Error("reversePayout returned no result.");
  }

  if (result.success !== true) {
    throw new Error(result.message || "Payout reversal was not successful.");
  }

  if (result.payoutStatus !== "FAILED") {
    throw new Error(
      `Unexpected reversal payout status: ${result.payoutStatus}`,
    );
  }

  if (result.transactionStatus !== "REVERSED") {
    throw new Error(
      `Unexpected reversal transaction status: ${result.transactionStatus}`,
    );
  }

  if (
    result.payoutID !== payout.id ||
    result.transactionID !== transaction.id ||
    result.walletID !== payout.walletID
  ) {
    throw new Error(
      "Reversal returned mismatched payout, transaction or wallet IDs.",
    );
  }

  console.log("PAYOUT REVERSAL CONFIRMED:", result);

  return result;
}

/* ============================================================
   RECOVER PAYOUT RESERVATION
============================================================ */

/**
 * Reservation recovery rules:
 *
 * PENDING:
 *   - If deterministic debit transaction exists and matches,
 *     the debit is evidenced by the reservation workflow.
 *   - If it does not exist, do not assume whether the wallet
 *     was debited. Require manual reconciliation.
 *
 * WALLET_DEBITED:
 *   - Wallet debit was confirmed by reservePayoutWallet.
 *   - Repair/create the deterministic debit transaction.
 *   - Never deduct the wallet again.
 *
 * RESERVED:
 *   - Reservation is ready for Paystack reconciliation.
 *
 * COMPLETED:
 *   - Reservation was finalized after successful payout.
 *
 * REVERSAL_STARTED:
 *   - Do not retry wallet restoration.
 *   - reversePayout or manual reconciliation must resolve it.
 *
 * FAILED / REVERSED:
 *   - Do not restart the payout automatically.
 */

async function recoverReservation({ payout, reservation }) {
  const expectedTransactionID = `${payout.id}-PAYOUT-DEBIT`;

  let transaction = await getPayoutDebitTransaction(expectedTransactionID);

  if (reservation.status === "PENDING") {
    if (!transaction) {
      return {
        safe: false,
        action: "MANUAL_RECONCILIATION_REQUIRED",
        reason:
          "Reservation is PENDING and the deterministic debit transaction does not exist. The wallet debit outcome is uncertain. No wallet changes were made.",
      };
    }

    validateDebitTransaction({
      payout,
      reservation,
      transaction,
    });

    if (
      transaction.status !== "PENDING" &&
      transaction.status !== "COMPLETED"
    ) {
      return {
        safe: false,
        action: "MANUAL_RECONCILIATION_REQUIRED",
        reason: `Unexpected debit transaction status: ${transaction.status}.`,
      };
    }

    reservation = await updateReservation(reservation, {
      status: "WALLET_DEBITED",
      transactionID: transaction.id,
      failureReason: null,
    });

    console.log("RECOVERED PENDING RESERVATION TO WALLET_DEBITED:", payout.id);
  }

  if (reservation.status === "WALLET_DEBITED") {
    if (!transaction) {
      transaction = await createMissingDebitTransaction({
        payout,
        reservation,
      });
    } else {
      validateDebitTransaction({
        payout,
        reservation,
        transaction,
      });
    }

    if (
      transaction.status !== "PENDING" &&
      transaction.status !== "COMPLETED"
    ) {
      return {
        safe: false,
        action: "MANUAL_RECONCILIATION_REQUIRED",
        reason: `Cannot resume reservation with transaction status ${transaction.status}.`,
      };
    }

    reservation = await updateReservation(reservation, {
      transactionID: transaction.id,
      status: "RESERVED",
      failureReason: null,
      reservedAt: reservation.reservedAt || new Date().toISOString(),
    });

    console.log("RECOVERED WALLET_DEBITED RESERVATION TO RESERVED:", payout.id);
  }

  if (reservation.status === "REVERSAL_STARTED") {
    return {
      safe: false,
      action: "MANUAL_RECONCILIATION_REQUIRED",
      reason:
        "Reservation is REVERSAL_STARTED. The wallet restoration may have occurred. Do not credit the wallet again automatically.",
    };
  }

  if (reservation.status === "FAILED" || reservation.status === "REVERSED") {
    return {
      safe: false,
      action: "MANUAL_RECONCILIATION_REQUIRED",
      reason: `Reservation is already ${reservation.status}. It cannot be restarted automatically.`,
    };
  }

  if (reservation.status !== "RESERVED" && reservation.status !== "COMPLETED") {
    return {
      safe: false,
      action: "MANUAL_RECONCILIATION_REQUIRED",
      reason: `Unsupported reservation status: ${reservation.status}.`,
    };
  }

  // Re-read the transaction after any reservation recovery.

  transaction = await getPayoutDebitTransaction(expectedTransactionID);

  validateDebitTransaction({
    payout,
    reservation,
    transaction,
  });

  return {
    safe: true,
    reservation,
    transaction,
  };
}

/* ============================================================
   RECONCILE ONE PAYOUT
============================================================ */

async function reconcileOnePayout({ payout, secretKey }) {
  console.log("============================================================");

  console.log("RECONCILING PAYOUT:", {
    payoutID: payout.id,
    courierID: payout.courierID,
    walletID: payout.walletID,
    amount: payout.amount,
    reference: payout.reference,
    status: payout.status,
  });

  if (payout.status !== "PROCESSING") {
    return {
      payoutID: payout.id,
      status: payout.status,
      action: "NO_CHANGE",
      reason: "Payout is no longer PROCESSING.",
    };
  }

  if (!payout.reference) {
    throw new Error("Payout reference is missing.");
  }

  if (!payout.walletID) {
    throw new Error("Payout walletID is missing.");
  }

  /* ----------------------------------------------------------
     1. GET RESERVATION
  ---------------------------------------------------------- */

  const reservation = await getReservation(payout.id);

  if (!reservation) {
    throw new Error(
      "Payout reservation is missing. Manual reconciliation is required.",
    );
  }

  /* ----------------------------------------------------------
     2. VALIDATE PAYOUT AND RESERVATION FINANCIALS
  ---------------------------------------------------------- */

  validatePayoutFinancials({
    payout,
    reservation,
  });

  /* ----------------------------------------------------------
     3. RECOVER SAFE RESERVATION STATES
  ---------------------------------------------------------- */

  const recovery = await recoverReservation({
    payout,
    reservation,
  });

  if (!recovery.safe) {
    return {
      payoutID: payout.id,
      reference: payout.reference,
      status: "PROCESSING",
      action: recovery.action,
      reason: recovery.reason,
    };
  }

  const currentReservation = recovery.reservation;

  const transaction = recovery.transaction;

  /* ----------------------------------------------------------
     4. VERIFY EXISTING PAYSTACK TRANSFER
  ---------------------------------------------------------- */

  const transfer = await verifyPaystackTransfer({
    reference: payout.reference,
    secretKey,
  });

  /* ----------------------------------------------------------
     5. VALIDATE PAYSTACK TRANSFER
  ---------------------------------------------------------- */

  validatePaystackTransfer({
    payout,
    transfer,
  });

  const transferStatus = normalizeStatus(transfer.status);

  console.log("PAYSTACK TRANSFER RESULT:", {
    payoutID: payout.id,
    reference: payout.reference,
    transferStatus,
    transferID: transfer.id,
    transferCode: transfer.transfer_code,
    amount: transfer.amount,
    currency: transfer.currency,
  });

  /* ==========================================================
     SUCCESSFUL TRANSFER
  ========================================================== */

  if (transferStatus === "success") {
    console.log("PAYSTACK CONFIRMED SUCCESS:", payout.reference);

    if (
      currentReservation.status !== "RESERVED" &&
      currentReservation.status !== "COMPLETED"
    ) {
      throw new Error(
        `Cannot finalize successful transfer with reservation status ${currentReservation.status}.`,
      );
    }

    if (transaction.status === "FAILED" || transaction.status === "REVERSED") {
      throw new Error(
        `Paystack reports SUCCESS but transaction is ${transaction.status}. Manual reconciliation is required.`,
      );
    }

    if (
      transaction.status !== "PENDING" &&
      transaction.status !== "COMPLETED"
    ) {
      throw new Error(`Unexpected transaction status: ${transaction.status}.`);
    }

    /* --------------------------------------------------------
       A. COMPLETE TRANSACTION
    -------------------------------------------------------- */

    let updatedTransaction = transaction;

    if (transaction.status === "PENDING") {
      updatedTransaction = await updateTransaction(transaction, {
        status: "COMPLETED",
      });
    }

    if (updatedTransaction.status !== "COMPLETED") {
      throw new Error("Debit transaction could not be confirmed COMPLETED.");
    }

    /* --------------------------------------------------------
       B. COMPLETE RESERVATION
    -------------------------------------------------------- */

    let updatedReservation = currentReservation;

    if (currentReservation.status === "RESERVED") {
      updatedReservation = await updateReservation(currentReservation, {
        status: "COMPLETED",
        transactionID: transaction.id,
        failureReason: null,
      });
    }

    if (updatedReservation.status !== "COMPLETED") {
      throw new Error("Payout reservation could not be confirmed COMPLETED.");
    }

    /* --------------------------------------------------------
       C. MARK PAYOUT PAID
    -------------------------------------------------------- */

    const updatedPayout = await updatePayout(payout, {
      status: "PAID",

      transferCode: transfer.transfer_code || payout.transferCode || null,

      transferID:
        transfer.id != null ? String(transfer.id) : payout.transferID || null,

      paidAt: payout.paidAt || new Date().toISOString(),

      failureReason: null,
    });

    if (updatedPayout.status !== "PAID") {
      throw new Error("Payout was not confirmed PAID.");
    }

    console.log("PAYOUT SUCCESSFULLY RECONCILED:", {
      payoutID: payout.id,
      transactionID: transaction.id,
      reservationID: updatedReservation.id,
      payoutStatus: updatedPayout.status,
      transactionStatus: updatedTransaction.status,
      reservationStatus: updatedReservation.status,
    });

    return {
      payoutID: payout.id,
      reference: payout.reference,

      status: "PAID",

      transactionStatus: "COMPLETED",
      reservationStatus: "COMPLETED",

      action: "FINALIZED",
    };
  }

  /* ==========================================================
     CONFIRMED TERMINAL FAILURE
  ========================================================== */

  /**
   * Only these two statuses are automatically reversed:
   *
   * failed
   * reversed
   *
   * Other statuses are not automatically treated as terminal.
   */

  if (transferStatus === "failed" || transferStatus === "reversed") {
    console.log("PAYSTACK CONFIRMED TERMINAL FAILURE:", {
      payoutID: payout.id,
      reference: payout.reference,
      transferStatus,
    });

    const eventType =
      transferStatus === "reversed" ? "transfer.reversed" : "transfer.failed";

    const failureReason =
      transfer.reason ||
      transfer.gateway_response ||
      `Paystack transfer ${transferStatus}.`;

    /* --------------------------------------------------------
       A. CHECK WHETHER REVERSAL CAN SAFELY PROCEED
    -------------------------------------------------------- */

    if (payout.walletRestoredAt) {
      // reversePayout can repair final record states without
      // crediting the wallet again when this marker exists.
      console.log(
        "WALLET RESTORATION MARKER EXISTS. REQUESTING STATUS REPAIR.",
      );
    } else if (
      currentReservation.status !== "RESERVED" ||
      transaction.status !== "PENDING"
    ) {
      throw new Error(
        "Automatic reversal is unsafe. The reservation or transaction is not in the expected state. Manual reconciliation is required.",
      );
    }

    /* --------------------------------------------------------
       B. REQUEST DEDICATED REVERSAL
    -------------------------------------------------------- */

    const reversal = await requestPayoutReversal({
      payout,
      transaction,
      transfer,
      eventType,
      failureReason,
    });

    return {
      payoutID: payout.id,
      reference: payout.reference,

      status: "FAILED",

      transferStatus,

      transactionStatus: reversal.transactionStatus,

      action: reversal.alreadyReversed ? "ALREADY_REVERSED" : "REVERSED",
    };
  }

  /* ==========================================================
     PENDING / PROCESSING / UNKNOWN TRANSFER STATUS
  ========================================================== */

  console.log("PAYSTACK TRANSFER IS NOT FINAL:", {
    payoutID: payout.id,
    reference: payout.reference,
    transferStatus,
  });

  // Do not change the wallet, transaction, reservation
  // or payout status for an unconfirmed transfer result.

  return {
    payoutID: payout.id,
    reference: payout.reference,

    status: "PROCESSING",

    transferStatus,

    action: "NO_CHANGE",

    reason: "Paystack has not returned a confirmed terminal result.",
  };
}

/* ============================================================
   MAIN LAMBDA HANDLER
============================================================ */

exports.handler = async (event) => {
  console.log("============================================================");

  console.log("ATUA RECONCILE PAYOUTS STARTED");

  console.log("INVOCATION EVENT:", JSON.stringify(event || {}));

  try {
    /* --------------------------------------------------------
       1. GET PAYSTACK SECRET
    -------------------------------------------------------- */

    const secretKey = await getPaystackSecret();

    /* --------------------------------------------------------
       2. GET PROCESSING PAYOUTS
    -------------------------------------------------------- */

    const payouts = await getProcessingPayouts();

    console.log("PROCESSING PAYOUT COUNT:", payouts.length);

    if (payouts.length === 0) {
      return {
        success: true,

        processed: 0,
        finalized: 0,
        failed: 0,
        unchanged: 0,
        errors: 0,

        message: "No PROCESSING payouts require reconciliation.",
      };
    }

    /* --------------------------------------------------------
       3. PROCESS PAYOUTS SEQUENTIALLY
    -------------------------------------------------------- */

    const results = [];

    let finalized = 0;
    let failed = 0;
    let unchanged = 0;
    let errors = 0;

    for (const payout of payouts) {
      try {
        const result = await reconcileOnePayout({
          payout,
          secretKey,
        });

        results.push(result);

        if (result.status === "PAID") {
          finalized++;
        } else if (result.status === "FAILED") {
          failed++;
        } else {
          unchanged++;
        }
      } catch (error) {
        errors++;

        console.error("PAYOUT RECONCILIATION ERROR:", {
          payoutID: payout.id,
          reference: payout.reference,
          error: errorText(error),
          stack: error?.stack,
        });

        results.push({
          payoutID: payout.id,
          reference: payout.reference,

          status: "PROCESSING",

          action: "ERROR",

          error: errorText(error),
        });
      }
    }

    /* --------------------------------------------------------
       4. FINAL SUMMARY
    -------------------------------------------------------- */

    const summary = {
      success: true,

      processed: payouts.length,

      finalized,
      failed,
      unchanged,
      errors,

      results,
    };

    console.log("============================================================");

    console.log(
      "ATUA RECONCILE PAYOUTS FINISHED:",
      JSON.stringify(summary, null, 2),
    );

    return summary;
  } catch (error) {
    console.error("RECONCILE PAYOUTS FATAL ERROR:", error);

    throw error;
  }
};
