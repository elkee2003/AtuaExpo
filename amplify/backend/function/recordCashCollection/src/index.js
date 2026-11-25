const crypto = require("crypto");

// =============================================================================
// ATUA — RECORD CASH COLLECTION
// =============================================================================

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;
const GRAPHQL_API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

const DEBT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_CAS_ATTEMPTS = 6;
const PAGE_SIZE = 1000;

const CASH_STATUSES = { CONFIRMED: "CONFIRMED" };
const ACTIVE_DEBT_STATUSES = new Set(["OPEN", "PARTIALLY_PAID", "OVERDUE"]);
const CLOSED_DEBT_STATUSES = new Set(["PAID", "REVERSED", "WAIVED"]);

const ORDER_FIELDS = `
  id
  totalPrice
  courierEarnings
  status
  assignedCourierId
  paymentStatus
  paymentID
  paymentReference
  paymentTiming
  paymentMethod
  paymentResponsibility
  cashCollectionStatus
  cashCollectedByCourierId
  cashCollectedAmount
  cashCollectedAt
  cashCollectionID
  commissionAmount
  platformFee
  vatAmount
  _version
`;

const PAYMENT_FIELDS = `
  id
  orderID
  status
  provider
  reference
`;

const COLLECTION_FIELDS = `
  id
  orderID
  courierID
  amount
  status
  idempotencyKey
  confirmedAt
  courierDebtID
  atuaShareAmount
  debtAppliedAt
  _version
`;

const WALLET_FIELDS = `
  id
  ownerID
  ownerType
  availableBalance
  pendingBalance
  lifetimeEarnings
  cashLifetimeEarnings
  electronicLifetimeEarnings
  outstandingDebt
  activeCourierDebtID
  _version
`;

const DEBT_FIELDS = `
  id
  courierID
  walletID
  amount
  amountPaid
  remainingAmount
  grossDebtAmount
  earningsOffsetAmount
  walletRecoveredAmount
  externalPaymentsAmount
  status
  debtStartedAt
  dueAt
  firstPaymentAt
  settledAt
  idempotencyKey
  _version
`;

const TRANSACTION_FIELDS = `
  id
  walletID
  type
  amount
  description
  orderID
  paymentID
  reference
  status
`;

function result(success, message, details = {}) {
  return {
    success,
    message,
    orderId: details.orderId || null,
    cashCollectionID: details.cashCollectionID || null,
    amount: Number.isFinite(details.amount) ? details.amount : null,
    atuaShareAmount: Number.isFinite(details.atuaShareAmount)
      ? details.atuaShareAmount
      : null,
    courierEarnings: Number.isFinite(details.courierEarnings)
      ? details.courierEarnings
      : null,
    courierDebtID: details.courierDebtID || null,
    debtRemaining: Number.isFinite(details.debtRemaining)
      ? details.debtRemaining
      : null,
    dueAt: details.dueAt || null,
    confirmedAt: details.confirmedAt || null,
  };
}

function getIdentitySub(event) {
  return event?.identity?.sub || event?.identity?.claims?.sub || null;
}

function getOrderId(event) {
  const args = event?.arguments || event?.input || {};
  return args.orderId || args.orderID || null;
}

function getCashCollectionId(orderId) {
  return `cash-collection-${orderId}`;
}

function getIdempotencyKey(orderId) {
  return `cash-collection:${orderId}`;
}

function getCashEarningsTransactionId(orderId) {
  return `cash-earnings-${orderId}`;
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function requiredMoney(value, fieldName) {
  const number = Number(value);

  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(number) ||
    number < 0
  ) {
    throw new Error(`Order ${fieldName} is missing or invalid.`);
  }

  return roundMoney(number);
}

function getAtuaShare(order) {
  const commission = requiredMoney(order.commissionAmount, "commissionAmount");
  const platformFee = requiredMoney(order.platformFee, "platformFee");
  const vat = requiredMoney(order.vatAmount, "vatAmount");

  const share = roundMoney(commission + platformFee + vat);

  if (share <= 0) {
    throw new Error(
      "Atua's share for this order is zero or invalid. Cash collection cannot be posted to courier debt.",
    );
  }

  return share;
}

function getCourierEarnings(order) {
  const earnings = requiredMoney(order.courierEarnings, "courierEarnings");

  if (earnings <= 0) {
    throw new Error(
      "Order courierEarnings is zero or invalid. Cash earnings cannot be posted.",
    );
  }

  return earnings;
}

// =============================================================================
// APPSYNC REQUEST SIGNING
// =============================================================================

function hmac(key, value, encoding) {
  return crypto
    .createHmac("sha256", key)
    .update(value, "utf8")
    .digest(encoding);
}

function getAppSyncRegion() {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error("Atua GraphQL endpoint is not configured.");
  }

  const hostname = new URL(GRAPHQL_ENDPOINT).hostname;
  const match = hostname.match(
    /appsync-api\.([a-z0-9-]+)\.amazonaws\.com(?:\.cn)?$/,
  );

  return match?.[1] || process.env.AWS_REGION || process.env.REGION || null;
}

