// Synthetic conference demo - no real data.
// Broadcast a JSON message to every recorded WebSocket connection, pruning
// stale ones. Duplicated verbatim across backend functions to keep each
// Lambda bundle self-contained (no shared layer / private package).
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;
const WS_ENDPOINT = process.env.WS_ENDPOINT;

const api = new ApiGatewayManagementApiClient({ endpoint: WS_ENDPOINT });

async function broadcast(message, { role } = {}) {
  const payload = Buffer.from(JSON.stringify(message));
  let items = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new ScanCommand({ TableName: CONNECTIONS_TABLE, ExclusiveStartKey }));
    items = items.concat(res.Items || []);
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  const targets = role ? items.filter((i) => i.role === role) : items;
  await Promise.all(
    targets.map(async ({ connectionId }) => {
      try {
        await api.send(new PostToConnectionCommand({ ConnectionId: connectionId, Data: payload }));
      } catch (err) {
        if (err.statusCode === 410 || err.$metadata?.httpStatusCode === 410) {
          await ddb.send(new DeleteCommand({ TableName: CONNECTIONS_TABLE, Key: { connectionId } }));
        } else {
          console.error("post failed", connectionId, err.message);
        }
      }
    })
  );
}

module.exports = { broadcast };
