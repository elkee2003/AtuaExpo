// ============================================================
// ATUA — REASSIGN ORDER LAMBDA
// PART 1
// ============================================================
//
// PURPOSE
// ============================================================
//
// This Lambda handles EXPIRED automatic courier assignments.
//
// Supported automatic assignment types:
//
//     MICRO_EXPRESS
//     MICRO_BATCH
//     MOTO_EXPRESS
//     MOTO_BATCH
//
// MAXI IS NOT handled by this automatic reassignment Lambda.
//
// Maxi uses its separate offer / bidding workflow.
//
// ============================================================
//
// REASSIGNMENT FLOW
// ============================================================
//
// assignOrder
//      ↓
// courier receives offer
//      ↓
// assignmentStatus = OFFERED
//      ↓
// assignmentExpiresAt = +25 seconds
//      ↓
// SQS
//      ↓
// reassignOrder
//      ↓
// reload order from DynamoDB
//      ↓
// verify offer REALLY expired
//      ↓
// reject expired courier
//      ↓
// find another eligible courier
//      ↓
// reserve new courier
//      ↓
// update order
//      ↓
// assignmentAttempts + 1
//      ↓
// SQS again for the new 25-second offer
//
// IMPORTANT:
//
// There is NO maximum number of assignment attempts.
//
// Example:
//
//     Courier A → attempt 1 → expires
//     Courier B → attempt 2 → expires
//     Courier C → attempt 3 → expires
//     ...
//     Courier J → attempt 10 → expires
//     Courier K → attempt 11 → expires
//     Courier L → attempt 12 → expires
//     ...
//
// assignmentAttempts is only a counter.
//
// It is NOT used as a stopping condition.
//
// ============================================================

// ============================================================
// AWS SDK
// ============================================================

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");

// ============================================================
// AWS CLIENTS
// ============================================================

const dynamoClient = new DynamoDBClient({});

const docClient = DynamoDBDocumentClient.from(dynamoClient);

const sqsClient = new SQSClient({});

// ============================================================
// TABLE NAMES
// ============================================================

const COURIER_TABLE =
  process.env.COURIER_TABLE || "Courier-n4tb6ywvhnf3zesv5ibhpitqiq-staging";

const ORDER_TABLE =
  process.env.ORDER_TABLE || "Order-n4tb6ywvhnf3zesv5ibhpitqiq-staging";

// ============================================================
// SQS QUEUE
// ============================================================

const ASSIGNMENT_EXPIRY_QUEUE_URL =
  process.env.ASSIGNMENT_EXPIRY_QUEUE_URL || "";

// ============================================================
// ASSIGNMENT TIMING
// ============================================================
//
// Courier gets 25 seconds to accept the offer.
//

const ASSIGNMENT_TIMEOUT_MS = 25 * 1000;

const ASSIGNMENT_TIMEOUT_SECONDS = 25;

// ============================================================
// COURIER CAPACITY
// ============================================================
//
// EXPRESS
//     maximum 1 active express assignment
//
// BATCH
//     maximum 10 active batch assignments
//
// EXPRESS and BATCH are mutually exclusive.
//

const MAX_EXPRESS_JOBS = 1;

const MAX_BATCH_JOBS = 10;

// ============================================================
// SEARCH RADIUS
// ============================================================
//
// MICRO:
//
//     5 km
//     8 km
//
// MOTO:
//
//     5 km
//     10 km
//     15 km
//     20 km
//     25 km
//

const MICRO_RADIUS_SEQUENCE = [5, 8];

const MOTO_RADIUS_SEQUENCE = [5, 10, 15, 20, 25];

// ============================================================
// REJECTED COURIERS
// ============================================================
//
// Prevents a courier that already failed this order from
// receiving the same order again.
//

const MAX_REJECTED_COURIERS = 200;

// ============================================================
// SQS SEND RETRIES
// ============================================================
//
// IMPORTANT:
//
// These are SQS delivery retries only.
//
// They are NOT assignment attempts.
//

const SQS_SEND_RETRIES = 3;

// ============================================================
// MAIN HANDLER
// ============================================================

exports.handler = async (event) => {
  console.log("==================================================");

  console.log("🔄 ATUA REASSIGN ORDER LAMBDA STARTED");

  console.log("==================================================");

  const records = Array.isArray(event?.Records) ? event.Records : [];

  console.log("📨 INVOCATION INFORMATION:", {
    recordCount: records.length,

    eventSource: records[0]?.eventSource || null,

    queueConfigured: Boolean(ASSIGNMENT_EXPIRY_QUEUE_URL),

    functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,

    region: process.env.AWS_REGION,
  });

  // ==========================================================
  // VERIFY QUEUE CONFIGURATION
  // ==========================================================

  if (!ASSIGNMENT_EXPIRY_QUEUE_URL) {
    console.error("❌ ASSIGNMENT_EXPIRY_QUEUE_URL IS NOT CONFIGURED");

    throw new Error(
      "Missing environment variable: ASSIGNMENT_EXPIRY_QUEUE_URL",
    );
  }

  // ==========================================================
  // NO RECORDS
  // ==========================================================

  if (!records.length) {
    console.log("⚠️ NO SQS RECORDS RECEIVED");

    return {
      success: true,
      processed: 0,
    };
  }

  // ==========================================================
  // PROCESS EACH SQS RECORD
  // ==========================================================

  const results = [];

  for (const record of records) {
    try {
      const message = parseSQSMessage(record);

      console.log("📨 SQS ASSIGNMENT EXPIRY MESSAGE:", message);

      // ========================================================
      // ONLY PROCESS ASSIGNMENT EXPIRY MESSAGES
      // ========================================================

      if (!message || message.type !== "ASSIGNMENT_EXPIRY") {
        console.log("⚠️ UNKNOWN SQS MESSAGE TYPE — IGNORING:", message);

        results.push({
          success: true,
          ignored: true,
          reason: "UNKNOWN_MESSAGE_TYPE",
        });

        continue;
      }

      // ========================================================
      // ORDER ID
      // ========================================================

      if (typeof message.orderId !== "string" || !message.orderId.trim()) {
        throw new Error("ASSIGNMENT_EXPIRY message is missing orderId");
      }

      // ========================================================
      // PROCESS EXPIRATION
      // ========================================================

      const result = await processExpiredAssignment(message);

      results.push({
        success: true,

        orderId: message.orderId,

        result,
      });
    } catch (error) {
      console.error("==================================================");

      console.error("❌ SQS MESSAGE PROCESSING FAILED");

      console.error("==================================================");

      console.error({
        errorName: error?.name,

        errorMessage: error?.message,

        stack: error?.stack,
      });

      // IMPORTANT:
      //
      // Throwing allows SQS/Lambda to retry a genuine
      // processing failure.
      //

      throw error;
    }
  }

  console.log("==================================================");

  console.log("🏁 ATUA REASSIGN ORDER LAMBDA FINISHED");

  console.log("==================================================");

  return {
    success: true,

    processed: results.length,

    results,
  };
};

