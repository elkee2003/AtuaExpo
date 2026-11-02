/* Amplify Params - DO NOT EDIT
    ENV
    REGION
Amplify Params - DO NOT EDIT */

/**
 * financialOrderTrigger
 *
 * PURPOSE
 * -------
 * Routes Order DynamoDB Stream events to the correct financial Lambdas.
 *
 * This Lambda does NOT:
 * - Calculate courier earnings.
 * - Move wallet balances.
 * - Create financial ledger transactions directly.
 * - Process Paystack payments itself.
 *
 * It routes financial operations to:
 * 1. allocateCourierEarnings
 * 2. releaseFunds
 * 3. releaseCourierMilestoneFunds
 *
 *
 * FINANCIAL ROUTING
 * -----------------
 *
 * PAYMENT PAID + COURIER ASSIGNED + VALID EARNINGS
 *     -> allocateCourierEarnings
 *
 * MICRO/MOTO + DELIVERED + FINANCIAL CONDITIONS READY
 *     -> releaseFunds
 *
 * MAXI + PICKED_UP + FINANCIAL CONDITIONS READY
 *     -> releaseCourierMilestoneFunds
 *        milestone: PICKED_UP
 *
 * MAXI + DELIVERED + FINANCIAL CONDITIONS READY
 *     -> releaseCourierMilestoneFunds
 *        milestone: DELIVERED
 *
 *
 * IMPORTANT
 * ---------
 * MAXI must NEVER invoke releaseFunds.
 *
 * MICRO/MOTO must NEVER invoke
 * releaseCourierMilestoneFunds.
 *
 * This Lambda relies on DynamoDB Streams NEW_AND_OLD_IMAGES.
 *
 * The DynamoDB event source mapping must enable
 * ReportBatchItemFailures for batchItemFailures to work.
 */

const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { unmarshall } = require("@aws-sdk/util-dynamodb");

// =============================================================================
// 1. AWS LAMBDA CLIENT
// =============================================================================

const lambdaClient = new LambdaClient({
  region: process.env.REGION || process.env.AWS_REGION,
});

// =============================================================================
// 2. ENVIRONMENT AND TARGET LAMBDA NAMES
// =============================================================================

/*
 * Example:
 * ENV = staging
 *
 * Target Lambdas:
 * allocateCourierEarnings-staging
 * releaseFunds-staging
 * releaseCourierMilestoneFunds-staging
 *
 * Confirm these names match the deployed Lambda function names in your AWS
 * environment before deployment.
 */

const ENVIRONMENT = process.env.ENV || "staging";

const ALLOCATE_EARNINGS_FUNCTION = `allocateCourierEarnings-${ENVIRONMENT}`;

const RELEASE_FUNDS_FUNCTION = `releaseFunds-${ENVIRONMENT}`;

const RELEASE_MAXI_MILESTONE_FUNCTION = `releaseCourierMilestoneFunds-${ENVIRONMENT}`;

console.log("=================================================");
console.log("financialOrderTrigger loaded");
console.log("Environment:", ENVIRONMENT);
console.log("Allocate Lambda:", ALLOCATE_EARNINGS_FUNCTION);
console.log("Release Lambda:", RELEASE_FUNDS_FUNCTION);
console.log("MAXI Release Lambda:", RELEASE_MAXI_MILESTONE_FUNCTION);
console.log("=================================================");

// =============================================================================
// 3. DYNAMODB STREAM IMAGE HELPERS
// =============================================================================

/**
 * Converts a DynamoDB Stream image into a normal JavaScript object.
 *
 * A missing image returns null.
 * An invalid image throws an error so the stream record can be retried.
 */
function unmarshallImage(image) {
  if (!image) {
    return null;
  }

  try {
    return unmarshall(image);
  } catch (error) {
    console.error("Failed to unmarshall DynamoDB image:", error);
    throw error;
  }
}

/**
 * Gets the Order primary identifier.
 *
 * This assumes the Order model's primary identifier is `id`.
 */
function getOrderId(order) {
  return order?.id || null;
}

// =============================================================================
// 4. ORDER FINANCIAL-STATE HELPERS
// =============================================================================

