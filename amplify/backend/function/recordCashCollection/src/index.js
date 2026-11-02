const crypto = require("crypto");

/**
 * ATUA — RECORD CASH COLLECTION
 *
 * Called by the authenticated courier when they confirm that cash
 * has physically been received from the customer.
 *
 * Responsibilities:
 * 1. Authenticate the caller.
 * 2. Resolve the caller to an Atua Courier.
 * 3. Verify the courier is assigned to the Order.
 * 4. Verify that cash collection is permitted for the Order.
 * 5. Check for successful or unresolved electronic payments.
 * 6. Update the Order's cash/payment fields.
 * 7. Create a CashCollection audit record.
 * 8. Repair a missing audit record on safe retries.
 *
 * The amount is derived from Order.totalPrice, never from client input.
 * This Lambda does not call Paystack.
 */

// =============================================================================
// 1. CONFIGURATION
// =============================================================================

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const GRAPHQL_API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

const CASH_STATUSES = {
  CONFIRMED: "CONFIRMED",
};

// =============================================================================
// 2. GRAPHQL FIELDS
// =============================================================================

const ORDER_FIELDS = `
    id
    totalPrice
    status
    assignedCourierId
    paymentStatus
    paymentID
    paymentReference
    paymentTiming
    paymentMethod
    paymentResponsibility
    cashCollectionStatus
    cashCollectedByCourierId
    cashCollectedAmount
    cashCollectedAt
    cashCollectionID
    _version
`;

const PAYMENT_FIELDS = `
    id
    orderID
    status
    provider
    reference
`;

const COLLECTION_FIELDS = `
    id
    orderID
    courierID
    amount
    status
    idempotencyKey
    confirmedAt
`;

// =============================================================================
// 3. RESPONSE AND INPUT HELPERS
// =============================================================================

function result(success, message, details = {}) {
  return {
    success,
    message,
    orderId: details.orderId || null,
    cashCollectionID: details.cashCollectionID || null,
    amount: Number.isFinite(details.amount) ? details.amount : null,
    confirmedAt: details.confirmedAt || null,
  };
}

/**
 * AppSync normally supplies identity.sub for Cognito-authenticated callers.
 */
function getIdentitySub(event) {
  return event?.identity?.sub || event?.identity?.claims?.sub || null;
}

/**
 * Supports the GraphQL arguments shape and an input-style invocation.
 */
function getOrderId(event) {
  const args = event?.arguments || event?.input || {};

  return args.orderId || args.orderID || null;
}

/**
 * Deterministic ID: retries for one Order use the same collection record.
 */
function getCashCollectionId(orderId) {
  return `cash-collection-${orderId}`;
}

function getIdempotencyKey(orderId) {
  return `cash-collection:${orderId}`;
}

// =============================================================================
// 4. AWS IAM SIGNING HELPERS
// =============================================================================

/**
 * Determine the AWS Region from the AppSync endpoint.
 *
 * Example endpoint:
 * https://xxxx.appsync-api.eu-west-1.amazonaws.com/graphql
 */
function getAppSyncRegion() {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error("Atua GraphQL endpoint is not configured.");
  }

  const hostname = new URL(GRAPHQL_ENDPOINT).hostname;

  const match = hostname.match(
    /appsync-api\.([a-z0-9-]+)\.amazonaws\.com(?:\.cn)?$/,
  );

  return match?.[1] || process.env.AWS_REGION || process.env.REGION || null;
}

function hmac(key, value, encoding) {
  return crypto
    .createHmac("sha256", key)
    .update(value, "utf8")
    .digest(encoding);
}

/**
 * Signs AppSync requests using the Lambda execution role.
 *
 * CashCollection uses AWS_IAM authorization.
 * Do not hard-code AWS credentials in this function.
 */
