/*
 * Lambda: getAssignedOrderStatus
 *
 * Purpose:
 * Securely retrieve the latest status of an order assigned to
 * the currently authenticated courier.
 *
 * Security:
 * 1. Gets the authenticated courier's Cognito sub from AppSync identity.
 * 2. Finds the Courier record belonging to that sub.
 * 3. Requires exactly one matching Courier record.
 * 4. Fetches the requested Order using the Lambda's IAM permissions.
 * 5. Verifies that the Order is assigned to that Courier.
 * 6. Returns only the approved order status and timestamp fields.
 *
 * This Lambda does not update orders or change payment information.
 */

const { defaultProvider } = require("@aws-sdk/credential-provider-node");
const { SignatureV4 } = require("@smithy/signature-v4");
const { HttpRequest } = require("@smithy/protocol-http");
const { Hash } = require("@smithy/hash-node");

// ------------------------------------------------------------
// ENVIRONMENT VARIABLES
// ------------------------------------------------------------

const REGION = process.env.REGION || process.env.AWS_REGION;

const APPSYNC_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

if (!REGION) {
  throw new Error("Missing REGION environment variable.");
}

if (!APPSYNC_ENDPOINT) {
  throw new Error(
    "Missing API_ATUA_GRAPHQLAPIENDPOINTOUTPUT environment variable.",
  );
}

// ------------------------------------------------------------
// GRAPHQL QUERIES
// ------------------------------------------------------------

// Find the Courier record belonging to the authenticated user.
//
// We request up to two records so that we can reject duplicate
// Courier records rather than arbitrarily selecting one.

const GET_COURIER_BY_SUB = /* GraphQL */ `
  query GetCourierByAuthenticatedSub($sub: String!, $limit: Int) {
    couriersBySub(sub: $sub, limit: $limit) {
      items {
        id
        sub
      }
    }
  }
`;

// Fetch only the fields required to refresh the courier's
// current order status.

const GET_ORDER_BY_ID = /* GraphQL */ `
  query GetOrderForAssignedCourier($id: ID!) {
    getOrder(id: $id) {
      id
      status
      assignedCourierId

      acceptedAt
      arrivedPickupAt
      loadingStartedAt
      tripStartedAt
      arrivedDropoffAt
      unloadingCompletedAt

      updatedAt
    }
  }
`;

// ------------------------------------------------------------
// APPSYNC IAM / SIGV4 CLIENT
// ------------------------------------------------------------

const credentialsProvider = defaultProvider();

const signer = new SignatureV4({
  credentials: credentialsProvider,
  region: REGION,
  service: "appsync",
  sha256: Hash.bind(null, "sha256"),
});

// Execute a GraphQL query against AppSync using the Lambda's
// IAM execution role.
//
// The Lambda execution role must have appsync:GraphQL permission
// on the relevant AppSync Query fields.

async function executeGraphQL(query, variables = {}) {
  const endpoint = new URL(APPSYNC_ENDPOINT);

  const body = JSON.stringify({
    query,
    variables,
  });

  const request = new HttpRequest({
    method: "POST",
    protocol: endpoint.protocol,
    hostname: endpoint.hostname,
    path: endpoint.pathname,
    headers: {
      host: endpoint.hostname,
      "content-type": "application/json",
    },
    body,
  });

  const signedRequest = await signer.sign(request);

  const response = await fetch(APPSYNC_ENDPOINT, {
    method: "POST",
    headers: signedRequest.headers,
    body,
  });

  const responseText = await response.text();

  let responseData;

  try {
    responseData = JSON.parse(responseText);
  } catch (error) {
    console.error("AppSync returned a non-JSON response:", responseText);

    throw new Error("Invalid response received from AppSync.");
  }

  if (!response.ok) {
    console.error("AppSync HTTP error:", {
      status: response.status,
      response: responseData,
    });

    throw new Error(
      `AppSync request failed with HTTP status ${response.status}.`,
    );
  }

  if (responseData.errors && responseData.errors.length > 0) {
    console.error(
      "AppSync GraphQL errors:",
      JSON.stringify(responseData.errors, null, 2),
    );

    throw new Error(
      responseData.errors[0].message || "AppSync GraphQL request failed.",
    );
  }

  return responseData.data || {};
}

// ------------------------------------------------------------
// AUTHENTICATED COURIER
// ------------------------------------------------------------

// Extract the Cognito sub from the authenticated AppSync identity.
//
// Depending on the resolver event shape, it may be available
// directly as identity.sub or under identity.claims.sub.

function getAuthenticatedSub(identity) {
  if (!identity) {
    return null;
  }

  const sub =
    identity.sub || identity.claims?.sub || identity.resolverContext?.sub;

  if (typeof sub !== "string" || !sub.trim()) {
    return null;
  }

  return sub.trim();
}

