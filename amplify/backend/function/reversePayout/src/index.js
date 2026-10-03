"use strict";

/**
 * ============================================================
 * reversePayout
 * ============================================================
 *
 * PURPOSE
 * ------------------------------------------------------------
 * Reverses a courier payout when Paystack reports:
 *
 *   transfer.failed
 *   transfer.reversed
 *
 *
 * IMPORTANT ACCOUNTING RULE
 * ------------------------------------------------------------
 *
 * Payout.amount:
 *   = amount sent to Paystack
 *
 * Transaction.amount:
 *   = TOTAL amount removed from the courier wallet
 *
 * Therefore, when a payout fails, we restore:
 *
 *   Transaction.amount
 *
 * NOT:
 *
 *   Payout.amount
 *
 *
 * Example:
 *
 *   Requested payout       = ₦10,000
 *   Courier request fee    = ₦100
 *   Wallet debit           = ₦10,100
 *   Paystack transfer      = ₦10,000
 *
 * If Paystack transfer fails:
 *
 *   Wallet restoration = ₦10,100
 *
 *
 * ============================================================
 * WALLET RESTORATION SAFETY
 * ============================================================
 *
 * Payout.walletRestoredAt is used as the durable idempotency
 * marker for the wallet restoration.
 *
 * Once walletRestoredAt has a value:
 *
 *   DO NOT restore the wallet again.
 *
 * This protects against:
 *
 *   - duplicate Paystack webhooks
 *   - repeated transfer.failed events
 *   - repeated transfer.reversed events
 *   - reconciliation retries
 *   - manual Lambda retries
 *
 *
 * IMPORTANT:
 *
 * The wallet update and the Payout update are still separate
 * AppSync operations. Therefore, this is not a database-level
 * atomic transaction.
 *
 * If the wallet is restored but walletRestoredAt cannot be
 * saved, the Lambda stops and requires reconciliation rather
 * than attempting another restoration.
 *
 * ============================================================
 */

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const GRAPHQL_API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

/* ============================================================
   CONFIGURATION VALIDATION
============================================================ */

if (!GRAPHQL_ENDPOINT) {
  throw new Error("Missing API_ATUA_GRAPHQLAPIENDPOINTOUTPUT.");
}

if (!GRAPHQL_API_KEY) {
  throw new Error("Missing API_ATUA_GRAPHQLAPIKEYOUTPUT.");
}

/* ============================================================
   GRAPHQL REQUEST
============================================================ */

/**
 * Sends a GraphQL request to the Atua AppSync API.
 *
 * Throws when:
 *   - HTTP request fails
 *   - GraphQL returns errors
 *   - GraphQL returns invalid JSON
 */
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
   MONEY NORMALIZATION
============================================================ */

/**
 * Keeps financial calculations at two decimal places.
 */
function normalizeMoney(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    throw new Error(`Invalid monetary value: ${value}`);
  }

  return Number(amount.toFixed(2));
}

/* ============================================================
   GET PAYOUT BY REFERENCE
============================================================ */

/**
 * Finds the Payout using the Atua payout reference.
 *
 * walletRestoredAt is deliberately retrieved here because
 * it is the idempotency marker for wallet restoration.
 */
