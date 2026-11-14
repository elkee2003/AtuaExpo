"use strict";

const https = require("https");
const crypto = require("crypto");
const aws4 = require("aws4");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

// ============================================================
// 1. CONFIGURATION
// ============================================================

const REGION = process.env.REGION || process.env.AWS_REGION || "eu-north-1";
const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;
const PAYSTACK_SECRET_PARAMETER = process.env.PAYSTACK_SECRET_KEY;

const CURRENCY = "NGN";
const PROVIDER = "PAYSTACK";

const MAX_DEBT_NAIRA = 100000000;
const MAX_PAYMENT_HISTORY_PAGES = 20;

const APPSYNC_TIMEOUT_MS = 15000;
const PAYSTACK_TIMEOUT_MS = 20000;

const ssmClient = new SSMClient({ region: REGION });

// ============================================================
// 2. COMMON HELPERS
// ============================================================

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function validateMoney(value, fieldName) {
  if (value === null || value === undefined || value === "") {
    throw new Error(fieldName + " is missing.");
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(fieldName + " is invalid.");
  }

  return roundMoney(amount);
}

function validateEmail(email) {
  return (
    typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  );
}

function safeErrorMessage(error) {
  return error?.message || "An unexpected error occurred.";
}

// ============================================================
// 3. APPSYNC IAM REQUEST
// ============================================================

async function graphqlRequest(
  query,
  variables = {},
  operationName = "GraphQL",
) {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error("Missing API_ATUA_GRAPHQLAPIENDPOINTOUTPUT.");
  }

  const endpoint = new URL(GRAPHQL_ENDPOINT);

  if (endpoint.protocol !== "https:") {
    throw new Error("AppSync endpoint must use HTTPS.");
  }

  const body = JSON.stringify({
    query,
    variables,
  });

  const headers = {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  };

  const signedOptions = aws4.sign({
    host: endpoint.host,
    path: endpoint.pathname + endpoint.search,
    service: "appsync",
    region: REGION,
    method: "POST",
    headers,
    body,
  });

  signedOptions.hostname = endpoint.hostname;
  signedOptions.port = endpoint.port || 443;

  return new Promise((resolve, reject) => {
    const req = https.request(signedOptions, (res) => {
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
          return reject(
            new Error(operationName + ": AppSync returned invalid JSON."),
          );
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          console.error(operationName + ": AppSync HTTP error", {
            statusCode: res.statusCode,
          });

          return reject(
            new Error(operationName + ": AppSync HTTP " + res.statusCode),
          );
        }

        if (result.errors?.length) {
          console.error(operationName + ": GraphQL errors", {
            errors: result.errors.map((item) => item.message),
          });

          return reject(
            new Error(
              operationName +
                ": " +
                result.errors.map((item) => item.message).join("; "),
            ),
          );
        }

        if (!result.data) {
          return reject(
            new Error(operationName + ": AppSync returned no data."),
          );
        }

        resolve(result.data);
      });
    });

    req.on("error", (error) => {
      reject(new Error(operationName + ": " + error.message));
    });

    req.setTimeout(APPSYNC_TIMEOUT_MS, () => {
      req.destroy(new Error(operationName + ": AppSync request timed out."));
    });

    req.write(body);
    req.end();
  });
}

// ============================================================
// 4. RETRIEVE PAYSTACK SECRET FROM SSM
// ============================================================

async function getPaystackSecretKey() {
  if (!PAYSTACK_SECRET_PARAMETER) {
    throw new Error("PAYSTACK_SECRET_KEY must contain the SSM parameter name.");
  }

  const result = await ssmClient.send(
    new GetParameterCommand({
      Name: PAYSTACK_SECRET_PARAMETER,
      WithDecryption: true,
    }),
  );

  const secretKey = result?.Parameter?.Value?.trim();

  if (!secretKey) {
    throw new Error("Paystack secret could not be retrieved from SSM.");
  }

  return secretKey;
}

