/**
 * ============================================================
 * Atua - allocateCourierEarnings Lambda
 * ============================================================
 *
 * PURPOSE
 * -------
 * Allocates a courier's earnings from a PAID order into the
 * courier's PENDING wallet balance.
 *
 * IMPORTANT FLOW
 * --------------
 *
 * Paystack payment succeeds
 *        ↓
 * Paystack webhook
 *        ↓
 * Order.paymentStatus = PAID
 * Order.fundsStatus = HELD
 * earningsAllocationStatus = null
 *        ↓
 * Courier gets assigned
 *        ↓
 * allocateCourierEarnings
 *        ↓
 * null / empty / FAILED → PROCESSING
 *        ↓
 * Find existing wallet
 *        ↓
 * If no wallet exists → CREATE wallet
 *        ↓
 * Find/create earnings transaction
 *        ↓
 * Apply earnings to pendingBalance
 *        ↓
 * Mark transaction COMPLETED
 *        ↓
 * PROCESSING → ALLOCATED
 *
 * ============================================================
 *
 * IMPORTANT FINANCIAL RULE
 * ------------------------
 *
 * Courier earnings DO NOT immediately become available.
 *
 * First allocation:
 *
 *     availableBalance = unchanged
 *     pendingBalance   = pendingBalance + earnings
 *     lifetimeEarnings = lifetimeEarnings + earnings
 *
 * Later:
 *
 *     releaseFunds
 *     OR
 *     releaseCourierMilestoneFunds
 *
 * moves the money from pendingBalance to availableBalance.
 *
 * ============================================================
 *
 * IDEMPOTENCY / RETRY RULE
 * ------------------------
 *
 * The earnings transaction uses:
 *
 *     EARNINGS-${orderID}
 *
 * as its unique business reference.
 *
 * This allows a retry to recognize that the same order has
 * already created an earnings transaction.
 *
 * The Lambda must NEVER simply add the earnings again just
 * because the order is being retried.
 *
 * ============================================================
 */

const fetch = require("node-fetch");

// ============================================================
// ENVIRONMENT VARIABLES
// ============================================================

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const GRAPHQL_API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

// ============================================================
// BASIC VALIDATION
// ============================================================

if (!GRAPHQL_ENDPOINT) {
  console.warn("WARNING: API_ATUA_GRAPHQLAPIENDPOINTOUTPUT is not configured.");
}

if (!GRAPHQL_API_KEY) {
  console.warn("WARNING: API_ATUA_GRAPHQLAPIKEYOUTPUT is not configured.");
}

// ============================================================
// GRAPHQL HELPER
// ============================================================

