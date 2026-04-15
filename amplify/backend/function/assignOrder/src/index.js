// ================= AWS SDK v3 =================
const { isTransportCompatible } = require("./transportLambda");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  TransactWriteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { unmarshall } = require("@aws-sdk/util-dynamodb");

// ================= CONFIG =================
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const COURIER_TABLE = "Courier-n4tb6ywvhnf3zesv5ibhpitqiq-staging";
const ORDER_TABLE = "Order-n4tb6ywvhnf3zesv5ibhpitqiq-staging";

// ✅ Radius expansion steps (IMPORTANT)
const RADIUS_STEPS = [5, 10, 15]; // km

// ================= HANDLER =================
exports.handler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName !== "INSERT") continue;

    const order = unmarshall(record.dynamodb.NewImage);

    if (!order) continue;

    // ✅ Only assign READY orders
    if (order.status !== "READY_FOR_PICKUP") continue;

    // ✅ Skip MAXI / bidding
    if (order.transportationType === "MAXI" || order.status === "BIDDING") {
      console.log("🚫 Skipping MAXI/bidding order:", order.id);
      continue;
    }

    console.log("📦 Assigning order:", order.id);

    await assignNextCourier(order);
  }
};

// ================= ASSIGN LOGIC =================
async function assignNextCourier(order) {
  if (order.transportationType === "MAXI" || order.status === "BIDDING") {
    console.log("🚫 Blocked MAXI inside assign:", order.id);
    return;
  }

  const couriers = await getAvailableCouriers();

  if (!couriers.length) {
    console.log("⚠️ No couriers available");
    return;
  }

  // ✅ CORRECT radius loop (what you were trying to do)
  for (let radius of RADIUS_STEPS) {
    const filtered = couriers.filter((c) => {
      if (!c.lat || !c.lng) return false;

      const distance = getDistance(
        c.lat,
        c.lng,
        order.originLat,
        order.originLng,
      );

      return distance <= radius;
    });

    if (!filtered.length) continue;

    console.log(`📍 Trying radius: ${radius}km (${filtered.length} couriers)`);

    const sorted = filtered.sort(
      (a, b) =>
        getDistance(a.lat, a.lng, order.originLat, order.originLng) -
        getDistance(b.lat, b.lng, order.originLat, order.originLng),
    );

    for (let courier of sorted) {
      if (!isTransportCompatible(order, courier)) continue;
      if (!canAccept(courier, order)) continue;

      const success = await assign(order, courier);
      if (success) return;
    }
  }

  console.log("❌ No suitable courier found within radius:", order.id);
}

// ================= GET COURIERS =================
async function getAvailableCouriers() {
  let items = [];
  let lastKey;

  do {
    const res = await docClient.send(
      new QueryCommand({
        TableName: COURIER_TABLE,
        IndexName: "byStatus",
        KeyConditionExpression: "statusKey = :s",
        ExpressionAttributeValues: {
          ":s": "ONLINE#APPROVED",
        },
        ExclusiveStartKey: lastKey,
      }),
    );

    items.push(...(res.Items || []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  return items;
}

// ================= ACCEPT RULE =================
function canAccept(courier, order) {
  const batch = courier.currentBatchCount || 0;
  const express = courier.currentExpressCount || 0;

  const total = batch + express;

  // ❌ Max capacity
  if (total >= 10) return false;

  // ❌ EXPRESS limit
  if (order.transportationType?.includes("EXPRESS")) {
    if (express >= 1) return false;
  }

  return true;
}

// ================= ASSIGN =================
async function assign(order, courier) {
  const expires = new Date(Date.now() + 25000).toISOString();
  const now = new Date().toISOString();

  const isExpress = order.transportationType?.includes("EXPRESS");

  try {
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          // 1️⃣ Update Order
          {
            Update: {
              TableName: ORDER_TABLE,
              Key: { id: order.id },
              UpdateExpression: `
                SET assignedCourierId = :c,
                    assignmentStatus = :s,
                    assignmentExpiresAt = :e,
                    lastAssignedAt = :now
              `,
              ConditionExpression:
                "attribute_not_exists(assignedCourierId) OR assignmentStatus = :expired",
              ExpressionAttributeValues: {
                ":c": courier.id,
                ":s": "PENDING",
                ":e": expires,
                ":now": now,
                ":expired": "EXPIRED",
              },
            },
          },

          // 2️⃣ Update Courier capacity
          {
            Update: {
              TableName: COURIER_TABLE,
              Key: { id: courier.id },
              UpdateExpression: isExpress
                ? "SET currentExpressCount = if_not_exists(currentExpressCount, :z) + :inc"
                : "SET currentBatchCount = if_not_exists(currentBatchCount, :z) + :inc",
              ExpressionAttributeValues: {
                ":inc": 1,
                ":z": 0,
              },
            },
          },
        ],
      }),
    );

    console.log(`✅ Assigned order ${order.id} → courier ${courier.id}`);
    return true;
  } catch (err) {
    if (err.name === "TransactionCanceledException") {
      console.log(`⚠️ Race condition (skipped): ${order.id}`);
      return false;
    }

    console.error("❌ Assignment error:", err);
    throw err;
  }
}

// ================= DISTANCE =================
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
