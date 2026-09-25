/* Amplify Params - DO NOT EDIT
	ENV
	REGION
Amplify Params - DO NOT EDIT */

/**
 * financialOrderTrigger
 *
 * PURPOSE
 * -------
 * This Lambda is the financial event router for Atua Orders.
 *
 * It is triggered by the Order DynamoDB Stream.
 *
 * It DOES NOT perform wallet, transaction, payout, or balance calculations.
 *
 * Instead, it determines which existing financial Lambda should handle
 * the Order event:
 *
 * 1. allocateCourierEarnings
 * 2. releaseFunds
 * 3. releaseCourierMilestoneFunds
 *
 *
 * FINANCIAL FLOW
 * --------------
 *
 * PAYMENT PAID + COURIER ASSIGNED
 *        ↓
 * allocateCourierEarnings
 *
 * MAXI + PICKED_UP
 *        ↓
 * releaseCourierMilestoneFunds
 *        milestone = PICKED_UP
 *
 * MICRO/MOTO + DELIVERED
 *        ↓
 * releaseFunds
 *
 * MAXI + DELIVERED
 *        ↓
 * releaseCourierMilestoneFunds
 *        milestone = DELIVERED
 *
 *
 * IMPORTANT ROUTING RULE
 * ----------------------
 *
 * MICRO and MOTO orders:
 *
 *     → releaseFunds
 *
 * MAXI orders:
 *
 *     → releaseCourierMilestoneFunds
 *
 * These release paths are completely separate.
 *
 * A MAXI order must NEVER invoke releaseFunds.
 *
 * A MICRO/MOTO order must NEVER invoke
 * releaseCourierMilestoneFunds.
 *
 *
 * IMPORTANT
 * ---------
 * earningsAllocationStatus can be NULL/undefined in actual Order records.
 *
 * Therefore:
 *
 *     null
 *     undefined
 *     ""
 *     NOT_ALLOCATED
 *
 * are treated as "not yet allocated".
 *
 * We deliberately do NOT force the Order field to NOT_ALLOCATED here.
 *
 *
 * IDEMPOTENCY
 * ----------
 * The existing financial Lambdas are responsible for protecting their own
 * financial operations.
 *
 * This trigger also checks state transitions so that an Order that remains
 * DELIVERED, for example, does not cause a release Lambda to be called again
 * on every unrelated Order modification.
 *
 *
 * DYNAMODB STREAM
 * ---------------
 * The Order table is configured with:
 *
 *     NEW_AND_OLD_IMAGES
 *
 * Therefore we can compare OldImage and NewImage.
 */

const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

const { unmarshall } = require("@aws-sdk/util-dynamodb");

// -----------------------------------------------------------------------------
// AWS CLIENT
// -----------------------------------------------------------------------------

const lambdaClient = new LambdaClient({
  region: process.env.REGION || process.env.AWS_REGION,
});

// -----------------------------------------------------------------------------
// ENVIRONMENT
// -----------------------------------------------------------------------------

/*
 * Amplify provides ENV to the Lambda.
 *
 * For the staging environment:
 *
 *     ENV = staging
 *
 * Therefore the existing Lambda names are:
 *
 *     allocateCourierEarnings-staging
 *     releaseFunds-staging
 *     releaseCourierMilestoneFunds-staging
 *
 * This keeps the trigger environment-aware and avoids hard-coding the
 * staging Lambda names.
 */

const ENVIRONMENT = process.env.ENV || "staging";

// -----------------------------------------------------------------------------
// TARGET LAMBDA NAMES
// -----------------------------------------------------------------------------

const ALLOCATE_EARNINGS_FUNCTION = `allocateCourierEarnings-${ENVIRONMENT}`;

const RELEASE_FUNDS_FUNCTION = `releaseFunds-${ENVIRONMENT}`;

const RELEASE_MAXI_MILESTONE_FUNCTION = `releaseCourierMilestoneFunds-${ENVIRONMENT}`;

// -----------------------------------------------------------------------------
// LOGGING
// -----------------------------------------------------------------------------

