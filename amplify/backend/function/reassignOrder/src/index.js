// ============================================================
// ATUA REASSIGN ORDER LAMBDA
// ============================================================
//
// PURPOSE
// ============================================================
//
// Handles expired courier offers.
//
// FLOW:
//
// ORDER
//   ↓
// Courier A OFFERED
//   ↓
// 25 seconds
//   ↓
// Courier A does not accept
//   ↓
// OFFER EXPIRES
//   ↓
// Courier A added to attempted list
//   ↓
// Courier B searched
//   ↓
// Courier B OFFERED
//   ↓
// 25 seconds
//   ↓
// ...continues...
//
// When the current radius is exhausted:
//
// MICRO:
//   5km → 8km
//              ↓
//        NEW DISPATCH ROUND
//              ↓
//   5km → 8km again
//
// MOTO:
//   5km → 10km → 15km → 20km → 25km
//                                ↓
//                         NEW DISPATCH ROUND
//                                ↓
//   5km → 10km → 15km → 20km → 25km
//
// ============================================================
//
// IMPORTANT
// ============================================================
//
// This Lambda ONLY modifies assignment / dispatch fields.
//
// It NEVER reconstructs the Order.
//
// It NEVER writes:
//
//   userID
//   paymentStatus
//   paymentID
//   paymentReference
//   totalPrice
//   operationalFare
//   courierEarnings
//   payoutStatus
//   fundsStatus
//   fundsReleaseBlocked
//   pickup information
//   destination information
//   recipient information
//   timestamps owned elsewhere
//   etc.
//
// This is intentional.
//
// DynamoDB SET updates preserve every attribute that is not
// included in the UpdateExpression.
//
// ============================================================
//
// MAXI
// ============================================================
//
// MAXI is NOT handled here.
//
// MAXI uses the separate marketplace / bidding flow.
//
// ============================================================

// ============================================================
// AWS SDK
// ============================================================

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const {
  DynamoDBDocumentClient,
  QueryCommand,
  TransactWriteCommand,
} = require("@aws-sdk/lib-dynamodb");

// ============================================================
// CLIENT
// ============================================================

const client = new DynamoDBClient({});

const docClient = DynamoDBDocumentClient.from(client);

// ============================================================
// TABLES
// ============================================================

const COURIER_TABLE =
  process.env.COURIER_TABLE || "Courier-n4tb6ywvhnf3zesv5ibhpitqiq-staging";

const ORDER_TABLE =
  process.env.ORDER_TABLE || "Order-n4tb6ywvhnf3zesv5ibhpitqiq-staging";

// ============================================================
// DISPATCH CONFIGURATION
// ============================================================
//
// MICRO:
//   5km → 8km
//
// MOTO:
//   5km → 10km → 15km → 20km → 25km
//
// ============================================================

const MICRO_RADIUS_STEPS = [5, 8];

const MOTO_RADIUS_STEPS = [5, 10, 15, 20, 25];

// ============================================================
// OFFER TIMEOUT
// ============================================================

const ASSIGNMENT_TIMEOUT_MS = 25 * 1000;

// ============================================================
// CAPACITY
// ============================================================

const MAX_BATCH_JOBS = 10;

const MAX_EXPRESS_JOBS = 1;

// ============================================================
// HANDLER
// ============================================================

