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

const { SignatureV4 } = require("@aws-sdk/signature-v4");
const { HttpRequest } = require("@aws-sdk/protocol-http");
const { defaultProvider } = require("@aws-sdk/credential-provider-node");
const { Sha256 } = require("@aws-crypto/sha256-js");

const { saveReusablePaymentMethod } = require("./paymentMethodHelper");

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
   IAM/SIGV4 GRAPHQL REQUEST
========================================================== */

/*
 * IMPORTANT:
 *
 * Most of this webhook currently uses the AppSync API key.
 *
 * OrderCancellation is different.
 *
 * Its schema allows backend access through:
 *
 *   allow: private
 *   provider: iam
 *
 * Therefore refund webhook operations against
 * OrderCancellation MUST use IAM/SigV4.
 *
 * We keep this separate from graphqlRequest() so that
 * existing payment and payout behaviour is not changed.
 */

const graphqlRequestIAM = async (
  query,
  variables = {},
  operationName = "GraphQL IAM operation",
) => {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error("Atua GraphQL endpoint is not configured.");
  }

  if (!REGION) {
    throw new Error("AWS region is not configured.");
  }

  const endpoint = new URL(GRAPHQL_ENDPOINT);

  const body = JSON.stringify({
    query,
    variables,
  });

  const request = new HttpRequest({
    method: "POST",

    protocol: endpoint.protocol,

    hostname: endpoint.hostname,

    path: endpoint.pathname || "/graphql",

    headers: {
      host: endpoint.hostname,

      "content-type": "application/json",

      "content-length": String(Buffer.byteLength(body)),
    },

    body,
  });

  /*
   * Sign the AppSync request using the Lambda's
   * IAM execution role.
   */
  const signer = new SignatureV4({
    credentials: defaultProvider(),

    region: REGION,

    service: "appsync",

    sha256: Sha256,
  });

  const signedRequest = await signer.sign(request);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: signedRequest.hostname,

      port: signedRequest.port,

      path: signedRequest.path,

      method: signedRequest.method,

      headers: signedRequest.headers,
    };

    const requestObject = https.request(options, (response) => {
      let data = "";

      response.on("data", (chunk) => {
        data += chunk;
      });

      response.on("end", () => {
        let parsed;

        try {
          parsed = data ? JSON.parse(data) : {};
        } catch (error) {
          console.error(`${operationName} INVALID JSON:`, {
            statusCode: response.statusCode,
            body: data,
          });

          return reject(new Error(`${operationName} returned invalid JSON.`));
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          console.error(`${operationName} HTTP ERROR:`, {
            statusCode: response.statusCode,
            body: parsed,
          });

          return reject(
            new Error(`${operationName} returned HTTP ${response.statusCode}.`),
          );
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

    requestObject.on("error", (error) => {
      console.error(`${operationName} REQUEST ERROR:`, error);

      reject(error);
    });

    requestObject.end();
  });
};

/* ==========================================================
   GET ORDER CANCELLATION BY PAYMENT REFERENCE
========================================================== */

/*
 * Paystack refund webhooks contain the original transaction
 * reference.
 *
 * We use that reference to find the OrderCancellation record
 * that belongs to the refund.
 *
 * OrderCancellation is protected by IAM, so this MUST use
 * graphqlRequestIAM().
 */
const getOrderCancellationByPaymentReference = async (paymentReference) => {
  if (!paymentReference) {
    throw new Error("Payment reference is required to find OrderCancellation.");
  }

  const query = `
    query ListOrderCancellations(
      $filter: ModelOrderCancellationFilterInput
    ) {
      listOrderCancellations(
        filter: $filter
        limit: 10
      ) {
        items {
          id

          orderID
          userID
          courierID

          status
          stage

          reason
          reasonNote

          originalAmount
          cancellationFee
          refundAmount

          refundStatus
          refundReference
          paymentReference

          cancellationRequestedAt
          cancellationProcessedAt

          refundRequestedAt
          refundedAt

          courierReversed
          courierEarningsReversed
          walletReversed
          assignmentReversed

          errorMessage

          createdAt
          updatedAt

          _version
          _lastChangedAt
          _deleted
        }
      }
    }
  `;

  const data = await graphqlRequestIAM(
    query,
    {
      filter: {
        paymentReference: {
          eq: paymentReference,
        },
      },
    },
    "GetOrderCancellationByPaymentReference",
  );

  const cancellation =
    data?.listOrderCancellations?.items?.find((item) => !item?._deleted) ||
    null;

  return cancellation;
};

/* ==========================================================
   UPDATE ORDER CANCELLATION REFUND STATUS
========================================================== */

/*
 * Updates the OrderCancellation record when Paystack sends
 * refund lifecycle events.
 *
 * This uses IAM because OrderCancellation allows backend
 * access through the IAM authorization rule.
 */
const updateOrderCancellationRefund = async ({
  cancellation,
  refundStatus,
  status,
  refundReference,
  refundedAt,
  cancellationProcessedAt,
  errorMessage,
}) => {
  if (!cancellation?.id) {
    throw new Error("OrderCancellation is required for refund update.");
  }

  const mutation = `
    mutation UpdateOrderCancellation(
      $input: UpdateOrderCancellationInput!
    ) {
      updateOrderCancellation(
        input: $input
      ) {
        id

        orderID
        userID
        courierID

        status
        stage

        originalAmount
        cancellationFee
        refundAmount

        refundStatus
        refundReference
        paymentReference

        cancellationRequestedAt
        cancellationProcessedAt

        refundRequestedAt
        refundedAt

        courierReversed
        courierEarningsReversed
        walletReversed
        assignmentReversed

        errorMessage

        createdAt
        updatedAt

        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const input = {
    id: cancellation.id,
    refundStatus,
    status,
  };

  /*
   * Preserve the existing Paystack refund reference if the
   * current webhook does not provide one.
   */
  if (refundReference) {
    input.refundReference = refundReference;
  }

  if (refundedAt) {
    input.refundedAt = refundedAt;
  }

  if (cancellationProcessedAt) {
    input.cancellationProcessedAt = cancellationProcessedAt;
  }

  if (errorMessage !== undefined) {
    input.errorMessage = errorMessage;
  }

  /*
   * AppSync/DataStore conflict version.
   *
   * Your current webhook already works with _version on
   * DataStore-backed models, so preserve it when available.
   */
  if (Number.isInteger(cancellation._version)) {
    input._version = cancellation._version;
  }

  console.log("UPDATING ORDER CANCELLATION REFUND:", {
    cancellationID: cancellation.id,
    orderID: cancellation.orderID,
    refundStatus,
    status,
    refundReference,
    refundedAt,
    cancellationProcessedAt,
    errorMessage,
    version: cancellation._version,
  });

  const data = await graphqlRequestIAM(
    mutation,
    {
      input,
    },
    "UpdateOrderCancellationRefund",
  );

  const updatedCancellation = data?.updateOrderCancellation || null;

  if (!updatedCancellation) {
    throw new Error(
      `OrderCancellation ${cancellation.id} was not returned after refund update.`,
    );
  }

  return updatedCancellation;
};

/* ==========================================================
   UPDATE ORDER REFUND STATUS
========================================================== */

/*
 * Order is currently handled by the existing AppSync API-key
 * path in your webhook.
 *
 * We therefore keep Order updates on graphqlRequest()
 * rather than changing the existing authorization model.
 */
const updateOrderRefundStatus = async ({
  orderID,
  refundStatus,
  cancellationStatus,
  refundReference,
  refundedAt,
  cancellationProcessedAt,
}) => {
  if (!orderID) {
    throw new Error("Order ID is required for refund status update.");
  }

  const mutation = `
    mutation UpdateOrderRefundStatus(
      $input: UpdateOrderInput!
    ) {
      updateOrder(
        input: $input
      ) {
        id

        status

        cancellationStatus
        refundStatus

        refundReference
        refundRequestedAt
        refundedAt

        cancellationProcessedAt

        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const input = {
    id: orderID,
    refundStatus,
    cancellationStatus,
  };

  if (refundReference) {
    input.refundReference = refundReference;
  }

  if (refundedAt) {
    input.refundedAt = refundedAt;
  }

  if (cancellationProcessedAt) {
    input.cancellationProcessedAt = cancellationProcessedAt;
  }

  console.log("UPDATING ORDER REFUND STATUS:", {
    orderID,
    refundStatus,
    cancellationStatus,
    refundReference,
    refundedAt,
    cancellationProcessedAt,
  });

  const data = await graphqlRequest(
    mutation,
    {
      input,
    },
    "UpdateOrderRefundStatus",
  );

  const updatedOrder = data?.updateOrder || null;

  if (!updatedOrder) {
    throw new Error(
      `Order ${orderID} was not returned after refund status update.`,
    );
  }

  return updatedOrder;
};

/* ==========================================================
   PROCESS PAYSTACK REFUND WEBHOOK
========================================================== */

/*
 * Paystack refund lifecycle:
 *
 * refund.pending
 * refund.processing
 * refund.needs-attention
 * refund.failed
 * refund.processed
 *
 * IMPORTANT:
 *
 * The refund API request being accepted does NOT mean that
 * the customer has received the money.
 *
 * The financial refund is only considered completed when
 * Paystack sends:
 *
 *     refund.processed
 *
 * This function is also deliberately idempotent because
 * Paystack may send the same webhook more than once.
 */
const processPaystackRefundWebhook = async ({ event, refund }) => {
  if (!event) {
    throw new Error("Refund webhook event is required.");
  }

  if (!refund) {
    throw new Error("Refund webhook data is required.");
  }

  const paymentReference =
    refund.transaction_reference || refund.transaction?.reference || null;

  if (!paymentReference) {
    throw new Error(
      `Paystack ${event} refund does not contain transaction_reference.`,
    );
  }

  const currency = String(refund.currency || "NGN").toUpperCase();

  if (currency !== "NGN") {
    throw new Error(
      `Unsupported refund currency: ${currency}. Atua expects NGN refunds.`,
    );
  }

  /*
   * Paystack amounts are in kobo.
   */
  const refundAmountKobo = Number(refund.amount);

  if (!Number.isFinite(refundAmountKobo) || refundAmountKobo < 0) {
    throw new Error(`Invalid Paystack refund amount: ${refund.amount}`);
  }

  console.log("PROCESSING PAYSTACK REFUND:", {
    event,
    paymentReference,
    refundID: refund.id || null,
    amountKobo: refundAmountKobo,
    currency,
    status: refund.status || null,
  });

  /* ========================================================
     FIND ORDER CANCELLATION
  ======================================================== */

  const cancellation =
    await getOrderCancellationByPaymentReference(paymentReference);

  if (!cancellation) {
    throw new Error(
      `No OrderCancellation found for Paystack refund transaction reference ${paymentReference}.`,
    );
  }

  if (cancellation._deleted) {
    throw new Error(`OrderCancellation ${cancellation.id} has been deleted.`);
  }

  /* ========================================================
     VALIDATE REFUND AMOUNT
  ======================================================== */

  const expectedRefundKobo = Math.round(
    Number(cancellation.refundAmount || 0) * 100,
  );

  if (refundAmountKobo !== expectedRefundKobo) {
    throw new Error(
      `Refund amount mismatch for ${paymentReference}. ` +
        `Expected ${expectedRefundKobo} kobo but Paystack sent ${refundAmountKobo} kobo.`,
    );
  }

  /*
   * Use Paystack's refund ID/reference when available.
   */
  const refundReference =
    refund.reference || (refund.id != null ? String(refund.id) : null);

  const now = new Date().toISOString();

  /* ========================================================
     IDEMPOTENCY
  ======================================================== */

  /*
   * If the refund has already reached PROCESSED and the
   * cancellation has already completed, there is nothing
   * more to do.
   */
  if (
    event === "refund.processed" &&
    cancellation.refundStatus === "PROCESSED" &&
    cancellation.status === "COMPLETED"
  ) {
    console.log("REFUND ALREADY COMPLETED - IGNORING DUPLICATE WEBHOOK:", {
      cancellationID: cancellation.id,
      orderID: cancellation.orderID,
      paymentReference,
      refundReference,
    });

    return {
      handled: true,
      alreadyProcessed: true,
      status: "PROCESSED",
      paymentReference,
      refundReference,
      cancellationID: cancellation.id,
      orderID: cancellation.orderID,
    };
  }

  /* ========================================================
     REFUND.PENDING
  ======================================================== */

  if (event === "refund.pending") {
    const updatedCancellation = await updateOrderCancellationRefund({
      cancellation,
      refundStatus: "PENDING",
      status: "PROCESSING",
      refundReference,
    });

    const updatedOrder = await updateOrderRefundStatus({
      orderID: cancellation.orderID,
      refundStatus: "PENDING",
      cancellationStatus: "PROCESSING",
      refundReference,
    });

    return {
      handled: true,
      alreadyProcessed: false,
      status: "PENDING",
      paymentReference,
      refundReference,
      cancellationID: updatedCancellation.id,
      orderID: updatedOrder.id,
    };
  }

  /* ========================================================
     REFUND.PROCESSING
  ======================================================== */

  if (event === "refund.processing") {
    const updatedCancellation = await updateOrderCancellationRefund({
      cancellation,
      refundStatus: "PROCESSING",
      status: "PROCESSING",
      refundReference,
    });

    const updatedOrder = await updateOrderRefundStatus({
      orderID: cancellation.orderID,
      refundStatus: "PROCESSING",
      cancellationStatus: "PROCESSING",
      refundReference,
    });

    return {
      handled: true,
      alreadyProcessed: false,
      status: "PROCESSING",
      paymentReference,
      refundReference,
      cancellationID: updatedCancellation.id,
      orderID: updatedOrder.id,
    };
  }

  /* ========================================================
     REFUND.NEEDS-ATTENTION
  ======================================================== */

  if (event === "refund.needs-attention") {
    const attentionMessage =
      refund.message ||
      refund.reason ||
      "Paystack requires additional customer information to complete the refund.";

    const updatedCancellation = await updateOrderCancellationRefund({
      cancellation,
      refundStatus: "NEEDS_ATTENTION",
      status: "PROCESSING",
      refundReference,
      errorMessage: attentionMessage,
    });

    const updatedOrder = await updateOrderRefundStatus({
      orderID: cancellation.orderID,
      refundStatus: "NEEDS_ATTENTION",
      cancellationStatus: "PROCESSING",
      refundReference,
    });

    console.warn("REFUND NEEDS CUSTOMER ATTENTION:", {
      cancellationID: cancellation.id,
      orderID: cancellation.orderID,
      paymentReference,
      message: attentionMessage,
    });

    return {
      handled: true,
      alreadyProcessed: false,
      status: "NEEDS_ATTENTION",
      paymentReference,
      refundReference,
      cancellationID: updatedCancellation.id,
      orderID: updatedOrder.id,
      message: attentionMessage,
    };
  }

  /* ========================================================
     REFUND.FAILED
  ======================================================== */

  if (event === "refund.failed") {
    const failureMessage =
      refund.message ||
      refund.reason ||
      refund.failure_reason ||
      "Paystack refund failed.";

    const updatedCancellation = await updateOrderCancellationRefund({
      cancellation,
      refundStatus: "FAILED",
      status: "FAILED",
      refundReference,
      errorMessage: failureMessage,
    });

    const updatedOrder = await updateOrderRefundStatus({
      orderID: cancellation.orderID,
      refundStatus: "FAILED",
      cancellationStatus: "FAILED",
      refundReference,
    });

    console.error("PAYSTACK REFUND FAILED:", {
      cancellationID: cancellation.id,
      orderID: cancellation.orderID,
      paymentReference,
      refundReference,
      reason: failureMessage,
    });

    return {
      handled: true,
      alreadyProcessed: false,
      status: "FAILED",
      paymentReference,
      refundReference,
      cancellationID: updatedCancellation.id,
      orderID: updatedOrder.id,
      message: failureMessage,
    };
  }

  /* ========================================================
     REFUND.PROCESSED
  ======================================================== */

  if (event === "refund.processed") {
    const updatedCancellation = await updateOrderCancellationRefund({
      cancellation,
      refundStatus: "PROCESSED",
      status: "COMPLETED",
      refundReference,
      refundedAt: now,
      cancellationProcessedAt: now,
      errorMessage: null,
    });

    const updatedOrder = await updateOrderRefundStatus({
      orderID: cancellation.orderID,
      refundStatus: "PROCESSED",
      cancellationStatus: "COMPLETED",
      refundReference,
      refundedAt: now,
      cancellationProcessedAt: now,
    });

    console.log("PAYSTACK REFUND PROCESSED SUCCESSFULLY:", {
      cancellationID: cancellation.id,
      orderID: cancellation.orderID,
      paymentReference,
      refundReference,
      refundedAt: now,
    });

    return {
      handled: true,
      alreadyProcessed: false,
      status: "PROCESSED",
      paymentReference,
      refundReference,
      cancellationID: updatedCancellation.id,
      orderID: updatedOrder.id,
      refundedAt: now,
    };
  }

  /*
   * Defensive fallback.
   */
  throw new Error(`Unsupported Paystack refund event: ${event}`);
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
   ORDER FIELDS
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
  orderEnvironment
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

  maxiCountIncrementedAt

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
   GET COURIER FOR MAXI COUNT
========================================================== */

const getCourierForMaxiCount = async (courierId) => {
  if (!courierId) {
    throw new Error("assignedCourierId is required for a MAXI count update.");
  }

  const query = `
    query GetCourier(
      $id: ID!
    ) {
      getCourier(
        id: $id
      ) {
        id
        currentMaxiCount
        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    {
      id: courierId,
    },
    "GetCourierForMaxiCount",
  );

  return data?.getCourier || null;
};

/* ==========================================================
   INCREMENT MAXI COURIER COUNT
========================================================== */

const incrementMaxiCourierCount = async (order) => {
  /*
   * Only MAXI orders use currentMaxiCount.
   */
  if (order?.transportationType !== "MAXI") {
    return order;
  }

  /*
   * Do not increment the same MAXI courier twice if
   * Paystack sends the same payment webhook again.
   */
  if (order?.maxiCountIncrementedAt) {
    console.log("MAXI COUNT ALREADY INCREMENTED:", {
      orderID: order.id,
      assignedCourierId: order.assignedCourierId,
      maxiCountIncrementedAt: order.maxiCountIncrementedAt,
    });

    return order;
  }

  if (!order?.assignedCourierId) {
    throw new Error(
      `MAXI Order ${
        order?.id || "unknown"
      } is PAID but has no assignedCourierId.`,
    );
  }

  const courier = await getCourierForMaxiCount(order.assignedCourierId);

  if (!courier || courier._deleted) {
    throw new Error(
      `Assigned MAXI courier ${order.assignedCourierId} was not found.`,
    );
  }

  const currentMaxiCount = Number(courier.currentMaxiCount || 0);

  if (!Number.isFinite(currentMaxiCount) || currentMaxiCount < 0) {
    throw new Error(
      `Invalid currentMaxiCount for courier ${courier.id}: ${courier.currentMaxiCount}`,
    );
  }

  const nextMaxiCount = currentMaxiCount + 1;

  const mutation = `
    mutation UpdateCourier(
      $input: UpdateCourierInput!
    ) {
      updateCourier(
        input: $input
      ) {
        id
        currentMaxiCount
        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const courierInput = {
    id: courier.id,
    currentMaxiCount: nextMaxiCount,
  };

  if (Number.isInteger(courier._version)) {
    courierInput._version = courier._version;
  }

  console.log("INCREMENTING MAXI COURIER COUNT:", {
    orderID: order.id,
    courierID: courier.id,
    previousMaxiCount: currentMaxiCount,
    nextMaxiCount,
    courierVersion: courier._version,
  });

  const data = await graphqlRequest(
    mutation,
    {
      input: courierInput,
    },
    "IncrementMaxiCourierCount",
  );

  const updatedCourier = data?.updateCourier || null;

  if (!updatedCourier) {
    throw new Error(`updateCourier returned no Courier for ${courier.id}.`);
  }

  /*
   * Mark the Order so future Paystack retries do not
   * increment the courier again.
   */
  const markMutation = `
    mutation MarkMaxiCountIncremented(
      $input: UpdateOrderInput!
    ) {
      updateOrder(
        input: $input
      ) {
        id
        maxiCountIncrementedAt
        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const incrementedAt = new Date().toISOString();

  const orderInput = {
    id: order.id,
    maxiCountIncrementedAt: incrementedAt,
  };

  if (Number.isInteger(order._version)) {
    orderInput._version = order._version;
  }

  const markedData = await graphqlRequest(
    markMutation,
    {
      input: orderInput,
    },
    "MarkMaxiCountIncremented",
  );

  const markedOrder = markedData?.updateOrder || null;

  if (!markedOrder) {
    throw new Error(
      `MAXI courier count was increased for Order ${order.id}, but the idempotency marker could not be saved.`,
    );
  }

  console.log("MAXI COURIER COUNT INCREMENTED:", {
    orderID: order.id,
    courierID: updatedCourier.id,
    currentMaxiCount: updatedCourier.currentMaxiCount,
    maxiCountIncrementedAt: markedOrder.maxiCountIncrementedAt,
  });

  return {
    ...order,
    maxiCountIncrementedAt: markedOrder.maxiCountIncrementedAt,
    _version: markedOrder._version,
  };
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
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/* ==========================================================
   GENERATE RECIPIENT TRACKING TOKEN
========================================================== */

const generateRecipientTrackingToken = () => {
  return crypto.randomBytes(24).toString("hex");
};

/* ==========================================================
   FINALIZE PAID ORDER
========================================================== */

/*
 * This is the existing payment-finalization logic.
 *
 * IMPORTANT:
 * The payout transfer webhook does NOT use this function.
 *
 * This function is only for charge.success and therefore
 * preserves the existing Order payment flow.
 */

const finalizePaidOrder = async ({ order, payment, transaction }) => {
  if (!order?.id) {
    throw new Error("Order is required to finalize payment.");
  }

  if (!payment?.id) {
    throw new Error("Payment is required to finalize Order.");
  }

  if (!transaction?.reference) {
    throw new Error("Paystack transaction reference is required.");
  }

  /*
   * --------------------------------------------------------
   * IDEMPOTENCY
   * --------------------------------------------------------
   *
   * If the Order is already PAID and already points to the
   * same Payment, do not perform the payment finalization
   * again.
   */

  const expectedPostPaymentStatus =
    order.transportationType === "MAXI" ? "ACCEPTED" : "READY_FOR_PICKUP";

  if (
    order.paymentStatus === "PAID" &&
    order.paymentID === payment.id &&
    order.paymentReference === transaction.reference &&
    order.status === expectedPostPaymentStatus &&
    order.deliveryVerificationCode &&
    order.recipientTrackingToken &&
    order.recipientTrackingEnabled === true
  ) {
    console.log("ORDER ALREADY FULLY FINALIZED:", {
      orderID: order.id,
      paymentID: payment.id,
      reference: transaction.reference,
    });

    return order;
  }

  /*
   * --------------------------------------------------------
   * GENERATE DELIVERY VERIFICATION CODE
   * --------------------------------------------------------
   */

  const deliveryVerificationCode =
    order.deliveryVerificationCode || generateVerificationCode();

  /*
   * --------------------------------------------------------
   * GENERATE RECIPIENT TRACKING TOKEN
   * --------------------------------------------------------
   */

  const recipientTrackingToken =
    order.recipientTrackingToken || generateRecipientTrackingToken();

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

  const paymentFinalizedStatus =
    order.transportationType === "MAXI" ? "ACCEPTED" : "READY_FOR_PICKUP";

  const input = {
    id: order.id,

    paymentStatus: "PAID",

    paymentID: payment.id,

    paymentReference: transaction.reference,

    status: paymentFinalizedStatus,

    fundsStatus: "HELD",

    earningsAllocationStatus: order.earningsAllocationStatus || "NOT_ALLOCATED",

    deliveryVerificationCode,

    recipientTrackingToken,

    recipientTrackingEnabled: true,

    recipientTrackingRevokedAt: null,
  };

  /*
   * Preserve orderEnvironment.
   *
   * This is important because the application now
   * distinguishes TEST and PRODUCTION orders.
   */
  if (order.orderEnvironment !== undefined) {
    input.orderEnvironment = order.orderEnvironment;
  }

  /*
   * Use DataStore versioning when available.
   */
  if (Number.isInteger(order._version)) {
    input._version = order._version;
  }

  console.log("FINALIZING PAID ORDER:", {
    orderID: order.id,
    paymentID: payment.id,
    reference: transaction.reference,

    previousStatus: order.status,
    newStatus: paymentFinalizedStatus,

    transportationType: order.transportationType,

    paymentStatus: input.paymentStatus,
    fundsStatus: input.fundsStatus,
    earningsAllocationStatus: input.earningsAllocationStatus,
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
    throw new Error(
      `Order payment finalization returned no Order for ${order.id}.`,
    );
  }

  console.log("ORDER PAYMENT FINALIZED:", {
    orderID: updatedOrder.id,
    paymentStatus: updatedOrder.paymentStatus,
    paymentID: updatedOrder.paymentID,
    paymentReference: updatedOrder.paymentReference,
    status: updatedOrder.status,
    fundsStatus: updatedOrder.fundsStatus,
    earningsAllocationStatus: updatedOrder.earningsAllocationStatus,
    orderEnvironment: updatedOrder.orderEnvironment,
    _version: updatedOrder._version,
  });

  return updatedOrder;
};

/* ==========================================================
   VERIFY PAYSTACK WEBHOOK SIGNATURE
========================================================== */

const verifyPaystackSignature = ({ rawBody, signature, secretKey }) => {
  if (!rawBody) {
    throw new Error("Webhook body is empty.");
  }

  if (!signature) {
    throw new Error("Paystack webhook signature is missing.");
  }

  if (!secretKey) {
    throw new Error("Paystack secret key is missing.");
  }

  const expectedSignature = crypto
    .createHmac("sha512", secretKey)
    .update(rawBody)
    .digest("hex");

  /*
   * timingSafeEqual requires buffers of the same
   * length, so check length first.
   */
  if (expectedSignature.length !== signature.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, "utf8"),
    Buffer.from(signature, "utf8"),
  );
};

/* ==========================================================
   GET PAYSTACK SIGNATURE
========================================================== */

const getPaystackSignature = (event) => {
  const headers = event?.headers || {};

  /*
   * API Gateway/Lambda headers can arrive with different
   * capitalization depending on the request path.
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
  let rawBody = event?.body;

  if (event?.isBase64Encoded && typeof rawBody === "string") {
    rawBody = Buffer.from(rawBody, "base64").toString("utf8");
  }

  if (typeof rawBody !== "string") {
    rawBody = JSON.stringify(rawBody || {});
  }

  let payload;

  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    throw new Error("Invalid JSON webhook body.");
  }

  return {
    rawBody,
    payload,
  };
};

/**
 * Extract the actual Atua Order ID from a Paystack transaction.
 *
 * Priority:
 *
 * 1. Paystack metadata.orderId / orderID / order_id
 * 2. Normal payment reference:
 *      atua_<orderId>_<timestamp>
 * 3. Saved-card payment reference:
 *      atua-saved-<orderId>-<timestamp>-<random>
 *
 * IMPORTANT:
 * Never return the complete Paystack reference as the Order ID.
 */
const extractOrderId = (transaction) => {
  // ---------------------------------------------------------
  // 1. Read Paystack metadata
  // ---------------------------------------------------------
  let metadata = transaction?.metadata || {};

  // Paystack metadata may arrive as an object OR as a JSON string.
  if (typeof metadata === "string") {
    try {
      metadata = JSON.parse(metadata);
    } catch (error) {
      console.warn("PAYSTACK METADATA COULD NOT BE PARSED.");
      metadata = {};
    }
  }

  // ---------------------------------------------------------
  // 2. Prefer the actual Order ID from metadata
  // ---------------------------------------------------------
  const metadataOrderId =
    metadata?.orderId || metadata?.orderID || metadata?.order_id || null;

  if (metadataOrderId) {
    return String(metadataOrderId);
  }

  // ---------------------------------------------------------
  // 3. Fall back to parsing the Paystack reference
  // ---------------------------------------------------------
  const reference = String(transaction?.reference || "").trim();

  if (!reference) {
    return null;
  }

  // ---------------------------------------------------------
  // Normal new-card payment:
  //
  // atua_<orderId>_<timestamp>
  //
  // Example:
  // atua_f7d1431a-655f-4ac7-9445-04ec90cf21e9_1791483241146
  // ---------------------------------------------------------
  const normalPaymentMatch = reference.match(/^atua_(.+)_\d+$/);

  if (normalPaymentMatch?.[1]) {
    return normalPaymentMatch[1];
  }

  // ---------------------------------------------------------
  // Saved-card payment:
  //
  // atua-saved-<orderId>-<timestamp>-<random>
  //
  // Example:
  // atua-saved-f7d1431a-655f-4ac7-9445-04ec90cf21e9-1791483241146-a1b2c3d4
  // ---------------------------------------------------------
  const savedPaymentMatch = reference.match(/^atua-saved-(.+)-\d+-[a-f0-9]+$/i);

  if (savedPaymentMatch?.[1]) {
    return savedPaymentMatch[1];
  }

  // ---------------------------------------------------------
  // NEVER return the full Paystack reference.
  // ---------------------------------------------------------
  return null;
};

/* ==========================================================
   HTTP RESPONSE HELPER
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
   PAYOUT HELPERS
========================================================== */

/*
 * Payout flow:
 *
 * processPayouts
 *      |
 *      | creates Payout = PROCESSING
 *      | creates DEBIT Transaction = PENDING
 *      | debits courier wallet
 *      | initiates Paystack transfer
 *      |
 *      v
 * Paystack
 *      |
 *      +--> transfer.success
 *      |
 *      +--> transfer.failed
 *      |
 *      +--> transfer.reversed
 *              |
 *              v
 *       this webhook finalizes
 *
 * IMPORTANT:
 *
 * Payout.reference is the same reference used for the
 * Paystack transfer.
 *
 * Transaction.reference is also the same reference.
 */

/* ==========================================================
   GET PAYOUT BY REFERENCE
========================================================== */

const getPayoutByReference = async (reference) => {
  if (!reference) {
    throw new Error("Payout reference is required.");
  }

  const query = `
    query ListPayouts(
      $filter: ModelPayoutFilterInput
    ) {
      listPayouts(
        filter: $filter
        limit: 10
      ) {
        items {
          id

          courierID
          walletID

          amount
          status

          bankName
          accountNumber

          reference

          transferCode
          transferID

          failureReason

          payoutMethod
          payoutSource

          processedAt
          paidAt
          failedAt

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
    "GetPayoutByReference",
  );

  const payouts = data?.listPayouts?.items || [];

  const payout = payouts.find(
    (item) => item && !item._deleted && item.reference === reference,
  );

  return payout || null;
};

/* ==========================================================
   GET PAYOUT TRANSACTION BY REFERENCE
========================================================== */

/*
 * processPayouts creates the payout debit Transaction
 * using the same reference as the Payout / Paystack transfer.
 *
 * We deliberately require:
 *
 *   reference
 *   walletID
 *
 * and we verify:
 *
 *   type === DEBIT
 *
 * This prevents an unrelated Transaction from being
 * treated as the payout transaction.
 */

const getPayoutTransactionByReference = async ({ reference, walletID }) => {
  if (!reference) {
    throw new Error("Payout transaction reference is required.");
  }

  if (!walletID) {
    throw new Error("Payout walletID is required.");
  }

  const query = `
    query ListTransactions(
      $filter: ModelTransactionFilterInput
    ) {
      listTransactions(
        filter: $filter
        limit: 20
      ) {
        items {
          id

          walletID

          type
          amount

          description

          orderID
          paymentID

          reference

          status

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
        and: [
          {
            reference: {
              eq: reference,
            },
          },
          {
            walletID: {
              eq: walletID,
            },
          },
        ],
      },
    },
    "GetPayoutTransactionByReference",
  );

  const transactions = data?.listTransactions?.items || [];

  const transaction = transactions.find(
    (item) =>
      item &&
      !item._deleted &&
      item.reference === reference &&
      item.walletID === walletID &&
      item.type === "DEBIT",
  );

  return transaction || null;
};

/* ==========================================================
   GET PAYOUT WALLET
========================================================== */

/*
 * IMPORTANT:
 *
 * The Payout already stores walletID.
 *
 * Therefore we use payout.walletID directly rather than
 * searching for a wallet by courierID.
 */

const getPayoutWallet = async (walletID) => {
  if (!walletID) {
    throw new Error("Payout walletID is required.");
  }

  const query = `
    query GetWallet(
      $id: ID!
    ) {
      getWallet(
        id: $id
      ) {
        id

        ownerID
        ownerType

        availableBalance
        pendingBalance
        lifetimeEarnings

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
      id: walletID,
    },
    "GetPayoutWallet",
  );

  const wallet = data?.getWallet || null;

  if (!wallet || wallet._deleted) {
    return null;
  }

  return wallet;
};

/* ==========================================================
   VALIDATE PAYSTACK PAYOUT TRANSFER
========================================================== */

/*
 * Paystack transfer amounts are in kobo.
 *
 * Atua Payout.amount is stored in naira.
 *
 * Example:
 *
 * Atua Payout.amount = ₦10,000
 *
 * Paystack transfer.amount = 1,000,000
 *
 * Therefore:
 *
 * transfer.amount / 100 === payout.amount
 *
 * We also require NGN.
 */

const validatePayoutTransfer = ({ payout, transfer }) => {
  if (!payout) {
    throw new Error("Payout is required for transfer validation.");
  }

  if (!transfer) {
    throw new Error("Paystack transfer data is required.");
  }

  const payoutAmount = Number(payout.amount);

  const transferAmountKobo = Number(transfer.amount);

  if (!Number.isFinite(payoutAmount) || payoutAmount <= 0) {
    throw new Error(
      `Invalid payout amount for ${payout.reference}: ${payout.amount}`,
    );
  }

  if (!Number.isFinite(transferAmountKobo) || transferAmountKobo <= 0) {
    throw new Error(
      `Invalid Paystack transfer amount for ${payout.reference}: ${transfer.amount}`,
    );
  }

  const transferAmountNaira = transferAmountKobo / 100;

  if (transferAmountNaira !== payoutAmount) {
    throw new Error(
      `Paystack transfer amount mismatch for ${payout.reference}. Payout amount: ${payoutAmount}, Paystack amount: ${transferAmountNaira}.`,
    );
  }

  const currency = String(transfer.currency || "NGN").toUpperCase();

  if (currency !== "NGN") {
    throw new Error(
      `Unsupported payout currency for ${payout.reference}: ${currency}`,
    );
  }

  return true;
};

/* ==========================================================
   UPDATE PAYOUT STATUS
========================================================== */

const updatePayoutStatus = async ({
  payout,
  status,
  failureReason = null,
  transferCode = null,
  transferID = null,
}) => {
  if (!payout?.id) {
    throw new Error("Payout is required to update payout status.");
  }

  if (!status) {
    throw new Error("Payout status is required.");
  }

  const mutation = `
    mutation UpdatePayout(
      $input: UpdatePayoutInput!
    ) {
      updatePayout(
        input: $input
      ) {
        id

        courierID
        walletID

        amount
        status

        bankName
        accountNumber

        reference

        transferCode
        transferID

        failureReason

        payoutMethod
        payoutSource

        processedAt
        paidAt
        failedAt

        createdAt
        updatedAt

        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const input = {
    id: payout.id,
    status,
  };

  /*
   * Preserve the Paystack transfer identifiers.
   */

  if (transferCode) {
    input.transferCode = transferCode;
  }

  if (transferID) {
    input.transferID = transferID;
  }

  /*
   * SUCCESS
   */

  if (status === "PAID") {
    input.paidAt = new Date().toISOString();

    /*
     * A successful payout should not retain
     * an old failure reason.
     */

    input.failureReason = null;
  }

  /*
   * FAILURE
   */

  if (status === "FAILED") {
    input.failedAt = new Date().toISOString();

    input.failureReason = failureReason || "Paystack transfer failed.";
  }

  /*
   * DataStore optimistic concurrency.
   */

  if (Number.isInteger(payout._version)) {
    input._version = payout._version;
  }

  console.log("UPDATING PAYOUT STATUS:", {
    payoutID: payout.id,
    reference: payout.reference,
    previousStatus: payout.status,
    nextStatus: status,
    transferCode,
    transferID,
    failureReason,
  });

  const data = await graphqlRequest(
    mutation,
    {
      input,
    },
    "UpdatePayoutStatus",
  );

  const updatedPayout = data?.updatePayout || null;

  if (!updatedPayout) {
    throw new Error(`Payout update returned no Payout for ${payout.id}.`);
  }

  console.log("PAYOUT STATUS UPDATED:", {
    payoutID: updatedPayout.id,
    reference: updatedPayout.reference,
    status: updatedPayout.status,
    transferCode: updatedPayout.transferCode,
    transferID: updatedPayout.transferID,
    paidAt: updatedPayout.paidAt,
    failedAt: updatedPayout.failedAt,
  });

  return updatedPayout;
};

/* ==========================================================
   UPDATE PAYOUT TRANSACTION STATUS
========================================================== */

/*
 * processPayouts creates the payout debit Transaction
 * as PENDING.
 *
 * Final states:
 *
 * Paystack transfer.success
 *      PENDING -> COMPLETED
 *
 * Paystack transfer.failed/reversed
 *      PENDING -> FAILED
 *
 * We do NOT create another debit transaction.
 */

const updatePayoutTransactionStatus = async ({ transaction, status }) => {
  if (!transaction?.id) {
    throw new Error("Payout transaction is required.");
  }

  if (!status) {
    throw new Error("Transaction status is required.");
  }

  const mutation = `
    mutation UpdateTransaction(
      $input: UpdateTransactionInput!
    ) {
      updateTransaction(
        input: $input
      ) {
        id

        walletID

        type
        amount

        description

        orderID
        paymentID

        reference

        status

        createdAt
        updatedAt

        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const input = {
    id: transaction.id,
    status,
  };

  if (Number.isInteger(transaction._version)) {
    input._version = transaction._version;
  }

  console.log("UPDATING PAYOUT TRANSACTION STATUS:", {
    transactionID: transaction.id,
    reference: transaction.reference,
    previousStatus: transaction.status,
    nextStatus: status,
  });

  const data = await graphqlRequest(
    mutation,
    {
      input,
    },
    "UpdatePayoutTransactionStatus",
  );

  const updatedTransaction = data?.updateTransaction || null;

  if (!updatedTransaction) {
    throw new Error(
      `Transaction update returned no Transaction for ${transaction.id}.`,
    );
  }

  console.log("PAYOUT TRANSACTION STATUS UPDATED:", {
    transactionID: updatedTransaction.id,
    reference: updatedTransaction.reference,
    status: updatedTransaction.status,
  });

  return updatedTransaction;
};

/* ==========================================================
   RESTORE PAYOUT WALLET
========================================================== */

/*
 * IMPORTANT:
 *
 * This restores Transaction.amount, NOT Payout.amount.
 *
 * Example:
 *
 * Requested payout = ₦10,000
 * Courier fee      = ₦100
 * Wallet debit     = ₦10,100
 *
 * Therefore:
 *
 * Failed transfer restoration = ₦10,100
 *
 * This is important because Payout.amount excludes
 * the courier payout fee while Transaction.amount
 * represents the actual wallet debit.
 *
 * NOTE:
 *
 * This helper is used only by the dedicated payout
 * reversal operation in the final corrected flow.
 */

const restorePayoutWallet = async ({ wallet, transaction }) => {
  if (!wallet?.id) {
    throw new Error("Wallet is required for payout restoration.");
  }

  if (!transaction?.id) {
    throw new Error("Payout transaction is required for wallet restoration.");
  }

  const restorationAmount = Number(transaction.amount);

  if (!Number.isFinite(restorationAmount) || restorationAmount <= 0) {
    throw new Error(`Invalid payout transaction amount: ${transaction.amount}`);
  }

  const currentAvailableBalance = Number(wallet.availableBalance || 0);

  if (!Number.isFinite(currentAvailableBalance)) {
    throw new Error(
      `Invalid wallet availableBalance: ${wallet.availableBalance}`,
    );
  }

  const nextAvailableBalance = Number(
    (currentAvailableBalance + restorationAmount).toFixed(2),
  );

  const mutation = `
    mutation UpdateWallet(
      $input: UpdateWalletInput!
    ) {
      updateWallet(
        input: $input
      ) {
        id

        ownerID
        ownerType

        availableBalance
        pendingBalance
        lifetimeEarnings

        createdAt
        updatedAt

        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const input = {
    id: wallet.id,
    availableBalance: nextAvailableBalance,
  };

  if (Number.isInteger(wallet._version)) {
    input._version = wallet._version;
  }

  console.log("RESTORING PAYOUT WALLET:", {
    walletID: wallet.id,
    transactionID: transaction.id,
    reference: transaction.reference,
    previousAvailableBalance: currentAvailableBalance,
    restorationAmount,
    nextAvailableBalance,
  });

  const data = await graphqlRequest(
    mutation,
    {
      input,
    },
    "RestorePayoutWallet",
  );

  const updatedWallet = data?.updateWallet || null;

  if (!updatedWallet) {
    throw new Error(`Wallet restoration returned no Wallet for ${wallet.id}.`);
  }

  console.log("PAYOUT WALLET RESTORED:", {
    walletID: updatedWallet.id,
    restorationAmount,
    availableBalance: updatedWallet.availableBalance,
  });

  return updatedWallet;
};

/* ==========================================================
   PAYOUT REVERSAL HELPER
========================================================== */

/*
 * IMPORTANT:
 *
 * The wallet restoration cannot safely be performed as three
 * unrelated GraphQL mutations:
 *
 *   1. restore Wallet
 *   2. mark Payout FAILED
 *   3. mark Transaction FAILED
 *
 * because Lambda could stop between those operations.
 *
 * Therefore the final failure/reversal path is designed to
 * use the dedicated payout-reversal operation.
 *
 * That operation is responsible for making the financial
 * reversal idempotent.
 *
 * The webhook itself remains responsible for:
 *
 *   - authenticating Paystack
 *   - validating the transfer
 *   - locating the Payout
 *   - locating the original debit Transaction
 *   - passing the exact wallet debit amount
 *
 * The dedicated reversal Lambda will perform the actual
 * financial reversal safely.
 *
 * IMPORTANT:
 *
 * The mutation name/input/output below must match the
 * reversePayout Lambda/schema that will be created next.
 */

const reversePayout = async ({
  payout,
  transaction,
  transfer,
  failureReason,
}) => {
  if (!payout?.id) {
    throw new Error("Payout is required for reversal.");
  }

  if (!payout.walletID) {
    throw new Error(`Payout ${payout.id} has no walletID.`);
  }

  if (!transaction?.id) {
    throw new Error("Payout transaction is required for reversal.");
  }

  const restorationAmount = Number(transaction.amount);

  if (!Number.isFinite(restorationAmount) || restorationAmount <= 0) {
    throw new Error(
      `Invalid payout transaction amount for reversal: ${transaction.amount}`,
    );
  }

  const reference = payout.reference;

  if (!reference) {
    throw new Error("Payout reference is required for reversal.");
  }

  const mutation = `
    mutation ReversePayout(
      $input: ReversePayoutInput!
    ) {
      reversePayout(
        input: $input
      ) {
        success

        payoutID
        transactionID
        walletID

        payoutStatus
        transactionStatus

        restoredAmount

        alreadyReversed

        message
      }
    }
  `;

  const input = {
    payoutID: payout.id,

    transactionID: transaction.id,

    walletID: payout.walletID,

    reference,

    restorationAmount,

    eventType: transfer?.event || null,

    transferCode: transfer?.transfer_code || null,

    transferID: transfer?.id != null ? String(transfer.id) : null,

    failureReason: failureReason || "Paystack transfer failed.",
  };

  console.log("REQUESTING SAFE PAYOUT REVERSAL:", {
    payoutID: payout.id,
    transactionID: transaction.id,
    walletID: payout.walletID,
    reference,
    restorationAmount,
    eventType: input.eventType,
    transferCode: input.transferCode,
    transferID: input.transferID,
    failureReason: input.failureReason,
  });

  const data = await graphqlRequest(
    mutation,
    {
      input,
    },
    "ReversePayout",
  );

  const result = data?.reversePayout || null;

  if (!result) {
    throw new Error(`reversePayout returned no result for ${reference}.`);
  }

  if (result.success !== true) {
    throw new Error(result.message || `reversePayout failed for ${reference}.`);
  }

  console.log("SAFE PAYOUT REVERSAL COMPLETED:", {
    payoutID: result.payoutID,
    transactionID: result.transactionID,
    walletID: result.walletID,
    payoutStatus: result.payoutStatus,
    transactionStatus: result.transactionStatus,
    restoredAmount: result.restoredAmount,
    alreadyReversed: result.alreadyReversed,
    message: result.message,
  });

  return result;
};

/* ==========================================================
   PROCESS PAYSTACK TRANSFER WEBHOOK
========================================================== */

/*
 * Handles:
 *
 *   transfer.success
 *   transfer.failed
 *   transfer.reversed
 *
 * Paystack's final transfer event is what determines
 * the final payout state.
 */

const processPaystackTransferWebhook = async ({ event, transfer }) => {
  if (!transfer) {
    throw new Error("Paystack transfer payload is missing.");
  }

  const reference = transfer.reference;

  if (!reference) {
    throw new Error("Paystack transfer does not contain a reference.");
  }

  console.log("PROCESSING PAYSTACK TRANSFER:", {
    event,
    reference,
    transferCode: transfer.transfer_code,
    transferID: transfer.id,
    status: transfer.status,
    amount: transfer.amount,
    currency: transfer.currency,
  });

  /* --------------------------------------------------------
     GET PAYOUT
  -------------------------------------------------------- */

  const payout = await getPayoutByReference(reference);

  if (!payout) {
    /*
     * Unknown payout references must fail rather than
     * returning 200 to Paystack.
     *
     * This allows the event to be retried.
     */

    throw new Error(
      `No Atua Payout found for Paystack transfer reference ${reference}.`,
    );
  }

  /* --------------------------------------------------------
     VALIDATE TRANSFER
  -------------------------------------------------------- */

  validatePayoutTransfer({
    payout,
    transfer,
  });

  /* --------------------------------------------------------
     GET ORIGINAL PAYOUT DEBIT TRANSACTION
  -------------------------------------------------------- */

  let transaction = await getPayoutTransactionByReference({
    reference,
    walletID: payout.walletID,
  });

  if (!transaction) {
    throw new Error(
      `No payout DEBIT transaction found for reference ${reference} and wallet ${payout.walletID}.`,
    );
  }

  /* ========================================================
     TRANSFER.SUCCESS
  ======================================================== */

  if (event === "transfer.success") {
    /*
     * If already PAID, this is a duplicate Paystack
     * webhook.
     *
     * We repair the Transaction if the earlier attempt
     * stopped after updating the Payout.
     */

    if (payout.status === "PAID") {
      console.log("PAYOUT ALREADY PAID:", {
        payoutID: payout.id,
        reference,
        transactionStatus: transaction.status,
      });

      if (transaction.status === "PENDING") {
        transaction = await updatePayoutTransactionStatus({
          transaction,
          status: "COMPLETED",
        });
      }

      if (transaction.status !== "COMPLETED") {
        throw new Error(
          `Payout ${reference} is PAID but its Transaction is ${transaction.status}.`,
        );
      }

      return {
        handled: true,
        status: "PAID",
        reference,
        alreadyProcessed: true,
      };
    }

    /*
     * A FAILED payout must never silently become PAID.
     */

    if (payout.status === "FAILED") {
      throw new Error(
        `Payout ${reference} is already FAILED but Paystack sent transfer.success. Manual reconciliation is required.`,
      );
    }

    /*
     * Mark payout PAID.
     */

    const paidPayout = await updatePayoutStatus({
      payout,
      status: "PAID",
      transferCode: transfer.transfer_code || null,
      transferID: transfer.id != null ? String(transfer.id) : null,
    });

    /*
     * Complete original debit Transaction.
     *
     * processPayouts creates it as PENDING.
     */

    if (transaction.status === "PENDING") {
      transaction = await updatePayoutTransactionStatus({
        transaction,
        status: "COMPLETED",
      });
    }

    if (transaction.status !== "COMPLETED") {
      throw new Error(
        `Payout ${paidPayout.id} was marked PAID but Transaction ${transaction.id} is ${transaction.status}.`,
      );
    }

    console.log("PAYSTACK TRANSFER SUCCESS PROCESSED:", {
      payoutID: paidPayout.id,
      reference,
      payoutStatus: paidPayout.status,
      transactionID: transaction.id,
      transactionStatus: transaction.status,
    });

    return {
      handled: true,
      status: "PAID",
      reference,
      alreadyProcessed: false,
    };
  }

  /* ========================================================
     TRANSFER.FAILED / TRANSFER.REVERSED
  ======================================================== */

  if (event === "transfer.failed" || event === "transfer.reversed") {
    /*
     * A payout already marked FAILED means the financial
     * reversal has already been processed.
     *
     * DO NOT restore the wallet again.
     */

    if (payout.status === "FAILED") {
      console.log("PAYOUT ALREADY FAILED:", {
        payoutID: payout.id,
        reference,
        transactionStatus: transaction.status,
      });

      /*
       * Repair only the Transaction if an earlier attempt
       * stopped before updating it.
       */

      if (transaction.status === "PENDING") {
        transaction = await updatePayoutTransactionStatus({
          transaction,
          status: "FAILED",
        });
      }

      if (transaction.status !== "FAILED") {
        throw new Error(
          `Payout ${reference} is FAILED but Transaction ${transaction.id} is ${transaction.status}. Manual reconciliation is required.`,
        );
      }

      return {
        handled: true,
        status: "FAILED",
        reference,
        alreadyProcessed: true,
      };
    }

    /*
     * If already PAID, do not automatically restore the
     * wallet.
     *
     * A reversal after PAID is an exceptional case requiring
     * reconciliation.
     */

    if (payout.status === "PAID") {
      throw new Error(
        `Payout ${reference} is already PAID but Paystack sent ${event}. Manual reconciliation is required.`,
      );
    }

    /*
     * Determine the Paystack failure/reversal reason.
     */

    const failureReason =
      transfer.reason ||
      transfer.failure_reason ||
      transfer.gateway_response ||
      transfer.message ||
      (event === "transfer.reversed"
        ? "Paystack transfer was reversed."
        : "Paystack transfer failed.");

    /*
     * ------------------------------------------------------
     * SAFE FINANCIAL REVERSAL
     * ------------------------------------------------------
     *
     * DO NOT directly restore the Wallet here.
     *
     * The dedicated reversePayout operation is responsible
     * for making the wallet restoration and final accounting
     * idempotent.
     */

    const reversalResult = await reversePayout({
      payout,
      transaction,
      transfer: {
        ...transfer,
        event,
      },
      failureReason,
    });

    /*
     * Refresh the Transaction state after the reversal
     * operation.
     *
     * The reversal operation itself is responsible for
     * changing it to FAILED.
     */

    transaction = await getPayoutTransactionByReference({
      reference,
      walletID: payout.walletID,
    });

    if (!transaction) {
      throw new Error(
        `Payout ${reference} reversal completed but its Transaction could not be found afterwards.`,
      );
    }

    if (transaction.status !== "FAILED") {
      throw new Error(
        `Payout ${reference} reversal completed but Transaction ${transaction.id} is ${transaction.status}.`,
      );
    }

    console.log("PAYSTACK TRANSFER FAILURE/REVERSAL PROCESSED:", {
      payoutID: payout.id,
      reference,
      event,
      payoutStatus: reversalResult.payoutStatus,
      transactionID: transaction.id,
      transactionStatus: transaction.status,
      restoredAmount: reversalResult.restoredAmount,
      alreadyReversed: reversalResult.alreadyReversed,
      failureReason,
    });

    return {
      handled: true,
      status: "FAILED",
      reference,
      alreadyProcessed: reversalResult.alreadyReversed === true,
    };
  }

  throw new Error(`Unsupported Paystack transfer event: ${event}`);
};
/* ==========================================================
   MAIN LAMBDA HANDLER
========================================================== */

exports.handler = async (event) => {
  console.log(
    "PAYSTACK WEBHOOK RECEIVED:",
    JSON.stringify(
      {
        requestId: event?.requestContext?.requestId || null,

        isBase64Encoded: event?.isBase64Encoded || false,

        hasBody: !!event?.body,

        headerKeys: Object.keys(event?.headers || {}),
      },
      null,
      2,
    ),
  );

  try {
    /* ======================================================
       GET PAYSTACK SECRET
    ====================================================== */

    const secretKey = await getPaystackSecretKey();

    /* ======================================================
       GET RAW BODY
    ====================================================== */

    /*
     * Paystack signature verification must use the original
     * raw request body.
     */

    let rawBody = event?.body;

    if (event?.isBase64Encoded && typeof rawBody === "string") {
      rawBody = Buffer.from(rawBody, "base64").toString("utf8");
    }

    if (typeof rawBody !== "string") {
      rawBody = JSON.stringify(rawBody || {});
    }

    /* ======================================================
       VERIFY PAYSTACK SIGNATURE
    ====================================================== */

    const signature = getPaystackSignature(event);

    const validSignature = verifyPaystackSignature({
      rawBody,
      signature,
      secretKey,
    });

    if (!validSignature) {
      console.error("INVALID PAYSTACK WEBHOOK SIGNATURE.");

      return httpResponse(401, {
        success: false,
        message: "Invalid webhook signature.",
      });
    }

    /* ======================================================
       PARSE PAYLOAD
    ====================================================== */

    let payload;

    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      console.error("INVALID PAYLOAD JSON:", error);

      return httpResponse(400, {
        success: false,
        message: "Invalid webhook payload.",
      });
    }

    const eventName = payload?.event;

    console.log("PAYSTACK WEBHOOK EVENT:", eventName);

    /* ======================================================
   PAYSTACK REFUND EVENTS
====================================================== */

    /*
     * These events belong to customer order refunds.
     *
     * They are completely separate from:
     *
     * - charge.success
     * - transfer.success
     * - transfer.failed
     * - transfer.reversed
     *
     * Refund processing is handled by
     * processPaystackRefundWebhook().
     */

    if (
      eventName === "refund.pending" ||
      eventName === "refund.processing" ||
      eventName === "refund.needs-attention" ||
      eventName === "refund.failed" ||
      eventName === "refund.processed"
    ) {
      const refund = payload?.data;

      if (!refund) {
        throw new Error(
          `Paystack ${eventName} webhook does not contain refund data.`,
        );
      }

      const result = await processPaystackRefundWebhook({
        event: eventName,

        refund,
      });

      return httpResponse(200, {
        success: true,

        message: "Paystack refund webhook processed.",

        result,
      });
    }

    /* ======================================================
       PAYSTACK TRANSFER EVENTS
    ====================================================== */

    /*
     * These events belong to courier payouts.
     *
     * They are handled before charge.success because
     * customer payments and courier transfers are two
     * completely different Paystack flows.
     */

    if (
      eventName === "transfer.success" ||
      eventName === "transfer.failed" ||
      eventName === "transfer.reversed"
    ) {
      const transfer = payload?.data;

      if (!transfer) {
        throw new Error(
          `Paystack ${eventName} webhook does not contain transfer data.`,
        );
      }

      const result = await processPaystackTransferWebhook({
        event: eventName,

        transfer,
      });

      return httpResponse(200, {
        success: true,

        message: "Paystack transfer webhook processed.",

        result,
      });
    }

    /* ======================================================
       CUSTOMER PAYMENT EVENTS
    ====================================================== */

    /*
     * The existing customer-payment behaviour is preserved.
     *
     * We only process charge.success here.
     *
     * Other Paystack events are acknowledged and ignored.
     */

    if (eventName !== "charge.success") {
      console.log("IGNORING PAYSTACK EVENT:", eventName);

      return httpResponse(200, {
        success: true,

        message: "Event received and ignored.",

        event: eventName || null,
      });
    }

    /* ======================================================
       CHARGE.SUCCESS
    ====================================================== */

    const transaction = payload?.data;

    if (!transaction) {
      throw new Error("Paystack charge.success transaction data is missing.");
    }

    const reference = transaction.reference;

    if (!reference) {
      throw new Error("Paystack charge.success reference is missing.");
    }

    console.log("PROCESSING CHARGE.SUCCESS:", {
      reference,

      transactionID: transaction.id,

      amount: transaction.amount,

      currency: transaction.currency,

      status: transaction.status,
    });

    /* ======================================================
       EXTRACT ORDER ID
    ====================================================== */

    const orderId = extractOrderId(transaction);

    if (!orderId) {
      throw new Error(
        `Could not determine Order ID from Paystack reference ${reference}.`,
      );
    }

    /* ======================================================
       GET ORDER
    ====================================================== */

    let order = await getOrder(orderId);

    if (!order) {
      throw new Error(`Order ${orderId} was not found.`);
    }

    if (order._deleted) {
      throw new Error(`Order ${orderId} has been deleted.`);
    }

    /* ======================================================
       VALIDATE ORDER USER
    ====================================================== */

    if (!order.userID) {
      throw new Error(`Order ${order.id} does not have userID.`);
    }

    /* ======================================================
       FIND EXISTING PAYMENT
    ====================================================== */

    let payment = await getPaymentByReference(reference);

    /* ======================================================
       CREATE PAYMENT IF NEEDED
    ====================================================== */

    if (!payment) {
      payment = await createPayment({
        order,
        transaction,
      });
    } else {
      console.log("PAYMENT ALREADY EXISTS:", {
        paymentID: payment.id,

        orderID: payment.orderID,

        reference: payment.reference,

        status: payment.status,
      });
    }

    /* ======================================================
       FINALIZE ORDER PAYMENT
    ====================================================== */

    order = await finalizePaidOrder({
      order,
      payment,
      transaction,
    });

    /* ======================================================
       VERIFY PAYMENT FINALIZATION
    ====================================================== */

    if (order.paymentStatus !== "PAID") {
      throw new Error(
        `Order ${order.id} paymentStatus is ${order.paymentStatus} after payment finalization.`,
      );
    }

    if (order.paymentID !== payment.id) {
      throw new Error(
        `Order ${order.id} paymentID does not match Payment ${payment.id}.`,
      );
    }

    if (order.userID !== payment.userID) {
      throw new Error(
        `Payment ${payment.id} userID does not match Order ${order.id} userID.`,
      );
    }

    /* ======================================================
       VERIFY DELIVERY CODE
    ====================================================== */

    if (!order.deliveryVerificationCode) {
      throw new Error(
        `Order ${order.id} is PAID but has no deliveryVerificationCode.`,
      );
    }

    /* ======================================================
       VERIFY RECIPIENT TRACKING
    ====================================================== */

    if (!order.recipientTrackingToken) {
      throw new Error(
        `Order ${order.id} is PAID but has no recipientTrackingToken.`,
      );
    }

    if (order.recipientTrackingEnabled !== true) {
      throw new Error(
        `Order ${order.id} is PAID but recipientTrackingEnabled is not true.`,
      );
    }

    /* ======================================================
       MAXI COUNT
    ====================================================== */

    /*
     * MAXI courier count is incremented only after the
     * customer payment has been successfully finalized.
     *
     * incrementMaxiCourierCount already contains its own
     * idempotency protection through maxiCountIncrementedAt.
     */

    order = await incrementMaxiCourierCount(order);

    /* ======================================================
       SAVE REUSABLE PAYSTACK CARD
    ====================================================== */

    /**
     * IMPORTANT:
     *
     * At this point the payment has already been:
     *
     * 1. Verified by Paystack
     * 2. Created/located in Atua
     * 3. Finalized on the Order
     * 4. Confirmed as PAID
     * 5. Passed all payment validation checks
     *
     * Saving the card is therefore an additional operation.
     *
     * If saving the card fails, we DO NOT fail the payment
     * webhook because the customer's payment was already
     * successful.
     */

    try {
      const authorization = transaction?.authorization;

      /**
       * Only save cards that Paystack explicitly marks as
       * reusable.
       */
      if (
        authorization &&
        authorization.reusable === true &&
        authorization.authorization_code &&
        authorization.signature
      ) {
        /**
         * Paystack normally provides the customer email here.
         *
         * We check a few possible locations so that a minor
         * Paystack payload variation does not prevent saving
         * an otherwise valid reusable authorization.
         */
        const customerEmail =
          transaction?.customer?.email ||
          transaction?.customer?.customer_email ||
          transaction?.email ||
          null;

        if (customerEmail) {
          const result = await saveReusablePaymentMethod({
            endpoint: GRAPHQL_ENDPOINT,
            region: REGION,

            userID: order.userID,

            authorization,

            email: customerEmail,

            /**
             * IMPORTANT:
             *
             * This must be the actual Paystack secret key being
             * used by this Lambda.
             *
             * paymentMethodHelper.js will determine:
             *
             * sk_test_... -> TEST
             * sk_live_... -> LIVE
             *
             * Do NOT use order.orderEnvironment here.
             *
             * order.orderEnvironment is Atua's operational
             * TEST/PRODUCTION order environment, which is
             * completely separate from Paystack TEST/LIVE.
             */
            paystackSecretKey: secretKey,
          });

          console.log("PAYMENT METHOD SAVE RESULT:", {
            orderId: order.id,
            userID: order.userID,
            saved: result?.saved,
            created: result?.created,
            reactivated: result?.reactivated || false,
            paymentMethodId: result?.paymentMethod?.id || null,
            last4: result?.paymentMethod?.last4 || null,
          });
        } else {
          console.log(
            "PAYMENT METHOD NOT SAVED: Paystack customer email unavailable.",
            {
              orderId: order.id,
            },
          );
        }
      } else {
        console.log(
          "PAYMENT METHOD NOT SAVED: No reusable Paystack authorization.",
          {
            orderId: order.id,
            hasAuthorization: !!authorization,
            reusable: authorization?.reusable,
            hasAuthorizationCode: !!authorization?.authorization_code,
            hasSignature: !!authorization?.signature,
          },
        );
      }
    } catch (paymentMethodError) {
      /**
       * IMPORTANT:
       *
       * The payment has already succeeded.
       *
       * Therefore an error while saving the reusable card
       * must NOT cause the Paystack webhook to return 500.
       *
       * The customer must still receive a successful payment.
       */
      console.error("SAVE PAYMENT METHOD ERROR:", {
        orderId: order.id,
        userID: order.userID,
        error: paymentMethodError?.message || paymentMethodError,
      });
    }

    /* ======================================================
       SUCCESS
    ====================================================== */

    console.log("PAYSTACK CHARGE.SUCCESS PROCESSED SUCCESSFULLY:", {
      orderID: order.id,

      paymentID: payment.id,

      reference,

      paymentStatus: order.paymentStatus,

      fundsStatus: order.fundsStatus,

      earningsAllocationStatus: order.earningsAllocationStatus,

      transportationType: order.transportationType,

      assignedCourierId: order.assignedCourierId,

      maxiCountIncrementedAt: order.maxiCountIncrementedAt || null,
    });

    return httpResponse(200, {
      success: true,

      message: "Payment webhook processed successfully.",

      orderID: order.id,

      paymentID: payment.id,

      reference,
    });
  } catch (error) {
    /* ======================================================
       ERROR
    ====================================================== */

    /*
     * IMPORTANT:
     *
     * Return HTTP 500 when processing fails.
     *
     * This allows Paystack to retry the webhook.
     *
     * This is especially important for payout events.
     *
     * Example:
     *
     * transfer.success
     *      |
     *      +--> Payout updated PAID
     *      |
     *      +--> Lambda fails before Transaction becomes
     *           COMPLETED
     *
     * Paystack retry
     *      |
     *      +--> sees Payout already PAID
     *      +--> repairs Transaction
     */

    console.error("PAYSTACK WEBHOOK PROCESSING ERROR:", {
      message: error?.message,

      stack: error?.stack,
    });

    return httpResponse(500, {
      success: false,

      message: error?.message || "Webhook processing failed.",
    });
  }
};
