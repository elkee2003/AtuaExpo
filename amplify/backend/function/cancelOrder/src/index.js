/**
 * ============================================================
 * ATUA - CANCEL ORDER LAMBDA
 * ============================================================
 *
 * Purpose:
 *
 * This Lambda is the backend authority for customer
 * cancellation.
 *
 * BUSINESS RULES
 * ------------------------------------------------------------
 *
 * MICRO / MOTO:
 *
 *   Can cancel ONLY when:
 *
 *     status === READY_FOR_PICKUP
 *     paymentStatus === PAID
 *
 *   A full Paystack refund is initiated.
 *
 *   There is currently NO cancellation fee.
 *
 *   No courier earnings reversal is required because
 *   Micro/Moto cancellation happens before courier acceptance.
 *
 *
 * MAXI:
 *
 *   1. BIDDING
 *
 *      - Can be cancelled.
 *      - No payment has been made.
 *      - No refund.
 *      - No courier count reversal.
 *
 *
 *   2. ACCEPTED + UNPAID
 *
 *      - This is NOT handled by cancelOrder.
 *      - It is permanently deleted through deleteOrder.
 *
 *
 *   3. ACCEPTED + PAID
 *
 *      - Can be cancelled.
 *      - Full Paystack refund.
 *      - The assigned courier's currentMaxiCount is reduced by 1.
 *      - The order is then marked CANCELLED.
 *      - Refund remains asynchronous.
 *
 *
 * IMPORTANT
 * ------------------------------------------------------------
 *
 * The mobile app must NOT directly change Order.status.
 *
 * This Lambda performs the cancellation.
 *
 * ============================================================
 */

const { SignatureV4 } = require("@aws-sdk/signature-v4");
const { HttpRequest } = require("@aws-sdk/protocol-http");
const { defaultProvider } = require("@aws-sdk/credential-provider-node");
const { Sha256 } = require("@aws-crypto/sha256-js");

/* ============================================================
   CONFIGURATION
============================================================ */

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const GRAPHQL_API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

const GRAPHQL_API_ID = process.env.API_ATUA_GRAPHQLAPIIDOUTPUT;

const REGION = process.env.REGION || "us-east-1";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

/* ============================================================
   BASIC VALIDATION
============================================================ */

if (!GRAPHQL_ENDPOINT) {
  console.error("Missing API_ATUA_GRAPHQLAPIENDPOINTOUTPUT");
}

if (!GRAPHQL_API_KEY) {
  console.error("Missing API_ATUA_GRAPHQLAPIKEYOUTPUT");
}

if (!GRAPHQL_API_ID) {
  console.error("Missing API_ATUA_GRAPHQLAPIIDOUTPUT");
}

if (!PAYSTACK_SECRET_KEY) {
  console.error("Missing PAYSTACK_SECRET_KEY");
}

/* ============================================================
   ORDER FIELDS
============================================================ */

const ORDER_FIELDS = `
  id
  userID
  transportationType
  status
  totalPrice
  paymentStatus
  paymentID
  paymentReference
  assignedCourierId
  acceptedOfferID

  cancellationStatus
  refundStatus
  cancellationFee
  refundAmount
  cancellationReason
  cancellationReasonNote
  cancellationStage
  cancellationRequestedAt
  cancellationProcessedAt
  refundReference
  refundRequestedAt
  refundedAt

  maxiCountIncrementedAt

  createdAt
  updatedAt

  _version
  _lastChangedAt
  _deleted
`;

/* ============================================================
   GRAPHQL HELPER - API KEY
============================================================ */

/**
 * Used for Order, Courier and Offer operations.
 *
 * These models already use the existing AppSync API-key
 * architecture in Atua.
 */

const graphqlRequest = async (
  query,
  variables = {},
  operationName = "AtuaCancelOrder",
) => {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error("GraphQL endpoint is not configured.");
  }

  if (!GRAPHQL_API_KEY) {
    throw new Error("GraphQL API key is not configured.");
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

  const body = await response.json();

  if (!response.ok) {
    console.error("GraphQL API-KEY HTTP ERROR:", response.status, body);

    throw new Error(
      body?.errors?.[0]?.message ||
        `GraphQL request failed with HTTP ${response.status}`,
    );
  }

  if (body.errors?.length) {
    console.error("GraphQL API-KEY ERRORS:", JSON.stringify(body.errors));

    throw new Error(body.errors[0]?.message || "GraphQL request failed.");
  }

  return body.data;
};

/* ============================================================
   GRAPHQL HELPER - IAM / SIGV4
============================================================ */

