const fetch = require("node-fetch");

/*
============================================================
ATUA — RELEASE FUNDS
============================================================

PURPOSE
-------

Release a courier's allocated earnings after the order has
been successfully completed.

FLOW:

    Order DELIVERED
          ↓
    Check admin hold
          ↓
    pendingBalance -= courierEarnings
          ↓
    availableBalance += courierEarnings
          ↓
    Transaction PENDING → COMPLETED
          ↓
    Order fundsStatus = RELEASED


THIS FUNCTION DOES NOT:

    - Process customer payment
    - Verify Paystack
    - Allocate courier earnings
    - Generate delivery verification codes
    - Pay courier's bank account
    - Process Paystack transfers
    - Change lifetimeEarnings

PAYOUTS ARE A SEPARATE PROCESS.

============================================================
EXPECTED EVENT
============================================================

{
    "orderID": "ORDER-ID"
}

Optional:

{
    "orderID": "ORDER-ID",
    "releaseType": "MANUAL"
}

If releaseType is not supplied:

    AUTOMATIC

============================================================
*/


/* ==========================================================
   ENVIRONMENT VARIABLES
========================================================== */

const GRAPHQL_ENDPOINT =
  process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const API_KEY =
  process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;


/* ==========================================================
   MAIN HANDLER
========================================================== */

