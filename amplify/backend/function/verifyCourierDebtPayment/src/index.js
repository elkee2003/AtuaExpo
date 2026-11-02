/*
 * File:
 * amplify/backend/function/verifyCourierDebtPayment/src/index.js
 *
 * ATUA — VERIFY COURIER DEBT PAYMENT
 *
 * PURPOSE
 * -------
 * Verifies a courier's debt-repayment transaction with Paystack and,
 * if successful, reduces the courier's outstanding wallet debt.
 *
 * FLOW
 * ----
 * 1. Authenticate the courier.
 * 2. Validate the payment reference.
 * 3. Load the CourierDebtPayment record.
 * 4. Verify the payment belongs to the authenticated courier.
 * 5. Verify the transaction directly with Paystack.
 * 6. Validate the reference, amount, currency and transaction status.
 * 7. Claim the payment by changing PENDING to PROCESSING.
 * 8. Validate the courier's wallet and outstanding debt.
 * 9. Reduce the wallet debt.
 * 10. Mark the payment SUCCESS.
 *
 * IMPORTANT FINANCIAL SAFETY LIMITATION
 * -------------------------------------
 * Updating the wallet and updating CourierDebtPayment are two separate
 * AppSync operations. They are not one atomic database transaction.
 *
 * If the wallet update succeeds but the payment update fails or times
 * out, the payment may remain PROCESSING even though the debt was
 * already reduced.
 *
 * Never reset a PROCESSING payment to PENDING automatically.
 * Reconcile the payment record, Paystack transaction and wallet before
 * deciding whether any recovery action is needed.
 *
 * REQUIRED CONFIGURATION
 * ----------------------
 * REGION or AWS_REGION
 * API_ATUA_GRAPHQLAPIENDPOINTOUTPUT
 * PAYSTACK_SECRET_KEY
 *
 * PAYSTACK_SECRET_KEY must contain the NAME of the AWS SSM parameter
 * storing the Paystack secret, not the Paystack secret itself.
 *
 * The Lambda execution role needs permission to:
 * - Read the specified SSM parameter.
 * - Decrypt it if it uses a customer-managed KMS key.
 * - Call the required AppSync operations using IAM.
 *
 * Dependencies:
 * - aws4
 * - @aws-sdk/client-ssm
 */

"use strict";

const https = require("https");
const aws4 = require("aws4");

const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

// ============================================================
// 1. CONFIGURATION
// ============================================================

// AWS region where the Lambda and AppSync API are configured.
const REGION = process.env.REGION || process.env.AWS_REGION || "eu-north-1";

// AppSync GraphQL endpoint.
const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

// Name of the SSM parameter containing the Paystack secret.
const PAYSTACK_PARAMETER_NAME = process.env.PAYSTACK_SECRET_KEY;

// AWS Systems Manager client used to retrieve the secret.
const ssm = new SSMClient({
  region: REGION,
});

// This Lambda handles Paystack payments in Nigerian naira.
const CURRENCY = "NGN";
const PROVIDER = "PAYSTACK";

// Only references with this prefix are accepted by this Lambda.
const PAYMENT_PREFIX = "ATUA-DEBT-";

// Maximum allowed repayment amount in naira.
// This is a safety limit against unexpected or corrupted values.
const MAX_PAYMENT_NAIRA = 100000000;

// Cache the secret for subsequent invocations in the same warm
// Lambda execution environment. Do not log the secret.
let cachedPaystackSecret;

// ============================================================
// 2. STANDARD RESPONSE
// ============================================================

/*
 * Returns a consistent response structure to the AppSync caller.
 *
 * Additional fields can be included through the extra argument.
 */
function response(success, message, extra = {}) {
  return {
    success,
    message,
    ...extra,
  };
}

// ============================================================
// 3. GET PAYSTACK SECRET FROM AWS SSM
// ============================================================

/*
 * Retrieves the Paystack secret from AWS Systems Manager Parameter
 * Store with decryption enabled.
 *
 * The Lambda should never receive the actual secret from the mobile
 * app or from GraphQL arguments.
 */
