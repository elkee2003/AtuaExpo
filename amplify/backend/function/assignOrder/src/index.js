"use strict";

/**
 * ATUA — ASSIGN ORDER
 *
 * AUTOMATIC ASSIGNMENT TEMPORARILY DISABLED.
 *
 * Manual courier order listing will be used instead.
 */

exports.handler = async (event, context) => {
  const invocationId = context?.awsRequestId || null;

  console.log("AUTOMATIC_ASSIGNMENT_DISABLED", {
    invocationId,
    recordCount: Array.isArray(event?.Records) ? event.Records.length : 0,
  });

  // The DynamoDB Stream event is intentionally acknowledged
  // without assigning the order to any courier.
  return {
    ok: true,
    disabled: true,
    message: "Automatic courier assignment is temporarily disabled.",
    invocationId,
  };
};

/*
|--------------------------------------------------------------------------
| ORIGINAL ASSIGNORDER CODE
|--------------------------------------------------------------------------
|
| Keep your complete existing assignOrder code below.
| Do not delete it.
|
|--------------------------------------------------------------------------
*/

// Delete from here to the top when you have come back to this to fix it.

// // ============================================================
// // ATUA — ASSIGN ORDER LAMBDA
// // ============================================================
// //
// // PURPOSE
// // ============================================================
// //
// // This Lambda performs the INITIAL automatic courier assignment
// // after an Order has successfully been paid.
// //
// // The Order table has a DynamoDB Stream trigger connected to this
// // Lambda.
// //
// // Therefore this Lambda must understand TWO things:
// //
// //     1. DynamoDB Stream events
// //     2. Direct Lambda/test events
// //
// // IMPORTANT:
// //
// // The DynamoDB Stream is NOT an SQS trigger.
// //
// // A DynamoDB Stream event looks approximately like:
// //
// //     {
// //       Records: [
// //         {
// //           eventName: "MODIFY",
// //           dynamodb: {
// //             NewImage: {
// //               id: { S: "..." },
// //               paymentStatus: { S: "PAID" }
// //             },
// //             OldImage: {
// //               paymentStatus: { S: "PENDING" }
// //             }
// //           }
// //         }
// //       ]
// //     }
// //
// // We therefore extract the Order from NewImage.
// //
// // ============================================================
// //
// // SUPPORTED INITIAL ASSIGNMENTS:
// //
// //     MICRO_EXPRESS -> MICRO courier
// //     MICRO_BATCH   -> MICRO courier
// //     MOTO_EXPRESS  -> MOTO courier
// //     MOTO_BATCH    -> MOTO courier
// //
// // Maxi is deliberately NOT assigned by this Lambda because Maxi
// // requires vehicleClass matching.
// //
// // ============================================================
// //
// // ASSIGNMENT FLOW:
// //
// //     User places Order
// //           ↓
// //     Payment succeeds
// //           ↓
// //     Paystack webhook updates Order
// //           ↓
// //     paymentStatus changes to PAID
// //           ↓
// //     DynamoDB Stream fires
// //           ↓
// //     assignOrder-staging
// //           ↓
// //     Find eligible courier
// //           ↓
// //     Reserve courier capacity
// //           ↓
// //     AppSync updateOrder
// //           ↓
// //     Strong DynamoDB verification
// //           ↓
// //     SQS expiry message
// //           ↓
// //     reassignOrder
// //
// // ============================================================
// //
// // CRITICAL LOOP PROTECTION
// // ============================================================
// //
// // assignOrder itself updates the Order.
// //
// // That update creates another DynamoDB Stream record.
// //
// // We MUST NOT interpret every Order modification as a new
// // assignment request.
// //
// // The initial assignment trigger is therefore:
// //
// //     paymentStatus changes TO PAID
// //
// // NOT:
// //
// //     any Order modification
// //
// // This prevents:
// //
// //     assignOrder
// //          ↓
// //     Order update
// //          ↓
// //     DynamoDB Stream
// //          ↓
// //     assignOrder
// //          ↓
// //     Order update
// //          ↓
// //     infinite loop
// //
// // ============================================================

// "use strict";

// // ============================================================
// // HTTPS
// // ============================================================
// //
// // AppSync is called over HTTPS using the same general approach
// // used by the working payment Lambdas.
// //

// const https = require("https");

// // ============================================================
// // AWS SDK
// // ============================================================

// const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

// const {
//   DynamoDBDocumentClient,
//   GetCommand,
//   ScanCommand,
//   TransactWriteCommand,
// } = require("@aws-sdk/lib-dynamodb");

// const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");

// // ============================================================
// // AWS CLIENTS
// // ============================================================

// const dynamoClient = new DynamoDBClient({});

// const docClient = DynamoDBDocumentClient.from(dynamoClient);

// const sqsClient = new SQSClient({});

// // ============================================================
// // TABLE NAMES
// // ============================================================

// const COURIER_TABLE =
//   process.env.COURIER_TABLE || "Courier-n4tb6ywvhnf3zesv5ibhpitqiq-staging";

// const ORDER_TABLE =
//   process.env.ORDER_TABLE || "Order-n4tb6ywvhnf3zesv5ibhpitqiq-staging";

// // ============================================================
// // SQS
// // ============================================================
// //
// // This queue is NOT the trigger for assignOrder.
// //
// // It is the queue that assignOrder sends expiry messages INTO.
// //
// // reassignOrder consumes those messages.
// //

// const ASSIGNMENT_EXPIRY_QUEUE_URL =
//   process.env.ASSIGNMENT_EXPIRY_QUEUE_URL || "";

// // ============================================================
// // APPSYNC
// // ============================================================

// const GRAPHQL_ENDPOINT = process.env.API_ATUA_GRAPHQLAPIENDPOINTOUTPUT || "";

// const GRAPHQL_API_KEY = process.env.API_ATUA_GRAPHQLAPIKEYOUTPUT || "";

// // ============================================================
// // ASSIGNMENT SETTINGS
// // ============================================================

// // Courier has 25 seconds to accept/reject the offer.
// const ASSIGNMENT_TIMEOUT_MS = 25 * 1000;

// // Initial automatic assignment radius.
// const INITIAL_RADIUS_KM = 5;

// // ============================================================
// // COURIER CAPACITY LIMITS
// // ============================================================
// //
// // EXPRESS:
// //
// //     One Express Order at a time.
// //
// // BATCH:
// //
// //     Up to 10 Batch Orders.
// //
// // Express and Batch assignments are mutually exclusive.
// //

// const MAX_EXPRESS_JOBS = 1;

// const MAX_BATCH_JOBS = 10;

// // ============================================================
// // ORDER TYPE CONFIGURATION
// // ============================================================
// //
// // transportationType determines which courier category receives
// // the Order.
// //
// // Examples:
// //
// //     micro_express -> MICRO
// //     micro_batch   -> MICRO
// //     moto_express  -> MOTO
// //     moto_batch    -> MOTO
// //
// // vehicleClass is NOT used for Micro/Moto.
// //
// // Maxi is handled separately.
// //

// const ORDER_TYPE_CONFIG = {
//   MICRO_EXPRESS: {
//     courierCategory: "MICRO",
//     capacityType: "EXPRESS",
//   },

//   MICRO_BATCH: {
//     courierCategory: "MICRO",
//     capacityType: "BATCH",
//   },

//   MOTO_EXPRESS: {
//     courierCategory: "MOTO",
//     capacityType: "EXPRESS",
//   },

//   MOTO_BATCH: {
//     courierCategory: "MOTO",
//     capacityType: "BATCH",
//   },
// };

// // ============================================================
// // GRAPHQL REQUEST
// // ============================================================
// //
// // This follows the same HTTPS/AppSync approach used by the
// // working payment Lambdas.
// //
// // ============================================================

// async function graphqlRequest(
//   query,
//   variables = {},
//   operationName = "GraphQL operation",
// ) {
//   if (!GRAPHQL_ENDPOINT) {
//     throw new Error("ATUA_GRAPHQL_ENDPOINT_NOT_CONFIGURED");
//   }

//   if (!GRAPHQL_API_KEY) {
//     throw new Error("ATUA_GRAPHQL_API_KEY_NOT_CONFIGURED");
//   }

//   const endpoint = new URL(GRAPHQL_ENDPOINT);

//   const body = JSON.stringify({
//     query,
//     variables,
//   });

//   const options = {
//     hostname: endpoint.hostname,

//     path: `${endpoint.pathname || "/graphql"}` + `${endpoint.search || ""}`,

//     method: "POST",

//     headers: {
//       "Content-Type": "application/json",
//       "Content-Length": Buffer.byteLength(body),
//       "x-api-key": GRAPHQL_API_KEY,
//     },
//   };

//   return new Promise((resolve, reject) => {
//     const request = https.request(options, (response) => {
//       let data = "";

//       response.on("data", (chunk) => {
//         data += chunk;
//       });

//       response.on("end", () => {
//         if (response.statusCode < 200 || response.statusCode >= 300) {
//           console.error("APPSYNC_HTTP_ERROR", {
//             operationName,
//             statusCode: response.statusCode,
//             body: data,
//           });

//           return reject(
//             new Error(`${operationName} returned HTTP ${response.statusCode}.`),
//           );
//         }

//         let parsed;

//         try {
//           parsed = JSON.parse(data);
//         } catch (error) {
//           console.error("APPSYNC_JSON_PARSE_ERROR", {
//             operationName,
//             errorName: error.name,
//             errorMessage: error.message,
//             body: data,
//           });

//           return reject(error);
//         }

//         if (Array.isArray(parsed?.errors) && parsed.errors.length > 0) {
//           console.error("APPSYNC_GRAPHQL_ERRORS", {
//             operationName,
//             errors: parsed.errors,
//           });