async function getPayoutByReference(reference) {
  if (!reference) {
    throw new Error("Payout reference is required.");
  }

  const query = /* GraphQL */ `
    query GetPayoutByReference($filter: ModelPayoutFilterInput) {
      listPayouts(filter: $filter, limit: 10) {
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

          # IMPORTANT:
          # This is the durable wallet restoration marker.
          walletRestoredAt

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
        reference: {
          eq: reference,
        },
      },
    },
    "GetPayoutByReference",
  );

  const payouts = data?.listPayouts?.items || [];

  const payout = payouts.find(
    (item) => item && !item._deleted && item.reference === reference,
  );

  return payout || null;
}

/* ============================================================
   GET EXACT PAYOUT TRANSACTION
============================================================ */

/**
 * Finds the exact payout DEBIT transaction.
 *
 * Required match:
 *
 *   reference === payout.reference
 *   walletID  === payout.walletID
 *   type      === DEBIT
 */
async function getPayoutTransaction({ reference, walletID }) {
  if (!reference) {
    throw new Error("Transaction reference is required.");
  }

  if (!walletID) {
    throw new Error("Wallet ID is required.");
  }

  const query = /* GraphQL */ `
    query GetPayoutTransaction($filter: ModelTransactionFilterInput) {
      listTransactions(filter: $filter, limit: 20) {
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
              eq: reference,
            },
          },
          {
            walletID: {
              eq: walletID,
            },
          },
        ],
      },
    },
    "GetPayoutTransaction",
  );

  const transactions = data?.listTransactions?.items || [];

  const matchingTransactions = transactions.filter(
    (item) =>
      item &&
      !item._deleted &&
      item.reference === reference &&
      item.walletID === walletID &&
      item.type === "DEBIT",
  );

  if (matchingTransactions.length > 1) {
    throw new Error(
      `Multiple DEBIT transactions found for payout reference ${reference}. Manual reconciliation is required.`,
    );
  }

  return matchingTransactions[0] || null;
}

/* ============================================================
   GET WALLET
============================================================ */

