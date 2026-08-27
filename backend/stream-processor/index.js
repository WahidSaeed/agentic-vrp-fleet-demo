// Synthetic conference demo - no real data.
// Kinesis stream processor: keeps each vehicle's latest position in DynamoDB,
// broadcasts position deltas to WebSocket clients, and on a disruption event
// fires the Bedrock reasoning agent (async invoke).
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { broadcast } = require("./broadcast");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const lambda = new LambdaClient({});
const VEHICLE_STATE_TABLE = process.env.VEHICLE_STATE_TABLE;
const AGENT_FUNCTION = process.env.AGENT_FUNCTION;

exports.handler = async (event) => {
  for (const record of event.Records) {
    let data;
    try {
      data = JSON.parse(Buffer.from(record.kinesis.data, "base64").toString("utf8"));
    } catch {
      continue;
    }

    if (data.type === "position") {
      await ddb.send(new UpdateCommand({
        TableName: VEHICLE_STATE_TABLE,
        Key: { vehicleId: data.vehicleId },
        UpdateExpression:
          "SET lat = :lat, lon = :lon, heading = :h, speed = :s, routeId = :r, stopsRemaining = :sr, updatedAt = :ts",
        ExpressionAttributeValues: {
          ":lat": data.lat, ":lon": data.lon, ":h": data.heading ?? 0,
          ":s": data.speed ?? 0, ":r": data.routeId ?? "unknown",
          ":sr": data.stopsRemaining ?? 0, ":ts": data.ts ?? Date.now(),
        },
      }));
      await broadcast({ event: "position", vehicle: data });
    }

    if (data.type === "disruption") {
      await ddb.send(new UpdateCommand({
        TableName: VEHICLE_STATE_TABLE,
        Key: { vehicleId: data.vehicleId },
        UpdateExpression: "SET disruption = :d, disruptedAt = :ts",
        ExpressionAttributeValues: { ":d": data, ":ts": Date.now() },
      }));
      await broadcast({ event: "disruption", disruption: data });
      await lambda.send(new InvokeCommand({
        FunctionName: AGENT_FUNCTION,
        InvocationType: "Event",
        Payload: Buffer.from(JSON.stringify(data)),
      }));
    }
  }
  return { statusCode: 200 };
};
