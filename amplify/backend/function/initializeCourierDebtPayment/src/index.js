/* Amplify Params - DO NOT EDIT
    API_ATUA_GRAPHQLAPIENDPOINTOUTPUT
    ENV
    REGION
Amplify Params - DO NOT EDIT */

"use strict";

/*
============================================================
ATUA — INITIALIZE COURIER DEBT PAYMENT
============================================================

PURPOSE
-------
1. Authenticate the courier through Cognito.
2. Find the courier's profile and wallet.
3. Read outstandingDebt directly from AppSync.
4. Check for unresolved debt-payment attempts.
5. Create a CourierDebtPayment record.
6. Initialize a Paystack transaction.
7. Save and return the checkout URL.

FINANCIAL SAFEGUARDS
--------------------
- Never accept courierID or amount from the caller.
- Calculate the amount from Wallet.outstandingDebt.
- Do not deduct debt in this Lambda.
- Only the verification flow should apply a verified payment.
- Paystack amounts must be sent in kobo.
- A checkout URL does not mean payment succeeded.
- PENDING and PROCESSING payments must not be ignored.
- If a Paystack request has an uncertain outcome, do not
  automatically mark that attempt FAILED.

IMPORTANT LIMITATION
--------------------
The existing-payment check is not a database lock. Two
simultaneous requests can still race and create two records.
Preventing that requires a concurrency-safe database claim.
============================================================
*/

const https = require("https");
const crypto = require("crypto");
const aws4 = require("aws4");

const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

/* ============================================================
   1. CONFIGURATION
   ============================================================ */

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const REGION = process.env.REGION || process.env.AWS_REGION || "eu-north-1";

/*
  PAYSTACK_SECRET_KEY must contain the SSM parameter NAME,
  not the actual Paystack secret.

  Example:
  /atuainc/staging/PAYSTACK_SECRET_KEY
*/
const PAYSTACK_SECRET_PARAMETER = process.env.PAYSTACK_SECRET_KEY;

const ssmClient = new SSMClient({
  region: REGION,
});

const CURRENCY = "NGN";
const PROVIDER = "PAYSTACK";

/*
  Maximum debt amount permitted for one payment initialization.
  This amount is expressed in naira.
*/
const MAX_DEBT_NAIRA = 100000000;

/* ============================================================
   2. APPSYNC GRAPHQL REQUEST
   ============================================================ */

/*
  Sends a GraphQL request to AppSync using AWS IAM signing.

  The Lambda execution role must have permission to call the
  relevant AppSync operations.

  Never hardcode AWS access keys in this Lambda.
*/
async function graphqlRequest(
  query,
  variables = {},
  operationName = "GraphQL",
) {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error(
      "Missing API_ATUA_GRAPHQLAPIENDPOINTOUTPUT environment variable.",
    );
  }

  const endpoint = new URL(GRAPHQL_ENDPOINT);

  if (endpoint.protocol !== "https:") {
    throw new Error("The AppSync endpoint must use HTTPS.");
  }

  const body = JSON.stringify({
    query,
    variables,
  });

  const requestOptions = {
    host: endpoint.host,
    hostname: endpoint.hostname,
    path: `${endpoint.pathname}${endpoint.search}`,
    method: "POST",
    service: "appsync",
    region: REGION,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
    body,
  };

  const signedRequest = aws4.sign(requestOptions);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: signedRequest.hostname,
        port: signedRequest.port || 443,
        path: signedRequest.path,
        method: signedRequest.method,
        headers: signedRequest.headers,
      },
      (res) => {
        let responseBody = "";

        res.setEncoding("utf8");

        res.on("data", (chunk) => {
          responseBody += chunk;
        });

        res.on("end", () => {
          let payload;

          try {
            payload = JSON.parse(responseBody);
          } catch {
            return reject(
              new Error(`${operationName}: AppSync returned invalid JSON.`),
            );
          }

          if (res.statusCode < 200 || res.statusCode >= 300) {
            console.error(`${operationName}: AppSync HTTP failure`, {
              statusCode: res.statusCode,
            });

            return reject(
              new Error(`${operationName}: AppSync HTTP ${res.statusCode}.`),
            );
          }

          if (payload.errors && payload.errors.length > 0) {
            console.error(`${operationName}: GraphQL errors`, {
              errors: payload.errors.map((error) => error.message),
            });

            return reject(
              new Error(
                `${operationName}: ${payload.errors
                  .map((error) => error.message)
                  .join("; ")}`,
              ),
            );
          }

          resolve(payload.data);
        });
      },
    );

    req.on("error", (error) => {
      reject(
        new Error(`${operationName}: AppSync request failed: ${error.message}`),
      );
    });

    req.setTimeout(15000, () => {
      req.destroy(new Error(`${operationName}: AppSync request timed out.`));
    });

    req.write(body);
    req.end();
  });
}

