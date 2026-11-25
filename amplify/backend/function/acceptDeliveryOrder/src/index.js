// Note that this lambda has not been connected to the frontend yet, but the necessary code has been put in the schema

const crypto = require("crypto");
const { defaultProvider } = require("@aws-sdk/credential-provider-node");

const awsCredentialProvider = defaultProvider();

// ============================================================
// CONFIGURATION
// ============================================================

const MAX_ACTIVE_BATCH_ORDERS = 10;
const VAT_RATE = 0.075;
const MAX_COURIER_UPDATE_ATTEMPTS = 3;

// Maxi financial configuration copied from Atua PRICING_CONFIG.
// Only commissionRate and platformFee are required here.

const MAXI_PRICING = {
  CAR: { commissionRate: 0.17, platformFee: 650 },
  WAGON: { commissionRate: 0.17, platformFee: 700 },
  MINIBUS: { commissionRate: 0.18, platformFee: 950 },
  PICKUP: { commissionRate: 0.19, platformFee: 1000 },
  SMALL_VAN: { commissionRate: 0.2, platformFee: 1200 },
  MEDIUM_VAN: { commissionRate: 0.2, platformFee: 1300 },
  LARGE_VAN: { commissionRate: 0.21, platformFee: 1500 },
  TRUCK_5T: { commissionRate: 0.22, platformFee: 2000 },
  FLATBED_5T: { commissionRate: 0.22, platformFee: 2150 },
  TIPPER_5T: { commissionRate: 0.22, platformFee: 2200 },
  TRUCK_10T: { commissionRate: 0.23, platformFee: 2300 },
  FLATBED_10T: { commissionRate: 0.23, platformFee: 2500 },
  TIPPER_10T: { commissionRate: 0.23, platformFee: 2500 },
  REFRIGERATED_5T: { commissionRate: 0.23, platformFee: 2400 },
  REFRIGERATED_10T: { commissionRate: 0.24, platformFee: 2500 },
};

// ============================================================
// APPSYNC IAM REQUEST SIGNING
// ============================================================

function hmac(key, value, encoding) {
  return crypto
    .createHmac("sha256", key)
    .update(value, "utf8")
    .digest(encoding);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function getSigningKey(secret, date, region) {
  const kDate = hmac(`AWS4${secret}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "appsync");
  return hmac(kService, "aws4_request");
}

async function appsyncRequest(query, variables = {}) {
  const endpoint = process.env.APPSYNC_API_URL;

  if (!endpoint) {
    throw new Error("Missing APPSYNC_API_URL environment variable.");
  }

  const url = new URL(endpoint);
  const region = process.env.REGION || process.env.AWS_REGION;

  if (!region) {
    throw new Error("AWS region could not be determined.");
  }

  // Use the Lambda execution role's temporary credentials.
  // Do not store AWS access keys in Lambda environment variables.
  const credentials = await awsCredentialProvider();

  const accessKeyId = credentials.accessKeyId;
  const secretAccessKey = credentials.secretAccessKey;
  const sessionToken = credentials.sessionToken;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Lambda execution-role credentials are unavailable.");
  }

  const body = JSON.stringify({ query, variables });

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = sha256(body);

  const headers = {
    "content-type": "application/json",
    host: url.host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
  };

  if (sessionToken) {
    headers["x-amz-security-token"] = sessionToken;
  }

  const signedHeaderNames = Object.keys(headers)
    .map((key) => key.toLowerCase())
    .sort();

  const canonicalHeaders =
    signedHeaderNames.map((key) => `${key}:${headers[key]}`).join("\n") + "\n";

  const signedHeaders = signedHeaderNames.join(";");

  const canonicalRequest = [
    "POST",
    url.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/appsync/aws4_request`;

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const signingKey = getSigningKey(secretAccessKey, dateStamp, region);

  const signature = hmac(signingKey, stringToSign, "hex");

  headers.Authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body,
  });

  const result = await response.json();

  if (!response.ok || result.errors?.length) {
    console.error("AppSync error:", JSON.stringify(result.errors || result));

    throw new Error(result.errors?.[0]?.message || "AppSync request failed.");
  }

  return result.data;
}