console.log("=================================================");
console.log("financialOrderTrigger loaded");
console.log("Environment:", ENVIRONMENT);
console.log("Allocate Lambda:", ALLOCATE_EARNINGS_FUNCTION);
console.log("Release Lambda:", RELEASE_FUNDS_FUNCTION);
console.log("MAXI Release Lambda:", RELEASE_MAXI_MILESTONE_FUNCTION);
console.log("=================================================");

// -----------------------------------------------------------------------------
// HELPER: SAFELY CONVERT DYNAMODB STREAM IMAGE
// -----------------------------------------------------------------------------

function unmarshallImage(image) {
  if (!image) {
    return null;
  }

  try {
    return unmarshall(image);
  } catch (error) {
    console.error("❌ Failed to unmarshall DynamoDB image:", error);

    throw error;
  }
}

// -----------------------------------------------------------------------------
// HELPER: GET ORDER ID
// -----------------------------------------------------------------------------

function getOrderId(order) {
  if (!order) {
    return null;
  }

  return order.id || null;
}

// -----------------------------------------------------------------------------
// HELPER: CHECK WHETHER EARNINGS ARE ALREADY ALLOCATED
// -----------------------------------------------------------------------------

/**
 * IMPORTANT:
 *
 * Your actual Order data can have earningsAllocationStatus empty/null.
 *
 * Therefore null/undefined/empty string is treated as NOT ALLOCATED.
 *
 * We also recognise the explicit enum value:
 *
 *     NOT_ALLOCATED
 *
 * as not allocated.
 */

function isEarningsNotAllocated(order) {
  if (!order) {
    return true;
  }

  const status = order.earningsAllocationStatus;

  return (
    status === null ||
    status === undefined ||
    status === "" ||
    status === "NOT_ALLOCATED"
  );
}

// -----------------------------------------------------------------------------
// HELPER: CHECK WHETHER EARNINGS ARE ALLOCATED
// -----------------------------------------------------------------------------

function isEarningsAllocated(order) {
  return order?.earningsAllocationStatus === "ALLOCATED";
}

// -----------------------------------------------------------------------------
// HELPER: CHECK PAYMENT
// -----------------------------------------------------------------------------

function isPaymentComplete(order) {
  return order?.paymentStatus === "PAID";
}

// -----------------------------------------------------------------------------
// HELPER: CHECK COURIER ASSIGNMENT
// -----------------------------------------------------------------------------

function hasAssignedCourier(order) {
  return Boolean(order?.assignedCourierId);
}

// -----------------------------------------------------------------------------
// HELPER: GET COURIER EARNINGS
// -----------------------------------------------------------------------------

function getCourierEarnings(order) {
  const earnings = Number(order?.courierEarnings);

  if (!Number.isFinite(earnings)) {
    return 0;
  }

  return earnings;
}

// -----------------------------------------------------------------------------
// HELPER: CHECK WHETHER ORDER IS MAXI
// -----------------------------------------------------------------------------

function isMaxiOrder(order) {
  const transportationType = String(order?.transportationType || "")
    .trim()
    .toUpperCase();

  return transportationType === "MAXI";
}

// -----------------------------------------------------------------------------
// HELPER: CHECK WHETHER ORDER IS MICRO
// -----------------------------------------------------------------------------

function isMicroOrder(order) {
  const transportationType = String(order?.transportationType || "")
    .trim()
    .toUpperCase();

  return (
    transportationType === "MICRO" || transportationType.startsWith("MICRO_")
  );
}

// -----------------------------------------------------------------------------
// HELPER: CHECK WHETHER ORDER IS MOTO
// -----------------------------------------------------------------------------

function isMotoOrder(order) {
  const transportationType = String(order?.transportationType || "")
    .trim()
    .toUpperCase();

  return (
    transportationType === "MOTO" || transportationType.startsWith("MOTO_")
  );
}

// -----------------------------------------------------------------------------
// HELPER: CHECK WHETHER ORDER IS MICRO/MOTO
// -----------------------------------------------------------------------------

function isMicroOrMotoOrder(order) {
  return isMicroOrder(order) || isMotoOrder(order);
}

// -----------------------------------------------------------------------------
// HELPER: INVOKE FINANCIAL LAMBDA
// -----------------------------------------------------------------------------

