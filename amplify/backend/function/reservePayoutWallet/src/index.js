"use strict";

const https = require("https");
const crypto = require("crypto");

const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const REGION = process.env.REGION || process.env.AWS_REGION || "eu-north-1";

/* ==========================================================
   GENERAL HELPERS
========================================================== */

const money = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error("Invalid monetary amount.");
  }

  return Number(number.toFixed(2));
};

const errorMessage = (error) => {
  if (!error) return "Unknown error.";
  if (typeof error === "string") return error;
  return error.message || JSON.stringify(error);
};

/* ==========================================================
   AWS IAM SIGNING
========================================================== */

const getAwsCredentials = () => {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "Lambda IAM credentials are unavailable. Check the execution role.",
    );
  }

  return {
    accessKeyId,
    secretAccessKey,
    sessionToken,
  };
};

const sha256 = (value) =>
  crypto.createHash("sha256").update(value, "utf8").digest("hex");

const hmac = (key, value, encoding) =>
  crypto.createHmac("sha256", key).update(value, "utf8").digest(encoding);

const getSigningKey = (secretKey, dateStamp, region, service) => {
  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);

  return hmac(kService, "aws4_request");
};

const signAppSyncRequest = ({ method, path, body, host }) => {
  const credentials = getAwsCredentials();

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const service = "appsync";

  const canonicalHeaders =
    `content-type:application/json\n` +
    `host:${host}\n` +
    `x-amz-date:${amzDate}\n` +
    (credentials.sessionToken
      ? `x-amz-security-token:${credentials.sessionToken}\n`
      : "");

  const signedHeaders = credentials.sessionToken
    ? "content-type;host;x-amz-date;x-amz-security-token"
    : "content-type;host;x-amz-date";

  const payloadHash = sha256(body);

  const canonicalRequest =
    `${method}\n` +
    `${path}\n` +
    `\n` +
    `${canonicalHeaders}` +
    `${signedHeaders}\n` +
    `${payloadHash}`;

  const credentialScope = `${dateStamp}/${REGION}/${service}/aws4_request`;

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const signingKey = getSigningKey(
    credentials.secretAccessKey,
    dateStamp,
    REGION,
    service,
  );

  const signature = hmac(signingKey, stringToSign, "hex");

  const authorization =
    `AWS4-HMAC-SHA256 ` +
    `Credential=${credentials.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signature}`;

  const headers = {
    "Content-Type": "application/json",
    "X-Amz-Date": amzDate,
    Authorization: authorization,
  };

  if (credentials.sessionToken) {
    headers["X-Amz-Security-Token"] = credentials.sessionToken;
  }

  return headers;
};

/* ==========================================================
   GRAPHQL REQUEST
========================================================== */

const graphqlRequest = async (
  query,
  variables = {},
  operationName = "AppSync operation",
) => {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error("API_ATUA_GRAPHQLAPIENDPOINTOUTPUT is not configured.");
  }

  const endpoint = new URL(GRAPHQL_ENDPOINT);

  const body = JSON.stringify({
    query,
    variables,
  });

  const path = `${endpoint.pathname}${endpoint.search}`;

  const headers = signAppSyncRequest({
    method: "POST",
    path,
    body,
    host: endpoint.host,
  });

  const options = {
    hostname: endpoint.hostname,
    port: endpoint.port || 443,
    path,
    method: "POST",
    headers: {
      ...headers,
      "Content-Length": Buffer.byteLength(body),
    },
  };

  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      let responseBody = "";

      response.on("data", (chunk) => {
        responseBody += chunk;
      });

      response.on("end", () => {
        let parsed;

        try {
          parsed = JSON.parse(responseBody);
        } catch {
          return reject(
            new Error(`${operationName}: AppSync returned invalid JSON.`),
          );
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          return reject(
            new Error(
              `${operationName}: HTTP ${response.statusCode}: ` + responseBody,
            ),
          );
        }

        if (parsed.errors?.length) {
          const messages = parsed.errors
            .map((item) => item.message)
            .filter(Boolean)
            .join(" | ");

          const error = new Error(messages || `${operationName} failed.`);

          error.graphqlErrors = parsed.errors;

          return reject(error);
        }

        resolve(parsed.data || null);
      });
    });

    request.on("error", reject);

    request.setTimeout(15000, () => {
      request.destroy(
        new Error(`${operationName}: AppSync request timed out.`),
      );
    });

    request.write(body);
    request.end();
  });
};

