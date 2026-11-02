/*
 * ============================================================
 * INITIALIZE ATUA PAYMENT
 * ============================================================
 *
 * Purpose:
 * - Initialize Paystack payments for eligible Atua orders.
 * - Support SENDER and RECEIVER payment responsibility.
 * - Support BEFORE_PICKUP payment.
 * - Support receiver ON_DELIVERY electronic payments.
 * - Reuse a valid existing pending checkout.
 * - Save the Payment record and link it to the Order.
 * - Avoid creating replacement transactions when an earlier
 *   transaction's outcome is uncertain.
 *
 * IMPORTANT SECURITY NOTE:
 * This Lambda authenticates the caller, but the current version
 * does not fully verify whether that caller is authorized to
 * initiate payment for the requested order.
 *
 * Implement and test the appropriate sender/receiver/support
 * authorization before deploying this version to production.
 * ============================================================
 */

const crypto = require("crypto");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

/* ============================================================
   1. CONFIGURATION
============================================================ */

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const GRAPHQL_API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

const REGION = process.env.REGION || process.env.AWS_REGION || "eu-north-1";

// This environment variable must contain the SSM parameter NAME,
// not the Paystack secret key itself.
const PAYSTACK_SECRET_PARAMETER = process.env.PAYSTACK_SECRET_KEY;

const ssmClient = new SSMClient({ region: REGION });

let cachedPaystackSecret = null;

/* ============================================================
   2. GENERAL HELPERS
============================================================ */

// Normalize enum-like values before comparing them.
const normalize = (value) =>
  String(value ?? "")
    .trim()
    .toUpperCase();

// Consistent failure response for the AppSync mutation.
const failureResult = (message, orderId = null) => ({
  success: false,
  message,
  orderId,
  paymentId: null,
  reference: null,
  checkoutUrl: null,
  amount: null,
  currency: "NGN",
  payerEmail: null,
  paymentResponsibility: null,
});

// Consistent success response for the AppSync mutation.
const successResult = ({
  orderId,
  paymentId,
  reference,
  checkoutUrl,
  amount,
  payerEmail,
  paymentResponsibility,
}) => ({
  success: true,
  message: "Payment initialized successfully.",
  orderId,
  paymentId,
  reference,
  checkoutUrl,
  amount,
  currency: "NGN",
  payerEmail,
  paymentResponsibility,
});

// Basic email format validation.
const validEmail = (email) =>
  typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

// Confirm that the Lambda was invoked with an authenticated
// Cognito/AppSync identity.
//
// Authentication alone does not prove that the caller is
// authorized to pay for a particular order.
const hasAuthenticatedIdentity = (event) => {
  const identity = event?.identity;

  if (!identity) {
    return false;
  }

  return Boolean(
    identity.sub ||
    identity.username ||
    identity.claims?.sub ||
    identity.claims?.["cognito:username"],
  );
};

/* ============================================================
   3. RETRIEVE PAYSTACK SECRET FROM AWS SSM
============================================================ */

const getPaystackSecretKey = async () => {
  // Cache the secret for subsequent invocations that reuse
  // the same Lambda execution environment.
  if (cachedPaystackSecret) {
    return cachedPaystackSecret;
  }

  if (!PAYSTACK_SECRET_PARAMETER) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  }

  const result = await ssmClient.send(
    new GetParameterCommand({
      Name: PAYSTACK_SECRET_PARAMETER,
      WithDecryption: true,
    }),
  );

  const secretKey = result?.Parameter?.Value?.trim();

  if (!secretKey) {
    throw new Error("Unable to retrieve the Paystack secret key.");
  }

  cachedPaystackSecret = secretKey;

  return secretKey;
};

/* ============================================================
   4. APPSYNC GRAPHQL REQUEST HELPER
============================================================ */

const graphqlRequest = async (
  query,
  variables = {},
  operationName = "InitializeAtuaPayment",
) => {
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
    // Log technical details for CloudWatch troubleshooting.
    console.error(
      "ATUA GRAPHQL REQUEST FAILED:",
      JSON.stringify(result.errors || result),
    );

    throw new Error(
      result.errors?.[0]?.message || "Unable to access Atua payment records.",
    );
  }

  return result.data;
};

/* ============================================================
   5. GET ORDER
============================================================ */

