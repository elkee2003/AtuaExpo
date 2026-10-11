/**
 * ============================================================
 * Atua - deleteOrder Lambda
 * ============================================================
 *
 * PURPOSE
 * -------
 * This Lambda is the backend authority for permanently deleting
 * orders that are still unpaid / not yet active.
 *
 *
 * ALLOWED DELETION CASES
 * ----------------------
 *
 * 1. MAXI + BIDDING
 *
 * 2. MAXI + ACCEPTED + UNPAID
 *
 * 3. MICRO/MOTO + AWAITING_PAYMENT
 *
 *
 * NOT ALLOWED
 * -----------
 *
 * 1. MAXI + ACCEPTED + PAID
 *    -> Must use cancelOrder + refund flow.
 *
 * 2. MICRO/MOTO + READY_FOR_PICKUP + PAID
 *    -> Must use cancelOrder + refund flow.
 *
 * 3. Any active / delivered / cancelled / disputed order that
 *    does not satisfy the rules above.
 *
 *
 * IMPORTANT
 * ---------
 *
 * The frontend performs the same eligibility checks for UX.
 * However, those checks are NOT trusted for security.
 *
 * This Lambda:
 *
 *   - authenticates the caller
 *   - resolves the Atua User from Cognito sub
 *   - verifies order ownership
 *   - reads the latest Order
 *   - checks deletion eligibility
 *   - invalidates MAXI offers
 *   - re-reads the Order after offer invalidation
 *   - verifies that the Order did not change
 *   - deletes the Order using AppSync versioning
 *
 *
 * IMPORTANT DATASTORE FIX
 * ------------------------
 *
 * DataStore subscriptions expect the AppSync mutation response
 * to contain the complete model fields needed to hydrate the
 * deleted/updated record.
 *
 * The previous version only requested:
 *
 *   Order:
 *     id
 *     _version
 *     _deleted
 *
 *   Offer:
 *     id
 *     orderID
 *     courierID
 *     senderType
 *     amount
 *     status
 *     _version
 *     _deleted
 *
 * This caused DataStore to receive subscription payloads where
 * fields such as:
 *
 *   userID
 *   createdAt
 *   updatedAt
 *   _lastChangedAt
 *
 * appeared as null.
 *
 * This version deliberately requests the complete scalar fields
 * for Order and Offer, including DataStore metadata.
 *
 * ============================================================
 */

const https = require("https");
const { URL } = require("url");

/**
 * ============================================================
 * Environment
 * ============================================================
 */

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const GRAPHQL_API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

const REGION = process.env.REGION || "us-east-1";

/**
 * REGION is kept because it is part of the Lambda environment.
 *
 * The current AppSync requests use HTTPS + API key directly.
 */
void REGION;

/**
 * ============================================================
 * Basic validation
 * ============================================================
 */

if (!GRAPHQL_ENDPOINT) {
  console.error("FATAL: API_ATUA_GRAPHQLAPIENDPOINTOUTPUT is not configured.");
}

if (!GRAPHQL_API_KEY) {
  console.error("FATAL: API_ATUA_GRAPHQLAPIKEYOUTPUT is not configured.");
}

/**
 * ============================================================
 * GraphQL HTTP helper
 * ============================================================
 *
 * Order, User and Offer use AppSync API-key access.
 *
 * The custom permanentlyDeleteOrder mutation itself is protected
 * by Cognito. The Lambda therefore verifies the caller through
 * event.identity before performing any destructive operation.
 * ============================================================
 */

async function graphqlRequest(query, variables = {}) {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error("AppSync GraphQL endpoint is not configured.");
  }

  if (!GRAPHQL_API_KEY) {
    throw new Error("AppSync API key is not configured.");
  }

  const endpoint = new URL(GRAPHQL_ENDPOINT);

  const body = JSON.stringify({
    query,
    variables,
  });

  const options = {
    hostname: endpoint.hostname,
    path: endpoint.pathname,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": GRAPHQL_API_KEY,
      "Content-Length": Buffer.byteLength(body),
    },
  };

  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      let responseBody = "";

      response.on("data", (chunk) => {
        responseBody += chunk;
      });

      response.on("end", () => {
        let parsed;

        try {
          parsed = JSON.parse(responseBody);
        } catch (error) {
          return reject(
            new Error(
              `Invalid AppSync response. HTTP ${response.statusCode}: ${responseBody}`,
            ),
          );
        }

        /**
         * AppSync can return HTTP 200 while still containing
         * GraphQL errors.
         */
        if (parsed.errors && parsed.errors.length > 0) {
          console.error(
            "AppSync GraphQL errors:",
            JSON.stringify(parsed.errors, null, 2),
          );

          const message =
            parsed.errors[0]?.message || "AppSync GraphQL request failed.";

          const error = new Error(message);

          error.graphQLErrors = parsed.errors;

          return reject(error);
        }

        /**
         * Check HTTP status after GraphQL errors.
         */
        if (response.statusCode < 200 || response.statusCode >= 300) {
          return reject(
            new Error(`AppSync returned HTTP ${response.statusCode}.`),
          );
        }

        resolve(parsed.data);
      });
    });

    request.on("error", (error) => {
      reject(error);
    });

    request.write(body);
    request.end();
  });
}

