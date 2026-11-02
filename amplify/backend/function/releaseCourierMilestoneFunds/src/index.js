/*
===============================================================================
ATUA — RELEASE COURIER MILESTONE FUNDS
===============================================================================

PURPOSE
-------
This Lambda handles Maxi courier earnings in two milestones.

NORMAL FLOW
-----------

1. Customer payment is verified.
2. Courier earnings are allocated to pendingBalance.
3. Order reaches PICKED_UP.
4. 50% of courier earnings moves from pendingBalance to availableBalance.
5. Order.fundsStatus becomes PARTIALLY_RELEASED.
6. Order reaches DELIVERED.
7. The remaining courier earnings move to availableBalance.
8. Order.fundsStatus becomes RELEASED.

LATE-PAYMENT FLOW
-----------------

An order may reach DELIVERED before payment and earnings allocation
are complete.

If this Lambda is subsequently invoked with milestone DELIVERED,
and the order is still HELD, it releases the full earnings once
payment is confirmed and allocation is complete.

This is a catch-up release because both milestones have already
occurred. It does not falsely record a pickup release at an earlier
time when no release actually happened.

CASH ORDERS
-----------

Cash orders must not be treated as electronically funded orders.

This Lambda skips cash orders. If cash earnings have already been
allocated through the electronic wallet flow, it flags the case
for reconciliation instead of moving balances again.

MAXI RELEASE AMOUNTS
--------------------

At pickup:
    Release 50% of courierEarnings.

At delivery after pickup:
    Release courierEarnings - fundsReleasedAmount.

At delivery without a previous release:
    Release all courierEarnings as a catch-up release.

WALLET MOVEMENT
---------------

    pendingBalance decreases
    availableBalance increases
    lifetimeEarnings increases

This Lambda does NOT:
- Verify a Paystack transaction directly.
- Allocate initial courier earnings.
- Initiate a bank payout.
- Handle Micro or Moto orders.
- Process cash collection.

REQUIRED ENVIRONMENT VARIABLES
------------------------------
API_ATUA_GRAPHQLAPIENDPOINTOUTPUT
API_ATUA_GRAPHQLAPIKEYOUTPUT

IMPORTANT DATABASE LIMITATION
-----------------------------
Wallet and Order are separate AppSync records. Their updates are
not one atomic database transaction.

This code uses conditional Order updates, wallet version checks
when supported, and compensating rollback. If rollback fails,
financial reconciliation is required.

Before production use, test duplicate invocations and concurrent
wallet updates in staging.
===============================================================================
*/

const fetch = global.fetch || require("node-fetch");

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

/*
===============================================================================
1. MAIN HANDLER
===============================================================================

AWS Lambda invokes this function.

Expected payload examples:

    { "orderID": "ORDER_ID", "milestone": "PICKED_UP" }

    { "orderID": "ORDER_ID", "milestone": "DELIVERED" }

The milestone can also be inferred from Order.status if the caller
does not provide it.
*/