exports.handler = async (event) => {

  console.log(
    "RELEASE FUNDS EVENT:",
    JSON.stringify(event)
  );

  let orderID = null;

  try {

    /*
    ----------------------------------------------------------
    1. GET ORDER ID
    ----------------------------------------------------------
    */

    orderID =
      event?.orderID ||
      event?.arguments?.orderID ||
      event?.detail?.orderID;


    if (!orderID) {

      throw new Error(
        "orderID is required"
      );

    }


    console.log(
      "Releasing funds for order:",
      orderID
    );


    /*
    ----------------------------------------------------------
    2. GET ORDER
    ----------------------------------------------------------
    */

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

          fundsReleasedAt

          fundsReleaseType

          earningsAllocationStatus

          earningsAllocatedAt

          assignedCourierId

          courierEarnings

          paymentID

          paymentReference
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


    /*
    ----------------------------------------------------------
    3. IDEMPOTENCY CHECK
    ----------------------------------------------------------

    If the funds have already been released, do nothing.

    This protects against:

        - duplicate Lambda invocation
        - retries
        - accidental manual re-runs
        - network retries
    ----------------------------------------------------------
    */

    if (
      order.fundsStatus === "RELEASED"
    ) {

      console.log(
        `Funds already released for order ${orderID}`
      );


      return successResponse({

        message:
          "Funds already released",

        orderID,

        status:
          "RELEASED",

        alreadyReleased:
          true,

      });

    }


    /*
    ----------------------------------------------------------
    4. VERIFY ORDER STATUS
    ----------------------------------------------------------

    Funds should only be released after the delivery has
    actually been completed.

    Your schema defines DELIVERED as the completed delivery
    state.

    ----------------------------------------------------------
    */

    if (
      order.status !== "DELIVERED"
    ) {

      throw new Error(
        `Order ${orderID} is not DELIVERED. Current status: ${order.status}`
      );

    }


    /*
    ----------------------------------------------------------
    5. VERIFY EARNINGS WERE ALLOCATED
    ----------------------------------------------------------
    */

    if (
      order.earningsAllocationStatus !==
      "ALLOCATED"
    ) {

      throw new Error(
        `Courier earnings have not been allocated for order ${orderID}. Current allocation status: ${order.earningsAllocationStatus}`
      );

    }


    /*
    ----------------------------------------------------------
    6. VERIFY COURIER
    ----------------------------------------------------------
    */

    const courierID =
      order.assignedCourierId;


    if (!courierID) {

      throw new Error(
        `Order ${orderID} has no assigned courier`
      );

    }


    /*
    ----------------------------------------------------------
    7. VERIFY EARNINGS
    ----------------------------------------------------------
    */

    const earnings =
      Number(
        order.courierEarnings || 0
      );


    if (
      !Number.isFinite(earnings) ||
      earnings <= 0
    ) {

      throw new Error(
        `Invalid courier earnings for order ${orderID}: ${order.courierEarnings}`
      );

    }


    console.log(
      "Courier:",
      courierID
    );

    console.log(
      "Courier earnings:",
      earnings
    );


    /*
    ----------------------------------------------------------
    8. CHECK ADMIN HOLD
    ----------------------------------------------------------

    THIS IS VERY IMPORTANT.

    An admin can deliberately prevent automatic release by
    setting:

        fundsReleaseBlocked = true

    Even if the order is DELIVERED, the money stays in:

        pendingBalance

    until the admin removes the hold.

    ----------------------------------------------------------
    */

    if (
      order.fundsReleaseBlocked === true
    ) {

      console.log(
        `Funds release blocked by admin for order ${orderID}`
      );


      return successResponse({

        message:
          "Funds release is blocked by admin",

        orderID,

        courierID,

        amount:
          earnings,

        status:
          "HELD",

        fundsStatus:
          order.fundsStatus,

        holdReason:
          order.fundsHoldReason || null,

        heldBy:
          order.fundsHeldBy || null,

        heldAt:
          order.fundsHeldAt || null,

        releaseBlocked:
          true,

      });

    }


    /*
    ----------------------------------------------------------
    9. VERIFY FUNDS ARE CURRENTLY HELD
    ----------------------------------------------------------
    */

    if (
      order.fundsStatus !== "HELD"
    ) {

      throw new Error(
        `Order ${orderID} has unexpected fundsStatus: ${order.fundsStatus}`
      );

    }


    /*
    ----------------------------------------------------------
    10. GET COURIER WALLET
    ----------------------------------------------------------
    */

    const getCourierQuery = `
      query GetCourier($id: ID!) {

        getCourier(id: $id) {

          id

          firstName
          lastName

          walletID
        }
      }
    `;


    const courierResponse =
      await graphqlRequest(
        getCourierQuery,
        {
          id:
            courierID,
        }
      );


    if (
      courierResponse.errors
    ) {

      throw new Error(
        `Failed to fetch courier: ${JSON.stringify(
          courierResponse.errors
        )}`
      );

    }


    const courier =
      courierResponse?.data?.getCourier;


    if (!courier) {

      throw new Error(
        `Courier not found: ${courierID}`
      );

    }


    /*
    ----------------------------------------------------------
    11. FIND COURIER WALLET
    ----------------------------------------------------------

    First attempt:

        Courier.walletID

    If that does not exist, search by:

        ownerID
        ownerType = COURIER

    ----------------------------------------------------------
    */

    let wallet = null;


    if (
      courier.walletID
    ) {

      const getWalletQuery = `
        query GetWallet($id: ID!) {

          getWallet(id: $id) {

            id

            ownerID
            ownerType

            availableBalance
            pendingBalance
            lifetimeEarnings
          }
        }
      `;


      const walletResponse =
        await graphqlRequest(
          getWalletQuery,
          {
            id:
              courier.walletID,
          }
        );


      if (
        walletResponse.errors
      ) {

        throw new Error(
          `Failed to fetch wallet: ${JSON.stringify(
            walletResponse.errors
          )}`
        );

      }


      wallet =
        walletResponse?.data?.getWallet;

    }


    /*
    ----------------------------------------------------------
    FALLBACK WALLET SEARCH
    ----------------------------------------------------------
    */

    if (!wallet) {

      const listWalletsQuery = `
        query ListWallets(
          $filter: ModelWalletFilterInput
        ) {

          listWallets(
            filter: $filter
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


      const walletResponse =
        await graphqlRequest(
          listWalletsQuery,
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
        walletResponse.errors
      ) {

        throw new Error(
          `Failed to search courier wallet: ${JSON.stringify(
            walletResponse.errors
          )}`
        );

      }


      wallet =
        walletResponse
          ?.data
          ?.listWallets
          ?.items
          ?.[0];

    }


    /*
    ----------------------------------------------------------
    12. WALLET MUST EXIST
    ----------------------------------------------------------
    */

    if (!wallet) {

      throw new Error(
        `Wallet not found for courier ${courierID}`
      );

    }


    /*
    ----------------------------------------------------------
    13. VERIFY WALLET OWNER
    ----------------------------------------------------------
    */

    if (
      wallet.ownerID !== courierID
    ) {

      throw new Error(
        `Wallet ${wallet.id} does not belong to courier ${courierID}`
      );

    }


    if (
      wallet.ownerType !== "COURIER"
    ) {

      throw new Error(
        `Wallet ${wallet.id} is not a courier wallet`
      );

    }


    console.log(
      "WALLET:",
      JSON.stringify(wallet)
    );


    /*
    ----------------------------------------------------------
    14. READ WALLET BALANCES
    ----------------------------------------------------------
    */

    const currentPendingBalance =
      Number(
        wallet.pendingBalance || 0
      );


    const currentAvailableBalance =
      Number(
        wallet.availableBalance || 0
      );


    const currentLifetimeEarnings =
      Number(
        wallet.lifetimeEarnings || 0
      );


    /*
    ----------------------------------------------------------
    15. VERIFY PENDING BALANCE
    ----------------------------------------------------------

    We should NEVER release more money than is actually
    sitting in pendingBalance.

    ----------------------------------------------------------
    */

    if (
      currentPendingBalance < earnings
    ) {

      throw new Error(
        `Insufficient pending balance for courier ${courierID}. ` +
        `Pending: ${currentPendingBalance}, ` +
        `Required: ${earnings}`
      );

    }


    /*
    ----------------------------------------------------------
    16. CALCULATE NEW BALANCES
    ----------------------------------------------------------

    pendingBalance
        decreases

    availableBalance
        increases

    lifetimeEarnings
        DOES NOT CHANGE

    ----------------------------------------------------------
    */

    const newPendingBalance =
      currentPendingBalance -
      earnings;


    const newAvailableBalance =
      currentAvailableBalance +
      earnings;


    /*
    Floating point protection.

    Money should be stored consistently to two decimal places.
    */

    const roundedPendingBalance =
      Number(
        newPendingBalance.toFixed(2)
      );


    const roundedAvailableBalance =
      Number(
        newAvailableBalance.toFixed(2)
      );


    /*
    ----------------------------------------------------------
    17. UPDATE WALLET
    ----------------------------------------------------------
    */

    const updateWalletMutation = `
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


    const walletUpdateResponse =
      await graphqlRequest(
        updateWalletMutation,
        {

          input: {

            id:
              wallet.id,

            availableBalance:
              roundedAvailableBalance,

            pendingBalance:
              roundedPendingBalance,

            /*
            IMPORTANT:

            lifetimeEarnings is intentionally NOT changed.
            */

          },

        }
      );


    if (
      walletUpdateResponse.errors
    ) {

      throw new Error(
        `Failed to release wallet funds: ${JSON.stringify(
          walletUpdateResponse.errors
        )}`
      );

    }


    console.log(
      "WALLET AFTER RELEASE:",
      JSON.stringify(
        walletUpdateResponse
          ?.data
          ?.updateWallet
      )
    );


    /*
    ----------------------------------------------------------
    18. FIND THE EARNINGS TRANSACTION
    ----------------------------------------------------------

    allocateCourierEarnings creates:

        CREDIT
        PENDING

    We now change that transaction to:

        CREDIT
        COMPLETED

    ----------------------------------------------------------
    */

    const transactionReference =
      `EARNINGS-${orderID}`;


    const findTransactionQuery = `
      query ListTransactions(
        $filter: ModelTransactionFilterInput
      ) {

        listTransactions(
          filter: $filter
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
          }
        }
      }
    `;


    const transactionResponse =
      await graphqlRequest(
        findTransactionQuery,
        {

          filter: {

            reference: {
              eq:
                transactionReference,
            },

          },

        }
      );


    if (
      transactionResponse.errors
    ) {

      throw new Error(
        `Failed to find earnings transaction: ${JSON.stringify(
          transactionResponse.errors
        )}`
      );

    }


    const transaction =
      transactionResponse
        ?.data
        ?.listTransactions
        ?.items
        ?.[0];


    /*
    ----------------------------------------------------------
    19. UPDATE TRANSACTION
    ----------------------------------------------------------
    */

    if (transaction) {

      /*
      Only change the transaction to COMPLETED if it is
      currently pending.

      If it is already completed, leave it alone.
      */

      if (
        transaction.status === "PENDING"
      ) {

        const updateTransactionMutation = `
          mutation UpdateTransaction(
            $input: UpdateTransactionInput!
          ) {

            updateTransaction(
              input: $input
            ) {

              id

              walletID

              type

              amount

              description

              orderID

              paymentID

              reference

              status
            }
          }
        `;


        const updateTransactionResponse =
          await graphqlRequest(
            updateTransactionMutation,
            {

              input: {

                id:
                  transaction.id,

                status:
                  "COMPLETED",

                description:
                  "Courier earnings released and made available for payout",

              },

            }
          );


        if (
          updateTransactionResponse.errors
        ) {

          throw new Error(
            `Wallet was updated but transaction could not be completed: ${JSON.stringify(
              updateTransactionResponse.errors
            )}`
          );

        }


        console.log(
          "TRANSACTION COMPLETED:",
          JSON.stringify(
            updateTransactionResponse
              ?.data
              ?.updateTransaction
          )
        );

      } else if (
        transaction.status === "COMPLETED"
      ) {

        console.log(
          "Transaction already completed"
        );

      } else {

        throw new Error(
          `Earnings transaction has unexpected status: ${transaction.status}`
        );

      }

    } else {

      /*
      This is unusual.

      allocateCourierEarnings should have created the
      transaction before release.

      We do NOT silently create a new transaction here because
      the wallet has already been changed.

      Throwing an error makes the problem visible and
      prevents us from pretending the ledger is complete.
      */

      throw new Error(
        `Earnings transaction ${transactionReference} was not found`
      );

    }


    /*
    ----------------------------------------------------------
    20. DETERMINE RELEASE TYPE
    ----------------------------------------------------------

    Because fundsReleaseType is a String in your schema,
    we can safely store:

        AUTOMATIC

    or:

        MANUAL

    ----------------------------------------------------------
    */

    const releaseType =
      event?.releaseType ||
      event?.arguments?.releaseType ||
      "AUTOMATIC";


    /*
    ----------------------------------------------------------
    21. UPDATE ORDER
    ----------------------------------------------------------

    The money is now:

        pendingBalance → availableBalance

    Therefore the order's funds are RELEASED.

    ----------------------------------------------------------
    */

    const releaseTimestamp =
      new Date().toISOString();


    const updateOrderMutation = `
      mutation UpdateOrder(
        $input: UpdateOrderInput!
      ) {

        updateOrder(
          input: $input
        ) {

          id

          fundsStatus

          fundsReleasedAt

          fundsReleaseType

          fundsReleaseBlocked

          earningsAllocationStatus

          payoutStatus
        }
      }
    `;


    const orderUpdateResponse =
      await graphqlRequest(
        updateOrderMutation,
        {

          input: {

            id:
              orderID,

            fundsStatus:
              "RELEASED",

            fundsReleasedAt:
              releaseTimestamp,

            fundsReleaseType:
              releaseType,

            /*
            We are NOT changing:

                fundsReleaseBlocked

            The admin hold state is preserved.

            In normal operation it should already be false.
            */

          },

        }
      );


    if (
      orderUpdateResponse.errors
    ) {

      throw new Error(
        `Wallet and transaction were updated but order could not be marked RELEASED: ${JSON.stringify(
          orderUpdateResponse.errors
        )}`
      );

    }


    console.log(
      "ORDER FUNDS RELEASED:",
      JSON.stringify(
        orderUpdateResponse
          ?.data
          ?.updateOrder
      )
    );


    /*
    ----------------------------------------------------------
    22. SUCCESS
    ----------------------------------------------------------
    */

    return successResponse({

      message:
        "Courier funds released successfully",

      orderID,

      courierID,

      amount:
        earnings,

      walletID:
        wallet.id,

      previousPendingBalance:
        currentPendingBalance,

      newPendingBalance:
        roundedPendingBalance,

      previousAvailableBalance:
        currentAvailableBalance,

      newAvailableBalance:
        roundedAvailableBalance,

      lifetimeEarnings:
        currentLifetimeEarnings,

      releaseType:
        releaseType,

      fundsStatus:
        "RELEASED",

      transactionStatus:
        "COMPLETED",

    });


  } catch (error) {

    console.error(
      "RELEASE FUNDS ERROR:",
      error
    );


    /*
    ----------------------------------------------------------
    23. ERROR RESPONSE
    ----------------------------------------------------------
    */

    return {

      statusCode:
        500,

      body:
        JSON.stringify({

          success:
            false,

          message:
            error.message ||
            "Funds release failed",

          orderID,

        }),

    };

  }
};


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
    parseError
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

}const fetch = require("node-fetch");

