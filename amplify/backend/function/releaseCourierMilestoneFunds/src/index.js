const fetch = require("node-fetch");

/*
============================================================
ATUA — RELEASE COURIER MILESTONE FUNDS
============================================================

MAXI FINANCIAL FLOW

    EARNINGS ALLOCATED
            ↓
    pendingBalance = 100%
            ↓
        PICKED_UP
            ↓
       RELEASE 50%
            ↓
    PARTIALLY_RELEASED
            ↓
        DELIVERED
            ↓
   RELEASE REMAINING
            ↓
         RELEASED


IMPORTANT

This Lambda:

- ONLY processes MAXI orders
- Does NOT process customer payments
- Does NOT allocate courier earnings
- Does NOT increase lifetimeEarnings
- Does NOT process Paystack payouts
- Does NOT send bank transfers
- Respects admin funds holds


WALLET MOVEMENT

    pendingBalance
           ↓
    availableBalance


STATE MACHINE

    HELD
      ↓
PICKED_UP
      ↓
PARTIALLY_RELEASED
      ↓
DELIVERED
      ↓
RELEASED


IMPORTANT:

DELIVERED is NOT allowed to move:

    HELD → RELEASED

The pickup milestone MUST happen first.
============================================================
*/

/*
============================================================
ENVIRONMENT VARIABLES
============================================================
*/

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

/*
============================================================
MONEY NORMALIZATION
============================================================

All financial calculations are normalized to 2 decimal
places.

This function was missing from the previous deployed
version and caused:

    ReferenceError: normalizeMoney is not defined
============================================================
*/

function normalizeMoney(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`Invalid monetary value: ${value}`);
  }

  return Math.round((number + Number.EPSILON) * 100) / 100;
}

/*
============================================================
MAIN HANDLER
============================================================
*/

