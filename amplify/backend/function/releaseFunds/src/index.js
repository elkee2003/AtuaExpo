/*
===============================================================
ATUA — RELEASE FUNDS LAMBDA
===============================================================

PURPOSE
-------
This Lambda releases courier earnings for MICRO and MOTO orders
that were paid electronically through Paystack.

It does NOT release funds for MAXI orders. MAXI orders use:
releaseCourierMilestoneFunds.

ELECTRONIC PAYMENT FLOW
-----------------------
1. Customer pays electronically through Paystack.
2. Backend verifies payment and marks the Order as PAID.
3. allocateCourierEarnings allocates courier earnings to
   the courier's pendingBalance.
4. The order reaches DELIVERED.
5. This Lambda validates the Order, Courier, Wallet and ledger.
6. The Lambda claims the Order for release.
7. Courier earnings move from pendingBalance to availableBalance.
8. The Order records the release.

CASH PAYMENT FLOW
-----------------
Cash collected by a courier is NOT electronic money held by Atua.

This Lambda therefore does not release cash orders through the
electronic payment flow.

Cash orders must be handled through:
- recordCashCollection
- The cash reconciliation process
- The appropriate cash wallet and ledger rules

IMPORTANT FINANCIAL SAFETY
--------------------------
This Lambda uses an Order condition to reduce duplicate releases
and uses _version when available.

However, separate AppSync mutations are NOT one atomic transaction.

If the Order is claimed but the wallet update fails, this code
attempts to restore the Order to HELD.

If the wallet update succeeds and a later step fails, investigate
the Order and Wallet before attempting another release.

For stronger production guarantees, use a durable, idempotent
release ledger and a recoverable PROCESSING state.

REQUIRED ENVIRONMENT VARIABLES
------------------------------
API_ATUA_GRAPHQLAPIENDPOINTOUTPUT
API_ATUA_GRAPHQLAPIKEYOUTPUT

SCHEMA REQUIREMENTS
-------------------
This code assumes your deployed schema contains the fields,
enum values, queries and mutations used below. Verify these
against your actual Amplify GraphQL schema before deployment.
===============================================================
*/

const fetch = global.fetch || require("node-fetch");

/*
===============================================================
1. CONFIGURATION
===============================================================

Read the AppSync endpoint and API key from Lambda environment
variables. Do not hardcode credentials in this file.
*/

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

/*
===============================================================
2. MAIN LAMBDA HANDLER
===============================================================

AWS Lambda starts execution here.

The handler:
- Extracts the Order ID.
- Loads the Order.
- Validates payment, delivery and allocation.
- Validates the Courier and Wallet.
- Verifies the original earnings transaction.
- Claims the Order for release.
- Updates the Wallet.
- Returns a result or throws an error for investigation.
*/

