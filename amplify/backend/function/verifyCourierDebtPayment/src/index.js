"use strict";

/*
 * ATUA — VERIFY COURIER DEBT PAYMENT
 *
 * Verifies a Paystack debt repayment and applies it to:
 *   1. The linked CourierDebt record.
 *   2. Wallet.outstandingDebt.
 *   3. The Transaction ledger.
 *
 * IMPORTANT:
 * - Never deduct from availableBalance.
 * - Never deduct from pendingBalance.
 * - Never change lifetimeEarnings.
 * - Never reset PROCESSING to PENDING.
 * - Never automatically repeat an uncertain financial mutation.
 * - Partial repayments do not reset the original debt deadline.
 *
 * ENVIRONMENT VARIABLES:
 * REGION or AWS_REGION
 * API_ATUA_GRAPHQLAPIENDPOINTOUTPUT
 * PAYSTACK_SECRET_KEY (SSM parameter name, not secret value)
 *
 * DEPENDENCIES:
 * aws4
 * @aws-sdk/client-ssm
 *
 * REQUIRED IAM:
 * ssm:GetParameter
 * kms:Decrypt (if using a customer-managed KMS key)
 * AppSync IAM access for Courier, CourierDebt,
 * CourierDebtPayment, Wallet and Transaction.
 */

const https = require("https");
const crypto = require("crypto");
const aws4 = require("aws4");

const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

// ============================================================
// 1. CONFIGURATION
// ============================================================

const REGION = process.env.REGION || process.env.AWS_REGION || "eu-north-1";

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const PAYSTACK_PARAMETER_NAME = process.env.PAYSTACK_SECRET_KEY;

const CURRENCY = "NGN";
const PROVIDER = "PAYSTACK";
const PAYMENT_PREFIX = "ATUA-DEBT-";

const MAX_PAYMENT_NAIRA = 100000000;
const REQUEST_TIMEOUT_MS = 15000;

const ACTIVE_DEBT_STATUSES = ["OPEN", "PARTIALLY_PAID", "OVERDUE"];

let cachedPaystackSecret = null;

const ssm = new SSMClient({ region: REGION });

// ============================================================
// 2. GENERAL HELPERS
// ============================================================

function response(success, message, extra = {}) {
  return {
    success,
    message,
    ...extra,
  };
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function toKobo(value, fieldName) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    throw new Error(`${fieldName} is not a valid amount.`);
  }

  const kobo = Math.round(amount * 100);

  if (!Number.isSafeInteger(kobo)) {
    throw new Error(`${fieldName} is outside the supported range.`);
  }

  return kobo;
}

function fromKobo(kobo) {
  if (!Number.isSafeInteger(kobo)) {
    throw new Error("Invalid monetary amount.");
  }

  return Number((kobo / 100).toFixed(2));
}

function parseJsonSafely(value) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("The server returned an invalid JSON response.");
  }
}

function validDate(value) {
  if (!value) return false;

  return Number.isFinite(new Date(value).getTime());
}

// ============================================================
// 3. PAYSTACK SECRET FROM SSM
// ============================================================

async function getPaystackSecret() {
  if (cachedPaystackSecret) {
    return cachedPaystackSecret;
  }

  if (!isNonEmptyString(PAYSTACK_PARAMETER_NAME)) {
    throw new Error("PAYSTACK_SECRET_KEY SSM parameter name is missing.");
  }

  const result = await ssm.send(
    new GetParameterCommand({
      Name: PAYSTACK_PARAMETER_NAME,
      WithDecryption: true,
    }),
  );

  const secret = result?.Parameter?.Value;

  if (!isNonEmptyString(secret)) {
    throw new Error("Paystack secret could not be retrieved from SSM.");
  }

  cachedPaystackSecret = secret;

  return secret;
}

// ============================================================
// 4. APPSYNC REQUEST
// ============================================================

async function graphqlRequest(query, variables = {}) {
  if (!isNonEmptyString(GRAPHQL_ENDPOINT)) {
    throw new Error("API_ATUA_GRAPHQLAPIENDPOINTOUTPUT is missing.");
  }

  const endpoint = new URL(GRAPHQL_ENDPOINT);

  if (endpoint.protocol !== "https:") {
    throw new Error("The AppSync endpoint must use HTTPS.");
  }

  const body = JSON.stringify({
    query,
    variables,
  });

  const headers = {
    "Content-Type": "application/json",
    host: endpoint.host,
  };

  const signedRequest = {
    host: endpoint.host,
    path: `${endpoint.pathname}${endpoint.search}`,
    method: "POST",
    service: "appsync",
    region: REGION,
    headers,
    body,
  };

  aws4.sign(signedRequest);
  Object.assign(headers, signedRequest.headers);

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: endpoint.hostname,
        port: endpoint.port || 443,
        path: `${endpoint.pathname}${endpoint.search}`,
        method: "POST",
        headers: {
          ...headers,
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
            parsed = parseJsonSafely(data);
          } catch (error) {
            return reject(error);
          }

          if (res.statusCode < 200 || res.statusCode >= 300) {
            console.error("AppSync HTTP error:", {
              statusCode: res.statusCode,
            });

            return reject(new Error("AppSync database request failed."));
          }

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

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error("AppSync request timed out."));
    });

    request.on("error", reject);

    request.write(body);
    request.end();
  });
}