exports.handler = async (event) => {
  console.log("==========================================");
  console.log("ATUA MAXI MILESTONE FUND RELEASE");
  console.log("==========================================");

  console.log("EVENT:", JSON.stringify(event));

  let orderID = null;

  try {
    /*
    ==========================================================
    1. GET ORDER ID
    ==========================================================
    */

    orderID =
      event?.orderID ||
      event?.arguments?.orderID ||
      event?.detail?.orderID ||
      event?.detail?.orderId;

    if (!orderID) {
      throw new Error("orderID is required.");
    }

    /*
    ==========================================================
    2. GET REQUESTED MILESTONE
    ==========================================================
    */

    let requestedMilestone =
      event?.milestone ||
      event?.arguments?.milestone ||
      event?.detail?.milestone ||
      null;

    if (requestedMilestone) {
      requestedMilestone = String(requestedMilestone).toUpperCase();
    }

    console.log("ORDER ID:", orderID);
    console.log("REQUESTED MILESTONE:", requestedMilestone);

    /*
    ==========================================================
    3. GET ORDER
    ==========================================================
    */

    const order = await getOrder(orderID);

    if (!order) {
      throw new Error(`Order not found: ${orderID}`);
    }

    console.log("ORDER:", JSON.stringify(order));

    /*
    ==========================================================
    4. VERIFY PAYMENT
    ==========================================================
    */

    if (order.paymentStatus !== "PAID") {
      throw new Error(
        `Order ${orderID} is not PAID. ` +
          `Current paymentStatus: ${order.paymentStatus}`,
      );
    }

    /*
    ==========================================================
    5. VERIFY EARNINGS ALLOCATION
    ==========================================================
    */

    if (order.earningsAllocationStatus !== "ALLOCATED") {
      throw new Error(
        `Courier earnings have not been allocated for ` +
          `order ${orderID}. ` +
          `Current status: ${order.earningsAllocationStatus}`,
      );
    }

    /*
    ==========================================================
    6. GET ASSIGNED COURIER
    ==========================================================
    */

    const courierID = order.assignedCourierId;

    if (!courierID) {
      throw new Error(`Order ${orderID} has no assigned courier.`);
    }

    console.log("COURIER ID:", courierID);

    /*
    ==========================================================
    7. VERIFY COURIER EARNINGS
    ==========================================================
    */

    const earnings = normalizeMoney(order.courierEarnings);

    if (earnings <= 0) {
      throw new Error(
        `Invalid courier earnings for order ${orderID}: ` +
          `${order.courierEarnings}`,
      );
    }

    console.log("TOTAL COURIER EARNINGS:", earnings);

    /*
    ==========================================================
    8. VERIFY MAXI ORDER
    ==========================================================
    */

    const transportationType = String(
      order.transportationType || "",
    ).toUpperCase();

    const vehicleClass = String(order.vehicleClass || "").toUpperCase();

    const isMaxi = transportationType === "MAXI" || vehicleClass === "MAXI";

    if (!isMaxi) {
      throw new Error(
        `Order ${orderID} is not a MAXI order. ` +
          `transportationType=${order.transportationType}, ` +
          `vehicleClass=${order.vehicleClass}`,
      );
    }

    console.log("MAXI ORDER VERIFIED");

    /*
    ==========================================================
    9. DETERMINE MILESTONE
    ==========================================================
    */

    const milestone =
      requestedMilestone || String(order.status || "").toUpperCase();

    if (milestone !== "PICKED_UP" && milestone !== "DELIVERED") {
      throw new Error(
        `Unsupported Maxi milestone: ${milestone}. ` +
          `Expected PICKED_UP or DELIVERED.`,
      );
    }

    console.log("MAXI MILESTONE:", milestone);

    /*
    ==========================================================
    10. VERIFY MILESTONE MATCHES ORDER STATUS
    ==========================================================

    Prevents a caller from sending:

        milestone = PICKED_UP

    while the Order is actually:

        DELIVERED

    or vice versa.
    ==========================================================
    */

    const actualOrderStatus = String(order.status || "").toUpperCase();

    if (milestone === "PICKED_UP" && actualOrderStatus !== "PICKED_UP") {
      throw new Error(
        `Milestone mismatch for order ${orderID}. ` +
          `Requested PICKED_UP but Order.status is ` +
          `${actualOrderStatus}.`,
      );
    }

    if (milestone === "DELIVERED" && actualOrderStatus !== "DELIVERED") {
      throw new Error(
        `Milestone mismatch for order ${orderID}. ` +
          `Requested DELIVERED but Order.status is ` +
          `${actualOrderStatus}.`,
      );
    }

    /*
    ==========================================================
    11. ADMIN FUNDS HOLD
    ==========================================================
    */

    if (order.fundsReleaseBlocked === true) {
      console.log(`Funds release blocked by admin for order ${orderID}`);

      return successResponse({
        message: "Funds release is blocked by admin.",
        orderID,
        courierID,
        milestone,
        fundsStatus: order.fundsStatus,
        fundsReleasedAmount: normalizeMoney(order.fundsReleasedAmount || 0),
        holdReason: order.fundsHoldReason || null,
        heldBy: order.fundsHeldBy || null,
        heldAt: order.fundsHeldAt || null,
        releaseBlocked: true,
      });
    }

    /*
    ==========================================================
    12. CURRENT RELEASED AMOUNT
    ==========================================================
    */

    const currentReleasedAmount = normalizeMoney(
      order.fundsReleasedAmount || 0,
    );

    if (currentReleasedAmount < 0) {
      throw new Error(`Invalid fundsReleasedAmount for order ${orderID}.`);
    }

    if (currentReleasedAmount > earnings + 0.01) {
      throw new Error(
        `Order ${orderID} has released more funds than ` +
          `its courier earnings.`,
      );
    }

    /*
    ==========================================================
    13. PROCESS PICKUP
    ==========================================================
    */

    if (milestone === "PICKED_UP") {
      return await processMaxiPickup({
        order,
        orderID,
        courierID,
        earnings,
        currentReleasedAmount,
      });
    }

    /*
    ==========================================================
    14. PROCESS DELIVERY
    ==========================================================
    */

    if (milestone === "DELIVERED") {
      return await processMaxiDelivery({
        order,
        orderID,
        courierID,
        earnings,
        currentReleasedAmount,
      });
    }

    throw new Error(`Unsupported milestone: ${milestone}`);
  } catch (error) {
    console.error("==========================================");
    console.error("ATUA MAXI MILESTONE RELEASE ERROR");
    console.error("ORDER ID:", orderID);
    console.error("MESSAGE:", error?.message);
    console.error("STACK:", error?.stack);
    console.error("==========================================");

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: error?.message || "Maxi milestone release failed.",
        orderID,
      }),
    };
  }
};

/*
============================================================
PROCESS MAXI PICKUP
============================================================

PICKED_UP:

    HELD
      ↓
PARTIALLY_RELEASED

Releases exactly 50%.

Example:

    courierEarnings = 15,120

    pickup release = 7,560

Wallet:

    pendingBalance -= 7,560
    availableBalance += 7,560

Order:

    fundsStatus = PARTIALLY_RELEASED
    fundsReleasedAmount = 7,560
============================================================
*/

