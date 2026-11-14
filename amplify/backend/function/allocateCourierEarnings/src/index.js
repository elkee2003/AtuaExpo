/**
 * ============================================================
 * ATUA — allocateCourierEarnings
 * ============================================================
 *
 * PURPOSE
 * -------
 * Allocate earnings from a confirmed PAYSTACK order to the
 * assigned courier's pending wallet balance.
 *
 * FINANCIAL RULES
 * ---------------
 * 1. Only PAYSTACK orders can be allocated.
 * 2. CASH, null and other payment methods are skipped.
 * 3. Order paymentStatus must be PAID.
 * 4. Order must have an assigned courier.
 * 5. courierEarnings must be greater than zero.
 * 6. Only pendingBalance is increased.
 * 7. availableBalance is not increased.
 * 8. lifetimeEarnings is not increased here.
 * 9. One earnings transaction per order:
 *       EARNINGS-{orderID}
 * 10. A possibly successful wallet update is never blindly
 *     repeated.
 *
 * REQUIRED ENVIRONMENT VARIABLES
 * -------------------------------
 * API_ATUA_GRAPHQLAPIENDPOINTOUTPUT
 * API_ATUA_GRAPHQLAPIKEYOUTPUT
 *
 * IMPORTANT
 * ---------
 * This Lambda performs multiple AppSync operations.
 * They are not one atomic transaction.
 *
 * AppSync optimistic concurrency must be configured and
 * verified for the _version safeguards to work.
 *
 * An uncertain wallet update leaves the transaction PENDING
 * and requires financial reconciliation.
 * ============================================================
 */

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const GRAPHQL_API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

const fetch = global.fetch || require("node-fetch");

const PAGE_SIZE = 100;

/* ============================================================
   RESPONSE HELPERS
   ============================================================ */

function successResponse(body = {}, message = null) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      ...(message ? { message } : {}),
      ...body,
    }),
  };
}

function errorResponse(error, extra = {}) {
  console.error("allocateCourierEarnings:", error);

  return {
    statusCode: 500,
    body: JSON.stringify({
      success: false,
      message: error?.message || "Failed to allocate courier earnings.",
      ...extra,
    }),
  };
}

/* ============================================================
   MONEY HELPERS
   ============================================================ */

function money(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`Invalid monetary value: ${value}`);
  }

  return Number(number.toFixed(2));
}

function sameMoney(a, b) {
  return money(a) === money(b);
}

function earningsReference(orderID) {
  return `EARNINGS-${orderID}`;
}

/* ============================================================
   GRAPHQL REQUEST
   ============================================================ */

async function graphqlRequest(query, variables = {}) {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error("Missing API_ATUA_GRAPHQLAPIENDPOINTOUTPUT.");
  }

  if (!GRAPHQL_API_KEY) {
    throw new Error("Missing API_ATUA_GRAPHQLAPIKEYOUTPUT.");
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

  let result;

  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(`AppSync returned invalid JSON. HTTP ${response.status}.`);
  }

  if (!response.ok || result.errors?.length) {
    throw new Error(
      `AppSync request failed: ${JSON.stringify(
        result.errors || responseText,
      )}`,
    );
  }

  if (!result.data) {
    throw new Error("AppSync returned no data.");
  }

  return result.data;
}

/* ============================================================
   GET ORDER
   ============================================================ */

async function getOrder(orderID) {
  const query = `
    query GetOrder($id: ID!) {
      getOrder(id: $id) {
        id
        paymentStatus
        paymentMethod
        paymentID
        paymentReference
        status
        assignedCourierId
        courierEarnings
        earningsAllocationStatus
        earningsAllocatedAt
        _version
        _deleted
      }
    }
  `;

  const data = await graphqlRequest(query, {
    id: orderID,
  });

  const order = data.getOrder;

  if (!order || order._deleted === true) {
    return null;
  }

  return order;
}

/* ============================================================
   GET COURIER
   ============================================================ */

