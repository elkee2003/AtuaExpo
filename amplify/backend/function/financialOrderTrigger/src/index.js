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
 * This Lambda is a ROUTER. It does not:
 * - Calculate courier earnings.
 * - Update wallet balances.
 * - Create financial transactions.
 * - Process Paystack payments.
 * - Record cash collections.
 *
 * It routes to:
 * 1. allocateCourierEarnings
 * 2. releaseFunds
 * 3. releaseCourierMilestoneFunds
 *
 *
 * FINANCIAL RULES
 * ---------------
 * Only an order with:
 *
 *   paymentMethod === "PAYSTACK"
 *   paymentStatus === "PAID"
 *
 * may enter online earnings allocation or online funds release.
 *
 * CASH orders must NEVER enter these three online-funds paths.
 *
 * ALLOCATION:
 * - PAYSTACK
 * - PAID
 * - Courier assigned
 * - Positive courier earnings
 * - Allocation not yet completed
 *
 * MICRO / MOTO RELEASE:
 * - PAYSTACK
 * - PAID
 * - Earnings ALLOCATED
 * - Courier assigned
 * - Positive courier earnings
 * - Order DELIVERED
 *
 * MAXI RELEASE:
 * - Same financial eligibility as above.
 * - Uses releaseCourierMilestoneFunds only.
 * - PICKED_UP and DELIVERED are separate milestones.
 *
 *
 * IMPORTANT DEPLOYMENT REQUIREMENTS
 * ---------------------------------
 * 1. DynamoDB Stream view type must be NEW_AND_OLD_IMAGES.
 * 2. Event source mapping must enable ReportBatchItemFailures.
 * 3. Target financial Lambdas must enforce their own idempotency.
 * 4. The target Lambda names must match the deployed functions.
 * 5. This Lambda must have lambda:InvokeFunction permission for all
 *    three target functions.
 */

"use strict";

const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { unmarshall } = require("@aws-sdk/util-dynamodb");

// =============================================================================
// 1. ENVIRONMENT CONFIGURATION
// =============================================================================

const ENVIRONMENT = process.env.ENV || process.env.ENVIRONMENT;

if (!ENVIRONMENT || !String(ENVIRONMENT).trim()) {
  throw new Error(
    "Missing ENV environment variable. Set it to the deployed Amplify environment, for example staging or production.",
  );
}

const REGION = process.env.REGION || process.env.AWS_REGION;

const ALLOCATE_EARNINGS_FUNCTION =
  process.env.ALLOCATE_EARNINGS_FUNCTION_NAME ||
  `allocateCourierEarnings-${ENVIRONMENT}`;

const RELEASE_FUNDS_FUNCTION =
  process.env.RELEASE_FUNDS_FUNCTION_NAME || `releaseFunds-${ENVIRONMENT}`;

const RELEASE_MAXI_MILESTONE_FUNCTION =
  process.env.RELEASE_MAXI_MILESTONE_FUNCTION_NAME ||
  `releaseCourierMilestoneFunds-${ENVIRONMENT}`;

// =============================================================================
// 2. AWS CLIENT
// =============================================================================

const lambdaClient = new LambdaClient({
  ...(REGION ? { region: REGION } : {}),
  maxAttempts: 2,
});

// =============================================================================
// 3. STARTUP VALIDATION AND LOGGING
// =============================================================================

const TARGET_FUNCTIONS = [
  ALLOCATE_EARNINGS_FUNCTION,
  RELEASE_FUNDS_FUNCTION,
  RELEASE_MAXI_MILESTONE_FUNCTION,
];

for (const functionName of TARGET_FUNCTIONS) {
  if (typeof functionName !== "string" || !functionName.trim()) {
    throw new Error("A financial Lambda target name is invalid.");
  }
}

console.log("=================================================");
console.log("financialOrderTrigger loaded");
console.log("Environment:", ENVIRONMENT);
console.log("Region:", REGION || "AWS default region");
console.log("Allocation Lambda:", ALLOCATE_EARNINGS_FUNCTION);
console.log("Release Lambda:", RELEASE_FUNDS_FUNCTION);
console.log("MAXI milestone Lambda:", RELEASE_MAXI_MILESTONE_FUNCTION);
console.log("=================================================");