//           return reject(
//             new Error(
//               parsed.errors
//                 .map((item) => item?.message)
//                 .filter(Boolean)
//                 .join(" | ") || `${operationName} failed.`,
//             ),
//           );
//         }

//         resolve(parsed?.data || null);
//       });
//     });

//     request.on("error", (error) => {
//       console.error("APPSYNC_REQUEST_ERROR", {
//         operationName,
//         errorName: error.name,
//         errorMessage: error.message,
//         stack: error.stack,
//       });

//       reject(error);
//     });

//     request.write(body);

//     request.end();
//   });
// }

// // ============================================================
// // COMPLETE ORDER FIELD SELECTION
// // ============================================================
// //
// // These fields are requested from AppSync.
// //
// // IMPORTANT:
// //
// // We request many fields so that we can see the complete Order,
// // but we DO NOT send the complete Order back during assignment.
// //
// // Only assignment fields are sent to updateOrder.
// //
// // ============================================================

// const ORDER_FIELDS = `
//   id

//   recipientName
//   recipientNumber
//   recipientNumber2
//   orderDetails

//   originAddress
//   originState
//   originLat
//   originLng

//   destinationAddress
//   destinationState
//   destinationLat
//   destinationLng

//   tripType
//   distance

//   transportationType
//   vehicleClass
//   status

//   hasNewOffer
//   lastOfferAt
//   lastOfferSenderType

//   loadCategory
//   isInterState

//   estimatedMinPrice
//   estimatedMaxPrice

//   initialOfferPrice

//   loadingFee
//   unloadingFee
//   floorSurcharge
//   fragileSurcharge
//   extrasTotal

//   totalPrice
//   operationalFare
//   courierEarnings
//   commissionAmount
//   platformFee
//   platformServiceRevenue
//   vatAmount
//   platformNetRevenue

//   deliveryVerificationCode

//   declaredWeightBracket

//   senderPreTransferPhotos
//   senderPreTransferVideo
//   senderPreTransferRecordedAt

//   senderPreTransferLocalPhotos
//   senderPreTransferLocalVideo

//   mediaUploadStatus

//   courierPreTransferUploadStatus
//   courierPostLoadingUploadStatus
//   dropoffUploadStatus

//   courierPreTransferPhotos
//   courierPreTransferVideo
//   courierPreTransferRecordedAt

//   courierPreTransferLocalPhotos
//   courierPreTransferLocalVideo

//   courierPostLoadingPhotos
//   courierPostLoadingVideo

//   courierPostLoadingLocalPhotos
//   courierPostLoadingLocalVideo

//   dropoffArrivalPhotos
//   dropoffArrivalVideo

//   dropoffArrivalLocalPhotos
//   dropoffArrivalLocalVideo

//   postDeliveryPhotos
//   postDeliveryVideo

//   pickupLoadingResponsibility
//   pickupFloorLevel
//   pickupFloorLevelPrice
//   pickupHasElevator

//   dropoffUnloadingResponsibility
//   dropoffFloorLevel
//   dropoffFloorLevelPrice
//   dropoffHasElevator

//   acceptedAt
//   arrivedPickupAt
//   loadingStartedAt
//   tripStartedAt
//   arrivedDropoffAt
//   unloadingCompletedAt

//   logisticsCompanyId
//   waybillNumber
//   waybillPhoto
//   logisticsTrackingCode
//   logisticsTrackingStatus
//   handedOverToLogisticsAt
//   logisticsIntakeConfirmedAt

//   acceptedOfferID

//   paymentStatus
//   paymentID
//   paymentReference

//   payoutStatus
//   fundsStatus

//   earningsAllocationStatus
//   earningsAllocatedAt

//   fundsReleaseBlocked
//   fundsHoldReason
//   fundsHeldBy
//   fundsHeldAt
//   fundsReleasedAmount
//   pickupFundsReleasedAt
//   fundsReleasedAt
//   fundsReleaseType

//   assignedCourierId
//   assignmentExpiresAt
//   assignmentAttempts
//   lastAssignedAt
//   rejectedCourierIds
//   assignmentStatus

//   userID

//   createdAt
//   updatedAt

//   _version
//   _lastChangedAt
//   _deleted
// `;

// // ============================================================
// // GET ORDER THROUGH APPSYNC
// // ============================================================
// //
// // We intentionally fetch the current Order from AppSync.
// //
// // This gives us:
// //
// //     - current Order data
// //     - current _version
// //     - current assignment state
// //     - current payment state
// //
// // This is safer than relying entirely on the older DynamoDB
// // Stream image.
// //

// async function getOrder(orderId) {
//   if (!orderId) {
//     throw new Error("ORDER_ID_REQUIRED");
//   }

//   const query = `
//     query GetOrder(
//       $id: ID!
//     ) {
//       getOrder(
//         id: $id
//       ) {
//         ${ORDER_FIELDS}
//       }
//     }
//   `;

//   const data = await graphqlRequest(
//     query,
//     {
//       id: orderId,
//     },
//     "GetOrder",
//   );

//   return data?.getOrder || null;
// }

// // ============================================================
// // GET ORDER DIRECTLY FROM DYNAMODB
// // ============================================================
// //
// // This function is used for strong verification.
// //
// // IMPORTANT:
// //
// // This does NOT replace AppSync for assignment writes.
// //
// // AppSync performs the Order update.
// //
// // DynamoDB is used afterward to verify that the assignment really
// // reached the underlying Order record.
// //

// async function getOrderFromDynamoDB(orderId) {
//   if (!orderId) {
//     throw new Error("ORDER_ID_REQUIRED");
//   }

//   const result = await docClient.send(
//     new GetCommand({
//       TableName: ORDER_TABLE,

//       Key: {
//         id: orderId,
//       },

//       ConsistentRead: true,
//     }),
//   );

//   return result?.Item || null;
// }

// // ============================================================
// // NORMALIZE TRANSPORTATION TYPE
// // ============================================================

// function normalizeTransportationType(value) {
//   if (value === null || value === undefined) {
//     return "";
//   }

//   return String(value).trim().toUpperCase();
// }

// // ============================================================
// // GET ORDER TYPE CONFIGURATION
// // ============================================================

// function getOrderTypeConfig(order) {
//   const transportationType = normalizeTransportationType(
//     order?.transportationType,
//   );

//   return {
//     transportationType,

//     config: ORDER_TYPE_CONFIG[transportationType] || null,
//   };
// }

// // ============================================================
// // COURIER CATEGORY NORMALIZATION
// // ============================================================

// function getCourierCategory(courier) {
//   return normalizeTransportationType(courier?.transportationType);
// }

// // ============================================================
// // COURIER ONLINE CHECK
// // ============================================================

// function isCourierOnline(courier) {
//   return courier?.isOnline === true;
// }

// // ============================================================
// // COURIER APPROVAL CHECK
// // ============================================================

// function isCourierApproved(courier) {
//   return courier?.isApproved === true;
// }

// // ============================================================
// // COURIER STATUS CHECK
// // ============================================================
// //
// // We deliberately keep this flexible because your Courier schema
// // may contain statusKey values that are represented differently
// // between records.
// //
// // The hard requirements remain:
// //
// //     isOnline === true
// //     isApproved === true
// //
// // ============================================================

// function isCourierAvailable(courier) {
//   if (!courier) {
//     return false;
//   }

//   if (!isCourierOnline(courier)) {
//     return false;
//   }

//   if (!isCourierApproved(courier)) {
//     return false;
//   }

//   return true;
// }

// // ============================================================
// // CURRENT EXPRESS COUNT
// // ============================================================

// function getCurrentExpressCount(courier) {
//   const value = Number(courier?.currentExpressCount);

//   if (!Number.isFinite(value) || value < 0) {
//     return 0;
//   }

//   return Math.floor(value);
// }

// // ============================================================
// // CURRENT BATCH COUNT
// // ============================================================

// function getCurrentBatchCount(courier) {
//   const value = Number(courier?.currentBatchCount);

//   if (!Number.isFinite(value) || value < 0) {
//     return 0;
//   }

//   return Math.floor(value);
// }

// // ============================================================
// // HAVERSINE DISTANCE
// // ============================================================
// //
// // Returns distance between two latitude/longitude points in KM.
// //

// function haversineDistanceKm(lat1, lng1, lat2, lng2) {
//   const latitude1 = Number(lat1);
//   const longitude1 = Number(lng1);
//   const latitude2 = Number(lat2);
//   const longitude2 = Number(lng2);

//   if (
//     !Number.isFinite(latitude1) ||
//     !Number.isFinite(longitude1) ||
//     !Number.isFinite(latitude2) ||
//     !Number.isFinite(longitude2)
//   ) {
//     return NaN;
//   }

//   const earthRadiusKm = 6371;

//   const dLat = ((latitude2 - latitude1) * Math.PI) / 180;

//   const dLng = ((longitude2 - longitude1) * Math.PI) / 180;

//   const a =
//     Math.sin(dLat / 2) ** 2 +
//     Math.cos((latitude1 * Math.PI) / 180) *
//       Math.cos((latitude2 * Math.PI) / 180) *
//       Math.sin(dLng / 2) ** 2;

//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

//   return earthRadiusKm * c;
// }

// // ============================================================
// // DYNAMODB STREAM ATTRIBUTE DECODER
// // ============================================================
// //
// // IMPORTANT:
// //
// // DynamoDB Streams do NOT give us ordinary JavaScript objects.
// //
// // They give AttributeValue objects such as:
// //
// //     { S: "PAID" }
// //
// //     { N: "123" }
// //
// //     { BOOL: true }
// //
// //     { NULL: true }
// //
// //     { L: [...] }
// //
// //     { M: {...} }
// //
// // We need to decode these values before examining:
// //
// //     paymentStatus
// //     id
// //     status
// //     transportationType
// //
// // This avoids relying on the AppSync event format when the actual
// // trigger is DynamoDB Streams.
// //