/**
 * OrderCancellation has an IAM authorization rule.
 *
 * Therefore Lambda uses its IAM execution role when
 * creating/updating/querying OrderCancellation records.
 */

const graphqlRequestIAM = async (
  query,
  variables = {},
  operationName = "AtuaCancelOrderIAM",
) => {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error("GraphQL endpoint is not configured.");
  }

  if (!REGION) {
    throw new Error("AWS REGION is not configured.");
  }

  const endpoint = new URL(GRAPHQL_ENDPOINT);

  const body = JSON.stringify({
    query,
    variables,
    operationName,
  });

  const request = new HttpRequest({
    method: "POST",

    protocol: endpoint.protocol,

    hostname: endpoint.hostname,

    path: endpoint.pathname || "/",

    headers: {
      "Content-Type": "application/json",

      host: endpoint.hostname,
    },

    body,
  });

  const signer = new SignatureV4({
    credentials: defaultProvider(),

    region: REGION,

    service: "appsync",

    sha256: Sha256,
  });

  const signedRequest = await signer.sign(request);

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",

    headers: {
      ...signedRequest.headers,
    },

    body,
  });

  const responseText = await response.text();

  let responseBody;

  try {
    responseBody = JSON.parse(responseText);
  } catch (parseError) {
    console.error("IAM GRAPHQL NON-JSON RESPONSE:", responseText);

    throw new Error("Invalid response received from AppSync.");
  }

  if (!response.ok) {
    console.error("GraphQL IAM HTTP ERROR:", response.status, responseBody);

    throw new Error(
      responseBody?.errors?.[0]?.message ||
        `IAM GraphQL request failed with HTTP ${response.status}`,
    );
  }

  if (responseBody.errors?.length) {
    console.error("GraphQL IAM ERRORS:", JSON.stringify(responseBody.errors));

    throw new Error(
      responseBody.errors[0]?.message || "IAM GraphQL request failed.",
    );
  }

  return responseBody.data;
};

/* ============================================================
   GET ORDER
============================================================ */

const getOrder = async (orderID) => {
  const query = `
    query GetOrder($id: ID!) {
      getOrder(id: $id) {
        ${ORDER_FIELDS}
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    {
      id: orderID,
    },
    "GetOrderForCancellation",
  );

  return data?.getOrder || null;
};

/* ============================================================
   GET COURIER
============================================================ */

/**
 * We only need the courier's current MAXI count and
 * AppSync version.
 */

const getCourier = async (courierID) => {
  if (!courierID) {
    return null;
  }

  const query = `
      query GetCourier($id: ID!) {
        getCourier(id: $id) {
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
      id: courierID,
    },
    "GetCourierForMaxiCancellation",
  );

  return data?.getCourier || null;
};

/* ============================================================
   UPDATE COURIER MAXI COUNT
============================================================ */

/**
 * Reverse exactly one MAXI count.
 *
 * This is only called for:
 *
 *   MAXI
 *   ACCEPTED
 *   PAID
 *
 * The cancellation record's assignmentReversed flag is used
 * as the idempotency marker.
 */

