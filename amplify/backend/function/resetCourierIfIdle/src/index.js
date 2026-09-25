// ================================================================
// AWS SDK v3
// ================================================================
//
// This Lambda uses DynamoDB to:
//
// 1. Detect when an Order changes.
// 2. Check whether the Order has become DELIVERED.
// 3. Identify the Courier who delivered it.
// 4. Check whether that Courier has any other active Orders.
// 5. If the Courier has NO active Orders left, reset the Courier's
//    capacity counters.
//
// IMPORTANT:
// The frontend normally handles the regular capacity decrement
// when an Order is completed.
//
// This Lambda acts as a BACKEND SAFETY NET.
// If the Courier has completely finished all active deliveries,
// this Lambda makes sure the counters are reset to zero.
//
// MAXI couriers are intentionally excluded because their freight
// capacity logic is handled separately.
// ================================================================

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");

const { unmarshall } = require("@aws-sdk/util-dynamodb");

// ================================================================
// CONFIG
// ================================================================
//
// Create the DynamoDB client used to communicate with AWS.
//
// DynamoDBDocumentClient allows us to work with normal JavaScript
// values instead of DynamoDB's low-level attribute format.
// ================================================================

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// These table names come from the Lambda's environment variables.
//
// COURIER_TABLE:
// Contains Courier records.
//
// ORDER_TABLE:
// Contains Order records.
const COURIER_TABLE = process.env.COURIER_TABLE;
const ORDER_TABLE = process.env.ORDER_TABLE;

// ================================================================
// HANDLER
// ================================================================
//
// This is the main Lambda function.
//
// The Lambda is expected to be triggered by a DynamoDB Stream
// whenever an Order record changes.
//
// The basic flow is:
//
// Order changes
//      ↓
// Is it a MODIFY event?
//      ↓
// Did the Order become DELIVERED?
//      ↓
// Find the assigned Courier
//      ↓
// Is the Courier MAXI?
//      ↓
// Find the Courier's active Orders
//      ↓
// If no active Orders remain → reset Courier
// ================================================================

exports.handler = async (event) => {
  console.log("📦 Checking courier completion...");

  // --------------------------------------------------------------
  // Get the first DynamoDB Stream record from this Lambda event.
  //
  // If there is no record, there is nothing for this Lambda to do.
  // --------------------------------------------------------------

  const record = event.Records?.[0];

  if (!record) return;

  // --------------------------------------------------------------
  // Only react to MODIFY events.
  //
  // DynamoDB Streams can contain different event types, including:
  //
  // INSERT
  // MODIFY
  // REMOVE
  //
  // We only care about MODIFY because an existing Order is being
  // changed, particularly when its status changes to DELIVERED.
  // --------------------------------------------------------------

  if (record.eventName !== "MODIFY") return;

  // --------------------------------------------------------------
  // DynamoDB Streams stores the changed data in DynamoDB's
  // attribute-value format.
  //
  // unmarshall() converts that data into a normal JavaScript object.
  //
  // Example:
  //
  // DynamoDB format:
  // {
  //   status: { S: "DELIVERED" }
  // }
  //
  // becomes:
  //
  // {
  //   status: "DELIVERED"
  // }
  // --------------------------------------------------------------

  const newImage = unmarshall(record.dynamodb.NewImage);

  // --------------------------------------------------------------
  // Only continue when the Order is DELIVERED.
  //
  // We do not want this safety-net Lambda running its reset logic
  // for ACCEPTED, PICKED_UP, IN_TRANSIT, etc.
  //
  // The frontend normally releases one unit of Courier capacity
  // when an Order reaches a terminal state.
  //
  // This Lambda checks the Courier after DELIVERED to make sure
  // that the Courier is completely finished with all active Orders.
  // --------------------------------------------------------------

  if (newImage.status !== "DELIVERED") return;

  // --------------------------------------------------------------
  // Get the Courier assigned to this Order.
  //
  // The assignedCourierId comes from the delivered Order.
  //
  // If there is no assigned Courier, there is nothing to reset.
  // --------------------------------------------------------------

  const courierId = newImage.assignedCourierId;

  if (!courierId) return;

  console.log("Checking courier:", courierId);

  // ==============================================================
  // GET COURIER
  // ==============================================================
  //
  // Retrieve the Courier record so we can check the Courier's
  // transportation type.
  //
  // This is especially important because MAXI couriers are handled
  // by separate freight/capacity logic.
  // ==============================================================

  const courier = await getCourier(courierId);

  // --------------------------------------------------------------
  // If the Courier record cannot be found, stop.
  // --------------------------------------------------------------

  if (!courier) {
    console.log("⚠️ Courier not found:", courierId);
    return;
  }

  // --------------------------------------------------------------
  // MAXI SAFETY EXCLUSION
  //
  // MAXI couriers are intentionally NOT reset by this Lambda.
  //
  // Their freight/capacity logic is handled separately.
  //
  // Therefore:
  //
  // MICRO / MOTO → continue with this safety-net logic
  // MAXI         → stop here
  // --------------------------------------------------------------

  if (courier.transportationType === "MAXI") {
    console.log("⛔ Skipping reset for MAXI courier:", courierId);
    return;
  }

  // ==============================================================
  // CHECK FOR ACTIVE ORDERS
  // ==============================================================
  //
  // Now we find out whether this Courier still has any active
  // Orders assigned to them.
  //
  // Active Orders are defined in getCourierActiveOrders() below.
  //
  // The important question is:
  //
  // "After this Order was delivered, does this Courier still
  // have any other Orders that are currently active?"
  // ==============================================================

  const activeOrders = await getCourierActiveOrders(courierId);

  // --------------------------------------------------------------
  // NO ACTIVE ORDERS
  //
  // If there are zero active Orders, the Courier has finished
  // their entire current delivery workload.
  //
  // The Lambda now acts as a safety net and resets the Courier's
  // capacity counters.
  //
  // This does NOT replace the frontend's normal decrement logic.
  // It is simply the backend's final cleanup/reset.
  // --------------------------------------------------------------

  if (activeOrders.length === 0) {
    console.log("✅ Courier finished all deliveries. Resetting:", courierId);

    await resetCourier(courierId);
  } else {
    // ------------------------------------------------------------
    // ACTIVE ORDERS STILL EXIST
    //
    // This means the Courier still has other deliveries to work on.
    //
    // Therefore we DO NOT reset their counters yet.
    //
    // Example:
    //
    // Courier has 3 Batch Orders.
    //
    // Order A → DELIVERED
    // Order B → IN_TRANSIT
    // Order C → ACCEPTED
    //
    // There are still 2 active Orders, so we leave the Courier
    // capacity as it is.
    // ------------------------------------------------------------

    console.log("⏳ Courier still has active orders:", activeOrders.length);
  }
};

