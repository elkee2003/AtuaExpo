"use strict";

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
   GET PAYSTACK SECRET
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
   GENERATE DELIVERY VERIFICATION CODE
========================================================== */

const generateVerificationCode = () => {
  return crypto.randomInt(0, 1000000).toString().padStart(6, "0");
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
          console.error(`${operationName} JSON PARSE ERROR:`, {
            error: error.message,

            response: data,
          });

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
   COMPLETE ORDER FIELDS
========================================================== */

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
    throw new Error(`Order ${order.id} has no userID.`);
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

  console.log("CREATING FALLBACK PAYMENT:", {
    orderID: input.orderID,

    userID: input.userID,

    amount: input.amount,

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

  console.log("FALLBACK PAYMENT CREATED:", {
    paymentID: payment.id,

    orderID: payment.orderID,

    userID: payment.userID,

    reference: payment.reference,
  });

  return payment;
};

/* ==========================================================
   FALLBACK ORDER UPDATE
========================================================== */

/*
 * This function is ONLY called when:
 *
 *     Paystack says SUCCESS
 *
 * AND
 *
 *     the webhook has not successfully completed
 *     the Order.
 *
 * It is NOT called merely because verifyAtuaPayment
 * was invoked.
 */

const markOrderAsPaidFallback = async ({
  order,
  paymentId,
  verificationCode,
}) => {
  if (!order?.id) {
    throw new Error("Order is required before fallback update.");
  }

  if (!order?.userID) {
    throw new Error(`Order ${order.id} is missing userID.`);
  }

  if (!paymentId) {
    throw new Error("Payment ID is required.");
  }

  if (!verificationCode) {
    throw new Error("Delivery verification code is required.");
  }

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

    userID: order.userID,

    paymentStatus: "PAID",

    paymentID: paymentId,

    status: "READY_FOR_PICKUP",

    fundsStatus: "HELD",

    deliveryVerificationCode: verificationCode,
  };

  if (Number.isInteger(order._version)) {
    input._version = order._version;
  }

  console.log("FALLBACK ORDER UPDATE:", {
    orderID: order.id,

    userID: order.userID,

    currentVersion: order._version,

    paymentID: paymentId,

    paymentStatus: "PAID",

    status: "READY_FOR_PICKUP",

    fundsStatus: "HELD",

    verificationCode,
  });

  const data = await graphqlRequest(
    mutation,
    {
      input,
    },
    "MarkOrderAsPaidFallback",
  );

  const updatedOrder = data?.updateOrder || null;

  if (!updatedOrder) {
    throw new Error("Fallback Order update returned no Order.");
  }

  console.log(
    "FALLBACK ORDER UPDATED:",
    JSON.stringify(
      {
        id: updatedOrder.id,

        userID: updatedOrder.userID,

        paymentStatus: updatedOrder.paymentStatus,

        paymentID: updatedOrder.paymentID,

        fundsStatus: updatedOrder.fundsStatus,

        status: updatedOrder.status,

        deliveryVerificationCode: updatedOrder.deliveryVerificationCode,

        totalPrice: updatedOrder.totalPrice,

        recipientName: updatedOrder.recipientName,

        originAddress: updatedOrder.originAddress,

        destinationAddress: updatedOrder.destinationAddress,

        _version: updatedOrder._version,

        _lastChangedAt: updatedOrder._lastChangedAt,
      },
      null,
      2,
    ),
  );

  return updatedOrder;
};

/* ==========================================================
   VERIFY TRANSACTION WITH PAYSTACK
========================================================== */

const verifyWithPaystack = async (reference, secretKey) => {
  if (!reference) {
    throw new Error("Payment reference is required.");
  }

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
        let parsed;

        try {
          parsed = JSON.parse(data);
        } catch (error) {
          console.error("PAYSTACK RESPONSE PARSE ERROR:", {
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
   FAILURE RESULT
========================================================== */

const failureResult = (message, orderId = null) => {
  return {
    success: false,

    verified: false,

    alreadyPaid: false,

    fallbackUsed: false,

    message,

    orderId,

    deliveryVerificationCode: null,

    payment: null,
  };
};

/* ==========================================================
   PAYMENT DETAILS
========================================================== */

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
/* ==========================================================
   VERIFY ATUA PAYMENT
========================================================== */

/*
 * ==========================================================
 *
 * PAYMENT ARCHITECTURE
 *
 * ==========================================================
 *
 * PRIMARY:
 *
 * Paystack
 *    ↓
 * charge.success webhook
 *    ↓
 * paystackWebhook
 *    ↓
 * Payment
 *    ↓
 * Order:
 *    PAID
 *    HELD
 *    READY_FOR_PICKUP
 *    deliveryVerificationCode
 *
 *
 * FALLBACK:
 *
 * verifyAtuaPayment
 *    ↓
 * verify Paystack directly
 *    ↓
 * reload Order
 *
 *    ┌─────────────────────────────────────┐
 *    │                                     │
 *    │ PAID + CODE                         │
 *    │                                     │
 *    │      → DO NOTHING                   │
 *    │      → return success               │
 *    │                                     │
 *    └─────────────────────────────────────┘
 *
 *
 *    ┌─────────────────────────────────────┐
 *    │                                     │
 *    │ PAID + NO CODE                      │
 *    │                                     │
 *    │      → WEBHOOK PAYMENT SUCCEEDED    │
 *    │      → BUT CODE IS MISSING          │
 *    │      → GENERATE CODE                │
 *    │      → UPDATE ONLY CODE + REQUIRED  │
 *    │        PAYMENT FIELDS               │
 *    │                                     │
 *    └─────────────────────────────────────┘
 *
 *
 *    ┌─────────────────────────────────────┐
 *    │                                     │
 *    │ NOT PAID                            │
 *    │                                     │
 *    │      → verify Paystack              │
 *    │      → create/find Payment           │
 *    │      → generate code                │
 *    │      → fallback Order update        │
 *    │                                     │
 *    └─────────────────────────────────────┘
 *
 * ==========================================================
 */

/* ==========================================================
   REPAIR CODE ONLY
========================================================== */

/*
 * This is different from markOrderAsPaidFallback().
 *
 * It is used for the very specific case:
 *
 *     Order.paymentStatus === "PAID"
 *
 * AND
 *
 *     Order.deliveryVerificationCode is missing
 *
 * In that situation the webhook already processed the
 * payment, so we DO NOT change payment status, Payment ID,
 * funds status, etc.
 *
 * We ONLY add the missing verification code.
 *
 * This prevents verifyAtuaPayment from becoming a second
 * payment processor.
 */

const repairMissingVerificationCode = async ({ order, verificationCode }) => {
  if (!order?.id) {
    throw new Error("Order is required to repair verification code.");
  }

  if (!order?.userID) {
    throw new Error(`Order ${order.id} is missing userID.`);
  }

  if (!verificationCode) {
    throw new Error("Verification code is required.");
  }

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
     * Keep required userID present.
     */
    userID: order.userID,

    /*
     * Payment is already PAID.
     *
     * We preserve these existing values instead of
     * inventing new payment information.
     */
    paymentStatus: order.paymentStatus,

    paymentID: order.paymentID,

    fundsStatus: order.fundsStatus,

    status: order.status,

    /*
     * THIS is the actual repair.
     */
    deliveryVerificationCode: verificationCode,
  };

  if (Number.isInteger(order._version)) {
    input._version = order._version;
  }

  console.log("REPAIRING MISSING VERIFICATION CODE:", {
    orderID: order.id,

    userID: order.userID,

    currentVersion: order._version,

    paymentStatus: order.paymentStatus,

    paymentID: order.paymentID,

    fundsStatus: order.fundsStatus,

    status: order.status,

    verificationCode,
  });

  const data = await graphqlRequest(
    mutation,
    {
      input,
    },
    "RepairMissingVerificationCode",
  );

  const updatedOrder = data?.updateOrder || null;

  if (!updatedOrder) {
    throw new Error("Verification code repair returned no Order.");
  }

  console.log(
    "VERIFICATION CODE REPAIR RESULT:",
    JSON.stringify(
      {
        id: updatedOrder.id,

        userID: updatedOrder.userID,

        paymentStatus: updatedOrder.paymentStatus,

        paymentID: updatedOrder.paymentID,

        fundsStatus: updatedOrder.fundsStatus,

        status: updatedOrder.status,

        deliveryVerificationCode: updatedOrder.deliveryVerificationCode,

        recipientName: updatedOrder.recipientName,

        originAddress: updatedOrder.originAddress,

        destinationAddress: updatedOrder.destinationAddress,

        totalPrice: updatedOrder.totalPrice,

        courierEarnings: updatedOrder.courierEarnings,

        _version: updatedOrder._version,

        _lastChangedAt: updatedOrder._lastChangedAt,
      },
      null,
      2,
    ),
  );

  return updatedOrder;
};

/* ==========================================================
   MAIN HANDLER
========================================================== */

exports.handler = async (event) => {
  console.log("==========================================");

  console.log("VERIFY ATUA PAYMENT STARTED");

  console.log("==========================================");

  try {
    /* ======================================================
       1. GET ARGUMENTS
    ====================================================== */

    const { orderId, reference } = event?.arguments || {};

    if (!orderId) {
      return failureResult("Order ID is required.");
    }

    if (!reference) {
      return failureResult("Payment reference is required.", orderId);
    }

    console.log("VERIFY PAYMENT REQUEST:", {
      orderId,
      reference,
    });

    /* ======================================================
       2. GET ORDER
    ====================================================== */

    let order = await getOrder(orderId);

    if (!order) {
      return failureResult("Order could not be found.", orderId);
    }

    console.log(
      "INITIAL ORDER:",
      JSON.stringify(
        {
          id: order.id,

          userID: order.userID,

          paymentStatus: order.paymentStatus,

          paymentID: order.paymentID,

          fundsStatus: order.fundsStatus,

          status: order.status,

          deliveryVerificationCode: order.deliveryVerificationCode,

          totalPrice: order.totalPrice,

          _version: order._version,
        },
        null,
        2,
      ),
    );

    /* ======================================================
       3. VALIDATE USER ID
    ====================================================== */

    if (!order.userID) {
      return failureResult("Order does not have a user ID.", order.id);
    }

    /* ======================================================
       4. VALIDATE ORDER AMOUNT
    ====================================================== */

    const orderAmount = Number(order.totalPrice);

    if (!Number.isFinite(orderAmount) || orderAmount <= 0) {
      return failureResult("Order has an invalid payment amount.", order.id);
    }

    /* ======================================================
       5. GET PAYSTACK SECRET
    ====================================================== */

    const secretKey = await getPaystackSecretKey();

    console.log("PAYSTACK SECRET RETRIEVED");

    /* ======================================================
       6. VERIFY TRANSACTION WITH PAYSTACK
    ====================================================== */

    const paystackResponse = await verifyWithPaystack(reference, secretKey);

    console.log("PAYSTACK HTTP STATUS:", paystackResponse?.statusCode);

    const paystack = paystackResponse?.body;

    if (
      !paystackResponse ||
      paystackResponse.statusCode < 200 ||
      paystackResponse.statusCode >= 300 ||
      !paystack?.status
    ) {
      console.error("PAYSTACK VERIFICATION FAILED:", JSON.stringify(paystack));

      return failureResult(
        paystack?.message || "Payment could not be verified.",
        order.id,
      );
    }

    /* ======================================================
       7. GET TRANSACTION
    ====================================================== */

    const transaction = paystack?.data;

    if (!transaction) {
      return failureResult("Paystack returned no transaction.", order.id);
    }

    /* ======================================================
       8. VERIFY TRANSACTION STATUS
    ====================================================== */

    if (transaction.status !== "success") {
      return failureResult(
        "Payment has not been successfully completed.",
        order.id,
      );
    }

    /* ======================================================
       9. VERIFY REFERENCE
    ====================================================== */

    if (transaction.reference !== reference) {
      console.error("PAYMENT REFERENCE MISMATCH:", {
        requestedReference: reference,

        paystackReference: transaction.reference,
      });

      return failureResult("Payment reference does not match.", order.id);
    }

    /* ======================================================
       10. VERIFY CURRENCY
    ====================================================== */

    if (transaction.currency !== "NGN") {
      return failureResult(
        "Payment currency does not match the order.",
        order.id,
      );
    }

    /* ======================================================
       11. VERIFY AMOUNT
    ====================================================== */

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

    console.log("PAYSTACK TRANSACTION VERIFIED:", {
      orderId: order.id,

      reference: transaction.reference,

      amount: transaction.amount,

      currency: transaction.currency,

      status: transaction.status,
    });

    /* ======================================================
       12. CHECK EXISTING PAYMENT
    ====================================================== */

    let payment = await getPaymentByReference(transaction.reference);

    if (payment) {
      console.log("EXISTING PAYMENT FOUND:", {
        paymentID: payment.id,

        orderID: payment.orderID,

        userID: payment.userID,

        reference: payment.reference,

        status: payment.status,
      });

      /*
       * Never allow the same Paystack reference to
       * belong to another Order.
       */

      if (payment.orderID && payment.orderID !== order.id) {
        console.error("PAYMENT REFERENCE BELONGS TO ANOTHER ORDER:", {
          reference: transaction.reference,

          existingOrderID: payment.orderID,

          requestedOrderID: order.id,
        });

        return failureResult(
          "This payment reference has already been used for another order.",
          order.id,
        );
      }
    } else {
      /*
       * The webhook may not have created the Payment yet.
       *
       * verifyAtuaPayment is allowed to create it because
       * this is the fallback path.
       */

      payment = await createPayment({
        order,

        transaction,
      });

      if (!payment?.id) {
        /*
         * Race-condition protection.
         *
         * The webhook may have created the Payment between
         * our lookup and creation attempt.
         */

        payment = await getPaymentByReference(transaction.reference);

        if (!payment?.id) {
          throw new Error("Payment record could not be created or found.");
        }
      }
    }

    /* ======================================================
       13. RELOAD ORDER
    ====================================================== */

    /*
     * THIS IS VERY IMPORTANT.
     *
     * The webhook could have updated the Order while this
     * Lambda was verifying Paystack.
     *
     * Therefore we throw away the old Order object and
     * retrieve the newest version.
     */

    order = await getOrder(order.id);

    if (!order) {
      throw new Error("Order could not be reloaded.");
    }

    console.log(
      "ORDER AFTER PAYSTACK VERIFICATION:",
      JSON.stringify(
        {
          id: order.id,

          userID: order.userID,

          paymentStatus: order.paymentStatus,

          paymentID: order.paymentID,

          fundsStatus: order.fundsStatus,

          status: order.status,

          deliveryVerificationCode: order.deliveryVerificationCode,

          version: order._version,
        },
        null,
        2,
      ),
    );

    /* ======================================================
       14. NORMAL WEBHOOK SUCCESS
    ====================================================== */

    /*
     * CASE 1:
     *
     * Webhook has already processed EVERYTHING.
     *
     * There is nothing for verifyAtuaPayment to change.
     */

    if (order.paymentStatus === "PAID" && order.deliveryVerificationCode) {
      console.log("==========================================");

      console.log("WEBHOOK ALREADY COMPLETED PAYMENT.");

      console.log("VERIFICATION CODE ALREADY EXISTS.");

      console.log("NO ORDER UPDATE WILL BE PERFORMED.");

      console.log("==========================================");

      return {
        success: true,

        verified: true,

        alreadyPaid: true,

        fallbackUsed: false,

        message: "Payment has already been processed by the Paystack webhook.",

        orderId: order.id,

        deliveryVerificationCode: order.deliveryVerificationCode,

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

    /* ======================================================
       15. PAID BUT VERIFICATION CODE MISSING
    ====================================================== */

    /*
     * CASE 2:
     *
     * This is the special fallback you requested.
     *
     * The webhook already processed the payment:
     *
     *     paymentStatus = PAID
     *
     * BUT:
     *
     *     deliveryVerificationCode = null
     *
     * Therefore:
     *
     *     DO NOT process payment again.
     *
     *     DO NOT create another Payment.
     *
     *     DO NOT change paymentStatus.
     *
     *     DO NOT change fundsStatus.
     *
     *     DO NOT change status.
     *
     *     ONLY generate/save the missing code.
     */

    if (order.paymentStatus === "PAID" && !order.deliveryVerificationCode) {
      console.log("==========================================");

      console.log("ORDER IS PAID BUT VERIFICATION CODE IS MISSING.");

      console.log("WEBHOOK PROCESSED PAYMENT.");

      console.log("VERIFY ATUA PAYMENT IS REPAIRING ONLY THE MISSING CODE.");

      console.log("==========================================");

      const verificationCode = generateVerificationCode();

      console.log("GENERATED FALLBACK VERIFICATION CODE:", {
        orderId: order.id,

        userID: order.userID,

        currentVersion: order._version,
      });

      const repairedOrder = await repairMissingVerificationCode({
        order,

        verificationCode,
      });

      if (!repairedOrder) {
        throw new Error("Could not repair missing verification code.");
      }

      if (!repairedOrder.deliveryVerificationCode) {
        throw new Error(
          "Verification code repair completed without a saved code.",
        );
      }

      console.log("==========================================");

      console.log("VERIFICATION CODE FALLBACK COMPLETED.");

      console.log("ORDER:", repairedOrder.id);

      console.log("CODE:", repairedOrder.deliveryVerificationCode);

      console.log("VERSION:", repairedOrder._version);

      console.log("==========================================");

      return {
        success: true,

        verified: true,

        alreadyPaid: true,

        fallbackUsed: true,

        message:
          "Payment was already confirmed. The missing delivery verification code was repaired.",

        orderId: repairedOrder.id,

        deliveryVerificationCode: repairedOrder.deliveryVerificationCode,

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

    /* ======================================================
       16. FULL FALLBACK PAYMENT PROCESSING
    ====================================================== */

    /*
     * CASE 3:
     *
     * The transaction is genuinely successful,
     * but the webhook has NOT yet marked the Order PAID.
     *
     * Therefore verifyAtuaPayment is allowed to complete
     * the entire payment state as a FALLBACK.
     */

    console.log("==========================================");

    console.log("WEBHOOK HAS NOT COMPLETED ORDER.");

    console.log("VERIFY ATUA PAYMENT IS ACTING AS FULL FALLBACK.");

    console.log("==========================================");

    /*
     * Preserve an existing code if there somehow is one.
     */

    const verificationCode =
      order.deliveryVerificationCode || generateVerificationCode();

    console.log("FALLBACK VERIFICATION CODE:", {
      orderId: order.id,

      reused: Boolean(order.deliveryVerificationCode),
    });

    /* ======================================================
       17. FALLBACK ORDER UPDATE
    ====================================================== */

    const updatedOrder = await markOrderAsPaidFallback({
      order,

      paymentId: payment.id,

      verificationCode,
    });

    if (!updatedOrder) {
      throw new Error("Fallback Order update failed.");
    }

    /* ======================================================
       18. RELOAD FINAL ORDER
    ====================================================== */

    const finalOrder = await getOrder(order.id);

    if (!finalOrder) {
      throw new Error("Could not reload Order after fallback update.");
    }

    console.log(
      "FINAL FALLBACK ORDER:",
      JSON.stringify(
        {
          id: finalOrder.id,

          userID: finalOrder.userID,

          paymentStatus: finalOrder.paymentStatus,

          paymentID: finalOrder.paymentID,

          fundsStatus: finalOrder.fundsStatus,

          status: finalOrder.status,

          deliveryVerificationCode: finalOrder.deliveryVerificationCode,

          recipientName: finalOrder.recipientName,

          originAddress: finalOrder.originAddress,

          destinationAddress: finalOrder.destinationAddress,

          totalPrice: finalOrder.totalPrice,

          courierEarnings: finalOrder.courierEarnings,

          version: finalOrder._version,

          lastChangedAt: finalOrder._lastChangedAt,
        },
        null,
        2,
      ),
    );

    /* ======================================================
       19. VALIDATE FINAL STATE
    ====================================================== */

    if (finalOrder.paymentStatus !== "PAID") {
      throw new Error(
        `Fallback payment update did not produce PAID status. Current: ${finalOrder.paymentStatus}`,
      );
    }

    if (finalOrder.paymentID !== payment.id) {
      throw new Error(
        `Fallback payment ID mismatch. Expected ${payment.id}, received ${finalOrder.paymentID}.`,
      );
    }

    if (finalOrder.fundsStatus !== "HELD") {
      throw new Error(
        `Fallback fundsStatus mismatch. Current: ${finalOrder.fundsStatus}`,
      );
    }

    if (finalOrder.status !== "READY_FOR_PICKUP") {
      throw new Error(
        `Fallback status mismatch. Current: ${finalOrder.status}`,
      );
    }

    if (!finalOrder.deliveryVerificationCode) {
      throw new Error("Fallback verification code was not saved.");
    }

    if (!finalOrder.userID) {
      throw new Error("Order userID disappeared during fallback update.");
    }

    /* ======================================================
       20. SUCCESS
    ====================================================== */

    console.log("==========================================");

    console.log("VERIFY ATUA PAYMENT FALLBACK COMPLETED");

    console.log("ORDER:", finalOrder.id);

    console.log("PAYMENT:", payment.id);

    console.log("CODE:", finalOrder.deliveryVerificationCode);

    console.log("VERSION:", finalOrder._version);

    console.log("==========================================");

    return {
      success: true,

      verified: true,

      alreadyPaid: false,

      fallbackUsed: true,

      message:
        "Payment successfully verified and recorded by fallback verification.",

      orderId: finalOrder.id,

      deliveryVerificationCode: finalOrder.deliveryVerificationCode,

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
    console.error("==========================================");

    console.error("VERIFY ATUA PAYMENT ERROR");

    console.error("MESSAGE:", error?.message);

    console.error("STACK:", error?.stack);

    console.error("==========================================");

    return {
      success: false,

      verified: false,

      alreadyPaid: false,

      fallbackUsed: false,

      message:
        error?.message || "Something went wrong while verifying the payment.",

      orderId: event?.arguments?.orderId || null,

      deliveryVerificationCode: null,

      payment: null,
    };
  }
};
