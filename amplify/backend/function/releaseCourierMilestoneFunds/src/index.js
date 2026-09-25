const fetch = require("node-fetch");

/*
============================================================
ATUA — RELEASE COURIER MILESTONE FUNDS
============================================================

MAXI FUND RELEASE FLOW

    EARNINGS ALLOCATED
           ↓
    pendingBalance = 100%
           ↓
       PICKED_UP
           ↓
       release 50%
           ↓
 fundsStatus = PARTIALLY_RELEASED
           ↓
       DELIVERED
           ↓
 release remaining 50%
           ↓
   fundsStatus = RELEASED


IMPORTANT

This Lambda:

- ONLY processes MAXI orders
- Does NOT process customer payments
- Does NOT allocate courier earnings
- Does NOT increase lifetimeEarnings
- Does NOT process Paystack payouts
- Does NOT send bank transfers
- Does NOT generate delivery codes
- Respects admin funds holds

Financial movement:

    pendingBalance
          ↓
    availableBalance


IMPORTANT STATE RULE

MAXI funds MUST follow:

    HELD
      ↓
PICKED_UP
      ↓
PARTIALLY_RELEASED
      ↓
DELIVERED
      ↓
RELEASED

A DELIVERED event is NOT allowed to release
funds directly from HELD.

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
MAIN HANDLER
============================================================
*/