async function getCourier(courierID) {
  const query = `
    query GetCourier($id: ID!) {
      getCourier(id: $id) {
        id
        walletID
        _version
        _deleted
      }
    }
  `;

  const data = await graphqlRequest(query, {
    id: courierID,
  });

  const courier = data.getCourier;

  if (!courier || courier._deleted === true) {
    return null;
  }

  return courier;
}

/* ============================================================
   GET WALLET BY ID
   ============================================================ */

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
        outstandingDebt
        _version
        _deleted
      }
    }
  `;

  const data = await graphqlRequest(query, {
    id: walletID,
  });

  const wallet = data.getWallet;

  if (!wallet || wallet._deleted === true) {
    return null;
  }

  return wallet;
}

/* ============================================================
   FIND COURIER WALLETS — WITH PAGINATION
   ============================================================ */

async function getWalletByOwner(courierID) {
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
  const wallets = [];

  do {
    const data = await graphqlRequest(query, {
      filter: {
        ownerID: { eq: courierID },
        ownerType: { eq: "COURIER" },
      },
      limit: PAGE_SIZE,
      nextToken,
    });

    const result = data.listWallets;

    wallets.push(
      ...(result?.items || []).filter((item) => item && item._deleted !== true),
    );

    nextToken = result?.nextToken || null;
  } while (nextToken);

  if (wallets.length > 1) {
    throw new Error(
      `Multiple COURIER wallets found for courier ${courierID}. ` +
        "Resolve the duplicate wallets before proceeding.",
    );
  }

  return wallets[0] || null;
}

/* ============================================================
   CREATE COURIER WALLET
   ============================================================ */

async function createCourierWallet(courierID) {
  const mutation = `
    mutation CreateWallet($input: CreateWalletInput!) {
      createWallet(input: $input) {
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

  const data = await graphqlRequest(mutation, {
    input: {
      ownerID: courierID,
      ownerType: "COURIER",
      availableBalance: 0,
      pendingBalance: 0,
      lifetimeEarnings: 0,
      outstandingDebt: 0,
    },
  });

  const wallet = data.createWallet;

  if (!wallet?.id) {
    throw new Error(`Could not create wallet for courier ${courierID}.`);
  }

  return wallet;
}

/* ============================================================
   SAVE WALLET ID TO COURIER
   ============================================================ */

async function updateCourierWalletID(courier, walletID) {
  if (courier.walletID === walletID) {
    return courier;
  }

  const mutation = `
    mutation UpdateCourier($input: UpdateCourierInput!) {
      updateCourier(input: $input) {
        id
        walletID
        _version
        _deleted
      }
    }
  `;

  const input = {
    id: courier.id,
    walletID,
  };

  if (courier._version != null) {
    input._version = courier._version;
  }

  const data = await graphqlRequest(mutation, {
    input,
  });

  if (!data.updateCourier) {
    throw new Error(`Could not save walletID to courier ${courier.id}.`);
  }

  return data.updateCourier;
}

/* ============================================================
   FIND OR CREATE COURIER WALLET
   ============================================================ */

async function findCourierWallet(courier) {
  if (!courier?.id) {
    throw new Error("A valid courier is required.");
  }

  // Prefer the wallet already linked to the Courier.
  if (courier.walletID) {
    const linkedWallet = await getWalletByID(courier.walletID);

    if (linkedWallet) {
      if (
        linkedWallet.ownerID !== courier.id ||
        linkedWallet.ownerType !== "COURIER"
      ) {
        throw new Error(
          `Wallet ${linkedWallet.id} does not belong to courier ${courier.id}.`,
        );
      }

      return {
        wallet: linkedWallet,
        courier,
        walletCreated: false,
      };
    }
  }

  // Search for an existing wallet.
  let wallet = await getWalletByOwner(courier.id);

  let walletCreated = false;

  // Create one only when no wallet exists.
  if (!wallet) {
    wallet = await createCourierWallet(courier.id);
    walletCreated = true;
  }

  if (wallet.ownerID !== courier.id || wallet.ownerType !== "COURIER") {
    throw new Error(`Wallet ${wallet.id} ownership validation failed.`);
  }

  const updatedCourier = await updateCourierWalletID(courier, wallet.id);

  return {
    wallet,
    courier: updatedCourier,
    walletCreated,
  };
}

/* ============================================================
   UPDATE ORDER
   ============================================================ */

async function updateOrder(input, condition) {
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
        _deleted
      }
    }
  `;

  const data = await graphqlRequest(mutation, {
    input,
    condition,
  });

  return data.updateOrder || null;
}

/* ============================================================
   CLAIM ORDER ALLOCATION
   ============================================================ */

async function claimAllocation(order) {
  const previousStatus = order.earningsAllocationStatus;

  const input = {
    id: order.id,
    earningsAllocationStatus: "PROCESSING",
  };

  if (order._version != null) {
    input._version = order._version;
  }

  let condition;

  if (previousStatus == null) {
    // The field must still be absent.
    // This prevents two first-time invocations from both
    // claiming an order whose allocation status is null.
    condition = {
      earningsAllocationStatus: {
        attributeExists: false,
      },
    };
  } else {
    condition = {
      earningsAllocationStatus: {
        eq: previousStatus,
      },
    };
  }

  try {
    return await updateOrder(input, condition);
  } catch (error) {
    console.error("Allocation claim failed:", error);
    return null;
  }
}

/* ============================================================
   FINALIZE ORDER
   ============================================================ */

async function finalizeAllocation(order) {
  const input = {
    id: order.id,
    earningsAllocationStatus: "ALLOCATED",
    earningsAllocatedAt: new Date().toISOString(),
  };

  if (order._version != null) {
    input._version = order._version;
  }

  return updateOrder(input, {
    earningsAllocationStatus: {
      eq: "PROCESSING",
    },
  });
}

/* ============================================================
   MARK ORDER FAILED
   ============================================================ */

async function markAllocationFailed(order) {
  if (!order?.id) {
    return null;
  }

  const input = {
    id: order.id,
    earningsAllocationStatus: "FAILED",
  };

  if (order._version != null) {
    input._version = order._version;
  }

  try {
    return await updateOrder(input, {
      earningsAllocationStatus: {
        eq: "PROCESSING",
      },
    });
  } catch (error) {
    console.error("Could not mark allocation FAILED:", error);

    return null;
  }
}

/* ============================================================
   FIND EARNINGS TRANSACTION — WITH PAGINATION
   ============================================================ */

async function getEarningsTransaction(orderID) {
  const query = `
    query TransactionsByReference(
      $reference: String!
      $limit: Int
      $nextToken: String
    ) {
      transactionsByReference(
        reference: $reference
        limit: $limit
        nextToken: $nextToken
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
        }
        nextToken
      }
    }
  `;

  let nextToken = null;
  const transactions = [];

  do {
    const data = await graphqlRequest(query, {
      reference: earningsReference(orderID),
      limit: PAGE_SIZE,
      nextToken,
    });

    const result = data.transactionsByReference;

    transactions.push(
      ...(result?.items || []).filter((item) => item && item._deleted !== true),
    );

    nextToken = result?.nextToken || null;
  } while (nextToken);

  if (transactions.length > 1) {
    throw new Error(
      `Multiple earnings transactions found for order ${orderID}. ` +
        "Manual reconciliation is required.",
    );
  }

  return transactions[0] || null;
}

/* ============================================================
   CREATE EARNINGS TRANSACTION
   ============================================================ */

async function createEarningsTransaction({
  walletID,
  orderID,
  paymentID,
  amount,
}) {
  const mutation = `
    mutation CreateTransaction(
      $input: CreateTransactionInput!
    ) {
      createTransaction(input: $input) {
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
      }
    }
  `;

  const data = await graphqlRequest(mutation, {
    input: {
      walletID,
      type: "CREDIT",
      amount,
      description: "Courier earnings allocated from paid order.",
      orderID,
      paymentID: paymentID || null,
      reference: earningsReference(orderID),
      status: "PENDING",
    },
  });

  const transaction = data.createTransaction;

  if (!transaction?.id) {
    throw new Error("Earnings transaction creation failed.");
  }

  return transaction;
}

/* ============================================================
   UPDATE TRANSACTION STATUS
   ============================================================ */

async function updateTransactionStatus(transaction, newStatus) {
  if (!transaction?.id) {
    throw new Error("Cannot update a transaction without an ID.");
  }

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
        orderID
        paymentID
        reference
        status
        _version
        _deleted
      }
    }
  `;

  const input = {
    id: transaction.id,
    status: newStatus,
  };

  if (transaction._version != null) {
    input._version = transaction._version;
  }

  const condition = {
    status: {
      eq: transaction.status,
    },
  };

  const data = await graphqlRequest(mutation, {
    input,
    condition,
  });

  if (!data.updateTransaction) {
    throw new Error(
      `Could not update transaction ${transaction.id} to ${newStatus}.`,
    );
  }

  return data.updateTransaction;
}