// =============================================================================
// 4. DYNAMODB STREAM IMAGE HELPERS
// =============================================================================

/**
 * Converts a DynamoDB Stream image into a JavaScript object.
 *
 * Missing images return null.
 * Invalid images throw so that the stream record is not silently lost.
 */
function unmarshallImage(image) {
  if (!image) {
    return null;
  }

  return unmarshall(image);
}

/**
 * Returns the Order ID.
 *
 * The current Order model uses `id` as its primary identifier.
 */
function getOrderId(order) {
  return order?.id || null;
}

/**
 * Checks whether the Order has been soft-deleted.
 */
function isDeletedOrder(order) {
  return order?._deleted === true;
}

// =============================================================================
// 5. PAYMENT ELIGIBILITY
// =============================================================================

/**
 * Only an explicitly PAYSTACK order can enter online financial processing.
 *
 * Missing paymentMethod is NOT treated as PAYSTACK.
 * CASH is always excluded.
 */
function isPaystackOrder(order) {
  return order?.paymentMethod === "PAYSTACK";
}

/**
 * The payment must be confirmed as PAID.
 */
function isPaymentComplete(order) {
  return order?.paymentStatus === "PAID";
}

/**
 * Both conditions must be true before online financial processing.
 */
function isPaystackPaymentComplete(order) {
  return (
    !isDeletedOrder(order) && isPaystackOrder(order) && isPaymentComplete(order)
  );
}

// =============================================================================
// 6. EARNINGS ALLOCATION STATE
// =============================================================================

/**
 * Allocation can be attempted when the status is:
 *
 * - null / undefined
 * - empty string
 * - NOT_ALLOCATED
 * - FAILED
 *
 * FAILED is included because allocateCourierEarnings supports recovery
 * of a failed allocation when its transaction state permits a safe retry.
 *
 * PROCESSING is deliberately excluded. A PROCESSING allocation must not
 * be started again automatically because its previous wallet operation
 * may have an uncertain outcome.
 *
 * ALLOCATED is excluded because it is already complete.
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
    status === "NOT_ALLOCATED" ||
    status === "FAILED"
  );
}

/**
 * Checks whether earnings have been allocated successfully.
 */
function isEarningsAllocated(order) {
  return order?.earningsAllocationStatus === "ALLOCATED";
}

// =============================================================================
// 7. COURIER AND EARNINGS VALIDATION
// =============================================================================

function hasAssignedCourier(order) {
  return Boolean(
    order?.assignedCourierId && String(order.assignedCourierId).trim(),
  );
}

/**
 * Converts courier earnings to a finite number.
 *
 * Missing, invalid, zero, and negative earnings are not eligible.
 */
function getCourierEarnings(order) {
  const earnings = Number(order?.courierEarnings);

  if (!Number.isFinite(earnings)) {
    return 0;
  }

  return earnings;
}

function hasPositiveCourierEarnings(order) {
  return getCourierEarnings(order) > 0;
}

// =============================================================================
// 8. TRANSPORTATION-TYPE HELPERS
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
// 9. ALLOCATION ELIGIBILITY
// =============================================================================

/**
 * Determines whether the Order should be sent to allocateCourierEarnings.
 *
 * This function intentionally does not require a particular Order status.
 * Payment confirmation and courier assignment can happen in separate
 * database updates.
 *
 * Examples:
 *
 * 1. Payment becomes PAID, but no courier is assigned yet.
 *    No allocation.
 *
 * 2. Courier is assigned later.
 *    Allocation becomes eligible.
 *
 * 3. Payment method is CASH.
 *    No allocation.
 *
 * 4. Payment method is missing.
 *    No allocation.
 *
 * 5. Allocation status is PROCESSING.
 *    No automatic duplicate allocation.
 */