// ============================================================
// 5. FIND AUTHENTICATED COURIER
// ============================================================

async function getAuthenticatedCourier(sub) {
  const query = `
    query CouriersBySub($sub: String!, $limit: Int) {
      couriersBySub(sub: $sub, limit: $limit) {
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

  // Courier supports IAM read access in the supplied schema.
  // Do not use the public API key for this lookup.

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
      "No courier profile is linked to your authenticated account.",
    );
  }

  if (couriers.length > 1) {
    throw new Error(
      "Multiple courier profiles share this account. Contact Atua support.",
    );
  }

  const courier = couriers[0];

  if (courier.sub !== sub) {
    throw new Error("Courier identity verification failed.");
  }

  if (!validateEmail(courier.email)) {
    throw new Error(
      "A valid email address must be saved in your courier profile before payment.",
    );
  }

  return {
    ...courier,
    email: courier.email.trim(),
  };
}

// ============================================================
// 6. FIND AND VALIDATE COURIER WALLET
// ============================================================

async function getCourierWallet(courier) {
  // Prefer the wallet explicitly linked to the Courier record.

  if (courier.walletID) {
    const query = `
      query GetWallet($id: ID!) {
        getWallet(id: $id) {
          id
          ownerID
          ownerType
          outstandingDebt
          activeCourierDebtID
          _deleted
        }
      }
    `;

    const data = await graphqlRequest(
      query,
      { id: courier.walletID },
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

  // Fallback for older Courier records without walletID.
  // We must confirm that exactly one wallet exists.

  const query = `
    query ListCourierWallets(
      $filter: ModelWalletFilterInput
      $limit: Int
      $nextToken: String
    ) {
      listWallets(
        filter: $filter
        limit: $limit
        nextToken: $nextToken
      ) {
        items {
          id
          ownerID
          ownerType
          outstandingDebt
          activeCourierDebtID
          _deleted
        }
        nextToken
      }
    }
  `;

  const wallets = [];
  let nextToken = null;
  let pageCount = 0;

  do {
    const data = await graphqlRequest(
      query,
      {
        filter: {
          ownerID: { eq: courier.id },
          ownerType: { eq: "COURIER" },
        },
        limit: 100,
        nextToken,
      },
      "Find courier wallet",
    );

    const result = data?.listWallets;

    if (!result) {
      throw new Error("Could not retrieve courier wallets.");
    }

    wallets.push(
      ...(result.items || []).filter(
        (wallet) =>
          wallet &&
          wallet.id &&
          wallet.ownerID === courier.id &&
          wallet.ownerType === "COURIER" &&
          wallet._deleted !== true,
      ),
    );

    nextToken = result.nextToken || null;
    pageCount += 1;

    if (pageCount >= 10 && nextToken) {
      throw new Error(
        "Could not safely verify the courier's complete wallet records.",
      );
    }
  } while (nextToken);

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

// ============================================================
// 7. FIND AND VALIDATE THE COURIER ACTIVE DEBT CYCLE
// ============================================================

async function getCourierDebt(courierDebtID, courier, wallet) {
  const query = `
    query GetCourierDebt($id: ID!) {
      getCourierDebt(id: $id) {
        id
        courierID
        walletID
        amount
        amountPaid
        remainingAmount
        status
        dueAt
        _deleted
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    { id: courierDebtID },
    "Get active courier debt cycle",
  );

  const debt = data?.getCourierDebt;

  if (!debt || debt._deleted === true) {
    throw new Error(
      "The active debt cycle linked to your wallet could not be found. Contact Atua support.",
    );
  }

  if (debt.courierID !== courier.id) {
    throw new Error(
      "The active debt cycle does not belong to your courier account.",
    );
  }

  if (debt.walletID !== wallet.id) {
    throw new Error("The active debt cycle is not linked to your wallet.");
  }

  const allowedStatuses = ["OPEN", "PARTIALLY_PAID", "OVERDUE"];

  if (!allowedStatuses.includes(debt.status)) {
    throw new Error(
      "This debt is not currently available for payment. Its status is " +
        debt.status +
        ".",
    );
  }

  const remainingAmount = validateMoney(
    debt.remainingAmount,
    "Debt remainingAmount",
  );

  if (remainingAmount <= 0) {
    throw new Error("This debt has already been fully paid.");
  }

  const walletDebt = validateMoney(
    wallet.outstandingDebt ?? 0,
    "Wallet outstandingDebt",
  );

  // The active CourierDebt record represents the consolidated debt cycle.
  // Its remaining amount must agree with the wallet-level outstanding total.

  if (Math.abs(remainingAmount - walletDebt) > 0.01) {
    throw new Error(
      "The active debt cycle does not agree with the wallet's outstanding balance. Contact Atua support.",
    );
  }

  return {
    ...debt,
    remainingAmount,
  };
}

// ============================================================
// 8. FIND EXISTING UNRESOLVED DEBT PAYMENTS
// ============================================================

async function getPendingDebtPayment(courierID, courierDebtID) {
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
          courierDebtID
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
          courierID: { eq: courierID },
          courierDebtID: { eq: courierDebtID },
        },
        limit: 100,
        nextToken,
      },
      "Check existing debt payments",
    );

    const result = data?.listCourierDebtPayments;

    if (!result) {
      throw new Error("Could not retrieve debt-payment history.");
    }

    payments.push(
      ...(result.items || []).filter(
        (payment) =>
          payment &&
          payment.id &&
          payment.courierID === courierID &&
          payment.courierDebtID === courierDebtID &&
          payment._deleted !== true,
      ),
    );

    nextToken = result.nextToken || null;
    pageCount += 1;

    if (pageCount >= MAX_PAYMENT_HISTORY_PAGES && nextToken) {
      throw new Error(
        "Could not safely check the complete debt-payment history. Please try again later.",
      );
    }
  } while (nextToken);

  const unresolved = payments
    .filter((payment) => ["PENDING", "PROCESSING"].includes(payment.status))
    .sort(
      (a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0),
    );

  if (unresolved.length > 1) {
    throw new Error(
      "Multiple unresolved debt-payment attempts exist for this courier. Contact Atua support before creating another payment.",
    );
  }

  return unresolved[0] || null;
}

