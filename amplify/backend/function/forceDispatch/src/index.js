const AWS = require("aws-sdk");
const docClient = new AWS.DynamoDB.DocumentClient();

const COURIER_TABLE = "Courier-n4tb6ywvhnf3zesv5ibhpitqiq-staging";
const ORDER_TABLE = "Order-n4tb6ywvhnf3zesv5ibhpitqiq-staging";

// I will have to change this scan because it will be expensive. I will come back to it later
// docClient.scan({ TableName: COURIER_TABLE })
// docClient.scan({ TableName: ORDER_TABLE })

exports.handler = async () => {
  console.log("Running force dispatch...");

  const couriersRes = await docClient
    .scan({
      TableName: COURIER_TABLE,
    })
    .promise();

  const couriers = couriersRes.Items;

  for (let courier of couriers) {
    if (!courier.isOnline) continue;

    await checkForceDispatch(courier);
  }
};

/* ================= FORCE LOGIC ================= */

async function checkForceDispatch(courier) {
  // 🚫 Skip MAXI completely
  if (courier.transportationType === "MAXI") return;

  const MAX_CAPACITY = 10;

  // ✅ 3 HOURS
  const BATCH_TIMEOUT = 3 * 60 * 60 * 1000;

  const total =
    (courier.currentBatchCount || 0) + (courier.currentExpressCount || 0);

  const lastBatchTime = new Date(courier.lastBatchAssignedAt || 0);
  const now = new Date();

  const noNewOrders = now - lastBatchTime > BATCH_TIMEOUT;

  if (total >= MAX_CAPACITY || noNewOrders) {
    console.log("Force dispatch triggered:", courier.id);

    await triggerDeliveryStart(courier.id);
  }
}

/* ================= START DELIVERY ================= */

async function triggerDeliveryStart(courierId) {
  const ordersRes = await docClient
    .scan({
      TableName: ORDER_TABLE,
      FilterExpression:
        "assignedCourierId = :c AND (#status = :picked OR #status = :accepted)",
      ExpressionAttributeValues: {
        ":c": courierId,
        ":picked": "PICKED_UP",
        ":accepted": "ACCEPTED",
      },
      ExpressionAttributeNames: {
        "#status": "status",
      },
    })
    .promise();

  const orders = ordersRes.Items;

  // ✅ Safety: do nothing if no orders
  if (!orders || orders.length === 0) {
    console.log("No orders to dispatch for courier:", courierId);
    return;
  }

  // ✅ Move orders to IN_TRANSIT
  for (let order of orders) {
    await docClient
      .update({
        TableName: ORDER_TABLE,
        Key: { id: order.id },
        UpdateExpression: "SET #status = :inTransit",
        ExpressionAttributeValues: {
          ":inTransit": "IN_TRANSIT",
        },
        ExpressionAttributeNames: {
          "#status": "status",
        },
      })
      .promise();
  }

  // ✅ Reset courier capacity
  await docClient
    .update({
      TableName: COURIER_TABLE,
      Key: { id: courierId },
      UpdateExpression: `
      SET currentBatchCount = :zero,
          currentExpressCount = :zero,
          lastBatchAssignedAt = :null
    `,
      ExpressionAttributeValues: {
        ":zero": 0,
        ":null": null,
      },
    })
    .promise();

  console.log("Dispatch complete & courier reset:", courierId);
}