// ============================================================
// GRAPHQL OPERATIONS
// ============================================================

const GET_COURIER_BY_SUB = `
  query GetCourierBySub($sub: String!) {
    couriersBySub(sub: $sub, limit: 2) {
      items {
        id
        sub
        transportationType
        vehicleClass
        isOnline
        isBlocked
        isApproved
        debtRestrictionActive
        currentBatchCount
        currentExpressCount
        currentMaxiCount
        lastBatchAssignedAt
        _version
      }
    }
  }
`;

const GET_COURIER = `
  query GetCourier($id: ID!) {
    getCourier(id: $id) {
      id
      sub
      transportationType
      vehicleClass
      isOnline
      isBlocked
      isApproved
      debtRestrictionActive
      currentBatchCount
      currentExpressCount
      currentMaxiCount
      lastBatchAssignedAt
      _version
    }
  }
`;

const GET_ORDER = `
  query GetOrder($id: ID!) {
    getOrder(id: $id) {
      id
      status
      transportationType
      vehicleClass
      paymentStatus
      paymentResponsibility
      paymentTiming
      assignedCourierId
      acceptedOfferID
      acceptedAt
      assignmentStatus
      hasNewOffer
      operationalFare
      courierEarnings
      commissionAmount
      platformFee
      platformServiceRevenue
      vatAmount
      platformNetRevenue
      totalPrice
      _version
    }
  }
`;

const GET_OFFERS = `
  query OffersByOrder($orderID: ID!) {
    offersByOrder(orderID: $orderID, limit: 1000) {
      items {
        id
        orderID
        senderType
        amount
        status
        createdAt
        _version
      }
    }
  }
`;

const UPDATE_ORDER = `
  mutation UpdateOrder(
    $input: UpdateOrderInput!
    $condition: ModelOrderConditionInput
  ) {
    updateOrder(input: $input, condition: $condition) {
      id
      status
      assignedCourierId
      acceptedOfferID
      acceptedAt
      _version
    }
  }
`;

const UPDATE_COURIER = `
  mutation UpdateCourier(
    $input: UpdateCourierInput!
    $condition: ModelCourierConditionInput
  ) {
    updateCourier(input: $input, condition: $condition) {
      id
      currentBatchCount
      currentExpressCount
      currentMaxiCount
      lastBatchAssignedAt
      _version
    }
  }
`;

const UPDATE_OFFER = `
  mutation UpdateOffer(
    $input: UpdateOfferInput!
    $condition: ModelOfferConditionInput
  ) {
    updateOffer(input: $input, condition: $condition) {
      id
      status
      _version
    }
  }
`;

// ============================================================
// DATA HELPERS
// ============================================================

async function getCourierBySub(sub) {
  const data = await appsyncRequest(GET_COURIER_BY_SUB, { sub });
  const items = data.couriersBySub?.items || [];

  if (items.length !== 1) {
    return null;
  }

  return items[0];
}

async function getCourier(id) {
  const data = await appsyncRequest(GET_COURIER, { id });
  return data.getCourier;
}

async function getOrder(id) {
  const data = await appsyncRequest(GET_ORDER, { id });
  return data.getOrder;
}

async function getLatestOffer(orderId) {
  const data = await appsyncRequest(GET_OFFERS, {
    orderID: orderId,
  });

  const offers = data.offersByOrder?.items || [];

  return (
    offers.sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime(),
    )[0] || null
  );
}

// ============================================================
// COURIER ELIGIBILITY
// ============================================================