// function decodeDynamoDBAttributeValue(attributeValue) {
//   if (attributeValue === null || attributeValue === undefined) {
//     return null;
//   }

//   if (Object.prototype.hasOwnProperty.call(attributeValue, "S")) {
//     return attributeValue.S;
//   }

//   if (Object.prototype.hasOwnProperty.call(attributeValue, "N")) {
//     const numberValue = Number(attributeValue.N);

//     return Number.isFinite(numberValue) ? numberValue : attributeValue.N;
//   }

//   if (Object.prototype.hasOwnProperty.call(attributeValue, "BOOL")) {
//     return Boolean(attributeValue.BOOL);
//   }

//   if (Object.prototype.hasOwnProperty.call(attributeValue, "NULL")) {
//     return null;
//   }

//   if (Object.prototype.hasOwnProperty.call(attributeValue, "SS")) {
//     return Array.isArray(attributeValue.SS) ? attributeValue.SS : [];
//   }

//   if (Object.prototype.hasOwnProperty.call(attributeValue, "NS")) {
//     return Array.isArray(attributeValue.NS)
//       ? attributeValue.NS.map((value) => {
//           const numberValue = Number(value);

//           return Number.isFinite(numberValue) ? numberValue : value;
//         })
//       : [];
//   }

//   if (Object.prototype.hasOwnProperty.call(attributeValue, "L")) {
//     return Array.isArray(attributeValue.L)
//       ? attributeValue.L.map(decodeDynamoDBAttributeValue)
//       : [];
//   }

//   if (Object.prototype.hasOwnProperty.call(attributeValue, "M")) {
//     return decodeDynamoDBMap(attributeValue.M);
//   }

//   // ==========================================================
//   // FALLBACK
//   // ==========================================================
//   //
//   // This allows us to safely handle unexpected values without
//   // crashing the whole Lambda.
//   //

//   return attributeValue;
// }

// // ============================================================
// // DYNAMODB STREAM MAP DECODER
// // ============================================================

// function decodeDynamoDBMap(attributeMap) {
//   if (!attributeMap || typeof attributeMap !== "object") {
//     return {};
//   }

//   const result = {};

//   for (const [key, value] of Object.entries(attributeMap)) {
//     result[key] = decodeDynamoDBAttributeValue(value);
//   }

//   return result;
// }

// // ============================================================
// // GET NEW IMAGE FROM DYNAMODB STREAM RECORD
// // ============================================================

// function getStreamNewImage(record) {
//   const newImage = record?.dynamodb?.NewImage;

//   if (!newImage || typeof newImage !== "object") {
//     return null;
//   }

//   return decodeDynamoDBMap(newImage);
// }

// // ============================================================
// // GET OLD IMAGE FROM DYNAMODB STREAM RECORD
// // ============================================================

// function getStreamOldImage(record) {
//   const oldImage = record?.dynamodb?.OldImage;

//   if (!oldImage || typeof oldImage !== "object") {
//     return null;
//   }

//   return decodeDynamoDBMap(oldImage);
// }

// // ============================================================
// // DETERMINE WHETHER PAYMENT JUST BECAME PAID
// // ============================================================
// //
// // This is the MOST IMPORTANT protection in the new handler.
// //
// // The DynamoDB stream fires whenever the Order changes.
// //
// // We only want the initial assignment when:
// //
// //     NEW paymentStatus = PAID
// //
// // and:
// //
// //     OLD paymentStatus was NOT PAID
// //
// // Example:
// //
// //     OLD:
// //         paymentStatus = PENDING
// //
// //     NEW:
// //         paymentStatus = PAID
// //
// // Result:
// //
// //     TRUE
// //
// //
// // But:
// //
// //     OLD:
// //         paymentStatus = PAID
// //
// //     NEW:
// //         assignmentStatus = OFFERED
// //
// // Result:
// //
// //     FALSE
// //
// // This prevents the assignment update itself from triggering
// // another assignment.
// //

// function paymentJustBecamePaid(oldOrder, newOrder) {
//   const oldPaymentStatus = String(oldOrder?.paymentStatus || "")
//     .trim()
//     .toUpperCase();

//   const newPaymentStatus = String(newOrder?.paymentStatus || "")
//     .trim()
//     .toUpperCase();

//   return newPaymentStatus === "PAID" && oldPaymentStatus !== "PAID";
// }

// // ============================================================
// // STREAM EVENT ANALYSIS
// // ============================================================
// //
// // Returns a structured decision instead of immediately assigning.
// //
// // This makes the decision visible in CloudWatch.
// //
// // ============================================================

// function analyzeDynamoDBStreamRecord(record) {
//   const eventName = String(record?.eventName || "").toUpperCase();

//   const newOrder = getStreamNewImage(record);

//   const oldOrder = getStreamOldImage(record);

//   const orderId =
//     newOrder?.id || oldOrder?.id || record?.dynamodb?.Keys?.id?.S || null;

//   const newPaymentStatus = String(newOrder?.paymentStatus || "")
//     .trim()
//     .toUpperCase();

//   const oldPaymentStatus = String(oldOrder?.paymentStatus || "")
//     .trim()
//     .toUpperCase();

//   const paymentBecamePaid = paymentJustBecamePaid(oldOrder, newOrder);

//   console.log("DYNAMODB_STREAM_ASSIGNMENT_DECISION", {
//     eventName,
//     orderId,
//     oldPaymentStatus,
//     newPaymentStatus,
//     paymentBecamePaid,
//     transportationType: newOrder?.transportationType || null,
//     vehicleClass: newOrder?.vehicleClass || null,
//     status: newOrder?.status || null,
//   });

//   return {
//     shouldAssign:
//       eventName !== "REMOVE" && Boolean(orderId) && paymentBecamePaid,

//     orderId,

//     oldOrder,
//     newOrder,

//     eventName,

//     oldPaymentStatus,
//     newPaymentStatus,

//     paymentBecamePaid,
//   };
// }

// // ============================================================
// // NORMALIZE DIRECT EVENT BODY
// // ============================================================
// //
// // This allows the Lambda to continue supporting direct test
// // invocations such as:
// //
// //     { "orderId": "123" }
// //
// // or:
// //
// //     { "body": "{\"orderId\":\"123\"}" }
// //
// // IMPORTANT:
// //
// // DynamoDB Stream events are handled separately below.
// //
// // ============================================================

// function parseEventBody(body) {
//   if (typeof body !== "string") {
//     return null;
//   }

//   try {
//     return JSON.parse(body);
//   } catch (error) {
//     console.warn("EVENT_BODY_NOT_VALID_JSON", {
//       errorMessage: error.message,
//     });

//     return null;
//   }
// }

// // ============================================================
// // GET DIRECT ORDER ID
// // ============================================================

// function extractDirectOrderId(event) {
//   if (!event) {
//     return null;
//   }

//   // ----------------------------------------------------------
//   // Direct:
//   //
//   //     { orderId: "..." }
//   // ----------------------------------------------------------

//   if (typeof event.orderId === "string") {
//     return event.orderId;
//   }

//   // ----------------------------------------------------------
//   // AppSync:
//   //
//   //     { arguments: { orderId: "..." } }
//   // ----------------------------------------------------------

//   if (typeof event?.arguments?.orderId === "string") {
//     return event.arguments.orderId;
//   }

//   // ----------------------------------------------------------
//   // Body:
//   //
//   //     { body: "{\"orderId\":\"...\"}" }
//   // ----------------------------------------------------------

//   if (typeof event.body === "string") {
//     const parsed = parseEventBody(event.body);

//     if (typeof parsed?.orderId === "string") {
//       return parsed.orderId;
//     }

//     if (typeof parsed?.id === "string") {
//       return parsed.id;
//     }
//   }

//   // ----------------------------------------------------------
//   // Direct Order object:
//   //
//   //     { order: { id: "..." } }
//   // ----------------------------------------------------------

//   if (typeof event?.order?.id === "string") {
//     return event.order.id;
//   }

//   // ----------------------------------------------------------
//   // Direct id:
//   //
//   //     { id: "..." }
//   // ----------------------------------------------------------

//   if (typeof event.id === "string") {
//     return event.id;
//   }

//   return null;
// }

// // ============================================================
// // FIND ELIGIBLE COURIERS
// // ============================================================
// //
// // This function scans the Courier table and filters couriers by:
// //
// //     - courier category
// //     - online state
// //     - approval
// //     - capacity
// //     - valid GPS coordinates
// //     - distance
// //
// // Candidates are returned nearest first.
// //
// // ============================================================

// async function findEligibleCouriers({
//   order,
//   courierCategory,
//   capacityType,
//   radiusKm,
// }) {
//   if (!order?.id) {
//     throw new Error("ORDER_REQUIRED_FOR_COURIER_SEARCH");
//   }

//   if (!courierCategory) {
//     throw new Error("COURIER_CATEGORY_REQUIRED");
//   }

//   if (!capacityType) {
//     throw new Error("CAPACITY_TYPE_REQUIRED");
//   }

//   const orderLat = Number(order.originLat);

//   const orderLng = Number(order.originLng);

//   if (!Number.isFinite(orderLat) || !Number.isFinite(orderLng)) {
//     console.warn("ORDER_ORIGIN_COORDINATES_INVALID", {
//       orderId: order.id,
//       originLat: order.originLat,
//       originLng: order.originLng,
//     });

//     return [];
//   }

//   console.log("COURIER_SEARCH_START", {
//     orderId: order.id,

//     courierCategory,

//     capacityType,

//     radiusKm,

//     orderLat,

//     orderLng,
//   });

