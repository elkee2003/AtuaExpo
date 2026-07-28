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

//==================================================
// CONFIGURATION
//==================================================

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const GRAPHQL_API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

const REGION = process.env.REGION || process.env.AWS_REGION;

//==================================================
// HTTP RESPONSE
//==================================================

const response = (statusCode, body) => {
  return {
    statusCode,

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(body),
  };
};

//==================================================
// GET PAYSTACK SECRET
//==================================================

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

//==================================================
// GENERATE DELIVERY VERIFICATION CODE
//==================================================

const generateVerificationCode = () => {
  return crypto.randomInt(0, 1000000).toString().padStart(6, "0");
};

//==================================================
// GET HEADER
//==================================================

const getHeader = (headers = {}, headerName) => {
  const target = headerName.toLowerCase();

  const key = Object.keys(headers).find(
    (item) => item.toLowerCase() === target,
  );

  return key ? headers[key] : null;
};

//==================================================
// GET RAW REQUEST BODY
//==================================================

const getRawBody = (event) => {
  if (typeof event?.body !== "string") {
    return "";
  }

  //-----------------------------------------
  // API Gateway may base64 encode the body
  //-----------------------------------------

  if (event.isBase64Encoded) {
    return Buffer.from(event.body, "base64").toString("utf8");
  }

  return event.body;
};

//==================================================
// VERIFY PAYSTACK WEBHOOK SIGNATURE
//==================================================