async function processMaxiPickup({
  order,
  orderID,
  courierID,
  earnings,
  currentReleasedAmount,
}) {
  console.log(`Processing MAXI PICKED_UP for ${orderID}`);

  /*
  ==========================================================
  1. IDEMPOTENCY
  ==========================================================
  */

  if (
    order.fundsStatus === "PARTIALLY_RELEASED" ||
    order.fundsStatus === "RELEASED"
  ) {
    console.log(`Pickup milestone already processed for ${orderID}`);

    return successResponse({
      message: "Pickup milestone has already been processed.",
      orderID,
      courierID,
      milestone: "PICKED_UP",
      fundsStatus: order.fundsStatus,
      fundsReleasedAmount: currentReleasedAmount,
      alreadyProcessed: true,
    });
  }

  /*
  ==========================================================
  2. PICKUP MUST START FROM HELD
  ==========================================================
  */

  if (order.fundsStatus !== "HELD") {
    throw new Error(
      `Order ${orderID} has unexpected fundsStatus ` +
        `${order.fundsStatus}. Pickup release requires HELD.`,
    );
  }

  /*
  ==========================================================
  3. NO PREVIOUS RELEASE
  ==========================================================
  */

  if (Math.abs(currentReleasedAmount) > 0.01) {
    throw new Error(
      `Order ${orderID} has fundsReleasedAmount ` +
        `${currentReleasedAmount} but is still HELD. ` +
        `Financial state requires reconciliation.`,
    );
  }

  /*
  ==========================================================
  4. GET COURIER WALLET
  ==========================================================
  */

  const wallet = await getCourierWallet(courierID);

  if (!wallet) {
    throw new Error(`Wallet not found for courier ${courierID}`);
  }

  /*
  ==========================================================
  5. VERIFY WALLET
  ==========================================================
  */

  verifyCourierWallet(wallet, courierID);

  /*
  ==========================================================
  6. VERIFY ORIGINAL EARNINGS TRANSACTION
  ==========================================================

  The original allocation transaction must exist.

      EARNINGS-${orderID}

  This prevents the Lambda from releasing money merely
  because Order.courierEarnings contains a value.
  ==========================================================
  */

  const earningsReference = `EARNINGS-${orderID}`;

  const earningsTransaction =
    await getTransactionByReference(earningsReference);

  verifyEarningsTransaction({
    transaction: earningsTransaction,
    walletID: wallet.id,
    orderID,
    earnings,
  });

  /*
  ==========================================================
  7. CALCULATE 50%
  ==========================================================
  */

  const firstReleaseAmount = normalizeMoney(earnings / 2);

  if (firstReleaseAmount <= 0) {
    throw new Error("Calculated Maxi pickup release amount is invalid.");
  }

  console.log("PICKUP RELEASE AMOUNT:", firstReleaseAmount);

  /*
  ==========================================================
  8. READ WALLET
  ==========================================================
  */

  const pendingBalance = normalizeMoney(wallet.pendingBalance || 0);

  const availableBalance = normalizeMoney(wallet.availableBalance || 0);

  const lifetimeEarnings = normalizeMoney(wallet.lifetimeEarnings || 0);

  /*
  ==========================================================
  9. VERIFY PENDING BALANCE
  ==========================================================
  */

  if (pendingBalance < firstReleaseAmount) {
    throw new Error(
      `Insufficient pending balance. ` +
        `Pending=${pendingBalance}, ` +
        `required=${firstReleaseAmount}`,
    );
  }

  /*
  ==========================================================
  10. CALCULATE NEW WALLET BALANCES
  ==========================================================
  */

  const newPendingBalance = normalizeMoney(pendingBalance - firstReleaseAmount);

  const newAvailableBalance = normalizeMoney(
    availableBalance + firstReleaseAmount,
  );

  /*
  ==========================================================
  11. SAVE ORIGINAL WALLET STATE
  ==========================================================
  */

  const originalWalletState = {
    availableBalance,
    pendingBalance,
    lifetimeEarnings,
  };

  /*
  ==========================================================
  12. UPDATE WALLET
  ==========================================================
  */

  let walletUpdated = false;
  let updatedWallet = null;

  try {
    updatedWallet = await updateWallet({
      wallet,
      availableBalance: newAvailableBalance,
      pendingBalance: newPendingBalance,
    });

    walletUpdated = true;

    /*
    ========================================================
    13. UPDATE ORDER
    ========================================================
    */

    const timestamp = new Date().toISOString();

    const orderUpdate = await updateOrder({
      order,
      fundsStatus: "PARTIALLY_RELEASED",
      fundsReleasedAmount: firstReleaseAmount,
      pickupFundsReleasedAt: timestamp,
      fundsReleaseType: "MAXI_PICKUP",
    });

    if (!orderUpdate) {
      throw new Error(
        "Wallet was updated but Order could not " +
          "be updated for Maxi pickup release.",
      );
    }

    /*
    ========================================================
    14. SUCCESS
    ========================================================
    */

    console.log(`MAXI pickup release successful for ${orderID}`);

    return successResponse({
      message: "50% of Maxi courier earnings released at pickup.",
      orderID,
      courierID,
      milestone: "PICKED_UP",
      amountReleased: firstReleaseAmount,
      totalCourierEarnings: earnings,
      fundsReleasedAmount: firstReleaseAmount,
      remainingPendingBalance: newPendingBalance,
      availableBalance: newAvailableBalance,
      lifetimeEarnings,
      fundsStatus: "PARTIALLY_RELEASED",
      pickupFundsReleasedAt: timestamp,
      releaseType: "MAXI_PICKUP",
    });
  } catch (error) {
    /*
    ========================================================
    15. ROLLBACK WALLET
    ========================================================
    */

    if (walletUpdated && updatedWallet) {
      console.error(`Attempting wallet rollback for pickup ${orderID}`);

      try {
        await rollbackWallet({
          wallet: updatedWallet,
          availableBalance: originalWalletState.availableBalance,
          pendingBalance: originalWalletState.pendingBalance,
        });

        console.log(`Pickup wallet rollback successful for ${orderID}`);
      } catch (rollbackError) {
        console.error(
          `CRITICAL: Pickup wallet rollback failed for ${orderID}`,
          rollbackError,
        );

        throw new Error(
          `CRITICAL RECONCILIATION REQUIRED: ` +
            `wallet was updated but Order update failed, ` +
            `and wallet rollback also failed. ` +
            `orderID=${orderID}. ` +
            `Original error=${error.message}. ` +
            `Rollback error=${rollbackError.message}`,
        );
      }
    }

    throw error;
  }
}

