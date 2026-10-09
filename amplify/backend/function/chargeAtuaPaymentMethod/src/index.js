/* ==========================================================
   AMPLIFY PARAMETERS
========================================================== */

/* Amplify Params - DO NOT EDIT

    API_ATUA_GRAPHQLAPIENDPOINTOUTPUT
    API_ATUA_GRAPHQLAPIIDOUTPUT
    API_ATUA_GRAPHQLAPIKEYOUTPUT
    ENV
    REGION

Amplify Params - DO NOT EDIT */

"use strict";

/* Amplify Params - DO NOT EDIT

    API_ATUA_GRAPHQLAPIENDPOINTOUTPUT
    API_ATUA_GRAPHQLAPIIDOUTPUT
    API_ATUA_GRAPHQLAPIKEYOUTPUT
    ENV
    REGION

Amplify Params - DO NOT EDIT */

/* ==========================================================
   IMPORTS
========================================================== */

const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

const https = require("https");

const crypto = require("crypto");

const { SignatureV4 } = require("@aws-sdk/signature-v4");

const { HttpRequest } = require("@aws-sdk/protocol-http");

const { defaultProvider } = require("@aws-sdk/credential-provider-node");

const { Sha256 } = require("@aws-crypto/sha256-js");

/* ==========================================================
   CONFIGURATION
========================================================== */

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const REGION = process.env.REGION || process.env.AWS_REGION;

/* ==========================================================
   GET PAYSTACK SECRET FROM SSM
========================================================== */

/**
 * PAYSTACK_SECRET_KEY is the name of the
 * Amplify-managed secret/SSM parameter.
 *
 * We NEVER store the actual Paystack secret key
 * in source code.
 *
 * Amplify provides the SSM parameter name through
 * the PAYSTACK_SECRET_KEY environment variable.
 */
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
   DETERMINE PAYSTACK ENVIRONMENT
========================================================== */

/**
 * Determines the Paystack environment from
 * the actual secret key used by this Lambda.
 *
 * IMPORTANT:
 *
 * This is completely separate from:
 *
 *     Order.orderEnvironment
 *
 * Order.orderEnvironment belongs to Atua and means:
 *
 *     TEST
 *     PRODUCTION
 *
 * Paystack environment means:
 *
 *     TEST
 *     LIVE
 *
 * We derive Paystack environment from the actual
 * secret key so that we never accidentally use a
 * TEST authorization with LIVE credentials or
 * a LIVE authorization with TEST credentials.
 *
 * sk_test_... -> TEST
 * sk_live_... -> LIVE
 */
const getPaystackEnvironment = (secretKey) => {
  if (typeof secretKey !== "string" || !secretKey.trim()) {
    throw new Error("Invalid Paystack secret key.");
  }

  if (secretKey.startsWith("sk_test_")) {
    return "TEST";
  }

  if (secretKey.startsWith("sk_live_")) {
    return "LIVE";
  }

  throw new Error("Invalid Paystack secret key format.");
};

/* ==========================================================
   GRAPHQL IAM REQUEST
========================================================== */

/**
 * IMPORTANT:
 *
 * PaymentMethod has:
 *
 *   allow: owner
 *   allow: private, provider: iam
 *
 * Therefore this Lambda must use IAM/SigV4
 * when reading PaymentMethod.
 *
 * We deliberately DO NOT use the public API key here.
 *
 * This gives the Lambda controlled backend access
 * to the GraphQL API.
 */
