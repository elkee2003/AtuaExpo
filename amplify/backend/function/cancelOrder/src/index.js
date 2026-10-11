/**
 * ============================================================
 * ATUA - CANCEL ORDER LAMBDA
 * ============================================================
 *
 * BUSINESS RULES
 * ------------------------------------------------------------
 *
 * MICRO / MOTO:
 *   Can cancel ONLY when:
 *     status === READY_FOR_PICKUP
 *     paymentStatus === PAID
 *
 *   Full Paystack refund.
 *   No cancellation fee.
 *   No courier earnings reversal.
 *
 *
 * MAXI:
 *
 *   BIDDING:
 *     - Can be cancelled.
 *     - No payment.
 *     - No refund.
 *     - No courier count reversal.
 *
 *   ACCEPTED + UNPAID:
 *     - NOT handled here.
 *     - Permanently deleted through deleteOrder.
 *
 *   ACCEPTED + PAID:
 *     - Can be cancelled.
 *     - Full Paystack refund.
 *     - Assigned courier MAXI count decreases by 1.
 *     - Order becomes CANCELLED.
 *
 * ============================================================
 */

const { SignatureV4 } = require("@aws-sdk/signature-v4");

const { HttpRequest } = require("@aws-sdk/protocol-http");

const { defaultProvider } = require("@aws-sdk/credential-provider-node");

const { Sha256 } = require("@aws-crypto/sha256-js");

const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

/* ============================================================
   CONFIGURATION
============================================================ */

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const GRAPHQL_API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

const GRAPHQL_API_ID = process.env.API_ATUA_GRAPHQLAPIIDOUTPUT;

const REGION = process.env.REGION || process.env.AWS_REGION || "eu-north-1";

const PAYSTACK_SECRET_PARAMETER = process.env.PAYSTACK_SECRET_KEY;

const ssmClient = new SSMClient({
  region: REGION,
});

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

if (!PAYSTACK_SECRET_PARAMETER) {
  console.error("Missing PAYSTACK_SECRET_KEY SSM parameter name.");
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
  courierEarnings
  earningsAllocationStatus

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
 * Used for:
 *
 *   Order
 *   Courier
 *   Offer
 *
 * operations.
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
 * OrderCancellation uses IAM authorization.
 *
 * Therefore Lambda uses its IAM execution role for
 * OrderCancellation operations.
 */

const graphqlRequestIAM = async (
  query,
  variables = {},
  operationName = "AtuaCancelOrderIAM",
) => {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error("GraphQL endpoint is not configured.");
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
  } catch (error) {
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
      responseBody.errors[0]?.message || "GraphQL IAM request failed.",
    );
  }

  return responseBody.data;
};

/* ============================================================
   GET ORDER
============================================================ */

