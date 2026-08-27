// Synthetic conference demo - no real data.
// WebSocket $default route handler. Actions from the frontend:
//   {"action":"subscribe"}                -> ack
//   {"action":"approve","approvalId":...} -> apply the agent's re-route, broadcast
//   {"action":"reject","approvalId":...}  -> discard the proposal, broadcast
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");
const { broadcast } = require("./broadcast");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const PENDING_APPROVALS_TABLE = process.env.PENDING_APPROVALS_TABLE;
const VEHICLE_STATE_TABLE = process.env.VEHICLE_STATE_TABLE;
const WS_ENDPOINT = process.env.WS_ENDPOINT;

async function reply(connectionId, message) {
  const api = new ApiGatewayManagementApiClient({ endpoint: WS_ENDPOINT });
  try {
    await api.send(new PostToConnectionCommand({
      ConnectionId: connectionId, Data: Buffer.from(JSON.stringify(message)),
    }));
  } catch (err) {
    console.error("reply failed", err.message);
  }
}

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { /* ignore */ }

  if (body.action === "subscribe") {
    await reply(connectionId, { event: "subscribed" });
    return { statusCode: 200 };
  }

  if (body.action === "approve" || body.action === "reject") {
    const { approvalId } = body;
    const { Item } = await ddb.send(new GetCommand({
      TableName: PENDING_APPROVALS_TABLE, Key: { approvalId },
    }));
    if (!Item) {
      await reply(connectionId, { event: "error", message: "approval not found" });
      return { statusCode: 200 };
    }

    if (body.action === "reject") {
      await ddb.send(new UpdateCommand({
        TableName: PENDING_APPROVALS_TABLE, Key: { approvalId },
        UpdateExpression: "SET #s = :s", ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":s": "rejected" },
      }));
      await broadcast({ event: "proposal_rejected", approvalId, vehicleId: Item.vehicleId });
      return { statusCode: 200 };
    }

    await ddb.send(new UpdateCommand({
      TableName: PENDING_APPROVALS_TABLE, Key: { approvalId },
      UpdateExpression: "SET #s = :s", ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":s": "approved" },
    }));
    await ddb.send(new UpdateCommand({
      TableName: VEHICLE_STATE_TABLE, Key: { vehicleId: Item.vehicleId },
      UpdateExpression: "SET activeDetour = :d, detourApprovedAt = :ts REMOVE disruption",
      ExpressionAttributeValues: { ":d": Item.proposal.detourWaypoints, ":ts": Date.now() },
    }));
    await broadcast({
      event: "route_update",
      vehicleId: Item.vehicleId,
      detourWaypoints: Item.proposal.detourWaypoints,
      approvalId, autoApplied: false,
    });
    return { statusCode: 200 };
  }

  await reply(connectionId, { event: "error", message: "unknown action" });
  return { statusCode: 200 };
};
