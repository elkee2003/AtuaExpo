/**
 * ============================================================
 * ATUA — allocateCourierEarnings Lambda
 * ============================================================
 *
 * PURPOSE
 * -------
 * Allocates courier earnings from a paid order into the
 * courier's PENDING wallet balance.
 *
 * FINANCIAL RULES
 * ---------------
 * 1. Order must be PAID.
 * 2. Order must have an assigned courier.
 * 3. Earnings must be greater than zero.
 * 4. Earnings increase pendingBalance only.
 * 5. availableBalance remains unchanged.
 * 6. lifetimeEarnings remains unchanged here.
 * 7. The transaction reference is EARNINGS-${orderID}.
 * 8. Never blindly credit an existing PENDING transaction.
 *
 * IMPORTANT SAFETY RULE
 * ---------------------
 * AppSync does not make separate Wallet, Transaction and Order
 * mutations one atomic operation.
 *
 * If a wallet update might have succeeded but its response was
 * lost, this Lambda leaves the transaction pending and requires
 * reconciliation. It does not automatically credit again.
 *
 * ENVIRONMENT VARIABLES
 * ---------------------
 * API_ATUA_GRAPHQLAPIENDPOINTOUTPUT
 * API_ATUA_GRAPHQLAPIKEYOUTPUT
 *
 * DEPENDENCIES
 * ------------
 * Uses built-in fetch on supported Node.js runtimes.
 * Falls back to node-fetch if required by the runtime.
 * ============================================================
 */

const fetch = global.fetch || require("node-fetch");

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const GRAPHQL_API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

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

function normalizeMoney(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`Invalid monetary value: ${value}`);
  }

  return Number(number.toFixed(2));
}

function sameMoney(first, second) {
  return normalizeMoney(first) === normalizeMoney(second);
}

/* ============================================================
   GRAPHQL REQUEST HELPER
   ============================================================ */

async function graphqlRequest(query, variables = {}) {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error(
      "Missing environment variable: API_ATUA_GRAPHQLAPIENDPOINTOUTPUT",
    );
  }

  if (!GRAPHQL_API_KEY) {
    throw new Error(
      "Missing environment variable: API_ATUA_GRAPHQLAPIKEYOUTPUT",
    );
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
    throw new Error(
      `GraphQL returned a non-JSON response. HTTP ${response.status}: ${responseText}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `GraphQL HTTP ${response.status}: ${JSON.stringify(
        result.errors || responseText,
      )}`,
    );
  }

  if (result.errors?.length) {
    throw new Error(`GraphQL error: ${JSON.stringify(result.errors)}`);
  }

  if (!result.data) {
    throw new Error("GraphQL returned no data.");
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

  const data = await graphqlRequest(query, { id: orderID });
  const order = data?.getOrder;

  if (order?._deleted === true) {
    return null;
  }

  return order || null;
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

  const data = await graphqlRequest(query, { id: courierID });
  const courier = data?.getCourier;

  if (courier?._deleted === true) {
    return null;
  }

  return courier || null;
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
        _version
        _deleted
      }
    }
  `;

  const data = await graphqlRequest(query, { id: walletID });
  const wallet = data?.getWallet;

  if (wallet?._deleted === true) {
    return null;
  }

  return wallet || null;
}

/* ============================================================
   FIND WALLET BY OWNER
   ============================================================ */

async function getWalletByOwner(courierID) {
  const query = `
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
          pendingBalance
          lifetimeEarnings
          _version
          _deleted
        }
      }
    }
  `;

  const data = await graphqlRequest(query, {
    filter: {
      ownerID: { eq: courierID },
      ownerType: { eq: "COURIER" },
    },
    limit: 100,
  });

  const wallets = (data?.listWallets?.items || []).filter(
    (wallet) => wallet && wallet._deleted !== true,
  );

  // Never arbitrarily choose between multiple courier wallets.
  // Duplicate wallets must be investigated before allocating funds.
  if (wallets.length > 1) {
    throw new Error(
      `Multiple active COURIER wallets found for courier ${courierID}. ` +
        "Resolve the duplicate wallets before retrying.",
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
    },
  });

  const wallet = data?.createWallet;

  if (!wallet?.id) {
    throw new Error(
      `Wallet creation returned no wallet for courier ${courierID}.`,
    );
  }

  return wallet;
}

/* ============================================================
   SAVE WALLET ID TO COURIER
   ============================================================ */