exports.handler = async (event) => {
  console.log("==========================================");
  console.log("ATUA MAXI MILESTONE FUND RELEASE");
  console.log("==========================================");

  console.log("EVENT:", JSON.stringify(event));

  let orderID = null;

  /*
  ------------------------------------------------------------
  Keep this variable outside the try block.

  It is useful if an error occurs and we need to
  identify the order in CloudWatch.
  ------------------------------------------------------------
  */

  try {
    /*
    ==========================================================
    1. GET ORDER ID
    ==========================================================
    */

    /*
     * Supports:
     *
     * Direct Lambda invocation
     *
     * AppSync-style arguments
     *
     * EventBridge-style detail payload
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
    2. GET OPTIONAL MILESTONE
    ==========================================================

    The financial trigger can explicitly send:

        PICKED_UP

    or:

        DELIVERED

    If it does not send one, we use Order.status.
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
        `Courier earnings have not been allocated ` +
          `for order ${orderID}. ` +
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

    const earnings = normalizeMoney(order.courierEarnings || 0);

    if (!Number.isFinite(earnings) || earnings <= 0) {
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

    /*
     * A MAXI order can be identified by:
     *
     * transportationType = MAXI
     *
     * OR
     *
     * vehicleClass = MAXI
     */

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

    /*
     * If the financial trigger supplied an explicit
     * milestone, use it.
     *
     * Otherwise fall back to Order.status.
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
    10. ADMIN FUNDS HOLD
    ==========================================================
    */

    /*
     * If an administrator has blocked release,
     * do not touch the wallet.
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
    11. READ CURRENT RELEASED AMOUNT
    ==========================================================
    */

    const currentReleasedAmount = normalizeMoney(
      order.fundsReleasedAmount || 0,
    );

    if (!Number.isFinite(currentReleasedAmount) || currentReleasedAmount < 0) {
      throw new Error(
        `Invalid fundsReleasedAmount for order ${orderID}: ` +
          `${order.fundsReleasedAmount}`,
      );
    }

    /*
    ----------------------------------------------------------
    SAFETY CHECK
    ----------------------------------------------------------

    The amount already released can never be greater
    than the courier's total earnings.
    ----------------------------------------------------------
    */

    if (currentReleasedAmount > earnings + 0.01) {
      throw new Error(
        `Order ${orderID} has released more funds ` +
          `than its courier earnings.`,
      );
    }

    /*
    ==========================================================
    12. PICKED_UP
    ==========================================================
    */

    /*
     * MAXI pickup releases the first 50%.
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
    13. DELIVERED
    ==========================================================
    */

    /*
     * MAXI delivery releases the remaining amount.
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

    /*
    ==========================================================
    SAFETY
    ==========================================================
    */

    throw new Error(`Unsupported milestone: ${milestone}`);
  } catch (error) {
    console.error("==========================================");

    console.error("ATUA MAXI MILESTONE RELEASE ERROR");

    console.error("ORDER ID:", orderID);

    console.error("MESSAGE:", error?.message);

    console.error("STACK:", error?.stack);

    console.error("==========================================");

    /*
    ----------------------------------------------------------
    Return a failed Lambda response.
    ----------------------------------------------------------

    IMPORTANT:

    We do NOT pretend the release succeeded.
    ----------------------------------------------------------
    */

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

PICKED_UP releases exactly 50%.

Required state:

    fundsStatus = HELD

Result:

    fundsStatus = PARTIALLY_RELEASED

    fundsReleasedAmount = 50%

    pendingBalance decreases

    availableBalance increases

    lifetimeEarnings unchanged

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
  ============================================================
  1. IDEMPOTENCY
  ============================================================

  If pickup has already been processed, do not release
  another 50%.
  ============================================================
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
  ============================================================
  2. PICKUP MUST START FROM HELD
  ============================================================
  */

  if (order.fundsStatus !== "HELD") {
    throw new Error(
      `Order ${orderID} has unexpected fundsStatus ` +
        `${order.fundsStatus}. ` +
        `Pickup release requires HELD.`,
    );
  }

  /*
  ============================================================
  3. NO PREVIOUS RELEASE ALLOWED
  ============================================================
  */

  if (Math.abs(currentReleasedAmount) > 0.01) {
    throw new Error(
      `Order ${orderID} has ` +
        `fundsReleasedAmount ${currentReleasedAmount} ` +
        `but is still HELD.`,
    );
  }

  /*
  ============================================================
  4. CALCULATE FIRST 50%
  ============================================================

  Example:

      earnings = 20,001

      first release = 10,000.50
  ============================================================
  */

  const firstReleaseAmount = normalizeMoney(earnings / 2);

  if (firstReleaseAmount <= 0) {
    throw new Error("Calculated Maxi pickup release amount is invalid.");
  }

  console.log("PICKUP RELEASE AMOUNT:", firstReleaseAmount);

  /*
  ============================================================
  5. GET COURIER WALLET
  ============================================================
  */

  const wallet = await getCourierWallet(courierID);

  if (!wallet) {
    throw new Error(`Wallet not found for courier ${courierID}`);
  }

  /*
  ============================================================
  6. VERIFY WALLET OWNER
  ============================================================
  */

  if (wallet.ownerID !== courierID) {
    throw new Error(
      `Wallet ${wallet.id} does not belong ` + `to courier ${courierID}`,
    );
  }

  if (wallet.ownerType !== "COURIER") {
    throw new Error(`Wallet ${wallet.id} is not a courier wallet.`);
  }

  /*
  ============================================================
  7. READ WALLET BALANCES
  ============================================================
  */

  const pendingBalance = normalizeMoney(wallet.pendingBalance || 0);

  const availableBalance = normalizeMoney(wallet.availableBalance || 0);

  const lifetimeEarnings = normalizeMoney(wallet.lifetimeEarnings || 0);

  /*
  ============================================================
  8. VERIFY PENDING BALANCE
  ============================================================
  */

  if (pendingBalance < firstReleaseAmount) {
    throw new Error(
      `Insufficient pending balance. ` +
        `Pending=${pendingBalance}, ` +
        `required=${firstReleaseAmount}`,
    );
  }

  /*
  ============================================================
  9. CALCULATE NEW BALANCES
  ============================================================
  */

  const newPendingBalance = normalizeMoney(pendingBalance - firstReleaseAmount);

  const newAvailableBalance = normalizeMoney(
    availableBalance + firstReleaseAmount,
  );

  /*
  ============================================================
  10. SAVE ORIGINAL WALLET STATE
  ============================================================

  If the Order update fails after the wallet has been
  updated, this snapshot allows us to restore the wallet.
  ============================================================
  */

  const originalWalletState = {
    availableBalance,

    pendingBalance,

    lifetimeEarnings,
  };

  /*
  ============================================================
  11. UPDATE WALLET
  ============================================================
  */

  let walletUpdated = false;

  let updatedWallet = null;

  try {
    updatedWallet = await updateWallet({
      wallet,

      availableBalance: newAvailableBalance,

      pendingBalance: newPendingBalance,
    });

    if (!updatedWallet) {
      throw new Error(
        "Could not update courier wallet " + "during Maxi pickup release.",
      );
    }

    walletUpdated = true;

    /*
    ==========================================================
    12. UPDATE ORDER
    ==========================================================

    The updateOrder helper will use:

    - the current _version
    - the expected current fundsStatus
    - the financial state checks

    This protects against stale/concurrent releases.
    ==========================================================
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
        "Wallet was updated but order could not " +
          "be updated for Maxi pickup release.",
      );
    }

    /*
    ==========================================================
    13. SUCCESS
    ==========================================================
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

      /*
      --------------------------------------------------------
      lifetimeEarnings remains unchanged.
      --------------------------------------------------------
      */

      lifetimeEarnings,

      fundsStatus: "PARTIALLY_RELEASED",

      pickupFundsReleasedAt: timestamp,

      releaseType: "MAXI_PICKUP",
    });
  } catch (error) {
    /*
    ==========================================================
    14. COMPENSATING WALLET ROLLBACK
    ==========================================================

    If:

        Wallet update succeeds
                ↓
        Order update fails

    restore the wallet to its original state.
    ==========================================================
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

DELIVERED releases ONLY the remaining amount.

Required state:

    fundsStatus = PARTIALLY_RELEASED

Expected state before delivery:

    fundsReleasedAmount = 50%

Result:

    fundsStatus = RELEASED

    fundsReleasedAmount = 100%

    pendingBalance decreases

    availableBalance increases

    lifetimeEarnings remains unchanged

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
  ============================================================
  1. IDEMPOTENCY
  ============================================================

  If the final release has already happened,
  do not release anything again.
  ============================================================
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
  ============================================================
  2. DELIVERY MUST START FROM PARTIALLY_RELEASED
  ============================================================

  This is intentionally strict.

  We DO NOT allow:

      HELD → RELEASED

  because that could accidentally release 100% of the
  courier earnings if the PICKED_UP milestone was missed.
  ============================================================
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
  ============================================================
  3. VERIFY FIRST 50% WAS ACTUALLY RELEASED
  ============================================================

  We expect fundsReleasedAmount to be greater than zero.

  This is another protection against accidentally releasing
  the entire amount from a malformed financial state.
  ============================================================
  */

  if (currentReleasedAmount <= 0) {
    throw new Error(
      `Order ${orderID} is PARTIALLY_RELEASED but ` +
        `fundsReleasedAmount is ${currentReleasedAmount}. ` +
        `Financial state requires reconciliation.`,
    );
  }

  /*
  ============================================================
  4. CALCULATE REMAINING AMOUNT
  ============================================================

  Example:

      earnings = 20,001

      released = 10,000.50

      remaining = 10,000.50

  This is safer than simply calculating another 50%.
  ============================================================
  */

  const remainingAmount = normalizeMoney(earnings - currentReleasedAmount);

  /*
  ============================================================
  5. VERIFY REMAINING AMOUNT
  ============================================================
  */

  if (remainingAmount < 0) {
    throw new Error(
      `Order ${orderID} has an invalid remaining release amount: ` +
        `${remainingAmount}`,
    );
  }

  /*
  ------------------------------------------------------------
  If the remaining amount is effectively zero but the Order
  still says PARTIALLY_RELEASED, this is an inconsistent
  financial state.

  Do NOT silently mark it RELEASED.
  ------------------------------------------------------------
  */

  if (remainingAmount <= 0.01) {
    throw new Error(
      `Order ${orderID} is PARTIALLY_RELEASED but has ` +
        `no remaining amount to release. ` +
        `Financial state requires reconciliation.`,
    );
  }

  console.log("FINAL MAXI RELEASE AMOUNT:", remainingAmount);

  /*
  ============================================================
  6. GET COURIER WALLET
  ============================================================
  */

  const wallet = await getCourierWallet(courierID);

  if (!wallet) {
    throw new Error(`Wallet not found for courier ${courierID}`);
  }

  /*
  ============================================================
  7. VERIFY WALLET OWNER
  ============================================================
  */

  if (wallet.ownerID !== courierID) {
    throw new Error(
      `Wallet ${wallet.id} does not belong ` + `to courier ${courierID}`,
    );
  }

  if (wallet.ownerType !== "COURIER") {
    throw new Error(`Wallet ${wallet.id} is not a courier wallet.`);
  }

  /*
  ============================================================
  8. READ WALLET BALANCES
  ============================================================
  */

  const pendingBalance = normalizeMoney(wallet.pendingBalance || 0);

  const availableBalance = normalizeMoney(wallet.availableBalance || 0);

  const lifetimeEarnings = normalizeMoney(wallet.lifetimeEarnings || 0);

  /*
  ============================================================
  9. VERIFY PENDING BALANCE
  ============================================================
  */

  if (pendingBalance < remainingAmount) {
    throw new Error(
      `Insufficient pending balance for final Maxi release. ` +
        `Pending=${pendingBalance}, ` +
        `required=${remainingAmount}`,
    );
  }

  /*
  ============================================================
  10. CALCULATE NEW BALANCES
  ============================================================
  */

  const newPendingBalance = normalizeMoney(pendingBalance - remainingAmount);

  const newAvailableBalance = normalizeMoney(
    availableBalance + remainingAmount,
  );

  /*
  ============================================================
  11. SAVE ORIGINAL WALLET STATE
  ============================================================

  If the Order update fails after the wallet has been
  updated, use this snapshot to restore the wallet.
  ============================================================
  */

  const originalWalletState = {
    availableBalance,

    pendingBalance,

    lifetimeEarnings,
  };

  /*
  ============================================================
  12. UPDATE WALLET
  ============================================================
  */

  let walletUpdated = false;

  let updatedWallet = null;

  try {
    updatedWallet = await updateWallet({
      wallet,

      availableBalance: newAvailableBalance,

      pendingBalance: newPendingBalance,
    });

    if (!updatedWallet) {
      throw new Error(
        "Could not update courier wallet " + "during final Maxi release.",
      );
    }

    walletUpdated = true;

    /*
    ==========================================================
    13. UPDATE ORDER
    ==========================================================

    The Order moves:

        PARTIALLY_RELEASED
                 ↓
             RELEASED

    and fundsReleasedAmount becomes the full
    courier earnings.
    ==========================================================
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
    ==========================================================
    14. SUCCESS
    ==========================================================
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

      /*
      --------------------------------------------------------
      lifetimeEarnings is intentionally unchanged.
      --------------------------------------------------------
      */

      lifetimeEarnings,

      fundsStatus: "RELEASED",

      fundsReleasedAt: timestamp,

      releaseType: "MAXI_DELIVERY",
    });
  } catch (error) {
    /*
    ==========================================================
    15. COMPENSATING WALLET ROLLBACK
    ==========================================================
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
GET ORDER
============================================================

Fetches all fields required by the financial release flow.

IMPORTANT:

There are NO JavaScript-style block comments inside
the GraphQL query.

GraphQL itself does not accept:

    /* comment *\/

inside the query.

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

Important safety rule:

There must be exactly ONE active COURIER wallet for
a courier.

0 wallets:
    error

1 wallet:
    use it

2+ wallets:
    STOP

We never silently select one of multiple wallets because
that could move money into the wrong wallet.

IMPORTANT CORRECTION:

We explicitly request _deleted from AppSync and exclude
soft-deleted Wallet records before determining whether
duplicate wallets exist.

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

  /*
  ============================================================
  QUERY WALLET RECORDS
  ============================================================
  */

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

  /*
  ============================================================
  CHECK GRAPHQL ERRORS
  ============================================================
  */

  if (response.errors) {
    throw new Error(
      `Failed to fetch courier wallet: ` + `${JSON.stringify(response.errors)}`,
    );
  }

  /*
  ============================================================
  GET WALLET ITEMS
  ============================================================
  */

  const wallets = response?.data?.listWallets?.items || [];

  /*
  ============================================================
  REMOVE SOFT-DELETED RECORDS
  ============================================================

  Amplify/DataStore can retain records marked:

      _deleted = true

  Such records must NOT count as active financial wallets.

  Only wallets where:

      _deleted !== true

  are considered active.
  ============================================================
  */

  const activeWallets = wallets.filter(
    (wallet) => wallet && wallet.id && wallet._deleted !== true,
  );

  /*
  ============================================================
  NO WALLET
  ============================================================

  Returning null allows the caller to decide how to handle
  the missing wallet.

  For this release Lambda, a missing wallet is an error.
  ============================================================
  */

  if (activeWallets.length === 0) {
    return null;
  }

  /*
  ============================================================
  DUPLICATE WALLET
  ============================================================

  NEVER silently select one wallet when multiple active
  courier wallets exist.

  This is a financial safety rule.
  ============================================================
  */

  if (activeWallets.length > 1) {
    throw new Error(
      `Courier ${courierID} has ` +
        `${activeWallets.length} COURIER wallets. ` +
        `Financial reconciliation is required before funds ` +
        `can be released.`,
    );
  }

  /*
  ============================================================
  EXACTLY ONE ACTIVE WALLET
  ============================================================
  */

  return activeWallets[0];
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

Uses _version when available.

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

  /*
  ============================================================
  BUILD UPDATE INPUT
  ============================================================
  */

  const input = {
    id: wallet.id,

    availableBalance: normalizeMoney(availableBalance),

    pendingBalance: normalizeMoney(pendingBalance),

    /*
    ----------------------------------------------------------
    lifetimeEarnings intentionally NOT included.
    ----------------------------------------------------------

    Earnings allocation is responsible for lifetimeEarnings.

    Release only moves money from:

        pendingBalance
              ↓
        availableBalance
    ----------------------------------------------------------
    */
  };

  /*
  ============================================================
  INCLUDE AMPLIFY VERSION
  ============================================================
  */

  if (wallet._version !== undefined && wallet._version !== null) {
    input._version = wallet._version;
  }

  /*
  ============================================================
  SEND WALLET UPDATE
  ============================================================
  */

  const response = await graphqlRequest(mutation, {
    input,
  });

  /*
  ============================================================
  CHECK GRAPHQL ERRORS
  ============================================================
  */

  if (response.errors) {
    throw new Error(
      `Failed to update courier wallet: ` +
        `${JSON.stringify(response.errors)}`,
    );
  }

  /*
  ============================================================
  GET UPDATED WALLET
  ============================================================
  */

  const updatedWallet = response?.data?.updateWallet;

  if (!updatedWallet) {
    throw new Error("Wallet update returned no wallet.");
  }

  /*
  ============================================================
  RETURN UPDATED WALLET
  ============================================================
  */

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

Restores the previous available/pending balances.

IMPORTANT:

    lifetimeEarnings is NOT changed.

============================================================
*/

async function rollbackWallet({ wallet, availableBalance, pendingBalance }) {
  console.warn(`Rolling back wallet ${wallet.id}`);

  /*
  ============================================================
  ROLLBACK MUTATION
  ============================================================
  */

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

  /*
  ============================================================
  BUILD ROLLBACK INPUT
  ============================================================
  */

  const input = {
    id: wallet.id,

    availableBalance: normalizeMoney(availableBalance),

    pendingBalance: normalizeMoney(pendingBalance),

    /*
    ----------------------------------------------------------
    lifetimeEarnings intentionally untouched.
    ----------------------------------------------------------
    */
  };

  /*
  ============================================================
  USE AMPLIFY VERSION
  ============================================================

  The wallet passed into this function should normally be
  the wallet returned by the successful updateWallet()
  operation.

  Therefore its _version should represent the latest
  version available after that update.
  ============================================================
  */

  if (wallet._version !== undefined && wallet._version !== null) {
    input._version = wallet._version;
  }

  /*
  ============================================================
  SEND ROLLBACK
  ============================================================
  */

  const response = await graphqlRequest(mutation, {
    input,
  });

  /*
  ============================================================
  CHECK GRAPHQL ERRORS
  ============================================================
  */

  if (response.errors) {
    throw new Error(
      `Failed to rollback courier wallet: ` +
        `${JSON.stringify(response.errors)}`,
    );
  }

  /*
  ============================================================
  GET ROLLED-BACK WALLET
  ============================================================
  */

  const rolledBackWallet = response?.data?.updateWallet;

  if (!rolledBackWallet) {
    throw new Error("Wallet rollback returned no wallet.");
  }

  console.log(`Wallet ${wallet.id} successfully rolled back.`);

  return rolledBackWallet;
}

/*
============================================================
UPDATE ORDER
============================================================

Financial state transitions:

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
- earningsAllocationStatus condition

This prevents stale/concurrent updates from silently
overwriting a newer financial state.

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

  /*
  ============================================================
  BUILD ORDER UPDATE INPUT
  ============================================================
  */

  const input = {
    id: order.id,

    fundsStatus,

    fundsReleasedAmount: normalizeMoney(fundsReleasedAmount),

    fundsReleaseType,
  };

  /*
  ============================================================
  ADD TIMESTAMP FIELDS WHEN PROVIDED
  ============================================================
  */

  if (pickupFundsReleasedAt) {
    input.pickupFundsReleasedAt = pickupFundsReleasedAt;
  }

  if (fundsReleasedAt) {
    input.fundsReleasedAt = fundsReleasedAt;
  }

  /*
  ============================================================
  INCLUDE AMPLIFY _VERSION
  ============================================================
  */

  if (order._version !== undefined && order._version !== null) {
    input._version = order._version;
  }

  /*
  ============================================================
  DETERMINE EXPECTED PREVIOUS STATE
  ============================================================
  */

  let condition;

  /*
  ============================================================
  PICKUP:

      HELD
        ↓
      PARTIALLY_RELEASED
  ============================================================
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
  ============================================================
  DELIVERY:

      PARTIALLY_RELEASED
        ↓
      RELEASED
  ============================================================
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
  ============================================================
  UNSUPPORTED TRANSITION
  ============================================================
  */
    throw new Error(`Unsupported financial Order transition: ${fundsStatus}`);
  }

  /*
  ============================================================
  UPDATE ORDER
  ============================================================
  */

  const response = await graphqlRequest(mutation, {
    input,

    condition,
  });

  /*
  ============================================================
  CHECK GRAPHQL ERRORS
  ============================================================
  */

  if (response.errors) {
    throw new Error(
      `Failed to update order: ` + `${JSON.stringify(response.errors)}`,
    );
  }

  /*
  ============================================================
  GET UPDATED ORDER
  ============================================================
  */

  const updatedOrder = response?.data?.updateOrder;

  if (!updatedOrder) {
    throw new Error("Order update returned no Order.");
  }

  /*
  ============================================================
  RETURN UPDATED ORDER
  ============================================================
  */

  return updatedOrder;
}
/*
============================================================
GRAPHQL REQUEST HELPER
============================================================

All AppSync GraphQL requests go through this helper.

Authentication:

    x-api-key

Environment variables:

    API_ATUA_GRAPHQLAPIENDPOINTOUTPUT
    API_ATUA_GRAPHQLAPIKEYOUTPUT

IMPORTANT:

The GraphQL queries themselves must contain only valid
GraphQL syntax.

JavaScript comments such as:

    /* GraphQL *\/ `...`

are fine outside the GraphQL document.

However, JavaScript-style block comments such as:

    /* comment *\/

must NOT be placed inside the GraphQL query string.

============================================================
*/

