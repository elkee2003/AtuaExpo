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

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const GRAPHQL_API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

const AWS_REGION = process.env.AWS_REGION || process.env.REGION;

const CURRENCY = process.env.RECONCILIATION_CURRENCY || "NGN";

const PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 20000;

/*
 * IMPORTANT:
 * This Lambda calculates a reconciliation only.
 * It does not transfer money, settle wallet debt, mark courier
 * earnings as paid, or mark cash collections as reconciled.
 *
 * The IAM role must be restricted to the operations required
 * by this function. Order reads use API-key authentication
 * because that is how the current Order model is configured.
 */

/* ============================================================
   GRAPHQL REQUEST
============================================================ */

const graphqlRequest = async (query, variables = {}, authMode = "IAM") => {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error("Missing API_ATUA_GRAPHQLAPIENDPOINTOUTPUT.");
  }

  const endpoint = new URL(GRAPHQL_ENDPOINT);
  const body = JSON.stringify({ query, variables });

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

    /*
     * AWS Lambda supplies temporary AWS credentials through
     * environment variables. Do not hardcode credentials.
     */
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
      `AppSync returned a non-JSON response: ${response.body.slice(0, 300)}`,
    );
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(
      `AppSync HTTP ${response.statusCode}: ${JSON.stringify(
        parsed.errors || parsed,
      )}`,
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
   PAGINATED MODEL QUERIES
============================================================ */

const fetchAllPages = async ({ query, variables, resultField, authMode }) => {
  const allItems = [];
  let nextToken = null;
  let pageCount = 0;

  do {
    pageCount += 1;

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

    if (pageCount > 10000) {
      throw new Error("Pagination safety limit reached.");
    }
  } while (nextToken);

  return allItems;
};

/* ============================================================
   LIST DELIVERED ORDERS FOR ONE COURIER

   Use stored financial values. Never recalculate historical
   earnings using today's pricing configuration.
============================================================ */

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
        _deleted
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
      !order._deleted &&
      order.assignedCourierId === courierID &&
      order.status === "DELIVERED",
  );
};

/* ============================================================
   LIST CASH COLLECTIONS FOR ONE COURIER
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
        createdAt
        updatedAt
        _deleted
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
    (collection) =>
      collection && !collection._deleted && collection.courierID === courierID,
  );
};

/* ============================================================
   LIST EXISTING RECONCILIATIONS
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
        createdAt
        updatedAt
        _deleted
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

  return records.filter(
    (record) => record && !record._deleted && record.courierID === courierID,
  );
};

/* ============================================================
   CREATE RECONCILIATION
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
   FINANCIAL AND PERIOD HELPERS
============================================================ */

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
};

const roundMoney = (amount) =>
  Math.round((amount + Number.EPSILON) * 100) / 100;

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

const makeReference = (courierID, startMs, endMs) => {
  const safeCourierID = String(courierID)
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 40);

  return `CR-${safeCourierID}-${startMs}-${endMs}`;
};

const samePeriod = (record, startMs, endMs) =>
  Date.parse(record.periodStart) === startMs &&
  Date.parse(record.periodEnd) === endMs;

const periodsOverlap = (record, startMs, endMs) => {
  const existingStart = Date.parse(record.periodStart);
  const existingEnd = Date.parse(record.periodEnd);

  if (!Number.isFinite(existingStart) || !Number.isFinite(existingEnd)) {
    return false;
  }

  return startMs <= existingEnd && endMs >= existingStart;
};