function signAwsRequest(url, body) {
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;

  if (!accessKey || !secretKey) {
    throw new Error(
      "Lambda AWS credentials are unavailable. Check the execution role.",
    );
  }

  const parsedUrl = new URL(url);
  const region = getAppSyncRegion();

  if (!region) {
    throw new Error("Could not determine the AppSync signing region.");
  }

  /*
   * AWS SigV4 timestamp format:
   * YYYYMMDDTHHmmssZ
   */
  const now = new Date();

  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");

  const dateStamp = amzDate.slice(0, 8);

  const service = "appsync";
  const method = "POST";
  const canonicalUri = parsedUrl.pathname || "/";
  const canonicalQueryString = "";

  const payloadHash = crypto
    .createHash("sha256")
    .update(body, "utf8")
    .digest("hex");

  const headers = {
    "content-type": "application/json",
    host: parsedUrl.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };

  if (sessionToken) {
    headers["x-amz-security-token"] = sessionToken;
  }

  const sortedHeaderNames = Object.keys(headers).sort();

  const signedHeaderNames = sortedHeaderNames.join(";");

  const canonicalHeaders = sortedHeaderNames
    .map((name) => `${name}:${String(headers[name]).trim()}\n`)
    .join("");

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaderNames,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    crypto.createHash("sha256").update(canonicalRequest, "utf8").digest("hex"),
  ].join("\n");

  const dateKey = hmac(`AWS4${secretKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  const signingKey = hmac(serviceKey, "aws4_request");

  const signature = hmac(signingKey, stringToSign, "hex");

  headers.Authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaderNames}, Signature=${signature}`;

  return headers;
}

// =============================================================================
// 5. GRAPHQL REQUEST HELPER
// =============================================================================

/**
 * authMode:
 * - API_KEY: Order, Courier, and Payment queries/mutations.
 * - IAM: CashCollection queries/mutations.
 *
 * Ensure these authorization modes match your deployed AppSync schema.
 */
async function graphqlRequest(
  query,
  variables = {},
  operationName = "RecordCashCollection",
  authMode = "API_KEY",
) {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error("Atua GraphQL endpoint is not configured.");
  }

  const body = JSON.stringify({
    query,
    variables,
    operationName,
  });

  let headers;

  if (authMode === "IAM") {
    headers = signAwsRequest(GRAPHQL_ENDPOINT, body);
  } else {
    if (!GRAPHQL_API_KEY) {
      throw new Error("Atua GraphQL API key is not configured.");
    }

    headers = {
      "Content-Type": "application/json",
      "x-api-key": GRAPHQL_API_KEY,
    };
  }

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers,
    body,
  });

  let payload;

  try {
    payload = await response.json();
  } catch {
    throw new Error(
      `AppSync returned an invalid response (HTTP ${response.status}).`,
    );
  }

  if (!response.ok || payload.errors?.length) {
    const message =
      payload.errors?.map((item) => item.message).join("; ") ||
      `AppSync request failed with HTTP ${response.status}.`;

    console.error("APPSYNC GRAPHQL ERROR:", {
      operationName,
      authMode,
      statusCode: response.status,
      message,
    });

    throw new Error(message);
  }

  return payload.data;
}

// =============================================================================
// 6. READ THE ORDER
// =============================================================================

async function getOrder(orderId) {
  const query = `
        query GetOrderForCashCollection($id: ID!) {
            getOrder(id: $id) {
                ${ORDER_FIELDS}
            }
        }
    `;

  const data = await graphqlRequest(
    query,
    { id: orderId },
    "GetOrderForCashCollection",
    "API_KEY",
  );

  return data?.getOrder || null;
}

// =============================================================================
// 7. RESOLVE THE AUTHENTICATED COURIER
// =============================================================================

async function getCourierBySub(sub) {
  const query = `
        query GetCourierForCashCollection(
            $sub: String!
            $limit: Int
        ) {
            couriersBySub(sub: $sub, limit: $limit) {
                items {
                    id
                    sub
                }
            }
        }
    `;

  const data = await graphqlRequest(
    query,
    { sub, limit: 10 },
    "GetCourierForCashCollection",
    "API_KEY",
  );

  const couriers = data?.couriersBySub?.items || [];

  return couriers.find((courier) => courier.sub === sub) || null;
}

// =============================================================================
// 8. READ PAYMENTS ASSOCIATED WITH THE ORDER
// =============================================================================

