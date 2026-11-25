/* Amplify Params - DO NOT EDIT
    ENV
    REGION
Amplify Params - DO NOT EDIT */

/**
 * ATUA — RELEASE FUNDS
 *
 * PURPOSE
 * -------
 * Releases allocated courier earnings for MICRO and MOTO orders
 * after successful delivery.
 *
 * SUPPORTED FLOW
 * --------------
 * 1. Order is paid through PAYSTACK.
 * 2. Backend verifies payment and sets paymentStatus = PAID.
 * 3. allocateCourierEarnings credits courier pendingBalance.
 * 4. Order reaches DELIVERED.
 * 5. This Lambda validates the Order, Courier, Wallet and
 *    original EARNINGS transaction.
 * 6. The Order is conditionally claimed for release.
 * 7. Wallet pendingBalance decreases.
 * 8. Wallet availableBalance increases.
 * 9. Wallet electronicLifetimeEarnings and lifetimeEarnings increase.
 *
 * IMPORTANT
 * ---------
 * - CASH orders are never released through this Lambda.
 * - MAXI orders must use releaseCourierMilestoneFunds.
 * - This Lambda does not calculate courier earnings.
 * - This Lambda does not recover courier debt.
 * - This Lambda increases electronicLifetimeEarnings when
 *   earnings are released into availableBalance.
 * - cashLifetimeEarnings is preserved and never changed here.
 * - lifetimeEarnings remains the combined cash and electronic total.
 *
 * FINANCIAL SAFETY
 * ----------------
 * - Checks payment method and payment status.
 * - Checks earnings allocation status.
 * - Checks Order delivery status.
 * - Checks courier and wallet ownership.
 * - Checks the original EARNINGS transaction.
 * - Uses a conditional Order claim.
 * - Uses a conditional Wallet update.
 * - Handles uncertain Wallet update outcomes by rereading
 *   the Wallet before deciding whether rollback is safe.
 *
 * IMPORTANT LIMITATION
 * --------------------
 * AppSync does not make the Order and Wallet mutations atomic.
 * If a process crashes between those mutations, manual
 * reconciliation may still be required.
 */

"use strict";

// =============================================================================
// 1. CONFIGURATION
// =============================================================================

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

// This Lambda requires the native fetch available in supported
// modern Node.js Lambda runtimes.
if (typeof fetch !== "function") {
  throw new Error(
    "Native fetch is unavailable. Use a supported Node.js Lambda runtime.",
  );
}

const REQUEST_TIMEOUT_MS = 15000;

// =============================================================================
// 2. MAIN HANDLER
// =============================================================================