function validateCourier(courier) {
  if (!courier) {
    return "Courier information could not be found.";
  }

  if (courier.isOnline !== true) {
    return "You must be online to accept deliveries.";
  }

  if (courier.isApproved !== true) {
    return "Your courier account has not been approved.";
  }

  if (courier.isBlocked === true) {
    return "Your courier account is blocked.";
  }

  if (courier.debtRestrictionActive === true) {
    return "You must settle your outstanding Atua debt before accepting deliveries.";
  }

  return null;
}

function getServiceCategory(orderType) {
  if (orderType === "MICRO_EXPRESS" || orderType === "MOTO_EXPRESS") {
    return "EXPRESS";
  }

  if (orderType === "MICRO_BATCH" || orderType === "MOTO_BATCH") {
    return "BATCH";
  }

  if (orderType === "MAXI") {
    return "MAXI";
  }

  return null;
}

function validateServiceCompatibility(courier, order) {
  const type = order.transportationType;

  if (type === "MICRO_EXPRESS" || type === "MICRO_BATCH") {
    if (courier.transportationType !== "MICRO") {
      return "This delivery is only available to Micro couriers.";
    }
  }

  if (type === "MOTO_EXPRESS" || type === "MOTO_BATCH") {
    if (courier.transportationType !== "MOTO") {
      return "This delivery is only available to Moto couriers.";
    }
  }

  if (type === "MAXI") {
    if (!order.vehicleClass || courier.vehicleClass !== order.vehicleClass) {
      return "Your registered vehicle does not match this Maxi delivery.";
    }
  }

  return null;
}

function validateCapacity(courier, category) {
  const batch = Number(courier.currentBatchCount || 0);
  const express = Number(courier.currentExpressCount || 0);
  const maxi = Number(courier.currentMaxiCount || 0);

  if (category === "EXPRESS") {
    if (express > 0 || batch > 0) {
      return "You must complete your active Express or Batch deliveries before accepting another Express delivery.";
    }
  }

  if (category === "BATCH") {
    if (express > 0) {
      return "You must complete your active Express delivery before accepting a Batch delivery.";
    }

    if (batch >= MAX_ACTIVE_BATCH_ORDERS) {
      return `You can have a maximum of ${MAX_ACTIVE_BATCH_ORDERS} active Batch deliveries.`;
    }
  }

  if (category === "MAXI" && maxi > 0) {
    return "You must complete your current Maxi delivery first.";
  }

  return null;
}

// ============================================================
// PAYMENT ELIGIBILITY FOR MICRO / MOTO
// ============================================================

function validateMicroMotoPayment(order) {
  const paidAndReady =
    order.status === "READY_FOR_PICKUP" && order.paymentStatus === "PAID";

  const receiverPaysOnDelivery =
    order.status === "AWAITING_PAYMENT" &&
    order.paymentResponsibility === "RECEIVER" &&
    order.paymentTiming === "ON_DELIVERY";

  const senderPaysAtPickup =
    order.status === "AWAITING_PAYMENT" &&
    order.paymentResponsibility === "SENDER" &&
    order.paymentTiming === "AT_PICKUP";

  return paidAndReady || receiverPaysOnDelivery || senderPaysAtPickup;
}

// ============================================================
// MAXI FINANCIAL CALCULATION
// ============================================================

function calculateMaxiFinancials(vehicleClass, agreedAmount) {
  const config = MAXI_PRICING[vehicleClass];
  const operationalFare = Number(agreedAmount);

  if (!config || !Number.isFinite(operationalFare) || operationalFare <= 0) {
    return null;
  }

  const commissionAmount = operationalFare * config.commissionRate;

  const platformServiceRevenue = commissionAmount + config.platformFee;

  const vatAmount = platformServiceRevenue * VAT_RATE;

  const platformNetRevenue = platformServiceRevenue - vatAmount;

  const courierEarnings = operationalFare - commissionAmount;

  const customerPrice = operationalFare + config.platformFee + vatAmount;

  return {
    operationalFare: Math.round(operationalFare),
    commissionAmount: Math.round(commissionAmount),
    platformFee: Math.round(config.platformFee),
    platformServiceRevenue: Math.round(platformServiceRevenue),
    vatAmount: Math.round(vatAmount),
    platformNetRevenue: Math.round(platformNetRevenue),
    courierEarnings: Math.round(courierEarnings),
    customerPrice: Math.round(customerPrice),
  };
}

