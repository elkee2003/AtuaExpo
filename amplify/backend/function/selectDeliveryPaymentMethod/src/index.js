/*
 * SELECT DELIVERY PAYMENT METHOD LAMBDA
 *
 * Purpose:
 * Allows the courier assigned to an order to select how the receiver
 * will pay when the order is being delivered.
 *
 * Supported payment methods:
 * - CASH: The receiver pays the courier with physical cash.
 * - PAYSTACK: The receiver pays electronically through Paystack.
 *
 * Security and validation:
 * 1. Requires an authenticated user.
 * 2. Verifies that the authenticated user has a valid courier account.
 * 3. Confirms that the courier is assigned to the requested order.
 * 4. Allows selection only at the delivery stage.
 * 5. Confirms that the order uses receiver payment on delivery.
 * 6. Prevents changing the method after payment has started.
 * 7. Uses the order's DataStore/AppSync version to help prevent
 *    overwriting a concurrent update.
 *
 * Important:
 * This Lambda selects the payment method. It does not collect cash,
 * initialize a Paystack transaction, or verify a payment.
 */

// AppSync GraphQL endpoint configured for this Lambda.
const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

// AppSync API key used to authorize GraphQL requests.
// This approach assumes the API permits API-key authentication
// for the operations called by this Lambda.
const GRAPHQL_API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

/*
 * NORMALIZE
 *
 * Converts a value to a trimmed, uppercase string.
 *
 * This makes comparisons consistent when values have different
 * casing or contain accidental surrounding spaces.
 *
 * Examples:
 * normalize("cash")       -> "CASH"
 * normalize(" Paystack ") -> "PAYSTACK"
 * normalize(null)         -> ""
 */
function normalize(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

/*
 * MAKE RESULT
 *
 * Creates a consistent response object for both successful and
 * unsuccessful operations.
 *
 * orderId and paymentMethod default to null when they are unavailable.
 */
function makeResult(success, message, orderId = null, paymentMethod = null) {
  return {
    success,
    message,
    orderId,
    paymentMethod,
  };
}

/*
 * GRAPHQL REQUEST
 *
 * Sends a GraphQL query or mutation to the configured AppSync API.
 *
 * Parameters:
 * - query: GraphQL query or mutation string.
 * - variables: Variables required by the GraphQL operation.
 * - operationName: Name of the GraphQL operation, used for logging.
 *
 * The function:
 * 1. Checks that the required environment variables exist.
 * 2. Sends the request to AppSync.
 * 3. Parses the JSON response.
 * 4. Throws an error if the HTTP request or GraphQL operation fails.
 * 5. Returns the GraphQL data when successful.
 */
async function graphqlRequest(query, variables = {}, operationName) {
  // Fail immediately if this Lambda has not been configured correctly.
  if (!GRAPHQL_ENDPOINT || !GRAPHQL_API_KEY) {
    throw new Error("Atua GraphQL configuration is missing.");
  }

  // Send the GraphQL operation to AWS AppSync.
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",

      // AppSync API-key authentication.
      "x-api-key": GRAPHQL_API_KEY,
    },

    // Include the operation, its variables, and its name.
    body: JSON.stringify({
      query,
      variables,
      operationName,
    }),
  });

  let result;

  // Parse AppSync's response body as JSON.
  try {
    result = await response.json();
  } catch {
    // This catches responses that are not valid JSON.
    throw new Error("Atua GraphQL returned an invalid response.");
  }

  /*
   * An HTTP response can succeed while the GraphQL operation fails.
   * Therefore, check both the HTTP status and GraphQL errors.
   */
  if (!response.ok || result.errors?.length) {
    console.error(
      `GraphQL operation failed: ${operationName}`,
      result.errors || response.status,
    );

    // Avoid exposing internal GraphQL details in the user-facing error.
    throw new Error("Unable to access or update the order.");
  }

  // Return only the data produced by the GraphQL operation.
  return result.data;
}