/*
============================================================
PROCESS MAXI DELIVERY
============================================================

DELIVERED:

    PARTIALLY_RELEASED
            ↓
         RELEASED

Only the remaining amount is released.

Example:

    earnings = 15,120
    already released = 7,560

    remaining = 7,560

Wallet:

    pendingBalance -= 7,560
    availableBalance += 7,560
============================================================
*/

async function processMaxiDelivery({
  order,
  orderID,
  courierID,
  earnings,
  currentReleasedAmount,
}) {
  console.log(`Processing MAXI DELIVERED for ${orderID}`);

  /*
  ==========================================================
  1. IDEMPOTENCY
  ==========================================================
  */

  if (order.fundsStatus === "RELEASED") {
    console.log(`Final Maxi release already completed for ${orderID}`);

    return successResponse({
      message: "Maxi courier earnings are already fully released.",
      orderID,
      courierID,
      milestone: "DELIVERED",
      fundsStatus: "RELEASED",
      fundsReleasedAmount: earnings,
      alreadyProcessed: true,
    });
  }

  /*
  ==========================================================
  2. DELIVERY MUST START FROM PARTIALLY_RELEASED
  ==========================================================

  IMPORTANT:

      HELD → RELEASED

  is NEVER allowed.
  ==========================================================
  */

  if (order.fundsStatus !== "PARTIALLY_RELEASED") {
    throw new Error(
      `Order ${orderID} cannot receive the final Maxi ` +
        `release because fundsStatus is ` +
        `${order.fundsStatus}. ` +
        `DELIVERED requires PARTIALLY_RELEASED.`,
    );
  }

  /*
  ==========================================================
  3. VERIFY FIRST RELEASE
  ==========================================================
  */

  if (currentReleasedAmount <= 0) {
    throw new Error(
      `Order ${orderID} is PARTIALLY_RELEASED but ` +
        `fundsReleasedAmount is ${currentReleasedAmount}. ` +
        `Financial state requires reconciliation.`,
    );
  }

  /*
  ==========================================================
  4. GET COURIER WALLET
  ==========================================================
  */

  const wallet = await getCourierWallet(courierID);

  if (!wallet) {
    throw new Error(`Wallet not found for courier ${courierID}`);
  }

  /*
  ==========================================================
  5. VERIFY WALLET
  ==========================================================
  */

  verifyCourierWallet(wallet, courierID);

  /*
  ==========================================================
  6. VERIFY ORIGINAL EARNINGS TRANSACTION
  ==========================================================
  */

  const earningsReference = `EARNINGS-${orderID}`;

  const earningsTransaction =
    await getTransactionByReference(earningsReference);

  verifyEarningsTransaction({
    transaction: earningsTransaction,
    walletID: wallet.id,
    orderID,
    earnings,
  });

  /*
  ==========================================================
  7. CALCULATE REMAINING AMOUNT
  ==========================================================

  We deliberately calculate:

      total earnings
            -
      amount already released

  instead of simply doing another 50%.

  This handles rounding safely.
  ==========================================================
  */

  const remainingAmount = normalizeMoney(earnings - currentReleasedAmount);

  if (remainingAmount < 0) {
    throw new Error(
      `Order ${orderID} has an invalid remaining ` +
        `release amount: ${remainingAmount}`,
    );
  }

  if (remainingAmount <= 0.01) {
    throw new Error(
      `Order ${orderID} is PARTIALLY_RELEASED but ` +
        `has no remaining amount to release. ` +
        `Financial state requires reconciliation.`,
    );
  }

  console.log("FINAL MAXI RELEASE AMOUNT:", remainingAmount);

  /*
  ==========================================================
  8. READ WALLET
  ==========================================================
  */

  const pendingBalance = normalizeMoney(wallet.pendingBalance || 0);

  const availableBalance = normalizeMoney(wallet.availableBalance || 0);

  const lifetimeEarnings = normalizeMoney(wallet.lifetimeEarnings || 0);

  /*
  ==========================================================
  9. VERIFY PENDING BALANCE
  ==========================================================
  */

  if (pendingBalance < remainingAmount) {
    throw new Error(
      `Insufficient pending balance for final Maxi release. ` +
        `Pending=${pendingBalance}, ` +
        `required=${remainingAmount}`,
    );
  }

  /*
  ==========================================================
  10. CALCULATE NEW WALLET BALANCES
  ==========================================================
  */

  const newPendingBalance = normalizeMoney(pendingBalance - remainingAmount);

  const newAvailableBalance = normalizeMoney(
    availableBalance + remainingAmount,
  );

  /*
  ==========================================================
  11. SAVE ORIGINAL WALLET STATE
  ==========================================================
  */

  const originalWalletState = {
    availableBalance,
    pendingBalance,
    lifetimeEarnings,
  };

  /*
  ==========================================================
  12. UPDATE WALLET
  ==========================================================
  */

  let walletUpdated = false;
  let updatedWallet = null;

  try {
    updatedWallet = await updateWallet({
      wallet,
      availableBalance: newAvailableBalance,
      pendingBalance: newPendingBalance,
    });

    walletUpdated = true;

    /*
    ========================================================
    13. UPDATE ORDER
    ========================================================
    */

    const timestamp = new Date().toISOString();

    const orderUpdate = await updateOrder({
      order,
      fundsStatus: "RELEASED",
      fundsReleasedAmount: earnings,
      fundsReleasedAt: timestamp,
      fundsReleaseType: "MAXI_DELIVERY",
    });

    if (!orderUpdate) {
      throw new Error(
        "Wallet was updated but Order could not " +
          "be finalized for Maxi delivery.",
      );
    }

    /*
    ========================================================
    14. SUCCESS
    ========================================================
    */

    console.log(`Final Maxi release successful for ${orderID}`);

    return successResponse({
      message: "Remaining Maxi courier earnings released after delivery.",
      orderID,
      courierID,
      milestone: "DELIVERED",
      amountReleased: remainingAmount,
      totalCourierEarnings: earnings,
      fundsReleasedAmount: earnings,
      remainingPendingBalance: newPendingBalance,
      availableBalance: newAvailableBalance,
      lifetimeEarnings,
      fundsStatus: "RELEASED",
      fundsReleasedAt: timestamp,
      releaseType: "MAXI_DELIVERY",
    });
  } catch (error) {
    /*
    ========================================================
    15. ROLLBACK WALLET
    ========================================================
    */

    if (walletUpdated && updatedWallet) {
      console.error(`Attempting wallet rollback for delivery ${orderID}`);

      try {
        await rollbackWallet({
          wallet: updatedWallet,
          availableBalance: originalWalletState.availableBalance,
          pendingBalance: originalWalletState.pendingBalance,
        });

        console.log(`Delivery wallet rollback successful for ${orderID}`);
      } catch (rollbackError) {
        console.error(
          `CRITICAL: Delivery wallet rollback failed for ${orderID}`,
          rollbackError,
        );

        throw new Error(
          `CRITICAL RECONCILIATION REQUIRED: ` +
            `wallet was updated but Order update failed, ` +
            `and wallet rollback also failed. ` +
            `orderID=${orderID}. ` +
            `Original error=${error.message}. ` +
            `Rollback error=${rollbackError.message}`,
        );
      }
    }

    throw error;
  }
}

