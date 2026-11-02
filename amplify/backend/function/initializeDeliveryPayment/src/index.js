/*
 * ============================================================
 * ATUA — INITIALIZE DELIVERY PAYMENT
 * ============================================================
 *
 * PURPOSE:
 * Initialize or reuse electronic payment checkout for an order
 * where the RECEIVER is responsible for payment.
 *
 * Supports:
 * - Receiver payment BEFORE_PICKUP or ON_DELIVERY.
 * - Reusing an existing valid pending Paystack checkout.
 * - Creating a new Paystack checkout when appropriate.
 * - Sender-generated checkout links that remain unpaid.
 * - Order owner or currently assigned, unblocked courier.
 *
 * IMPORTANT:
 * - No receiverConfirmationStatus is used.
 * - No receiverPaymentExpiresAt is used.
 * - This Lambda never marks an order PAID.
 * - Paystack success must be verified server-side.
 * - Cash collection is handled separately.
 * - An uncertain Paystack attempt is not automatically marked
 *   FAILED, because Paystack may have created the transaction.
 * ============================================================
 */

const crypto = require("crypto");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

/* ============================================================
   CONFIGURATION
============================================================ */

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;
const GRAPHQL_API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

// Use the same AWS region as the SSM parameter.
const REGION = process.env.REGION || process.env.AWS_REGION || "eu-north-1";

// This must be the SSM parameter NAME, not the secret value.
const PAYSTACK_SECRET_PARAMETER = process.env.PAYSTACK_SECRET_KEY;

const ssmClient = new SSMClient({ region: REGION });
let cachedPaystackSecret = null;

/* ============================================================
   PAYSTACK SECRET
============================================================ */

async function getPaystackSecretKey() {
  if (cachedPaystackSecret) {
    return cachedPaystackSecret;
  }

  if (!PAYSTACK_SECRET_PARAMETER) {
    throw new Error("Paystack secret parameter is not configured.");
  }

  const result = await ssmClient.send(
    new GetParameterCommand({
      Name: PAYSTACK_SECRET_PARAMETER,
      WithDecryption: true,
    }),
  );

  const secret = result?.Parameter?.Value?.trim();

  if (!secret) {
    throw new Error("Unable to retrieve Paystack secret.");
  }

  cachedPaystackSecret = secret;
  return secret;
}

/* ============================================================
   APPSYNC GRAPHQL REQUEST
============================================================ */

async function graphqlRequest(
  query,
  variables = {},
  operationName = "InitializeDeliveryPayment",
) {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error("Atua GraphQL endpoint is not configured.");
  }

  if (!GRAPHQL_API_KEY) {
    throw new Error("Atua GraphQL API key is not configured.");
  }

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": GRAPHQL_API_KEY,
    },
    body: JSON.stringify({
      query,
      variables,
      operationName,
    }),
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("Atua GraphQL returned an invalid response.");
  }

  if (!response.ok || result.errors?.length) {
    console.error(
      "APPSYNC REQUEST FAILED:",
      JSON.stringify(result.errors || result),
    );

    throw new Error(
      result.errors?.[0]?.message || "Unable to access Atua records.",
    );
  }

  return result.data;
}

/* ============================================================
   AUTHENTICATED IDENTITY
============================================================ */

function getCognitoSub(event) {
  const identity = event?.identity;
  const sub = identity?.sub || identity?.claims?.sub;

  return typeof sub === "string" && sub.trim() ? sub.trim() : null;
}