/*
 * GET COURIER BY SUB
 *
 * Finds the courier record associated with the authenticated user's
 * Cognito subject (sub).
 *
 * The Cognito sub identifies the authenticated identity. The Lambda
 * uses it to locate the corresponding Courier record rather than
 * trusting a courier ID supplied by the caller.
 *
 * A limit of 2 helps detect duplicate matching records: the function
 * expects exactly one valid courier record.
 */
async function getCourierBySub(sub) {
  const query = `
    query GetCourierBySub($sub: String!, $limit: Int) {
      couriersBySub(sub: $sub, limit: $limit) {
        items {
          id
          sub
          isBlocked
        }
      }
    }
  `;

  // Request at most two matching records so duplicates can be detected.
  const data = await graphqlRequest(
    query,
    {
      sub,
      limit: 2,
    },
    "GetCourierBySub",
  );

  // Safely obtain the returned courier records.
  const couriers = data?.couriersBySub?.items || [];

  /*
   * Reject the account if:
   * - No courier record was found.
   * - More than one matching record was found.
   * - The returned record does not match the authenticated sub.
   * - The courier account is blocked.
   *
   * Returning null lets the caller handle all these cases uniformly.
   */
  if (
    couriers.length !== 1 ||
    couriers[0]?.sub !== sub ||
    couriers[0]?.isBlocked === true
  ) {
    return null;
  }

  // Return the verified courier record.
  return couriers[0];
}

/*
 * GET ORDER
 *
 * Retrieves the order fields needed to decide whether payment-method
 * selection is allowed.
 *
 * The query includes:
 * - Order status and assigned courier.
 * - Payment responsibility and timing.
 * - Existing payment method and payment status.
 * - Payment IDs/references that indicate a payment attempt exists.
 * - Cash collection status.
 * - AppSync's _version for concurrency protection.
 */
async function getOrder(orderId) {
  const query = `
    query GetOrderForPaymentChoice($id: ID!) {
      getOrder(id: $id) {
        id
        status
        assignedCourierId
        paymentResponsibility
        paymentTiming
        paymentMethod
        paymentStatus
        paymentID
        paymentReference
        cashCollectionStatus
        _version
      }
    }
  `;

  // Fetch the order using the supplied order ID.
  const data = await graphqlRequest(
    query,
    {
      id: orderId,
    },
    "GetOrderForPaymentChoice",
  );

  // Return the order, or null if AppSync did not find it.
  return data?.getOrder || null;
}

/*
 * SAVE PAYMENT METHOD
 *
 * Updates the order with the selected payment method.
 *
 * The _version field is included when available. With an appropriately
 * configured versioned AppSync data source, this helps detect concurrent
 * updates rather than silently overwriting a newer order version.
 *
 * Note:
 * The version check is only effective if the underlying AppSync model
 * and resolver support the expected version-conflict behavior.
 */
async function savePaymentMethod(orderId, paymentMethod, version) {
  const mutation = `
    mutation SaveDeliveryPaymentMethod($input: UpdateOrderInput!) {
      updateOrder(input: $input) {
        id
        paymentMethod
        _version
      }
    }
  `;

  // These are the fields this Lambda intends to change.
  const input = {
    id: orderId,
    paymentMethod,
  };

  /*
   * Include the version from the order we previously read.
   * If another operation updates the order first, a configured
   * version-conflict mechanism can reject this stale update.
   */
  if (Number.isInteger(version)) {
    input._version = version;
  }

  // Execute the update mutation.
  const data = await graphqlRequest(
    mutation,
    {
      input,
    },
    "SaveDeliveryPaymentMethod",
  );

  // Return the updated order, or null if the mutation returned no order.
  return data?.updateOrder || null;
}

/*
 * MAIN LAMBDA HANDLER
 *
 * This is the entry point invoked by AWS Lambda.
 *
 * Expected arguments:
 * {
 *   orderId: "order-id",
 *   paymentMethod: "CASH" | "PAYSTACK"
 * }
 *
 * The authenticated identity must come from the AppSync event,
 * not from values supplied in the mutation arguments.
 */