function shouldAllocateEarnings(order) {
  if (!order || isDeletedOrder(order)) {
    return false;
  }

  if (!isPaystackPaymentComplete(order)) {
    return false;
  }

  if (!hasAssignedCourier(order)) {
    return false;
  }

  if (!hasPositiveCourierEarnings(order)) {
    return false;
  }

  if (!isEarningsNotAllocated(order)) {
    return false;
  }

  return true;
}

// =============================================================================
// 10. RELEASE ELIGIBILITY
// =============================================================================

/**
 * A release must not be attempted until allocation is complete.
 *
 * The release Lambdas also validate their own financial conditions.
 * This trigger-level check prevents unnecessary calls and ensures CASH
 * orders cannot reach online release processing.
 */
function isReadyForOnlineRelease(order) {
  if (!order || isDeletedOrder(order)) {
    return false;
  }

  if (!isPaystackPaymentComplete(order)) {
    return false;
  }

  if (!isEarningsAllocated(order)) {
    return false;
  }

  if (!hasAssignedCourier(order)) {
    return false;
  }

  if (!hasPositiveCourierEarnings(order)) {
    return false;
  }

  return true;
}

// =============================================================================
// 11. CHANGE-DETECTION HELPERS
// =============================================================================

function statusChangedTo(oldOrder, newOrder, status) {
  return newOrder?.status === status && oldOrder?.status !== status;
}

function paymentBecamePaid(oldOrder, newOrder) {
  return (
    newOrder?.paymentStatus === "PAID" && oldOrder?.paymentStatus !== "PAID"
  );
}

function paymentMethodBecamePaystack(oldOrder, newOrder) {
  return (
    newOrder?.paymentMethod === "PAYSTACK" &&
    oldOrder?.paymentMethod !== "PAYSTACK"
  );
}

function earningsBecameAllocated(oldOrder, newOrder) {
  return isEarningsAllocated(newOrder) && !isEarningsAllocated(oldOrder);
}

/**
 * Detects when an administrator removes a funds-release hold.
 *
 * This allows a previously held order to be reconsidered.
 */
function fundsReleaseWasUnblocked(oldOrder, newOrder) {
  return (
    oldOrder?.fundsReleaseBlocked === true &&
    newOrder?.fundsReleaseBlocked !== true
  );
}

/**
 * Determines whether the financial milestone should be reconsidered.
 *
 * The Order must:
 * - Currently have the requested status.
 * - Be a confirmed PAYSTACK payment.
 * - Have allocated earnings.
 * - Have an assigned courier.
 * - Have positive courier earnings.
 *
 * It is reconsidered when:
 * - The Order enters the milestone status.
 * - Payment becomes PAID.
 * - Payment method becomes PAYSTACK.
 * - Earnings become ALLOCATED.
 * - A funds-release hold is removed.
 *
 * If OldImage is unavailable, the current eligible state is sufficient
 * for a first attempt. The target Lambda must remain idempotent.
 */
function shouldRetryFinancialMilestone(oldOrder, newOrder, status) {
  if (!newOrder || newOrder.status !== status) {
    return false;
  }

  if (!isReadyForOnlineRelease(newOrder)) {
    return false;
  }

  // Missing OldImage: attempt based on the current eligible state.
  if (!oldOrder) {
    return true;
  }

  return (
    statusChangedTo(oldOrder, newOrder, status) ||
    paymentBecamePaid(oldOrder, newOrder) ||
    paymentMethodBecamePaystack(oldOrder, newOrder) ||
    earningsBecameAllocated(oldOrder, newOrder) ||
    fundsReleaseWasUnblocked(oldOrder, newOrder)
  );
}

// =============================================================================
// 12. FINANCIAL LAMBDA INVOCATION
// =============================================================================

