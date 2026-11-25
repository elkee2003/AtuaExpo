/*
===============================================================================
ATUA — RELEASE COURIER MILESTONE FUNDS
===============================================================================

PURPOSE
-------
This Lambda releases MAXI courier earnings in two milestones:

1. PICKED_UP:
   - Release 50% of courierEarnings.
   - Move that amount from pendingBalance to availableBalance.
   - Set fundsStatus to PARTIALLY_RELEASED.

2. DELIVERED:
   - If 50% was previously released, release the remaining balance.
   - If nothing was previously released, release the full amount as a
     catch-up release.
   - Set fundsStatus to RELEASED.

IMPORTANT FINANCIAL RULES
-------------------------
- MAXI orders only.
- PAYSTACK orders only.
- paymentStatus must be PAID.
- earningsAllocationStatus must be ALLOCATED.
- Cash orders are never released through this Lambda.
- The original EARNINGS-{orderID} transaction must exist and be valid.
- outstandingDebt is never deducted here.
- This Lambda does not initiate bank payouts.

DATABASE LIMITATION
-------------------
Order and Wallet are separate AppSync records.

Their updates are NOT one atomic transaction.

This implementation:
- Uses AppSync _version where available.
- Checks wallet balances again after ambiguous update errors.
- Uses conditional Order updates.
- Attempts compensating wallet rollback if the Order update fails.
- Stops and reports reconciliation when it cannot safely determine the
  financial outcome.

A crash after the Wallet update but before the Order update can still
require manual reconciliation. Do not treat this as a fully atomic ledger.

ENVIRONMENT VARIABLES
---------------------
API_ATUA_GRAPHQLAPIENDPOINTOUTPUT
API_ATUA_GRAPHQLAPIKEYOUTPUT

===============================================================================
*/

const fetch = global.fetch || require("node-fetch");

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

/*
===============================================================================
1. MAIN HANDLER
===============================================================================
*/