// ============================================================
// 5. LOAD PAYMENT BY REFERENCE
// ============================================================

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
          courierDebtID
          amount
          currency
          provider
          reference
          status
          paidAt
          amountApplied
          debtBefore
          debtAfter
          transactionID
          processedAt
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

  const matches = items.filter((item) => item && item.reference === reference);

  if (matches.length === 0) {
    return null;
  }

  if (matches.length !== 1) {
    throw new Error(
      "The reference does not identify exactly one payment record.",
    );
  }

  return matches[0];
}

// ============================================================
// 6. LOAD COURIER
// ============================================================

async function getCourierById(courierID) {
  const query = /* GraphQL */ `
    query GetCourier($id: ID!) {
      getCourier(id: $id) {
        id
        sub
        email
        walletID

        debtRestrictionActive
        debtDueAt
        debtBlockedAt
        debtBlockReason

        isOnline
        isApproved
        isBlocked
        statusKey

        _version
      }
    }
  `;

  const data = await graphqlRequest(query, {
    id: courierID,
  });

  return data?.getCourier || null;
}

// ============================================================
// 7. LOAD WALLET
// ============================================================

async function getWallet(walletID) {
  const query = /* GraphQL */ `
    query GetWallet($id: ID!) {
      getWallet(id: $id) {
        id
        ownerID
        ownerType
        outstandingDebt
        activeCourierDebtID
        availableBalance
        pendingBalance
        lifetimeEarnings
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
// 8. LOAD THE SPECIFIC COURIER DEBT
// ============================================================

async function getCourierDebt(courierDebtID) {
  const query = /* GraphQL */ `
    query GetCourierDebt($id: ID!) {
      getCourierDebt(id: $id) {
        id
        courierID
        walletID
        amount
        amountPaid
        remainingAmount
        externalPaymentsAmount
        status
        debtStartedAt
        dueAt
        firstPaymentAt
        settledAt
        _version
      }
    }
  `;

  const data = await graphqlRequest(query, {
    id: courierDebtID,
  });

  return data?.getCourierDebt || null;
}

// ============================================================
// 9. UPDATE COURIER DEBT
// ============================================================

async function updateCourierDebt(
  debt,
  changes,
  oldRemainingAmount,
  oldAmountPaid,
) {
  const query = /* GraphQL */ `
    mutation UpdateCourierDebt(
      $input: UpdateCourierDebtInput!
      $condition: ModelCourierDebtConditionInput
    ) {
      updateCourierDebt(input: $input, condition: $condition) {
        id
        courierID
        walletID
        amount
        amountPaid
        remainingAmount
        externalPaymentsAmount
        status
        debtStartedAt
        dueAt
        firstPaymentAt
        settledAt
        _version
      }
    }
  `;

  const input = {
    id: debt.id,
    ...changes,
  };

  if (debt._version !== undefined && debt._version !== null) {
    input._version = debt._version;
  }

  const data = await graphqlRequest(query, {
    input,
    condition: {
      courierID: {
        eq: debt.courierID,
      },
      walletID: {
        eq: debt.walletID,
      },
      remainingAmount: {
        eq: oldRemainingAmount,
      },
      amountPaid: {
        eq: oldAmountPaid,
      },
      status: {
        eq: debt.status,
      },
    },
  });

  const updated = data?.updateCourierDebt;

  if (!updated) {
    throw new Error("Courier debt update failed. Reconciliation is required.");
  }

  return updated;
}

// ============================================================
// 10. VERIFY DIRECTLY WITH PAYSTACK
// ============================================================

async function verifyWithPaystack(reference) {
  const secret = await getPaystackSecret();

  const path = "/transaction/verify/" + encodeURIComponent(reference);

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: "api.paystack.co",
        port: 443,
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
            parsed = parseJsonSafely(data);
          } catch (error) {
            return reject(error);
          }

          if (res.statusCode < 200 || res.statusCode >= 300) {
            console.error("Paystack verification HTTP error:", {
              statusCode: res.statusCode,
              reference,
            });

            return reject(new Error("Paystack verification request failed."));
          }

          if (parsed.status !== true || !parsed.data) {
            return reject(
              new Error(
                parsed.message || "Paystack could not verify this transaction.",
              ),
            );
          }

          resolve(parsed.data);
        });
      },
    );

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error("Paystack verification request timed out."));
    });

    request.on("error", reject);
    request.end();
  });
}

// ============================================================
// 11. UPDATE COURIER DEBT PAYMENT
// ============================================================

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
        courierDebtID
        amount
        currency
        provider
        reference
        status
        paidAt
        amountApplied
        debtBefore
        debtAfter
        transactionID
        processedAt
        failureReason
        _version
      }
    }
  `;

  const input = {
    id: payment.id,
    ...inputFields,
  };

  if (payment._version !== undefined && payment._version !== null) {
    input._version = payment._version;
  }

  const variables = { input };

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
// 12. CLAIM PAYMENT: PENDING -> PROCESSING
// ============================================================

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
    const latest = await getDebtPaymentByReference(payment.reference);

    if (latest && latest.status !== "PENDING") {
      return {
        claimed: false,
        payment: latest,
      };
    }

    throw error;
  }
}

