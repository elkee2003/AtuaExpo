/* Amplify Params - DO NOT EDIT
	API_ATUA_GRAPHQLAPIENDPOINTOUTPUT
	API_ATUA_GRAPHQLAPIIDOUTPUT
	API_ATUA_GRAPHQLAPIKEYOUTPUT
	ENV
	REGION
 Amplify Params - DO NOT EDIT */

const {
  SSMClient,
  GetParameterCommand,
} = require("@aws-sdk/client-ssm");

const https = require("https");
const crypto = require("crypto");

/* ==========================================================
   CONFIGURATION
========================================================== */

const GRAPHQL_ENDPOINT =
  process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT;

const GRAPHQL_API_KEY =
  process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT;

const REGION =
  process.env.REGION ||
  process.env.AWS_REGION;

/* ==========================================================
   GET PAYSTACK SECRET FROM SSM
========================================================== */

const getPaystackSecretKey = async () => {
  const parameterName =
    process.env.PAYSTACK_SECRET_KEY;

  if (!parameterName) {
    throw new Error(
      "PAYSTACK_SECRET_KEY secret is not configured."
    );
  }

  const ssmClient =
    new SSMClient({
      region: REGION,
    });

  const command =
    new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true,
    });

  const result =
    await ssmClient.send(command);

  const secretKey =
    result?.Parameter?.Value;

  if (!secretKey) {
    throw new Error(
      "Could not retrieve Paystack secret key."
    );
  }

  return secretKey;
};

/* ==========================================================
   GRAPHQL REQUEST
========================================================== */

const graphqlRequest = async (
  query,
  variables = {},
  operationName = "GraphQL operation"
) => {
  if (!GRAPHQL_ENDPOINT) {
    throw new Error(
      "Atua GraphQL endpoint is not configured."
    );
  }

  if (!GRAPHQL_API_KEY) {
    throw new Error(
      "Atua GraphQL API key is not configured."
    );
  }

  const endpoint =
    new URL(GRAPHQL_ENDPOINT);

  const body =
    JSON.stringify({
      query,
      variables,
    });

  const options = {
    hostname:
      endpoint.hostname,

    path:
      endpoint.pathname ||
      "/graphql",

    method:
      "POST",

    headers: {
      "Content-Type":
        "application/json",

      "Content-Length":
        Buffer.byteLength(body),

      "x-api-key":
        GRAPHQL_API_KEY,
    },
  };

  return new Promise(
    (resolve, reject) => {
      const request =
        https.request(
          options,
          (res) => {
            let data = "";

            res.on(
              "data",
              (chunk) => {
                data += chunk;
              }
            );

            res.on(
              "end",
              () => {
                if (
                  res.statusCode < 200 ||
                  res.statusCode >= 300
                ) {
                  console.error(
                    `${operationName} HTTP ERROR:`,
                    {
                      statusCode:
                        res.statusCode,

                      body:
                        data,
                    }
                  );

                  return reject(
                    new Error(
                      `${operationName} returned HTTP ${res.statusCode}.`
                    )
                  );
                }

                let parsed;

                try {
                  parsed =
                    JSON.parse(data);
                } catch (error) {
                  console.error(
                    `${operationName} JSON PARSE ERROR:`,
                    error
                  );

                  return reject(error);
                }

                if (
                  parsed?.errors?.length
                ) {
                  console.error(
                    `${operationName} GRAPHQL ERRORS:`,
                    JSON.stringify(
                      parsed.errors
                    )
                  );

                  return reject(
                    new Error(
                      parsed.errors
                        .map(
                          (item) =>
                            item?.message
                        )
                        .filter(Boolean)
                        .join(" | ") ||
                      `${operationName} failed.`
                    )
                  );
                }

                resolve(
                  parsed?.data ||
                  null
                );
              }
            );
          }
        );

      request.on(
        "error",
        (error) => {
          console.error(
            `${operationName} REQUEST ERROR:`,
            error
          );

          reject(error);
        }
      );

      request.write(body);
      request.end();
    }
  );
};

/* ==========================================================
   PAYSTACK API REQUEST
========================================================== */

