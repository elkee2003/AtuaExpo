/* Amplify Params - DO NOT EDIT
    ENV
    REGION
    API_ATUA_GRAPHQLAPIENDPOINTOUTPUT
*/

"use strict";

const https = require("https");
const aws4 = require("aws4");

/*
 * ENFORCE COURIER DEBT DEADLINE
 *
 * EventBridge schedule: rate(5 minutes)
 *
 * This function enforces existing CourierDebt.dueAt values.
 * It does not create debts, change debtStartedAt/dueAt, collect
 * money, or change Wallet balances.
 *
 * The 24-hour deadline is established by the cash-collection
 * flow when the first debt in an open debt cycle is created.
 *
 * Courier.isBlocked is an administrative block and is never
 * modified by this function.
 */

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;
const AWS_REGION = process.env.AWS_REGION || process.env.REGION;

const GRAPHQL_TIMEOUT_MS = 20000;
const PAGE_SIZE = 1000;
const MAX_PAGES = 1000;
const MAX_COURIER_UPDATE_ATTEMPTS = 3;

const ACTIVE_DEBT_STATUSES = ["OPEN", "PARTIALLY_PAID", "OVERDUE"];

/* ============================================================
   GRAPHQL OPERATIONS
============================================================ */

const DEBTS_BY_STATUS = `
  query CourierDebtsByDebtStatusDueAt(
    $status: CourierDebtStatus!
    $limit: Int
    $nextToken: String
  ) {
    courierDebtsByDebtStatusDueAt(
      status: $status
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        courierID
        remainingAmount
        status
        dueAt
        _version
        _deleted
      }
      nextToken
    }
  }
`;

const LIST_COURIER_DEBTS = `
  query ListCourierDebts(
    $filter: ModelCourierDebtFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listCourierDebts(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        courierID
        remainingAmount
        status
        dueAt
        _version
        _deleted
      }
      nextToken
    }
  }
`;

const LIST_RESTRICTED_COURIERS = `
  query ListRestrictedCouriers(
    $filter: ModelCourierFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listCouriers(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        debtDueAt
        debtRestrictionActive
        debtBlockedAt
        debtBlockReason
        _version
        _deleted
      }
      nextToken
    }
  }
`;

const GET_COURIER = `
  query GetCourier($id: ID!) {
    getCourier(id: $id) {
      id
      debtDueAt
      debtRestrictionActive
      debtBlockedAt
      debtBlockReason
      _version
      _deleted
    }
  }
`;

const GET_COURIER_DEBT = `
  query GetCourierDebt($id: ID!) {
    getCourierDebt(id: $id) {
      id
      courierID
      remainingAmount
      status
      dueAt
      _version
      _deleted
    }
  }
`;

const UPDATE_COURIER_DEBT = `
  mutation UpdateCourierDebt(
    $input: UpdateCourierDebtInput!
    $condition: ModelCourierDebtConditionInput
  ) {
    updateCourierDebt(
      input: $input
      condition: $condition
    ) {
      id
      courierID
      remainingAmount
      status
      dueAt
      _version
    }
  }
`;

const UPDATE_COURIER = `
  mutation UpdateCourier($input: UpdateCourierInput!) {
    updateCourier(input: $input) {
      id
      debtDueAt
      debtRestrictionActive
      debtBlockedAt
      debtBlockReason
      _version
    }
  }
`;

/* ============================================================
   VALIDATION HELPERS
============================================================ */

