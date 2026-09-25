const fetch = require("node-fetch");

/*
============================================================
ATUA — RELEASE FUNDS
============================================================

PURPOSE
-------

This Lambda handles NORMAL courier earnings releases for:

    MICRO
    MOTO

It does NOT handle:

    MAXI

MAXI orders use:

    releaseCourierMilestoneFunds


------------------------------------------------------------
MICRO / MOTO FINANCIAL FLOW
------------------------------------------------------------

Payment succeeds
        ↓
Paystack webhook
        ↓
paymentStatus = PAID
fundsStatus = HELD
        ↓
Courier assigned
        ↓
allocateCourierEarnings
        ↓
earningsAllocationStatus = ALLOCATED
        ↓
100% courier earnings moved to pendingBalance
        ↓
Order reaches DELIVERED
        ↓
financialOrderTrigger
        ↓
releaseFunds
        ↓
100% courier earnings:

    pendingBalance
          ↓
    availableBalance

        ↓
Order.fundsStatus = RELEASED


------------------------------------------------------------
IMPORTANT FINANCIAL RULES
------------------------------------------------------------

1. Customer payment is NOT processed here.

2. Courier earnings are NOT allocated here.

3. lifetimeEarnings is NOT increased here.

4. This Lambda ONLY moves:

       pendingBalance
              ↓
       availableBalance

5. The EARNINGS-${orderID} transaction created by
   allocateCourierEarnings is used as the ledger proof.

6. The earnings transaction MUST be COMPLETED before
   release is allowed.

7. This Lambda is idempotent.

8. If the order is already RELEASED, the wallet is NOT
   touched again.

9. MAXI orders must NEVER be processed here.

10. Micro/Moto release is:

       HELD → RELEASED

11. lifetimeEarnings MUST NOT change during release.

12. If the wallet changes but the Order cannot be finalized,
    this Lambda attempts a compensating wallet rollback.

============================================================
*/

/* ==========================================================
   ENVIRONMENT VARIABLES
========================================================== */

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

/* ==========================================================
   MAIN HANDLER
========================================================== */