exports.handler = async (event) => {
  let orderID = null;

  try {
    console.log("================================================");
    console.log("ATUA MAXI MILESTONE RELEASE START");
    console.log("================================================");

    /*
    ---------------------------------------------------------------------------
    STEP 1: EXTRACT ORDER ID
    ---------------------------------------------------------------------------

    Support the payload formats used by direct calls and other Lambdas.
    */

    orderID =
      event?.orderID ||
      event?.orderId ||
      event?.arguments?.orderID ||
      event?.arguments?.orderId ||
      event?.input?.orderID ||
      event?.input?.orderId ||
      event?.detail?.orderID ||
      event?.detail?.orderId;

    if (!orderID) {
      throw new Error("orderID is required.");
    }

    /*
    ---------------------------------------------------------------------------
    STEP 2: EXTRACT REQUESTED MILESTONE
    ---------------------------------------------------------------------------

    If a milestone is provided, normalize it to uppercase.
    */

    const suppliedMilestone =
      event?.milestone ||
      event?.arguments?.milestone ||
      event?.input?.milestone ||
      event?.detail?.milestone ||
      null;

    let requestedMilestone = suppliedMilestone
      ? normalize(suppliedMilestone)
      : null;

    if (
      requestedMilestone &&
      !["PICKED_UP", "DELIVERED"].includes(requestedMilestone)
    ) {
      throw new Error(
        `Invalid milestone "${requestedMilestone}". ` +
          "Expected PICKED_UP or DELIVERED.",
      );
    }

    console.log("ORDER ID:", orderID);
    console.log("REQUESTED MILESTONE:", requestedMilestone);

    /*
    ---------------------------------------------------------------------------
    STEP 3: FETCH THE LATEST ORDER
    ---------------------------------------------------------------------------

    Do not rely solely on the event payload for financial values.
    Fetch the latest Order from AppSync.
    */

    const order = await getOrder(orderID);

    if (!order || order._deleted === true) {
      throw new Error(`Order ${orderID} was not found or has been deleted.`);
    }

    const orderStatus = normalize(order.status);
    const paymentStatus = normalize(order.paymentStatus);
    const paymentMethod = normalize(order.paymentMethod);
    const allocationStatus = normalize(order.earningsAllocationStatus);

    let fundsStatus = normalize(order.fundsStatus);

    console.log(
      "CURRENT ORDER STATE:",
      JSON.stringify({
        status: orderStatus,
        paymentStatus,
        paymentMethod,
        earningsAllocationStatus: allocationStatus,
        fundsStatus,
      }),
    );

    /*
    ---------------------------------------------------------------------------
    STEP 4: VERIFY THIS IS A MAXI ORDER
    ---------------------------------------------------------------------------

    Micro and Moto orders must use releaseFunds instead.
    */

    const transportationType = normalize(order.transportationType);

    const vehicleClass = normalize(order.vehicleClass);

    const isMaxi = transportationType === "MAXI" || vehicleClass === "MAXI";

    if (!isMaxi) {
      throw new Error(
        `Order ${orderID} is not a MAXI order. ` +
          `transportationType=${transportationType}; ` +
          `vehicleClass=${vehicleClass}.`,
      );
    }

    /*
    ---------------------------------------------------------------------------
    STEP 5: VERIFY ASSIGNED COURIER
    ---------------------------------------------------------------------------
    */

    const courierID = order.assignedCourierId;

    if (!courierID) {
      throw new Error(`Order ${orderID} has no assigned courier.`);
    }

    /*
    ---------------------------------------------------------------------------
    STEP 6: HANDLE CASH ORDERS
    ---------------------------------------------------------------------------

    Cash collection is not the same as receiving money through Paystack.

    Do not transfer wallet balances through this electronic release flow.

    If a cash order has already been allocated, return a reconciliation
    flag because the existing allocation may have changed pendingBalance.
    */

    if (paymentMethod === "CASH") {
      if (allocationStatus === "ALLOCATED") {
        console.error("MAXI CASH ORDER REQUIRES RECONCILIATION:", orderID);

        return successResponse({
          success: false,
          skipped: true,
          reconciliationRequired: true,
          orderID,
          courierID,
          paymentMethod: "CASH",
          fundsStatus,
          message:
            "Cash earnings were already allocated. Review the wallet " +
            "and ledger before making any adjustment.",
        });
      }

      return successResponse({
        success: true,
        skipped: true,
        orderID,
        courierID,
        paymentMethod: "CASH",
        message:
          "Cash orders are not released through the electronic " +
          "Maxi milestone flow.",
      });
    }

    /*
    ---------------------------------------------------------------------------
    STEP 7: VERIFY ELECTRONIC PAYMENT METHOD
    ---------------------------------------------------------------------------

    This implementation supports PAYSTACK orders only.

    If your schema uses a different enum value for electronic payment,
    update this comparison to match your deployed schema.
    */

    if (paymentMethod !== "PAYSTACK") {
      throw new Error(
        `Unsupported payment method "${order.paymentMethod}". ` +
          "This Lambda only releases PAYSTACK-funded orders.",
      );
    }

    /*
    ---------------------------------------------------------------------------
    STEP 8: VERIFY PAYMENT STATUS
    ---------------------------------------------------------------------------

    The payment backend must verify the Paystack payment before setting
    paymentStatus to PAID.

    This Lambda does not itself contact Paystack.
    */

    if (paymentStatus !== "PAID") {
      throw new Error(
        `Order ${orderID} is not PAID. ` +
          `Current paymentStatus=${order.paymentStatus}.`,
      );
    }

    /*
    ---------------------------------------------------------------------------
    STEP 9: VERIFY EARNINGS ALLOCATION
    ---------------------------------------------------------------------------

    allocateCourierEarnings must have completed successfully.

    A PAID order alone is not sufficient: courier earnings must already
    have been allocated to the courier's pending balance.
    */

    if (allocationStatus !== "ALLOCATED") {
      throw new Error(
        `Courier earnings are not allocated for Order ${orderID}. ` +
          `Current allocation status=${order.earningsAllocationStatus}.`,
      );
    }

    /*
    ---------------------------------------------------------------------------
    STEP 10: CHECK ADMINISTRATIVE HOLD
    ---------------------------------------------------------------------------

    Do not release earnings while an administrator has blocked the release.
    */

    if (order.fundsReleaseBlocked === true) {
      console.log(`Funds release is blocked for Order ${orderID}.`);

      return successResponse({
        success: true,
        skipped: true,
        orderID,
        courierID,
        releaseBlocked: true,
        fundsStatus,
        holdReason: order.fundsHoldReason || null,
        heldBy: order.fundsHeldBy || null,
        heldAt: order.fundsHeldAt || null,
        message: "An administrative hold prevents funds release.",
      });
    }

    /*
    ---------------------------------------------------------------------------
    STEP 11: VALIDATE TOTAL COURIER EARNINGS
    ---------------------------------------------------------------------------
    */

    const earnings = normalizeMoney(order.courierEarnings);

    if (earnings <= 0) {
      throw new Error(
        `Invalid courierEarnings for Order ${orderID}: ` +
          `${order.courierEarnings}.`,
      );
    }

    /*
    ---------------------------------------------------------------------------
    STEP 12: VALIDATE AMOUNT ALREADY RELEASED
    ---------------------------------------------------------------------------

    At pickup:
        fundsReleasedAmount should normally be 0.

    After pickup:
        fundsReleasedAmount should normally equal 50% of earnings.

    After delivery:
        fundsReleasedAmount should equal 100% of earnings.
    */

    const currentReleasedAmount = normalizeMoney(
      order.fundsReleasedAmount || 0,
    );

    if (currentReleasedAmount < 0) {
      throw new Error(`Order ${orderID} has a negative fundsReleasedAmount.`);
    }

    if (currentReleasedAmount > earnings + 0.01) {
      throw new Error(
        `Order ${orderID} records more released funds than ` +
          "the courier's total earnings.",
      );
    }

    /*
    ---------------------------------------------------------------------------
    STEP 13: DETERMINE THE EFFECTIVE MILESTONE
    ---------------------------------------------------------------------------

    Prefer the milestone supplied by the caller.

    If no milestone is supplied, use Order.status.

    A stream event can be slightly behind the latest database record.
    For example, a PICKED_UP event may be processed after the Order
    has already reached DELIVERED.

    In that case, use DELIVERED so the Lambda can catch up rather than
    incorrectly treating the old pickup event as the current milestone.
    */

    let milestone = requestedMilestone || orderStatus;

    if (milestone === "PICKED_UP" && orderStatus === "DELIVERED") {
      console.log(
        `Order ${orderID} is already DELIVERED. ` +
          "Using DELIVERED catch-up processing.",
      );

      milestone = "DELIVERED";
    }

    if (milestone !== "PICKED_UP" && milestone !== "DELIVERED") {
      throw new Error(
        `Cannot release Maxi funds at milestone "${milestone}". ` +
          "Expected PICKED_UP or DELIVERED.",
      );
    }

    /*
    ---------------------------------------------------------------------------
    STEP 14: ENSURE MILESTONE IS CONSISTENT WITH ORDER STATUS
    ---------------------------------------------------------------------------

    PICKED_UP is valid only while the latest Order status is PICKED_UP.

    DELIVERED is valid only when the latest Order status is DELIVERED.
    */

    if (milestone === "PICKED_UP" && orderStatus !== "PICKED_UP") {
      throw new Error(
        `Cannot process PICKED_UP for Order ${orderID}. ` +
          `Current Order.status=${orderStatus}.`,
      );
    }

    if (milestone === "DELIVERED" && orderStatus !== "DELIVERED") {
      throw new Error(
        `Cannot process DELIVERED for Order ${orderID}. ` +
          `Current Order.status=${orderStatus}.`,
      );
    }

    console.log("EFFECTIVE MILESTONE:", milestone);

    /*
    ---------------------------------------------------------------------------
    STEP 15: HANDLE ALREADY-COMPLETED RELEASES
    ---------------------------------------------------------------------------

    Repeated delivery events must not release earnings a second time.
    */

    if (milestone === "DELIVERED" && fundsStatus === "RELEASED") {
      if (Math.abs(currentReleasedAmount - earnings) > 0.01) {
        throw new Error(
          `Order ${orderID} is RELEASED but fundsReleasedAmount ` +
            "does not match total courier earnings. Reconciliation required.",
        );
      }

      return successResponse({
        success: true,
        alreadyProcessed: true,
        orderID,
        courierID,
        milestone,
        fundsStatus: "RELEASED",
        fundsReleasedAmount: currentReleasedAmount,
        message: "Maxi courier earnings have already been fully released.",
      });
    }

    /*
    ---------------------------------------------------------------------------
    STEP 16: HANDLE REPEATED PICKUP EVENTS
    ---------------------------------------------------------------------------

    If the pickup release has already happened, do not release another 50%.
    */

    if (
      milestone === "PICKED_UP" &&
      (fundsStatus === "PARTIALLY_RELEASED" || fundsStatus === "RELEASED")
    ) {
      const expectedPickupAmount = normalizeMoney(earnings / 2);

      if (currentReleasedAmount + 0.01 < expectedPickupAmount) {
        throw new Error(
          `Order ${orderID} has a partial-release state but the ` +
            "released amount is below the expected pickup amount. " +
            "Reconciliation is required.",
        );
      }

      return successResponse({
        success: true,
        alreadyProcessed: true,
        orderID,
        courierID,
        milestone: "PICKED_UP",
        fundsStatus,
        fundsReleasedAmount: currentReleasedAmount,
        message: "Pickup milestone has already been processed.",
      });
    }

    /*
    ---------------------------------------------------------------------------
    STEP 17: LOAD THE COURIER WALLET
    ---------------------------------------------------------------------------

    The wallet must belong to the courier assigned to the Order.
    */

    const wallet = await getCourierWallet(courierID);

    if (!wallet) {
      throw new Error(`No wallet found for courier ${courierID}.`);
    }

    verifyCourierWallet(wallet, courierID);

    /*
    ---------------------------------------------------------------------------
    STEP 18: VERIFY ORIGINAL EARNINGS TRANSACTION
    ---------------------------------------------------------------------------

    allocateCourierEarnings should have created:

        EARNINGS-{orderID}

    Confirm that this transaction:
    - Exists exactly once.
    - Belongs to the expected wallet and Order.
    - Is a CREDIT.
    - Matches courierEarnings.
    - Has status COMPLETED.
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
    ---------------------------------------------------------------------------
    STEP 19: CALCULATE THE RELEASE AMOUNT
    ---------------------------------------------------------------------------

    PICKED_UP + HELD:
        Release 50%.

    DELIVERED + PARTIALLY_RELEASED:
        Release the remaining amount.

    DELIVERED + HELD:
        Both milestones have occurred, but no release was recorded.
        Release the full earnings as a catch-up release.

    DELIVERED + RELEASED:
        Already handled above.
    */

    let releaseAmount = 0;
    let nextFundsStatus = null;
    let releaseType = null;
    let pickupTimestamp = null;
    let deliveryTimestamp = null;

    const now = new Date().toISOString();

    if (milestone === "PICKED_UP") {
      if (fundsStatus !== "HELD") {
        throw new Error(
          `Pickup release requires fundsStatus HELD. ` +
            `Current status=${fundsStatus}.`,
        );
      }

      if (Math.abs(currentReleasedAmount) > 0.01) {
        throw new Error(
          `Order ${orderID} is HELD but already has a released amount. ` +
            "Reconciliation is required.",
        );
      }

      // Release the first 50% at pickup.
      releaseAmount = normalizeMoney(earnings / 2);

      nextFundsStatus = "PARTIALLY_RELEASED";
      releaseType = "MAXI_PICKUP";
      pickupTimestamp = now;
    } else if (milestone === "DELIVERED") {
      if (fundsStatus === "PARTIALLY_RELEASED") {
        // Release only what remains. Do not pay the first half twice.
        releaseAmount = normalizeMoney(earnings - currentReleasedAmount);

        nextFundsStatus = "RELEASED";
        releaseType = "MAXI_DELIVERY";
        deliveryTimestamp = now;
      } else if (fundsStatus === "HELD") {
        /*
        Both pickup and delivery have occurred, but no previous
        release was recorded.

        This is the late-payment/allocation catch-up path. The
        entire earnings amount is released once, after payment and
        allocation have been verified.

        We do not set pickupFundsReleasedAt because no pickup
        release actually happened at pickup time.
        */

        if (Math.abs(currentReleasedAmount) > 0.01) {
          throw new Error(
            `Order ${orderID} is HELD but already records released funds. ` +
              "Reconciliation is required.",
          );
        }

        releaseAmount = earnings;
        nextFundsStatus = "RELEASED";
        releaseType = "MAXI_DELIVERY_CATCHUP";
        deliveryTimestamp = now;
      } else {
        throw new Error(
          `DELIVERED cannot process fundsStatus "${fundsStatus}".`,
        );
      }
    }

    if (releaseAmount <= 0) {
      throw new Error(
        `Calculated release amount is invalid: ${releaseAmount}.`,
      );
    }

    /*
    ---------------------------------------------------------------------------
    STEP 20: CALCULATE EXPECTED TOTAL RELEASED
    ---------------------------------------------------------------------------

    At pickup:
        current released amount + 50%.

    At delivery:
        current released amount + remaining amount = total earnings.

    Catch-up at delivery:
        0 + full earnings = total earnings.
    */

    const newReleasedAmount = normalizeMoney(
      currentReleasedAmount + releaseAmount,
    );

    if (newReleasedAmount > earnings + 0.01) {
      throw new Error(
        `The calculated release would exceed courier earnings ` +
          `for Order ${orderID}.`,
      );
    }

    if (
      nextFundsStatus === "RELEASED" &&
      Math.abs(newReleasedAmount - earnings) > 0.01
    ) {
      throw new Error(
        `Final release amount does not equal total earnings for ` +
          `Order ${orderID}. Reconciliation is required.`,
      );
    }

    console.log(
      "RELEASE PLAN:",
      JSON.stringify({
        orderID,
        courierID,
        milestone,
        currentFundsStatus: fundsStatus,
        nextFundsStatus,
        totalEarnings: earnings,
        previouslyReleased: currentReleasedAmount,
        releaseAmount,
        newReleasedAmount,
        releaseType,
      }),
    );

    /*
    ---------------------------------------------------------------------------
    STEP 21: VALIDATE WALLET BALANCES
    ---------------------------------------------------------------------------

    The pending balance must contain the amount being released.

    The available balance receives the released amount.
    */

    const pendingBalance = normalizeMoney(wallet.pendingBalance || 0);

    const availableBalance = normalizeMoney(wallet.availableBalance || 0);

    const lifetimeEarnings = normalizeMoney(wallet.lifetimeEarnings || 0);

    if (pendingBalance < 0 || availableBalance < 0 || lifetimeEarnings < 0) {
      throw new Error(`Wallet ${wallet.id} has a negative balance.`);
    }

    if (pendingBalance + 0.01 < releaseAmount) {
      throw new Error(
        `Insufficient pending balance for Order ${orderID}. ` +
          `Pending=${pendingBalance}; required=${releaseAmount}.`,
      );
    }

    /*
    ---------------------------------------------------------------------------
    STEP 22: CALCULATE NEW WALLET BALANCES
    ---------------------------------------------------------------------------

    Example:
        Pending balance before:   ₦20,000
        Available balance before: ₦5,000
        Release amount:           ₦7,500

    After release:
        Pending balance:          ₦12,500
        Available balance:        ₦12,500

    lifetimeEarnings is increased by the amount released, following
    the accounting convention used by the existing Lambda.
    */

    const newPendingBalance = normalizeMoney(pendingBalance - releaseAmount);

    const newAvailableBalance = normalizeMoney(
      availableBalance + releaseAmount,
    );

    const newLifetimeEarnings = normalizeMoney(
      lifetimeEarnings + releaseAmount,
    );

    /*
    ---------------------------------------------------------------------------
    STEP 23: SAVE THE ORIGINAL WALLET VALUES
    ---------------------------------------------------------------------------

    If the Order update fails after the Wallet update, these values
    are used for a compensating rollback.

    The rollback uses the version returned by the successful Wallet
    update, not the old version read at the beginning.
    */

    const originalWalletState = {
      availableBalance,
      pendingBalance,
      lifetimeEarnings,
    };

    let updatedWallet = null;
    let walletUpdated = false;

    try {
      /*
      -------------------------------------------------------------------------
      STEP 24: UPDATE THE WALLET
      -------------------------------------------------------------------------

      Include _version when available. For this to protect against
      concurrent updates, AppSync optimistic concurrency must be
      configured to enforce the version.

      A conflict should fail the update rather than silently
      overwrite a newer wallet balance.
      */

      updatedWallet = await updateWallet({
        wallet,
        availableBalance: newAvailableBalance,
        pendingBalance: newPendingBalance,
        lifetimeEarnings: newLifetimeEarnings,
      });

      walletUpdated = true;

      /*
      -------------------------------------------------------------------------
      STEP 25: UPDATE THE ORDER'S FINANCIAL STATE
      -------------------------------------------------------------------------

      At pickup:
          HELD -> PARTIALLY_RELEASED

      At delivery after pickup:
          PARTIALLY_RELEASED -> RELEASED

      At delivery catch-up:
          HELD -> RELEASED

      The update has a condition that checks the original state.
      This reduces the chance of duplicate releases.

      If the Order update fails, the Wallet update is rolled back.
      */

      const updatedOrder = await updateOrder({
        order,
        milestone,
        nextFundsStatus,
        newReleasedAmount,
        pickupFundsReleasedAt: pickupTimestamp,
        fundsReleasedAt: deliveryTimestamp,
        fundsReleaseType: releaseType,
      });

      /*
      -------------------------------------------------------------------------
      STEP 26: LOG SUCCESS
      -------------------------------------------------------------------------
      */

      console.log(
        "MAXI MILESTONE RELEASE SUCCESS:",
        JSON.stringify({
          orderID,
          courierID,
          walletID: wallet.id,
          milestone,
          releaseType,
          releaseAmount,
          totalEarnings: earnings,
          fundsReleasedAmount: newReleasedAmount,
          fundsStatus: nextFundsStatus,
          pendingBalance: newPendingBalance,
          availableBalance: newAvailableBalance,
          lifetimeEarnings: newLifetimeEarnings,
          orderVersion: updatedOrder._version,
          walletVersion: updatedWallet._version,
        }),
      );

      /*
      -------------------------------------------------------------------------
      STEP 27: RETURN SUCCESS
      -------------------------------------------------------------------------
      */

      return successResponse({
        success: true,
        orderID,
        courierID,
        walletID: wallet.id,
        milestone,
        releaseType,
        amountReleased: releaseAmount,
        totalCourierEarnings: earnings,
        fundsReleasedAmount: newReleasedAmount,
        fundsStatus: nextFundsStatus,
        pickupFundsReleasedAt: updatedOrder.pickupFundsReleasedAt || null,
        fundsReleasedAt: updatedOrder.fundsReleasedAt || null,
        pendingBalance: newPendingBalance,
        availableBalance: newAvailableBalance,
        lifetimeEarnings: newLifetimeEarnings,
        alreadyProcessed: false,
      });
    } catch (releaseError) {
      /*
      -------------------------------------------------------------------------
      STEP 28: ROLL BACK THE WALLET IF THE ORDER UPDATE FAILED
      -------------------------------------------------------------------------

      This rollback is only attempted if the Wallet update succeeded.

      IMPORTANT:
      We use the latest version returned by updateWallet. We do not
      blindly overwrite a newer Wallet record.

      If rollback fails, the Order and Wallet must be reconciled
      before the Lambda is retried.
      */

      if (walletUpdated && updatedWallet) {
        console.error(`Attempting Wallet rollback for Order ${orderID}.`);

        try {
          await rollbackWallet({
            updatedWallet,
            availableBalance: originalWalletState.availableBalance,
            pendingBalance: originalWalletState.pendingBalance,
            lifetimeEarnings: originalWalletState.lifetimeEarnings,
          });

          console.log(`Wallet rollback completed for Order ${orderID}.`);
        } catch (rollbackError) {
          console.error(
            "CRITICAL: MAXI WALLET ROLLBACK FAILED:",
            JSON.stringify({
              orderID,
              walletID: wallet.id,
              releaseError: releaseError.message,
              rollbackError: rollbackError.message,
            }),
          );

          throw new Error(
            `CRITICAL FINANCIAL RECONCILIATION REQUIRED. ` +
              `Order=${orderID}; ` +
              `release error=${releaseError.message}; ` +
              `rollback error=${rollbackError.message}.`,
          );
        }
      }

      // Pass the original failure to the outer error handler.
      throw releaseError;
    }
  } catch (error) {
    /*
    ---------------------------------------------------------------------------
    STEP 29: LOG AND RETURN FAILURE
    ---------------------------------------------------------------------------

    The Lambda returns a 500 response for the caller to inspect.

    If financialOrderTrigger invokes this Lambda, it must check the
    returned statusCode and the JSON body's success value. A returned
    statusCode of 500 does not, by itself, mean AWS Lambda reported
    a FunctionError when the handler returned normally.
    */

    console.error(
      "ATUA MAXI MILESTONE RELEASE FAILED:",
      JSON.stringify({
        orderID,
        message: error?.message,
        stack: error?.stack,
      }),
    );

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: false,
        orderID,
        message: error?.message || "Maxi milestone funds release failed.",
      }),
    };
  }
};