/**
 * Treat null, undefined, empty string, and NOT_ALLOCATED as not allocated.
 *
 * We do not modify the Order's allocation status in this trigger.
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

/**
 * Checks whether the Order explicitly reports allocated earnings.
 */
function isEarningsAllocated(order) {
  return order?.earningsAllocationStatus === "ALLOCATED";
}

/**
 * Payment is considered complete only when the Order says PAID.
 */
function isPaymentComplete(order) {
  return order?.paymentStatus === "PAID";
}

/**
 * The courier must already be assigned.
 */
function hasAssignedCourier(order) {
  return Boolean(order?.assignedCourierId);
}

/**
 * Returns the courier earnings as a number.
 *
 * Invalid or missing values become zero and cannot trigger allocation.
 */
function getCourierEarnings(order) {
  const earnings = Number(order?.courierEarnings);

  if (!Number.isFinite(earnings)) {
    return 0;
  }

  return earnings;
}

// =============================================================================
// 5. TRANSPORTATION-TYPE HELPERS
// =============================================================================

function getTransportationType(order) {
  return String(order?.transportationType || "")
    .trim()
    .toUpperCase();
}

function isMaxiOrder(order) {
  return getTransportationType(order) === "MAXI";
}

function isMicroOrder(order) {
  const type = getTransportationType(order);

  return type === "MICRO" || type.startsWith("MICRO_");
}

function isMotoOrder(order) {
  const type = getTransportationType(order);

  return type === "MOTO" || type.startsWith("MOTO_");
}

function isMicroOrMotoOrder(order) {
  return isMicroOrder(order) || isMotoOrder(order);
}

// =============================================================================
// 6. CHANGE-DETECTION HELPERS
// =============================================================================

/**
 * Returns true when the Order enters a specified status.
 *
 * Example:
 * Old status: ACCEPTED
 * New status: PICKED_UP
 *
 * statusChangedTo(oldOrder, newOrder, "PICKED_UP") returns true.
 */
function statusChangedTo(oldOrder, newOrder, status) {
  return newOrder?.status === status && oldOrder?.status !== status;
}

/**
 * Detects when payment changes from a non-PAID state to PAID.
 *
 * This is important when payment is confirmed after the Order has already
 * reached a milestone.
 */
function paymentBecamePaid(oldOrder, newOrder) {
  return (
    newOrder?.paymentStatus === "PAID" && oldOrder?.paymentStatus !== "PAID"
  );
}

/**
 * Detects when courier earnings become allocated.
 *
 * A financial release may have been attempted before allocation completed.
 * This change allows the trigger to reconsider the applicable release.
 */
function earningsBecameAllocated(oldOrder, newOrder) {
  return isEarningsAllocated(newOrder) && !isEarningsAllocated(oldOrder);
}

/**
 * Determines whether a financial milestone should be reconsidered.
 *
 * It must still be the specified Order status.
 *
 * The release is reconsidered when:
 * - The Order newly enters that status.
 * - Payment newly becomes PAID.
 * - Earnings newly become ALLOCATED.
 *
 * This avoids calling the release Lambda on every unrelated Order update.
 */
function shouldRetryFinancialMilestone(oldOrder, newOrder, status) {
  if (newOrder?.status !== status) {
    return false;
  }

  return (
    statusChangedTo(oldOrder, newOrder, status) ||
    paymentBecamePaid(oldOrder, newOrder) ||
    earningsBecameAllocated(oldOrder, newOrder)
  );
}

// =============================================================================
// 7. ALLOCATION ELIGIBILITY
// =============================================================================

/**
 * Earnings allocation is eligible only when:
 *
 * 1. Payment is PAID.
 * 2. A courier is assigned.
 * 3. Courier earnings are greater than zero.
 * 4. Earnings are not already allocated.
 *
 * This intentionally does not require a particular Order status.
 *
 * Payment confirmation and courier assignment can happen in separate updates.
 */
function shouldAllocateEarnings(order) {
  if (!order) {
    return false;
  }

  if (!isPaymentComplete(order)) {
    return false;
  }

  if (!hasAssignedCourier(order)) {
    return false;
  }

  if (getCourierEarnings(order) <= 0) {
    return false;
  }

  if (!isEarningsNotAllocated(order)) {
    return false;
  }

  return true;
}