// Retrieve the Courier record belonging to the authenticated user.
//
// Exactly one matching record is required.
// We deliberately do not choose the first record if duplicates exist.

async function getAuthenticatedCourier(sub) {
  const data = await executeGraphQL(GET_COURIER_BY_SUB, {
    sub,
    limit: 2,
  });

  const couriers = data?.couriersBySub?.items || [];

  if (couriers.length !== 1) {
    console.error(
      `Expected exactly one Courier record for authenticated sub; found ${couriers.length}.`,
    );

    return null;
  }

  const courier = couriers[0];

  if (!courier?.id || courier.sub !== sub) {
    console.error(
      "Courier record did not match the authenticated Cognito sub.",
    );

    return null;
  }

  return courier;
}

// ------------------------------------------------------------
// ORDER RETRIEVAL
// ------------------------------------------------------------

async function getOrderById(orderId) {
  const data = await executeGraphQL(GET_ORDER_BY_ID, {
    id: orderId,
  });

  return data?.getOrder || null;
}

// ------------------------------------------------------------
// RESPONSE HELPERS
// ------------------------------------------------------------

function failure(message) {
  return {
    success: false,
    message,

    orderId: null,
    assignedCourierId: null,
    status: null,

    acceptedAt: null,
    arrivedPickupAt: null,
    loadingStartedAt: null,
    tripStartedAt: null,
    arrivedDropoffAt: null,
    unloadingCompletedAt: null,

    updatedAt: null,
  };
}

function success(order) {
  return {
    success: true,
    message: "Order status retrieved successfully.",

    orderId: order.id,
    assignedCourierId: order.assignedCourierId,
    status: order.status,

    acceptedAt: order.acceptedAt || null,
    arrivedPickupAt: order.arrivedPickupAt || null,
    loadingStartedAt: order.loadingStartedAt || null,
    tripStartedAt: order.tripStartedAt || null,
    arrivedDropoffAt: order.arrivedDropoffAt || null,
    unloadingCompletedAt: order.unloadingCompletedAt || null,

    updatedAt: order.updatedAt || null,
  };
}

// ------------------------------------------------------------
// MAIN LAMBDA HANDLER
// ------------------------------------------------------------

exports.handler = async (event) => {
  console.log("getAssignedOrderStatus invoked.");

  try {
    // --------------------------------------------------------
    // 1. Validate the AppSync request
    // --------------------------------------------------------

    const orderId = event?.arguments?.orderId;

    if (typeof orderId !== "string" || !orderId.trim()) {
      return failure("A valid order ID is required.");
    }

    // --------------------------------------------------------
    // 2. Identify the authenticated user
    // --------------------------------------------------------

    const sub = getAuthenticatedSub(event?.identity);

    if (!sub) {
      console.warn("Request rejected: authenticated Cognito sub is missing.");

      return failure("Authentication is required.");
    }

    // --------------------------------------------------------
    // 3. Find the authenticated user's Courier record
    // --------------------------------------------------------

    const courier = await getAuthenticatedCourier(sub);

    if (!courier) {
      console.warn(
        "Request rejected: no unique Courier record found for authenticated user.",
      );

      return failure("Unable to verify courier account.");
    }

    console.log("Authenticated courier verified:", {
      courierId: courier.id,
    });

    // --------------------------------------------------------
    // 4. Retrieve the requested order
    // --------------------------------------------------------

    const order = await getOrderById(orderId.trim());

    if (!order) {
      console.warn("Requested order was not found.");

      return failure("Order not found or access denied.");
    }

    // --------------------------------------------------------
    // 5. Verify order assignment
    // --------------------------------------------------------

    // A courier must only receive status information for an
    // order currently assigned to their own Courier record.

    if (order.assignedCourierId !== courier.id) {
      console.warn(
        "Request rejected: order is not assigned to authenticated courier.",
        {
          orderId: order.id,
          requestedCourierId: courier.id,
          actualAssignedCourierId: order.assignedCourierId,
        },
      );

      // Do not reveal whether the order exists or who it
      // is assigned to.

      return failure("Order not found or access denied.");
    }

    // --------------------------------------------------------
    // 6. Return the latest approved order fields
    // --------------------------------------------------------

    console.log("Assigned order status retrieved successfully:", {
      orderId: order.id,
      courierId: courier.id,
      status: order.status,
      updatedAt: order.updatedAt,
    });

    return success(order);
  } catch (error) {
    // --------------------------------------------------------
    // 7. Handle unexpected errors
    // --------------------------------------------------------

    console.error("getAssignedOrderStatus failed:", {
      message: error?.message,
      stack: error?.stack,
    });

    return failure(
      "Unable to retrieve the latest order status. Please try again.",
    );
  }
};