exports.handler = async (event) => {
  const orderID =
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

  console.log("=================================================");
  console.log("ATUA RELEASE FUNDS START");
  console.log("Order ID:", orderID);
  console.log("=================================================");

  let order = null;
  let courier = null;
  let wallet = null;

  let claimedOrder = null;
  let walletUpdated = false;

  let expectedWalletBalances = null;

  try {
    // =======================================================================
    // STEP 1: LOAD THE LATEST ORDER
    // =======================================================================

    order = await getOrder(orderID);

    if (!order || order._deleted === true) {
      throw new Error(`Order ${orderID} was not found or has been deleted.`);
    }

    const paymentMethod = normalize(order.paymentMethod);
    const paymentStatus = normalize(order.paymentStatus);
    const orderStatus = normalize(order.status);
    const fundsStatus = normalize(order.fundsStatus);
    const allocationStatus = normalize(order.earningsAllocationStatus);

    const courierID = order.assignedCourierId;

    // =======================================================================
    // STEP 2: HANDLE CASH ORDERS
    // =======================================================================

    /**
     * Cash is physically collected by the courier.
     *
     * It is not money held electronically by Atua.
     * Therefore, this Lambda must never move cash-order earnings
     * from pendingBalance to availableBalance.
     *
     * If cash earnings have already been allocated, that is a
     * financial inconsistency requiring reconciliation.
     */

    if (paymentMethod === "CASH") {
      if (allocationStatus === "ALLOCATED") {
        console.error(
          "CRITICAL: CASH ORDER HAS ALLOCATED ONLINE EARNINGS",
          JSON.stringify({
            orderID,
            courierID,
            allocationStatus,
            fundsStatus,
          }),
        );

        return response({
          success: false,
          skipped: true,
          reconciliationRequired: true,
          orderID,
          courierID: courierID || null,
          paymentMethod: "CASH",
          message:
            "Cash order has an allocated earnings transaction. " +
            "Inspect the Wallet and ledger before making adjustments.",
        });
      }

      console.log(`Skipping online funds release for CASH Order ${orderID}.`);

      return response({
        success: true,
        skipped: true,
        orderID,
        paymentMethod: "CASH",
        message:
          "Cash orders are handled by cash collection and reconciliation.",
      });
    }

    // =======================================================================
    // STEP 3: VALIDATE PAYMENT METHOD
    // =======================================================================

    if (paymentMethod !== "PAYSTACK") {
      throw new Error(
        `Unsupported payment method: ${order.paymentMethod}. ` +
          "Only PAYSTACK orders can use releaseFunds.",
      );
    }

    // =======================================================================
    // STEP 4: VERIFY PAYMENT
    // =======================================================================

    if (paymentStatus !== "PAID") {
      throw new Error(
        `Order ${orderID} is not PAID. Current status: ${order.paymentStatus}`,
      );
    }

    // =======================================================================
    // STEP 5: VERIFY EARNINGS ALLOCATION
    // =======================================================================

    if (allocationStatus !== "ALLOCATED") {
      throw new Error(
        `Order ${orderID} earnings are not allocated. ` +
          `Current status: ${order.earningsAllocationStatus}`,
      );
    }

    // =======================================================================
    // STEP 6: VERIFY COURIER
    // =======================================================================

    if (!courierID) {
      throw new Error(`Order ${orderID} has no assigned courier.`);
    }

    // =======================================================================
    // STEP 7: VERIFY DELIVERY
    // =======================================================================

    if (orderStatus !== "DELIVERED") {
      throw new Error(
        `Order ${orderID} is not DELIVERED. ` +
          `Current status: ${order.status}`,
      );
    }

    // =======================================================================
    // STEP 8: VERIFY TRANSPORTATION TYPE
    // =======================================================================

    const transportationType = normalize(order.transportationType);

    const vehicleClass = normalize(order.vehicleClass);

    const isMaxi = transportationType === "MAXI" || vehicleClass === "MAXI";

    if (isMaxi) {
      throw new Error(
        `Order ${orderID} is MAXI. ` +
          "Use releaseCourierMilestoneFunds instead.",
      );
    }

    const isMicro =
      transportationType === "MICRO" ||
      transportationType.startsWith("MICRO_") ||
      vehicleClass === "MICRO";

    const isMoto =
      transportationType === "MOTO" ||
      transportationType.startsWith("MOTO_") ||
      vehicleClass === "MOTO";

    if (!isMicro && !isMoto) {
      throw new Error(
        `Unsupported transportation type "${transportationType}" ` +
          `and vehicle class "${vehicleClass}".`,
      );
    }

    // =======================================================================
    // STEP 9: CHECK ADMINISTRATIVE HOLD
    // =======================================================================

    if (order.fundsReleaseBlocked === true) {
      console.log(`Funds release is blocked for Order ${orderID}.`);

      return response({
        success: true,
        skipped: true,
        orderID,
        courierID,
        releaseBlocked: true,
        holdReason: order.fundsHoldReason || null,
        message: "Funds release is blocked by an administrator.",
      });
    }

    // =======================================================================
    // STEP 10: CHECK DUPLICATE RELEASE
    // =======================================================================

    if (fundsStatus === "RELEASED") {
      const recordedAmount = money(order.fundsReleasedAmount ?? 0);

      const currentEarnings = money(order.courierEarnings);

      if (recordedAmount !== currentEarnings) {
        throw new Error(
          `Order ${orderID} is marked RELEASED but its recorded ` +
            `release amount (${recordedAmount}) does not match ` +
            `courier earnings (${currentEarnings}). ` +
            "Manual reconciliation is required.",
        );
      }

      console.log(`Order ${orderID} has already been released.`);

      return response({
        success: true,
        alreadyProcessed: true,
        orderID,
        courierID,
        fundsStatus: "RELEASED",
        fundsReleasedAmount: recordedAmount,
        message:
          "This Order has already been released. No additional wallet change was made.",
      });
    }

    // =======================================================================
    // STEP 11: REQUIRE HELD STATE
    // =======================================================================

    if (fundsStatus !== "HELD") {
      throw new Error(
        `Order ${orderID} has fundsStatus "${order.fundsStatus}". ` +
          "MICRO/MOTO release requires HELD.",
      );
    }

    if (money(order.fundsReleasedAmount ?? 0) !== 0) {
      throw new Error(
        `Order ${orderID} is HELD but already has a recorded ` +
          "release amount. Manual reconciliation is required.",
      );
    }

    // =======================================================================
    // STEP 12: VALIDATE EARNINGS
    // =======================================================================

    const earnings = money(order.courierEarnings);

    if (earnings <= 0) {
      throw new Error(
        `Invalid courier earnings for Order ${orderID}: ${order.courierEarnings}`,
      );
    }

    // =======================================================================
    // STEP 13: LOAD COURIER
    // =======================================================================

    courier = await getCourier(courierID);

    if (!courier || courier._deleted === true) {
      throw new Error(
        `Courier ${courierID} was not found or has been deleted.`,
      );
    }

    // =======================================================================
    // STEP 14: FIND COURIER WALLET
    // =======================================================================

    wallet = await findCourierWallet(courier);

    if (!wallet) {
      throw new Error(`No Wallet found for Courier ${courierID}.`);
    }

    if (
      wallet.ownerID !== courierID ||
      normalize(wallet.ownerType) !== "COURIER"
    ) {
      throw new Error(
        `Wallet ${wallet.id} does not belong to Courier ${courierID}.`,
      );
    }

    // =======================================================================
    // STEP 15: VALIDATE WALLET BALANCES
    // =======================================================================

    const pendingBalance = money(wallet.pendingBalance ?? 0);

    const availableBalance = money(wallet.availableBalance ?? 0);

    const lifetimeEarnings = money(wallet.lifetimeEarnings ?? 0);
    const cashLifetimeEarnings = money(wallet.cashLifetimeEarnings ?? 0);
    const electronicLifetimeEarnings = money(
      wallet.electronicLifetimeEarnings ?? 0,
    );

    if (
      pendingBalance < 0 ||
      availableBalance < 0 ||
      lifetimeEarnings < 0 ||
      cashLifetimeEarnings < 0 ||
      electronicLifetimeEarnings < 0
    ) {
      throw new Error(`Wallet ${wallet.id} contains a negative balance.`);
    }

    if (pendingBalance < earnings) {
      throw new Error(
        `Insufficient pending balance for Order ${orderID}. ` +
          `Available pending balance: ${pendingBalance}; ` +
          `required: ${earnings}.`,
      );
    }

    // =======================================================================
    // STEP 16: VERIFY ORIGINAL EARNINGS TRANSACTION
    // =======================================================================

    const transactionReference = `EARNINGS-${orderID}`;

    const transaction = await getEarningsTransaction(transactionReference);

    validateEarningsTransaction({
      transaction,
      walletID: wallet.id,
      orderID,
      earnings,
    });

    // =======================================================================
    // STEP 17: CALCULATE NEW WALLET BALANCES
    // =======================================================================

    const newPendingBalance = money(pendingBalance - earnings);
    const newAvailableBalance = money(availableBalance + earnings);

    const newCashLifetimeEarnings = money(wallet.cashLifetimeEarnings ?? 0);

    const newElectronicLifetimeEarnings = money(
      electronicLifetimeEarnings + earnings,
    );

    const newLifetimeEarnings = money(
      newCashLifetimeEarnings + newElectronicLifetimeEarnings,
    );

    expectedWalletBalances = {
      pendingBalance: newPendingBalance,
      availableBalance: newAvailableBalance,
      lifetimeEarnings: newLifetimeEarnings,
      cashLifetimeEarnings: newCashLifetimeEarnings,
      electronicLifetimeEarnings: newElectronicLifetimeEarnings,
    };

    // =======================================================================
    // STEP 18: CLAIM ORDER FOR RELEASE
    // =======================================================================

    const releaseTimestamp = new Date().toISOString();

    claimedOrder = await claimOrderRelease({
      order,
      courierID,
      earnings,
      releaseTimestamp,
    });

    if (!claimedOrder) {
      const latestOrder = await getOrder(orderID);

      if (
        normalize(latestOrder?.fundsStatus) === "RELEASED" &&
        money(latestOrder?.fundsReleasedAmount ?? 0) === earnings
      ) {
        return response({
          success: true,
          alreadyProcessed: true,
          orderID,
          courierID,
          message:
            "Another invocation has already claimed or released this Order.",
        });
      }

      throw new Error(
        `Could not claim Order ${orderID} for release. ` +
          "Refresh the Order and investigate before retrying.",
      );
    }

    // =======================================================================
    // STEP 19: UPDATE WALLET CONDITIONALLY
    // =======================================================================

    /**
     * The Wallet mutation checks that:
     *
     * - The wallet still belongs to the same courier.
     * - pendingBalance has not changed.
     * - availableBalance has not changed.
     * - lifetimeEarnings has not changed.
     * - cashLifetimeEarnings has not changed.
     * - electronicLifetimeEarnings has not changed.
     *
     * The release increases electronicLifetimeEarnings and
     * lifetimeEarnings, while preserving cashLifetimeEarnings.
     *
     * If another financial operation updates the Wallet first,
     * this mutation must fail rather than overwrite that update.
     */

    try {
      await updateWallet({
        wallet,
        pendingBalance: newPendingBalance,
        availableBalance: newAvailableBalance,
        lifetimeEarnings: newLifetimeEarnings,
        cashLifetimeEarnings: newCashLifetimeEarnings,
        electronicLifetimeEarnings: newElectronicLifetimeEarnings,
      });

      walletUpdated = true;
    } catch (walletUpdateError) {
      /**
       * A network error can occur after AppSync has committed
       * the mutation but before this Lambda receives the response.
       *
       * Therefore, do not immediately roll back the Order.
       *
       * First reread the Wallet and determine whether the
       * intended balances were actually committed.
       */

      console.error(
        "Wallet update returned an error. Checking actual Wallet state:",
        walletUpdateError?.message,
      );

      const latestWallet = await getWallet(wallet.id);

      if (!latestWallet || latestWallet._deleted === true) {
        throw new Error(
          `Wallet ${wallet.id} could not be reread after an uncertain update. ` +
            "Order remains claimed. Manual reconciliation is required.",
        );
      }

      const latestBalances = {
        pendingBalance: money(latestWallet.pendingBalance ?? 0),
        availableBalance: money(latestWallet.availableBalance ?? 0),
        lifetimeEarnings: money(latestWallet.lifetimeEarnings ?? 0),
        cashLifetimeEarnings: money(latestWallet.cashLifetimeEarnings ?? 0),
        electronicLifetimeEarnings: money(
          latestWallet.electronicLifetimeEarnings ?? 0,
        ),
      };

      const updateWasCommitted =
        latestBalances.pendingBalance === newPendingBalance &&
        latestBalances.availableBalance === newAvailableBalance &&
        latestBalances.lifetimeEarnings === newLifetimeEarnings &&
        latestBalances.cashLifetimeEarnings === newCashLifetimeEarnings &&
        latestBalances.electronicLifetimeEarnings ===
          newElectronicLifetimeEarnings;

      const walletRemainsUnchanged =
        latestBalances.pendingBalance === pendingBalance &&
        latestBalances.availableBalance === availableBalance &&
        latestBalances.lifetimeEarnings === lifetimeEarnings &&
        latestBalances.cashLifetimeEarnings ===
          money(wallet.cashLifetimeEarnings ?? 0) &&
        latestBalances.electronicLifetimeEarnings ===
          money(wallet.electronicLifetimeEarnings ?? 0);

      if (updateWasCommitted) {
        console.warn(
          "Wallet update appears to have committed despite the request error.",
        );

        walletUpdated = true;
      } else if (walletRemainsUnchanged) {
        throw walletUpdateError;
      } else {
        /**
         * A different wallet state means another operation may
         * have changed it, or the outcome is uncertain.
         *
         * Do not roll back the Order automatically.
         * Doing so could allow the same earnings to be released twice.
         */

        throw new Error(
          `CRITICAL FINANCIAL RECONCILIATION REQUIRED for Order ${orderID}. ` +
            `Wallet ${wallet.id} does not match either its original or ` +
            "expected balances after an uncertain update. " +
            "Order remains claimed. Inspect the Wallet before retrying.",
        );
      }
    }

    // =======================================================================
    // STEP 20: SUCCESS
    // =======================================================================

    console.log(
      "ATUA RELEASE FUNDS SUCCESS:",
      JSON.stringify({
        orderID,
        courierID,
        walletID: wallet.id,
        paymentMethod: "PAYSTACK",
        transportationType,
        amountReleased: earnings,
        previousPendingBalance: pendingBalance,
        newPendingBalance,
        previousAvailableBalance: availableBalance,
        newAvailableBalance,
        lifetimeEarnings: newLifetimeEarnings,
        fundsStatus: "RELEASED",
        releaseTimestamp,
      }),
    );

    return response({
      success: true,
      orderID,
      courierID,
      walletID: wallet.id,
      paymentMethod: "PAYSTACK",
      transportationType,
      amountReleased: earnings,
      totalCourierEarnings: earnings,
      previousPendingBalance: pendingBalance,
      pendingBalance: newPendingBalance,
      previousAvailableBalance: availableBalance,
      availableBalance: newAvailableBalance,
      lifetimeEarnings: newLifetimeEarnings,
      fundsStatus: "RELEASED",
      fundsReleasedAmount: earnings,
      fundsReleasedAt: releaseTimestamp,
      releaseType: "MICRO_MOTO_DELIVERY",
      alreadyProcessed: false,
    });
  } catch (error) {
    console.error("=================================================");
    console.error("ATUA RELEASE FUNDS FAILED");
    console.error("Order ID:", orderID);
    console.error("Error:", error?.message);
    console.error("Stack:", error?.stack);
    console.error("=================================================");

    // =======================================================================
    // STEP 21: SAFE ORDER CLAIM ROLLBACK
    // =======================================================================

    /**
     * Roll back only when:
     *
     * - The Order was claimed.
     * - The Wallet was not updated.
     *
     * If the Wallet update succeeded or its outcome is uncertain,
     * never restore the Order to HELD automatically.
     */

    if (claimedOrder && !walletUpdated) {
      try {
        await rollbackOrderClaim(claimedOrder);

        console.log(`Order ${orderID} claim successfully rolled back to HELD.`);
      } catch (rollbackError) {
        console.error(
          "CRITICAL: ORDER CLAIM ROLLBACK FAILED",
          JSON.stringify({
            orderID,
            originalError: error?.message,
            rollbackError: rollbackError?.message,
          }),
        );

        throw new Error(
          `CRITICAL FINANCIAL RECONCILIATION REQUIRED for Order ${orderID}. ` +
            `Original error: ${error?.message}. ` +
            `Rollback error: ${rollbackError?.message}.`,
        );
      }
    }

    if (claimedOrder && walletUpdated) {
      console.error(
        "CRITICAL: WALLET UPDATED AND ORDER CLAIMED",
        JSON.stringify({
          orderID,
          walletID: wallet?.id,
          expectedWalletBalances,
          message:
            "Do not retry blindly. Verify the Order and Wallet before any manual correction.",
        }),
      );
    }

    throw error;
  }
};

