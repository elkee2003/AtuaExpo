const AWS = require("aws-sdk");
const docClient = new AWS.DynamoDB.DocumentClient();

const COURIER_TABLE = "Courier-n4tb6ywvhnf3zesv5ibhpitqiq-staging";
const ORDER_TABLE = "Order-n4tb6ywvhnf3zesv5ibhpitqiq-staging";

// I will have to change this scan because it will be expensive. I will come back to it later
// docClient.scan({ TableName: COURIER_TABLE })
// docClient.scan({ TableName: ORDER_TABLE })

exports.handler = async () => {
  const now = new Date().toISOString();

  const ordersRes = await docClient
    .scan({
      TableName: ORDER_TABLE,
    })
    .promise();

  const orders = ordersRes.Items;

  for (let order of orders) {
    const isExpired =
      order.assignmentStatus === "PENDING" &&
      order.assignmentExpiresAt &&
      order.assignmentExpiresAt < now;

    if (!isExpired) continue;

    console.log("Reassigning order:", order.id);

    // 1️⃣ Clone rejected list safely
    let rejected = [...(order.rejectedCourierIds || [])];

    // 2️⃣ Add previous courier (avoid duplicates)
    if (
      order.assignedCourierId &&
      !rejected.includes(order.assignedCourierId)
    ) {
      rejected.push(order.assignedCourierId);
    }

    // 3️⃣ Update order → expire + increment attempts
    await docClient
      .update({
        TableName: ORDER_TABLE,
        Key: { id: order.id },
        UpdateExpression: `
          SET assignmentStatus = :expired,
              assignedCourierId = :null,
              rejectedCourierIds = :r,
              assignmentAttempts = if_not_exists(assignmentAttempts, :zero) + :inc
        `,
        ExpressionAttributeValues: {
          ":expired": "EXPIRED",
          ":null": null,
          ":r": rejected,
          ":zero": 0,
          ":inc": 1,
        },
      })
      .promise();

    // 4️⃣ Try assign next courier
    await assignNextCourier({
      ...order,
      rejectedCourierIds: rejected,
    });
  }
};

/* ================= ASSIGN LOGIC ================= */

async function assignNextCourier(order) {
  const couriers = await getCouriers();

  let rejected = [...(order.rejectedCourierIds || [])];

  // 🔥 RESET if all couriers rejected
  if (rejected.length >= couriers.length) {
    console.log("Resetting rejected list for order:", order.id);

    rejected = [];

    // ✅ Persist reset to DB
    await docClient
      .update({
        TableName: ORDER_TABLE,
        Key: { id: order.id },
        UpdateExpression: "SET rejectedCourierIds = :r",
        ExpressionAttributeValues: {
          ":r": rejected,
        },
      })
      .promise();
  }

  // Sort by distance (nearest first)
  const sorted = couriers.sort(
    (a, b) =>
      getDistance(a.lat, a.lng, order.originLat, order.originLng) -
      getDistance(b.lat, b.lng, order.originLat, order.originLng),
  );

  for (let courier of sorted) {
    if (!canAccept(courier, order, rejected)) continue;

    const success = await assign(order, courier.id);

    if (success) return; // ✅ only stop if assignment worked
  }

  console.log("No available courier for order:", order.id);
}

/* ================= HELPERS ================= */

async function getCouriers() {
  const res = await docClient
    .scan({
      TableName: COURIER_TABLE,
    })
    .promise();

  return res.Items.filter((c) => c.isOnline && c.isApproved);
}

function canAccept(courier, order, rejected) {
  // ❌ Already rejected in this cycle
  if (rejected.includes(courier.id)) return false;

  // ❌ Max capacity reached
  const total =
    (courier.currentBatchCount || 0) + (courier.currentExpressCount || 0);

  if (total >= 10) return false;

  // ❌ EXPRESS limit
  if (order.transportationType?.includes("EXPRESS")) {
    if ((courier.currentExpressCount || 0) >= 1) return false;
  }

  return true;
}

async function assign(order, courierId) {
  const expires = new Date(Date.now() + 25000).toISOString();

  try {
    await docClient
      .update({
        TableName: ORDER_TABLE,
        Key: { id: order.id },
        UpdateExpression: `
          SET assignedCourierId = :c,
              assignmentStatus = :s,
              assignmentExpiresAt = :e
        `,
        ConditionExpression:
          "assignedCourierId = :null OR attribute_not_exists(assignedCourierId)",
        ExpressionAttributeValues: {
          ":c": courierId,
          ":s": "PENDING",
          ":e": expires,
          ":null": null,
        },
      })
      .promise();

    console.log(`Assigned order ${order.id} → courier ${courierId}`);

    // ✅ NOW SAFE
    if (order.transportationType?.includes("EXPRESS")) {
      await docClient
        .update({
          TableName: COURIER_TABLE,
          Key: { id: courierId },
          UpdateExpression:
            "SET currentExpressCount = if_not_exists(currentExpressCount, :zero) + :inc",
          ExpressionAttributeValues: {
            ":inc": 1,
            ":zero": 0,
          },
        })
        .promise();
    } else {
      await docClient
        .update({
          TableName: COURIER_TABLE,
          Key: { id: courierId },
          UpdateExpression:
            "SET currentBatchCount = if_not_exists(currentBatchCount, :zero) + :inc",
          ExpressionAttributeValues: {
            ":inc": 1,
            ":zero": 0,
          },
        })
        .promise();
    }

    return true;
  } catch (err) {
    if (err.code === "ConditionalCheckFailedException") {
      console.log(`Assignment skipped (already taken): ${order.id}`);
      return false;
    } else {
      throw err;
    }
  }
}

/* ================= DISTANCE ================= */

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