// ============================================================
// PARSE SQS MESSAGE
// ============================================================

function parseSQSMessage(record) {
  const body = record?.body;

  if (typeof body !== "string" || !body.trim()) {
    throw new Error("SQS record does not contain a valid body");
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    console.error("❌ INVALID SQS MESSAGE JSON:", body);

    throw new Error("Unable to parse SQS message body as JSON");
  }
}

// ============================================================
// PROCESS EXPIRED ASSIGNMENT
// ============================================================
//
// This is the main reassignment controller.
//
// It ALWAYS reloads the order from DynamoDB.
//
// We never trust stale information from the SQS message.
//
// ============================================================

async function processExpiredAssignment(message) {
  const orderId = message.orderId;

  console.log("==================================================");

  console.log("🔎 PROCESSING ASSIGNMENT EXPIRY:", orderId);

  console.log("==================================================");

  // ==========================================================
  // LOAD FRESH ORDER
  // ==========================================================

  const order = await getOrder(orderId);

  if (!order) {
    console.log("⚠️ ORDER NOT FOUND:", orderId);

    return {
      assigned: false,

      reason: "ORDER_NOT_FOUND",
    };
  }

  // ==========================================================
  // CURRENT STATE
  // ==========================================================

  console.log("📦 CURRENT ORDER STATE:", {
    orderId: order.id,

    status: order.status,

    paymentStatus: order.paymentStatus,

    transportationType: order.transportationType,

    assignedCourierId: order.assignedCourierId,

    assignmentStatus: order.assignmentStatus,

    assignmentExpiresAt: order.assignmentExpiresAt,

    assignmentAttempts: order.assignmentAttempts,

    rejectedCourierIds: order.rejectedCourierIds,

    messageCourierId: message.courierId,

    messageExpiresAt: message.expiresAt,

    messageAssignmentAttempts: message.assignmentAttempts,
  });

  // ==========================================================
  // TRANSPORTATION TYPE
  // ==========================================================

  const transportationType = normalizeString(order.transportationType);

  // ==========================================================
  // MAXI
  // ==========================================================
  //
  // Maxi is NOT part of this automatic reassignment flow.
  //
  // This prevents this Lambda from accidentally taking over
  // the Maxi bidding workflow.
  //

  if (transportationType === "MAXI") {
    console.log("🚚 MAXI ORDER — SKIPPING AUTOMATIC REASSIGNMENT:", orderId);

    return {
      assigned: false,

      reason: "MAXI_NOT_HANDLED",
    };
  }

  // ==========================================================
  // SUPPORTED TRANSPORTATION
  // ==========================================================

  if (!isSupportedTransportationType(transportationType)) {
    console.log("🚫 UNSUPPORTED TRANSPORTATION TYPE:", {
      orderId,

      transportationType,
    });

    return {
      assigned: false,

      reason: "UNSUPPORTED_TRANSPORTATION",
    };
  }

  // ==========================================================
  // PAYMENT
  // ==========================================================
  //
  // The order should normally already be PAID because
  // assignOrder is triggered after payment.
  //
  // Nevertheless, this is an important safety check.
  //

  const paymentStatus = normalizeString(order.paymentStatus);

  if (paymentStatus && paymentStatus !== "PAID") {
    console.log("💳 ORDER NOT PAID — SKIPPING:", {
      orderId,

      paymentStatus,
    });

    return {
      assigned: false,

      reason: "ORDER_NOT_PAID",
    };
  }

  // ==========================================================
  // TERMINAL STATUS
  // ==========================================================

  const status = normalizeString(order.status);

  const terminalStatuses = ["DELIVERED", "CANCELLED", "DISPUTED"];

  if (terminalStatuses.includes(status)) {
    console.log("🛑 TERMINAL ORDER — SKIPPING:", {
      orderId,

      status,
    });

    return {
      assigned: false,

      reason: "TERMINAL_ORDER",
    };
  }

  // ==========================================================
  // ACTIVE DELIVERY STATUS
  // ==========================================================

  const activeStatuses = [
    "ACCEPTED",
    "ARRIVED PICKUP",
    "LOADING",
    "PICKED UP",
    "IN TRANSIT",
    "ARRIVED DROPOFF",
    "UNLOADING",
    "HANDOVER TO LOGISTICS",
    "IN LOGISTICS TRANSIT",
  ];

  if (activeStatuses.includes(status)) {
    console.log("🚚 ORDER ALREADY ACTIVE — SKIPPING:", {
      orderId,

      status,
    });

    return {
      assigned: false,

      reason: "ORDER_ALREADY_ACTIVE",
    };
  }

  // ==========================================================
  // ASSIGNMENT STATUS
  // ==========================================================

  const assignmentStatus = normalizeString(order.assignmentStatus);

  // ----------------------------------------------------------
  // ACCEPTED ASSIGNMENT
  // ----------------------------------------------------------

  if (assignmentStatus === "ACCEPTED") {
    console.log("✅ ASSIGNMENT ALREADY ACCEPTED — SKIPPING:", {
      orderId,
    });

    return {
      assigned: false,

      reason: "ASSIGNMENT_ALREADY_ACCEPTED",
    };
  }

  // ==========================================================
  // VERIFY EXPIRATION
  // ==========================================================
  //
  // SQS delivery does NOT itself prove that the assignment
  // is expired.
  //
  // DynamoDB is the source of truth.
  //

  const currentExpiry = order.assignmentExpiresAt;

  if (currentExpiry) {
    const expiryTime = new Date(currentExpiry).getTime();

    if (Number.isFinite(expiryTime) && Date.now() < expiryTime) {
      console.log("⏳ ASSIGNMENT HAS NOT EXPIRED — IGNORING SQS MESSAGE:", {
        orderId,

        assignmentExpiresAt: currentExpiry,

        now: new Date().toISOString(),
      });

      return {
        assigned: false,

        reason: "ASSIGNMENT_NOT_EXPIRED",
      };
    }
  }

  // ==========================================================
  // CURRENT ASSIGNMENT ATTEMPTS
  // ==========================================================
  //
  // IMPORTANT:
  //
  // assignmentAttempts is ONLY a counter.
  //
  // THERE IS NO MAXIMUM.
  //
  // It can become:
  //
  //     1
  //     2
  //     3
  //     ...
  //     10
  //     11
  //     12
  //     13
  //     ...
  //
  // It does NOT stop reassignment.
  //

  const currentAttempts = Number(order.assignmentAttempts || 0);

  console.log("🔢 CURRENT ASSIGNMENT COUNTER:", {
    orderId,

    currentAttempts,

    maximumAttempts: "UNLIMITED",
  });

  // ==========================================================
  // OLD COURIER
  // ==========================================================

  const oldCourierId = order.assignedCourierId || message.courierId || null;

  console.log("👤 EXPIRED COURIER:", {
    orderId,

    oldCourierId,
  });

  // ==========================================================
  // REJECTED COURIERS
  // ==========================================================
  //
  // The expired courier is permanently excluded for this
  // order.
  //
  // This prevents:
  //
  //     Courier A
  //       ↓
  //     offer expires
  //       ↓
  //     Courier A gets same order again
  //
  // ==========================================================

  let rejectedCourierIds = Array.isArray(order.rejectedCourierIds)
    ? [...order.rejectedCourierIds]
    : [];

  rejectedCourierIds = normalizeIds(rejectedCourierIds);

  if (oldCourierId && !rejectedCourierIds.includes(oldCourierId)) {
    rejectedCourierIds.push(oldCourierId);
  }

  if (rejectedCourierIds.length > MAX_REJECTED_COURIERS) {
    rejectedCourierIds = rejectedCourierIds.slice(-MAX_REJECTED_COURIERS);
  }

  console.log("🚫 REJECTED COURIERS:", {
    orderId,

    rejectedCount: rejectedCourierIds.length,

    rejectedCourierIds,
  });

  // ==========================================================
  // FIND NEXT COURIER
  // ==========================================================
  //
  // Searches the configured radius sequence.
  //
  // IMPORTANT:
  //
  // Searching does NOT consume an assignment attempt.
  //
  // An attempt is consumed ONLY when a courier is actually
  // selected and receives a new offer.
  //

  const candidates = await findEligibleCouriers(
    order,

    rejectedCourierIds,
  );

  console.log("🔍 ELIGIBLE COURIER SEARCH RESULT:", {
    orderId,

    currentAttempts,

    candidateCount: candidates.length,

    candidates: candidates.map((candidate) => ({
      courierId: candidate?.courier?.id || null,

      distanceKm: candidate?.distanceKm ?? null,

      radiusKm: candidate?.radiusKm ?? null,
    })),
  });

  // ==========================================================
  // NO COURIER AVAILABLE
  // ==========================================================
  //
  // IMPORTANT:
  //
  // We do NOT consume an assignment attempt.
  //
  // We do NOT create another SQS message.
  //
  // This prevents an endless SQS loop when no courier exists.
  //
  // We release the expired courier and leave the order in
  // READY state so another assignment process can try later.
  //

  if (!candidates.length) {
    console.log("⚠️ NO ELIGIBLE COURIER FOUND:", {
      orderId,

      currentAttempts,

      rejectedCourierIds,
    });

    await clearExpiredAssignment(
      order,

      oldCourierId,

      rejectedCourierIds,
    );

    return {
      assigned: false,

      reason: "NO_ELIGIBLE_COURIER",

      assignmentAttempts: currentAttempts,

      stopped: false,
    };
  }

  // ==========================================================
  // SELECT NEAREST COURIER
  // ==========================================================
  //
  // findEligibleCouriers() returns candidates sorted by
  // distance.
  //
  // Therefore the first candidate is the nearest eligible
  // courier.
  //

  const selected = candidates[0];

  const newCourier = selected?.courier;

  const radiusKm = selected?.radiusKm;

  if (!newCourier?.id) {
    console.error(
      "❌ ELIGIBLE COURIER RESULT DID NOT CONTAIN A VALID COURIER:",
      {
        orderId,

        selected,
      },
    );

    throw new Error("Eligible courier result is missing courier.id");
  }

  console.log("🎯 SELECTED NEXT COURIER:", {
    orderId,

    oldCourierId,

    newCourierId: newCourier.id,

    distanceKm: selected.distanceKm,

    radiusKm,

    currentAttempts,

    nextAttempt: currentAttempts + 1,
  });

  // ==========================================================
  // CREATE ATOMIC REASSIGNMENT
  // ==========================================================
  //
  // Part 2 contains createReassignment().
  //
  // That transaction:
  //
  //     1. releases old courier capacity
  //     2. updates order
  //     3. increments assignmentAttempts
  //     4. reserves new courier capacity
  //     5. creates new 25-second expiry
  //     6. queues next SQS expiry
  //
  // There is NO maximum attempt check.
  //
  // ==========================================================

  const reassigned = await createReassignment(
    order,

    newCourier,

    radiusKm,

    rejectedCourierIds,

    oldCourierId,

    false,
  );

  return {
    assigned: Boolean(reassigned),

    courierId: newCourier.id,

    distanceKm: selected.distanceKm,

    radiusKm,

    assignmentAttempts: currentAttempts + 1,
  };
}