/*
===============================================================================
2. FETCH ORDER
===============================================================================

Retrieve the fields required for:
- Payment validation.
- Courier validation.
- Maxi identification.
- Milestone processing.
- Funds-state validation.
*/

async function getOrder(orderID) {
  const query = /* GraphQL */ `
    query GetOrder($id: ID!) {
      getOrder(id: $id) {
        id
        status
        assignedCourierId
        transportationType
        vehicleClass
        courierEarnings
        paymentStatus
        paymentMethod
        paymentID
        paymentReference
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

  const response = await graphqlRequest(query, {
    id: orderID,
  });

  return response?.data?.getOrder || null;
}

/*
===============================================================================
3. FIND COURIER WALLET
===============================================================================

Find exactly one active wallet belonging to this courier.

If there are no wallets, stop.

If there are multiple wallets, stop rather than risk releasing
earnings to the wrong wallet.
*/

async function getCourierWallet(courierID) {
  const query = /* GraphQL */ `
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

  const response = await graphqlRequest(query, {
    filter: {
      ownerID: {
        eq: courierID,
      },
      ownerType: {
        eq: "COURIER",
      },
      _deleted: {
        ne: true,
      },
    },
    limit: 100,
  });

  const wallets = (response?.data?.listWallets?.items || []).filter(
    (wallet) => wallet && wallet.id && wallet._deleted !== true,
  );

  if (wallets.length === 0) {
    return null;
  }

  if (wallets.length > 1) {
    throw new Error(
      `Courier ${courierID} has multiple active COURIER wallets. ` +
        "Financial reconciliation is required.",
    );
  }

  return wallets[0];
}

