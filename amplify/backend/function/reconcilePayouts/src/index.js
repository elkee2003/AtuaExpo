"use strict";

/**
 * ============================================================
 * reconcilePayouts
 * ============================================================
 *
 * PURPOSE
 * ------------------------------------------------------------
 * This Lambda is the SAFETY-NET for courier payouts.
 *
 * processPayouts:
 *
 *     Creates Payout
 *          ↓
 *     Initiates Paystack transfer
 *          ↓
 *     Payout = PROCESSING
 *
 * paystackWebhook:
 *
 *     Normally receives the final Paystack result.
 *
 * reconcilePayouts:
 *
 *     Checks PROCESSING payouts directly with Paystack.
 *
 * This protects Atua when:
 *
 *     - Paystack webhook is delayed
 *     - webhook is missed
 *     - webhook processing fails
 *     - database update failed
 *
 *
 * IMPORTANT
 * ------------------------------------------------------------
 *
 * This Lambda NEVER creates another Paystack transfer.
 *
 * It ONLY verifies an existing transfer.
 *
 *
 * FINAL STATES
 * ------------------------------------------------------------
 *
 * Paystack success:
 *
 *     Transaction -> COMPLETED
 *     Payout      -> PAID
 *
 *
 * Paystack failed/reversed/abandoned/blocked/rejected:
 *
 *     reversePayout
 *          ↓
 *     Wallet restored
 *          ↓
 *     Transaction -> REVERSED
 *     Payout      -> FAILED
 *
 *
 * IMPORTANT
 * ------------------------------------------------------------
 *
 * REVERSED means:
 *
 *     The Paystack payout failed
 *     AND
 *     The wallet debit was successfully restored.
 *
 * Therefore:
 *
 *     Transaction -> REVERSED
 *
 * must only happen after wallet restoration has been
 * successfully confirmed.
 *
 *
 * Paystack pending/unknown:
 *
 *     Nothing changes.
 *     Payout remains PROCESSING.
 *
 *
 * ============================================================
 */

/* ============================================================
   AWS SSM
============================================================ */

const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

/* ============================================================
   CONFIGURATION
============================================================ */

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const GRAPHQL_API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

/*
 * IMPORTANT:
 *
 * PAYSTACK_SECRET_KEY is the SSM parameter name/path.
 *
 * It is NOT the actual Paystack secret itself.
 */
const PAYSTACK_SECRET_PARAMETER = process.env.PAYSTACK_SECRET_KEY;

/* ============================================================
   CONFIGURATION VALIDATION
============================================================ */

if (!GRAPHQL_ENDPOINT) {
  throw new Error("Missing API_ATUA_GRAPHQLAPIENDPOINTOUTPUT.");
}

if (!GRAPHQL_API_KEY) {
  throw new Error("Missing API_ATUA_GRAPHQLAPIKEYOUTPUT.");
}

if (!PAYSTACK_SECRET_PARAMETER) {
  throw new Error("Missing PAYSTACK_SECRET_KEY secret configuration.");
}

/* ============================================================
   SSM CLIENT
============================================================ */

const ssmClient = new SSMClient({});

/* ============================================================
   GET PAYSTACK SECRET
============================================================ */

async function getPaystackSecret() {
  const command = new GetParameterCommand({
    Name: PAYSTACK_SECRET_PARAMETER,
    WithDecryption: true,
  });

  const result = await ssmClient.send(command);

  const secret = result?.Parameter?.Value;

  if (!secret) {
    throw new Error("Paystack secret was not found in SSM.");
  }

  return secret;
}

/* ============================================================
   GRAPHQL REQUEST
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
  });

  const responseText = await response.text();

  let result;

  try {
    result = JSON.parse(responseText);
  } catch (error) {
    throw new Error(
      `GraphQL returned invalid JSON. HTTP ${response.status}: ${responseText}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `GraphQL HTTP ${response.status}: ${JSON.stringify(result)}`,
    );
  }

  if (result.errors && result.errors.length > 0) {
    throw new Error(
      `GraphQL ${operationName} failed: ${JSON.stringify(result.errors)}`,
    );
  }

  return result.data;
}

/* ============================================================
   GET PROCESSING PAYOUTS
============================================================ */