exports.handler = async (event) => {
  console.log("==================================================");
  console.log("ATUA — RELEASE FUNDS");
  console.log("==================================================");

  console.log("EVENT:", JSON.stringify(event));

  console.log("==================================================");

  /* ========================================================
     WORKING VARIABLES
  ======================================================== */

  let orderID = null;
  let order = null;
  let wallet = null;
  let transaction = null;

  let updatedWallet = null;

  let walletUpdated = false;
  let orderUpdated = false;

  let walletBeforeRelease = null;

  try {
    /* ======================================================
       1. GET ORDER ID
    ====================================================== */

    /*
     * Supports:
     *
     * Direct Lambda invocation
     * AppSync
     * EventBridge-style payload
     */

    orderID =
      event?.orderID ||
      event?.arguments?.orderID ||
      event?.detail?.orderID ||
      event?.detail?.orderId;

    if (!orderID) {
      throw new Error("orderID is required.");
    }

    console.log("ORDER ID:", orderID);

    /* ======================================================
       2. GET ORDER
    ====================================================== */

    order = await getOrder(orderID);

    if (!order) {
      throw new Error(`Order ${orderID} was not found.`);
    }

    if (order._deleted === true) {
      throw new Error(`Order ${orderID} has been deleted.`);
    }

    console.log("ORDER:", JSON.stringify(order));

    /* ======================================================
       3. VERIFY PAYMENT
    ====================================================== */

    /*
     * Customer payment must already be successful.
     */

    if (order.paymentStatus !== "PAID") {
      throw new Error(
        `Order ${orderID} is not PAID. ` +
          `Current paymentStatus: ${order.paymentStatus}`,
      );
    }

    /* ======================================================
       4. VERIFY EARNINGS ALLOCATION
    ====================================================== */

    /*
     * allocateCourierEarnings must already have:
     *
     * - calculated courier earnings
     * - increased lifetimeEarnings
     * - increased pendingBalance
     * - created EARNINGS-${orderID}
     * - marked earningsAllocationStatus = ALLOCATED
     */

    if (order.earningsAllocationStatus !== "ALLOCATED") {
      throw new Error(
        `Courier earnings have not been allocated for ` +
          `order ${orderID}. ` +
          `Current earningsAllocationStatus: ` +
          `${order.earningsAllocationStatus}`,
      );
    }

    /* ======================================================
       5. VERIFY COURIER
    ====================================================== */

    const courierID = order.assignedCourierId;

    if (!courierID) {
      throw new Error(`Order ${orderID} has no assigned courier.`);
    }

    console.log("COURIER ID:", courierID);

    /* ======================================================
       6. VERIFY COURIER EARNINGS
    ====================================================== */

    const earnings = normalizeMoney(order.courierEarnings);

    if (earnings <= 0) {
      throw new Error(
        `Invalid courier earnings for order ${orderID}: ` +
          `${order.courierEarnings}`,
      );
    }

    console.log("TOTAL COURIER EARNINGS:", earnings);

    /* ======================================================
       7. VERIFY TRANSPORTATION TYPE
    ====================================================== */

    const transportationType = String(order.transportationType || "")
      .trim()
      .toUpperCase();

    const vehicleClass = String(order.vehicleClass || "")
      .trim()
      .toUpperCase();

    /* ------------------------------------------------------
       MICRO
    ------------------------------------------------------ */

    const isMicro =
      transportationType === "MICRO" ||
      transportationType === "MICRO_EXPRESS" ||
      transportationType === "MICRO_BATCH" ||
      vehicleClass === "MICRO";

    /* ------------------------------------------------------
       MOTO
    ------------------------------------------------------ */

    const isMoto =
      transportationType === "MOTO" ||
      transportationType === "MOTO_EXPRESS" ||
      transportationType === "MOTO_BATCH" ||
      vehicleClass === "MOTO";

    /* ------------------------------------------------------
       MAXI
    ------------------------------------------------------ */

    const isMaxi = transportationType === "MAXI" || vehicleClass === "MAXI";

    console.log("TRANSPORTATION TYPE:", transportationType);

    console.log("VEHICLE CLASS:", vehicleClass);

    /* ======================================================
       7A. MAXI PROTECTION
    ====================================================== */

    if (isMaxi) {
      throw new Error(
        `Order ${orderID} is a MAXI order. ` +
          `MAXI orders must use ` +
          `releaseCourierMilestoneFunds.`,
      );
    }

    /* ======================================================
       7B. ONLY MICRO / MOTO ALLOWED
    ====================================================== */

    if (!isMicro && !isMoto) {
      throw new Error(
        `Order ${orderID} has unsupported ` +
          `transportation type "${transportationType}" ` +
          `and vehicle class "${vehicleClass}".`,
      );
    }

    console.log("RELEASE TYPE:", isMicro ? "MICRO" : "MOTO");

    /* ======================================================
       8. VERIFY ORDER STATUS
    ====================================================== */

    /*
     * Micro/Moto funds are released ONLY after delivery.
     */

    const orderStatus = String(order.status || "")
      .trim()
      .toUpperCase();

    if (orderStatus !== "DELIVERED") {
      throw new Error(
        `Order ${orderID} is not DELIVERED. ` +
          `Current status: ${order.status}`,
      );
    }

    /* ======================================================
       9. ADMIN HOLD
    ====================================================== */

    /*
     * If an administrator has blocked release,
     * do not touch the wallet.
     */

    if (order.fundsReleaseBlocked === true) {
      console.log(`Funds release blocked by admin ` + `for order ${orderID}.`);

      return successResponse({
        message: "Funds release is blocked by admin.",

        orderID,

        courierID,

        transportationType,

        amount: earnings,

        fundsStatus: order.fundsStatus,

        fundsReleasedAmount: normalizeMoney(order.fundsReleasedAmount),

        holdReason: order.fundsHoldReason || null,

        heldBy: order.fundsHeldBy || null,

        heldAt: order.fundsHeldAt || null,

        releaseBlocked: true,
      });
    }

    /* ======================================================
       10. IDEMPOTENCY CHECK
    ====================================================== */

    /*
     * If already RELEASED, never touch wallet again.
     */

    if (order.fundsStatus === "RELEASED") {
      console.log(`Funds already fully released ` + `for order ${orderID}.`);

      return successResponse({
        message: "Courier earnings are already fully released.",

        orderID,

        courierID,

        transportationType,

        amountReleased: normalizeMoney(order.fundsReleasedAmount),

        totalCourierEarnings: earnings,

        fundsReleasedAmount: normalizeMoney(order.fundsReleasedAmount),

        fundsStatus: "RELEASED",

        alreadyProcessed: true,
      });
    }

    /* ======================================================
       11. MICRO/MOTO MUST START FROM HELD
    ====================================================== */

    /*
     * Micro/Moto:
     *
     * HELD → RELEASED
     *
     * PARTIALLY_RELEASED belongs to MAXI.
     */

    if (order.fundsStatus !== "HELD") {
      throw new Error(
        `Order ${orderID} has fundsStatus ` +
          `${order.fundsStatus}. ` +
          `Micro/Moto release requires HELD.`,
      );
    }

    /* ======================================================
       12. VERIFY NOTHING HAS ALREADY BEEN RELEASED
    ====================================================== */

    const currentReleasedAmount = normalizeMoney(order.fundsReleasedAmount);

    if (currentReleasedAmount < 0) {
      throw new Error(
        `Order ${orderID} has an invalid ` + `fundsReleasedAmount.`,
      );
    }

    /*
     * HELD order must not already have a released amount.
     */

    if (currentReleasedAmount > 0) {
      throw new Error(
        `Order ${orderID} has fundsStatus HELD ` +
          `but ${currentReleasedAmount} has already ` +
          `been released. Manual reconciliation is required.`,
      );
    }

    console.log("CURRENTLY RELEASED:", currentReleasedAmount);

    /* ======================================================
       13. GET COURIER
    ====================================================== */

    const courier = await getCourier(courierID);

    if (!courier) {
      throw new Error(`Courier ${courierID} was not found.`);
    }

    if (courier._deleted === true) {
      throw new Error(`Courier ${courierID} has been deleted.`);
    }

    /* ======================================================
       14. GET COURIER WALLET
    ====================================================== */

    wallet = await findCourierWallet(courier);

    if (!wallet) {
      throw new Error(
        `No wallet was found for courier ${courierID}. ` +
          `Courier earnings must be allocated before ` +
          `funds can be released.`,
      );
    }

    /* ======================================================
       15. VERIFY WALLET OWNER
    ====================================================== */

    if (wallet.ownerID !== courierID) {
      throw new Error(
        `Wallet ${wallet.id} belongs to ` +
          `${wallet.ownerID}, not courier ${courierID}.`,
      );
    }

    if (wallet.ownerType !== "COURIER") {
      throw new Error(`Wallet ${wallet.id} is not a COURIER wallet.`);
    }

    console.log("WALLET:", JSON.stringify(wallet));

    /* ======================================================
       16. READ WALLET BALANCES
    ====================================================== */

    const currentPendingBalance = normalizeMoney(wallet.pendingBalance);

    const currentAvailableBalance = normalizeMoney(wallet.availableBalance);

    const currentLifetimeEarnings = normalizeMoney(wallet.lifetimeEarnings);

    console.log("CURRENT PENDING BALANCE:", currentPendingBalance);

    console.log("CURRENT AVAILABLE BALANCE:", currentAvailableBalance);

    console.log("CURRENT LIFETIME EARNINGS:", currentLifetimeEarnings);

    /* ======================================================
       17. VERIFY WALLET BALANCES
    ====================================================== */

    if (currentPendingBalance < 0) {
      throw new Error(`Wallet ${wallet.id} has a negative pendingBalance.`);
    }

    if (currentAvailableBalance < 0) {
      throw new Error(`Wallet ${wallet.id} has a negative availableBalance.`);
    }

    /* ======================================================
       18. VERIFY PENDING BALANCE
    ====================================================== */

    if (currentPendingBalance < earnings) {
      throw new Error(
        `Insufficient pending balance for order ${orderID}. ` +
          `Pending: ${currentPendingBalance}. ` +
          `Required: ${earnings}.`,
      );
    }

    console.log("PENDING BALANCE CHECK PASSED.");

    /* ======================================================
       19. SAVE WALLET SNAPSHOT FOR ROLLBACK
    ====================================================== */

    walletBeforeRelease = {
      availableBalance: currentAvailableBalance,

      pendingBalance: currentPendingBalance,

      lifetimeEarnings: currentLifetimeEarnings,

      _version: wallet._version,
    };

    /* ======================================================
       20. CALCULATE NEW WALLET BALANCES
    ====================================================== */

    const newPendingBalance = normalizeMoney(currentPendingBalance - earnings);

    const newAvailableBalance = normalizeMoney(
      currentAvailableBalance + earnings,
    );

    console.log(
      "MICRO/MOTO RELEASE CALCULATION:",
      JSON.stringify({
        totalEarnings: earnings,

        amountBeingReleased: earnings,

        previousPendingBalance: currentPendingBalance,

        newPendingBalance,

        previousAvailableBalance: currentAvailableBalance,

        newAvailableBalance,

        lifetimeEarnings: currentLifetimeEarnings,
      }),
    );

    /* ======================================================
       21. FIND EARNINGS TRANSACTION
    ====================================================== */

    const transactionReference = `EARNINGS-${orderID}`;

    transaction = await getTransactionByReference(transactionReference);

    if (!transaction) {
      throw new Error(
        `Earnings transaction ` +
          `${transactionReference} was not found. ` +
          `Allocation ledger must be reconciled ` +
          `before Micro/Moto funds can be released.`,
      );
    }

    console.log("EARNINGS TRANSACTION:", JSON.stringify(transaction));

    /* ======================================================
       22. VERIFY EARNINGS TRANSACTION
    ====================================================== */

    verifyEarningsTransaction({
      transaction,

      walletID: wallet.id,

      orderID,

      earnings,
    });

    console.log("EARNINGS TRANSACTION VALIDATION PASSED.");

    /* ======================================================
       23. UPDATE WALLET
    ====================================================== */

    updatedWallet = await updateWallet(
      wallet,

      newAvailableBalance,

      newPendingBalance,

      currentLifetimeEarnings,
    );

    if (!updatedWallet) {
      throw new Error(
        `Wallet ${wallet.id} could not be updated ` +
          `for Micro/Moto funds release.`,
      );
    }

    walletUpdated = true;

    console.log("WALLET UPDATED:", JSON.stringify(updatedWallet));

    /* ======================================================
       24. UPDATE ORDER
    ====================================================== */

    const releaseTimestamp = new Date().toISOString();

    const updatedOrder = await finalizeRelease({
      order,

      earnings,

      releaseTimestamp,
    });

    if (!updatedOrder) {
      throw new Error(
        `Order ${orderID} could not be marked ` +
          `RELEASED after Micro/Moto funds release.`,
      );
    }

    orderUpdated = true;

    console.log("ORDER UPDATED:", JSON.stringify(updatedOrder));

    /* ======================================================
       25. SUCCESS
    ====================================================== */

    console.log("==================================================");

    console.log("MICRO/MOTO FUNDS RELEASE SUCCESSFUL");

    console.log("==================================================");

    return successResponse({
      message: "100% of Micro/Moto courier earnings released.",

      orderID,

      courierID,

      transportationType,

      amountReleased: earnings,

      totalCourierEarnings: earnings,

      previousPendingBalance: currentPendingBalance,

      remainingPendingBalance: newPendingBalance,

      previousAvailableBalance: currentAvailableBalance,

      availableBalance: newAvailableBalance,

      lifetimeEarnings: currentLifetimeEarnings,

      fundsStatus: "RELEASED",

      fundsReleasedAmount: earnings,

      fundsReleasedAt: releaseTimestamp,

      releaseType: "MICRO_MOTO_DELIVERY",

      alreadyProcessed: false,
    });
  } catch (error) {
    /* ======================================================
       ERROR HANDLING
    ====================================================== */

    console.error("==================================================");

    console.error("ATUA — RELEASE FUNDS FAILED");

    console.error("MESSAGE:", error?.message);

    console.error("STACK:", error?.stack);

    console.error("==================================================");

    /* ======================================================
       COMPENSATING WALLET ROLLBACK
    ====================================================== */

    if (
      walletUpdated &&
      !orderUpdated &&
      updatedWallet &&
      walletBeforeRelease
    ) {
      console.warn("Attempting Micro/Moto wallet rollback...");

      try {
        const rolledBackWallet = await updateWallet(
          updatedWallet,

          walletBeforeRelease.availableBalance,

          walletBeforeRelease.pendingBalance,

          walletBeforeRelease.lifetimeEarnings,
        );

        if (!rolledBackWallet) {
          throw new Error("Wallet rollback returned no wallet.");
        }

        walletUpdated = false;

        console.log(
          "MICRO/MOTO WALLET ROLLBACK SUCCESS:",
          JSON.stringify(rolledBackWallet),
        );
      } catch (rollbackError) {
        console.error(
          "CRITICAL: MICRO/MOTO WALLET ROLLBACK FAILED",
          rollbackError,
        );

        const reconciliationError = new Error(
          `CRITICAL FINANCIAL RECONCILIATION REQUIRED: ` +
            `wallet ${updatedWallet?.id || "unknown"} ` +
            `was changed during releaseFunds but rollback failed. ` +
            `Original error: ${error?.message || "Unknown error"}. ` +
            `Rollback error: ${rollbackError?.message || "Unknown error"}`,
        );

        reconciliationError.originalError = error?.message || null;

        reconciliationError.rollbackError = rollbackError?.message || null;

        reconciliationError.orderID = orderID;

        reconciliationError.courierID = order?.assignedCourierId || null;

        reconciliationError.reconciliationRequired = true;

        throw reconciliationError;
      }
    }

    /* ======================================================
       FINAL ERROR
    ====================================================== */

    const releaseError = new Error(
      error?.message || "Micro/Moto funds release failed.",
    );

    releaseError.orderID = orderID;

    releaseError.courierID = order?.assignedCourierId || null;

    releaseError.transportationType = order?.transportationType || null;

    releaseError.reconciliationRequired = false;

    throw releaseError;
  }
};
// ============================================================
// ATUA — RELEASE FUNDS
// PART 2 OF 3
//
// HELPER FUNCTIONS
//
// ONLY:
//   MICRO
//   MOTO
//
// MAXI is handled by:
//   releaseCourierMilestoneFunds
// ============================================================