exports.handler = async (event) => {
  const startedAt = Date.now();

  const now = new Date().toISOString();

  console.log("==================================================");

  console.log("🔄 ATUA REASSIGN ORDER LAMBDA STARTED");

  console.log("==================================================");

  console.log("Current time:", now);

  console.log("Environment:", {
    ORDER_TABLE,
    COURIER_TABLE,
  });

  console.log("Event:", JSON.stringify(event || {}));

  // ==========================================================
  // FIND EXPIRED OFFERS
  // ==========================================================

  let orders;

  try {
    orders = await getExpiredOffers(now);
  } catch (error) {
    console.error("❌ FAILED TO FIND EXPIRED OFFERS");

    console.error(error);

    throw error;
  }

  console.log(`📦 Found ${orders.length} expired offer(s).`);

  // ==========================================================
  // NOTHING TO DO
  // ==========================================================

  if (orders.length === 0) {
    console.log("ℹ️ No expired offers require reassignment.");

    console.log(`🏁 Finished in ${Date.now() - startedAt}ms`);

    return {
      success: true,

      processed: 0,

      reassigned: 0,
    };
  }

  // ==========================================================
  // PROCESS ORDERS
  // ==========================================================

  let processed = 0;

  let reassigned = 0;

  for (const order of orders) {
    processed++;

    try {
      console.log("--------------------------------------------------");

      console.log("♻️ PROCESSING EXPIRED OFFER");

      console.log({
        orderId: order.id,

        userID: order.userID,

        status: order.status,

        paymentStatus: order.paymentStatus,

        transportationType: order.transportationType,

        assignedCourierId: order.assignedCourierId,

        assignmentStatus: order.assignmentStatus,

        assignmentExpiresAt: order.assignmentExpiresAt,

        assignmentAttempts: order.assignmentAttempts,

        dispatchRound: order.dispatchRound,

        dispatchRadiusKm: order.dispatchRadiusKm,

        dispatchAttemptedCourierIds: order.dispatchAttemptedCourierIds,
      });

      // ========================================================
      // MAXI
      // ========================================================

      if (order.transportationType === "MAXI") {
        console.log(
          "🚚 MAXI ORDER — AUTOMATIC REASSIGNMENT SKIPPED:",
          order.id,
        );

        continue;
      }

      // ========================================================
      // ORDER MUST STILL BE READY
      // ========================================================

      if (order.status !== "READY_FOR_PICKUP") {
        console.log("⏭️ ORDER NO LONGER READY_FOR_PICKUP", {
          orderId: order.id,

          status: order.status,
        });

        continue;
      }

      // ========================================================
      // PAYMENT MUST STILL BE PAID
      // ========================================================

      if (order.paymentStatus !== "PAID") {
        console.log("⏭️ ORDER PAYMENT IS NOT PAID", {
          orderId: order.id,

          paymentStatus: order.paymentStatus,
        });

        continue;
      }

      // ========================================================
      // PROCESS
      // ========================================================

      const result = await processExpiredOffer(order);

      if (result?.reassigned) {
        reassigned++;
      }
    } catch (error) {
      console.error("❌ ERROR PROCESSING EXPIRED ORDER", {
        orderId: order.id,

        errorName: error?.name,

        errorMessage: error?.message,

        stack: error?.stack,
      });

      // Continue with other expired orders.
      continue;
    }
  }

  // ==========================================================
  // FINISHED
  // ==========================================================

  console.log("==================================================");

  console.log("🏁 ATUA REASSIGN ORDER LAMBDA FINISHED");

  console.log({
    processed,

    reassigned,

    durationMs: Date.now() - startedAt,
  });

  console.log("==================================================");

  return {
    success: true,

    processed,

    reassigned,
  };
};

// ============================================================
// FIND EXPIRED OFFERS
// ============================================================
//
// Requires:
//
// GSI:
//   byAssignmentStatus
//
// Partition key:
//   assignmentStatus
//
// Sort key:
//   assignmentExpiresAt
//
// Query:
//
//   assignmentStatus = OFFERED
//
// AND:
//
//   assignmentExpiresAt <= now
//
// ============================================================

async function getExpiredOffers(now) {
  const items = [];

  let lastKey = undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: ORDER_TABLE,

        IndexName: "byAssignmentStatus",

        KeyConditionExpression:
          "assignmentStatus = :offered AND assignmentExpiresAt <= :now",

        ExpressionAttributeValues: {
          ":offered": "OFFERED",

          ":now": now,
        },

        ...(lastKey
          ? {
              ExclusiveStartKey: lastKey,
            }
          : {}),
      }),
    );

    if (result.Items?.length) {
      items.push(...result.Items);
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
}

// ============================================================
// PROCESS EXPIRED OFFER
// ============================================================