function getIdentityEmail(event) {
  const identity = event?.identity;

  const email =
    identity?.claims?.email ||
    identity?.claims?.["cognito:email"] ||
    identity?.email;

  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

/* ============================================================
   RESPONSE HELPERS
============================================================ */

function successResult({
  orderId,
  paymentId,
  reference,
  checkoutUrl,
  amount,
  reused = false,
}) {
  return {
    success: true,
    message: reused
      ? "Existing payment checkout is ready."
      : "Delivery payment checkout is ready.",
    orderId,
    paymentId,
    reference,
    checkoutUrl,
    amount,
    reused,
  };
}

function failureResult(message, orderId = null) {
  return {
    success: false,
    message,
    orderId,
    paymentId: null,
    reference: null,
    checkoutUrl: null,
    amount: null,
    reused: false,
  };
}

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

// Correct email regex. The dot in the domain is escaped.
function isValidEmail(email) {
  return (
    typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  );
}

function isPositiveAmount(amount) {
  return (
    Number.isFinite(amount) &&
    amount > 0 &&
    Number.isSafeInteger(Math.round(amount * 100))
  );
}

/* ============================================================
   LOAD ORDER
============================================================ */

async function getOrder(orderId) {
  const query = `
    query GetOrderForDeliveryPayment($id: ID!) {
      getOrder(id: $id) {
        id
        userID
        recipientNumber
        totalPrice
        status
        transportationType
        vehicleClass
        acceptedOfferID
        assignedCourierId
        bookingSource
        paymentStatus
        paymentID
        paymentReference
        paymentResponsibility
        paymentTiming
        paymentMethod
        cashCollectionID
        cashCollectedAt
        cashCollectedAmount
        createdAt
        updatedAt
        _version
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    { id: orderId },
    "GetOrderForDeliveryPayment",
  );

  return data?.getOrder || null;
}

/* ============================================================
   FIND USER BY COGNITO SUB
============================================================ */

async function getUserBySub(sub) {
  const query = `
    query GetUserBySub($sub: String!, $limit: Int) {
      usersBySub(sub: $sub, limit: $limit) {
        items {
          id
          sub
        }
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    {
      sub,
      limit: 2,
    },
    "GetUserBySub",
  );

  const users = data?.usersBySub?.items || [];

  // Do not authorize ambiguous duplicate records.
  if (users.length !== 1 || users[0]?.sub !== sub) {
    return null;
  }

  return users[0];
}

/* ============================================================
   FIND COURIER BY COGNITO SUB
============================================================ */

async function getCourierBySub(sub) {
  const query = `
    query GetCourierBySub($sub: String!, $limit: Int) {
      couriersBySub(sub: $sub, limit: $limit) {
        items {
          id
          sub
          isBlocked
        }
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    {
      sub,
      limit: 2,
    },
    "GetCourierBySub",
  );

  const couriers = data?.couriersBySub?.items || [];

  if (couriers.length !== 1 || couriers[0]?.sub !== sub) {
    return null;
  }

  return couriers[0];
}

/* ============================================================
   AUTHORIZE ORDER OWNER OR ASSIGNED COURIER
============================================================ */

async function authorizeOrderCaller(event, order) {
  const sub = getCognitoSub(event);

  if (!sub) {
    return {
      allowed: false,
      reason: "You must be signed in to continue.",
    };
  }

  // The order owner may generate or retrieve the checkout.
  const user = await getUserBySub(sub);

  if (user && user.id === order.userID) {
    return {
      allowed: true,
      role: "ORDER_OWNER",
    };
  }

  // Only the currently assigned, unblocked courier may
  // generate or retrieve this order's checkout.
  if (order.assignedCourierId) {
    const courier = await getCourierBySub(sub);

    if (
      courier &&
      courier.id === order.assignedCourierId &&
      !courier.isBlocked
    ) {
      return {
        allowed: true,
        role: "ASSIGNED_COURIER",
      };
    }
  }

  return {
    allowed: false,
    reason:
      "You are not authorized to generate payment checkout for this order.",
  };
}

/* ============================================================
   GET PAYMENT BY REFERENCE
============================================================ */

// Your earlier schema does not expose paymentsByPaymentReference.
// This uses listPayments with a reference filter instead.
// Confirm listPayments and ModelPaymentFilterInput exist in your
// deployed schema before deploying this Lambda.

async function getPaymentByReference(reference) {
  if (!reference) {
    throw new Error("Payment reference is required.");
  }

  const query = `
    query GetDeliveryPaymentByReference(
      $filter: ModelPaymentFilterInput
      $limit: Int
      $nextToken: String
    ) {
      listPayments(
        filter: $filter
        limit: $limit
        nextToken: $nextToken
      ) {
        items {
          id
          orderID
          userID
          amount
          currency
          status
          paymentMethod
          provider
          reference
          payerEmail
          payerPhone
          checkoutUrl
          _deleted
        }
        nextToken
      }
    }
  `;

  let nextToken = null;
  const matches = [];

  do {
    const data = await graphqlRequest(
      query,
      {
        filter: {
          reference: {
            eq: reference,
          },
        },
        limit: 100,
        nextToken,
      },
      "GetDeliveryPaymentByReference",
    );

    const result = data?.listPayments;

    if (!result) {
      throw new Error("AppSync did not return the payment list.");
    }

    const pageMatches = (result.items || []).filter(
      (payment) =>
        payment && !payment._deleted && payment.reference === reference,
    );

    matches.push(...pageMatches);
    nextToken = result.nextToken || null;
  } while (nextToken);

  if (matches.length > 1) {
    throw new Error("Multiple payment records share the same reference.");
  }

  return matches[0] || null;
}

/* ============================================================
   CREATE PAYMENT RECORD
============================================================ */

async function createPayment({
  order,
  reference,
  amount,
  payerEmail,
  payerPhone,
}) {
  const mutation = `
    mutation CreateDeliveryPayment(
      $input: CreatePaymentInput!
    ) {
      createPayment(input: $input) {
        id
        orderID
        userID
        amount
        currency
        status
        paymentMethod
        provider
        reference
        payerEmail
        payerPhone
        checkoutUrl
      }
    }
  `;

  const input = {
    orderID: order.id,
    userID: order.userID,
    amount,
    currency: "NGN",
    status: "PENDING",
    paymentMethod: "PAYSTACK",
    provider: "PAYSTACK",
    reference,
    payerEmail,
    payerPhone: payerPhone || null,
  };

  const data = await graphqlRequest(
    mutation,
    { input },
    "CreateDeliveryPayment",
  );

  const payment = data?.createPayment;

  if (
    !payment?.id ||
    payment.orderID !== order.id ||
    payment.userID !== order.userID ||
    payment.reference !== reference ||
    Number(payment.amount) !== amount
  ) {
    throw new Error("Payment record was not created correctly.");
  }

  return payment;
}

/* ============================================================
   UPDATE PAYMENT CHECKOUT URL
============================================================ */

async function updatePaymentCheckout({ payment, checkoutUrl }) {
  const mutation = `
    mutation UpdateDeliveryPaymentCheckout(
      $input: UpdatePaymentInput!
    ) {
      updatePayment(input: $input) {
        id
        orderID
        userID
        amount
        currency
        status
        paymentMethod
        provider
        reference
        checkoutUrl
      }
    }
  `;

  const data = await graphqlRequest(
    mutation,
    {
      input: {
        id: payment.id,
        checkoutUrl,
      },
    },
    "UpdateDeliveryPaymentCheckout",
  );

  const updated = data?.updatePayment;

  if (
    !updated?.id ||
    updated.id !== payment.id ||
    updated.orderID !== payment.orderID ||
    updated.reference !== payment.reference ||
    updated.checkoutUrl !== checkoutUrl
  ) {
    throw new Error("Checkout URL could not be saved to the payment record.");
  }

  return updated;
}

/* ============================================================
   UPDATE PAYMENT STATUS
============================================================ */

async function updatePaymentStatus({ payment, status }) {
  const mutation = `
    mutation UpdateDeliveryPaymentStatus(
      $input: UpdatePaymentInput!
    ) {
      updatePayment(input: $input) {
        id
        orderID
        reference
        status
      }
    }
  `;

  const data = await graphqlRequest(
    mutation,
    {
      input: {
        id: payment.id,
        status,
      },
    },
    "UpdateDeliveryPaymentStatus",
  );

  const updated = data?.updatePayment;

  if (
    !updated?.id ||
    updated.id !== payment.id ||
    updated.reference !== payment.reference ||
    normalize(updated.status) !== normalize(status)
  ) {
    throw new Error("Payment status could not be updated.");
  }

  return updated;
}

/* ============================================================
   RESERVE ORDER FOR ELECTRONIC PAYMENT
============================================================ */

async function reserveOrderForPayment({ order, payment }) {
  const mutation = `
    mutation ReserveDeliveryOrderPayment($input: UpdateOrderInput!) {
      updateOrder(input: $input) {
        id
        userID
        paymentStatus
        paymentMethod
        paymentTiming
        paymentID
        paymentReference
        _version
      }
    }
  `;

  const input = {
    id: order.id,
    paymentStatus: "PROCESSING",

    // IMPORTANT:
    // Do not overwrite paymentMethod or paymentTiming.
    // An electronic checkout may be generated for receiver
    // ON_DELIVERY even when the order currently has CASH selected
    // or its method has not yet been chosen.
    paymentID: payment.id,
    paymentReference: payment.reference,
  };

  // Include DataStore version when available to help prevent
  // overwriting a newer version of the order.
  if (Number.isInteger(order._version)) {
    input._version = order._version;
  }

  const data = await graphqlRequest(
    mutation,
    { input },
    "ReserveDeliveryOrderPayment",
  );

  const updated = data?.updateOrder;

  if (
    !updated?.id ||
    updated.id !== order.id ||
    updated.paymentID !== payment.id ||
    updated.paymentReference !== payment.reference ||
    normalize(updated.paymentStatus) !== "PROCESSING" ||
    normalize(updated.paymentMethod) !== normalize(order.paymentMethod) ||
    normalize(updated.paymentTiming) !== normalize(order.paymentTiming)
  ) {
    throw new Error(
      "The order could not be reserved for this payment attempt.",
    );
  }

  return updated;
}

/* ============================================================
   MARK ORDER PAYMENT FAILED
   Used only when a failure is known to be definitive.
============================================================ */

async function markOrderPaymentFailed({ orderId, reference }) {
  const order = await getOrder(orderId);

  if (!order) {
    return;
  }

  // Never change a newer payment attempt.
  if (order.paymentReference !== reference) {
    return;
  }

  // Never overwrite a successful payment.
  if (normalize(order.paymentStatus) === "PAID") {
    return;
  }

  const mutation = `
    mutation MarkDeliveryOrderPaymentFailed(
      $input: UpdateOrderInput!
    ) {
      updateOrder(input: $input) {
        id
        paymentStatus
        paymentReference
        _version
      }
    }
  `;

  const input = {
    id: order.id,
    paymentStatus: "FAILED",
  };

  if (Number.isInteger(order._version)) {
    input._version = order._version;
  }

  const data = await graphqlRequest(
    mutation,
    { input },
    "MarkDeliveryOrderPaymentFailed",
  );

  const updated = data?.updateOrder;

  if (
    !updated?.id ||
    updated.paymentReference !== reference ||
    normalize(updated.paymentStatus) !== "FAILED"
  ) {
    throw new Error("The order payment failure status could not be confirmed.");
  }
}

/* ============================================================
   INITIALIZE PAYSTACK TRANSACTION
============================================================ */

async function initializePaystackTransaction({
  order,
  amount,
  reference,
  payerEmail,
  payerPhone,
  paymentTiming,
}) {
  const secretKey = await getPaystackSecretKey();
  const amountInKobo = Math.round(amount * 100);

  if (!Number.isSafeInteger(amountInKobo) || amountInKobo <= 0) {
    throw new Error("The payment amount is invalid.");
  }

  const timing =
    normalize(paymentTiming) === "BEFORE_PICKUP"
      ? "BEFORE_PICKUP"
      : "ON_DELIVERY";

  const payload = {
    email: payerEmail,
    amount: amountInKobo,
    currency: "NGN",
    reference,

    metadata: {
      orderID: order.id,
      paymentReference: reference,
      bookingSource: order.bookingSource || "APP",
      paymentResponsibility: "RECEIVER",
      paymentTiming: timing,
      paymentMethod: "PAYSTACK",
      payerEmail,
      payerPhone: payerPhone || "",

      custom_fields: [
        {
          display_name: "Atua Order ID",
          variable_name: "atua_order_id",
          value: order.id,
        },
        {
          display_name: "Payment Responsibility",
          variable_name: "payment_responsibility",
          value: "RECEIVER",
        },
        {
          display_name: "Payment Timing",
          variable_name: "payment_timing",
          value: timing,
        },
      ],
    },
  };

  const response = await fetch(
    "https://api.paystack.co/transaction/initialize",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("Paystack returned an invalid response.");
  }

  if (
    !response.ok ||
    !result?.status ||
    !result?.data?.authorization_url ||
    !result?.data?.reference
  ) {
    console.error("PAYSTACK INITIALIZATION FAILED:", {
      statusCode: response.status,
      message: result?.message,
      orderId: order.id,
      reference,
    });

    // Do not automatically mark the attempt FAILED here.
    // If the request timed out or the response was incomplete,
    // Paystack may still have created the transaction.
    throw new Error(
      result?.message || "Paystack could not initialize this payment.",
    );
  }

  if (result.data.reference !== reference) {
    throw new Error("Paystack returned an unexpected payment reference.");
  }

  return {
    authorizationUrl: result.data.authorization_url,
    reference: result.data.reference,
  };
}

/* ============================================================
   MAIN HANDLER
============================================================ */

exports.handler = async (event) => {
  console.log("INITIALIZE DELIVERY PAYMENT STARTED");

  let orderId = null;

  try {
    const args = event?.arguments || event?.input || {};

    orderId = args.orderId || args.orderID;

    const requestedPayerEmail =
      typeof args.payerEmail === "string"
        ? args.payerEmail.trim().toLowerCase()
        : "";

    const suppliedPayerPhone =
      typeof args.payerPhone === "string"
        ? args.payerPhone.trim().slice(0, 32)
        : "";

    /* -----------------------------------------------
       1. AUTHENTICATION
    ----------------------------------------------- */

    if (!getCognitoSub(event)) {
      return failureResult(
        "You must be signed in to generate a payment link.",
        orderId || null,
      );
    }

    /* -----------------------------------------------
       2. INPUT VALIDATION
    ----------------------------------------------- */

    if (typeof orderId !== "string" || !orderId.trim()) {
      return failureResult("A valid order ID is required.");
    }

    orderId = orderId.trim();

    if (requestedPayerEmail && !isValidEmail(requestedPayerEmail)) {
      return failureResult(
        "The supplied payer email address is invalid.",
        orderId,
      );
    }

    /* -----------------------------------------------
       3. LOAD ORDER
    ----------------------------------------------- */

    const order = await getOrder(orderId);

    if (!order) {
      return failureResult("Order could not be found.", orderId);
    }

    if (!order.userID) {
      return failureResult(
        "This order has no associated sender account.",
        order.id,
      );
    }

    /* -----------------------------------------------
       4. AUTHORIZE SENDER OR ASSIGNED COURIER
    ----------------------------------------------- */

    const authorization = await authorizeOrderCaller(event, order);

    if (!authorization.allowed) {
      return failureResult(authorization.reason, order.id);
    }

    /* -----------------------------------------------
       5. VALIDATE AMOUNT
    ----------------------------------------------- */

    const amount = Number(order.totalPrice);

    if (!isPositiveAmount(amount)) {
      return failureResult(
        "The order has an invalid payment amount.",
        order.id,
      );
    }

    /* -----------------------------------------------
       6. VALIDATE ORDER STATUS
    ----------------------------------------------- */

    const orderStatus = normalize(order.status);

    if (orderStatus === "CANCELLED" || orderStatus === "DELIVERED") {
      return failureResult(
        "Payment cannot be initialized for a cancelled or delivered order.",
        order.id,
      );
    }

    /* -----------------------------------------------
       7. VALIDATE MAXI ORDER, IF APPLICABLE
    ----------------------------------------------- */

    if (
      normalize(order.transportationType) === "MAXI" &&
      (orderStatus !== "ACCEPTED" || !order.acceptedOfferID)
    ) {
      return failureResult(
        "This MAXI order must have an accepted bid before payment can be initialized.",
        order.id,
      );
    }

    /* -----------------------------------------------
       8. VALIDATE PAYMENT ARRANGEMENT
    ----------------------------------------------- */

    if (normalize(order.paymentResponsibility) !== "RECEIVER") {
      return failureResult(
        "This order is not configured for receiver payment.",
        order.id,
      );
    }

    const currentTiming = normalize(order.paymentTiming);

    if (currentTiming !== "BEFORE_PICKUP" && currentTiming !== "ON_DELIVERY") {
      return failureResult(
        "This order does not have a supported receiver payment timing.",
        order.id,
      );
    }

    /*
     * The receiver may choose cash or electronic payment at delivery.
     * Do not block electronic checkout merely because CASH was
     * selected as a preliminary preference.
     *
     * Actual recorded cash collection still blocks electronic
     * checkout below.
     */
    const selectedPaymentMethod = normalize(order.paymentMethod);
    const allowedMethods = ["", "PAYSTACK", "CASH"];

    if (
      currentTiming === "BEFORE_PICKUP" &&
      selectedPaymentMethod !== "PAYSTACK"
    ) {
      return failureResult(
        "Receiver payments before pickup must use Paystack.",
        order.id,
      );
    }

    if (!allowedMethods.includes(selectedPaymentMethod)) {
      return failureResult(
        "The current payment arrangement cannot use this electronic checkout flow.",
        order.id,
      );
    }

    /* -----------------------------------------------
       9. PREVENT PAYMENT/CASH CONFLICTS
    ----------------------------------------------- */

    if (normalize(order.paymentStatus) === "PAID") {
      return failureResult("This order has already been paid for.", order.id);
    }

    if (
      order.cashCollectionID ||
      order.cashCollectedAt ||
      Number(order.cashCollectedAmount || 0) > 0
    ) {
      return failureResult(
        "Cash collection has already been recorded for this order.",
        order.id,
      );
    }

    /* -----------------------------------------------
       10. PAYER EMAIL AND PHONE
    ----------------------------------------------- */

    const identityEmail = getIdentityEmail(event);

    const safeOrderId = String(order.id)
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .slice(0, 80);

    // Paystack requires an email address. Use the supplied email
    // first, then the authenticated caller's email, then a fallback.
    const payerEmail =
      requestedPayerEmail ||
      (isValidEmail(identityEmail) ? identityEmail : "") ||
      `payment-${safeOrderId}@atuainc.com`;

    const payerPhone =
      suppliedPayerPhone ||
      String(order.recipientNumber || "")
        .trim()
        .slice(0, 32);

    /* -----------------------------------------------
       11. REUSE AN EXISTING PAYMENT ATTEMPT IF VALID
    ----------------------------------------------- */

    if (order.paymentReference || order.paymentID) {
      if (!order.paymentReference) {
        return failureResult(
          "A previous payment attempt needs reconciliation before another can be created.",
          order.id,
        );
      }

      const existingPayment = await getPaymentByReference(
        order.paymentReference,
      );

      if (
        !existingPayment ||
        existingPayment.orderID !== order.id ||
        existingPayment.userID !== order.userID ||
        existingPayment.reference !== order.paymentReference ||
        normalize(existingPayment.provider) !== "PAYSTACK" ||
        normalize(existingPayment.paymentMethod) !== "PAYSTACK"
      ) {
        return failureResult(
          "A previous payment attempt could not be safely verified. Please reconcile it before retrying.",
          order.id,
        );
      }

      /*
       * Reuse only when the Order and Payment point to the same
       * pending payment and the checkout URL is available.
       */
      if (
        normalize(order.paymentStatus) === "PROCESSING" &&
        order.paymentID === existingPayment.id &&
        normalize(existingPayment.status) === "PENDING" &&
        existingPayment.checkoutUrl &&
        Math.round(Number(existingPayment.amount) * 100) ===
          Math.round(amount * 100) &&
        normalize(existingPayment.currency) === "NGN"
      ) {
        console.log("REUSING EXISTING CHECKOUT:", {
          orderId: order.id,
          paymentId: existingPayment.id,
          reference: existingPayment.reference,
          callerRole: authorization.role,
        });

        return successResult({
          orderId: order.id,
          paymentId: existingPayment.id,
          reference: existingPayment.reference,
          checkoutUrl: existingPayment.checkoutUrl,
          amount,
          reused: true,
        });
      }

      /*
       * Only replace an attempt if BOTH the Order and Payment are
       * marked FAILED. Pending, successful, mismatched, or uncertain
       * attempts must be reconciled first.
       */
      if (
        normalize(order.paymentStatus) !== "FAILED" ||
        normalize(existingPayment.status) !== "FAILED"
      ) {
        return failureResult(
          "A previous payment attempt exists and cannot safely be replaced yet. Verify its status before trying again.",
          order.id,
        );
      }
    }

    /* -----------------------------------------------
       12. CREATE UNIQUE REFERENCE AND PAYMENT RECORD
    ----------------------------------------------- */

    const reference = `ATUA-DELIVERY-${order.id}-${crypto.randomUUID()}`;

    const payment = await createPayment({
      order,
      reference,
      amount,
      payerEmail,
      payerPhone,
    });

    /* -----------------------------------------------
       13. RESERVE ORDER FOR THIS ATTEMPT
    ----------------------------------------------- */

    try {
      await reserveOrderForPayment({
        order,
        payment,
      });
    } catch (reserveError) {
      console.error(
        "FAILED TO RESERVE ORDER FOR PAYMENT:",
        reserveError?.message || reserveError,
      );

      /*
       * The Paystack request has not been made yet.
       *
       * Do not automatically mark the Payment FAILED here: an
       * AppSync response can fail after a mutation has succeeded.
       * The order and payment records should be checked before
       * changing the status or starting another attempt.
       */

      return failureResult(
        "The order could not be safely reserved for payment. Refresh the order and reconcile this attempt before retrying.",
        order.id,
      );
    }

    /* -----------------------------------------------
       14. INITIALIZE PAYSTACK
    ----------------------------------------------- */

    let paystackResult;

    try {
      paystackResult = await initializePaystackTransaction({
        order,
        amount,
        reference,
        payerEmail,
        payerPhone,
        paymentTiming: currentTiming,
      });
    } catch (paystackError) {
      console.error(
        "PAYSTACK INITIALIZATION ERROR:",
        paystackError?.message || paystackError,
      );

      /*
       * Do not automatically mark this attempt FAILED.
       * A network timeout or incomplete response does not prove
       * Paystack failed to create the transaction.
       *
       * Leave the attempt attached to the order for reconciliation.
       */

      return failureResult(
        "Paystack's response could not be confirmed. This payment attempt must be checked before another is created.",
        order.id,
      );
    }

    /* -----------------------------------------------
       15. SAVE CHECKOUT URL ON PAYMENT
    ----------------------------------------------- */

    let updatedPayment;

    try {
      updatedPayment = await updatePaymentCheckout({
        payment,
        checkoutUrl: paystackResult.authorizationUrl,
      });
    } catch (saveError) {
      console.error(
        "FAILED TO SAVE PAYSTACK CHECKOUT URL:",
        saveError?.message || saveError,
      );

      /*
       * Paystack has initialized the reference. Leave the attempt
       * PROCESSING and reconcile it; do not mark it FAILED or
       * create another reference automatically.
       */

      return failureResult(
        "Paystack created a payment attempt, but the checkout link could not be saved. The attempt must be reconciled before retrying.",
        order.id,
      );
    }

    /* -----------------------------------------------
       16. RETURN CHECKOUT DETAILS
    ----------------------------------------------- */

    console.log("DELIVERY PAYMENT CHECKOUT READY:", {
      orderId: order.id,
      paymentId: updatedPayment.id,
      reference: updatedPayment.reference,
      callerRole: authorization.role,
      amount,
      paymentResponsibility: "RECEIVER",
      paymentTiming: currentTiming,
      paymentMethod: "PAYSTACK",
    });

    return successResult({
      orderId: order.id,
      paymentId: updatedPayment.id,
      reference: updatedPayment.reference,
      checkoutUrl: updatedPayment.checkoutUrl,
      amount,
      reused: false,
    });
  } catch (error) {
    console.error(
      "INITIALIZE DELIVERY PAYMENT ERROR:",
      error?.message || error,
    );

    // Keep internal AWS/AppSync/Paystack errors out of the response.
    return failureResult(
      "Unable to initialize delivery payment. Please retry or contact Atua support if the problem persists.",
      orderId,
    );
  }
};
