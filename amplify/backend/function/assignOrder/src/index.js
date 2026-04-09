const AWS = require("aws-sdk");
const docClient = new AWS.DynamoDB.DocumentClient();

const COURIER_TABLE = "Courier-n4tb6ywvhnf3zesv5ibhpitqiq-staging";
const ORDER_TABLE = "Order-n4tb6ywvhnf3zesv5ibhpitqiq-staging";

// I will have to change this scan because it will be expensive. I will come back to it later
// docClient.scan({ TableName: COURIER_TABLE })
// docClient.scan({ TableName: ORDER_TABLE })

exports.handler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName !== "INSERT") continue;

    const order = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);

    if (order.status !== "READY_FOR_PICKUP") continue;

    await assignNextCourier(order);
  }
};

async function assignNextCourier(order) {
  const couriers = await getCouriers();

  const sorted = couriers.sort(
    (a, b) =>
      getDistance(a.lat, a.lng, order.originLat, order.originLng) -
      getDistance(b.lat, b.lng, order.originLat, order.originLng),
  );

  for (let courier of sorted) {
    if (!canAccept(courier, order)) continue;

    const success = await assign(order, courier.id);

    if (success) return;
  }
}

async function getCouriers() {
  const res = await docClient
    .scan({
      TableName: COURIER_TABLE,
    })
    .promise();

  return res.Items.filter((c) => c.isOnline && c.isApproved);
}

function canAccept(courier, order) {
  const total =
    (courier.currentBatchCount || 0) + (courier.currentExpressCount || 0);

  if (total >= 10) return false;

  if (order.transportationType.includes("EXPRESS")) {
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