//   // ==========================================================
//   // SCAN COURIER TABLE
//   // ==========================================================
//   //
//   // We use Scan here because courier assignment is based on
//   // geographical distance and multiple eligibility fields.
//   //
//   // The capacity reservation itself is still protected by a
//   // DynamoDB conditional transaction later.
//   //

//   const allCouriers = [];

//   let ExclusiveStartKey;

//   do {
//     const result = await docClient.send(
//       new ScanCommand({
//         TableName: COURIER_TABLE,

//         ExclusiveStartKey,
//       }),
//     );

//     if (Array.isArray(result?.Items)) {
//       allCouriers.push(...result.Items);
//     }

//     ExclusiveStartKey = result?.LastEvaluatedKey;
//   } while (ExclusiveStartKey);

//   console.log("COURIER_TABLE_SCAN_COMPLETE", {
//     orderId: order.id,

//     totalCourierRecords: allCouriers.length,
//   });

//   const eligibleCouriers = [];

//   const rejectionSummary = {
//     WRONG_CATEGORY: 0,
//     OFFLINE: 0,
//     NOT_APPROVED: 0,
//     EXPRESS_CAPACITY_FULL: 0,
//     BATCH_CAPACITY_FULL: 0,
//     INVALID_LOCATION: 0,
//     OUTSIDE_RADIUS: 0,
//     INVALID_DISTANCE: 0,
//   };

//   // ==========================================================
//   // FILTER COURIERS
//   // ==========================================================

//   for (const courier of allCouriers) {
//     // --------------------------------------------------------
//     // CATEGORY
//     // --------------------------------------------------------

//     const courierTransportationType = getCourierCategory(courier);

//     if (courierTransportationType !== courierCategory) {
//       rejectionSummary.WRONG_CATEGORY++;

//       continue;
//     }

//     // --------------------------------------------------------
//     // ONLINE
//     // --------------------------------------------------------

//     if (!isCourierOnline(courier)) {
//       rejectionSummary.OFFLINE++;

//       continue;
//     }

//     // --------------------------------------------------------
//     // APPROVED
//     // --------------------------------------------------------

//     if (!isCourierApproved(courier)) {
//       rejectionSummary.NOT_APPROVED++;

//       continue;
//     }

//     // --------------------------------------------------------
//     // CAPACITY
//     // --------------------------------------------------------

//     const expressCount = getCurrentExpressCount(courier);

//     const batchCount = getCurrentBatchCount(courier);

//     if (capacityType === "EXPRESS") {
//       if (expressCount >= MAX_EXPRESS_JOBS) {
//         rejectionSummary.EXPRESS_CAPACITY_FULL++;

//         continue;
//       }

//       // Express and Batch are mutually exclusive.
//       if (batchCount > 0) {
//         rejectionSummary.BATCH_CAPACITY_FULL++;

//         continue;
//       }
//     }

//     if (capacityType === "BATCH") {
//       // Express and Batch are mutually exclusive.
//       if (expressCount > 0) {
//         rejectionSummary.EXPRESS_CAPACITY_FULL++;

//         continue;
//       }

//       if (batchCount >= MAX_BATCH_JOBS) {
//         rejectionSummary.BATCH_CAPACITY_FULL++;

//         continue;
//       }
//     }

//     // --------------------------------------------------------
//     // COURIER LOCATION
//     // --------------------------------------------------------

//     const courierLat = Number(
//       courier.currentLat ?? courier.latitude ?? courier.lat,
//     );

//     const courierLng = Number(
//       courier.currentLng ?? courier.longitude ?? courier.lng,
//     );

//     if (!Number.isFinite(courierLat) || !Number.isFinite(courierLng)) {
//       rejectionSummary.INVALID_LOCATION++;

//       continue;
//     }

//     // --------------------------------------------------------
//     // DISTANCE
//     // --------------------------------------------------------

//     const distanceKm = haversineDistanceKm(
//       orderLat,
//       orderLng,
//       courierLat,
//       courierLng,
//     );

//     if (!Number.isFinite(distanceKm)) {
//       rejectionSummary.INVALID_DISTANCE++;

//       continue;
//     }

//     // --------------------------------------------------------
//     // INITIAL RADIUS
//     // --------------------------------------------------------

//     if (distanceKm > radiusKm) {
//       rejectionSummary.OUTSIDE_RADIUS++;

//       continue;
//     }

//     // --------------------------------------------------------
//     // ELIGIBLE
//     // --------------------------------------------------------

//     console.log("COURIER_ELIGIBLE", {
//       orderId: order.id,

//       courierId: courier.id,

//       transportationType: courier.transportationType,

//       isOnline: courier.isOnline,

//       isApproved: courier.isApproved,

//       statusKey: courier.statusKey,

//       distanceKm: Number(distanceKm.toFixed(3)),

//       capacityType,

//       currentExpressCount: expressCount,

//       currentBatchCount: batchCount,
//     });

//     eligibleCouriers.push({
//       courier,

//       distanceKm,
//     });
//   }

//   // ==========================================================
//   // CLOSEST COURIER FIRST
//   // ==========================================================

//   eligibleCouriers.sort((a, b) => a.distanceKm - b.distanceKm);

//   console.log("COURIER_SEARCH_COMPLETE", {
//     orderId: order.id,

//     courierCategory,

//     capacityType,

//     radiusKm,

//     totalCourierRecords: allCouriers.length,

//     eligibleCount: eligibleCouriers.length,

//     rejectionSummary,

//     candidates: eligibleCouriers.map((candidate) => ({
//       courierId: candidate.courier.id,

//       transportationType: candidate.courier.transportationType,

//       distanceKm: Number(candidate.distanceKm.toFixed(3)),

//       currentExpressCount: getCurrentExpressCount(candidate.courier),

//       currentBatchCount: getCurrentBatchCount(candidate.courier),
//     })),
//   });

//   return eligibleCouriers;
// }

// // ============================================================
// //
// // This part contains:
// //
// //     - rejected courier handling
// //     - courier capacity reservation
// //     - AppSync Order update
// //     - DynamoDB verification
// //     - SQS expiry message
// //     - initial assignment
// //     - DynamoDB Stream handler
// //     - direct/manual invocation support
// //
// // ============================================================

// // ============================================================
// // SAFE ARRAY NORMALIZATION
// // ============================================================
// //
// // DynamoDB/AppSync can sometimes return an empty value, null,
// // undefined, or an actual array.
// //
// // We normalize it before working with rejected courier IDs.
// //

// function normalizeArray(value) {
//   if (Array.isArray(value)) {
//     return value;
//   }

//   return [];
// }

// // ============================================================
// // NORMALIZE COURIER ID
// // ============================================================

// function normalizeCourierId(value) {
//   if (value === null || value === undefined) {
//     return null;
//   }

//   const id = String(value).trim();

//   return id || null;
// }

// // ============================================================
// // CHECK WHETHER COURIER HAS ALREADY BEEN REJECTED
// // ============================================================

// function hasRejectedCourier(order, courierId) {
//   const normalizedCourierId = normalizeCourierId(courierId);

//   if (!normalizedCourierId) {
//     return false;
//   }

//   const rejectedCourierIds = normalizeArray(order?.rejectedCourierIds);

//   return rejectedCourierIds.some(
//     (id) => normalizeCourierId(id) === normalizedCourierId,
//   );
// }

// // ============================================================
// // FILTER REJECTED COURIERS
// // ============================================================
// //
// // We never want to immediately offer an Order to a courier who
// // has already rejected that same Order.
// //

// function filterRejectedCouriers(candidates, order) {
//   return candidates.filter((candidate) => {
//     const courierId = candidate?.courier?.id;

//     return !hasRejectedCourier(order, courierId);
//   });
// }

// // ============================================================
// // UPDATE ORDER THROUGH APPSYNC
// // ============================================================
// //
// // IMPORTANT:
// //
// // The actual Order write is performed through AppSync.
// //
// // This is intentional because your working Paystack webhook uses
// // the AppSync/DataManager path successfully.
// //
// // We therefore do NOT attempt to bypass the AppSync model layer
// // for the assignment write.
// //
// // ============================================================

// /**
//  * Updates the Order with the courier assignment.
//  *
//  * IMPORTANT:
//  * This mutation intentionally mirrors the working payment-finalization
//  * mutation used by the Paystack webhook.
//  *
//  * In particular:
//  *   1. We send userID with the update.
//  *   2. We send _version when the Order has one.
//  *   3. We request the complete ORDER_FIELDS response.
//  *
//  * These details are important because AppSync/Amplify uses the returned
//  * mutation result and version information when publishing changes to
//  * realtime subscribers.
//  */
// async function updateOrderAssignment({
//   order,
//   orderId,
//   courierId,
//   assignmentExpiresAt,
//   assignmentAttempts,
//   assignmentStatus,
//   hasNewOffer,
//   lastOfferAt,
//   lastOfferSenderType,
// }) {
//   if (!orderId) {
//     throw new Error("ORDER_ID_REQUIRED_FOR_ASSIGNMENT_UPDATE");
//   }

//   if (!courierId) {
//     throw new Error("COURIER_ID_REQUIRED_FOR_ASSIGNMENT_UPDATE");
//   }

//   /**
//    * The Order must have a userID.
//    *
//    * This mirrors the working Paystack payment update, which sends
//    * userID together with the updateOrder mutation.
//    *
//    * Do not silently continue without it because the realtime behavior
//    * we are trying to fix depends on making this mutation structurally
//    * consistent with the known-working payment mutation.
//    */
//   if (!order?.userID) {
//     throw new Error(`ORDER_USER_ID_REQUIRED_FOR_ASSIGNMENT_UPDATE:${orderId}`);
//   }

