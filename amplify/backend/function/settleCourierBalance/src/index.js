/* Amplify Params - DO NOT EDIT
        ENV
        REGION
        API_ATUA_GRAPHQLAPIIDOUTPUT
        API_ATUA_GRAPHQLAPIENDPOINTOUTPUT
        API_ATUA_GRAPHQLAPIKEYOUTPUT
Amplify Params - DO NOT EDIT */

"use strict";

/*
============================================================
SETTLE COURIER BALANCE
============================================================

PURPOSE
-------
Apply an APPROVED CourierReconciliation.

When COURIER_OWES_ATUA:
  1. Recover as much as possible from Wallet.availableBalance.
  2. Never intentionally set availableBalance below zero.
  3. Add unrecovered debt to Wallet.outstandingDebt.
  4. Record the recovered amount as a DEBIT Transaction.
  5. Mark the reconciliation SETTLED after successful steps.

When ATUA_OWES_COURIER:
  - Reject the request. Use the payout workflow instead.

SAFETY
------
- The reconciliation ID is the only financial input supplied.
- Amounts and courier ID are read from AppSync.
- A deterministic settlement reference prevents normal retries.
- Conditional mutations help prevent stale/concurrent updates.
- If a later step fails after the wallet changes, do not blindly
  invoke this Lambda again. Inspect the wallet, transaction, and
  reconciliation records first.

LIMITATION
----------
AppSync mutations are separate operations. This Lambda does not
provide a database-wide atomic transaction across the three models.
For strict exactly-once financial processing, use a transactional
ledger design with DynamoDB TransactWriteItems or an equivalent
atomic mechanism.

DEPENDENCIES
------------
Install/package aws4 with this Lambda:
  npm install aws4

AUTHENTICATION
--------------
This implementation signs AppSync requests using AWS IAM.
The Lambda execution role must be allowed to call AppSync, and
the models must allow IAM access.
============================================================
*/

const https = require("https");
const aws4 = require("aws4");

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const AWS_REGION = process.env.AWS_REGION || process.env.REGION;

const CURRENCY = "NGN";

/* ==========================================================
   APPSYNC GRAPHQL REQUEST
========================================================== */

/*
 * Sends a GraphQL request signed with the Lambda's temporary
 * IAM credentials. Never hardcode AWS credentials.
 */
const graphqlRequest = async (query, variables = {}) => {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error(
      "Missing API_ATUA_GRAPHQLAPIENDPOINTOUTPUT environment variable.",
    );
  }

  if (!AWS_REGION) {
    throw new Error("Missing AWS_REGION/REGION.");
  }

  const endpoint = new URL(GRAPHQL_ENDPOINT);

  const body = JSON.stringify({
    query,
    variables,
  });

  const headers = {
    "Content-Type": "application/json",
  };

  const credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  };

  const signedRequest = aws4.sign(
    {
      host: endpoint.host,
      path: endpoint.pathname + endpoint.search,
      service: "appsync",
      region: AWS_REGION,
      method: "POST",
      headers,
      body,
    },
    credentials,
  );

  const response = await new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: endpoint.hostname,
        port: endpoint.port || 443,
        path: endpoint.pathname + endpoint.search,
        method: "POST",
        headers: signedRequest.headers,
      },
      (res) => {
        let responseText = "";

        res.setEncoding("utf8");

        res.on("data", (chunk) => {
          responseText += chunk;
        });

        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            body: responseText,
          });
        });
      },
    );

    request.on("error", reject);

    request.setTimeout(20000, () => {
      request.destroy(new Error("AppSync request timed out."));
    });

    request.write(body);
    request.end();
  });

  let parsed;

  try {
    parsed = JSON.parse(response.body);
  } catch {
    throw new Error(
      "AppSync returned a non-JSON response: " + response.body.slice(0, 300),
    );
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(
      "AppSync HTTP " +
        response.statusCode +
        ": " +
        JSON.stringify(parsed.errors || parsed),
    );
  }

  if (parsed.errors && parsed.errors.length > 0) {
    throw new Error(
      "AppSync GraphQL error: " +
        parsed.errors.map((item) => item.message).join("; "),
    );
  }

  return parsed.data;
};

/* ==========================================================
   GRAPHQL OPERATIONS
========================================================== */

/*
 * Load authoritative reconciliation values from AppSync.
 */
const GET_RECONCILIATION = `
  query GetCourierReconciliation($id: ID!) {
    getCourierReconciliation(id: $id) {
      id
      courierID
      reconciliationReference
      netAmount
      direction
      status
      walletDebtRecovered
      remainingDebt
      approvedAt
      settledAt
      settlementReference
      notes
      _deleted
    }
  }
`;