/**
 * Financial Lambda payloads:
 *
 * allocateCourierEarnings:
 *
 * {
 *   "orderID": "..."
 * }
 *
 *
 * releaseFunds:
 *
 * {
 *   "orderID": "..."
 * }
 *
 *
 * releaseCourierMilestoneFunds:
 *
 * {
 *   "orderID": "...",
 *   "milestone": "PICKED_UP"
 * }
 *
 * OR
 *
 * {
 *   "orderID": "...",
 *   "milestone": "DELIVERED"
 * }
 *
 *
 * IMPORTANT:
 *
 * - Micro/Moto MUST only invoke releaseFunds.
 * - Maxi MUST only invoke releaseCourierMilestoneFunds.
 * - Maxi milestone releases REQUIRE the milestone.
 *
 * We use RequestResponse so this trigger can see whether the target Lambda
 * invocation itself failed.
 *
 * The financial Lambda remains responsible for its own financial
 * idempotency and validation.
 */

async function invokeFinancialLambda({
  functionName,
  orderID,
  reason,
  milestone = null,
}) {
  if (!functionName) {
    throw new Error("Financial Lambda function name is missing.");
  }

  if (!orderID) {
    throw new Error("Cannot invoke financial Lambda without orderID.");
  }

  // ---------------------------------------------------------------------------
  // VALIDATE MAXI MILESTONE
  // ---------------------------------------------------------------------------

  /*
   * Only releaseCourierMilestoneFunds is allowed to receive a milestone.
   */

  if (functionName === RELEASE_MAXI_MILESTONE_FUNCTION) {
    if (milestone !== "PICKED_UP" && milestone !== "DELIVERED") {
      throw new Error(
        "MAXI milestone Lambda requires milestone PICKED_UP or DELIVERED.",
      );
    }
  }

  // ---------------------------------------------------------------------------
  // PREVENT MILESTONE FROM BEING SENT TO OTHER FINANCIAL LAMBDAS
  // ---------------------------------------------------------------------------

  /*
   * allocateCourierEarnings and releaseFunds do not use milestones.
   *
   * If a milestone accidentally reaches either Lambda, fail here rather than
   * sending an incorrect payload.
   */
  else if (milestone !== null && milestone !== undefined) {
    throw new Error(
      `Milestone was supplied to non-MAXI financial Lambda ${functionName}.`,
    );
  }

  // ---------------------------------------------------------------------------
  // BUILD PAYLOAD
  // ---------------------------------------------------------------------------

  const payload = {
    orderID,
  };

  /*
   * Only Maxi milestone releases get this property.
   */

  if (milestone) {
    payload.milestone = milestone;
  }

  // ---------------------------------------------------------------------------
  // LOG INVOCATION
  // ---------------------------------------------------------------------------

  console.log("-------------------------------------------------");
  console.log("Invoking financial Lambda");
  console.log("Reason:", reason);
  console.log("Function:", functionName);
  console.log("Order ID:", orderID);

  if (milestone) {
    console.log("Milestone:", milestone);
  }

  console.log("Payload:", JSON.stringify(payload));

  console.log("-------------------------------------------------");

  // ---------------------------------------------------------------------------
  // INVOKE TARGET LAMBDA
  // ---------------------------------------------------------------------------

  const command = new InvokeCommand({
    FunctionName: functionName,

    /*
     * RequestResponse allows us to detect an invocation/function error.
     */

    InvocationType: "RequestResponse",

    /*
     * Send the correctly constructed payload.
     */

    Payload: Buffer.from(JSON.stringify(payload)),
  });

  const response = await lambdaClient.send(command);

  console.log(
    "Lambda invocation response:",
    JSON.stringify({
      StatusCode: response.StatusCode,
      FunctionError: response.FunctionError,
    }),
  );

  // ---------------------------------------------------------------------------
  // AWS-LEVEL / LAMBDA-LEVEL FAILURE
  // ---------------------------------------------------------------------------

  if (response.FunctionError) {
    let responsePayload = null;

    if (response.Payload) {
      try {
        responsePayload = JSON.parse(Buffer.from(response.Payload).toString());
      } catch (parseError) {
        responsePayload = Buffer.from(response.Payload).toString();
      }
    }

    console.error(
      "❌ Financial Lambda reported an error:",
      JSON.stringify(responsePayload),
    );

    throw new Error(`Financial Lambda ${functionName} returned FunctionError.`);
  }

  console.log(`✅ Successfully invoked ${functionName} for Order ${orderID}`);

  return response;
}
// -----------------------------------------------------------------------------
// ALLOCATION DECISION
// -----------------------------------------------------------------------------