// ============================================================
// GET ORDER
// ============================================================

async function getOrder(orderID) {
  if (!orderID) {
    return null;
  }

  const response = await graphqlRequest(getOrderQuery, {
    id: orderID,
  });

  const order = response?.data?.getOrder;

  if (!order || order._deleted) {
    return null;
  }

  return order;
}

// ============================================================
// GET COURIER
// ============================================================

async function getCourier(courierID) {
  if (!courierID) {
    return null;
  }

  const response = await graphqlRequest(getCourierQuery, {
    id: courierID,
  });

  const courier = response?.data?.getCourier;

  if (!courier || courier._deleted) {
    return null;
  }

  return courier;
}

// ============================================================
// FIND COURIER WALLET
// ============================================================
//
// First tries:
//
//     Courier.walletID
//
// If unavailable, falls back to:
//
//     Wallet.ownerID
//     Wallet.ownerType = COURIER
//
// If multiple active wallets exist,
// STOP instead of choosing one randomly.
// ============================================================

async function findCourierWallet(courier) {
  if (!courier || !courier.id) {
    throw new Error("Courier is required to find wallet.");
  }

  /* ========================================================
     1. USE COURIER WALLET ID
  ======================================================== */

  if (courier.walletID) {
    const wallet = await getWalletByID(courier.walletID);

    if (wallet) {
      if (wallet.ownerID !== courier.id) {
        throw new Error(
          `Courier wallet ownership mismatch. ` +
            `Wallet ${wallet.id} does not belong ` +
            `to courier ${courier.id}.`,
        );
      }

      if (wallet.ownerType !== "COURIER") {
        throw new Error(`Wallet ${wallet.id} is not a COURIER wallet.`);
      }

      return wallet;
    }

    console.warn(
      `Courier ${courier.id} has walletID ` +
        `${courier.walletID}, but that wallet was not found. ` +
        `Falling back to owner lookup.`,
    );
  }

  /* ========================================================
     2. FALLBACK OWNER LOOKUP
  ======================================================== */

  const walletResponse = await graphqlRequest(
    listWalletsQuery,

    {
      filter: {
        ownerID: {
          eq: courier.id,
        },

        ownerType: {
          eq: "COURIER",
        },

        _deleted: {
          ne: true,
        },
      },

      limit: 100,
    },
  );

  const wallets = walletResponse?.data?.listWallets?.items || [];

  /* ========================================================
     NO WALLET
  ======================================================== */

  if (wallets.length === 0) {
    return null;
  }

  /* ========================================================
     DUPLICATE WALLETS
  ======================================================== */

  if (wallets.length > 1) {
    throw new Error(
      `Multiple active COURIER wallets found ` +
        `for courier ${courier.id}. ` +
        `Manual reconciliation required ` +
        `before releasing funds.`,
    );
  }

  return wallets[0];
}