async function processExpiredOffer(order) {
  const previousCourierId = order.assignedCourierId;

  // ==========================================================
  // SAFETY
  // ==========================================================

  if (!previousCourierId) {
    console.log("⚠️ EXPIRED OFFER HAS NO ASSIGNED COURIER", {
      orderId: order.id,

      assignmentStatus: order.assignmentStatus,
    });

    return {
      reassigned: false,

      reason: "NO_ASSIGNED_COURIER",
    };
  }

  // ==========================================================
  // BUILD ATTEMPTED COURIER LIST
  // ==========================================================

  let attemptedCourierIds = Array.isArray(order.dispatchAttemptedCourierIds)
    ? [...order.dispatchAttemptedCourierIds]
    : [];

  // ==========================================================
  // ADD PREVIOUS COURIER
  // ==========================================================

  if (!attemptedCourierIds.includes(previousCourierId)) {
    attemptedCourierIds.push(previousCourierId);
  }

  // ==========================================================
  // REMOVE DUPLICATES
  // ==========================================================

  attemptedCourierIds = Array.from(new Set(attemptedCourierIds));

  console.log("📋 UPDATED ATTEMPTED COURIER LIST", {
    orderId: order.id,

    previousCourierId,

    attemptedCourierIds,
  });

  // ==========================================================
  // EXPIRE CURRENT OFFER ATOMICALLY
  // ==========================================================

  const expired = await expireCurrentOffer(
    order,

    previousCourierId,

    attemptedCourierIds,
  );

  // ==========================================================
  // ANOTHER PROCESS ALREADY HANDLED IT
  // ==========================================================

  if (!expired) {
    console.log("⏭️ OFFER WAS ALREADY HANDLED", {
      orderId: order.id,
    });

    return {
      reassigned: false,

      reason: "ALREADY_HANDLED",
    };
  }

  // ==========================================================
  // CREATE NEXT OFFER
  // ==========================================================

  const dispatchResult = await dispatchNextCourier({
    ...order,

    assignedCourierId: null,

    assignmentStatus: "EXPIRED",

    dispatchAttemptedCourierIds: attemptedCourierIds,
  });

  return {
    reassigned: dispatchResult?.offered === true,

    reason: dispatchResult?.reason,

    courierId: dispatchResult?.courierId,
  };
}

// ============================================================
// EXPIRE CURRENT OFFER
// ============================================================
//
// OFFERED
//    ↓
// EXPIRED
//
// assignedCourierId
//    ↓
// null
//
// previous courier
//    ↓
// attempted list
//
// ============================================================
//
// IMPORTANT:
//
// This only changes assignment fields.
//
// It does NOT modify:
//
// userID
// paymentStatus
// paymentID
// paymentReference
// pricing
// funds
// payout
// pickup
// destination
// etc.
//
// ============================================================

async function expireCurrentOffer(
  order,

  previousCourierId,

  attemptedCourierIds,
) {
  const now = new Date().toISOString();

  try {
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: ORDER_TABLE,

              Key: {
                id: order.id,
              },

              // =================================================
              // ONLY ASSIGNMENT FIELDS
              // =================================================

              UpdateExpression: `

                SET

                  assignmentStatus =
                    :expired,

                  assignedCourierId =
                    :nullCourier,

                  dispatchAttemptedCourierIds =
                    :attemptedIds

              `,

              // =================================================
              // ATOMIC SAFETY CONDITION
              // =================================================

              ConditionExpression: `

                #status =
                  :ready

                AND

                paymentStatus =
                  :paid

                AND

                assignmentStatus =
                  :offered

                AND

                assignedCourierId =
                  :previousCourier

                AND

                assignmentExpiresAt <=
                  :now

              `,

              ExpressionAttributeNames: {
                "#status": "status",
              },

              ExpressionAttributeValues: {
                ":expired": "EXPIRED",

                ":nullCourier": null,

                ":attemptedIds": attemptedCourierIds,

                ":previousCourier": previousCourierId,

                ":now": now,

                ":ready": "READY_FOR_PICKUP",

                ":paid": "PAID",

                ":offered": "OFFERED",
              },
            },
          },
        ],
      }),
    );

    console.log("♻️ OFFER EXPIRED SUCCESSFULLY", {
      orderId: order.id,

      previousCourierId,

      assignmentStatus: "EXPIRED",

      assignedCourierId: null,

      attemptedCourierIds,
    });

    return true;
  } catch (error) {
    // ========================================================
    // RACE CONDITION
    // ========================================================

    if (error?.name === "TransactionCanceledException") {
      console.log("⚠️ EXPIRATION TRANSACTION CANCELLED", {
        orderId: order.id,

        previousCourierId,

        reason:
          "Offer was probably accepted, replaced, cancelled, or already processed.",
      });

      return false;
    }

    console.error("❌ FAILED TO EXPIRE OFFER", {
      orderId: order.id,

      previousCourierId,

      errorName: error?.name,

      errorMessage: error?.message,
    });

    throw error;
  }
}