const graphqlRequestIAM = async ({
  query,
  variables = {},
  operationName = "GraphQL operation",
}) => {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error("Atua GraphQL endpoint is not configured.");
  }

  if (!REGION) {
    throw new Error("AWS region is not configured.");
  }

  const url = new URL(GRAPHQL_ENDPOINT);

  const body = JSON.stringify({
    query,
    variables,
  });

  const request = new HttpRequest({
    method: "POST",

    protocol: url.protocol,

    hostname: url.hostname,

    path: url.pathname || "/graphql",

    headers: {
      host: url.hostname,

      "content-type": "application/json",

      "content-length": String(Buffer.byteLength(body)),
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

  return new Promise((resolve, reject) => {
    const requestOptions = {
      hostname: signedRequest.hostname,

      port: signedRequest.port,

      path: signedRequest.path,

      method: signedRequest.method,

      headers: signedRequest.headers,
    };

    const req = https.request(requestOptions, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        let parsed;

        try {
          parsed = data ? JSON.parse(data) : {};
        } catch (error) {
          return reject(new Error(`${operationName} returned invalid JSON.`));
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          console.error(`${operationName} HTTP ERROR:`, {
            statusCode: res.statusCode,
          });

          return reject(
            new Error(`${operationName} returned HTTP ${res.statusCode}.`),
          );
        }

        if (parsed?.errors?.length) {
          console.error(
            `${operationName} GRAPHQL ERROR:`,
            JSON.stringify(
              parsed.errors.map((error) => ({
                message: error?.message,

                path: error?.path,
              })),
            ),
          );

          return reject(
            new Error(
              parsed.errors
                .map((error) => error?.message)
                .filter(Boolean)
                .join(" | ") || `${operationName} failed.`,
            ),
          );
        }

        resolve(parsed?.data || null);
      });
    });

    req.on("error", (error) => {
      console.error(`${operationName} REQUEST ERROR:`, error);

      reject(error);
    });

    req.write(body);

    req.end();
  });
};

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
        id

        userID

        totalPrice

        paymentStatus

        paymentID

        paymentReference

        orderEnvironment

        status

        transportationType

        _version

        _lastChangedAt

        _deleted
      }
    }
  `;

  const data = await graphqlRequestIAM({
    query,

    variables: {
      id: orderId,
    },

    operationName: "GetOrder",
  });

  return data?.getOrder || null;
};

/* ==========================================================
   GET PAYMENT METHOD
========================================================== */

/**
 * This query deliberately retrieves the authorization
 * code only inside the backend Lambda.
 *
 * The authorization code is NEVER returned to the frontend.
 *
 * IMPORTANT:
 *
 * We use:
 *
 *     paystackEnvironment
 *
 * NOT:
 *
 *     environment
 */
const getPaymentMethod = async (paymentMethodId) => {
  if (!paymentMethodId) {
    throw new Error("Payment method ID is required.");
  }

  const query = `
    query GetPaymentMethod(
      $id: ID!
    ) {
      getPaymentMethod(
        id: $id
      ) {
        id

        owner

        userID

        paystackEnvironment

        provider

        authorizationCode

        signature

        cardType

        last4

        expMonth

        expYear

        bank

        countryCode

        channel

        reusable

        email

        isDefault

        status

        deactivatedAt

        createdAt

        updatedAt
      }
    }
  `;

  const data = await graphqlRequestIAM({
    query,

    variables: {
      id: paymentMethodId,
    },

    operationName: "GetPaymentMethod",
  });

  return data?.getPaymentMethod || null;
};

/* ==========================================================
   GET CALLER COGNITO SUB
========================================================== */

/**
 * The frontend sends ONLY:
 *
 *   orderId
 *   paymentMethodId
 *
 * The Lambda gets the actual authenticated user's
 * Cognito sub from the AppSync identity.
 *
 * We NEVER trust a userID sent by the frontend.
 */
const getCallerSub = (event) => {
  const identity = event?.identity || null;

  const claims = identity?.claims || {};

  return claims?.sub || identity?.sub || null;
};

/* ==========================================================
   GENERATE PAYSTACK REFERENCE
========================================================== */

/**
 * Paystack references only allow:
 *
 *   alphanumeric
 *   -
 *   .
 *   =
 *
 * So we sanitize the Order ID before putting it
 * into the reference.
 */
const generatePaystackReference = (orderId) => {
  const sanitizedOrderId = String(orderId)
    .replace(/[^a-zA-Z0-9.\-=]/g, "-")
    .slice(0, 70);

  const randomPart = crypto.randomBytes(8).toString("hex");

  return `atua-saved-${sanitizedOrderId}-${Date.now()}-${randomPart}`;
};

/* ==========================================================
   PAYSTACK POST REQUEST
========================================================== */

/**
 * Makes a backend-only POST request to Paystack.
 *
 * The Paystack secret key NEVER leaves this Lambda.
 */
const paystackPost = async ({ path, body, secretKey }) => {
  if (!secretKey) {
    throw new Error("Paystack secret key is required.");
  }

  const requestBody = JSON.stringify(body);

  const options = {
    hostname: "api.paystack.co",

    path,

    method: "POST",

    headers: {
      Authorization: `Bearer ${secretKey}`,

      "Content-Type": "application/json",

      Accept: "application/json",

      "Content-Length": Buffer.byteLength(requestBody),
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
          parsed = data ? JSON.parse(data) : {};
        } catch (error) {
          console.error("PAYSTACK RESPONSE JSON ERROR:", {
            statusCode: res.statusCode,
          });

          return reject(new Error("Paystack returned invalid JSON."));
        }

        /**
         * IMPORTANT:
         *
         * Never log the entire Paystack
         * response because it may contain
         * authorization/customer data.
         */

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

    request.write(requestBody);

    request.end();
  });
};

/* ==========================================================
   VALIDATE PAYSTACK SUCCESS RESPONSE
========================================================== */

/**
 * Paystack Charge Authorization expects the amount
 * in the currency's smallest unit.
 *
 * For NGN:
 *
 *   ₦1,000
 *
 * becomes:
 *
 *   100000 kobo
 */
const validatePaystackChargeResponse = ({
  response,
  expectedAmountSubunit,
}) => {
  const body = response?.body || {};

  const transaction = body?.data || null;

  if (response?.statusCode < 200 || response?.statusCode >= 300) {
    return {
      success: false,

      pending: false,

      message: body?.message || "Paystack rejected the saved-card charge.",

      transaction: null,
    };
  }

  if (body?.status !== true) {
    return {
      success: false,

      pending: false,

      message:
        body?.message || "Paystack could not process the saved-card charge.",

      transaction,
    };
  }

  if (!transaction) {
    return {
      success: false,

      pending: false,

      message: "Paystack returned no transaction data.",

      transaction: null,
    };
  }

  const transactionStatus = String(transaction.status || "").toLowerCase();

  /**
   * A successful charge must have a reference.
   */
  if (transactionStatus === "success" && !transaction.reference) {
    return {
      success: false,

      pending: false,

      message:
        "Paystack reported success but returned no transaction reference.",

      transaction,
    };
  }

  /**
   * Verify that Paystack charged exactly the
   * amount Atua requested.
   *
   * This is an important backend safety check.
   */
  if (transactionStatus === "success") {
    const actualAmount = Number(transaction.amount);

    if (
      !Number.isFinite(actualAmount) ||
      actualAmount !== expectedAmountSubunit
    ) {
      console.error("PAYSTACK AMOUNT MISMATCH:", {
        expectedAmountSubunit,

        actualAmount,

        reference: transaction.reference || null,
      });

      return {
        success: false,

        pending: false,

        message: "Paystack returned an unexpected transaction amount.",

        transaction,
      };
    }

    return {
      success: true,

      pending: false,

      message: "Saved card charged successfully.",

      transaction,
    };
  }

  /**
   * Paystack can return a non-success state.
   *
   * IMPORTANT:
   *
   * We do NOT immediately attempt another charge.
   *
   * A transaction that is still processing must not
   * be blindly retried because that could create
   * duplicate charges.
   */
  if (transactionStatus === "pending") {
    return {
      success: false,

      pending: true,

      message:
        "The saved-card payment is still processing. Do not retry the charge.",

      transaction,
    };
  }

  return {
    success: false,

    pending: false,

    message:
      transaction.gateway_response ||
      transaction.message ||
      body.message ||
      "The saved-card payment was not successful.",

    transaction,
  };
};

/* ==========================================================
   MAIN HANDLER
========================================================== */

exports.handler = async (event) => {
  console.log("==========================================");

  console.log("CHARGE ATUA PAYMENT METHOD STARTED");

  console.log("==========================================");

  try {
    /* ======================================================
       1. GET GRAPHQL ARGUMENTS
    ====================================================== */

    const { orderId, paymentMethodId } = event?.arguments || {};

    if (!orderId) {
      throw new Error("Order ID is required.");
    }

    if (!paymentMethodId) {
      throw new Error("Payment method ID is required.");
    }

    console.log("SAVED CARD PAYMENT REQUEST:", {
      orderId,

      paymentMethodId,
    });

    /* ======================================================
       2. GET AUTHENTICATED USER
    ====================================================== */

    const callerSub = getCallerSub(event);

    if (!callerSub) {
      throw new Error("Authenticated user could not be identified.");
    }

    /**
     * We intentionally do NOT log the actual Cognito sub.
     *
     * It is sensitive user identity information and is
     * not needed in normal CloudWatch logs.
     */
    console.log("AUTHENTICATED USER CONFIRMED.");

    /* ======================================================
       3. GET ORDER
    ====================================================== */

    const order = await getOrder(orderId);

    if (!order) {
      throw new Error("Order could not be found.");
    }

    if (order._deleted) {
      throw new Error("Order has been deleted.");
    }

    if (!order.userID) {
      throw new Error("Order does not have a user ID.");
    }

    /**
     * We still require orderEnvironment because it is part
     * of Atua's own operational order separation.
     *
     * IMPORTANT:
     *
     * This value is NOT used to determine Paystack TEST/LIVE.
     */
    if (!order.orderEnvironment) {
      throw new Error("Order does not have an environment.");
    }

    /* ======================================================
       4. PREVENT DUPLICATE CHARGES
    ====================================================== */

    if (order.paymentStatus === "PAID") {
      console.log("ORDER ALREADY PAID:", {
        orderId: order.id,

        paymentID: order.paymentID,

        paymentReference: order.paymentReference || null,
      });

      return {
        success: true,

        message: "This order has already been paid.",

        reference: order.paymentReference || null,

        orderId: order.id,
      };
    }

    /**
     * Do not allow a second saved-card charge while
     * another payment is already being processed.
     */
    if (order.paymentStatus === "PROCESSING") {
      throw new Error(
        "This order already has a payment being processed. Please wait for confirmation before trying again.",
      );
    }

    /* ======================================================
       5. DO NOT CHARGE CANCELLED ORDERS
    ====================================================== */

    if (order.status === "CANCELLED" || order.status === "DISPUTED") {
      throw new Error(
        `This order cannot be paid because its current status is ${order.status}.`,
      );
    }

    /* ======================================================
       6. GET SAVED PAYMENT METHOD
    ====================================================== */

    const paymentMethod = await getPaymentMethod(paymentMethodId);

    if (!paymentMethod) {
      throw new Error("Saved payment method could not be found.");
    }

    /* ======================================================
       7. VERIFY PAYMENT METHOD OWNER
    ====================================================== */

    /**
     * PaymentMethod.owner is the Cognito sub.
     *
     * We compare it directly with the authenticated
     * caller's Cognito sub.
     */
    if (paymentMethod.owner !== callerSub) {
      console.error("PAYMENT METHOD OWNERSHIP VALIDATION FAILED.");

      throw new Error(
        "This saved payment method does not belong to the authenticated user.",
      );
    }

    /* ======================================================
       8. VERIFY ORDER OWNER
    ====================================================== */

    /**
     * PaymentMethod.userID is the Atua User.id.
     *
     * Order.userID must point to the same Atua User.
     */
    if (paymentMethod.userID !== order.userID) {
      console.error("ORDER/PAYMENT METHOD USER MISMATCH.");

      throw new Error(
        "The saved payment method does not belong to the user who owns this order.",
      );
    }

    /* ======================================================
       9. VERIFY PAYSTACK ENVIRONMENT
    ====================================================== */

    /**
     * IMPORTANT:
     *
     * Paystack TEST/LIVE is completely separate from
     * Atua's Order.orderEnvironment TEST/PRODUCTION value.
     *
     * PaymentMethod.paystackEnvironment tells us which
     * Paystack environment owns this saved authorization.
     *
     * We determine the environment of this Lambda from
     * the actual Paystack secret key that will perform
     * the charge.
     *
     * Therefore:
     *
     *   sk_test_... -> TEST
     *   sk_live_... -> LIVE
     *
     * This prevents:
     *
     *   TEST authorization + LIVE credentials
     *
     * and:
     *
     *   LIVE authorization + TEST credentials
     */

    if (!paymentMethod.paystackEnvironment) {
      throw new Error(
        "This saved payment method is missing its Paystack environment. Please add the card again before using it.",
      );
    }

    /**
     * Retrieve the actual Paystack secret.
     *
     * We do this BEFORE charging because the Paystack
     * environment must be derived from the same credential
     * that will perform the actual charge.
     */
    const secretKey = await getPaystackSecretKey();

    const currentPaystackEnvironment = getPaystackEnvironment(secretKey);

    if (paymentMethod.paystackEnvironment !== currentPaystackEnvironment) {
      console.warn("Paystack environment mismatch for saved card.", {
        paymentMethodId,

        paymentMethodPaystackEnvironment: paymentMethod.paystackEnvironment,

        currentPaystackEnvironment,
      });

      throw new Error(
        "This saved payment method belongs to a different Paystack environment and cannot be used with the current payment configuration.",
      );
    }

    console.log("PAYSTACK ENVIRONMENT VALIDATED:", {
      paymentMethodId,

      paystackEnvironment: currentPaystackEnvironment,
    });

    /* ======================================================
       10. VERIFY PAYMENT METHOD STATUS
    ====================================================== */

    if (paymentMethod.status !== "ACTIVE") {
      throw new Error("This saved payment method is not active.");
    }

    /* ======================================================
       11. VERIFY REUSABLE AUTHORIZATION
    ====================================================== */

    if (paymentMethod.reusable !== true) {
      throw new Error("This saved payment method is not reusable.");
    }

    if (!paymentMethod.authorizationCode) {
      throw new Error(
        "This saved payment method has no Paystack authorization.",
      );
    }

    if (!paymentMethod.email) {
      throw new Error(
        "This saved payment method has no Paystack customer email.",
      );
    }

    if (paymentMethod.provider !== "PAYSTACK") {
      throw new Error("This payment method is not a Paystack payment method.");
    }

    /* ======================================================
       12. VALIDATE ORDER AMOUNT
    ====================================================== */

    const orderAmount = Number(order.totalPrice);

    if (!Number.isFinite(orderAmount) || orderAmount <= 0) {
      throw new Error(`Order has an invalid totalPrice: ${order.totalPrice}`);
    }

    /**
     * Paystack expects the amount in the smallest
     * currency unit.
     *
     * Atua Order.totalPrice is stored as the normal
     * NGN amount.
     *
     * Example:
     *
     * ₦5,000
     *
     * becomes:
     *
     * 500000 kobo
     */
    const amountSubunit = Math.round(orderAmount * 100);

    if (!Number.isSafeInteger(amountSubunit) || amountSubunit <= 0) {
      throw new Error(
        "Order amount could not be safely converted to Paystack subunits.",
      );
    }

    /* ======================================================
       13. PAYSTACK SECRET ALREADY VALIDATED
    ====================================================== */

    /**
     * secretKey was retrieved and validated in section 9.
     *
     * It remains backend-only.
     *
     * It is NEVER:
     *
     * - returned to the frontend
     * - written to logs
     * - stored in the Order
     * - stored in PaymentMethod
     */

    /* ======================================================
       14. CREATE UNIQUE PAYSTACK REFERENCE
    ====================================================== */

    const reference = generatePaystackReference(order.id);

    /**
     * IMPORTANT:
     *
     * Never log the authorizationCode.
     */
    console.log("PAYSTACK SAVED-CARD CHARGE PREPARED:", {
      orderId: order.id,

      paymentMethodId,

      amount: orderAmount,

      currency: "NGN",

      reference,

      last4: paymentMethod.last4 || null,

      paystackEnvironment: paymentMethod.paystackEnvironment,
    });

    /* ======================================================
       15. CHARGE SAVED AUTHORIZATION
    ====================================================== */

    /**
     * Paystack's Charge Authorization API requires:
     *
     *   email
     *   amount
     *   authorization_code
     *
     * We also send:
     *
     *   reference
     *   currency
     *
     * The authorization code is obtained ONLY from the
     * backend PaymentMethod record.
     */
    const paystackResponse = await paystackPost({
      path: "/transaction/charge_authorization",

      secretKey,

      body: {
        email: paymentMethod.email,

        amount: String(amountSubunit),

        authorization_code: paymentMethod.authorizationCode,

        reference,

        currency: "NGN",

        metadata: JSON.stringify({
          orderId: order.id,

          paymentMethodId,

          /**
           * IMPORTANT:
           *
           * This is Atua's operational environment.
           *
           * It is intentionally kept as metadata,
           * but it is NOT used to determine Paystack
           * TEST/LIVE.
           */
          orderEnvironment: order.orderEnvironment,
        }),
      },
    });

    /* ======================================================
       16. VALIDATE PAYSTACK RESPONSE
    ====================================================== */

    const chargeResult = validatePaystackChargeResponse({
      response: paystackResponse,

      expectedAmountSubunit: amountSubunit,
    });

    /* ======================================================
       17. HANDLE PAYSTACK FAILURE
    ====================================================== */

    if (!chargeResult.success) {
      /**
       * IMPORTANT:
       *
       * If Paystack says pending, we do NOT automatically
       * try the card again.
       *
       * That protects the customer from duplicate charges.
       */
      console.error("PAYSTACK SAVED-CARD CHARGE NOT SUCCESSFUL:", {
        orderId: order.id,

        paymentMethodId,

        pending: chargeResult.pending,

        message: chargeResult.message,

        reference: chargeResult.transaction?.reference || reference,
      });

      return {
        success: false,

        message: chargeResult.message,

        reference: chargeResult.transaction?.reference || reference,

        orderId: order.id,
      };
    }

    /* ======================================================
       18. SUCCESS
    ====================================================== */

    const transaction = chargeResult.transaction;

    /**
     * IMPORTANT:
     *
     * We do NOT create Payment here.
     *
     * We do NOT manually mark Order as PAID here.
     *
     * We do NOT increment MAXI courier count here.
     *
     * Paystack will send charge.success to your existing
     * paystackwebhook, which already owns that finalization
     * flow.
     *
     * This prevents two different Lambdas from competing
     * to finalize the same payment.
     */

    console.log("PAYSTACK SAVED-CARD CHARGE SUCCESSFUL:", {
      orderId: order.id,

      reference: transaction.reference,

      amount: transaction.amount,

      currency: transaction.currency,

      status: transaction.status,

      last4: paymentMethod.last4 || null,

      paystackEnvironment: paymentMethod.paystackEnvironment,
    });

    return {
      success: true,

      message:
        "Payment charged successfully. Payment confirmation is being processed.",

      reference: transaction.reference,

      orderId: order.id,
    };
  } catch (error) {
    console.error("==========================================");

    console.error("CHARGE ATUA PAYMENT METHOD ERROR");

    console.error("MESSAGE:", error?.message || error);

    console.error("STACK:", error?.stack);

    console.error("==========================================");

    return {
      success: false,

      message: error?.message || "Unable to charge the saved payment method.",

      reference: null,

      orderId: event?.arguments?.orderId || null,
    };
  }
};