// ============================================================
// GET WALLET BY ID
// ============================================================

async function getWalletByID(walletID) {
  if (!walletID) {
    return null;
  }

  const response = await graphqlRequest(
    getWalletQuery,

    {
      id: walletID,
    },
  );

  const wallet = response?.data?.getWallet;

  if (!wallet || wallet._deleted) {
    return null;
  }

  return wallet;
}

// ============================================================
// GET EARNINGS TRANSACTION
// ============================================================
//
// Expected:
//
//     EARNINGS-${orderID}
//
// Exactly ONE active transaction must exist.
// ============================================================

async function getTransactionByReference(reference) {
  if (!reference) {
    return null;
  }

  const response = await graphqlRequest(
    listTransactionsQuery,

    {
      filter: {
        reference: {
          eq: reference,
        },

        _deleted: {
          ne: true,
        },
      },

      limit: 100,
    },
  );

  const transactions = response?.data?.listTransactions?.items || [];

  /* ========================================================
     NO TRANSACTION
  ======================================================== */

  if (transactions.length === 0) {
    return null;
  }

  /* ========================================================
     DUPLICATE TRANSACTIONS
  ======================================================== */

  if (transactions.length > 1) {
    throw new Error(
      `Multiple active transactions found ` +
        `for reference ${reference}. ` +
        `Manual reconciliation required.`,
    );
  }

  return transactions[0];
}