const verifyPaystackSignature = ({ rawBody, signature, secretKey }) => {
  if (!rawBody) {
    return false;
  }

  if (!signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha512", secretKey)
    .update(rawBody)
    .digest("hex");

  //-----------------------------------------
  // Use timingSafeEqual
  //-----------------------------------------

  try {
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");

    const receivedBuffer = Buffer.from(signature, "utf8");

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch (error) {
    console.error("SIGNATURE COMPARISON ERROR:", error);

    return false;
  }
};

//==================================================
// GRAPHQL REQUEST
//==================================================

const graphqlRequest = async (
  query,
  variables = {},
  operationName = "GraphQL operation",
) => {
  //-----------------------------------------
  // Validate Configuration
  //-----------------------------------------

  if (!GRAPHQL_ENDPOINT) {
    throw new Error("Atua GraphQL endpoint is not configured.");
  }

  if (!GRAPHQL_API_KEY) {
    throw new Error("Atua GraphQL API key is not configured.");
  }

  //-----------------------------------------
  // Build Request
  //-----------------------------------------

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

  //-----------------------------------------
  // Execute
  //-----------------------------------------

  return new Promise((resolve, reject) => {
    const request = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        //---------------------------------
        // HTTP Failure
        //---------------------------------

        if (res.statusCode < 200 || res.statusCode >= 300) {
          console.error(`${operationName} HTTP ERROR:`, {
            statusCode: res.statusCode,

            body: data,
          });

          return reject(
            new Error(`${operationName} returned HTTP ${res.statusCode}.`),
          );
        }

        //---------------------------------
        // Parse Response
        //---------------------------------

        let parsed;

        try {
          parsed = JSON.parse(data);
        } catch (error) {
          console.error(`${operationName} PARSE ERROR:`, {
            rawResponse: data,

            error: error.message,
          });

          return reject(error);
        }

        //---------------------------------
        // GraphQL Errors
        //---------------------------------

        if (parsed?.errors?.length) {
          console.error(
            `${operationName} GRAPHQL ERRORS:`,
            JSON.stringify(parsed.errors),
          );

          console.error(
            `${operationName} GRAPHQL DATA:`,
            JSON.stringify(parsed.data),
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

//==================================================
// GET ORDER
//==================================================

const getOrder = async (orderId) => {
  const query = `
    query GetOrder($id: ID!) {
      getOrder(id: $id) {
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

        totalPrice
        operationalFare
        courierEarnings
        commissionAmount
        platformFee
        platformServiceRevenue
        vatAmount
        platformNetRevenue

        deliveryVerificationCode

        declaredWeightBracket

        paymentStatus
        paymentID

        payoutStatus
        fundsStatus

        assignedCourierId
        assignmentStatus
        assignmentExpiresAt
        assignmentAttempts
        lastAssignedAt
        rejectedCourierIds

        userID

        createdAt
        updatedAt

        _version
        _lastChangedAt
        _deleted
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

//==================================================
// GET PAYMENT BY REFERENCE
//==================================================

const getPaymentByReference = async (reference) => {
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

  return data?.listPayments?.items?.[0] || null;
};

//==================================================
// CREATE PAYMENT
//==================================================

const createPayment = async ({ order, transaction }) => {
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

  const paymentMethod = transaction.channel || "paystack";

  const input = {
    orderID: order.id,

    userID: order.userID,

    amount: Number(order.totalPrice),

    currency: transaction.currency,

    status: "SUCCESS",

    paymentMethod,

    provider: "PAYSTACK",

    reference: transaction.reference,
  };

  const data = await graphqlRequest(
    mutation,
    {
      input,
    },
    "CreatePayment",
  );

  return data?.createPayment || null;
};

//==================================================
// UPDATE ORDER AFTER PAYMENT
//==================================================

const markOrderAsPaid = async ({ order, paymentId, verificationCode }) => {
  //-----------------------------------------
  // Validate
  //-----------------------------------------

  if (!order?.id) {
    throw new Error("Order is required before it can be marked as paid.");
  }

  if (!paymentId) {
    throw new Error(
      "Payment ID is required before the order can be marked as paid.",
    );
  }

  if (!verificationCode) {
    throw new Error("Delivery verification code is required.");
  }

  //-----------------------------------------
  // Mutation
  //-----------------------------------------

  const mutation = `
    mutation UpdateOrder(
      $input: UpdateOrderInput!
    ) {
      updateOrder(
        input: $input
      ) {
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

        totalPrice
        operationalFare
        courierEarnings
        commissionAmount
        platformFee
        platformServiceRevenue
        vatAmount
        platformNetRevenue

        deliveryVerificationCode

        declaredWeightBracket

        paymentStatus
        paymentID

        payoutStatus
        fundsStatus

        assignedCourierId
        assignmentStatus
        assignmentExpiresAt
        assignmentAttempts
        lastAssignedAt
        rejectedCourierIds

        userID

        createdAt
        updatedAt

        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  //-----------------------------------------
  // Update payment-related fields only
  //-----------------------------------------

  const input = {
    id: order.id,

    paymentStatus: "PAID",

    paymentID: paymentId,

    status: "READY_FOR_PICKUP",

    deliveryVerificationCode: verificationCode,
  };

  //-----------------------------------------
  // DataStore Version
  //-----------------------------------------

  if (Number.isInteger(order._version)) {
    input._version = order._version;
  }

  const data = await graphqlRequest(
    mutation,
    {
      input,
    },
    "MarkOrderAsPaid",
  );

  return data?.updateOrder || null;
};

//==================================================
// VERIFY TRANSACTION WITH PAYSTACK
//==================================================

const verifyWithPaystack = async (reference, secretKey) => {
  const encodedReference = encodeURIComponent(reference);

  const options = {
    hostname: "api.paystack.co",

    path: `/transaction/verify/${encodedReference}`,

    method: "GET",

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
        try {
          const parsed = JSON.parse(data);

          resolve({
            statusCode: res.statusCode,

            body: parsed,
          });
        } catch (error) {
          console.error("PAYSTACK VERIFY PARSE ERROR:", error);

          reject(error);
        }
      });
    });

    request.on("error", (error) => {
      console.error("PAYSTACK VERIFY REQUEST ERROR:", error);

      reject(error);
    });

    request.end();
  });
};

//==================================================
// PARSE METADATA
//==================================================

const parseMetadata = (metadata) => {
  if (!metadata) {
    return {};
  }

  if (typeof metadata === "object") {
    return metadata;
  }

  if (typeof metadata === "string") {
    try {
      return JSON.parse(metadata);
    } catch (error) {
      console.error("PAYSTACK METADATA PARSE ERROR:", error.message);

      return {};
    }
  }

  return {};
};

//==================================================
// GET ORDER ID FROM PAYSTACK METADATA
//==================================================

const getOrderIdFromMetadata = (metadataValue) => {
  const metadata = parseMetadata(metadataValue);

  //-----------------------------------------
  // Preferred direct metadata fields
  //-----------------------------------------

  const directOrderId =
    metadata.orderId || metadata.orderID || metadata.order_id;

  if (directOrderId) {
    return String(directOrderId);
  }

  //-----------------------------------------
  // Existing Atua custom_fields format
  //-----------------------------------------

  const customFields = Array.isArray(metadata.custom_fields)
    ? metadata.custom_fields
    : [];

  const orderField = customFields.find((field) => {
    const variableName = String(field?.variable_name || "").toLowerCase();

    return ["order_id", "orderid", "order_id_atua", "atua_order_id"].includes(
      variableName,
    );
  });

  if (orderField?.value) {
    return String(orderField.value);
  }

  return null;
};

//==================================================
// PROCESS SUCCESSFUL PAYMENT
//==================================================

const processSuccessfulPayment = async ({ webhookTransaction, secretKey }) => {
  //================================================
  // 1. REFERENCE
  //================================================

  const reference = webhookTransaction?.reference;

  if (!reference) {
    throw new Error("Webhook transaction does not contain a reference.");
  }

  console.log("WEBHOOK PAYMENT RECEIVED:", {
    reference,
  });

  //================================================
  // 2. VERIFY TRANSACTION DIRECTLY WITH PAYSTACK
  //================================================

  const verification = await verifyWithPaystack(reference, secretKey);

  const paystack = verification?.body;

  if (
    !verification ||
    verification.statusCode < 200 ||
    verification.statusCode >= 300 ||
    !paystack?.status
  ) {
    throw new Error(
      paystack?.message || "Paystack transaction verification failed.",
    );
  }

  const transaction = paystack?.data;

  if (!transaction) {
    throw new Error("Paystack returned an invalid transaction.");
  }

  //================================================
  // 3. TRANSACTION MUST BE SUCCESSFUL
  //================================================

  if (transaction.status !== "success") {
    throw new Error(
      `Transaction is not successful. Current status: ${transaction.status}`,
    );
  }

  //================================================
  // 4. REFERENCES MUST MATCH
  //================================================

  if (transaction.reference !== reference) {
    throw new Error(
      "Paystack transaction reference does not match the webhook reference.",
    );
  }

  //================================================
  // 5. GET ORDER ID FROM VERIFIED TRANSACTION
  //================================================

  const orderId = getOrderIdFromMetadata(transaction.metadata);

  if (!orderId) {
    console.error("WEBHOOK ORDER ID NOT FOUND IN METADATA:", {
      reference,
    });

    throw new Error("Atua Order ID could not be found in Paystack metadata.");
  }

  console.log("WEBHOOK ORDER IDENTIFIED:", {
    orderId,
    reference,
  });

  //================================================
  // 6. GET ORDER
  //================================================

  let order = await getOrder(orderId);

  if (!order) {
    throw new Error(`Order ${orderId} could not be found.`);
  }

  if (!order.userID) {
    throw new Error("Order does not have a user ID.");
  }

  //================================================
  // 7. VALIDATE ORDER AMOUNT
  //================================================

  const orderAmount = Number(order.totalPrice);

  if (!Number.isFinite(orderAmount) || orderAmount <= 0) {
    throw new Error("Order has an invalid payment amount.");
  }

  //================================================
  // 8. VERIFY CURRENCY
  //================================================

  if (transaction.currency !== "NGN") {
    throw new Error("Payment currency does not match the expected currency.");
  }

  //================================================
  // 9. VERIFY AMOUNT
  //================================================

  const expectedAmountInKobo = Math.round(orderAmount * 100);

  const paidAmountInKobo = Number(transaction.amount);

  if (!Number.isFinite(paidAmountInKobo)) {
    throw new Error("Paystack returned an invalid payment amount.");
  }

  if (paidAmountInKobo !== expectedAmountInKobo) {
    console.error("WEBHOOK PAYMENT AMOUNT MISMATCH:", {
      orderId: order.id,

      reference,

      expectedAmountInKobo,

      paidAmountInKobo,
    });

    throw new Error("The amount paid does not match the order total.");
  }

  console.log("WEBHOOK PAYSTACK PAYMENT VERIFIED:", {
    orderId: order.id,

    reference,

    amount: orderAmount,

    currency: transaction.currency,
  });

  //================================================
  // 10. CHECK PAYMENT BY REFERENCE FIRST
  //================================================

  let payment = await getPaymentByReference(reference);

  if (payment) {
    //-----------------------------------------
    // Reference belongs to another Order
    //-----------------------------------------

    if (payment.orderID !== order.id) {
      console.error("WEBHOOK PAYMENT REFERENCE ALREADY USED:", {
        reference,

        existingOrderId: payment.orderID,

        attemptedOrderId: order.id,
      });

      throw new Error(
        "Payment reference has already been used for another order.",
      );
    }

    console.log("WEBHOOK EXISTING PAYMENT FOUND:", {
      paymentId: payment.id,

      orderId: payment.orderID,

      reference: payment.reference,
    });
  }

  //================================================
  // 11. IF ORDER ALREADY PAID
  //================================================

  if (order.paymentStatus === "PAID") {
    console.log("WEBHOOK ORDER ALREADY PAID:", {
      orderId: order.id,

      paymentID: order.paymentID,

      reference,

      hasVerificationCode: Boolean(order.deliveryVerificationCode),
    });

    return {
      alreadyProcessed: true,

      orderId: order.id,

      paymentId: order.paymentID || payment?.id || null,

      reference,
    };
  }

  //================================================
  // 12. CREATE PAYMENT IF NEEDED
  //================================================

  if (!payment) {
    payment = await createPayment({
      order,
      transaction,
    });

    if (!payment?.id) {
      throw new Error("Payment record could not be created.");
    }

    console.log("WEBHOOK PAYMENT RECORD CREATED:", {
      paymentId: payment.id,

      orderId: order.id,

      reference: payment.reference,
    });
  }

  //================================================
  // 13. REFRESH ORDER BEFORE MUTATION
  //================================================

  order = await getOrder(order.id);

  if (!order) {
    throw new Error("Order disappeared before payment could be recorded.");
  }

  //================================================
  // 14. CHECK AGAIN AFTER REFRESH
  //================================================

  if (order.paymentStatus === "PAID") {
    console.log("WEBHOOK ORDER BECAME PAID BEFORE UPDATE:", {
      orderId: order.id,

      paymentID: order.paymentID,

      reference,
    });

    return {
      alreadyProcessed: true,

      orderId: order.id,

      paymentId: order.paymentID || payment.id,

      reference,
    };
  }

  //================================================
  // 15. GENERATE / REUSE VERIFICATION CODE
  //================================================

  const verificationCode =
    order.deliveryVerificationCode || generateVerificationCode();

  //================================================
  // 16. UPDATE ORDER
  //================================================

  const updatedOrder = await markOrderAsPaid({
    order,

    paymentId: payment.id,

    verificationCode,
  });

  if (!updatedOrder) {
    throw new Error("Order could not be updated after webhook payment.");
  }

  //================================================
  // 17. CONFIRM FROM CLOUD
  //================================================

  const confirmedOrder = await getOrder(order.id);

  if (!confirmedOrder) {
    throw new Error("Could not reload Order after webhook update.");
  }

  //================================================
  // 18. VERIFY CRITICAL FIELDS
  //================================================

  if (confirmedOrder.paymentStatus !== "PAID") {
    throw new Error(
      `Order payment status was not updated. Current value: ${confirmedOrder.paymentStatus}`,
    );
  }

  if (confirmedOrder.paymentID !== payment.id) {
    throw new Error(
      `Payment was not linked to the order. Expected ${payment.id}, received ${confirmedOrder.paymentID}.`,
    );
  }

  if (confirmedOrder.status !== "READY_FOR_PICKUP") {
    throw new Error(
      `Order was not activated for pickup. Current value: ${confirmedOrder.status}`,
    );
  }

  if (!confirmedOrder.deliveryVerificationCode) {
    throw new Error("Delivery verification code was not saved.");
  }

  console.log("WEBHOOK PAYMENT PROCESSING CONFIRMED:", {
    orderId: confirmedOrder.id,

    paymentID: confirmedOrder.paymentID,

    paymentStatus: confirmedOrder.paymentStatus,

    status: confirmedOrder.status,

    reference,

    hasVerificationCode: true,
  });

  return {
    alreadyProcessed: false,

    orderId: confirmedOrder.id,

    paymentId: confirmedOrder.paymentID,

    reference,
  };
};

//==================================================
// LAMBDA HANDLER
//==================================================

exports.handler = async (event) => {
  console.log("==========================================");

  console.log("PAYSTACK WEBHOOK RECEIVED");

  console.log("==========================================");

  try {
    //================================================
    // 1. GET RAW BODY
    //================================================

    const rawBody = getRawBody(event);

    if (!rawBody) {
      console.error("WEBHOOK BODY IS EMPTY");

      return response(400, {
        success: false,

        message: "Request body is required.",
      });
    }

    //================================================
    // 2. GET SIGNATURE
    //================================================

    const signature = getHeader(event?.headers || {}, "x-paystack-signature");

    if (!signature) {
      console.error("PAYSTACK SIGNATURE MISSING");

      return response(401, {
        success: false,

        message: "Invalid webhook signature.",
      });
    }

    //================================================
    // 3. GET SECRET
    //================================================

    const secretKey = await getPaystackSecretKey();

    //================================================
    // 4. VERIFY SIGNATURE BEFORE PARSING/PROCESSING
    //================================================

    const validSignature = verifyPaystackSignature({
      rawBody,
      signature,
      secretKey,
    });

    if (!validSignature) {
      console.error("INVALID PAYSTACK WEBHOOK SIGNATURE");

      return response(401, {
        success: false,

        message: "Invalid webhook signature.",
      });
    }

    console.log("PAYSTACK WEBHOOK SIGNATURE VERIFIED");

    //================================================
    // 5. PARSE EVENT
    //================================================

    let webhook;

    try {
      webhook = JSON.parse(rawBody);
    } catch (error) {
      console.error("INVALID PAYSTACK WEBHOOK JSON:", error);

      return response(400, {
        success: false,

        message: "Invalid webhook body.",
      });
    }

    //================================================
    // 6. EVENT TYPE
    //================================================

    const eventType = webhook?.event;

    console.log("PAYSTACK WEBHOOK EVENT:", eventType);

    //================================================
    // 7. IGNORE EVENTS WE DON'T HANDLE
    //================================================

    if (eventType !== "charge.success") {
      console.log("PAYSTACK EVENT IGNORED:", eventType);

      return response(200, {
        success: true,

        processed: false,

        message: "Webhook event acknowledged.",
      });
    }

    //================================================
    // 8. GET WEBHOOK TRANSACTION
    //================================================

    const webhookTransaction = webhook?.data;

    if (!webhookTransaction) {
      console.error("CHARGE.SUCCESS HAS NO TRANSACTION DATA");

      return response(400, {
        success: false,

        message: "Transaction data is required.",
      });
    }

    //================================================
    // 9. PROCESS PAYMENT
    //================================================

    const result = await processSuccessfulPayment({
      webhookTransaction,

      secretKey,
    });

    //================================================
    // 10. SUCCESS
    //================================================

    console.log("PAYSTACK WEBHOOK COMPLETED:", {
      orderId: result.orderId,

      reference: result.reference,

      alreadyProcessed: result.alreadyProcessed,
    });

    return response(200, {
      success: true,

      processed: true,

      alreadyProcessed: result.alreadyProcessed,

      message: result.alreadyProcessed
        ? "Payment was already processed."
        : "Payment processed successfully.",
    });
  } catch (error) {
    //================================================
    // UNEXPECTED FAILURE
    //================================================

    console.error("PAYSTACK WEBHOOK ERROR:", error);

    console.error("PAYSTACK WEBHOOK ERROR MESSAGE:", error?.message);

    console.error("PAYSTACK WEBHOOK ERROR STACK:", error?.stack);

    //-----------------------------------------
    // Return 500 so a genuine Paystack event
    // can be retried rather than silently lost.
    //-----------------------------------------

    return response(500, {
      success: false,

      message: "Webhook could not be processed.",
    });
  }
};