// ============================================================
// 13. TRANSACTION LOOKUP
// ============================================================

function getDebtTransactionReference(paymentReference) {
  return `DEBT-PAYMENT-${paymentReference}`;
}

async function getDebtTransactionByReference(reference) {
  const query = /* GraphQL */ `
    query TransactionsByReference($reference: String!, $limit: Int) {
      transactionsByReference(reference: $reference, limit: $limit) {
        items {
          id
          walletID
          type
          amount
          description
          paymentID
          reference
          status
        }
      }
    }
  `;

  const data = await graphqlRequest(query, {
    reference,
    limit: 10,
  });

  const items = data?.transactionsByReference?.items || [];

  const matches = items.filter((item) => item && item.reference === reference);

  if (matches.length > 1) {
    throw new Error("Duplicate debt repayment transactions were found.");
  }

  return matches[0] || null;
}

// ============================================================
// 14. CREATE DEBT REPAYMENT TRANSACTION
// ============================================================

async function createDebtTransaction({
  payment,
  wallet,
  amount,
  transactionReference,
}) {
  const existing = await getDebtTransactionByReference(transactionReference);

  if (existing) {
    if (
      existing.walletID !== wallet.id ||
      existing.paymentID !== payment.id ||
      Number(existing.amount) !== amount ||
      existing.type !== "DEBT_REPAYMENT"
    ) {
      throw new Error(
        "An existing transaction has conflicting payment details.",
      );
    }

    return existing;
  }

  const deterministicID =
    "DEBT-" +
    crypto
      .createHash("sha256")
      .update(payment.reference)
      .digest("hex")
      .slice(0, 40);

  const query = /* GraphQL */ `
    mutation CreateTransaction($input: CreateTransactionInput!) {
      createTransaction(input: $input) {
        id
        walletID
        type
        amount
        description
        paymentID
        reference
        status
      }
    }
  `;

  try {
    const data = await graphqlRequest(query, {
      input: {
        id: deterministicID,
        walletID: wallet.id,
        type: "DEBT_REPAYMENT",
        amount,
        description: "Courier debt repayment via Paystack",
        paymentID: payment.id,
        reference: transactionReference,
        status: "PENDING",
      },
    });

    const created = data?.createTransaction;

    if (!created) {
      throw new Error("The debt repayment transaction was not created.");
    }

    return created;
  } catch (error) {
    // The create request may have succeeded even if its
    // response was lost. Check before reporting failure.
    const recovered = await getDebtTransactionByReference(transactionReference);

    if (recovered) {
      if (
        recovered.walletID !== wallet.id ||
        recovered.paymentID !== payment.id ||
        Number(recovered.amount) !== amount ||
        recovered.type !== "DEBT_REPAYMENT"
      ) {
        throw new Error("The recovered transaction has conflicting details.");
      }

      return recovered;
    }

    throw error;
  }
}

// ============================================================
// 15. UPDATE TRANSACTION STATUS
// ============================================================

async function updateDebtTransactionStatus(transaction, status) {
  const query = /* GraphQL */ `
    mutation UpdateTransaction($input: UpdateTransactionInput!) {
      updateTransaction(input: $input) {
        id
        walletID
        type
        amount
        description
        paymentID
        reference
        status
      }
    }
  `;

  const data = await graphqlRequest(query, {
    input: {
      id: transaction.id,
      status,
    },
  });

  const updated = data?.updateTransaction;

  if (!updated) {
    throw new Error(
      "The debt repayment transaction status could not be updated.",
    );
  }

  return updated;
}

// ============================================================
// 16. UPDATE WALLET OUTSTANDING DEBT AND ACTIVE DEBT POINTER
// ============================================================