/*
============================================================
VERIFY COURIER WALLET
============================================================
*/

function verifyCourierWallet(wallet, courierID) {
  if (!wallet) {
    throw new Error(`Wallet not found for courier ${courierID}`);
  }

  if (wallet._deleted === true) {
    throw new Error(`Courier wallet ${wallet.id} is deleted.`);
  }

  if (wallet.ownerID !== courierID) {
    throw new Error(
      `Wallet ${wallet.id} does not belong to courier ${courierID}.`,
    );
  }

  if (wallet.ownerType !== "COURIER") {
    throw new Error(`Wallet ${wallet.id} is not a courier wallet.`);
  }
}

/*
============================================================
GET ORDER
============================================================
*/

async function getOrder(orderID) {
  const query = `
    query GetOrder($id: ID!) {
      getOrder(id: $id) {
        id
        status

        paymentStatus
        payoutStatus

        fundsStatus
        fundsReleaseBlocked
        fundsHoldReason
        fundsHeldBy
        fundsHeldAt

        fundsReleasedAmount
        pickupFundsReleasedAt
        fundsReleasedAt
        fundsReleaseType

        earningsAllocationStatus
        earningsAllocatedAt

        assignedCourierId
        courierEarnings

        transportationType
        vehicleClass

        paymentID
        paymentReference

        createdAt
        updatedAt

        _version
      }
    }
  `;

  const response = await graphqlRequest(query, {
    id: orderID,
  });

  if (response.errors) {
    throw new Error(
      `Failed to fetch order: ` + `${JSON.stringify(response.errors)}`,
    );
  }

  return response?.data?.getOrder || null;
}