// =============================================================================
// 3. GRAPHQL REQUEST HELPER
// =============================================================================

async function graphqlRequest(query, variables = {}) {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error("Missing API_ATUA_GRAPHQLAPIENDPOINTOUTPUT.");
  }

  if (!API_KEY) {
    throw new Error("Missing API_ATUA_GRAPHQLAPIKEYOUTPUT.");
  }

  const controller = new AbortController();

  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let httpResponse;

  try {
    httpResponse = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        `AppSync request timed out after ${REQUEST_TIMEOUT_MS}ms.`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  let payload;

  try {
    payload = await httpResponse.json();
  } catch {
    throw new Error(
      `AppSync returned invalid JSON. HTTP ${httpResponse.status}.`,
    );
  }

  if (!httpResponse.ok || payload.errors?.length) {
    const messages = (payload.errors || [])
      .map((item) => item.message)
      .join("; ");

    throw new Error(
      `AppSync request failed: ${messages || `HTTP ${httpResponse.status}`}`,
    );
  }

  return payload;
}

// =============================================================================
// 4. GRAPHQL READ HELPERS
// =============================================================================

async function getOrder(id) {
  const result = await graphqlRequest(GET_ORDER_QUERY, { id });

  return result?.data?.getOrder || null;
}

async function getCourier(id) {
  const result = await graphqlRequest(GET_COURIER_QUERY, { id });

  return result?.data?.getCourier || null;
}