/* ============================================================
   VALIDATE TRANSACTION
   ============================================================ */

function validateEarningsTransaction(transaction, wallet, order, earnings) {
  if (!transaction) {
    throw new Error("Earnings transaction is missing.");
  }

  if (transaction.walletID !== wallet.id) {
    throw new Error(
      `Transaction wallet mismatch. Expected ${wallet.id}; received ${transaction.walletID}.`,
    );
  }

  if (transaction.orderID !== order.id) {
    throw new Error("Transaction orderID does not match the Order.");
  }

  if (transaction.reference !== earningsReference(order.id)) {
    throw new Error("Transaction reference does not match the Order.");
  }

  if (transaction.type !== "CREDIT") {
    throw new Error("Earnings transaction must have type CREDIT.");
  }

  if (!sameMoney(transaction.amount, earnings)) {
    throw new Error("Transaction amount does not match courierEarnings.");
  }
}

/* ============================================================
   UPDATE WALLET
   ============================================================ */

async function updateWallet(wallet, earnings) {
  const availableBalance = money(wallet.availableBalance ?? 0);

  const pendingBalance = money(wallet.pendingBalance ?? 0);

  const lifetimeEarnings = money(wallet.lifetimeEarnings ?? 0);

  if (availableBalance < 0 || pendingBalance < 0 || lifetimeEarnings < 0) {
    throw new Error(`Wallet ${wallet.id} contains a negative balance.`);
  }

  const input = {
    id: wallet.id,
    availableBalance,
    pendingBalance: money(pendingBalance + earnings),
    lifetimeEarnings,
  };

  // AppSync optimistic concurrency must be enabled for this
  // version value to protect concurrent wallet updates.
  if (wallet._version != null) {
    input._version = wallet._version;
  }

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
        _deleted
      }
    }
  `;

  const data = await graphqlRequest(mutation, {
    input,
  });

  if (!data.updateWallet) {
    throw new Error(`Wallet ${wallet.id} update returned no wallet.`);
  }

  return data.updateWallet;
}

/* ============================================================
   RECONCILE COMPLETED TRANSACTION
   ============================================================ */

/**
 * A COMPLETED transaction must never trigger another wallet
 * credit.
 *
 * Before marking the Order ALLOCATED, this function validates
 * that the transaction belongs to the actual courier wallet.
 */

async function reconcileCompletedTransaction({
  order,
  courier,
  wallet,
  transaction,
  earnings,
}) {
  validateEarningsTransaction(transaction, wallet, order, earnings);

  if (transaction.status !== "COMPLETED") {
    throw new Error("Expected a COMPLETED earnings transaction.");
  }

  if (order.earningsAllocationStatus === "ALLOCATED") {
    return successResponse(
      {
        orderID: order.id,
        courierID: courier.id,
        walletID: wallet.id,
        transactionID: transaction.id,
        amount: earnings,
        alreadyAllocated: true,
        earningsAllocationStatus: "ALLOCATED",
      },
      "Earnings were already allocated. No duplicate credit was made.",
    );
  }

  let processingOrder = order;

  if (order.earningsAllocationStatus !== "PROCESSING") {
    const claimedOrder = await claimAllocation(order);

    if (!claimedOrder) {
      throw new Error(
        "The completed transaction exists, but the Order could not be claimed for reconciliation.",
      );
    }

    processingOrder = {
      ...order,
      ...claimedOrder,
    };
  }

  const finalizedOrder = await finalizeAllocation(processingOrder);

  if (!finalizedOrder) {
    throw new Error(
      "The transaction is COMPLETED, but the Order could not be finalized. No wallet credit was made by this retry.",
    );
  }

  return successResponse(
    {
      orderID: order.id,
      courierID: courier.id,
      walletID: wallet.id,
      transactionID: transaction.id,
      amount: earnings,
      alreadyAllocated: true,
      earningsAllocationStatus: finalizedOrder.earningsAllocationStatus,
    },
    "Existing completed transaction reconciled. No duplicate wallet credit was made.",
  );
}

/* ============================================================
   MAIN HANDLER
   ============================================================ */

exports.handler = async (event) => {
  console.log("==========================================");
  console.log("allocateCourierEarnings invoked");
  console.log("==========================================");

  let order = null;
  let courier = null;
  let wallet = null;
  let transaction = null;

  let allocationClaimed = false;
  let walletWasCreated = false;
  let walletUpdateAttempted = false;
  let walletWasUpdated = false;
  let transactionWasCreated = false;
  let transactionWasCompleted = false;
  let orderWasFinalized = false;

  try {
    /* --------------------------------------------------------
       1. GET ORDER ID
       -------------------------------------------------------- */

    const orderID =
      event?.orderID ||
      event?.orderId ||
      event?.arguments?.orderID ||
      event?.arguments?.orderId ||
      event?.detail?.orderID ||
      event?.detail?.orderId ||
      event?.detail?.id;

    if (!orderID) {
      throw new Error("orderID is required.");
    }

    console.log("Processing order:", orderID);

    /* --------------------------------------------------------
       2. GET ORDER
       -------------------------------------------------------- */

    order = await getOrder(orderID);

    if (!order) {
      throw new Error(`Order ${orderID} was not found or was deleted.`);
    }

    /* --------------------------------------------------------
       3. PAYMENT METHOD CHECK
       -------------------------------------------------------- */

    // Cash orders must never enter wallet earnings allocation.
    // A null payment method is also skipped because the
    // receiver may not yet have selected a payment method.

    if (order.paymentMethod !== "PAYSTACK") {
      return successResponse({
        skipped: true,
        reason: "Only PAYSTACK orders can be allocated to the courier wallet.",
        orderID: order.id,
        paymentMethod: order.paymentMethod || null,
        paymentStatus: order.paymentStatus,
      });
    }

    /* --------------------------------------------------------
       4. PAYMENT STATUS CHECK
       -------------------------------------------------------- */

    if (order.paymentStatus !== "PAID") {
      return successResponse({
        skipped: true,
        reason: "Order payment is not PAID.",
        orderID: order.id,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
      });
    }

    /* --------------------------------------------------------
       5. COURIER ASSIGNMENT CHECK
       -------------------------------------------------------- */

    if (!order.assignedCourierId) {
      return successResponse({
        skipped: true,
        reason: "Order has no assigned courier.",
        orderID: order.id,
      });
    }

    /* --------------------------------------------------------
       6. VALIDATE EARNINGS
       -------------------------------------------------------- */

    const earnings = money(order.courierEarnings);

    if (earnings <= 0) {
      throw new Error(`Invalid courierEarnings: ${order.courierEarnings}`);
    }

    const allocationStatus = order.earningsAllocationStatus || null;

    /* --------------------------------------------------------
       7. GET COURIER AND WALLET
       -------------------------------------------------------- */

    courier = await getCourier(order.assignedCourierId);

    if (!courier) {
      throw new Error(`Courier ${order.assignedCourierId} was not found.`);
    }

    const walletResult = await findCourierWallet(courier);

    wallet = walletResult.wallet;
    courier = walletResult.courier;
    walletWasCreated = walletResult.walletCreated;

    if (!wallet) {
      throw new Error(`No wallet exists for courier ${courier.id}.`);
    }

    if (wallet.ownerID !== courier.id || wallet.ownerType !== "COURIER") {
      throw new Error("Courier wallet ownership validation failed.");
    }

    /* --------------------------------------------------------
       8. FIND EXISTING EARNINGS TRANSACTION
       -------------------------------------------------------- */

    transaction = await getEarningsTransaction(order.id);

    /* --------------------------------------------------------
       9. HANDLE EXISTING TRANSACTION
       -------------------------------------------------------- */

    if (transaction) {
      validateEarningsTransaction(transaction, wallet, order, earnings);

      if (transaction.status === "COMPLETED") {
        transactionWasCompleted = true;

        return await reconcileCompletedTransaction({
          order,
          courier,
          wallet,
          transaction,
          earnings,
        });
      }

      if (transaction.status === "PENDING") {
        // A PENDING transaction may mean the wallet update
        // succeeded but the response was lost.
        //
        // Never credit this transaction again automatically.

        throw new Error(
          `FINANCIAL RECONCILIATION REQUIRED: transaction ${transaction.id} is PENDING. Verify the wallet balance and ledger before taking further action.`,
        );
      }

      if (transaction.status !== "FAILED") {
        throw new Error(
          `Unsupported transaction status: ${transaction.status}`,
        );
      }

      // FAILED transactions are only eligible for retry
      // when the previous code marked them FAILED before
      // attempting the wallet update.
      //
      // Do not retry a FAILED transaction from an unknown
      // legacy implementation without first reconciling it.
    }

    /* --------------------------------------------------------
       10. CHECK ORDER ALLOCATION STATUS
       -------------------------------------------------------- */

    if (allocationStatus === "ALLOCATED") {
      throw new Error(
        `Order ${order.id} is ALLOCATED but its transaction is not COMPLETED. Reconciliation is required.`,
      );
    }

    if (allocationStatus === "PROCESSING") {
      return successResponse({
        skipped: true,
        reason:
          "Order allocation is already PROCESSING. Do not start a second allocation.",
        orderID: order.id,
        transactionID: transaction?.id || null,
      });
    }

    if (
      allocationStatus !== null &&
      allocationStatus !== "NOT_ALLOCATED" &&
      allocationStatus !== "FAILED"
    ) {
      throw new Error(`Unsupported allocation status: ${allocationStatus}`);
    }

    /* --------------------------------------------------------
       11. CLAIM ORDER
       -------------------------------------------------------- */

    const claimedOrder = await claimAllocation(order);

    if (!claimedOrder) {
      throw new Error(
        `Could not claim order ${order.id}. Another invocation may have changed it.`,
      );
    }

    allocationClaimed = true;

    order = {
      ...order,
      ...claimedOrder,
    };

    /* --------------------------------------------------------
       12. HANDLE FAILED TRANSACTION RETRY
       -------------------------------------------------------- */

    if (transaction?.status === "FAILED") {
      transaction = await updateTransactionStatus(transaction, "PENDING");
    }

    /* --------------------------------------------------------
       13. CREATE TRANSACTION IF NECESSARY
       -------------------------------------------------------- */

    if (!transaction) {
      transaction = await createEarningsTransaction({
        walletID: wallet.id,
        orderID: order.id,
        paymentID: order.paymentID,
        amount: earnings,
      });

      transactionWasCreated = true;
    }

    validateEarningsTransaction(transaction, wallet, order, earnings);

    if (transaction.status !== "PENDING") {
      throw new Error(
        `Expected PENDING transaction; got ${transaction.status}.`,
      );
    }

    /* --------------------------------------------------------
       14. UPDATE WALLET PENDING BALANCE
       -------------------------------------------------------- */

    // Set this BEFORE sending the request.
    //
    // If AppSync applies the mutation but the network response
    // is lost, the wallet may already have been credited.
    //
    // The catch block will therefore leave the transaction
    // PENDING and will not automatically retry the credit.

    walletUpdateAttempted = true;

    const updatedWallet = await updateWallet(wallet, earnings);

    walletWasUpdated = true;
    wallet = updatedWallet;

    console.log("Wallet updated:", {
      walletID: wallet.id,
      pendingBalance: wallet.pendingBalance,
      availableBalance: wallet.availableBalance,
      lifetimeEarnings: wallet.lifetimeEarnings,
    });

    /* --------------------------------------------------------
       15. MARK TRANSACTION COMPLETED
       -------------------------------------------------------- */

    transaction = await updateTransactionStatus(transaction, "COMPLETED");

    transactionWasCompleted = true;

    /* --------------------------------------------------------
       16. FINALIZE ORDER
       -------------------------------------------------------- */

    const finalizedOrder = await finalizeAllocation(order);

    if (!finalizedOrder) {
      throw new Error(
        "Wallet was updated and transaction completed, but Order finalization failed. Retry only for reconciliation; do not credit again.",
      );
    }

    order = finalizedOrder;
    orderWasFinalized = true;

    /* --------------------------------------------------------
       17. SUCCESS
       -------------------------------------------------------- */

    console.log("Courier earnings allocated successfully:", {
      orderID: order.id,
      courierID: courier.id,
      walletID: wallet.id,
      transactionID: transaction.id,
      amount: earnings,
    });

    return successResponse(
      {
        orderID: order.id,
        courierID: courier.id,
        walletID: wallet.id,
        transactionID: transaction.id,
        amount: earnings,
        paymentMethod: "PAYSTACK",
        paymentStatus: "PAID",
        availableBalance: wallet.availableBalance,
        pendingBalance: wallet.pendingBalance,
        lifetimeEarnings: wallet.lifetimeEarnings,
        walletCreated: walletWasCreated,
        transactionCreated: transactionWasCreated,
        transactionStatus: transaction.status,
        earningsAllocationStatus: order.earningsAllocationStatus,
        alreadyAllocated: false,
      },
      "Courier earnings allocated successfully.",
    );
  } catch (error) {
    console.error("==========================================");

    console.error("allocateCourierEarnings FAILED", {
      orderID: order?.id || null,
      courierID: courier?.id || null,
      walletID: wallet?.id || null,
      transactionID: transaction?.id || null,
      error: error?.message,
      stack: error?.stack,
    });

    console.error("==========================================");

    /* --------------------------------------------------------
       18. SAFE FAILURE HANDLING
       -------------------------------------------------------- */

    // If the wallet update was never attempted, it is safe
    // to mark the claimed Order FAILED.

    if (
      allocationClaimed &&
      order &&
      !walletUpdateAttempted &&
      !transactionWasCompleted &&
      !orderWasFinalized
    ) {
      await markAllocationFailed(order);
    }

    // Mark a PENDING transaction FAILED only if the wallet
    // update was definitely never attempted.
    //
    // If it was attempted, leave it PENDING for reconciliation.

    if (
      transaction &&
      transaction.status === "PENDING" &&
      !walletUpdateAttempted &&
      !transactionWasCompleted
    ) {
      try {
        transaction = await updateTransactionStatus(transaction, "FAILED");
      } catch (transactionError) {
        console.error("Could not mark transaction FAILED:", transactionError);
      }
    }

    return errorResponse(error, {
      orderID: order?.id || null,
      courierID: courier?.id || null,
      walletID: wallet?.id || null,
      transactionID: transaction?.id || null,
      walletWasCreated,
      walletUpdateAttempted,
      walletWasUpdated,
      transactionWasCreated,
      transactionWasCompleted,
      orderWasFinalized,
      reconciliationRequired: walletUpdateAttempted && !transactionWasCompleted,
    });
  }
};