// ============================================================
// 9. CREATE COURIER DEBT PAYMENT RECORD
// ============================================================

async function createDebtPaymentRecord({
  courierID,
  walletID,
  courierDebtID,
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
        courierDebtID
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
    courierDebtID,
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
    { input },
    "Create debt-payment record",
  );

  const record = data?.createCourierDebtPayment;

  if (
    !record?.id ||
    record.reference !== reference ||
    record.courierID !== courierID ||
    record.walletID !== walletID ||
    record.courierDebtID !== courierDebtID
  ) {
    throw new Error(
      "The debt-payment record could not be created or validated.",
    );
  }

  return record;
}

// ============================================================
// 10. READ A PAYMENT RECORD
// ============================================================

async function getDebtPaymentByID(paymentID) {
  const query = `
    query GetCourierDebtPayment($id: ID!) {
      getCourierDebtPayment(id: $id) {
        id
        courierID
        walletID
        courierDebtID
        amount
        currency
        provider
        reference
        status
        checkoutUrl
        failureReason
        _version
        _deleted
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    { id: paymentID },
    "Reload debt-payment record",
  );

  const payment = data?.getCourierDebtPayment;

  if (!payment || payment._deleted === true) {
    throw new Error("The debt-payment record could not be reloaded.");
  }

  return payment;
}

// ============================================================
// 11. UPDATE COURIER DEBT PAYMENT RECORD
// ============================================================

async function updateDebtPaymentRecord(payment, changes) {
  const mutation = `
    mutation UpdateCourierDebtPayment(
      $input: UpdateCourierDebtPaymentInput!
      $condition: ModelCourierDebtPaymentConditionInput
    ) {
      updateCourierDebtPayment(
        input: $input
        condition: $condition
      ) {
        id
        courierID
        walletID
        courierDebtID
        amount
        currency
        provider
        reference
        status
        checkoutUrl
        failureReason
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

  // Do not overwrite a payment that verification has already
  // moved out of PENDING.

  const condition = {
    status: { eq: "PENDING" },
    reference: { eq: payment.reference },
  };

  const data = await graphqlRequest(
    mutation,
    {
      input,
      condition,
    },
    "Update debt-payment record",
  );

  const updated = data?.updateCourierDebtPayment;

  if (!updated?.id) {
    throw new Error("The debt-payment record could not be updated.");
  }

  return updated;
}

// ============================================================
// 12. INITIALIZE PAYSTACK
// ============================================================

async function initializePaystack({
  secretKey,
  email,
  amountNaira,
  reference,
  courierID,
  walletID,
  courierDebtID,
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
      courierDebtID,
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
          Authorization: "Bearer " + secretKey,
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
            return reject(
              new Error(
                "Paystack returned an invalid response. The transaction outcome is uncertain; check the reference before retrying.",
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
            console.error("Paystack initialization was not confirmed:", {
              httpStatus: res.statusCode,
              paystackStatus: result.status,
              message: result.message,
              referenceMatches: result.data?.reference === reference,
            });

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
      reject(new Error("Paystack request failed: " + error.message));
    });

    req.setTimeout(PAYSTACK_TIMEOUT_MS, () => {
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

// ============================================================
// 13. HANDLE EXISTING UNRESOLVED PAYMENT
// ============================================================

function returnExistingPayment(existing, courier, wallet, requestedAmount) {
  if (existing.status === "PROCESSING") {
    return {
      success: false,
      message:
        "A previous debt payment is being verified or requires reconciliation. Do not initiate another payment until the previous attempt is resolved.",
      courierID: courier.id,
      walletID: wallet.id,
      debtPaymentID: existing.id,
      reference: existing.reference,
      amount: existing.amount,
      currency: existing.currency || CURRENCY,
    };
  }

  const existingAmount = validateMoney(
    existing.amount,
    "Existing payment amount",
  );

  if (Math.round(existingAmount * 100) !== Math.round(requestedAmount * 100)) {
    return {
      success: false,
      message:
        "A pending debt payment exists for a different amount. Wait for it to be verified or contact Atua support before creating another payment.",
      courierID: courier.id,
      walletID: wallet.id,
      debtPaymentID: existing.id,
      reference: existing.reference,
      amount: existingAmount,
      currency: existing.currency || CURRENCY,
    };
  }

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
      amount: existingAmount,
      currency: existing.currency || CURRENCY,
    };
  }

  return {
    success: false,
    message:
      "A debt-payment attempt is still unresolved. Its Paystack status must be checked before another payment can be created.",
    courierID: courier.id,
    walletID: wallet.id,
    debtPaymentID: existing.id,
    reference: existing.reference,
    amount: existingAmount,
    currency: existing.currency || CURRENCY,
  };
}

// ============================================================
// 14. MAIN LAMBDA HANDLER
// ============================================================

exports.handler = async (event) => {
  console.log("initializeCourierDebtPayment invoked.");

  let paymentRecord = null;
  let paystackInitializationAttempted = false;

  try {
    // --------------------------------------------------------
    // STEP 1: AUTHENTICATE COURIER
    // --------------------------------------------------------

    // This function is invoked through an authenticated
    // AppSync Cognito User Pools resolver.
    //
    // Never accept sub, courierID or walletID from arguments.

    const courierDebtIDInput = event?.arguments?.courierDebtID;
    const requestedAmountInput = event?.arguments?.requestedAmount;

    if (typeof courierDebtIDInput !== "string" || !courierDebtIDInput.trim()) {
      return {
        success: false,
        message: "A valid courier debt ID is required.",
      };
    }

    if (
      requestedAmountInput === null ||
      requestedAmountInput === undefined ||
      requestedAmountInput === ""
    ) {
      return {
        success: false,
        message: "Enter the amount you want to repay.",
      };
    }

    const sub = event?.identity?.sub;

    if (!sub || typeof sub !== "string") {
      return {
        success: false,
        message: "You must be signed in as a courier to continue.",
      };
    }

    // --------------------------------------------------------
    // STEP 2: FIND COURIER AND WALLET
    // --------------------------------------------------------

    const courier = await getAuthenticatedCourier(sub);

    const wallet = await getCourierWallet(courier);

    // --------------------------------------------------------
    // STEP 3: RETRIEVE THE ACTIVE CONSOLIDATED DEBT CYCLE
    // --------------------------------------------------------

    const courierDebtID = courierDebtIDInput.trim();

    // The client may identify the debt cycle, but it cannot choose
    // another courier's debt. Confirm that this is still the single
    // active consolidated debt cycle linked to this courier's wallet.

    if (
      typeof wallet.activeCourierDebtID !== "string" ||
      wallet.activeCourierDebtID !== courierDebtID
    ) {
      throw new Error(
        "The selected debt is not the active debt cycle linked to your wallet. Refresh your debt balance and try again.",
      );
    }

    const activeDebt = await getCourierDebt(courierDebtID, courier, wallet);

    const requestedAmount = validateMoney(
      requestedAmountInput,
      "Requested repayment amount",
    );

    if (requestedAmount <= 0) {
      throw new Error("Repayment amount must be greater than zero.");
    }

    // Paystack charges in kobo. Reject amounts with fractions smaller
    // than one kobo instead of silently changing what the courier chose.

    const requestedAmountKobo = Math.round(requestedAmount * 100);

    if (
      !Number.isSafeInteger(requestedAmountKobo) ||
      Math.abs(requestedAmount * 100 - requestedAmountKobo) > 0.000001
    ) {
      throw new Error(
        "Enter a repayment amount with no more than two decimal places.",
      );
    }

    const debtRemainingKobo = Math.round(activeDebt.remainingAmount * 100);

    if (requestedAmountKobo > debtRemainingKobo) {
      throw new Error(
        "The repayment amount cannot exceed your outstanding debt of ₦" +
          activeDebt.remainingAmount.toFixed(2) +
          ".",
      );
    }

    const amount = requestedAmountKobo / 100;

    if (amount > MAX_DEBT_NAIRA) {
      throw new Error(
        "The outstanding debt exceeds the permitted payment limit. Contact Atua support.",
      );
    }

    // --------------------------------------------------------
    // STEP 4: CHECK EXISTING UNRESOLVED PAYMENT FOR THIS DEBT CYCLE
    // --------------------------------------------------------

    const existing = await getPendingDebtPayment(courier.id, activeDebt.id);

    if (existing) {
      return returnExistingPayment(existing, courier, wallet, amount);
    }

    // --------------------------------------------------------
    // STEP 5: CHECK THAT DEBT IS STILL PAYABLE
    // --------------------------------------------------------

    if (amount <= 0) {
      return {
        success: false,
        message: "There is no outstanding debt left to repay.",
        courierID: courier.id,
        walletID: wallet.id,
        amount: 0,
        currency: CURRENCY,
      };
    }

    // --------------------------------------------------------
    // STEP 6: GENERATE BACKEND PAYMENT REFERENCE
    // --------------------------------------------------------

    const reference = "ATUA-DEBT-" + crypto.randomUUID();

    // --------------------------------------------------------
    // STEP 7: CREATE PAYMENT RECORD BEFORE PAYSTACK
    // --------------------------------------------------------

    paymentRecord = await createDebtPaymentRecord({
      courierID: courier.id,
      walletID: wallet.id,
      courierDebtID: activeDebt.id,
      amount,
      reference,
    });

    // --------------------------------------------------------
    // STEP 8: RETRIEVE PAYSTACK SECRET
    // --------------------------------------------------------

    const secretKey = await getPaystackSecretKey();

    // --------------------------------------------------------
    // STEP 9: INITIALIZE PAYSTACK
    // --------------------------------------------------------

    // Set this immediately before making the Paystack request.
    // Once the request starts, a timeout or lost response does
    // not prove that Paystack failed to create the transaction.

    paystackInitializationAttempted = true;

    const paystack = await initializePaystack({
      secretKey,
      email: courier.email,
      amountNaira: amount,
      reference,
      courierID: courier.id,
      walletID: wallet.id,
      courierDebtID: activeDebt.id,
      debtPaymentID: paymentRecord.id,
    });

    // --------------------------------------------------------
    // STEP 10: SAVE CHECKOUT URL
    // --------------------------------------------------------

    let updatedPayment;

    try {
      updatedPayment = await updateDebtPaymentRecord(paymentRecord, {
        checkoutUrl: paystack.checkoutUrl,
        status: "PENDING",
        failureReason: null,
      });
    } catch (updateError) {
      // Verification might have changed the payment status
      // while this initialization request was completing.
      // Reload before deciding what happened.

      console.error(
        "Could not save Paystack checkout URL:",
        updateError.message,
      );

      const latestPayment = await getDebtPaymentByID(paymentRecord.id);

      if (["PROCESSING", "SUCCESS"].includes(latestPayment.status)) {
        return {
          success: false,
          message:
            "The payment has already entered verification. Do not initiate another payment.",
          courierID: courier.id,
          walletID: wallet.id,
          debtPaymentID: latestPayment.id,
          reference: latestPayment.reference,
          amount: latestPayment.amount,
          currency: latestPayment.currency || CURRENCY,
        };
      }

      // If the record is still PENDING, do not mark it FAILED.
      // Paystack has already received the initialization request.
      // The reference must be checked before another attempt.

      return {
        success: false,
        message:
          "Paystack created or may have created the transaction, but Atua could not save the checkout link. Do not start another payment. The reference must be checked first.",
        courierID: courier.id,
        walletID: wallet.id,
        debtPaymentID: paymentRecord.id,
        reference,
        amount,
        currency: CURRENCY,
      };
    }

    // --------------------------------------------------------
    // STEP 11: RETURN CHECKOUT DETAILS
    // --------------------------------------------------------

    console.log("Courier debt checkout initialized:", {
      courierID: courier.id,
      walletID: wallet.id,
      debtPaymentID: updatedPayment.id,
      courierDebtID: activeDebt.id,
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
      message: safeErrorMessage(error),
      paymentRecordID: paymentRecord?.id || null,
      paystackInitializationAttempted,
    });

    // --------------------------------------------------------
    // STEP 12: FAILURE HANDLING
    // --------------------------------------------------------

    // If the Paystack request has NOT started, it is safe to
    // mark the created payment record FAILED.
    //
    // If Paystack initialization was attempted, leave the
    // payment unresolved. Its transaction may exist.

    if (paymentRecord?.id && !paystackInitializationAttempted) {
      try {
        await updateDebtPaymentRecord(paymentRecord, {
          status: "FAILED",
          failureReason:
            "Initialization failed before the Paystack request was started.",
        });
      } catch (updateError) {
        console.error("Could not mark debt payment FAILED:", {
          paymentRecordID: paymentRecord.id,
          message: updateError.message,
        });
      }
    }

    return {
      success: false,
      message: paystackInitializationAttempted
        ? "We could not confirm the checkout result. Do not start another payment yet. The payment reference must be checked first."
        : safeErrorMessage(error),
      debtPaymentID: paymentRecord?.id || null,
      reference: paymentRecord?.reference || null,
    };
  }
};