/*
 * Find the courier's wallet.
 *
 * This assumes:
 *   Wallet.ownerID = Courier.id
 *   Wallet.ownerType = COURIER
 *
 * Confirm your stored wallet ownership convention before
 * using this function against live wallets.
 */
const LIST_WALLETS = `
  query ListWallets(
    $filter: ModelWalletFilterInput
    $limit: Int
  ) {
    listWallets(filter: $filter, limit: $limit) {
      items {
        id
        ownerID
        ownerType
        availableBalance
        outstandingDebt
        _version
      }
    }
  }
`;

/*
 * Update the reconciliation.
 *
 * The condition input is used when claiming the record and
 * must match the generated AppSync schema for your API.
 */
const UPDATE_RECONCILIATION = `
  mutation UpdateCourierReconciliation(
    $input: UpdateCourierReconciliationInput!
    $condition: ModelCourierReconciliationConditionInput
  ) {
    updateCourierReconciliation(
      input: $input
      condition: $condition
    ) {
      id
      courierID
      reconciliationReference
      netAmount
      direction
      status
      walletDebtRecovered
      remainingDebt
      approvedAt
      settledAt
      settlementReference
      notes
    }
  }
`;

/*
 * Update wallet balances.
 *
 * The condition protects against updating the wallet if its
 * balances have changed since they were read.
 */
const UPDATE_WALLET = `
  mutation UpdateWallet(
    $input: UpdateWalletInput!
    $condition: ModelWalletConditionInput
  ) {
    updateWallet(
      input: $input
      condition: $condition
    ) {
      id
      ownerID
      ownerType
      availableBalance
      outstandingDebt
      _version
    }
  }
`;

/*
 * Find an existing ledger entry for this settlement.
 *
 * This is an additional duplicate check, not a substitute
 * for a database-level unique constraint or transaction.
 */
const LIST_TRANSACTIONS_BY_REFERENCE = `
  query ListTransactionsByReference(
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
        reference
        status
      }
    }
  }
`;

/*
 * Create the debit transaction for recovered money.
 */
