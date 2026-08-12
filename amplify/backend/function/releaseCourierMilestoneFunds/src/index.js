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

This function:

    - Only processes MAXI orders
    - Does not process customer payments
    - Does not allocate courier earnings
    - Does not generate delivery codes
    - Does not send bank transfers
    - Does not process Paystack payouts
    - Does not change lifetimeEarnings
    - Respects admin funds holds

This function only moves money:

    pendingBalance
          ↓
    availableBalance
*/

const GRAPHQL_ENDPOINT =
  process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const API_KEY =
  process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;


/* ==========================================================
   MAIN HANDLER
========================================================== */

exports.handler = async (event) => {

  console.log(
    "=========================================="
  );

  console.log(
    "ATUA RELEASE COURIER MILESTONE FUNDS"
  );

  console.log(
    "EVENT:",
    JSON.stringify(event)
  );

  console.log(
    "=========================================="
  );

  let orderID = null;

  try {

    /* ======================================================
       1. GET ORDER ID
    ====================================================== */

    orderID =
      event?.orderID ||
      event?.arguments?.orderID ||
      event?.detail?.orderID;

    if (!orderID) {
      throw new Error(
        "orderID is required."
      );
    }


    /* ======================================================
       2. GET OPTIONAL MILESTONE
    ====================================================== */

    let requestedMilestone =
      event?.milestone ||
      event?.arguments?.milestone ||
      event?.detail?.milestone ||
      null;

    if (
      requestedMilestone
    ) {

      requestedMilestone =
        String(
          requestedMilestone
        ).toUpperCase();

    }


    console.log(
      "ORDER ID:",
      orderID
    );

    console.log(
      "REQUESTED MILESTONE:",
      requestedMilestone
    );


    /* ======================================================
       3. GET ORDER
    ====================================================== */

    const getOrderQuery = `
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

        }

      }
    `;


    const orderResponse =
      await graphqlRequest(
        getOrderQuery,
        {
          id: orderID,
        }
      );


    if (
      orderResponse.errors
    ) {

      throw new Error(
        `Failed to fetch order: ${JSON.stringify(
          orderResponse.errors
        )}`
      );

    }


    const order =
      orderResponse?.data?.getOrder;


    if (!order) {

      throw new Error(
        `Order not found: ${orderID}`
      );

    }


    console.log(
      "ORDER:",
      JSON.stringify(order)
    );


    /* ======================================================
       4. VERIFY PAYMENT
    ====================================================== */

    if (
      order.paymentStatus !==
      "PAID"
    ) {

      throw new Error(
        `Order ${orderID} is not PAID. Current paymentStatus: ${order.paymentStatus}`
      );

    }


    /* ======================================================
       5. VERIFY EARNINGS WERE ALLOCATED
    ====================================================== */

    if (
      order.earningsAllocationStatus !==
      "ALLOCATED"
    ) {

      throw new Error(
        `Courier earnings have not been allocated for order ${orderID}. Current status: ${order.earningsAllocationStatus}`
      );

    }


    /* ======================================================
       6. VERIFY COURIER
    ====================================================== */

    const courierID =
      order.assignedCourierId;


    if (!courierID) {

      throw new Error(
        `Order ${orderID} has no assigned courier.`
      );

    }


    /* ======================================================
       7. VERIFY COURIER EARNINGS
    ====================================================== */

    const earnings =
      Number(
        order.courierEarnings || 0
      );


    if (
      !Number.isFinite(
        earnings
      ) ||
      earnings <= 0
    ) {

      throw new Error(
        `Invalid courier earnings for order ${orderID}: ${order.courierEarnings}`
      );

    }


    /* ======================================================
       8. VERIFY MAXI ORDER
    ====================================================== */

    const transportationType =
      String(
        order.transportationType ||
        ""
      ).toUpperCase();

    const vehicleClass =
      String(
        order.vehicleClass ||
        ""
      ).toUpperCase();


    const isMaxi =
      transportationType ===
        "MAXI" ||
      vehicleClass ===
        "MAXI";


    if (!isMaxi) {

      throw new Error(
        `Order ${orderID} is not a MAXI order. transportationType=${order.transportationType}, vehicleClass=${order.vehicleClass}`
      );

    }


    /* ======================================================
       9. DETERMINE MILESTONE
    ======================================================

    We support:

        PICKED_UP
        DELIVERED

    If the caller did not explicitly supply a milestone,
    use the current Order.status.

    ====================================================== */

    const milestone =
      requestedMilestone ||
      String(
        order.status || ""
      ).toUpperCase();


    if (
      milestone !==
        "PICKED_UP" &&
      milestone !==
        "DELIVERED"
    ) {

      throw new Error(
        `Unsupported Maxi milestone: ${milestone}. Expected PICKED_UP or DELIVERED.`
      );

    }


    console.log(
      "MAXI MILESTONE:",
      milestone
    );


    /* ======================================================
       10. ADMIN HOLD
    ====================================================== */

    if (
      order.fundsReleaseBlocked ===
      true
    ) {

      console.log(
        `Funds release blocked by admin for order ${orderID}`
      );


      return successResponse({

        message:
          "Funds release is blocked by admin.",

        orderID,

        courierID,

        milestone,

        fundsStatus:
          order.fundsStatus,

        fundsReleasedAmount:
          Number(
            order.fundsReleasedAmount || 0
          ),

        holdReason:
          order.fundsHoldReason ||
          null,

        heldBy:
          order.fundsHeldBy ||
          null,

        heldAt:
          order.fundsHeldAt ||
          null,

        releaseBlocked:
          true,

      });

    }


    /* ======================================================
       11. READ CURRENT RELEASED AMOUNT
    ====================================================== */

    const currentReleasedAmount =
      Number(
        order.fundsReleasedAmount || 0
      );


    if (
      !Number.isFinite(
        currentReleasedAmount
      ) ||
      currentReleasedAmount < 0
    ) {

      throw new Error(
        `Invalid fundsReleasedAmount for order ${orderID}: ${order.fundsReleasedAmount}`
      );

    }


    if (
      currentReleasedAmount >
      earnings + 0.01
    ) {

      throw new Error(
        `Order ${orderID} has released more funds than its courier earnings.`
      );

    }


    /* ======================================================
       12. PICKED UP — FIRST 50%
    ====================================================== */

    if (
      milestone ===
      "PICKED_UP"
    ) {

      /*
       * If already partially released or fully released,
       * this milestone has already been processed.
       */

      if (
        order.fundsStatus ===
          "PARTIALLY_RELEASED" ||
        order.fundsStatus ===
          "RELEASED"
      ) {

        console.log(
          `Pickup milestone already processed for order ${orderID}`
        );


        return successResponse({

          message:
            "Pickup milestone has already been processed.",

          orderID,

          courierID,

          milestone,

          fundsStatus:
            order.fundsStatus,

          fundsReleasedAmount:
            currentReleasedAmount,

          alreadyProcessed:
            true,

        });

      }


      /*
       * The first milestone must begin from HELD.
       */

      if (
        order.fundsStatus !==
        "HELD"
      ) {

        throw new Error(
          `Order ${orderID} has unexpected fundsStatus ${order.fundsStatus}. Pickup release requires HELD.`
        );

      }


      /*
       * 50% of the courier earnings.
       */

      const firstReleaseAmount =
        Number(
          (
            earnings / 2
          ).toFixed(2)
        );


      if (
        firstReleaseAmount <= 0
      ) {

        throw new Error(
          "Calculated Maxi pickup release amount is invalid."
        );

      }


      /*
       * We expect no previous release.
       */

      if (
        Math.abs(
          currentReleasedAmount
        ) > 0.01
      ) {

        throw new Error(
          `Order ${orderID} has fundsReleasedAmount ${currentReleasedAmount} but is still HELD.`
        );

      }


      /* ====================================================
         GET WALLET
      ==================================================== */

      const wallet =
        await getCourierWallet(
          courierID
        );


      if (!wallet) {

        throw new Error(
          `Wallet not found for courier ${courierID}`
        );

      }


      /* ====================================================
         VERIFY WALLET OWNER
      ==================================================== */

      if (
        wallet.ownerID !==
        courierID
      ) {

        throw new Error(
          `Wallet ${wallet.id} does not belong to courier ${courierID}`
        );

      }


      if (
        wallet.ownerType !==
        "COURIER"
      ) {

        throw new Error(
          `Wallet ${wallet.id} is not a courier wallet.`
        );

      }


      /* ====================================================
         READ BALANCES
      ==================================================== */

      const pendingBalance =
        Number(
          wallet.pendingBalance || 0
        );

      const availableBalance =
        Number(
          wallet.availableBalance || 0
        );

      const lifetimeEarnings =
        Number(
          wallet.lifetimeEarnings || 0
        );


      /* ====================================================
         VERIFY PENDING BALANCE
      ==================================================== */

      if (
        pendingBalance <
        firstReleaseAmount
      ) {

        throw new Error(
          `Insufficient pending balance. Pending=${pendingBalance}, required=${firstReleaseAmount}`
        );

      }


      /* ====================================================
         CALCULATE NEW BALANCES
      ==================================================== */

      const newPendingBalance =
        Number(
          (
            pendingBalance -
            firstReleaseAmount
          ).toFixed(2)
        );


      const newAvailableBalance =
        Number(
          (
            availableBalance +
            firstReleaseAmount
          ).toFixed(2)
        );


      /* ====================================================
         UPDATE WALLET
      ==================================================== */

      const walletUpdate =
        await updateWallet({

          wallet,

          availableBalance:
            newAvailableBalance,

          pendingBalance:
            newPendingBalance,

        });


      if (!walletUpdate) {

        throw new Error(
          "Could not update courier wallet during Maxi pickup release."
        );

      }


      /*
       * lifetimeEarnings intentionally remains unchanged.
       */


      /* ====================================================
         UPDATE ORDER
      ==================================================== */

      const timestamp =
        new Date().toISOString();


      const orderUpdate =
        await updateOrder({

          order,

          fundsStatus:
            "PARTIALLY_RELEASED",

          fundsReleasedAmount:
            firstReleaseAmount,

          pickupFundsReleasedAt:
            timestamp,

          fundsReleaseType:
            "MAXI_PICKUP",

        });


      if (!orderUpdate) {

        throw new Error(
          "Wallet was updated but order could not be updated for Maxi pickup release. Reconciliation is required."
        );

      }


      /* ====================================================
         SUCCESS
      ==================================================== */

      return successResponse({

        message:
          "50% of Maxi courier earnings released at pickup.",

        orderID,

        courierID,

        milestone:
          "PICKED_UP",

        amountReleased:
          firstReleaseAmount,

        totalCourierEarnings:
          earnings,

        fundsReleasedAmount:
          firstReleaseAmount,

        remainingPendingBalance:
          newPendingBalance,

        availableBalance:
          newAvailableBalance,

        lifetimeEarnings:
          lifetimeEarnings,

        fundsStatus:
          "PARTIALLY_RELEASED",

        pickupFundsReleasedAt:
          timestamp,

        releaseType:
          "MAXI_PICKUP",

      });

    }


    /* ======================================================
       13. DELIVERED — REMAINING 50%
    ====================================================== */

    if (
      milestone ===
      "DELIVERED"
    ) {

      /*
       * Delivery should release only what remains.
       *
       * This makes the calculation safe even when the
       * courier earnings are an odd amount.
       *
       * Example:
       *
       * earnings = ₦20,001
       * first release = ₦10,000.50
       * remaining = ₦10,000.50
       */

      const remainingAmount =
        Number(
          (
            earnings -
            currentReleasedAmount
          ).toFixed(2)
        );


      /* ====================================================
         ALREADY FULLY RELEASED
      ==================================================== */

      if (
        order.fundsStatus ===
          "RELEASED" ||
        remainingAmount <= 0.01
      ) {

        console.log(
          `Final Maxi release already completed for order ${orderID}`
        );


        return successResponse({

          message:
            "Maxi courier earnings are already fully released.",

          orderID,

          courierID,

          milestone:
            "DELIVERED",

          fundsStatus:
            "RELEASED",

          fundsReleasedAmount:
            earnings,

          alreadyProcessed:
            true,

        });

      }


      /* ====================================================
         DELIVERY VALID STATES
      ==================================================== */

      if (
        order.fundsStatus !==
          "PARTIALLY_RELEASED" &&
        order.fundsStatus !==
          "HELD"
      ) {

        throw new Error(
          `Order ${orderID} has unexpected fundsStatus ${order.fundsStatus} for delivery release.`
        );

      }


      /*
       * Normally this should be PARTIALLY_RELEASED.
       *
       * If it is HELD with released amount 0, we do NOT
       * silently release 100% here. We release only the
       * remaining amount, which happens to be 50%.
       *
       * This makes the function resilient if the pickup event
       * was missed, but the financial state still needs review.
       */

      if (
        order.fundsStatus ===
        "HELD"
      ) {

        console.warn(
          `Order ${orderID} reached DELIVERED while fundsStatus is HELD. Releasing remaining amount only.`
        );

      }


      /* ====================================================
         GET WALLET
      ==================================================== */

      const wallet =
        await getCourierWallet(
          courierID
        );


      if (!wallet) {

        throw new Error(
          `Wallet not found for courier ${courierID}`
        );

      }


      /* ====================================================
         VERIFY WALLET OWNER
      ==================================================== */

      if (
        wallet.ownerID !==
        courierID
      ) {

        throw new Error(
          `Wallet ${wallet.id} does not belong to courier ${courierID}`
        );

      }


      if (
        wallet.ownerType !==
        "COURIER"
      ) {

        throw new Error(
          `Wallet ${wallet.id} is not a courier wallet.`
        );

      }


      /* ====================================================
         READ BALANCES
      ==================================================== */

      const pendingBalance =
        Number(
          wallet.pendingBalance || 0
        );

      const availableBalance =
        Number(
          wallet.availableBalance || 0
        );

      const lifetimeEarnings =
        Number(
          wallet.lifetimeEarnings || 0
        );


      /* ====================================================
         VERIFY PENDING BALANCE
      ==================================================== */

      if (
        pendingBalance <
        remainingAmount
      ) {

        throw new Error(
          `Insufficient pending balance for final Maxi release. Pending=${pendingBalance}, required=${remainingAmount}`
        );

      }


      /* ====================================================
         CALCULATE NEW BALANCES
      ==================================================== */

      const newPendingBalance =
        Number(
          (
            pendingBalance -
            remainingAmount
          ).toFixed(2)
        );


      const newAvailableBalance =
        Number(
          (
            availableBalance +
            remainingAmount
          ).toFixed(2)
        );


      /* ====================================================
         UPDATE WALLET
      ==================================================== */

      const walletUpdate =
        await updateWallet({

          wallet,

          availableBalance:
            newAvailableBalance,

          pendingBalance:
            newPendingBalance,

        });


      if (!walletUpdate) {

        throw new Error(
          "Could not update courier wallet during final Maxi release."
        );

      }


      /*
       * lifetimeEarnings intentionally remains unchanged.
       */


      /* ====================================================
         UPDATE ORDER
      ==================================================== */

      const timestamp =
        new Date().toISOString();


      const orderUpdate =
        await updateOrder({

          order,

          fundsStatus:
            "RELEASED",

          fundsReleasedAmount:
            earnings,

          fundsReleasedAt:
            timestamp,

          fundsReleaseType:
            "MAXI_DELIVERY",

        });


      if (!orderUpdate) {

        throw new Error(
          "Wallet was updated but order could not be finalized. Reconciliation is required."
        );

      }


      /* ====================================================
         SUCCESS
      ==================================================== */

      return successResponse({

        message:
          "Remaining Maxi courier earnings released after delivery.",

        orderID,

        courierID,

        milestone:
          "DELIVERED",

        amountReleased:
          remainingAmount,

        totalCourierEarnings:
          earnings,

        fundsReleasedAmount:
          earnings,

        remainingPendingBalance:
          newPendingBalance,

        availableBalance:
          newAvailableBalance,

        lifetimeEarnings:
          lifetimeEarnings,

        fundsStatus:
          "RELEASED",

        fundsReleasedAt:
          timestamp,

        releaseType:
          "MAXI_DELIVERY",

      });

    }


    throw new Error(
      `Unsupported milestone: ${milestone}`
    );


  } catch (error) {

    console.error(
      "=========================================="
    );

    console.error(
      "ATUA MAXI MILESTONE RELEASE ERROR"
    );

    console.error(
      "MESSAGE:",
      error?.message
    );

    console.error(
      "STACK:",
      error?.stack
    );

    console.error(
      "=========================================="
    );


    return {

      statusCode:
        500,

      body:
        JSON.stringify({

          success:
            false,

          message:
            error?.message ||
            "Maxi milestone release failed.",

          orderID,

        }),

    };

  }
};