// ============================================================
// DISPATCH NEXT COURIER
// ============================================================
//
// This function is responsible for:
//
// 1. Finding the next courier.
// 2. Skipping couriers already attempted in this round.
// 3. Searching the current radius.
// 4. Expanding the radius when necessary.
// 5. Starting a new round after maximum radius.
// 6. Resetting attemptedCourierIds for the new round.
//
// ============================================================

async function dispatchNextCourier(order) {
  // ==========================================================
  // MAXI
  // ==========================================================

  if (order.transportationType === "MAXI") {
    console.log("🚚 MAXI — AUTOMATIC DISPATCH DISABLED", order.id);

    return {
      offered: false,

      reason: "MAXI",
    };
  }

  // ==========================================================
  // LOCATION
  // ==========================================================

  if (
    !isValidCoordinate(order.originLat) ||
    !isValidCoordinate(order.originLng)
  ) {
    console.log("❌ INVALID PICKUP COORDINATES", {
      orderId: order.id,

      originLat: order.originLat,

      originLng: order.originLng,
    });

    return {
      offered: false,

      reason: "INVALID_COORDINATES",
    };
  }

  // ==========================================================
  // RADIUS STEPS
  // ==========================================================

  const radiusSteps = getRadiusSteps(order.transportationType);

  if (radiusSteps.length === 0) {
    console.log("🚫 NO RADIUS CONFIGURATION", {
      orderId: order.id,

      transportationType: order.transportationType,
    });

    return {
      offered: false,

      reason: "NO_RADIUS_CONFIGURATION",
    };
  }

  // ==========================================================
  // DISPATCH ROUND
  // ==========================================================

  let dispatchRound = Number(order.dispatchRound) || 1;

  // ==========================================================
  // CURRENT RADIUS
  // ==========================================================

  let currentRadius = Number(order.dispatchRadiusKm) || radiusSteps[0];

  // ==========================================================
  // NORMALIZE RADIUS
  // ==========================================================

  if (!radiusSteps.includes(currentRadius)) {
    currentRadius = radiusSteps[0];
  }

  // ==========================================================
  // ATTEMPTED COURIERS
  // ==========================================================

  let attemptedCourierIds = normalizeCourierIds(
    order.dispatchAttemptedCourierIds,
  );

  console.log("📡 CURRENT DISPATCH STATE", {
    orderId: order.id,

    dispatchRound,

    currentRadius,

    radiusSteps,

    attemptedCourierCount: attemptedCourierIds.length,

    attemptedCourierIds,
  });

  // ==========================================================
  // GET AVAILABLE COURIERS
  // ==========================================================

  const couriers = await getAvailableCouriers();

  console.log("👥 AVAILABLE COURIERS", {
    orderId: order.id,

    count: couriers.length,
  });

  if (couriers.length === 0) {
    console.log("⚠️ NO ONLINE + APPROVED COURIERS", order.id);

    return {
      offered: false,

      reason: "NO_AVAILABLE_COURIERS",
    };
  }

  // ==========================================================
  // SEARCH CURRENT RADIUS
  // ==========================================================

  const candidates = getCandidates(
    order,

    couriers,

    currentRadius,

    attemptedCourierIds,
  );

  console.log("📍 CURRENT RADIUS SEARCH", {
    orderId: order.id,

    radius: currentRadius,

    candidateCount: candidates.length,
  });

  // ==========================================================
  // TRY EACH COURIER
  // ==========================================================

  for (const candidate of candidates) {
    const courier = candidate.courier;

    const distance = candidate.distance;

    console.log("🔎 EVALUATING COURIER", {
      orderId: order.id,

      courierId: courier.id,

      distanceKm: Number(distance.toFixed(2)),

      transportationType: courier.transportationType,

      vehicleClass: courier.vehicleClass,

      isOnline: courier.isOnline,

      isApproved: courier.isApproved,

      isBlocked: courier.isBlocked,

      currentBatchCount: courier.currentBatchCount || 0,

      currentExpressCount: courier.currentExpressCount || 0,
    });

    // ========================================================
    // TRANSPORT COMPATIBILITY
    // ========================================================

    if (!isTransportCompatible(order, courier)) {
      console.log("🚫 TRANSPORT INCOMPATIBLE", {
        orderId: order.id,

        courierId: courier.id,

        orderTransportationType: order.transportationType,

        courierTransportationType: courier.transportationType,
      });

      continue;
    }

    // ========================================================
    // CAPACITY
    // ========================================================

    if (!canAccept(courier, order)) {
      console.log("🚫 COURIER HAS NO CURRENT CAPACITY", {
        courierId: courier.id,

        currentBatchCount: courier.currentBatchCount || 0,

        currentExpressCount: courier.currentExpressCount || 0,
      });

      continue;
    }

    // ========================================================
    // CREATE OFFER
    // ========================================================

    const success = await createOffer(
      order,

      courier,

      currentRadius,

      dispatchRound,

      attemptedCourierIds,
    );

    // ========================================================
    // SUCCESS
    // ========================================================

    if (success) {
      console.log("==================================================");

      console.log("✅ COURIER OFFERED ORDER", {
        orderId: order.id,

        courierId: courier.id,

        distanceKm: Number(distance.toFixed(2)),

        dispatchRound,

        dispatchRadiusKm: currentRadius,

        assignmentStatus: "OFFERED",

        expiresInSeconds: 25,
      });

      console.log("==================================================");

      return {
        offered: true,

        reason: "OFFER_CREATED",

        courierId: courier.id,
      };
    }

    // ========================================================
    // FAILED
    // ========================================================

    console.log("⚠️ OFFER TRANSACTION FAILED — TRYING NEXT COURIER", {
      orderId: order.id,

      courierId: courier.id,
    });
  }

  // ==========================================================
  // CURRENT RADIUS EXHAUSTED
  // ==========================================================

  console.log("⚠️ NO COURIER COULD RECEIVE OFFER AT CURRENT RADIUS", {
    orderId: order.id,

    currentRadius,

    dispatchRound,
  });

  // ==========================================================
  // FIND NEXT RADIUS
  // ==========================================================

  const radiusIndex = radiusSteps.indexOf(currentRadius);

  const nextRadius = radiusSteps[radiusIndex + 1];

  // ==========================================================
  // NEXT RADIUS EXISTS
  // ==========================================================

  if (nextRadius !== undefined) {
    console.log("📈 EXPANDING DISPATCH RADIUS", {
      orderId: order.id,

      previousRadius: currentRadius,

      nextRadius,

      dispatchRound,
    });

    const updated = await updateDispatchState(
      order,

      {
        dispatchRound,

        dispatchRadiusKm: nextRadius,

        dispatchAttemptedCourierIds: attemptedCourierIds,
      },
    );

    if (!updated) {
      console.log("⏭️ RADIUS UPDATE CANCELLED — ORDER STATE CHANGED", order.id);

      return {
        offered: false,

        reason: "STATE_CHANGED",
      };
    }

    // ========================================================
    // SEARCH NEXT RADIUS
    // ========================================================

    return dispatchNextCourier({
      ...order,

      dispatchRound,

      dispatchRadiusKm: nextRadius,

      dispatchAttemptedCourierIds: attemptedCourierIds,

      assignmentStatus: "EXPIRED",

      assignedCourierId: null,
    });
  }

  // ==========================================================
  // MAXIMUM RADIUS EXHAUSTED
  // ==========================================================

  console.log("🔚 MAXIMUM RADIUS EXHAUSTED", {
    orderId: order.id,

    dispatchRound,

    maximumRadius: radiusSteps[radiusSteps.length - 1],

    attemptedCourierCount: attemptedCourierIds.length,
  });

  // ==========================================================
  // NEW DISPATCH ROUND
  // ==========================================================

  dispatchRound += 1;

  const resetRadius = radiusSteps[0];

  console.log("🔄 STARTING NEW DISPATCH ROUND", {
    orderId: order.id,

    previousRound: dispatchRound - 1,

    newRound: dispatchRound,

    resetRadius,
  });

  // ==========================================================
  // IMPORTANT
  // ==========================================================
  //
  // RESET THE COURIER ATTEMPT LIST.
  //
  // This means:
  //
  // Round 1:
  //
  // A → B → C → D
  //
  // Round 2:
  //
  // A → B → C → D
  //
  // Round 3:
  //
  // A → B → C → D
  //
  // etc.
  //
  // ==========================================================

  attemptedCourierIds = [];

  const updated = await updateDispatchState(
    order,

    {
      dispatchRound,

      dispatchRadiusKm: resetRadius,

      dispatchAttemptedCourierIds: [],
    },
  );

  if (!updated) {
    console.log(
      "⏭️ NEW DISPATCH ROUND CANCELLED — ORDER STATE CHANGED",
      order.id,
    );

    return {
      offered: false,

      reason: "STATE_CHANGED",
    };
  }

  // ==========================================================
  // START NEW ROUND
  // ==========================================================

  return dispatchNextCourier({
    ...order,

    dispatchRound,

    dispatchRadiusKm: resetRadius,

    dispatchAttemptedCourierIds: [],

    assignmentStatus: "EXPIRED",

    assignedCourierId: null,
  });
}