function requireString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required.`);
  }

  return value.trim();
}

function isValidDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function remainingAmountOf(debt) {
  const amount = Number(debt && debt.remainingAmount);

  if (!Number.isFinite(amount)) {
    throw new Error(`Invalid remainingAmount for debt ${debt && debt.id}`);
  }

  return amount;
}

function isOutstandingDebt(debt) {
  return Boolean(
    debt &&
    !debt._deleted &&
    ACTIVE_DEBT_STATUSES.includes(debt.status) &&
    remainingAmountOf(debt) > 0,
  );
}

/* ============================================================
   APPSYNC IAM REQUEST
============================================================ */

async function graphqlRequest(query, variables = {}) {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error("Missing API_ATUA_GRAPHQLAPIENDPOINTOUTPUT.");
  }

  if (!AWS_REGION) {
    throw new Error("Missing AWS_REGION/REGION.");
  }

  const endpoint = new URL(GRAPHQL_ENDPOINT);

  const body = JSON.stringify({
    query,
    variables,
  });

  const credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  };

  if (!credentials.accessKeyId || !credentials.secretAccessKey) {
    throw new Error("Lambda IAM credentials are not available.");
  }

  const signed = aws4.sign(
    {
      host: endpoint.host,
      path: endpoint.pathname + endpoint.search,
      service: "appsync",
      region: AWS_REGION,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    },
    credentials,
  );

  const response = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: endpoint.hostname,
        port: endpoint.port || 443,
        path: endpoint.pathname + endpoint.search,
        method: "POST",
        headers: signed.headers,
      },
      (res) => {
        let responseBody = "";

        res.setEncoding("utf8");

        res.on("data", (chunk) => {
          responseBody += chunk;
        });

        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            body: responseBody,
          });
        });
      },
    );

    req.on("error", reject);

    req.setTimeout(GRAPHQL_TIMEOUT_MS, () => {
      req.destroy(new Error("AppSync request timed out."));
    });

    req.write(body);
    req.end();
  });

  let parsed;

  try {
    parsed = JSON.parse(response.body);
  } catch (error) {
    throw new Error(
      `AppSync returned invalid JSON: ${response.body.slice(0, 300)}`,
    );
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(
      `AppSync HTTP ${response.statusCode}: ${JSON.stringify(
        parsed.errors || parsed,
      )}`,
    );
  }

  if (parsed.errors && parsed.errors.length) {
    throw new Error(
      `AppSync GraphQL error: ${parsed.errors
        .map((e) => e.message)
        .join("; ")}`,
    );
  }

  if (!parsed.data) {
    throw new Error("AppSync returned no data.");
  }

  return parsed.data;
}

/* ============================================================
   PAGINATION
============================================================ */

async function fetchAllPages(query, rootField, variables = {}) {
  const items = [];

  let nextToken = null;
  let pageCount = 0;

  do {
    pageCount += 1;

    if (pageCount > MAX_PAGES) {
      throw new Error(`Pagination safety limit exceeded for ${rootField}.`);
    }

    const data = await graphqlRequest(query, {
      ...variables,
      limit: PAGE_SIZE,
      nextToken,
    });

    const result = data[rootField];

    if (!result) {
      throw new Error(`AppSync did not return ${rootField}.`);
    }

    items.push(...(result.items || []));

    nextToken = result.nextToken || null;
  } while (nextToken);

  return items;
}

/* ============================================================
   LOAD ALL OUTSTANDING DEBTS
============================================================ */

async function getAllOutstandingDebts() {
  const all = [];

  // Use the standard generated listCourierDebts query.
  // This avoids depending on the missing custom index query.
  for (const status of ACTIVE_DEBT_STATUSES) {
    const page = await fetchAllPages(LIST_COURIER_DEBTS, "listCourierDebts", {
      filter: {
        status: {
          eq: status,
        },
      },
    });

    all.push(...page);
  }

  // Remove duplicates and deleted records.
  const unique = new Map();

  for (const debt of all) {
    if (debt && debt.id && !debt._deleted) {
      unique.set(debt.id, debt);
    }
  }

  // Only return debts that still have an amount outstanding.
  return [...unique.values()].filter(isOutstandingDebt);
}

/* ============================================================
   LOAD COURIERS ALREADY RESTRICTED
============================================================ */

async function getRestrictedCouriers() {
  return fetchAllPages(LIST_RESTRICTED_COURIERS, "listCouriers", {
    filter: {
      debtRestrictionActive: {
        eq: true,
      },
    },
  });
}

/* ============================================================
   LOAD ONE COURIER'S OUTSTANDING DEBTS
============================================================ */

async function getCourierOutstandingDebts(courierID) {
  const debts = await fetchAllPages(LIST_COURIER_DEBTS, "listCourierDebts", {
    filter: {
      courierID: {
        eq: courierID,
      },
    },
  });

  return debts.filter(isOutstandingDebt);
}

/* ============================================================
   LOAD ONE COURIER
============================================================ */

async function getCourier(courierID) {
  const data = await graphqlRequest(GET_COURIER, { id: courierID });

  const courier = data.getCourier;

  if (!courier || courier._deleted) {
    throw new Error(`Courier not found: ${courierID}`);
  }

  return courier;
}

/* ============================================================
   MARK DEBT OVERDUE
============================================================ */

async function markDebtOverdue(debt, nowISO) {
  if (!isOutstandingDebt(debt)) {
    return {
      updated: false,
      reason: "Debt is no longer outstanding.",
    };
  }

  if (debt.status !== "OPEN" && debt.status !== "PARTIALLY_PAID") {
    return {
      updated: false,
      reason: "Debt is already overdue or not eligible.",
    };
  }

  if (!isValidDate(debt.dueAt)) {
    throw new Error(`Invalid dueAt for debt ${debt.id}.`);
  }

  if (Date.parse(debt.dueAt) > Date.parse(nowISO)) {
    return {
      updated: false,
      reason: "Deadline has not passed.",
    };
  }

  const input = {
    id: debt.id,
    status: "OVERDUE",
  };

  if (debt._version !== null && debt._version !== undefined) {
    input._version = debt._version;
  }

  try {
    const data = await graphqlRequest(UPDATE_COURIER_DEBT, {
      input,
      condition: {
        status: {
          eq: debt.status,
        },
        remainingAmount: {
          gt: 0,
        },
      },
    });

    if (!data.updateCourierDebt) {
      throw new Error("AppSync did not return the updated CourierDebt.");
    }

    console.log("COURIER DEBT MARKED OVERDUE:", {
      debtID: debt.id,
      courierID: debt.courierID,
      remainingAmount: data.updateCourierDebt.remainingAmount,
      dueAt: data.updateCourierDebt.dueAt,
    });

    return {
      updated: true,
      debt: data.updateCourierDebt,
    };
  } catch (error) {
    /*
     * A payment or another scheduled invocation may
     * have updated this debt in the meantime.
     */

    const freshData = await graphqlRequest(GET_COURIER_DEBT, { id: debt.id });

    const freshDebt = freshData.getCourierDebt;

    if (!freshDebt || freshDebt._deleted || !isOutstandingDebt(freshDebt)) {
      return {
        updated: false,
        reason: "Debt was cleared concurrently.",
      };
    }

    if (freshDebt.status === "OVERDUE") {
      return {
        updated: false,
        reason: "Debt was marked overdue by another invocation.",
      };
    }

    throw new Error(`Could not mark debt ${debt.id} OVERDUE: ${error.message}`);
  }
}

/* ============================================================
   CALCULATE COURIER DEBT STATE
============================================================ */

function calculateDebtState(debts, nowISO) {
  const outstanding = debts.filter(isOutstandingDebt);

  for (const debt of outstanding) {
    if (!isValidDate(debt.dueAt)) {
      throw new Error(`Outstanding debt has invalid dueAt: ${debt.id}`);
    }
  }

  outstanding.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));

  const earliestDueAt = outstanding.length ? outstanding[0].dueAt : null;

  const overdue = outstanding.filter(
    (debt) => Date.parse(debt.dueAt) <= Date.parse(nowISO),
  );

  return {
    outstanding,
    overdue,
    earliestDueAt,
    restrictionRequired: overdue.length > 0,
  };
}

/* ============================================================
   SYNCHRONISE COURIER DEBT RESTRICTION
============================================================ */

async function syncCourierDebtRestriction(courierID, nowISO) {
  for (let attempt = 1; attempt <= MAX_COURIER_UPDATE_ATTEMPTS; attempt += 1) {
    /*
     * Reload debt records on every attempt.
     * This ensures recent repayments are respected.
     */

    const debts = await getCourierOutstandingDebts(courierID);

    const state = calculateDebtState(debts, nowISO);

    const courier = await getCourier(courierID);

    const wasRestricted = courier.debtRestrictionActive === true;

    const shouldRestrict = state.restrictionRequired;

    /*
     * Preserve the original restriction timestamp.
     * Set it only when the restriction is first activated.
     */

    const nextBlockedAt = shouldRestrict
      ? wasRestricted && courier.debtBlockedAt
        ? courier.debtBlockedAt
        : nowISO
      : null;

    const nextBlockReason = shouldRestrict
      ? "Outstanding courier debt passed its 24-hour " +
        "repayment deadline. Overdue debt IDs: " +
        state.overdue.map((d) => d.id).join(", ")
      : null;

    const nextDueAt = state.earliestDueAt;

    const unchanged =
      wasRestricted === shouldRestrict &&
      (courier.debtDueAt || null) === nextDueAt &&
      (courier.debtBlockedAt || null) === nextBlockedAt &&
      (courier.debtBlockReason || null) === nextBlockReason;

    if (unchanged) {
      return {
        courierID,
        updated: false,
        debtRestrictionActive: shouldRestrict,
        debtDueAt: nextDueAt,
        outstandingDebtCount: state.outstanding.length,
        overdueDebtCount: state.overdue.length,
      };
    }

    const input = {
      id: courierID,
      debtDueAt: nextDueAt,
      debtRestrictionActive: shouldRestrict,
      debtBlockedAt: nextBlockedAt,
      debtBlockReason: nextBlockReason,
    };

    if (courier._version !== null && courier._version !== undefined) {
      input._version = courier._version;
    }

    try {
      const data = await graphqlRequest(UPDATE_COURIER, { input });

      const updated = data.updateCourier;

      if (!updated) {
        throw new Error("AppSync did not return the updated Courier.");
      }

      if (!wasRestricted && shouldRestrict) {
        console.log("COURIER DEBT RESTRICTION ACTIVATED:", {
          courierID,
          debtBlockedAt: nextBlockedAt,
          overdueDebtIDs: state.overdue.map((d) => d.id),
        });
      } else if (wasRestricted && !shouldRestrict) {
        console.log("COURIER DEBT RESTRICTION CLEARED:", {
          courierID,
          reason: "No outstanding debt remains past its deadline.",
        });
      }

      return {
        courierID,
        updated: true,
        debtRestrictionActive: shouldRestrict,
        debtDueAt: nextDueAt,
        outstandingDebtCount: state.outstanding.length,
        overdueDebtCount: state.overdue.length,
      };
    } catch (error) {
      console.warn("Courier debt restriction update failed:", {
        courierID,
        attempt,
        message: error.message,
      });

      if (attempt === MAX_COURIER_UPDATE_ATTEMPTS) {
        throw error;
      }

      /*
       * The next attempt reloads both the courier
       * and debt records before recalculating.
       */
    }
  }

  throw new Error(
    `Could not synchronise courier debt restriction: ${courierID}`,
  );
}

/* ============================================================
   MAIN ENFORCEMENT FUNCTION
============================================================ */

async function enforceCourierDebtDeadline() {
  const nowISO = new Date().toISOString();

  console.log("ENFORCE COURIER DEBT DEADLINE STARTED:", { now: nowISO });

  /*
   * STEP 1
   * Load OPEN, PARTIALLY_PAID and OVERDUE debts.
   * This includes debts with future deadlines.
   */

  const activeDebts = await getAllOutstandingDebts();

  const affectedCourierIDs = new Set();

  let overdueDebtUpdates = 0;

  /*
   * STEP 2
   * Mark expired OPEN/PARTIALLY_PAID debts OVERDUE.
   */

  for (const debt of activeDebts) {
    const courierID = requireString(debt.courierID, "CourierDebt.courierID");

    affectedCourierIDs.add(courierID);

    if (!isValidDate(debt.dueAt)) {
      throw new Error(`Invalid dueAt for debt ${debt.id}.`);
    }

    const deadlinePassed = Date.parse(debt.dueAt) <= Date.parse(nowISO);

    if (
      deadlinePassed &&
      (debt.status === "OPEN" || debt.status === "PARTIALLY_PAID")
    ) {
      const result = await markDebtOverdue(debt, nowISO);

      if (result.updated) {
        overdueDebtUpdates += 1;
      }
    }
  }

  /*
   * STEP 3
   * Load couriers already restricted.
   *
   * This catches couriers whose debts have been
   * repaid since the previous scheduled execution.
   */

  const restrictedCouriers = await getRestrictedCouriers();

  for (const courier of restrictedCouriers) {
    if (courier && courier.id && !courier._deleted) {
      affectedCourierIDs.add(courier.id);
    }
  }

  /*
   * STEP 4
   * Synchronise each affected courier.
   */

  let couriersProcessed = 0;
  let courierUpdates = 0;
  let restrictionsActivated = 0;
  let restrictionsCleared = 0;

  const results = [];

  for (const courierID of affectedCourierIDs) {
    const result = await syncCourierDebtRestriction(courierID, nowISO);

    couriersProcessed += 1;

    if (result.updated) {
      courierUpdates += 1;
    }

    if (result.debtRestrictionActive) {
      restrictionsActivated += 1;
    } else {
      restrictionsCleared += 1;
    }

    results.push(result);
  }

  /*
   * STEP 5
   * Return execution summary.
   */

  const summary = {
    success: true,
    executedAt: nowISO,
    activeDebtsChecked: activeDebts.length,
    overdueDebtUpdates,
    couriersProcessed,
    courierUpdates,
    restrictionsActivated,
    restrictionsCleared,
  };

  console.log("ENFORCE COURIER DEBT DEADLINE COMPLETED:", summary);

  return {
    ...summary,
    results,
  };
}

/* ============================================================
   LAMBDA HANDLER
============================================================ */

exports.handler = async (event) => {
  console.log("enforceCourierDebtDeadline invoked:", {
    requestId: event?.id || event?.requestContext?.requestId || null,
    source: event?.source || null,
    time: event?.time || null,
  });

  try {
    return await enforceCourierDebtDeadline();
  } catch (error) {
    console.error(
      "ENFORCE COURIER DEBT DEADLINE FAILED:",
      error.stack || error.message || error,
    );

    /*
     * Throwing allows Lambda/EventBridge retry
     * and configured failure handling to run.
     */

    throw error;
  }
};