// ============================================================
// CONDITIONAL ORDER ACCEPTANCE
// ============================================================

function buildOrderCondition(order, category) {
  const conditions = [
    { status: { eq: order.status } },
    { assignedCourierId: { attributeExists: false } },
  ];

  if (category === "MAXI") {
    conditions.push({
      acceptedOfferID: { attributeExists: false },
    });
  } else {
    if (order.paymentStatus) {
      conditions.push({
        paymentStatus: { eq: order.paymentStatus },
      });
    }

    if (order.paymentResponsibility) {
      conditions.push({
        paymentResponsibility: {
          eq: order.paymentResponsibility,
        },
      });
    }

    if (order.paymentTiming) {
      conditions.push({
        paymentTiming: { eq: order.paymentTiming },
      });
    }
  }

  return { and: conditions };
}

async function claimOrder(order, courier, category, now, offer, financials) {
  const input = {
    id: order.id,
    _version: order._version,
    status: "ACCEPTED",
    acceptedAt: now,
    assignedCourierId: courier.id,
    assignmentStatus: "ACCEPTED",
    hasNewOffer: false,
  };

  if (category === "MAXI") {
    input.acceptedOfferID = offer.id;
    input.operationalFare = financials.operationalFare;
    input.commissionAmount = financials.commissionAmount;
    input.platformFee = financials.platformFee;
    input.platformServiceRevenue = financials.platformServiceRevenue;
    input.vatAmount = financials.vatAmount;
    input.platformNetRevenue = financials.platformNetRevenue;
    input.courierEarnings = financials.courierEarnings;
    input.totalPrice = financials.customerPrice;
  }

  const data = await appsyncRequest(UPDATE_ORDER, {
    input,
    condition: buildOrderCondition(order, category),
  });

  if (!data.updateOrder) {
    throw new Error(
      "This delivery was just accepted by another courier. Please refresh and try another order.",
    );
  }

  return data.updateOrder;
}

// ============================================================
// COURIER COUNTER UPDATE
// ============================================================

function buildCourierCounterCondition(courier) {
  const conditions = [];

  for (const field of [
    "currentBatchCount",
    "currentExpressCount",
    "currentMaxiCount",
  ]) {
    const value = courier[field];

    conditions.push(
      value === null || value === undefined
        ? { [field]: { attributeExists: false } }
        : { [field]: { eq: value } },
    );
  }

  conditions.push({ isOnline: { eq: true } });
  conditions.push({ isApproved: { eq: true } });

  return { and: conditions };
}