const getOrder = async (orderID) => {
  const query = `
    query GetOrderForCancellation($id: ID!) {
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

const getCourier = async (courierID) => {
  if (!courierID) {
    return null;
  }

  const query = `
    query GetCourierForMaxiCancellation($id: ID!) {
      getCourier(id: $id) {
        id
        currentMaxiCount
        walletID
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
   GET COURIER WALLET
============================================================ */

const getCourierWallet = async (walletID) => {
  if (!walletID) {
    throw new Error("Courier walletID is missing.");
  }

  const query = `
    query GetWalletForCourierEarningsReversal($id: ID!) {
      getWallet(id: $id) {
        id
        pendingBalance
        lifetimeEarnings
        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    { id: walletID },
    "GetWalletForCourierEarningsReversal",
  );

  const wallet = data?.getWallet || null;

  if (!wallet || wallet._deleted) {
    throw new Error(`Wallet ${walletID} was not found.`);
  }

  return wallet;
};

/* ============================================================
   REVERSE MAXI COURIER EARNINGS
============================================================ */

const reverseMaxiCourierEarnings = async (courier, order) => {
  const earnings = Number(order.courierEarnings || 0);

  if (!Number.isFinite(earnings) || earnings < 0) {
    throw new Error("Invalid courierEarnings on the order.");
  }

  // Nothing to reverse if the order has no courier earnings.
  if (earnings === 0) {
    return { reversed: true, amount: 0 };
  }

  if (!courier?.walletID) {
    throw new Error(`Courier ${courier?.id} has no walletID.`);
  }

  const wallet = await getCourierWallet(courier.walletID);

  const pendingBalance = Number(wallet.pendingBalance || 0);
  const lifetimeEarnings = Number(wallet.lifetimeEarnings || 0);

  if (
    !Number.isFinite(pendingBalance) ||
    !Number.isFinite(lifetimeEarnings) ||
    pendingBalance < earnings ||
    lifetimeEarnings < earnings
  ) {
    throw new Error(
      `Cannot reverse earnings for order ${order.id}: ` +
        `wallet balances are insufficient. ` +
        `pendingBalance=${pendingBalance}, ` +
        `lifetimeEarnings=${lifetimeEarnings}, ` +
        `earnings=${earnings}.`,
    );
  }

  const input = {
    id: wallet.id,
    pendingBalance: Number((pendingBalance - earnings).toFixed(2)),
    lifetimeEarnings: Number((lifetimeEarnings - earnings).toFixed(2)),
  };

  if (Number.isInteger(wallet._version)) {
    input._version = wallet._version;
  }

  const mutation = `
    mutation ReverseMaxiCourierEarnings(
      $input: UpdateWalletInput!
    ) {
      updateWallet(input: $input) {
        id
        pendingBalance
        lifetimeEarnings
        _version
      }
    }
  `;

  const data = await graphqlRequest(
    mutation,
    { input },
    "ReverseMaxiCourierEarnings",
  );

  const updatedWallet = data?.updateWallet;

  if (!updatedWallet) {
    throw new Error(`Failed to reverse earnings for wallet ${wallet.id}.`);
  }

  console.log("MAXI COURIER EARNINGS REVERSED:", {
    orderID: order.id,
    courierID: courier.id,
    walletID: wallet.id,
    earningsReversed: earnings,
    previousPendingBalance: pendingBalance,
    newPendingBalance: updatedWallet.pendingBalance,
    previousLifetimeEarnings: lifetimeEarnings,
    newLifetimeEarnings: updatedWallet.lifetimeEarnings,
  });

  return {
    reversed: true,
    amount: earnings,
    wallet: updatedWallet,
  };
};

/* ============================================================
   REVERSE MAXI COURIER COUNT
============================================================ */

/**
 * Decreases currentMaxiCount by exactly 1.
 *
 * The cancellation record's assignmentReversed flag
 * prevents the normal retry path from intentionally
 * performing this operation twice.
 */

const reverseMaxiCourierCount = async (courier) => {
  if (!courier?.id) {
    throw new Error("Courier is required to reverse MAXI count.");
  }

  const currentMaxiCount = Number(courier.currentMaxiCount || 0);

  if (!Number.isFinite(currentMaxiCount) || currentMaxiCount < 0) {
    throw new Error(`Invalid currentMaxiCount for courier ${courier.id}.`);
  }

  const nextMaxiCount = Math.max(0, currentMaxiCount - 1);

  const mutation = `
      mutation ReverseMaxiCourierCount(
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
      mutation UpdateOrderForCancellation(
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

const getOffersForOrder = async (orderID) => {
  const query = `
      query GetOffersForCancelledMaxiOrder(
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
            _lastChangedAt
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

  const mutation = `
      mutation CancelMaxiOffer(
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

  for (const offer of cancellableOffers) {
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
      console.error("FAILED TO CANCEL MAXI OFFER:", {
        offerID: offer.id,
        error: error?.message,
      });

      /*
       * Re-read the offer in case
       * a version conflict occurred.
       */

      const retryQuery = `
          query RecheckMaxiOffer(
            $id: ID!
          ) {
            getOffer(id: $id) {
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
          "CancelMaxiOffer",
        );
      }
    }
  }

  return true;
};

/* ============================================================
   GET PAYSTACK SECRET FROM AWS SSM
============================================================ */

/*
 * The Lambda environment variable PAYSTACK_SECRET_KEY contains
 * the NAME/PATH of the SSM parameter, not the actual secret.
 *
 * Example:
 *
 * PAYSTACK_SECRET_KEY =
 * /amplify/d4d2e6dwzso4a/staging/AMPLIFY_cancelOrder_PAYSTACK_SECRET_KEY
 *
 * This function retrieves the actual decrypted Paystack secret
 * from AWS Systems Manager Parameter Store.
 *
 * IMPORTANT:
 * Never log the actual secret.
 */
const getPaystackSecretKey = async () => {
  const parameterName = PAYSTACK_SECRET_PARAMETER;

  if (!parameterName) {
    throw new Error(
      "PAYSTACK_SECRET_KEY SSM parameter name is not configured.",
    );
  }

  console.log("RETRIEVING PAYSTACK SECRET FROM SSM:", parameterName);

  const result = await ssmClient.send(
    new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true,
    }),
  );

  const secretKey = result?.Parameter?.Value;

  if (!secretKey) {
    throw new Error(
      `Paystack secret could not be retrieved from SSM parameter: ${parameterName}`,
    );
  }

  /*
   * Do NOT log secretKey.
   */
  return secretKey.trim();
};

/* ============================================================
   PAYSTACK REFUND
============================================================ */

/*
 * Paystack refunds are asynchronous.
 *
 * This function only INITIATES the refund.
 *
 * The Paystack refund webhook is responsible for
 * the later refund lifecycle.
 */
const initiatePaystackRefund = async ({ paymentReference, amount }) => {
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

  /*
   * IMPORTANT:
   *
   * Retrieve the REAL Paystack secret from AWS SSM.
   *
   * process.env.PAYSTACK_SECRET_KEY contains the SSM
   * parameter name/path, NOT the actual Paystack key.
   */
  const paystackSecretKey = await getPaystackSecretKey();

  /*
   * Never log paystackSecretKey.
   */

  const response = await fetch("https://api.paystack.co/refund", {
    method: "POST",

    headers: {
      Authorization: `Bearer ${paystackSecretKey}`,

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
   GET COGNITO SUB
============================================================ */

const getAuthenticatedCognitoSub = (event) => {
  const identity = event?.identity;

  const cognitoSub =
    identity?.sub || identity?.claims?.sub || identity?.username || null;

  return cognitoSub;
};

/**
 * Resolve the Atua User record from the authenticated
 * Cognito user's `sub`.
 *
 * IMPORTANT:
 * - Cognito identity.sub = User.sub
 * - Order.userID = User.id
 *
 * We must NOT compare Cognito sub directly to Order.userID.
 */
const getUserByCognitoSub = async (cognitoSub) => {
  const query = /* GraphQL */ `
    query GetAtuaUserBySub($filter: ModelUserFilterInput) {
      listUsers(filter: $filter, limit: 1) {
        items {
          id
          sub
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
        sub: {
          eq: cognitoSub,
        },
      },
    },
    "GetAtuaUserBySub",
  );

  const users = data?.listUsers?.items || [];

  if (users.length === 0) {
    throw new Error("Unable to resolve your Atua User account.");
  }

  return users[0];
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
   2. GET AUTHENTICATED COGNITO USER
====================================================== */

    const cognitoSub = getAuthenticatedCognitoSub(event);

    if (!cognitoSub) {
      throw new Error("Unable to identify the authenticated user.");
    }

    console.log("Authenticated Cognito sub:", cognitoSub);

    /* ======================================================
   3. RESOLVE ATUA USER
====================================================== */

    const user = await getUserByCognitoSub(cognitoSub);

    if (!user?.id) {
      throw new Error("Your Atua user account could not be found.");
    }

    const userID = user.id;

    console.log("Resolved Atua User:", {
      cognitoSub,
      atuaUserID: userID,
    });

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
         5. DETERMINISTIC CANCELLATION ID
      ====================================================== */

    const cancellationID = `cancel-${order.id}`;

    let cancellation = await getCancellation(cancellationID);

    /* ======================================================
         6. ALREADY CANCELLED
      ====================================================== */

    if (order.status === "CANCELLED") {
      /*
       * If the order is already cancelled and
       * we have its cancellation record,
       * simply return that record.
       *
       * This is important for retries.
       */

      if (cancellation) {
        return cancellation;
      }

      throw new Error("This order has already been cancelled.");
    }

    /* ======================================================
         7. VALIDATE CURRENT ORDER STATE
      ====================================================== */

    const eligibility = validateCancellationEligibility(order);

    if (!eligibility.allowed) {
      throw new Error(eligibility.message);
    }

    console.log("CANCELLATION ELIGIBILITY PASSED:", eligibility);

    /* ======================================================
         8. DETERMINE AMOUNTS
      ====================================================== */

    const originalAmount = Number(order.totalPrice || 0);

    if (!Number.isFinite(originalAmount) || originalAmount < 0) {
      throw new Error("Order has an invalid totalPrice.");
    }

    const cancellationFee = 0;

    const refundAmount = eligibility.requiresRefund ? originalAmount : 0;

    const cancellationRequestedAt =
      cancellation?.cancellationRequestedAt || new Date().toISOString();

    /* ======================================================
         9. VALIDATE REFUND CASE
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
         10. CREATE CANCELLATION RECORD
      ====================================================== */

    if (!cancellation) {
      cancellation = await createCancellation({
        id: cancellationID,

        orderID: order.id,

        userID,

        courierID: order.assignedCourierId || null,

        /*
         * Paid cancellation starts PROCESSING
         * because the Paystack refund is asynchronous.
         *
         * MAXI BIDDING can immediately complete.
         */

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
         IMPORTANT RETRY BEHAVIOUR
      ====================================================== */

    /*
     * DO NOT return simply because the cancellation is
     * PROCESSING.
     *
     * PROCESSING can mean the previous Lambda execution
     * stopped before completing all required operations.
     *
     * We therefore continue from the current durable state.
     */

    /* ======================================================
         11. MAXI OFFER INVALIDATION
      ====================================================== */

    if (eligibility.type === "MAXI") {
      await invalidateMaxiOffers(order.id);
    }

    /* ======================================================
         12. MAXI BIDDING
      ====================================================== */

    if (eligibility.type === "MAXI" && eligibility.requiresRefund === false) {
      order = await getOrder(orderID);

      if (!order) {
        throw new Error("Order no longer exists.");
      }

      if (order.userID !== userID) {
        throw new Error("You are not authorized to cancel this order.");
      }

      if (order.status !== "BIDDING") {
        /*
         * If another retry already cancelled
         * it, return the existing record.
         */

        if (order.status === "CANCELLED") {
          return cancellation;
        }

        throw new Error("This MAXI order is no longer in BIDDING status.");
      }

      const processedAt = new Date().toISOString();

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
         13. MAXI ACCEPTED + PAID
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
           INITIATE REFUND
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
           REVERSE MAXI COURIER COUNT
        ---------------------------------------------------- */

      if (cancellation.assignmentReversed !== true) {
        console.log("MAXI COURIER COUNT HAS NOT YET BEEN REVERSED.");

        const courier = await getCourier(order.assignedCourierId);

        if (!courier) {
          throw new Error(
            `Assigned Courier ${order.assignedCourierId} was not found.`,
          );
        }

        /*
         * Reverse exactly one MAXI count.
         */

        await reverseMaxiCourierCount(courier);

        /*
         * IMPORTANT:
         *
         * Mark the cancellation record only
         * AFTER the courier update succeeds.
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
     REVERSE MAXI COURIER EARNINGS
---------------------------------------------------- */

      if (cancellation.courierEarningsReversed !== true) {
        const allocationStatus = String(
          order.earningsAllocationStatus || "NOT_ALLOCATED",
        ).toUpperCase();

        if (allocationStatus === "PROCESSING") {
          throw new Error(
            "Courier earnings allocation is still processing. " +
              "Retry the cancellation after allocation finishes.",
          );
        }

        if (allocationStatus === "ALLOCATED") {
          const courier = await getCourier(order.assignedCourierId);

          if (!courier) {
            throw new Error(
              `Assigned Courier ${order.assignedCourierId} was not found.`,
            );
          }

          await reverseMaxiCourierEarnings(courier, order);

          console.log("MAXI COURIER EARNINGS REVERSAL SUCCEEDED:", {
            orderID: order.id,
            courierID: courier.id,
            courierEarnings: order.courierEarnings,
          });
        } else {
          // No successful earnings allocation exists to reverse.
          console.log("NO ALLOCATED EARNINGS TO REVERSE:", {
            orderID: order.id,
            allocationStatus,
          });
        }

        // Mark handled only after the wallet operation succeeds,
        // or after confirming there is no allocation to reverse.
        cancellation = await updateCancellation(cancellation, {
          courierEarningsReversed: true,
          errorMessage: null,
        });
      }

      /* ----------------------------------------------------
           FINAL ORDER RE-READ
        ---------------------------------------------------- */

      order = await getOrder(orderID);

      if (!order) {
        throw new Error("Order no longer exists.");
      }

      if (order.userID !== userID) {
        throw new Error("You are not authorized to cancel this order.");
      }

      /* ----------------------------------------------------
           CHECK STATE BEFORE CANCELLING
        ---------------------------------------------------- */

      if (order.status !== "ACCEPTED" || order.paymentStatus !== "PAID") {
        if (order.status === "CANCELLED") {
          return cancellation;
        }

        throw new Error(
          "This MAXI order changed state before cancellation could be completed.",
        );
      }

      /* ----------------------------------------------------
           CANCEL ORDER
        ---------------------------------------------------- */

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
           FINAL CANCELLATION RECORD UPDATE
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
         14. MICRO / MOTO
      ====================================================== */

    console.log("MICRO/MOTO ORDER REQUIRES REFUND.");

    cancellation = await getCancellation(cancellationID);

    if (!cancellation) {
      throw new Error("Cancellation record could not be found.");
    }

    /* ------------------------------------------------------
         INITIATE REFUND
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
         15. RE-READ MICRO/MOTO ORDER
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

    /* ======================================================
         16. CANCEL MICRO/MOTO ORDER
      ====================================================== */

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
         17. FINAL CANCELLATION RECORD UPDATE
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