// ============================================================
// CREATE NEW OFFER
// ============================================================

async function createOffer(
  order,

  courier,

  radiusKm,

  dispatchRound,

  attemptedCourierIds,
) {
  const now = new Date();

  const expiresAt = new Date(
    now.getTime() + ASSIGNMENT_TIMEOUT_MS,
  ).toISOString();

  const nowISO = now.toISOString();

  // ==========================================================
  // ADD COURIER TO ATTEMPTED LIST
  // ==========================================================

  const updatedAttemptedIds = Array.from(
    new Set([...(attemptedCourierIds || []), courier.id]),
  );

  // ==========================================================
  // ATTEMPT COUNT
  // ==========================================================

  const assignmentAttempts = Number(order.assignmentAttempts || 0) + 1;

  try {
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: ORDER_TABLE,

              Key: {
                id: order.id,
              },

              // =================================================
              // ONLY ASSIGNMENT / DISPATCH FIELDS
              // =================================================

              UpdateExpression: `

                SET

                  assignedCourierId =
                    :courierId,

                  assignmentStatus =
                    :offered,

                  assignmentExpiresAt =
                    :expiresAt,

                  assignmentAttempts =
                    :attempts,

                  lastAssignedAt =
                    :now,

                  dispatchAttemptedCourierIds =
                    :attemptedIds,

                  dispatchRound =
                    :dispatchRound,

                  dispatchRadiusKm =
                    :radiusKm

              `,

              // =================================================
              // SAFETY CONDITION
              // =================================================

              ConditionExpression: `

                #status =
                  :ready

                AND

                paymentStatus =
                  :paid

                AND

                assignmentStatus =
                  :expired

                AND

                (

                  attribute_not_exists(
                    assignedCourierId
                  )

                  OR

                  assignedCourierId =
                    :nullCourier

                )

              `,

              ExpressionAttributeNames: {
                "#status": "status",
              },

              ExpressionAttributeValues: {
                ":courierId": courier.id,

                ":offered": "OFFERED",

                ":expiresAt": expiresAt,

                ":attempts": assignmentAttempts,

                ":now": nowISO,

                ":attemptedIds": updatedAttemptedIds,

                ":dispatchRound": dispatchRound,

                ":radiusKm": radiusKm,

                ":ready": "READY_FOR_PICKUP",

                ":paid": "PAID",

                ":expired": "EXPIRED",

                ":nullCourier": null,
              },
            },
          },
        ],
      }),
    );

    console.log("✅ NEW OFFER CREATED", {
      orderId: order.id,

      courierId: courier.id,

      expiresAt,

      dispatchRound,

      radiusKm,

      assignmentAttempts,

      assignmentStatus: "OFFERED",

      attemptedCourierIds: updatedAttemptedIds,
    });

    return true;
  } catch (error) {
    // ========================================================
    // RACE CONDITION
    // ========================================================

    if (error?.name === "TransactionCanceledException") {
      console.log("⚠️ CREATE OFFER TRANSACTION CANCELLED", {
        orderId: order.id,

        courierId: courier.id,

        reason: "Order state changed before offer could be created.",
      });

      return false;
    }

    console.error("❌ CREATE OFFER FAILED", {
      orderId: order.id,

      courierId: courier.id,

      errorName: error?.name,

      errorMessage: error?.message,
    });

    throw error;
  }
}