/*
============================================================
GET COURIER WALLET
============================================================

There must be exactly ONE active COURIER wallet.

0 wallets:
    ERROR

1 wallet:
    USE IT

2+ wallets:
    STOP
============================================================
*/

async function getCourierWallet(courierID) {
  const query = `
    query ListWallets(
      $filter: ModelWalletFilterInput
    ) {
      listWallets(
        filter: $filter
        limit: 100
      ) {
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

  const response = await graphqlRequest(query, {
    filter: {
      ownerID: {
        eq: courierID,
      },
      ownerType: {
        eq: "COURIER",
      },
    },
  });

  if (response.errors) {
    throw new Error(
      `Failed to fetch courier wallet: ` + `${JSON.stringify(response.errors)}`,
    );
  }

  const wallets = response?.data?.listWallets?.items || [];

  const activeWallets = wallets.filter(
    (wallet) => wallet && wallet.id && wallet._deleted !== true,
  );

  if (activeWallets.length === 0) {
    return null;
  }

  if (activeWallets.length > 1) {
    throw new Error(
      `Courier ${courierID} has ` +
        `${activeWallets.length} COURIER wallets. ` +
        `Financial reconciliation is required before ` +
        `funds can be released.`,
    );
  }

  return activeWallets[0];
}

/*
============================================================
GET EARNINGS TRANSACTION
============================================================

Expected reference:

    EARNINGS-${orderID}

Exactly ONE active transaction must exist.
============================================================
*/

async function getTransactionByReference(reference) {
  if (!reference) {
    return null;
  }

  const query = `
    query ListTransactions(
      $filter: ModelTransactionFilterInput
    ) {
      listTransactions(
        filter: $filter
        limit: 100
      ) {
        items {
          id
          walletID
          type
          amount
          description
          orderID
          paymentID
          payoutID
          reference
          status
          createdAt
          updatedAt
          _version
          _deleted
        }
      }
    }
  `;

  const response = await graphqlRequest(query, {
    filter: {
      reference: {
        eq: reference,
      },
      _deleted: {
        ne: true,
      },
    },
  });

  if (response.errors) {
    throw new Error(
      `Failed to fetch earnings transaction: ` +
        `${JSON.stringify(response.errors)}`,
    );
  }

  const transactions = response?.data?.listTransactions?.items || [];

  if (transactions.length === 0) {
    return null;
  }

  if (transactions.length > 1) {
    throw new Error(
      `Multiple active transactions found for ` +
        `reference ${reference}. ` +
        `Manual reconciliation required.`,
    );
  }

  return transactions[0];
}

/*
============================================================
VERIFY EARNINGS TRANSACTION
============================================================

The original allocation transaction must be:

- CREDIT
- COMPLETED
- correct wallet
- correct order
- correct amount

This transaction proves that allocateCourierEarnings
actually allocated the courier earnings.
============================================================
*/

function verifyEarningsTransaction({
  transaction,
  walletID,
  orderID,
  earnings,
}) {
  if (!transaction) {
    throw new Error(`Earnings transaction not found for order ${orderID}.`);
  }

  /*
  ==========================================================
  WALLET CHECK
  ==========================================================
  */

  if (transaction.walletID !== walletID) {
    throw new Error(
      `Earnings transaction wallet mismatch ` + `for order ${orderID}.`,
    );
  }

  /*
  ==========================================================
  ORDER CHECK
  ==========================================================
  */

  if (transaction.orderID !== orderID) {
    throw new Error(
      `Earnings transaction order mismatch ` + `for order ${orderID}.`,
    );
  }

  /*
  ==========================================================
  CREDIT CHECK
  ==========================================================
  */

  if (transaction.type !== "CREDIT") {
    throw new Error(
      `Earnings transaction for order ${orderID} ` +
        `is not a CREDIT transaction.`,
    );
  }

  /*
  ==========================================================
  AMOUNT CHECK
  ==========================================================
  */

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

  /*
  ==========================================================
  STATUS CHECK
  ==========================================================
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

/*
============================================================
UPDATE WALLET
============================================================

Moves:

    pendingBalance
          ↓
    availableBalance

Does NOT modify lifetimeEarnings.
============================================================
*/

async function updateWallet({ wallet, availableBalance, pendingBalance }) {
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
      }
    }
  `;

  const input = {
    id: wallet.id,
    availableBalance: normalizeMoney(availableBalance),
    pendingBalance: normalizeMoney(pendingBalance),
  };

  /*
  ==========================================================
  AMPLIFY VERSION
  ==========================================================
  */

  if (wallet._version !== undefined && wallet._version !== null) {
    input._version = wallet._version;
  }

  const response = await graphqlRequest(mutation, {
    input,
  });

  if (response.errors) {
    throw new Error(
      `Failed to update courier wallet: ` +
        `${JSON.stringify(response.errors)}`,
    );
  }

  const updatedWallet = response?.data?.updateWallet;

  if (!updatedWallet) {
    throw new Error("Wallet update returned no wallet.");
  }

  return updatedWallet;
}

