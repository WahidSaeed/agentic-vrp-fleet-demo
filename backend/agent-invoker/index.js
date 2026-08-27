// Synthetic conference demo - no real data.
// Reasoning agent for the self-healing fleet. On a disruption it:
//   1. pulls the road-network graph (Neo4j / AuraDB, or the bundled fallback)
//   2. closes the road segments next to the disruption
//   3. asks HiGHS (an in-process MIP solver) for the fastest order to still hit
//      the disrupted vehicle's remaining stops, on the graph with those segments
//      removed  ->  new route + honest added-delay / stops-touched numbers
//   4. asks Bedrock (Converse API) to turn that solver result into the 2-3
//      sentence rationale shown on stage - the model explains, it does not do
//      the maths
// Low-impact changes auto-apply; high-impact changes wait for a human in
// PendingApprovals. Every step has a fallback so the demo never stalls.
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { BedrockRuntimeClient, ConverseCommand } = require("@aws-sdk/client-bedrock-runtime");
const { randomUUID } = require("crypto");
const { broadcast } = require("./broadcast");
const graph = require("./graph");
const { solveOpenTsp, inOrderMinutes } = require("./solve");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const bedrock = new BedrockRuntimeClient({});
const VEHICLE_STATE_TABLE = process.env.VEHICLE_STATE_TABLE;
const PENDING_APPROVALS_TABLE = process.env.PENDING_APPROVALS_TABLE;
const MODEL_ID = process.env.BEDROCK_MODEL_ID;
const STOPS_AHEAD = 4; // how many upcoming stops the re-planner considers

// Approval gate: re-route affecting >2 stops OR adding >15 min delay needs a human.
const HIGH_IMPACT = (p) => (p.affectedStops ?? 0) > 2 || (p.estDelayMin ?? 0) > 15;

// ---- the graph + MIP re-plan -------------------------------------------------
async function replan(disruption, vehicles) {
  const g = await graph.getGraph();
  const veh = vehicles.find((v) => v.vehicleId === disruption.vehicleId) || {};
  const routeId = veh.routeId || g.nodes[0].routeId;
  const here = graph.nearestJunction(
    g, veh.lon ?? disruption.lon, veh.lat ?? disruption.lat, routeId);

  const stops = graph.remainingStops(g, routeId, here.id, STOPS_AHEAD);
  if (!stops.length) throw new Error("no remaining stops for vehicle");

  const ids = [here.id, ...stops.map((s) => s.id)];
  const openM = graph.matrix(g, ids, new Set());
  const closed = graph.closedEdgeIds(g, disruption);
  const closedM = graph.matrix(g, ids, closed);

  const baseline = inOrderMinutes(openM);              // planned route, no disruption
  const { order, minutes } = await solveOpenTsp(closedM); // re-optimised around the closure

  const affectedStops = order.reduce((n, s, i) => n + (s !== i + 1 ? 1 : 0), 0)
    || (closed.size ? 1 : 0);
  const estDelayMin = Math.max(0, Math.round(minutes - baseline));

  const firstStop = stops[order[0] - 1];
  const detourWaypoints = graph.pathCoords(g, here.id, firstStop.id, closed);

  return {
    proposal: {
      summary: null, // filled by Bedrock (or the template fallback)
      affectedStops,
      estDelayMin,
      detourWaypoints: detourWaypoints.length ? detourWaypoints : [[firstStop.lon, firstStop.lat]],
    },
    trace: {
      graphSource: g.source,
      closedSegments: closed.size / 2,
      stopsConsidered: stops.length,
      baselineMin: Math.round(baseline),
      replannedMin: Math.round(minutes),
      newOrder: order,
      solver: "HiGHS open-TSP MIP",
    },
  };
}

// ---- Bedrock: explain the solver's plan in plain language ------------------
const SYSTEM = `You are the explainability voice of a fleet re-routing agent for a
logistics demo. All data is synthetic. A graph + MIP optimiser has ALREADY chosen
the re-route; your only job is to explain its decision.

Return ONLY compact JSON, no markdown: {"summary": string}
- "summary": 2-3 short sentences a dispatcher reads aloud. Name the disruption,
  say the route was re-optimised around the closed road, and state the trade-off
  using the numbers given (added delay, stops touched). Plain language, no jargon.`;