/* ==========================================================
   GET PAYOUT
========================================================== */

const getPayout = async (payoutID) => {
  const query = `
    query GetPayout($id: ID!) {
      getPayout(id: $id) {
        id
        courierID
        walletID
        amount
        payoutFee
        totalWalletDebit
        status
        reference
        bankName
        accountNumber
        payoutMethod
        payoutSource
        processedAt
        paidAt
        failedAt
      }
    }
  `;

  const data = await graphqlRequest(query, { id: payoutID }, "GetPayout");

  return data?.getPayout || null;
};

/* ==========================================================
   GET COURIER
========================================================== */

const getCourier = async (courierID) => {
  if (!courierID) {
    throw new Error("Payout courier ID is missing.");
  }

  const query = `
    query GetCourier($id: ID!) {
      getCourier(id: $id) {
        id
        isBlocked
        debtRestrictionActive
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    { id: courierID },
    "GetPayoutCourier",
  );

  return data?.getCourier || null;
};

/* ==========================================================
   GET WALLET
========================================================== */

const getWallet = async ({ payout, courierID }) => {
  if (payout.walletID) {
    const query = `
      query GetWallet($id: ID!) {
        getWallet(id: $id) {
          id
          ownerID
          ownerType
          availableBalance
          pendingBalance
          lifetimeEarnings
          outstandingDebt
          _version
          _deleted
        }
      }
    `;

    const data = await graphqlRequest(
      query,
      { id: payout.walletID },
      "GetPayoutWallet",
    );

    return data?.getWallet || null;
  }

  const query = `
    query ListWallets(
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
          availableBalance
          pendingBalance
          lifetimeEarnings
          outstandingDebt
          _version
          _deleted
        }
        nextToken
      }
    }
  `;

  let nextToken = null;

  do {
    const data = await graphqlRequest(
      query,
      {
        filter: {
          ownerID: { eq: courierID },
          ownerType: { eq: "COURIER" },
        },
        limit: 100,
        nextToken,
      },
      "FindCourierWallet",
    );

    const wallets = data?.listWallets?.items || [];

    const wallet = wallets.find((item) => item && item._deleted !== true);

    if (wallet) return wallet;

    nextToken = data?.listWallets?.nextToken || null;
  } while (nextToken);

  return null;
};

/* ==========================================================
   GET PAYOUT RESERVATION
========================================================== */

const getReservation = async (payoutID) => {
  const query = `
    query GetPayoutReservation($id: ID!) {
      getPayoutReservation(id: $id) {
        id
        payoutID
        walletID
        courierID
        totalWalletDebit
        payoutAmount
        payoutFee
        reference
        transactionID
        status
        failureReason
        reservedAt
        reversedAt
        _version
        _deleted
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    { id: payoutID },
    "GetPayoutReservation",
  );

  const reservation = data?.getPayoutReservation || null;

  if (reservation?._deleted === true) return null;

  return reservation;
};

/* ==========================================================
   CREATE PAYOUT RESERVATION
========================================================== */