// ============================================================
// UPDATE DISPATCH STATE
// ============================================================
//
// Used for:
//
// MICRO:
//
//   5 → 8
//
// MOTO:
//
//   5 → 10
//   10 → 15
//   15 → 20
//   20 → 25
//
// And for:
//
//   New dispatch round
//
// ============================================================

async function updateDispatchState(
  order,

  state,
) {
  try {
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: ORDER_TABLE,

              Key: {
                id: order.id,
              },

              // =================================================
              // ONLY DISPATCH FIELDS
              // =================================================

              UpdateExpression: `

                SET

                  dispatchRound =
                    :dispatchRound,

                  dispatchRadiusKm =
                    :radiusKm,

                  dispatchAttemptedCourierIds =
                    :attemptedIds

              `,

              // =================================================
              // SAFETY CONDITION
              // =================================================

              ConditionExpression: `

                #status =
                  :ready

                AND

                paymentStatus =
                  :paid

                AND

                assignmentStatus =
                  :expired

                AND

                (

                  attribute_not_exists(
                    assignedCourierId
                  )

                  OR

                  assignedCourierId =
                    :nullCourier

                )

              `,

              ExpressionAttributeNames: {
                "#status": "status",
              },

              ExpressionAttributeValues: {
                ":dispatchRound": state.dispatchRound,

                ":radiusKm": state.dispatchRadiusKm,

                ":attemptedIds": state.dispatchAttemptedCourierIds,

                ":ready": "READY_FOR_PICKUP",

                ":paid": "PAID",

                ":expired": "EXPIRED",

                ":nullCourier": null,
              },
            },
          },
        ],
      }),
    );

    console.log("📡 DISPATCH STATE UPDATED", {
      orderId: order.id,

      dispatchRound: state.dispatchRound,

      dispatchRadiusKm: state.dispatchRadiusKm,

      attemptedCourierCount: state.dispatchAttemptedCourierIds.length,
    });

    return true;
  } catch (error) {
    if (error?.name === "TransactionCanceledException") {
      console.log("⚠️ DISPATCH STATE UPDATE CANCELLED", order.id);

      return false;
    }

    console.error("❌ DISPATCH STATE UPDATE FAILED", {
      orderId: order.id,

      errorName: error?.name,

      errorMessage: error?.message,
    });

    throw error;
  }
}

