/* Amplify Params - DO NOT EDIT
    API_ATUA_GRAPHQLAPIENDPOINTOUTPUT
    API_ATUA_GRAPHQLAPIIDOUTPUT
    API_ATUA_GRAPHQLAPIKEYOUTPUT
    ENV
    REGION
 Amplify Params - DO NOT EDIT */

const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

const https = require("https");
const crypto = require("crypto");

/* ==========================================================
   CONFIGURATION
========================================================== */

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const GRAPHQL_API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

const REGION = process.env.REGION || process.env.AWS_REGION;

/* ==========================================================
   GET PAYSTACK SECRET FROM SSM
========================================================== */

const getPaystackSecretKey = async () => {
  const parameterName = process.env.PAYSTACK_SECRET_KEY;

  if (!parameterName) {
    throw new Error("PAYSTACK_SECRET_KEY secret is not configured.");
  }

  const ssmClient = new SSMClient({
    region: REGION,
  });

  const command = new GetParameterCommand({
    Name: parameterName,
    WithDecryption: true,
  });

  const result = await ssmClient.send(command);

  const secretKey = result?.Parameter?.Value;

  if (!secretKey) {
    throw new Error("Could not retrieve Paystack secret key.");
  }

  return secretKey;
};

/* ==========================================================
   GRAPHQL REQUEST
========================================================== */

const graphqlRequest = async (
  query,
  variables = {},
  operationName = "GraphQL operation",
) => {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error("Atua GraphQL endpoint is not configured.");
  }

  if (!GRAPHQL_API_KEY) {
    throw new Error("Atua GraphQL API key is not configured.");
  }

  const endpoint = new URL(GRAPHQL_ENDPOINT);

  const body = JSON.stringify({
    query,
    variables,
  });

  const options = {
    hostname: endpoint.hostname,

    path: endpoint.pathname || "/graphql",

    method: "POST",

    headers: {
      "Content-Type": "application/json",

      "Content-Length": Buffer.byteLength(body),

      "x-api-key": GRAPHQL_API_KEY,
    },
  };

  return new Promise((resolve, reject) => {
    const request = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          console.error(`${operationName} HTTP ERROR:`, {
            statusCode: res.statusCode,

            body: data,
          });

          return reject(
            new Error(`${operationName} returned HTTP ${res.statusCode}.`),
          );
        }

        let parsed;

        try {
          parsed = JSON.parse(data);
        } catch (error) {
          console.error(`${operationName} JSON PARSE ERROR:`, error);

          return reject(error);
        }

        if (parsed?.errors?.length) {
          console.error(
            `${operationName} GRAPHQL ERRORS:`,
            JSON.stringify(parsed.errors),
          );

          return reject(
            new Error(
              parsed.errors
                .map((item) => item?.message)
                .filter(Boolean)
                .join(" | ") || `${operationName} failed.`,
            ),
          );
        }

        resolve(parsed?.data || null);
      });
    });

    request.on("error", (error) => {
      console.error(`${operationName} REQUEST ERROR:`, error);

      reject(error);
    });

    request.write(body);
    request.end();
  });
};

/* ==========================================================
   PAYSTACK API REQUEST
========================================================== */

const paystackRequest = async ({ method = "GET", path, secretKey }) => {
  if (!secretKey) {
    throw new Error("Paystack secret key is required.");
  }

  if (!path) {
    throw new Error("Paystack API path is required.");
  }

  const options = {
    hostname: "api.paystack.co",

    path,

    method,

    headers: {
      Authorization: `Bearer ${secretKey}`,

      Accept: "application/json",
    },
  };

  return new Promise((resolve, reject) => {
    const request = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        let parsed;

        try {
          parsed = JSON.parse(data);
        } catch (error) {
          console.error("PAYSTACK JSON PARSE ERROR:", {
            statusCode: res.statusCode,

            body: data,
          });

          return reject(error);
        }

        resolve({
          statusCode: res.statusCode,

          body: parsed,
        });
      });
    });

    request.on("error", (error) => {
      console.error("PAYSTACK REQUEST ERROR:", error);

      reject(error);
    });

    request.end();
  });
};

