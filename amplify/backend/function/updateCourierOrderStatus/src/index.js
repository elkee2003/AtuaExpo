"use strict";

/**
 * updateCourierOrderStatus
 *
 * Responsibilities:
 * - Authenticate the requesting courier.
 * - Confirm that the courier is assigned to the order.
 * - Enforce the existing Micro/Moto and Maxi status sequences.
 * - Enforce the existing payment-transition rules.
 * - Validate the recipient verification code on DELIVERED.
 * - Update the Order through AppSync's generated updateOrder mutation.
 *
 * This Lambda does NOT:
 * - Record cash collections.
 * - Allocate courier earnings.
 * - Release funds.
 * - Process Paystack payments.
 * - Reconcile courier debt.
 * - Release courier capacity.
 */

const GRAPHQL_ENDPOINT = process.env.API_URL;
const GRAPHQL_API_KEY = process.env.API_KEY;

const DEFAULT_FLOW = [
  "ACCEPTED",
  "ARRIVED_PICKUP",
  "PICKED_UP",
  "IN_TRANSIT",
  "ARRIVED_DROPOFF",
  "DELIVERED",
];

const MAXI_FLOW = [
  "ACCEPTED",
  "ARRIVED_PICKUP",
  "LOADING",
  "PICKED_UP",
  "IN_TRANSIT",
  "ARRIVED_DROPOFF",
  "UNLOADING",
  "DELIVERED",
];

const TERMINAL_STATUSES = ["DELIVERED", "CANCELLED", "DISPUTED"];

const GET_ORDER_QUERY = /* GraphQL */ `
  query GetOrderForStatusUpdate($id: ID!) {
    getOrder(id: $id) {
      id
      status
      transportationType
      assignedCourierId

      paymentStatus
      paymentTiming
      paymentMethod
      paymentResponsibility

      cashCollectionStatus
      deliveryVerificationCode

      acceptedAt
      arrivedPickupAt
      loadingStartedAt
      tripStartedAt
      arrivedDropoffAt
      unloadingCompletedAt

      trackingStartedAt
      trackingEndedAt
      recipientTrackingEnabled
      recipientTrackingRevokedAt

      updatedAt
      _version
      _lastChangedAt
    }
  }
`;

const GET_COURIER_QUERY = /* GraphQL */ `
  query GetCourierBySub($sub: String!, $limit: Int) {
    couriersBySub(sub: $sub, limit: $limit) {
      items {
        id
        sub
      }
    }
  }
`;

const UPDATE_ORDER_MUTATION = /* GraphQL */ `
  mutation UpdateOrderStatus($input: UpdateOrderInput!) {
    updateOrder(input: $input) {
      id
      status

      acceptedAt
      arrivedPickupAt
      loadingStartedAt
      tripStartedAt
      arrivedDropoffAt
      unloadingCompletedAt
      assignedCourierId

      updatedAt
      _version
      _lastChangedAt
    }
  }
`;

/**
 * Make an AppSync GraphQL request using the API key.
 *
 * The Order and Courier models in the supplied schema
 * have public authorization rules. This Lambda uses the
 * server-side API key for these model operations, then
 * independently verifies the authenticated courier.
 */
async function graphqlRequest(query, variables) {
  if (!GRAPHQL_ENDPOINT || !GRAPHQL_API_KEY) {
    throw new Error("Missing API_URL or API_KEY environment variable.");
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
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("AppSync HTTP error:", {
      status: response.status,
      result,
    });

    throw new Error(
      result?.errors?.[0]?.message ||
        `AppSync request failed with HTTP ${response.status}.`,
    );
  }

  if (result.errors?.length) {
    console.error("AppSync GraphQL errors:", result.errors);

    throw new Error(
      result.errors[0]?.message || "AppSync returned a GraphQL error.",
    );
  }

  return result.data;
}

function getIdentitySub(identity) {
  return identity?.claims?.sub || identity?.sub || null;
}

function getDeliveryFlow(order) {
  return order?.transportationType === "MAXI" ? MAXI_FLOW : DEFAULT_FLOW;
}