/*
===============================================================================
4. VALIDATE WALLET OWNERSHIP
===============================================================================
*/

function verifyCourierWallet(wallet, courierID) {
  if (!wallet) {
    throw new Error(`Wallet not found for courier ${courierID}.`);
  }

  if (wallet._deleted === true) {
    throw new Error(`Wallet ${wallet.id} has been deleted.`);
  }

  if (wallet.ownerID !== courierID) {
    throw new Error(
      `Wallet ${wallet.id} does not belong to courier ${courierID}.`,
    );
  }

  if (normalize(wallet.ownerType) !== "COURIER") {
    throw new Error(`Wallet ${wallet.id} is not a COURIER wallet.`);
  }
}

/*
===============================================================================
5. FIND THE ORIGINAL EARNINGS TRANSACTION
===============================================================================

Expected reference:

    EARNINGS-{orderID}

There must be exactly one active matching transaction.
*/

async function getTransactionByReference(reference) {
  const query = /* GraphQL */ `
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
          payoutID
          reference
          status
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
    limit: 100,
  });

  const transactions = (response?.data?.listTransactions?.items || []).filter(
    (transaction) => transaction && transaction._deleted !== true,
  );

  if (transactions.length === 0) {
    return null;
  }

  if (transactions.length > 1) {
    throw new Error(
      `Multiple active transactions found for ${reference}. ` +
        "Manual financial reconciliation is required.",
    );
  }

  return transactions[0];
}

/*
===============================================================================
6. VERIFY EARNINGS TRANSACTION
===============================================================================

The original allocation transaction must:
- Exist.
- Belong to the correct wallet.
- Belong to the correct Order.
- Be a CREDIT.
- Match the full courier earnings amount.
- Have status COMPLETED.

This checks that the original earnings allocation exists before
the milestone release changes the Wallet.
*/

function verifyEarningsTransaction({
  transaction,
  walletID,
  orderID,
  earnings,
}) {
  if (!transaction) {
    throw new Error(`Earnings transaction EARNINGS-${orderID} was not found.`);
  }

  if (transaction.walletID !== walletID) {
    throw new Error(
      `Earnings transaction Wallet mismatch for Order ${orderID}.`,
    );
  }

  if (transaction.orderID !== orderID) {
    throw new Error(
      `Earnings transaction Order mismatch for Order ${orderID}.`,
    );
  }

  if (normalize(transaction.type) !== "CREDIT") {
    throw new Error(`Earnings transaction for Order ${orderID} is not CREDIT.`);
  }

  if (normalizeMoney(transaction.amount) !== normalizeMoney(earnings)) {
    throw new Error(
      `Earnings transaction amount mismatch for Order ${orderID}.`,
    );
  }

  if (normalize(transaction.status) !== "COMPLETED") {
    throw new Error(
      `Earnings transaction for Order ${orderID} is not COMPLETED. ` +
        `Current status=${transaction.status}.`,
    );
  }

  return true;
}

/*
===============================================================================
7. UPDATE WALLET
===============================================================================

Move earnings from pendingBalance to availableBalance.

The mutation includes _version when available.

AppSync must be configured to enforce optimistic concurrency for
the version to protect against concurrent wallet updates.
*/

async function updateWallet({
  wallet,
  availableBalance,
  pendingBalance,
  lifetimeEarnings,
}) {
  const mutation = /* GraphQL */ `
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

  const input = {
    id: wallet.id,
    availableBalance: normalizeMoney(availableBalance),
    pendingBalance: normalizeMoney(pendingBalance),
    lifetimeEarnings: normalizeMoney(lifetimeEarnings),
  };

  if (wallet._version !== undefined && wallet._version !== null) {
    input._version = wallet._version;
  }

  const response = await graphqlRequest(mutation, {
    input,
  });

  const updatedWallet = response?.data?.updateWallet;

  if (!updatedWallet) {
    throw new Error(
      `Wallet update returned no record for Wallet ${wallet.id}.`,
    );
  }

  return updatedWallet;
}

