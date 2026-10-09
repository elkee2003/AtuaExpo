/**
 * deletePaymentMethod Lambda
 *
 * Purpose:
 *
 * 1. Authenticate the caller.
 * 2. Load the requested PaymentMethod.
 * 3. Verify that the PaymentMethod belongs to the caller.
 * 4. Verify that it is a Paystack reusable authorization.
 * 5. Deactivate the authorization at Paystack.
 * 6. Mark the local PaymentMethod as INACTIVE.
 * 7. Remove it as the default card.
 * 8. Promote another ACTIVE card from the SAME Paystack environment
 *    to default if necessary.
 *
 * IMPORTANT:
 *
 * - The Paystack secret is retrieved from AWS SSM.
 * - The Paystack authorization code is used only inside Lambda.
 * - The authorization code is NEVER returned to the frontend.
 * - We never store raw card numbers, CVV, PIN, etc.
 * - We do NOT physically delete the PaymentMethod record.
 *
 * AppSync permissions required:
 *
 * - Query
 * - Mutation
 *
 * Secret required:
 *
 * - PAYSTACK_SECRET_KEY
 */

const https = require("https");

const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

const { SignatureV4 } = require("@aws-sdk/signature-v4");

const { HttpRequest } = require("@aws-sdk/protocol-http");

const { defaultProvider } = require("@aws-sdk/credential-provider-node");

const { Sha256 } = require("@aws-crypto/sha256-js");

// ============================================================
// CONFIGURATION
// ============================================================

const REGION = process.env.REGION || process.env.AWS_REGION;

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const PAYSTACK_SECRET_PARAMETER = process.env.PAYSTACK_SECRET_KEY;

// ============================================================
// BASIC CONFIGURATION VALIDATION
// ============================================================

if (!REGION) {
  console.warn("WARNING: AWS region was not found.");
}

if (!GRAPHQL_ENDPOINT) {
  console.warn("WARNING: API_ATUA_GRAPHQLAPIENDPOINTOUTPUT is not configured.");
}

if (!PAYSTACK_SECRET_PARAMETER) {
  console.warn(
    "WARNING: PAYSTACK_SECRET_KEY secret parameter is not configured.",
  );
}

// ============================================================
// AWS SSM CLIENT
// ============================================================

const ssmClient = new SSMClient({
  region: REGION,
});

// ============================================================
// GET PAYSTACK SECRET
// ============================================================

/**
 * Gets PAYSTACK_SECRET_KEY from AWS Systems Manager.
 *
 * The actual secret value is never logged.
 */
async function getPaystackSecretKey() {
  if (!PAYSTACK_SECRET_PARAMETER) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  }

  const command = new GetParameterCommand({
    Name: PAYSTACK_SECRET_PARAMETER,
    WithDecryption: true,
  });

  const response = await ssmClient.send(command);

  const secret = response && response.Parameter && response.Parameter.Value;

  if (!secret) {
    throw new Error("Unable to retrieve PAYSTACK_SECRET_KEY from AWS SSM.");
  }

  return secret;
}

// ============================================================
// DETERMINE PAYSTACK ENVIRONMENT
// ============================================================

/**
 * Determines whether the Lambda is currently configured
 * to communicate with Paystack TEST or LIVE.
 *
 * IMPORTANT:
 *
 * This is completely separate from:
 *
 * Order.orderEnvironment
 *
 * Order.orderEnvironment is Atua's own operational
 * TEST/PRODUCTION distinction.
 *
 * This function determines the actual Paystack account
 * environment from the secret key.
 *
 * sk_test_... -> TEST
 * sk_live_... -> LIVE
 */
function getPaystackEnvironment(secretKey) {
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
}

// ============================================================
// APPSYNC IAM REQUEST
// ============================================================

/**
 * Sends a signed IAM request to AppSync.
 *
 * This Lambda requires Query + Mutation access
 * to the Atua AppSync API.
 */
