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

  if (
    order.paymentStatus === "PAID" &&
    order.paymentID === payment.id &&
    order.paymentReference === transaction.reference
  ) {
    console.log("ORDER ALREADY FINALIZED AS PAID:", {
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

  const input = {
    id: order.id,

    paymentStatus: "PAID",

    paymentID: payment.id,

    paymentReference: transaction.reference,

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

/* ==========================================================
   EXTRACT ORDER ID
========================================================== */

/*
 * Paystack references used by Atua can contain the Order ID.
 *
 * This helper keeps the extraction logic in one place.
 */

const extractOrderId = (transaction) => {
  if (!transaction) {
    return null;
  }

  /*
   * Metadata is the preferred source where available.
   */
  const metadata = transaction.metadata;

  if (metadata && typeof metadata === "object") {
    if (typeof metadata.orderID === "string" && metadata.orderID) {
      return metadata.orderID;
    }

    if (typeof metadata.orderId === "string" && metadata.orderId) {
      return metadata.orderId;
    }

    if (typeof metadata.order_id === "string" && metadata.order_id) {
      return metadata.order_id;
    }
  }

  /*
   * Also support the existing reference format.
   *
   * The original webhook uses the reference as a
   * fallback source for locating the Order.
   */
  const reference = transaction.reference;

  if (typeof reference === "string" && reference) {
    /*
     * If the reference itself is an Order ID,
     * return it.
     */
    return reference;
  }

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