/**
 * ============================================================
 * Utility helpers
 * ============================================================
 */

function normalizeString(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

/**
 * Determine whether an Order is MAXI.
 */
function isMaxi(order) {
  return normalizeString(order?.transportationType) === "MAXI";
}

/**
 * Determine whether an Order is Micro or Moto.
 *
 * We deliberately support the actual transportationType values
 * used by Atua.
 */
function isMicroOrMoto(order) {
  const type = normalizeString(order?.transportationType);

  return [
    "MICRO_EXPRESS",
    "MICRO_BATCH",
    "MOTO_EXPRESS",
    "MOTO_BATCH",
    "MICRO",
    "MOTO",
  ].includes(type);
}

/**
 * ============================================================
 * Determine whether the latest Order is deletable
 * ============================================================
 *
 * This is the backend business rule.
 *
 * The frontend may use the same logic for displaying buttons,
 * but the frontend is NOT trusted.
 * ============================================================
 */

function getDeletionEligibility(order) {
  if (!order) {
    return {
      allowed: false,
      reason: "ORDER_NOT_FOUND",
    };
  }

  const type = normalizeString(order.transportationType);

  const status = normalizeString(order.status);

  const paymentStatus = normalizeString(order.paymentStatus);

  /**
   * ----------------------------------------------------------
   * MAXI
   * ----------------------------------------------------------
   */

  if (type === "MAXI") {
    /**
     * --------------------------------------------------------
     * MAXI BIDDING
     * --------------------------------------------------------
     *
     * No payment has occurred.
     *
     * The order can be permanently deleted.
     */
    if (status === "BIDDING") {
      return {
        allowed: true,
        reason: "MAXI_BIDDING",
      };
    }

    /**
     * --------------------------------------------------------
     * MAXI ACCEPTED + UNPAID
     * --------------------------------------------------------
     *
     * A courier may already have accepted the bid, but payment
     * has not happened.
     *
     * The order can still be permanently deleted.
     *
     * We do NOT reverse currentMaxiCount here because the MAXI
     * count is incremented only after payment.
     */
    if (status === "ACCEPTED" && paymentStatus !== "PAID") {
      return {
        allowed: true,
        reason: "MAXI_ACCEPTED_UNPAID",
      };
    }

    /**
     * --------------------------------------------------------
     * MAXI ACCEPTED + PAID
     * --------------------------------------------------------
     *
     * NEVER permanently delete this order.
     *
     * This must go through cancelOrder so that:
     *
     *   - Paystack refund
     *   - cancellation record
     *   - MAXI count reversal
     *
     * are handled correctly.
     */
    if (status === "ACCEPTED" && paymentStatus === "PAID") {
      return {
        allowed: false,
        reason: "MAXI_ACCEPTED_PAID",
      };
    }

    /**
     * All other MAXI states cannot be deleted.
     */
    return {
      allowed: false,
      reason: "MAXI_ORDER_NOT_DELETABLE",
    };
  }

  /**
   * ----------------------------------------------------------
   * MICRO / MOTO
   * ----------------------------------------------------------
   */

  if (isMicroOrMoto(order)) {
    /**
     * Only unpaid AWAITING_PAYMENT orders can be permanently
     * deleted.
     */
    if (status === "AWAITING_PAYMENT") {
      return {
        allowed: true,
        reason: "MICRO_MOTO_AWAITING_PAYMENT",
      };
    }

    /**
     * READY_FOR_PICKUP + PAID and all later states must go
     * through the cancellation/refund flow.
     */
    return {
      allowed: false,
      reason: "MICRO_MOTO_ORDER_NOT_DELETABLE",
    };
  }

  /**
   * Unknown transportation type.
   *
   * Fail closed.
   */
  return {
    allowed: false,
    reason: "UNKNOWN_TRANSPORTATION_TYPE",
  };
}

/**
 * ============================================================
 * Resolve the authenticated Atua User
 * ============================================================
 *
 * Cognito gives us:
 *
 *   event.identity.sub
 *
 * Your Order model stores:
 *
 *   userID = Atua User.id
 *
 * while User contains:
 *
 *   sub = Cognito user's sub
 *
 * Therefore:
 *
 *   Cognito sub
 *       ↓
 *   User.sub
 *       ↓
 *   User.id
 *
 * Then compare:
 *
 *   Order.userID === User.id
 * ============================================================
 */

async function getUserByCognitoSub(cognitoSub) {
  if (!cognitoSub) {
    return null;
  }

  const query = `
    query GetUserBySub(
      $filter: ModelUserFilterInput
    ) {
      listUsers(
        filter: $filter
        limit: 2
      ) {
        items {
          id
          sub
        }
      }
    }
  `;

  const data = await graphqlRequest(query, {
    filter: {
      sub: {
        eq: cognitoSub,
      },
    },
  });

  const users = data?.listUsers?.items || [];

  /**
   * No matching Atua User.
   */
  if (users.length === 0) {
    return null;
  }

  /**
   * There should only be one User record
   * for a Cognito sub.
   *
   * If duplicates exist, fail closed rather
   * than guessing which account owns the order.
   */
  if (users.length > 1) {
    throw new Error("Multiple Atua User records were found for this account.");
  }

  return users[0];
}

/**
 * ============================================================
 * Complete Order scalar field selection
 * ============================================================
 *
 * IMPORTANT:
 *
 * This list intentionally contains the Order scalar fields
 * required by the current Atua schema, including DataStore
 * metadata.
 *
 * We do NOT request nested relationships such as:
 *
 *   offers
 *   payments
 *   assignedCourier
 *
 * because those are connections/relationships and are not
 * necessary for the delete subscription payload.
 * ============================================================
 */

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

/**
 * ============================================================
 * Get latest Order
 * ============================================================
 */

async function getOrder(orderID) {
  if (!orderID) {
    throw new Error("Order ID is required.");
  }

  const query = `
    query GetOrder($id: ID!) {
      getOrder(id: $id) {
        ${ORDER_FIELDS}
      }
    }
  `;

  const data = await graphqlRequest(query, {
    id: orderID,
  });

  return data?.getOrder || null;
}

/**
 * ============================================================
 * Get ALL Offers belonging to an Order
 * ============================================================
 *
 * We use the orderID filter.
 *
 * We intentionally paginate because an order may have more
 * offers than the default AppSync page size.
 * ============================================================
 */

async function getOffersForOrder(orderID) {
  const allOffers = [];

  let nextToken = null;

  do {
    const query = `
      query ListOffers(
        $filter: ModelOfferFilterInput
        $limit: Int
        $nextToken: String
      ) {
        listOffers(
          filter: $filter
          limit: $limit
          nextToken: $nextToken
        ) {
          items {
            id
            orderID
            courierID
            senderType
            amount
            status
            createdAt
            updatedAt
            _version
            _lastChangedAt
            _deleted
          }

          nextToken
        }
      }
    `;

    const data = await graphqlRequest(query, {
      filter: {
        orderID: {
          eq: orderID,
        },
      },
      limit: 100,
      nextToken,
    });

    const page = data?.listOffers;

    if (!page) {
      break;
    }

    allOffers.push(...(page.items || []));

    nextToken = page.nextToken || null;
  } while (nextToken);

  return allOffers;
}

/**
 * ============================================================
 * Cancel a single Offer
 * ============================================================
 *
 * We use the Offer's _version so that if another operation
 * changed the Offer between our read and this update,
 * AppSync's optimistic concurrency control can detect
 * the conflict.
 *
 * We do NOT blindly overwrite the Offer.
 *
 * IMPORTANT DATASTORE FIX:
 *
 * The mutation response now includes:
 *
 *   createdAt
 *   updatedAt
 *   _lastChangedAt
 *
 * in addition to the normal Offer fields.
 * ============================================================
 */

async function cancelOffer(offer) {
  if (!offer?.id) {
    return null;
  }

  /**
   * Already cancelled.
   *
   * This makes repeated Lambda execution harmless.
   */
  if (normalizeString(offer.status) === "CANCELLED") {
    return offer;
  }

  /**
   * If AppSync tells us the record has already
   * been deleted, there is nothing more to do.
   */
  if (offer._deleted === true) {
    return offer;
  }

  const mutation = `
    mutation UpdateOffer(
      $input: UpdateOfferInput!
    ) {
      updateOffer(input: $input) {
        id
        orderID
        courierID
        senderType
        amount
        status

        createdAt
        updatedAt
        _lastChangedAt

        _version
        _deleted
      }
    }
  `;

  const input = {
    id: offer.id,
    status: "CANCELLED",
  };

  /**
   * AppSync versioned models normally require _version
   * for updates when conflict detection is enabled.
   */
  if (offer._version != null) {
    input._version = offer._version;
  }

  const data = await graphqlRequest(mutation, {
    input,
  });

  return data?.updateOffer || null;
}

/**
 * ============================================================
 * Cancel all MAXI Offers
 * ============================================================
 */

async function invalidateMaxiOffers(orderID) {
  const offers = await getOffersForOrder(orderID);

  console.log(`Found ${offers.length} Offer record(s) for Order ${orderID}.`);

  let cancelledCount = 0;

  for (const offer of offers) {
    /**
     * Already cancelled or deleted.
     */
    if (
      normalizeString(offer.status) === "CANCELLED" ||
      offer._deleted === true
    ) {
      continue;
    }

    /**
     * We deliberately allow the backend to invalidate
     * ACCEPTED as well for an unpaid MAXI order.
     *
     * The order itself is being deleted, so the offer no longer
     * represents a valid acceptance.
     */
    await cancelOffer(offer);

    cancelledCount += 1;
  }

  return {
    totalOffers: offers.length,
    cancelledOffers: cancelledCount,
  };
}

/**
 * ============================================================
 * Delete Order
 * ============================================================
 *
 * IMPORTANT:
 *
 * The generated AppSync mutation for the Order model is:
 *
 *   deleteOrder(input: DeleteOrderInput!)
 *
 * This is DIFFERENT from our custom mutation:
 *
 *   permanentlyDeleteOrder(orderID: ID!)
 *
 * The custom mutation invokes this Lambda.
 *
 * Inside the Lambda, we call the generated model mutation
 * deleteOrder(input: ...).
 *
 *
 * IMPORTANT DATASTORE FIX:
 *
 * The previous version only returned:
 *
 *   id
 *   _version
 *   _deleted
 *
 * The DataStore subscription expects the complete Order
 * model payload.
 *
 * We therefore request the complete scalar Order fields,
 * including:
 *
 *   userID
 *   createdAt
 *   updatedAt
 *   _lastChangedAt
 *
 * and the other model fields.
 * ============================================================
 */

async function deleteOrderRecord(order) {
  if (!order?.id) {
    throw new Error("Cannot delete an Order without an ID.");
  }

  const mutation = `
    mutation DeleteOrder(
      $input: DeleteOrderInput!
    ) {
      deleteOrder(input: $input) {
        ${ORDER_FIELDS}
      }
    }
  `;

  const input = {
    id: order.id,
  };

  /**
   * Use the exact version we read.
   *
   * This protects against deleting a stale version
   * of the Order.
   */
  if (order._version != null) {
    input._version = order._version;
  }

  const data = await graphqlRequest(mutation, {
    input,
  });

  return data?.deleteOrder || null;
}

/**
 * ============================================================
 * Lambda handler
 * ============================================================
 */

exports.handler = async (event) => {
  console.log("deleteOrder invoked:", JSON.stringify(event, null, 2));

  try {
    /**
     * --------------------------------------------------------
     * 1. Validate Lambda input
     * --------------------------------------------------------
     *
     * The custom GraphQL mutation is:
     *
     *   permanentlyDeleteOrder(orderID: ID!)
     *
     * Therefore the Lambda receives:
     *
     *   event.arguments.orderID
     * --------------------------------------------------------
     */

    const orderID = event?.arguments?.orderID;

    if (!orderID) {
      throw new Error("orderID is required.");
    }

    /**
     * --------------------------------------------------------
     * 2. Verify Cognito authentication
     * --------------------------------------------------------
     *
     * The custom GraphQL mutation itself is protected by
     * Cognito user-pool authentication.
     *
     * We still explicitly verify the identity here.
     * --------------------------------------------------------
     */

    const identity = event?.identity;

    const cognitoSub =
      identity?.sub || identity?.claims?.sub || identity?.username;

    if (!cognitoSub) {
      console.warn("deleteOrder called without a Cognito identity.");

      throw new Error("Authentication is required to delete an order.");
    }

    console.log("Authenticated Cognito sub:", cognitoSub);

    /**
     * --------------------------------------------------------
     * 3. Resolve the Atua User
     * --------------------------------------------------------
     */

    const user = await getUserByCognitoSub(cognitoSub);

    if (!user?.id) {
      throw new Error("Your Atua user account could not be found.");
    }

    console.log("Resolved Atua User:", user.id);

    /**
     * --------------------------------------------------------
     * 4. Get the latest Order
     * --------------------------------------------------------
     */

    const order = await getOrder(orderID);

    /**
     * --------------------------------------------------------
     * 5. Idempotency
     * --------------------------------------------------------
     *
     * If the Order has already been deleted, there is nothing
     * left to delete.
     *
     * Returning true makes a repeated delete request safe.
     * --------------------------------------------------------
     */

    if (!order) {
      console.log(
        `Order ${orderID} no longer exists. Treating delete as successful.`,
      );

      return true;
    }

    /**
     * --------------------------------------------------------
     * 6. Verify ownership
     * --------------------------------------------------------
     *
     * Order.userID stores the Atua User.id.
     *
     * The authenticated Cognito account was resolved above
     * to that same User.id.
     * --------------------------------------------------------
     */

    if (String(order.userID) !== String(user.id)) {
      console.warn("Unauthorized order deletion attempt:", {
        orderID,
        orderUserID: order.userID,
        authenticatedUserID: user.id,
      });

      throw new Error("You are not authorized to delete this order.");
    }

    /**
     * --------------------------------------------------------
     * 7. Check deletion eligibility
     * --------------------------------------------------------
     */

    const eligibility = getDeletionEligibility(order);

    console.log("Order deletion eligibility:", JSON.stringify(eligibility));

    if (!eligibility.allowed) {
      /**
       * Give the frontend a useful reason without exposing
       * sensitive internal information.
       */
      switch (eligibility.reason) {
        case "MAXI_ACCEPTED_PAID":
          throw new Error(
            "This paid Maxi order cannot be deleted. Please use the cancellation option to request a refund.",
          );

        case "MICRO_MOTO_ORDER_NOT_DELETABLE":
          throw new Error(
            "This delivery can no longer be deleted. Please use the cancellation option if cancellation is available.",
          );

        default:
          throw new Error("This order can no longer be deleted.");
      }
    }

    /**
     * --------------------------------------------------------
     * Save the version that we initially read.
     * --------------------------------------------------------
     *
     * We will compare this with the fresh Order read later.
     *
     * This is important because MAXI offer invalidation happens
     * before the final Order deletion.
     */

    const originalOrderVersion = order._version;

    /**
     * --------------------------------------------------------
     * 8. MAXI offer invalidation
     * --------------------------------------------------------
     *
     * MAXI orders can have multiple offers.
     *
     * Before deleting the Order, invalidate those offers so
     * courier applications do not continue to treat them as
     * active.
     *
     * We do NOT modify Courier.currentMaxiCount here because:
     *
     *   - BIDDING has not incremented the paid MAXI count.
     *
     *   - ACCEPTED + UNPAID has not incremented the paid MAXI
     *     count.
     *
     * The MAXI count reversal belongs to cancelOrder for:
     *
     *   ACCEPTED + PAID
     *
     * which this Lambda explicitly refuses to delete.
     * --------------------------------------------------------
     */

    if (isMaxi(order)) {
      const offerResult = await invalidateMaxiOffers(order.id);

      console.log("MAXI offers invalidated:", JSON.stringify(offerResult));
    }

    /**
     * --------------------------------------------------------
     * 9. IMPORTANT: Re-read the Order
     * --------------------------------------------------------
     *
     * We just changed Offer records.
     *
     * During that time, another operation could potentially
     * have changed the Order itself.
     *
     * Example:
     *
     *   User clicks Delete
     *         ↓
     *   Lambda reads BIDDING
     *         ↓
     *   Courier accepts / payment process changes Order
     *         ↓
     *   Lambda cancels old offers
     *         ↓
     *   Lambda tries to delete
     *
     * We MUST NOT delete the Order based only on our original
     * stale read.
     *
     * Therefore we read the Order again immediately before
     * deletion.
     * --------------------------------------------------------
     */

    const latestOrder = await getOrder(order.id);

    /**
     * The Order disappeared while we were processing.
     *
     * Treat this as successful because there is nothing left
     * to delete.
     */
    if (!latestOrder) {
      console.log(
        `Order ${order.id} no longer exists after offer invalidation.`,
      );

      return true;
    }

    /**
     * --------------------------------------------------------
     * 10. Re-check ownership
     * --------------------------------------------------------
     */

    if (String(latestOrder.userID) !== String(user.id)) {
      console.warn("Order ownership changed during deletion:", {
        orderID: order.id,
        latestOrderUserID: latestOrder.userID,
        authenticatedUserID: user.id,
      });

      throw new Error(
        "The order changed while it was being deleted. Please refresh your orders and try again.",
      );
    }

    /**
     * --------------------------------------------------------
     * 11. Re-check deletion eligibility
     * --------------------------------------------------------
     *
     * The Order must STILL satisfy the deletion rules.
     *
     * This is especially important for MAXI.
     *
     * If it changed from:
     *
     *   BIDDING
     *
     * to:
     *
     *   ACCEPTED + PAID
     *
     * we MUST NOT delete it.
     */

    const latestEligibility = getDeletionEligibility(latestOrder);

    console.log(
      "Latest Order deletion eligibility:",
      JSON.stringify(latestEligibility),
    );

    if (!latestEligibility.allowed) {
      switch (latestEligibility.reason) {
        case "MAXI_ACCEPTED_PAID":
          throw new Error(
            "This paid Maxi order can no longer be deleted. Please use the cancellation option to request a refund.",
          );

        case "MICRO_MOTO_ORDER_NOT_DELETABLE":
          throw new Error(
            "This delivery can no longer be deleted. Please use the cancellation option if cancellation is available.",
          );

        default:
          throw new Error(
            "The order changed while it was being deleted. Please refresh your orders and try again.",
          );
      }
    }

    /**
     * --------------------------------------------------------
     * 12. Verify Order version did not change
     * --------------------------------------------------------
     *
     * If AppSync versioning is enabled, the _version is the
     * strongest indicator that the Order changed.
     *
     * We compare the original version with the latest version.
     *
     * If they differ, do NOT delete.
     */

    if (
      originalOrderVersion != null &&
      latestOrder._version != null &&
      latestOrder._version !== originalOrderVersion
    ) {
      console.warn("Order version changed during deletion:", {
        orderID: order.id,
        originalVersion: originalOrderVersion,
        latestVersion: latestOrder._version,
      });

      throw new Error(
        "The order changed while it was being deleted. Please refresh your orders and try again.",
      );
    }

    /**
     * --------------------------------------------------------
     * 13. Delete the Order using the latest read
     * --------------------------------------------------------
     *
     * IMPORTANT:
     *
     * We use latestOrder, NOT the original order object.
     *
     * This ensures that the final delete uses the freshest
     * version that we verified.
     * --------------------------------------------------------
     */

    let deletedOrder;

    try {
      deletedOrder = await deleteOrderRecord(latestOrder);
    } catch (deleteError) {
      console.error("Order deletion failed:", deleteError);

      /**
       * Do NOT pretend deletion succeeded.
       *
       * This can happen if another process changed the Order
       * between our final read and the actual delete.
       *
       * AppSync's version check should reject the stale delete.
       */

      throw new Error(
        "The order changed while it was being deleted. Please refresh your orders and try again.",
      );
    }

    /**
     * --------------------------------------------------------
     * 14. Verify delete result
     * --------------------------------------------------------
     */

    if (!deletedOrder?.id) {
      throw new Error("The order could not be deleted.");
    }

    console.log(`Order ${orderID} deleted successfully.`);

    /**
     * --------------------------------------------------------
     * 15. Success
     * --------------------------------------------------------
     */

    return true;
  } catch (error) {
    console.error("DELETE ORDER ERROR:", error);

    /**
     * Throwing here causes AppSync to return the error to
     * the React Native client.
     *
     * The frontend can then show:
     *
     *   "Unable to Delete Order"
     *
     * instead of believing the order was deleted.
     */

    throw error;
  }
};