exports.handler = async (event) => {
  // Keep the order ID available for error responses and logging.
  let orderId = null;

  try {
    // AppSync passes GraphQL mutation arguments under event.arguments.
    const args = event?.arguments || {};

    /*
     * Validate and clean the order ID.
     * A non-string value is rejected rather than converted implicitly.
     */
    orderId = typeof args.orderId === "string" ? args.orderId.trim() : "";

    // Normalize the requested method to uppercase.
    const requestedMethod = normalize(args.paymentMethod);

    /*
     * AUTHENTICATION CHECK
     *
     * Obtain the Cognito sub from the AppSync identity.
     * Depending on the AppSync authentication mode and event shape,
     * the subject may be available directly or in the claims object.
     *
     * This assumes the AppSync mutation is configured to require
     * Cognito authentication.
     */
    const sub = event?.identity?.sub || event?.identity?.claims?.sub;

    // Reject unauthenticated requests.
    if (typeof sub !== "string" || !sub.trim()) {
      return makeResult(
        false,
        "You must be signed in to select a payment method.",
        orderId || null,
      );
    }

    /*
     * INPUT VALIDATION
     *
     * Only CASH and PAYSTACK are accepted.
     * Reject invalid methods before making GraphQL requests.
     */
    if (!orderId || !["CASH", "PAYSTACK"].includes(requestedMethod)) {
      return makeResult(
        false,
        "A valid order and payment method are required.",
        orderId || null,
      );
    }

    /*
     * VERIFY COURIER
     *
     * Find the courier record associated with the authenticated
     * Cognito user and confirm that the account is not blocked.
     */
    const courier = await getCourierBySub(sub);

    if (!courier) {
      return makeResult(
        false,
        "Your courier account could not be verified.",
        orderId,
      );
    }

    /*
     * LOAD ORDER
     *
     * Retrieve the order before changing any payment-related field.
     */
    const order = await getOrder(orderId);

    if (!order) {
      return makeResult(false, "Order not found.", orderId);
    }

    /*
     * ASSIGNMENT AUTHORIZATION
     *
     * Only the courier currently assigned to the order can select
     * the receiver's payment method.
     *
     * Do not trust a courier ID passed by the client. Compare the
     * assigned courier ID with the verified courier record.
     */
    if (order.assignedCourierId !== courier.id) {
      return makeResult(
        false,
        "Only the assigned courier can select the payment method.",
        orderId,
      );
    }

    /*
     * DELIVERY-STAGE CHECK
     *
     * The payment choice can only be made when the courier has
     * arrived at the drop-off point or is unloading the delivery.
     *
     * Normalization allows comparisons regardless of casing.
     */
    if (!["ARRIVED_DROPOFF", "UNLOADING"].includes(normalize(order.status))) {
      return makeResult(
        false,
        "Payment can only be selected at the delivery stage.",
        orderId,
      );
    }

    /*
     * PAYMENT RESPONSIBILITY AND TIMING CHECK
     *
     * This Lambda handles only orders where:
     * - The receiver is responsible for payment.
     * - Payment is due on delivery.
     *
     * It should not change payment methods for orders configured
     * for sender payment, payment at pickup, or another flow.
     */
    if (
      normalize(order.paymentResponsibility) !== "RECEIVER" ||
      normalize(order.paymentTiming) !== "ON_DELIVERY"
    ) {
      return makeResult(
        false,
        "This order does not use receiver payment on delivery.",
        orderId,
      );
    }

    /*
     * COMPLETED-PAYMENT CHECK
     *
     * Do not change the payment method if:
     * - The order's payment status is already PAID, or
     * - Cash collection has already been confirmed.
     *
     * Return the existing payment method, when available, to help
     * the caller understand the current order state.
     */
    if (
      normalize(order.paymentStatus) === "PAID" ||
      normalize(order.cashCollectionStatus) === "CONFIRMED"
    ) {
      return makeResult(
        false,
        "Payment has already been completed.",
        orderId,
        normalize(order.paymentMethod) || null,
      );
    }

    /*
     * EXISTING PAYMENT ATTEMPT CHECK
     *
     * If a payment ID or reference already exists, a payment attempt
     * may have been initialized.
     *
     * Do not change the payment method in that situation. The existing
     * payment should be verified before any further action is taken.
     */
    if (order.paymentID || order.paymentReference) {
      return makeResult(
        false,
        "A payment attempt already exists. Verify its status before continuing.",
        orderId,
        normalize(order.paymentMethod) || null,
      );
    }

    // Normalize the payment method already saved on the order.
    const existingMethod = normalize(order.paymentMethod);

    /*
     * PAYMENT-METHOD CHANGE RULES
     *
     * Allow CASH -> PAYSTACK only when:
     * - Payment has not been completed.
     * - Cash collection has not been confirmed.
     * - No payment ID or reference exists.
     *
     * The earlier validation checks already enforce these conditions.
     * Do not allow PAYSTACK -> CASH or any other method change.
     */
    if (existingMethod && existingMethod !== requestedMethod) {
      const canSwitchCashToPaystack =
        existingMethod === "CASH" && requestedMethod === "PAYSTACK";

      if (!canSwitchCashToPaystack) {
        return makeResult(
          false,
          "A different payment method has already been selected.",
          orderId,
          existingMethod,
        );
      }
    }

    /*
     * IDEMPOTENT RETRY
     *
     * If the requested method is already saved, return success without
     * writing to the database again.
     *
     * This supports repeated requests caused by retries, slow networks,
     * or a client that did not receive the previous response.
     */
    if (existingMethod === requestedMethod) {
      return makeResult(
        true,
        requestedMethod === "CASH"
          ? "Cash is already selected."
          : "Electronic payment is already selected.",
        orderId,
        requestedMethod,
      );
    }

    /*
     * SAVE THE METHOD
     *
     * At this point, all validation checks have passed and no existing
     * payment method has been selected.
     *
     * Pass the version read from the order so the configured AppSync
     * version-conflict mechanism can help protect against stale updates.
     */
    const updated = await savePaymentMethod(
      orderId,
      requestedMethod,
      order._version,
    );

    /*
     * VERIFY THE WRITE
     *
     * Do not assume the mutation succeeded merely because it returned.
     * Confirm that:
     * - The returned order ID matches the requested order.
     * - The returned payment method matches the requested method.
     */
    if (
      updated?.id !== orderId ||
      normalize(updated.paymentMethod) !== requestedMethod
    ) {
      return makeResult(
        false,
        "The payment choice could not be confirmed. Refresh the order and try again.",
        orderId,
      );
    }

    /*
     * SUCCESS RESPONSE
     *
     * CASH:
     * Remind the courier to confirm collection only after physically
     * receiving the cash from the receiver.
     *
     * PAYSTACK:
     * Tell the caller that electronic payment is selected and the next
     * step is to generate the Paystack checkout link for the receiver.
     *
     * This Lambda does not perform either of those next steps itself.
     */
    return makeResult(
      true,
      requestedMethod === "CASH"
        ? "Cash selected. Confirm collection only after physically receiving the cash."
        : "Electronic payment selected. Generate the Paystack checkout link for the receiver.",
      orderId,
      requestedMethod,
    );
  } catch (error) {
    /*
     * ERROR HANDLING
     *
     * Log the technical error for investigation in CloudWatch.
     * Return a generic message to the caller instead of exposing
     * internal GraphQL responses, configuration, or stack traces.
     */
    console.error("SELECT DELIVERY PAYMENT METHOD ERROR:", error);

    return makeResult(
      false,
      "Unable to save the payment choice. Please refresh the order and try again.",
      orderId || null,
    );
  }
};