async function getPaystackSecret() {
  // Reuse the cached secret if this execution environment already
  // retrieved it successfully.
  if (cachedPaystackSecret) {
    return cachedPaystackSecret;
  }

  if (!PAYSTACK_PARAMETER_NAME) {
    throw new Error("PAYSTACK_SECRET_KEY SSM parameter name is missing.");
  }

  // Securely retrieve the parameter value.
  const result = await ssm.send(
    new GetParameterCommand({
      Name: PAYSTACK_PARAMETER_NAME,
      WithDecryption: true,
    }),
  );

  const secret = result?.Parameter?.Value;

  if (!secret) {
    throw new Error("Paystack secret could not be retrieved.");
  }

  // Cache it only after successfully retrieving a non-empty value.
  cachedPaystackSecret = secret;

  return secret;
}

// ============================================================
// 4. APPSYNC GRAPHQL REQUEST USING AWS IAM SIGNATURE V4
// ============================================================

/*
 * Executes a GraphQL request against AppSync using the Lambda
 * execution role's AWS credentials.
 *
 * This is different from API-key authentication. The Lambda role
 * must have the required AppSync IAM permissions, and the relevant
 * schema operations must permit IAM access.
 */
async function graphqlRequest(query, variables = {}) {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error("API_ATUA_GRAPHQLAPIENDPOINTOUTPUT is missing.");
  }

  const endpoint = new URL(GRAPHQL_ENDPOINT);

  // Refuse non-HTTPS endpoints so requests are encrypted in transit.
  if (endpoint.protocol !== "https:") {
    throw new Error("The AppSync endpoint must use HTTPS.");
  }

  // Build the GraphQL request body.
  const body = JSON.stringify({
    query,
    variables,
  });

  // aws4.sign adds the AWS Signature Version 4 authorization headers.
  const request = {
    host: endpoint.host,

    // Preserve any endpoint query string if one exists.
    path: `${endpoint.pathname}${endpoint.search}`,

    method: "POST",
    service: "appsync",
    region: REGION,

    headers: {
      "Content-Type": "application/json",
      host: endpoint.host,
    },

    body,
  };

  // Sign the request using the Lambda execution role credentials.
  aws4.sign(request);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: request.host,
        path: request.path,
        method: request.method,
        headers: request.headers,
      },
      (res) => {
        let data = "";

        // Accumulate the response body.
        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          let parsed;

          // AppSync should return JSON.
          try {
            parsed = JSON.parse(data);
          } catch {
            return reject(new Error("AppSync returned an invalid response."));
          }

          // Check the HTTP status independently of GraphQL errors.
          if (res.statusCode < 200 || res.statusCode >= 300) {
            console.error("AppSync HTTP status:", res.statusCode);

            return reject(new Error("AppSync HTTP request failed."));
          }

          // A GraphQL request can return HTTP 200 and still contain
          // one or more GraphQL operation errors.
          if (parsed.errors?.length) {
            console.error(
              "AppSync GraphQL errors:",
              JSON.stringify(parsed.errors),
            );

            return reject(new Error("AppSync rejected a database operation."));
          }

          resolve(parsed.data);
        });
      },
    );

    // Prevent this request from hanging indefinitely.
    req.setTimeout(15000, () => {
      req.destroy(new Error("AppSync request timed out."));
    });

    req.on("error", reject);

    req.write(body);
    req.end();
  });
}

// ============================================================
// 5. FIND DEBT PAYMENT BY REFERENCE
// ============================================================

/*
 * Retrieves the CourierDebtPayment record associated with a
 * Paystack reference.
 *
 * A reference must identify exactly one payment record.
 */
async function getDebtPaymentByReference(reference) {
  const query = /* GraphQL */ `
    query ListCourierDebtPayments(
      $filter: ModelCourierDebtPaymentFilterInput
      $limit: Int
    ) {
      listCourierDebtPayments(filter: $filter, limit: $limit) {
        items {
          id
          courierID
          walletID
          amount
          currency
          provider
          reference
          status
          paidAt
          failureReason
          _version
        }
      }
    }
  `;

  const data = await graphqlRequest(query, {
    filter: {
      reference: {
        eq: reference,
      },
    },
    limit: 10,
  });

  const items = data?.listCourierDebtPayments?.items || [];

  // Confirm the exact reference rather than relying solely on
  // the database filter.
  const matches = items.filter((item) => item && item.reference === reference);

  if (matches.length === 0) {
    return null;
  }

  // Duplicate references are a data-integrity problem.
  if (matches.length !== 1) {
    throw new Error(
      "The payment reference does not identify exactly one record.",
    );
  }

  return matches[0];
}