const CREATE_TRANSACTION = `
  mutation CreateTransaction(
    $input: CreateTransactionInput!
  ) {
    createTransaction(input: $input) {
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

/* ==========================================================
   HELPERS
========================================================== */

/*
 * Round monetary values to two decimal places.
 */
const roundMoney = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/*
 * Validate monetary values. This function rejects invalid
 * and negative amounts rather than silently accepting them.
 */
const toMoney = (value, fieldName) => {
  if (value === null || value === undefined || value === "") {
    throw new Error(fieldName + " is missing.");
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(fieldName + " is not a valid number.");
  }

  const rounded = roundMoney(number);

  if (rounded < 0) {
    throw new Error(fieldName + " cannot be negative.");
  }

  return rounded;
};

/*
 * Validate required string inputs.
 */
const requireNonEmptyString = (value, fieldName) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(fieldName + " is required.");
  }

  return value.trim();
};

/*
 * Load a reconciliation and reject missing/deleted records.
 */
const getReconciliation = async (reconciliationID) => {
  const data = await graphqlRequest(GET_RECONCILIATION, {
    id: reconciliationID,
  });

  const reconciliation = data?.getCourierReconciliation;

  if (!reconciliation || reconciliation._deleted) {
    throw new Error("Courier reconciliation was not found.");
  }

  return reconciliation;
};

/*
 * Find exactly one wallet owned by the specified courier.
 *
 * Stop if no wallet or multiple wallets match. Guessing which
 * wallet to modify could affect the wrong financial record.
 */
const getCourierWallet = async (courierID) => {
  const data = await graphqlRequest(LIST_WALLETS, {
    filter: {
      ownerID: {
        eq: courierID,
      },
    },
    limit: 100,
  });

  const items = data?.listWallets?.items || [];

  const wallets = items.filter(
    (wallet) =>
      wallet && wallet.ownerID === courierID && wallet.ownerType === "COURIER",
  );

  if (wallets.length === 0) {
    throw new Error(
      "No COURIER wallet was found for courierID " +
        courierID +
        ". Check Wallet.ownerID and Wallet.ownerType.",
    );
  }

  if (wallets.length > 1) {
    throw new Error(
      "Multiple courier wallets were found. " +
        "Settlement stopped to avoid changing the wrong wallet.",
    );
  }

  return wallets[0];
};

/*
 * Update a reconciliation and ensure AppSync returned it.
 */
const updateReconciliation = async (input, condition = null) => {
  const data = await graphqlRequest(UPDATE_RECONCILIATION, {
    input,
    condition,
  });

  if (!data?.updateCourierReconciliation) {
    throw new Error("AppSync did not return the updated reconciliation.");
  }

  return data.updateCourierReconciliation;
};

/*
 * Update a wallet with a condition matching the balances
 * read earlier. This reduces the risk of overwriting a newer
 * balance with a stale calculation.
 */
const updateWallet = async (input, condition) => {
  const data = await graphqlRequest(UPDATE_WALLET, {
    input,
    condition,
  });

  if (!data?.updateWallet) {
    throw new Error(
      "AppSync did not return the updated Wallet. " +
        "Check whether the conditional update failed.",
    );
  }

  return data.updateWallet;
};

/*
 * Look for a transaction with this settlement reference.
 */
const findSettlementTransaction = async (reference) => {
  const data = await graphqlRequest(LIST_TRANSACTIONS_BY_REFERENCE, {
    filter: {
      reference: {
        eq: reference,
      },
    },
    limit: 10,
  });

  const transactions = data?.listTransactions?.items || [];

  return (
    transactions.find(
      (transaction) => transaction && transaction.reference === reference,
    ) || null
  );
};

/*
 * Create a completed debit transaction and confirm AppSync
 * returned the created record.
 */
const createSettlementTransaction = async (input) => {
  const data = await graphqlRequest(CREATE_TRANSACTION, {
    input,
  });

  if (!data?.createTransaction) {
    throw new Error(
      "AppSync did not return the created settlement Transaction.",
    );
  }

  return data.createTransaction;
};

/* ==========================================================
   MAIN SETTLEMENT FUNCTION
========================================================== */

const settleCourierBalance = async ({ reconciliationID }) => {
  reconciliationID = requireNonEmptyString(
    reconciliationID,
    "reconciliationID",
  );

  /*
   * STEP 1
   * Load the authoritative reconciliation.
   */
  const reconciliation = await getReconciliation(reconciliationID);

  /*
   * If already SETTLED, do not touch the wallet again.
   */
  if (reconciliation.status === "SETTLED") {
    return {
      success: true,
      alreadySettled: true,
      message: "This reconciliation has already been settled.",
      currency: CURRENCY,
      reconciliation,
    };
  }

  /*
   * Only APPROVED reconciliations can be processed.
   */
  if (reconciliation.status !== "APPROVED") {
    throw new Error(
      "Only an APPROVED reconciliation can be settled. " +
        "Current status: " +
        reconciliation.status,
    );
  }

  /*
   * A settlement reference on a non-SETTLED reconciliation
   * means an earlier invocation may have started processing.
   *
   * Stop instead of repeating a possibly completed wallet
   * movement. Investigate the records before recovery.
   */
  if (reconciliation.settlementReference) {
    throw new Error(
      "This reconciliation already has a settlementReference " +
        "but is not marked SETTLED. A previous attempt may have " +
        "failed part-way through. Automatic retry is blocked. " +
        "Reference: " +
        reconciliation.settlementReference,
    );
  }

  const courierID = requireNonEmptyString(
    reconciliation.courierID,
    "reconciliation.courierID",
  );

  const direction = reconciliation.direction;

  const netAmount = toMoney(
    reconciliation.netAmount,
    "reconciliation.netAmount",
  );

  /*
   * STEP 2
   * Validate direction.
   *
   * A payout to a courier must go through processPayouts.
   */
  if (direction === "ATUA_OWES_COURIER") {
    throw new Error(
      "This reconciliation says ATUA_OWES_COURIER. " +
        "Use the courier payout workflow; this Lambda does " +
        "not transfer money to couriers.",
    );
  }

  if (direction !== "COURIER_OWES_ATUA" && direction !== "BALANCED") {
    throw new Error("Unsupported reconciliation direction: " + direction);
  }

  /*
   * A BALANCED reconciliation must not contain a non-zero
   * net amount. Reject inconsistent financial records.
   */
  if (direction === "BALANCED" && netAmount !== 0) {
    throw new Error(
      "Reconciliation is marked BALANCED but netAmount is not zero. " +
        "Correct the reconciliation before settling it.",
    );
  }

  /*
   * A courier debt reconciliation should have a positive
   * amount to recover. A zero debt can be settled with no
   * wallet movement.
   */
  if (direction === "COURIER_OWES_ATUA" && netAmount < 0) {
    throw new Error("COURIER_OWES_ATUA cannot have a negative netAmount.");
  }

  /*
   * One deterministic reference per reconciliation.
   * Retries must never create a different reference.
   */
  const settlementReference = "SETTLE-" + reconciliation.id;

  const claimTime = new Date().toISOString();

  /*
   * STEP 3
   * CLAIM THE RECONCILIATION.
   *
   * The condition means the record must still be APPROVED
   * and must not yet have a settlement reference.
   *
   * If another invocation claimed it first, this mutation
   * should fail and this invocation must stop.
   *
   * Confirm ModelCourierReconciliationConditionInput and
   * attributeExists are supported by your generated schema.
   * Do not remove this condition merely to suppress errors.
   */
  await updateReconciliation(
    {
      id: reconciliation.id,
      settlementReference,
      notes:
        (reconciliation.notes || "") +
        " Settlement processing started at " +
        claimTime +
        ". Reference: " +
        settlementReference +
        ".",
    },
    {
      status: {
        eq: "APPROVED",
      },
      settlementReference: {
        attributeExists: false,
      },
    },
  );

  /*
   * STEP 4
   * A BALANCED reconciliation has no money to recover.
   *
   * Mark it SETTLED without changing a wallet.
   */
  if (direction === "BALANCED") {
    const settledAt = new Date().toISOString();

    const finalReconciliation = await updateReconciliation({
      id: reconciliation.id,
      status: "SETTLED",
      walletDebtRecovered: 0,
      remainingDebt: 0,
      settlementReference,
      settledAt,
      notes:
        (reconciliation.notes || "") +
        " Balanced reconciliation settled with no wallet " +
        "movement. Reference: " +
        settlementReference +
        ".",
    });

    return {
      success: true,
      alreadySettled: false,
      currency: CURRENCY,
      message:
        "Balanced reconciliation settled. No wallet balance was changed.",
      settlementReference,
      courierID,
      reconciliationID: reconciliation.id,
      walletDebtRecovered: 0,
      remainingDebt: 0,
      reconciliation: finalReconciliation,
    };
  }

  /*
   * STEP 5
   * Load the courier's wallet.
   */
  const wallet = await getCourierWallet(courierID);

  const availableBalance = toMoney(
    wallet.availableBalance ?? 0,
    "wallet.availableBalance",
  );

  const existingOutstandingDebt = toMoney(
    wallet.outstandingDebt ?? 0,
    "wallet.outstandingDebt",
  );

  /*
   * Recover no more than the lesser of:
   *   - the debt owed under this reconciliation; and
   *   - the wallet's currently available balance.
   *
   * Example:
   *   Reconciliation debt = ₦4,000
   *   Available balance  = ₦1,200
   *
   *   Recovered           = ₦1,200
   *   New remaining debt  = ₦2,800
   *   New available       = ₦0
   */
  const walletDebtRecovered = roundMoney(Math.min(availableBalance, netAmount));

  const remainingDebt = roundMoney(netAmount - walletDebtRecovered);

  const newAvailableBalance = roundMoney(
    availableBalance - walletDebtRecovered,
  );

  /*
   * Preserve existing debt and add this reconciliation's
   * unrecovered amount to it.
   */
  const newOutstandingDebt = roundMoney(
    existingOutstandingDebt + remainingDebt,
  );

  /*
   * Final safety checks before modifying the wallet.
   */
  if (
    newAvailableBalance < 0 ||
    remainingDebt < 0 ||
    newOutstandingDebt < existingOutstandingDebt
  ) {
    throw new Error(
      "Settlement safety validation failed. Wallet was not updated.",
    );
  }

  /*
   * STEP 6
   * Check for an existing transaction with this reference.
   *
   * Since the claim was just made, an existing transaction
   * indicates a prior or inconsistent attempt. Stop rather
   * than deducting funds again.
   */
  if (walletDebtRecovered > 0) {
    const existingTransaction =
      await findSettlementTransaction(settlementReference);

    if (existingTransaction) {
      throw new Error(
        "A Transaction already exists for this settlement reference, " +
          "but the reconciliation is not SETTLED. Stop and inspect " +
          "the Wallet and Transaction before recovery. Transaction ID: " +
          existingTransaction.id,
      );
    }
  }

  /*
   * STEP 7
   * Update the wallet using a conditional balance check.
   *
   * This prevents the update from proceeding if the balance
   * changed between reading the wallet and updating it.
   *
   * Do not update pendingBalance or lifetimeEarnings here.
   *
   * If your API uses AppSync conflict detection/versioning,
   * you may additionally include _version in the mutation
   * input, using the version returned by LIST_WALLETS.
   */
  const walletCondition = {
    availableBalance: {
      eq: wallet.availableBalance ?? 0,
    },
    outstandingDebt: {
      eq: wallet.outstandingDebt ?? 0,
    },
  };

  await updateWallet(
    {
      id: wallet.id,
      availableBalance: newAvailableBalance,
      outstandingDebt: newOutstandingDebt,
    },
    walletCondition,
  );

  /*
   * IMPORTANT RECOVERY BOUNDARY
   *
   * The wallet has now been changed.
   *
   * If the next operation fails, do not simply invoke this
   * Lambda again. The reconciliation claim will block a
   * normal retry, and the records must be inspected first.
   *
   * A database-wide atomic transaction is required to remove
   * this cross-model partial-failure window entirely.
   */

  /*
   * STEP 8
   * Create a DEBIT Transaction for the amount actually
   * recovered from the available wallet balance.
   *
   * Do not create a zero-value transaction.
   */
  let transaction = null;

  if (walletDebtRecovered > 0) {
    transaction = await createSettlementTransaction({
      walletID: wallet.id,
      type: "DEBIT",
      amount: walletDebtRecovered,
      description:
        "Courier debt recovered during reconciliation " +
        reconciliation.reconciliationReference +
        ". Reconciliation ID: " +
        reconciliation.id +
        ".",
      reference: settlementReference,
      status: "COMPLETED",
    });
  }

  /*
   * STEP 9
   * Finalize the reconciliation after the wallet and ledger
   * operations have returned successfully.
   *
   * SETTLED means the reconciliation process was applied.
   * It does not mean any remaining debt was paid through
   * Paystack, nor that a courier payout occurred.
   */
  const settledAt = new Date().toISOString();

  const finalNotes =
    (reconciliation.notes || "") +
    " Settlement processing completed at " +
    settledAt +
    ". Reference: " +
    settlementReference +
    ". Wallet debt recovered: " +
    walletDebtRecovered +
    " " +
    CURRENCY +
    ". Remaining debt from this reconciliation: " +
    remainingDebt +
    " " +
    CURRENCY +
    ".";

  const finalReconciliation = await updateReconciliation({
    id: reconciliation.id,
    status: "SETTLED",
    walletDebtRecovered,
    remainingDebt,
    settlementReference,
    settledAt,
    notes: finalNotes,
  });

  /*
   * STEP 10
   * Return an audit-friendly result.
   */
  return {
    success: true,
    alreadySettled: false,
    currency: CURRENCY,
    message:
      remainingDebt > 0
        ? "Settlement applied. Some debt remains outstanding."
        : "Settlement applied. The reconciliation debt was fully recovered.",
    settlementReference,
    courierID,
    walletID: wallet.id,
    reconciliationID: reconciliation.id,
    reconciliationReference: reconciliation.reconciliationReference,
    walletDebtRecovered,
    remainingDebt,
    transactionID: transaction?.id || null,
    wallet: {
      availableBalance: newAvailableBalance,
      outstandingDebt: newOutstandingDebt,
    },
    reconciliation: finalReconciliation,
  };
};

/* ==========================================================
   LAMBDA HANDLER
========================================================== */

/*
 * Accepts:
 *
 * Direct Lambda test:
 *   { "reconciliationID": "YOUR_RECONCILIATION_ID" }
 *
 * AppSync Lambda resolver:
 *   { "arguments": { "reconciliationID": "..." } }
 *
 * HTTP-style invocation:
 *   { "body": "{\"reconciliationID\":\"...\"}" }
 */
exports.handler = async (event) => {
  console.log("settleCourierBalance invoked", {
    requestId: event?.requestContext?.requestId,
    hasArguments: Boolean(event?.arguments),
  });

  try {
    let payload = event || {};

    /*
     * Support HTTP events with a JSON request body.
     */
    if (typeof payload.body === "string") {
      try {
        payload = JSON.parse(payload.body);
      } catch {
        throw new Error("Request body must contain valid JSON.");
      }
    }

    /*
     * Support AppSync Lambda resolver events.
     */
    if (payload.arguments) {
      payload = payload.arguments;
    }

    const result = await settleCourierBalance({
      reconciliationID: payload.reconciliationID,
    });

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error(
      "settleCourierBalance failed:",
      error.stack || error.message || error,
    );

    /*
     * A failure does not necessarily mean that no financial
     * changes occurred. The caller should inspect the logs
     * and reconciliation records before retrying.
     */
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: error.message || "Settlement failed.",
        manualReviewMayBeRequired: true,
      }),
    };
  }
};