async function getWallet(id) {
  const result = await graphqlRequest(GET_WALLET_QUERY, { id });

  return result?.data?.getWallet || null;
}

// =============================================================================
// 5. FIND COURIER WALLET
// =============================================================================

async function findCourierWallet(courier) {
  // Prefer the Wallet explicitly linked to the Courier.
  if (courier.walletID) {
    const wallet = await getWallet(courier.walletID);

    if (wallet && !wallet._deleted) {
      if (
        wallet.ownerID !== courier.id ||
        normalize(wallet.ownerType) !== "COURIER"
      ) {
        throw new Error(
          `Wallet ${wallet.id} ownership mismatch for Courier ${courier.id}.`,
        );
      }

      return wallet;
    }
  }

  /**
   * Fallback search.
   *
   * Pagination is used so that the lookup does not silently
   * ignore matching wallets beyond the first page.
   */

  let nextToken = null;
  const wallets = [];

  do {
    const result = await graphqlRequest(LIST_WALLETS_QUERY, {
      filter: {
        ownerID: { eq: courier.id },
        ownerType: { eq: "COURIER" },
        _deleted: { ne: true },
      },
      limit: 100,
      nextToken,
    });

    const page = result?.data?.listWallets;

    wallets.push(
      ...(page?.items || []).filter((item) => item && !item._deleted),
    );

    nextToken = page?.nextToken || null;

    if (wallets.length > 1) {
      throw new Error(
        `Multiple Wallets found for Courier ${courier.id}. ` +
          "Manual reconciliation is required.",
      );
    }
  } while (nextToken);

  return wallets[0] || null;
}

