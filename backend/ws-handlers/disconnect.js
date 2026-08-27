// Synthetic conference demo - no real data. WebSocket $disconnect handler.
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.CONNECTIONS_TABLE;

exports.handler = async (event) => {
  await ddb.send(new DeleteCommand({
    TableName: TABLE,
    Key: { connectionId: event.requestContext.connectionId },
  }));
  return { statusCode: 200, body: "disconnected" };
};