const createReservation = async ({ payout, wallet, debit }) => {
  const mutation = `
    mutation CreatePayoutReservation(
      $input: CreatePayoutReservationInput!
    ) {
      createPayoutReservation(input: $input) {
        id
        payoutID
        walletID
        courierID
        totalWalletDebit
        payoutAmount
        payoutFee
        reference
        transactionID
        status
        failureReason
        reservedAt
        _version
      }
    }
  `;

  const input = {
    id: payout.id,
    payoutID: payout.id,
    walletID: wallet.id,
    courierID: payout.courierID,
    totalWalletDebit: debit,
    payoutAmount: money(payout.amount),
    payoutFee: money(payout.payoutFee || 0),
    reference: payout.reference,
    transactionID: null,
    status: "PENDING",
    failureReason: null,
    reservedAt: null,
  };

  const data = await graphqlRequest(
    mutation,
    { input },
    "CreatePayoutReservation",
  );

  return data?.createPayoutReservation || null;
};

/* ==========================================================
   UPDATE PAYOUT RESERVATION
========================================================== */

const updateReservation = async (reservation, updates) => {
  if (!reservation?.id || reservation._version == null) {
    throw new Error("Reservation ID and version are required for an update.");
  }

  const mutation = `
    mutation UpdatePayoutReservation(
      $input: UpdatePayoutReservationInput!
    ) {
      updatePayoutReservation(input: $input) {
        id
        payoutID
        walletID
        courierID
        totalWalletDebit
        payoutAmount
        payoutFee
        reference
        transactionID
        status
        failureReason
        reservedAt
        reversedAt
        _version
      }
    }
  `;

  const data = await graphqlRequest(
    mutation,
    {
      input: {
        id: reservation.id,
        _version: reservation._version,
        ...updates,
      },
    },
    "UpdatePayoutReservation",
  );

  return data?.updatePayoutReservation || null;
};

/* ==========================================================
   DEDUCT WALLET BALANCE
========================================================== */

const deductWallet = async ({ wallet, debit }) => {
  if (!wallet?.id) {
    throw new Error("Wallet ID is missing.");
  }

  if (wallet._version == null) {
    throw new Error("Wallet version is missing.");
  }

  const currentBalance = money(wallet.availableBalance || 0);

  if (currentBalance < debit) {
    throw new Error("Insufficient available wallet balance for this payout.");
  }

  const newBalance = money(currentBalance - debit);

  const mutation = `
    mutation UpdateWallet($input: UpdateWalletInput!) {
      updateWallet(input: $input) {
        id
        ownerID
        ownerType
        availableBalance
        pendingBalance
        lifetimeEarnings
        outstandingDebt
        _version
      }
    }
  `;

  const data = await graphqlRequest(
    mutation,
    {
      input: {
        id: wallet.id,
        availableBalance: newBalance,
        _version: wallet._version,
      },
    },
    "DeductPayoutWallet",
  );

  const updatedWallet = data?.updateWallet;

  if (!updatedWallet) {
    throw new Error("Wallet deduction was not confirmed by AppSync.");
  }

  return updatedWallet;
};

/* ==========================================================
   GET EXISTING PAYOUT DEBIT TRANSACTION
========================================================== */

const getPayoutDebitTransaction = async (transactionID) => {
  const query = `
    query GetTransaction($id: ID!) {
      getTransaction(id: $id) {
        id
        walletID
        payoutID
        type
        amount
        description
        reference
        status
        _version
        _deleted
      }
    }
  `;

  const data = await graphqlRequest(
    query,
    { id: transactionID },
    "GetPayoutDebitTransaction",
  );

  const transaction = data?.getTransaction || null;

  if (transaction?._deleted === true) return null;

  return transaction;
};

/* ==========================================================
   CREATE PAYOUT DEBIT TRANSACTION
========================================================== */

