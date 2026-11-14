/* Amplify Params - DO NOT EDIT
    ENV
    REGION
    API_ATUA_GRAPHQLAPIIDOUTPUT
    API_ATUA_GRAPHQLAPIENDPOINTOUTPUT
    API_ATUA_GRAPHQLAPIKEYOUTPUT
    RECONCILIATION_CURRENCY
*/

"use strict";

const https = require("https");
const aws4 = require("aws4");
const crypto = require("crypto");

/* ============================================================
   CONFIGURATION
============================================================ */

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const GRAPHQL_API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

const AWS_REGION = process.env.AWS_REGION || process.env.REGION;

const CURRENCY = process.env.RECONCILIATION_CURRENCY || "NGN";

const PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 20000;
const MAX_PAGES = 10000;

/*
 * ACCOUNTING RULES
 *
 * This Lambda calculates and records a reconciliation only.
 *
 * It must NOT:
 * - Deduct Wallet.availableBalance.
 * - Deduct Wallet.pendingBalance.
 * - Deduct Wallet.lifetimeEarnings.
 * - Reduce Wallet.outstandingDebt.
 * - Create or settle CourierDebt records.
 * - Transfer money to the courier.
 * - Mark online earnings as paid.
 * - Mark CashCollection records as reconciled.
 * - Approve or settle a reconciliation.
 *
 * Online earnings owed by Atua and cash debt owed by the
 * courier are separate obligations.
 *
 * Cash debt is:
 * commissionAmount + platformFee + vatAmount
 *
 * Never offset online earnings against cash debt.
 */

/* ============================================================
   GRAPHQL REQUEST
============================================================ */

const graphqlRequest = async (query, variables = {}, authMode = "IAM") => {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error("Missing API_ATUA_GRAPHQLAPIENDPOINTOUTPUT.");
  }

  const endpoint = new URL(GRAPHQL_ENDPOINT);

  const body = JSON.stringify({
    query,
    variables,
  });

  const baseHeaders = {
    "Content-Type": "application/json",
  };

  let requestHeaders;

  if (authMode === "API_KEY") {
    if (!GRAPHQL_API_KEY) {
      throw new Error("Missing API_ATUA_GRAPHQLAPIKEYOUTPUT.");
    }

    requestHeaders = {
      ...baseHeaders,
      "x-api-key": GRAPHQL_API_KEY,
    };
  } else {
    if (!AWS_REGION) {
      throw new Error("Missing AWS_REGION/REGION for IAM authentication.");
    }

    const signedRequest = aws4.sign(
      {
        host: endpoint.host,
        path: endpoint.pathname + endpoint.search,
        service: "appsync",
        region: AWS_REGION,
        method: "POST",
        headers: baseHeaders,
        body,
      },
      {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN,
      },
    );

    requestHeaders = signedRequest.headers;
  }

  const response = await new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: endpoint.hostname,
        port: endpoint.port || 443,
        path: endpoint.pathname + endpoint.search,
        method: "POST",
        headers: requestHeaders,
      },
      (res) => {
        let responseText = "";

        res.setEncoding("utf8");

        res.on("data", (chunk) => {
          responseText += chunk;
        });

        res.on("end", () => {
          resolve({
            statusCode: res.statusCode || 0,
            body: responseText,
          });
        });
      },
    );

    request.on("error", reject);

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error("AppSync request timed out."));
    });

    request.write(body);
    request.end();
  });

  let parsed;

  try {
    parsed = JSON.parse(response.body);
  } catch {
    throw new Error(
      "AppSync returned a non-JSON response: " + response.body.slice(0, 300),
    );
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(
      `AppSync HTTP ${response.statusCode}: ` +
        JSON.stringify(parsed.errors || parsed),
    );
  }

  if (parsed.errors?.length) {
    throw new Error(
      "AppSync GraphQL error: " +
        parsed.errors.map((error) => error.message).join("; "),
    );
  }

  if (!parsed.data) {
    throw new Error("AppSync did not return GraphQL data.");
  }

  return parsed.data;
};

/* ============================================================
   PAGINATION
============================================================ */

