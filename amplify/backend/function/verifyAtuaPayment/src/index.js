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

  console.log("CREATING PAYMENT:", {
    orderID: input.orderID,

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

  console.log("CREATE PAYMENT RESULT:", JSON.stringify(data?.createPayment));

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

  //================================================
  // MUTATION
  //================================================

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

  //================================================
  // UPDATE ONLY PAYMENT-RELATED FIELDS
  //================================================

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

  console.log("UPDATING ORDER AFTER PAYMENT:", {
    orderId: order.id,

    paymentId,

    currentVersion: order._version,

    originAddress: order.originAddress,

    originLat: order.originLat,

    originLng: order.originLng,

    destinationAddress: order.destinationAddress,

    destinationLat: order.destinationLat,

    destinationLng: order.destinationLng,

    targetPaymentStatus: "PAID",

    targetStatus: "READY_FOR_PICKUP",
  });

  //================================================
  // UPDATE
  //================================================

  const data = await graphqlRequest(
    mutation,
    {
      input,
    },
    "MarkOrderAsPaid",
  );

  const updatedOrder = data?.updateOrder || null;

  return updatedOrder;
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
          console.error("PAYSTACK PARSE ERROR:", error);

          reject(error);
        }
      });
    });

    request.on("error", (error) => {
      console.error("PAYSTACK REQUEST ERROR:", error);

      reject(error);
    });

    request.end();
  });
};

//==================================================
// FAILURE RESULT
//==================================================

const failureResult = (message, orderId = null) => {
  return {
    success: false,

    verified: false,

    alreadyPaid: false,

    message,

    orderId,

    deliveryVerificationCode: null,

    payment: null,
  };
};

//==================================================
// SUCCESS PAYMENT DETAILS
//==================================================

const buildPaymentDetails = ({
  reference,
  amount,
  currency,
  status,
  channel,
  paidAt,
}) => {
  return {
    reference: reference || null,

    amount: Number(amount),

    currency: currency || null,

    status: status || null,

    channel: channel || null,

    paidAt: paidAt || null,
  };
};

//==================================================
// LAMBDA HANDLER
//==================================================

