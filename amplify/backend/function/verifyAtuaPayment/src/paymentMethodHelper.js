const https = require("https");
const crypto = require("crypto");

const { SignatureV4 } = require("@aws-sdk/signature-v4");
const { HttpRequest } = require("@aws-sdk/protocol-http");
const { defaultProvider } = require("@aws-sdk/credential-provider-node");
const { Sha256 } = require("@aws-crypto/sha256-js");

/**
 * Clean a value before storing it.
 */
function cleanString(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

/**
 * Determine which Paystack environment this Lambda is currently using.
 *
 * The Paystack environment is determined by the secret key:
 *
 *   sk_test_... -> TEST
 *   sk_live_... -> LIVE
 *
 * IMPORTANT:
 * This is completely separate from Atua's OrderEnvironment.
 * OrderEnvironment controls whether an Atua order is TEST or PRODUCTION.
 * This function only determines the Paystack environment.
 */
function getPaystackEnvironment(secretKey) {
  const key = cleanString(secretKey);

  if (key.startsWith("sk_test_")) {
    return "TEST";
  }

  if (key.startsWith("sk_live_")) {
    return "LIVE";
  }

  throw new Error(
    "Cannot determine Paystack environment: invalid or unrecognized secret key.",
  );
}

/**
 * Create a deterministic PaymentMethod ID.
 *
 * Same Atua user + same Paystack card signature
 * will always produce the same PaymentMethod ID.
 *
 * This prevents duplicate cards when:
 * - paystackwebhook runs
 * - verifyAtuaPayment runs
 * - both happen at almost the same time
 */
function buildPaymentMethodId(userID, signature) {
  return `pm_${crypto
    .createHash("sha256")
    .update(`${userID}:${signature}`)
    .digest("hex")}`;
}

/**
 * Basic HTTPS request helper.
 */
function httpsRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      let data = "";

      response.on("data", (chunk) => {
        data += chunk;
      });

      response.on("end", () => {
        let parsed;

        try {
          parsed = data ? JSON.parse(data) : {};
        } catch (error) {
          return reject(
            new Error(
              `AppSync returned invalid JSON. HTTP ${response.statusCode}.`,
            ),
          );
        }

        resolve({
          statusCode: response.statusCode,
          body: parsed,
        });
      });
    });

    request.on("error", reject);

    if (body) {
      request.write(body);
    }

    request.end();
  });
}

/**
 * Make an IAM/SigV4 authenticated AppSync request.
 *
 * PaymentMethod uses IAM authorization, so we cannot use
 * the normal API-key GraphQL request for PaymentMethod.
 */
async function graphqlRequestIAM({ endpoint, region, query, variables = {} }) {
  if (!endpoint) {
    throw new Error("AppSync endpoint is missing.");
  }

  if (!region) {
    throw new Error("AWS region is missing.");
  }

  const url = new URL(endpoint);

  const body = JSON.stringify({
    query,
    variables,
  });

  const request = new HttpRequest({
    method: "POST",
    protocol: url.protocol,
    hostname: url.hostname,
    path: url.pathname || "/",
    headers: {
      host: url.hostname,
      "content-type": "application/json",
    },
    body,
  });

  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region,
    service: "appsync",
    sha256: Sha256,
  });

  const signedRequest = await signer.sign(request);

  const response = await httpsRequest(
    {
      hostname: signedRequest.hostname,
      port: signedRequest.port,
      path: signedRequest.path,
      method: signedRequest.method,
      headers: signedRequest.headers,
    },
    signedRequest.body,
  );

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(
      `AppSync IAM request failed with HTTP ${response.statusCode}: ${JSON.stringify(
        response.body,
      )}`,
    );
  }

  if (response.body?.errors?.length) {
    throw new Error(
      `AppSync GraphQL error: ${JSON.stringify(response.body.errors)}`,
    );
  }

  return response.body?.data;
}

/**
 * Get an existing PaymentMethod by its deterministic ID.
 */
async function getPaymentMethod({ endpoint, region, paymentMethodId }) {
  const query = `
    query GetPaymentMethod($id: ID!) {
      getPaymentMethod(id: $id) {
        id
        owner
        userID
        paystackEnvironment
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
      }
    }
  `;

  try {
    const data = await graphqlRequestIAM({
      endpoint,
      region,
      query,
      variables: {
        id: paymentMethodId,
      },
    });

    return data?.getPaymentMethod || null;
  } catch (error) {
    const message = String(error?.message || "");

    if (
      message.includes("not found") ||
      message.includes("NotFound") ||
      message.includes("does not exist")
    ) {
      return null;
    }

    throw error;
  }
}