/* ============================================================
   3. RETRIEVE THE PAYSTACK SECRET FROM SSM
   ============================================================ */

/*
  Retrieves the Paystack secret securely from AWS Systems
  Manager Parameter Store.

  Required Lambda permissions:
  - ssm:GetParameter
  - kms:Decrypt, if required by the parameter's KMS key
*/
async function getPaystackSecretKey() {
  if (!PAYSTACK_SECRET_PARAMETER) {
    throw new Error(
      "PAYSTACK_SECRET_KEY is not configured as an SSM parameter name.",
    );
  }

  const result = await ssmClient.send(
    new GetParameterCommand({
      Name: PAYSTACK_SECRET_PARAMETER,
      WithDecryption: true,
    }),
  );

  const secretKey = result?.Parameter?.Value?.trim();

  if (!secretKey) {
    throw new Error("The Paystack secret could not be retrieved from SSM.");
  }

  return secretKey;
}

/* ============================================================
   4. FIND THE AUTHENTICATED COURIER
   ============================================================ */

/*
  The courier is identified through the Cognito sub supplied
  by the authenticated AppSync request.

  This assumes Courier.sub is indexed with the query field
  couriersBySub.

  Never accept the courier's ID or Cognito sub from ordinary
  mutation arguments as proof of identity.
*/
async function getAuthenticatedCourier(sub) {
  const query = `
    query CouriersBySub(
      $sub: String!
      $limit: Int
    ) {
      couriersBySub(
        sub: $sub
        limit: $limit
      ) {
        items {
          id
          sub
          email
          walletID
          _deleted
        }
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    {
      sub,
      limit: 10,
    },
    "Get authenticated courier",
  );

  const couriers = (data?.couriersBySub?.items || []).filter(
    (courier) => courier && courier.id && courier._deleted !== true,
  );

  if (couriers.length === 0) {
    throw new Error(
      "No courier profile is linked to the authenticated account.",
    );
  }

  if (couriers.length > 1) {
    throw new Error(
      "Multiple courier profiles share this Cognito sub. Contact Atua support.",
    );
  }

  const courier = couriers[0];

  if (courier.sub !== sub) {
    throw new Error("Courier identity verification failed.");
  }

  if (!courier.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(courier.email)) {
    throw new Error(
      "A valid email address must be saved in your courier profile before payment.",
    );
  }

  return courier;
}

/* ============================================================
   5. FIND AND VALIDATE THE COURIER'S WALLET
   ============================================================ */

/*
  Prefer Courier.walletID when it exists.

  If it does not exist, find the wallet using:
    Wallet.ownerID = Courier.id
    Wallet.ownerType = COURIER

  Stop if multiple wallets match. Do not guess which wallet
  contains the authoritative debt balance.
*/
async function getCourierWallet(courier) {
  if (courier.walletID) {
    const query = `
      query GetWallet($id: ID!) {
        getWallet(id: $id) {
          id
          ownerID
          ownerType
          availableBalance
          outstandingDebt
          _deleted
        }
      }
    `;

    const data = await graphqlRequest(
      query,
      {
        id: courier.walletID,
      },
      "Get courier wallet",
    );

    const wallet = data?.getWallet;

    if (!wallet || wallet._deleted === true) {
      throw new Error("The wallet linked to this courier was not found.");
    }

    if (wallet.ownerID !== courier.id || wallet.ownerType !== "COURIER") {
      throw new Error("The linked wallet does not belong to this courier.");
    }

    return wallet;
  }

  /*
    Fallback for older Courier records without walletID.
  */
  const query = `
    query ListCourierWallets(
      $filter: ModelWalletFilterInput
      $limit: Int
    ) {
      listWallets(
        filter: $filter
        limit: $limit
      ) {
        items {
          id
          ownerID
          ownerType
          availableBalance
          outstandingDebt
          _deleted
        }
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    {
      filter: {
        ownerID: {
          eq: courier.id,
        },
        ownerType: {
          eq: "COURIER",
        },
        _deleted: {
          ne: true,
        },
      },
      limit: 100,
    },
    "Find courier wallet",
  );

  const wallets = (data?.listWallets?.items || []).filter(
    (wallet) =>
      wallet &&
      wallet.id &&
      wallet._deleted !== true &&
      wallet.ownerID === courier.id &&
      wallet.ownerType === "COURIER",
  );

  if (wallets.length === 0) {
    throw new Error("No wallet was found for this courier.");
  }

  if (wallets.length > 1) {
    throw new Error(
      "Multiple courier wallets were found. Financial reconciliation is required.",
    );
  }

  return wallets[0];
}

/* ============================================================
   6. FIND EXISTING UNRESOLVED DEBT PAYMENTS
   ============================================================ */

/*
  Both PENDING and PROCESSING are unresolved statuses.

  PENDING:
    The payment has not been conclusively resolved.

  PROCESSING:
    Verification may have claimed the payment, but the wallet
    update or final payment-status update may not be complete.

  We must not create another checkout while an unresolved
  attempt exists.

  We paginate through the payment history so older records are
  not silently ignored.

  IMPORTANT:
  This check is not a database lock. Concurrent invocations
  can still race; use a concurrency-safe claim to eliminate
  that remaining risk.
*/
async function getPendingDebtPayment(courierID) {
  const query = `
    query ListCourierDebtPayments(
      $filter: ModelCourierDebtPaymentFilterInput
      $limit: Int
      $nextToken: String
    ) {
      listCourierDebtPayments(
        filter: $filter
        limit: $limit
        nextToken: $nextToken
      ) {
        items {
          id
          courierID
          walletID
          amount
          currency
          provider
          reference
          status
          checkoutUrl
          createdAt
          _deleted
        }
        nextToken
      }
    }
  `;

  const payments = [];

  let nextToken = null;
  let pageCount = 0;

  do {
    const data = await graphqlRequest(
      query,
      {
        filter: {
          courierID: {
            eq: courierID,
          },
          _deleted: {
            ne: true,
          },
        },
        limit: 100,
        nextToken,
      },
      "Check existing debt payment",
    );

    const result = data?.listCourierDebtPayments;

    payments.push(
      ...(result?.items || []).filter(
        (payment) =>
          payment &&
          payment.id &&
          payment.courierID === courierID &&
          payment._deleted !== true,
      ),
    );

    nextToken = result?.nextToken || null;
    pageCount += 1;

    /*
      Fail closed if an unusually large history exceeds the
      maximum number of pages this function is willing to read.
      We must not create a new payment after an incomplete check.
    */
    if (pageCount >= 20 && nextToken) {
      throw new Error(
        "Could not safely check the courier's complete debt-payment history. Please try again later.",
      );
    }
  } while (nextToken);

  /*
    CRITICAL FIX:
    Include PROCESSING as well as PENDING. A PROCESSING record
    may represent a payment that has already been claimed by
    verifyCourierDebtPayment.
  */
  const unresolved = payments
    .filter((payment) => ["PENDING", "PROCESSING"].includes(payment.status))
    .sort(
      (a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0),
    );

  /*
    Multiple unresolved attempts indicate an inconsistent
    financial state. Do not choose one arbitrarily.
  */
  if (unresolved.length > 1) {
    throw new Error(
      "Multiple unresolved debt-payment attempts exist for this courier. Contact Atua support before creating another payment.",
    );
  }

  return unresolved[0] || null;
}

/* ============================================================
   7. CREATE THE DEBT-PAYMENT RECORD
   ============================================================ */

/*
  Create the record before calling Paystack so the reference
  can be tied to a specific CourierDebtPayment record.

  The amount comes from the wallet, never from the caller.
*/
async function createDebtPaymentRecord({
  courierID,
  walletID,
  amount,
  reference,
}) {
  const mutation = `
    mutation CreateCourierDebtPayment(
      $input: CreateCourierDebtPaymentInput!
    ) {
      createCourierDebtPayment(input: $input) {
        id
        courierID
        walletID
        amount
        currency
        provider
        reference
        status
        checkoutUrl
        createdAt
        updatedAt
        _version
      }
    }
  `;

  const now = new Date().toISOString();

  const input = {
    courierID,
    walletID,
    amount,
    currency: CURRENCY,
    provider: PROVIDER,
    reference,
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
  };

  const data = await graphqlRequest(
    mutation,
    {
      input,
    },
    "Create debt payment record",
  );

  const record = data?.createCourierDebtPayment;

  if (!record?.id || record.reference !== reference) {
    throw new Error("The debt-payment record could not be created.");
  }

  return record;
}

/* ============================================================
   8. UPDATE THE DEBT-PAYMENT RECORD
   ============================================================ */

/*
  Updates the payment record, for example to save the checkout
  URL or record a failure.

  Include _version when AppSync returns it and conflict
  detection is enabled for this model.
*/
async function updateDebtPaymentRecord(payment, changes) {
  const mutation = `
    mutation UpdateCourierDebtPayment(
      $input: UpdateCourierDebtPaymentInput!
    ) {
      updateCourierDebtPayment(input: $input) {
        id
        courierID
        walletID
        amount
        currency
        provider
        reference
        status
        checkoutUrl
        failureReason
        createdAt
        updatedAt
        _version
      }
    }
  `;

  const input = {
    id: payment.id,
    ...changes,
    updatedAt: new Date().toISOString(),
  };

  if (Number.isInteger(payment._version)) {
    input._version = payment._version;
  }

  const data = await graphqlRequest(
    mutation,
    {
      input,
    },
    "Update debt payment record",
  );

  const updated = data?.updateCourierDebtPayment;

  if (!updated?.id) {
    throw new Error("The debt-payment record could not be updated.");
  }

  return updated;
}

/* ============================================================
   9. INITIALIZE THE PAYSTACK TRANSACTION
   ============================================================ */

/*
  Paystack expects the amount in kobo.

  Example:
    ₦1,000.00 = 100000 kobo

  This function does not mark the payment as successful.
  The verification Lambda must verify the transaction directly
  with Paystack before applying the payment to the wallet debt.
*/
async function initializePaystack({
  secretKey,
  email,
  amountNaira,
  reference,
  courierID,
  walletID,
  debtPaymentID,
}) {
  const amountKobo = Math.round(amountNaira * 100);

  if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
    throw new Error("The calculated Paystack amount is invalid.");
  }

  const payload = JSON.stringify({
    email,
    amount: amountKobo,
    currency: CURRENCY,
    reference,
    metadata: {
      source: "ATUA_COURIER_DEBT",
      courierID,
      walletID,
      debtPaymentID,
    },
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.paystack.co",
        path: "/transaction/initialize",
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let responseBody = "";

        res.setEncoding("utf8");

        res.on("data", (chunk) => {
          responseBody += chunk;
        });

        res.on("end", () => {
          let result;

          try {
            result = JSON.parse(responseBody);
          } catch {
            /*
              Paystack may have received the request even though
              its response could not be parsed. The caller must
              treat the outcome as uncertain.
            */
            return reject(
              new Error(
                "Paystack returned an invalid response. Check the transaction reference before retrying.",
              ),
            );
          }

          if (
            res.statusCode < 200 ||
            res.statusCode >= 300 ||
            result.status !== true ||
            !result.data?.authorization_url ||
            result.data?.reference !== reference
          ) {
            console.error(
              "Paystack initialization did not return a valid checkout:",
              {
                httpStatus: res.statusCode,
                paystackStatus: result.status,
                message: result.message,
                referenceMatches: result.data?.reference === reference,
              },
            );

            return reject(
              new Error(
                result.message ||
                  "Paystack did not return a valid checkout. Check the reference before retrying.",
              ),
            );
          }

          resolve({
            checkoutUrl: result.data.authorization_url,
            reference: result.data.reference,
          });
        });
      },
    );

    req.on("error", (error) => {
      reject(new Error(`Paystack request failed: ${error.message}`));
    });

    req.setTimeout(20000, () => {
      req.destroy(
        new Error(
          "Paystack initialization timed out. Its final outcome is uncertain; check the reference before retrying.",
        ),
      );
    });

    req.write(payload);
    req.end();
  });
}