// ============================================================
// VERIFY EARNINGS TRANSACTION
// ============================================================
//
// Must be:
//
//   CREDIT
//   COMPLETED
//   correct wallet
//   correct order
//   correct amount
// ============================================================

function verifyEarningsTransaction({
  transaction,

  walletID,

  orderID,

  earnings,
}) {
  if (!transaction) {
    throw new Error(
      `Earnings transaction not found ` + `for order ${orderID}.`,
    );
  }

  /* ========================================================
     WALLET CHECK
  ======================================================== */

  if (transaction.walletID !== walletID) {
    throw new Error(
      `Earnings transaction wallet mismatch ` + `for order ${orderID}.`,
    );
  }

  /* ========================================================
     ORDER CHECK
  ======================================================== */

  if (transaction.orderID !== orderID) {
    throw new Error(
      `Earnings transaction order mismatch ` + `for order ${orderID}.`,
    );
  }

  /* ========================================================
     CREDIT CHECK
  ======================================================== */

  if (transaction.type !== "CREDIT") {
    throw new Error(
      `Earnings transaction for order ${orderID} ` +
        `is not a CREDIT transaction.`,
    );
  }

  /* ========================================================
     AMOUNT CHECK
  ======================================================== */

  const transactionAmount = normalizeMoney(transaction.amount);

  const expectedAmount = normalizeMoney(earnings);

  if (transactionAmount !== expectedAmount) {
    throw new Error(
      `Earnings transaction amount mismatch ` +
        `for order ${orderID}. ` +
        `Expected ${expectedAmount}, ` +
        `got ${transactionAmount}.`,
    );
  }

  /* ========================================================
     STATUS CHECK
  ======================================================== */

  /*
   * IMPORTANT:
   *
   * PENDING is NOT accepted.
   *
   * Allocation must already be completely
   * recorded before release.
   */

  if (transaction.status !== "COMPLETED") {
    throw new Error(
      `Earnings transaction for order ${orderID} ` +
        `is not COMPLETED. ` +
        `Current status: ${transaction.status}.`,
    );
  }

  return true;
}