// =============================================================================
// 8. FINANCIAL LAMBDA INVOCATION
// =============================================================================

/**
 * Calls the relevant financial Lambda synchronously.
 *
 * RequestResponse allows this trigger to inspect the result.
 *
 * IMPORTANT:
 * A successful AWS invocation does not always mean the target financial
 * operation succeeded. A target Lambda can return { statusCode: 500 } or
 * { success: false } without producing an AWS FunctionError.
 *
 * We inspect both the Lambda invocation result and the returned payload.
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

  // -------------------------------------------------------------------------
  // Validate MAXI milestone payloads.
  // -------------------------------------------------------------------------

  if (functionName === RELEASE_MAXI_MILESTONE_FUNCTION) {
    if (milestone !== "PICKED_UP" && milestone !== "DELIVERED") {
      throw new Error(
        "MAXI milestone Lambda requires milestone PICKED_UP or DELIVERED.",
      );
    }
  } else if (milestone !== null && milestone !== undefined) {
    // Other financial Lambdas must not receive a milestone.
    throw new Error(
      `Milestone was supplied to non-MAXI financial Lambda ${functionName}.`,
    );
  }

  // -------------------------------------------------------------------------
  // Build the payload.
  // -------------------------------------------------------------------------

  const payload = {
    orderID,
  };

  if (milestone) {
    payload.milestone = milestone;
  }

  // -------------------------------------------------------------------------
  // Log the request.
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Invoke the target Lambda.
  // -------------------------------------------------------------------------

  const command = new InvokeCommand({
    FunctionName: functionName,
    InvocationType: "RequestResponse",
    Payload: Buffer.from(JSON.stringify(payload)),
  });

  const response = await lambdaClient.send(command);

  console.log(
    "Lambda invocation metadata:",
    JSON.stringify({
      StatusCode: response.StatusCode,
      FunctionError: response.FunctionError || null,
    }),
  );

  // -------------------------------------------------------------------------
  // Parse the target Lambda's returned payload, if any.
  // -------------------------------------------------------------------------

  let responsePayload = null;

  if (response.Payload) {
    const rawPayload = Buffer.from(response.Payload).toString();

    try {
      responsePayload = JSON.parse(rawPayload);
    } catch (error) {
      // Keep unparseable output for diagnostics.
      responsePayload = rawPayload;
    }
  }

  // -------------------------------------------------------------------------
  // Detect AWS/Lambda execution errors.
  // -------------------------------------------------------------------------

  if (response.FunctionError) {
    console.error(
      "Financial Lambda reported FunctionError:",
      JSON.stringify(responsePayload),
    );

    throw new Error(`Financial Lambda ${functionName} returned FunctionError.`);
  }

  // -------------------------------------------------------------------------
  // Detect business errors returned inside the response payload.
  // -------------------------------------------------------------------------

  /*
   * Some Lambdas return HTTP-style responses:
   *
   * {
   *   statusCode: 500,
   *   body: "{\"success\":false,\"message\":\"...\"}"
   * }
   *
   * A statusCode of 500 does not automatically set response.FunctionError.
   * Therefore we inspect statusCode and success explicitly.
   */

  let businessPayload = responsePayload;

  if (
    responsePayload &&
    typeof responsePayload === "object" &&
    typeof responsePayload.body === "string"
  ) {
    try {
      businessPayload = JSON.parse(responsePayload.body);
    } catch (error) {
      // The body may be plain text; preserve the outer response.
      businessPayload = responsePayload;
    }
  }

  const returnedStatusCode = Number(responsePayload?.statusCode);

  const returnedBusinessFailure =
    (Number.isFinite(returnedStatusCode) && returnedStatusCode >= 400) ||
    responsePayload?.success === false ||
    businessPayload?.success === false;

  if (returnedBusinessFailure) {
    console.error(
      "Financial Lambda returned an unsuccessful result:",
      JSON.stringify(responsePayload),
    );

    throw new Error(
      `Financial Lambda ${functionName} returned an unsuccessful result.`,
    );
  }

  console.log(`Successfully invoked ${functionName} for Order ${orderID}`);

  return response;
}

// =============================================================================
// 9. PROCESS ONE DYNAMODB STREAM RECORD
// =============================================================================