async function graphqlRequestIAM(query, variables = {}) {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error("AppSync GraphQL endpoint is not configured.");
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
    path: url.pathname,

    headers: {
      "Content-Type": "application/json",

      host: url.hostname,
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

  const response = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: signedRequest.hostname,

        path: signedRequest.path,

        method: signedRequest.method,

        headers: signedRequest.headers,
      },

      (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,

            body: data,
          });
        });
      },
    );

    req.on("error", reject);

    req.write(signedRequest.body);

    req.end();
  });

  let parsed;

  try {
    parsed = JSON.parse(response.body);
  } catch (error) {
    throw new Error(
      `AppSync returned invalid JSON. HTTP ${response.statusCode}.`,
    );
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`AppSync request failed with HTTP ${response.statusCode}.`);
  }

  if (parsed.errors && parsed.errors.length > 0) {
    const message =
      parsed.errors[0].message || "AppSync GraphQL request failed.";

    throw new Error(message);
  }

  return parsed.data;
}

// ============================================================
// GET PAYMENT METHOD
// ============================================================

/**
 * Gets a single PaymentMethod.
 *
 * authorizationCode is retrieved only by the backend.
 *
 * It is never returned by this Lambda's response.
 */
async function getPaymentMethod(paymentMethodId) {
  const query = `
    query GetPaymentMethod($id: ID!) {
      getPaymentMethod(id: $id) {
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

        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const data = await graphqlRequestIAM(query, {
    id: paymentMethodId,
  });

  return data.getPaymentMethod;
}

// ============================================================
// GET ACTIVE PAYMENT METHODS
// ============================================================

/**
 * Gets ACTIVE payment methods belonging to
 * the same Atua user.
 *
 * We use the byPaymentMethodUser index.
 *
 * IMPORTANT:
 *
 * User.id is NOT the same thing as Cognito sub.
 */
async function getActivePaymentMethods(userID) {
  const query = `
    query PaymentMethodsByUser(
      $userID: ID!
      $filter: ModelPaymentMethodFilterInput
      $limit: Int
    ) {
      paymentMethodsByUser(
        userID: $userID
        filter: $filter
        limit: $limit
      ) {
        items {
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

          _version
          _lastChangedAt
          _deleted
        }
      }
    }
  `;

  const data = await graphqlRequestIAM(query, {
    userID,

    filter: {
      status: {
        eq: "ACTIVE",
      },
    },

    limit: 100,
  });

  if (
    !data ||
    !data.paymentMethodsByUser ||
    !Array.isArray(data.paymentMethodsByUser.items)
  ) {
    return [];
  }

  return data.paymentMethodsByUser.items.filter(
    (method) =>
      method && method._deleted !== true && method.status === "ACTIVE",
  );
}

// ============================================================
// UPDATE PAYMENT METHOD
// ============================================================

/**
 * Updates a PaymentMethod.
 *
 * The current _version is supplied because
 * Amplify generated models use optimistic concurrency.
 */
async function updatePaymentMethod(input) {
  const mutation = `
    mutation UpdatePaymentMethod(
      $input: UpdatePaymentMethodInput!
    ) {
      updatePaymentMethod(input: $input) {
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

        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const data = await graphqlRequestIAM(mutation, {
    input,
  });

  return data.updatePaymentMethod;
}

// ============================================================
// PAYSTACK POST REQUEST
// ============================================================

/**
 * Makes a POST request to Paystack.
 *
 * The Paystack secret is supplied only inside Lambda.
 */
async function paystackPost(path, payload, secretKey) {
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.paystack.co",

        path,

        method: "POST",

        headers: {
          Authorization: `Bearer ${secretKey}`,

          "Content-Type": "application/json",

          "Content-Length": Buffer.byteLength(body),
        },
      },

      (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          let parsed;

          try {
            parsed = JSON.parse(data);
          } catch (error) {
            reject(
              new Error(
                `Paystack returned invalid JSON. HTTP ${res.statusCode}.`,
              ),
            );

            return;
          }

          resolve({
            statusCode: res.statusCode,

            data: parsed,
          });
        });
      },
    );

    req.on("error", reject);

    req.write(body);

    req.end();
  });
}

// ============================================================
// DEACTIVATE PAYSTACK AUTHORIZATION
// ============================================================

/**
 * Deactivates a reusable Paystack authorization.
 *
 * IMPORTANT:
 *
 * The authorization code is intentionally not logged.
 */
async function deactivatePaystackAuthorization(authorizationCode, secretKey) {
  if (!authorizationCode || typeof authorizationCode !== "string") {
    throw new Error("Invalid Paystack authorization code.");
  }

  const response = await paystackPost(
    "/customer/deactivate_authorization",
    {
      authorization_code: authorizationCode,
    },
    secretKey,
  );

  if (!response || !response.data) {
    throw new Error(
      "Paystack returned an unexpected response while deactivating the authorization.",
    );
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    const message =
      response.data.message || "Paystack authorization deactivation failed.";

    throw new Error(message);
  }

  if (response.data.status !== true) {
    const message =
      response.data.message || "Paystack authorization deactivation failed.";

    throw new Error(message);
  }

  return response.data;
}