function signAwsRequest(url, body) {
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;

  if (!accessKey || !secretKey) {
    throw new Error(
      "Lambda AWS credentials are unavailable. Check the execution role.",
    );
  }

  const parsedUrl = new URL(url);
  const region = getAppSyncRegion();

  if (!region) {
    throw new Error("Could not determine the AppSync signing region.");
  }

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = crypto
    .createHash("sha256")
    .update(body, "utf8")
    .digest("hex");

  const headers = {
    "content-type": "application/json",
    host: parsedUrl.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };

  if (sessionToken) {
    headers["x-amz-security-token"] = sessionToken;
  }

  const sortedNames = Object.keys(headers).sort();
  const signedHeaderNames = sortedNames.join(";");

  const canonicalHeaders = sortedNames
    .map((name) => `${name}:${String(headers[name]).trim()}\n`)
    .join("");

  const canonicalRequest = [
    "POST",
    parsedUrl.pathname || "/",
    "",
    canonicalHeaders,
    signedHeaderNames,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/appsync/aws4_request`;

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    crypto.createHash("sha256").update(canonicalRequest, "utf8").digest("hex"),
  ].join("\n");

  const dateKey = hmac(`AWS4${secretKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, "appsync");
  const signingKey = hmac(serviceKey, "aws4_request");

  const signature = hmac(signingKey, stringToSign, "hex");

  headers.Authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaderNames}, Signature=${signature}`;

  return headers;
}

async function graphqlRequest(
  query,
  variables = {},
  operationName = "RecordCashCollection",
  authMode = "API_KEY",
) {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error("Atua GraphQL endpoint is not configured.");
  }

  const body = JSON.stringify({ query, variables, operationName });

  let headers;

  if (authMode === "IAM") {
    headers = signAwsRequest(GRAPHQL_ENDPOINT, body);
  } else {
    if (!GRAPHQL_API_KEY) {
      throw new Error("Atua GraphQL API key is not configured.");
    }

    headers = {
      "Content-Type": "application/json",
      "x-api-key": GRAPHQL_API_KEY,
    };
  }

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers,
    body,
  });

  let payload;

  try {
    payload = await response.json();
  } catch {
    throw new Error(
      `AppSync returned an invalid response (HTTP ${response.status}).`,
    );
  }

  if (!response.ok || payload.errors?.length) {
    const message =
      payload.errors?.map((item) => item.message).join("; ") ||
      `AppSync request failed with HTTP ${response.status}.`;

    console.error("APPSYNC GRAPHQL ERROR:", {
      operationName,
      authMode,
      statusCode: response.status,
      message,
    });

    throw new Error(message);
  }

  return payload.data;
}

function assertVersioned(record, label) {
  if (!Number.isInteger(record?._version)) {
    throw new Error(
      `${label} does not expose an AppSync _version. Confirm AppSync conflict detection before using concurrent updates.`,
    );
  }
}

// =============================================================================
// ORDER, COURIER AND PAYMENT READS
// =============================================================================

async function getOrder(orderId) {
  const query = `
    query GetOrderForCashCollection($id: ID!) {
      getOrder(id: $id) {
        ${ORDER_FIELDS}
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    { id: orderId },
    "GetOrderForCashCollection",
    "API_KEY",
  );

  return data?.getOrder || null;
}

async function getCourierBySub(sub) {
  const query = `
    query GetCourierForCashCollection($sub: String!, $limit: Int) {
      couriersBySub(sub: $sub, limit: $limit) {
        items {
          id
          sub
          walletID
          _version
          _lastChangedAt
          _deleted
        }
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    { sub, limit: 10 },
    "GetCourierForCashCollection",
    "API_KEY",
  );

  const couriers = data?.couriersBySub?.items || [];

  return (
    couriers.find(
      (courier) => courier.sub === sub && courier._deleted !== true,
    ) || null
  );
}

async function getPaymentsForOrder(orderId) {
  const query = `
    query GetPaymentsForCashCollection($orderID: ID!, $limit: Int) {
      paymentsByOrderID(orderID: $orderID, limit: $limit) {
        items {
          ${PAYMENT_FIELDS}
        }
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    { orderID: orderId, limit: 100 },
    "GetPaymentsForCashCollection",
    "API_KEY",
  );

  return data?.paymentsByOrderID?.items || [];
}

// =============================================================================
// CASH COLLECTION READ AND WRITE
// =============================================================================

async function getCashCollection(collectionId) {
  const query = `
    query GetCashCollection($id: ID!) {
      getCashCollection(id: $id) {
        ${COLLECTION_FIELDS}
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    { id: collectionId },
    "GetCashCollection",
    "IAM",
  );

  return data?.getCashCollection || null;
}

async function createCashCollectionRecord({
  collectionId,
  orderId,
  courierId,
  amount,
  atuaShareAmount,
  confirmedAt,
}) {
  const input = {
    id: collectionId,
    orderID: orderId,
    courierID: courierId,
    amount,
    status: CASH_STATUSES.CONFIRMED,
    idempotencyKey: getIdempotencyKey(orderId),
    confirmedAt,
    atuaShareAmount,
  };

  const mutation = `
    mutation CreateCashCollection($input: CreateCashCollectionInput!) {
      createCashCollection(input: $input) {
        ${COLLECTION_FIELDS}
      }
    }
  `;

  try {
    const data = await graphqlRequest(
      mutation,
      { input },
      "CreateCashCollection",
      "IAM",
    );

    const created = data?.createCashCollection;

    if (
      !created ||
      created.id !== collectionId ||
      created.orderID !== orderId ||
      created.courierID !== courierId ||
      Number(created.amount) !== Number(amount) ||
      Number(created.atuaShareAmount) !== Number(atuaShareAmount) ||
      created.status !== CASH_STATUSES.CONFIRMED ||
      created.idempotencyKey !== getIdempotencyKey(orderId)
    ) {
      throw new Error("Cash collection record was not saved correctly.");
    }

    return created;
  } catch (error) {
    const existing = await getCashCollection(collectionId).catch(
      (readError) => {
        console.error(
          "CASH COLLECTION RETRY CHECK FAILED:",
          readError?.message || readError,
        );
        return null;
      },
    );

    if (
      existing &&
      existing.orderID === orderId &&
      existing.courierID === courierId &&
      Number(existing.amount) === Number(amount) &&
      existing.status === CASH_STATUSES.CONFIRMED &&
      existing.idempotencyKey === getIdempotencyKey(orderId)
    ) {
      return ensureCollectionShare(existing, atuaShareAmount);
    }

    throw error;
  }
}

async function updateCashCollection(collection, updates) {
  let current = collection;

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
    if (!current) {
      throw new Error("Cash collection record could not be found.");
    }

    assertVersioned(current, "CashCollection");

    const input = {
      id: current.id,
      ...updates,
      _version: current._version,
    };

    const mutation = `
      mutation UpdateCashCollectionForDebt($input: UpdateCashCollectionInput!) {
        updateCashCollection(input: $input) {
          ${COLLECTION_FIELDS}
        }
      }
    `;

    try {
      const data = await graphqlRequest(
        mutation,
        { input },
        "UpdateCashCollectionForDebt",
        "IAM",
      );

      const updated = data?.updateCashCollection;

      if (!updated) {
        throw new Error("Cash collection debt details were not saved.");
      }

      return updated;
    } catch (error) {
      current = await getCashCollection(current.id);

      if (attempt === MAX_CAS_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  throw new Error("Unable to update cash collection after repeated conflicts.");
}

async function ensureCollectionShare(collection, atuaShareAmount) {
  if (Number(collection.atuaShareAmount) === Number(atuaShareAmount)) {
    return collection;
  }

  if (
    collection.atuaShareAmount != null &&
    Number(collection.atuaShareAmount) !== Number(atuaShareAmount)
  ) {
    throw new Error(
      "The saved cash collection has a different Atua share. Contact support.",
    );
  }

  return updateCashCollection(collection, { atuaShareAmount });
}

// =============================================================================
// WALLET AND COURIER DEBT READS
// =============================================================================

async function getWalletById(walletId) {
  if (!walletId) return null;

  const query = `
    query GetCourierWalletByID($id: ID!) {
      getWallet(id: $id) {
        ${WALLET_FIELDS}
        _deleted
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    { id: walletId },
    "GetCourierWalletByID",
    "API_KEY",
  );

  const wallet = data?.getWallet;

  return wallet && wallet._deleted !== true ? wallet : null;
}

async function getWalletByOwner(courierId) {
  const query = `
    query GetCourierWalletByOwner(
      $filter: ModelWalletFilterInput
      $limit: Int
    ) {
      listWallets(filter: $filter, limit: $limit) {
        items {
          ${WALLET_FIELDS}
          _deleted
        }
        nextToken
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    {
      filter: {
        ownerID: { eq: courierId },
        ownerType: { eq: "COURIER" },
      },
      limit: 100,
    },
    "GetCourierWalletByOwner",
    "API_KEY",
  );

  const wallets = (data?.listWallets?.items || []).filter(
    (wallet) =>
      wallet &&
      wallet._deleted !== true &&
      wallet.ownerID === courierId &&
      normalizeStatus(wallet.ownerType) === "COURIER",
  );

  if (wallets.length > 1) {
    throw new Error(
      "More than one wallet is linked to this courier. Wallet posting was stopped for manual reconciliation.",
    );
  }

  return wallets[0] || null;
}

async function createCourierWallet(courierId) {
  const mutation = `
    mutation CreateCourierWallet($input: CreateWalletInput!) {
      createWallet(input: $input) {
        ${WALLET_FIELDS}
      }
    }
  `;

  const input = {
    ownerID: courierId,
    ownerType: "COURIER",
    availableBalance: 0,
    pendingBalance: 0,
    lifetimeEarnings: 0,
    cashLifetimeEarnings: 0,
    electronicLifetimeEarnings: 0,
    outstandingDebt: 0,
  };

  const data = await graphqlRequest(
    mutation,
    { input },
    "CreateCourierWallet",
    "API_KEY",
  );

  const wallet = data?.createWallet;

  if (!wallet?.id) {
    throw new Error("Courier wallet creation returned no wallet.");
  }

  if (
    wallet.ownerID !== courierId ||
    normalizeStatus(wallet.ownerType) !== "COURIER"
  ) {
    throw new Error("Created wallet does not belong to the expected courier.");
  }

  return wallet;
}

async function updateCourierWalletID(courier, walletId) {
  if (!courier?.id || !walletId) {
    throw new Error("Courier and wallet ID are required to link the wallet.");
  }

  if (courier.walletID === walletId) {
    return courier;
  }

  const input = {
    id: courier.id,
    walletID: walletId,
  };

  if (Number.isInteger(courier._version)) {
    input._version = courier._version;
  }

  const mutation = `
    mutation UpdateCourierWalletID($input: UpdateCourierInput!) {
      updateCourier(input: $input) {
        id
        sub
        walletID
        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  try {
    const data = await graphqlRequest(
      mutation,
      { input },
      "UpdateCourierWalletID",
      "API_KEY",
    );

    const updated = data?.updateCourier;

    if (updated?.walletID === walletId) {
      return updated;
    }
  } catch (error) {
    console.error("COURIER WALLET ID UPDATE ERROR:", error?.message || error);
  }

  // Recover if the update succeeded but its response failed.
  const verifyQuery = `
    query VerifyCourierWalletID($id: ID!) {
      getCourier(id: $id) {
        id
        sub
        walletID
        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const verifyData = await graphqlRequest(
    verifyQuery,
    { id: courier.id },
    "VerifyCourierWalletID",
    "API_KEY",
  );

  const verified = verifyData?.getCourier;

  if (verified?.walletID === walletId) {
    return verified;
  }

  throw new Error(
    "The wallet exists, but its ID could not be saved to the courier record.",
  );
}

async function getWalletForCourier(courierId) {
  const courierQuery = `
    query GetCourierForWalletSetup($id: ID!) {
      getCourier(id: $id) {
        id
        walletID
        sub
        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  let courierData = await graphqlRequest(
    courierQuery,
    { id: courierId },
    "GetCourierForWalletSetup",
    "API_KEY",
  );

  let courier = courierData?.getCourier;

  if (!courier || courier._deleted === true) {
    throw new Error("Courier could not be found while setting up the wallet.");
  }

  // 1. Try the wallet ID already saved on Courier.
  if (courier.walletID) {
    const linkedWallet = await getWalletById(courier.walletID);

    if (
      linkedWallet &&
      linkedWallet.ownerID === courierId &&
      normalizeStatus(linkedWallet.ownerType) === "COURIER"
    ) {
      return linkedWallet;
    }
  }

  // 2. Search by ownerID and ownerType.
  let wallet = await getWalletByOwner(courierId);

  if (wallet) {
    // Repair Courier.walletID if necessary.
    if (courier.walletID !== wallet.id) {
      courier = await updateCourierWalletID(courier, wallet.id);
    }

    return wallet;
  }

  // 3. No wallet exists. Create one.
  try {
    wallet = await createCourierWallet(courierId);
  } catch (createError) {
    // Another invocation may have created the wallet first.
    console.warn(
      "WALLET CREATION FAILED; CHECKING FOR CONCURRENT CREATION:",
      createError?.message || createError,
    );

    wallet = await getWalletByOwner(courierId).catch(() => null);

    if (!wallet) {
      throw createError;
    }
  }

  // 4. Verify ownership before linking.
  if (
    !wallet ||
    wallet.ownerID !== courierId ||
    normalizeStatus(wallet.ownerType) !== "COURIER"
  ) {
    throw new Error("Courier wallet ownership verification failed.");
  }

  // 5. Save the wallet ID on Courier.

  const latestCourierData = await graphqlRequest(
    courierQuery,
    { id: courierId },
    "GetCourierForWalletSetup",
    "API_KEY",
  );

  const latestCourier = latestCourierData?.getCourier;

  if (!latestCourier || latestCourier._deleted === true) {
    throw new Error("Courier could not be reloaded while linking the wallet.");
  }

  if (latestCourier.walletID && latestCourier.walletID !== wallet.id) {
    const existingLinkedWallet = await getWalletById(latestCourier.walletID);

    if (
      existingLinkedWallet &&
      existingLinkedWallet.ownerID === courierId &&
      normalizeStatus(existingLinkedWallet.ownerType) === "COURIER"
    ) {
      return existingLinkedWallet;
    }
  }

  await updateCourierWalletID(latestCourier, wallet.id);

  console.log("COURIER WALLET READY:", {
    courierId,
    walletId: wallet.id,
  });

  return wallet;
}

async function getCourierDebt(debtId) {
  const query = `
    query GetCourierDebtForCashCollection($id: ID!) {
      getCourierDebt(id: $id) {
        ${DEBT_FIELDS}
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    { id: debtId },
    "GetCourierDebtForCashCollection",
    "IAM",
  );

  return data?.getCourierDebt || null;
}

async function listAllCourierDebts(courierId) {
  const query = `
    query ListCourierDebtsForCashCollection(
      $filter: ModelCourierDebtFilterInput
      $limit: Int
      $nextToken: String
    ) {
      listCourierDebts(filter: $filter, limit: $limit, nextToken: $nextToken) {
        items {
          ${DEBT_FIELDS}
        }
        nextToken
      }
    }
  `;

  const all = [];
  let nextToken = null;

  do {
    const data = await graphqlRequest(
      query,
      {
        filter: { courierID: { eq: courierId } },
        limit: PAGE_SIZE,
        nextToken,
      },
      "ListCourierDebtsForCashCollection",
      "IAM",
    );

    const page = data?.listCourierDebts;
    all.push(...(page?.items || []));
    nextToken = page?.nextToken || null;
  } while (nextToken);

  return all;
}

async function listAllCourierCollections(courierId) {
  const query = `
    query ListCourierCashCollections(
      $filter: ModelCashCollectionFilterInput
      $limit: Int
      $nextToken: String
    ) {
      listCashCollections(filter: $filter, limit: $limit, nextToken: $nextToken) {
        items {
          ${COLLECTION_FIELDS}
        }
        nextToken
      }
    }
  `;

  const all = [];
  let nextToken = null;

  do {
    const data = await graphqlRequest(
      query,
      {
        filter: { courierID: { eq: courierId } },
        limit: PAGE_SIZE,
        nextToken,
      },
      "ListCourierCashCollections",
      "IAM",
    );

    const page = data?.listCashCollections;
    all.push(...(page?.items || []));
    nextToken = page?.nextToken || null;
  } while (nextToken);

  return all;
}

// =============================================================================
// CASH EARNINGS TRANSACTION AND LIFETIME EARNINGS
// =============================================================================

async function getTransaction(transactionId) {
  const query = `
    query GetCashEarningsTransaction($id: ID!) {
      getTransaction(id: $id) {
        ${TRANSACTION_FIELDS}
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    { id: transactionId },
    "GetCashEarningsTransaction",
    "IAM",
  );

  return data?.getTransaction || null;
}

async function createCashEarningsTransaction({
  walletId,
  orderId,
  courierEarnings,
}) {
  const transactionId = getCashEarningsTransactionId(orderId);

  const input = {
    id: transactionId,
    walletID: walletId,
    type: "CASH_EARNINGS",
    amount: courierEarnings,
    description: `Courier earnings from cash order ${orderId}`,
    orderID: orderId,
    reference: `CASH-EARNINGS-${orderId}`,
    status: "COMPLETED",
  };

  const mutation = `
    mutation CreateCashEarningsTransaction(
      $input: CreateTransactionInput!
    ) {
      createTransaction(input: $input) {
        ${TRANSACTION_FIELDS}
      }
    }
  `;

  try {
    const data = await graphqlRequest(
      mutation,
      { input },
      "CreateCashEarningsTransaction",
      "IAM",
    );

    const created = data?.createTransaction;

    if (
      !created ||
      created.id !== transactionId ||
      created.walletID !== walletId ||
      created.orderID !== orderId ||
      created.type !== "CASH_EARNINGS" ||
      Number(created.amount) !== Number(courierEarnings) ||
      created.status !== "COMPLETED"
    ) {
      throw new Error("Cash earnings transaction was not saved correctly.");
    }

    return created;
  } catch (error) {
    // The create may have succeeded even if the response timed out.
    const existing = await getTransaction(transactionId).catch(() => null);

    if (
      existing &&
      existing.walletID === walletId &&
      existing.orderID === orderId &&
      existing.type === "CASH_EARNINGS" &&
      Number(existing.amount) === Number(courierEarnings) &&
      existing.status === "COMPLETED"
    ) {
      return existing;
    }

    if (existing) {
      throw new Error(
        "A conflicting cash earnings transaction already exists for this order.",
      );
    }

    throw error;
  }
}

async function listCashEarningsTransactions(walletId) {
  const query = `
    query ListCashEarningsTransactions(
      $filter: ModelTransactionFilterInput
      $limit: Int
      $nextToken: String
    ) {
      listTransactions(filter: $filter, limit: $limit, nextToken: $nextToken) {
        items {
          ${TRANSACTION_FIELDS}
        }
        nextToken
      }
    }
  `;

  const all = [];
  let nextToken = null;

  do {
    const data = await graphqlRequest(
      query,
      {
        filter: { walletID: { eq: walletId } },
        limit: PAGE_SIZE,
        nextToken,
      },
      "ListCashEarningsTransactions",
      "IAM",
    );

    const page = data?.listTransactions;
    all.push(...(page?.items || []));
    nextToken = page?.nextToken || null;
  } while (nextToken);

  return all.filter(
    (transaction) =>
      transaction.walletID === walletId &&
      transaction.type === "CASH_EARNINGS" &&
      transaction.status === "COMPLETED",
  );
}

async function updateWallet(wallet, updates) {
  let current = wallet;

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
    assertVersioned(current, "Wallet");

    const input = {
      id: current.id,
      ...updates,
      _version: current._version,
    };

    const mutation = `
      mutation UpdateWalletForCourierDebt($input: UpdateWalletInput!) {
        updateWallet(input: $input) {
          ${WALLET_FIELDS}
        }
      }
    `;

    try {
      const data = await graphqlRequest(
        mutation,
        { input },
        "UpdateWalletForCourierDebt",
        "IAM",
      );

      const updated = data?.updateWallet;

      if (!updated) {
        throw new Error("Courier wallet update failed.");
      }

      return updated;
    } catch (error) {
      // Updates passed here are absolute values, not increments.
      // Reloading and retrying therefore does not add the same amount twice.
      current = await getWalletForCourier(wallet.ownerID);

      if (attempt === MAX_CAS_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  throw new Error("Unable to update courier wallet after repeated conflicts.");
}

async function updateWalletEarnings(wallet, cashLifetimeEarnings) {
  let current = wallet;

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
    assertVersioned(current, "Wallet");

    // Always use the latest electronic total from the wallet.
    // This prevents cash collection from overwriting electronic earnings.
    const electronicLifetimeEarnings = roundMoney(
      Number(current.electronicLifetimeEarnings || 0),
    );

    const newCashLifetimeEarnings = roundMoney(cashLifetimeEarnings);

    const lifetimeEarnings = roundMoney(
      newCashLifetimeEarnings + electronicLifetimeEarnings,
    );

    const input = {
      id: current.id,
      cashLifetimeEarnings: newCashLifetimeEarnings,
      lifetimeEarnings,
      _version: current._version,
    };

    const mutation = `
      mutation UpdateWalletLifetimeEarnings(
        $input: UpdateWalletInput!
      ) {
        updateWallet(input: $input) {
          ${WALLET_FIELDS}
        }
      }
    `;

    try {
      const data = await graphqlRequest(
        mutation,
        { input },
        "UpdateWalletLifetimeEarnings",
        "IAM",
      );

      const updated = data?.updateWallet;

      if (!updated) {
        throw new Error("Wallet lifetime earnings update failed.");
      }

      return updated;
    } catch (error) {
      // Reload the wallet before retrying.
      // The next attempt recalculates the combined total using
      // the latest electronic earnings value.
      current = await getWalletForCourier(current.ownerID);

      if (!current) {
        throw new Error("Courier wallet could not be reloaded.");
      }

      // The update may have succeeded even if the response timed out.
      if (
        roundMoney(Number(current.cashLifetimeEarnings || 0)) ===
          newCashLifetimeEarnings &&
        roundMoney(Number(current.lifetimeEarnings || 0)) ===
          roundMoney(
            newCashLifetimeEarnings +
              Number(current.electronicLifetimeEarnings || 0),
          )
      ) {
        return current;
      }

      if (attempt === MAX_CAS_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  throw new Error(
    "Unable to update wallet lifetime earnings after repeated conflicts.",
  );
}

async function ensureCashEarnings({ order, courierId, courierEarnings }) {
  const earnings = getCourierEarnings({
    ...order,
    courierEarnings,
  });

  let wallet = await getWalletForCourier(courierId);

  // Create one deterministic transaction for this cash order.
  // This prevents the same order from being counted twice.
  await createCashEarningsTransaction({
    walletId: wallet.id,
    orderId: order.id,
    courierEarnings: earnings,
  });

  // Rebuild the cash earnings total from the cash earnings ledger.
  const transactions = await listCashEarningsTransactions(wallet.id);

  const cashLifetimeEarnings = roundMoney(
    transactions.reduce((sum, transaction) => {
      const amount = Number(transaction.amount);

      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error(
          `Cash earnings transaction ${transaction.id} has an invalid amount.`,
        );
      }

      return sum + amount;
    }, 0),
  );

  // Reload the latest wallet before updating its lifetime earnings.
  wallet = await getWalletForCourier(courierId);

  // Update cash lifetime earnings and recalculate the combined total.
  // Electronic lifetime earnings are preserved.
  wallet = await updateWalletEarnings(wallet, cashLifetimeEarnings);

  return {
    wallet,
    courierEarnings: earnings,
    cashLifetimeEarnings: Number(wallet.cashLifetimeEarnings || 0),
    electronicLifetimeEarnings: Number(wallet.electronicLifetimeEarnings || 0),
    lifetimeEarnings: Number(wallet.lifetimeEarnings || 0),
  };
}

// =============================================================================
// DEBT CYCLE IDENTIFICATION AND CREATION
// =============================================================================

function makeDebtId(courierId, collectionId, startedAt) {
  const courierHash = crypto
    .createHash("sha256")
    .update(courierId)
    .digest("hex")
    .slice(0, 12);

  const collectionHash = crypto
    .createHash("sha256")
    .update(collectionId)
    .digest("hex")
    .slice(0, 12);

  return (
    `courier-debt-${courierHash}-` +
    `${Date.parse(startedAt)}-${collectionHash}`
  );
}

function getStartTimeFromDebtId(debtId) {
  const parts = String(debtId || "").split("-");
  const timestamp = Number(parts[parts.length - 2]);

  return Number.isFinite(timestamp) && timestamp > 0
    ? new Date(timestamp).toISOString()
    : null;
}

async function createDebtCycle({
  wallet,
  courierId,
  collectionId,
  confirmedAt,
}) {
  const debtId = makeDebtId(courierId, collectionId, confirmedAt);
  const startedAt = confirmedAt;
  const dueAt = new Date(Date.parse(startedAt) + DEBT_WINDOW_MS).toISOString();

  const input = {
    id: debtId,
    courierID: courierId,
    walletID: wallet.id,
    amount: 0,
    amountPaid: 0,
    remainingAmount: 0,
    grossDebtAmount: 0,
    earningsOffsetAmount: 0,
    walletRecoveredAmount: 0,
    externalPaymentsAmount: 0,
    status: "OPEN",
    debtStartedAt: startedAt,
    dueAt,
    idempotencyKey: `courier-debt-cycle:${courierId}:${startedAt}`,
  };

  const mutation = `
    mutation CreateCourierDebtCycle($input: CreateCourierDebtInput!) {
      createCourierDebt(input: $input) {
        ${DEBT_FIELDS}
      }
    }
  `;

  try {
    const data = await graphqlRequest(
      mutation,
      { input },
      "CreateCourierDebtCycle",
      "IAM",
    );

    const created = data?.createCourierDebt;

    if (!created?.id) {
      throw new Error("Courier debt cycle could not be created.");
    }

    return created;
  } catch (error) {
    const existing = await getCourierDebt(debtId).catch(() => null);

    if (
      existing &&
      existing.courierID === courierId &&
      existing.walletID === wallet.id
    ) {
      return existing;
    }

    throw error;
  }
}

async function createDebtWithId({
  debtId,
  courierId,
  walletId,
  startedAt,
  dueAt,
}) {
  const input = {
    id: debtId,
    courierID: courierId,
    walletID: walletId,
    amount: 0,
    amountPaid: 0,
    remainingAmount: 0,
    grossDebtAmount: 0,
    earningsOffsetAmount: 0,
    walletRecoveredAmount: 0,
    externalPaymentsAmount: 0,
    status: "OPEN",
    debtStartedAt: startedAt,
    dueAt,
    idempotencyKey: `courier-debt-cycle:${courierId}:${startedAt}`,
  };

  const mutation = `
    mutation RecoverCourierDebtCycle($input: CreateCourierDebtInput!) {
      createCourierDebt(input: $input) {
        ${DEBT_FIELDS}
      }
    }
  `;

  try {
    const data = await graphqlRequest(
      mutation,
      { input },
      "RecoverCourierDebtCycle",
      "IAM",
    );

    return data?.createCourierDebt;
  } catch (error) {
    const existing = await getCourierDebt(debtId).catch(() => null);

    if (existing) {
      return existing;
    }

    throw error;
  }
}

// =============================================================================
// VERSIONED DEBT UPDATE
// =============================================================================

async function updateDebt(debt, updates) {
  let current = debt;

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
    assertVersioned(current, "CourierDebt");

    const input = {
      id: current.id,
      ...updates,
      _version: current._version,
    };

    const mutation = `
      mutation UpdateCourierDebtForCashCollection(
        $input: UpdateCourierDebtInput!
      ) {
        updateCourierDebt(input: $input) {
          ${DEBT_FIELDS}
        }
      }
    `;

    try {
      const data = await graphqlRequest(
        mutation,
        { input },
        "UpdateCourierDebtForCashCollection",
        "IAM",
      );

      const updated = data?.updateCourierDebt;

      if (!updated) {
        throw new Error("Courier debt update failed.");
      }

      return updated;
    } catch (error) {
      current = await getCourierDebt(current.id);

      if (!current || attempt === MAX_CAS_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  throw new Error("Unable to update courier debt after repeated conflicts.");
}

// =============================================================================
// FIND OR RESERVE THE COURIER'S ACTIVE DEBT CYCLE
// =============================================================================

async function reserveOrGetActiveDebt({ courierId, collection }) {
  let wallet = await getWalletForCourier(courierId);

  if (collection.courierDebtID) {
    const mappedDebt = await getCourierDebt(collection.courierDebtID);

    if (!mappedDebt || mappedDebt.courierID !== courierId) {
      throw new Error(
        "Cash collection points to a missing or mismatched courier debt.",
      );
    }

    return { wallet, debt: mappedDebt, collection };
  }

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
    wallet = await getWalletForCourier(courierId);

    if (wallet.activeCourierDebtID) {
      const activeDebt = await getCourierDebt(wallet.activeCourierDebtID);

      if (!activeDebt) {
        const recoveredStart = getStartTimeFromDebtId(
          wallet.activeCourierDebtID,
        );

        if (!recoveredStart) {
          throw new Error(
            "Wallet points to a missing active debt with an unknown start time. Manual review is required.",
          );
        }

        const recoveredDue = new Date(
          Date.parse(recoveredStart) + DEBT_WINDOW_MS,
        ).toISOString();

        const recovered = await createDebtWithId({
          debtId: wallet.activeCourierDebtID,
          courierId,
          walletId: wallet.id,
          startedAt: recoveredStart,
          dueAt: recoveredDue,
        });

        return { wallet, debt: recovered, collection };
      }

      if (
        activeDebt.courierID !== courierId ||
        activeDebt.walletID !== wallet.id
      ) {
        throw new Error(
          "Wallet active debt pointer does not belong to this courier.",
        );
      }

      if (
        ACTIVE_DEBT_STATUSES.has(normalizeStatus(activeDebt.status)) &&
        (Number(activeDebt.remainingAmount) > 0 ||
          (Number(activeDebt.amount) === 0 &&
            Number(activeDebt.remainingAmount) === 0))
      ) {
        return { wallet, debt: activeDebt, collection };
      }

      if (
        !CLOSED_DEBT_STATUSES.has(normalizeStatus(activeDebt.status)) &&
        Number(activeDebt.remainingAmount) <= 0
      ) {
        throw new Error(
          "Active courier debt has an inconsistent status or balance. Manual review is required.",
        );
      }
    }

    const debtId = makeDebtId(courierId, collection.id, collection.confirmedAt);

    assertVersioned(wallet, "Wallet");

    const input = {
      id: wallet.id,
      activeCourierDebtID: debtId,
      _version: wallet._version,
    };

    const mutation = `
      mutation ReserveCourierDebtCycle($input: UpdateWalletInput!) {
        updateWallet(input: $input) {
          ${WALLET_FIELDS}
        }
      }
    `;

    try {
      const data = await graphqlRequest(
        mutation,
        { input },
        "ReserveCourierDebtCycle",
        "IAM",
      );

      const reservedWallet = data?.updateWallet;

      if (!reservedWallet) {
        throw new Error("Could not reserve the courier's debt cycle.");
      }

      const debt = await createDebtCycle({
        wallet: reservedWallet,
        courierId,
        collectionId: collection.id,
        confirmedAt: collection.confirmedAt,
      });

      return { wallet: reservedWallet, debt, collection };
    } catch (error) {
      wallet = await getWalletForCourier(courierId);

      if (wallet.activeCourierDebtID === debtId) {
        const debt = await createDebtCycle({
          wallet,
          courierId,
          collectionId: collection.id,
          confirmedAt: collection.confirmedAt,
        });

        return { wallet, debt, collection };
      }

      if (attempt === MAX_CAS_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  throw new Error(
    "Unable to reserve a courier debt cycle after repeated conflicts.",
  );
}

// =============================================================================
// ATTACH CASH COLLECTION TO DEBT CYCLE
// =============================================================================

async function attachCollectionToDebt(collection, debt, atuaShareAmount) {
  if (collection.courierDebtID && collection.courierDebtID !== debt.id) {
    throw new Error(
      "Cash collection is already linked to a different debt cycle.",
    );
  }

  if (
    collection.debtAppliedAt &&
    collection.courierDebtID === debt.id &&
    Number(collection.atuaShareAmount) === Number(atuaShareAmount)
  ) {
    return collection;
  }

  return updateCashCollection(collection, {
    courierDebtID: debt.id,
    atuaShareAmount,
  });
}

// =============================================================================
// RECOMPUTE DEBT FROM CASH COLLECTION AUDIT RECORDS
// =============================================================================

async function recomputeDebtFromCollections(
  debt,
  courierId,
  expectedCollectionId,
) {
  const collections = await listAllCourierCollections(courierId);

  const cycleCollections = collections.filter(
    (item) =>
      item.courierDebtID === debt.id && item.status === CASH_STATUSES.CONFIRMED,
  );

  if (
    expectedCollectionId &&
    !cycleCollections.some((item) => item.id === expectedCollectionId)
  ) {
    throw new Error(
      "The new cash collection is not yet visible in the debt ledger. Retry debt posting.",
    );
  }

  const totalAtuaShare = roundMoney(
    cycleCollections.reduce((sum, item) => {
      const amount = Number(item.atuaShareAmount);

      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error(
          `Cash collection ${item.id} has an invalid Atua share.`,
        );
      }

      return sum + amount;
    }, 0),
  );

  if (totalAtuaShare <= 0) {
    throw new Error(
      "No confirmed cash collections are linked to this debt cycle.",
    );
  }

  let current = await getCourierDebt(debt.id);

  if (!current) {
    throw new Error("Courier debt cycle could not be found.");
  }

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
    const amountPaid = roundMoney(Number(current.amountPaid || 0));
    const remaining = roundMoney(totalAtuaShare - amountPaid);

    if (amountPaid < 0 || remaining < -0.01) {
      throw new Error(
        "Courier debt repayment totals exceed linked cash collections. Manual review is required.",
      );
    }

    const safeRemaining = Math.max(0, remaining);
    const dueTime = Date.parse(current.dueAt);
    const isOverdue =
      Number.isFinite(dueTime) && dueTime <= Date.now() && safeRemaining > 0;

    let status = "OPEN";

    if (safeRemaining <= 0) {
      status = "PAID";
    } else if (isOverdue) {
      status = "OVERDUE";
    } else if (amountPaid > 0) {
      status = "PARTIALLY_PAID";
    }

    const updates = {
      amount: totalAtuaShare,
      grossDebtAmount: totalAtuaShare,
      amountPaid,
      remainingAmount: safeRemaining,
      status,
      earningsOffsetAmount: Number(current.earningsOffsetAmount || 0),
      walletRecoveredAmount: Number(current.walletRecoveredAmount || 0),
      externalPaymentsAmount: Number(current.externalPaymentsAmount || 0),
    };

    try {
      return await updateDebt(current, updates);
    } catch (error) {
      current = await getCourierDebt(debt.id);

      if (!current || attempt === MAX_CAS_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  throw new Error("Unable to reconcile the consolidated debt cycle.");
}

// =============================================================================
// RECOMPUTE WALLET.OUTSTANDINGDEBT
// =============================================================================

async function recomputeWalletOutstandingDebt(wallet, courierId) {
  const debts = await listAllCourierDebts(courierId);

  const totalOutstanding = roundMoney(
    debts.reduce((sum, debt) => {
      const status = normalizeStatus(debt.status);
      const remaining = Number(debt.remainingAmount || 0);

      if (
        ACTIVE_DEBT_STATUSES.has(status) &&
        Number.isFinite(remaining) &&
        remaining > 0
      ) {
        return sum + remaining;
      }

      return sum;
    }, 0),
  );

  let currentWallet = await getWalletForCourier(courierId);

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
    try {
      return await updateWallet(currentWallet, {
        outstandingDebt: totalOutstanding,
      });
    } catch (error) {
      currentWallet = await getWalletForCourier(courierId);

      if (attempt === MAX_CAS_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  throw new Error("Unable to update the courier's aggregate outstanding debt.");
}

// =============================================================================
// COMPLETE OR REPAIR DEBT POSTING FOR ONE CASH COLLECTION
// =============================================================================

async function ensureDebtApplied({ collection, courierId, atuaShareAmount }) {
  const verifiedCollection = await ensureCollectionShare(
    collection,
    atuaShareAmount,
  );

  if (verifiedCollection.debtAppliedAt && verifiedCollection.courierDebtID) {
    const debt = await getCourierDebt(verifiedCollection.courierDebtID);

    if (!debt || debt.courierID !== courierId) {
      throw new Error(
        "The completed cash collection references an invalid debt cycle.",
      );
    }

    const wallet = await getWalletForCourier(courierId);

    return {
      collection: verifiedCollection,
      debt,
      wallet,
    };
  }

  const reserved = await reserveOrGetActiveDebt({
    courierId,
    collection: verifiedCollection,
  });

  const attached = await attachCollectionToDebt(
    verifiedCollection,
    reserved.debt,
    atuaShareAmount,
  );

  const debt = await recomputeDebtFromCollections(
    reserved.debt,
    courierId,
    attached.id,
  );

  const wallet = await recomputeWalletOutstandingDebt(
    reserved.wallet,
    courierId,
  );

  const marked = await updateCashCollection(attached, {
    debtAppliedAt: new Date().toISOString(),
  });

  return {
    collection: marked,
    debt,
    wallet,
  };
}

// =============================================================================
// UPDATE ORDER AS CASH-PAID
// =============================================================================

async function updateOrderForCashCollection({
  order,
  courierId,
  amount,
  collectionId,
  confirmedAt,
}) {
  const mutation = `
    mutation ConfirmOrderCashCollection($input: UpdateOrderInput!) {
      updateOrder(input: $input) {
        ${ORDER_FIELDS}
      }
    }
  `;

  const input = {
    id: order.id,
    paymentMethod: "CASH",
    paymentStatus: "PAID",
    cashCollectionStatus: "CONFIRMED",
    cashCollectedByCourierId: courierId,
    cashCollectedAmount: amount,
    cashCollectedAt: confirmedAt,
    cashCollectionID: collectionId,
  };

  if (Number.isInteger(order._version)) {
    input._version = order._version;
  }

  const data = await graphqlRequest(
    mutation,
    { input },
    "ConfirmOrderCashCollection",
    "API_KEY",
  );

  const updated = data?.updateOrder;

  if (
    !updated ||
    updated.id !== order.id ||
    updated.cashCollectionID !== collectionId ||
    updated.cashCollectedByCourierId !== courierId ||
    updated.cashCollectionStatus !== "CONFIRMED" ||
    Number(updated.cashCollectedAmount) !== Number(amount) ||
    updated.paymentStatus !== "PAID" ||
    updated.paymentMethod !== "CASH"
  ) {
    throw new Error("The Order's cash collection could not be confirmed.");
  }

  return updated;
}

// =============================================================================
// IDEMPOTENCY AND AUDIT REPAIR
// =============================================================================

function alreadyCollectedByThisCourier(order, courierId, collectionId) {
  return (
    order?.cashCollectionStatus === "CONFIRMED" &&
    order?.cashCollectionID === collectionId &&
    order?.cashCollectedByCourierId === courierId &&
    Number.isFinite(Number(order?.cashCollectedAmount)) &&
    Number(order.cashCollectedAmount) > 0
  );
}

async function ensureLedgerAndDebt({
  order,
  courierId,
  collectionId,
  atuaShareAmount,
}) {
  const amount = Number(order.cashCollectedAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("The recorded cash collection has an invalid amount.");
  }

  const courierEarnings = getCourierEarnings(order);
  const confirmedAt = order.cashCollectedAt || new Date().toISOString();

  const collection = await createCashCollectionRecord({
    collectionId,
    orderId: order.id,
    courierId,
    amount,
    atuaShareAmount,
    confirmedAt,
  });

  const debtPosting = await ensureDebtApplied({
    collection,
    courierId,
    atuaShareAmount,
  });

  // Always run this after debt posting, including on retries.
  // If a previous invocation stopped after debtAppliedAt was written,
  // this step still creates/repairs the earnings ledger and wallet total.
  const earningsPosting = await ensureCashEarnings({
    order,
    courierId,
    courierEarnings,
  });

  return {
    ...debtPosting,
    courierEarnings: earningsPosting.courierEarnings,
    lifetimeEarnings: earningsPosting.lifetimeEarnings,
  };
}

// =============================================================================
// ELECTRONIC PAYMENT SAFETY CHECKS
// =============================================================================

function isPaystackPayment(payment) {
  return normalizeStatus(payment?.provider) === "PAYSTACK";
}

const UNRESOLVED_OR_SUCCESSFUL_PAYMENT_STATUSES = new Set([
  "SUCCESS",
  "SUCCESSFUL",
  "PAID",
  "COMPLETED",
  "PENDING",
  "PROCESSING",
  "ONGOING",
  "INITIATED",
  "ABANDONED",
]);

const DEFINITIVE_FAILED_PAYMENT_STATUSES = new Set([
  "FAILED",
  "FAIL",
  "CANCELLED",
  "CANCELED",
  "DECLINED",
  "EXPIRED",
]);

function hasUnresolvedPaystackPayment(payments) {
  return payments.some((payment) => {
    if (!isPaystackPayment(payment)) {
      return false;
    }

    return UNRESOLVED_OR_SUCCESSFUL_PAYMENT_STATUSES.has(
      normalizeStatus(payment.status),
    );
  });
}

function canSafelyUseCashAfterElectronicAttempt(order, payments) {
  const hasElectronicReference = Boolean(
    order.paymentID || order.paymentReference,
  );

  if (!hasElectronicReference) {
    return true;
  }

  const orderPaymentStatus = normalizeStatus(order.paymentStatus);

  if (!DEFINITIVE_FAILED_PAYMENT_STATUSES.has(orderPaymentStatus)) {
    return false;
  }

  const orderReference = String(
    order.paymentReference || order.paymentID || "",
  );

  const relatedPayments = payments.filter((payment) => {
    if (!isPaystackPayment(payment)) {
      return false;
    }

    const reference = String(payment.reference || "");

    return !orderReference || !reference || reference === orderReference;
  });

  if (relatedPayments.length === 0) {
    return false;
  }

  return relatedPayments.every((payment) =>
    DEFINITIVE_FAILED_PAYMENT_STATUSES.has(normalizeStatus(payment.status)),
  );
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

exports.handler = async (event) => {
  let orderId = null;

  console.log("RECORD CASH COLLECTION INVOKED:", {
    hasIdentity: Boolean(event?.identity),
    hasCognitoSub: Boolean(
      event?.identity?.sub || event?.identity?.claims?.sub,
    ),
    arguments: event?.arguments || null,
  });

  try {
    orderId = getOrderId(event);
    const sub = getIdentitySub(event);

    if (!sub) {
      return result(false, "You must be signed in as the assigned courier.", {
        orderId,
      });
    }

    if (!orderId || typeof orderId !== "string" || !orderId.trim()) {
      return result(false, "A valid order ID is required.");
    }

    // -------------------------------------------------------------------------
    // Resolve authenticated user to an Atua Courier.
    // -------------------------------------------------------------------------

    const courier = await getCourierBySub(sub);

    if (!courier?.id) {
      return result(
        false,
        "Your account is not registered as an Atua courier.",
        { orderId },
      );
    }

    // -------------------------------------------------------------------------
    // Load Order and verify courier assignment.
    // -------------------------------------------------------------------------

    const order = await getOrder(orderId);

    if (!order) {
      return result(false, "Order could not be found.", { orderId });
    }

    if (order.assignedCourierId !== courier.id) {
      return result(
        false,
        "Only the courier assigned to this order can record cash collection.",
        { orderId: order.id },
      );
    }

    const collectionId = getCashCollectionId(order.id);
    const atuaShareAmount = getAtuaShare(order);

    // -------------------------------------------------------------------------
    // Idempotent retry: repair missing audit, debt or earnings posting.
    // -------------------------------------------------------------------------

    if (alreadyCollectedByThisCourier(order, courier.id, collectionId)) {
      if (
        normalizeStatus(order.paymentMethod) !== "CASH" ||
        normalizeStatus(order.paymentStatus) !== "PAID"
      ) {
        return result(
          false,
          "The recorded cash collection has inconsistent payment fields. Contact Atua support.",
          { orderId: order.id },
        );
      }

      const posted = await ensureLedgerAndDebt({
        order,
        courierId: courier.id,
        collectionId,
        atuaShareAmount,
      });

      return result(
        true,
        "Cash collection, courier debt and earnings are confirmed.",
        {
          orderId: order.id,
          cashCollectionID: posted.collection.id,
          amount: Number(posted.collection.amount),
          atuaShareAmount,
          courierEarnings: posted.courierEarnings,
          courierDebtID: posted.debt.id,
          debtRemaining: Number(posted.debt.remainingAmount),
          dueAt: posted.debt.dueAt,
          confirmedAt: posted.collection.confirmedAt,
        },
      );
    }

    // -------------------------------------------------------------------------
    // Do not overwrite a different or incomplete recorded collection.
    // -------------------------------------------------------------------------

    if (
      order.cashCollectionStatus === "CONFIRMED" ||
      order.cashCollectionID ||
      order.cashCollectedAt ||
      order.cashCollectedByCourierId
    ) {
      return result(
        false,
        "A cash collection is already recorded for this order. Contact Atua support if this is incorrect.",
        { orderId: order.id },
      );
    }

    // -------------------------------------------------------------------------
    // Validate Order status.
    // -------------------------------------------------------------------------

    if (
      ["CANCELLED", "DISPUTED", "DELIVERED"].includes(
        normalizeStatus(order.status),
      )
    ) {
      return result(
        false,
        "Cash cannot be recorded for this order in its current status.",
        { orderId: order.id },
      );
    }

    // -------------------------------------------------------------------------
    // Determine the cash-collection arrangement.
    // -------------------------------------------------------------------------

    const isPickupCash =
      order.paymentResponsibility === "SENDER" &&
      order.paymentTiming === "AT_PICKUP" &&
      normalizeStatus(order.paymentMethod) === "CASH";

    const isDeliveryCash =
      order.paymentTiming === "ON_DELIVERY" &&
      (normalizeStatus(order.paymentMethod) === "CASH" ||
        (order.paymentResponsibility === "RECEIVER" &&
          order.paymentMethod == null));

    if (!isPickupCash && !isDeliveryCash) {
      return result(
        false,
        "This order's saved payment arrangement does not permit cash collection at this stage.",
        { orderId: order.id },
      );
    }

    // -------------------------------------------------------------------------
    // Validate collection stage.
    // -------------------------------------------------------------------------

    if (
      isPickupCash &&
      !["ARRIVED_PICKUP", "LOADING"].includes(normalizeStatus(order.status))
    ) {
      return result(
        false,
        "Cash at pickup can only be recorded at the pickup location.",
        { orderId: order.id },
      );
    }

    if (
      isDeliveryCash &&
      !["ARRIVED_DROPOFF", "UNLOADING"].includes(normalizeStatus(order.status))
    ) {
      return result(
        false,
        "Cash on delivery can only be recorded at the delivery location.",
        { orderId: order.id },
      );
    }

    if (
      (isPickupCash && order.paymentTiming !== "AT_PICKUP") ||
      (isDeliveryCash && order.paymentTiming !== "ON_DELIVERY")
    ) {
      return result(
        false,
        "This order's payment timing does not match its cash-collection stage.",
        { orderId: order.id },
      );
    }

    // -------------------------------------------------------------------------
    // A previously confirmed payment must never be switched to cash.
    // -------------------------------------------------------------------------

    if (normalizeStatus(order.paymentStatus) === "PAID") {
      return result(
        false,
        "This order is already marked as paid. Verify its payment method before recording cash.",
        { orderId: order.id },
      );
    }

    if (
      order.paymentMethod &&
      !["CASH", "PAYSTACK", "ELECTRONIC"].includes(
        normalizeStatus(order.paymentMethod),
      )
    ) {
      return result(
        false,
        "This order has an unsupported payment method. Contact Atua support.",
        { orderId: order.id },
      );
    }

    // -------------------------------------------------------------------------
    // Derive order amount and courier earnings from saved Order.
    // -------------------------------------------------------------------------

    const amount = Number(order.totalPrice);
    const courierEarnings = getCourierEarnings(order);

    if (!Number.isFinite(amount) || amount <= 0) {
      return result(
        false,
        "The order has an invalid cash amount. Contact Atua support.",
        { orderId: order.id },
      );
    }

    // -------------------------------------------------------------------------
    // Inspect Payment records as well as Order fields.
    // -------------------------------------------------------------------------

    const payments = await getPaymentsForOrder(order.id);

    if (hasUnresolvedPaystackPayment(payments)) {
      return result(
        false,
        "An electronic payment attempt is successful or still unresolved. Verify or resolve it before collecting cash.",
        { orderId: order.id },
      );
    }

    if (!canSafelyUseCashAfterElectronicAttempt(order, payments)) {
      return result(
        false,
        "An electronic payment reference exists and its failure has not been conclusively verified. Resolve it before collecting cash.",
        { orderId: order.id },
      );
    }

    // -------------------------------------------------------------------------
    // Record physical cash collection.
    // -------------------------------------------------------------------------

    const confirmedAt = new Date().toISOString();

    try {
      await updateOrderForCashCollection({
        order,
        courierId: courier.id,
        amount,
        collectionId,
        confirmedAt,
      });
    } catch (updateError) {
      // The update might have succeeded even if its response failed.
      const latestOrder = await getOrder(order.id).catch(() => null);

      if (
        latestOrder &&
        alreadyCollectedByThisCourier(latestOrder, courier.id, collectionId) &&
        normalizeStatus(latestOrder.paymentMethod) === "CASH" &&
        normalizeStatus(latestOrder.paymentStatus) === "PAID"
      ) {
        const posted = await ensureLedgerAndDebt({
          order: latestOrder,
          courierId: courier.id,
          collectionId,
          atuaShareAmount,
        });

        return result(
          true,
          "Cash collection, courier debt and earnings are confirmed.",
          {
            orderId: latestOrder.id,
            cashCollectionID: posted.collection.id,
            amount: Number(posted.collection.amount),
            atuaShareAmount,
            courierEarnings: posted.courierEarnings,
            courierDebtID: posted.debt.id,
            debtRemaining: Number(posted.debt.remainingAmount),
            dueAt: posted.debt.dueAt,
            confirmedAt: posted.collection.confirmedAt,
          },
        );
      }

      console.error(
        "ORDER CASH UPDATE FAILED:",
        updateError?.message || updateError,
      );

      return result(
        false,
        "The order changed while cash was being recorded. Refresh the order and verify its payment status before retrying.",
        { orderId: order.id },
      );
    }

    // -------------------------------------------------------------------------
    // Create audit record, apply Atua's share to CourierDebt and record
    // the courier's cash earnings.
    // -------------------------------------------------------------------------

    const posted = await ensureLedgerAndDebt({
      order: {
        ...order,
        cashCollectedAmount: amount,
        cashCollectedAt: confirmedAt,
      },
      courierId: courier.id,
      collectionId,
      atuaShareAmount,
    });

    console.log("CASH COLLECTION, DEBT AND EARNINGS RECORDED:", {
      orderId: order.id,
      courierId: courier.id,
      cashCollectionID: posted.collection.id,
      courierDebtID: posted.debt.id,
      amount,
      atuaShareAmount,
      courierEarnings: posted.courierEarnings,
      lifetimeEarnings: posted.lifetimeEarnings,
      debtRemaining: posted.debt.remainingAmount,
      dueAt: posted.debt.dueAt,
      confirmedAt,
    });

    return result(
      true,
      "Cash collection recorded. Courier debt and lifetime earnings updated successfully.",
      {
        orderId: order.id,
        cashCollectionID: posted.collection.id,
        amount,
        atuaShareAmount,
        courierEarnings: posted.courierEarnings,
        courierDebtID: posted.debt.id,
        debtRemaining: Number(posted.debt.remainingAmount),
        dueAt: posted.debt.dueAt,
        confirmedAt,
      },
    );
  } catch (error) {
    console.error("RECORD CASH COLLECTION ERROR:", error?.message || error);

    return result(
      false,
      "Cash may already have been recorded on the order. Refresh and retry so the audit, debt and earnings records can be repaired. If the problem continues, contact Atua support.",
      { orderId },
    );
  }
};