/**
 * Earnings allocation is allowed when:
 *
 * 1. Order is paid
 * 2. Courier is assigned
 * 3. Courier earnings > 0
 * 4. Earnings have not already been allocated
 *
 *
 * IMPORTANT:
 *
 * We do NOT require the Order status to be ACCEPTED.
 *
 * This is intentional.
 *
 * Payment and courier assignment can occur in separate Order updates.
 *
 * Therefore the trigger watches the Order stream and allocates as soon as
 * the required financial conditions are simultaneously true.
 */

function shouldAllocateEarnings(order) {
  if (!order) {
    return false;
  }

  // ---------------------------------------------------------------------------
  // PAYMENT MUST BE SUCCESSFUL
  // ---------------------------------------------------------------------------

  if (!isPaymentComplete(order)) {
    return false;
  }

  // ---------------------------------------------------------------------------
  // COURIER MUST BE ASSIGNED
  // ---------------------------------------------------------------------------

  if (!hasAssignedCourier(order)) {
    return false;
  }

  // ---------------------------------------------------------------------------
  // THERE MUST BE ACTUAL COURIER EARNINGS
  // ---------------------------------------------------------------------------

  const courierEarnings = getCourierEarnings(order);

  if (courierEarnings <= 0) {
    return false;
  }

  // ---------------------------------------------------------------------------
  // DO NOT ALLOCATE AGAIN
  // ---------------------------------------------------------------------------

  if (!isEarningsNotAllocated(order)) {
    return false;
  }

  return true;
}

// -----------------------------------------------------------------------------
// RELEASE DECISION
// -----------------------------------------------------------------------------

/**
 * We only release funds when the Order actually transitions into the
 * appropriate milestone.
 *
 * This prevents an unrelated later Order update from repeatedly calling
 * a release Lambda just because the status remains DELIVERED.
 */

function statusChangedTo(oldOrder, newOrder, status) {
  return newOrder?.status === status && oldOrder?.status !== status;
}

// -----------------------------------------------------------------------------
// PROCESS ONE STREAM RECORD
// -----------------------------------------------------------------------------