//   /**
//    * Use the same complete Order selection that the rest of this Lambda
//    * already uses.
//    *
//    * This also gives us the AppSync-generated _version,
//    * _lastChangedAt, and other fields in the mutation response.
//    */
//   const mutation = `
//     mutation UpdateOrderAssignment(
//       $input: UpdateOrderInput!
//     ) {
//       updateOrder(
//         input: $input
//       ) {
//         ${ORDER_FIELDS}
//       }
//     }
//   `;

//   /**
//    * Build the mutation input.
//    *
//    * userID is intentionally included here to match the working
//    * Paystack finalizePaidOrder mutation.
//    */
//   const input = {
//     id: orderId,

//     // Preserve the Order's owner/user relationship.
//     userID: order.userID,

//     // Courier assignment fields.
//     assignedCourierId: courierId,
//     assignmentExpiresAt,
//     assignmentAttempts,

//     // Assignment timing/status.
//     lastAssignedAt: new Date().toISOString(),
//     assignmentStatus: assignmentStatus || "OFFERED",

//     // Notify the courier app that a new offer exists.
//     hasNewOffer: hasNewOffer !== false,
//     lastOfferAt: lastOfferAt || new Date().toISOString(),
//     lastOfferSenderType: lastOfferSenderType || "SYSTEM",
//   };

//   /**
//    * AppSync/Amplify versioned mutations use _version for optimistic
//    * concurrency control.
//    *
//    * The Paystack webhook already uses this same pattern successfully,
//    * so assignment updates should do the same.
//    */
//   if (Number.isInteger(order._version)) {
//     input._version = order._version;
//   }

//   console.log("ASSIGNMENT_APPSYNC_UPDATE_START", {
//     orderId,
//     courierId,
//     userID: order.userID,
//     previousVersion: order._version ?? null,
//     assignmentExpiresAt,
//     assignmentAttempts,
//     assignmentStatus: input.assignmentStatus,
//     hasNewOffer: input.hasNewOffer,
//     lastOfferAt: input.lastOfferAt,
//     lastOfferSenderType: input.lastOfferSenderType,
//   });

//   /**
//    * Execute the AppSync mutation.
//    *
//    * graphqlRequest() is the same helper already used by the Lambda
//    * for its other AppSync operations.
//    */
//   const data = await graphqlRequest(
//     mutation,
//     { input },
//     "UpdateOrderAssignment",
//   );

//   const updatedOrder = data?.updateOrder || null;

//   /**
//    * Log the actual object returned by AppSync.
//    *
//    * These fields are particularly important when testing realtime
//    * propagation because they tell us whether AppSync accepted the
//    * versioned mutation and generated a new version/change timestamp.
//    */
//   console.log("ASSIGNMENT_APPSYNC_UPDATE_RESULT", {
//     orderId,
//     courierId,

//     updated: Boolean(updatedOrder),

//     returnedOrderId: updatedOrder?.id || null,

//     returnedCourierId: updatedOrder?.assignedCourierId || null,

//     returnedUserID: updatedOrder?.userID || null,

//     returnedAssignmentStatus: updatedOrder?.assignmentStatus || null,

//     returnedAssignmentExpiresAt: updatedOrder?.assignmentExpiresAt || null,

//     returnedAssignmentAttempts: updatedOrder?.assignmentAttempts ?? null,

//     returnedHasNewOffer: updatedOrder?.hasNewOffer ?? null,

//     returnedLastOfferAt: updatedOrder?.lastOfferAt || null,

//     returnedLastOfferSenderType: updatedOrder?.lastOfferSenderType || null,

//     returnedVersion: updatedOrder?._version ?? null,

//     returnedLastChangedAt: updatedOrder?._lastChangedAt || null,

//     returnedDeleted: updatedOrder?._deleted ?? null,
//   });

//   /**
//    * Never allow the assignment flow to continue if AppSync did not
//    * return an updated Order.
//    *
//    * The caller will then release the courier reservation and handle
//    * the assignment failure.
//    */
//   if (!updatedOrder) {
//     throw new Error(`ASSIGNMENT_APPSYNC_UPDATE_RETURNED_NO_ORDER:${orderId}`);
//   }

//   return updatedOrder;
// }

// // ============================================================
// // VERIFY ASSIGNMENT IN DYNAMODB
// // ============================================================
// //
// // This is one of the most important functions in this Lambda.
// //
// // An AppSync response saying that an update succeeded is useful,
// // but we also want to verify the actual DynamoDB record.
// //
// // This gives us the decisive CloudWatch evidence:
// //
// //     ASSIGNMENT_VERIFICATION_RESULT
// //
// // If this says:
// //
// //     verified: true
// //
// // then the assignment actually exists in DynamoDB.
// //
// // ============================================================

// async function verifyAssignmentInDynamoDB({ orderId, expectedCourierId }) {
//   if (!orderId) {
//     throw new Error("ORDER_ID_REQUIRED_FOR_ASSIGNMENT_VERIFICATION");
//   }

//   if (!expectedCourierId) {
//     throw new Error("EXPECTED_COURIER_ID_REQUIRED_FOR_ASSIGNMENT_VERIFICATION");
//   }

//   console.log("ASSIGNMENT_VERIFICATION_START", {
//     orderId,

//     expectedCourierId,
//   });

//   const order = await getOrderFromDynamoDB(orderId);

//   if (!order) {
//     console.error("ASSIGNMENT_VERIFICATION_RESULT", {
//       orderId,

//       expectedCourierId,

//       verified: false,

//       reason: "ORDER_NOT_FOUND_IN_DYNAMODB",
//     });

//     return {
//       verified: false,

//       reason: "ORDER_NOT_FOUND_IN_DYNAMODB",

//       order: null,
//     };
//   }

//   const actualCourierId = normalizeCourierId(order.assignedCourierId);

//   const expected = normalizeCourierId(expectedCourierId);

//   const verified = actualCourierId === expected;

//   console.log("ASSIGNMENT_VERIFICATION_RESULT", {
//     orderId,

//     expectedCourierId: expected,

//     actualCourierId,

//     verified,

//     assignmentStatus: order.assignmentStatus ?? null,

//     assignmentExpiresAt: order.assignmentExpiresAt ?? null,

//     assignmentAttempts: order.assignmentAttempts ?? null,

//     hasNewOffer: order.hasNewOffer ?? null,

//     status: order.status ?? null,

//     paymentStatus: order.paymentStatus ?? null,

//     dynamoVersion: order._version ?? null,

//     updatedAt: order.updatedAt ?? null,
//   });

//   return {
//     verified,

//     reason: verified
//       ? "ASSIGNMENT_MATCHES_DYNAMODB"
//       : "ASSIGNED_COURIER_ID_MISMATCH",

//     order,
//   };
// }

// // ============================================================
// // RESERVE COURIER CAPACITY
// // ============================================================
// //
// // This protects against two orders assigning to the same courier
// // at the same time.
// //
// // We use a DynamoDB transaction with conditions.
// //
// // IMPORTANT:
// //
// // The transaction is NOT the Order assignment write.
// //
// // It protects the Courier capacity.
// //
// // The Order itself is subsequently updated through AppSync.
// //
// // ============================================================

// async function reserveCourierCapacity({ courier, capacityType, orderId }) {
//   if (!courier?.id) {
//     throw new Error("COURIER_ID_REQUIRED_FOR_CAPACITY_RESERVATION");
//   }

//   if (!orderId) {
//     throw new Error("ORDER_ID_REQUIRED_FOR_CAPACITY_RESERVATION");
//   }

//   const courierId = courier.id;

//   const currentExpressCount = getCurrentExpressCount(courier);

//   const currentBatchCount = getCurrentBatchCount(courier);

//   // ==========================================================
//   // EXPRESS
//   // ==========================================================

//   if (capacityType === "EXPRESS") {
//     if (currentExpressCount >= MAX_EXPRESS_JOBS) {
//       return {
//         reserved: false,

//         reason: "EXPRESS_CAPACITY_FULL",
//       };
//     }

//     if (currentBatchCount > 0) {
//       return {
//         reserved: false,

//         reason: "BATCH_JOBS_ALREADY_ACTIVE",
//       };
//     }

//     const newExpressCount = currentExpressCount + 1;

//     console.log("COURIER_CAPACITY_RESERVATION_START", {
//       orderId,

//       courierId,

//       capacityType,

//       currentExpressCount,

//       currentBatchCount,

//       newExpressCount,
//     });

//     try {
//       await docClient.send(
//         new TransactWriteCommand({
//           TransactItems: [
//             {
//               Update: {
//                 TableName: COURIER_TABLE,

//                 Key: {
//                   id: courierId,
//                 },

//                 UpdateExpression: "SET currentExpressCount = :newExpressCount",

//                 ConditionExpression:
//                   "attribute_not_exists(currentExpressCount) OR currentExpressCount = :currentExpressCount",

//                 ExpressionAttributeValues: {
//                   ":currentExpressCount": currentExpressCount,

//                   ":newExpressCount": newExpressCount,
//                 },
//               },
//             },
//           ],
//         }),
//       );

//       console.log("COURIER_CAPACITY_RESERVED", {
//         orderId,

//         courierId,

//         capacityType,

//         currentExpressCount,

//         newExpressCount,
//       });

//       return {
//         reserved: true,

//         courierId,

//         capacityType,

//         previousExpressCount: currentExpressCount,

//         newExpressCount,
//       };
//     } catch (error) {
//       console.warn("COURIER_CAPACITY_RESERVATION_FAILED", {
//         orderId,

//         courierId,

//         capacityType,

//         errorName: error.name,

//         errorMessage: error.message,
//       });

//       return {
//         reserved: false,

//         reason: "CAPACITY_CONDITION_FAILED",

//         error,
//       };
//     }
//   }