async function processRecord(record) {
  if (!record) {
    return {
      processed: false,
      reason: "Missing record",
    };
  }

  // -------------------------------------------------------------------------
  // Only MODIFY events are processed.
  // -------------------------------------------------------------------------

  if (record.eventName !== "MODIFY") {
    console.log(`Skipping ${record.eventName} event.`);

    return {
      processed: false,
      reason: `Ignored event type ${record.eventName}`,
    };
  }

  // -------------------------------------------------------------------------
  // The new image is required.
  // -------------------------------------------------------------------------

  if (!record.dynamodb?.NewImage) {
    console.log("Skipping MODIFY event because NewImage is missing.");

    return {
      processed: false,
      reason: "NewImage missing",
    };
  }

  // -------------------------------------------------------------------------
  // Convert the old and new DynamoDB images.
  // -------------------------------------------------------------------------

  const newOrder = unmarshallImage(record.dynamodb.NewImage);
  const oldOrder = unmarshallImage(record.dynamodb.OldImage);

  const orderID = getOrderId(newOrder);

  // -------------------------------------------------------------------------
  // Log the important state for troubleshooting.
  // -------------------------------------------------------------------------

  console.log("=================================================");
  console.log("Processing Order Stream record");
  console.log("Order ID:", orderID);
  console.log("Event ID:", record.eventID);
  console.log("Old status:", oldOrder?.status);
  console.log("New status:", newOrder?.status);
  console.log("Transportation type:", newOrder?.transportationType);
  console.log("Old payment status:", oldOrder?.paymentStatus);
  console.log("New payment status:", newOrder?.paymentStatus);
  console.log("Assigned courier:", newOrder?.assignedCourierId);
  console.log("Courier earnings:", newOrder?.courierEarnings);
  console.log(
    "Old earnings allocation status:",
    oldOrder?.earningsAllocationStatus,
  );
  console.log(
    "New earnings allocation status:",
    newOrder?.earningsAllocationStatus,
  );
  console.log("=================================================");

  if (!orderID) {
    console.warn("Order ID is missing. Skipping record.");

    return {
      processed: false,
      reason: "Order ID missing",
    };
  }

  // =========================================================================
  // 10. ALLOCATE COURIER EARNINGS
  // =========================================================================

  /*
   * Allocation is checked on every Order modification.
   *
   * Example:
   *
   * Update 1:
   * paymentStatus = PAID
   * assignedCourierId = null
   *
   * Allocation cannot happen yet.
   *
   * Update 2:
   * assignedCourierId = courier123
   *
   * Allocation can now happen, provided earnings are valid.
   *
   * The allocation Lambda must enforce its own idempotency because stream
   * records may be delivered more than once.
   */

  if (shouldAllocateEarnings(newOrder)) {
    console.log("Allocation conditions satisfied.");

    await invokeFinancialLambda({
      functionName: ALLOCATE_EARNINGS_FUNCTION,
      orderID,
      reason:
        "Order is PAID, has an assigned courier, has positive courier earnings, and earnings are not yet allocated.",
    });
  } else {
    console.log("Courier earnings allocation is not required for this record.");
  }

  // =========================================================================
  // 11. MAXI PICKUP MILESTONE
  // =========================================================================

  /*
   * MAXI orders use milestone-based release.
   *
   * At PICKED_UP, releaseCourierMilestoneFunds handles the pickup release.
   *
   * The trigger only routes the milestone; it does not calculate or move
   * the 50% amount itself.
   *
   * The release is reconsidered if:
   * - The Order enters PICKED_UP.
   * - Payment subsequently becomes PAID while the Order remains PICKED_UP.
   * - Earnings subsequently become ALLOCATED while the Order remains PICKED_UP.
   */

  if (
    isMaxiOrder(newOrder) &&
    shouldRetryFinancialMilestone(oldOrder, newOrder, "PICKED_UP")
  ) {
    console.log("MAXI PICKED_UP milestone detected or made eligible.");

    await invokeFinancialLambda({
      functionName: RELEASE_MAXI_MILESTONE_FUNCTION,
      orderID,
      milestone: "PICKED_UP",
      reason:
        "MAXI order is PICKED_UP and the milestone should be reconsidered after a status, payment, or allocation change.",
    });
  }

  // =========================================================================
  // 12. MICRO/MOTO DELIVERY RELEASE
  // =========================================================================

  /*
   * MICRO and MOTO orders use releaseFunds.
   *
   * MAXI orders cannot enter this block.
   *
   * The release is reconsidered if:
   * - The Order enters DELIVERED.
   * - Payment subsequently becomes PAID while the Order remains DELIVERED.
   * - Earnings subsequently become ALLOCATED while the Order remains DELIVERED.
   *
   * releaseFunds must verify the current Order state, payment, allocation,
   * courier, ledger, and wallet idempotency before releasing funds.
   */

  if (
    isMicroOrMotoOrder(newOrder) &&
    shouldRetryFinancialMilestone(oldOrder, newOrder, "DELIVERED")
  ) {
    console.log("MICRO/MOTO DELIVERED milestone detected or made eligible.");

    await invokeFinancialLambda({
      functionName: RELEASE_FUNDS_FUNCTION,
      orderID,
      reason:
        "MICRO/MOTO order is DELIVERED and the release should be reconsidered after a status, payment, or allocation change.",
    });
  }

  // =========================================================================
  // 13. MAXI DELIVERY RELEASE
  // =========================================================================

  /*
   * MAXI orders use releaseCourierMilestoneFunds for delivery.
   *
   * MAXI must NEVER invoke releaseFunds.
   *
   * The delivery milestone is reconsidered if:
   * - The Order enters DELIVERED.
   * - Payment subsequently becomes PAID while the Order remains DELIVERED.
   * - Earnings subsequently become ALLOCATED while the Order remains DELIVERED.
   *
   * IMPORTANT LIMITATION:
   *
   * This trigger only retries the milestone corresponding to the Order's
   * current status. If payment is not confirmed until AFTER the Order has
   * moved beyond PICKED_UP, this block alone does not recreate the missed
   * pickup release. releaseCourierMilestoneFunds must safely support
   * catch-up/reconciliation of missed milestones before this flow is
   * considered complete.
   */

  if (
    isMaxiOrder(newOrder) &&
    shouldRetryFinancialMilestone(oldOrder, newOrder, "DELIVERED")
  ) {
    console.log("MAXI DELIVERED milestone detected or made eligible.");

    await invokeFinancialLambda({
      functionName: RELEASE_MAXI_MILESTONE_FUNCTION,
      orderID,
      milestone: "DELIVERED",
      reason:
        "MAXI order is DELIVERED and the delivery milestone should be reconsidered after a status, payment, or allocation change.",
    });
  }

  // =========================================================================
  // 14. RECORD PROCESSED
  // =========================================================================

  console.log(`Finished processing financial events for Order ${orderID}`);

  return {
    processed: true,
    orderID,
  };
}