/* ============================================================
   10. MAIN LAMBDA HANDLER
   ============================================================ */

exports.handler = async (event) => {
  console.log("initializeCourierDebtPayment invoked.");

  let paymentRecord = null;

  /*
    This flag becomes true immediately before the Paystack
    request begins.

    Once the request has started, a timeout or lost response
    does not prove that Paystack failed to create a transaction.
  */
  let paystackInitializationAttempted = false;

  try {
    /* --------------------------------------------------------
       STEP 1: AUTHENTICATE THE COURIER
       -------------------------------------------------------- */

    /*
      This Lambda is expected to be invoked through an AppSync
      resolver using Cognito user-pool authentication.

      Never accept the Cognito sub from mutation arguments.
    */
    const sub = event?.identity?.sub;

    if (!sub || typeof sub !== "string") {
      return {
        success: false,
        message: "You must be signed in as a courier to continue.",
      };
    }

    /* --------------------------------------------------------
       STEP 2: FIND THE COURIER AND WALLET
       -------------------------------------------------------- */

    const courier = await getAuthenticatedCourier(sub);

    const wallet = await getCourierWallet(courier);

    /* --------------------------------------------------------
       STEP 3: CALCULATE DEBT ON THE SERVER
       -------------------------------------------------------- */

    const rawDebt = Number(wallet.outstandingDebt ?? 0);

    if (!Number.isFinite(rawDebt) || rawDebt < 0) {
      throw new Error(
        "The wallet has an invalid debt value. Contact Atua support.",
      );
    }

    /*
      Round the debt to two decimal places because the stored
      value is in naira and Paystack requires kobo.
    */
    const amount = Math.round((rawDebt + Number.EPSILON) * 100) / 100;

    if (amount <= 0) {
      return {
        success: false,
        message: "You have no outstanding Atua debt to pay.",
        courierID: courier.id,
        walletID: wallet.id,
        amount: 0,
        currency: CURRENCY,
      };
    }

    if (amount > MAX_DEBT_NAIRA) {
      throw new Error(
        "The outstanding debt exceeds the permitted payment limit. Contact Atua support.",
      );
    }

    /* --------------------------------------------------------
       STEP 4: CHECK FOR AN EXISTING UNRESOLVED PAYMENT
       -------------------------------------------------------- */

    const existing = await getPendingDebtPayment(courier.id);

    if (existing) {
      /*
        CRITICAL FIX:
        Never issue a new checkout for a PROCESSING payment.
        The verification Lambda may have claimed the payment
        and could have updated the wallet already.
      */
      if (existing.status === "PROCESSING") {
        return {
          success: false,
          message:
            "A previous debt payment is being verified or requires reconciliation. Do not initiate another payment until Atua support resolves it.",
          courierID: courier.id,
          walletID: wallet.id,
          debtPaymentID: existing.id,
          reference: existing.reference,
          amount: existing.amount,
          currency: existing.currency || CURRENCY,
        };
      }

      const existingAmount = Number(existing.amount);

      /*
        If the wallet debt has changed since the existing
        payment was created, do not automatically create
        another transaction. The existing checkout may
        still be payable.
      */
      if (
        !Number.isFinite(existingAmount) ||
        Math.round(existingAmount * 100) !== Math.round(amount * 100)
      ) {
        return {
          success: false,
          message:
            "A pending debt payment exists for a different amount. Please wait for it to be verified or contact Atua support before creating another payment.",
          courierID: courier.id,
          walletID: wallet.id,
          debtPaymentID: existing.id,
          reference: existing.reference,
          pendingAmount: existing.amount,
          currentOutstandingDebt: amount,
          currency: CURRENCY,
        };
      }

      /*
        Reuse the existing checkout when the amount matches
        and a checkout URL has already been saved.
      */
      if (existing.checkoutUrl) {
        return {
          success: true,
          message:
            "You already have a pending debt payment. Reusing the existing checkout link.",
          courierID: courier.id,
          walletID: wallet.id,
          debtPaymentID: existing.id,
          reference: existing.reference,
          checkoutUrl: existing.checkoutUrl,
          amount: existing.amount,
          currency: existing.currency || CURRENCY,
        };
      }

      /*
        A PENDING record without a checkout URL may mean
        initialization failed before the URL was saved.

        Do not blindly initialize another Paystack transaction.
        The existing reference must be checked first.
      */
      return {
        success: false,
        message:
          "A debt-payment attempt is still being processed. Its Paystack status must be checked before another attempt can be created.",
        courierID: courier.id,
        walletID: wallet.id,
        debtPaymentID: existing.id,
        reference: existing.reference,
        amount: existing.amount,
        currency: existing.currency || CURRENCY,
      };
    }

    /* --------------------------------------------------------
       STEP 5: CREATE A UNIQUE REFERENCE AND PAYMENT RECORD
       -------------------------------------------------------- */

    /*
      The reference is generated on the server and stored in
      CourierDebtPayment before Paystack is called.
    */
    const reference = `ATUA-DEBT-${crypto.randomUUID()}`;

    paymentRecord = await createDebtPaymentRecord({
      courierID: courier.id,
      walletID: wallet.id,
      amount,
      reference,
    });

    /* --------------------------------------------------------
       STEP 6: GET THE SECRET AND INITIALIZE PAYSTACK
       -------------------------------------------------------- */

    /*
      Retrieve the secret only when needed. Do not log or
      return the secret to the client.
    */
    const secretKey = await getPaystackSecretKey();

    /*
      Set the flag before making the network request.
      If the request times out, the transaction's outcome
      may be uncertain.
    */
    paystackInitializationAttempted = true;

    const paystack = await initializePaystack({
      secretKey,
      email: courier.email,
      amountNaira: amount,
      reference,
      courierID: courier.id,
      walletID: wallet.id,
      debtPaymentID: paymentRecord.id,
    });

    /* --------------------------------------------------------
       STEP 7: SAVE THE CHECKOUT URL
       -------------------------------------------------------- */

    const updatedPayment = await updateDebtPaymentRecord(paymentRecord, {
      checkoutUrl: paystack.checkoutUrl,
      status: "PENDING",
      failureReason: null,
    });

    /* --------------------------------------------------------
       STEP 8: RETURN CHECKOUT DETAILS
       -------------------------------------------------------- */

    /*
      IMPORTANT:
      This Lambda does not change Wallet.outstandingDebt.

      The verification Lambda must:
      1. Verify the transaction with Paystack.
      2. Validate its reference, amount, and currency.
      3. Confirm the payment belongs to this courier.
      4. Safely apply the verified payment to the debt.
    */
    console.log("Debt-payment checkout initialized:", {
      courierID: courier.id,
      walletID: wallet.id,
      debtPaymentID: updatedPayment.id,
      reference,
      amount,
    });

    return {
      success: true,
      message: "Paystack checkout link generated successfully.",
      courierID: courier.id,
      walletID: wallet.id,
      debtPaymentID: updatedPayment.id,
      reference,
      checkoutUrl: paystack.checkoutUrl,
      amount,
      currency: CURRENCY,
    };
  } catch (error) {
    console.error("initializeCourierDebtPayment failed:", {
      message: error?.message || "Unknown error",
      paymentRecordID: paymentRecord?.id || null,
      paystackInitializationAttempted,
    });

    /*
      FAILURE HANDLING

      If the payment record exists but the Paystack request
      has NOT started, the failure occurred before this
      invocation sent an initialization request to Paystack.
      Attempt to mark the record FAILED.

      If the Paystack request HAS started, leave the record
      PENDING. Paystack may have created a valid transaction
      even if this Lambda did not receive the response.

      Do not mark an uncertain transaction FAILED simply to
      allow another payment attempt.
    */
    if (paymentRecord?.id && !paystackInitializationAttempted) {
      try {
        await updateDebtPaymentRecord(paymentRecord, {
          status: "FAILED",
          failureReason:
            "Payment initialization failed before the Paystack request was started. Please retry.",
        });
      } catch (updateError) {
        console.error("Could not mark debt payment as failed:", {
          paymentRecordID: paymentRecord.id,
          message: updateError?.message,
        });
      }
    }

    return {
      success: false,
      message: paystackInitializationAttempted
        ? "We could not confirm the checkout result. Do not start another payment yet. Please retry later or contact Atua support to verify the payment reference."
        : "Unable to initialize your debt payment right now. Please try again or contact Atua support.",
      debtPaymentID: paymentRecord?.id || null,
      reference: paymentRecord?.reference || null,
    };
  }
};