// ============================================================
// FIND ELIGIBLE COURIERS
// ============================================================
//
// This function:
//
//     getAvailableCouriers()
//             ↓
//     transportation filtering
//             ↓
//     rejected courier filtering
//             ↓
//     capacity filtering
//             ↓
//     distance filtering
//             ↓
//     radius expansion
//
// The result is sorted nearest-first.
//
// ============================================================

async function findEligibleCouriers(order, rejectedCourierIds) {
  console.log("==================================================");

  console.log("🔎 FINDING ELIGIBLE COURIERS");

  console.log("==================================================");

  // ==========================================================
  // GET ONLINE / APPROVED COURIERS
  // ==========================================================

  const couriers = await getAvailableCouriers();

  console.log("👥 AVAILABLE COURIERS LOADED:", {
    orderId: order.id,

    count: couriers.length,
  });

  if (!couriers.length) {
    console.log("⚠️ NO ONLINE/APPROVED COURIERS EXIST");

    return [];
  }

  // ==========================================================
  // RADIUS SEQUENCE
  // ==========================================================

  const radiusSequence = getRadiusSequence(order.transportationType);

  if (!radiusSequence.length) {
    console.log("⚠️ NO RADIUS SEQUENCE FOR ORDER:", {
      orderId: order.id,

      transportationType: order.transportationType,
    });

    return [];
  }

  // ==========================================================
  // SEARCH EACH RADIUS
  // ==========================================================
  //
  // MICRO:
  //
  //     5 km
  //       ↓
  //     8 km
  //
  // MOTO:
  //
  //     5 km
  //       ↓
  //     10 km
  //       ↓
  //     15 km
  //       ↓
  //     20 km
  //       ↓
  //     25 km
  //
  // Once a courier is found at the smallest radius, we do NOT
  // unnecessarily expand the search.
  //

  for (const radiusKm of radiusSequence) {
    console.log("🔎 SEARCHING COURIERS WITHIN RADIUS:", {
      orderId: order.id,

      radiusKm,

      transportationType: order.transportationType,

      rejectedCount: normalizeIds(rejectedCourierIds).length,
    });

    const candidates = findCandidates(
      order,

      couriers,

      radiusKm,

      rejectedCourierIds,
    );

    console.log("📊 RADIUS SEARCH RESULT:", {
      orderId: order.id,

      radiusKm,

      candidateCount: candidates.length,
    });

    if (candidates.length) {
      // --------------------------------------------------------
      // Every candidate returned by findCandidates() is already
      // compatible with the order and within this radius.
      //
      // Candidates are sorted nearest-first.
      // --------------------------------------------------------

      return candidates.map((candidate) => ({
        ...candidate,

        radiusKm,
      }));
    }
  }

  // ==========================================================
  // NO COURIER IN ANY RADIUS
  // ==========================================================

  console.log("⚠️ NO ELIGIBLE COURIER FOUND IN ANY RADIUS:", {
    orderId: order.id,

    transportationType: order.transportationType,

    radiusSequence,
  });

  return [];
}