function isTerminalOrder(status) {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Preserve the payment-transition rules already used
 * by OrderProvider.
 *
 * This function only checks existing confirmation fields.
 * It does not record cash or verify Paystack transactions.
 */
function canAdvancePaymentStatus(order, newStatus) {
  if (!order) {
    return {
      allowed: false,
      message: "The order could not be found.",
    };
  }

  const paymentStatus = order.paymentStatus;
  const paymentTiming = order.paymentTiming;
  const paymentMethod = order.paymentMethod;
  const paymentResponsibility = order.paymentResponsibility;

  const cashConfirmed = order.cashCollectionStatus === "CONFIRMED";

  // BEFORE PICKUP: electronic payment must already be paid.
  if (
    ["PICKED_UP", "LOADING"].includes(newStatus) &&
    paymentTiming === "BEFORE_PICKUP" &&
    paymentStatus !== "PAID"
  ) {
    return {
      allowed: false,
      message: "Payment must be confirmed before pickup.",
    };
  }

  // SENDER CASH AT PICKUP.
  // For Maxi, this is checked before loading begins.
  if (
    ["PICKED_UP", "LOADING"].includes(newStatus) &&
    paymentResponsibility === "SENDER" &&
    paymentTiming === "AT_PICKUP" &&
    paymentMethod === "CASH" &&
    !cashConfirmed
  ) {
    return {
      allowed: false,
      message:
        "Confirm that the pickup cash has been collected before proceeding.",
    };
  }

  // ON DELIVERY: payment is checked before DELIVERED.
  if (newStatus === "DELIVERED" && paymentTiming === "ON_DELIVERY") {
    if (paymentMethod === "PAYSTACK" && paymentStatus !== "PAID") {
      return {
        allowed: false,
        message: "The electronic payment has not been confirmed yet.",
      };
    }

    if (paymentMethod === "CASH" && !cashConfirmed) {
      return {
        allowed: false,
        message: "Record the cash collection before completing delivery.",
      };
    }

    if (
      paymentResponsibility === "RECEIVER" &&
      !["CASH", "PAYSTACK"].includes(paymentMethod)
    ) {
      return {
        allowed: false,
        message:
          "The receiver must select a payment method before delivery can be completed.",
      };
    }
  }

  return {
    allowed: true,
    message: "",
  };
}

function makeFailure(message, orderId = null, status = null) {
  return {
    success: false,
    message,
    orderId,
    status,
  };
}

function makeSuccess(order, message = "Order status updated successfully.") {
  return {
    success: true,
    message,
    orderId: order.id,
    status: order.status,
    assignedCourierId: order.assignedCourierId ?? null,
    acceptedAt: order.acceptedAt || null,
    arrivedPickupAt: order.arrivedPickupAt || null,
    loadingStartedAt: order.loadingStartedAt || null,
    tripStartedAt: order.tripStartedAt || null,
    arrivedDropoffAt: order.arrivedDropoffAt || null,
    unloadingCompletedAt: order.unloadingCompletedAt || null,
    updatedAt: order.updatedAt || null,
    _version: order._version ?? null,
    _lastChangedAt: order._lastChangedAt ?? null,
  };
}

async function getOrder(orderId) {
  const data = await graphqlRequest(GET_ORDER_QUERY, { id: orderId });

  return data?.getOrder || null;
}

async function getCourierBySub(sub) {
  const data = await graphqlRequest(GET_COURIER_QUERY, {
    sub,
    limit: 2,
  });

  const couriers = data?.couriersBySub?.items || [];

  if (couriers.length !== 1) {
    return null;
  }

  return couriers[0];
}

async function saveOrderStatus(order, newStatus) {
  const now = new Date().toISOString();

  const input = {
    id: order.id,
    status: newStatus,

    // Important for Amplify DataStore conflict detection.
    _version: order._version,
  };

  if (newStatus === "ACCEPTED") {
    input.acceptedAt = now;
  }

  if (newStatus === "ARRIVED_PICKUP") {
    input.arrivedPickupAt = now;
  }

  if (newStatus === "LOADING") {
    input.loadingStartedAt = now;
  }

  if (newStatus === "PICKED_UP") {
    input.tripStartedAt = now;
  }

  if (newStatus === "IN_TRANSIT") {
    input.trackingStartedAt = now;
  }

  if (newStatus === "ARRIVED_DROPOFF") {
    input.arrivedDropoffAt = now;
  }

  if (newStatus === "DELIVERED") {
    input.unloadingCompletedAt = now;
    input.trackingEndedAt = now;
    input.recipientTrackingEnabled = false;
    input.recipientTrackingRevokedAt = now;
  }

  const data = await graphqlRequest(UPDATE_ORDER_MUTATION, { input });

  const updated = data?.updateOrder;

  if (!updated) {
    throw new Error("AppSync did not return the updated Order.");
  }

  return updated;
}

exports.handler = async (event) => {
  const args = event?.arguments || {};

  const orderId = args.orderId;
  const newStatus = args.newStatus;
  const verificationCode = args.verificationCode;

  try {
    // ------------------------------------------------------
    // 1. VALIDATE INPUT
    // ------------------------------------------------------

    if (!orderId || typeof orderId !== "string") {
      return makeFailure("A valid orderId is required.");
    }

    if (!newStatus || typeof newStatus !== "string") {
      return makeFailure("A valid newStatus is required.", orderId);
    }

    const validStatuses = [
      ...DEFAULT_FLOW,
      "LOADING",
      "UNLOADING",
      "CANCELLED",
      "DISPUTED",
    ];

    if (!validStatuses.includes(newStatus)) {
      return makeFailure(
        "This status is not supported by the courier delivery workflow.",
        orderId,
      );
    }

    // ------------------------------------------------------
    // 2. AUTHENTICATE THE COURIER
    // ------------------------------------------------------

    const identity = event?.identity;
    const cognitoSub = getIdentitySub(identity);

    // This mutation supports IAM and Cognito at the schema
    // level, but this operation requires an authenticated
    // Cognito courier.
    if (!cognitoSub) {
      return makeFailure("Unauthorised. Please sign in as a courier.", orderId);
    }

    const courier = await getCourierBySub(cognitoSub);

    if (!courier) {
      return makeFailure(
        "Your courier account could not be verified.",
        orderId,
      );
    }

    // ------------------------------------------------------
    // 3. RETRIEVE THE ORDER
    // ------------------------------------------------------

    const order = await getOrder(orderId);

    console.log("STATUS UPDATE DIAGNOSTIC:", {
      requestedOrderId: orderId,
      fetchedOrderId: order?.id,
      fetchedStatus: order?.status,
      fetchedAssignedCourierId: order?.assignedCourierId,
      courierId: courier?.id,
      requestedNewStatus: newStatus,
      version: order?._version,
    });

    if (!order) {
      return makeFailure("Order not found.", orderId);
    }

    // ------------------------------------------------------
    // 4. VERIFY ORDER ASSIGNMENT
    // ------------------------------------------------------

    if (order.assignedCourierId !== courier.id) {
      return makeFailure(
        "You are not authorised to update this order.",
        orderId,
        order.status,
      );
    }

    // ------------------------------------------------------
    // 5. HANDLE SAFE RETRIES
    // ------------------------------------------------------

    // If a previous request succeeded but the client did not
    // receive the response, return the current status instead
    // of attempting the same update again.
    if (order.status === newStatus) {
      return makeSuccess(order, "This order status has already been applied.");
    }

    // ------------------------------------------------------
    // 6. PREVENT UPDATES TO TERMINAL ORDERS
    // ------------------------------------------------------

    if (isTerminalOrder(order.status)) {
      return makeFailure(
        `This order is already ${order.status}.`,
        orderId,
        order.status,
      );
    }

    // ------------------------------------------------------
    // 7. CANCEL / DISPUTE — EXISTING SPECIAL CASE
    // ------------------------------------------------------

    // Preserve the special status path previously handled
    // by OrderProvider. No delivery-flow check is applied.
    if (newStatus === "CANCELLED" || newStatus === "DISPUTED") {
      const updated = await saveOrderStatus(order, newStatus);

      return makeSuccess(updated, `Order status changed to ${newStatus}.`);
    }

    // ------------------------------------------------------
    // 8. VALIDATE THE DELIVERY SEQUENCE
    // ------------------------------------------------------

    const flow = getDeliveryFlow(order);
    const currentIndex = flow.indexOf(order.status);

    if (currentIndex === -1) {
      return makeFailure(
        `The current status ${order.status} is not part of this delivery workflow.`,
        orderId,
        order.status,
      );
    }

    const expectedNextStatus = flow[currentIndex + 1];

    if (!expectedNextStatus || newStatus !== expectedNextStatus) {
      return makeFailure(
        `Invalid status transition. The next expected status is ${expectedNextStatus || "none"}.`,
        orderId,
        order.status,
      );
    }

    // ------------------------------------------------------
    // 9. CHECK EXISTING PAYMENT CONFIRMATION
    // ------------------------------------------------------

    const paymentGate = canAdvancePaymentStatus(order, newStatus);

    if (!paymentGate.allowed) {
      return makeFailure(paymentGate.message, orderId, order.status);
    }

    // ------------------------------------------------------
    // 10. VERIFY DELIVERY CODE
    // ------------------------------------------------------

    if (newStatus === "DELIVERED") {
      const submittedCode = String(verificationCode || "").trim();

      const storedCode = String(order.deliveryVerificationCode || "").trim();

      if (!submittedCode) {
        return makeFailure(
          "The recipient verification code is required before completing delivery.",
          orderId,
          order.status,
        );
      }

      if (!storedCode || submittedCode !== storedCode) {
        return makeFailure(
          "The recipient verification code is incorrect.",
          orderId,
          order.status,
        );
      }
    }

    // ------------------------------------------------------
    // 11. SAVE THE STATUS THROUGH APPSYNC
    // ------------------------------------------------------

    const updated = await saveOrderStatus(order, newStatus);

    console.log("Courier order status updated:", {
      orderId: updated.id,
      courierId: courier.id,
      previousStatus: order.status,
      newStatus: updated.status,

      assignedCourierIdBeforeUpdate: order.assignedCourierId,
      assignedCourierIdAfterUpdate: updated.assignedCourierId,

      versionBeforeUpdate: order._version,
      versionAfterUpdate: updated._version,
    });

    // ------------------------------------------------------
    // 12. RETURN THE UPDATED ORDER
    // ------------------------------------------------------

    return makeSuccess(updated);
  } catch (error) {
    console.error("updateCourierOrderStatus error:", {
      message: error?.message,
      name: error?.name,
      orderId,
      newStatus,
      stack: error?.stack,
    });

    return makeFailure(
      error?.message || "Unable to update the order status. Please try again.",
      orderId,
    );
  }
};
