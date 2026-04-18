// I will choose 5 minutes now because of testing, make sure to edit the rate the function should run (for processpayouts lambda)

// I can create Admin button → call Lambda manually

const fetch = require("node-fetch");

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;
const API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

exports.handler = async () => {
  try {
    console.log("Running payout job...");

    // -----------------------------
    // 1. GET ORDERS READY FOR PAYOUT
    // -----------------------------
    const query = `
      query ListOrders {
        listOrders(filter: {
          payoutStatus: { eq: NOT_PAID },
          fundsStatus: { eq: RELEASED }
        }) {
          items {
            id
            courierEarnings
            assignedCourierId
          }
        }
      }
    `;

    const res = await graphqlRequest(query);
    const orders = res.data.listOrders.items;

    if (!orders.length) {
      return success("No payouts to process");
    }

    // -----------------------------
    // 2. GROUP BY COURIER
    // -----------------------------
    const grouped = {};

    for (const order of orders) {
      const courierID = order.assignedCourierId;

      if (!grouped[courierID]) {
        grouped[courierID] = {
          total: 0,
          orders: [],
        };
      }

      grouped[courierID].total += order.courierEarnings;
      grouped[courierID].orders.push(order.id);
    }

    // -----------------------------
    // 3. PROCESS EACH COURIER
    // -----------------------------
    for (const courierID of Object.keys(grouped)) {
      const { total, orders: orderIDs } = grouped[courierID];

      console.log(`Processing courier ${courierID} → ${total}`);

      // -----------------------------
      // GET WALLET
      // -----------------------------
      const walletRes = await graphqlRequest(
        `
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
            }
          }
        }
      `,
        { ownerID: courierID },
      );

      const wallet = walletRes.data.listWallets.items[0];

      if (!wallet) {
        console.log("Wallet not found, skipping...");
        continue;
      }

      if ((wallet.balance || 0) < total) {
        console.log("Insufficient balance, skipping...");
        continue;
      }

      // -----------------------------
      // 🔥 (FUTURE) PAYSTACK TRANSFER
      // -----------------------------
      // await sendToPaystack(courierID, total);

      // -----------------------------
      // 4. DEBIT WALLET
      // -----------------------------
      const newBalance = wallet.balance - total;

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
          },
        },
      );

      // -----------------------------
      // 5. CREATE DEBIT TRANSACTION
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
            type: "DEBIT",
            amount: total,
            description: "Payout to bank",
            status: "COMPLETED",
          },
        },
      );

      // -----------------------------
      // 6. MARK ORDERS AS PAID
      // -----------------------------
      for (const orderID of orderIDs) {
        await graphqlRequest(
          `
          mutation UpdateOrder($input: UpdateOrderInput!) {
            updateOrder(input: $input) { id }
          }
        `,
          {
            input: {
              id: orderID,
              payoutStatus: "PAID",
            },
          },
        );
      }
    }

    return success("Payout completed");
  } catch (err) {
    console.error(err);
    return fail(err.message);
  }
};

// -----------------------------
// HELPERS
// -----------------------------
async function graphqlRequest(query, variables = {}) {
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