async function processRecord(record) {
  if (!record) {
    return {
      processed: false,
      reason: "Missing record",
    };
  }

  // ===========================================================================
  // 1. ONLY MODIFY EVENTS ARE RELEVANT
  // ===========================================================================

  /*
   * The financial trigger is watching changes to existing Orders.
   */

  if (record.eventName !== "MODIFY") {
    console.log(`Skipping ${record.eventName} event.`);

    return {
      processed: false,
      reason: `Ignored event type ${record.eventName}`,
    };
  }

  // ===========================================================================
  // 2. DYNAMODB STREAM MUST CONTAIN NEW IMAGE
  // ===========================================================================

  if (!record.dynamodb?.NewImage) {
    console.log("Skipping MODIFY event because NewImage is missing.");

    return {
      processed: false,
      reason: "NewImage missing",
    };
  }

  // ===========================================================================
  // 3. CONVERT DYNAMODB IMAGES
  // ===========================================================================

  const newOrder = unmarshallImage(record.dynamodb.NewImage);

  const oldOrder = unmarshallImage(record.dynamodb.OldImage);

  const orderID = getOrderId(newOrder);

  // ===========================================================================
  // LOG ORDER INFORMATION
  // ===========================================================================

  console.log("=================================================");
  console.log("Processing Order Stream record");
  console.log("Order ID:", orderID);
  console.log("Event ID:", record.eventID);
  console.log("Old status:", oldOrder?.status);
  console.log("New status:", newOrder?.status);
  console.log("Transportation type:", newOrder?.transportationType);
  console.log("Payment status:", newOrder?.paymentStatus);
  console.log("Assigned courier:", newOrder?.assignedCourierId);
  console.log("Courier earnings:", newOrder?.courierEarnings);
  console.log(
    "Earnings allocation status:",
    newOrder?.earningsAllocationStatus,
  );
  console.log("=================================================");

  // ===========================================================================
  // 4. ORDER ID IS REQUIRED
  // ===========================================================================

  if (!orderID) {
    console.warn("⚠️ Order ID is missing. Skipping record.");

    return {
      processed: false,
      reason: "Order ID missing",
    };
  }

  // ===========================================================================
  // 5. ALLOCATE COURIER EARNINGS
  // ===========================================================================

  /**
   * This check is intentionally independent of status transitions.
   *
   * Example:
   *
   * Update 1:
   *     paymentStatus = PAID
   *     assignedCourierId = null
   *
   *     → Cannot allocate yet.
   *
   *
   * Update 2:
   *     paymentStatus = PAID
   *     assignedCourierId = courier123
   *
   *     → Allocation should now happen.
   *
   *
   * Another example:
   *
   * Update 1:
   *     assignedCourierId = courier123
   *     paymentStatus = PENDING
   *
   *     → Cannot allocate.
   *
   *
   * Update 2:
   *     paymentStatus = PAID
   *
   *     → Allocation should now happen.
   */

  if (shouldAllocateEarnings(newOrder)) {
    console.log("💰 Allocation conditions satisfied.");

    await invokeFinancialLambda({
      functionName: ALLOCATE_EARNINGS_FUNCTION,

      orderID,

      reason:
        "Order is PAID, has an assigned courier, has courier earnings, and earningsAllocationStatus is not allocated.",
    });
  } else {
    console.log("ℹ️ Courier earnings allocation not required for this record.");
  }

  // ===========================================================================
  // IMPORTANT RELEASE ROUTING RULE
  // ===========================================================================
  //
  // There are two completely separate release systems:
  //
  // MICRO / MOTO
  //     ↓
  // releaseFunds
  //
  // MAXI
  //     ↓
  // releaseCourierMilestoneFunds
  //
  //
  // A MAXI order MUST NEVER be sent to releaseFunds.
  //
  // A MICRO/MOTO order MUST NEVER be sent to
  // releaseCourierMilestoneFunds.
  //
  // ===========================================================================

  // ===========================================================================
  // 6. MAXI PICKUP MILESTONE
  // ===========================================================================

  /**
   * MAXI earnings are released in milestones.
   *
   * At PICKED_UP:
   *
   *     50% is released.
   *
   * The actual 50% calculation is performed by:
   *
   *     releaseCourierMilestoneFunds
   *
   * This trigger only routes the event.
   *
   * IMPORTANT:
   *
   * The milestone MUST be included in the Lambda payload.
   */

  if (
    isMaxiOrder(newOrder) &&
    statusChangedTo(oldOrder, newOrder, "PICKED_UP")
  ) {
    console.log("🚚 MAXI PICKED_UP milestone detected.");

    console.log(
      "Routing MAXI pickup exclusively to releaseCourierMilestoneFunds.",
    );

    await invokeFinancialLambda({
      // -----------------------------------------------------------------------
      // IMPORTANT:
      //
      // MAXI orders use the milestone release Lambda.
      //
      // They must NOT use releaseFunds.
      // -----------------------------------------------------------------------

      functionName: RELEASE_MAXI_MILESTONE_FUNCTION,

      orderID,

      // -----------------------------------------------------------------------
      // REQUIRED BY releaseCourierMilestoneFunds
      // -----------------------------------------------------------------------

      milestone: "PICKED_UP",

      reason:
        "MAXI order transitioned to PICKED_UP; releaseCourierMilestoneFunds should release the pickup milestone.",
    });
  }

  // ===========================================================================
  // 7. MICRO/MOTO DELIVERY
  // ===========================================================================

  /**
   * Micro and Moto orders release the courier's full earnings when
   * the Order reaches DELIVERED.
   *
   * The actual wallet movement is performed by:
   *
   *     releaseFunds
   *
   *
   * IMPORTANT:
   *
   * This condition specifically checks MICRO/MOTO.
   *
   * Therefore a MAXI order cannot enter this block.
   */

  if (
    isMicroOrMotoOrder(newOrder) &&
    statusChangedTo(oldOrder, newOrder, "DELIVERED")
  ) {
    console.log("✅ MICRO/MOTO DELIVERED milestone detected.");

    console.log("Routing MICRO/MOTO order exclusively to releaseFunds.");

    await invokeFinancialLambda({
      // -----------------------------------------------------------------------
      // IMPORTANT:
      //
      // Micro and Moto use the normal full-release Lambda.
      //
      // They must NOT invoke releaseCourierMilestoneFunds.
      // -----------------------------------------------------------------------

      functionName: RELEASE_FUNDS_FUNCTION,

      orderID,

      /*
       * No milestone is sent here.
       *
       * releaseFunds only needs orderID.
       */

      reason:
        "MICRO/MOTO order transitioned to DELIVERED; releaseFunds should release the courier's earnings.",
    });
  }

  // ===========================================================================
  // 8. MAXI DELIVERY
  // ===========================================================================

  /**
   * MAXI delivery releases the remaining amount.
   *
   * If 50% was released at pickup, this call releases the remaining 50%.
   *
   * The actual calculation is handled by:
   *
   *     releaseCourierMilestoneFunds
   *
   *
   * IMPORTANT:
   *
   * This condition specifically checks MAXI.
   *
   * Therefore a Micro/Moto order cannot enter this block.
   */

  if (
    isMaxiOrder(newOrder) &&
    statusChangedTo(oldOrder, newOrder, "DELIVERED")
  ) {
    console.log("🏁 MAXI DELIVERED milestone detected.");

    console.log(
      "Routing MAXI delivery exclusively to releaseCourierMilestoneFunds.",
    );

    await invokeFinancialLambda({
      // -----------------------------------------------------------------------
      // IMPORTANT:
      //
      // Maxi orders use milestone-based releases.
      //
      // They must NOT invoke releaseFunds.
      // -----------------------------------------------------------------------

      functionName: RELEASE_MAXI_MILESTONE_FUNCTION,

      orderID,

      // -----------------------------------------------------------------------
      // REQUIRED BY releaseCourierMilestoneFunds
      // -----------------------------------------------------------------------

      milestone: "DELIVERED",

      reason:
        "MAXI order transitioned to DELIVERED; releaseCourierMilestoneFunds should release the remaining courier earnings.",
    });
  }

  // ===========================================================================
  // FINISHED
  // ===========================================================================

  console.log(`✅ Finished processing financial events for Order ${orderID}`);

  return {
    processed: true,
    orderID,
  };
}