const createPayoutDebitTransaction = async ({ payout, wallet, debit }) => {
  const transactionID = `${payout.id}-PAYOUT-DEBIT`;

  const existing = await getPayoutDebitTransaction(transactionID);

  if (existing) {
    if (
      existing.walletID !== wallet.id ||
      existing.payoutID !== payout.id ||
      existing.type !== "DEBIT" ||
      money(existing.amount) !== debit ||
      existing.reference !== payout.reference
    ) {
      throw new Error(
        "An existing payout debit transaction does not match this payout.",
      );
    }

    return existing;
  }

  const mutation = `
    mutation CreateTransaction($input: CreateTransactionInput!) {
      createTransaction(input: $input) {
        id
        walletID
        payoutID
        type
        amount
        description
        reference
        status
        _version
      }
    }
  `;

  const input = {
    id: transactionID,
    walletID: wallet.id,
    payoutID: payout.id,
    type: "DEBIT",
    amount: debit,
    description: `Atua payout reservation - ${payout.id}`,
    reference: payout.reference,
    status: "PENDING",
  };

  try {
    const data = await graphqlRequest(
      mutation,
      { input },
      "CreatePayoutDebitTransaction",
    );

    const transaction = data?.createTransaction;

    if (!transaction) {
      throw new Error("Payout debit transaction was not confirmed.");
    }

    return transaction;
  } catch (error) {
    const retryRead = await getPayoutDebitTransaction(transactionID);

    if (retryRead) {
      if (
        retryRead.walletID !== wallet.id ||
        retryRead.payoutID !== payout.id ||
        retryRead.type !== "DEBIT" ||
        money(retryRead.amount) !== debit ||
        retryRead.reference !== payout.reference
      ) {
        throw new Error(
          "Existing payout transaction does not match the requested debit.",
        );
      }

      return retryRead;
    }

    throw error;
  }
};

/* ==========================================================
   VALIDATE PAYOUT AND WALLET
========================================================== */

const validatePayout = ({ payout, wallet }) => {
  if (!payout) {
    throw new Error("Payout record could not be found.");
  }

  if (!payout.id || !payout.courierID) {
    throw new Error("Payout ID or courier ID is missing.");
  }

  if (!payout.reference) {
    throw new Error("Payout reference is missing.");
  }

  if (!wallet || wallet._deleted === true) {
    throw new Error("Courier wallet could not be found.");
  }

  if (wallet.ownerID !== payout.courierID) {
    throw new Error("The payout wallet does not belong to this courier.");
  }

  if (wallet.ownerType !== "COURIER") {
    throw new Error("The selected wallet is not a courier wallet.");
  }

  const payoutAmount = money(payout.amount);
  const payoutFee = money(payout.payoutFee || 0);
  const totalWalletDebit = money(payout.totalWalletDebit);

  if (payoutAmount <= 0 || totalWalletDebit <= 0) {
    throw new Error("Payout amount or wallet debit is invalid.");
  }

  if (Math.abs(totalWalletDebit - money(payoutAmount + payoutFee)) > 0.01) {
    throw new Error(
      "Payout.totalWalletDebit does not match amount plus payoutFee.",
    );
  }

  const status = String(payout.status || "").toUpperCase();

  if (status !== "PENDING" && status !== "PROCESSING") {
    throw new Error(
      `Payout cannot be reserved while its status is ${status || "EMPTY"}.`,
    );
  }

  return {
    payoutAmount,
    payoutFee,
    totalWalletDebit,
  };
};

/* ==========================================================
   MAIN HANDLER
========================================================== */