// ============================================================
// AUTHENTICATE USER
// ============================================================

/**
 * Gets the authenticated Cognito user's sub.
 *
 * AppSync Lambda invocation context can differ depending
 * on how the Lambda is invoked.
 *
 * We support the common identity locations.
 */
function getAuthenticatedUserSub(event) {
  const identity = event && event.identity;

  if (identity && identity.sub) {
    return identity.sub;
  }

  if (identity && identity.claims && identity.claims.sub) {
    return identity.claims.sub;
  }

  if (
    event &&
    event.requestContext &&
    event.requestContext.identity &&
    event.requestContext.identity.sub
  ) {
    return event.requestContext.identity.sub;
  }

  return null;
}

// ============================================================
// HANDLER
// ============================================================

exports.handler = async (event) => {
  let paymentMethodId = null;

  try {
    // ========================================================
    // 1. AUTHENTICATE CALLER
    // ========================================================

    const userSub = getAuthenticatedUserSub(event);

    if (!userSub) {
      return {
        success: false,

        message: "Authentication is required.",

        paymentMethodId: null,
      };
    }

    // ========================================================
    // 2. READ INPUT
    // ========================================================

    /**
     * Depending on the AppSync Lambda resolver configuration,
     * arguments may be available directly on event.arguments.
     *
     * We intentionally only accept paymentMethodId.
     */
    const argumentsObject = event && event.arguments ? event.arguments : {};

    paymentMethodId = argumentsObject.paymentMethodId || null;

    if (!paymentMethodId || typeof paymentMethodId !== "string") {
      return {
        success: false,

        message: "paymentMethodId is required.",

        paymentMethodId: null,
      };
    }

    console.log("deletePaymentMethod started.", {
      paymentMethodId,
      userSub,
    });

    // ========================================================
    // 3. LOAD PAYMENT METHOD
    // ========================================================

    const paymentMethod = await getPaymentMethod(paymentMethodId);

    if (!paymentMethod) {
      return {
        success: false,

        message: "Payment method not found.",

        paymentMethodId,
      };
    }

    // ========================================================
    // 4. VERIFY OWNERSHIP
    // ========================================================

    /**
     * PaymentMethod.owner should contain the Cognito user's
     * sub because the model uses owner-based authorization.
     *
     * We verify this ourselves before doing anything with
     * the Paystack authorization.
     */
    if (paymentMethod.owner !== userSub) {
      console.warn("deletePaymentMethod rejected: ownership mismatch.", {
        paymentMethodId,
        userSub,
        paymentMethodOwner: paymentMethod.owner || null,
      });

      return {
        success: false,

        message: "You are not authorized to delete this payment method.",

        paymentMethodId,
      };
    }

    // ========================================================
    // 5. VALIDATE PAYMENT METHOD USER
    // ========================================================

    if (!paymentMethod.userID) {
      return {
        success: false,

        message: "This payment method is missing its user reference.",

        paymentMethodId,
      };
    }

    // ========================================================
    // 6. ALREADY INACTIVE
    // ========================================================

    /**
     * If the card is already inactive, there is nothing
     * left to deactivate at the local level.
     *
     * We treat this as an idempotent success.
     */
    if (paymentMethod.status === "INACTIVE") {
      return {
        success: true,

        message: "Payment method has already been deleted.",

        paymentMethodId,
      };
    }

    // ========================================================
    // 7. VALIDATE PAYMENT PROVIDER
    // ========================================================

    if (String(paymentMethod.provider || "").toUpperCase() !== "PAYSTACK") {
      return {
        success: false,

        message: "Only Paystack payment methods can be deleted.",

        paymentMethodId,
      };
    }

    // ========================================================
    // 8. VALIDATE REUSABLE AUTHORIZATION
    // ========================================================

    if (paymentMethod.reusable !== true) {
      return {
        success: false,

        message: "This payment method is not reusable.",

        paymentMethodId,
      };
    }

    if (!paymentMethod.authorizationCode) {
      return {
        success: false,

        message:
          "This payment method does not have a valid Paystack authorization.",

        paymentMethodId,
      };
    }

    // ========================================================
    // 9. RETRIEVE PAYSTACK SECRET
    // ========================================================

    /**
     * The secret is retrieved from AWS SSM.
     *
     * NEVER log the secret.
     */
    const paystackSecret = await getPaystackSecretKey();

    // ========================================================
    // 10. DETERMINE CURRENT PAYSTACK ENVIRONMENT
    // ========================================================

    /**
     * Determine TEST/LIVE from the actual Paystack secret
     * currently configured on this Lambda.
     *
     * This must NOT use:
     *
     * paymentMethod.orderEnvironment
     * order.orderEnvironment
     * frontend state
     *
     * Paystack environment is determined only from the
     * Paystack credentials.
     */
    const currentPaystackEnvironment = getPaystackEnvironment(paystackSecret);

    console.log("Paystack environment resolved.", {
      paymentMethodId,

      currentPaystackEnvironment,

      paymentMethodPaystackEnvironment:
        paymentMethod.paystackEnvironment || null,
    });

    // ========================================================
    // 11. VERIFY PAYMENT METHOD PAYSTACK ENVIRONMENT
    // ========================================================

    /**
     * A saved authorization belongs to the Paystack
     * environment in which it was created.
     *
     * We must NEVER attempt to deactivate:
     *
     * TEST authorization with LIVE credentials
     *
     * or
     *
     * LIVE authorization with TEST credentials.
     *
     * Older PaymentMethod records may not have
     * paystackEnvironment.
     *
     * In that situation we fail safely rather than guessing.
     */
    if (!paymentMethod.paystackEnvironment) {
      console.warn(
        "deletePaymentMethod rejected: PaymentMethod has no paystackEnvironment.",
        {
          paymentMethodId,

          last4: paymentMethod.last4 || null,
        },
      );

      return {
        success: false,

        message:
          "This saved payment method is missing its Paystack environment. Please add the card again before deleting this saved card.",

        paymentMethodId,
      };
    }

    if (paymentMethod.paystackEnvironment !== currentPaystackEnvironment) {
      console.warn("Paystack environment mismatch.", {
        paymentMethodId,

        paymentMethodPaystackEnvironment: paymentMethod.paystackEnvironment,

        currentPaystackEnvironment,
      });

      return {
        success: false,

        message:
          "This saved payment method belongs to a different Paystack environment and cannot be deleted with the current configuration.",

        paymentMethodId,
      };
    }

    console.log("Paystack environment validation passed.", {
      paymentMethodId,

      paystackEnvironment: paymentMethod.paystackEnvironment,
    });

    // ========================================================
    // 12. DEACTIVATE AUTHORIZATION AT PAYSTACK
    // ========================================================

    /**
     * Paystack is updated FIRST.
     *
     * If Paystack refuses the deactivation, we do NOT mark
     * the local PaymentMethod as inactive.
     *
     * This prevents our database from saying a card is deleted
     * while Paystack still considers its authorization active.
     */
    await deactivatePaystackAuthorization(
      paymentMethod.authorizationCode,
      paystackSecret,
    );

    console.log("Paystack authorization deactivated successfully.", {
      paymentMethodId,

      paystackEnvironment: paymentMethod.paystackEnvironment || null,

      last4: paymentMethod.last4 || null,

      cardType: paymentMethod.cardType || null,
    });

    // ========================================================
    // 13. MARK LOCAL PAYMENT METHOD INACTIVE
    // ========================================================

    const deactivatedAt = new Date().toISOString();

    await updatePaymentMethod({
      id: paymentMethod.id,

      status: "INACTIVE",

      isDefault: false,

      deactivatedAt,

      _version: paymentMethod._version,
    });

    console.log("Local PaymentMethod marked INACTIVE.", {
      paymentMethodId,

      paystackEnvironment: paymentMethod.paystackEnvironment || null,
    });

    // ========================================================
    // 14. FIND REMAINING ACTIVE CARDS
    // ========================================================

    let activePaymentMethods;

    try {
      activePaymentMethods = await getActivePaymentMethods(
        paymentMethod.userID,
      );
    } catch (error) {
      /**
       * At this point:
       *
       * 1. Paystack authorization has already been deactivated.
       * 2. Local PaymentMethod has already been marked INACTIVE.
       *
       * Therefore the deletion itself succeeded.
       *
       * Failure to load remaining cards should not tell the
       * user that deletion failed.
       */
      console.error(
        "Unable to load remaining active payment methods:",
        error && error.message ? error.message : error,
      );

      return {
        success: true,

        message: "Payment method deleted successfully.",

        paymentMethodId,
      };
    }

    // ========================================================
    // 15. ONLY CONSIDER CARDS FROM SAME PAYSTACK ENVIRONMENT
    // ========================================================

    /**
     * IMPORTANT:
     *
     * PaymentMethod.paystackEnvironment represents the
     * Paystack account/environment that owns the reusable
     * authorization.
     *
     * TEST and LIVE Paystack authorizations must NEVER be
     * mixed together.
     *
     * This is NOT Order.orderEnvironment.
     *
     * Order.orderEnvironment is Atua's operational
     * TEST/PRODUCTION separation.
     */
    const samePaystackEnvironmentMethods = activePaymentMethods.filter(
      (method) =>
        method.paystackEnvironment === paymentMethod.paystackEnvironment,
    );

    console.log("Remaining same-environment payment methods found.", {
      paymentMethodId,

      paystackEnvironment: paymentMethod.paystackEnvironment,

      count: samePaystackEnvironmentMethods.length,
    });

    // ========================================================
    // 16. CHECK IF ANOTHER DEFAULT CARD EXISTS
    // ========================================================

    const anotherDefault = samePaystackEnvironmentMethods.find(
      (method) => method.isDefault === true && method.id !== paymentMethod.id,
    );

    if (anotherDefault) {
      /**
       * Another valid default card already exists.
       *
       * Therefore no replacement is necessary.
       */
      console.log("Another default payment method already exists.", {
        paymentMethodId: anotherDefault.id,

        paystackEnvironment: anotherDefault.paystackEnvironment || null,

        last4: anotherDefault.last4 || null,
      });

      return {
        success: true,

        message: "Payment method deleted successfully.",

        paymentMethodId,
      };
    }

    // ========================================================
    // 17. PROMOTE ANOTHER CARD TO DEFAULT
    // ========================================================

    if (samePaystackEnvironmentMethods.length > 0) {
      /**
       * No other default card exists.
       *
       * We therefore select a replacement.
       *
       * The oldest remaining active card becomes
       * the replacement default.
       */
      const sortedMethods = [...samePaystackEnvironmentMethods].sort((a, b) => {
        const aTime = a.createdAt
          ? new Date(a.createdAt).getTime()
          : Number.MAX_SAFE_INTEGER;

        const bTime = b.createdAt
          ? new Date(b.createdAt).getTime()
          : Number.MAX_SAFE_INTEGER;

        return aTime - bTime;
      });

      const newDefault = sortedMethods[0];

      if (newDefault) {
        try {
          await updatePaymentMethod({
            id: newDefault.id,

            isDefault: true,

            _version: newDefault._version,
          });

          console.log("Replacement default payment method selected.", {
            paymentMethodId: newDefault.id,

            paystackEnvironment: newDefault.paystackEnvironment || null,

            last4: newDefault.last4 || null,
          });
        } catch (error) {
          /**
           * Deletion has already succeeded.
           *
           * If promotion fails because of an optimistic
           * concurrency conflict or another temporary
           * AppSync problem, we do NOT tell the user that
           * deletion failed.
           *
           * The card was still successfully deleted.
           */
          console.error(
            "Failed to promote replacement default payment method:",
            error && error.message ? error.message : error,
          );

          return {
            success: true,

            message: "Payment method deleted successfully.",

            paymentMethodId,
          };
        }
      }
    }

    // ========================================================
    // 18. FINAL SUCCESS
    // ========================================================

    return {
      success: true,

      message: "Payment method deleted successfully.",

      paymentMethodId,
    };
  } catch (error) {
    // ========================================================
    // 19. SAFE ERROR HANDLING
    // ========================================================

    /**
     * NEVER log:
     *
     * - Paystack secret
     * - authorizationCode
     * - full card number
     * - CVV
     * - PIN
     *
     * Only safe error information is logged.
     */
    console.error(
      "deletePaymentMethod error:",
      error && error.message ? error.message : error,
    );

    return {
      success: false,

      message:
        error && error.message
          ? error.message
          : "Unable to delete payment method.",

      paymentMethodId,
    };
  }
};