async function updateWalletDebt(wallet, oldDebt, newDebt, courierDebtID) {
  if (wallet.activeCourierDebtID !== courierDebtID) {
    throw new Error(
      "The wallet's active debt pointer changed. Reconciliation is required.",
    );
  }

  const fullySettled = newDebt === 0;

  const query = /* GraphQL */ `
    mutation UpdateWallet(
      $input: UpdateWalletInput!
      $condition: ModelWalletConditionInput
    ) {
      updateWallet(input: $input, condition: $condition) {
        id
        ownerID
        ownerType
        outstandingDebt
        activeCourierDebtID
        _version
      }
    }
  `;

  const input = {
    id: wallet.id,
    outstandingDebt: newDebt,
    activeCourierDebtID: fullySettled ? null : courierDebtID,
  };

  if (wallet._version !== undefined && wallet._version !== null) {
    input._version = wallet._version;
  }

  const data = await graphqlRequest(query, {
    input,
    condition: {
      ownerID: {
        eq: wallet.ownerID,
      },
      ownerType: {
        eq: "COURIER",
      },
      outstandingDebt: {
        eq: oldDebt,
      },
      activeCourierDebtID: {
        eq: courierDebtID,
      },
    },
  });

  const updated = data?.updateWallet;

  if (!updated) {
    throw new Error("Wallet outstanding debt could not be updated.");
  }

  return updated;
}

// ============================================================
// 17. SYNCHRONISE COURIER DEBT RESTRICTION
// ============================================================

async function syncCourierDebtRestriction(courierID) {
  const courier = await getCourierById(courierID);

  if (!courier) {
    throw new Error(
      "Courier could not be found while synchronising debt restriction.",
    );
  }

  // ----------------------------------------------------------
  // LOAD ALL COURIER DEBTS
  // ----------------------------------------------------------

  const query = /* GraphQL */ `
    query ListCourierDebts(
      $filter: ModelCourierDebtFilterInput
      $limit: Int
      $nextToken: String
    ) {
      listCourierDebts(filter: $filter, limit: $limit, nextToken: $nextToken) {
        items {
          id
          courierID
          remainingAmount
          status
          dueAt
        }
        nextToken
      }
    }
  `;

  const allDebts = [];
  let nextToken = null;

  do {
    const data = await graphqlRequest(query, {
      filter: {
        courierID: {
          eq: courierID,
        },
      },
      limit: 1000,
      nextToken,
    });

    const result = data?.listCourierDebts;

    if (!result) {
      throw new Error("Could not retrieve courier debt records.");
    }

    allDebts.push(...(result.items || []));
    nextToken = result.nextToken || null;
  } while (nextToken);

  // ----------------------------------------------------------
  // IDENTIFY ACTIVE AND OVERDUE DEBTS
  // ----------------------------------------------------------

  const activeDebts = allDebts.filter((debt) => {
    const remaining = Number(debt.remainingAmount || 0);

    return remaining > 0 && ACTIVE_DEBT_STATUSES.includes(debt.status);
  });

  const now = Date.now();

  const overdueDebts = activeDebts.filter((debt) => {
    if (!validDate(debt.dueAt)) {
      throw new Error(
        `Active debt ${debt.id} has a missing or invalid deadline.`,
      );
    }

    return new Date(debt.dueAt).getTime() <= now;
  });

  const earliestDueAt =
    activeDebts.length > 0
      ? activeDebts
          .map((debt) => debt.dueAt)
          .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0]
      : null;

  const shouldRestrict = overdueDebts.length > 0;

  // ----------------------------------------------------------
  // CALCULATE DEBT RESTRICTION FIELDS
  // ----------------------------------------------------------

  const debtBlockedAt = shouldRestrict
    ? courier.debtBlockedAt || new Date().toISOString()
    : null;

  const debtBlockReason = shouldRestrict ? "OVERDUE_DEBT" : null;

  // ----------------------------------------------------------
  // SYNCHRONISE STATUS KEY
  // ----------------------------------------------------------

  let updatedStatusKey = courier.statusKey || null;

  /*
   * If the courier still has overdue debt and is already
   * offline, retain the debt-offline status.
   */
  if (
    shouldRestrict &&
    courier.isOnline !== true &&
    courier.isBlocked !== true &&
    courier.isApproved === true
  ) {
    updatedStatusKey = "OFFLINE#DEBT";
  }

  /*
   * If the debt restriction has been cleared, restore the
   * normal approved-offline status ONLY when the previous
   * status was OFFLINE#DEBT.
   *
   * Do not accidentally overwrite:
   * - ONLINE#APPROVED
   * - OFFLINE#BLOCKED
   * - OFFLINE#NOT_APPROVED
   */
  if (!shouldRestrict && courier.statusKey === "OFFLINE#DEBT") {
    if (courier.isBlocked === true) {
      updatedStatusKey = "OFFLINE#BLOCKED";
    } else if (courier.isApproved !== true) {
      updatedStatusKey = "OFFLINE#NOT_APPROVED";
    } else {
      updatedStatusKey = "OFFLINE#APPROVED";
    }
  }

  // ----------------------------------------------------------
  // CHECK WHETHER ANYTHING ACTUALLY CHANGED
  // ----------------------------------------------------------

  const restrictionChanged =
    courier.debtRestrictionActive !== shouldRestrict ||
    (courier.debtDueAt || null) !== earliestDueAt ||
    (courier.debtBlockedAt || null) !== debtBlockedAt ||
    (courier.debtBlockReason || null) !== debtBlockReason ||
    (courier.statusKey || null) !== updatedStatusKey;

  if (!restrictionChanged) {
    return {
      debtRestrictionActive: shouldRestrict,
      debtDueAt: earliestDueAt,
      activeDebtCount: activeDebts.length,
      overdueDebtCount: overdueDebts.length,
      statusKey: updatedStatusKey,
      updated: false,
    };
  }

  // ----------------------------------------------------------
  // UPDATE COURIER THROUGH APPSYNC
  // ----------------------------------------------------------

  const input = {
    id: courier.id,

    debtRestrictionActive: shouldRestrict,
    debtDueAt: earliestDueAt,
    debtBlockedAt,
    debtBlockReason,

    statusKey: updatedStatusKey,
  };

  if (courier._version !== undefined && courier._version !== null) {
    input._version = courier._version;
  }

  const updateQuery = /* GraphQL */ `
    mutation UpdateCourier($input: UpdateCourierInput!) {
      updateCourier(input: $input) {
        id
        debtRestrictionActive
        debtDueAt
        debtBlockedAt
        debtBlockReason
        statusKey
        _version
      }
    }
  `;

  const updateData = await graphqlRequest(updateQuery, {
    input,
  });

  const updatedCourier = updateData?.updateCourier;

  if (!updatedCourier) {
    throw new Error("Could not update the courier's debt restriction.");
  }

  console.log("COURIER DEBT RESTRICTION SYNCHRONISED:", {
    courierID: courier.id,
    debtRestrictionActive: updatedCourier.debtRestrictionActive,
    statusKey: updatedCourier.statusKey,
    activeDebtCount: activeDebts.length,
    overdueDebtCount: overdueDebts.length,
  });

  return {
    debtRestrictionActive: shouldRestrict,
    debtDueAt: earliestDueAt,
    activeDebtCount: activeDebts.length,
    overdueDebtCount: overdueDebts.length,
    statusKey: updatedStatusKey,
    updated: true,
  };
}

