const AWS = require("aws-sdk");
const docClient = new AWS.DynamoDB.DocumentClient();

const COURIER_TABLE = process.env.COURIER_TABLE;
const ORDER_TABLE = process.env.ORDER_TABLE;

exports.handler = async (event) => {
  console.log("Checking courier completion...");

  const record = event.Records?.[0];
  if (!record) return;

  const newImage = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);

  if (newImage.status !== "DELIVERED") return;

  const courierId = newImage.assignedCourierId;
  if (!courierId) return;

  const activeOrdersRes = await docClient
    .scan({
      TableName: ORDER_TABLE,
      FilterExpression:
        "assignedCourierId = :c AND (#s = :a OR #s = :p OR #s = :t)",
      ExpressionAttributeValues: {
        ":c": courierId,
        ":a": "ACCEPTED",
        ":p": "PICKED_UP",
        ":t": "IN_TRANSIT",
      },
      ExpressionAttributeNames: {
        "#s": "status",
      },
    })
    .promise();

  const activeOrders = activeOrdersRes.Items;

  if (!activeOrders || activeOrders.length === 0) {
    console.log("Courier finished all deliveries. Resetting:", courierId);

    await docClient
      .update({
        TableName: COURIER_TABLE,
        Key: { id: courierId },
        UpdateExpression: `
          SET currentBatchCount = :zero,
              currentExpressCount = :zero,
              lastBatchAssignedAt = :null
        `,
        ExpressionAttributeValues: {
          ":zero": 0,
          ":null": null,
        },
      })
      .promise();
  } else {
    console.log("Courier still has active orders:", activeOrders.length);
  }
};