const fetchAllPages = async ({
  query,
  variables,
  resultField,
  authMode = "IAM",
}) => {
  const allItems = [];

  let nextToken = null;
  let pageCount = 0;

  do {
    pageCount += 1;

    if (pageCount > MAX_PAGES) {
      throw new Error("Pagination safety limit reached.");
    }

    const data = await graphqlRequest(
      query,
      {
        ...variables,
        limit: PAGE_SIZE,
        nextToken,
      },
      authMode,
    );

    const result = data[resultField];

    if (!result) {
      throw new Error(`AppSync did not return ${resultField}.`);
    }

    const items = Array.isArray(result.items) ? result.items : [];

    allItems.push(...items);

    nextToken = result.nextToken || null;
  } while (nextToken);

  return allItems;
};

/* ============================================================
   1. LOAD DELIVERED ORDERS FOR COURIER
============================================================ */

/*
 * We use the stored financial values on each Order.
 *
 * We do not recalculate historical orders using the
 * current pricing configuration.
 *
 * This query uses API_KEY authentication to preserve the
 * existing Order access pattern in this Lambda.
 */

const LIST_COURIER_ORDERS = `
  query ListCourierOrders(
    $filter: ModelOrderFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listOrders(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        status
        assignedCourierId
        paymentMethod
        paymentStatus
        payoutStatus
        courierEarnings
        commissionAmount
        platformFee
        vatAmount
        totalPrice
        unloadingCompletedAt
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;

const listCourierOrders = async (courierID) => {
  const orders = await fetchAllPages({
    query: LIST_COURIER_ORDERS,
    variables: {
      filter: {
        assignedCourierId: {
          eq: courierID,
        },
      },
    },
    resultField: "listOrders",
    authMode: "API_KEY",
  });

  return orders.filter(
    (order) =>
      order &&
      order.assignedCourierId === courierID &&
      order.status === "DELIVERED",
  );
};

/* ============================================================
   2. LOAD CASH COLLECTIONS FOR COURIER
============================================================ */

const LIST_CASH_COLLECTIONS = `
  query ListCourierCashCollections(
    $filter: ModelCashCollectionFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listCashCollections(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        orderID
        courierID
        amount
        status
        confirmedAt
        reconciledAt
        reconciliationReference
        idempotencyKey
        courierDebtID
        atuaShareAmount
        debtAppliedAt
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;

const listCashCollections = async (courierID) => {
  const collections = await fetchAllPages({
    query: LIST_CASH_COLLECTIONS,
    variables: {
      filter: {
        courierID: {
          eq: courierID,
        },
      },
    },
    resultField: "listCashCollections",
    authMode: "IAM",
  });

  return collections.filter(
    (collection) => collection && collection.courierID === courierID,
  );
};

/* ============================================================
   3. LOAD EXISTING RECONCILIATIONS
============================================================ */

const LIST_RECONCILIATIONS = `
  query ListCourierReconciliations(
    $filter: ModelCourierReconciliationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listCourierReconciliations(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        courierID
        reconciliationReference
        periodStart
        periodEnd
        onlineCourierEarnings
        cashCollectedAmount
        amountCourierOwesAtua
        amountAtuaOwesCourier
        previousSettlements
        adjustments
        netAmount
        direction
        status
        calculatedAt
        notes
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;

const listReconciliations = async (courierID) => {
  const records = await fetchAllPages({
    query: LIST_RECONCILIATIONS,
    variables: {
      filter: {
        courierID: {
          eq: courierID,
        },
      },
    },
    resultField: "listCourierReconciliations",
    authMode: "IAM",
  });

  return records.filter((record) => record && record.courierID === courierID);
};

/* ============================================================
   4. GET RECONCILIATION BY ID
============================================================ */

const GET_RECONCILIATION = `
  query GetCourierReconciliation($id: ID!) {
    getCourierReconciliation(id: $id) {
      id
      courierID
      reconciliationReference
      periodStart
      periodEnd
      onlineCourierEarnings
      cashCollectedAmount
      amountCourierOwesAtua
      amountAtuaOwesCourier
      previousSettlements
      adjustments
      netAmount
      direction
      status
      calculatedAt
      notes
      createdAt
      updatedAt
    }
  }
`;

const getReconciliationByID = async (id) => {
  const data = await graphqlRequest(GET_RECONCILIATION, { id }, "IAM");

  return data.getCourierReconciliation || null;
};

/* ============================================================
   5. CREATE RECONCILIATION
============================================================ */

const CREATE_RECONCILIATION = `
  mutation CreateCourierReconciliation(
    $input: CreateCourierReconciliationInput!
  ) {
    createCourierReconciliation(input: $input) {
      id
      courierID
      reconciliationReference
      periodStart
      periodEnd
      onlineCourierEarnings
      cashCollectedAmount
      amountCourierOwesAtua
      amountAtuaOwesCourier
      previousSettlements
      adjustments
      netAmount
      direction
      status
      calculatedAt
      notes
      createdAt
      updatedAt
    }
  }
`;

const createReconciliation = async (input) => {
  const data = await graphqlRequest(CREATE_RECONCILIATION, { input }, "IAM");

  const record = data.createCourierReconciliation;

  if (!record?.id) {
    throw new Error("AppSync did not return the created reconciliation.");
  }

  return record;
};

/* ============================================================
   6. FINANCIAL HELPERS
============================================================ */

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
};

const roundMoney = (amount) => {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

const isWithinPeriod = (value, startMs, endMs) => {
  if (!value) return false;

  const timestamp = Date.parse(value);

  return (
    Number.isFinite(timestamp) && timestamp >= startMs && timestamp <= endMs
  );
};

const parsePeriod = (periodStart, periodEnd) => {
  if (!periodStart || !periodEnd) {
    throw new Error("periodStart and periodEnd are required.");
  }

  const startMs = Date.parse(periodStart);
  const endMs = Date.parse(periodEnd);

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new Error(
      "periodStart and periodEnd must be valid date/time values.",
    );
  }

  if (startMs >= endMs) {
    throw new Error("periodStart must be earlier than periodEnd.");
  }

  return {
    startMs,
    endMs,
    normalizedStart: new Date(startMs).toISOString(),
    normalizedEnd: new Date(endMs).toISOString(),
  };
};

/* ============================================================
   7. DETERMINISTIC IDENTIFIERS
============================================================ */

const makeReconciliationID = (courierID, startMs, endMs) => {
  const source = `${courierID}|${startMs}|${endMs}`;

  const hash = crypto.createHash("sha256").update(source).digest("hex");

  return `CR-${hash}`;
};

const makeReconciliationReference = (courierID, startMs, endMs) => {
  const safeCourierID = String(courierID)
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 40);

  return `CR-${safeCourierID}-${startMs}-${endMs}`;
};

/* ============================================================
   8. PERIOD COMPARISON
============================================================ */

const samePeriod = (record, startMs, endMs) => {
  return (
    Date.parse(record.periodStart) === startMs &&
    Date.parse(record.periodEnd) === endMs
  );
};

const periodsOverlap = (record, startMs, endMs) => {
  const existingStart = Date.parse(record.periodStart);

  const existingEnd = Date.parse(record.periodEnd);

  if (!Number.isFinite(existingStart) || !Number.isFinite(existingEnd)) {
    throw new Error(
      `Existing reconciliation ${record.id} has invalid period dates.`,
    );
  }

  /*
   * Treat periods as inclusive.
   * This prevents two reconciliations from sharing
   * even a single timestamp.
   */
  return startMs <= existingEnd && endMs >= existingStart;
};

/* ============================================================
   9. VALIDATE EXISTING RECONCILIATION
============================================================ */

const validateExistingReconciliation = (record, courierID, startMs, endMs) => {
  if (!record) {
    throw new Error("Expected reconciliation record was not found.");
  }

  if (record.courierID !== courierID) {
    throw new Error("Reconciliation ID belongs to a different courier.");
  }

  if (!samePeriod(record, startMs, endMs)) {
    throw new Error("Existing reconciliation ID has a different period.");
  }

  return record;
};

/* ============================================================
   10. VALIDATE CASH COLLECTION FINANCIALS
============================================================ */

const calculateAtuaShare = (order, collection) => {
  const commission = toFiniteNumber(order.commissionAmount);

  const platformFee = toFiniteNumber(order.platformFee);

  const vat = toFiniteNumber(order.vatAmount);

  if (
    commission === null ||
    commission < 0 ||
    platformFee === null ||
    platformFee < 0 ||
    vat === null ||
    vat < 0
  ) {
    throw new Error(
      `Order ${order.id} has missing or invalid commission, platformFee, or vatAmount.`,
    );
  }

  const calculatedShare = roundMoney(commission + platformFee + vat);

  /*
   * recordCashCollection stores atuaShareAmount.
   *
   * When it is present, compare it with the amount
   * calculated from the Order's stored financial fields.
   * A mismatch should be investigated instead of silently
   * choosing one value.
   */
  if (
    collection.atuaShareAmount !== null &&
    collection.atuaShareAmount !== undefined
  ) {
    const storedShare = toFiniteNumber(collection.atuaShareAmount);

    if (storedShare === null || storedShare < 0) {
      throw new Error(
        `Cash collection ${collection.id} has an invalid atuaShareAmount.`,
      );
    }

    if (Math.abs(roundMoney(storedShare) - calculatedShare) > 0.01) {
      throw new Error(
        `Cash collection ${collection.id} has an atuaShareAmount that does not match its Order financial breakdown.`,
      );
    }
  }

  return calculatedShare;
};

/* ============================================================
   11. MAIN RECONCILIATION
============================================================ */

const reconcileCourierBalance = async ({
  courierID,
  periodStart,
  periodEnd,
}) => {
  if (typeof courierID !== "string" || !courierID.trim()) {
    throw new Error("courierID is required.");
  }

  courierID = courierID.trim();

  const { startMs, endMs, normalizedStart, normalizedEnd } = parsePeriod(
    periodStart,
    periodEnd,
  );

  /* ----------------------------------------------------------
     STEP 1: CHECK EXISTING RECONCILIATIONS
  ---------------------------------------------------------- */

  const existingRecords = await listReconciliations(courierID);

  const samePeriodRecord = existingRecords.find((record) =>
    samePeriod(record, startMs, endMs),
  );

  if (samePeriodRecord) {
    validateExistingReconciliation(samePeriodRecord, courierID, startMs, endMs);

    /*
     * Do not silently return a potentially stale snapshot.
     *
     * If a reconciliation already exists for this exact
     * period, review it before creating another one.
     *
     * This Lambda does not overwrite historical financial
     * snapshots or change approved/settled records.
     */
    throw new Error(
      `A reconciliation already exists for this exact period (${samePeriodRecord.reconciliationReference}, status: ${samePeriodRecord.status}). Review that record before attempting another reconciliation.`,
    );
  }

  /*
   * Prevent overlapping reconciliations.
   *
   * REVERSED records do not block a new reconciliation.
   * All other existing records block overlapping periods.
   */

  const blockingStatuses = ["PENDING", "CALCULATED", "APPROVED", "SETTLED"];

  const overlappingRecord = existingRecords.find(
    (record) =>
      blockingStatuses.includes(record.status) &&
      periodsOverlap(record, startMs, endMs),
  );

  if (overlappingRecord) {
    throw new Error(
      "This period overlaps an existing " +
        `${overlappingRecord.status} reconciliation ` +
        `(${overlappingRecord.reconciliationReference}). ` +
        "Use a non-overlapping period or review the existing record.",
    );
  }

  /* ----------------------------------------------------------
     STEP 2: LOAD SOURCE RECORDS
  ---------------------------------------------------------- */

  const [orders, collections] = await Promise.all([
    listCourierOrders(courierID),
    listCashCollections(courierID),
  ]);

  const ordersByID = new Map(orders.map((order) => [order.id, order]));

  /* ----------------------------------------------------------
     STEP 3: CALCULATE ONLINE COURIER EARNINGS

     Include only:
     - Delivered orders.
     - Assigned to this courier.
     - PAYSTACK payment method.
     - Payment status PAID.
     - Payout status NOT_PAID.
     - Delivery completed within the period.
     - Valid stored courierEarnings.

     These are earnings Atua owes the courier.

     They must never be deducted from cash debt.
  ---------------------------------------------------------- */

  let onlineCourierEarnings = 0;
  let onlineOrderCount = 0;

  const eligibleOnlineOrderIDs = [];

  for (const order of orders) {
    if (order.paymentMethod !== "PAYSTACK") {
      continue;
    }

    if (order.paymentStatus !== "PAID" || order.payoutStatus !== "NOT_PAID") {
      continue;
    }

    if (!order.unloadingCompletedAt) {
      throw new Error(
        `Eligible online order ${order.id} has no unloadingCompletedAt timestamp.`,
      );
    }

    const deliveryTimestamp = Date.parse(order.unloadingCompletedAt);

    if (!Number.isFinite(deliveryTimestamp)) {
      throw new Error(
        `Online order ${order.id} has an invalid unloadingCompletedAt timestamp.`,
      );
    }

    if (!isWithinPeriod(order.unloadingCompletedAt, startMs, endMs)) {
      continue;
    }

    const earnings = toFiniteNumber(order.courierEarnings);

    if (earnings === null || earnings < 0) {
      throw new Error(
        `Online order ${order.id} has invalid courierEarnings. Reconciliation stopped.`,
      );
    }

    onlineCourierEarnings += earnings;

    onlineOrderCount += 1;

    eligibleOnlineOrderIDs.push(order.id);
  }

  onlineCourierEarnings = roundMoney(onlineCourierEarnings);

  /* ----------------------------------------------------------
     STEP 4: CALCULATE CASH COLLECTIONS

     Only confirmed physical cash collections count.

     The full amount collected is reported separately.

     The amount owed to Atua is:
       commissionAmount
       + platformFee
       + vatAmount

     Do not use the full cash collection amount as Atua's
     share, and do not offset this debt against online earnings.
  ---------------------------------------------------------- */

  let cashCollectedAmount = 0;
  let amountCourierOwesAtua = 0;
  let cashCollectionCount = 0;

  const eligibleCashCollectionIDs = [];

  const processedCashOrderIDs = new Set();

  for (const collection of collections) {
    if (collection.status !== "CONFIRMED") {
      continue;
    }

    /*
     * Collections already reconciled by a previous
     * settlement/reconciliation process must not be
     * counted again.
     */
    if (collection.reconciledAt) {
      continue;
    }

    if (!collection.confirmedAt) {
      throw new Error(
        `Confirmed cash collection ${collection.id} has no confirmedAt timestamp.`,
      );
    }

    const collectionTimestamp = Date.parse(collection.confirmedAt);

    if (!Number.isFinite(collectionTimestamp)) {
      throw new Error(
        `Cash collection ${collection.id} has an invalid confirmedAt timestamp.`,
      );
    }

    if (!isWithinPeriod(collection.confirmedAt, startMs, endMs)) {
      continue;
    }

    if (!collection.orderID) {
      throw new Error(`Cash collection ${collection.id} has no orderID.`);
    }

    /*
     * A single order should have one confirmed cash
     * collection record under the current collection flow.
     *
     * Do not silently count duplicates.
     */
    if (processedCashOrderIDs.has(collection.orderID)) {
      throw new Error(
        `Multiple confirmed cash collections exist for order ${collection.orderID}. Review the duplicate collection records before reconciliation.`,
      );
    }

    const order = ordersByID.get(collection.orderID);

    if (!order) {
      throw new Error(
        `Cash collection ${collection.id} has no matching delivered order assigned to this courier.`,
      );
    }

    if (
      order.status !== "DELIVERED" ||
      order.paymentMethod !== "CASH" ||
      order.assignedCourierId !== courierID
    ) {
      throw new Error(
        `Cash collection ${collection.id} does not match a delivered CASH order assigned to this courier.`,
      );
    }

    const collectedAmount = toFiniteNumber(collection.amount);

    const totalPrice = toFiniteNumber(order.totalPrice);

    if (
      collectedAmount === null ||
      collectedAmount <= 0 ||
      totalPrice === null ||
      totalPrice <= 0
    ) {
      throw new Error(
        `Cash collection ${collection.id} or Order ${order.id} has an invalid amount or totalPrice.`,
      );
    }

    /*
     * This version expects full cash collection.
     *
     * If partial cash collection is introduced later,
     * it should be handled explicitly in the payment
     * and collection ledger.
     */
    if (Math.abs(roundMoney(collectedAmount) - roundMoney(totalPrice)) > 0.01) {
      throw new Error(
        `Cash collection ${collection.id} for order ${order.id} does not match the order total. Review this record before reconciliation.`,
      );
    }

    const atuaShare = calculateAtuaShare(order, collection);

    cashCollectedAmount += collectedAmount;

    amountCourierOwesAtua += atuaShare;

    cashCollectionCount += 1;

    eligibleCashCollectionIDs.push(collection.id);

    processedCashOrderIDs.add(collection.orderID);
  }

  cashCollectedAmount = roundMoney(cashCollectedAmount);

  amountCourierOwesAtua = roundMoney(amountCourierOwesAtua);

  /* ----------------------------------------------------------
     STEP 5: CALCULATE ATUA'S ONLINE OBLIGATION

     This is the amount Atua owes the courier from eligible
     online-paid deliveries.

     It remains independent of the cash debt.
  ---------------------------------------------------------- */

  const amountAtuaOwesCourier = onlineCourierEarnings;

  /* ----------------------------------------------------------
     STEP 6: LEGACY NET SUMMARY

     The schema retains:
       netAmount
       direction

     These are reporting fields only.

     They are NOT the authoritative cash debt amount.

     The settlement process must use:
       amountCourierOwesAtua

     It must never use netAmount to reduce cash debt by
     onlineCourierEarnings.
  ---------------------------------------------------------- */

  const difference = roundMoney(amountAtuaOwesCourier - amountCourierOwesAtua);

  let direction;

  if (difference > 0) {
    direction = "ATUA_OWES_COURIER";
  } else if (difference < 0) {
    direction = "COURIER_OWES_ATUA";
  } else {
    direction = "BALANCED";
  }

  const netAmount = roundMoney(Math.abs(difference));

  /* ----------------------------------------------------------
     STEP 7: PREPARE AUDIT RECORD
  ---------------------------------------------------------- */

  const calculatedAt = new Date().toISOString();

  const reconciliationID = makeReconciliationID(courierID, startMs, endMs);

  const reconciliationReference = makeReconciliationReference(
    courierID,
    startMs,
    endMs,
  );

  const notes = [
    "Calculated reconciliation only; no funds transferred.",
    "Online earnings use stored courierEarnings from eligible PAYSTACK orders.",
    "Online delivery period uses unloadingCompletedAt.",
    "Cash collection amount is recorded independently.",
    "Cash debt is commission + platform fee + VAT from eligible CASH deliveries.",
    "Cash collection atuaShareAmount is checked against the Order financial breakdown when present.",
    "Online courier earnings are not deducted from cash debt.",
    "Cash collections already marked reconciledAt are excluded.",
    "previousSettlements and adjustments are not applied by this Lambda.",
    `Online orders included: ${onlineOrderCount}.`,
    `Cash collections included: ${cashCollectionCount}.`,
    `Currency: ${CURRENCY}.`,
  ].join(" ");

  const input = {
    id: reconciliationID,

    courierID,

    reconciliationReference,

    periodStart: normalizedStart,

    periodEnd: normalizedEnd,

    onlineCourierEarnings,

    cashCollectedAmount,

    amountCourierOwesAtua,

    amountAtuaOwesCourier,

    /*
     * These remain zero at calculation time.
     * The settlement process must handle actual
     * settlements and adjustments.
     */
    previousSettlements: 0,

    adjustments: 0,

    /*
     * Legacy summary only.
     * Never use this to offset cash debt.
     */
    netAmount,

    direction,

    status: "CALCULATED",

    calculatedAt,

    notes,
  };

  /* ----------------------------------------------------------
     STEP 8: CREATE RECONCILIATION

     The deterministic ID prevents duplicate records for
     the exact same courier and period.

     If a concurrent invocation creates the same record,
     retrieve and return that record.
  ---------------------------------------------------------- */

  let reconciliation;

  try {
    reconciliation = await createReconciliation(input);
  } catch (createError) {
    console.warn(
      "Reconciliation create returned an error. Checking whether the deterministic record already exists.",
      createError.message,
    );

    const existingByID = await getReconciliationByID(reconciliationID);

    if (!existingByID) {
      throw createError;
    }

    reconciliation = validateExistingReconciliation(
      existingByID,
      courierID,
      startMs,
      endMs,
    );

    return {
      success: true,
      reusedExistingRecord: true,
      message:
        "The reconciliation already exists. The existing record was returned; no duplicate was created.",
      currency: CURRENCY,
      reconciliation,
    };
  }

  /* ----------------------------------------------------------
     STEP 9: RETURN RESULTS
  ---------------------------------------------------------- */

  return {
    success: true,

    reusedExistingRecord: false,

    message:
      "Reconciliation calculated and saved. No payment was made, no wallet balance was changed, no CourierDebt was created or modified, and no source records were marked as reconciled.",

    currency: CURRENCY,

    reconciliation,

    summary: {
      courierID,

      periodStart: normalizedStart,

      periodEnd: normalizedEnd,

      onlineOrderCount,

      cashCollectionCount,

      onlineCourierEarnings,

      cashCollectedAmount,

      amountCourierOwesAtua,

      amountAtuaOwesCourier,

      netAmount,

      direction,

      previousSettlements: 0,

      adjustments: 0,

      eligibleOnlineOrderIDs,

      eligibleCashCollectionIDs,
    },
  };
};

/* ============================================================
   12. LAMBDA HANDLER
============================================================ */

/*
 * Supports direct Lambda invocation:
 *
 * {
 *   "courierID": "...",
 *   "periodStart": "2026-11-01T00:00:00.000Z",
 *   "periodEnd": "2026-11-30T23:59:59.999Z"
 * }
 *
 * Supports AppSync resolver invocation:
 *
 * {
 *   "arguments": {
 *     "courierID": "...",
 *     "periodStart": "...",
 *     "periodEnd": "..."
 *   }
 * }
 *
 * Supports API Gateway invocation:
 *
 * {
 *   "body": "{\"courierID\":\"...\", ...}"
 * }
 */

exports.handler = async (event) => {
  console.log("reconcileCourierBalance invoked", {
    requestId: event?.requestContext?.requestId,

    hasArguments: Boolean(event?.arguments),
  });

  try {
    let payload = event || {};

    /*
     * API Gateway body.
     */
    if (typeof payload.body === "string") {
      try {
        payload = JSON.parse(payload.body);
      } catch {
        throw new Error("Request body must contain valid JSON.");
      }
    }

    /*
     * AppSync resolver arguments.
     */
    if (payload.arguments) {
      payload = payload.arguments;
    }

    const result = await reconcileCourierBalance({
      courierID: payload.courierID,
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
    });

    return {
      statusCode: 200,

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error(
      "reconcileCourierBalance failed:",
      error.stack || error.message || error,
    );

    const message = error.message || "Reconciliation failed.";

    /*
     * Validation and business-rule failures return 400.
     * Unexpected AppSync or infrastructure failures
     * return 500.
     */
    const statusCode =
      message.includes("required") ||
      message.includes("valid") ||
      message.includes("already exists") ||
      message.includes("overlaps") ||
      message.includes("does not match") ||
      message.includes("Multiple confirmed") ||
      message.includes("no matching") ||
      message.includes("no unloadingCompletedAt") ||
      message.includes("incomplete") ||
      message.includes("invalid")
        ? 400
        : 500;

    return {
      statusCode,

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        success: false,
        error: message,
      }),
    };
  }
};