exports.handler = async (event) => {
  let orderID = null;

  try {
    console.log("================================================");
    console.log("ATUA MAXI MILESTONE RELEASE START");
    console.log("================================================");

    /*
     * Accept the payload formats used by direct Lambda invocations
     * and by financialOrderTrigger.
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
     * The milestone is optional. If omitted, the latest Order.status
     * determines which milestone should be processed.
     */
    const suppliedMilestone =
      event?.milestone ||
      event?.arguments?.milestone ||
      event?.input?.milestone ||
      event?.detail?.milestone ||
      null;

    const requestedMilestone = suppliedMilestone
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
     * Always retrieve the latest Order.
     * Never trust financial amounts supplied in the event payload.
     */
    const order = await getOrder(orderID);

    if (!order || order._deleted === true) {
      throw new Error(`Order ${orderID} was not found or has been deleted.`);
    }

    const orderStatus = normalize(order.status);
    const paymentStatus = normalize(order.paymentStatus);
    const paymentMethod = normalize(order.paymentMethod);
    const allocationStatus = normalize(order.earningsAllocationStatus);

    const fundsStatus = normalize(order.fundsStatus);

    console.log(
      "CURRENT ORDER STATE:",
      JSON.stringify({
        status: orderStatus,
        paymentStatus,
        paymentMethod,
        allocationStatus,
        fundsStatus,
        fundsReleasedAmount: order.fundsReleasedAmount,
      }),
    );

    /*
     * -------------------------------------------------------------------------
     * VERIFY MAXI ORDER
     * -------------------------------------------------------------------------
     *
     * Do not accept an Order where transportationType and vehicleClass
     * explicitly contradict each other.
     */
    const transportationType = normalize(order.transportationType);
    const vehicleClass = normalize(order.vehicleClass);

    if (transportationType && transportationType !== "MAXI") {
      throw new Error(
        `Order ${orderID} has transportationType ` +
          `"${transportationType}", not MAXI.`,
      );
    }

    if (vehicleClass && vehicleClass !== "MAXI") {
      throw new Error(
        `Order ${orderID} has vehicleClass "${vehicleClass}", not MAXI.`,
      );
    }

    if (transportationType !== "MAXI" && vehicleClass !== "MAXI") {
      throw new Error(`Order ${orderID} cannot be identified as a MAXI order.`);
    }

    /*
     * -------------------------------------------------------------------------
     * VERIFY ASSIGNED COURIER
     * -------------------------------------------------------------------------
     */
    const courierID = order.assignedCourierId;

    if (!courierID) {
      throw new Error(`Order ${orderID} has no assigned courier.`);
    }

    /*
     * -------------------------------------------------------------------------
     * CASH ORDERS MUST NEVER ENTER THIS RELEASE FLOW
     * -------------------------------------------------------------------------
     */
    if (paymentMethod === "CASH") {
      if (allocationStatus === "ALLOCATED") {
        console.error(
          "CASH ORDER HAS ELECTRONIC EARNINGS ALLOCATION:",
          orderID,
        );

        return successResponse({
          success: false,
          skipped: true,
          reconciliationRequired: true,
          orderID,
          courierID,
          paymentMethod,
          fundsStatus,
          message:
            "This cash Order has already been allocated through the " +
            "electronic wallet flow. Review the wallet and ledger " +
            "before making any adjustment.",
        });
      }

      return successResponse({
        success: true,
        skipped: true,
        orderID,
        courierID,
        paymentMethod,
        message:
          "Cash orders are not released through the electronic " +
          "Maxi milestone flow.",
      });
    }

    /*
     * Only Paystack-funded orders can enter this Lambda.
     */
    if (paymentMethod !== "PAYSTACK") {
      throw new Error(
        `Unsupported payment method "${order.paymentMethod}". ` +
          "Only PAYSTACK orders are supported.",
      );
    }

    /*
     * Paystack verification must already have succeeded elsewhere.
     */
    if (paymentStatus !== "PAID") {
      throw new Error(
        `Order ${orderID} is not PAID. ` +
          `Current paymentStatus=${order.paymentStatus}.`,
      );
    }

    /*
     * Earnings must already have been allocated to pendingBalance.
     */
    if (allocationStatus !== "ALLOCATED") {
      throw new Error(
        `Courier earnings are not allocated for Order ${orderID}. ` +
          `Current allocation status=${order.earningsAllocationStatus}.`,
      );
    }

    /*
     * Respect administrative holds.
     */
    if (order.fundsReleaseBlocked === true) {
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
     * Validate the amount that was allocated to the courier.
     */
    const earnings = normalizeMoney(order.courierEarnings);

    if (earnings <= 0) {
      throw new Error(
        `Invalid courierEarnings for Order ${orderID}: ` +
          `${order.courierEarnings}.`,
      );
    }

    /*
     * Read the amount already released.
     */
    const currentReleasedAmount = normalizeMoney(
      order.fundsReleasedAmount ?? 0,
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
     * -------------------------------------------------------------------------
     * DETERMINE THE EFFECTIVE MILESTONE
     * -------------------------------------------------------------------------
     *
     * Use the latest Order status to protect against stale stream events.
     *
     * Example:
     * A PICKED_UP stream event may be processed after the Order is already
     * DELIVERED. In that case, process DELIVERED catch-up instead.
     */
    let milestone = requestedMilestone || orderStatus;

    if (milestone === "PICKED_UP" && orderStatus === "DELIVERED") {
      console.log(
        `Order ${orderID} is already DELIVERED. ` +
          "Switching to delivery catch-up processing.",
      );

      milestone = "DELIVERED";
    }

    if (milestone !== "PICKED_UP" && milestone !== "DELIVERED") {
      throw new Error(`Cannot process milestone "${milestone}".`);
    }

    /*
     * A pickup release is valid only when the current Order is PICKED_UP.
     */
    if (milestone === "PICKED_UP" && orderStatus !== "PICKED_UP") {
      throw new Error(
        `Cannot process PICKED_UP for Order ${orderID}. ` +
          `Current Order.status=${orderStatus}.`,
      );
    }

    /*
     * A delivery release is valid only when the current Order is DELIVERED.
     */
    if (milestone === "DELIVERED" && orderStatus !== "DELIVERED") {
      throw new Error(
        `Cannot process DELIVERED for Order ${orderID}. ` +
          `Current Order.status=${orderStatus}.`,
      );
    }

    console.log("EFFECTIVE MILESTONE:", milestone);

    /*
     * -------------------------------------------------------------------------
     * DUPLICATE DELIVERY PROTECTION
     * -------------------------------------------------------------------------
     *
     * If the Order already says RELEASED, do not move the Wallet again.
     */
    if (milestone === "DELIVERED" && fundsStatus === "RELEASED") {
      if (Math.abs(currentReleasedAmount - earnings) > 0.01) {
        throw new Error(
          `Order ${orderID} is RELEASED, but fundsReleasedAmount ` +
            "does not equal courierEarnings. Reconciliation required.",
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
     * -------------------------------------------------------------------------
     * DUPLICATE PICKUP PROTECTION
     * -------------------------------------------------------------------------
     *
     * If the pickup milestone has already been processed, do not release
     * another 50%.
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
     * -------------------------------------------------------------------------
     * LOAD THE COURIER WALLET
     * -------------------------------------------------------------------------
     */
    const wallet = await getCourierWallet(courierID);

    if (!wallet) {
      throw new Error(`No wallet found for courier ${courierID}.`);
    }

    verifyCourierWallet(wallet, courierID);

    /*
     * -------------------------------------------------------------------------
     * VERIFY THE ORIGINAL EARNINGS TRANSACTION
     * -------------------------------------------------------------------------
     *
     * allocateCourierEarnings should have created:
     *
     *     EARNINGS-{orderID}
     *
     * This transaction must match the assigned courier's Wallet and
     * the full courier earnings amount.
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
     * -------------------------------------------------------------------------
     * CALCULATE THE MILESTONE RELEASE
     * -------------------------------------------------------------------------
     */
    let releaseAmount = 0;
    let nextFundsStatus = null;
    let releaseType = null;

    let pickupTimestamp = null;
    let deliveryTimestamp = null;

    const now = new Date().toISOString();

    if (milestone === "PICKED_UP") {
      /*
       * The first milestone must start from HELD.
       */
      if (fundsStatus !== "HELD") {
        throw new Error(
          `Pickup release requires fundsStatus HELD. ` +
            `Current status=${fundsStatus}.`,
        );
      }

      if (Math.abs(currentReleasedAmount) > 0.01) {
        throw new Error(
          `Order ${orderID} is HELD but already records released funds. ` +
            "Reconciliation is required.",
        );
      }

      /*
       * Release the first half.
       *
       * normalizeMoney handles rounding to two decimal places.
       * The delivery milestone will release the exact remainder.
       */
      releaseAmount = normalizeMoney(earnings / 2);

      nextFundsStatus = "PARTIALLY_RELEASED";
      releaseType = "MAXI_PICKUP";
      pickupTimestamp = now;
    }

    if (milestone === "DELIVERED") {
      if (fundsStatus === "PARTIALLY_RELEASED") {
        /*
         * Normal delivery flow:
         * Release only the amount that remains.
         */
        releaseAmount = normalizeMoney(earnings - currentReleasedAmount);

        nextFundsStatus = "RELEASED";
        releaseType = "MAXI_DELIVERY";
        deliveryTimestamp = now;
      } else if (fundsStatus === "HELD") {
        /*
         * Catch-up flow:
         *
         * The Order is already DELIVERED, but no milestone release
         * has been recorded. Release all earnings once.
         *
         * Do not write pickupFundsReleasedAt because no pickup
         * release actually occurred.
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
     * Calculate the new cumulative amount released.
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

    /*
     * A final release must equal the full courier earnings amount.
     */
    if (
      nextFundsStatus === "RELEASED" &&
      Math.abs(newReleasedAmount - earnings) > 0.01
    ) {
      throw new Error(
        `Final release does not equal total courier earnings ` +
          `for Order ${orderID}. Reconciliation required.`,
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
     * -------------------------------------------------------------------------
     * VALIDATE WALLET BALANCES
     * -------------------------------------------------------------------------
     */

    const pendingBalance = normalizeMoney(wallet.pendingBalance ?? 0);
    const availableBalance = normalizeMoney(wallet.availableBalance ?? 0);
    const lifetimeEarnings = normalizeMoney(wallet.lifetimeEarnings ?? 0);

    const cashLifetimeEarnings = normalizeMoney(
      wallet.cashLifetimeEarnings ?? 0,
    );

    const electronicLifetimeEarnings = normalizeMoney(
      wallet.electronicLifetimeEarnings ?? 0,
    );

    if (
      pendingBalance < 0 ||
      availableBalance < 0 ||
      lifetimeEarnings < 0 ||
      cashLifetimeEarnings < 0 ||
      electronicLifetimeEarnings < 0
    ) {
      throw new Error(`Wallet ${wallet.id} has a negative balance.`);
    }

    if (pendingBalance + 0.01 < releaseAmount) {
      throw new Error(
        `Insufficient pending balance for Order ${orderID}. ` +
          `Pending=${pendingBalance}; required=${releaseAmount}.`,
      );
    }

    /*
     * -------------------------------------------------------------------------
     * CALCULATE NEW WALLET BALANCES
     * -------------------------------------------------------------------------
     *
     * MAXI milestone releases:
     * - Reduce pendingBalance.
     * - Increase availableBalance.
     * - Increase electronicLifetimeEarnings.
     * - Preserve cashLifetimeEarnings.
     * - Recalculate lifetimeEarnings as cash + electronic.
     *
     * outstandingDebt is deliberately not changed.
     */

    const newPendingBalance = normalizeMoney(pendingBalance - releaseAmount);

    const newAvailableBalance = normalizeMoney(
      availableBalance + releaseAmount,
    );

    const newCashLifetimeEarnings = cashLifetimeEarnings;

    const newElectronicLifetimeEarnings = normalizeMoney(
      electronicLifetimeEarnings + releaseAmount,
    );

    const newLifetimeEarnings = normalizeMoney(
      newCashLifetimeEarnings + newElectronicLifetimeEarnings,
    );

    /*
     * Preserve the original Wallet state for rollback.
     */
    const originalWalletState = {
      availableBalance,
      pendingBalance,
      lifetimeEarnings,
      cashLifetimeEarnings,
      electronicLifetimeEarnings,
    };

    let updatedWallet = null;
    let walletUpdated = false;

    try {
      /*
       * -----------------------------------------------------------------------
       * UPDATE WALLET
       * -----------------------------------------------------------------------
       *
       * Include _version when available.
       *
       * AppSync must enforce optimistic concurrency for _version to protect
       * against concurrent Wallet updates.
       */
      try {
        updatedWallet = await updateWallet({
          wallet,
          availableBalance: newAvailableBalance,
          pendingBalance: newPendingBalance,
          lifetimeEarnings: newLifetimeEarnings,
          cashLifetimeEarnings: newCashLifetimeEarnings,
          electronicLifetimeEarnings: newElectronicLifetimeEarnings,
        });

        walletUpdated = true;
      } catch (walletUpdateError) {
        /*
         * An HTTP timeout or network error does not always mean the
         * database mutation failed.
         *
         * Re-read the Wallet before deciding whether to retry or stop.
         */
        console.error(
          "Wallet update returned an error. Checking latest Wallet state:",
          walletUpdateError.message,
        );

        const latestWallet = await getWallet(wallet.id);

        if (!latestWallet) {
          throw new Error(
            `Wallet ${wallet.id} could not be re-read after an ` +
              "ambiguous update result. Reconciliation required.",
          );
        }

        const latestAvailable = normalizeMoney(
          latestWallet.availableBalance ?? 0,
        );

        const latestPending = normalizeMoney(latestWallet.pendingBalance ?? 0);

        const latestLifetime = normalizeMoney(
          latestWallet.lifetimeEarnings ?? 0,
        );

        const latestCashLifetime = normalizeMoney(
          latestWallet.cashLifetimeEarnings ?? 0,
        );

        const latestElectronicLifetime = normalizeMoney(
          latestWallet.electronicLifetimeEarnings ?? 0,
        );

        const walletHasExpectedValues =
          moneyEqual(latestAvailable, newAvailableBalance) &&
          moneyEqual(latestPending, newPendingBalance) &&
          moneyEqual(latestLifetime, newLifetimeEarnings) &&
          moneyEqual(latestCashLifetime, newCashLifetimeEarnings) &&
          moneyEqual(latestElectronicLifetime, newElectronicLifetimeEarnings);

        const walletHasOriginalValues =
          moneyEqual(latestAvailable, originalWalletState.availableBalance) &&
          moneyEqual(latestPending, originalWalletState.pendingBalance) &&
          moneyEqual(latestLifetime, originalWalletState.lifetimeEarnings) &&
          moneyEqual(
            latestCashLifetime,
            originalWalletState.cashLifetimeEarnings,
          ) &&
          moneyEqual(
            latestElectronicLifetime,
            originalWalletState.electronicLifetimeEarnings,
          );

        if (walletHasExpectedValues) {
          /*
           * The update appears to have committed despite the error response.
           * Continue with the Order update.
           */
          updatedWallet = latestWallet;
          walletUpdated = true;
        } else if (walletHasOriginalValues) {
          /*
           * The Wallet still has the original balances.
           * The update did not commit.
           */
          throw walletUpdateError;
        } else {
          /*
           * Another update may have changed the Wallet, or the outcome
           * cannot be determined safely.
           *
           * Do not overwrite the Wallet.
           */
          throw new Error(
            `CRITICAL FINANCIAL RECONCILIATION REQUIRED. ` +
              `Wallet ${wallet.id} has balances that match neither ` +
              "the original nor the expected release values. " +
              `Original error: ${walletUpdateError.message}`,
          );
        }
      }

      /*
       * -----------------------------------------------------------------------
       * UPDATE ORDER FINANCIAL STATE
       * -----------------------------------------------------------------------
       *
       * Only update the Order after the Wallet mutation has succeeded.
       *
       * The conditional update checks the original financial state.
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
       * Log the successful release.
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
       * -----------------------------------------------------------------------
       * COMPENSATING WALLET ROLLBACK
       * -----------------------------------------------------------------------
       *
       * If the Wallet update succeeded but the Order update failed,
       * attempt to restore the original Wallet balances.
       *
       * The rollback uses the latest Wallet version returned by AppSync.
       */
      if (walletUpdated && updatedWallet) {
        console.error(`Attempting Wallet rollback for Order ${orderID}.`);

        try {
          await rollbackWallet({
            updatedWallet,
            availableBalance: originalWalletState.availableBalance,
            pendingBalance: originalWalletState.pendingBalance,
            lifetimeEarnings: originalWalletState.lifetimeEarnings,
            cashLifetimeEarnings: originalWalletState.cashLifetimeEarnings,
            electronicLifetimeEarnings:
              originalWalletState.electronicLifetimeEarnings,
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

      throw releaseError;
    }
  } catch (error) {
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
2. GET ORDER
===============================================================================
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
3. GET WALLET BY ID
===============================================================================

Used to verify an ambiguous Wallet update result.
*/

async function getWallet(walletID) {
  const query = /* GraphQL */ `
    query GetWallet($id: ID!) {
      getWallet(id: $id) {
        id
        ownerID
        ownerType
        availableBalance
        pendingBalance
        lifetimeEarnings
        cashLifetimeEarnings
        electronicLifetimeEarnings
        _version
        _deleted
      }
    }
  `;

  const response = await graphqlRequest(query, {
    id: walletID,
  });

  const wallet = response?.data?.getWallet || null;

  if (!wallet || wallet._deleted === true) {
    return null;
  }

  return wallet;
}

/*
===============================================================================
4. FIND COURIER WALLET
===============================================================================

Find exactly one active COURIER wallet.

If there are multiple matching wallets, stop rather than risk paying
the wrong wallet.
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
          cashLifetimeEarnings
          electronicLifetimeEarnings
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
5. VERIFY WALLET OWNERSHIP
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
6. FIND ORIGINAL EARNINGS TRANSACTION
===============================================================================

Expected reference:

    EARNINGS-{orderID}

There must be exactly one active matching Transaction.
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
7. VERIFY EARNINGS TRANSACTION
===============================================================================
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

  if (!moneyEqual(normalizeMoney(transaction.amount), earnings)) {
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
8. UPDATE WALLET
===============================================================================

Moves the milestone amount from pendingBalance to availableBalance.

The _version is included when available. AppSync must have optimistic
concurrency enabled for version checks to protect concurrent updates.
*/

async function updateWallet({
  wallet,
  availableBalance,
  pendingBalance,
  lifetimeEarnings,
  cashLifetimeEarnings,
  electronicLifetimeEarnings,
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
        cashLifetimeEarnings
        electronicLifetimeEarnings
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
    cashLifetimeEarnings: normalizeMoney(cashLifetimeEarnings),
    electronicLifetimeEarnings: normalizeMoney(electronicLifetimeEarnings),
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
9. ROLL BACK WALLET
===============================================================================

Compensating operation used when the Wallet update succeeded but the
Order update failed.

Use the _version returned by the successful Wallet update.
*/

async function rollbackWallet({
  updatedWallet,
  availableBalance,
  pendingBalance,
  lifetimeEarnings,
  cashLifetimeEarnings,
  electronicLifetimeEarnings,
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
        cashLifetimeEarnings
        electronicLifetimeEarnings
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
    cashLifetimeEarnings: normalizeMoney(cashLifetimeEarnings),
    electronicLifetimeEarnings: normalizeMoney(electronicLifetimeEarnings),
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
10. UPDATE ORDER FINANCIAL STATE
===============================================================================

Allowed transitions:

PICKUP:
    HELD -> PARTIALLY_RELEASED

DELIVERY AFTER PICKUP:
    PARTIALLY_RELEASED -> RELEASED

DELIVERY CATCH-UP:
    HELD -> RELEASED

The condition checks the original state so a stale invocation cannot
freely overwrite a newer financial state.
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

  /*
   * Only write the pickup timestamp when the pickup release occurs.
   */
  if (pickupFundsReleasedAt) {
    input.pickupFundsReleasedAt = pickupFundsReleasedAt;
  }

  /*
   * Write the final-release timestamp at delivery.
   */
  if (fundsReleasedAt) {
    input.fundsReleasedAt = fundsReleasedAt;
  }

  /*
   * Include Order version when available.
   */
  if (order._version !== undefined && order._version !== null) {
    input._version = order._version;
  }

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
11. GRAPHQL REQUEST HELPER
===============================================================================
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

  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;

  /*
   * Avoid waiting indefinitely for an AppSync request.
   */
  const timeout = controller
    ? setTimeout(() => controller.abort(), 15000)
    : null;

  let response;

  try {
    response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
      ...(controller ? { signal: controller.signal } : {}),
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("AppSync request timed out after 15 seconds.");
    }

    throw error;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }

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
12. UTILITY FUNCTIONS
===============================================================================
*/

/*
 * Normalize strings and enum values before comparing them.
 */
function normalize(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

/*
 * Normalize monetary values to two decimal places.
 */
function normalizeMoney(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`Invalid monetary value: ${value}`);
  }

  return Math.round((number + Number.EPSILON) * 100) / 100;
}

/*
 * Compare money values using a one-kobo tolerance.
 */
function moneyEqual(first, second) {
  return Math.abs(normalizeMoney(first) - normalizeMoney(second)) < 0.01;
}

/*
 * Kept as an explicit helper so all balance comparisons use
 * normalized monetary values.
 */
function pendingSafe(value) {
  return normalizeMoney(value);
}

/*
 * Return a structured successful response.
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