// ============================================================
// UPDATE WALLET
// ============================================================
//
// Micro/Moto:
//
//     pendingBalance -= earnings
//     availableBalance += earnings
//
// lifetimeEarnings does NOT change.
// ============================================================

async function updateWallet(
  wallet,

  availableBalance,

  pendingBalance,

  lifetimeEarnings,
) {
  if (!wallet || !wallet.id) {
    throw new Error("Wallet is required for wallet update.");
  }

  const input = {
    id: wallet.id,

    availableBalance: normalizeMoney(availableBalance),

    pendingBalance: normalizeMoney(pendingBalance),

    lifetimeEarnings: normalizeMoney(lifetimeEarnings),
  };

  /* ========================================================
     VERSION
  ======================================================== */

  if (wallet._version !== undefined && wallet._version !== null) {
    input._version = wallet._version;
  }

  const response = await graphqlRequest(
    updateWalletMutation,

    {
      input,
    },
  );

  const updatedWallet = response?.data?.updateWallet;

  if (!updatedWallet) {
    throw new Error(`Wallet update returned no wallet ` + `for ${wallet.id}.`);
  }

  return updatedWallet;
}

// ============================================================
// FINALIZE ORDER RELEASE
// ============================================================
//
// Changes:
//
//     fundsStatus
//         HELD → RELEASED
//
//     fundsReleasedAmount
//         = 100% courier earnings
//
//     fundsReleaseType
//         = MICRO_MOTO_DELIVERY
//
// The mutation is conditionally protected by:
//
//     status = DELIVERED
//     fundsStatus = HELD
//     earningsAllocationStatus = ALLOCATED
// ============================================================