// ============================================================
// GET ORDER
// ============================================================
//
// Always reads the latest order directly from DynamoDB.
//
// ============================================================

async function getOrder(orderId) {
  if (!orderId) {
    return null;
  }

  const result = await docClient.send(
    new GetCommand({
      TableName: ORDER_TABLE,

      Key: {
        id: orderId,
      },
    }),
  );

  return result?.Item || null;
}

// ============================================================
// NORMALIZE STRING
// ============================================================

function normalizeString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim().toUpperCase();
}

// ============================================================
// NORMALIZE IDS
// ============================================================

function normalizeIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((id) => typeof id === "string" && id.trim().length > 0)
        .map((id) => id.trim()),
    ),
  ).slice(0, MAX_REJECTED_COURIERS);
}

// ============================================================
// EXPRESS ORDER
// ============================================================

function isExpressOrder(order) {
  const type = normalizeString(order?.transportationType);

  return type === "MICRO_EXPRESS" || type === "MOTO_EXPRESS";
}

// ============================================================
// BATCH ORDER
// ============================================================

function isBatchOrder(order) {
  const type = normalizeString(order?.transportationType);

  return type === "MICRO_BATCH" || type === "MOTO_BATCH";
}

// ============================================================
// SUPPORTED TRANSPORTATION TYPES
// ============================================================

function isSupportedTransportationType(transportationType) {
  const type = normalizeString(transportationType);

  return (
    type === "MICRO_EXPRESS" ||
    type === "MICRO_BATCH" ||
    type === "MOTO_EXPRESS" ||
    type === "MOTO_BATCH"
  );
}

// ============================================================
// TRANSPORT BASE
// ============================================================
//
// Converts:
//
//     MICRO_EXPRESS → MICRO
//     MICRO_BATCH   → MICRO
//
//     MOTO_EXPRESS  → MOTO
//     MOTO_BATCH    → MOTO
//
// Maxi is deliberately not used by automatic reassignment.
//
// ============================================================

function getTransportBase(transportationType) {
  const type = normalizeString(transportationType);

  if (type === "MICRO" || type.startsWith("MICRO_")) {
    return "MICRO";
  }

  if (type === "MOTO" || type.startsWith("MOTO_")) {
    return "MOTO";
  }

  if (type === "MAXI") {
    return "MAXI";
  }

  return null;
}

// ============================================================
// TRANSPORT COMPATIBILITY
// ============================================================
//
// MICRO order → MICRO courier
// MOTO order  → MOTO courier
//
// ============================================================

function isTransportCompatible(order, courier) {
  const orderBase = getTransportBase(order?.transportationType);

  const courierBase = getTransportBase(courier?.transportationType);

  if (!orderBase || !courierBase) {
    return false;
  }

  return orderBase === courierBase;
}

// ============================================================
// RADIUS SEQUENCE
// ============================================================

function getRadiusSequence(transportationType) {
  const type = normalizeString(transportationType);

  if (type.startsWith("MICRO")) {
    return MICRO_RADIUS_SEQUENCE;
  }

  if (type.startsWith("MOTO")) {
    return MOTO_RADIUS_SEQUENCE;
  }

  return [];
}

// ============================================================
// VALID LATITUDE
// ============================================================

function isValidLatitude(value) {
  const number = Number(value);

  return Number.isFinite(number) && number >= -90 && number <= 90;
}

// ============================================================
// VALID LONGITUDE
// ============================================================

function isValidLongitude(value) {
  const number = Number(value);

  return Number.isFinite(number) && number >= -180 && number <= 180;
}

// ============================================================
// HAVERSINE DISTANCE
// ============================================================
//
// Returns distance in kilometres.
//
// ============================================================

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;

  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const lat1Radians = (lat1 * Math.PI) / 180;

  const lat2Radians = (lat2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1Radians) * Math.cos(lat2Radians) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================
// ATUA — REASSIGN ORDER LAMBDA
// PART 2
// ============================================================
//
// This is the continuation of PART 1.
//
// IMPORTANT:
//
// DO NOT add another exports.handler here.
//
// PART 1 already contains:
//
//     exports.handler
//     processExpiredAssignment()
//     findEligibleCouriers()
//     getOrder()
//     transportation helpers
//     distance helpers
//
// PART 2 contains:
//
//     1. Atomic reassignment
//     2. Old courier capacity release
//     3. New courier capacity reservation
//     4. Order update
//     5. Assignment attempt counter
//     6. Expired assignment cleanup
//     7. SQS expiry scheduling
//     8. Courier lookup
//     9. Candidate filtering
//    10. Capacity checking
//    11. Supporting helpers
//
// IMPORTANT:
//
// assignmentAttempts has NO maximum.
//
// It is only a telemetry / history counter.
//
// Attempt 10 → 11 → 12 → 13 → ... is allowed.
//
// ============================================================

// ============================================================
// CREATE REASSIGNMENT
// ============================================================
//
// This is the MOST IMPORTANT database operation in the
// reassignment system.
//
// Everything happens inside ONE DynamoDB transaction:
//
//     1. Release old courier capacity
//     2. Update order
//     3. Reserve new courier capacity
//
// If ANY part fails:
//
//     NOTHING is changed.
//
// This prevents:
//
//     Order assigned to Courier B
//     while Courier B capacity was not reserved.
//
// OR:
//
//     Courier A capacity released
//     but order was never reassigned.
//
// ============================================================