/* ==========================================================
   COMPLETE ORDER FIELD SELECTION
========================================================== */

/*
 * IMPORTANT:
 *
 * These fields are used when READING an Order and when
 * receiving the result of an Order update.
 *
 * They are NOT all sent in updateOrder input.
 *
 * The webhook only changes the fields that belong to
 * payment finalization.
 */

const ORDER_FIELDS = `
  id

  recipientName
  recipientNumber
  recipientNumber2
  orderDetails

  originAddress
  originState
  originLat
  originLng

  destinationAddress
  destinationState
  destinationLat
  destinationLng

  tripType
  distance

  transportationType
  vehicleClass
  status

  hasNewOffer
  lastOfferAt
  lastOfferSenderType

  loadCategory
  isInterState

  estimatedMinPrice
  estimatedMaxPrice

  initialOfferPrice

  loadingFee
  unloadingFee
  floorSurcharge
  fragileSurcharge
  extrasTotal

  totalPrice
  operationalFare

  courierEarnings
  commissionAmount
  platformFee
  platformServiceRevenue
  vatAmount
  platformNetRevenue

  deliveryVerificationCode

  recipientTrackingToken
  recipientTrackingEnabled
  recipientTrackingRevokedAt

  declaredWeightBracket

  senderPreTransferPhotos
  senderPreTransferVideo
  senderPreTransferRecordedAt

  senderPreTransferLocalPhotos
  senderPreTransferLocalVideo

  mediaUploadStatus

  courierPreTransferUploadStatus
  courierPostLoadingUploadStatus
  dropoffUploadStatus

  courierPreTransferPhotos
  courierPreTransferVideo
  courierPreTransferRecordedAt

  courierPreTransferLocalPhotos
  courierPreTransferLocalVideo

  courierPostLoadingPhotos
  courierPostLoadingVideo

  courierPostLoadingLocalPhotos
  courierPostLoadingLocalVideo

  dropoffArrivalPhotos
  dropoffArrivalVideo

  dropoffArrivalLocalPhotos
  dropoffArrivalLocalVideo

  postDeliveryPhotos
  postDeliveryVideo

  pickupLoadingResponsibility
  pickupFloorLevel
  pickupFloorLevelPrice
  pickupHasElevator

  dropoffUnloadingResponsibility
  dropoffFloorLevel
  dropoffFloorLevelPrice
  dropoffHasElevator

  acceptedAt
  arrivedPickupAt
  loadingStartedAt
  tripStartedAt
  arrivedDropoffAt
  unloadingCompletedAt

  logisticsCompanyId
  waybillNumber
  waybillPhoto
  logisticsTrackingCode
  logisticsTrackingStatus
  handedOverToLogisticsAt
  logisticsIntakeConfirmedAt

  acceptedOfferID

  paymentStatus
  paymentID
  paymentReference

  payoutStatus
  fundsStatus

  earningsAllocationStatus
  earningsAllocatedAt

  fundsReleaseBlocked
  fundsHoldReason
  fundsHeldBy
  fundsHeldAt
  fundsReleasedAmount
  pickupFundsReleasedAt
  fundsReleasedAt
  fundsReleaseType

  assignedCourierId
  assignmentExpiresAt
  assignmentAttempts
  lastAssignedAt
  rejectedCourierIds
  assignmentStatus

  userID

  createdAt
  updatedAt

  _version
  _lastChangedAt
  _deleted
`;

/* ==========================================================
   GET ORDER
========================================================== */

const getOrder = async (orderId) => {
  if (!orderId) {
    throw new Error("Order ID is required.");
  }

  const query = `
    query GetOrder(
      $id: ID!
    ) {
      getOrder(
        id: $id
      ) {
        ${ORDER_FIELDS}
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    {
      id: orderId,
    },
    "GetOrder",
  );

  return data?.getOrder || null;
};

/* ==========================================================
   GET PAYMENT BY REFERENCE
========================================================== */

const getPaymentByReference = async (reference) => {
  if (!reference) {
    throw new Error("Payment reference is required.");
  }

  const query = `
    query ListPayments(
      $filter: ModelPaymentFilterInput
    ) {
      listPayments(
        filter: $filter
        limit: 1
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

          createdAt
          updatedAt

          _version
          _lastChangedAt
          _deleted
        }
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    {
      filter: {
        reference: {
          eq: reference,
        },
      },
    },
    "GetPaymentByReference",
  );

  return data?.listPayments?.items?.find((item) => !item?._deleted) || null;
};

