// Synthetic conference demo - no real data. WebSocket $connect handler.
// Validates a short-lived demo token (query string ?token=...) and records the
// connection id. Demo-grade auth: a shared token rotated per event, not IAM/JWT.
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.CONNECTIONS_TABLE;
const EXPECTED = process.env.DEMO_WS_TOKEN;

exports.handler = async (event) => {
  const token = event.queryStringParameters?.token;
  if (!EXPECTED || token !== EXPECTED) {
    return { statusCode: 401, body: "unauthorized" };
  }
  const connectionId = event.requestContext.connectionId;
  const role = event.queryStringParameters?.role === "dispatcher" ? "dispatcher" : "driver";
  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: {
      connectionId,
      role,
      ttl: Math.floor(Date.now() / 1000) + 2 * 60 * 60, // auto-reap after 2h
    },
  }));
  return { statusCode: 200, body: "connected" };
};