const paystackRequest = async ({
  method,
  path,
  secretKey,
}) => {
  const options = {
    hostname:
      "api.paystack.co",

    path,

    method,

    headers: {
      Authorization:
        `Bearer ${secretKey}`,

      Accept:
        "application/json",
    },
  };

  return new Promise(
    (resolve, reject) => {
      const request =
        https.request(
          options,
          (res) => {
            let data = "";

            res.on(
              "data",
              (chunk) => {
                data += chunk;
              }
            );

            res.on(
              "end",
              () => {
                let parsed;

                try {
                  parsed =
                    JSON.parse(data);
                } catch (error) {
                  console.error(
                    "PAYSTACK JSON PARSE ERROR:",
                    {
                      statusCode:
                        res.statusCode,

                      body:
                        data,
                    }
                  );

                  return reject(error);
                }

                resolve({
                  statusCode:
                    res.statusCode,

                  body:
                    parsed,
                });
              }
            );
          }
        );

      request.on(
        "error",
        (error) => {
          console.error(
            "PAYSTACK REQUEST ERROR:",
            error
          );

          reject(error);
        }
      );

      request.end();
    }
  );
};

/* ==========================================================
   GET ORDER
========================================================== */

const getOrder = async (
  orderId
) => {
  const query = `
    query GetOrder($id: ID!) {
      getOrder(id: $id) {
        id
        userID
        totalPrice

        status

        paymentStatus
        paymentID

        payoutStatus
        fundsStatus

        courierEarnings
        assignedCourierId

        isInterState
        tripType

        createdAt
        updatedAt

        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const data =
    await graphqlRequest(
      query,
      {
        id:
          orderId,
      },
      "GetOrder"
    );

  return (
    data?.getOrder ||
    null
  );
};

/* ==========================================================
   GET PAYMENT BY REFERENCE
========================================================== */

const getPaymentByReference =
  async (
    reference
  ) => {
    const query = `
      query ListPayments(
        $filter: ModelPaymentFilterInput
      ) {
        listPayments(
          filter: $filter
          limit: 1
        ) {
          items {
            id

            orderID
            userID

            amount
            currency

            status
            paymentMethod
            provider

            reference

            createdAt
            updatedAt

            _version
            _lastChangedAt
            _deleted
          }
        }
      }
    `;

    const data =
      await graphqlRequest(
        query,
        {
          filter: {
            reference: {
              eq:
                reference,
            },
          },
        },
        "GetPaymentByReference"
      );

    return (
      data?.listPayments?.items?.[0] ||
      null
    );
  };

/* ==========================================================
   CREATE PAYMENT
========================================================== */

const createPayment = async ({
  order,
  transaction,
}) => {
  const mutation = `
    mutation CreatePayment(
      $input: CreatePaymentInput!
    ) {
      createPayment(
        input: $input
      ) {
        id

        orderID
        userID

        amount
        currency

        status
        paymentMethod
        provider

        reference

        createdAt
        updatedAt

        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const input = {
    orderID:
      order.id,

    userID:
      order.userID,

    amount:
      Number(
        order.totalPrice
      ),

    currency:
      transaction.currency,

    status:
      "SUCCESS",

    paymentMethod:
      transaction.channel ||
      "paystack",

    provider:
      "PAYSTACK",

    reference:
      transaction.reference,
  };

  console.log(
    "CREATING PAYMENT:",
    {
      orderID:
        input.orderID,

      amount:
        input.amount,

      reference:
        input.reference,
    }
  );

  const data =
    await graphqlRequest(
      mutation,
      {
        input,
      },
      "CreatePayment"
    );

  return (
    data?.createPayment ||
    null
  );
};

/* ==========================================================
   MARK ORDER AS PAID
========================================================== */

const markOrderAsPaid = async ({
  order,
  paymentId,
}) => {
  if (!order?.id) {
    throw new Error(
      "Order is required."
    );
  }

  if (!paymentId) {
    throw new Error(
      "Payment ID is required."
    );
  }

  const mutation = `
    mutation UpdateOrder(
      $input: UpdateOrderInput!
    ) {
      updateOrder(
        input: $input
      ) {
        id

        status

        paymentStatus
        paymentID

        payoutStatus
        fundsStatus

        courierEarnings
        assignedCourierId

        createdAt
        updatedAt

        _version
        _lastChangedAt
        _deleted
      }
    }
  `;

  const input = {
    id:
      order.id,

    paymentStatus:
      "PAID",

    paymentID:
      paymentId,

    status:
      "READY_FOR_PICKUP",

    fundsStatus:
      "HELD",
  };

  if (
    Number.isInteger(
      order._version
    )
  ) {
    input._version =
      order._version;
  }

  const data =
    await graphqlRequest(
      mutation,
      {
        input,
      },
      "MarkOrderAsPaid"
    );

  return (
    data?.updateOrder ||
    null
  );
};

/* ==========================================================
   VERIFY CUSTOMER TRANSACTION WITH PAYSTACK
========================================================== */

const verifyCustomerTransaction =
  async (
    reference,
    secretKey
  ) => {
    const encodedReference =
      encodeURIComponent(
        reference
      );

    const response =
      await new Promise(
        (resolve, reject) => {
          const request =
            https.request(
              {
                hostname:
                  "api.paystack.co",

                path:
                  `/transaction/verify/${encodedReference}`,

                method:
                  "GET",

                headers: {
                  Authorization:
                    `Bearer ${secretKey}`,

                  Accept:
                    "application/json",
                },
              },

              (res) => {
                let data = "";

                res.on(
                  "data",
                  (chunk) => {
                    data += chunk;
                  }
                );

                res.on(
                  "end",
                  () => {
                    try {
                      resolve({
                        statusCode:
                          res.statusCode,

                        body:
                          JSON.parse(
                            data
                          ),
                      });
                    } catch (error) {
                      reject(error);
                    }
                  }
                );
              }
            );

          request.on(
            "error",
            reject
          );

          request.end();
        }
      );

    return response;
  };

/* ==========================================================
   GET PAYOUT BY REFERENCE
========================================================== */

const getPayoutByReference =
  async (
    reference
  ) => {
    const query = `
      query ListPayouts(
        $filter: ModelPayoutFilterInput
      ) {
        listPayouts(
          filter: $filter
          limit: 1
        ) {
          items {
            id

            courierID
            walletID

            amount

            status

            bankName
            accountNumber

            reference

            transferCode
            transferID

            failureReason

            payoutMethod

            processedAt
            paidAt
            failedAt

            _version
          }
        }
      }
    `;

    const data =
      await graphqlRequest(
        query,
        {
          filter: {
            reference: {
              eq:
                reference,
            },
          },
        },
        "GetPayoutByReference"
      );

    return (
      data?.listPayouts?.items?.[0] ||
      null
    );
  };

/* ==========================================================
   UPDATE PAYOUT
========================================================== */

const updatePayout = async ({
  payout,
  fields,
}) => {
  const mutation = `
    mutation UpdatePayout(
      $input: UpdatePayoutInput!
    ) {
      updatePayout(
        input: $input
      ) {
        id

        courierID
        walletID

        amount

        status

        bankName
        accountNumber

        reference

        transferCode
        transferID

        failureReason

        payoutMethod

        processedAt
        paidAt
        failedAt

        _version
      }
    }
  `;

  const input = {
    id:
      payout.id,

    ...fields,
  };

  if (
    Number.isInteger(
      payout._version
    )
  ) {
    input._version =
      payout._version;
  }

  const data =
    await graphqlRequest(
      mutation,
      {
        input,
      },
      "UpdatePayout"
    );

  return (
    data?.updatePayout ||
    null
  );
};

/* ==========================================================
   GET TRANSACTION BY REFERENCE
========================================================== */

const getTransactionByReference =
  async (
    reference
  ) => {
    const query = `
      query ListTransactions(
        $filter: ModelTransactionFilterInput
      ) {
        listTransactions(
          filter: $filter
          limit: 1
        ) {
          items {
            id

            walletID

            type
            amount

            description

            orderID
            paymentID

            reference

            status

            _version
          }
        }
      }
    `;

    const data =
      await graphqlRequest(
        query,
        {
          filter: {
            reference: {
              eq:
                reference,
            },
          },
        },
        "GetTransactionByReference"
      );

    return (
      data?.listTransactions?.items?.[0] ||
      null
    );
  };

/* ==========================================================
   UPDATE TRANSACTION
========================================================== */

const updateTransaction = async ({
  transaction,
  fields,
}) => {
  const mutation = `
    mutation UpdateTransaction(
      $input: UpdateTransactionInput!
    ) {
      updateTransaction(
        input: $input
      ) {
        id

        walletID

        type
        amount

        description

        orderID
        paymentID

        reference

        status

        _version
      }
    }
  `;

  const input = {
    id:
      transaction.id,

    ...fields,
  };

  if (
    Number.isInteger(
      transaction._version
    )
  ) {
    input._version =
      transaction._version;
  }

  const data =
    await graphqlRequest(
      mutation,
      {
        input,
      },
      "UpdateTransaction"
    );

  return (
    data?.updateTransaction ||
    null
  );
};

/* ==========================================================
   GET COURIER WALLET
========================================================== */

const getCourierWallet =
  async (
    courierID
  ) => {
    const query = `
      query ListWallets(
        $filter: ModelWalletFilterInput
      ) {
        listWallets(
          filter: $filter
          limit: 1
        ) {
          items {
            id

            ownerID
            ownerType

            availableBalance
            pendingBalance
            lifetimeEarnings

            _version
          }
        }
      }
    `;

    const data =
      await graphqlRequest(
        query,
        {
          filter: {
            ownerID: {
              eq:
                courierID,
            },

            ownerType: {
              eq:
                "COURIER",
            },
          },
        },
        "GetCourierWallet"
      );

    return (
      data?.listWallets?.items?.[0] ||
      null
    );
  };

/* ==========================================================
   UPDATE WALLET AVAILABLE BALANCE
========================================================== */

const updateWalletAvailableBalance =
  async ({
    wallet,
    availableBalance,
  }) => {
    const mutation = `
      mutation UpdateWallet(
        $input: UpdateWalletInput!
      ) {
        updateWallet(
          input: $input
        ) {
          id

          availableBalance
          pendingBalance
          lifetimeEarnings

          _version
        }
      }
    `;

    const input = {
      id:
        wallet.id,

      availableBalance:
        Number(
          availableBalance.toFixed(2)
        ),
    };

    if (
      Number.isInteger(
        wallet._version
      )
    ) {
      input._version =
        wallet._version;
    }

    const data =
      await graphqlRequest(
        mutation,
        {
          input,
        },
        "UpdateWalletAvailableBalance"
      );

    return (
      data?.updateWallet ||
      null
    );
  };

/* ==========================================================
   GET RAW WEBHOOK BODY
========================================================== */

const getRawBody = (
  event
) => {
  if (
    event?.isBase64Encoded &&
    event?.body
  ) {
    return Buffer.from(
      event.body,
      "base64"
    );
  }

  return Buffer.from(
    event?.body || "",
    "utf8"
  );
};

/* ==========================================================
   GET HEADER
========================================================== */

const getHeader = (
  event,
  headerName
) => {
  const headers =
    event?.headers ||
    {};

  const target =
    headerName.toLowerCase();

  for (
    const key of Object.keys(
      headers
    )
  ) {
    if (
      key.toLowerCase() ===
      target
    ) {
      return headers[key];
    }
  }

  return null;
};

/* ==========================================================
   VERIFY PAYSTACK SIGNATURE
========================================================== */

const verifyPaystackSignature =
  ({
    rawBody,
    signature,
    secretKey,
  }) => {
    if (!signature) {
      return false;
    }

    const expectedHash =
      crypto
        .createHmac(
          "sha512",
          secretKey
        )
        .update(rawBody)
        .digest("hex");

    const expected =
      Buffer.from(
        expectedHash,
        "utf8"
      );

    const received =
      Buffer.from(
        String(signature),
        "utf8"
      );

    if (
      expected.length !==
      received.length
    ) {
      return false;
    }

    return crypto.timingSafeEqual(
      expected,
      received
    );
  };

/* ==========================================================
   EXTRACT ORDER ID
========================================================== */

const extractOrderId = (
  transaction
) => {
  const directOrderId =
    transaction?.metadata?.order_id ||
    transaction?.metadata?.orderId;

  if (
    directOrderId
  ) {
    return directOrderId;
  }

  const customFields =
    transaction?.metadata?.custom_fields;

  if (
    Array.isArray(
      customFields
    )
  ) {
    const field =
      customFields.find(
        (item) =>
          item?.variable_name ===
          "order_id"
      );

    if (
      field?.value
    ) {
      return field.value;
    }
  }

  return null;
};

/* ==========================================================
   SUCCESS RESPONSE
========================================================== */

const successResponse = (
  message,
  extra = {}
) => {
  return {
    statusCode:
      200,

    headers: {
      "Content-Type":
        "application/json",
    },

    body:
      JSON.stringify({
        success:
          true,

        message,

        ...extra,
      }),
  };
};

/* ==========================================================
   CUSTOMER PAYMENT HANDLER
========================================================== */

const handleCustomerPayment =
  async ({
    payload,
    secretKey,
  }) => {
    const transaction =
      payload?.data;

    if (!transaction) {
      throw new Error(
        "Paystack customer transaction data is missing."
      );
    }

    const reference =
      transaction.reference;

    if (!reference) {
      throw new Error(
        "Paystack payment reference is missing."
      );
    }

    const orderId =
      extractOrderId(
        transaction
      );

    if (!orderId) {
      throw new Error(
        "Order ID could not be found in Paystack metadata."
      );
    }

    let order =
      await getOrder(
        orderId
      );

    if (!order) {
      throw new Error(
        `Order ${orderId} could not be found.`
      );
    }

    const verification =
      await verifyCustomerTransaction(
        reference,
        secretKey
      );

    const paystack =
      verification?.body;

    if (
      !verification ||
      verification.statusCode < 200 ||
      verification.statusCode >= 300 ||
      !paystack?.status
    ) {
      throw new Error(
        paystack?.message ||
        "Paystack transaction verification failed."
      );
    }

    const verifiedTransaction =
      paystack?.data;

    if (!verifiedTransaction) {
      throw new Error(
        "Paystack returned no transaction data."
      );
    }

    if (
      verifiedTransaction.status !==
      "success"
    ) {
      throw new Error(
        `Payment is not successful. Paystack status: ${verifiedTransaction.status}`
      );
    }

    if (
      verifiedTransaction.reference !==
      reference
    ) {
      throw new Error(
        "Paystack payment reference mismatch."
      );
    }

    if (
      verifiedTransaction.currency !==
      "NGN"
    ) {
      throw new Error(
        `Unexpected payment currency: ${verifiedTransaction.currency}`
      );
    }

    const orderAmount =
      Number(
        order.totalPrice
      );

    if (
      !Number.isFinite(
        orderAmount
      ) ||
      orderAmount <= 0
    ) {
      throw new Error(
        "Order has an invalid totalPrice."
      );
    }

    const expectedAmountInKobo =
      Math.round(
        orderAmount * 100
      );

    const paidAmountInKobo =
      Number(
        verifiedTransaction.amount
      );

    if (
      !Number.isFinite(
        paidAmountInKobo
      ) ||
      paidAmountInKobo !==
        expectedAmountInKobo
    ) {
      throw new Error(
        "The amount paid does not match the order amount."
      );
    }

    let payment =
      await getPaymentByReference(
        reference
      );

    if (
      payment &&
      payment.orderID !==
        order.id
    ) {
      throw new Error(
        "This payment reference is already associated with another order."
      );
    }

    if (!payment) {
      payment =
        await createPayment({
          order,

          transaction:
            verifiedTransaction,
        });

      if (!payment?.id) {
        payment =
          await getPaymentByReference(
            reference
          );
      }

      if (!payment?.id) {
        throw new Error(
          "Payment record could not be created."
        );
      }
    }

    order =
      await getOrder(
        order.id
      );

    if (!order) {
      throw new Error(
        "Order could not be reloaded."
      );
    }

    if (
      order.paymentStatus ===
      "PAID"
    ) {
      return successResponse(
        "Payment already processed.",
        {
          orderId:
            order.id,

          paymentId:
            payment.id,

          reference,

          paymentStatus:
            order.paymentStatus,

          fundsStatus:
            order.fundsStatus,

          alreadyProcessed:
            true,
        }
      );
    }

    const updatedOrder =
      await markOrderAsPaid({
        order,

        paymentId:
          payment.id,
      });

    if (!updatedOrder) {
      throw new Error(
        "Order could not be updated after payment."
      );
    }

    const confirmedOrder =
      await getOrder(
        order.id
      );

    if (!confirmedOrder) {
      throw new Error(
        "Could not reload order after payment update."
      );
    }

    if (
      confirmedOrder.paymentStatus !==
      "PAID"
    ) {
      throw new Error(
        `Order paymentStatus was not updated to PAID. Current value: ${confirmedOrder.paymentStatus}`
      );
    }

    if (
      confirmedOrder.paymentID !==
      payment.id
    ) {
      throw new Error(
        "Payment was not correctly linked to the order."
      );
    }

    if (
      confirmedOrder.fundsStatus !==
      "HELD"
    ) {
      throw new Error(
        `Order fundsStatus was not set to HELD. Current value: ${confirmedOrder.fundsStatus}`
      );
    }

    if (
      confirmedOrder.status !==
      "READY_FOR_PICKUP"
    ) {
      throw new Error(
        `Order status was not set to READY_FOR_PICKUP. Current value: ${confirmedOrder.status}`
      );
    }

    return successResponse(
      "Customer payment successfully verified and recorded.",
      {
        orderId:
          confirmedOrder.id,

        paymentId:
          payment.id,

        reference,

        amount:
          orderAmount,

        currency:
          verifiedTransaction.currency,

        paymentStatus:
          confirmedOrder.paymentStatus,

        fundsStatus:
          confirmedOrder.fundsStatus,

        status:
          confirmedOrder.status,
      }
    );
  };

/* ==========================================================
   TRANSFER PAYLOAD FAILURE REASON
========================================================== */

const getTransferFailureReason =
  (transfer) => {
    if (
      transfer?.failures
    ) {
      try {
        return JSON.stringify(
          transfer.failures
        );
      } catch {
        return String(
          transfer.failures
        );
      }
    }

    if (
      transfer?.reason
    ) {
      return String(
        transfer.reason
      );
    }

    if (
      transfer?.message
    ) {
      return String(
        transfer.message
      );
    }

    return "Paystack transfer failed.";
  };

/* ==========================================================
   HANDLE TRANSFER SUCCESS
========================================================== */

const handleTransferSuccess =
  async ({
    transfer,
  }) => {
    const reference =
      transfer?.reference;

    if (!reference) {
      throw new Error(
        "Transfer success event has no reference."
      );
    }

    const payout =
      await getPayoutByReference(
        reference
      );

    if (!payout) {
      throw new Error(
        `Payout not found for transfer reference ${reference}.`
      );
    }

    if (
      payout.status ===
      "PAID"
    ) {
      return successResponse(
        "Payout was already marked PAID.",
        {
          payoutID:
            payout.id,

          reference,

          alreadyProcessed:
            true,
        }
      );
    }

    if (
      payout.status ===
      "FAILED"
    ) {
      return successResponse(
        "Payout was already marked FAILED; success event ignored.",
        {
          payoutID:
            payout.id,

          reference,

          alreadyProcessed:
            true,
        }
      );
    }

    const paidPayout =
      await updatePayout({
        payout,

        fields: {
          status:
            "PAID",

          transferCode:
            transfer?.transfer_code ||
            payout.transferCode ||
            null,

          transferID:
            transfer?.id != null
              ? String(
                  transfer.id
                )
              : payout.transferID ||
                null,

          paidAt:
            new Date().toISOString(),

          failureReason:
            null,
        },
      });

    if (!paidPayout) {
      throw new Error(
        `Could not mark payout ${payout.id} as PAID.`
      );
    }

    const transaction =
      await getTransactionByReference(
        reference
      );

    if (
      transaction &&
      transaction.status !==
        "COMPLETED"
    ) {
      await updateTransaction({
        transaction,

        fields: {
          status:
            "COMPLETED",

          description:
            "Courier payout completed by Paystack.",
        },
      });
    }

    return successResponse(
      "Courier payout marked PAID.",
      {
        payoutID:
          payout.id,

        courierID:
          payout.courierID,

        amount:
          payout.amount,

        reference,

        payoutStatus:
          "PAID",
      }
    );
  };

/* ==========================================================
   HANDLE TRANSFER FAILURE / REVERSAL
========================================================== */

const handleTransferFailure =
  async ({
    transfer,
    eventType,
  }) => {
    const reference =
      transfer?.reference;

    if (!reference) {
      throw new Error(
        `${eventType} event has no transfer reference.`
      );
    }

    const payout =
      await getPayoutByReference(
        reference
      );

    if (!payout) {
      throw new Error(
        `Payout not found for transfer reference ${reference}.`
      );
    }

    if (
      payout.status ===
      "FAILED"
    ) {
      return successResponse(
        "Payout was already marked FAILED.",
        {
          payoutID:
            payout.id,

          reference,

          alreadyProcessed:
            true,
        }
      );
    }

    if (
      payout.status ===
      "PAID"
    ) {
      return successResponse(
        "Payout is already PAID; failure event ignored.",
        {
          payoutID:
            payout.id,

          reference,

          alreadyProcessed:
            true,
        }
      );
    }

    const wallet =
      await getCourierWallet(
        payout.courierID
      );

    if (!wallet) {
      throw new Error(
        `Wallet not found for courier ${payout.courierID}.`
      );
    }

    const transaction =
      await getTransactionByReference(
        reference
      );

    const currentAvailable =
      Number(
        wallet.availableBalance ||
        0
      );

    const payoutAmount =
      Number(
        payout.amount ||
        0
      );

    if (
      !Number.isFinite(
        payoutAmount
      ) ||
      payoutAmount <= 0
    ) {
      throw new Error(
        `Invalid payout amount for payout ${payout.id}.`
      );
    }

    /*
     * Only restore the wallet while the payout is still
     * PROCESSING/PENDING.
     *
     * A duplicate webhook after FAILED will stop above and
     * will therefore not restore the balance twice.
     */

    const restoredBalance =
      Number(
        (
          currentAvailable +
          payoutAmount
        ).toFixed(2)
      );

    const restoredWallet =
      await updateWalletAvailableBalance({
        wallet,

        availableBalance:
          restoredBalance,
      });

    if (!restoredWallet) {
      throw new Error(
        `Could not restore available balance for courier ${payout.courierID}.`
      );
    }

    if (
      transaction &&
      transaction.status !==
        "FAILED"
    ) {
      await updateTransaction({
        transaction,

        fields: {
          status:
            "FAILED",

          description:
            eventType ===
            "transfer.reversed"
              ? "Courier payout reversed by Paystack; balance restored."
              : "Courier payout failed; balance restored.",
        },
      });
    }

    const failedPayout =
      await updatePayout({
        payout,

        fields: {
          status:
            "FAILED",

          failureReason:
            getTransferFailureReason(
              transfer
            ),

          failedAt:
            new Date().toISOString(),

          transferCode:
            transfer?.transfer_code ||
            payout.transferCode ||
            null,

          transferID:
            transfer?.id != null
              ? String(
                  transfer.id
                )
              : payout.transferID ||
                null,
        },
      });

    if (!failedPayout) {
      throw new Error(
        `Payout ${payout.id} could not be marked FAILED.`
      );
    }

    return successResponse(
      eventType ===
        "transfer.reversed"
        ? "Courier payout was reversed and balance restored."
        : "Courier payout failed and balance was restored.",
      {
        payoutID:
          payout.id,

        courierID:
          payout.courierID,

        amount:
          payoutAmount,

        reference,

        event:
          eventType,

        payoutStatus:
          "FAILED",

        restoredAvailableBalance:
          restoredBalance,
      }
    );
  };

/* ==========================================================
   HANDLE TRANSFER EVENT
========================================================== */

const handleTransferEvent =
  async ({
    eventType,
    payload,
  }) => {
    const transfer =
      payload?.data;

    if (!transfer) {
      throw new Error(
        `${eventType} event contains no transfer data.`
      );
    }

    console.log(
      "PAYSTACK TRANSFER EVENT:",
      {
        event:
          eventType,

        reference:
          transfer.reference,

        transferID:
          transfer.id,

        transferCode:
          transfer.transfer_code,

        amount:
          transfer.amount,

        status:
          transfer.status,
      }
    );

    switch (
      eventType
    ) {
      case "transfer.success":
        return handleTransferSuccess({
          transfer,
        });

      case "transfer.failed":
        return handleTransferFailure({
          transfer,
          eventType,
        });

      case "transfer.reversed":
        return handleTransferFailure({
          transfer,
          eventType,
        });

      default:
        return successResponse(
          "Transfer event received and ignored.",
          {
            event:
              eventType,
          }
        );
    }
  };

/* ==========================================================
   MAIN HANDLER
========================================================== */

exports.handler = async (
  event
) => {
  console.log(
    "=========================================="
  );

  console.log(
    "ATUA PAYSTACK WEBHOOK STARTED"
  );

  console.log(
    "=========================================="
  );

  try {
    /* ======================================================
       1. GET PAYSTACK SECRET
    ====================================================== */

    const secretKey =
      await getPaystackSecretKey();

    /* ======================================================
       2. GET RAW BODY
    ====================================================== */

    const rawBody =
      getRawBody(
        event
      );

    if (
      !rawBody ||
      rawBody.length === 0
    ) {
      return {
        statusCode:
          400,

        body:
          JSON.stringify({
            success:
              false,

            message:
              "Webhook body is empty.",
          }),
      };
    }

    /* ======================================================
       3. VERIFY PAYSTACK SIGNATURE
    ====================================================== */

    const signature =
      getHeader(
        event,
        "x-paystack-signature"
      );

    const signatureValid =
      verifyPaystackSignature({
        rawBody,

        signature,

        secretKey,
      });

    if (!signatureValid) {
      console.error(
        "INVALID PAYSTACK WEBHOOK SIGNATURE"
      );

      return {
        statusCode:
          401,

        body:
          JSON.stringify({
            success:
              false,

            message:
              "Invalid webhook signature.",
          }),
      };
    }

    console.log(
      "PAYSTACK SIGNATURE VERIFIED"
    );

    /* ======================================================
       4. PARSE PAYLOAD
    ====================================================== */

    let payload;

    try {
      payload =
        JSON.parse(
          rawBody.toString(
            "utf8"
          )
        );
    } catch (error) {
      console.error(
        "INVALID WEBHOOK JSON:",
        error
      );

      return {
        statusCode:
          400,

        body:
          JSON.stringify({
            success:
              false,

            message:
              "Invalid webhook JSON.",
          }),
      };
    }

    /* ======================================================
       5. DETERMINE EVENT
    ====================================================== */

    const eventType =
      payload?.event;

    console.log(
      "PAYSTACK EVENT:",
      eventType
    );

    /* ======================================================
       6. CUSTOMER PAYMENT EVENTS
    ====================================================== */

    if (
      eventType ===
      "charge.success"
    ) {
      return await handleCustomerPayment({
        payload,

        secretKey,
      });
    }

    /* ======================================================
       7. COURIER TRANSFER EVENTS
    ====================================================== */

    if (
      eventType ===
        "transfer.success" ||
      eventType ===
        "transfer.failed" ||
      eventType ===
        "transfer.reversed"
    ) {
      return await handleTransferEvent({
        eventType,

        payload,
      });
    }

    /* ======================================================
       8. OTHER EVENTS
    ====================================================== */

    console.log(
      "IGNORING UNSUPPORTED PAYSTACK EVENT:",
      eventType
    );

    return successResponse(
      "Event received and ignored.",
      {
        event:
          eventType ||
          null,
      }
    );

  } catch (error) {
    console.error(
      "=========================================="
    );

    console.error(
      "ATUA PAYSTACK WEBHOOK ERROR"
    );

    console.error(
      "MESSAGE:",
      error?.message
    );

    console.error(
      "STACK:",
      error?.stack
    );

    console.error(
      "=========================================="
    );

    return {
      statusCode:
        500,

      headers: {
        "Content-Type":
          "application/json",
      },

      body:
        JSON.stringify({
          success:
            false,

          message:
            "Paystack webhook processing failed.",
        }),
    };
  }
};