// ============================================================
// 6. GET COURIER
// ============================================================

/*
 * Retrieves the courier associated with the payment record.
 *
 * The caller later compares courier.sub with the authenticated
 * Cognito subject to ensure the user owns this payment.
 */
async function getCourierById(courierID) {
  const query = /* GraphQL */ `
    query GetCourier($id: ID!) {
      getCourier(id: $id) {
        id
        sub
        email
        walletID
      }
    }
  `;

  const data = await graphqlRequest(query, {
    id: courierID,
  });

  return data?.getCourier || null;
}

// ============================================================
// 7. GET WALLET
// ============================================================

/*
 * Retrieves the wallet associated with the debt-payment record.
 *
 * We need:
 * - ownerID and ownerType to confirm wallet ownership.
 * - outstandingDebt to calculate the remaining debt.
 * - availableBalance for context if needed by future reconciliation.
 * - _version for AppSync version-conflict protection, when enabled.
 */
async function getWallet(walletID) {
  if (!walletID) {
    throw new Error("The payment has no walletID.");
  }

  const query = /* GraphQL */ `
    query GetWallet($id: ID!) {
      getWallet(id: $id) {
        id
        ownerID
        ownerType
        outstandingDebt
        availableBalance
        _version
      }
    }
  `;

  const data = await graphqlRequest(query, {
    id: walletID,
  });

  return data?.getWallet || null;
}

// ============================================================
// 8. VERIFY PAYMENT DIRECTLY WITH PAYSTACK
// ============================================================

/*
 * Calls Paystack's transaction verification endpoint.
 *
 * Do not rely solely on information submitted by the mobile app.
 * Paystack's server response is used to verify the transaction.
 */
async function verifyWithPaystack(reference) {
  const secret = await getPaystackSecret();

  const path = "/transaction/verify/" + encodeURIComponent(reference);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.paystack.co",
        path,
        method: "GET",

        headers: {
          Authorization: `Bearer ${secret}`,
          Accept: "application/json",
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
          } catch {
            return reject(new Error("Paystack returned an invalid response."));
          }

          if (res.statusCode < 200 || res.statusCode >= 300) {
            console.error("Paystack verification HTTP status:", res.statusCode);

            return reject(new Error("Paystack verification request failed."));
          }

          // Paystack must indicate success and include transaction data.
          if (parsed.status !== true || !parsed.data) {
            return reject(
              new Error("Paystack could not verify this transaction."),
            );
          }

          resolve(parsed.data);
        });
      },
    );

    req.setTimeout(15000, () => {
      req.destroy(new Error("Paystack verification timed out."));
    });

    req.on("error", reject);

    req.end();
  });
}

// ============================================================
// 9. UPDATE COURIER DEBT PAYMENT
// ============================================================

/*
 * Updates a CourierDebtPayment record.
 *
 * The optional condition allows the caller to require a particular
 * current status before the update is accepted.
 *
 * The _version value is included when available. This is useful
 * when the AppSync model has version-based conflict detection enabled.
 */
async function updateDebtPayment(payment, inputFields, condition = null) {
  const query = /* GraphQL */ `
    mutation UpdateCourierDebtPayment(
      $input: UpdateCourierDebtPaymentInput!
      $condition: ModelCourierDebtPaymentConditionInput
    ) {
      updateCourierDebtPayment(input: $input, condition: $condition) {
        id
        courierID
        walletID
        amount
        currency
        provider
        reference
        status
        paidAt
        failureReason
        _version
      }
    }
  `;

  const input = {
    id: payment.id,
    ...inputFields,
  };

  // Supply the current model version when the schema supports it.
  if (payment._version !== undefined && payment._version !== null) {
    input._version = payment._version;
  }

  const variables = {
    input,
  };

  // Only add a condition when the caller supplied one.
  if (condition) {
    variables.condition = condition;
  }

  const data = await graphqlRequest(query, variables);

  const updated = data?.updateCourierDebtPayment;

  if (!updated) {
    throw new Error("The CourierDebtPayment record was not updated.");
  }

  return updated;
}