/**
 * Retrieves every payout currently in PROCESSING.
 *
 * Pagination is used so this does not stop at the first
 * 100 records.
 */
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
            _lastChangedAt
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

    /*
     * Do not include deleted records.
     */
    payouts.push(...items.filter((item) => item && !item._deleted));

    nextToken = page.nextToken || null;
  } while (nextToken);

  return payouts;
}

/* ============================================================
   GET PAYOUT TRANSACTION
============================================================ */

/**
 * Finds the original payout DEBIT transaction.
 *
 * We require:
 *
 *     reference = payout.reference
 *     walletID  = payout.walletID
 *     type      = DEBIT
 *
 * This prevents reconciliation from accidentally operating
 * on another transaction belonging to the same wallet.
 */
async function getPayoutTransaction(payout) {
  if (!payout?.reference) {
    throw new Error(`Payout ${payout?.id || "unknown"} has no reference.`);
  }

  if (!payout?.walletID) {
    throw new Error(`Payout ${payout.id} has no walletID.`);
  }

  const query = /* GraphQL */ `
    query GetPayoutTransaction(
      $filter: ModelTransactionFilterInput
      $limit: Int
    ) {
      listTransactions(filter: $filter, limit: $limit) {
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

          createdAt
          updatedAt

          _version
          _lastChangedAt
          _deleted
        }
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    {
      filter: {
        and: [
          {
            reference: {
              eq: payout.reference,
            },
          },

          {
            walletID: {
              eq: payout.walletID,
            },
          },

          {
            type: {
              eq: "DEBIT",
            },
          },
        ],
      },

      limit: 20,
    },
    "GetPayoutTransaction",
  );

  const transactions = data?.listTransactions?.items || [];

  const matches = transactions.filter(
    (item) =>
      item &&
      !item._deleted &&
      item.reference === payout.reference &&
      item.walletID === payout.walletID &&
      item.type === "DEBIT",
  );

  if (matches.length > 1) {
    throw new Error(
      `Multiple DEBIT transactions were found for payout ${payout.reference}. Manual reconciliation is required.`,
    );
  }

  return matches[0] || null;
}

/* ============================================================
   UPDATE PAYOUT
============================================================ */

async function updatePayout({ payout, fields }) {
  const mutation = /* GraphQL */ `
    mutation UpdatePayout($input: UpdatePayoutInput!) {
      updatePayout(input: $input) {
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

        createdAt
        updatedAt

        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const input = {
    id: payout.id,

    ...fields,
  };

  /*
   * Amplify optimistic concurrency.
   */
  if (payout._version !== undefined && payout._version !== null) {
    input._version = payout._version;
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
    throw new Error(`Payout ${payout.id} was not returned after update.`);
  }

  return updatedPayout;
}

/* ============================================================
   UPDATE TRANSACTION
============================================================ */

async function updateTransaction({ transaction, fields }) {
  const mutation = /* GraphQL */ `
    mutation UpdateTransaction($input: UpdateTransactionInput!) {
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

        createdAt
        updatedAt

        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const input = {
    id: transaction.id,

    ...fields,
  };

  /*
   * Amplify optimistic concurrency.
   */
  if (transaction._version !== undefined && transaction._version !== null) {
    input._version = transaction._version;
  }

  const data = await graphqlRequest(
    mutation,
    {
      input,
    },
    "UpdateTransaction",
  );

  const updatedTransaction = data?.updateTransaction;

  if (!updatedTransaction) {
    throw new Error(
      `Transaction ${transaction.id} was not returned after update.`,
    );
  }

  return updatedTransaction;
}

/* ============================================================
   VERIFY PAYSTACK TRANSFER
============================================================ */

/**
 * Verifies an EXISTING Paystack transfer.
 *
 * This function NEVER creates a transfer.
 */
async function verifyPaystackTransfer({ reference, secretKey }) {
  if (!reference) {
    throw new Error("Paystack transfer reference is required.");
  }

  if (!secretKey) {
    throw new Error("Paystack secret key is required.");
  }

  const url =
    `https://api.paystack.co/transfer/verify/` +
    `${encodeURIComponent(reference)}`;

  const response = await fetch(url, {
    method: "GET",

    headers: {
      Authorization: `Bearer ${secretKey}`,

      "Content-Type": "application/json",
    },
  });

  const responseText = await response.text();

  let result;

  try {
    result = JSON.parse(responseText);
  } catch (error) {
    throw new Error(
      `Paystack returned invalid JSON. HTTP ${response.status}: ${responseText}`,
    );
  }

  /*
   * IMPORTANT:
   *
   * A Paystack API/HTTP error is NOT automatically treated
   * as a failed transfer.
   *
   * We leave the payout PROCESSING and retry later.
   */
  if (!response.ok) {
    throw new Error(
      `Paystack verification HTTP ${response.status}: ${JSON.stringify(result)}`,
    );
  }

  if (result?.status !== true) {
    throw new Error(
      result?.message || `Paystack could not verify transfer ${reference}.`,
    );
  }

  if (!result.data) {
    throw new Error(`Paystack returned no transfer data for ${reference}.`);
  }

  return result.data;
}

/* ============================================================
   VALIDATE PAYSTACK TRANSFER
============================================================ */

/**
 * Makes sure the transfer returned by Paystack is actually
 * the transfer belonging to this Atua Payout.
 *
 * IMPORTANT ACCOUNTING DISTINCTION:
 *
 * Payout.amount
 *     =
 *     amount sent to Paystack
 *
 * Transaction.amount
 *     =
 *     amount removed from wallet
 *
 * Therefore Payout.amount is used when validating Paystack's
 * transfer amount.
 */
function validateTransfer({ payout, transfer }) {
  if (!transfer) {
    throw new Error(`Paystack returned no transfer for ${payout.reference}.`);
  }

  /*
   * Reference must match.
   */
  if (transfer.reference !== payout.reference) {
    throw new Error(
      `Paystack reference mismatch for payout ${payout.reference}.`,
    );
  }

  /*
   * Validate payout amount.
   */
  const payoutAmount = Number(payout.amount);

  if (!Number.isFinite(payoutAmount) || payoutAmount <= 0) {
    throw new Error(
      `Invalid payout amount for ${payout.reference}: ${payout.amount}`,
    );
  }

  /*
   * Paystack returns transfer amounts in kobo.
   */
  const transferAmountNaira = Number(transfer.amount) / 100;

  if (!Number.isFinite(transferAmountNaira)) {
    throw new Error(
      `Invalid Paystack transfer amount for ${payout.reference}: ${transfer.amount}`,
    );
  }

  const expected = Number(payoutAmount.toFixed(2));

  const received = Number(transferAmountNaira.toFixed(2));

  if (expected !== received) {
    throw new Error(
      `Paystack amount mismatch for ${payout.reference}. Expected ${expected}, received ${received}.`,
    );
  }

  /*
   * Atua payout transfers are NGN.
   */
  if (transfer.currency && String(transfer.currency).toUpperCase() !== "NGN") {
    throw new Error(
      `Unexpected Paystack currency for ${payout.reference}: ${transfer.currency}`,
    );
  }
}

/* ============================================================
   REVERSE PAYOUT
============================================================ */

/**
 * Sends the failed/reversed payout to the dedicated
 * reversePayout Lambda.
 *
 * IMPORTANT:
 *
 * reconcilePayouts does NOT directly modify the wallet.
 *
 * reversePayout owns wallet restoration.
 *
 * reversePayout is also responsible for making sure the
 * Transaction is marked REVERSED only after the wallet
 * restoration succeeds.
 *
 * Expected final result:
 *
 *     Wallet restored
 *          ↓
 *     Transaction -> REVERSED
 *     Payout      -> FAILED
 */
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

    /*
     * This is supplementary.
     *
     * reversePayout re-reads Transaction.amount and uses
     * that as the authoritative restoration amount.
     */
    restorationAmount: Number(transaction.amount),

    eventType,

    transferCode: transfer?.transfer_code || payout.transferCode || null,

    transferID:
      transfer?.id != null ? String(transfer.id) : payout.transferID || null,

    failureReason:
      failureReason ||
      "Paystack transfer failed or was reversed during reconciliation.",
  };

  console.log("REQUESTING PAYOUT REVERSAL:", {
    payoutID: input.payoutID,

    transactionID: input.transactionID,

    walletID: input.walletID,

    reference: input.reference,

    eventType: input.eventType,

    restorationAmount: input.restorationAmount,

    transferCode: input.transferCode,

    transferID: input.transferID,
  });

  const data = await graphqlRequest(
    mutation,
    {
      input,
    },
    "ReversePayout",
  );

  const result = data?.reversePayout;

  if (!result) {
    throw new Error(
      `reversePayout returned no result for ${payout.reference}.`,
    );
  }

  if (result.success !== true) {
    throw new Error(
      result.message || `reversePayout failed for ${payout.reference}.`,
    );
  }

  /*
   * Confirm that reversePayout actually reached the expected
   * final states.
   *
   * IMPORTANT:
   *
   * Payout and Transaction have different meanings here.
   *
   * Payout:
   *
   *     FAILED
   *
   * means the Paystack payout itself failed/reversed.
   *
   * Transaction:
   *
   *     REVERSED
   *
   * means the original wallet debit was successfully
   * reversed/restored.
   *
   * Therefore we expect:
   *
   *     Payout      -> FAILED
   *     Transaction -> REVERSED
   */
  if (result.payoutStatus !== "FAILED") {
    throw new Error(
      `reversePayout returned payout status ${result.payoutStatus} for ${payout.reference}.`,
    );
  }

  if (result.transactionStatus !== "REVERSED") {
    throw new Error(
      `reversePayout returned transaction status ${result.transactionStatus} for ${payout.reference}. Expected REVERSED after successful wallet restoration.`,
    );
  }

  console.log("PAYOUT REVERSAL RESULT:", {
    payoutID: result.payoutID,

    transactionID: result.transactionID,

    walletID: result.walletID,

    payoutStatus: result.payoutStatus,

    transactionStatus: result.transactionStatus,

    restoredAmount: result.restoredAmount,

    alreadyReversed: result.alreadyReversed,

    message: result.message,
  });

  return result;
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

    currentStatus: payout.status,
  });

  /* ==========================================================
     BASIC VALIDATION
  ========================================================== */

  if (!payout.reference) {
    throw new Error(`Payout ${payout.id} has no reference.`);
  }

  if (!payout.walletID) {
    throw new Error(`Payout ${payout.id} has no walletID.`);
  }

  /* ==========================================================
     GET ORIGINAL PAYOUT TRANSACTION
  ========================================================== */

  const transaction = await getPayoutTransaction(payout);

  if (!transaction) {
    throw new Error(
      `No DEBIT transaction found for payout ${payout.reference}.`,
    );
  }

  /* ==========================================================
     VALIDATE TRANSACTION IDENTITY
  ========================================================== */

  if (transaction.walletID !== payout.walletID) {
    throw new Error(`Wallet mismatch for payout ${payout.reference}.`);
  }

  if (transaction.reference !== payout.reference) {
    throw new Error(
      `Reference mismatch between payout and transaction for ${payout.reference}.`,
    );
  }

  if (transaction.type !== "DEBIT") {
    throw new Error(
      `Transaction ${transaction.id} is not a DEBIT transaction.`,
    );
  }

  const transactionAmount = Number(transaction.amount);

  if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
    throw new Error(
      `Invalid payout transaction amount for ${payout.reference}: ${transaction.amount}`,
    );
  }

  /* ==========================================================
     VERIFY EXISTING PAYSTACK TRANSFER
  ========================================================== */

  const transfer = await verifyPaystackTransfer({
    reference: payout.reference,

    secretKey,
  });

  /* ==========================================================
     VALIDATE PAYSTACK TRANSFER
  ========================================================== */

  validateTransfer({
    payout,

    transfer,
  });

  /* ==========================================================
     GET TRANSFER STATUS
  ========================================================== */

  const transferStatus = String(transfer.status || "").toLowerCase();

  console.log("PAYSTACK TRANSFER STATUS:", {
    reference: payout.reference,

    transferID: transfer.id,

    transferCode: transfer.transfer_code,

    status: transferStatus,

    amount: transfer.amount,

    currency: transfer.currency,
  });

  /* ==========================================================
     TRANSFER SUCCESS
  ========================================================== */

  if (transferStatus === "success") {
    console.log("PAYSTACK TRANSFER SUCCESS:", payout.reference);

    /* --------------------------------------------------------
       CRITICAL TRANSACTION STATE CHECK
    -------------------------------------------------------- */

    /**
     * If Paystack says SUCCESS:
     *
     *     PENDING    -> COMPLETED
     *
     * is valid.
     *
     *     COMPLETED  -> COMPLETED
     *
     * is also valid.
     *
     * BUT:
     *
     *     FAILED -> COMPLETED
     *
     * is NEVER allowed automatically.
     */

    if (transaction.status === "FAILED") {
      throw new Error(
        `Paystack reports SUCCESS for payout ${payout.reference}, but Transaction ${transaction.id} is already FAILED. Automatic reconciliation is unsafe; manual reconciliation is required.`,
      );
    }

    /* --------------------------------------------------------
       COMPLETE PENDING TRANSACTION
    -------------------------------------------------------- */

    let updatedTransaction = transaction;

    if (transaction.status === "PENDING") {
      updatedTransaction = await updateTransaction({
        transaction,

        fields: {
          status: "COMPLETED",
        },
      });
    }

    /* --------------------------------------------------------
       VERIFY TRANSACTION COMPLETED
    -------------------------------------------------------- */

    if (updatedTransaction.status !== "COMPLETED") {
      throw new Error(
        `Transaction ${updatedTransaction.id} could not be confirmed COMPLETED for payout ${payout.reference}.`,
      );
    }

    /* --------------------------------------------------------
       MARK PAYOUT PAID
    -------------------------------------------------------- */

    const updatedPayout = await updatePayout({
      payout,

      fields: {
        status: "PAID",

        transferCode: transfer.transfer_code || payout.transferCode || null,

        transferID:
          transfer.id != null ? String(transfer.id) : payout.transferID || null,

        paidAt: payout.paidAt || new Date().toISOString(),

        failureReason: null,
      },
    });

    /* --------------------------------------------------------
       FINAL PAYOUT VALIDATION
    -------------------------------------------------------- */

    if (updatedPayout.status !== "PAID") {
      throw new Error(`Payout ${payout.reference} was not confirmed PAID.`);
    }

    console.log("PAYOUT RECONCILIATION SUCCESS:", {
      payoutID: updatedPayout.id,

      reference: updatedPayout.reference,

      payoutStatus: updatedPayout.status,

      transactionID: updatedTransaction.id,

      transactionStatus: updatedTransaction.status,
    });

    return {
      payoutID: payout.id,

      reference: payout.reference,

      status: "PAID",

      transactionStatus: "COMPLETED",

      action: "FINALIZED",
    };
  }

  /* ==========================================================
     TERMINAL TRANSFER FAILURE
  ========================================================== */

  /*
   * Paystack has several conclusive failure states.
   *
   * These states mean the transfer will not complete successfully:
   *
   *     failed
   *     reversed
   *     abandoned
   *     blocked
   *     rejected
   *
   * Atua must restore the wallet for all of these states.
   *
   * Once wallet restoration succeeds:
   *
   *     Transaction -> REVERSED
   *     Payout      -> FAILED
   *
   * REVERSED is used instead of FAILED for the Transaction
   * because the original wallet debit has been successfully
   * undone.
   *
   * We intentionally route:
   *
   *     reversed -> transfer.reversed
   *     everything else -> transfer.failed
   *
   * because reversePayout accepts only the two event types above.
   */

  const terminalFailureStatuses = new Set([
    "failed",
    "reversed",
    "abandoned",
    "blocked",
    "rejected",
  ]);

  if (terminalFailureStatuses.has(transferStatus)) {
    const defaultFailureReasons = {
      failed: "Paystack transfer failed.",

      reversed: "Paystack transfer was reversed.",

      abandoned: "Paystack transfer was abandoned before completion.",

      blocked: "Paystack transfer was blocked by Paystack.",

      rejected: "Paystack transfer was rejected by Paystack.",
    };

    const failureReason =
      transfer.reason ||
      transfer.gateway_response ||
      (transfer.failures ? JSON.stringify(transfer.failures) : null) ||
      defaultFailureReasons[transferStatus] ||
      `Paystack transfer ended with terminal status: ${transferStatus}.`;

    const eventType =
      transferStatus === "reversed" ? "transfer.reversed" : "transfer.failed";

    console.log("PAYSTACK TRANSFER TERMINAL FAILURE:", {
      reference: payout.reference,

      transferStatus,

      eventType,

      failureReason,
    });

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

      // The Paystack payout itself failed.
      status: "FAILED",

      transferStatus,

      // The wallet debit was successfully restored.
      transactionStatus: reversal.transactionStatus,

      action: reversal.alreadyReversed ? "ALREADY_REVERSED" : "REVERSED",
    };
  }

  /* ==========================================================
     PENDING / PROCESSING / UNKNOWN
  ========================================================== */

  /**
   * Anything that is not a confirmed final state is left
   * completely untouched.
   *
   * We DO NOT:
   *
   *     - restore wallet
   *     - mark payout FAILED
   *     - mark payout PAID
   *     - create another transfer
   *
   * It will be checked during the next reconciliation run.
   */

  console.log("PAYSTACK TRANSFER NOT FINAL:", {
    reference: payout.reference,

    transferStatus,
  });

  return {
    payoutID: payout.id,

    reference: payout.reference,

    status: "PROCESSING",

    transferStatus,

    action: "NO_CHANGE",
  };
}