// =============================================================================
// 6. FIND ORIGINAL EARNINGS TRANSACTION
// =============================================================================

async function getEarningsTransaction(reference) {
  let nextToken = null;
  const transactions = [];

  do {
    const result = await graphqlRequest(LIST_TRANSACTIONS_QUERY, {
      filter: {
        reference: { eq: reference },
        _deleted: { ne: true },
      },
      limit: 100,
      nextToken,
    });

    const page = result?.data?.listTransactions;

    transactions.push(
      ...(page?.items || []).filter((item) => item && !item._deleted),
    );

    nextToken = page?.nextToken || null;

    if (transactions.length > 1) {
      throw new Error(`Multiple active transactions found for ${reference}.`);
    }
  } while (nextToken);

  return transactions[0] || null;
}

// =============================================================================
// 7. VALIDATE EARNINGS TRANSACTION
// =============================================================================

function validateEarningsTransaction({
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

  if (money(transaction.amount) !== money(earnings)) {
    throw new Error(
      `Earnings transaction amount mismatch for Order ${orderID}.`,
    );
  }

  if (normalize(transaction.status) !== "COMPLETED") {
    throw new Error(
      `Earnings transaction is not COMPLETED. ` +
        `Current status: ${transaction.status}.`,
    );
  }
}

// =============================================================================
// 8. CLAIM ORDER FOR RELEASE
// =============================================================================

async function claimOrderRelease({
  order,
  courierID,
  earnings,
  releaseTimestamp,
}) {
  const input = {
    id: order.id,
    fundsStatus: "RELEASED",
    fundsReleasedAmount: money(earnings),
    fundsReleasedAt: releaseTimestamp,
    fundsReleaseType: "MICRO_MOTO_DELIVERY",
  };

  if (order._version != null) {
    input._version = order._version;
  }

  /**
   * These conditions ensure that the Order is still eligible
   * at the time of the claim.
   *
   * The courier and earnings checks prevent the claim from
   * proceeding if the assignment or financial amount changed.
   */

  const condition = {
    status: { eq: "DELIVERED" },
    assignedCourierId: { eq: courierID },
    courierEarnings: { eq: money(earnings) },
    fundsStatus: { eq: "HELD" },
    earningsAllocationStatus: { eq: "ALLOCATED" },
    paymentStatus: { eq: "PAID" },
    paymentMethod: { eq: "PAYSTACK" },
    fundsReleaseBlocked: { ne: true },
  };

  const result = await graphqlRequest(UPDATE_ORDER_MUTATION, {
    input,
    condition,
  });

  return result?.data?.updateOrder || null;
}

// =============================================================================
// 9. ROLLBACK ORDER CLAIM
// =============================================================================

async function rollbackOrderClaim(claimedOrder) {
  const input = {
    id: claimedOrder.id,
    fundsStatus: "HELD",
    fundsReleasedAmount: 0,
    fundsReleasedAt: null,
    fundsReleaseType: null,
  };

  if (claimedOrder._version != null) {
    input._version = claimedOrder._version;
  }

  /**
   * Roll back only the exact claim made by this invocation.
   *
   * This prevents the rollback from overwriting a later release
   * or a separate administrative change.
   */

  const condition = {
    fundsStatus: { eq: "RELEASED" },
    fundsReleasedAmount: {
      eq: money(claimedOrder.fundsReleasedAmount),
    },
    fundsReleasedAt: {
      eq: claimedOrder.fundsReleasedAt,
    },
    fundsReleaseType: {
      eq: "MICRO_MOTO_DELIVERY",
    },
  };

  const result = await graphqlRequest(UPDATE_ORDER_MUTATION, {
    input,
    condition,
  });

  const updatedOrder = result?.data?.updateOrder;

  if (!updatedOrder) {
    throw new Error("AppSync did not confirm the Order claim rollback.");
  }

  return updatedOrder;
}

// =============================================================================
// 10. CONDITIONAL WALLET UPDATE
// =============================================================================

async function updateWallet({
  wallet,
  pendingBalance,
  availableBalance,
  lifetimeEarnings,
  cashLifetimeEarnings,
  electronicLifetimeEarnings,
}) {
  const input = {
    id: wallet.id,
    pendingBalance: money(pendingBalance),
    availableBalance: money(availableBalance),
    lifetimeEarnings: money(lifetimeEarnings),
    cashLifetimeEarnings: money(cashLifetimeEarnings),
    electronicLifetimeEarnings: money(electronicLifetimeEarnings),
  };

  if (wallet._version != null) {
    input._version = wallet._version;
  }

  const condition = {
    ownerID: { eq: wallet.ownerID },
    ownerType: { eq: "COURIER" },
    pendingBalance: {
      eq: money(wallet.pendingBalance ?? 0),
    },
    availableBalance: {
      eq: money(wallet.availableBalance ?? 0),
    },
    lifetimeEarnings: {
      eq: money(wallet.lifetimeEarnings ?? 0),
    },
  };

  // Only add conditions for the new fields when they are not null.
  // The _version check above protects against concurrent updates.
  if (wallet.cashLifetimeEarnings != null) {
    condition.cashLifetimeEarnings = {
      eq: money(wallet.cashLifetimeEarnings),
    };
  }

  if (wallet.electronicLifetimeEarnings != null) {
    condition.electronicLifetimeEarnings = {
      eq: money(wallet.electronicLifetimeEarnings),
    };
  }

  const result = await graphqlRequest(UPDATE_WALLET_MUTATION, {
    input,
    condition,
  });

  const updatedWallet = result?.data?.updateWallet;

  if (!updatedWallet) {
    throw new Error(`Wallet ${wallet.id} update returned no record.`);
  }

  return updatedWallet;
}

// =============================================================================
// 11. UTILITIES
// =============================================================================

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function money(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    throw new Error(`Invalid monetary value: ${value}`);
  }

  return Number(amount.toFixed(2));
}

