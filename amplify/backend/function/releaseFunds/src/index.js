// Right now, your Lambda is just a function sitting idle. It only runs when something calls it.
// we have options:
// Option A (RECOMMENDED): Trigger from your backend when delivery completes (status = "DELIVERED")
// Immediately call the Lambda.
// Example (inside your app / backend):
// await fetch(YOUR_LAMBDA_URL, {
//   method: "POST",
//   body: JSON.stringify({
//     orderID: order.id,
//   }),
// });
// Option B: Trigger from AppSync (advanced)

// BEST PRACTICE (what you should do)
// When courier taps “DELIVERED”:
// Update order → status = DELIVERED
// Call ReleaseFunds Lambda immediately

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

    // -----------------------------
    // 1. GET ORDER
    // -----------------------------
    const getOrderQuery = `
      query GetOrder($id: ID!) {
        getOrder(id: $id) {
          id
          courierEarnings
          assignedCourierId
          fundsStatus
          payoutStatus
        }
      }
    `;

    const orderRes = await graphqlRequest(getOrderQuery, { id: orderID });
    const order = orderRes.data.getOrder;

    if (!order) throw new Error("Order not found");

    // ✅ HARD PROTECTION (idempotency)
    if (order.fundsStatus === "RELEASED") {
      console.log("Already released");
      return success("Funds already released");
    }

    if (order.payoutStatus === "PAID") {
      console.log("Already paid out");
      return success("Already paid out");
    }

    const courierID = order.assignedCourierId;
    const amount = order.courierEarnings;

    // -----------------------------
    // 2. GET WALLET
    // -----------------------------
    const walletQuery = `
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

    const walletRes = await graphqlRequest(walletQuery, {
      ownerID: courierID,
    });

    const wallet = walletRes.data.listWallets.items[0];

    if (!wallet) throw new Error("Wallet not found");

    if ((wallet.pendingBalance || 0) < amount) {
      throw new Error("Insufficient pending balance");
    }

    // -----------------------------
    // 3. MOVE FUNDS
    // -----------------------------
    const newPending = wallet.pendingBalance - amount;
    const newBalance = (wallet.balance || 0) + amount;

    await graphqlRequest(
      `
      mutation UpdateWallet($input: UpdateWalletInput!) {
        updateWallet(input: $input) { id }
      }
    `,
      {
        input: {
          id: wallet.id,
          balance: newBalance,
          pendingBalance: newPending,
        },
      },
    );

    // -----------------------------
    // 4. CREATE TRANSACTION (FINAL CREDIT)
    // -----------------------------
    await graphqlRequest(
      `
      mutation CreateTransaction($input: CreateTransactionInput!) {
        createTransaction(input: $input) { id }
      }
    `,
      {
        input: {
          walletID: wallet.id,
          type: "CREDIT",
          amount,
          description: "Funds released to available balance",
          orderID: orderID,
          status: "COMPLETED",
        },
      },
    );

    // -----------------------------
    // 5. UPDATE ORDER
    // -----------------------------
    await graphqlRequest(
      `
      mutation UpdateOrder($input: UpdateOrderInput!) {
        updateOrder(input: $input) {
          id
        }
      }
    `,
      {
        input: {
          id: orderID,
          fundsStatus: "RELEASED",
          payoutStatus: "NOT_PAID",
        },
      },
    );

    return success("Funds released successfully");
  } catch (error) {
    console.error(error);
    return fail(error.message);
  }
};

// -----------------------------
// HELPERS
// -----------------------------
async function graphqlRequest(query, variables) {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify({ query, variables }),
  });

  return res.json();
}

function success(message) {
  return {
    statusCode: 200,
    body: JSON.stringify(message),
  };
}

function fail(message) {
  return {
    statusCode: 500,
    body: JSON.stringify(message),
  };
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
