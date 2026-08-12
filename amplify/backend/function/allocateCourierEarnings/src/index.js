const fetch = require("node-fetch");

/*
============================================================
ATUA — ALLOCATE COURIER EARNINGS
============================================================

PURPOSE
-------

Allocate a courier's earnings from a PAID order into the
courier's pending wallet balance.

This function DOES:

    Order courierEarnings
            ↓
    Wallet.pendingBalance
            +
    Wallet.lifetimeEarnings
            ↓
    Transaction CREDIT / PENDING
            ↓
    Order earningsAllocationStatus = ALLOCATED


This function DOES NOT:

    - Process Paystack payment
    - Verify Paystack payment
    - Generate delivery verification codes
    - Release courier funds
    - Move pendingBalance → availableBalance
    - Pay the courier's bank account
    - Process payouts

Those responsibilities belong to other parts of the
financial system.

============================================================
EXPECTED EVENT
============================================================

{
    "orderID": "ORDER-ID"
}

============================================================
REQUIRED ORDER STATE
============================================================

paymentStatus
    = PAID

assignedCourierId
    = valid courier ID

courierEarnings
    > 0

earningsAllocationStatus
    = NOT_ALLOCATED

============================================================
WALLET RESULT
============================================================

pendingBalance
    += courierEarnings

lifetimeEarnings
    += courierEarnings

availableBalance
    remains unchanged

============================================================
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
    "ALLOCATE COURIER EARNINGS EVENT:",
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
      throw new Error("orderID is required");
    }

    console.log(
      "Processing order:",
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

          paymentStatus
          paymentID
          paymentReference

          assignedCourierId
          courierEarnings

          fundsStatus
          fundsReleaseBlocked

          payoutStatus

          earningsAllocationStatus
          earningsAllocatedAt
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


    if (orderResponse.errors) {

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
    3. VERIFY PAYMENT STATUS
    ----------------------------------------------------------

    This Lambda only allocates earnings after the order has
    been successfully paid.

    verifyAtuaPayment / Paystack flow is responsible for
    establishing that payment is PAID.

    ----------------------------------------------------------
    */

    if (
      order.paymentStatus !== "PAID"
    ) {

      throw new Error(
        `Order ${orderID} is not PAID. Current paymentStatus: ${order.paymentStatus}`
      );
    }


    /*
    ----------------------------------------------------------
    4. VERIFY COURIER ASSIGNMENT
    ----------------------------------------------------------
    */

    const courierID =
      order.assignedCourierId;


    if (!courierID) {

      throw new Error(
        `Order ${orderID} does not have an assigned courier`
      );
    }


    console.log(
      "Assigned courier:",
      courierID
    );


    /*
    ----------------------------------------------------------
    5. VERIFY COURIER EARNINGS
    ----------------------------------------------------------
    */

    const earnings =
      Number(order.courierEarnings || 0);


    if (
      !Number.isFinite(earnings) ||
      earnings <= 0
    ) {

      throw new Error(
        `Invalid courier earnings for order ${orderID}: ${order.courierEarnings}`
      );
    }


    console.log(
      "Courier earnings:",
      earnings
    );


    /*
    ----------------------------------------------------------
    6. VERIFY ALLOCATION STATUS
    ----------------------------------------------------------

    A newly paid/assigned order should be:

        NOT_ALLOCATED

    If already ALLOCATED, do nothing.

    If PROCESSING, another invocation may already be working.

    ----------------------------------------------------------
    */

    const allocationStatus =
      order.earningsAllocationStatus;


    if (
      allocationStatus === "ALLOCATED"
    ) {

      console.log(
        `Order ${orderID} earnings already allocated`
      );


      return successResponse({
        message:
          "Courier earnings already allocated",

        orderID,

        courierID,

        amount:
          earnings,

        status:
          "ALLOCATED",

        alreadyAllocated:
          true,
      });
    }


    if (
      allocationStatus === "PROCESSING"
    ) {

      console.log(
        `Order ${orderID} allocation is already processing`
      );


      return successResponse({
        message:
          "Courier earnings allocation is already processing",

        orderID,

        courierID,

        amount:
          earnings,

        status:
          "PROCESSING",

        alreadyProcessing:
          true,
      });
    }


    if (
      allocationStatus !== "NOT_ALLOCATED"
    ) {

      throw new Error(
        `Order ${orderID} has invalid earningsAllocationStatus: ${allocationStatus}`
      );
    }


    /*
    ----------------------------------------------------------
    7. CLAIM ORDER FOR PROCESSING
    ----------------------------------------------------------

    We first change:

        NOT_ALLOCATED
                ↓
        PROCESSING

    using an AppSync condition.

    This prevents two Lambda invocations from both attempting
    to allocate the same order simultaneously.

    ----------------------------------------------------------
    */

    const claimOrderMutation = `
      mutation UpdateOrder(
        $input: UpdateOrderInput!
        $condition: ModelOrderConditionInput
      ) {

        updateOrder(
          input: $input
          condition: $condition
        ) {

          id

          earningsAllocationStatus
        }
      }
    `;


    const claimResponse =
      await graphqlRequest(
        claimOrderMutation,
        {

          input: {

            id:
              orderID,

            earningsAllocationStatus:
              "PROCESSING",
          },


          condition: {

            earningsAllocationStatus: {
              eq: "NOT_ALLOCATED",
            },

          },

        }
      );


    /*
    ----------------------------------------------------------
    8. HANDLE CLAIM FAILURE
    ----------------------------------------------------------
    */

    if (
      claimResponse.errors
    ) {

      console.error(
        "ORDER CLAIM FAILED:",
        JSON.stringify(
          claimResponse.errors
        )
      );


      /*
      Re-read the order.

      Another Lambda invocation may have claimed it.
      */

      const checkResponse =
        await graphqlRequest(
          getOrderQuery,
          {
            id:
              orderID,
          }
        );


      const currentOrder =
        checkResponse?.data?.getOrder;


      if (
        currentOrder?.earningsAllocationStatus ===
        "ALLOCATED"
      ) {

        return successResponse({

          message:
            "Courier earnings were already allocated",

          orderID,

          courierID,

          amount:
            earnings,

          status:
            "ALLOCATED",

          alreadyAllocated:
            true,

        });
      }


      if (
        currentOrder?.earningsAllocationStatus ===
        "PROCESSING"
      ) {

        return successResponse({

          message:
            "Courier earnings are already being processed",

          orderID,

          courierID,

          amount:
            earnings,

          status:
            "PROCESSING",

          alreadyProcessing:
            true,

        });
      }


      throw new Error(
        `Unable to claim order ${orderID} for earnings allocation`
      );
    }


    console.log(
      `Order ${orderID} successfully claimed`
    );


    /*
    ----------------------------------------------------------
    9. VERIFY COURIER EXISTS
    ----------------------------------------------------------
    */

    const getCourierQuery = `
      query GetCourier($id: ID!) {

        getCourier(id: $id) {

          id

          firstName
          lastName

          isApproved

          bankName
          accountName
          accountNumber

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


    console.log(
      "COURIER:",
      JSON.stringify(courier)
    );


    /*
    ----------------------------------------------------------
    10. GET COURIER WALLET
    ----------------------------------------------------------
    */

    let wallet = null;


    /*
    ----------------------------------------------------------
    PREFERRED METHOD

    Courier has:

        walletID

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
          `Failed to fetch courier wallet: ${JSON.stringify(
            walletResponse.errors
          )}`
        );
      }


      wallet =
        walletResponse?.data?.getWallet;
    }


    /*
    ----------------------------------------------------------
    FALLBACK

    If Courier.walletID is not populated, search by:

        ownerID
        ownerType = COURIER

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
        walletResponse?.data?.listWallets?.items?.[0];
    }


    /*
    ----------------------------------------------------------
    11. WALLET MUST EXIST
    ----------------------------------------------------------
    */

    if (!wallet) {

      throw new Error(
        `Wallet not found for courier ${courierID}`
      );
    }


    /*
    ----------------------------------------------------------
    12. VERIFY WALLET OWNER
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
      "COURIER WALLET:",
      JSON.stringify(wallet)
    );


    /*
    ----------------------------------------------------------
    13. CALCULATE NEW WALLET VALUES
    ----------------------------------------------------------

    IMPORTANT:

    availableBalance DOES NOT CHANGE.

    The courier has earned the money, but the delivery has
    not yet been released.

        pendingBalance += earnings

        lifetimeEarnings += earnings

    ----------------------------------------------------------
    */

    const currentPendingBalance =
      Number(
        wallet.pendingBalance || 0
      );


    const currentLifetimeEarnings =
      Number(
        wallet.lifetimeEarnings || 0
      );


    const newPendingBalance =
      currentPendingBalance +
      earnings;


    const newLifetimeEarnings =
      currentLifetimeEarnings +
      earnings;


    /*
    ----------------------------------------------------------
    14. UPDATE WALLET
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

            /*
            DO NOT CHANGE availableBalance HERE.
            */

            pendingBalance:
              newPendingBalance,

            lifetimeEarnings:
              newLifetimeEarnings,
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


    console.log(
      "WALLET UPDATED:",
      JSON.stringify(
        walletUpdateResponse?.data?.updateWallet
      )
    );


    /*
    ----------------------------------------------------------
    15. CREATE TRANSACTION
    ----------------------------------------------------------

    This transaction represents the courier earnings being
    credited to PENDING balance.

        CREDIT
        PENDING

    It is NOT a payout.

    ----------------------------------------------------------
    */

    const transactionReference =
      `EARNINGS-${orderID}`;


    /*
    ----------------------------------------------------------
    16. CHECK FOR EXISTING TRANSACTION
    ----------------------------------------------------------

    This is an additional protection against duplicate
    transaction creation.

    ----------------------------------------------------------
    */

    const existingTransactionQuery = `
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

            orderID

            reference

            status
          }
        }
      }
    `;


    const existingTransactionResponse =
      await graphqlRequest(
        existingTransactionQuery,
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
      existingTransactionResponse.errors
    ) {

      throw new Error(
        `Failed to check existing transaction: ${JSON.stringify(
          existingTransactionResponse.errors
        )}`
      );
    }


    const existingTransaction =
      existingTransactionResponse
        ?.data
        ?.listTransactions
        ?.items
        ?.[0];


    /*
    ----------------------------------------------------------
    17. CREATE TRANSACTION IF IT DOES NOT EXIST
    ----------------------------------------------------------
    */

    if (!existingTransaction) {

      const createTransactionMutation = `
        mutation CreateTransaction(
          $input: CreateTransactionInput!
        ) {

          createTransaction(
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


      const transactionResponse =
        await graphqlRequest(
          createTransactionMutation,
          {

            input: {

              walletID:
                wallet.id,

              type:
                "CREDIT",

              amount:
                earnings,

              description:
                "Courier earnings allocated to pending balance",

              orderID:
                orderID,

              paymentID:
                order.paymentID || null,

              reference:
                transactionReference,

              status:
                "PENDING",
            },

          }
        );


      if (
        transactionResponse.errors
      ) {

        throw new Error(
          `Failed to create transaction: ${JSON.stringify(
            transactionResponse.errors
          )}`
        );
      }


      console.log(
        "TRANSACTION CREATED:",
        JSON.stringify(
          transactionResponse?.data?.createTransaction
        )
      );

    } else {

      console.log(
        "TRANSACTION ALREADY EXISTS:",
        JSON.stringify(
          existingTransaction
        )
      );

    }


    /*
    ----------------------------------------------------------
    18. FINALIZE ORDER
    ----------------------------------------------------------

        PROCESSING
             ↓
        ALLOCATED

    ----------------------------------------------------------
    */

    const finalizeOrderMutation = `
      mutation UpdateOrder(
        $input: UpdateOrderInput!
      ) {

        updateOrder(
          input: $input
        ) {

          id

          earningsAllocationStatus

          earningsAllocatedAt

          paymentStatus

          fundsStatus

          payoutStatus

          fundsReleaseBlocked
        }
      }
    `;


    const finalizedAt =
      new Date().toISOString();


    const finalizeResponse =
      await graphqlRequest(
        finalizeOrderMutation,
        {

          input: {

            id:
              orderID,

            earningsAllocationStatus:
              "ALLOCATED",

            earningsAllocatedAt:
              finalizedAt,
          },

        }
      );


    if (
      finalizeResponse.errors
    ) {

      throw new Error(
        `Wallet was updated but order could not be finalized: ${JSON.stringify(
          finalizeResponse.errors
        )}`
      );
    }


    console.log(
      "ORDER FINALIZED:",
      JSON.stringify(
        finalizeResponse?.data?.updateOrder
      )
    );


    /*
    ----------------------------------------------------------
    19. SUCCESS
    ----------------------------------------------------------
    */

    return successResponse({

      message:
        "Courier earnings allocated successfully",

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

      previousLifetimeEarnings:
        currentLifetimeEarnings,

      newLifetimeEarnings:
        newLifetimeEarnings,

      availableBalance:
        Number(
          wallet.availableBalance || 0
        ),

      status:
        "ALLOCATED",

    });


  } catch (error) {

    console.error(
      "ALLOCATE COURIER EARNINGS ERROR:",
      error
    );


    /*
    ----------------------------------------------------------
    20. MARK ALLOCATION FAILED
    ----------------------------------------------------------

    Only change PROCESSING → FAILED.

    This condition is important because we do NOT want to
    overwrite an allocation that another successful process
    may have already completed.
    ----------------------------------------------------------
    */

    try {

      if (orderID) {

        const markFailedMutation = `
          mutation UpdateOrder(
            $input: UpdateOrderInput!
            $condition: ModelOrderConditionInput
          ) {

            updateOrder(
              input: $input
              condition: $condition
            ) {

              id

              earningsAllocationStatus
            }
          }
        `;


        const failedResponse =
          await graphqlRequest(
            markFailedMutation,
            {

              input: {

                id:
                  orderID,

                earningsAllocationStatus:
                  "FAILED",
              },


              condition: {

                earningsAllocationStatus: {
                  eq:
                    "PROCESSING",
                },

              },

            }
          );


        if (
          failedResponse.errors
        ) {

          console.error(
            "FAILED TO MARK ALLOCATION AS FAILED:",
            JSON.stringify(
              failedResponse.errors
            )
          );
        }

      }

    } catch (
      failureUpdateError
    ) {

      console.error(
        "ERROR WHILE MARKING ALLOCATION FAILED:",
        failureUpdateError
      );

    }


    /*
    ----------------------------------------------------------
    21. RETURN ERROR
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
            "Courier earnings allocation failed",

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

  } catch (error) {

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