/**
 * Invokes a financial Lambda synchronously.
 *
 * RequestResponse is intentional. It allows this router to inspect the
 * target Lambda's result rather than treating a successful AWS invocation
 * as proof that the financial operation succeeded.
 *
 * Both AWS execution errors and business-level errors are detected.
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
  // Validate the requested target and milestone.
  // -------------------------------------------------------------------------

  if (functionName === RELEASE_MAXI_MILESTONE_FUNCTION) {
    if (milestone !== "PICKED_UP" && milestone !== "DELIVERED") {
      throw new Error(
        "MAXI milestone Lambda requires milestone PICKED_UP or DELIVERED.",
      );
    }
  } else if (milestone !== null && milestone !== undefined) {
    throw new Error(`A milestone cannot be sent to ${functionName}.`);
  }

  // -------------------------------------------------------------------------
  // Construct the existing target Lambda payload.
  // -------------------------------------------------------------------------

  const payload = {
    orderID,
  };

  if (milestone) {
    payload.milestone = milestone;
  }

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
  // Invoke synchronously.
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
      ExecutedVersion: response.ExecutedVersion || null,
    }),
  );

  // -------------------------------------------------------------------------
  // Validate the AWS invocation status.
  // -------------------------------------------------------------------------

  if (response.StatusCode !== 200) {
    throw new Error(
      `${functionName} returned unexpected AWS invocation status ${response.StatusCode}.`,
    );
  }

  if (response.FunctionError) {
    let errorPayload = null;

    if (response.Payload) {
      errorPayload = Buffer.from(response.Payload).toString();
    }

    console.error("Financial Lambda execution error:", errorPayload);

    throw new Error(`${functionName} reported a Lambda execution error.`);
  }

  // -------------------------------------------------------------------------
  // Parse the returned payload.
  // -------------------------------------------------------------------------

  if (!response.Payload || response.Payload.length === 0) {
    throw new Error(`${functionName} returned an empty response.`);
  }

  const rawPayload = Buffer.from(response.Payload).toString();

  let responsePayload;

  try {
    responsePayload = JSON.parse(rawPayload);
  } catch (error) {
    console.error("Financial Lambda returned invalid JSON:", rawPayload);

    throw new Error(`${functionName} returned an invalid JSON response.`);
  }

  // -------------------------------------------------------------------------
  // Parse an API-style body when the target returns one.
  // -------------------------------------------------------------------------

  let businessPayload = responsePayload;

  if (
    responsePayload &&
    typeof responsePayload === "object" &&
    typeof responsePayload.body === "string"
  ) {
    try {
      businessPayload = JSON.parse(responsePayload.body);
    } catch (error) {
      // A plain-text body is retained as the original response.
      businessPayload = responsePayload;
    }
  }

  // -------------------------------------------------------------------------
  // Detect business-level failures.
  // -------------------------------------------------------------------------

  const outerStatusCode = Number(responsePayload?.statusCode);
  const innerStatusCode = Number(businessPayload?.statusCode);

  const outerStatusFailed =
    Number.isFinite(outerStatusCode) && outerStatusCode >= 400;

  const innerStatusFailed =
    Number.isFinite(innerStatusCode) && innerStatusCode >= 400;

  const businessFailed =
    responsePayload?.success === false || businessPayload?.success === false;

  if (outerStatusFailed || innerStatusFailed || businessFailed) {
    console.error(
      "Financial Lambda returned an unsuccessful result:",
      JSON.stringify(responsePayload),
    );

    throw new Error(
      `${functionName} returned an unsuccessful financial result.`,
    );
  }

  console.log(
    `Successfully completed invocation of ${functionName} for Order ${orderID}.`,
  );

  return responsePayload;
}

// =============================================================================
// 13. PROCESS ONE DYNAMODB STREAM RECORD
// =============================================================================

async function processRecord(record) {
  if (!record) {
    throw new Error("DynamoDB Stream record is missing.");
  }

  // -------------------------------------------------------------------------
  // Only MODIFY events are relevant to this financial router.
  // -------------------------------------------------------------------------

  if (record.eventName !== "MODIFY") {
    console.log(`Ignoring DynamoDB event type: ${record.eventName}`);

    return {
      processed: false,
      reason: `Ignored event type ${record.eventName}`,
    };
  }

  // -------------------------------------------------------------------------
  // A MODIFY event must contain NewImage.
  // -------------------------------------------------------------------------

  if (!record.dynamodb?.NewImage) {
    throw new Error("DynamoDB MODIFY record does not contain NewImage.");
  }

  // -------------------------------------------------------------------------
  // Convert stream images.
  // -------------------------------------------------------------------------

  const newOrder = unmarshallImage(record.dynamodb.NewImage);

  // OldImage is expected because the stream should use NEW_AND_OLD_IMAGES.
  // If absent, the current NewImage can still be evaluated safely because
  // the target financial Lambdas enforce idempotency.
  const oldOrder = record.dynamodb.OldImage
    ? unmarshallImage(record.dynamodb.OldImage)
    : null;

  const orderID = getOrderId(newOrder);

  if (!orderID) {
    throw new Error("DynamoDB MODIFY record has no Order ID.");
  }

  // -------------------------------------------------------------------------
  // Ignore deleted Orders.
  // -------------------------------------------------------------------------

  if (isDeletedOrder(newOrder)) {
    console.log(`Skipping deleted Order ${orderID}.`);

    return {
      processed: false,
      orderID,
      reason: "Order is deleted",
    };
  }

  // -------------------------------------------------------------------------
  // Log the relevant financial state.
  // -------------------------------------------------------------------------

  console.log("=================================================");
  console.log("Processing Order Stream record");
  console.log("Order ID:", orderID);
  console.log("Event ID:", record.eventID || null);
  console.log("Sequence Number:", record.dynamodb?.SequenceNumber || null);
  console.log("Old status:", oldOrder?.status || null);
  console.log("New status:", newOrder.status || null);
  console.log("Transportation type:", newOrder.transportationType || null);
  console.log("Payment method:", newOrder.paymentMethod || null);
  console.log("Payment status:", newOrder.paymentStatus || null);
  console.log("Assigned courier:", newOrder.assignedCourierId || null);
  console.log("Courier earnings:", newOrder.courierEarnings ?? null);
  console.log("Allocation status:", newOrder.earningsAllocationStatus || null);
  console.log("Funds release blocked:", newOrder.fundsReleaseBlocked === true);
  console.log("=================================================");

  // =========================================================================
  // 14. ALLOCATE COURIER EARNINGS
  // =========================================================================

  /**
   * Allocation is checked on every Order modification.
   *
   * This is intentional:
   * - Payment may become PAID before courier assignment.
   * - Courier assignment may happen later.
   * - Payment method may be set after an earlier state update.
   * - FAILED allocation may be safely recoverable by the allocation Lambda.
   *
   * The allocation Lambda itself protects against duplicate wallet credits.
   */

  if (shouldAllocateEarnings(newOrder)) {
    console.log(
      `Order ${orderID} is eligible for PAYSTACK earnings allocation.`,
    );

    await invokeFinancialLambda({
      functionName: ALLOCATE_EARNINGS_FUNCTION,
      orderID,
      reason:
        "PAYSTACK payment is PAID, courier is assigned, courier earnings are positive, and allocation is not complete.",
    });
  } else {
    console.log(
      `Order ${orderID} is not currently eligible for earnings allocation.`,
    );
  }

  // =========================================================================
  // 15. MAXI PICKUP MILESTONE
  // =========================================================================

  /**
   * MAXI uses releaseCourierMilestoneFunds.
   *
   * It must NEVER use releaseFunds.
   *
   * The milestone Lambda controls the actual amount released at pickup.
   */

  if (
    isMaxiOrder(newOrder) &&
    shouldRetryFinancialMilestone(oldOrder, newOrder, "PICKED_UP")
  ) {
    console.log(
      `MAXI PICKED_UP milestone is eligible for reconsideration: ${orderID}.`,
    );

    await invokeFinancialLambda({
      functionName: RELEASE_MAXI_MILESTONE_FUNCTION,
      orderID,
      milestone: "PICKED_UP",
      reason:
        "MAXI order is PICKED_UP, PAYSTACK payment is confirmed, and courier earnings are allocated.",
    });
  }

  // =========================================================================
  // 16. MICRO / MOTO DELIVERY RELEASE
  // =========================================================================

  /**
   * MICRO and MOTO use releaseFunds.
   *
   * This block requires:
   * - PAYSTACK payment confirmed.
   * - Earnings ALLOCATED.
   * - Courier assigned.
   * - Positive courier earnings.
   * - Order DELIVERED.
   *
   * MAXI orders cannot enter this block.
   */

  if (
    isMicroOrMotoOrder(newOrder) &&
    shouldRetryFinancialMilestone(oldOrder, newOrder, "DELIVERED")
  ) {
    console.log(`MICRO/MOTO DELIVERED release is eligible: ${orderID}.`);

    await invokeFinancialLambda({
      functionName: RELEASE_FUNDS_FUNCTION,
      orderID,
      reason:
        "MICRO/MOTO order is DELIVERED, PAYSTACK payment is confirmed, and courier earnings are allocated.",
    });
  }

  // =========================================================================
  // 17. MAXI DELIVERY MILESTONE
  // =========================================================================

  /**
   * MAXI delivery uses releaseCourierMilestoneFunds.
   *
   * If payment or allocation was not ready at PICKED_UP, this delivery
   * invocation gives the milestone Lambda an opportunity to perform its
   * supported catch-up handling.
   *
   * MAXI must NEVER invoke releaseFunds.
   */

  if (
    isMaxiOrder(newOrder) &&
    shouldRetryFinancialMilestone(oldOrder, newOrder, "DELIVERED")
  ) {
    console.log(
      `MAXI DELIVERED milestone is eligible for reconsideration: ${orderID}.`,
    );

    await invokeFinancialLambda({
      functionName: RELEASE_MAXI_MILESTONE_FUNCTION,
      orderID,
      milestone: "DELIVERED",
      reason:
        "MAXI order is DELIVERED, PAYSTACK payment is confirmed, and courier earnings are allocated.",
    });
  }

  // =========================================================================
  // 18. RECORD SUCCESSFUL PROCESSING
  // =========================================================================

  console.log(`Finished financial routing for Order ${orderID}.`);

  return {
    processed: true,
    orderID,
  };
}