/*
============================================================
ROLLBACK WALLET
============================================================

Used when:

    Wallet update succeeds
            ↓
    Order update fails

Restores:

    availableBalance
    pendingBalance

Does NOT modify:

    lifetimeEarnings
============================================================
*/

async function rollbackWallet({ wallet, availableBalance, pendingBalance }) {
  console.warn(`Rolling back wallet ${wallet.id}`);

  const mutation = `
    mutation RollbackWallet(
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
      }
    }
  `;

  const input = {
    id: wallet.id,
    availableBalance: normalizeMoney(availableBalance),
    pendingBalance: normalizeMoney(pendingBalance),
  };

  /*
  ==========================================================
  IMPORTANT

  Use the VERSION returned by the successful wallet update.

  This prevents the rollback from blindly overwriting a newer
  wallet update.
  ==========================================================
  */

  if (wallet._version !== undefined && wallet._version !== null) {
    input._version = wallet._version;
  }

  const response = await graphqlRequest(mutation, {
    input,
  });

  if (response.errors) {
    throw new Error(
      `Failed to rollback courier wallet: ` +
        `${JSON.stringify(response.errors)}`,
    );
  }

  const rolledBackWallet = response?.data?.updateWallet;

  if (!rolledBackWallet) {
    throw new Error("Wallet rollback returned no wallet.");
  }

  return rolledBackWallet;
}

/*
============================================================
UPDATE ORDER
============================================================

PICKUP:

    HELD
      ↓
PARTIALLY_RELEASED


DELIVERY:

PARTIALLY_RELEASED
      ↓
   RELEASED

Uses:

- _version
- conditional financial state
- earningsAllocationStatus

This prevents stale/concurrent updates.
============================================================
*/