async function createReassignment(
  order,
  courier,
  radiusKm,
  rejectedCourierIds,
  oldCourierId,
  restarted,
) {
  const now = new Date();

  const nowISO = now.toISOString();

  // ==========================================================
  // NEW OFFER EXPIRATION
  // ==========================================================
  //
  // Every newly selected courier gets a fresh 25-second offer.
  //

  const expiresAt = new Date(
    now.getTime() + ASSIGNMENT_TIMEOUT_MS,
  ).toISOString();

  // ==========================================================
  // CURRENT ATTEMPTS
  // ==========================================================
  //
  // assignmentAttempts represents the number of couriers
  // that have actually received an offer.
  //
  // It is NOT the number of Lambda executions.
  //
  // It is NOT the number of searches.
  //
  // It is NOT the number of SQS messages.
  //
  // There is NO maximum.
  //

  const currentAttempts = Number(order.assignmentAttempts || 0);

  // ==========================================================
  // NEXT ATTEMPT
  // ==========================================================
  //
  // Every time a new courier actually receives an offer,
  // increase the counter by one.
  //

  const assignmentAttempts = currentAttempts + 1;

  console.log("🔢 CREATING NEW ASSIGNMENT ATTEMPT:", {
    orderId: order.id,

    oldCourierId,

    newCourierId: courier.id,

    currentAttempts,

    nextAttempt: assignmentAttempts,

    maximumAttempts: "UNLIMITED",
  });

  // ==========================================================
  // SERVICE TYPE
  // ==========================================================

  const isExpress = isExpressOrder(order);

  const isBatch = isBatchOrder(order);

  if (!isExpress && !isBatch) {
    console.error("❌ INVALID SERVICE TYPE:", {
      orderId: order.id,

      transportationType: order.transportationType,
    });

    return false;
  }

  // ==========================================================
  // NEVER ASSIGN SAME COURIER
  // ==========================================================
  //
  // The courier whose offer just expired must not immediately
  // receive the same order again.
  //

  if (oldCourierId && oldCourierId === courier.id) {
    console.log("🚫 SAME COURIER AS EXPIRED COURIER:", {
      orderId: order.id,

      courierId: courier.id,
    });

    return false;
  }

  // ==========================================================
  // BUILD REJECTED COURIER LIST
  // ==========================================================
  //
  // The expired courier is added to the rejected list.
  //
  // This prevents the same courier from being selected again
  // for this order.
  //

  let finalRejectedIds = normalizeIds(rejectedCourierIds);

  if (oldCourierId && !finalRejectedIds.includes(oldCourierId)) {
    finalRejectedIds.push(oldCourierId);
  }

  finalRejectedIds = normalizeIds(finalRejectedIds);

  // ==========================================================
  // COURIER CAPACITY UPDATE
  // ==========================================================

  let courierUpdateExpression;

  let courierConditionExpression;

  // ==========================================================
  // EXPRESS
  // ==========================================================

  if (isExpress) {
    courierUpdateExpression = `
      SET currentExpressCount =
        if_not_exists(
          currentExpressCount,
          :zero
        ) + :one
    `;

    courierConditionExpression = `
      attribute_exists(id)

      AND isOnline = :true

      AND isApproved = :true

      AND (
        attribute_not_exists(isBlocked)
        OR isBlocked = :false
      )

      AND (
        attribute_not_exists(statusKey)
        OR statusKey = :onlineApproved
      )

      AND (
        attribute_not_exists(currentExpressCount)
        OR currentExpressCount < :maxExpressJobs
      )

      AND (
        attribute_not_exists(currentBatchCount)
        OR currentBatchCount = :zero
      )
    `;
  }

  // ==========================================================
  // BATCH
  // ==========================================================

  if (isBatch) {
    courierUpdateExpression = `
      SET currentBatchCount =
        if_not_exists(
          currentBatchCount,
          :zero
        ) + :one
    `;

    courierConditionExpression = `
      attribute_exists(id)

      AND isOnline = :true

      AND isApproved = :true

      AND (
        attribute_not_exists(isBlocked)
        OR isBlocked = :false
      )

      AND (
        attribute_not_exists(statusKey)
        OR statusKey = :onlineApproved
      )

      AND (
        attribute_not_exists(currentExpressCount)
        OR currentExpressCount = :zero
      )

      AND (
        attribute_not_exists(currentBatchCount)
        OR currentBatchCount < :maxBatchJobs
      )
    `;
  }

  // ==========================================================
  // OLD COURIER CAPACITY RELEASE
  // ==========================================================

  let oldCourierUpdateExpression;

  let oldCourierConditionExpression;

  // ==========================================================
  // EXPRESS RELEASE
  // ==========================================================

  if (isExpress) {
    oldCourierUpdateExpression = `
      SET currentExpressCount =
        currentExpressCount - :one
    `;

    oldCourierConditionExpression = `
      attribute_exists(id)

      AND attribute_exists(currentExpressCount)

      AND currentExpressCount > :zero
    `;
  }

  // ==========================================================
  // BATCH RELEASE
  // ==========================================================

  if (isBatch) {
    oldCourierUpdateExpression = `
      SET currentBatchCount =
        currentBatchCount - :one
    `;

    oldCourierConditionExpression = `
      attribute_exists(id)

      AND attribute_exists(currentBatchCount)

      AND currentBatchCount > :zero
    `;
  }

  // ==========================================================
  // BUILD TRANSACTION
  // ==========================================================

  const transactItems = [];

  // ==========================================================
  // 1. RELEASE OLD COURIER
  // ==========================================================
  //
  // The old courier only gets released when there actually
  // was an old courier.
  //

  if (oldCourierId && oldCourierId !== courier.id) {
    transactItems.push({
      Update: {
        TableName: COURIER_TABLE,

        Key: {
          id: oldCourierId,
        },

        UpdateExpression: oldCourierUpdateExpression,

        ConditionExpression: oldCourierConditionExpression,

        ExpressionAttributeValues: {
          ":one": 1,

          ":zero": 0,
        },

        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
      },
    });
  }

  // ==========================================================
  // 2. UPDATE ORDER
  // ==========================================================
  //
  // The order receives the NEW courier and the new offer.
  //
  // assignmentAttempts is incremented here.
  //
  // There is NO maximum attempt condition.
  //

  transactItems.push({
    Update: {
      TableName: ORDER_TABLE,

      Key: {
        id: order.id,
      },

      UpdateExpression: `
        SET
          assignedCourierId = :courierId,
          assignmentStatus = :offered,
          assignmentExpiresAt = :expiresAt,
          assignmentAttempts = :attempts,
          lastAssignedAt = :now,
          rejectedCourierIds = :rejectedIds,
          hasNewOffer = :true
      `,

      // --------------------------------------------------------
      // IMPORTANT:
      //
      // These conditions prevent a stale SQS message from
      // overwriting a newer assignment.
      //
      // assignmentAttempts here is NOT a maximum.
      //
      // It is simply a concurrency guard ensuring the order
      // still has the same attempt counter that this Lambda
      // loaded before making the reassignment.
      // --------------------------------------------------------

      ConditionExpression: `
        #status = :ready

        AND paymentStatus = :paid

        AND assignmentStatus = :offered

        AND assignedCourierId = :oldCourierId

        AND assignmentExpiresAt <= :now

        AND (
          attribute_not_exists(assignmentAttempts)
          OR assignmentAttempts = :currentAttempts
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

        ":ready": "READY_FOR_PICKUP",

        ":paid": "PAID",

        ":oldCourierId": oldCourierId,

        ":currentAttempts": currentAttempts,

        ":rejectedIds": finalRejectedIds,

        ":true": true,
      },

      ReturnValuesOnConditionCheckFailure: "ALL_OLD",
    },
  });

  // ==========================================================
  // 3. RESERVE NEW COURIER
  // ==========================================================
  //
  // This is done inside the SAME transaction as:
  //
  //     - order update
  //     - old courier release
  //
  // ==========================================================

  transactItems.push({
    Update: {
      TableName: COURIER_TABLE,

      Key: {
        id: courier.id,
      },

      UpdateExpression: courierUpdateExpression,

      ConditionExpression: courierConditionExpression,

      ExpressionAttributeValues: {
        ":one": 1,

        ":zero": 0,

        ":true": true,

        ":false": false,

        ":onlineApproved": "ONLINE#APPROVED",

        ...(isExpress
          ? {
              ":maxExpressJobs": MAX_EXPRESS_JOBS,
            }
          : {
              ":maxBatchJobs": MAX_BATCH_JOBS,
            }),
      },

      ReturnValuesOnConditionCheckFailure: "ALL_OLD",
    },
  });

  // ==========================================================
  // LOG BEFORE TRANSACTION
  // ==========================================================

  console.log("🔐 STARTING ATOMIC REASSIGNMENT:", {
    orderId: order.id,

    oldCourierId,

    newCourierId: courier.id,

    transportationType: order.transportationType,

    serviceType: isExpress ? "EXPRESS" : "BATCH",

    radiusKm,

    restarted,

    currentAttempts,

    assignmentAttempts,

    maximumAttempts: "UNLIMITED",

    assignmentExpiresAt: expiresAt,

    rejectedCourierIds: finalRejectedIds,

    transactionItems: transactItems.length,
  });

  // ==========================================================
  // EXECUTE TRANSACTION
  // ==========================================================

  try {
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: transactItems,
      }),
    );

    console.log("==================================================");

    console.log("✅ ATOMIC REASSIGNMENT SUCCEEDED:", {
      orderId: order.id,

      oldCourierId,

      newCourierId: courier.id,

      radiusKm,

      restarted,

      assignmentStatus: "OFFERED",

      currentAttempts,

      assignmentAttempts,

      maximumAttempts: "UNLIMITED",

      assignmentExpiresAt: expiresAt,

      capacityReleased: Boolean(oldCourierId),

      capacityReserved: true,
    });

    console.log("==================================================");
  } catch (error) {
    // ========================================================
    // TRANSACTION CANCELLED
    // ========================================================

    if (error?.name === "TransactionCanceledException") {
      console.error("⚠️ REASSIGNMENT TRANSACTION CANCELLED:", {
        orderId: order.id,

        oldCourierId,

        newCourierId: courier.id,

        radiusKm,

        restarted,

        currentAttempts,

        assignmentAttempts,

        cancellationReasons: error?.CancellationReasons || null,

        message: error?.message,
      });

      return false;
    }

    // ========================================================
    // REAL AWS ERROR
    // ========================================================

    console.error("❌ REAL REASSIGNMENT ERROR:", {
      orderId: order.id,

      oldCourierId,

      newCourierId: courier.id,

      errorName: error?.name,

      errorMessage: error?.message,

      stack: error?.stack,
    });

    throw error;
  }

  // ==========================================================
  // QUEUE NEXT EXPIRY
  // ==========================================================
  //
  // The database assignment has already succeeded.
  //
  // We now tell SQS to wake this Lambda after 25 seconds.
  //
  // ==========================================================

  try {
    await queueAssignmentExpiryWithRetry({
      orderId: order.id,

      courierId: courier.id,

      expiresAt,

      assignmentAttempts,
    });
  } catch (error) {
    console.error("❌ FAILED TO QUEUE NEXT ASSIGNMENT EXPIRY:", {
      orderId: order.id,

      courierId: courier.id,

      expiresAt,

      assignmentAttempts,

      errorName: error?.name,

      errorMessage: error?.message,
    });

    // --------------------------------------------------------
    // IMPORTANT:
    //
    // We DO NOT undo the successful DynamoDB assignment here.
    //
    // The assignment already exists.
    //
    // --------------------------------------------------------

    throw error;
  }

  console.log("✅ NEW ASSIGNMENT EXPIRY QUEUED:", {
    orderId: order.id,

    courierId: courier.id,

    expiresAt,

    assignmentAttempts,
  });

  return true;
}

// ============================================================
// CLEAR EXPIRED ASSIGNMENT
// ============================================================
//
// Used when there is currently NO replacement courier.
//
// This:
//
//     1. releases the expired courier
//     2. removes the active assignment
//     3. keeps the order available for another assignment cycle
//
// IMPORTANT:
//
// assignmentAttempts is NOT increased.
//
// No new courier received an offer.
//
// No new SQS expiry message is created.
//
// ============================================================

async function clearExpiredAssignment(order, oldCourierId, rejectedCourierIds) {
  if (!oldCourierId) {
    console.log("⚠️ NO OLD COURIER TO CLEAR:", {
      orderId: order.id,
    });

    return false;
  }

  const isExpress = isExpressOrder(order);

  const isBatch = isBatchOrder(order);

  if (!isExpress && !isBatch) {
    console.error("❌ CANNOT CLEAR INVALID SERVICE TYPE:", {
      orderId: order.id,

      transportationType: order.transportationType,
    });

    return false;
  }

  // ==========================================================
  // OLD COURIER RELEASE EXPRESSION
  // ==========================================================

  let courierUpdateExpression;

  let courierConditionExpression;

  // ==========================================================
  // EXPRESS
  // ==========================================================

  if (isExpress) {
    courierUpdateExpression = `
      SET currentExpressCount =
        currentExpressCount - :one
    `;

    courierConditionExpression = `
      attribute_exists(id)

      AND attribute_exists(currentExpressCount)

      AND currentExpressCount > :zero
    `;
  }

  // ==========================================================
  // BATCH
  // ==========================================================

  if (isBatch) {
    courierUpdateExpression = `
      SET currentBatchCount =
        currentBatchCount - :one
    `;

    courierConditionExpression = `
      attribute_exists(id)

      AND attribute_exists(currentBatchCount)

      AND currentBatchCount > :zero
    `;
  }

  const finalRejectedIds = normalizeIds(rejectedCourierIds);

  console.log("🧹 CLEARING EXPIRED ASSIGNMENT:", {
    orderId: order.id,

    oldCourierId,

    serviceType: isExpress ? "EXPRESS" : "BATCH",

    rejectedCourierIds: finalRejectedIds,
  });

  // ==========================================================
  // ATOMIC CLEAR
  // ==========================================================

  try {
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          // ----------------------------------------------------
          // RELEASE OLD COURIER
          // ----------------------------------------------------

          {
            Update: {
              TableName: COURIER_TABLE,

              Key: {
                id: oldCourierId,
              },

              UpdateExpression: courierUpdateExpression,

              ConditionExpression: courierConditionExpression,

              ExpressionAttributeValues: {
                ":one": 1,

                ":zero": 0,
              },

              ReturnValuesOnConditionCheckFailure: "ALL_OLD",
            },
          },

          // ----------------------------------------------------
          // CLEAR ORDER ASSIGNMENT
          // ----------------------------------------------------

          {
            Update: {
              TableName: ORDER_TABLE,

              Key: {
                id: order.id,
              },

              UpdateExpression: `
                SET
                  assignmentStatus = :ready,
                  assignmentExpiresAt = :nullValue,
                  assignedCourierId = :nullValue,
                  rejectedCourierIds = :rejectedIds,
                  hasNewOffer = :falseValue
              `,

              ConditionExpression: `
                #status = :orderReady

                AND paymentStatus = :paid

                AND assignmentStatus = :offered

                AND assignedCourierId = :oldCourierId

                AND assignmentExpiresAt <= :now
              `,

              ExpressionAttributeNames: {
                "#status": "status",
              },

              ExpressionAttributeValues: {
                ":ready": "READY",

                ":nullValue": null,

                ":rejectedIds": finalRejectedIds,

                ":falseValue": false,

                ":orderReady": "READY_FOR_PICKUP",

                ":paid": "PAID",

                ":offered": "OFFERED",

                ":oldCourierId": oldCourierId,

                ":now": new Date().toISOString(),
              },

              ReturnValuesOnConditionCheckFailure: "ALL_OLD",
            },
          },
        ],
      }),
    );

    console.log("✅ EXPIRED ASSIGNMENT CLEARED:", {
      orderId: order.id,

      oldCourierId,

      assignmentAttempts: Number(order.assignmentAttempts || 0),

      assignmentStatus: "READY",

      newSqsMessage: false,
    });

    return true;
  } catch (error) {
    // ========================================================
    // TRANSACTION CANCELLED
    // ========================================================

    if (error?.name === "TransactionCanceledException") {
      console.log("⚠️ EXPIRED ASSIGNMENT CLEAR TRANSACTION CANCELLED:", {
        orderId: order.id,

        oldCourierId,

        cancellationReasons: error?.CancellationReasons || null,
      });

      return false;
    }

    console.error("❌ FAILED TO CLEAR EXPIRED ASSIGNMENT:", {
      orderId: order.id,

      oldCourierId,

      errorName: error?.name,

      errorMessage: error?.message,

      stack: error?.stack,
    });

    throw error;
  }
}

// ============================================================
// QUEUE ASSIGNMENT EXPIRY WITH RETRY
// ============================================================
//
// If SQS temporarily fails, retry the SQS send a few times.
//
// IMPORTANT:
//
// These are SQS delivery retries only.
//
// They are NOT assignment retries.
//
// They do NOT increase assignmentAttempts.
//
// ============================================================

async function queueAssignmentExpiryWithRetry({
  orderId,
  courierId,
  expiresAt,
  assignmentAttempts,
}) {
  let lastError;

  for (let attempt = 1; attempt <= SQS_SEND_RETRIES; attempt++) {
    try {
      return await queueAssignmentExpiry({
        orderId,

        courierId,

        expiresAt,

        assignmentAttempts,
      });
    } catch (error) {
      lastError = error;

      console.error("⚠️ SQS SEND ATTEMPT FAILED:", {
        attempt,

        maxAttempts: SQS_SEND_RETRIES,

        orderId,

        courierId,

        errorName: error?.name,

        errorMessage: error?.message,
      });

      if (attempt < SQS_SEND_RETRIES) {
        await sleep(250 * attempt);
      }
    }
  }

  throw lastError;
}

// ============================================================
// QUEUE ASSIGNMENT EXPIRY
// ============================================================
//
// Creates the SQS message that wakes reassignOrder after
// approximately 25 seconds.
//
// ============================================================

async function queueAssignmentExpiry({
  orderId,
  courierId,
  expiresAt,
  assignmentAttempts,
}) {
  if (!ASSIGNMENT_EXPIRY_QUEUE_URL) {
    throw new Error("ASSIGNMENT_EXPIRY_QUEUE_URL is not configured");
  }

  const message = {
    type: "ASSIGNMENT_EXPIRY",

    orderId,

    courierId,

    expiresAt,

    assignmentAttempts,
  };

  console.log("📨 SENDING ASSIGNMENT EXPIRY MESSAGE:", {
    queueUrl: ASSIGNMENT_EXPIRY_QUEUE_URL,

    message,

    delaySeconds: ASSIGNMENT_TIMEOUT_SECONDS,
  });

  const result = await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: ASSIGNMENT_EXPIRY_QUEUE_URL,

      MessageBody: JSON.stringify(message),

      DelaySeconds: ASSIGNMENT_TIMEOUT_SECONDS,
    }),
  );

  console.log("✅ ASSIGNMENT EXPIRY MESSAGE SENT:", {
    messageId: result.MessageId,

    orderId,

    courierId,

    expiresAt,

    assignmentAttempts,
  });

  return result;
}

// ============================================================
// GET AVAILABLE COURIERS
// ============================================================
//
// Uses the existing Courier.byStatus index.
//
// Only couriers with:
//
//     ONLINE#APPROVED
//
// are retrieved.
//
// A second safety filter is applied afterwards.
//
// ============================================================

async function getAvailableCouriers() {
  const items = [];

  let lastEvaluatedKey;

  do {
    const params = {
      TableName: COURIER_TABLE,

      IndexName: "byStatus",

      KeyConditionExpression: "statusKey = :status",

      ExpressionAttributeValues: {
        ":status": "ONLINE#APPROVED",
      },
    };

    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    console.log("🔎 QUERYING COURIER.byStatus:", {
      TableName: COURIER_TABLE,

      IndexName: "byStatus",

      statusKey: "ONLINE#APPROVED",
    });

    const result = await docClient.send(new QueryCommand(params));

    console.log("📊 COURIER QUERY RESULT:", {
      count: result.Items?.length || 0,

      scannedCount: result.ScannedCount,

      hasMore: Boolean(result.LastEvaluatedKey),
    });

    if (result.Items?.length) {
      items.push(...result.Items);
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  // ==========================================================
  // FINAL SAFETY FILTER
  // ==========================================================

  const filtered = items.filter((courier) => {
    if (!courier?.id) {
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

    if (normalizeString(courier.statusKey) !== "ONLINE#APPROVED") {
      return false;
    }

    return true;
  });

  console.log("👥 FINAL AVAILABLE COURIERS:", {
    queried: items.length,

    eligible: filtered.length,

    courierIds: filtered.map((courier) => courier.id),
  });

  return filtered;
}

// ============================================================
// FIND CANDIDATES
// ============================================================
//
// Filters couriers according to:
//
//     - rejected list
//     - online status
//     - approval
//     - blocked status
//     - location
//     - transportation type
//     - capacity
//     - distance
//     - search radius
//
// Candidates are sorted nearest first.
//
// ============================================================

function findCandidates(order, couriers, radiusKm, rejectedCourierIds) {
  const rejected = normalizeIds(rejectedCourierIds);

  const candidates = [];

  for (const courier of couriers) {
    if (!courier?.id) {
      continue;
    }

    // ========================================================
    // REJECTED COURIER
    // ========================================================

    if (rejected.includes(courier.id)) {
      console.log("🚫 COURIER REJECTED — ALREADY USED:", courier.id);

      continue;
    }

    // ========================================================
    // ONLINE
    // ========================================================

    if (courier.isOnline !== true) {
      continue;
    }

    // ========================================================
    // APPROVED
    // ========================================================

    if (courier.isApproved !== true) {
      continue;
    }

    // ========================================================
    // BLOCKED
    // ========================================================

    if (courier.isBlocked === true) {
      continue;
    }

    // ========================================================
    // STATUS
    // ========================================================

    if (normalizeString(courier.statusKey) !== "ONLINE#APPROVED") {
      continue;
    }

    // ========================================================
    // LOCATION
    // ========================================================

    if (!isValidLatitude(courier.lat) || !isValidLongitude(courier.lng)) {
      console.log("🚫 INVALID COURIER LOCATION:", {
        courierId: courier.id,

        lat: courier.lat,

        lng: courier.lng,
      });

      continue;
    }

    // ========================================================
    // TRANSPORTATION
    // ========================================================

    if (!isTransportCompatible(order, courier)) {
      console.log("🚫 TRANSPORT INCOMPATIBLE:", {
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
      console.log("🚫 COURIER CAPACITY FULL:", {
        courierId: courier.id,

        currentExpressCount: Number(courier.currentExpressCount || 0),

        currentBatchCount: Number(courier.currentBatchCount || 0),
      });

      continue;
    }

    // ========================================================
    // ORDER LOCATION
    // ========================================================

    if (
      !isValidLatitude(order.originLat) ||
      !isValidLongitude(order.originLng)
    ) {
      console.log("🚫 INVALID ORDER ORIGIN:", {
        orderId: order.id,

        originLat: order.originLat,

        originLng: order.originLng,
      });

      continue;
    }

    // ========================================================
    // DISTANCE
    // ========================================================

    const distanceKm = getDistance(
      Number(courier.lat),

      Number(courier.lng),

      Number(order.originLat),

      Number(order.originLng),
    );

    console.log("📏 COURIER DISTANCE:", {
      courierId: courier.id,

      distanceKm: Number(distanceKm.toFixed(4)),

      radiusKm,
    });

    // ========================================================
    // RADIUS
    // ========================================================

    if (distanceKm > radiusKm) {
      continue;
    }

    // ========================================================
    // ELIGIBLE
    // ========================================================

    candidates.push({
      courier,

      distanceKm,
    });
  }

  // ==========================================================
  // NEAREST COURIER FIRST
  // ==========================================================

  candidates.sort((a, b) => a.distanceKm - b.distanceKm);

  return candidates;
}

// ============================================================
// CAPACITY CHECK
// ============================================================
//
// EXPRESS:
//
//     maximum 1 express assignment
//     cannot simultaneously carry batch assignments
//
// BATCH:
//
//     maximum 10 batch assignments
//     cannot simultaneously carry an express assignment
//
// ============================================================

function canAccept(courier, order) {
  const expressCount = Number(courier.currentExpressCount || 0);

  const batchCount = Number(courier.currentBatchCount || 0);

  const isExpress = isExpressOrder(order);

  const isBatch = isBatchOrder(order);

  // ==========================================================
  // INVALID
  // ==========================================================

  if (!isExpress && !isBatch) {
    return false;
  }

  // ==========================================================
  // EXPRESS
  // ==========================================================

  if (isExpress) {
    if (expressCount >= MAX_EXPRESS_JOBS) {
      return false;
    }

    // --------------------------------------------------------
    // Express courier cannot simultaneously have batch jobs.
    // --------------------------------------------------------

    if (batchCount !== 0) {
      return false;
    }

    return true;
  }

  // ==========================================================
  // BATCH
  // ==========================================================

  if (isBatch) {
    // --------------------------------------------------------
    // Batch courier cannot simultaneously have express jobs.
    // --------------------------------------------------------

    if (expressCount !== 0) {
      return false;
    }

    if (batchCount >= MAX_BATCH_JOBS) {
      return false;
    }

    return true;
  }

  return false;
}

// ============================================================
// SLEEP
// ============================================================
//
// Used only for short SQS retry delays.
//
// This is NOT an assignment retry.
//
// ============================================================

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// ============================================================
// END OF PART 2
// ============================================================
//
// FINAL ASSIGNMENT FLOW:
//
//     Courier #1
//          ↓
//     assignmentAttempts = 1
//          ↓
//     25 seconds
//          ↓
//     reassignOrder
//          ↓
//     Courier #2
//          ↓
//     assignmentAttempts = 2
//          ↓
//     25 seconds
//          ↓
//     ...
//          ↓
//     Courier #10
//          ↓
//     assignmentAttempts = 10
//          ↓
//     25 seconds
//          ↓
//     reassignOrder
//          ↓
//     Courier #11
//          ↓
//     assignmentAttempts = 11
//          ↓
//     25 seconds
//          ↓
//     ...
//          ↓
//     Continue while eligible couriers exist
//
// If NO eligible courier exists:
//
//          ↓
//     RELEASE EXPIRED COURIER
//          ↓
//     assignmentStatus = READY
//          ↓
//     assignedCourierId = null
//          ↓
//     assignmentExpiresAt = null
//          ↓
//     hasNewOffer = false
//          ↓
//     NO NEW SQS MESSAGE
//
// This stops the current SQS chain without imposing an
// artificial maximum number of courier attempts.
//
// ============================================================

// ============================================================
// OPTIONAL EXPORTS
// ============================================================
//
// These are useful if you want the functions available for
// Lambda testing or debugging.
//
// They do NOT affect the normal handler flow.
//
// ============================================================

exports.getOrder = getOrder;

exports.findEligibleCouriers = findEligibleCouriers;

exports.updateOrderAssignment =
  typeof updateOrderAssignment !== "undefined"
    ? updateOrderAssignment
    : undefined;

exports.verifyAssignmentInDynamoDB =
  typeof verifyAssignmentInDynamoDB !== "undefined"
    ? verifyAssignmentInDynamoDB
    : undefined;

exports.sendAssignmentExpiryMessage =
  typeof sendAssignmentExpiryMessage !== "undefined"
    ? sendAssignmentExpiryMessage
    : undefined;