exports.handler = async (event) => {
  /*
  -------------------------------------------------------------
  2.1 Extract the Order ID
  -------------------------------------------------------------

  Different callers may send the Order ID in different locations.

  Supporting these formats allows the Lambda to be called by
  another Lambda or by a compatible direct invocation.
  */

  const orderID =
    event?.orderID ||
    event?.orderId ||
    event?.arguments?.orderID ||
    event?.arguments?.orderId ||
    event?.input?.orderID ||
    event?.input?.orderId ||
    event?.detail?.orderID ||
    event?.detail?.orderId;

  // An Order ID is mandatory. Do not continue without one.
  if (!orderID) {
    throw new Error("orderID is required.");
  }

  console.log("ATUA RELEASE FUNDS START:", orderID);

  /*
  -------------------------------------------------------------
  2.2 Declare variables used during processing
  -------------------------------------------------------------

  These variables allow the error handler to determine whether
  the Order was claimed and whether the Wallet was updated.
  */

  let order = null;
  let wallet = null;
  let claimedOrder = null;
  let walletAfterUpdate = null;
  let walletUpdated = false;

  try {
    /*
    -----------------------------------------------------------
    STEP 1: LOAD THE ORDER
    -----------------------------------------------------------

    Always read the latest Order record before making financial
    changes. Never rely only on values supplied by the caller.
    */

    order = await getOrder(orderID);

    if (!order || order._deleted === true) {
      throw new Error(`Order ${orderID} was not found or has been deleted.`);
    }

    // Normalize enum/string values for consistent comparisons.
    const paymentMethod = normalize(order.paymentMethod);
    const paymentStatus = normalize(order.paymentStatus);
    const orderStatus = normalize(order.status);
    const fundsStatus = normalize(order.fundsStatus);

    const allocationStatus = normalize(order.earningsAllocationStatus);

    // The courier assigned to this Order.
    const courierID = order.assignedCourierId;

    /*
    -----------------------------------------------------------
    STEP 2: HANDLE CASH ORDERS SAFELY
    -----------------------------------------------------------

    CASH is not the same as PAYSTACK.

    A courier collecting cash from a receiver does not mean
    Atua has received electronic funds that this Lambda can
    release from a platform-held payment.

    Therefore, this Lambda never moves cash-order earnings
    from pendingBalance to availableBalance.

    If cash earnings were already allocated to pendingBalance,
    flag the Order for reconciliation rather than guessing how
    to correct the wallet.
    */

    if (paymentMethod === "CASH") {
      if (allocationStatus === "ALLOCATED") {
        console.error(
          "CASH ORDER REQUIRES FINANCIAL RECONCILIATION:",
          JSON.stringify({
            orderID,
            courierID,
            paymentMethod,
            allocationStatus,
            fundsStatus,
            message:
              "Cash-order earnings have already been allocated. " +
              "Review the wallet and ledger before making adjustments.",
          }),
        );

        /*
        Return a structured result so the caller can identify
        the reconciliation requirement.

        NOTE: The HTTP-style status code is 200. A caller must
        inspect body.success and body.reconciliationRequired;
        it must not interpret HTTP 200 alone as financial success.
        */

        return response({
          success: false,
          skipped: true,
          reconciliationRequired: true,
          orderID,
          courierID: courierID || null,
          paymentMethod: "CASH",
          message:
            "Cash earnings were already allocated. This Lambda " +
            "did not release them. Reconcile the wallet and ledger.",
        });
      }

      // Cash order has not been allocated through this flow.
      console.log(
        `Order ${orderID} uses CASH. ` + "Electronic funds release skipped.",
      );

      return response({
        success: true,
        skipped: true,
        orderID,
        courierID: courierID || null,
        paymentMethod: "CASH",
        message:
          "Cash orders are handled by the cash collection " +
          "and reconciliation process.",
      });
    }

    /*
    -----------------------------------------------------------
    STEP 3: VALIDATE THE PAYMENT METHOD
    -----------------------------------------------------------

    Only PAYSTACK orders are supported by this Lambda.

    Other payment methods must use their own appropriate
    accounting and release logic.
    */

    if (paymentMethod !== "PAYSTACK") {
      throw new Error(
        `Unsupported payment method "${order.paymentMethod}". ` +
          "Only PAYSTACK orders can use releaseFunds.",
      );
    }

    /*
    -----------------------------------------------------------
    STEP 4: VERIFY THAT PAYMENT SUCCEEDED
    -----------------------------------------------------------

    The Order must be marked PAID.

    This check relies on the backend correctly verifying the
    Paystack transaction before setting paymentStatus to PAID.
    This Lambda does not independently contact Paystack.
    */

    if (paymentStatus !== "PAID") {
      throw new Error(
        `Order ${orderID} is not PAID. ` +
          `Current paymentStatus: ${order.paymentStatus}`,
      );
    }

    /*
    -----------------------------------------------------------
    STEP 5: VERIFY THAT EARNINGS WERE ALLOCATED
    -----------------------------------------------------------

    allocateCourierEarnings must have completed the initial
    earnings allocation before this Lambda runs.

    This Lambda does not create the initial allocation.
    It only releases an existing allocation.
    */

    if (allocationStatus !== "ALLOCATED") {
      throw new Error(
        `Courier earnings have not been allocated for Order ` +
          `${orderID}. Current status: ` +
          `${order.earningsAllocationStatus}`,
      );
    }

    /*
    -----------------------------------------------------------
    STEP 6: VERIFY THE ASSIGNED COURIER
    -----------------------------------------------------------

    An Order cannot release earnings without a courier ID.
    */

    if (!courierID) {
      throw new Error(`Order ${orderID} has no assigned courier.`);
    }

    /*
    -----------------------------------------------------------
    STEP 7: VERIFY DELIVERY
    -----------------------------------------------------------

    For Micro/Moto orders, the release occurs after delivery.

    This prevents the funds from being released merely because
    the customer paid or the courier picked up the package.
    */

    if (orderStatus !== "DELIVERED") {
      throw new Error(
        `Order ${orderID} is not DELIVERED. ` +
          `Current status: ${order.status}`,
      );
    }

    /*
    -----------------------------------------------------------
    STEP 8: IDENTIFY THE TRANSPORTATION TYPE
    -----------------------------------------------------------

    MAXI orders use milestone-based releases, so they must
    not pass through this Lambda.

    The checks support common transportationType and vehicleClass
    values. Confirm that these values match your schema.
    */

    const transportationType = normalize(order.transportationType);

    const vehicleClass = normalize(order.vehicleClass);

    const isMaxi = transportationType === "MAXI" || vehicleClass === "MAXI";

    if (isMaxi) {
      throw new Error(
        `Order ${orderID} is a MAXI order. ` +
          "Use releaseCourierMilestoneFunds instead.",
      );
    }

    const isMicro =
      transportationType === "MICRO" ||
      transportationType === "MICRO_EXPRESS" ||
      transportationType === "MICRO_BATCH" ||
      vehicleClass === "MICRO";

    const isMoto =
      transportationType === "MOTO" ||
      transportationType === "MOTO_EXPRESS" ||
      transportationType === "MOTO_BATCH" ||
      vehicleClass === "MOTO";

    if (!isMicro && !isMoto) {
      throw new Error(
        `Unsupported transportation type "${transportationType}" ` +
          `and vehicle class "${vehicleClass}".`,
      );
    }

    /*
    -----------------------------------------------------------
    STEP 9: CHECK FOR AN ADMINISTRATIVE HOLD
    -----------------------------------------------------------

    If an administrator has blocked the release, stop without
    changing the wallet.

    This is useful when an Order is disputed or under review.
    */

    if (order.fundsReleaseBlocked === true) {
      console.log(`Funds release blocked for Order ${orderID}.`);

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

    /*
    -----------------------------------------------------------
    STEP 10: CHECK WHETHER THE ORDER WAS ALREADY RELEASED
    -----------------------------------------------------------

    If the Order is already RELEASED, do not change the wallet
    again.

    This is an important idempotency check for retries.
    */

    if (fundsStatus === "RELEASED") {
      return response({
        success: true,
        alreadyProcessed: true,
        orderID,
        courierID,
        fundsStatus: "RELEASED",
        fundsReleasedAmount: money(order.fundsReleasedAmount || 0),
        message:
          "The Order is already marked as released. " +
          "No additional wallet change was made.",
      });
    }

    /*
    -----------------------------------------------------------
    STEP 11: REQUIRE THE HELD STATE
    -----------------------------------------------------------

    Only an Order with fundsStatus HELD can enter this release
    process.

    Unknown states must not be silently treated as releasable.
    */

    if (fundsStatus !== "HELD") {
      throw new Error(
        `Order ${orderID} has fundsStatus "${order.fundsStatus}". ` +
          "Micro/Moto release requires HELD.",
      );
    }

    // A HELD Order should not already record a released amount.
    if (money(order.fundsReleasedAmount || 0) !== 0) {
      throw new Error(
        `Order ${orderID} is HELD but already records a released ` +
          "amount. Manual reconciliation is required.",
      );
    }

    /*
    -----------------------------------------------------------
    STEP 12: VALIDATE COURIER EARNINGS
    -----------------------------------------------------------

    Use the courierEarnings value already calculated and stored
    by the backend. Do not recalculate the fare here.
    */

    const earnings = money(order.courierEarnings);

    if (earnings <= 0) {
      throw new Error(
        `Invalid courier earnings for Order ${orderID}: ` +
          `${order.courierEarnings}`,
      );
    }

    /*
    -----------------------------------------------------------
    STEP 13: LOAD THE COURIER
    -----------------------------------------------------------

    Confirm that the assigned courier still exists.
    */

    const courier = await getCourier(courierID);

    if (!courier || courier._deleted === true) {
      throw new Error(
        `Courier ${courierID} was not found or has been deleted.`,
      );
    }

    /*
    -----------------------------------------------------------
    STEP 14: FIND THE COURIER'S WALLET
    -----------------------------------------------------------

    If Courier.walletID exists, use it.

    Otherwise, search for a wallet owned by this courier.

    If more than one matching wallet exists, stop rather than
    risk crediting the wrong wallet.
    */

    wallet = await findCourierWallet(courier);

    if (!wallet) {
      throw new Error(`No wallet found for courier ${courierID}.`);
    }

    if (
      wallet.ownerID !== courierID ||
      normalize(wallet.ownerType) !== "COURIER"
    ) {
      throw new Error(
        `Wallet ${wallet.id} does not belong to courier ${courierID}.`,
      );
    }

    /*
    -----------------------------------------------------------
    STEP 15: READ AND VALIDATE THE WALLET BALANCES
    -----------------------------------------------------------

    pendingBalance:
      Earnings that have been allocated but are not yet available.

    availableBalance:
      Earnings available for the courier to withdraw or use.

    lifetimeEarnings:
      The lifetime earnings total maintained by your wallet model.

    IMPORTANT:
    This code assumes all three fields use the same currency unit
    and convention as Order.courierEarnings.
    */

    const pendingBalance = money(wallet.pendingBalance || 0);

    const availableBalance = money(wallet.availableBalance || 0);

    const lifetimeEarnings = money(wallet.lifetimeEarnings || 0);

    if (pendingBalance < 0 || availableBalance < 0 || lifetimeEarnings < 0) {
      throw new Error(`Wallet ${wallet.id} contains a negative balance.`);
    }

    // The wallet must contain the earnings being released.
    if (pendingBalance < earnings) {
      throw new Error(
        `Insufficient pending balance for Order ${orderID}. ` +
          `Pending: ${pendingBalance}; required: ${earnings}.`,
      );
    }

    /*
    -----------------------------------------------------------
    STEP 16: VERIFY THE ORIGINAL EARNINGS TRANSACTION
    -----------------------------------------------------------

    allocateCourierEarnings is expected to create a transaction
    with this reference:

      EARNINGS-{orderID}

    Before releasing the earnings, verify:
    - The transaction exists.
    - It belongs to the correct wallet and Order.
    - It is a CREDIT.
    - Its amount matches courierEarnings.
    - Its status is COMPLETED.

    These checks help prevent releasing earnings that do not
    match the ledger.
    */

    const transactionReference = `EARNINGS-${orderID}`;

    const transaction = await getEarningsTransaction(transactionReference);

    validateEarningsTransaction({
      transaction,
      walletID: wallet.id,
      orderID,
      earnings,
    });

    /*
    -----------------------------------------------------------
    STEP 17: CALCULATE THE NEW WALLET BALANCES
    -----------------------------------------------------------

    Example:
      Pending balance before:   ₦5,000
      Earnings to release:      ₦2,000
      Available balance before: ₦1,000

    After release:
      Pending balance:          ₦3,000
      Available balance:        ₦3,000

    The earnings are moved between balances, not added twice.

    lifetimeEarnings is increased here according to this
    implementation's accounting convention. Confirm that your
    other financial Lambdas use the same convention.
    */

    const newPendingBalance = money(pendingBalance - earnings);

    const newAvailableBalance = money(availableBalance + earnings);

    const newLifetimeEarnings = money(lifetimeEarnings + earnings);

    /*
    -----------------------------------------------------------
    STEP 18: CLAIM THE ORDER BEFORE UPDATING THE WALLET
    -----------------------------------------------------------

    The Order update uses a condition requiring it to still be:
    - DELIVERED
    - HELD
    - ALLOCATED
    - PAID
    - PAYSTACK

    If another invocation has already changed the Order, the
    condition should reject this claim.

    This reduces the risk of two concurrent invocations
    releasing the same Order.

    IMPORTANT:
    This is not a multi-record database transaction. The Order
    claim and Wallet update can still become inconsistent if the
    Lambda crashes between operations.
    */

    const releaseTimestamp = new Date().toISOString();

    claimedOrder = await claimOrderRelease({
      order,
      earnings,
      releaseTimestamp,
    });

    if (!claimedOrder) {
      // Re-read the Order to determine whether another invocation
      // already claimed or released it.
      const latestOrder = await getOrder(orderID);

      if (normalize(latestOrder?.fundsStatus) === "RELEASED") {
        return response({
          success: true,
          alreadyProcessed: true,
          orderID,
          message:
            "The Order was already claimed or released. " +
            "Verify the Wallet and Order ledger before retrying.",
        });
      }

      throw new Error(
        `Could not claim Order ${orderID} for release. ` +
          "Refresh the records and investigate before retrying.",
      );
    }

    /*
    -----------------------------------------------------------
    STEP 19: UPDATE THE WALLET
    -----------------------------------------------------------

    Once the Order has been claimed, move the earnings from
    pendingBalance to availableBalance.

    The mutation includes _version when returned by AppSync.

    For this to protect concurrent wallet writes, your AppSync
    configuration must enforce optimistic concurrency.
    */

    const updatedWallet = await updateWallet({
      wallet,
      pendingBalance: newPendingBalance,
      availableBalance: newAvailableBalance,
      lifetimeEarnings: newLifetimeEarnings,
    });

    walletAfterUpdate = updatedWallet;
    walletUpdated = true;

    /*
    -----------------------------------------------------------
    STEP 20: LOG THE SUCCESSFUL RELEASE
    -----------------------------------------------------------

    The Order was claimed and the Wallet update was confirmed.
    Record the key details in CloudWatch for troubleshooting.
    */

    console.log(
      "ATUA RELEASE FUNDS SUCCESS:",
      JSON.stringify({
        orderID,
        courierID,
        walletID: wallet.id,
        paymentMethod: "PAYSTACK",
        amountReleased: earnings,
        previousPendingBalance: pendingBalance,
        newPendingBalance,
        previousAvailableBalance: availableBalance,
        newAvailableBalance,
        newLifetimeEarnings,
        fundsStatus: "RELEASED",
        releaseTimestamp,
      }),
    );

    /*
    -----------------------------------------------------------
    STEP 21: RETURN THE RESULT
    -----------------------------------------------------------

    The calling Lambda can inspect the response body to determine
    whether the release succeeded.

    Do not rely on statusCode alone. Inspect success and the
    returned message as well.
    */

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
    /*
    -----------------------------------------------------------
    STEP 22: LOG THE FAILURE
    -----------------------------------------------------------

    Log the Order ID, error message and stack trace.

    Throwing the error allows the caller or retry mechanism to
    detect that processing failed.
    */

    console.error(
      "ATUA RELEASE FUNDS FAILED:",
      JSON.stringify({
        orderID,
        error: error?.message,
        stack: error?.stack,
      }),
    );

    /*
    -----------------------------------------------------------
    STEP 23: ATTEMPT TO ROLL BACK AN UNCOMPLETED CLAIM
    -----------------------------------------------------------

    If the Order was claimed but the Wallet update did not
    succeed, attempt to restore the Order to HELD.

    If this rollback fails, raise a critical reconciliation
    error rather than pretending the operation was recovered.
    */

    if (claimedOrder && !walletUpdated) {
      try {
        await rollbackOrderClaim(claimedOrder);

        console.log(`Order ${orderID} claim was rolled back to HELD.`);
      } catch (rollbackError) {
        console.error(
          "CRITICAL: ORDER CLAIM ROLLBACK FAILED:",
          JSON.stringify({
            orderID,
            originalError: error?.message,
            rollbackError: rollbackError?.message,
          }),
        );

        throw new Error(
          `CRITICAL FINANCIAL RECONCILIATION REQUIRED for ` +
            `Order ${orderID}. Original error: ${error.message}. ` +
            `Rollback error: ${rollbackError.message}`,
        );
      }
    }

    /*
    -----------------------------------------------------------
    STEP 24: HANDLE A FAILURE AFTER THE WALLET UPDATE
    -----------------------------------------------------------

    If the Wallet was updated, do not blindly restore old balances.

    Another legitimate wallet operation may have occurred, and
    restoring an old snapshot could overwrite that transaction.

    The Order was claimed before the Wallet update. If an error
    occurs after the Wallet update, inspect both records and
    reconcile them before any retry.

    A production implementation should use a durable release
    ledger/state machine to recover this case automatically.
    */

    if (claimedOrder && walletUpdated) {
      console.error(
        "CRITICAL: WALLET UPDATED; VERIFY RELEASE RECORDS:",
        JSON.stringify({
          orderID,
          walletID: wallet?.id,
          walletVersion: walletAfterUpdate?._version,
          message:
            "Inspect the Order, Wallet and earnings transaction " +
            "before attempting another release.",
        }),
      );
    }

    // Propagate the error so the caller knows the invocation failed.
    throw error;
  }
};

/*
===============================================================
3. GRAPHQL REQUEST HELPER
===============================================================

All GraphQL operations pass through this function.

It:
- Checks that the endpoint and API key exist.
- Sends the GraphQL request to AppSync.
- Parses the response.
- Throws if AppSync reports a GraphQL or HTTP error.

This helps prevent failed GraphQL requests from being treated
as successful financial operations.
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

  let payload;

  try {
    payload = await response.json();
  } catch {
    throw new Error(`AppSync returned invalid JSON. HTTP ${response.status}.`);
  }

  // AppSync can return HTTP 200 while reporting GraphQL errors.
  if (!response.ok || payload.errors?.length) {
    const messages = (payload.errors || [])
      .map((item) => item.message)
      .join("; ");

    throw new Error(
      `AppSync request failed: ${messages || `HTTP ${response.status}`}`,
    );
  }

  return payload;
}

/*
===============================================================
4. GRAPHQL READ HELPERS
===============================================================

These functions retrieve the Order, Courier, Wallet and
Earnings transaction.
*/

// Fetch the latest Order by ID.
async function getOrder(id) {
  const response = await graphqlRequest(GET_ORDER_QUERY, { id });

  return response?.data?.getOrder || null;
}

// Fetch the Courier assigned to the Order.
async function getCourier(id) {
  const response = await graphqlRequest(GET_COURIER_QUERY, { id });

  return response?.data?.getCourier || null;
}

// Fetch a Wallet by its ID.
async function getWallet(id) {
  const response = await graphqlRequest(GET_WALLET_QUERY, { id });

  return response?.data?.getWallet || null;
}

/*
Find the courier's Wallet.

First, try Courier.walletID.

If no usable Wallet is found through walletID, search for a
Wallet whose ownerID and ownerType identify this Courier.

If multiple Wallets are found, stop because the correct Wallet
cannot be selected safely.
*/

async function findCourierWallet(courier) {
  if (courier.walletID) {
    const wallet = await getWallet(courier.walletID);

    if (wallet && !wallet._deleted) {
      // Never trust the wallet reference without checking ownership.
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

  // Fall back to a Wallet lookup by owner.
  const response = await graphqlRequest(LIST_WALLETS_QUERY, {
    filter: {
      ownerID: { eq: courier.id },
      ownerType: { eq: "COURIER" },
      _deleted: { ne: true },
    },
    limit: 100,
  });

  const wallets = (response?.data?.listWallets?.items || []).filter(
    (item) => item && !item._deleted,
  );

  if (wallets.length === 0) {
    return null;
  }

  if (wallets.length > 1) {
    throw new Error(
      `Multiple Wallets found for Courier ${courier.id}. ` +
        "Manual reconciliation is required.",
    );
  }

  return wallets[0];
}

/*
Find the original allocation transaction.

The expected reference is:
EARNINGS-{orderID}

Exactly one active transaction should match.
*/

async function getEarningsTransaction(reference) {
  const response = await graphqlRequest(LIST_TRANSACTIONS_QUERY, {
    filter: {
      reference: { eq: reference },
      _deleted: { ne: true },
    },
    limit: 100,
  });

  const transactions = (response?.data?.listTransactions?.items || []).filter(
    (item) => item && !item._deleted,
  );

  if (transactions.length > 1) {
    throw new Error(`Multiple active transactions found for ${reference}.`);
  }

  return transactions[0] || null;
}

/*
===============================================================
5. EARNINGS TRANSACTION VALIDATION
===============================================================

Validate that the original allocation transaction matches the
Order, Wallet and earnings amount.

This prevents releasing earnings based on a missing or
mismatched ledger entry.
*/

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
    throw new Error(
      `Earnings transaction for Order ${orderID} is not a CREDIT.`,
    );
  }

  if (money(transaction.amount) !== money(earnings)) {
    throw new Error(
      `Earnings transaction amount mismatch for Order ${orderID}.`,
    );
  }

  if (normalize(transaction.status) !== "COMPLETED") {
    throw new Error(
      `Earnings transaction is not COMPLETED. ` +
        `Current status: ${transaction.status}`,
    );
  }
}

/*
===============================================================
6. ORDER CLAIM MUTATION
===============================================================

This mutation marks the Order RELEASED before changing the
Wallet.

The condition is intended to ensure that only an Order still
in the required state can be claimed.

IMPORTANT:
A successful Order claim does not mean the Wallet has already
been updated. If the Wallet update fails, the rollback helper
attempts to restore the Order to HELD.

This approach reduces duplicate processing but is not a fully
atomic multi-record financial transaction.
*/

async function claimOrderRelease({ order, earnings, releaseTimestamp }) {
  const input = {
    id: order.id,
    fundsStatus: "RELEASED",
    fundsReleasedAmount: money(earnings),
    fundsReleasedAt: releaseTimestamp,
    fundsReleaseType: "MICRO_MOTO_DELIVERY",
  };

  /*
  Include the AppSync version if the record provides one.

  Optimistic concurrency must be configured correctly in AppSync
  for this version field to protect against concurrent updates.
  */

  if (order._version != null) {
    input._version = order._version;
  }

  /*
  The condition checks that the Order remains in the expected
  state at mutation time.
  */

  const condition = {
    status: { eq: "DELIVERED" },
    fundsStatus: { eq: "HELD" },
    earningsAllocationStatus: { eq: "ALLOCATED" },
    paymentStatus: { eq: "PAID" },
    paymentMethod: { eq: "PAYSTACK" },
  };

  const response = await graphqlRequest(UPDATE_ORDER_MUTATION, {
    input,
    condition,
  });

  return response?.data?.updateOrder || null;
}

/*
===============================================================
7. ORDER CLAIM ROLLBACK
===============================================================

If the Order was claimed but the Wallet update failed, attempt
to restore the Order to HELD.

The version from the claimed record is included where available.

If this rollback fails, the Lambda reports a critical error.
An administrator should inspect the Order and Wallet before
retrying the release.
*/

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

  const condition = {
    fundsStatus: { eq: "RELEASED" },
  };

  const response = await graphqlRequest(UPDATE_ORDER_MUTATION, {
    input,
    condition,
  });

  if (!response?.data?.updateOrder) {
    throw new Error("AppSync did not confirm the Order claim rollback.");
  }

  return response.data.updateOrder;
}