//   // ==========================================================
//   // BATCH
//   // ==========================================================

//   if (capacityType === "BATCH") {
//     if (currentExpressCount > 0) {
//       return {
//         reserved: false,

//         reason: "EXPRESS_JOB_ALREADY_ACTIVE",
//       };
//     }

//     if (currentBatchCount >= MAX_BATCH_JOBS) {
//       return {
//         reserved: false,

//         reason: "BATCH_CAPACITY_FULL",
//       };
//     }

//     const newBatchCount = currentBatchCount + 1;

//     console.log("COURIER_CAPACITY_RESERVATION_START", {
//       orderId,

//       courierId,

//       capacityType,

//       currentExpressCount,

//       currentBatchCount,

//       newBatchCount,
//     });

//     try {
//       await docClient.send(
//         new TransactWriteCommand({
//           TransactItems: [
//             {
//               Update: {
//                 TableName: COURIER_TABLE,

//                 Key: {
//                   id: courierId,
//                 },

//                 UpdateExpression: "SET currentBatchCount = :newBatchCount",

//                 ConditionExpression:
//                   "attribute_not_exists(currentBatchCount) OR currentBatchCount = :currentBatchCount",

//                 ExpressionAttributeValues: {
//                   ":currentBatchCount": currentBatchCount,

//                   ":newBatchCount": newBatchCount,
//                 },
//               },
//             },
//           ],
//         }),
//       );

//       console.log("COURIER_CAPACITY_RESERVED", {
//         orderId,

//         courierId,

//         capacityType,

//         currentBatchCount,

//         newBatchCount,
//       });

//       return {
//         reserved: true,

//         courierId,

//         capacityType,

//         previousBatchCount: currentBatchCount,

//         newBatchCount,
//       };
//     } catch (error) {
//       console.warn("COURIER_CAPACITY_RESERVATION_FAILED", {
//         orderId,

//         courierId,

//         capacityType,

//         errorName: error.name,

//         errorMessage: error.message,
//       });

//       return {
//         reserved: false,

//         reason: "CAPACITY_CONDITION_FAILED",

//         error,
//       };
//     }
//   }

//   return {
//     reserved: false,

//     reason: "UNKNOWN_CAPACITY_TYPE",
//   };
// }
// // ============================================================
// // RELEASE COURIER CAPACITY
// // ============================================================
// //
// // If AppSync fails AFTER we reserve courier capacity, we must
// // attempt to undo the reservation.
// //
// // This prevents a failed assignment from permanently consuming
// // courier capacity.
// //
// // ============================================================

// async function releaseCourierCapacity({ courierId, capacityType, orderId }) {
//   if (!courierId || !capacityType) {
//     return;
//   }

//   try {
//     const courierResult = await docClient.send(
//       new GetCommand({
//         TableName: COURIER_TABLE,

//         Key: {
//           id: courierId,
//         },

//         ConsistentRead: true,
//       }),
//     );

//     const courier = courierResult?.Item;

//     if (!courier) {
//       console.warn("COURIER_CAPACITY_RELEASE_SKIPPED", {
//         orderId,

//         courierId,

//         capacityType,

//         reason: "COURIER_NOT_FOUND",
//       });

//       return;
//     }

//     // ==========================================================
//     // EXPRESS CAPACITY RELEASE
//     // ==========================================================

//     if (capacityType === "EXPRESS") {
//       const current = getCurrentExpressCount(courier);

//       const next = Math.max(0, current - 1);

//       await docClient.send(
//         new TransactWriteCommand({
//           TransactItems: [
//             {
//               Update: {
//                 TableName: COURIER_TABLE,

//                 Key: {
//                   id: courierId,
//                 },

//                 UpdateExpression: "SET currentExpressCount = :next",

//                 ConditionExpression: "currentExpressCount = :current",

//                 ExpressionAttributeValues: {
//                   ":current": current,

//                   ":next": next,
//                 },
//               },
//             },
//           ],
//         }),
//       );

//       console.log("COURIER_CAPACITY_RELEASED", {
//         orderId,

//         courierId,

//         capacityType,

//         previousCount: current,

//         newCount: next,
//       });

//       return;
//     }

//     // ==========================================================
//     // BATCH CAPACITY RELEASE
//     // ==========================================================

//     if (capacityType === "BATCH") {
//       const current = getCurrentBatchCount(courier);

//       const next = Math.max(0, current - 1);

//       await docClient.send(
//         new TransactWriteCommand({
//           TransactItems: [
//             {
//               Update: {
//                 TableName: COURIER_TABLE,

//                 Key: {
//                   id: courierId,
//                 },

//                 UpdateExpression: "SET currentBatchCount = :next",

//                 ConditionExpression: "currentBatchCount = :current",

//                 ExpressionAttributeValues: {
//                   ":current": current,

//                   ":next": next,
//                 },
//               },
//             },
//           ],
//         }),
//       );

//       console.log("COURIER_CAPACITY_RELEASED", {
//         orderId,

//         courierId,

//         capacityType,

//         previousCount: current,

//         newCount: next,
//       });
//     }
//   } catch (error) {
//     console.error("COURIER_CAPACITY_RELEASE_FAILED", {
//       orderId,

//       courierId,

//       capacityType,

//       errorName: error.name,

//       errorMessage: error.message,

//       stack: error.stack,
//     });
//   }
// }

// // ============================================================
// // SEND ASSIGNMENT EXPIRY MESSAGE
// // ============================================================
// //
// // This sends the 25-second expiry information to SQS.
// //
// // IMPORTANT:
// //
// // SQS does NOT wait 25 seconds automatically.
// //
// // The message is sent immediately.
// //
// // It contains the timestamp at which the offer expires.
// //
// // reassignOrder later checks DynamoDB before reassigning.
// //
// // ============================================================

// async function sendAssignmentExpiryMessage({
//   orderId,
//   courierId,
//   assignmentExpiresAt,
//   assignmentAttempt,
// }) {
//   if (!ASSIGNMENT_EXPIRY_QUEUE_URL) {
//     throw new Error("ASSIGNMENT_EXPIRY_QUEUE_URL_NOT_CONFIGURED");
//   }

//   if (!orderId) {
//     throw new Error("ORDER_ID_REQUIRED_FOR_EXPIRY_MESSAGE");
//   }

//   if (!courierId) {
//     throw new Error("COURIER_ID_REQUIRED_FOR_EXPIRY_MESSAGE");
//   }

//   const message = {
//     type: "ASSIGNMENT_EXPIRY",

//     orderId,

//     courierId,

//     assignmentExpiresAt,

//     assignmentAttempt: assignmentAttempt ?? null,

//     createdAt: new Date().toISOString(),
//   };

//   console.log("ASSIGNMENT_EXPIRY_MESSAGE_START", {
//     queueConfigured: Boolean(ASSIGNMENT_EXPIRY_QUEUE_URL),

//     orderId,

//     courierId,

//     assignmentExpiresAt,

//     assignmentAttempt: assignmentAttempt ?? null,
//   });

//   const result = await sqsClient.send(
//     new SendMessageCommand({
//       QueueUrl: ASSIGNMENT_EXPIRY_QUEUE_URL,

//       MessageBody: JSON.stringify(message),
//     }),
//   );

//   console.log("ASSIGNMENT_EXPIRY_MESSAGE_SENT", {
//     orderId,

//     courierId,

//     assignmentExpiresAt,

//     assignmentAttempt: assignmentAttempt ?? null,

//     messageId: result?.MessageId || null,
//   });

//   return result;
// }

// // ============================================================
// // CALCULATE ASSIGNMENT EXPIRY
// // ============================================================
// //
// // The offer expires 25 seconds after assignment.
// //
// // ============================================================

// function calculateAssignmentExpiry() {
//   return new Date(Date.now() + ASSIGNMENT_TIMEOUT_MS).toISOString();
// }

// // ============================================================
// // GET NEXT ASSIGNMENT ATTEMPT
// // ============================================================
// //
// // If no previous attempt exists:
// //
// //     attempt = 1
// //
// // Otherwise:
// //
// //     current + 1
// //
// // ============================================================

// function getNextAssignmentAttempt(order) {
//   const current = Number(order?.assignmentAttempts);

//   if (!Number.isFinite(current) || current < 0) {
//     return 1;
//   }

//   return Math.floor(current) + 1;
// }

// // ============================================================
// // SHOULD INITIAL ASSIGNMENT BE ALLOWED?
// // ============================================================
// //
// // This is a second protection layer.
// //
// // Even if the DynamoDB Stream says payment became PAID, we still
// // fetch the current Order and verify that it has not already been
// // assigned.
// //
// // ============================================================

// function shouldPerformInitialAssignment(order) {
//   if (!order) {
//     return {
//       allowed: false,

//       reason: "ORDER_NOT_FOUND",
//     };
//   }

//   const paymentStatus = String(order.paymentStatus || "")
//     .trim()
//     .toUpperCase();

//   if (paymentStatus !== "PAID") {
//     return {
//       allowed: false,

//       reason: "PAYMENT_NOT_PAID",
//     };
//   }

//   if (order.assignedCourierId) {
//     return {
//       allowed: false,

//       reason: "ORDER_ALREADY_ASSIGNED",

//       assignedCourierId: order.assignedCourierId,
//     };
//   }

//   const assignmentStatus = String(order.assignmentStatus || "")
//     .trim()
//     .toUpperCase();

//   if (
//     assignmentStatus === "ASSIGNED" ||
//     assignmentStatus === "ACCEPTED" ||
//     assignmentStatus === "OFFERED"
//   ) {
//     return {
//       allowed: false,

//       reason: "ORDER_ALREADY_IN_ASSIGNMENT_FLOW",

//       assignmentStatus,
//     };
//   }

//   return {
//     allowed: true,