// ============================================================
// GET AVAILABLE COURIERS
// ============================================================

async function getAvailableCouriers() {
  const items = [];

  let lastKey = undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: COURIER_TABLE,

        IndexName: "byStatus",

        KeyConditionExpression: "statusKey = :status",

        ExpressionAttributeValues: {
          ":status": "ONLINE#APPROVED",
        },

        ...(lastKey
          ? {
              ExclusiveStartKey: lastKey,
            }
          : {}),
      }),
    );

    if (result.Items?.length) {
      items.push(...result.Items);
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  // ==========================================================
  // EXTRA SAFETY
  // ==========================================================

  return items.filter((courier) => {
    return (
      courier.id &&
      courier.isOnline === true &&
      courier.isApproved === true &&
      courier.isBlocked !== true
    );
  });
}

// ============================================================
// GET CANDIDATES
// ============================================================

function getCandidates(
  order,

  couriers,

  radius,

  attemptedCourierIds,
) {
  const attempted = new Set(normalizeCourierIds(attemptedCourierIds));

  return (
    couriers

      // ========================================================
      // BASIC FILTER
      // ========================================================

      .filter((courier) => {
        if (!isValidCoordinate(courier.lat)) {
          return false;
        }

        if (!isValidCoordinate(courier.lng)) {
          return false;
        }

        if (courier.isOnline !== true) {
          return false;
        }

        if (courier.isApproved !== true) {
          return false;
        }

        if (courier.isBlocked === true) {
          return false;
        }

        // -----------------------------------------------
        // Already attempted in this dispatch round.
        // -----------------------------------------------

        if (attempted.has(courier.id)) {
          return false;
        }

        const distance = getDistance(
          courier.lat,

          courier.lng,

          order.originLat,

          order.originLng,
        );

        return distance <= radius;
      })

      // ========================================================
      // CALCULATE DISTANCE
      // ========================================================

      .map((courier) => {
        const distance = getDistance(
          courier.lat,

          courier.lng,

          order.originLat,

          order.originLng,
        );

        return {
          courier,

          distance,
        };
      })

      // ========================================================
      // NEAREST FIRST
      // ========================================================

      .sort((a, b) => {
        return a.distance - b.distance;
      })
  );
}