// -----------------------------------------------------------------------------
// MAIN HANDLER
// -----------------------------------------------------------------------------

exports.handler = async (event) => {
  console.log("");
  console.log("=================================================");
  console.log("💰 financialOrderTrigger START");
  console.log("=================================================");

  console.log("Received records:", event?.Records?.length || 0);

  // ===========================================================================
  // VALIDATE DYNAMODB STREAM EVENT
  // ===========================================================================

  if (!event || !Array.isArray(event.Records)) {
    console.warn("⚠️ Event does not contain DynamoDB Stream Records.");

    return {
      batchItemFailures: [],
    };
  }

  // ===========================================================================
  // PROCESS EVERY STREAM RECORD
  // ===========================================================================

  /*
   * DynamoDB Streams can deliver multiple records in one Lambda invocation.
   *
   * We process every record rather than only Records[0].
   */

  const batchItemFailures = [];

  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (error) {
      console.error("❌ Failed to process stream record:", record.eventID);

      console.error("Error:", error);

      // -----------------------------------------------------------------------
      // REPORT THIS PARTICULAR RECORD AS FAILED
      // -----------------------------------------------------------------------
      //
      // Our EventSourceMapping uses:
      //
      //     ReportBatchItemFailures
      //
      // so DynamoDB Streams can retry the failed record.
      // -----------------------------------------------------------------------

      if (record.eventID) {
        batchItemFailures.push({
          itemIdentifier: record.eventID,
        });
      } else {
        /*
         * If AWS did not provide an event ID, rethrowing causes the whole
         * batch to be retried.
         */

        throw error;
      }
    }
  }

  // ===========================================================================
  // FINAL RESULT
  // ===========================================================================

  console.log("=================================================");
  console.log("financialOrderTrigger FINISHED");
  console.log("Failed records:", batchItemFailures.length);
  console.log("=================================================");

  return {
    batchItemFailures,
  };
};