async function explain(disruption, proposal, trace) {
  const user = `Disruption: ${JSON.stringify({ kind: disruption.kind, note: disruption.note, vehicleId: disruption.vehicleId })}
Optimiser result: ${JSON.stringify({
    closedSegments: trace.closedSegments,
    stopsConsidered: trace.stopsConsidered,
    plannedMinutes: trace.baselineMin,
    replannedMinutes: trace.replannedMin,
    addedDelayMin: proposal.estDelayMin,
    stopsResequenced: proposal.affectedStops,
  })}
Explain this re-route.`;
  const res = await bedrock.send(new ConverseCommand({
    modelId: MODEL_ID,
    system: [{ text: SYSTEM }],
    messages: [{ role: "user", content: [{ text: user }] }],
    inferenceConfig: { maxTokens: 250, temperature: 0.3 },
  }));
  const text = res.output?.message?.content?.[0]?.text ?? "{}";
  const m = text.match(/\{[\s\S]*\}/);
  const out = JSON.parse(m ? m[0] : text);
  if (!out.summary) throw new Error("no summary");
  return out.summary;
}

function templatedSummary(disruption, proposal, trace) {
  const what = disruption.kind === "breakdown"
    ? "A disabled vehicle is blocking the lane"
    : "A road on the planned route is closed";
  return `${what} ahead of ${disruption.vehicleId}. The re-planner removed ` +
    `${trace.closedSegments} affected road segment(s) and re-optimised the next ` +
    `${trace.stopsConsidered} stops, resequencing ${proposal.affectedStops} of them. ` +
    `Estimated added delay: about ${proposal.estDelayMin} minute(s).`;
}

// ---- last-resort fallback (no graph, no solver) ---------------------------
function fallbackProposal(disruption) {
  const { lat = 0, lon = 0 } = disruption;
  return {
    proposal: {
      summary:
        `Road ${disruption.kind === "breakdown" ? "blocked by a disabled vehicle" : "closed"} ahead; ` +
        `routing one block east around the affected segment and rejoining the planned route.`,
      affectedStops: 3, estDelayMin: 12,
      detourWaypoints: [
        [lon + 0.0018, lat + 0.0004], [lon + 0.0020, lat + 0.0016], [lon + 0.0006, lat + 0.0022],
      ],
    },
    trace: { graphSource: "none", solver: "deterministic fallback" },
  };
}

exports.handler = async (disruption) => {
  const scan = await ddb.send(new ScanCommand({ TableName: VEHICLE_STATE_TABLE }));
  const vehicles = scan.Items || [];

  let proposal, trace;
  try {
    ({ proposal, trace } = await replan(disruption, vehicles));
  } catch (err) {
    console.error("replan failed, using deterministic fallback:", err.message);
    ({ proposal, trace } = fallbackProposal(disruption));
  }

  if (!proposal.summary) {
    try {
      proposal.summary = await explain(disruption, proposal, trace);
    } catch (err) {
      console.error("bedrock explain failed, using templated summary:", err.message);
      proposal.summary = templatedSummary(disruption, proposal, trace);
    }
  }

  const approvalId = randomUUID();
  const highImpact = HIGH_IMPACT(proposal);
  await ddb.send(new PutCommand({
    TableName: PENDING_APPROVALS_TABLE,
    Item: {
      approvalId,
      vehicleId: disruption.vehicleId,
      disruptionId: disruption.disruptionId,
      proposal, trace,
      highImpact,
      status: highImpact ? "pending" : "auto-approved",
      createdAt: Date.now(),
      ttl: Math.floor(Date.now() / 1000) + 60 * 60,
    },
  }));

  await broadcast({
    event: "agent_proposal",
    approvalId, vehicleId: disruption.vehicleId,
    rationale: proposal.summary,
    affectedStops: proposal.affectedStops, estDelayMin: proposal.estDelayMin,
    detourWaypoints: proposal.detourWaypoints,
    decisionTrace: trace,
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

  return { approvalId, highImpact, trace };
};