// ============================================================
// 10. CLAIM PAYMENT: PENDING -> PROCESSING
// ============================================================

/*
 * Claims the payment before making a wallet change.
 *
 * The conditional mutation requires the stored status to be PENDING.
 * This helps stop two concurrent requests from both claiming the
 * same payment.
 *
 * Returns a consistent object:
 * - { claimed: true, payment: updatedRecord }
 * - { claimed: false, payment: latestRecord }
 *
 * If the mutation fails, reload the record to determine whether
 * another request may already have claimed it.
 *
 * IMPORTANT:
 * A failed request can sometimes have an uncertain outcome.
 * Never reset PROCESSING to PENDING automatically.
 */
async function claimPaymentForProcessing(payment) {
  try {
    const updated = await updateDebtPayment(
      payment,
      {
        status: "PROCESSING",
        failureReason: null,
      },
      {
        status: {
          eq: "PENDING",
        },
      },
    );

    return {
      claimed: true,
      payment: updated,
    };
  } catch (error) {
    // Reload the payment because another request may have won
    // the race to change PENDING to PROCESSING.
    const latest = await getDebtPaymentByReference(payment.reference);

    // If the stored state has changed, do not attempt another claim.
    if (latest && latest.status !== "PENDING") {
      return {
        claimed: false,
        payment: latest,
      };
    }

    // If it is still PENDING, the original failure was not explained
    // by another request successfully changing its status.
    throw error;
  }
}

// ============================================================
// 11. UPDATE WALLET OUTSTANDING DEBT
// ============================================================

/*
 * Writes the new outstanding debt to the wallet.
 *
 * The wallet version is supplied when available. Actual protection
 * against stale updates depends on the AppSync model's configured
 * conflict-detection behavior.
 *
 * This is a separate operation from marking the payment SUCCESS.
 */
async function updateWalletDebt(wallet, newOutstandingDebt) {
  const query = /* GraphQL */ `
    mutation UpdateWallet($input: UpdateWalletInput!) {
      updateWallet(input: $input) {
        id
        ownerID
        ownerType
        outstandingDebt
        _version
      }
    }
  `;

  const input = {
    id: wallet.id,
    outstandingDebt: newOutstandingDebt,
  };

  if (wallet._version !== undefined && wallet._version !== null) {
    input._version = wallet._version;
  }

  const data = await graphqlRequest(query, {
    input,
  });

  const updated = data?.updateWallet;

  if (!updated) {
    throw new Error("The wallet debt was not updated.");
  }

  return updated;
}

// ============================================================
// 12. HANDLE PAYMENTS THAT ARE ALREADY CLAIMED OR COMPLETED
// ============================================================

/*
 * Produces the appropriate response for a payment that is no longer
 * PENDING.
 *
 * SUCCESS:
 * A previous operation has recorded the payment as successful.
 *
 * PROCESSING:
 * Another request may be processing it, or a previous operation may
 * have stopped before finishing. PROCESSING does NOT by itself prove
 * that this request has verified Paystack or that the wallet was updated.
 *
 * Other statuses:
 * The payment cannot be processed through this verification attempt.
 */
function responseForExistingState(payment) {
  if (payment.status === "SUCCESS") {
    return response(
      true,
      "This payment has already been recorded as successful.",
      {
        verified: true,
        alreadyPaid: true,
        reference: payment.reference,
        amount: payment.amount,
        currency: payment.currency,
      },
    );
  }

  if (payment.status === "PROCESSING") {
    /*
     * CORRECTION:
     * Do not return verified: true here.
     *
     * The status PROCESSING only tells us that the payment has been
     * claimed. It does not prove that the wallet update completed or
     * that this invocation independently verified Paystack.
     */
    return response(
      false,
      "This payment is already being processed or requires reconciliation. Do not retry it repeatedly. If the status does not change, contact Atua support.",
      {
        verified: false,
        processing: true,
        reference: payment.reference,
      },
    );
  }

  return response(
    false,
    `This payment cannot be processed from status ${payment.status}.`,
    {
      verified: false,
      reference: payment.reference,
    },
  );
}

// ============================================================
// 13. MAIN LAMBDA HANDLER
// ============================================================