/* ==========================================================
   GET COURIER WALLET
========================================================== */

async function getCourierWallet(
  courierID
) {

  const query = `
    query ListWallets(
      $filter: ModelWalletFilterInput
    ) {

      listWallets(
        filter: $filter
        limit: 1
      ) {

        items {

          id

          ownerID
          ownerType

          availableBalance
          pendingBalance
          lifetimeEarnings

        }

      }

    }
  `;


  const response =
    await graphqlRequest(
      query,
      {

        filter: {

          ownerID: {
            eq:
              courierID,
          },

          ownerType: {
            eq:
              "COURIER",
          },

        },

      }
    );


  if (
    response.errors
  ) {

    throw new Error(
      `Failed to fetch courier wallet: ${JSON.stringify(
        response.errors
      )}`
    );

  }


  return (
    response?.data?.listWallets?.items?.[0] ||
    null
  );
}


/* ==========================================================
   UPDATE WALLET
========================================================== */

async function updateWallet({
  wallet,
  availableBalance,
  pendingBalance,
}) {

  const mutation = `
    mutation UpdateWallet(
      $input: UpdateWalletInput!
    ) {

      updateWallet(
        input: $input
      ) {

        id

        availableBalance
        pendingBalance
        lifetimeEarnings

      }

    }
  `;


  const response =
    await graphqlRequest(
      mutation,
      {

        input: {

          id:
            wallet.id,

          availableBalance:
            Number(
              availableBalance.toFixed(2)
            ),

          pendingBalance:
            Number(
              pendingBalance.toFixed(2)
            ),

          /*
           * lifetimeEarnings is intentionally not included.
           */

        },

      }
    );


  if (
    response.errors
  ) {

    throw new Error(
      `Failed to update courier wallet: ${JSON.stringify(
        response.errors
      )}`
    );

  }


  return (
    response?.data?.updateWallet ||
    null
  );
}