/*
===============================================================
8. WALLET UPDATE MUTATION
===============================================================

Update the Wallet's balances after the Order has been claimed.

The values are supplied by the handler:
- pendingBalance decreases by courier earnings.
- availableBalance increases by courier earnings.
- lifetimeEarnings increases according to this implementation.

Including _version helps only when AppSync concurrency
protection is correctly configured.
*/

async function updateWallet({
  wallet,
  availableBalance,
  pendingBalance,
  lifetimeEarnings,
}) {
  const input = {
    id: wallet.id,
    availableBalance: money(availableBalance),
    pendingBalance: money(pendingBalance),
    lifetimeEarnings: money(lifetimeEarnings),
  };

  if (wallet._version != null) {
    input._version = wallet._version;
  }

  const response = await graphqlRequest(UPDATE_WALLET_MUTATION, { input });

  const updatedWallet = response?.data?.updateWallet;

  if (!updatedWallet) {
    throw new Error(`Wallet ${wallet.id} update returned no record.`);
  }

  return updatedWallet;
}

/*
===============================================================
9. SMALL UTILITY FUNCTIONS
===============================================================
*/

// Convert enum/string values into a consistent uppercase format.
function normalize(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

// Validate and round monetary values to two decimal places.
function money(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    throw new Error(`Invalid monetary value: ${value}`);
  }

  return Number(amount.toFixed(2));
}