/*
============================================================
ATUA — RELEASE FUNDS
============================================================

PURPOSE
-------

Release 100% of a courier's allocated earnings into the
courier's available balance after a NORMAL delivery has been
completed.

NORMAL FLOW:

    Order DELIVERED
          ↓
    Check admin hold
          ↓
    pendingBalance -= courierEarnings
          ↓
    availableBalance += courierEarnings
          ↓
    Earnings Transaction = COMPLETED
          ↓
    Order fundsStatus = RELEASED
          ↓
    Order fundsReleasedAmount = courierEarnings


THIS FUNCTION DOES NOT:

    - Process customer payment
    - Verify Paystack payment
    - Allocate courier earnings
    - Generate delivery verification codes
    - Pay courier's bank account
    - Process Paystack transfers
    - Change lifetimeEarnings
    - Perform Maxi milestone releases

MAXI RELEASES ARE HANDLED BY:

    releaseCourierMilestoneFunds


EXPECTED EVENT:

{
    "orderID": "ORDER-ID"
}

OPTIONAL:

{
    "orderID": "ORDER-ID",
    "releaseType": "AUTOMATIC"
}

============================================================
*/


/* ==========================================================
   ENVIRONMENT VARIABLES
========================================================== */

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
    "ATUA RELEASE FUNDS STARTED"
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


    console.log(
      "Releasing funds for order:",
      orderID
    );


    /* ======================================================
       2. GET ORDER
    ====================================================== */

    const getOrderQuery = `
      query GetOrder($id: ID!) {

        getOrder(id: $id) {

          id

          status

          paymentStatus
          paymentID
          paymentReference

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

        }

      }
    `;


    const orderResponse =
      await graphqlRequest(
        getOrderQuery,
        {
          id:
            orderID,
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
       3. IDEMPOTENCY
    ====================================================== */

    if (
      order.fundsStatus ===
      "RELEASED"
    ) {

      console.log(
        `Funds already fully released for order ${orderID}`
      );


      return successResponse({

        message:
          "Funds already released.",

        orderID,

        courierID:
          order.assignedCourierId,

        amount:
          Number(
            order.courierEarnings || 0
          ),

        fundsStatus:
          "RELEASED",

        fundsReleasedAmount:
          Number(
            order.fundsReleasedAmount || 0
          ),

        alreadyReleased:
          true,

      });

    }


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
       5. VERIFY ORDER WAS ALLOCATED
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
       6. VERIFY ORDER IS DELIVERED
    ====================================================== */

    if (
      order.status !==
      "DELIVERED"
    ) {

      throw new Error(
        `Order ${orderID} is not DELIVERED. Current status: ${order.status}`
      );

    }


    /* ======================================================
       7. DO NOT USE NORMAL RELEASE FOR MAXI
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


    if (
      isMaxi
    ) {

      throw new Error(
        `Order ${orderID} is a MAXI order. Use releaseCourierMilestoneFunds instead.`
      );

    }


    /* ======================================================
       8. VERIFY COURIER
    ====================================================== */

    const courierID =
      order.assignedCourierId;


    if (!courierID) {

      throw new Error(
        `Order ${orderID} has no assigned courier.`
      );

    }


    /* ======================================================
       9. VERIFY EARNINGS
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


    console.log(
      "COURIER:",
      courierID
    );

    console.log(
      "EARNINGS:",
      earnings
    );


    /* ======================================================
       10. CHECK ADMIN HOLD
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

        amount:
          earnings,

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
       11. NORMAL ORDER MUST BE HELD
    ====================================================== */

    if (
      order.fundsStatus !==
      "HELD"
    ) {

      /*
       * PARTIALLY_RELEASED belongs to the Maxi milestone
       * system. It should not be processed by this Lambda.
       */

      throw new Error(
        `Order ${orderID} has fundsStatus ${order.fundsStatus}. Normal release requires HELD.`
      );

    }


    /* ======================================================
       12. GET COURIER
    ====================================================== */

    const getCourierQuery = `
      query GetCourier($id: ID!) {

        getCourier(id: $id) {

          id

          firstName
          lastName

          walletID

        }

      }
    `;


    const courierResponse =
      await graphqlRequest(
        getCourierQuery,
        {
          id:
            courierID,
        }
      );


    if (
      courierResponse.errors
    ) {

      throw new Error(
        `Failed to fetch courier: ${JSON.stringify(
          courierResponse.errors
        )}`
      );

    }


    const courier =
      courierResponse?.data?.getCourier;


    if (!courier) {

      throw new Error(
        `Courier not found: ${courierID}`
      );

    }


    /* ======================================================
       13. GET COURIER WALLET
    ====================================================== */

    let wallet = null;


    /*
    ----------------------------------------------------------
    PREFERRED: Courier.walletID
    ----------------------------------------------------------
    */

    if (
      courier.walletID
    ) {

      const getWalletQuery = `
        query GetWallet($id: ID!) {

          getWallet(id: $id) {

            id

            ownerID
            ownerType

            availableBalance
            pendingBalance
            lifetimeEarnings

          }

        }
      `;


      const walletResponse =
        await graphqlRequest(
          getWalletQuery,
          {
            id:
              courier.walletID,
          }
        );


      if (
        walletResponse.errors
      ) {

        throw new Error(
          `Failed to fetch wallet: ${JSON.stringify(
            walletResponse.errors
          )}`
        );

      }


      wallet =
        walletResponse?.data?.getWallet;

    }


    /*
    ----------------------------------------------------------
    FALLBACK: Search by ownerID + ownerType
    ----------------------------------------------------------
    */

    if (!wallet) {

      const listWalletsQuery = `
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


      const walletResponse =
        await graphqlRequest(
          listWalletsQuery,
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
        walletResponse.errors
      ) {

        throw new Error(
          `Failed to search courier wallet: ${JSON.stringify(
            walletResponse.errors
          )}`
        );

      }


      wallet =
        walletResponse
          ?.data
          ?.listWallets
          ?.items
          ?.[0];

    }


    /* ======================================================
       14. WALLET MUST EXIST
    ====================================================== */

    if (!wallet) {

      throw new Error(
        `Wallet not found for courier ${courierID}`
      );

    }


    /* ======================================================
       15. VERIFY WALLET OWNER
    ====================================================== */

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


    /* ======================================================
       16. READ BALANCES
    ====================================================== */

    const currentPendingBalance =
      Number(
        wallet.pendingBalance || 0
      );


    const currentAvailableBalance =
      Number(
        wallet.availableBalance || 0
      );


    const currentLifetimeEarnings =
      Number(
        wallet.lifetimeEarnings || 0
      );


    /* ======================================================
       17. VERIFY PENDING BALANCE
    ====================================================== */

    if (
      currentPendingBalance <
      earnings
    ) {

      throw new Error(
        `Insufficient pending balance. Pending: ${currentPendingBalance}, required: ${earnings}.`
      );

    }


    /* ======================================================
       18. CALCULATE BALANCES
    ====================================================== */

    const newPendingBalance =
      Number(
        (
          currentPendingBalance -
          earnings
        ).toFixed(2)
      );


    const newAvailableBalance =
      Number(
        (
          currentAvailableBalance +
          earnings
        ).toFixed(2)
      );


    /* ======================================================
       19. UPDATE WALLET
    ====================================================== */

    const updateWalletMutation = `
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


    const walletUpdateResponse =
      await graphqlRequest(
        updateWalletMutation,
        {

          input: {

            id:
              wallet.id,

            availableBalance:
              newAvailableBalance,

            pendingBalance:
              newPendingBalance,

            /*
             * lifetimeEarnings DOES NOT CHANGE.
             */

          },

        }
      );


    if (
      walletUpdateResponse.errors
    ) {

      throw new Error(
        `Failed to update wallet: ${JSON.stringify(
          walletUpdateResponse.errors
        )}`
      );

    }


    const updatedWallet =
      walletUpdateResponse
        ?.data
        ?.updateWallet;


    if (!updatedWallet) {

      throw new Error(
        "Wallet update returned no wallet."
      );

    }


    console.log(
      "WALLET UPDATED:",
      {
        walletID:
          wallet.id,

        previousPendingBalance:
          currentPendingBalance,

        newPendingBalance:
          newPendingBalance,

        previousAvailableBalance:
          currentAvailableBalance,

        newAvailableBalance:
          newAvailableBalance,

        lifetimeEarnings:
          currentLifetimeEarnings,
      }
    );


    /* ======================================================
       20. FIND EARNINGS TRANSACTION
    ====================================================== */

    const transactionReference =
      `EARNINGS-${orderID}`;


    const findTransactionQuery = `
      query ListTransactions(
        $filter: ModelTransactionFilterInput
      ) {

        listTransactions(
          filter: $filter
          limit: 1
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

          }

        }

      }
    `;


    const transactionResponse =
      await graphqlRequest(
        findTransactionQuery,
        {

          filter: {

            reference: {
              eq:
                transactionReference,
            },

          },

        }
      );


    if (
      transactionResponse.errors
    ) {

      throw new Error(
        `Failed to find earnings transaction: ${JSON.stringify(
          transactionResponse.errors
        )}`
      );

    }


    const transaction =
      transactionResponse
        ?.data
        ?.listTransactions
        ?.items
        ?.[0];


    if (!transaction) {

      /*
       * The wallet has already been changed, therefore we
       * deliberately do NOT create a replacement transaction
       * here without reconciliation.
       */

      throw new Error(
        `Earnings transaction ${transactionReference} was not found. Wallet update requires reconciliation.`
      );

    }


    /* ======================================================
       21. VERIFY TRANSACTION
    ====================================================== */

    if (
      transaction.walletID !==
      wallet.id
    ) {

      throw new Error(
        `Earnings transaction ${transaction.id} does not belong to wallet ${wallet.id}`
      );

    }


    if (
      transaction.type !==
      "CREDIT"
    ) {

      throw new Error(
        `Earnings transaction ${transaction.id} is not a CREDIT transaction.`
      );

    }


    const transactionAmount =
      Number(
        transaction.amount || 0
      );


    if (
      Math.abs(
        transactionAmount -
        earnings
      ) > 0.01
    ) {

      throw new Error(
        `Earnings transaction amount ${transactionAmount} does not match courier earnings ${earnings}.`
      );

    }


    /* ======================================================
       22. COMPLETE EARNINGS TRANSACTION
    ====================================================== */

    if (
      transaction.status ===
      "PENDING"
    ) {

      const updateTransactionMutation = `
        mutation UpdateTransaction(
          $input: UpdateTransactionInput!
        ) {

          updateTransaction(
            input: $input
          ) {

            id

            walletID

            type
            amount

            description

            orderID
            paymentID

            reference

            status

          }

        }
      `;


      const transactionUpdateResponse =
        await graphqlRequest(
          updateTransactionMutation,
          {

            input: {

              id:
                transaction.id,

              status:
                "COMPLETED",

              description:
                "Courier earnings released and made available for payout.",

            },

          }
        );


      if (
        transactionUpdateResponse.errors
      ) {

        throw new Error(
          `Wallet was updated but transaction could not be completed: ${JSON.stringify(
            transactionUpdateResponse.errors
          )}`
        );

      }


      console.log(
        "EARNINGS TRANSACTION COMPLETED:",
        JSON.stringify(
          transactionUpdateResponse
            ?.data
            ?.updateTransaction
        )
      );

    } else if (
      transaction.status ===
      "COMPLETED"
    ) {

      console.log(
        "Earnings transaction already completed."
      );

    } else {

      throw new Error(
        `Unexpected earnings transaction status: ${transaction.status}`
      );

    }


    /* ======================================================
       23. DETERMINE RELEASE TYPE
    ====================================================== */

    const releaseType =
      String(
        event?.releaseType ||
        event?.arguments?.releaseType ||
        "AUTOMATIC"
      ).toUpperCase();


    /* ======================================================
       24. UPDATE ORDER
    ====================================================== */

    const releaseTimestamp =
      new Date().toISOString();


    const updateOrderMutation = `
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

          earningsAllocationStatus

          payoutStatus

        }

      }
    `;


    const orderUpdateResponse =
      await graphqlRequest(
        updateOrderMutation,
        {

          input: {

            id:
              orderID,

            fundsStatus:
              "RELEASED",

            /*
             * For a normal courier, 100% is released.
             */

            fundsReleasedAmount:
              earnings,

            /*
             * pickupFundsReleasedAt is intentionally NOT
             * set here. It is only for Maxi pickup release.
             */

            fundsReleasedAt:
              releaseTimestamp,

            fundsReleaseType:
              releaseType,

          },

        }
      );


    if (
      orderUpdateResponse.errors
    ) {

      throw new Error(
        `Wallet and transaction were updated but order could not be marked RELEASED: ${JSON.stringify(
          orderUpdateResponse.errors
        )}`
      );

    }


    const updatedOrder =
      orderUpdateResponse
        ?.data
        ?.updateOrder;


    if (!updatedOrder) {

      throw new Error(
        "Order update returned no order."
      );

    }


    /* ======================================================
       25. VERIFY FINAL ORDER STATE
    ====================================================== */

    if (
      updatedOrder.fundsStatus !==
      "RELEASED"
    ) {

      throw new Error(
        `Order fundsStatus was not updated to RELEASED. Current value: ${updatedOrder.fundsStatus}`
      );

    }


    const releasedAmount =
      Number(
        updatedOrder.fundsReleasedAmount ||
        0
      );


    if (
      Math.abs(
        releasedAmount -
        earnings
      ) > 0.01
    ) {

      throw new Error(
        `Order fundsReleasedAmount ${releasedAmount} does not match courier earnings ${earnings}.`
      );

    }


    /* ======================================================
       26. SUCCESS
    ====================================================== */

    console.log(
      "=========================================="
    );

    console.log(
      "FUNDS RELEASED SUCCESSFULLY"
    );

    console.log(
      "=========================================="
    );


    return successResponse({

      message:
        "Courier funds released successfully.",

      orderID,

      courierID,

      amount:
        earnings,

      walletID:
        wallet.id,

      previousPendingBalance:
        currentPendingBalance,

      newPendingBalance:
        newPendingBalance,

      previousAvailableBalance:
        currentAvailableBalance,

      newAvailableBalance:
        newAvailableBalance,

      lifetimeEarnings:
        currentLifetimeEarnings,

      fundsReleasedAmount:
        earnings,

      fundsStatus:
        "RELEASED",

      releaseType,

      transactionStatus:
        "COMPLETED",

    });


  } catch (error) {

    console.error(
      "=========================================="
    );

    console.error(
      "ATUA RELEASE FUNDS ERROR"
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
            "Funds release failed.",

          orderID,

        }),

    };

  }

};


/* ==========================================================
   GRAPHQL REQUEST HELPER
========================================================== */

async function graphqlRequest(
  query,
  variables = {}
) {

  if (!GRAPHQL_ENDPOINT) {

    throw new Error(
      "Missing API_ATUA_GRAPHQLAPIENDPOINTOUTPUT"
    );

  }


  if (!API_KEY) {

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
    parseError
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


  if (
    responseData?.errors?.length
  ) {

    throw new Error(
      responseData.errors
        .map(
          (error) =>
            error?.message
        )
        .filter(Boolean)
        .join(" | ")
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