// ================================================================
// GET COURIER
// ================================================================
//
// Retrieves one Courier record from the Courier table using the
// Courier's ID.
//
// This is used by the handler to determine the Courier's
// transportationType.
//
// Example:
//
// courierId → "12345"
//       ↓
// Courier table
//       ↓
// Courier record
// ================================================================

async function getCourier(courierId) {
  const res = await docClient.send(
    new GetCommand({
      TableName: COURIER_TABLE,

      // The Courier table uses "id" as the primary key.
      Key: { id: courierId },
    }),
  );

  // Return the Courier record.
  //
  // If no Courier is found, this will be undefined.
  return res.Item;
}

// ================================================================
// GET ACTIVE ORDERS
// ================================================================
//
// Finds all active Orders currently assigned to a Courier.
//
// It uses the "byAssignedCourier" GSI (Global Secondary Index)
// so Orders can be searched by assignedCourierId.
//
// IMPORTANT:
// Not every Order assigned to the Courier is considered active.
//
// Only these statuses are considered active here:
//
// ACCEPTED
// PICKED_UP
// IN_TRANSIT
//
// DELIVERED, CANCELLED, DISPUTED, etc. are not included.
//
// The purpose is to determine whether the Courier still has
// unfinished delivery work.
// ================================================================

async function getCourierActiveOrders(courierId) {
  // This array will contain all active Orders found.
  let items = [];

  // DynamoDB may return Query results in multiple pages.
  //
  // lastKey is used to continue the Query when more results exist.
  let lastKey;

  // --------------------------------------------------------------
  // Keep querying until DynamoDB tells us there are no more pages.
  // --------------------------------------------------------------

  do {
    const res = await docClient.send(
      new QueryCommand({
        // Search the Order table.
        TableName: ORDER_TABLE,

        // Use the GSI that allows us to search by assignedCourierId.
        IndexName: "byAssignedCourier",

        // Only retrieve Orders assigned to this Courier.
        KeyConditionExpression: "assignedCourierId = :c",

        // From those Orders, only keep the active statuses.
        //
        // ACCEPTED:
        // Courier has accepted the Order.
        //
        // PICKED_UP:
        // Courier has collected the package.
        //
        // IN_TRANSIT:
        // Courier is currently travelling with the package.
        //
        FilterExpression: "#s = :accepted OR #s = :picked OR #s = :transit",

        // Values used by the expressions above.
        ExpressionAttributeValues: {
          ":c": courierId,
          ":accepted": "ACCEPTED",
          ":picked": "PICKED_UP",
          ":transit": "IN_TRANSIT",
        },

        // "status" is represented as "#s" in the expression.
        //
        // This avoids potential conflicts with DynamoDB reserved
        // words and makes the expression easier to use.
        ExpressionAttributeNames: {
          "#s": "status",
        },

        // If DynamoDB returned another page of results,
        // continue from the last evaluated key.
        ExclusiveStartKey: lastKey,
      }),
    );

    // Add the Orders returned by this Query to our complete list.
    items.push(...(res.Items || []));

    // If another page exists, DynamoDB provides LastEvaluatedKey.
    //
    // If no more pages exist, this becomes undefined.
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  // Return every active Order found for this Courier.
  return items;
}

// ================================================================
// RESET COURIER
// ================================================================
//
// This is the actual SAFETY-NET RESET.
//
// It is only called when:
//   1. An Order has become DELIVERED,
//   2. The Courier is not MAXI, and
//   3. The Courier has ZERO active Orders remaining.
//
// The frontend normally decrements capacity one Order at a time.
//
// This function provides a final backend reset in case the
// counters are out of sync for any reason.
//
// The reset sets:
//
// currentBatchCount    → 0
// currentExpressCount  → 0
// lastBatchAssignedAt  → null
// ================================================================

async function resetCourier(courierId) {
  await docClient.send(
    new UpdateCommand({
      // Update the Courier record.
      TableName: COURIER_TABLE,

      // Identify which Courier should be reset.
      Key: { id: courierId },

      // Force the capacity values back to their empty state.
      UpdateExpression: `
        SET currentBatchCount = :zero,
            currentExpressCount = :zero,
            lastBatchAssignedAt = :null
      `,

      // Values used by the UpdateExpression.
      ExpressionAttributeValues: {
        ":zero": 0,
        ":null": null,
      },
    }),
  );

  // Confirm in CloudWatch that the safety-net reset completed.
  console.log("🔄 Courier reset complete:", courierId);
}