// Keep this selection aligned with fields in your Order model.
const ORDER_FIELDS = `
  id
  userID
  totalPrice
  status
  transportationType
  vehicleClass
  acceptedOfferID
  paymentStatus
  paymentID
  paymentReference
  bookingSource
  paymentResponsibility
  paymentTiming
  paymentMethod
  receiverConfirmationStatus
  receiverPaymentExpiresAt
  createdAt
  updatedAt
  _version
`;

const getOrder = async (orderId) => {
  const query = `
    query GetOrderForPayment($id: ID!) {
      getOrder(id: $id) {
        ${ORDER_FIELDS}
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    { id: orderId },
    "GetOrderForPayment",
  );

  return data?.getOrder || null;
};

/* ============================================================
   6. GET PAYMENT BY ID
============================================================ */

// IMPORTANT:
// Use getPayment(id: $id). Your schema does not have the
// paymentsByPaymentReference query used in the earlier version.
const getPaymentById = async (paymentId) => {
  if (!paymentId) {
    return null;
  }

  const query = `
    query GetPaymentById($id: ID!) {
      getPayment(id: $id) {
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

  const data = await graphqlRequest(query, { id: paymentId }, "GetPaymentById");

  return data?.getPayment || null;
};

/* ============================================================
   7. CREATE PAYMENT RECORD
============================================================ */

const createPayment = async ({
  order,
  reference,
  amount,
  payerEmail,
  payerPhone,
}) => {
  const mutation = `
    mutation CreateAtuaPayment(
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

  const data = await graphqlRequest(mutation, { input }, "CreateAtuaPayment");

  const payment = data?.createPayment;

  // Verify the created record is linked to the expected order.
  if (
    !payment?.id ||
    payment.orderID !== order.id ||
    payment.userID !== order.userID ||
    payment.reference !== reference
  ) {
    throw new Error("Payment record could not be created correctly.");
  }

  return payment;
};

/* ============================================================
   8. SAVE PAYSTACK CHECKOUT URL TO PAYMENT
============================================================ */

const updatePaymentCheckout = async ({ payment, checkoutUrl }) => {
  const mutation = `
    mutation UpdateAtuaPaymentCheckout(
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
        payerEmail
        payerPhone
        checkoutUrl
      }
    }
  `;

  const input = {
    id: payment.id,
    checkoutUrl,
  };

  const data = await graphqlRequest(
    mutation,
    { input },
    "UpdateAtuaPaymentCheckout",
  );

  const updatedPayment = data?.updatePayment;

  // Do not return a checkout URL unless the database update
  // confirms that the URL was saved on the expected Payment.
  if (
    !updatedPayment?.id ||
    updatedPayment.id !== payment.id ||
    updatedPayment.reference !== payment.reference ||
    updatedPayment.orderID !== payment.orderID ||
    updatedPayment.userID !== payment.userID ||
    updatedPayment.checkoutUrl !== checkoutUrl
  ) {
    throw new Error("Payment checkout URL could not be saved correctly.");
  }

  return updatedPayment;
};

/* ============================================================
   9. LINK PAYMENT TO ORDER
============================================================ */

const updateOrderPayment = async ({ order, payment }) => {
  const mutation = `
    mutation UpdateAtuaOrderPayment(
      $input: UpdateOrderInput!
    ) {
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

  // PROCESSING means a payment attempt is underway.
  // It must not be treated as confirmation that money was received.
  //
  // Intentionally do not change paymentMethod or paymentTiming.
  // Receiver ON_DELIVERY orders may retain their original method.
  const input = {
    id: order.id,
    paymentStatus: "PROCESSING",
    paymentID: payment.id,
    paymentReference: payment.reference,
  };

  // Respect AppSync optimistic concurrency if _version is present.
  if (Number.isInteger(order._version)) {
    input._version = order._version;
  }

  const data = await graphqlRequest(
    mutation,
    { input },
    "UpdateAtuaOrderPayment",
  );

  const updatedOrder = data?.updateOrder;

  // Verify the Order points to the new Payment and that the
  // original payment arrangement has not been changed.
  if (
    !updatedOrder?.id ||
    updatedOrder.id !== order.id ||
    updatedOrder.paymentID !== payment.id ||
    updatedOrder.paymentReference !== payment.reference ||
    normalize(updatedOrder.paymentMethod) !== normalize(order.paymentMethod) ||
    normalize(updatedOrder.paymentTiming) !== normalize(order.paymentTiming)
  ) {
    throw new Error(
      "Payment details could not be saved correctly on the order.",
    );
  }

  return updatedOrder;
};

/* ============================================================
   10. INITIALIZE PAYSTACK TRANSACTION
============================================================ */

const initializePaystackTransaction = async ({
  order,
  amount,
  reference,
  payerEmail,
  payerPhone,
}) => {
  const secretKey = await getPaystackSecretKey();

  const paymentResponsibility = normalize(order.paymentResponsibility);

  const paymentTiming = normalize(order.paymentTiming);

  const payload = {
    email: payerEmail,

    // Paystack expects the amount in kobo, not naira.
    amount: Math.round(amount * 100),

    currency: "NGN",
    reference,

    metadata: {
      orderID: order.id,
      paymentReference: reference,
      bookingSource: order.bookingSource || "APP",
      paymentResponsibility,
      paymentTiming,
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
          value: paymentResponsibility,
        },
        {
          display_name: "Payment Timing",
          variable_name: "payment_timing",
          value: paymentTiming,
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
    !result.status ||
    !result.data?.authorization_url ||
    !result.data?.reference
  ) {
    console.error("PAYSTACK INITIALIZATION FAILED:", {
      statusCode: response.status,
      message: result.message,
      reference,
      orderId: order.id,
    });

    throw new Error(
      result.message || "Paystack could not initialize this payment.",
    );
  }

  // Ensure Paystack returned the exact reference generated by Atua.
  if (result.data.reference !== reference) {
    throw new Error("Paystack returned an unexpected payment reference.");
  }

  return {
    authorizationUrl: result.data.authorization_url,
    reference: result.data.reference,
  };
};

/* ============================================================
   11. MAIN LAMBDA HANDLER
============================================================ */

exports.handler = async (event) => {
  console.log("INITIALIZE ATUA PAYMENT STARTED");

  let orderId = null;

  try {
    const args = event?.arguments || event?.input || {};

    orderId = args.orderId || args.orderID;

    const requestedPayerEmail =
      typeof args.payerEmail === "string"
        ? args.payerEmail.trim().toLowerCase()
        : "";

    const payerPhone =
      typeof args.payerPhone === "string" ? args.payerPhone.trim() : "";

    /* --------------------------------------------------------
       STEP 1: AUTHENTICATION
    -------------------------------------------------------- */

    if (!hasAuthenticatedIdentity(event)) {
      return failureResult(
        "You must be signed in to generate a payment link.",
        orderId || null,
      );
    }

    /* --------------------------------------------------------
       STEP 2: INPUT VALIDATION
    -------------------------------------------------------- */

    if (!orderId || typeof orderId !== "string" || !orderId.trim()) {
      return failureResult("A valid order ID is required.");
    }

    orderId = orderId.trim();

    if (requestedPayerEmail && !validEmail(requestedPayerEmail)) {
      return failureResult(
        "The supplied payer email address is invalid.",
        orderId,
      );
    }

    /* --------------------------------------------------------
       STEP 3: LOAD ORDER
    -------------------------------------------------------- */

    const order = await getOrder(orderId);

    if (!order) {
      return failureResult("Order could not be found.", orderId);
    }

    /*
     * SECURITY TODO — DO NOT IGNORE:
     *
     * The authenticated caller must be authorized to initiate
     * payment for this specific order.
     *
     * Do not blindly compare the caller only with order.userID:
     * a legitimate receiver may be different from the sender who
     * created the order.
     *
     * Implement the authorization rule that matches your actual
     * sender, receiver, and support/admin access model.
     */

    /* --------------------------------------------------------
       STEP 4: DETERMINE PAYER EMAIL
    -------------------------------------------------------- */

    const identityEmail =
      event?.identity?.claims?.email ||
      event?.identity?.claims?.["cognito:email"] ||
      event?.identity?.email ||
      "";

    // Keep the fallback email safe for use in the generated address.
    const safeOrderId = String(order.id)
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .slice(0, 80);

    const payerEmail =
      requestedPayerEmail ||
      (validEmail(identityEmail) ? identityEmail.trim().toLowerCase() : "") ||
      `payment-${safeOrderId}@atuainc.com`;

    console.log("PAYER EMAIL SOURCE:", {
      orderId: order.id,
      suppliedByCaller: Boolean(requestedPayerEmail),
      availableInCognito: validEmail(identityEmail),
      fallbackUsed: !requestedPayerEmail && !validEmail(identityEmail),
    });

    /*
     * Paystack requires an email address.
     *
     * The fallback permits a receiver payment link to be generated
     * when the receiver's actual email address is unavailable.
     * It is not the receiver's actual email address.
     */

    /* --------------------------------------------------------
       STEP 5: VALIDATE ORDER AND AMOUNT
    -------------------------------------------------------- */

    if (!order.userID) {
      return failureResult(
        "This order does not have an associated user.",
        order.id,
      );
    }

    const amount = Number(order.totalPrice);

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isSafeInteger(Math.round(amount * 100))
    ) {
      return failureResult(
        "The order has an invalid payment amount.",
        order.id,
      );
    }

    const orderStatus = normalize(order.status);

    const currentPaymentStatus = normalize(order.paymentStatus);

    if (["CANCELLED", "DELIVERED", "DISPUTED"].includes(orderStatus)) {
      return failureResult(
        "Payment cannot be initialized for a cancelled, delivered or disputed order.",
        order.id,
      );
    }

    if (["PAID", "SUCCESSFUL"].includes(currentPaymentStatus)) {
      return failureResult("This order has already been paid for.", order.id);
    }

    /* --------------------------------------------------------
       STEP 6: MAXI PAYMENT ELIGIBILITY
    -------------------------------------------------------- */

    const transportationType = normalize(order.transportationType);

    const isMaxi = transportationType === "MAXI";

    if (
      isMaxi &&
      (!["ACCEPTED", "AWAITING_PAYMENT"].includes(orderStatus) ||
        !order.acceptedOfferID)
    ) {
      return failureResult(
        "This MAXI order must have an accepted bid before payment can be initialized.",
        order.id,
      );
    }

    /* --------------------------------------------------------
       STEP 7: VALIDATE PAYMENT ARRANGEMENT
    -------------------------------------------------------- */

    const paymentResponsibility = normalize(order.paymentResponsibility);

    const paymentTiming = normalize(order.paymentTiming);

    const paymentMethod = normalize(order.paymentMethod);

    const validResponsibility = ["SENDER", "RECEIVER"].includes(
      paymentResponsibility,
    );

    // Sender payments must be made before pickup.
    // Receiver payments may be made before pickup or on delivery.
    const validTiming =
      paymentResponsibility === "SENDER"
        ? paymentTiming === "BEFORE_PICKUP"
        : paymentResponsibility === "RECEIVER" &&
          ["BEFORE_PICKUP", "ON_DELIVERY"].includes(paymentTiming);

    /*
     * Valid arrangements for THIS Lambda:
     *
     * 1. SENDER + BEFORE_PICKUP + PAYSTACK
     * 2. RECEIVER + BEFORE_PICKUP + PAYSTACK
     * 3. RECEIVER + ON_DELIVERY
     *
     * For receiver ON_DELIVERY, the selected Order.paymentMethod
     * is intentionally not overwritten here. This Lambda creates
     * an electronic checkout attempt; it does not silently change
     * the Order's chosen payment arrangement.
     */
    const validPaymentArrangement =
      (paymentResponsibility === "SENDER" &&
        paymentTiming === "BEFORE_PICKUP" &&
        paymentMethod === "PAYSTACK") ||
      (paymentResponsibility === "RECEIVER" &&
        paymentTiming === "BEFORE_PICKUP" &&
        paymentMethod === "PAYSTACK") ||
      (paymentResponsibility === "RECEIVER" && paymentTiming === "ON_DELIVERY");

    if (!validResponsibility || !validTiming || !validPaymentArrangement) {
      return failureResult(
        "This payment arrangement cannot be initialized through this payment flow.",
        order.id,
      );
    }

    /* --------------------------------------------------------
       STEP 8: REUSE AN EXISTING PAYMENT ATTEMPT WHEN SAFE
    -------------------------------------------------------- */

    if (
      order.paymentReference ||
      order.paymentID ||
      currentPaymentStatus === "PROCESSING"
    ) {
      /*
       * An attempt without both identifiers cannot safely be
       * replaced because the previous transaction's status
       * may be uncertain.
       */
      if (!order.paymentReference || !order.paymentID) {
        return failureResult(
          "A payment attempt already exists but its reference or payment ID is missing. Verify its status before trying again.",
          order.id,
        );
      }

      // Fetch the Payment by its actual model ID.
      const existingPayment = await getPaymentById(order.paymentID);

      /*
       * Reuse only when the Order and Payment records match,
       * the Payment is still pending, and the checkout URL exists.
       */
      const reusable =
        Boolean(existingPayment) &&
        existingPayment.id === order.paymentID &&
        existingPayment.orderID === order.id &&
        existingPayment.userID === order.userID &&
        existingPayment.reference === order.paymentReference &&
        normalize(existingPayment.provider) === "PAYSTACK" &&
        normalize(existingPayment.paymentMethod) === "PAYSTACK" &&
        normalize(existingPayment.status) === "PENDING" &&
        Number(existingPayment.amount) === amount &&
        normalize(existingPayment.currency) === "NGN" &&
        Boolean(existingPayment.checkoutUrl) &&
        currentPaymentStatus === "PROCESSING" &&
        (paymentMethod === "PAYSTACK" ||
          (paymentResponsibility === "RECEIVER" &&
            paymentTiming === "ON_DELIVERY"));

      if (reusable) {
        return successResult({
          orderId: order.id,
          paymentId: existingPayment.id,
          reference: existingPayment.reference,
          checkoutUrl: existingPayment.checkoutUrl,
          amount: Number(existingPayment.amount),
          payerEmail: existingPayment.payerEmail,
          paymentResponsibility,
        });
      }

      /*
       * Do not initialize a replacement transaction here.
       *
       * The previous Paystack transaction might still be payable,
       * or it might have succeeded without the database being
       * updated. Reconcile its status before another attempt.
       */
      return failureResult(
        "A payment attempt already exists for this order and cannot safely be replaced yet. Verify its status or contact Atua support before trying again.",
        order.id,
      );
    }

    /* --------------------------------------------------------
       STEP 9: GENERATE A UNIQUE PAYMENT REFERENCE
    -------------------------------------------------------- */

    const reference = `ATUA-${order.id}-${crypto.randomUUID()}`;

    /* --------------------------------------------------------
       STEP 10: CREATE THE PENDING PAYMENT RECORD
    -------------------------------------------------------- */

    const payment = await createPayment({
      order,
      reference,
      amount,
      payerEmail,
      payerPhone,
    });

    /*
     * Save the attempt against the Order BEFORE calling Paystack.
     *
     * This makes the attempt traceable if Paystack succeeds but
     * a later database operation fails.
     *
     * If this Order update fails, Paystack is not called.
     */
    await updateOrderPayment({
      order,
      payment,
    });

    /* --------------------------------------------------------
       STEP 11: INITIALIZE PAYSTACK
    -------------------------------------------------------- */

    const paystackResult = await initializePaystackTransaction({
      order,
      amount,
      reference,
      payerEmail,
      payerPhone,
    });

    /* --------------------------------------------------------
       STEP 12: SAVE THE CHECKOUT URL
    -------------------------------------------------------- */

    const updatedPayment = await updatePaymentCheckout({
      payment,
      checkoutUrl: paystackResult.authorizationUrl,
    });

    /* --------------------------------------------------------
       STEP 13: RETURN THE CHECKOUT DETAILS
    -------------------------------------------------------- */

    console.log("PAYMENT INITIALIZED SUCCESSFULLY:", {
      orderId: order.id,
      paymentId: updatedPayment.id,
      reference: updatedPayment.reference,
      paymentResponsibility,
      paymentTiming,
    });

    return successResult({
      orderId: order.id,
      paymentId: updatedPayment.id,
      reference: updatedPayment.reference,
      checkoutUrl: paystackResult.authorizationUrl,
      amount,
      payerEmail,
      paymentResponsibility,
    });
  } catch (error) {
    console.error("INITIALIZE ATUA PAYMENT ERROR:", {
      orderId,
      message: error?.message || String(error),
    });

    /*
     * Do not automatically reset the Order to PENDING or create
     * a replacement payment here.
     *
     * Paystack may have initialized the transaction even if a
     * subsequent database operation failed. Reconcile the saved
     * reference before allowing another payment attempt.
     */
    return failureResult(
      "Unable to initialize payment at this time. Please verify the payment status or contact Atua support before trying again.",
      orderId,
    );
  }
};