/**
 * Create a PaymentMethod.
 */
async function createPaymentMethod({ endpoint, region, input }) {
  const mutation = `
    mutation CreatePaymentMethod(
      $input: CreatePaymentMethodInput!
    ) {
      createPaymentMethod(input: $input) {
        id
        owner
        userID
        paystackEnvironment
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
      }
    }
  `;

  const data = await graphqlRequestIAM({
    endpoint,
    region,
    query: mutation,
    variables: {
      input,
    },
  });

  return data?.createPaymentMethod || null;
}

/**
 * Update an existing PaymentMethod.
 */
async function updatePaymentMethod({ endpoint, region, input }) {
  const mutation = `
    mutation UpdatePaymentMethod(
      $input: UpdatePaymentMethodInput!
    ) {
      updatePaymentMethod(input: $input) {
        id
        owner
        userID
        paystackEnvironment
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
      }
    }
  `;

  const data = await graphqlRequestIAM({
    endpoint,
    region,
    query: mutation,
    variables: {
      input,
    },
  });

  return data?.updatePaymentMethod || null;
}

/**
 * Check whether the user already has another active card.
 */
async function hasActivePaymentMethod({ endpoint, region, userID }) {
  const query = `
    query PaymentMethodsByUser(
      $userID: ID!
      $limit: Int
    ) {
      paymentMethodsByUser(
        userID: $userID
        limit: $limit
      ) {
        items {
          id
          status
        }
      }
    }
  `;

  const data = await graphqlRequestIAM({
    endpoint,
    region,
    query,
    variables: {
      userID,
      limit: 100,
    },
  });

  const items = data?.paymentMethodsByUser?.items || [];

  return items.some(
    (paymentMethod) => paymentMethod && paymentMethod.status === "ACTIVE",
  );
}

/**
 * Save a reusable Paystack authorization as a PaymentMethod.
 *
 * IMPORTANT:
 * We only store Paystack's reusable authorization.
 *
 * We NEVER store:
 * - card number
 * - CVV
 * - PIN
 */