async function updateCourierWalletID(courier, walletID) {
  if (!courier?.id || !walletID) {
    throw new Error("Courier and walletID are required.");
  }

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

  // Include the latest version when available.
  if (courier._version !== undefined && courier._version !== null) {
    input._version = courier._version;
  }

  const data = await graphqlRequest(mutation, { input });
  const updatedCourier = data?.updateCourier;

  if (!updatedCourier) {
    throw new Error(`Could not save walletID to courier ${courier.id}.`);
  }

  return updatedCourier;
}

/* ============================================================
   FIND OR CREATE WALLET
   ============================================================ */

async function findCourierWallet(courier) {
  if (!courier?.id) {
    throw new Error("Cannot find a wallet without a valid courier.");
  }

  // First try the wallet ID already stored on the Courier.
  if (courier.walletID) {
    const linkedWallet = await getWalletByID(courier.walletID);

    if (linkedWallet) {
      if (
        linkedWallet.ownerID !== courier.id ||
        linkedWallet.ownerType !== "COURIER"
      ) {
        throw new Error(
          `Courier ${courier.id} points to wallet ${linkedWallet.id}, ` +
            "but that wallet does not belong to this courier.",
        );
      }

      return {
        wallet: linkedWallet,
        courier,
        walletCreated: false,
      };
    }
  }

  // If the stored ID is missing or stale, search by owner.
  let wallet = await getWalletByOwner(courier.id);
  let walletCreated = false;

  if (!wallet) {
    // Recheck immediately before creating. This reduces, but does
    // not eliminate, duplicate creation caused by concurrent calls.
    wallet = await getWalletByOwner(courier.id);
  }

  if (!wallet) {
    wallet = await createCourierWallet(courier.id);
    walletCreated = true;
  }

  if (wallet.ownerID !== courier.id || wallet.ownerType !== "COURIER") {
    throw new Error(
      `Wallet ${wallet.id} does not belong to courier ${courier.id}.`,
    );
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
      updateOrder(input: $input, condition: $condition) {
        id
        earningsAllocationStatus
        earningsAllocatedAt
        _version
        _deleted
      }
    }
  `;

  const variables = { input };

  if (condition !== undefined) {
    variables.condition = condition;
  }

  const data = await graphqlRequest(mutation, variables);
  return data?.updateOrder || null;
}

/* ============================================================
   CLAIM ORDER ALLOCATION
   ============================================================ */

/**
 * Claims an order for allocation by changing its status to
 * PROCESSING.
 *
 * The Order version is included when available. For reliable
 * concurrency protection, verify that your deployed API uses
 * the expected version/conflict handling configuration.
 */
async function claimAllocation(order) {
  const previousStatus = order.earningsAllocationStatus;

  const input = {
    id: order.id,
    earningsAllocationStatus: "PROCESSING",
  };

  if (order._version !== undefined && order._version !== null) {
    input._version = order._version;
  }

  let condition;

  if (previousStatus === null || previousStatus === undefined) {
    // This schema path does not use attributeExists.
    // _version is included when available.
    condition = undefined;
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
    console.error("Could not claim order allocation:", error);
    return null;
  }
}

/* ============================================================
   FINALIZE ORDER ALLOCATION
   ============================================================ */

async function finalizeAllocation(order) {
  const input = {
    id: order.id,
    earningsAllocationStatus: "ALLOCATED",
    earningsAllocatedAt: new Date().toISOString(),
  };

  if (order._version !== undefined && order._version !== null) {
    input._version = order._version;
  }

  return updateOrder(input, {
    earningsAllocationStatus: { eq: "PROCESSING" },
  });
}

/* ============================================================
   MARK ORDER ALLOCATION FAILED
   ============================================================ */

async function markAllocationFailed(order) {
  if (!order?.id) {
    return null;
  }

  const input = {
    id: order.id,
    earningsAllocationStatus: "FAILED",
  };

  if (order._version !== undefined && order._version !== null) {
    input._version = order._version;
  }

  try {
    return await updateOrder(input, {
      earningsAllocationStatus: { eq: "PROCESSING" },
    });
  } catch (error) {
    console.error("Could not mark allocation FAILED:", error);
    return null;
  }
}

/* ============================================================
   EARNINGS TRANSACTION HELPERS
   ============================================================ */

function getEarningsReference(orderID) {
  return `EARNINGS-${orderID}`;
}

/* ============================================================
   FIND EARNINGS TRANSACTION
   ============================================================ */

async function getEarningsTransaction(orderID) {
  const query = `
    query ListTransactions(
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
          _version
          _deleted
        }
      }
    }
  `;

  const data = await graphqlRequest(query, {
    filter: {
      reference: {
        eq: getEarningsReference(orderID),
      },
    },
    limit: 100,
  });

  const transactions = (data?.listTransactions?.items || []).filter(
    (transaction) => {
      return transaction && transaction._deleted !== true;
    },
  );

  // Duplicate references are a financial integrity problem.
  if (transactions.length > 1) {
    throw new Error(
      `Multiple earnings transactions exist for order ${orderID}. ` +
        "Do not allocate until the duplicate records are reconciled.",
    );
  }

  return transactions[0] || null;
}

/* ============================================================
   GET TRANSACTION BY ID
   ============================================================ */

async function getTransaction(transactionID) {
  if (!transactionID) {
    return null;
  }

  const query = `
    query GetTransaction($id: ID!) {
      getTransaction(id: $id) {
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

  const data = await graphqlRequest(query, {
    id: transactionID,
  });

  const transaction = data?.getTransaction;

  if (transaction?._deleted === true) {
    return null;
  }

  return transaction || null;
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

  const input = {
    walletID,
    type: "CREDIT",
    amount,
    description: "Courier earnings allocated from paid order.",
    orderID,
    paymentID: paymentID || null,
    reference: getEarningsReference(orderID),
    status: "PENDING",
  };

  const data = await graphqlRequest(mutation, { input });
  const transaction = data?.createTransaction;

  if (!transaction?.id) {
    throw new Error("Earnings transaction was not created.");
  }

  return transaction;
}

/* ============================================================
   UPDATE TRANSACTION STATUS
   ============================================================ */

async function updateTransactionStatus(transaction, status) {
  if (!transaction?.id) {
    throw new Error("Cannot update a transaction without an ID.");
  }

  const mutation = `
    mutation UpdateTransaction(
      $input: UpdateTransactionInput!
      $condition: ModelTransactionConditionInput
    ) {
      updateTransaction(input: $input, condition: $condition) {
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

  const input = {
    id: transaction.id,
    status,
  };

  if (transaction._version !== undefined && transaction._version !== null) {
    input._version = transaction._version;
  }

  // Do not overwrite a transaction whose status has changed.
  const condition = {
    status: {
      eq: transaction.status,
    },
  };

  const data = await graphqlRequest(mutation, {
    input,
    condition,
  });

  const updated = data?.updateTransaction;

  if (!updated) {
    throw new Error(
      `Transaction ${transaction.id} was not updated to ${status}.`,
    );
  }

  return updated;
}

/* ============================================================
   VALIDATE EARNINGS TRANSACTION
   ============================================================ */

function validateEarningsTransaction(transaction, wallet, order, earnings) {
  if (!transaction) {
    throw new Error("Earnings transaction is missing.");
  }

  if (transaction.walletID !== wallet.id) {
    throw new Error(
      `Transaction ${transaction.id} belongs to wallet ` +
        `${transaction.walletID}, expected ${wallet.id}.`,
    );
  }

  if (transaction.orderID !== order.id) {
    throw new Error(`Transaction ${transaction.id} has an incorrect orderID.`);
  }

  if (transaction.reference !== getEarningsReference(order.id)) {
    throw new Error(
      `Transaction ${transaction.id} has an incorrect reference.`,
    );
  }

  if (transaction.type !== "CREDIT") {
    throw new Error(
      `Transaction ${transaction.id} is not a CREDIT transaction.`,
    );
  }

  if (!sameMoney(transaction.amount, earnings)) {
    throw new Error(
      `Transaction amount ${transaction.amount} does not match ` +
        `order earnings ${earnings}.`,
    );
  }
}

/* ============================================================
   UPDATE WALLET BALANCES
   ============================================================ */

/**
 * Earnings are placed in pendingBalance.
 *
 * availableBalance does not change here.
 * lifetimeEarnings does not change here.
 *
 * The caller must set walletUpdateAttempted = true BEFORE calling
 * this helper, because a network error can happen after AppSync
 * has already applied the mutation.
 */
async function updateWallet(wallet, earnings) {
  const availableBalance = normalizeMoney(wallet.availableBalance ?? 0);
  const pendingBalance = normalizeMoney(wallet.pendingBalance ?? 0);
  const lifetimeEarnings = normalizeMoney(wallet.lifetimeEarnings ?? 0);

  const input = {
    id: wallet.id,
    availableBalance,
    pendingBalance: normalizeMoney(pendingBalance + earnings),
    lifetimeEarnings,
  };

  if (wallet._version !== undefined && wallet._version !== null) {
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
        _version
        _deleted
      }
    }
  `;

  const data = await graphqlRequest(mutation, { input });
  const updatedWallet = data?.updateWallet;

  if (!updatedWallet) {
    throw new Error(`Wallet ${wallet.id} update returned no wallet.`);
  }

  return updatedWallet;
}

/* ============================================================
   RECOVER AN ALREADY-COMPLETED TRANSACTION
   ============================================================ */

/**
 * If the transaction is COMPLETED, the wallet must not be
 * credited again.
 *
 * This helper only repairs the Order allocation status.
 */
async function finalizeAlreadyCompleted(order, transaction, earnings) {
  if (order.earningsAllocationStatus === "ALLOCATED") {
    return successResponse(
      {
        orderID: order.id,
        transactionID: transaction.id,
        amount: earnings,
        earningsAllocationStatus: "ALLOCATED",
        alreadyAllocated: true,
      },
      "Earnings were already allocated. No duplicate wallet credit was made.",
    );
  }

  let processingOrder = order;

  if (order.earningsAllocationStatus !== "PROCESSING") {
    const claimedOrder = await claimAllocation(order);

    if (!claimedOrder) {
      throw new Error(
        `Transaction ${transaction.id} is COMPLETED, but order ` +
          `${order.id} could not be claimed for finalization.`,
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
      `Transaction ${transaction.id} is COMPLETED, but order ` +
        `${order.id} could not be finalized. No wallet credit was made by this retry.`,
    );
  }

  return successResponse(
    {
      orderID: order.id,
      transactionID: transaction.id,
      amount: earnings,
      earningsAllocationStatus: finalizedOrder.earningsAllocationStatus,
      alreadyAllocated: true,
    },
    "Existing completed earnings transaction reconciled with the order.",
  );
}

/* ============================================================
   MAIN HANDLER
   ============================================================ */

exports.handler = async (event) => {
  console.log("==================================================");
  console.log("allocateCourierEarnings invoked");
  console.log("Event:", JSON.stringify(event));
  console.log("==================================================");

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
       1. Read order ID from supported event shapes
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

    console.log(`Processing order ${orderID}.`);

    /* --------------------------------------------------------
       2. Retrieve order
       -------------------------------------------------------- */

    order = await getOrder(orderID);

    if (!order) {
      throw new Error(`Order ${orderID} was not found or was deleted.`);
    }

    /* --------------------------------------------------------
       3. Confirm payment
       -------------------------------------------------------- */

    if (order.paymentStatus !== "PAID") {
      return successResponse({
        skipped: true,
        reason: "Order payment is not PAID.",
        orderID: order.id,
        paymentStatus: order.paymentStatus,
      });
    }

    /* --------------------------------------------------------
       4. Confirm courier assignment
       -------------------------------------------------------- */

    if (!order.assignedCourierId) {
      return successResponse({
        skipped: true,
        reason: "Order has no assigned courier.",
        orderID: order.id,
      });
    }

    /* --------------------------------------------------------
       5. Validate courier earnings
       -------------------------------------------------------- */

    const earnings = normalizeMoney(order.courierEarnings);

    if (earnings <= 0) {
      throw new Error(
        `Invalid courierEarnings for order ${order.id}: ` +
          `${order.courierEarnings}`,
      );
    }

    const allocationStatus = order.earningsAllocationStatus;

    console.log("Allocation status:", allocationStatus || "null");
    console.log("Courier earnings:", earnings);

    /* --------------------------------------------------------
       6. Inspect the existing transaction BEFORE crediting
       -------------------------------------------------------- */

    transaction = await getEarningsTransaction(order.id);

    if (transaction) {
      // Confirm that the transaction matches this order and its
      // earnings. Never trust a matching reference alone.
      if (transaction.orderID !== order.id) {
        throw new Error(
          `Existing transaction ${transaction.id} has a mismatched orderID.`,
        );
      }

      if (transaction.reference !== getEarningsReference(order.id)) {
        throw new Error(
          `Existing transaction ${transaction.id} has a mismatched reference.`,
        );
      }

      if (transaction.type !== "CREDIT") {
        throw new Error(
          `Existing transaction ${transaction.id} is not a CREDIT transaction.`,
        );
      }

      if (!sameMoney(transaction.amount, earnings)) {
        throw new Error(
          `Existing transaction amount ${transaction.amount} does not ` +
            `match courier earnings ${earnings}.`,
        );
      }

      /* ------------------------------------------------------
         Completed transaction: never credit again.
         ------------------------------------------------------ */

      if (transaction.status === "COMPLETED") {
        transactionWasCompleted = true;

        return await finalizeAlreadyCompleted(order, transaction, earnings);
      }

      /* ------------------------------------------------------
         A previous invocation may have stopped partway through.
         ------------------------------------------------------ */

      if (transaction.status === "PENDING") {
        /*
         * CRITICAL SAFETY CHANGE:
         *
         * A PENDING transaction might mean:
         * - the wallet has not yet been updated; OR
         * - the wallet was updated, but the function failed before
         *   it could mark the transaction COMPLETED.
         *
         * The schema shown in your supplied code does not give this
         * Lambda a reliable way to distinguish those two cases.
         *
         * Therefore, do not automatically credit an existing
         * PENDING transaction. Reconcile the wallet and transaction
         * before deciding whether another credit is needed.
         */
        throw new Error(
          `EARNINGS RECONCILIATION REQUIRED: transaction ` +
            `${transaction.id} for order ${order.id} is PENDING. ` +
            "The Lambda will not credit the wallet again automatically. " +
            "Check the wallet balance and transaction history first.",
        );
      }

      /* ------------------------------------------------------
         A FAILED transaction can be retried only under the
         invariant used by this Lambda: FAILED is set only when
         the wallet update was never attempted.
         ------------------------------------------------------ */

      if (transaction.status === "FAILED") {
        console.log(`Recovering FAILED transaction ${transaction.id}.`);

        transaction = await updateTransactionStatus(transaction, "PENDING");

        /*
         * Do not mark it as newly created. Its history exists,
         * but this FAILED -> PENDING transition confirms that this
         * code's previous attempt did not attempt the wallet update.
         */
      } else {
        throw new Error(
          `Unsupported earnings transaction status: ${transaction.status}`,
        );
      }
    }

    /* --------------------------------------------------------
       7. Inspect Order allocation status
       -------------------------------------------------------- */

    if (allocationStatus === "ALLOCATED") {
      /*
       * The order says ALLOCATED, but no completed transaction
       * was found. This is inconsistent financial state.
       * Never create a second credit automatically.
       */
      if (!transaction) {
        throw new Error(
          `Order ${order.id} is marked ALLOCATED, but its earnings ` +
            "transaction is missing. Reconcile before retrying.",
        );
      }
    }

    if (allocationStatus === "PROCESSING") {
      /*
       * If there is no existing transaction, another invocation
       * may still be working or may have failed before creating it.
       * Avoid concurrent crediting.
       */
      if (!transaction) {
        return successResponse({
          skipped: true,
          reason:
            "Order allocation is already PROCESSING and has no earnings transaction. Reconcile before retrying.",
          orderID: order.id,
        });
      }
    }

    /* --------------------------------------------------------
       8. Claim the order
       -------------------------------------------------------- */

    if (allocationStatus !== "PROCESSING") {
      const claimedOrder = await claimAllocation(order);

      if (!claimedOrder) {
        throw new Error(
          `Could not claim allocation for order ${order.id}. ` +
            "Another invocation may have changed the order.",
        );
      }

      allocationClaimed = true;

      order = {
        ...order,
        ...claimedOrder,
      };
    } else {
      /*
       * If an existing FAILED transaction was reset to PENDING,
       * the Order may already be PROCESSING from the previous run.
       * Continue only with that transaction's recovery path.
       */
      allocationClaimed = true;
    }

    /* --------------------------------------------------------
       9. Retrieve courier
       -------------------------------------------------------- */

    courier = await getCourier(order.assignedCourierId);

    if (!courier) {
      throw new Error(`Courier ${order.assignedCourierId} was not found.`);
    }

    /* --------------------------------------------------------
       10. Find or create courier wallet
       -------------------------------------------------------- */

    const walletResult = await findCourierWallet(courier);

    wallet = walletResult.wallet;
    courier = walletResult.courier;
    walletWasCreated = walletResult.walletCreated;

    if (!wallet) {
      throw new Error(
        `No wallet was found or created for courier ${courier.id}.`,
      );
    }

    if (wallet.ownerID !== courier.id || wallet.ownerType !== "COURIER") {
      throw new Error(
        `Wallet ${wallet.id} does not belong to courier ${courier.id}.`,
      );
    }

    /* --------------------------------------------------------
       11. Create a transaction only if no transaction exists
       -------------------------------------------------------- */

    if (!transaction) {
      transaction = await createEarningsTransaction({
        walletID: wallet.id,
        orderID: order.id,
        paymentID: order.paymentID,
        amount: earnings,
      });

      transactionWasCreated = true;
    } else {
      /*
       * A FAILED transaction may have been reset to PENDING above.
       * Validate that it belongs to the wallet we resolved.
       */
      validateEarningsTransaction(transaction, wallet, order, earnings);

      if (transaction.status !== "PENDING") {
        throw new Error(
          `Transaction ${transaction.id} is not PENDING before wallet update.`,
        );
      }
    }

    /* --------------------------------------------------------
       12. Validate transaction against the resolved wallet
       -------------------------------------------------------- */

    validateEarningsTransaction(transaction, wallet, order, earnings);

    if (transaction.status !== "PENDING") {
      throw new Error(
        `Expected PENDING transaction; received ${transaction.status}.`,
      );
    }

    /*
     * If a transaction already existed as PENDING, the code would
     * have stopped earlier. At this point it is either newly created
     * during this invocation or was safely recovered from FAILED.
     */

    /* --------------------------------------------------------
       13. Apply earnings to pendingBalance
       -------------------------------------------------------- */

    console.log("Updating courier wallet:", wallet.id);

    /*
     * Set this BEFORE sending the mutation.
     *
     * If the request times out after AppSync has applied the update,
     * we cannot safely assume the wallet remained unchanged.
     */
    walletUpdateAttempted = true;

    const updatedWallet = await updateWallet(wallet, earnings);

    walletWasUpdated = true;
    wallet = updatedWallet;

    console.log("Wallet update confirmed:", {
      walletID: wallet.id,
      availableBalance: wallet.availableBalance,
      pendingBalance: wallet.pendingBalance,
      lifetimeEarnings: wallet.lifetimeEarnings,
    });

    /* --------------------------------------------------------
       14. Mark transaction COMPLETED
       -------------------------------------------------------- */

    transaction = await updateTransactionStatus(transaction, "COMPLETED");

    transactionWasCompleted = true;

    console.log(`Transaction ${transaction.id} marked COMPLETED.`);

    /* --------------------------------------------------------
       15. Finalize Order: PROCESSING -> ALLOCATED
       -------------------------------------------------------- */

    const finalizedOrder = await finalizeAllocation(order);

    if (!finalizedOrder) {
      /*
       * Wallet and transaction are already updated.
       * Do not undo or repeat the credit automatically.
       * A retry can detect the COMPLETED transaction and repair
       * the Order status without crediting the wallet again.
       */
      throw new Error(
        `Wallet and transaction were updated, but order ${order.id} ` +
          "could not be finalized. Retry the function to reconcile the order.",
      );
    }

    order = finalizedOrder;
    orderWasFinalized = true;

    /* --------------------------------------------------------
       16. Return success
       -------------------------------------------------------- */

    console.log(
      `Courier earnings allocated successfully for order ${order.id}.`,
    );

    return successResponse(
      {
        orderID: order.id,
        courierID: courier.id,
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
    console.error("==================================================");
    console.error("allocateCourierEarnings FAILED");
    console.error(error);
    console.error("==================================================");

    /*
     * SAFETY RULE:
     *
     * Only mark the Order FAILED if the wallet update was never
     * attempted and the transaction was not completed.
     *
     * Once the wallet update has been attempted, its outcome might
     * be uncertain. Do not reset the Order to FAILED in that case.
     * That could allow another invocation to credit the wallet twice.
     */
    if (
      allocationClaimed &&
      order &&
      !walletUpdateAttempted &&
      !transactionWasCompleted &&
      !orderWasFinalized
    ) {
      await markAllocationFailed(order);
    }

    /*
     * Mark a PENDING transaction FAILED only when the wallet update
     * was never attempted.
     *
     * If the wallet mutation was attempted, leave the transaction
     * untouched so it can be reconciled safely.
     */
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