async function graphqlRequest(query, variables = {}) {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error("GraphQL endpoint is not configured.");
  }

  if (!GRAPHQL_API_KEY) {
    throw new Error("GraphQL API key is not configured.");
  }

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "x-api-key": GRAPHQL_API_KEY,
    },

    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const responseText = await response.text();

  let data;

  try {
    data = JSON.parse(responseText);
  } catch (error) {
    throw new Error(
      `GraphQL returned a non-JSON response. HTTP ${response.status}: ${responseText}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `GraphQL HTTP error ${response.status}: ${
        data?.errors ? JSON.stringify(data.errors) : responseText
      }`,
    );
  }

  if (data.errors && data.errors.length > 0) {
    throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
  }

  return data.data;
}

// ============================================================
// RESPONSE HELPERS
// ============================================================

function successResponse(body, message = null) {
  return {
    statusCode: 200,

    body: JSON.stringify({
      success: true,

      ...(message
        ? {
            message,
          }
        : {}),

      ...body,
    }),
  };
}

function errorResponse(error, extra = {}) {
  console.error("allocateCourierEarnings error:", error);

  return {
    statusCode: 500,

    body: JSON.stringify({
      success: false,

      message: error?.message || "Failed to allocate courier earnings.",

      ...extra,
    }),
  };
}

// ============================================================
// NORMALIZE MONEY
// ============================================================

function normalizeMoney(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Number(number.toFixed(2));
}

// ============================================================
// GET ORDER
// ============================================================

async function getOrder(orderID) {
  const query = `
    query GetOrder($id: ID!) {
      getOrder(id: $id) {
        id
        userID

        paymentStatus
        paymentID
        paymentReference

        status

        fundsStatus
        fundsReleaseBlocked
        fundsHoldReason
        fundsHeldBy
        fundsHeldAt

        payoutStatus

        earningsAllocationStatus
        earningsAllocatedAt

        assignedCourierId

        courierEarnings
        totalPrice
        operationalFare
        commissionAmount
        platformFee
        platformServiceRevenue
        vatAmount
        platformNetRevenue

        fundsReleasedAmount
        pickupFundsReleasedAt
        fundsReleasedAt
        fundsReleaseType

        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const data = await graphqlRequest(query, {
    id: orderID,
  });

  return data?.getOrder;
}

// ============================================================
// GET COURIER
// ============================================================

async function getCourier(courierID) {
  const query = `
    query GetCourier($id: ID!) {
      getCourier(id: $id) {
        id
        walletID

        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const data = await graphqlRequest(query, {
    id: courierID,
  });

  return data?.getCourier;
}

// ============================================================
// GET WALLET BY ID
// ============================================================
//
// IMPORTANT
// ---------
//
// DO NOT request:
//
//     transactions
//
// by itself.
//
// `transactions` is a ModelTransactionConnection.
//
// If requested, GraphQL requires a selection set.
//
// This Lambda does not need the transactions connection when
// retrieving a Wallet.
//
// ============================================================

async function getWalletByID(walletID) {
  if (!walletID) {
    return null;
  }

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
        _lastChangedAt
        _deleted
      }
    }
  `;

  const data = await graphqlRequest(query, {
    id: walletID,
  });

  return data?.getWallet;
}

// ============================================================
// GET WALLET BY OWNER
// ============================================================
//
// Finds the courier wallet using:
//
//     ownerID   = Courier.id
//     ownerType = COURIER
//
// IMPORTANT:
//
// There is deliberately NO:
//
//     transactions
//
// field in this query.
//
// ============================================================

async function getWalletByOwner(ownerID, ownerType) {
  if (!ownerID || !ownerType) {
    return null;
  }

  const query = `
    query ListWallets(
      $filter: ModelWalletFilterInput
      $limit: Int
    ) {
      listWallets(
        filter: $filter
        limit: $limit
      ) {
        items {
          id

          ownerID
          ownerType

          availableBalance
          pendingBalance
          lifetimeEarnings

          _version
          _lastChangedAt
          _deleted
        }
      }
    }
  `;

  const data = await graphqlRequest(query, {
    filter: {
      ownerID: {
        eq: ownerID,
      },

      ownerType: {
        eq: ownerType,
      },
    },

    limit: 10,
  });

  const wallets = data?.listWallets?.items || [];

  // Ignore deleted records.
  const activeWallet = wallets.find((item) => item && item._deleted !== true);

  return activeWallet || null;
}

// ============================================================
// CREATE COURIER WALLET
// ============================================================
//
// A courier does NOT need to have a Wallet before receiving
// their first earnings.
//
// The first allocation creates:
//
//     availableBalance = 0
//     pendingBalance   = 0
//     lifetimeEarnings = 0
//
// The actual earnings are added afterwards.
//
// ============================================================

async function createCourierWallet(courierID) {
  if (!courierID) {
    throw new Error("Cannot create courier wallet without courierID.");
  }

  const mutation = `
    mutation CreateWallet(
      $input: CreateWalletInput!
    ) {
      createWallet(input: $input) {
        id

        ownerID
        ownerType

        availableBalance
        pendingBalance
        lifetimeEarnings

        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const input = {
    ownerID: courierID,

    ownerType: "COURIER",

    availableBalance: 0,

    pendingBalance: 0,

    lifetimeEarnings: 0,
  };

  console.log(`Creating Wallet for courier ${courierID}.`);

  const data = await graphqlRequest(mutation, {
    input,
  });

  const wallet = data?.createWallet;

  if (!wallet) {
    throw new Error(
      `Wallet creation returned no Wallet for courier ${courierID}.`,
    );
  }

  console.log("Courier Wallet created:", JSON.stringify(wallet));

  return wallet;
}

// ============================================================
// UPDATE COURIER WALLET ID
// ============================================================
//
// Once the Wallet exists, save its ID to:
//
//     Courier.walletID
//
// This makes future allocations faster.
//
// `_version` is included when available for Amplify/DataStore
// optimistic concurrency.
//
// ============================================================

async function updateCourierWalletID(courier, walletID) {
  if (!courier) {
    throw new Error("Cannot update walletID because Courier is missing.");
  }

  if (!walletID) {
    throw new Error("Cannot update Courier.walletID without a walletID.");
  }

  // If the Courier already points to this exact Wallet,
  // there is nothing to update.
  if (courier.walletID === walletID) {
    return courier;
  }

  const input = {
    id: courier.id,

    walletID,
  };

  if (courier._version !== undefined && courier._version !== null) {
    input._version = courier._version;
  }

  const mutation = `
    mutation UpdateCourier(
      $input: UpdateCourierInput!
    ) {
      updateCourier(input: $input) {
        id
        walletID

        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  console.log(`Saving Wallet ${walletID} to Courier ${courier.id}.`);

  const data = await graphqlRequest(mutation, {
    input,
  });

  const updatedCourier = data?.updateCourier;

  if (!updatedCourier) {
    throw new Error(
      `Failed to save walletID ${walletID} to Courier ${courier.id}.`,
    );
  }

  console.log("Courier.walletID updated:", JSON.stringify(updatedCourier));

  return updatedCourier;
}

// ============================================================
// FIND OR CREATE COURIER WALLET
// ============================================================
//
// FLOW:
//
// 1. Courier.walletID exists
//       ↓
//    retrieve Wallet
//
// 2. If that fails
//       ↓
//    search Wallet by ownerID + ownerType
//
// 3. If found
//       ↓
//    repair Courier.walletID if necessary
//
// 4. If not found
//       ↓
//    create Wallet
//
// 5. Save new Wallet.id to Courier
//
// ============================================================

async function findCourierWallet(courier) {
  if (!courier) {
    throw new Error("Courier was not found.");
  }

  let wallet = null;

  let courierUpdated = false;

  let walletCreated = false;

  // ==========================================================
  // STEP 1
  // TRY COURIER.walletID
  // ==========================================================

  if (courier.walletID) {
    console.log(`Trying Courier.walletID: ${courier.walletID}`);

    wallet = await getWalletByID(courier.walletID);

    if (wallet && wallet._deleted !== true) {
      console.log(`Wallet found by Courier.walletID: ${wallet.id}`);

      return {
        wallet,

        courier,

        walletCreated: false,

        courierUpdated: false,
      };
    }

    console.warn(
      `Courier.walletID ${courier.walletID} did not return an active Wallet.`,
    );
  }

  // ==========================================================
  // STEP 2
  // FALLBACK OWNER LOOKUP
  // ==========================================================

  console.log(
    `Searching for Courier wallet by ownerID for courier ${courier.id}.`,
  );

  wallet = await getWalletByOwner(courier.id, "COURIER");

  // ==========================================================
  // EXISTING WALLET FOUND
  // ==========================================================

  if (wallet) {
    console.log(`Wallet found by owner lookup: ${wallet.id}`);

    // --------------------------------------------------------
    // Repair Courier.walletID if necessary.
    // --------------------------------------------------------

    if (courier.walletID !== wallet.id) {
      console.log(
        `Repairing Courier.walletID from ${
          courier.walletID || "null"
        } to ${wallet.id}.`,
      );

      const updatedCourier = await updateCourierWalletID(courier, wallet.id);

      courier = updatedCourier;

      courierUpdated = true;
    }

    return {
      wallet,

      courier,

      walletCreated: false,

      courierUpdated,
    };
  }

  // ==========================================================
  // STEP 3
  // NO WALLET EXISTS
  // ==========================================================
  //
  // This is normal for a courier receiving earnings for the
  // first time.
  //
  // ==========================================================

  console.log(
    `No Wallet exists for courier ${courier.id}. Creating first Wallet.`,
  );

  wallet = await createCourierWallet(courier.id);

  walletCreated = true;

  // ==========================================================
  // SAVE WALLET ID TO COURIER
  // ==========================================================

  const updatedCourier = await updateCourierWalletID(courier, wallet.id);

  courier = updatedCourier;

  courierUpdated = true;

  console.log(`First Wallet setup completed for courier ${courier.id}.`);

  return {
    wallet,

    courier,

    walletCreated,

    courierUpdated,
  };
}

// ============================================================
// UPDATE ORDER
// ============================================================
//
// This helper is used for:
//
//     PROCESSING
//     ALLOCATED
//     FAILED
//
// `_version` should normally be supplied in the input by the
// caller when updating a DataStore-enabled record.
//
// ============================================================

async function updateOrder(orderID, input, condition = undefined) {
  const mutation = `
    mutation UpdateOrder(
      $input: UpdateOrderInput!
      $condition: ModelOrderConditionInput
    ) {
      updateOrder(
        input: $input
        condition: $condition
      ) {
        id

        userID

        paymentStatus
        paymentID
        paymentReference

        status

        fundsStatus
        fundsReleaseBlocked
        fundsHoldReason
        fundsHeldBy
        fundsHeldAt

        payoutStatus

        earningsAllocationStatus
        earningsAllocatedAt

        assignedCourierId

        courierEarnings
        totalPrice
        operationalFare
        commissionAmount
        platformFee
        platformServiceRevenue
        vatAmount
        platformNetRevenue

        fundsReleasedAmount
        pickupFundsReleasedAt
        fundsReleasedAt
        fundsReleaseType

        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const variables = {
    input,
  };

  if (condition !== undefined) {
    variables.condition = condition;
  }

  const data = await graphqlRequest(mutation, variables);

  return data?.updateOrder;
}

// ============================================================
// CLAIM ALLOCATION
// ============================================================
//
// Allocation states:
//
//     null / undefined / ""
//     NOT_ALLOCATED
//     FAILED
//
//        ↓
//
//     PROCESSING
//
// IMPORTANT:
//
// The claim is performed using the Order `_version`.
//
// This prevents an old invocation from blindly overwriting a
// newer Order version.
//
// ============================================================

async function claimAllocation(order, previousStatus) {
  const input = {
    id: order.id,

    earningsAllocationStatus: "PROCESSING",
  };

  if (order._version !== undefined && order._version !== null) {
    input._version = order._version;
  }

  let condition;

  // ----------------------------------------------------------
  // NULL / UNDEFINED
  // ----------------------------------------------------------
  //
  // Do not use attributeExists here.
  //
  // Your previous deployment showed that this schema/update
  // path does not support using that operator for this field.
  //
  // `_version` is the concurrency protection.
  //
  // ----------------------------------------------------------

  if (previousStatus === null || previousStatus === undefined) {
    condition = undefined;
  }

  // ----------------------------------------------------------
  // EMPTY STRING
  // ----------------------------------------------------------
  else if (previousStatus === "") {
    condition = {
      earningsAllocationStatus: {
        eq: "",
      },
    };
  }

  // ----------------------------------------------------------
  // ANY EXPLICIT STATUS
  // ----------------------------------------------------------
  else {
    condition = {
      earningsAllocationStatus: {
        eq: previousStatus,
      },
    };
  }

  const variables = {
    input,
  };

  if (condition !== undefined) {
    variables.condition = condition;
  }

  const mutation = `
    mutation UpdateOrder(
      $input: UpdateOrderInput!
      $condition: ModelOrderConditionInput
    ) {
      updateOrder(
        input: $input
        condition: $condition
      ) {
        id

        earningsAllocationStatus
        earningsAllocatedAt

        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  try {
    const data = await graphqlRequest(mutation, variables);

    return data?.updateOrder || null;
  } catch (error) {
    console.error("Failed to claim earnings allocation:", error);

    return null;
  }
}

// ============================================================
// FINALIZE ALLOCATION
// ============================================================
//
// PROCESSING → ALLOCATED
//
// The condition prevents finalization of an Order that has
// moved to another state.
//
// ============================================================

async function finalizeAllocation(order) {
  const input = {
    id: order.id,

    earningsAllocationStatus: "ALLOCATED",

    earningsAllocatedAt: new Date().toISOString(),
  };

  if (order._version !== undefined && order._version !== null) {
    input._version = order._version;
  }

  const condition = {
    earningsAllocationStatus: {
      eq: "PROCESSING",
    },
  };

  return updateOrder(order.id, input, condition);
}

// ============================================================
// MARK ALLOCATION FAILED
// ============================================================

async function markAllocationFailed(order) {
  if (!order) {
    return null;
  }

  const input = {
    id: order.id,

    earningsAllocationStatus: "FAILED",
  };

  if (order._version !== undefined && order._version !== null) {
    input._version = order._version;
  }

  const condition = {
    earningsAllocationStatus: {
      eq: "PROCESSING",
    },
  };

  try {
    return await updateOrder(order.id, input, condition);
  } catch (error) {
    console.error("Failed to mark earnings allocation as FAILED:", error);

    return null;
  }
}

// ============================================================
// TRANSACTION REFERENCE
// ============================================================
//
// Every order has ONE earnings transaction:
//
//     EARNINGS-${orderID}
//
// This reference is the business-level idempotency key.
//
// ============================================================

function getEarningsReference(orderID) {
  return `EARNINGS-${orderID}`;
}

// ============================================================
// LIST EARNINGS TRANSACTION
// ============================================================

async function getEarningsTransaction(orderID) {
  const reference = getEarningsReference(orderID);

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
          _lastChangedAt
          _deleted
        }
      }
    }
  `;

  const data = await graphqlRequest(query, {
    filter: {
      reference: {
        eq: reference,
      },
    },

    limit: 10,
  });

  const transactions = data?.listTransactions?.items || [];

  const activeTransaction = transactions.find(
    (item) => item && item._deleted !== true,
  );

  return activeTransaction || null;
}

// ============================================================
// CREATE EARNINGS TRANSACTION
// ============================================================

async function createEarningsTransaction({
  walletID,
  orderID,
  paymentID,
  amount,
  reference,
}) {
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
        _lastChangedAt
        _deleted
      }
    }
  `;

  const input = {
    walletID,

    type: "CREDIT",

    amount,

    description: "Courier earnings allocated from paid order.",

    orderID,

    paymentID: paymentID || null,

    reference,

    status: "PENDING",
  };

  const data = await graphqlRequest(mutation, {
    input,
  });

  return data?.createTransaction;
}

// ============================================================
// UPDATE TRANSACTION
// ============================================================
//
// `_version` should be included in the input when the caller
// has the current transaction version.
//
// ============================================================

async function updateTransaction(transactionID, input, condition = undefined) {
  const mutation = `
    mutation UpdateTransaction(
      $input: UpdateTransactionInput!
      $condition: ModelTransactionConditionInput
    ) {
      updateTransaction(
        input: $input
        condition: $condition
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
        _lastChangedAt
        _deleted
      }
    }
  `;

  const variables = {
    input: {
      id: transactionID,

      ...input,
    },
  };

  if (condition !== undefined) {
    variables.condition = condition;
  }

  const data = await graphqlRequest(mutation, variables);

  return data?.updateTransaction || null;
}

// ============================================================
// MARK TRANSACTION FAILED
// ============================================================
//
// This is only used when the transaction has been created but
// the allocation cannot be completed.
//
// IMPORTANT:
//
// Part 2 will make FAILED transactions recoverable for the
// same order rather than permanently blocking the allocation.
//
// ============================================================

async function markTransactionFailed(transaction) {
  if (!transaction) {
    return null;
  }

  try {
    const input = {
      status: "FAILED",
    };

    if (transaction._version !== undefined && transaction._version !== null) {
      input._version = transaction._version;
    }

    return await updateTransaction(transaction.id, input);
  } catch (error) {
    console.error("Failed to mark transaction FAILED:", error);

    return null;
  }
}

// ============================================================
// UPDATE WALLET
// ============================================================
//
// IMPORTANT:
//
// availableBalance stays unchanged.
//
// pendingBalance increases.
//
// lifetimeEarnings increases.
//
// ============================================================

async function updateWallet(
  wallet,
  availableBalance,
  pendingBalance,
  lifetimeEarnings,
) {
  const input = {
    id: wallet.id,

    availableBalance: normalizeMoney(availableBalance),

    pendingBalance: normalizeMoney(pendingBalance),

    lifetimeEarnings: normalizeMoney(lifetimeEarnings),
  };

  if (wallet._version !== undefined && wallet._version !== null) {
    input._version = wallet._version;
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
        _lastChangedAt
        _deleted
      }
    }
  `;

  const data = await graphqlRequest(mutation, {
    input,
  });

  return data?.updateWallet || null;
}

// ============================================================
// GET TRANSACTION BY ID
// ============================================================
//
// Used when a previous operation may already have modified
// the transaction and we need the latest version/status.
//
// ============================================================

async function getTransaction(transactionID) {
  if (!transactionID) {
    return null;
  }

  const query = `
    query GetTransaction(
      $id: ID!
    ) {
      getTransaction(
        id: $id
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
        _lastChangedAt
        _deleted
      }
    }
  `;

  const data = await graphqlRequest(query, {
    id: transactionID,
  });

  return data?.getTransaction || null;
}

// ============================================================
// CHECK WHETHER TRANSACTION IS ALREADY COMPLETED
// ============================================================
//
// This helper is intentionally separate.
//
// If a previous invocation successfully completed the wallet
// allocation and marked the transaction COMPLETED, a retry must
// NOT add the same earnings to the wallet again.
//
// ============================================================

async function isEarningsTransactionCompleted(orderID) {
  const transaction = await getEarningsTransaction(orderID);

  if (!transaction) {
    return {
      completed: false,

      transaction: null,
    };
  }

  return {
    completed: transaction.status === "COMPLETED",

    transaction,
  };
}

// ============================================================
// END OF PART 1
// ============================================================
//
// PART 2 CONTINUES WITH:
//
//     MAIN HANDLER
//
// INCLUDING THE IMPORTANT RETRY-SAFE FLOW:
//
//     get order
//       ↓
//     claim allocation
//       ↓
//     find/create wallet
//       ↓
//     find/create earnings transaction
//       ↓
//     detect already-completed transaction
//       ↓
//     update wallet ONLY when necessary
//       ↓
//     mark transaction COMPLETED
//       ↓
//     finalize order ALLOCATED
//
// ============================================================
// ============================================================
// MAIN HANDLER
// ============================================================

exports.handler = async (event) => {
  console.log("============================================================");

  console.log("allocateCourierEarnings invoked");

  console.log("Event:", JSON.stringify(event));

  console.log("============================================================");

  // ==========================================================
  // STATE VARIABLES
  // ==========================================================

  let order = null;

  let courier = null;

  let wallet = null;

  let transaction = null;

  let allocationClaimed = false;

  let walletWasCreated = false;

  let walletWasUpdated = false;

  let transactionWasCreated = false;

  let transactionWasCompleted = false;

  let orderWasFinalized = false;

  try {
    // ========================================================
    // GET ORDER ID
    // ========================================================

    const orderID =
      event?.orderID ||
      event?.arguments?.orderID ||
      event?.detail?.orderID ||
      event?.detail?.orderId;

    if (!orderID) {
      throw new Error("orderID is required.");
    }

    console.log(`Processing order: ${orderID}`);

    // ========================================================
    // GET ORDER
    // ========================================================

    order = await getOrder(orderID);

    if (!order) {
      throw new Error(`Order ${orderID} was not found.`);
    }

    console.log("Order retrieved:", JSON.stringify(order));

    // ========================================================
    // PAYMENT CHECK
    // ========================================================
    //
    // Earnings can only be allocated after payment succeeds.
    //
    // ========================================================

    if (order.paymentStatus !== "PAID") {
      console.log(
        `Order ${order.id} paymentStatus is ${order.paymentStatus}. Allocation skipped.`,
      );

      return successResponse({
        skipped: true,

        reason: "Order payment is not PAID.",

        orderID: order.id,
      });
    }

    // ========================================================
    // COURIER CHECK
    // ========================================================

    if (!order.assignedCourierId) {
      console.log(
        `Order ${order.id} has no assigned courier. Allocation skipped.`,
      );

      return successResponse({
        skipped: true,

        reason: "Order has no assigned courier.",

        orderID: order.id,
      });
    }

    // ========================================================
    // EARNINGS CHECK
    // ========================================================

    const earnings = normalizeMoney(order.courierEarnings);

    if (earnings <= 0) {
      throw new Error(
        `Courier earnings are invalid for order ${order.id}: ${order.courierEarnings}`,
      );
    }

    console.log(`Courier earnings: ${earnings}`);

    // ========================================================
    // CURRENT ALLOCATION STATUS
    // ========================================================

    const currentAllocationStatus = order.earningsAllocationStatus;

    console.log(
      `Current earningsAllocationStatus: ${currentAllocationStatus ?? "null"}`,
    );

    // ========================================================
    // ALREADY ALLOCATED
    // ========================================================
    //
    // If the Order already says ALLOCATED, there is nothing
    // left for this Lambda to do.
    //
    // ========================================================

    if (currentAllocationStatus === "ALLOCATED") {
      console.log(`Order ${order.id} is already ALLOCATED.`);

      return successResponse({
        skipped: true,

        reason: "Earnings already allocated.",

        orderID: order.id,
      });
    }

    // ========================================================
    // IMPORTANT RETRY CHECK
    // ========================================================
    //
    // Before claiming PROCESSING, check whether the earnings
    // transaction was already COMPLETED.
    //
    // This protects against the following situation:
    //
    //     Wallet updated
    //          ↓
    //     Transaction completed
    //          ↓
    //     Order finalization failed
    //          ↓
    //     Lambda runs again
    //
    // The retry must NOT add the earnings a second time.
    //
    // ========================================================

    const previousTransactionState = await isEarningsTransactionCompleted(
      order.id,
    );

    if (previousTransactionState.completed) {
      transaction = previousTransactionState.transaction;

      console.log(
        `Earnings transaction ${transaction.id} is already COMPLETED.`,
      );

      // ------------------------------------------------------
      // The financial allocation has already happened.
      //
      // We therefore DO NOT update the wallet again.
      // ------------------------------------------------------

      transactionWasCompleted = true;

      // ------------------------------------------------------
      // If the Order is not yet ALLOCATED, attempt to finalize
      // it now.
      // ------------------------------------------------------

      if (currentAllocationStatus !== "ALLOCATED") {
        console.log(
          `Transaction is already completed. Attempting to finalize Order ${order.id}.`,
        );

        // ----------------------------------------------------
        // If Order is not PROCESSING, claim it first.
        // ----------------------------------------------------

        if (currentAllocationStatus !== "PROCESSING") {
          const claimedOrder = await claimAllocation(
            order,
            currentAllocationStatus,
          );

          if (!claimedOrder) {
            throw new Error(
              `Earnings transaction is already COMPLETED, but Order ${order.id} could not be claimed for finalization.`,
            );
          }

          allocationClaimed = true;

          order = {
            ...order,
            ...claimedOrder,
          };
        }

        // ----------------------------------------------------
        // Finalize the already-completed allocation.
        // ----------------------------------------------------

        const finalizedOrder = await finalizeAllocation(order);

        if (!finalizedOrder) {
          throw new Error(
            `Earnings transaction ${transaction.id} is already COMPLETED, but Order ${order.id} could not be finalized.`,
          );
        }

        order = finalizedOrder;

        orderWasFinalized = true;
      }

      // ------------------------------------------------------
      // Return without touching the wallet.
      // ------------------------------------------------------

      return successResponse(
        {
          orderID: order.id,

          courierID: order.assignedCourierId,

          walletID: transaction.walletID,

          transactionID: transaction.id,

          amount: earnings,

          transactionStatus: transaction.status,

          earningsAllocationStatus: order.earningsAllocationStatus,

          alreadyAllocated: true,
        },

        "Courier earnings had already been allocated. No duplicate wallet credit was made.",
      );
    }

    // ========================================================
    // ALREADY PROCESSING
    // ========================================================
    //
    // If another invocation currently owns PROCESSING, do not
    // blindly perform another allocation.
    //
    // ========================================================

    if (currentAllocationStatus === "PROCESSING") {
      console.log(`Order ${order.id} is already PROCESSING.`);

      return successResponse({
        skipped: true,

        reason: "Earnings allocation is already processing.",

        orderID: order.id,
      });
    }

    // ========================================================
    // CLAIM ALLOCATION
    // ========================================================
    //
    // Possible previous states:
    //
    //     null
    //     undefined
    //     ""
    //     NOT_ALLOCATED
    //     FAILED
    //
    // All of these can be claimed again.
    //
    // ========================================================

    console.log(
      `Claiming allocation for order ${order.id}: ${
        currentAllocationStatus ?? "null"
      } -> PROCESSING`,
    );

    const claimedOrder = await claimAllocation(order, currentAllocationStatus);

    if (!claimedOrder) {
      throw new Error(
        `Could not claim earnings allocation for order ${order.id}. Another invocation may have claimed it first.`,
      );
    }

    // --------------------------------------------------------
    // IMPORTANT:
    //
    // Only mark allocationClaimed AFTER the conditional
    // mutation succeeds.
    // --------------------------------------------------------

    allocationClaimed = true;

    order = {
      ...order,
      ...claimedOrder,
    };

    console.log("Allocation claimed successfully. Order is now PROCESSING.");

    // ========================================================
    // GET COURIER
    // ========================================================

    courier = await getCourier(order.assignedCourierId);

    if (!courier) {
      throw new Error(`Courier ${order.assignedCourierId} was not found.`);
    }

    console.log("Courier retrieved:", JSON.stringify(courier));

    // ========================================================
    // FIND OR CREATE WALLET
    // ========================================================
    //
    // This handles:
    //
    //     existing Courier.walletID
    //     existing Wallet by owner
    //     first-time Wallet creation
    //
    // ========================================================

    const walletResult = await findCourierWallet(courier);

    wallet = walletResult.wallet;

    courier = walletResult.courier;

    walletWasCreated = walletResult.walletCreated;

    console.log(
      "Wallet resolution result:",
      JSON.stringify({
        walletID: wallet?.id || null,

        walletCreated: walletWasCreated,

        courierWalletID: courier?.walletID || null,

        courierUpdated: walletResult.courierUpdated,
      }),
    );

    if (!wallet) {
      throw new Error(
        `Wallet was not found or created for courier ${courier.id}.`,
      );
    }

    // ========================================================
    // VALIDATE WALLET OWNER
    // ========================================================

    if (wallet.ownerID !== courier.id) {
      throw new Error(
        `Wallet ${wallet.id} does not belong to courier ${courier.id}.`,
      );
    }

    if (wallet.ownerType !== "COURIER") {
      throw new Error(
        `Wallet ${wallet.id} has ownerType ${wallet.ownerType}, expected COURIER.`,
      );
    }

    // ========================================================
    // READ CURRENT WALLET BALANCES
    // ========================================================

    const currentAvailable = normalizeMoney(wallet.availableBalance);

    const currentPending = normalizeMoney(wallet.pendingBalance);

    const currentLifetime = normalizeMoney(wallet.lifetimeEarnings);

    console.log("Current wallet balances:", {
      availableBalance: currentAvailable,

      pendingBalance: currentPending,

      lifetimeEarnings: currentLifetime,
    });

    // ========================================================
    // FIND EXISTING EARNINGS TRANSACTION
    // ========================================================
    //
    // Reference:
    //
    //     EARNINGS-${orderID}
    //
    // ========================================================

    transaction = await getEarningsTransaction(order.id);

    // ========================================================
    // EXISTING TRANSACTION
    // ========================================================

    if (transaction) {
      console.log(
        "Existing earnings transaction found:",
        JSON.stringify(transaction),
      );

      // ------------------------------------------------------
      // WALLET MUST MATCH
      // ------------------------------------------------------

      if (transaction.walletID !== wallet.id) {
        throw new Error(
          `Existing earnings transaction ${transaction.id} belongs to wallet ${transaction.walletID}, expected ${wallet.id}.`,
        );
      }

      // ------------------------------------------------------
      // TYPE MUST BE CREDIT
      // ------------------------------------------------------

      if (transaction.type !== "CREDIT") {
        throw new Error(
          `Existing earnings transaction ${transaction.id} has type ${transaction.type}, expected CREDIT.`,
        );
      }

      // ------------------------------------------------------
      // AMOUNT MUST MATCH
      // ------------------------------------------------------

      const transactionAmount = normalizeMoney(transaction.amount);

      if (transactionAmount !== earnings) {
        throw new Error(
          `Existing earnings transaction ${transaction.id} has amount ${transactionAmount}, expected ${earnings}.`,
        );
      }

      // ------------------------------------------------------
      // COMPLETED
      // ------------------------------------------------------
      //
      // This should normally have been caught by the earlier
      // isEarningsTransactionCompleted() check.
      //
      // We keep this second protection here.
      //
      // ------------------------------------------------------

      if (transaction.status === "COMPLETED") {
        console.log(
          `Transaction ${transaction.id} is already COMPLETED. Wallet will not be credited again.`,
        );

        transactionWasCompleted = true;

        // ----------------------------------------------------
        // Finalize Order if necessary.
        // ----------------------------------------------------

        if (order.earningsAllocationStatus !== "PROCESSING") {
          const reClaimedOrder = await claimAllocation(
            order,
            order.earningsAllocationStatus,
          );

          if (!reClaimedOrder) {
            throw new Error(
              `Transaction ${transaction.id} is COMPLETED but Order ${order.id} could not be claimed for finalization.`,
            );
          }

          order = {
            ...order,
            ...reClaimedOrder,
          };
        }

        const finalizedOrder = await finalizeAllocation(order);

        if (!finalizedOrder) {
          throw new Error(
            `Transaction ${transaction.id} is COMPLETED but Order ${order.id} could not be finalized.`,
          );
        }

        order = finalizedOrder;

        orderWasFinalized = true;

        return successResponse(
          {
            orderID: order.id,

            courierID: order.assignedCourierId,

            walletID: wallet.id,

            transactionID: transaction.id,

            amount: earnings,

            availableBalance: wallet.availableBalance,

            pendingBalance: wallet.pendingBalance,

            lifetimeEarnings: wallet.lifetimeEarnings,

            walletCreated: walletWasCreated,

            earningsAllocationStatus: order.earningsAllocationStatus,

            alreadyAllocated: true,
          },

          "Courier earnings were already allocated. No duplicate wallet credit was made.",
        );
      }

      // ------------------------------------------------------
      // FAILED
      // ------------------------------------------------------
      //
      // IMPORTANT CHANGE:
      //
      // A FAILED transaction for THIS SAME ORDER is recoverable.
      //
      // We do not create another EARNINGS-${orderID}
      // transaction.
      //
      // Instead, we reset it to PENDING.
      //
      // ------------------------------------------------------

      if (transaction.status === "FAILED") {
        console.log(
          `Recovering FAILED earnings transaction ${transaction.id}.`,
        );

        const resetInput = {
          status: "PENDING",
        };

        if (
          transaction._version !== undefined &&
          transaction._version !== null
        ) {
          resetInput._version = transaction._version;
        }

        transaction = await updateTransaction(transaction.id, resetInput);

        if (!transaction) {
          throw new Error(
            `Failed to recover earnings transaction ${transaction.id}.`,
          );
        }

        console.log(
          "FAILED earnings transaction recovered:",
          JSON.stringify(transaction),
        );
      }

      // ------------------------------------------------------
      // PENDING
      // ------------------------------------------------------
      else if (transaction.status === "PENDING") {
        console.log(
          `Reusing existing PENDING earnings transaction ${transaction.id}.`,
        );
      }

      // ------------------------------------------------------
      // UNKNOWN STATUS
      // ------------------------------------------------------
      else {
        throw new Error(
          `Existing earnings transaction ${transaction.id} has unsupported status ${transaction.status}.`,
        );
      }
    }

    // ========================================================
    // CREATE TRANSACTION IF NONE EXISTS
    // ========================================================

    if (!transaction) {
      const transactionReference = getEarningsReference(order.id);

      console.log(`Creating earnings transaction ${transactionReference}.`);

      transaction = await createEarningsTransaction({
        walletID: wallet.id,

        orderID: order.id,

        paymentID: order.paymentID,

        amount: earnings,

        reference: transactionReference,
      });

      if (!transaction) {
        throw new Error("Failed to create earnings transaction.");
      }

      transactionWasCreated = true;

      console.log("Earnings transaction created:", JSON.stringify(transaction));
    }

    // ========================================================
    // FINAL TRANSACTION VALIDATION
    // ========================================================

    if (transaction.walletID !== wallet.id) {
      throw new Error(
        `Transaction ${transaction.id} wallet mismatch after transaction resolution.`,
      );
    }

    if (normalizeMoney(transaction.amount) !== earnings) {
      throw new Error(
        `Transaction ${transaction.id} amount mismatch after transaction resolution.`,
      );
    }

    if (transaction.status !== "PENDING") {
      throw new Error(
        `Transaction ${transaction.id} is not PENDING after transaction resolution. Current status: ${transaction.status}`,
      );
    }

    // ========================================================
    // CALCULATE NEW WALLET BALANCES
    // ========================================================
    //
    // IMPORTANT:
    //
    // availableBalance stays unchanged.
    //
    // pendingBalance increases by earnings.
    //
    // lifetimeEarnings increases by earnings.
    //
    // ========================================================

    const newAvailable = currentAvailable;

    const newPending = normalizeMoney(currentPending + earnings);

    const newLifetime = normalizeMoney(currentLifetime + earnings);

    console.log("Calculated wallet balances:", {
      availableBalance: newAvailable,

      pendingBalance: newPending,

      lifetimeEarnings: newLifetime,
    });

    // ========================================================
    // UPDATE WALLET
    // ========================================================
    //
    // At this point:
    //
    //     Transaction = PENDING
    //
    // We now apply the actual financial balance change.
    //
    // ========================================================

    console.log(`Updating wallet ${wallet.id}.`);

    const updatedWallet = await updateWallet(
      wallet,

      newAvailable,

      newPending,

      newLifetime,
    );

    if (!updatedWallet) {
      throw new Error("Wallet update returned no Wallet.");
    }

    walletWasUpdated = true;

    wallet = updatedWallet;

    console.log("Wallet updated successfully:", JSON.stringify(wallet));

    // ========================================================
    // MARK TRANSACTION COMPLETED
    // ========================================================
    //
    // This is extremely important for retry safety.
    //
    // Once this succeeds:
    //
    //     EARNINGS-${orderID}
    //
    // becomes the record that tells a future invocation:
    //
    //     "The wallet has already been credited."
    //
    // ========================================================

    console.log(`Marking earnings transaction ${transaction.id} COMPLETED.`);

    const completedTransactionInput = {
      status: "COMPLETED",
    };

    if (transaction._version !== undefined && transaction._version !== null) {
      completedTransactionInput._version = transaction._version;
    }

    const completedTransaction = await updateTransaction(
      transaction.id,
      completedTransactionInput,
    );

    if (!completedTransaction) {
      throw new Error(
        `Failed to mark earnings transaction ${transaction.id} as COMPLETED after wallet update.`,
      );
    }

    transaction = completedTransaction;

    transactionWasCompleted = true;

    console.log(
      "Earnings transaction marked COMPLETED:",
      JSON.stringify(transaction),
    );

    // ========================================================
    // FINALIZE ORDER
    // ========================================================
    //
    // PROCESSING → ALLOCATED
    //
    // At this point the financial allocation has already been
    // recorded in the Wallet and Transaction.
    //
    // ========================================================

    console.log(`Finalizing earnings allocation for order ${order.id}.`);

    const finalizedOrder = await finalizeAllocation(order);

    if (!finalizedOrder) {
      throw new Error(
        `Wallet and transaction were updated, but Order ${order.id} could not be finalized.`,
      );
    }

    order = finalizedOrder;

    orderWasFinalized = true;

    console.log("Order finalized successfully:", JSON.stringify(order));

    // ========================================================
    // SUCCESS
    // ========================================================

    console.log("============================================================");

    console.log(
      `Courier earnings successfully allocated for order ${order.id}.`,
    );

    console.log("============================================================");

    return successResponse(
      {
        orderID: order.id,

        courierID: order.assignedCourierId,

        walletID: wallet.id,

        transactionID: transaction.id,

        amount: earnings,

        availableBalance: wallet.availableBalance,

        pendingBalance: wallet.pendingBalance,

        lifetimeEarnings: wallet.lifetimeEarnings,

        walletCreated: walletWasCreated,

        transactionCreated: transactionWasCreated,

        transactionStatus: transaction.status,

        earningsAllocationStatus: order.earningsAllocationStatus,
      },

      "Courier earnings allocated successfully.",
    );
  } catch (error) {
    // ========================================================
    // ERROR LOGGING
    // ========================================================

    console.error(
      "============================================================",
    );

    console.error("allocateCourierEarnings FAILED");

    console.error(error);

    console.error(
      "============================================================",
    );

    // ========================================================
    // IMPORTANT PARTIAL-FAILURE RULE
    // ========================================================
    //
    // If the wallet was already updated, DO NOT try to mark
    // the allocation as FAILED.
    //
    // Why?
    //
    // Because the financial operation may already have happened.
    //
    // A retry must be allowed to inspect the transaction and
    // determine whether the wallet was already credited.
    //
    // ========================================================

    if (
      allocationClaimed &&
      order &&
      !walletWasUpdated &&
      !transactionWasCompleted &&
      !orderWasFinalized
    ) {
      console.log(
        `Attempting to mark order ${order.id} earnings allocation as FAILED.`,
      );

      await markAllocationFailed(order);
    }

    // ========================================================
    // TRANSACTION FAILURE
    // ========================================================
    //
    // Only mark the transaction FAILED when the wallet was NOT
    // updated.
    //
    // If the wallet was already updated, we do not want to
    // incorrectly mark the financial record FAILED.
    //
    // ========================================================

    if (
      transaction &&
      !walletWasUpdated &&
      !transactionWasCompleted &&
      !orderWasFinalized &&
      transaction.status === "PENDING"
    ) {
      console.log(
        `Attempting to mark transaction ${transaction.id} as FAILED.`,
      );

      await markTransactionFailed(transaction);
    }

    // ========================================================
    // RETURN ERROR
    // ========================================================

    return errorResponse(error, {
      orderID: order?.id || null,

      walletID: wallet?.id || null,

      transactionID: transaction?.id || null,

      walletWasCreated,

      walletWasUpdated,

      transactionWasCreated,

      transactionWasCompleted,

      orderWasFinalized,
    });
  }
};