/*
Return a structured result.

This format is useful when the Lambda is invoked directly.
Callers must inspect the JSON body rather than relying only
on statusCode.
*/

function response(body) {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

/*
===============================================================
10. GRAPHQL OPERATIONS
===============================================================

These operations must match your deployed Amplify schema.

If your schema uses different field names, enum values, model
names or generated input types, update the operations to match.
*/

// Retrieve the Order and all fields needed for release validation.
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

// Retrieve the assigned Courier and its Wallet reference.
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

// Retrieve one Wallet by ID.
const GET_WALLET_QUERY = /* GraphQL */ `
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

// Search for Wallets belonging to a Courier.
const LIST_WALLETS_QUERY = /* GraphQL */ `
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

// Search for the original earnings allocation transaction.
const LIST_TRANSACTIONS_QUERY = /* GraphQL */ `
  query ListTransactions($filter: ModelTransactionFilterInput, $limit: Int) {
    listTransactions(filter: $filter, limit: $limit) {
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
    }
  }
`;

// Update the courier's Wallet balances.
const UPDATE_WALLET_MUTATION = /* GraphQL */ `
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

// Claim or restore the Order's release state.
const UPDATE_ORDER_MUTATION = /* GraphQL */ `
  mutation UpdateOrder(
    $input: UpdateOrderInput!
    $condition: ModelOrderConditionInput
  ) {
    updateOrder(input: $input, condition: $condition) {
      id
      status
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