async function finalizeRelease({
  order,

  earnings,

  releaseTimestamp,
}) {
  if (!order || !order.id) {
    throw new Error("Order is required to finalize funds release.");
  }

  const input = {
    id: order.id,

    fundsStatus: "RELEASED",

    fundsReleasedAmount: normalizeMoney(earnings),

    fundsReleasedAt: releaseTimestamp,

    fundsReleaseType: "MICRO_MOTO_DELIVERY",
  };

  /* ========================================================
     VERSION
  ======================================================== */

  if (order._version !== undefined && order._version !== null) {
    input._version = order._version;
  }

  /* ========================================================
     CONDITIONAL UPDATE
  ======================================================== */

  const condition = {
    status: {
      eq: "DELIVERED",
    },

    fundsStatus: {
      eq: "HELD",
    },

    earningsAllocationStatus: {
      eq: "ALLOCATED",
    },
  };

  const response = await graphqlRequest(
    updateOrderMutation,

    {
      input,

      condition,
    },
  );

  const updatedOrder = response?.data?.updateOrder;

  if (!updatedOrder) {
    throw new Error(
      `Order finalization returned no Order ` + `for ${order.id}.`,
    );
  }

  return updatedOrder;
}

// ============================================================
// NORMALIZE MONEY
// ============================================================

function normalizeMoney(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`Invalid monetary value: ${value}`);
  }

  return Number(number.toFixed(2));
}

// ============================================================
// SUCCESS RESPONSE
// ============================================================

function successResponse(body) {
  return {
    statusCode: 200,

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(body),
  };
}

// ============================================================
// GRAPHQL REQUEST HELPER
// ============================================================

async function graphqlRequest(
  query,

  variables = {},
) {
  /*
   * IMPORTANT:
   *
   * Use the same environment variables declared
   * at the top of Part 1.
   */

  const endpoint = GRAPHQL_ENDPOINT;

  const apiKey = API_KEY;

  if (!endpoint) {
    throw new Error(
      "API_ATUA_GRAPHQLAPIENDPOINTOUTPUT " + "environment variable is missing.",
    );
  }

  if (!apiKey) {
    throw new Error(
      "API_ATUA_GRAPHQLAPIKEYOUTPUT " + "environment variable is missing.",
    );
  }

  const response = await fetch(
    endpoint,

    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",

        "x-api-key": apiKey,
      },

      body: JSON.stringify({
        query,

        variables,
      }),
    },
  );

  let payload;

  try {
    payload = await response.json();
  } catch (error) {
    throw new Error(
      `AppSync returned invalid JSON. ` + `HTTP status: ${response.status}`,
    );
  }

  /* ========================================================
     HTTP ERROR
  ======================================================== */

  if (!response.ok) {
    throw new Error(
      `AppSync HTTP error ${response.status}: ` + `${JSON.stringify(payload)}`,
    );
  }

  /* ========================================================
     GRAPHQL ERROR
  ======================================================== */

  if (payload.errors && payload.errors.length > 0) {
    throw new Error(
      `AppSync GraphQL error: ` +
        `${payload.errors.map((error) => error.message).join("; ")}`,
    );
  }

  return payload;
}
// ============================================================
// ATUA — RELEASE FUNDS
// PART 3 OF 3
//
// GRAPHQL QUERIES & MUTATIONS
//
// ONLY:
//   MICRO
//   MOTO
//
// MAXI is handled separately by:
//   releaseCourierMilestoneFunds
// ============================================================