exports.handler = async (event) => {
  console.log("==========================================");

  console.log("VERIFY ATUA PAYMENT STARTED");

  console.log("==========================================");

  try {
    //================================================
    // 1. GET APPSYNC ARGUMENTS
    //================================================

    const { orderId, reference } = event?.arguments || {};

    if (!orderId) {
      return failureResult("Order ID is required.");
    }

    if (!reference) {
      return failureResult("Payment reference is required.", orderId);
    }

    console.log("VERIFYING PAYMENT:", {
      orderId,
      reference,
    });

    //================================================
    // 2. GET ORDER
    //================================================

    let order = await getOrder(orderId);

    if (!order) {
      return failureResult("Order could not be found.", orderId);
    }

    //================================================
    // 3. VALIDATE ORDER
    //================================================

    if (!order.userID) {
      return failureResult("Order does not have a user ID.", order.id);
    }

    const orderAmount = Number(order.totalPrice);

    if (!Number.isFinite(orderAmount) || orderAmount <= 0) {
      return failureResult("Order has an invalid payment amount.", order.id);
    }

    //================================================
    // 4. ALREADY PAID
    //================================================

    if (order.paymentStatus === "PAID") {
      console.log("ORDER ALREADY PAID:", {
        orderId: order.id,

        paymentID: order.paymentID,

        hasVerificationCode: Boolean(order.deliveryVerificationCode),
      });

      const existingPayment = await getPaymentByReference(reference);

      return {
        success: true,

        verified: true,

        alreadyPaid: true,

        message: "This order has already been paid.",

        orderId: order.id,

        deliveryVerificationCode: order.deliveryVerificationCode || null,

        payment: existingPayment
          ? buildPaymentDetails({
              reference: existingPayment.reference,

              amount: existingPayment.amount,

              currency: existingPayment.currency,

              status: "success",

              channel: existingPayment.paymentMethod,

              paidAt: existingPayment.createdAt,
            })
          : null,
      };
    }

    //================================================
    // 5. GET PAYSTACK SECRET
    //================================================

    const secretKey = await getPaystackSecretKey();

    console.log("PAYSTACK SECRET RETRIEVED");

    //================================================
    // 6. VERIFY WITH PAYSTACK
    //================================================

    const verification = await verifyWithPaystack(reference, secretKey);

    const paystack = verification?.body;

    console.log("PAYSTACK HTTP STATUS:", verification?.statusCode);

    if (
      !verification ||
      verification.statusCode < 200 ||
      verification.statusCode >= 300 ||
      !paystack?.status
    ) {
      console.error("PAYSTACK VERIFICATION FAILED:", JSON.stringify(paystack));

      return failureResult(
        paystack?.message || "Payment could not be verified.",
        order.id,
      );
    }

    //================================================
    // 7. TRANSACTION
    //================================================

    const transaction = paystack?.data;

    if (!transaction) {
      return failureResult(
        "Paystack returned an invalid transaction.",
        order.id,
      );
    }

    //================================================
    // 8. VERIFY STATUS
    //================================================

    if (transaction.status !== "success") {
      return failureResult(
        "Payment has not been successfully completed.",
        order.id,
      );
    }

    //================================================
    // 9. VERIFY REFERENCE
    //================================================

    if (transaction.reference !== reference) {
      console.error("PAYMENT REFERENCE MISMATCH:", {
        requestedReference: reference,

        paystackReference: transaction.reference,
      });

      return failureResult("Payment reference does not match.", order.id);
    }

    //================================================
    // 10. VERIFY CURRENCY
    //================================================

    if (transaction.currency !== "NGN") {
      return failureResult(
        "Payment currency does not match the order.",
        order.id,
      );
    }

    //================================================
    // 11. VERIFY AMOUNT
    //================================================

    const expectedAmountInKobo = Math.round(orderAmount * 100);

    const paidAmountInKobo = Number(transaction.amount);

    if (!Number.isFinite(paidAmountInKobo)) {
      return failureResult(
        "Paystack returned an invalid payment amount.",
        order.id,
      );
    }

    if (paidAmountInKobo !== expectedAmountInKobo) {
      console.error("PAYMENT AMOUNT MISMATCH:", {
        orderId: order.id,

        expectedAmountInKobo,

        paidAmountInKobo,
      });

      return failureResult(
        "The amount paid does not match the order total.",
        order.id,
      );
    }

    console.log("PAYSTACK PAYMENT VERIFIED:", {
      orderId: order.id,

      reference: transaction.reference,

      amount: orderAmount,

      currency: transaction.currency,
    });

    //================================================
    // 12. CHECK EXISTING PAYMENT
    //================================================

    let payment = await getPaymentByReference(transaction.reference);

    if (payment) {
      if (payment.orderID !== order.id) {
        console.error("PAYMENT REFERENCE ALREADY USED:", {
          reference: transaction.reference,

          existingOrderId: payment.orderID,

          attemptedOrderId: order.id,
        });

        return failureResult(
          "This payment reference has already been used for another order.",
          order.id,
        );
      }

      console.log("EXISTING PAYMENT FOUND:", {
        paymentId: payment.id,

        orderId: payment.orderID,

        reference: payment.reference,
      });
    } else {
      //================================================
      // 13. CREATE PAYMENT
      //================================================

      payment = await createPayment({
        order,
        transaction,
      });

      if (!payment?.id) {
        throw new Error("Payment record could not be created.");
      }

      console.log("PAYMENT RECORD CREATED:", {
        paymentId: payment.id,

        orderId: order.id,

        reference: payment.reference,

        version: payment._version,
      });
    }

    //================================================
    // 14. REFRESH ORDER BEFORE UPDATE
    //================================================

    order = await getOrder(order.id);

    if (!order) {
      throw new Error("Order disappeared before payment could be recorded.");
    }

    console.log("ORDER REFRESHED BEFORE PAYMENT UPDATE:", {
      id: order.id,

      version: order._version,

      paymentStatus: order.paymentStatus,

      status: order.status,

      paymentID: order.paymentID,

      originLat: order.originLat,

      originLng: order.originLng,

      destinationLat: order.destinationLat,

      destinationLng: order.destinationLng,

      hasVerificationCode: Boolean(order.deliveryVerificationCode),
    });

    //================================================
    // 15. ORDER BECAME PAID
    //================================================

    if (order.paymentStatus === "PAID") {
      console.log("ORDER BECAME PAID BEFORE UPDATE");

      return {
        success: true,

        verified: true,

        alreadyPaid: true,

        message: "Payment has already been verified.",

        orderId: order.id,

        deliveryVerificationCode: order.deliveryVerificationCode || null,

        payment: buildPaymentDetails({
          reference: transaction.reference,

          amount: orderAmount,

          currency: transaction.currency,

          status: transaction.status,

          channel: transaction.channel,

          paidAt: transaction.paid_at,
        }),
      };
    }

    //================================================
    // 16. GENERATE / REUSE DELIVERY CODE
    //================================================

    const verificationCode =
      order.deliveryVerificationCode || generateVerificationCode();

    console.log("DELIVERY VERIFICATION CODE READY:", {
      orderId: order.id,

      reused: Boolean(order.deliveryVerificationCode),

      hasVerificationCode: true,
    });

    //================================================
    // 17. MARK ORDER AS PAID
    //================================================

    const updatedOrder = await markOrderAsPaid({
      order,

      paymentId: payment.id,

      verificationCode,
    });

    if (!updatedOrder) {
      throw new Error("Order could not be updated after payment.");
    }

    //================================================
    // 18. CONFIRM ORDER FROM CLOUD
    //================================================

    const confirmedOrder = await getOrder(order.id);

    if (!confirmedOrder) {
      throw new Error("Could not reload order after payment update.");
    }

    console.log("CONFIRMED ORDER AFTER PAYMENT:", {
      orderId: confirmedOrder.id,

      userID: confirmedOrder.userID,

      paymentStatus: confirmedOrder.paymentStatus,

      paymentID: confirmedOrder.paymentID,

      status: confirmedOrder.status,

      version: confirmedOrder._version,

      hasVerificationCode: Boolean(confirmedOrder.deliveryVerificationCode),
    });

    //================================================
    // 19. VERIFY CRITICAL FIELDS
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

    console.log("ORDER PAYMENT UPDATE CONFIRMED:", {
      orderId: confirmedOrder.id,

      paymentID: confirmedOrder.paymentID,

      paymentStatus: confirmedOrder.paymentStatus,

      status: confirmedOrder.status,

      version: confirmedOrder._version,

      hasVerificationCode: true,
    });

    //================================================
    // 20. SUCCESS
    //================================================

    return {
      success: true,

      verified: true,

      alreadyPaid: false,

      message: "Payment successfully verified and recorded.",

      orderId: confirmedOrder.id,

      deliveryVerificationCode: confirmedOrder.deliveryVerificationCode,

      payment: buildPaymentDetails({
        reference: transaction.reference,

        amount: orderAmount,

        currency: transaction.currency,

        status: transaction.status,

        channel: transaction.channel,

        paidAt: transaction.paid_at,
      }),
    };
  } catch (error) {
    //================================================
    // UNEXPECTED ERROR
    //================================================

    console.error("VERIFY ATUA PAYMENT ERROR:", error);

    console.error("VERIFY ATUA PAYMENT ERROR MESSAGE:", error?.message);

    console.error("VERIFY ATUA PAYMENT ERROR STACK:", error?.stack);

    return {
      success: false,

      verified: false,

      alreadyPaid: false,

      message:
        "Something went wrong while verifying and recording the payment.",

      orderId: event?.arguments?.orderId || null,

      deliveryVerificationCode: null,

      payment: null,
    };
  }
};