// =============================================================================
// 19. MAIN LAMBDA HANDLER
// =============================================================================

exports.handler = async (event) => {
  console.log("");
  console.log("=================================================");
  console.log("financialOrderTrigger START");
  console.log("=================================================");

  const records = event?.Records;

  if (!Array.isArray(records)) {
    throw new Error("Invalid DynamoDB Stream event: Records must be an array.");
  }

  console.log("Received records:", records.length);

  const batchItemFailures = [];

  // -------------------------------------------------------------------------
  // Process records sequentially.
  //
  // Sequential processing keeps invocation behavior predictable and avoids
  // creating an uncontrolled burst of financial Lambda invocations.
  // -------------------------------------------------------------------------

  for (const record of records) {
    try {
      await processRecord(record);
    } catch (error) {
      console.error("=================================================");
      console.error(
        "Failed to process DynamoDB Stream record:",
        record?.eventID || "UNKNOWN_EVENT",
      );
      console.error(
        "Sequence number:",
        record?.dynamodb?.SequenceNumber || "MISSING",
      );
      console.error("Processing error:", error);
      console.error("=================================================");

      // DynamoDB Streams partial batch responses require the sequence number
      // as itemIdentifier. Do NOT use record.eventID here.
      const sequenceNumber = record?.dynamodb?.SequenceNumber;

      if (!sequenceNumber) {
        // Without a sequence number, a valid partial failure response cannot
        // be constructed. Throwing fails the entire invocation.
        throw new Error(
          "Cannot report partial batch failure because the DynamoDB record has no SequenceNumber.",
          { cause: error },
        );
      }

      batchItemFailures.push({
        itemIdentifier: sequenceNumber,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Return partial batch failures.
  //
  // The event source mapping must have ReportBatchItemFailures enabled.
  // -------------------------------------------------------------------------

  console.log("=================================================");
  console.log("financialOrderTrigger FINISHED");
  console.log("Total records:", records.length);
  console.log("Failed records:", batchItemFailures.length);
  console.log("=================================================");

  return {
    batchItemFailures,
  };
};