// ============================================================
// GET ORDER
// ============================================================
//
// IMPORTANT:
//
// The handler uses:
//
//     assignedCourierId
//     vehicleClass
//
// Therefore BOTH fields must be requested here.
// ============================================================

const getOrderQuery = /* GraphQL */ `
  query GetOrder($id: ID!) {
    getOrder(id: $id) {
      id
      status
      assignedCourierId
      transportationType
      vehicleClass

      totalPrice
      operationalFare
      courierEarnings
      commissionAmount
      platformFee
      platformServiceRevenue
      vatAmount
      platformNetRevenue

      paymentStatus
      paymentID
      paymentReference
      payoutStatus

      fundsStatus
      earningsAllocationStatus
      earningsAllocatedAt

      fundsReleaseBlocked
      fundsHoldReason
      fundsHeldBy
      fundsHeldAt

      fundsReleasedAmount
      pickupFundsReleasedAt
      fundsReleasedAt
      fundsReleaseType

      _version
      _deleted
    }
  }
`;

// ============================================================
// GET WALLET
// ============================================================

const getWalletQuery = /* GraphQL */ `
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

// ============================================================
// LIST WALLETS
// ============================================================
//
// Used when Courier.walletID is unavailable.
//
// Search:
//
//     ownerID = courier.id
//     ownerType = COURIER
//
// ============================================================

const listWalletsQuery = /* GraphQL */ `
  query ListWallets($filter: ModelWalletFilterInput, $limit: Int) {
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

// ============================================================
// LIST TRANSACTIONS
// ============================================================
//
// Used to locate:
//
//     EARNINGS-${orderID}
//
// The transaction must then be verified by:
//     verifyEarningsTransaction()
// ============================================================

const listTransactionsQuery = /* GraphQL */ `
  query ListTransactions($filter: ModelTransactionFilterInput, $limit: Int) {
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

// ============================================================
// GET COURIER
// ============================================================

const getCourierQuery = /* GraphQL */ `
  query GetCourier($id: ID!) {
    getCourier(id: $id) {
      id

      walletID

      _version

      _deleted
    }
  }
`;

// ============================================================
// UPDATE WALLET
// ============================================================
//
// Micro/Moto release:
//
//     pendingBalance
//            ↓
//     availableBalance
//
// lifetimeEarnings is preserved at its existing value.
//
// _version is supplied by updateWallet() when available.
// ============================================================

const updateWalletMutation = /* GraphQL */ `
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

// ============================================================
// UPDATE ORDER
// ============================================================
//
// finalizeRelease() supplies the condition:
//
//     status = DELIVERED
//     fundsStatus = HELD
//     earningsAllocationStatus = ALLOCATED
//
// This prevents an outdated Lambda invocation from finalizing
// an Order whose financial state has changed.
// ============================================================

const updateOrderMutation = /* GraphQL */ `
  mutation UpdateOrder(
    $input: UpdateOrderInput!
    $condition: ModelOrderConditionInput
  ) {
    updateOrder(input: $input, condition: $condition) {
      id

      status

      assignedCourierId

      transportationType

      vehicleClass

      courierEarnings

      paymentStatus

      paymentID

      paymentReference

      fundsStatus

      earningsAllocationStatus

      earningsAllocatedAt

      fundsReleasedAmount

      fundsReleasedAt

      fundsReleaseType

      _version

      _deleted
    }
  }
`;