/*
 * Expected AppSync event:
 *
 * {
 *   "arguments": {
 *     "reference": "ATUA-DEBT-..."
 *   },
 *   "identity": {
 *     "sub": "authenticated-cognito-user-sub"
 *   }
 * }
 *
 * Configure the AppSync mutation to require Cognito authentication.
 * Do not allow the client to choose the courier ID used for ownership
 * verification.
 */
exports.handler = async (event) => {
  let payment = null;

  /*
   * Diagnostic flag only.
   *
   * true means the wallet update returned successfully.
   * false does NOT guarantee the wallet was unchanged: a network
   * timeout can occur after AppSync has already applied the update.
   */
  let walletUpdateCompleted = false;

  try {
    console.log("VERIFY COURIER DEBT PAYMENT: started");

    // ----------------------------------------------------------
    // STEP 1: REQUIRE AN AUTHENTICATED COGNITO IDENTITY
    // ----------------------------------------------------------

    const authenticatedSub = event?.identity?.sub;

    if (typeof authenticatedSub !== "string" || !authenticatedSub.trim()) {
      return response(false, "You must be signed in to verify this payment.");
    }

    // ----------------------------------------------------------
    // STEP 2: VALIDATE THE PAYMENT REFERENCE
    // ----------------------------------------------------------

    const reference = String(event?.arguments?.reference || "").trim();

    /*
     * Validate the prefix, allowed characters and maximum length.
     * The reference must come from an existing payment record and
     * must also be verified against Paystack.
     */
    if (
      !reference ||
      reference.length > 100 ||
      !reference.startsWith(PAYMENT_PREFIX) ||
      !/^ATUA-DEBT-[A-Za-z0-9-]+$/.test(reference)
    ) {
      return response(
        false,
        "A valid Atua debt-payment reference is required.",
      );
    }

    // ----------------------------------------------------------
    // STEP 3: LOAD THE DEBT-PAYMENT RECORD
    // ----------------------------------------------------------

    payment = await getDebtPaymentByReference(reference);

    if (!payment) {
      return response(
        false,
        "No debt-payment record was found for this reference.",
      );
    }

    // ----------------------------------------------------------
    // STEP 4: VALIDATE PROVIDER AND CURRENCY
    // ----------------------------------------------------------

    if (
      payment.provider !== PROVIDER ||
      String(payment.currency).toUpperCase() !== CURRENCY
    ) {
      return response(false, "This is not a valid Atua Paystack debt payment.");
    }

    // ----------------------------------------------------------
    // STEP 5: CONFIRM PAYMENT OWNERSHIP
    // ----------------------------------------------------------

    /*
     * Load the courier from the payment record, then compare the
     * courier's Cognito sub with the authenticated user's sub.
     *
     * This prevents one authenticated courier from verifying another
     * courier's debt payment merely by supplying its reference.
     */
    const courier = await getCourierById(payment.courierID);

    if (!courier || courier.sub !== authenticatedSub) {
      return response(false, "You are not authorized to verify this payment.");
    }

    // ----------------------------------------------------------
    // STEP 6: HANDLE ALREADY COMPLETED OR CLAIMED PAYMENTS
    // ----------------------------------------------------------

    /*
     * SUCCESS means the database already records the payment as
     * completed. Return an idempotent success response.
     *
     * PROCESSING or any other non-PENDING status must not go through
     * the normal wallet-update flow again.
     *
     * This prevents a normal retry from deducting the same payment
     * from the wallet debt a second time.
     */
    if (payment.status === "SUCCESS") {
      return responseForExistingState(payment);
    }

    if (payment.status !== "PENDING") {
      return responseForExistingState(payment);
    }

    // ----------------------------------------------------------
    // STEP 7: VERIFY THE TRANSACTION WITH PAYSTACK
    // ----------------------------------------------------------

    /*
     * Verify using Paystack's API, not a status supplied by the app.
     */
    const transaction = await verifyWithPaystack(reference);

    // Confirm Paystack returned the exact reference we requested.
    if (transaction.reference !== payment.reference) {
      return response(
        false,
        "The Paystack reference does not match the payment record.",
      );
    }

    // Only a transaction whose Paystack status is "success" proceeds.
    if (transaction.status !== "success") {
      return response(false, "Paystack has not confirmed successful payment.", {
        verified: false,
        reference,
        providerStatus: transaction.status || "UNKNOWN",
      });
    }

    // ----------------------------------------------------------
    // STEP 8: VALIDATE THE PAYMENT AMOUNT
    // ----------------------------------------------------------

    /*
     * Paystack reports transaction amounts in kobo.
     * The CourierDebtPayment record is assumed to store naira.
     *
     * Example:
     * ₦2,000 in the database = 200,000 kobo from Paystack.
     */
    const paymentAmount = Number(payment.amount);

    const expectedKobo = Math.round(paymentAmount * 100);

    const receivedKobo = Number(transaction.amount);

    /*
     * Reject:
     * - Invalid or zero amounts.
     * - Negative amounts.
     * - Amounts above the configured safety limit.
     * - Values that cannot be safely represented in kobo.
     * - Transactions whose received amount differs from the expected
     *   amount in the database.
     */
    if (
      !Number.isFinite(paymentAmount) ||
      paymentAmount <= 0 ||
      paymentAmount > MAX_PAYMENT_NAIRA ||
      !Number.isSafeInteger(expectedKobo) ||
      !Number.isFinite(receivedKobo) ||
      receivedKobo !== expectedKobo
    ) {
      console.error("Debt-payment amount mismatch:", {
        reference,
        expectedKobo,
        receivedKobo,
      });

      return response(
        false,
        "The verified payment amount does not match the expected amount.",
      );
    }

    // ----------------------------------------------------------
    // STEP 9: VALIDATE PAYSTACK CURRENCY
    // ----------------------------------------------------------

    if (String(transaction.currency).toUpperCase() !== CURRENCY) {
      return response(false, "The verified payment currency is not NGN.");
    }

    // ----------------------------------------------------------
    // STEP 10: CLAIM THE PAYMENT BEFORE CHANGING THE WALLET
    // ----------------------------------------------------------

    /*
     * The conditional mutation attempts to change:
     *
     * PENDING -> PROCESSING
     *
     * Only a payment currently in PENDING should be claimable.
     * This helps prevent concurrent requests from processing the
     * same payment simultaneously.
     *
     * The claim is made before the wallet is modified.
     */
    const claim = await claimPaymentForProcessing(payment);

    /*
     * If another request already claimed or completed the payment,
     * return the current state instead of updating the wallet again.
     */
    if (claim.claimed === false) {
      return responseForExistingState(claim.payment);
    }

    // Continue with the newly claimed, current payment record.
    payment = claim.payment;

    // ----------------------------------------------------------
    // STEP 11: LOAD AND VALIDATE THE WALLET
    // ----------------------------------------------------------

    const wallet = await getWallet(payment.walletID);

    if (!wallet) {
      throw new Error("The courier wallet could not be found.");
    }

    /*
     * Confirm that the wallet referenced by the payment actually
     * belongs to this courier.
     */
    if (wallet.ownerID !== courier.id || wallet.ownerType !== "COURIER") {
      throw new Error("The payment wallet does not belong to this courier.");
    }

    // Treat a missing outstandingDebt as zero.
    const currentDebt = Number(wallet.outstandingDebt ?? 0);

    // Reject corrupted or unexpectedly large debt values.
    if (
      !Number.isFinite(currentDebt) ||
      currentDebt < 0 ||
      currentDebt > MAX_PAYMENT_NAIRA
    ) {
      throw new Error("The wallet outstanding debt is invalid.");
    }

    // ----------------------------------------------------------
    // STEP 12: CHECK WHETHER THE PAYMENT EXCEEDS THE CURRENT DEBT
    // ----------------------------------------------------------

    /*
     * The courier's debt may have changed since checkout was created.
     *
     * Do not silently discard an excess payment or mark the entire
     * payment successful while leaving the debt calculation unresolved.
     *
     * If the amount exceeds the current debt, leave the payment in
     * PROCESSING for reconciliation. The wallet has not been changed
     * by this Lambda at this point.
     */
    if (paymentAmount > currentDebt) {
      console.error("Payment exceeds current wallet debt:", {
        reference,
        paymentAmount,
        currentDebt,
        courierID: courier.id,
        walletID: wallet.id,
      });

      return response(
        false,
        "Paystack confirmed the payment, but the outstanding debt has changed. The payment requires reconciliation before it can be finalized. Contact Atua support.",
        {
          verified: true,
          processing: true,
          reference,
          amount: paymentAmount,
          currentDebt,
        },
      );
    }

    // ----------------------------------------------------------
    // STEP 13: CALCULATE THE REMAINING DEBT
    // ----------------------------------------------------------

    /*
     * Subtract the verified repayment from the outstanding debt.
     * Round to two decimal places to avoid floating-point residue.
     *
     * This assumes the debt is represented in naira with two decimal
     * places. For the strongest financial precision, store and
     * calculate monetary amounts in integer kobo consistently.
     */
    const remainingDebt = Number((currentDebt - paymentAmount).toFixed(2));

    // ----------------------------------------------------------
    // STEP 14: UPDATE THE WALLET DEBT
    // ----------------------------------------------------------

    /*
     * This is the first financial database mutation.
     *
     * If AppSync version conflict detection is configured, the wallet
     * _version can help reject a stale update.
     *
     * IMPORTANT:
     * This wallet mutation is not atomic with the next payment mutation.
     * If this update succeeds but the following operation fails, the
     * payment may remain PROCESSING and must be reconciled.
     */
    const updatedWallet = await updateWalletDebt(wallet, remainingDebt);

    // This flag means the wallet update returned successfully.
    // It is useful for logs but is not an atomic transaction guarantee.
    walletUpdateCompleted = true;

    // ----------------------------------------------------------
    // STEP 15: MARK THE PAYMENT SUCCESSFUL
    // ----------------------------------------------------------

    /*
     * Only mark the payment SUCCESS after the wallet update returns.
     *
     * The condition requires the payment still to be PROCESSING.
     * This helps prevent an unexpected status transition from being
     * overwritten.
     */
    const paidAt = new Date().toISOString();

    const successfulPayment = await updateDebtPayment(
      payment,
      {
        status: "SUCCESS",
        paidAt,
        failureReason: null,
      },
      {
        status: {
          eq: "PROCESSING",
        },
      },
    );

    // ----------------------------------------------------------
    // STEP 16: LOG THE SUCCESSFUL RESULT
    // ----------------------------------------------------------

    /*
     * Log identifiers and amounts needed for operational investigation.
     * Never log the Paystack secret or signed request headers.
     */
    console.log("COURIER DEBT PAYMENT VERIFIED:", {
      courierID: courier.id,
      walletID: updatedWallet.id,
      paymentID: successfulPayment.id,
      reference,
      amount: paymentAmount,
      previousDebt: currentDebt,
      remainingDebt,
    });

    // ----------------------------------------------------------
    // STEP 17: RETURN SUCCESS
    // ----------------------------------------------------------

    return response(true, "Payment verified successfully.", {
      verified: true,
      alreadyPaid: false,
      reference,
      amount: paymentAmount,
      currency: CURRENCY,
      previousDebt: currentDebt,
      remainingDebt,
      paidAt,
    });
  } catch (error) {
    // ----------------------------------------------------------
    // STEP 18: HANDLE ERRORS SAFELY
    // ----------------------------------------------------------

    /*
     * Do not log the Paystack secret or request authorization headers.
     *
     * The flag is diagnostic only. A false value does not prove that
     * the wallet was unchanged, because a timeout can happen after
     * AppSync applies a mutation but before this Lambda receives its
     * response.
     */
    console.error("VERIFY COURIER DEBT PAYMENT ERROR:", {
      message: error?.message,
      paymentID: payment?.id,
      reference: payment?.reference,
      walletUpdateCompleted,
    });

    /*
     * Do not reset PROCESSING to PENDING here.
     *
     * If a mutation timed out, its actual database outcome may be
     * uncertain. Automatically retrying could reduce the debt twice.
     *
     * Reconcile:
     * - The Paystack transaction.
     * - The CourierDebtPayment status.
     * - The wallet's outstandingDebt.
     *
     * Only after those records are compared should a recovery action
     * be performed.
     */
    return response(
      false,
      "We could not complete payment verification. If Paystack has charged you, do not make another payment for the same debt yet. Contact Atua support for reconciliation.",
      {
        reference: payment?.reference || null,
        processing: payment?.status === "PROCESSING",
      },
    );
  }
};
