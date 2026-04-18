// Note that I have to edit later to put proper variable name and variable value, which is meant to come from Paystack. They recommend webhook. For now I am using dummy data
const fetch = require("node-fetch");

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;
const API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

exports.handler = async (event) => {
  try {
    console.log("EVENT:", JSON.stringify(event));

    const { orderID } = event;

    if (!orderID) {
      throw new Error("orderID is required");
    }

    // 1. Get Order
    const getOrderQuery = `
      query GetOrder($id: ID!) {
        getOrder(id: $id) {
          id
          courierEarnings
          assignedCourierId
          paymentStatus
        }
      }
    `;

    const orderRes = await graphqlRequest(getOrderQuery, { id: orderID });
    const order = orderRes.data.getOrder;

    if (!order) {
      throw new Error("Order not found");
    }

    // ✅ Prevent double processing (VERY IMPORTANT)
    if (order.paymentStatus === "PAID") {
      console.log("Payment already processed for this order");
      return {
        statusCode: 200,
        body: JSON.stringify("Already processed"),
      };
    }

    const courierID = order.assignedCourierId;
    const earnings = order.courierEarnings;

    if (!courierID) {
      throw new Error("No courier assigned to this order");
    }

    // 2. Get Wallet (WITH ownerType filter)
    const listWalletsQuery = `
      query ListWallets($ownerID: ID!) {
        listWallets(
          filter: { 
            ownerID: { eq: $ownerID },
            ownerType: { eq: "COURIER" }
          }
        ) {
          items {
            id
            balance
            pendingBalance
          }
        }
      }
    `;

    const walletRes = await graphqlRequest(listWalletsQuery, {
      ownerID: courierID,
    });

    const wallet = walletRes.data.listWallets.items[0];

    if (!wallet) {
      throw new Error("Wallet not found for courier");
    }

    // 3. Update Wallet → ADD TO PENDING (ESCROW)
    const updateWalletMutation = `
      mutation UpdateWallet($input: UpdateWalletInput!) {
        updateWallet(input: $input) {
          id
          pendingBalance
        }
      }
    `;

    await graphqlRequest(updateWalletMutation, {
      input: {
        id: wallet.id,
        pendingBalance: (wallet.pendingBalance || 0) + earnings,
      },
    });

    // 4. Create Transaction (PENDING)
    const createTransactionMutation = `
      mutation CreateTransaction($input: CreateTransactionInput!) {
        createTransaction(input: $input) {
          id
        }
      }
    `;

    await graphqlRequest(createTransactionMutation, {
      input: {
        walletID: wallet.id,
        type: "CREDIT",
        amount: earnings,
        description: "Order payment (escrow)",
        orderID: orderID,
        status: "PENDING",
      },
    });

    // 5. Update Order → mark as paid + held
    const updateOrderMutation = `
      mutation UpdateOrder($input: UpdateOrderInput!) {
        updateOrder(input: $input) {
          id
          paymentStatus
          fundsStatus
        }
      }
    `;

    await graphqlRequest(updateOrderMutation, {
      input: {
        id: orderID,
        paymentStatus: "PAID",
        fundsStatus: "HELD",
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify("Payment processed successfully"),
    };
  } catch (error) {
    console.error("ERROR:", error);

    return {
      statusCode: 500,
      body: JSON.stringify(error.message),
    };
  }
};

// Helper function
async function graphqlRequest(query, variables) {
  const res = await fetch(GRAPHQL_ENDPOINT, {
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

  return res.json();
}

// Combination of all the lambda functions (processPaymentAndWallet, release funds, processPayout)
// Step 1: User pays
// Payment created
// Atua holds ₦10,000
// Step 2: Payment Lambda
// courier.pendingBalance += ₦8,000
// Order → HELD
// Step 3: Delivery completed
// pending → balance
// courier.balance = ₦8,000
// Order → RELEASED
// Step 4: Payout (admin/scheduled)
// courier.balance → ₦0
// Bank transfer ₦8,000
// Order → PAID
// Platform revenue:
// ₦2,000 = your profit

// Still missing:
//  Paystack transfer integration
//  Prevent double payout (PROCESSING state)
//  Webhook verification (VERY important)
//  Transaction reference tracking