function response(body) {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

// =============================================================================
// 12. GRAPHQL OPERATIONS
// =============================================================================

const GET_ORDER_QUERY = /* GraphQL */ `
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
      fundsStatus
      earningsAllocationStatus
      fundsReleaseBlocked
      fundsHoldReason
      fundsReleasedAmount
      fundsReleasedAt
      fundsReleaseType
      _version
      _deleted
    }
  }
`;

const GET_COURIER_QUERY = /* GraphQL */ `
  query GetCourier($id: ID!) {
    getCourier(id: $id) {
      id
      walletID
      _version
      _deleted
    }
  }
`;

const GET_WALLET_QUERY = /* GraphQL */ `
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

const LIST_WALLETS_QUERY = /* GraphQL */ `
  query ListWallets(
    $filter: ModelWalletFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listWallets(filter: $filter, limit: $limit, nextToken: $nextToken) {
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
      nextToken
    }
  }
`;

const LIST_TRANSACTIONS_QUERY = /* GraphQL */ `
  query ListTransactions(
    $filter: ModelTransactionFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listTransactions(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        walletID
        type
        amount
        orderID
        reference
        status
        _version
        _deleted
      }
      nextToken
    }
  }
`;

const UPDATE_ORDER_MUTATION = /* GraphQL */ `
  mutation UpdateOrder(
    $input: UpdateOrderInput!
    $condition: ModelOrderConditionInput
  ) {
    updateOrder(input: $input, condition: $condition) {
      id
      status
      assignedCourierId
      paymentStatus
      paymentMethod
      fundsStatus
      earningsAllocationStatus
      fundsReleasedAmount
      fundsReleasedAt
      fundsReleaseType
      _version
      _deleted
    }
  }
`;

const UPDATE_WALLET_MUTATION = /* GraphQL */ `
  mutation UpdateWallet(
    $input: UpdateWalletInput!
    $condition: ModelWalletConditionInput
  ) {
    updateWallet(input: $input, condition: $condition) {
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