//     reason: "READY_FOR_INITIAL_ASSIGNMENT",
//   };
// }

// // ============================================================
// // ASSIGN ORDER
// // ============================================================
// //
// // This is the core initial assignment function.
// //
// // ============================================================

// async function assignOrder(orderId) {
//   if (!orderId) {
//     throw new Error("ORDER_ID_REQUIRED");
//   }

//   console.log("ASSIGN_ORDER_START", {
//     orderId,
//   });

//   // ==========================================================
//   // GET CURRENT ORDER
//   // ==========================================================

//   const order = await getOrder(orderId);

//   if (!order) {
//     console.error("ASSIGN_ORDER_ORDER_NOT_FOUND", {
//       orderId,
//     });

//     return {
//       assigned: false,

//       reason: "ORDER_NOT_FOUND",
//     };
//   }

//   console.log("ASSIGN_ORDER_CURRENT_ORDER", {
//     orderId,

//     paymentStatus: order.paymentStatus,

//     transportationType: order.transportationType,

//     vehicleClass: order.vehicleClass,

//     status: order.status,

//     assignedCourierId: order.assignedCourierId || null,

//     assignmentStatus: order.assignmentStatus || null,

//     assignmentAttempts: order.assignmentAttempts ?? null,
//   });

//   // ==========================================================
//   // VERIFY INITIAL ASSIGNMENT IS STILL NEEDED
//   // ==========================================================

//   const assignmentCheck = shouldPerformInitialAssignment(order);

//   if (!assignmentCheck.allowed) {
//     console.log("ASSIGN_ORDER_SKIPPED", {
//       orderId,

//       reason: assignmentCheck.reason,

//       assignedCourierId: assignmentCheck.assignedCourierId || null,

//       assignmentStatus: assignmentCheck.assignmentStatus || null,
//     });

//     return {
//       assigned: false,

//       skipped: true,

//       reason: assignmentCheck.reason,
//     };
//   }

//   // ==========================================================
//   // DETERMINE ORDER TYPE
//   // ==========================================================

//   const { transportationType, config } = getOrderTypeConfig(order);

//   if (!config) {
//     // --------------------------------------------------------
//     // Maxi is intentionally not silently treated as Micro/Moto.
//     // --------------------------------------------------------

//     if (transportationType === "MAXI") {
//       console.log("ASSIGN_ORDER_MAXI_DETECTED", {
//         orderId,

//         transportationType,

//         vehicleClass: order.vehicleClass || null,
//       });

//       return {
//         assigned: false,

//         skipped: true,

//         reason: "MAXI_REQUIRES_VEHICLE_CLASS_ASSIGNMENT_FLOW",
//       };
//     }

//     console.error("ASSIGN_ORDER_UNSUPPORTED_TRANSPORTATION_TYPE", {
//       orderId,

//       transportationType,
//     });

//     return {
//       assigned: false,

//       reason: "UNSUPPORTED_TRANSPORTATION_TYPE",
//     };
//   }

//   // ==========================================================
//   // SEARCH COURIERS
//   // ==========================================================

//   let candidates = await findEligibleCouriers({
//     order,

//     courierCategory: config.courierCategory,

//     capacityType: config.capacityType,

//     radiusKm: INITIAL_RADIUS_KM,
//   });

//   // ==========================================================
//   // REMOVE PREVIOUSLY REJECTED COURIERS
//   // ==========================================================

//   candidates = filterRejectedCouriers(candidates, order);

//   console.log("ASSIGN_ORDER_CANDIDATES_AFTER_REJECTION_FILTER", {
//     orderId,

//     candidateCount: candidates.length,

//     candidates: candidates.map((candidate) => ({
//       courierId: candidate?.courier?.id,

//       distanceKm: candidate?.distanceKm,
//     })),
//   });

//   if (candidates.length === 0) {
//     console.warn("ASSIGN_ORDER_NO_ELIGIBLE_COURIER", {
//       orderId,

//       transportationType,

//       courierCategory: config.courierCategory,

//       capacityType: config.capacityType,

//       radiusKm: INITIAL_RADIUS_KM,
//     });

//     return {
//       assigned: false,

//       reason: "NO_ELIGIBLE_COURIER",
//     };
//   }

//   // ==========================================================
//   // TRY CANDIDATES IN DISTANCE ORDER
//   // ==========================================================
//   //
//   // The closest courier is tried first.
//   //
//   // If another Lambda has already consumed that courier's
//   // capacity, the conditional reservation fails and we move to
//   // the next courier.
//   //

//   const assignmentAttempt = getNextAssignmentAttempt(order);

//   for (const candidate of candidates) {
//     const courier = candidate.courier;

//     const courierId = normalizeCourierId(courier?.id);

//     if (!courierId) {
//       continue;
//     }

//     console.log("ASSIGN_ORDER_TRY_COURIER", {
//       orderId,

//       courierId,

//       distanceKm: Number(candidate.distanceKm.toFixed(3)),

//       courierCategory: config.courierCategory,

//       capacityType: config.capacityType,

//       assignmentAttempt,
//     });

//     // ========================================================
//     // RESERVE CAPACITY
//     // ========================================================

//     const reservation = await reserveCourierCapacity({
//       courier,

//       capacityType: config.capacityType,

//       orderId,
//     });

//     if (!reservation.reserved) {
//       console.log("ASSIGN_ORDER_COURIER_SKIPPED_CAPACITY", {
//         orderId,

//         courierId,

//         reason: reservation.reason,
//       });

//       continue;
//     }

//     // ========================================================
//     // CAPACITY IS NOW RESERVED
//     // ========================================================
//     //
//     // From this point onward, if AppSync fails, we attempt to
//     // release the capacity.
//     //

//     let assignmentSucceeded = false;

//     try {
//       // ------------------------------------------------------
//       // CALCULATE 25 SECOND EXPIRY
//       // ------------------------------------------------------

//       const assignmentExpiresAt = calculateAssignmentExpiry();

//       const offerTimestamp = new Date().toISOString();

//       /**
//        * Update the Order through AppSync.
//        *
//        * We pass the complete Order object that was fetched earlier
//        * so the mutation can include:
//        *
//        *   - userID
//        *   - the current AppSync _version
//        *
//        * This mirrors the working Paystack payment-finalization
//        * mutation.
//        */
//       const updatedOrder = await updateOrderAssignment({
//         order,

//         orderId,

//         courierId,

//         assignmentExpiresAt,

//         assignmentAttempts: assignmentAttempt,

//         assignmentStatus: "OFFERED",

//         hasNewOffer: true,

//         lastOfferAt: offerTimestamp,

//         lastOfferSenderType: "SYSTEM",
//       });

//       console.log("ASSIGNMENT_TRANSACTION_SUCCESS", {
//         orderId,

//         courierId,

//         assignmentAttempt,

//         assignmentExpiresAt,

//         returnedCourierId: updatedOrder?.assignedCourierId || null,

//         returnedAssignmentStatus: updatedOrder?.assignmentStatus || null,
//       });

//       // ------------------------------------------------------
//       // STRONG DYNAMODB VERIFICATION
//       // ------------------------------------------------------

//       const verification = await verifyAssignmentInDynamoDB({
//         orderId,

//         expectedCourierId: courierId,
//       });

//       if (!verification.verified) {
//         console.error("ASSIGNMENT_TRANSACTION_VERIFICATION_FAILED", {
//           orderId,

//           courierId,

//           reason: verification.reason,

//           actualCourierId: verification?.order?.assignedCourierId || null,
//         });

//         // ----------------------------------------------------
//         // Do NOT send an expiry message when the assignment was
//         // not actually confirmed in DynamoDB.
//         //
//         // We release the capacity because the assignment did not
//         // become authoritative.
//         // ----------------------------------------------------

//         await releaseCourierCapacity({
//           courierId,

//           capacityType: config.capacityType,

//           orderId,
//         });

//         continue;
//       }

//       // ======================================================
//       // ASSIGNMENT IS AUTHORITATIVE
//       // ======================================================

//       assignmentSucceeded = true;

//       // ------------------------------------------------------
//       // SEND EXPIRY MESSAGE
//       // ------------------------------------------------------

//       try {
//         await sendAssignmentExpiryMessage({
//           orderId,

//           courierId,

//           assignmentExpiresAt,

//           assignmentAttempt,
//         });
//       } catch (expiryError) {
//         // ----------------------------------------------------
//         // IMPORTANT:
//         //
//         // The Order has ALREADY been successfully assigned and
//         // verified in DynamoDB.
//         //
//         // Therefore we DO NOT undo the assignment merely because
//         // SQS failed.
//         //
//         // We log the failure so the expiry mechanism can be
//         // repaired/retried separately.
//         // ----------------------------------------------------

//         console.error("ASSIGNMENT_EXPIRY_MESSAGE_FAILED", {
//           orderId,

//           courierId,

//           assignmentExpiresAt,

//           errorName: expiryError.name,

//           errorMessage: expiryError.message,

//           stack: expiryError.stack,
//         });
//       }

//       console.log("ASSIGN_ORDER_SUCCESS", {
//         orderId,

//         courierId,

//         assignmentAttempt,

//         assignmentExpiresAt,

//         distanceKm: Number(candidate.distanceKm.toFixed(3)),

//         transportationType,

//         courierCategory: config.courierCategory,

//         capacityType: config.capacityType,
//       });

//       return {
//         assigned: true,

//         orderId,

//         courierId,

//         assignmentAttempt,

//         assignmentExpiresAt,

//         transportationType,

//         courierCategory: config.courierCategory,

//         capacityType: config.capacityType,

//         distanceKm: candidate.distanceKm,
//       };
//     } catch (error) {
//       console.error("ASSIGN_ORDER_COURIER_ATTEMPT_FAILED", {
//         orderId,