const reverseMaxiCourierCount = async (courier) => {
  if (!courier?.id) {
    throw new Error("Courier is required to reverse MAXI count.");
  }

  const currentMaxiCount = Number(courier.currentMaxiCount || 0);

  if (!Number.isFinite(currentMaxiCount) || currentMaxiCount < 0) {
    throw new Error(`Invalid currentMaxiCount for courier ${courier.id}.`);
  }

  /**
   * We should never allow the count to become negative.
   *
   * If it is already zero, something else has already
   * consumed/reversed the count.
   *
   * We leave it at zero rather than creating -1.
   */
  const nextMaxiCount = Math.max(0, currentMaxiCount - 1);

  const mutation = `
      mutation UpdateCourierMaxiCount(
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

  const input = {
    id: courier.id,
    currentMaxiCount: nextMaxiCount,
  };

  if (Number.isInteger(courier._version)) {
    input._version = courier._version;
  }

  console.log("REVERSING MAXI COURIER COUNT:", {
    courierID: courier.id,

    previousMaxiCount: currentMaxiCount,

    nextMaxiCount: nextMaxiCount,
  });

  const data = await graphqlRequest(
    mutation,
    {
      input,
    },
    "ReverseMaxiCourierCount",
  );

  const updatedCourier = data?.updateCourier || null;

  if (!updatedCourier) {
    throw new Error(
      `Courier ${courier.id} was not updated while reversing MAXI count.`,
    );
  }

  return updatedCourier;
};

/* ============================================================
   GET EXISTING CANCELLATION
============================================================ */

const getCancellation = async (cancellationID) => {
  const query = `
      query GetOrderCancellation(
        $id: ID!
      ) {
        getOrderCancellation(
          id: $id
        ) {
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
    `;

  const data = await graphqlRequestIAM(
    query,
    {
      id: cancellationID,
    },
    "GetOrderCancellation",
  );

  return data?.getOrderCancellation || null;
};

/* ============================================================
   CREATE ORDER CANCELLATION
============================================================ */

const createCancellation = async ({
  id,
  orderID,
  userID,
  courierID,
  status,
  stage,
  reason,
  reasonNote,
  originalAmount,
  cancellationFee,
  refundAmount,
  refundStatus,
  refundReference,
  paymentReference,
  cancellationRequestedAt,
  refundRequestedAt,
  courierReversed,
  courierEarningsReversed,
  walletReversed,
  assignmentReversed,
  errorMessage,
}) => {
  const mutation = `
      mutation CreateOrderCancellation(
        $input: CreateOrderCancellationInput!
      ) {
        createOrderCancellation(
          input: $input
        ) {
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
    `;

  const input = {
    id,

    orderID,

    userID,

    courierID: courierID || null,

    status,

    stage,

    reason: reason || null,

    reasonNote: reasonNote || null,

    originalAmount,

    cancellationFee,

    refundAmount,

    refundStatus,

    refundReference: refundReference || null,

    paymentReference: paymentReference || null,

    cancellationRequestedAt,

    refundRequestedAt: refundRequestedAt || null,

    courierReversed: courierReversed === true,

    courierEarningsReversed: courierEarningsReversed === true,

    walletReversed: walletReversed === true,

    assignmentReversed: assignmentReversed === true,

    errorMessage: errorMessage || null,
  };

  const data = await graphqlRequestIAM(
    mutation,
    {
      input,
    },
    "CreateOrderCancellation",
  );

  return data?.createOrderCancellation || null;
};

/* ============================================================
   UPDATE ORDER
============================================================ */

const updateOrder = async (order, fields) => {
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
    ...fields,
  };

  /**
   * DataStore-enabled models use _version for optimistic
   * concurrency.
   */
  if (order._version !== undefined && order._version !== null) {
    input._version = order._version;
  }

  const data = await graphqlRequest(
    mutation,
    {
      input,
    },
    "UpdateOrderForCancellation",
  );

  return data?.updateOrder || null;
};

/* ============================================================
   UPDATE CANCELLATION
============================================================ */

const updateCancellation = async (cancellation, fields) => {
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
    `;

  const input = {
    id: cancellation.id,
    ...fields,
  };

  /**
   * DataStore-enabled models use _version for optimistic
   * concurrency.
   */
  if (cancellation._version !== undefined && cancellation._version !== null) {
    input._version = cancellation._version;
  }

  const data = await graphqlRequestIAM(
    mutation,
    {
      input,
    },
    "UpdateOrderCancellation",
  );

  return data?.updateOrderCancellation || null;
};

/* ============================================================
   GET MAXI OFFERS
============================================================ */

/**
 * MAXI cancellation must also invalidate outstanding offers.
 *
 * This is important because a courier may have the order open
 * in the Courier app when the customer cancels.
 */

const getOffersForOrder = async (orderID) => {
  const query = `
      query ListOffersByOrder(
        $orderID: ID!
      ) {
        listOffers(
          filter: {
            orderID: {
              eq: $orderID
            }
          }
        ) {
          items {
            id
            orderID
            courierID
            senderType
            amount
            status
            _version
            _deleted
          }
        }
      }
    `;

  const data = await graphqlRequest(
    query,
    {
      orderID,
    },
    "GetOffersForCancelledMaxiOrder",
  );

  return data?.listOffers?.items || [];
};

/* ============================================================
   INVALIDATE MAXI OFFERS
============================================================ */

/**
 * Once a MAXI order is cancelled, no offer should remain
 * active against that order.
 *
 * We cancel:
 *
 *   ACTIVE
 *   ACCEPTED
 *
 * offers.
 *
 * Already REJECTED/CANCELLED offers are left untouched.
 */

const invalidateMaxiOffers = async (orderID) => {
  const offers = await getOffersForOrder(orderID);

  const cancellableOffers = offers.filter(
    (offer) =>
      !offer?._deleted &&
      (offer.status === "ACTIVE" || offer.status === "ACCEPTED"),
  );

  console.log("MAXI OFFERS TO INVALIDATE:", {
    orderID,
    count: cancellableOffers.length,
  });

  for (const offer of cancellableOffers) {
    const mutation = `
        mutation UpdateOffer(
          $input: UpdateOfferInput!
        ) {
          updateOffer(
            input: $input
          ) {
            id
            orderID
            courierID
            status
            _version
            _lastChangedAt
            _deleted
          }
        }
      `;

    const input = {
      id: offer.id,
      status: "CANCELLED",
    };

    if (Number.isInteger(offer._version)) {
      input._version = offer._version;
    }

    try {
      await graphqlRequest(
        mutation,
        {
          input,
        },
        "CancelMaxiOffer",
      );

      console.log("MAXI OFFER CANCELLED:", {
        offerID: offer.id,

        courierID: offer.courierID,

        previousStatus: offer.status,
      });
    } catch (error) {
      /**
       * A version conflict can happen if another operation
       * changed the offer at almost the same time.
       *
       * Re-read the offer and try once more only if it is
       * still ACTIVE/ACCEPTED.
       */
      console.error("FAILED TO CANCEL MAXI OFFER:", {
        offerID: offer.id,
        error: error?.message,
      });

      const retryQuery = `
          query GetOffer(
            $id: ID!
          ) {
            getOffer(id: $id) {
              id
              orderID
              courierID
              status
              _version
              _deleted
            }
          }
        `;

      const retryData = await graphqlRequest(
        retryQuery,
        {
          id: offer.id,
        },
        "RecheckMaxiOffer",
      );

      const latestOffer = retryData?.getOffer;

      if (
        latestOffer &&
        !latestOffer._deleted &&
        (latestOffer.status === "ACTIVE" || latestOffer.status === "ACCEPTED")
      ) {
        const retryInput = {
          id: latestOffer.id,

          status: "CANCELLED",
        };

        if (Number.isInteger(latestOffer._version)) {
          retryInput._version = latestOffer._version;
        }

        await graphqlRequest(
          mutation,
          {
            input: retryInput,
          },
          "RetryCancelMaxiOffer",
        );
      }
    }
  }

  /**
   * IMPORTANT:
   *
   * We do not delete Offer records.
   *
   * They remain as historical records but are no longer
   * active.
   */
  return true;
};

/* ============================================================
   PAYSTACK REFUND
============================================================ */

const initiatePaystackRefund = async ({ paymentReference, amount }) => {
  if (!PAYSTACK_SECRET_KEY) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  }

  if (!paymentReference) {
    throw new Error("Payment reference is required to initiate a refund.");
  }

  const amountInKobo = Math.round(Number(amount) * 100);

  if (!Number.isFinite(amountInKobo) || amountInKobo <= 0) {
    throw new Error(`Invalid refund amount: ${amount}`);
  }

  console.log("INITIATING PAYSTACK REFUND:", {
    paymentReference,
    amount,
    amountInKobo,
  });

  const response = await fetch("https://api.paystack.co/refund", {
    method: "POST",

    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,

      "Content-Type": "application/json",

      "Cache-Control": "no-cache",
    },

    body: JSON.stringify({
      transaction: paymentReference,

      amount: amountInKobo,
    }),
  });

  const body = await response.json();

  console.log("PAYSTACK REFUND RESPONSE:", JSON.stringify(body));

  if (!response.ok || body?.status !== true) {
    throw new Error(
      body?.message || `Paystack refund failed with HTTP ${response.status}`,
    );
  }

  const refundData = body?.data || {};

  return {
    success: true,

    message: body?.message || "Refund has been queued for processing.",

    refundID: refundData?.id != null ? String(refundData.id) : null,

    refundStatus: String(refundData?.status || "pending").toUpperCase(),

    amount:
      refundData?.amount != null
        ? Number(refundData.amount) / 100
        : Number(amount),

    transactionReference:
      refundData?.transaction?.reference || paymentReference,
  };
};

/* ============================================================
   AUTHENTICATED USER
============================================================ */

const getAuthenticatedUserID = (event) => {
  const sub = event?.identity?.sub || event?.identity?.claims?.sub;

  return sub || null;
};

/* ============================================================
   CHECK CANCELLATION ELIGIBILITY
============================================================ */

const validateCancellationEligibility = (order) => {
  const transportationType = String(
    order?.transportationType || "",
  ).toUpperCase();

  const status = String(order?.status || "").toUpperCase();

  const paymentStatus = String(order?.paymentStatus || "").toUpperCase();

  /* --------------------------------------------------------
       MICRO / MOTO
    -------------------------------------------------------- */

  const microMotoTypes = [
    "MICRO_EXPRESS",
    "MICRO_BATCH",
    "MOTO_EXPRESS",
    "MOTO_BATCH",
  ];

  if (microMotoTypes.includes(transportationType)) {
    if (status !== "READY_FOR_PICKUP") {
      return {
        allowed: false,

        message:
          "This order can no longer be cancelled because it has already moved beyond READY_FOR_PICKUP.",
      };
    }

    if (paymentStatus !== "PAID") {
      return {
        allowed: false,

        message:
          "This order cannot be cancelled because its payment has not been confirmed.",
      };
    }

    return {
      allowed: true,

      type: "MICRO_MOTO",

      stage: "BEFORE_ACCEPTANCE",

      requiresRefund: true,

      reverseMaxiCount: false,
    };
  }

  /* --------------------------------------------------------
       MAXI
    -------------------------------------------------------- */

  if (transportationType === "MAXI") {
    /* ------------------------------------------------------
         MAXI BIDDING
      ------------------------------------------------------ */

    if (status === "BIDDING") {
      return {
        allowed: true,

        type: "MAXI",

        stage: "BEFORE_ACCEPTANCE",

        requiresRefund: false,

        reverseMaxiCount: false,
      };
    }

    /* ------------------------------------------------------
         MAXI ACCEPTED + PAID
      ------------------------------------------------------ */

    if (status === "ACCEPTED" && paymentStatus === "PAID") {
      return {
        allowed: true,

        type: "MAXI",

        stage: "ACCEPTED",

        requiresRefund: true,

        reverseMaxiCount: true,
      };
    }

    /* ------------------------------------------------------
         MAXI ACCEPTED + UNPAID
      ------------------------------------------------------ */

    if (status === "ACCEPTED" && paymentStatus !== "PAID") {
      return {
        allowed: false,

        message:
          "This unpaid MAXI order should be permanently deleted instead of cancelled.",
      };
    }

    return {
      allowed: false,

      message: "This MAXI order can no longer be cancelled.",
    };
  }

  /* --------------------------------------------------------
       UNKNOWN TYPE
    -------------------------------------------------------- */

  return {
    allowed: false,

    message: "This order type cannot currently be cancelled.",
  };
};

/* ============================================================
   MAIN HANDLER
============================================================ */

exports.handler = async (event) => {
  console.log("============================================================");

  console.log("ATUA CANCEL ORDER STARTED");

  console.log("EVENT:", JSON.stringify(event));

  console.log("============================================================");

  try {
    /* ======================================================
         1. GET INPUT
      ====================================================== */

    const argumentsObject = event?.arguments || {};

    const orderID = argumentsObject?.orderID;

    const reason = argumentsObject?.reason || null;

    const reasonNote = argumentsObject?.reasonNote || null;

    if (!orderID) {
      throw new Error("orderID is required.");
    }

    /* ======================================================
         2. AUTHENTICATED USER
      ====================================================== */

    const userID = getAuthenticatedUserID(event);

    if (!userID) {
      throw new Error("Unable to identify the authenticated user.");
    }

    console.log("CANCELLATION REQUEST:", {
      orderID,
      userID,
      reason,
      reasonNote,
    });

    /* ======================================================
         3. GET LATEST ORDER
      ====================================================== */

    let order = await getOrder(orderID);

    if (!order) {
      throw new Error("Order not found.");
    }

    console.log("ORDER FOUND:", {
      id: order.id,

      userID: order.userID,

      transportationType: order.transportationType,

      status: order.status,

      paymentStatus: order.paymentStatus,

      totalPrice: order.totalPrice,

      assignedCourierId: order.assignedCourierId,

      paymentReference: order.paymentReference,

      maxiCountIncrementedAt: order.maxiCountIncrementedAt,
    });

    /* ======================================================
         4. VERIFY OWNERSHIP
      ====================================================== */

    if (order.userID !== userID) {
      throw new Error("You are not authorized to cancel this order.");
    }

    /* ======================================================
         5. CHECK ALREADY CANCELLED
      ====================================================== */

    if (order.status === "CANCELLED") {
      throw new Error("This order has already been cancelled.");
    }

    /* ======================================================
         6. DETERMINISTIC CANCELLATION ID
      ====================================================== */

    /**
     * One cancellation record per Order.
     *
     * This is important for idempotency.
     */

    const cancellationID = `cancel-${order.id}`;

    let cancellation = await getCancellation(cancellationID);

    /* ======================================================
         7. IF EXISTING CANCELLATION EXISTS
      ====================================================== */

    if (cancellation) {
      console.log("EXISTING CANCELLATION FOUND:", cancellation);

      /**
       * If the cancellation is already completed/processing,
       * do not start another Paystack refund.
       *
       * The refund webhook owns the later refund lifecycle.
       */

      if (
        cancellation.status === "COMPLETED" ||
        cancellation.status === "PROCESSING"
      ) {
        return cancellation;
      }

      /**
       * A FAILED cancellation can be retried.
       *
       * We continue below instead of creating another record.
       */
    }

    /* ======================================================
         8. VALIDATE CURRENT ORDER STATE
      ====================================================== */

    const eligibility = validateCancellationEligibility(order);

    if (!eligibility.allowed) {
      throw new Error(eligibility.message);
    }

    console.log("CANCELLATION ELIGIBILITY PASSED:", eligibility);

    /* ======================================================
         9. DETERMINE AMOUNTS
      ====================================================== */

    const originalAmount = Number(order.totalPrice || 0);

    if (!Number.isFinite(originalAmount) || originalAmount < 0) {
      throw new Error("Order has an invalid totalPrice.");
    }

    /**
     * Atua currently has no cancellation fee.
     */

    const cancellationFee = 0;

    /**
     * Paid cancellation means a FULL refund.
     */

    const refundAmount = eligibility.requiresRefund ? originalAmount : 0;

    const cancellationRequestedAt =
      cancellation?.cancellationRequestedAt || new Date().toISOString();

    /* ======================================================
         10. VALIDATE PAID REFUND CASES
      ====================================================== */

    if (eligibility.requiresRefund) {
      if (order.paymentStatus !== "PAID") {
        throw new Error(
          "This paid order cannot be cancelled because its payment has not been confirmed.",
        );
      }

      if (!order.paymentReference) {
        throw new Error(
          "This paid order cannot be refunded because its Paystack payment reference is missing.",
        );
      }

      if (refundAmount <= 0) {
        throw new Error("The refund amount must be greater than zero.");
      }
    }

    /* ======================================================
         11. CREATE CANCELLATION RECORD
      ====================================================== */

    if (!cancellation) {
      cancellation = await createCancellation({
        id: cancellationID,

        orderID: order.id,

        userID,

        /**
         * For MAXI ACCEPTED + PAID this is the assigned
         * courier whose MAXI count must be reversed.
         */
        courierID: order.assignedCourierId || null,

        status: eligibility.requiresRefund ? "PROCESSING" : "COMPLETED",

        stage: eligibility.stage,

        reason,

        reasonNote,

        originalAmount,

        cancellationFee,

        refundAmount,

        refundStatus: eligibility.requiresRefund ? "PENDING" : "NONE",

        refundReference: null,

        paymentReference: order.paymentReference || null,

        cancellationRequestedAt,

        refundRequestedAt: null,

        courierReversed: false,

        courierEarningsReversed: false,

        walletReversed: false,

        assignmentReversed: false,

        errorMessage: null,
      });

      if (!cancellation) {
        throw new Error("Failed to create cancellation record.");
      }

      console.log("CANCELLATION RECORD CREATED:", cancellation);
    }

    /* ======================================================
         12. MAXI OFFER INVALIDATION
      ====================================================== */

    /**
     * A cancelled MAXI order must never retain an ACTIVE
     * or ACCEPTED Offer.
     *
     * We perform this for BOTH:
     *
     *   MAXI BIDDING
     *   MAXI ACCEPTED + PAID
     *
     * This prevents couriers from continuing to interact
     * with the cancelled order.
     */

    if (eligibility.type === "MAXI") {
      await invalidateMaxiOffers(order.id);
    }

    /* ======================================================
         13. MAXI BIDDING
      ====================================================== */

    if (eligibility.type === "MAXI" && eligibility.requiresRefund === false) {
      /**
       * MAXI BIDDING has no payment.
       *
       * Therefore:
       *
       *   - no refund
       *   - no courier count reversal
       *   - no earnings reversal
       *
       * Just cancel the Order.
       */

      const processedAt = new Date().toISOString();

      /**
       * Re-read the Order immediately before update.
       *
       * This prevents us from blindly changing an Order whose
       * state changed while this Lambda was running.
       */

      order = await getOrder(orderID);

      if (!order) {
        throw new Error("Order no longer exists.");
      }

      if (order.userID !== userID) {
        throw new Error("You are not authorized to cancel this order.");
      }

      if (order.status !== "BIDDING") {
        throw new Error("This MAXI order is no longer in BIDDING status.");
      }

      const updatedOrder = await updateOrder(order, {
        status: "CANCELLED",

        cancellationStatus: "COMPLETED",

        refundStatus: "NONE",

        cancellationFee: 0,

        refundAmount: 0,

        cancellationReason: reason,

        cancellationReasonNote: reasonNote,

        cancellationStage: "BEFORE_ACCEPTANCE",

        cancellationRequestedAt,

        cancellationProcessedAt: processedAt,

        refundReference: null,

        refundRequestedAt: null,

        refundedAt: null,
      });

      console.log("MAXI BIDDING ORDER CANCELLED:", updatedOrder?.id);

      cancellation = await updateCancellation(cancellation, {
        status: "COMPLETED",

        refundStatus: "NONE",

        cancellationProcessedAt: processedAt,

        errorMessage: null,
      });

      console.log("MAXI BIDDING CANCELLATION COMPLETED:", cancellation);

      return cancellation;
    }

    /* ======================================================
         14. MAXI ACCEPTED + PAID
      ====================================================== */

    if (eligibility.type === "MAXI" && eligibility.reverseMaxiCount === true) {
      console.log("MAXI ACCEPTED + PAID CANCELLATION STARTED");

      /* ----------------------------------------------------
           Validate assigned courier
        ---------------------------------------------------- */

      if (!order.assignedCourierId) {
        throw new Error(
          "This paid MAXI order cannot be cancelled because no assigned courier was found.",
        );
      }

      /* ----------------------------------------------------
           Re-read cancellation
        ---------------------------------------------------- */

      cancellation = await getCancellation(cancellationID);

      if (!cancellation) {
        throw new Error("Cancellation record could not be found.");
      }

      /* ----------------------------------------------------
           Initiate refund if not already initiated
        ---------------------------------------------------- */

      if (!cancellation.refundReference) {
        console.log("MAXI PAID ORDER REQUIRES FULL REFUND.");

        let refundResult;

        try {
          refundResult = await initiatePaystackRefund({
            paymentReference: order.paymentReference,

            amount: refundAmount,
          });
        } catch (refundError) {
          console.error("MAXI PAYSTACK REFUND INITIATION FAILED:", refundError);

          cancellation = await updateCancellation(cancellation, {
            status: "FAILED",

            refundStatus: "FAILED",

            errorMessage:
              refundError?.message || "Unable to initiate Paystack refund.",
          });

          throw new Error(
            refundError?.message ||
              "Unable to initiate the refund. The order has not been cancelled.",
          );
        }

        const refundRequestedAt = new Date().toISOString();

        cancellation = await updateCancellation(cancellation, {
          status: "PROCESSING",

          refundStatus: "PENDING",

          refundReference: refundResult.refundID,

          refundRequestedAt,

          errorMessage: null,
        });

        console.log("MAXI REFUND QUEUED:", cancellation);
      }

      /* ----------------------------------------------------
           Reverse MAXI courier count
        ---------------------------------------------------- */

      if (cancellation.assignmentReversed !== true) {
        console.log("MAXI COURIER COUNT HAS NOT YET BEEN REVERSED.");

        /**
         * Re-read the courier immediately before changing it.
         */

        const courier = await getCourier(order.assignedCourierId);

        if (!courier) {
          throw new Error(
            `Assigned Courier ${order.assignedCourierId} was not found.`,
          );
        }

        /**
         * Reverse exactly one MAXI count.
         */
        await reverseMaxiCourierCount(courier);

        /**
         * Record that the assignment/capacity reversal
         * has completed.
         *
         * This prevents the normal retry path from intentionally
         * reversing it again.
         */
        cancellation = await updateCancellation(cancellation, {
          assignmentReversed: true,

          courierReversed: true,

          errorMessage: null,
        });

        console.log("MAXI COURIER COUNT SUCCESSFULLY REVERSED:", {
          orderID: order.id,

          courierID: order.assignedCourierId,

          cancellationID: cancellation.id,
        });
      }

      /* ----------------------------------------------------
           Cancel the Order
        ---------------------------------------------------- */

      /**
       * Re-read the Order one final time.
       */

      order = await getOrder(orderID);

      if (!order) {
        throw new Error("Order no longer exists.");
      }

      if (order.userID !== userID) {
        throw new Error("You are not authorized to cancel this order.");
      }

      /**
       * The only valid state here is ACCEPTED + PAID.
       */

      if (order.status !== "ACCEPTED" || order.paymentStatus !== "PAID") {
        /**
         * If the order has already become CANCELLED,
         * treat the operation as already completed.
         */
        if (order.status === "CANCELLED") {
          return cancellation;
        }

        throw new Error(
          "This MAXI order changed state before cancellation could be completed.",
        );
      }

      const processedAt = new Date().toISOString();

      const updatedOrder = await updateOrder(order, {
        status: "CANCELLED",

        cancellationStatus: "PROCESSING",

        refundStatus: "PENDING",

        cancellationFee: 0,

        refundAmount: refundAmount,

        cancellationReason: reason,

        cancellationReasonNote: reasonNote,

        cancellationStage: "ACCEPTED",

        cancellationRequestedAt,

        cancellationProcessedAt: null,

        refundReference: cancellation.refundReference || null,

        refundRequestedAt: cancellation.refundRequestedAt || null,

        refundedAt: null,
      });

      console.log("MAXI ACCEPTED + PAID ORDER CANCELLED:", {
        orderID: updatedOrder?.id,

        status: updatedOrder?.status,

        cancellationStatus: updatedOrder?.cancellationStatus,

        refundStatus: updatedOrder?.refundStatus,

        refundReference: updatedOrder?.refundReference,
      });

      /* ----------------------------------------------------
           Final cancellation record update
        ---------------------------------------------------- */

      cancellation = await updateCancellation(cancellation, {
        status: "PROCESSING",

        refundStatus: "PENDING",

        cancellationProcessedAt: null,

        errorMessage: null,
      });

      console.log("MAXI ACCEPTED + PAID CANCELLATION COMPLETED:", cancellation);

      return cancellation;
    }

    /* ======================================================
         15. MICRO / MOTO REFUND
      ====================================================== */

    console.log("MICRO/MOTO ORDER REQUIRES REFUND.");

    /**
     * Re-read cancellation.
     */

    cancellation = await getCancellation(cancellationID);

    if (!cancellation) {
      throw new Error("Cancellation record could not be found.");
    }

    /* ------------------------------------------------------
         Initiate Paystack refund
      ------------------------------------------------------ */

    if (!cancellation.refundReference) {
      let refundResult;

      try {
        refundResult = await initiatePaystackRefund({
          paymentReference: order.paymentReference,

          amount: refundAmount,
        });
      } catch (refundError) {
        console.error("PAYSTACK REFUND INITIATION FAILED:", refundError);

        cancellation = await updateCancellation(cancellation, {
          status: "FAILED",

          refundStatus: "FAILED",

          errorMessage:
            refundError?.message || "Unable to initiate Paystack refund.",
        });

        throw new Error(
          refundError?.message ||
            "Unable to initiate the refund. The order has not been cancelled.",
        );
      }

      const refundRequestedAt = new Date().toISOString();

      cancellation = await updateCancellation(cancellation, {
        status: "PROCESSING",

        refundStatus: "PENDING",

        refundReference: refundResult.refundID,

        refundRequestedAt,

        errorMessage: null,
      });

      console.log("MICRO/MOTO REFUND QUEUED:", cancellation);
    }

    /* ======================================================
         16. CANCEL MICRO/MOTO ORDER
      ====================================================== */

    order = await getOrder(orderID);

    if (!order) {
      throw new Error("Order no longer exists.");
    }

    if (order.userID !== userID) {
      throw new Error("You are not authorized to cancel this order.");
    }

    if (order.status === "CANCELLED") {
      return cancellation;
    }

    if (order.status !== "READY_FOR_PICKUP" || order.paymentStatus !== "PAID") {
      throw new Error(
        "This order changed state before cancellation could be completed.",
      );
    }

    const updatedOrder = await updateOrder(order, {
      status: "CANCELLED",

      cancellationStatus: "PROCESSING",

      refundStatus: "PENDING",

      cancellationFee: 0,

      refundAmount: refundAmount,

      cancellationReason: reason,

      cancellationReasonNote: reasonNote,

      cancellationStage: "BEFORE_ACCEPTANCE",

      cancellationRequestedAt,

      cancellationProcessedAt: null,

      refundReference: cancellation.refundReference || null,

      refundRequestedAt: cancellation.refundRequestedAt || null,

      refundedAt: null,
    });

    console.log("MICRO/MOTO ORDER CANCELLED:", {
      orderID: updatedOrder?.id,

      status: updatedOrder?.status,

      cancellationStatus: updatedOrder?.cancellationStatus,

      refundStatus: updatedOrder?.refundStatus,

      refundReference: updatedOrder?.refundReference,
    });

    /* ======================================================
         17. FINAL MICRO/MOTO CANCELLATION UPDATE
      ====================================================== */

    cancellation = await updateCancellation(cancellation, {
      status: "PROCESSING",

      refundStatus: "PENDING",

      cancellationProcessedAt: null,

      errorMessage: null,
    });

    /* ======================================================
         18. FINISHED
      ====================================================== */

    console.log("============================================================");

    console.log("ATUA CANCEL ORDER FINISHED SUCCESSFULLY");

    console.log("============================================================");

    return cancellation;
  } catch (error) {
    console.error(
      "============================================================",
    );

    console.error("ATUA CANCEL ORDER ERROR");

    console.error(error);

    console.error(
      "============================================================",
    );

    throw new Error(error?.message || "Unable to cancel order.");
  }
};