exports.handler = async (event) => {
  console.log("RESERVE PAYOUT WALLET EVENT:", JSON.stringify(event));

  let payoutID =
    event?.payoutID || event?.arguments?.payoutID || event?.detail?.payoutID;

  if (!payoutID && event?.body) {
    try {
      const body =
        typeof event.body === "string" ? JSON.parse(event.body) : event.body;

      payoutID = body?.payoutID;
    } catch {
      // Invalid body is handled by the required-field check below.
    }
  }

  if (!payoutID) {
    return {
      success: false,
      code: "MISSING_PAYOUT_ID",
      message: "payoutID is required.",
    };
  }

  try {
    /* ------------------------------------------------------
       1. LOAD PAYOUT
    ------------------------------------------------------ */

    const payout = await getPayout(payoutID);

    if (!payout) {
      throw new Error("Payout record does not exist.");
    }

    /* ------------------------------------------------------
       2. LOAD WALLET
    ------------------------------------------------------ */

    const wallet = await getWallet({
      payout,
      courierID: payout.courierID,
    });

    if (!wallet) {
      throw new Error("Courier wallet does not exist.");
    }

    /* ------------------------------------------------------
       3. VALIDATE FINANCIAL DATA
    ------------------------------------------------------ */

    const financials = validatePayout({
      payout,
      wallet,
    });

    const debit = financials.totalWalletDebit;

    /* ------------------------------------------------------
       4. CHECK EXISTING RESERVATION
    ------------------------------------------------------ */

    let reservation = await getReservation(payout.id);

    if (reservation) {
      if (reservation.status === "RESERVED") {
        return {
          success: true,
          alreadyReserved: true,
          payoutID: payout.id,
          walletID: reservation.walletID,
          reservationID: reservation.id,
          transactionID: reservation.transactionID,
          amountReserved: reservation.totalWalletDebit,
          totalWalletDebit: reservation.totalWalletDebit,
          reference: reservation.reference,
          status: reservation.status,
          message: "Payout wallet funds are already reserved.",
        };
      }

      if (reservation.status === "WALLET_DEBITED") {
        if (
          reservation.walletID !== wallet.id ||
          reservation.courierID !== payout.courierID ||
          money(reservation.totalWalletDebit) !== debit ||
          reservation.reference !== payout.reference
        ) {
          throw new Error("Existing reservation does not match the payout.");
        }

        const transaction = await createPayoutDebitTransaction({
          payout,
          wallet,
          debit,
        });

        const confirmed = await updateReservation(reservation, {
          transactionID: transaction.id,
          status: "RESERVED",
          failureReason: null,
          reservedAt: new Date().toISOString(),
        });

        if (!confirmed) {
          throw new Error("Could not confirm the final reservation status.");
        }

        return {
          success: true,
          resumed: true,
          payoutID: payout.id,
          walletID: reservation.walletID,
          reservationID: confirmed.id,
          transactionID: transaction.id,
          amountReserved: debit,
          totalWalletDebit: debit,
          reference: payout.reference,
          status: confirmed.status,
          message: "Payout reservation successfully completed.",
        };
      }

      if (reservation.status === "PENDING") {
        return {
          success: false,
          inProgress: true,
          payoutID: payout.id,
          reservationID: reservation.id,
          status: reservation.status,
          message:
            "A payout reservation already exists in PENDING status. " +
            "No second wallet deduction was attempted. Reconcile it before retrying.",
        };
      }

      if (
        reservation.status === "FAILED" ||
        reservation.status === "REVERSED"
      ) {
        throw new Error(
          `This payout reservation is ${reservation.status}. ` +
            "It must be reviewed before another reservation can be made.",
        );
      }

      throw new Error(`Unsupported reservation status: ${reservation.status}`);
    }

    /* ------------------------------------------------------
       5. CHECK COURIER RESTRICTIONS BEFORE A NEW RESERVATION
    ------------------------------------------------------ */

    const courier = await getCourier(payout.courierID);

    if (!courier) {
      throw new Error("Courier record could not be found.");
    }

    if (courier.isBlocked === true) {
      throw new Error(
        "This courier is administratively blocked and cannot withdraw.",
      );
    }

    if (courier.debtRestrictionActive === true) {
      return {
        success: false,
        blocked: true,
        code: "COURIER_DEBT_RESTRICTED",
        payoutID: payout.id,
        message:
          "This courier has overdue Atua debt. Withdrawals are frozen until the overdue debt is repaid.",
      };
    }

    /* ------------------------------------------------------
       6. CREATE THE RESERVATION RECORD
    ------------------------------------------------------ */

    let createdByThisInvocation = false;

    try {
      reservation = await createReservation({
        payout,
        wallet,
        debit,
      });

      if (!reservation) {
        throw new Error("Reservation creation was not confirmed.");
      }

      createdByThisInvocation = true;
    } catch (createError) {
      const existing = await getReservation(payout.id);

      if (existing) {
        return {
          success: false,
          inProgress: true,
          payoutID: payout.id,
          reservationID: existing.id,
          status: existing.status,
          message:
            "A reservation already exists. No additional wallet debit was attempted.",
        };
      }

      throw createError;
    }

    if (!createdByThisInvocation) {
      throw new Error("Reservation ownership could not be confirmed.");
    }

    /* ------------------------------------------------------
       7. DEDUCT WALLET BALANCE
    ------------------------------------------------------ */

    let updatedWallet;

    try {
      updatedWallet = await deductWallet({
        wallet,
        debit,
      });
    } catch (walletError) {
      console.error(
        "WALLET DEDUCTION NOT CONFIRMED:",
        errorMessage(walletError),
      );

      return {
        success: false,
        uncertain: true,
        payoutID: payout.id,
        reservationID: reservation.id,
        status: "PENDING",
        message:
          "Wallet deduction could not be confirmed. " +
          "The reservation remains PENDING to prevent a duplicate debit. " +
          "Reconcile before retrying.",
      };
    }

    console.log("PAYOUT WALLET DEBIT CONFIRMED:", {
      payoutID: payout.id,
      walletID: updatedWallet.id,
      previousBalance: wallet.availableBalance,
      newBalance: updatedWallet.availableBalance,
      amountDebited: debit,
    });

    /* ------------------------------------------------------
       8. MARK WALLET_DEBITED
    ------------------------------------------------------ */

    reservation = await updateReservation(reservation, {
      status: "WALLET_DEBITED",
      failureReason: null,
    });

    if (!reservation) {
      return {
        success: false,
        uncertain: true,
        payoutID: payout.id,
        reservationID: payout.id,
        status: "WALLET_DEBITED",
        message:
          "Wallet debit succeeded, but reservation status update was not confirmed. " +
          "Do not repeat the wallet debit. Reconcile this payout.",
      };
    }

    /* ------------------------------------------------------
       9. CREATE OR RETRIEVE DEBIT TRANSACTION
    ------------------------------------------------------ */

    const transaction = await createPayoutDebitTransaction({
      payout,
      wallet: updatedWallet,
      debit,
    });

    /* ------------------------------------------------------
       10. MARK RESERVATION RESERVED
    ------------------------------------------------------ */

    const confirmedReservation = await updateReservation(reservation, {
      transactionID: transaction.id,
      status: "RESERVED",
      failureReason: null,
      reservedAt: new Date().toISOString(),
    });

    if (!confirmedReservation) {
      return {
        success: false,
        uncertain: true,
        payoutID: payout.id,
        reservationID: reservation.id,
        transactionID: transaction.id,
        status: "WALLET_DEBITED",
        message:
          "Wallet debit and transaction are recorded, but final reservation confirmation failed. " +
          "Do not deduct again. Reconcile this payout.",
      };
    }

    /* ------------------------------------------------------
       11. SUCCESS
    ------------------------------------------------------ */

    console.log("PAYOUT WALLET RESERVED SUCCESSFULLY:", {
      payoutID: payout.id,
      reservationID: confirmedReservation.id,
      walletID: wallet.id,
      transactionID: transaction.id,
      totalWalletDebit: debit,
    });

    return {
      success: true,
      payoutID: payout.id,
      reservationID: confirmedReservation.id,
      walletID: wallet.id,
      transactionID: transaction.id,
      payoutAmount: financials.payoutAmount,
      payoutFee: financials.payoutFee,
      amountReserved: debit,
      totalWalletDebit: debit,
      reference: payout.reference,
      status: "RESERVED",
      message: "Payout wallet funds successfully reserved.",
    };
  } catch (error) {
    console.error("RESERVE PAYOUT WALLET FAILED:", errorMessage(error));

    return {
      success: false,
      payoutID,
      code: "PAYOUT_RESERVATION_FAILED",
      message: errorMessage(error),
    };
  }
};