//         courierId,

//         assignmentAttempt,

//         errorName: error.name,

//         errorMessage: error.message,

//         stack: error.stack,
//       });

//       // ------------------------------------------------------
//       // If the assignment did not become authoritative, release
//       // the capacity reserved above.
//       // ------------------------------------------------------

//       if (!assignmentSucceeded) {
//         await releaseCourierCapacity({
//           courierId,

//           capacityType: config.capacityType,

//           orderId,
//         });
//       }

//       // ------------------------------------------------------
//       // Try the next eligible courier.
//       // ------------------------------------------------------

//       continue;
//     }
//   }

//   // ==========================================================
//   // ALL CANDIDATES FAILED
//   // ==========================================================

//   console.warn("ASSIGN_ORDER_ALL_CANDIDATES_FAILED", {
//     orderId,

//     transportationType,

//     courierCategory: config.courierCategory,

//     capacityType: config.capacityType,

//     candidateCount: candidates.length,

//     assignmentAttempt,
//   });

//   return {
//     assigned: false,

//     reason: "ALL_ELIGIBLE_COURIERS_FAILED",
//   };
// }

// // ============================================================
// // EXTRACT ORDER ID FROM DYNAMODB STREAM
// // ============================================================
// //
// // This is the critical fix for the CloudWatch error:
// //
// //     ASSIGN_ORDER_HANDLER_MISSING_ORDER_ID
// //
// // Your Lambda is receiving:
// //
// //     event.Records
// //
// // because it is connected to the DynamoDB Stream.
// //
// // The Order ID is inside:
// //
// //     event.Records[n].dynamodb.NewImage.id.S
// //
// // after decoding the DynamoDB AttributeValue.
// //
// // ============================================================

// function extractOrderIdFromDynamoDBRecord(record) {
//   const newOrder = getStreamNewImage(record);

//   const oldOrder = getStreamOldImage(record);

//   // ----------------------------------------------------------
//   // Prefer NewImage.
//   // ----------------------------------------------------------

//   if (newOrder?.id) {
//     return newOrder.id;
//   }

//   // ----------------------------------------------------------
//   // Fall back to OldImage.
//   // ----------------------------------------------------------

//   if (oldOrder?.id) {
//     return oldOrder.id;
//   }

//   // ----------------------------------------------------------
//   // Finally use the DynamoDB stream Keys.
//   // ----------------------------------------------------------

//   const keyId = record?.dynamodb?.Keys?.id;

//   if (keyId?.S) {
//     return keyId.S;
//   }

//   if (keyId?.N) {
//     return keyId.N;
//   }

//   return null;
// }

// // ============================================================
// // PROCESS ONE DYNAMODB STREAM RECORD
// // ============================================================

// async function processDynamoDBStreamRecord(record) {
//   const decision = analyzeDynamoDBStreamRecord(record);

//   // ==========================================================
//   // INVALID / REMOVE
//   // ==========================================================

//   if (!decision.orderId) {
//     console.error("DYNAMODB_STREAM_RECORD_MISSING_ORDER_ID", {
//       eventName: decision.eventName,

//       keys: record?.dynamodb?.Keys || null,
//     });

//     return {
//       processed: false,

//       reason: "MISSING_ORDER_ID",
//     };
//   }

//   // ==========================================================
//   // NOT AN INITIAL PAYMENT EVENT
//   // ==========================================================
//   //
//   // This is expected for most Order changes.
//   //
//   // For example, after we assign:
//   //
//   //     assignedCourierId
//   //     assignmentExpiresAt
//   //     assignmentStatus
//   //
//   // DynamoDB creates another stream record.
//   //
//   // We intentionally ignore it here.
//   //

//   if (!decision.shouldAssign) {
//     console.log("DYNAMODB_STREAM_ASSIGNMENT_SKIPPED", {
//       orderId: decision.orderId,

//       eventName: decision.eventName,

//       oldPaymentStatus: decision.oldPaymentStatus,

//       newPaymentStatus: decision.newPaymentStatus,

//       paymentBecamePaid: decision.paymentBecamePaid,

//       reason:
//         decision.eventName === "REMOVE"
//           ? "DYNAMODB_REMOVE_EVENT"
//           : "PAYMENT_DID_NOT_TRANSITION_TO_PAID",
//     });

//     return {
//       processed: true,

//       assigned: false,

//       skipped: true,

//       reason: "NOT_INITIAL_PAYMENT_TRANSITION",
//     };
//   }

//   // ==========================================================
//   // INITIAL PAYMENT TRANSITION DETECTED
//   // ==========================================================

//   console.log("INITIAL_ASSIGNMENT_TRIGGER_CONFIRMED", {
//     orderId: decision.orderId,

//     oldPaymentStatus: decision.oldPaymentStatus,

//     newPaymentStatus: decision.newPaymentStatus,

//     transportationType: decision?.newOrder?.transportationType || null,

//     vehicleClass: decision?.newOrder?.vehicleClass || null,
//   });

//   // ==========================================================
//   // FETCH CURRENT ORDER AND ASSIGN
//   // ==========================================================

//   const result = await assignOrder(decision.orderId);

//   return {
//     processed: true,

//     ...result,
//   };
// }

// // ============================================================
// // MAIN LAMBDA HANDLER
// // ============================================================
// //
// // This handler supports:
// //
// //     1. DynamoDB Stream events
// //     2. Direct orderId invocation
// //
// // Your production assignOrder Lambda is currently triggered by
// // DynamoDB Streams.
// //
// // ============================================================

// exports.handler = async function handler(event, context) {
//   const invocationId = context?.awsRequestId || null;

//   console.log("ASSIGN_ORDER_HANDLER_INVOKED", {
//     invocationId,

//     eventType: typeof event,

//     eventKeys: event && typeof event === "object" ? Object.keys(event) : [],

//     hasRecords: Array.isArray(event?.Records),

//     recordCount: Array.isArray(event?.Records) ? event.Records.length : 0,
//   });

//   // ========================================================
//   // DYNAMODB STREAM EVENT
//   // ========================================================

//   if (Array.isArray(event?.Records)) {
//     const results = [];

//     for (const record of event.Records) {
//       try {
//         // --------------------------------------------------
//         // Log the actual record structure.
//         //
//         // This is deliberately detailed so the next
//         // CloudWatch test will tell us exactly what arrived.
//         // --------------------------------------------------

//         console.log("ASSIGN_ORDER_DYNAMODB_STREAM_RECORD", {
//           eventName: record?.eventName || null,

//           eventID: record?.eventID || null,

//           eventSource: record?.eventSource || null,

//           awsRegion: record?.awsRegion || null,

//           keys: record?.dynamodb?.Keys || null,

//           hasNewImage: Boolean(record?.dynamodb?.NewImage),

//           hasOldImage: Boolean(record?.dynamodb?.OldImage),

//           approximateCreationDateTime:
//             record?.dynamodb?.ApproximateCreationDateTime || null,
//         });

//         const result = await processDynamoDBStreamRecord(record);

//         results.push(result);
//       } catch (error) {
//         console.error("ASSIGN_ORDER_DYNAMODB_RECORD_FAILED", {
//           invocationId,

//           errorName: error.name,

//           errorMessage: error.message,

//           stack: error.stack,
//         });

//         // --------------------------------------------------
//         // Re-throw so the DynamoDB event source mapping knows
//         // that the invocation failed.
//         //
//         // This is preferable to silently acknowledging a
//         // failed assignment.
//         // --------------------------------------------------

//         throw error;
//       }
//     }

//     console.log("ASSIGN_ORDER_DYNAMODB_BATCH_COMPLETE", {
//       invocationId,

//       recordCount: event.Records.length,

//       results,
//     });

//     return {
//       ok: true,

//       invocationId,

//       processedRecords: event.Records.length,

//       results,
//     };
//   }

//   // ========================================================
//   // DIRECT INVOCATION
//   // ========================================================
//   //
//   // This allows the Lambda to be manually invoked with:
//   //
//   //     {
//   //       "orderId": "YOUR_ORDER_ID"
//   //     }
//   //
//   // It is useful for testing.
//   //

//   const directOrderId = extractDirectOrderId(event);

//   if (directOrderId) {
//     console.log("ASSIGN_ORDER_DIRECT_INVOCATION", {
//       invocationId,

//       orderId: directOrderId,
//     });

//     const result = await assignOrder(directOrderId);

//     console.log("ASSIGN_ORDER_DIRECT_INVOCATION_COMPLETE", {
//       invocationId,

//       orderId: directOrderId,

//       result,
//     });

//     return {
//       ok: true,

//       invocationId,

//       ...result,
//     };
//   }

//   // ========================================================
//   // NO SUPPORTED EVENT FORMAT
//   // ========================================================

//   console.error("ASSIGN_ORDER_HANDLER_MISSING_ORDER_ID", {
//     invocationId,

//     eventType: typeof event,

//     eventKeys: event && typeof event === "object" ? Object.keys(event) : [],

//     event,
//   });

//   return {
//     ok: false,

//     reason: "MISSING_ORDER_ID",
//   };
// };

// // ============================================================
// // EXPORTS
// // ============================================================
// //
// // These exports make the individual functions available when
// // the Lambda module is imported/tested.
// //
// // The actual Lambda entry point remains:
// //
// //     exports.handler
// //
// // ============================================================

// exports.assignOrder = assignOrder;

// exports.getOrder = getOrder;

// exports.findEligibleCouriers = findEligibleCouriers;

// exports.updateOrderAssignment = updateOrderAssignment;

// exports.verifyAssignmentInDynamoDB = verifyAssignmentInDynamoDB;

// exports.sendAssignmentExpiryMessage = sendAssignmentExpiryMessage;