// ============================================================
// 18. EXISTING PAYMENT STATE RESPONSE
// ============================================================

function responseForExistingState(payment) {
  if (payment.status === "SUCCESS") {
    return response(
      true,
      "This debt payment has already been processed successfully.",
      {
        verified: true,
        alreadyPaid: true,
        reference: payment.reference,
        amount: payment.amountApplied ?? payment.amount,
        currency: payment.currency,
        remainingDebt: payment.debtAfter ?? null,
        transactionID: payment.transactionID ?? null,
        paidAt: payment.paidAt ?? null,
      },
    );
  }

  if (payment.status === "PROCESSING") {
    return response(
      false,
      "This payment is already being processed or requires reconciliation. Do not make another payment for this reference. Contact Atua support if the status does not change.",
      {
        verified: false,
        processing: true,
        reconciliationRequired: true,
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
      status: payment.status,
    },
  );
}

// ============================================================
// 19. VALIDATE PAYSTACK RESPONSE
// ============================================================

function validatePaystackTransaction(transaction, payment) {
  if (!transaction) {
    throw new Error("Paystack did not return transaction details.");
  }

  if (transaction.reference !== payment.reference) {
    throw new Error(
      "The Paystack reference does not match the Atua payment record.",
    );
  }

  if (transaction.status !== "success") {
    return {
      successful: false,
      providerStatus: transaction.status || "UNKNOWN",
    };
  }

  if (String(transaction.currency).toUpperCase() !== CURRENCY) {
    throw new Error("The verified Paystack transaction is not in NGN.");
  }

  const savedAmount = Number(payment.amount);

  if (
    !Number.isFinite(savedAmount) ||
    savedAmount <= 0 ||
    savedAmount > MAX_PAYMENT_NAIRA
  ) {
    throw new Error("The saved payment amount is invalid.");
  }

  const expectedKobo = toKobo(savedAmount, "Saved payment amount");

  const receivedKobo = Number(transaction.amount);

  if (!Number.isSafeInteger(receivedKobo)) {
    throw new Error("Paystack returned an invalid transaction amount.");
  }

  if (receivedKobo !== expectedKobo) {
    console.error("Debt payment amount mismatch:", {
      reference: payment.reference,
      expectedKobo,
      receivedKobo,
    });

    throw new Error(
      "The verified Paystack amount does not match the saved debt payment amount.",
    );
  }

  return {
    successful: true,
    amountKobo: receivedKobo,
    amountNaira: fromKobo(receivedKobo),
  };
}

// ============================================================
// 20. MAIN HANDLER
// ============================================================

exports.handler = async (event) => {
  let payment = null;

  try {
    console.log("VERIFY COURIER DEBT PAYMENT: started");

    // --------------------------------------------------------
    // STEP 1: AUTHENTICATE COURIER
    // --------------------------------------------------------

    const authenticatedSub =
      event?.identity?.sub || event?.identity?.claims?.sub;

    if (!isNonEmptyString(authenticatedSub)) {
      return response(
        false,
        "You must be signed in to verify this debt payment.",
      );
    }

    // --------------------------------------------------------
    // STEP 2: VALIDATE REFERENCE
    // --------------------------------------------------------

    const reference = String(
      event?.arguments?.reference || event?.reference || "",
    ).trim();

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

    // --------------------------------------------------------
    // STEP 3: LOAD PAYMENT RECORD
    // --------------------------------------------------------

    payment = await getDebtPaymentByReference(reference);

    if (!payment) {
      return response(
        false,
        "No debt-payment record was found for this reference.",
      );
    }

    // --------------------------------------------------------
    // STEP 4: VALIDATE PROVIDER AND CURRENCY
    // --------------------------------------------------------

    if (
      payment.provider !== PROVIDER ||
      String(payment.currency).toUpperCase() !== CURRENCY
    ) {
      return response(false, "This is not a valid Atua Paystack debt payment.");
    }

    // --------------------------------------------------------
    // STEP 5: VERIFY COURIER OWNERSHIP
    // --------------------------------------------------------

    const courier = await getCourierById(payment.courierID);

    if (!courier || courier.sub !== authenticatedSub) {
      return response(false, "You are not authorized to verify this payment.");
    }

    if (courier.walletID && courier.walletID !== payment.walletID) {
      throw new Error(
        "The payment wallet does not match the courier's registered wallet.",
      );
    }

    // --------------------------------------------------------
    // STEP 6: HANDLE EXISTING PAYMENT STATES
    // --------------------------------------------------------

    if (payment.status !== "PENDING") {
      if (payment.status === "SUCCESS") {
        // A previous invocation may have completed the
        // financial updates but failed during restriction sync.
        await syncCourierDebtRestriction(payment.courierID);
      }

      return responseForExistingState(payment);
    }

    // --------------------------------------------------------
    // STEP 7: VERIFY DIRECTLY WITH PAYSTACK
    // --------------------------------------------------------

    const paystackTransaction = await verifyWithPaystack(reference);

    const verification = validatePaystackTransaction(
      paystackTransaction,
      payment,
    );

    if (!verification.successful) {
      // Leave PENDING. A later verification may confirm success.
      return response(
        false,
        "Paystack has not confirmed a successful payment.",
        {
          verified: false,
          reference,
          providerStatus: verification.providerStatus,
        },
      );
    }

    const paymentAmount = verification.amountNaira;
    const paymentAmountKobo = verification.amountKobo;

    // --------------------------------------------------------
    // STEP 8: CLAIM PAYMENT
    // --------------------------------------------------------

    const claim = await claimPaymentForProcessing(payment);

    if (!claim.claimed) {
      return responseForExistingState(claim.payment);
    }

    payment = claim.payment;

    // --------------------------------------------------------
    // STEP 9: LOAD AND VALIDATE WALLET
    // --------------------------------------------------------

    const wallet = await getWallet(payment.walletID);

    if (!wallet) {
      throw new Error("The courier wallet could not be found.");
    }

    if (wallet.ownerID !== courier.id || wallet.ownerType !== "COURIER") {
      throw new Error(
        "The wallet referenced by this payment does not belong to the courier.",
      );
    }

    // --------------------------------------------------------
    // STEP 10: LOAD THE SPECIFIC LINKED DEBT
    // --------------------------------------------------------

    if (!isNonEmptyString(payment.courierDebtID)) {
      throw new Error("The payment is not linked to a courier debt.");
    }

    const courierDebt = await getCourierDebt(payment.courierDebtID);

    if (!courierDebt) {
      throw new Error("The associated courier debt could not be found.");
    }

    if (
      courierDebt.courierID !== courier.id ||
      courierDebt.walletID !== wallet.id
    ) {
      throw new Error(
        "The selected debt does not belong to this courier wallet.",
      );
    }

    if (!ACTIVE_DEBT_STATUSES.includes(courierDebt.status)) {
      throw new Error(
        `This debt cannot receive payment because its status is ${courierDebt.status}.`,
      );
    }

    // The payment must apply to the wallet's one consolidated
    // active debt cycle.
    if (wallet.activeCourierDebtID !== courierDebt.id) {
      throw new Error(
        "The wallet's active debt pointer does not match the debt linked to this payment. Reconciliation is required.",
      );
    }

    // --------------------------------------------------------
    // STEP 11: VALIDATE BALANCES
    // --------------------------------------------------------

    const currentDebt = Number(wallet.outstandingDebt ?? 0);

    if (
      !Number.isFinite(currentDebt) ||
      currentDebt < 0 ||
      currentDebt > MAX_PAYMENT_NAIRA
    ) {
      throw new Error("The wallet outstanding debt is invalid.");
    }

    const currentDebtKobo = toKobo(currentDebt, "Wallet outstanding debt");

    const debtRemainingKobo = toKobo(
      courierDebt.remainingAmount,
      "Courier debt remaining amount",
    );

    const debtAmountPaidKobo = toKobo(
      courierDebt.amountPaid ?? 0,
      "Courier debt amount paid",
    );

    const debtExternalPaymentsKobo = toKobo(
      courierDebt.externalPaymentsAmount ?? 0,
      "Courier debt external payments",
    );

    if (
      debtRemainingKobo <= 0 ||
      debtAmountPaidKobo < 0 ||
      debtExternalPaymentsKobo < 0
    ) {
      throw new Error("The selected courier debt has invalid balances.");
    }

    // This architecture uses one consolidated active debt
    // cycle. The wallet and debt must therefore agree.
    if (currentDebtKobo !== debtRemainingKobo) {
      throw new Error(
        "Wallet outstanding debt does not match the active courier debt. Reconciliation is required.",
      );
    }

    // --------------------------------------------------------
    // STEP 12: CHECK FOR EXISTING TRANSACTION
    // --------------------------------------------------------

    const transactionReference = getDebtTransactionReference(reference);

    const existingTransaction =
      await getDebtTransactionByReference(transactionReference);

    if (existingTransaction) {
      // Do not repeat any financial update if a transaction
      // already exists. The previous invocation may have
      // completed one or more database mutations.
      return response(
        false,
        "A repayment transaction already exists for this reference. Reconciliation is required before any further financial update.",
        {
          verified: true,
          processing: true,
          reconciliationRequired: true,
          reference,
          transactionID: existingTransaction.id,
          transactionStatus: existingTransaction.status,
        },
      );
    }

    // --------------------------------------------------------
    // STEP 13: PREVENT OVERPAYMENT
    // --------------------------------------------------------

    if (paymentAmountKobo > debtRemainingKobo) {
      console.error("Payment exceeds selected courier debt:", {
        reference,
        courierDebtID: courierDebt.id,
        paymentAmount,
        debtRemaining: fromKobo(debtRemainingKobo),
      });

      return response(
        false,
        "Paystack confirmed the payment, but the selected debt is now lower than the amount paid. Manual reconciliation is required.",
        {
          verified: true,
          processing: true,
          reconciliationRequired: true,
          reference,
          amount: paymentAmount,
          selectedDebtRemaining: fromKobo(debtRemainingKobo),
        },
      );
    }

    if (paymentAmountKobo > currentDebtKobo) {
      console.error("Payment exceeds wallet outstanding debt:", {
        reference,
        courierID: courier.id,
        walletID: wallet.id,
        paymentAmount,
        currentDebt,
      });

      return response(
        false,
        "Paystack confirmed the payment, but the wallet outstanding debt is lower than the amount paid. Manual reconciliation is required.",
        {
          verified: true,
          processing: true,
          reconciliationRequired: true,
          reference,
          amount: paymentAmount,
          currentDebt,
        },
      );
    }

    // --------------------------------------------------------
    // STEP 14: CALCULATE NEW BALANCES
    // --------------------------------------------------------

    const remainingDebtKobo = currentDebtKobo - paymentAmountKobo;

    const remainingDebt = fromKobo(remainingDebtKobo);

    const debtRemainingAfterKobo = debtRemainingKobo - paymentAmountKobo;

    const debtRemainingAfter = fromKobo(debtRemainingAfterKobo);

    const debtAmountPaidAfter = fromKobo(
      debtAmountPaidKobo + paymentAmountKobo,
    );

    const debtExternalPaymentsAfter = fromKobo(
      debtExternalPaymentsKobo + paymentAmountKobo,
    );

    // Preserve debtStartedAt and dueAt.
    if (!validDate(courierDebt.dueAt)) {
      throw new Error(
        "The selected courier debt has no valid repayment deadline. Manual reconciliation is required.",
      );
    }

    const debtIsPastDue = new Date(courierDebt.dueAt).getTime() <= Date.now();

    const debtStatusAfter =
      debtRemainingAfterKobo === 0
        ? "PAID"
        : debtIsPastDue
          ? "OVERDUE"
          : "PARTIALLY_PAID";

    const paidAt = new Date().toISOString();

    // --------------------------------------------------------
    // STEP 15: CREATE PENDING TRANSACTION
    // --------------------------------------------------------

    const transaction = await createDebtTransaction({
      payment,
      wallet,
      amount: paymentAmount,
      transactionReference,
    });

    if (transaction.status !== "PENDING") {
      throw new Error(
        "The repayment transaction is not in the expected PENDING state.",
      );
    }

    // --------------------------------------------------------
    // STEP 16: UPDATE THE SPECIFIC COURIER DEBT
    // --------------------------------------------------------

    const updatedCourierDebt = await updateCourierDebt(
      courierDebt,
      {
        amountPaid: debtAmountPaidAfter,
        remainingAmount: debtRemainingAfter,
        externalPaymentsAmount: debtExternalPaymentsAfter,
        status: debtStatusAfter,
        firstPaymentAt: courierDebt.firstPaymentAt || paidAt,
        settledAt: debtRemainingAfterKobo === 0 ? paidAt : null,
      },
      fromKobo(debtRemainingKobo),
      fromKobo(debtAmountPaidKobo),
    );

    // --------------------------------------------------------
    // STEP 17: UPDATE WALLET DEBT AND POINTER
    // --------------------------------------------------------

    // This updates outstandingDebt only.
    // It never changes availableBalance, pendingBalance
    // or lifetimeEarnings.
    //
    // Partial repayment: retain activeCourierDebtID.
    // Full repayment: clear activeCourierDebtID.

    const updatedWallet = await updateWalletDebt(
      wallet,
      currentDebt,
      remainingDebt,
      courierDebt.id,
    );

    // --------------------------------------------------------
    // STEP 18: COMPLETE TRANSACTION
    // --------------------------------------------------------

    const completedTransaction = await updateDebtTransactionStatus(
      transaction,
      "COMPLETED",
    );

    // --------------------------------------------------------
    // STEP 19: MARK PAYMENT SUCCESSFUL
    // --------------------------------------------------------

    const successfulPayment = await updateDebtPayment(
      payment,
      {
        status: "SUCCESS",
        paidAt,
        amountApplied: paymentAmount,
        debtBefore: currentDebt,
        debtAfter: remainingDebt,
        transactionID: completedTransaction.id,
        processedAt: paidAt,
        failureReason: null,
      },
      {
        status: {
          eq: "PROCESSING",
        },
      },
    );

    payment = successfulPayment;

    // --------------------------------------------------------
    // STEP 20: SYNCHRONISE DEBT RESTRICTION
    // --------------------------------------------------------

    const restrictionResult = await syncCourierDebtRestriction(courier.id);

    console.log("DEBT RESTRICTION AFTER REPAYMENT:", restrictionResult);

    // --------------------------------------------------------
    // STEP 21: LOG SUCCESS
    // --------------------------------------------------------

    console.log("COURIER DEBT PAYMENT SUCCESSFULLY VERIFIED:", {
      courierID: courier.id,
      walletID: updatedWallet.id,
      paymentID: successfulPayment.id,
      transactionID: completedTransaction.id,
      debtID: updatedCourierDebt.id,
      debtRemainingAfter,
      debtStatusAfter,
      reference,
      amountApplied: paymentAmount,
      debtBefore: currentDebt,
      debtAfter: remainingDebt,
      activeCourierDebtID: updatedWallet.activeCourierDebtID,
    });

    // --------------------------------------------------------
    // STEP 22: RETURN SUCCESS
    // --------------------------------------------------------

    return response(
      true,
      "Your debt repayment has been verified and applied successfully.",
      {
        verified: true,
        alreadyPaid: false,
        reference,
        amount: paymentAmount,
        amountApplied: paymentAmount,
        currency: CURRENCY,
        previousDebt: currentDebt,
        remainingDebt,
        transactionID: completedTransaction.id,
        paidAt,
        debtStatus: debtStatusAfter,
        debtRestrictionActive: restrictionResult.debtRestrictionActive,
      },
    );
  } catch (error) {
    console.error("VERIFY COURIER DEBT PAYMENT ERROR:", {
      message: error?.message,
      paymentID: payment?.id,
      reference: payment?.reference,
      paymentStatus: payment?.status,
    });

    /*
     * Do not:
     * - Reset PROCESSING to PENDING.
     * - Deduct the wallet debt again automatically.
     * - Mark a payment SUCCESS without confirming the ledger updates.
     * - Change availableBalance.
     * - Change pendingBalance.
     * - Change lifetimeEarnings.
     *
     * If AppSync times out, the mutation may still have succeeded.
     * Keep the payment PROCESSING until its records have been
     * checked and reconciled.
     */

    return response(
      false,
      "We could not safely complete this debt-payment verification. If Paystack has charged you, do not make another payment for the same reference. Contact Atua support for reconciliation.",
      {
        reference: payment?.reference || null,
        processing: payment?.status === "PROCESSING",
        reconciliationRequired: true,
      },
    );
  }
};
