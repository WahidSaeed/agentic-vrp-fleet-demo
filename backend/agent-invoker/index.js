// Synthetic conference demo - no real data.
// Reasoning agent: given a disruption + current fleet state, ask Bedrock (Claude)
// for a re-route proposal and a short plain-language rationale (the on-stage
// "explainability trace"). Low-impact changes auto-apply; high-impact changes
// are written to PendingApprovals for a human dispatcher to approve.
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");
const { randomUUID } = require("crypto");
const { broadcast } = require("./broadcast");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const bedrock = new BedrockRuntimeClient({});
const VEHICLE_STATE_TABLE = process.env.VEHICLE_STATE_TABLE;
const PENDING_APPROVALS_TABLE = process.env.PENDING_APPROVALS_TABLE;
const MODEL_ID = process.env.BEDROCK_MODEL_ID;

// Approval gate: re-route affecting >2 stops OR adding >15 min delay needs a human.
const HIGH_IMPACT = (p) => (p.affectedStops ?? 0) > 2 || (p.estDelayMin ?? 0) > 15;

const SYSTEM = `You are a fleet re-routing agent for a delivery logistics demo.
All data is synthetic. You receive one disruption event and the current fleet
state. Return ONLY compact JSON, no prose, matching:
{"summary": string (<=2 sentences, plain language, why this re-route),
 "affectedStops": integer, "estDelayMin": integer,
 "detourWaypoints": [[lon,lat], ...] (2-4 points routing the vehicle around the problem)}`;

async function askBedrock(disruption, vehicles) {
  const user = `Disruption: ${JSON.stringify(disruption)}
Fleet state: ${JSON.stringify(vehicles.map((v) => ({
    vehicleId: v.vehicleId, lat: v.lat, lon: v.lon, routeId: v.routeId, stopsRemaining: v.stopsRemaining,
  })))}
Propose a re-route for vehicle ${disruption.vehicleId}.`;

  const body = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 500,
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
  };
  const res = await bedrock.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(body),
  }));
  const parsed = JSON.parse(Buffer.from(res.body).toString("utf8"));
  const text = parsed.content?.[0]?.text ?? "{}";
  const match = text.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : text);
}

// Deterministic fallback so the demo never stalls if Bedrock is slow/unavailable.
function fallbackProposal(disruption) {
  const { lat = 0, lon = 0 } = disruption;
  return {
    summary:
      `Road ${disruption.kind === "breakdown" ? "blocked by a disabled vehicle" : "closed"} ahead; ` +
      `routing one block east around the affected segment and rejoining the planned route.`,
    affectedStops: 2,
    estDelayMin: 8,
    detourWaypoints: [
      [lon + 0.0018, lat + 0.0004],
      [lon + 0.0020, lat + 0.0016],
      [lon + 0.0006, lat + 0.0022],
    ],
  };
}

exports.handler = async (disruption) => {
  const scan = await ddb.send(new ScanCommand({ TableName: VEHICLE_STATE_TABLE }));
  const vehicles = scan.Items || [];

  let proposal;
  try {
    proposal = await askBedrock(disruption, vehicles);
    if (!Array.isArray(proposal.detourWaypoints) || proposal.detourWaypoints.length === 0) {
      throw new Error("bad shape");
    }
  } catch (err) {
    console.error("bedrock failed, using fallback:", err.message);
    proposal = fallbackProposal(disruption);
  }

  const approvalId = randomUUID();
  const highImpact = HIGH_IMPACT(proposal);
  const item = {
    approvalId,
    vehicleId: disruption.vehicleId,
    disruptionId: disruption.disruptionId,
    proposal,
    highImpact,
    status: highImpact ? "pending" : "auto-approved",
    createdAt: Date.now(),
    ttl: Math.floor(Date.now() / 1000) + 60 * 60,
  };
  await ddb.send(new PutCommand({ TableName: PENDING_APPROVALS_TABLE, Item: item }));

  await broadcast({
    event: "agent_proposal",
    approvalId, vehicleId: disruption.vehicleId,
    rationale: proposal.summary,
    affectedStops: proposal.affectedStops, estDelayMin: proposal.estDelayMin,
    detourWaypoints: proposal.detourWaypoints,
    requiresApproval: highImpact,
  });

  if (!highImpact) {
    await broadcast({
      event: "route_update",
      vehicleId: disruption.vehicleId,
      detourWaypoints: proposal.detourWaypoints,
      approvalId, autoApplied: true,
    });
  }

  return { approvalId, highImpact };
};