/* ==========================================================
   UPDATE ORDER
========================================================== */

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
    ) {

      updateOrder(
        input: $input
      ) {

        id

        fundsStatus

        fundsReleasedAmount

        pickupFundsReleasedAt

        fundsReleasedAt

        fundsReleaseType

        fundsReleaseBlocked

      }

    }
  `;


  const input = {

    id:
      order.id,

    fundsStatus,

    fundsReleasedAmount,

    fundsReleaseType,

  };


  if (
    pickupFundsReleasedAt
  ) {

    input.pickupFundsReleasedAt =
      pickupFundsReleasedAt;

  }


  if (
    fundsReleasedAt
  ) {

    input.fundsReleasedAt =
      fundsReleasedAt;

  }


  const response =
    await graphqlRequest(
      mutation,
      {
        input,
      }
    );


  if (
    response.errors
  ) {

    throw new Error(
      `Failed to update order: ${JSON.stringify(
        response.errors
      )}`
    );

  }


  return (
    response?.data?.updateOrder ||
    null
  );
}


/* ==========================================================
   GRAPHQL REQUEST HELPER
========================================================== */

async function graphqlRequest(
  query,
  variables = {}
) {

  if (
    !GRAPHQL_ENDPOINT
  ) {

    throw new Error(
      "Missing API_ATUA_GRAPHQLAPIENDPOINTOUTPUT"
    );

  }


  if (
    !API_KEY
  ) {

    throw new Error(
      "Missing API_ATUA_GRAPHQLAPIKEYOUTPUT"
    );

  }


  const response =
    await fetch(
      GRAPHQL_ENDPOINT,
      {

        method:
          "POST",

        headers: {

          "Content-Type":
            "application/json",

          "x-api-key":
            API_KEY,

        },

        body:
          JSON.stringify({

            query,

            variables,

          }),

      }
    );


  const responseText =
    await response.text();


  let responseData;


  try {

    responseData =
      JSON.parse(
        responseText
      );

  } catch (
    error
  ) {

    throw new Error(
      `GraphQL returned invalid JSON: ${responseText}`
    );

  }


  if (
    !response.ok
  ) {

    throw new Error(
      `GraphQL HTTP ${response.status}: ${responseText}`
    );

  }


  return responseData;
}


/* ==========================================================
   SUCCESS RESPONSE HELPER
========================================================== */

function successResponse(
  data
) {

  return {

    statusCode:
      200,

    body:
      JSON.stringify({

        success:
          true,

        ...data,

      }),

  };

}