async function graphqlRequest(query, variables = {}) {
  /*
  ==========================================================
  1. VERIFY GRAPHQL ENDPOINT
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
  3. SEND GRAPHQL REQUEST
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
  4. READ RESPONSE BODY
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
  6. VERIFY HTTP STATUS
  ==========================================================
  */

  if (!response.ok) {
    throw new Error(`GraphQL HTTP ${response.status}: ${responseText}`);
  }

  /*
  ==========================================================
  7. RETURN GRAPHQL RESPONSE
  ==========================================================
  */

  return responseData;
}

/*
============================================================
SUCCESS RESPONSE
============================================================

Standard successful Lambda response.

HTTP:

    200

Body:

    {
      success: true,
      ...
    }

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
END OF MAXI RELEASE COURIER MILESTONE FUNDS
============================================================

FINAL FINANCIAL FLOW


                    MAXI ORDER
                        │
                        ▼
               EARNINGS ALLOCATED
                        │
                        ▼
                pendingBalance
                    = 100%
                        │
                        ▼
                   PICKED_UP
                        │
                        ▼
                   RELEASE 50%
                        │
                        ▼
             PARTIALLY_RELEASED
                        │
                        ▼
                   DELIVERED
                        │
                        ▼
              RELEASE REMAINING
                        │
                        ▼
                    RELEASED


WALLET MOVEMENT


       pendingBalance
              │
              │
              ▼
       availableBalance


LIFETIME EARNINGS


       lifetimeEarnings
              │
              │
              └──────► UNCHANGED


PAYMENTS


       Paystack
           │
           └──────► NOT PROCESSED HERE


PAYOUTS


       Bank payout
           │
           └──────► NOT PROCESSED HERE


ADMIN HOLD


       fundsReleaseBlocked = true
                    │
                    └──────► NO RELEASE


MAXI PROTECTION


       Micro/Moto
           │
           └──────► REJECTED


DELIVERY PROTECTION


       HELD
        │
        └── DELIVERED ──► REJECTED


       PARTIALLY_RELEASED
        │
        └── DELIVERED ──► RELEASE REMAINING


============================================================
END OF FILE
============================================================
*/