async function updateOrder({
  order,
  fundsStatus,
  fundsReleasedAmount,
  pickupFundsReleasedAt,
  fundsReleasedAt,
  fundsReleaseType,
}) {
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
        status
        paymentStatus
        earningsAllocationStatus
        fundsStatus
        fundsReleasedAmount
        pickupFundsReleasedAt
        fundsReleasedAt
        fundsReleaseType
        fundsReleaseBlocked
        assignedCourierId
        courierEarnings
        transportationType
        vehicleClass
        _version
      }
    }
  `;

  const input = {
    id: order.id,
    fundsStatus,
    fundsReleasedAmount: normalizeMoney(fundsReleasedAmount),
    fundsReleaseType,
  };

  /*
  ==========================================================
  TIMESTAMPS
  ==========================================================
  */

  if (pickupFundsReleasedAt) {
    input.pickupFundsReleasedAt = pickupFundsReleasedAt;
  }

  if (fundsReleasedAt) {
    input.fundsReleasedAt = fundsReleasedAt;
  }

  /*
  ==========================================================
  AMPLIFY VERSION
  ==========================================================
  */

  if (order._version !== undefined && order._version !== null) {
    input._version = order._version;
  }

  /*
  ==========================================================
  FINANCIAL STATE CONDITION
  ==========================================================
  */

  let condition;

  /*
  ==========================================================
  PICKUP

      HELD
        ↓
  PARTIALLY_RELEASED
  ==========================================================
  */

  if (fundsStatus === "PARTIALLY_RELEASED") {
    condition = {
      fundsStatus: {
        eq: "HELD",
      },
      earningsAllocationStatus: {
        eq: "ALLOCATED",
      },
    };
  } else if (fundsStatus === "RELEASED") {

  /*
  ==========================================================
  DELIVERY

  PARTIALLY_RELEASED
        ↓
     RELEASED
  ==========================================================
  */
    condition = {
      fundsStatus: {
        eq: "PARTIALLY_RELEASED",
      },
      earningsAllocationStatus: {
        eq: "ALLOCATED",
      },
    };
  } else {

  /*
  ==========================================================
  INVALID TRANSITION
  ==========================================================
  */
    throw new Error(`Unsupported financial Order transition: ${fundsStatus}`);
  }

  /*
  ==========================================================
  SEND UPDATE
  ==========================================================
  */

  const response = await graphqlRequest(mutation, {
    input,
    condition,
  });

  if (response.errors) {
    throw new Error(
      `Failed to update order: ` + `${JSON.stringify(response.errors)}`,
    );
  }

  const updatedOrder = response?.data?.updateOrder;

  if (!updatedOrder) {
    throw new Error("Order update returned no Order.");
  }

  return updatedOrder;
}

/*
============================================================
GRAPHQL REQUEST HELPER
============================================================
*/

async function graphqlRequest(query, variables = {}) {
  /*
  ==========================================================
  1. VERIFY ENDPOINT
  ==========================================================
  */

  if (!GRAPHQL_ENDPOINT) {
    throw new Error("Missing API_ATUA_GRAPHQLAPIENDPOINTOUTPUT");
  }

  /*
  ==========================================================
  2. VERIFY API KEY
  ==========================================================
  */

  if (!API_KEY) {
    throw new Error("Missing API_ATUA_GRAPHQLAPIKEYOUTPUT");
  }

  /*
  ==========================================================
  3. SEND REQUEST
  ==========================================================
  */

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },

    body: JSON.stringify({
      query,
      variables,
    }),
  });

  /*
  ==========================================================
  4. READ RESPONSE
  ==========================================================
  */

  const responseText = await response.text();

  /*
  ==========================================================
  5. PARSE JSON
  ==========================================================
  */

  let responseData;

  try {
    responseData = JSON.parse(responseText);
  } catch (error) {
    throw new Error(`GraphQL returned invalid JSON: ${responseText}`);
  }

  /*
  ==========================================================
  6. HTTP ERROR
  ==========================================================
  */

  if (!response.ok) {
    throw new Error(`GraphQL HTTP ${response.status}: ${responseText}`);
  }

  /*
  ==========================================================
  7. RETURN
  ==========================================================
  */

  return responseData;
}

/*
============================================================
SUCCESS RESPONSE
============================================================
*/

function successResponse(data) {
  return {
    statusCode: 200,

    body: JSON.stringify({
      success: true,
      ...data,
    }),
  };
}

/*
============================================================
END OF RELEASE COURIER MILESTONE FUNDS
============================================================
*/