// ============================================================
// RADIUS CONFIGURATION
// ============================================================

function getRadiusSteps(transportationType) {
  switch (transportationType) {
    case "MICRO_EXPRESS":

    case "MICRO_BATCH":
      return [...MICRO_RADIUS_STEPS];

    case "MOTO_EXPRESS":

    case "MOTO_BATCH":
      return [...MOTO_RADIUS_STEPS];

    case "MAXI":
      return [];

    default:
      return [];
  }
}

// ============================================================
// EXPRESS ORDER
// ============================================================

function isExpressOrder(order) {
  return (
    typeof order?.transportationType === "string" &&
    order.transportationType.endsWith("_EXPRESS")
  );
}

// ============================================================
// BATCH ORDER
// ============================================================

function isBatchOrder(order) {
  return (
    typeof order?.transportationType === "string" &&
    order.transportationType.endsWith("_BATCH")
  );
}

// ============================================================
// CAPACITY
// ============================================================
//
// EXPRESS:
//
//   maximum = 1
//
//   Express + Batch are mutually exclusive.
//
// BATCH:
//
//   maximum = 10
//
//   Express + Batch are mutually exclusive.
//
// ============================================================

function canAccept(courier, order) {
  const batch = Number(courier.currentBatchCount || 0);

  const express = Number(courier.currentExpressCount || 0);

  const isExpress = isExpressOrder(order);

  const isBatch = isBatchOrder(order);

  // ==========================================================
  // UNKNOWN TYPE
  // ==========================================================

  if (!isExpress && !isBatch) {
    console.log("🚫 UNKNOWN TRANSPORTATION TYPE", order.transportationType);

    return false;
  }

  // ==========================================================
  // EXPRESS
  // ==========================================================

  if (isExpress) {
    if (express >= MAX_EXPRESS_JOBS) {
      return false;
    }

    if (batch > 0) {
      return false;
    }

    return true;
  }

  // ==========================================================
  // BATCH
  // ==========================================================

  if (isBatch) {
    if (express > 0) {
      return false;
    }

    if (batch >= MAX_BATCH_JOBS) {
      return false;
    }

    return true;
  }

  return false;
}

// ============================================================
// NORMALIZE COURIER IDS
// ============================================================

function normalizeCourierIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.filter((id) => {
        return typeof id === "string" && id.trim().length > 0;
      }),
    ),
  );
}

// ============================================================
// VALID COORDINATE
// ============================================================

function isValidCoordinate(value) {
  const number = Number(value);

  return Number.isFinite(number);
}

// ============================================================
// HAVERSINE DISTANCE
// ============================================================

function getDistance(
  lat1,

  lon1,

  lat2,

  lon2,
) {
  const R = 6371;

  const dLat = ((Number(lat2) - Number(lat1)) * Math.PI) / 180;

  const dLon = ((Number(lon2) - Number(lon1)) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((Number(lat1) * Math.PI) / 180) *
      Math.cos((Number(lat2) * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return (
    R *
    2 *
    Math.atan2(
      Math.sqrt(a),

      Math.sqrt(1 - a),
    )
  );
}

// ============================================================
// TRANSPORT COMPATIBILITY
// ============================================================
//
// This is kept inside this Lambda so that this Lambda does not
// depend on transportLambda.js.
//
// ============================================================

function isTransportCompatible(order, courier) {
  const orderType = String(order?.transportationType || "").toUpperCase();

  const courierType = String(courier?.transportationType || "").toUpperCase();

  // ==========================================================
  // MICRO
  // ==========================================================

  if (orderType.startsWith("MICRO_")) {
    return courierType === "MICRO";
  }

  // ==========================================================
  // MOTO
  // ==========================================================

  if (orderType.startsWith("MOTO_")) {
    return courierType === "MOTO";
  }

  return false;
}