/* ==========================================================
   CREATE PAYMENT
========================================================== */

const createPayment = async ({ order, transaction }) => {
  if (!order?.id) {
    throw new Error("Order is required to create Payment.");
  }

  if (!order?.userID) {
    throw new Error(`Order ${order.id} does not have userID.`);
  }

  if (!transaction?.reference) {
    throw new Error("Paystack transaction reference is required.");
  }

  const amount = Number(order.totalPrice);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid Order totalPrice: ${order.totalPrice}`);
  }

  const mutation = `
    mutation CreatePayment(
      $input: CreatePaymentInput!
    ) {
      createPayment(
        input: $input
      ) {
        id

        orderID
        userID

        amount
        currency

        status
        paymentMethod
        provider

        reference

        createdAt
        updatedAt

        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const input = {
    orderID: order.id,

    userID: order.userID,

    amount,

    currency: transaction.currency || "NGN",

    status: "SUCCESS",

    paymentMethod: transaction.channel || "paystack",

    provider: "PAYSTACK",

    reference: transaction.reference,
  };

  console.log("CREATING PAYMENT:", {
    orderID: input.orderID,

    userID: input.userID,

    amount: input.amount,

    currency: input.currency,

    reference: input.reference,
  });

  const data = await graphqlRequest(
    mutation,
    {
      input,
    },
    "CreatePayment",
  );

  const payment = data?.createPayment || null;

  if (!payment) {
    throw new Error("Payment creation returned no Payment.");
  }

  console.log("PAYMENT CREATED:", {
    paymentID: payment.id,

    orderID: payment.orderID,

    userID: payment.userID,

    amount: payment.amount,

    reference: payment.reference,
  });

  return payment;
};

/* ==========================================================
   GENERATE DELIVERY VERIFICATION CODE
========================================================== */

const generateVerificationCode = () => {
  return crypto.randomInt(0, 1000000).toString().padStart(6, "0");
};

/* ==========================================================
   GENERATE RECIPIENT TRACKING TOKEN
========================================================== */

/*
 * Generates a unique public tracking token for the recipient.
 *
 * The existing token is always preserved during webhook retries.
 */
const generateRecipientTrackingToken = () => {
  return crypto.randomBytes(24).toString("hex");
};

/* ==========================================================
   UPDATE ORDER AFTER SUCCESSFUL PAYMENT
========================================================== */

/*
 * This is the PRIMARY payment finalization operation.
 *
 * One Order update contains:
 *
 * - userID
 * - paymentStatus
 * - paymentID
 * - status
 * - fundsStatus
 * - deliveryVerificationCode
 *
 * We only SEND those fields as the update input.
 *
 * We REQUEST the complete Order back using ORDER_FIELDS.
 *
 * This is important for the DataStore synchronization path.
 */

const finalizePaidOrder = async ({ order, payment }) => {
  if (!order?.id) {
    throw new Error("Cannot finalize Order without Order ID.");
  }

  if (!order?.userID) {
    throw new Error(`Order ${order.id} is missing userID.`);
  }

  if (!payment?.id) {
    throw new Error("Cannot finalize Order without Payment ID.");
  }

  /*
   * --------------------------------------------------------
   * IDEMPOTENCY
   * --------------------------------------------------------
   *
   * If this webhook was already successfully processed,
   * do NOT generate another verification code.
   *
   * This is extremely important because Paystack can retry
   * webhook events.
   */

  if (
    order.paymentStatus === "PAID" &&
    order.paymentID === payment.id &&
    order.deliveryVerificationCode &&
    order.recipientTrackingEnabled === true &&
    order.recipientTrackingToken
  ) {
    console.log("ORDER ALREADY FULLY FINALIZED:", {
      orderID: order.id,

      paymentID: payment.id,

      deliveryVerificationCode: order.deliveryVerificationCode,

      recipientTrackingToken: order.recipientTrackingToken,

      recipientTrackingEnabled: order.recipientTrackingEnabled,

      version: order._version,
    });

    return order;
  }

  /*
   * --------------------------------------------------------
   * VERIFICATION CODE
   * --------------------------------------------------------
   *
   * If an existing code somehow exists, preserve it.
   *
   * Otherwise generate a new one.
   *
   * This prevents a webhook retry from changing the customer's
   * verification code.
   */

  const deliveryVerificationCode =
    order.deliveryVerificationCode || generateVerificationCode();

  /*
   * Enable recipient tracking for every successfully paid order.
   *
   * If a token already exists, preserve it so webhook retries
   * do not generate a different public tracking link.
   */
  const recipientTrackingToken =
    order.recipientTrackingToken || generateRecipientTrackingToken();

  console.log("DELIVERY VERIFICATION CODE:", {
    orderID: order.id,

    code: deliveryVerificationCode,

    existing: Boolean(order.deliveryVerificationCode),
  });

  /*
   * --------------------------------------------------------
   * UPDATE ORDER
   * --------------------------------------------------------
   */

  const mutation = `
    mutation UpdateOrder(
      $input: UpdateOrderInput!
    ) {
      updateOrder(
        input: $input
      ) {
        ${ORDER_FIELDS}
      }
    }
  `;

  const input = {
    id: order.id,

    /*
     * IMPORTANT:
     *
     * userID is explicitly preserved.
     *
     * Your Order schema requires this field and the old
     * subscription problem involved userID becoming null.
     */
    userID: order.userID,

    paymentStatus: "PAID",

    paymentID: payment.id,

    status: "READY_FOR_PICKUP",

    fundsStatus: "HELD",

    deliveryVerificationCode: deliveryVerificationCode,

    recipientTrackingToken: recipientTrackingToken,

    recipientTrackingEnabled: true,
    recipientTrackingRevokedAt: null,
  };

  /*
   * --------------------------------------------------------
   * OPTIMISTIC CONCURRENCY
   * --------------------------------------------------------
   *
   * AppSync/DataStore uses _version.
   *
   * If we have the current version, send it so we don't
   * blindly overwrite a newer Order.
   */

  if (Number.isInteger(order._version)) {
    input._version = order._version;
  }

  console.log("FINALIZING ORDER:", {
    orderID: order.id,

    userID: order.userID,

    previousVersion: order._version,

    paymentID: payment.id,

    paymentStatus: "PAID",

    status: "READY_FOR_PICKUP",

    fundsStatus: "HELD",

    deliveryVerificationCode,
  });

  const data = await graphqlRequest(
    mutation,
    {
      input,
    },
    "FinalizePaidOrder",
  );

  const updatedOrder = data?.updateOrder || null;

  if (!updatedOrder) {
    throw new Error(`updateOrder returned no Order for ${order.id}.`);
  }

  /*
   * --------------------------------------------------------
   * IMPORTANT DATASTORE DIAGNOSTIC
   * --------------------------------------------------------
   *
   * We want to know exactly what AppSync returned from the
   * mutation.
   *
   * If the complete Order is here, but the mobile DataStore
   * temporarily blanks fields, then the remaining problem is
   * on the subscription/synchronization side rather than
   * this Lambda's database update.
   */

  console.log(
    "FINALIZED ORDER RESPONSE:",
    JSON.stringify(
      {
        id: updatedOrder.id,

        userID: updatedOrder.userID,

        recipientName: updatedOrder.recipientName,

        recipientNumber: updatedOrder.recipientNumber,

        originAddress: updatedOrder.originAddress,

        originState: updatedOrder.originState,

        destinationAddress: updatedOrder.destinationAddress,

        destinationState: updatedOrder.destinationState,

        originLat: updatedOrder.originLat,

        originLng: updatedOrder.originLng,

        destinationLat: updatedOrder.destinationLat,

        destinationLng: updatedOrder.destinationLng,

        tripType: updatedOrder.tripType,

        distance: updatedOrder.distance,

        transportationType: updatedOrder.transportationType,

        vehicleClass: updatedOrder.vehicleClass,

        totalPrice: updatedOrder.totalPrice,

        operationalFare: updatedOrder.operationalFare,

        courierEarnings: updatedOrder.courierEarnings,

        paymentStatus: updatedOrder.paymentStatus,

        paymentID: updatedOrder.paymentID,

        paymentReference: updatedOrder.paymentReference,

        payoutStatus: updatedOrder.payoutStatus,

        fundsStatus: updatedOrder.fundsStatus,

        deliveryVerificationCode: updatedOrder.deliveryVerificationCode,

        recipientTrackingToken: updatedOrder.recipientTrackingToken,

        recipientTrackingEnabled: updatedOrder.recipientTrackingEnabled,

        recipientTrackingRevokedAt: updatedOrder.recipientTrackingRevokedAt,

        assignedCourierId: updatedOrder.assignedCourierId,

        assignmentStatus: updatedOrder.assignmentStatus,

        status: updatedOrder.status,

        createdAt: updatedOrder.createdAt,

        updatedAt: updatedOrder.updatedAt,

        _version: updatedOrder._version,

        _lastChangedAt: updatedOrder._lastChangedAt,

        _deleted: updatedOrder._deleted,
      },
      null,
      2,
    ),
  );

  return updatedOrder;
};

/* ==========================================================
   PAYSTACK SIGNATURE VERIFICATION
========================================================== */

const verifyPaystackSignature = ({ rawBody, signature, secretKey }) => {
  if (!rawBody) {
    throw new Error("Paystack webhook body is missing.");
  }

  if (!signature) {
    throw new Error("Paystack signature is missing.");
  }

  const expectedSignature = crypto
    .createHmac("sha512", secretKey)
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  const receivedBuffer = Buffer.from(signature, "utf8");

  /*
   * timingSafeEqual requires both buffers
   * to have the same length.
   */

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
};

/* ==========================================================
   GET PAYSTACK SIGNATURE
========================================================== */

const getPaystackSignature = (event) => {
  const headers = event?.headers || {};

  /*
   * API Gateway may normalize header casing.
   */

  return (
    headers["x-paystack-signature"] ||
    headers["X-Paystack-Signature"] ||
    headers["X-PAYSTACK-SIGNATURE"] ||
    null
  );
};

/* ==========================================================
   PARSE WEBHOOK BODY
========================================================== */

const parseWebhookBody = (event) => {
  if (!event) {
    throw new Error("Webhook event is missing.");
  }

  let body = event.body;

  if (body === undefined || body === null) {
    throw new Error("Webhook body is missing.");
  }

  /*
   * API Gateway can deliver a Base64 encoded body.
   */

  if (event.isBase64Encoded) {
    body = Buffer.from(body, "base64").toString("utf8");
  }

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch (error) {
      console.error("FAILED TO PARSE WEBHOOK BODY:", error.message);

      throw new Error("Invalid Paystack webhook JSON.");
    }
  }

  if (typeof body === "object") {
    return body;
  }

  throw new Error("Unsupported webhook body format.");
};

/* ==========================================================
   EXTRACT ORDER ID
========================================================== */

const extractOrderId = (transaction) => {
  /*
   * Prefer metadata.
   */

  const metadata = transaction?.metadata;

  if (metadata && typeof metadata === "object") {
    const metadataOrderID =
      metadata.orderID || metadata.orderId || metadata.order_id;

    if (metadataOrderID) {
      return metadataOrderID;
    }
  }

  /*
   * Fallback to your Paystack reference:
   *
   * atua_<ORDER_ID>_<TIMESTAMP>
   */

  const reference = transaction?.reference;

  if (!reference) {
    return null;
  }

  const match = reference.match(/^atua_([^_]+)/);

  return match?.[1] || null;
};

/* ==========================================================
   HTTP RESPONSE
========================================================== */

const httpResponse = (statusCode, body) => {
  return {
    statusCode,

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(body),
  };
};

/* ==========================================================
   MAIN WEBHOOK HANDLER
========================================================== */

exports.handler = async (event) => {
  console.log("==========================================");

  console.log("ATUA PAYSTACK WEBHOOK STARTED");

  console.log("==========================================");

  try {
    /*
     * ------------------------------------------------------
     * 1. GET PAYSTACK SECRET
     * ------------------------------------------------------
     */

    const paystackSecret = await getPaystackSecretKey();

    /*
     * ------------------------------------------------------
     * 2. GET RAW BODY
     * ------------------------------------------------------
     */

    let rawBody = event?.body;

    if (rawBody === undefined || rawBody === null) {
      throw new Error("Webhook body is missing.");
    }

    if (event.isBase64Encoded) {
      rawBody = Buffer.from(rawBody, "base64").toString("utf8");
    }

    if (typeof rawBody !== "string") {
      rawBody = JSON.stringify(rawBody);
    }

    /*
     * ------------------------------------------------------
     * 3. VERIFY PAYSTACK SIGNATURE
     * ------------------------------------------------------
     */

    const signature = getPaystackSignature(event);

    const signatureValid = verifyPaystackSignature({
      rawBody,
      signature,
      secretKey: paystackSecret,
    });

    if (!signatureValid) {
      console.error("INVALID PAYSTACK SIGNATURE");

      return httpResponse(401, {
        success: false,

        message: "Invalid Paystack signature.",
      });
    }

    console.log("PAYSTACK SIGNATURE VERIFIED");

    /*
     * ------------------------------------------------------
     * 4. PARSE PAYLOAD
     * ------------------------------------------------------
     */

    const payload = parseWebhookBody({
      ...event,

      body: rawBody,

      isBase64Encoded: false,
    });

    const eventType = payload?.event;

    console.log("PAYSTACK EVENT:", eventType);

    /*
     * ------------------------------------------------------
     * 5. ONLY PROCESS CHARGE.SUCCESS
     * ------------------------------------------------------
     */

    if (eventType !== "charge.success") {
      console.log("IGNORING PAYSTACK EVENT:", eventType);

      return httpResponse(200, {
        success: true,

        ignored: true,

        event: eventType,
      });
    }

    /*
     * ------------------------------------------------------
     * 6. GET TRANSACTION
     * ------------------------------------------------------
     */

    const transaction = payload?.data;

    if (!transaction) {
      throw new Error("charge.success contains no transaction data.");
    }

    const reference = transaction.reference;

    if (!reference) {
      throw new Error("Paystack transaction reference is missing.");
    }

    console.log("PAYSTACK REFERENCE:", reference);

    /*
     * ------------------------------------------------------
     * 7. GET ORDER ID
     * ------------------------------------------------------
     */

    const orderId = extractOrderId(transaction);

    if (!orderId) {
      throw new Error(
        `Could not determine Order ID from Paystack reference ${reference}.`,
      );
    }

    console.log("PAYSTACK ORDER ID:", orderId);

    /*
     * ------------------------------------------------------
     * 8. FETCH CURRENT ORDER
     * ------------------------------------------------------
     */

    const order = await getOrder(orderId);

    if (!order) {
      throw new Error(`Order ${orderId} was not found.`);
    }

    console.log(
      "ORDER FOUND:",
      JSON.stringify(
        {
          id: order.id,

          userID: order.userID,

          status: order.status,

          paymentStatus: order.paymentStatus,

          paymentID: order.paymentID,

          fundsStatus: order.fundsStatus,

          deliveryVerificationCode: order.deliveryVerificationCode,

          totalPrice: order.totalPrice,

          operationalFare: order.operationalFare,

          courierEarnings: order.courierEarnings,

          _version: order._version,
        },
        null,
        2,
      ),
    );

    /*
     * ------------------------------------------------------
     * 9. VALIDATE USER ID
     * ------------------------------------------------------
     */

    if (!order.userID) {
      throw new Error(`Order ${order.id} has no userID.`);
    }

    /*
     * ------------------------------------------------------
     * 10. LOOK FOR EXISTING PAYMENT
     * ------------------------------------------------------
     */

    let payment = await getPaymentByReference(reference);

    if (payment) {
      console.log("PAYMENT ALREADY EXISTS:", {
        paymentID: payment.id,

        orderID: payment.orderID,

        userID: payment.userID,

        reference: payment.reference,

        status: payment.status,
      });

      /*
       * Never allow a Payment belonging to a different
       * Order to be attached to this Order.
       */

      if (payment.orderID && payment.orderID !== order.id) {
        throw new Error(
          `Payment ${payment.id} belongs to Order ${payment.orderID}, not ${order.id}.`,
        );
      }
    }

    /*
     * ------------------------------------------------------
     * 11. CREATE PAYMENT IF NECESSARY
     * ------------------------------------------------------
     */

    if (!payment) {
      console.log("CREATING PAYMENT:", {
        orderID: order.id,

        userID: order.userID,

        amount: transaction.amount,

        reference,
      });

      payment = await createPayment({
        order,

        transaction,
      });

      if (!payment?.id) {
        throw new Error("Payment creation returned no Payment ID.");
      }
    }

    /*
     * ------------------------------------------------------
     * 12. FINALIZE ORDER
     * ------------------------------------------------------
     *
     * THIS IS WHERE THE WEBHOOK GENERATES AND SAVES
     * THE DELIVERY VERIFICATION CODE.
     *
     * verifyAtuaPayment is NOT needed for the normal
     * successful payment path.
     */

    const finalizedOrder = await finalizePaidOrder({
      order,

      payment,
    });

    /*
     * ------------------------------------------------------
     * 13. VERIFY THE UPDATE RESULT
     * ------------------------------------------------------
     */

    if (finalizedOrder.paymentStatus !== "PAID") {
      throw new Error(`Order ${order.id} was not finalized as PAID.`);
    }

    if (finalizedOrder.paymentID !== payment.id) {
      throw new Error(
        `Order ${order.id} paymentID does not match Payment ${payment.id}.`,
      );
    }

    if (finalizedOrder.userID !== order.userID) {
      throw new Error(`Order ${order.id} userID changed unexpectedly.`);
    }

    if (!finalizedOrder.deliveryVerificationCode) {
      throw new Error(
        `Order ${order.id} was marked PAID but has no delivery verification code.`,
      );
    }

    if (!finalizedOrder.recipientTrackingToken) {
      throw new Error(
        `Order ${order.id} was marked PAID but has no recipient tracking token.`,
      );
    }

    if (finalizedOrder.recipientTrackingEnabled !== true) {
      throw new Error(
        `Order ${order.id} was marked PAID but recipient tracking is not enabled.`,
      );
    }

    /*
     * ------------------------------------------------------
     * 14. FINAL SUCCESS
     * ------------------------------------------------------
     */

    console.log("==========================================");

    console.log("ATUA PAYSTACK WEBHOOK COMPLETED");

    console.log("ORDER:", finalizedOrder.id);

    console.log("USER:", finalizedOrder.userID);

    console.log("PAYMENT:", payment.id);

    console.log("PAYMENT STATUS:", finalizedOrder.paymentStatus);

    console.log("FUNDS STATUS:", finalizedOrder.fundsStatus);

    console.log(
      "DELIVERY VERIFICATION CODE:",
      finalizedOrder.deliveryVerificationCode,
    );

    console.log("ORDER VERSION:", finalizedOrder._version);

    console.log("==========================================");

    return httpResponse(200, {
      success: true,

      event: eventType,

      orderID: finalizedOrder.id,

      paymentID: payment.id,

      paymentStatus: finalizedOrder.paymentStatus,

      status: finalizedOrder.status,

      fundsStatus: finalizedOrder.fundsStatus,

      deliveryVerificationCode: finalizedOrder.deliveryVerificationCode,

      recipientTrackingToken: finalizedOrder.recipientTrackingToken,

      recipientTrackingEnabled: finalizedOrder.recipientTrackingEnabled,
    });
  } catch (error) {
    console.error("==========================================");

    console.error("ATUA PAYSTACK WEBHOOK ERROR");

    console.error("MESSAGE:", error?.message);

    console.error("STACK:", error?.stack);

    console.error("==========================================");

    /*
     * Return 500 so Paystack can retry when the payment
     * could not be fully processed.
     *
     * This is especially important if:
     *
     * - Payment creation failed
     * - Order update failed
     * - Verification code could not be saved
     */

    return httpResponse(500, {
      success: false,

      message: error?.message || "Webhook processing failed.",
    });
  }
};