async function saveReusablePaymentMethod({
  endpoint,
  region,
  userID,
  authorization,
  email,
  paystackSecretKey,
}) {
  if (!userID) {
    throw new Error("Cannot save PaymentMethod: userID is missing.");
  }

  if (!authorization) {
    throw new Error(
      "Cannot save PaymentMethod: Paystack authorization is missing.",
    );
  }

  const authorizationCode = cleanString(authorization.authorization_code);

  const signature = cleanString(authorization.signature);

  const customerEmail = cleanString(email);

  if (!authorizationCode) {
    throw new Error(
      "Cannot save PaymentMethod: authorization_code is missing.",
    );
  }

  if (!signature) {
    throw new Error(
      "Cannot save PaymentMethod: Paystack signature is missing.",
    );
  }

  if (!customerEmail) {
    throw new Error("Cannot save PaymentMethod: customer email is missing.");
  }

  /**
   * Determine the Paystack environment from the actual secret key
   * being used by this Lambda.
   *
   * Do NOT use Order.orderEnvironment here.
   */
  const paystackEnvironment = getPaystackEnvironment(paystackSecretKey);

  /**
   * Do not save cards that Paystack says are not reusable.
   */
  if (authorization.reusable !== true) {
    console.log("PAYMENT METHOD NOT SAVED: authorization is not reusable.");

    return {
      saved: false,
      reason: "NOT_REUSABLE",
      paymentMethod: null,
    };
  }

  /**
   * We are saving cards only.
   */
  const channel = cleanString(authorization.channel).toLowerCase();

  if (channel && channel !== "card") {
    console.log("PAYMENT METHOD NOT SAVED: authorization is not a card.", {
      channel,
    });

    return {
      saved: false,
      reason: "NOT_CARD",
      paymentMethod: null,
    };
  }

  /**
   * Get the Atua User.
   *
   * IMPORTANT:
   *
   * PaymentMethod.userID = User.id
   * PaymentMethod.owner = User.sub
   *
   * They are NOT the same value.
   */
  const getUserQuery = `
    query GetUser($id: ID!) {
      getUser(id: $id) {
        id
        sub
        email
      }
    }
  `;

  const userData = await graphqlRequestIAM({
    endpoint,
    region,
    query: getUserQuery,
    variables: {
      id: userID,
    },
  });

  const user = userData?.getUser;

  if (!user) {
    throw new Error(
      `Cannot save PaymentMethod: Atua User ${userID} was not found.`,
    );
  }

  if (!user.sub) {
    throw new Error(
      `Cannot save PaymentMethod: Atua User ${userID} has no Cognito sub.`,
    );
  }

  /**
   * Create deterministic ID.
   */
  const paymentMethodId = buildPaymentMethodId(userID, signature);

  /**
   * Check whether the card already exists.
   */
  let existing = await getPaymentMethod({
    endpoint,
    region,
    paymentMethodId,
  });

  /**
   * If already active, do nothing.
   *
   * This makes the helper idempotent.
   */
  if (existing && existing.status === "ACTIVE") {
    console.log("PAYMENT METHOD ALREADY EXISTS:", {
      paymentMethodId: existing.id,
      userID,
      last4: existing.last4,
    });

    return {
      saved: true,
      created: false,
      paymentMethod: existing,
    };
  }

  /**
   * Determine whether this should be the default card.
   */
  const anotherActiveCardExists = await hasActivePaymentMethod({
    endpoint,
    region,
    userID,
  });

  const isDefault = !anotherActiveCardExists;

  /**
   * Fields shared by create/update.
   */
  const paymentMethodFields = {
    owner: user.sub,
    userID,
    paystackEnvironment,

    provider: "PAYSTACK",

    authorizationCode,
    signature,

    cardType: cleanString(authorization.card_type) || null,

    last4: cleanString(authorization.last4) || null,

    expMonth: cleanString(authorization.exp_month) || null,

    expYear: cleanString(authorization.exp_year) || null,

    bank: cleanString(authorization.bank) || null,

    countryCode: cleanString(authorization.country_code) || null,

    channel: channel || "card",

    reusable: true,

    email: customerEmail,

    isDefault,

    status: "ACTIVE",

    deactivatedAt: null,
  };

  /**
   * If an old inactive/expired/failed record exists,
   * reactivate it instead of creating another one.
   */
  if (existing) {
    const updateInput = {
      id: existing.id,
      ...paymentMethodFields,
    };

    if (Number.isInteger(existing._version)) {
      updateInput._version = existing._version;
    }

    try {
      const updated = await updatePaymentMethod({
        endpoint,
        region,
        input: updateInput,
      });

      console.log("PAYMENT METHOD REACTIVATED:", {
        paymentMethodId: existing.id,
        userID,
        last4: paymentMethodFields.last4,
      });

      return {
        saved: true,
        created: false,
        reactivated: true,
        paymentMethod: updated,
      };
    } catch (error) {
      console.warn("PAYMENT METHOD UPDATE FAILED; RELOADING:", error?.message);

      const reloaded = await getPaymentMethod({
        endpoint,
        region,
        paymentMethodId,
      });

      if (reloaded && reloaded.status === "ACTIVE") {
        return {
          saved: true,
          created: false,
          paymentMethod: reloaded,
        };
      }

      throw error;
    }
  }

  /**
   * Create a brand-new PaymentMethod.
   */
  const createInput = {
    id: paymentMethodId,
    ...paymentMethodFields,
  };

  try {
    const created = await createPaymentMethod({
      endpoint,
      region,
      input: createInput,
    });

    if (!created) {
      throw new Error("AppSync did not return the created PaymentMethod.");
    }

    console.log("PAYMENT METHOD CREATED:", {
      paymentMethodId: created.id,
      userID,
      last4: created.last4,
      isDefault: created.isDefault,
    });

    return {
      saved: true,
      created: true,
      paymentMethod: created,
    };
  } catch (error) {
    /**
     * Another Lambda invocation may have created the
     * exact same deterministic ID at the same time.
     *
     * Check again before treating this as a real failure.
     */
    console.warn(
      "PAYMENT METHOD CREATE FAILED; CHECKING FOR CONCURRENT CREATE:",
      error?.message,
    );

    const concurrentRecord = await getPaymentMethod({
      endpoint,
      region,
      paymentMethodId,
    });

    if (concurrentRecord) {
      console.log("PAYMENT METHOD WAS CREATED BY ANOTHER INVOCATION:", {
        paymentMethodId,
        userID,
      });

      return {
        saved: true,
        created: false,
        paymentMethod: concurrentRecord,
      };
    }

    throw error;
  }
}

module.exports = {
  saveReusablePaymentMethod,
};