async function getWallet(walletID) {
  if (!walletID) {
    throw new Error("Wallet ID is required.");
  }

  const query = /* GraphQL */ `
    query GetWallet($id: ID!) {
      getWallet(id: $id) {
        id

        ownerID
        ownerType

        availableBalance
        pendingBalance
        lifetimeEarnings

        createdAt
        updatedAt

        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    {
      id: walletID,
    },
    "GetWallet",
  );

  const wallet = data?.getWallet || null;

  if (!wallet || wallet._deleted) {
    return null;
  }

  return wallet;
}

/* ============================================================
   UPDATE PAYOUT
============================================================ */

/**
 * Marks the Payout as FAILED.
 *
 * IMPORTANT:
 *
 * walletRestoredAt is written here after the wallet has been
 * successfully restored.
 *
 * This makes walletRestoredAt the durable marker that prevents
 * another restoration on retry.
 */
async function updatePayoutFailed({
  payout,
  failureReason,
  transferCode,
  transferID,
  walletRestoredAt,
}) {
  const mutation = /* GraphQL */ `
    mutation UpdatePayout($input: UpdatePayoutInput!) {
      updatePayout(input: $input) {
        id

        courierID
        walletID

        amount
        status

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

        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const input = {
    id: payout.id,

    status: "FAILED",

    failureReason:
      failureReason || payout.failureReason || "Paystack transfer failed.",

    failedAt: payout.failedAt || new Date().toISOString(),

    /*
     * IMPORTANT:
     *
     * This is the durable marker that tells future retries:
     *
     * "The wallet has already been restored."
     */
    walletRestoredAt:
      walletRestoredAt || payout.walletRestoredAt || new Date().toISOString(),
  };

  if (transferCode) {
    input.transferCode = transferCode;
  }

  if (transferID) {
    input.transferID = String(transferID);
  }

  /*
   * Optimistic concurrency.
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
   UPDATE TRANSACTION -> FAILED
============================================================ */

async function updateTransactionFailed(transaction) {
  /*
   * Already FAILED is safe and idempotent.
   */
  if (transaction.status === "FAILED") {
    return transaction;
  }

  /*
   * Never move COMPLETED backwards automatically.
   */
  if (transaction.status === "COMPLETED") {
    throw new Error(
      `Transaction ${transaction.id} is already COMPLETED. Manual reconciliation is required.`,
    );
  }

  /*
   * Only PENDING can normally become FAILED.
   */
  if (transaction.status !== "PENDING") {
    throw new Error(
      `Transaction ${transaction.id} has unexpected status ${transaction.status}.`,
    );
  }

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

        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const input = {
    id: transaction.id,
    status: "FAILED",
  };

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
   RESTORE WALLET
============================================================ */

/**
 * Restores the exact amount removed from the wallet.
 *
 * IMPORTANT:
 *
 * Transaction.amount is authoritative.
 *
 * Payout.amount is NOT used here.
 */
async function restoreWallet({ wallet, transaction }) {
  if (!wallet?.id) {
    throw new Error("Wallet is required.");
  }

  if (!transaction?.id) {
    throw new Error("Transaction is required.");
  }

  if (transaction.walletID !== wallet.id) {
    throw new Error(
      `Transaction ${transaction.id} does not belong to wallet ${wallet.id}.`,
    );
  }

  const restorationAmount = normalizeMoney(transaction.amount);

  if (restorationAmount <= 0) {
    throw new Error(`Invalid restoration amount: ${transaction.amount}`);
  }

  const currentBalance = normalizeMoney(wallet.availableBalance || 0);

  const newBalance = normalizeMoney(currentBalance + restorationAmount);

  const mutation = /* GraphQL */ `
    mutation RestoreWallet($input: UpdateWalletInput!) {
      updateWallet(input: $input) {
        id

        ownerID
        ownerType

        availableBalance
        pendingBalance
        lifetimeEarnings

        createdAt
        updatedAt

        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const input = {
    id: wallet.id,
    availableBalance: newBalance,
  };

  /*
   * Optimistic concurrency protection.
   *
   * If the wallet changed after we read it,
   * AppSync should reject this update.
   */
  if (wallet._version !== undefined && wallet._version !== null) {
    input._version = wallet._version;
  }

  console.log("RESTORING PAYOUT WALLET:", {
    walletID: wallet.id,
    transactionID: transaction.id,
    reference: transaction.reference,

    previousBalance: currentBalance,
    restorationAmount,
    newBalance,

    walletVersion: wallet._version,
  });

  const data = await graphqlRequest(
    mutation,
    {
      input,
    },
    "RestoreWallet",
  );

  const updatedWallet = data?.updateWallet;

  if (!updatedWallet) {
    throw new Error(`Wallet ${wallet.id} was not returned after restoration.`);
  }

  return {
    wallet: updatedWallet,
    restoredAmount: restorationAmount,
  };
}

/* ============================================================
   VALIDATE INPUT
============================================================ */

function validateInput(input) {
  if (!input) {
    throw new Error("reversePayout input is required.");
  }

  if (!input.payoutID) {
    throw new Error("payoutID is required.");
  }

  if (!input.transactionID) {
    throw new Error("transactionID is required.");
  }

  if (!input.walletID) {
    throw new Error("walletID is required.");
  }

  if (!input.reference) {
    throw new Error("reference is required.");
  }

  if (!input.eventType) {
    throw new Error("eventType is required.");
  }

  if (
    input.eventType !== "transfer.failed" &&
    input.eventType !== "transfer.reversed"
  ) {
    throw new Error(`Unsupported reversal event: ${input.eventType}`);
  }
}

/* ============================================================
   MAIN REVERSAL
============================================================ */

async function reversePayout(input) {
  validateInput(input);

  const {
    payoutID,
    transactionID,
    walletID,
    reference,
    eventType,
    failureReason,
    transferCode,
    transferID,
  } = input;

  console.log("STARTING reversePayout:", {
    payoutID,
    transactionID,
    walletID,
    reference,
    eventType,
  });

  /* ==========================================================
     STEP 1
     GET PAYOUT
  ========================================================== */

  const payout = await getPayoutByReference(reference);

  if (!payout) {
    throw new Error(`No payout found for reference ${reference}.`);
  }

  /*
   * Verify that the supplied payout ID matches
   * the payout found by reference.
   */
  if (payout.id !== payoutID) {
    throw new Error(
      `Payout reference ${reference} belongs to ${payout.id}, not ${payoutID}.`,
    );
  }

  /*
   * Verify wallet ownership.
   */
  if (payout.walletID !== walletID) {
    throw new Error(
      `Payout ${payout.id} belongs to wallet ${payout.walletID}, not ${walletID}.`,
    );
  }

  /* ==========================================================
     STEP 2
     CHECK WALLET RESTORATION MARKER
  ========================================================== */

  /**
   * This is the NEW and IMPORTANT part.
   *
   * If walletRestoredAt exists, the wallet restoration has
   * already been completed.
   *
   * Therefore:
   *
   *     NEVER restore the wallet again.
   *
   * We can safely repair the remaining payout/transaction
   * state if necessary.
   */

  if (payout.walletRestoredAt) {
    console.log("WALLET ALREADY RESTORED - NO SECOND RESTORATION:", {
      payoutID: payout.id,
      reference,
      walletRestoredAt: payout.walletRestoredAt,
    });

    const transaction = await getPayoutTransaction({
      reference,
      walletID: payout.walletID,
    });

    if (!transaction) {
      throw new Error(
        `Payout ${payout.id} has walletRestoredAt but its transaction was not found. Manual reconciliation is required.`,
      );
    }

    if (transaction.id !== transactionID) {
      throw new Error(`Transaction mismatch for payout ${payout.id}.`);
    }

    /*
     * If the transaction is still PENDING,
     * repair it to FAILED.
     *
     * We DO NOT touch the wallet.
     */
    if (transaction.status === "PENDING") {
      const repairedTransaction = await updateTransactionFailed(transaction);

      /*
       * If Payout is not yet FAILED, finish it.
       */
      if (payout.status !== "FAILED") {
        const updatedPayout = await updatePayoutFailed({
          payout,

          failureReason: failureReason || `Paystack ${eventType}.`,

          transferCode,
          transferID,

          walletRestoredAt: payout.walletRestoredAt,
        });

        return {
          success: true,

          payoutID: updatedPayout.id,
          transactionID: repairedTransaction.id,
          walletID: updatedPayout.walletID,

          payoutStatus: updatedPayout.status,

          transactionStatus: repairedTransaction.status,

          restoredAmount: normalizeMoney(transaction.amount),

          alreadyReversed: true,

          message:
            "Wallet had already been restored. Payout and Transaction state were repaired without restoring the wallet again.",
        };
      }

      return {
        success: true,

        payoutID: payout.id,
        transactionID: repairedTransaction.id,
        walletID: payout.walletID,

        payoutStatus: "FAILED",
        transactionStatus: repairedTransaction.status,

        restoredAmount: normalizeMoney(transaction.amount),

        alreadyReversed: true,

        message:
          "Wallet had already been restored. Transaction was repaired without restoring the wallet again.",
      };
    }

    /*
     * FAILED + FAILED is completely idempotent.
     */
    if (payout.status === "FAILED" && transaction.status === "FAILED") {
      return {
        success: true,

        payoutID: payout.id,
        transactionID: transaction.id,
        walletID: payout.walletID,

        payoutStatus: "FAILED",
        transactionStatus: "FAILED",

        restoredAmount: normalizeMoney(transaction.amount),

        alreadyReversed: true,

        message:
          "Payout reversal was already completed. Wallet was not restored again.",
      };
    }

    /*
     * A COMPLETED transaction after wallet restoration
     * is a serious accounting conflict.
     */
    if (transaction.status === "COMPLETED") {
      throw new Error(
        `Payout ${payout.id} has walletRestoredAt but Transaction ${transaction.id} is COMPLETED. Manual reconciliation is required.`,
      );
    }

    /*
     * Any other state requires reconciliation.
     */
    throw new Error(
      `Payout ${payout.id} has walletRestoredAt but is in an unexpected financial state. Manual reconciliation is required.`,
    );
  }

  /* ==========================================================
     STEP 3
     PAYOUT ALREADY FAILED BUT WALLET RESTORATION MARKER
     IS MISSING
  ========================================================== */

  /**
   * This is deliberately conservative.
   *
   * If Payout is already FAILED but walletRestoredAt is NULL,
   * we cannot safely know whether the wallet was already
   * restored before a previous Lambda failure.
   *
   * Therefore we DO NOT restore automatically.
   *
   * Otherwise a retry could potentially double-credit the wallet.
   */

  if (payout.status === "FAILED") {
    throw new Error(
      `Payout ${payout.id} is already FAILED but walletRestoredAt is missing. Wallet restoration state is uncertain. Manual reconciliation is required.`,
    );
  }

  /* ==========================================================
     STEP 4
     PAYOUT ALREADY PAID
  ========================================================== */

  /**
   * Never automatically reverse a PAID payout.
   *
   * If Paystack reports transfer.reversed after success,
   * this requires financial reconciliation.
   */

  if (payout.status === "PAID") {
    throw new Error(
      `Payout ${payout.id} is already PAID but Paystack sent ${eventType}. Manual reconciliation is required.`,
    );
  }

  /* ==========================================================
     STEP 5
     GET EXACT PAYOUT TRANSACTION
  ========================================================== */

  const transaction = await getPayoutTransaction({
    reference,
    walletID: payout.walletID,
  });

  if (!transaction) {
    throw new Error(`No DEBIT transaction found for payout ${reference}.`);
  }

  if (transaction.id !== transactionID) {
    throw new Error(
      `Transaction mismatch. Expected ${transactionID}, found ${transaction.id}.`,
    );
  }

  /* ==========================================================
     STEP 6
     VALIDATE TRANSACTION
  ========================================================== */

  if (transaction.type !== "DEBIT") {
    throw new Error(
      `Transaction ${transaction.id} is not a DEBIT transaction.`,
    );
  }

  if (transaction.walletID !== payout.walletID) {
    throw new Error(
      `Transaction ${transaction.id} does not belong to payout wallet ${payout.walletID}.`,
    );
  }

  /*
   * Transaction.amount is authoritative.
   */
  const restorationAmount = normalizeMoney(transaction.amount);

  if (restorationAmount <= 0) {
    throw new Error(`Invalid transaction amount ${transaction.amount}.`);
  }

  /* ==========================================================
     STEP 7
     VALIDATE TRANSACTION STATUS
  ========================================================== */

  /*
   * COMPLETED means the financial state has already progressed.
   *
   * Never move it backwards automatically.
   */
  if (transaction.status === "COMPLETED") {
    throw new Error(
      `Transaction ${transaction.id} is already COMPLETED. Manual reconciliation is required.`,
    );
  }

  /*
   * Only PENDING is safe for the normal reversal path.
   */
  if (transaction.status !== "PENDING") {
    throw new Error(
      `Transaction ${transaction.id} has unexpected status ${transaction.status}. Manual reconciliation is required.`,
    );
  }

  /* ==========================================================
     STEP 8
     GET WALLET
  ========================================================== */

  const wallet = await getWallet(payout.walletID);

  if (!wallet) {
    throw new Error(`Wallet ${payout.walletID} was not found.`);
  }

  /*
   * Payout wallets must belong to couriers.
   */
  if (wallet.ownerType !== "COURIER") {
    throw new Error(`Wallet ${wallet.id} is not a COURIER wallet.`);
  }

  /*
   * Verify courier ownership.
   */
  if (payout.courierID && wallet.ownerID !== payout.courierID) {
    throw new Error(
      `Wallet ${wallet.id} does not belong to courier ${payout.courierID}.`,
    );
  }

  /* ==========================================================
     STEP 9
     RESTORE WALLET
  ========================================================== */

  /**
   * Restore the COMPLETE original wallet debit.
   *
   * Example:
   *
   *   Payout.amount      = ₦10,000
   *   Transaction.amount = ₦10,100
   *
   * Restore:
   *
   *   ₦10,100
   */

  const walletResult = await restoreWallet({
    wallet,
    transaction,
  });

  /* ==========================================================
     STEP 10
     MARK PAYOUT FAILED + RECORD WALLET RESTORATION
  ========================================================== */

  /**
   * VERY IMPORTANT:
   *
   * The wallet has now been restored.
   *
   * We immediately persist walletRestoredAt.
   *
   * If this update fails, we THROW and DO NOT retry the wallet
   * restoration automatically.
   *
   * The correct next action is reconciliation.
   */

  const walletRestoredAt = new Date().toISOString();

  let updatedPayout;

  try {
    updatedPayout = await updatePayoutFailed({
      payout,

      failureReason: failureReason || `Paystack ${eventType}.`,

      transferCode,
      transferID,

      walletRestoredAt,
    });
  } catch (error) {
    console.error("PAYOUT UPDATE FAILED AFTER WALLET RESTORATION:", error);

    throw new Error(
      `Wallet ${wallet.id} was restored for payout ${payout.id}, but walletRestoredAt could not be saved. DO NOT retry wallet restoration automatically. Manual reconciliation is required. ${error.message}`,
    );
  }

  /* ==========================================================
     STEP 11
     MARK TRANSACTION FAILED
  ========================================================== */

  let updatedTransaction;

  try {
    updatedTransaction = await updateTransactionFailed(transaction);
  } catch (error) {
    /**
     * At this point:
     *
     *   Wallet          = RESTORED
     *   walletRestoredAt = SET
     *   Payout          = FAILED
     *
     * Therefore a retry will NOT restore the wallet again.
     *
     * The remaining repair is the Transaction status.
     */

    console.error("TRANSACTION UPDATE FAILED AFTER PAYOUT REVERSAL:", error);

    throw new Error(
      `Payout ${payout.id} is FAILED and walletRestoredAt is recorded, but Transaction could not be marked FAILED. Reconciliation required. ${error.message}`,
    );
  }

  /* ==========================================================
     STEP 12
     FINAL VALIDATION
  ========================================================== */

  if (updatedPayout.status !== "FAILED") {
    throw new Error(`Payout ${updatedPayout.id} did not end in FAILED status.`);
  }

  if (!updatedPayout.walletRestoredAt) {
    throw new Error(
      `Payout ${updatedPayout.id} was marked FAILED but walletRestoredAt was not saved. Manual reconciliation is required.`,
    );
  }

  if (updatedTransaction.status !== "FAILED") {
    throw new Error(
      `Transaction ${updatedTransaction.id} did not end in FAILED status.`,
    );
  }

  /* ==========================================================
     STEP 13
     SUCCESS
  ========================================================== */

  console.log("PAYOUT REVERSAL COMPLETED:", {
    payoutID: updatedPayout.id,

    transactionID: updatedTransaction.id,

    walletID: walletResult.wallet.id,

    reference: updatedPayout.reference,

    restoredAmount: walletResult.restoredAmount,

    payoutStatus: updatedPayout.status,

    transactionStatus: updatedTransaction.status,

    walletRestoredAt: updatedPayout.walletRestoredAt,

    eventType,
  });

  return {
    success: true,

    payoutID: updatedPayout.id,

    transactionID: updatedTransaction.id,

    walletID: walletResult.wallet.id,

    payoutStatus: updatedPayout.status,

    transactionStatus: updatedTransaction.status,

    restoredAmount: walletResult.restoredAmount,

    alreadyReversed: false,

    message: "Payout reversal completed successfully.",
  };
}

/* ============================================================
   LAMBDA HANDLER
============================================================ */

exports.handler = async (event) => {
  console.log("reversePayout INVOKED:", JSON.stringify(event));

  try {
    /**
     * AppSync @function resolver supplies:
     *
     *   event.arguments.input
     *
     * We also support:
     *
     *   event.input
     *
     * for direct testing.
     */

    const input = event?.arguments?.input || event?.input || null;

    if (!input) {
      throw new Error("reversePayout received no input.");
    }

    const result = await reversePayout(input);

    console.log("reversePayout RESULT:", JSON.stringify(result));

    return result;
  } catch (error) {
    console.error("reversePayout FAILED:", error);

    /*
     * Throw the error instead of returning a fake success.
     *
     * This allows:
     *
     *   paystackWebhook
     *   reconcilePayouts
     *
     * to know that the reversal did not complete.
     */
    throw error;
  }
};