async function getPaymentsForOrder(orderId) {
  const query = `
    query GetPaymentsForCashCollection(
      $orderID: ID!
      $limit: Int
    ) {
      paymentsByOrderID(orderID: $orderID, limit: $limit) {
        items {
          id
          orderID
          status
          provider
          reference
        }
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    { orderID: orderId, limit: 100 },
    "GetPaymentsForCashCollection",
    "API_KEY",
  );

  return data?.paymentsByOrderID?.items || [];
}

// =============================================================================
// 9. READ THE CASH COLLECTION AUDIT RECORD
// =============================================================================

async function getCashCollection(collectionId) {
  const query = `
        query GetCashCollection($id: ID!) {
            getCashCollection(id: $id) {
                ${COLLECTION_FIELDS}
            }
        }
    `;

  const data = await graphqlRequest(
    query,
    { id: collectionId },
    "GetCashCollection",
    "IAM",
  );

  return data?.getCashCollection || null;
}

// =============================================================================
// 10. CREATE THE CASH COLLECTION AUDIT RECORD
// =============================================================================

async function createCashCollectionRecord({
  collectionId,
  orderId,
  courierId,
  amount,
  confirmedAt,
}) {
  const input = {
    id: collectionId,
    orderID: orderId,
    courierID: courierId,
    amount,
    status: CASH_STATUSES.CONFIRMED,
    idempotencyKey: getIdempotencyKey(orderId),
    confirmedAt,
  };

  const mutation = `
        mutation CreateCashCollection(
            $input: CreateCashCollectionInput!
        ) {
            createCashCollection(input: $input) {
                ${COLLECTION_FIELDS}
            }
        }
    `;

  try {
    const data = await graphqlRequest(
      mutation,
      { input },
      "CreateCashCollection",
      "IAM",
    );

    const created = data?.createCashCollection;

    if (
      !created ||
      created.id !== collectionId ||
      created.orderID !== orderId ||
      created.courierID !== courierId ||
      Number(created.amount) !== Number(amount) ||
      created.status !== CASH_STATUSES.CONFIRMED ||
      created.idempotencyKey !== getIdempotencyKey(orderId)
    ) {
      throw new Error("Cash collection record was not saved correctly.");
    }

    return created;
  } catch (error) {
    /*
     * The create request may have succeeded in AppSync even if the
     * response timed out. Check the deterministic ID before failing.
     */
    let existing;

    try {
      existing = await getCashCollection(collectionId);
    } catch (readError) {
      console.error(
        "CASH COLLECTION RETRY CHECK FAILED:",
        readError?.message || readError,
      );

      throw error;
    }

    if (
      existing &&
      existing.orderID === orderId &&
      existing.courierID === courierId &&
      Number(existing.amount) === Number(amount) &&
      existing.status === CASH_STATUSES.CONFIRMED &&
      existing.idempotencyKey === getIdempotencyKey(orderId)
    ) {
      return existing;
    }

    throw error;
  }
}

// =============================================================================
// 11. UPDATE THE ORDER AS CASH-PAID
// =============================================================================

async function updateOrderForCashCollection({
  order,
  courierId,
  amount,
  collectionId,
  confirmedAt,
}) {
  const mutation = `
        mutation ConfirmOrderCashCollection(
            $input: UpdateOrderInput!
        ) {
            updateOrder(input: $input) {
                ${ORDER_FIELDS}
            }
        }
    `;

  const input = {
    id: order.id,
    paymentMethod: "CASH",
    paymentStatus: "PAID",
    cashCollectionStatus: "CONFIRMED",
    cashCollectedByCourierId: courierId,
    cashCollectedAmount: amount,
    cashCollectedAt: confirmedAt,
    cashCollectionID: collectionId,
  };

  /*
   * Include the current version if AppSync conflict detection is enabled.
   * This helps prevent overwriting an Order that changed after it was read.
   */
  if (Number.isInteger(order._version)) {
    input._version = order._version;
  }

  const data = await graphqlRequest(
    mutation,
    { input },
    "ConfirmOrderCashCollection",
    "API_KEY",
  );

  const updated = data?.updateOrder;

  if (
    !updated ||
    updated.id !== order.id ||
    updated.cashCollectionID !== collectionId ||
    updated.cashCollectedByCourierId !== courierId ||
    updated.cashCollectionStatus !== "CONFIRMED" ||
    Number(updated.cashCollectedAmount) !== Number(amount) ||
    updated.paymentStatus !== "PAID" ||
    updated.paymentMethod !== "CASH"
  ) {
    throw new Error("The Order's cash collection could not be confirmed.");
  }

  return updated;
}

// =============================================================================
// 12. IDEMPOTENCY AND AUDIT-REPAIR HELPERS
// =============================================================================

/**
 * Confirms that the Order's recorded cash collection matches this courier
 * and this Order's deterministic collection ID.
 */
function alreadyCollectedByThisCourier(order, courierId, collectionId) {
  return (
    order?.cashCollectionStatus === "CONFIRMED" &&
    order?.cashCollectionID === collectionId &&
    order?.cashCollectedByCourierId === courierId &&
    Number.isFinite(Number(order?.cashCollectedAmount)) &&
    Number(order.cashCollectedAmount) > 0
  );
}

/**
 * If the Order is already marked as cash-collected, ensure the matching
 * audit record exists. This repairs a partial failure where the Order update
 * succeeded but creating the CashCollection record failed.
 */
async function ensureLedgerExists({ order, courierId, collectionId }) {
  const amount = Number(order.cashCollectedAmount);

  const confirmedAt = order.cashCollectedAt || new Date().toISOString();

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("The recorded cash collection has an invalid amount.");
  }

  return createCashCollectionRecord({
    collectionId,
    orderId: order.id,
    courierId,
    amount,
    confirmedAt,
  });
}

// =============================================================================
// 13. ELECTRONIC PAYMENT SAFETY CHECKS
// =============================================================================

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function isPaystackPayment(payment) {
  return normalizeStatus(payment?.provider) === "PAYSTACK";
}

/**
 * These statuses mean an electronic payment may have succeeded or may
 * still be in progress. Cash must not be recorded while one exists.
 */
const UNRESOLVED_OR_SUCCESSFUL_PAYMENT_STATUSES = new Set([
  "SUCCESS",
  "SUCCESSFUL",
  "PAID",
  "COMPLETED",
  "PENDING",
  "PROCESSING",
  "ONGOING",
  "INITIATED",
  "ABANDONED",
]);

/**
 * These statuses indicate a payment attempt has conclusively failed,
 * provided the payment provider's verification flow uses them only after
 * the attempt is resolved.
 */
const DEFINITIVE_FAILED_PAYMENT_STATUSES = new Set([
  "FAILED",
  "FAIL",
  "CANCELLED",
  "CANCELED",
  "DECLINED",
  "EXPIRED",
]);

function hasUnresolvedPaystackPayment(payments) {
  return payments.some((payment) => {
    if (!isPaystackPayment(payment)) {
      return false;
    }

    const status = normalizeStatus(payment.status);

    return UNRESOLVED_OR_SUCCESSFUL_PAYMENT_STATUSES.has(status);
  });
}

/**
 * If the Order still carries an electronic reference, we only permit cash
 * when the Order explicitly says the electronic attempt failed AND every
 * matching Paystack record is conclusively failed.
 *
 * If the payment record is missing or its state is unknown, fail closed.
 */
function canSafelyUseCashAfterElectronicAttempt(order, payments) {
  const hasElectronicReference = Boolean(
    order.paymentID || order.paymentReference,
  );

  if (!hasElectronicReference) {
    return true;
  }

  const orderPaymentStatus = normalizeStatus(order.paymentStatus);

  if (!DEFINITIVE_FAILED_PAYMENT_STATUSES.has(orderPaymentStatus)) {
    return false;
  }

  const orderReference = String(
    order.paymentReference || order.paymentID || "",
  );

  const relatedPayments = payments.filter((payment) => {
    if (!isPaystackPayment(payment)) {
      return false;
    }

    const reference = String(payment.reference || "");

    return !orderReference || !reference || reference === orderReference;
  });

  /*
   * A reference exists but no matching payment record can be found.
   * Do not assume it is safe to collect cash.
   */
  if (relatedPayments.length === 0) {
    return false;
  }

  return relatedPayments.every((payment) =>
    DEFINITIVE_FAILED_PAYMENT_STATUSES.has(normalizeStatus(payment.status)),
  );
}

// =============================================================================
// 14. MAIN HANDLER
// =============================================================================

exports.handler = async (event) => {
  let orderId = null;

  // Diagnostic log: confirms that AppSync actually invoked this Lambda.
  console.log("RECORD CASH COLLECTION INVOKED:", {
    hasIdentity: Boolean(event?.identity),
    hasCognitoSub: Boolean(
      event?.identity?.sub || event?.identity?.claims?.sub,
    ),
    arguments: event?.arguments || null,
  });

  try {
    // ---------------------------------------------------------------------
    // Authenticate the caller.
    // ---------------------------------------------------------------------

    orderId = getOrderId(event);

    const sub = getIdentitySub(event);

    if (!sub) {
      return result(false, "You must be signed in as the assigned courier.", {
        orderId,
      });
    }

    if (!orderId || typeof orderId !== "string" || !orderId.trim()) {
      return result(false, "A valid order ID is required.");
    }

    // ---------------------------------------------------------------------
    // Resolve the authenticated user to an Atua Courier.
    // ---------------------------------------------------------------------

    const courier = await getCourierBySub(sub);

    if (!courier?.id) {
      return result(
        false,
        "Your account is not registered as an Atua courier.",
        { orderId },
      );
    }

    // ---------------------------------------------------------------------
    // Load the Order and verify courier assignment.
    // ---------------------------------------------------------------------

    const order = await getOrder(orderId);

    if (!order) {
      return result(false, "Order could not be found.", { orderId });
    }

    if (order.assignedCourierId !== courier.id) {
      return result(
        false,
        "Only the courier assigned to this order can record cash collection.",
        { orderId: order.id },
      );
    }

    const collectionId = getCashCollectionId(order.id);

    // ---------------------------------------------------------------------
    // Idempotent retry: repair the audit record if needed.
    // ---------------------------------------------------------------------

    if (alreadyCollectedByThisCourier(order, courier.id, collectionId)) {
      /*
       * Verify the Order is consistent with a cash collection before
       * repairing or returning success.
       */
      if (order.paymentMethod !== "CASH" || order.paymentStatus !== "PAID") {
        return result(
          false,
          "The recorded cash collection has inconsistent payment fields. Contact Atua support.",
          { orderId: order.id },
        );
      }

      const ledger = await ensureLedgerExists({
        order,
        courierId: courier.id,
        collectionId,
      });

      return result(true, "Cash collection was already recorded.", {
        orderId: order.id,
        cashCollectionID: ledger.id,
        amount: Number(ledger.amount),
        confirmedAt: ledger.confirmedAt,
      });
    }

    // ---------------------------------------------------------------------
    // Do not overwrite a different or incomplete recorded collection.
    // ---------------------------------------------------------------------

    if (
      order.cashCollectionStatus === "CONFIRMED" ||
      order.cashCollectionID ||
      order.cashCollectedAt ||
      order.cashCollectedByCourierId
    ) {
      return result(
        false,
        "A cash collection is already recorded for this order. Contact Atua support if this is incorrect.",
        { orderId: order.id },
      );
    }

    // ---------------------------------------------------------------------
    // Validate the Order status.
    // ---------------------------------------------------------------------

    if (
      order.status === "CANCELLED" ||
      order.status === "DISPUTED" ||
      order.status === "DELIVERED"
    ) {
      return result(
        false,
        "Cash cannot be recorded for this order in its current status.",
        { orderId: order.id },
      );
    }

    // ---------------------------------------------------------------------
    // Determine which cash-collection arrangement applies.
    // ---------------------------------------------------------------------

    // Pickup cash:
    // The sender pays cash when the courier arrives to collect the order.
    const isPickupCash =
      order.paymentResponsibility === "SENDER" &&
      order.paymentTiming === "AT_PICKUP" &&
      normalizeStatus(order.paymentMethod) === "CASH";

    // Delivery cash:
    // Either CASH is already selected, or the receiver is responsible
    // for payment and chooses the payment method when the courier arrives.
    const isDeliveryCash =
      order.paymentTiming === "ON_DELIVERY" &&
      (normalizeStatus(order.paymentMethod) === "CASH" ||
        (order.paymentResponsibility === "RECEIVER" &&
          order.paymentMethod == null));

    if (!isPickupCash && !isDeliveryCash) {
      return result(
        false,
        "This order's saved payment arrangement does not permit cash collection at this stage.",
        { orderId: order.id },
      );
    }

    // ---------------------------------------------------------------------
    // Validate the stage for the relevant cash-collection arrangement.
    // ---------------------------------------------------------------------

    // Pickup cash must be collected at the pickup stage.
    if (isPickupCash && !["ARRIVED_PICKUP", "LOADING"].includes(order.status)) {
      return result(
        false,
        "Cash at pickup can only be recorded at the pickup location.",
        { orderId: order.id },
      );
    }

    // Delivery cash must be collected at the delivery stage.
    if (
      isDeliveryCash &&
      !["ARRIVED_DROPOFF", "UNLOADING"].includes(order.status)
    ) {
      return result(
        false,
        "Cash on delivery can only be recorded at the delivery location.",
        { orderId: order.id },
      );
    }

    // Pickup cash uses AT_PICKUP; delivery cash uses ON_DELIVERY.
    // Both arrangements are valid when their specific checks above pass.
    if (
      (isPickupCash && order.paymentTiming !== "AT_PICKUP") ||
      (isDeliveryCash && order.paymentTiming !== "ON_DELIVERY")
    ) {
      return result(
        false,
        "This order's payment timing does not match its cash-collection stage.",
        { orderId: order.id },
      );
    }

    // ---------------------------------------------------------------------
    // A previously confirmed payment must never be switched to cash.
    // ---------------------------------------------------------------------

    if (order.paymentStatus === "PAID") {
      return result(
        false,
        "This order is already marked as paid. Verify its payment method before recording cash.",
        { orderId: order.id },
      );
    }

    if (
      order.paymentMethod &&
      !["CASH", "PAYSTACK", "ELECTRONIC"].includes(
        normalizeStatus(order.paymentMethod),
      )
    ) {
      return result(
        false,
        "This order has an unsupported payment method. Contact Atua support.",
        { orderId: order.id },
      );
    }

    // ---------------------------------------------------------------------
    // Derive the amount from the saved Order.
    // ---------------------------------------------------------------------

    const amount = Number(order.totalPrice);

    if (!Number.isFinite(amount) || amount <= 0) {
      return result(
        false,
        "The order has an invalid cash amount. Contact Atua support.",
        { orderId: order.id },
      );
    }

    // ---------------------------------------------------------------------
    // Inspect the Payment records as well as the Order fields.
    // ---------------------------------------------------------------------

    const payments = await getPaymentsForOrder(order.id);

    if (hasUnresolvedPaystackPayment(payments)) {
      return result(
        false,
        "An electronic payment attempt is successful or still unresolved. Verify or resolve it before collecting cash.",
        { orderId: order.id },
      );
    }

    if (!canSafelyUseCashAfterElectronicAttempt(order, payments)) {
      return result(
        false,
        "An electronic payment reference exists and its failure has not been conclusively verified. Resolve it before collecting cash.",
        { orderId: order.id },
      );
    }

    // ---------------------------------------------------------------------
    // Record the physical cash collection.
    // ---------------------------------------------------------------------

    const confirmedAt = new Date().toISOString();

    /*
     * First update the Order.
     *
     * The Order update marks the payment as PAID and the method as CASH.
     * This is the state watched by financialOrderTrigger.
     *
     * The downstream financial Lambdas must still verify payment,
     * allocation, and their own idempotency requirements.
     */
    try {
      await updateOrderForCashCollection({
        order,
        courierId: courier.id,
        amount,
        collectionId,
        confirmedAt,
      });
    } catch (updateError) {
      /*
       * The update might have succeeded even if the response failed.
       * Re-read the Order before reporting a failure.
       */
      let latestOrder = null;

      try {
        latestOrder = await getOrder(order.id);
      } catch (readError) {
        console.error("ORDER RECHECK FAILED:", readError?.message || readError);
      }

      if (
        latestOrder &&
        alreadyCollectedByThisCourier(latestOrder, courier.id, collectionId) &&
        latestOrder.paymentMethod === "CASH" &&
        latestOrder.paymentStatus === "PAID"
      ) {
        const ledger = await ensureLedgerExists({
          order: latestOrder,
          courierId: courier.id,
          collectionId,
        });

        return result(true, "Cash collection was already recorded.", {
          orderId: latestOrder.id,
          cashCollectionID: ledger.id,
          amount: Number(ledger.amount),
          confirmedAt: ledger.confirmedAt,
        });
      }

      console.error(
        "ORDER CASH UPDATE FAILED:",
        updateError?.message || updateError,
      );

      return result(
        false,
        "The order changed while cash was being recorded. Refresh the order and verify its payment status before retrying.",
        { orderId: order.id },
      );
    }

    // ---------------------------------------------------------------------
    // Create the auditable CashCollection record.
    // ---------------------------------------------------------------------

    /*
     * If this step fails after the Order update, a retry will detect the
     * Order's deterministic collection ID and repair the audit record.
     *
     * Do not silently report success unless the audit record exists.
     */
    const ledger = await createCashCollectionRecord({
      collectionId,
      orderId: order.id,
      courierId: courier.id,
      amount,
      confirmedAt,
    });

    console.log("CASH COLLECTION RECORDED:", {
      orderId: order.id,
      courierId: courier.id,
      cashCollectionID: ledger.id,
      amount,
      confirmedAt,
    });

    return result(true, "Cash collection recorded successfully.", {
      orderId: order.id,
      cashCollectionID: ledger.id,
      amount,
      confirmedAt,
    });
  } catch (error) {
    console.error("RECORD CASH COLLECTION ERROR:", error?.message || error);

    return result(
      false,
      "Unable to record cash collection. Refresh the order and verify its payment status before retrying.",
      { orderId },
    );
  }
};