/*
===============================================================================
8. ROLL BACK WALLET
===============================================================================

This is a compensating operation used if the Wallet update succeeded
but the Order update failed.

IMPORTANT:
Use the _version returned by the successful Wallet update.

Do not use the old Wallet version because it may be stale.
*/

async function rollbackWallet({
  updatedWallet,
  availableBalance,
  pendingBalance,
  lifetimeEarnings,
}) {
  const mutation = /* GraphQL */ `
    mutation RollbackWallet($input: UpdateWalletInput!) {
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

  const input = {
    id: updatedWallet.id,
    availableBalance: normalizeMoney(availableBalance),
    pendingBalance: normalizeMoney(pendingBalance),
    lifetimeEarnings: normalizeMoney(lifetimeEarnings),
  };

  if (updatedWallet._version !== undefined && updatedWallet._version !== null) {
    input._version = updatedWallet._version;
  }

  const response = await graphqlRequest(mutation, {
    input,
  });

  const rolledBackWallet = response?.data?.updateWallet;

  if (!rolledBackWallet) {
    throw new Error(
      `Wallet rollback returned no record for ${updatedWallet.id}.`,
    );
  }

  return rolledBackWallet;
}

/*
===============================================================================
9. UPDATE ORDER FINANCIAL STATE
===============================================================================

Allowed transitions:

PICKUP:
    HELD -> PARTIALLY_RELEASED

DELIVERY AFTER PICKUP:
    PARTIALLY_RELEASED -> RELEASED

DELIVERY CATCH-UP:
    HELD -> RELEASED

The conditional update checks the original financial state and
allocation status so a stale invocation cannot freely overwrite
a newer state.
*/

async function updateOrder({
  order,
  milestone,
  nextFundsStatus,
  newReleasedAmount,
  pickupFundsReleasedAt,
  fundsReleasedAt,
  fundsReleaseType,
}) {
  const mutation = /* GraphQL */ `
    mutation UpdateOrder(
      $input: UpdateOrderInput!
      $condition: ModelOrderConditionInput
    ) {
      updateOrder(input: $input, condition: $condition) {
        id
        status
        paymentStatus
        paymentMethod
        earningsAllocationStatus
        fundsStatus
        fundsReleasedAmount
        pickupFundsReleasedAt
        fundsReleasedAt
        fundsReleaseType
        fundsReleaseBlocked
        _version
        _deleted
      }
    }
  `;

  const input = {
    id: order.id,
    fundsStatus: nextFundsStatus,
    fundsReleasedAmount: normalizeMoney(newReleasedAmount),
    fundsReleaseType,
  };

  // Only write the pickup timestamp when a pickup release actually occurs.
  if (pickupFundsReleasedAt) {
    input.pickupFundsReleasedAt = pickupFundsReleasedAt;
  }

  // Write the final-release timestamp at delivery.
  if (fundsReleasedAt) {
    input.fundsReleasedAt = fundsReleasedAt;
  }

  // Include the Order version when it is available.
  if (order._version !== undefined && order._version !== null) {
    input._version = order._version;
  }

  /*
  Build a condition that matches the state read earlier.

  The current Order.status must also match the milestone being processed.
  */

  let condition;

  if (milestone === "PICKED_UP" && nextFundsStatus === "PARTIALLY_RELEASED") {
    condition = {
      status: {
        eq: "PICKED_UP",
      },
      fundsStatus: {
        eq: "HELD",
      },
      earningsAllocationStatus: {
        eq: "ALLOCATED",
      },
      paymentStatus: {
        eq: "PAID",
      },
      paymentMethod: {
        eq: "PAYSTACK",
      },
      fundsReleaseBlocked: {
        ne: true,
      },
    };
  } else if (milestone === "DELIVERED" && nextFundsStatus === "RELEASED") {
    /*
    Delivery can start from either HELD (catch-up) or
    PARTIALLY_RELEASED (normal second milestone).

    The condition below is combined with the current fundsStatus
    so the update cannot succeed if the state changed after reading.
    */

    condition = {
      status: {
        eq: "DELIVERED",
      },
      fundsStatus: {
        eq: normalize(order.fundsStatus),
      },
      earningsAllocationStatus: {
        eq: "ALLOCATED",
      },
      paymentStatus: {
        eq: "PAID",
      },
      paymentMethod: {
        eq: "PAYSTACK",
      },
      fundsReleaseBlocked: {
        ne: true,
      },
    };
  } else {
    throw new Error(
      `Unsupported Order financial transition: ` +
        `${milestone} -> ${nextFundsStatus}.`,
    );
  }

  const response = await graphqlRequest(mutation, {
    input,
    condition,
  });

  const updatedOrder = response?.data?.updateOrder;

  if (!updatedOrder) {
    throw new Error(`Order update returned no record for ${order.id}.`);
  }

  return updatedOrder;
}

/*
===============================================================================
10. GRAPHQL REQUEST HELPER
===============================================================================

Every query and mutation uses this helper.

It:
- Validates the endpoint and API key.
- Sends the request to AppSync.
- Parses the response.
- Throws on HTTP errors or GraphQL errors.
*/

async function graphqlRequest(query, variables = {}) {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error(
      "Missing API_ATUA_GRAPHQLAPIENDPOINTOUTPUT environment variable.",
    );
  }

  if (!API_KEY) {
    throw new Error(
      "Missing API_ATUA_GRAPHQLAPIKEYOUTPUT environment variable.",
    );
  }

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

  const responseText = await response.text();

  let payload;

  try {
    payload = JSON.parse(responseText);
  } catch {
    throw new Error(`AppSync returned invalid JSON. HTTP ${response.status}.`);
  }

  if (!response.ok) {
    throw new Error(`AppSync HTTP ${response.status}: ${responseText}`);
  }

  if (payload.errors && payload.errors.length > 0) {
    throw new Error(
      "AppSync GraphQL error: " +
        payload.errors.map((item) => item.message).join("; "),
    );
  }

  return payload;
}

/*
===============================================================================
11. UTILITY FUNCTIONS
===============================================================================
*/

// Normalize strings and enum values before comparing them.
function normalize(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

// Normalize monetary values to two decimal places.
function normalizeMoney(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`Invalid monetary value: ${value}`);
  }

  return Math.round((number + Number.EPSILON) * 100) / 100;
}

/*
Return a structured response.

The calling Lambda must inspect the response body as well as statusCode.
*/

function successResponse(body) {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}