/* ============================================================
   MAIN RECONCILIATION
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
     1. Prevent ordinary duplicate and overlapping runs.

     NOTE:
     This pre-check is not a database transaction. Concurrent
     invocations can still race. See deployment notes below.
  ---------------------------------------------------------- */

  const existingRecords = await listReconciliations(courierID);

  const samePeriodRecord = existingRecords.find((record) =>
    samePeriod(record, startMs, endMs),
  );

  if (samePeriodRecord) {
    return {
      success: true,
      reusedExistingRecord: true,
      message:
        "A reconciliation already exists for this courier and period. No new record was created.",
      currency: CURRENCY,
      reconciliation: samePeriodRecord,
    };
  }

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
     2. Load source records.
  ---------------------------------------------------------- */

  const [orders, collections] = await Promise.all([
    listCourierOrders(courierID),
    listCashCollections(courierID),
  ]);

  const ordersByID = new Map(orders.map((order) => [order.id, order]));

  /* ----------------------------------------------------------
     3. Calculate online-paid courier earnings.

     Requirements:
       - Delivered order assigned to this courier
       - PAYSTACK payment method
       - Payment status PAID
       - Payout status NOT_PAID
       - Delivery completed inside the requested period
       - Valid stored courierEarnings
  ---------------------------------------------------------- */

  let onlineCourierEarnings = 0;
  let onlineOrderCount = 0;
  let skippedOnlineOrderCount = 0;

  const eligibleOnlineOrderIDs = [];

  for (const order of orders) {
    if (order.paymentMethod !== "PAYSTACK") {
      continue;
    }

    if (order.paymentStatus !== "PAID" || order.payoutStatus !== "NOT_PAID") {
      continue;
    }

    /*
     * unloadingCompletedAt is the closest explicit delivery
     * event timestamp available in the supplied Order schema.
     * Do not substitute createdAt: that is the booking time.
     */
    if (!isWithinPeriod(order.unloadingCompletedAt, startMs, endMs)) {
      if (!order.unloadingCompletedAt) {
        skippedOnlineOrderCount += 1;

        console.warn(
          "Online order has no unloadingCompletedAt; excluded from period calculation:",
          order.id,
        );
      }

      continue;
    }

    const earnings = toFiniteNumber(order.courierEarnings);

    if (earnings === null || earnings < 0) {
      skippedOnlineOrderCount += 1;

      console.warn("Online order has invalid courierEarnings:", order.id);

      continue;
    }

    onlineCourierEarnings += earnings;
    onlineOrderCount += 1;
    eligibleOnlineOrderIDs.push(order.id);
  }

  onlineCourierEarnings = roundMoney(onlineCourierEarnings);

  /* ----------------------------------------------------------
     4. Calculate confirmed cash collections.

     The courier does not owe Atua the entire customer payment.
     Atua's share is:
       commissionAmount + platformFee + vatAmount

     A cash collection is counted only once per order.
  ---------------------------------------------------------- */

  let cashCollectedAmount = 0;
  let amountCourierOwesAtua = 0;
  let cashCollectionCount = 0;
  let skippedCashCollectionCount = 0;

  const eligibleCashCollectionIDs = [];
  const processedCashOrderIDs = new Set();

  for (const collection of collections) {
    if (collection.status !== "CONFIRMED") {
      continue;
    }

    if (collection.reconciledAt) {
      continue;
    }

    if (!isWithinPeriod(collection.confirmedAt, startMs, endMs)) {
      continue;
    }

    if (processedCashOrderIDs.has(collection.orderID)) {
      skippedCashCollectionCount += 1;

      console.error(
        "Duplicate confirmed cash collection found for order:",
        collection.orderID,
        "Collection:",
        collection.id,
      );

      continue;
    }

    const order = ordersByID.get(collection.orderID);

    if (!order) {
      skippedCashCollectionCount += 1;

      console.error(
        "Cash collection has no matching delivered order for this courier:",
        collection.id,
      );

      continue;
    }

    if (
      order.status !== "DELIVERED" ||
      order.paymentMethod !== "CASH" ||
      order.assignedCourierId !== courierID
    ) {
      skippedCashCollectionCount += 1;

      console.error(
        "Cash collection does not match a delivered CASH order assigned to this courier:",
        collection.id,
        order.id,
      );

      continue;
    }

    const collectedAmount = toFiniteNumber(collection.amount);

    const totalPrice = toFiniteNumber(order.totalPrice);

    const commission = toFiniteNumber(order.commissionAmount);

    const platformFee = toFiniteNumber(order.platformFee);

    const vat = toFiniteNumber(order.vatAmount);

    if (
      collectedAmount === null ||
      collectedAmount <= 0 ||
      totalPrice === null ||
      totalPrice <= 0 ||
      commission === null ||
      commission < 0 ||
      platformFee === null ||
      platformFee < 0 ||
      vat === null ||
      vat < 0
    ) {
      skippedCashCollectionCount += 1;

      console.error(
        "Cash collection has incomplete or invalid financial fields:",
        collection.id,
        order.id,
      );

      continue;
    }

    /*
     * Do not silently include a partial or mismatched collection
     * in a balance calculation. Require manual review.
     *
     * If your business intentionally supports partial cash
     * payments, implement an explicit partial-payment ledger
     * before relaxing this check.
     */
    if (Math.abs(roundMoney(collectedAmount) - roundMoney(totalPrice)) > 0.01) {
      throw new Error(
        `Cash collection ${collection.id} for order ${order.id} ` +
          "does not match the order total. Review this record before reconciliation.",
      );
    }

    const atuaShare = roundMoney(commission + platformFee + vat);

    cashCollectedAmount += collectedAmount;
    amountCourierOwesAtua += atuaShare;

    cashCollectionCount += 1;

    eligibleCashCollectionIDs.push(collection.id);
    processedCashOrderIDs.add(collection.orderID);
  }

  cashCollectedAmount = roundMoney(cashCollectedAmount);

  amountCourierOwesAtua = roundMoney(amountCourierOwesAtua);

  /* ----------------------------------------------------------
     5. Calculate the net position.

     This is a GROSS offset calculation:
       online courier earnings minus Atua's share of cash jobs.

     It does not deduct previous settlements or wallet recoveries.
     ---------------------------------------------------------- */

  const amountAtuaOwesCourier = onlineCourierEarnings;

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
     6. Create the audit record.

     This does not:
       - Transfer money
       - Recover wallet debt
       - Mark online earnings as paid
       - Mark cash collections as reconciled
       - Approve or settle the reconciliation
  ---------------------------------------------------------- */

  const calculatedAt = new Date().toISOString();

  const reconciliationReference = makeReference(courierID, startMs, endMs);

  const notes = [
    "Calculated reconciliation only; no funds transferred.",
    "Online earnings use stored courierEarnings from eligible PAYSTACK orders.",
    "Delivery period uses unloadingCompletedAt.",
    "Cash amount owed to Atua is commission + platform fee + VAT.",
    "Previous settlements and adjustments are not applied by this Lambda.",
    `Online orders included: ${onlineOrderCount}.`,
    `Cash collections included: ${cashCollectionCount}.`,
    `Online orders skipped: ${skippedOnlineOrderCount}.`,
    `Cash collections skipped: ${skippedCashCollectionCount}.`,
    `Currency: ${CURRENCY}.`,
  ].join(" ");

  const input = {
    courierID,
    reconciliationReference,
    periodStart: normalizedStart,
    periodEnd: normalizedEnd,
    onlineCourierEarnings,
    cashCollectedAmount,
    amountCourierOwesAtua,
    amountAtuaOwesCourier,
    previousSettlements: 0,
    adjustments: 0,
    netAmount,
    direction,
    status: "CALCULATED",
    calculatedAt,
    notes,
  };

  const reconciliation = await createReconciliation(input);

  return {
    success: true,
    reusedExistingRecord: false,
    message:
      "Reconciliation calculated and saved. No payment was made and no source records were marked as reconciled.",
    currency: CURRENCY,
    reconciliation,
    summary: {
      courierID,
      periodStart: normalizedStart,
      periodEnd: normalizedEnd,
      onlineOrderCount,
      cashCollectionCount,
      skippedOnlineOrderCount,
      skippedCashCollectionCount,
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
   LAMBDA HANDLER
============================================================ */

exports.handler = async (event) => {
  console.log("reconcileCourierBalance invoked", {
    requestId: event?.requestContext?.requestId,
    hasArguments: Boolean(event?.arguments),
  });

  try {
    let payload = event || {};

    if (typeof payload.body === "string") {
      try {
        payload = JSON.parse(payload.body);
      } catch {
        throw new Error("Request body must contain valid JSON.");
      }
    }

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

    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: false,
        error: error.message || "Reconciliation failed.",
      }),
    };
  }
};