// =============================================================================
// 15. MAIN LAMBDA HANDLER
// =============================================================================

exports.handler = async (event) => {
  console.log("");
  console.log("=================================================");
  console.log("financialOrderTrigger START");
  console.log("=================================================");

  console.log("Received records:", event?.Records?.length || 0);

  // -------------------------------------------------------------------------
  // Validate the event.
  // -------------------------------------------------------------------------

  if (!event || !Array.isArray(event.Records)) {
    console.warn("Event does not contain DynamoDB Stream Records.");

    return {
      batchItemFailures: [],
    };
  }

  // -------------------------------------------------------------------------
  // Process every record.
  // -------------------------------------------------------------------------

  /*
   * If a financial Lambda invocation fails, processRecord throws.
   *
   * We report that stream record as failed so DynamoDB Streams can retry it,
   * provided the event source mapping enables ReportBatchItemFailures.
   */

  const batchItemFailures = [];

  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (error) {
      console.error("Failed to process stream record:", record?.eventID);

      console.error("Processing error:", error);

      if (record?.eventID) {
        batchItemFailures.push({
          itemIdentifier: record.eventID,
        });
      } else {
        // Without an event ID, fail the invocation so the batch retries.
        throw error;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Return the partial-batch failure response.
  // -------------------------------------------------------------------------

  console.log("=================================================");
  console.log("financialOrderTrigger FINISHED");
  console.log("Failed records:", batchItemFailures.length);
  console.log("=================================================");

  return {
    batchItemFailures,
  };
};