async function incrementCourierCounter(courierId, category, now) {
  for (let attempt = 0; attempt < MAX_COURIER_UPDATE_ATTEMPTS; attempt++) {
    const courier = await getCourier(courierId);

    if (!courier) {
      throw new Error("Courier record disappeared during acceptance.");
    }

    const eligibilityError = validateCourier(courier);

    if (eligibilityError) {
      throw new Error(eligibilityError);
    }

    const capacityError = validateCapacity(courier, category);

    if (capacityError) {
      throw new Error(capacityError);
    }

    const input = {
      id: courier.id,
      _version: courier._version,
    };

    if (category === "EXPRESS") {
      input.currentExpressCount = Number(courier.currentExpressCount || 0) + 1;
    }

    if (category === "BATCH") {
      input.currentBatchCount = Number(courier.currentBatchCount || 0) + 1;
      input.lastBatchAssignedAt = now;
    }

    if (category === "MAXI") {
      input.currentMaxiCount = Number(courier.currentMaxiCount || 0) + 1;
    }

    try {
      const data = await appsyncRequest(UPDATE_COURIER, {
        input,
        condition: buildCourierCounterCondition(courier),
      });

      if (data.updateCourier) {
        return data.updateCourier;
      }
    } catch (error) {
      console.warn(
        `Courier counter update attempt ${attempt + 1} failed:`,
        error.message,
      );

      if (attempt === MAX_COURIER_UPDATE_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  throw new Error("Could not update courier delivery capacity.");
}

// ============================================================
// ROLLBACK ORDER CLAIM IF COURIER CAPACITY UPDATE FAILS
// ============================================================

async function rollbackOrder(orderId, courierId, acceptedAt, originalOrder) {
  try {
    const currentOrder = await getOrder(orderId);

    if (
      !currentOrder ||
      currentOrder.assignedCourierId !== courierId ||
      currentOrder.acceptedAt !== acceptedAt
    ) {
      console.error(
        "Rollback skipped: order is no longer owned by this acceptance.",
      );

      return false;
    }

    const input = {
      id: currentOrder.id,
      _version: currentOrder._version,
      status: originalOrder.status,
      acceptedAt: null,
      assignedCourierId: null,
      assignmentStatus: originalOrder.assignmentStatus || null,
      hasNewOffer: originalOrder.hasNewOffer ?? null,
    };

    if (originalOrder.transportationType === "MAXI") {
      input.acceptedOfferID = null;
      input.operationalFare = originalOrder.operationalFare ?? null;
      input.commissionAmount = originalOrder.commissionAmount ?? null;
      input.platformFee = originalOrder.platformFee ?? null;
      input.platformServiceRevenue =
        originalOrder.platformServiceRevenue ?? null;
      input.vatAmount = originalOrder.vatAmount ?? null;
      input.platformNetRevenue = originalOrder.platformNetRevenue ?? null;
      input.courierEarnings = originalOrder.courierEarnings ?? null;
      input.totalPrice = originalOrder.totalPrice ?? null;
    }

    await appsyncRequest(UPDATE_ORDER, {
      input,
      condition: {
        and: [
          { status: { eq: "ACCEPTED" } },
          { assignedCourierId: { eq: courierId } },
        ],
      },
    });

    return true;
  } catch (error) {
    console.error("CRITICAL: Order rollback failed:", error);
    return false;
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================

exports.handler = async (event) => {
  console.log("acceptDeliveryOrder invoked.");

  try {
    const orderId = event.arguments?.orderId;

    // AppSync Cognito identity.
    const sub = event.identity?.sub || event.identity?.claims?.sub;

    if (!orderId) {
      return {
        success: false,
        message: "Order ID is required.",
      };
    }

    if (!sub) {
      return {
        success: false,
        message: "Authenticated courier identity could not be established.",
      };
    }

    // --------------------------------------------------------
    // 1. Identify courier from authenticated Cognito identity.
    // Never accept a courier ID supplied by the frontend.
    // --------------------------------------------------------

    const courier = await getCourierBySub(sub);

    if (!courier) {
      return {
        success: false,
        message: "Courier account could not be found.",
      };
    }

    const eligibilityError = validateCourier(courier);

    if (eligibilityError) {
      return {
        success: false,
        message: eligibilityError,
      };
    }

    // --------------------------------------------------------
    // 2. Retrieve the latest order.
    // --------------------------------------------------------

    const order = await getOrder(orderId);

    if (!order) {
      return {
        success: false,
        message: "Order no longer exists.",
      };
    }

    if (order.status === "ACCEPTED" || order.assignedCourierId) {
      return {
        success: false,
        message: "This order has already been accepted.",
      };
    }

    const category = getServiceCategory(order.transportationType);

    if (!category) {
      return {
        success: false,
        message: "This delivery type cannot be accepted.",
      };
    }

    // --------------------------------------------------------
    // 3. Validate courier's service and vehicle.
    // --------------------------------------------------------

    const compatibilityError = validateServiceCompatibility(courier, order);

    if (compatibilityError) {
      return {
        success: false,
        message: compatibilityError,
      };
    }

    // --------------------------------------------------------
    // 4. Validate payment arrangement for Micro / Moto.
    // --------------------------------------------------------

    if (category !== "MAXI" && !validateMicroMotoPayment(order)) {
      return {
        success: false,
        message:
          "This order must be paid before acceptance unless its payment arrangement is pay-at-pickup or pay-on-delivery.",
      };
    }

    // --------------------------------------------------------
    // 5. Validate Maxi bidding and retrieve latest user offer.
    // --------------------------------------------------------

    let latestOffer = null;
    let financials = null;

    if (category === "MAXI") {
      if (order.status !== "BIDDING") {
        return {
          success: false,
          message: "This Maxi order is no longer open for acceptance.",
        };
      }

      if (order.acceptedOfferID) {
        return {
          success: false,
          message: "This Maxi offer has already been accepted.",
        };
      }

      latestOffer = await getLatestOffer(order.id);

      if (!latestOffer || latestOffer.senderType !== "USER") {
        return {
          success: false,
          message: "You can only accept the user's latest offer.",
        };
      }

      financials = calculateMaxiFinancials(
        order.vehicleClass,
        latestOffer.amount,
      );

      if (!financials) {
        return {
          success: false,
          message: "Maxi pricing information is unavailable.",
        };
      }
    }

    // --------------------------------------------------------
    // 6. Check courier capacity before claiming the order.
    // --------------------------------------------------------

    const capacityError = validateCapacity(courier, category);

    if (capacityError) {
      return {
        success: false,
        message: capacityError,
      };
    }

    // --------------------------------------------------------
    // 7. Claim order with a conditional AppSync model update.
    // This prevents two couriers claiming the same order.
    // --------------------------------------------------------

    const now = new Date().toISOString();

    await claimOrder(order, courier, category, now, latestOffer, financials);

    // --------------------------------------------------------
    // 8. Increment courier's active delivery counter.
    // --------------------------------------------------------

    try {
      await incrementCourierCounter(courier.id, category, now);
    } catch (counterError) {
      console.error(
        "Courier capacity update failed after order claim:",
        counterError,
      );

      const rolledBack = await rollbackOrder(order.id, courier.id, now, order);

      return {
        success: false,
        message: rolledBack
          ? counterError.message
          : "The order was reserved but courier capacity could not be updated. Please contact Atua support.",
      };
    }

    // --------------------------------------------------------
    // 9. Mark accepted Maxi offer.
    // The acceptedOfferID on Order is the authoritative link.
    // --------------------------------------------------------

    if (category === "MAXI" && latestOffer) {
      try {
        await appsyncRequest(UPDATE_OFFER, {
          input: {
            id: latestOffer.id,
            _version: latestOffer._version,
            status: "ACCEPTED",
          },
          condition: {
            and: [
              { status: { eq: latestOffer.status } },
              { senderType: { eq: "USER" } },
            ],
          },
        });
      } catch (offerError) {
        // The order already records acceptedOfferID.
        // Log this for reconciliation rather than undoing
        // a successfully assigned delivery.

        console.error(
          "Order accepted but Offer status update failed:",
          offerError,
        );
      }
    }

    console.log(`Order ${order.id} accepted by courier ${courier.id}.`);

    return {
      success: true,
      message: "Delivery accepted successfully.",
      orderId: order.id,
      assignedCourierId: courier.id,
      acceptedOfferID: latestOffer?.id || null,
    };
  } catch (error) {
    console.error("acceptDeliveryOrder error:", error);

    return {
      success: false,
      message:
        error.message || "Unable to accept this delivery. Please try again.",
    };
  }
};
