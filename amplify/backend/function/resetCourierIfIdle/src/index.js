// ================= AWS SDK v3 =================
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");

const { unmarshall } = require("@aws-sdk/util-dynamodb");

// ================= CONFIG =================
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const COURIER_TABLE = process.env.COURIER_TABLE;
const ORDER_TABLE = process.env.ORDER_TABLE;

// ================= HANDLER =================
exports.handler = async (event) => {
  console.log("📦 Checking courier completion...");

  const record = event.Records?.[0];
  if (!record) return;

  // Only react to MODIFY (status change)
  if (record.eventName !== "MODIFY") return;

  const newImage = unmarshall(record.dynamodb.NewImage);

  // Only when order is delivered
  if (newImage.status !== "DELIVERED") return;

  const courierId = newImage.assignedCourierId;
  if (!courierId) return;

  console.log("Checking courier:", courierId);

  // 🚫 Get courier first (to check type)
  const courier = await getCourier(courierId);

  if (!courier) {
    console.log("⚠️ Courier not found:", courierId);
    return;
  }

  // 🚫 Skip MAXI (freight logic is separate)
  if (courier.transportationType === "MAXI") {
    console.log("⛔ Skipping reset for MAXI courier:", courierId);
    return;
  }

  const activeOrders = await getCourierActiveOrders(courierId);

  if (activeOrders.length === 0) {
    console.log("✅ Courier finished all deliveries. Resetting:", courierId);

    await resetCourier(courierId);
  } else {
    console.log("⏳ Courier still has active orders:", activeOrders.length);
  }
};

// ================= GET COURIER =================
async function getCourier(courierId) {
  const res = await docClient.send(
    new GetCommand({
      TableName: COURIER_TABLE,
      Key: { id: courierId },
    }),
  );

  return res.Item;
}

// ================= GET ACTIVE ORDERS (GSI) =================
async function getCourierActiveOrders(courierId) {
  let items = [];
  let lastKey;

  do {
    const res = await docClient.send(
      new QueryCommand({
        TableName: ORDER_TABLE,
        IndexName: "byAssignedCourier",
        KeyConditionExpression: "assignedCourierId = :c",
        FilterExpression: "#s = :accepted OR #s = :picked OR #s = :transit",
        ExpressionAttributeValues: {
          ":c": courierId,
          ":accepted": "ACCEPTED",
          ":picked": "PICKED_UP",
          ":transit": "IN_TRANSIT",
        },
        ExpressionAttributeNames: {
          "#s": "status",
        },
        ExclusiveStartKey: lastKey,
      }),
    );

    items.push(...(res.Items || []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  return items;
}

// ================= RESET COURIER =================
async function resetCourier(courierId) {
  await docClient.send(
    new UpdateCommand({
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
    }),
  );

  console.log("🔄 Courier reset complete:", courierId);
}