/* ============================================================
   MAIN HANDLER
============================================================ */

exports.handler = async (event) => {
  console.log("============================================================");

  console.log("RECONCILE PAYOUTS STARTED");

  console.log("Invocation event:", JSON.stringify(event || {}, null, 2));

  try {
    /* ========================================================
         STEP 1
         GET PAYSTACK SECRET
      ======================================================== */

    const secretKey = await getPaystackSecret();

    /* ========================================================
         STEP 2
         GET PROCESSING PAYOUTS
      ======================================================== */

    const payouts = await getProcessingPayouts();

    console.log("PROCESSING PAYOUT COUNT:", payouts.length);

    /* ========================================================
         NOTHING TO PROCESS
      ======================================================== */

    if (payouts.length === 0) {
      console.log("NO PROCESSING PAYOUTS FOUND.");

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

    /* ========================================================
         PROCESS PAYOUTS
      ======================================================== */

    const results = [];

    let finalized = 0;

    let failed = 0;

    let unchanged = 0;

    let errors = 0;

    /*
     * Process sequentially.
     *
     * This avoids sending a large number of simultaneous
     * GraphQL/Paystack requests.
     */

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
        /*
         * IMPORTANT:
         *
         * One payout failing must NOT stop reconciliation
         * for every other payout.
         */

        errors++;

        console.error("PAYOUT RECONCILIATION ERROR:", {
          payoutID: payout.id,

          reference: payout.reference,

          error: error?.message || String(error),

          stack: error?.stack,
        });

        /*
         * Leave the payout PROCESSING.
         *
         * This means another reconciliation run can safely
         * inspect it again.
         */

        results.push({
          payoutID: payout.id,

          reference: payout.reference,

          status: "PROCESSING",

          action: "ERROR",

          error: error?.message || String(error),
        });
      }
    }

    /* ========================================================
         FINAL SUMMARY
      ======================================================== */

    console.log("============================================================");

    console.log("RECONCILE PAYOUTS FINISHED");

    console.log({
      processed: payouts.length,

      finalized,

      failed,

      unchanged,

      errors,
    });

    /*
     * The reconciliation scan itself succeeded.
     *
     * Individual payout errors are returned in results.
     *
     * Those payouts remain PROCESSING and can be checked
     * again during the next reconciliation run.
     */

    return {
      success: true,

      processed: payouts.length,

      finalized,

      failed,

      unchanged,

      errors,

      results,
    };
  } catch (error) {
    /*
     * Global failures should fail the Lambda invocation.
     *
     * Examples:
     *
     *     - SSM unavailable
     *     - GraphQL unavailable
     *     - configuration failure
     *     - Paystack secret unavailable
     */

    console.error("RECONCILE PAYOUTS FATAL ERROR:", error);

    throw error;
  }
};
