#!/usr/bin/env node
// Synthetic conference demo - no real data.
// Builds the road-network graph the re-planner reasons over, from the four
// hand-drawn delivery loops in simulator/routes.js:
//   - every distinct waypoint becomes a :Junction node
//   - consecutive waypoints on a loop become bidirectional :ROAD edges,
//     weighted by travel time (minutes) at a nominal urban speed
//   - junctions on *different* loops that are physically close get a cross-link
//     :ROAD edge, so a detour actually has somewhere to go
//
// Output: backend/agent-invoker/road-graph.json  (bundled - the offline fallback)
// If NEO4J_URI / NEO4J_PASSWORD are set, the same graph is also loaded into the
// AuraDB Free instance the deployed agent queries.
const fs = require("fs");
const path = require("path");
const routes = require("../simulator/routes");

const SPEED_KMH = 25; // nominal urban speed for the demo
const CROSSLINK_M = 450; // junctions this close on different loops get linked

function haversineKm(a, b) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]), dLon = toRad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const minutesBetween = (a, b) => (haversineKm(a, b) / SPEED_KMH) * 60;

// ---- nodes: dedupe waypoints across all loops ----
const nodes = [];
const idByKey = new Map();
function nodeId(pt, routeId) {
  const key = `${pt[0].toFixed(5)},${pt[1].toFixed(5)}`;
  if (!idByKey.has(key)) {
    const id = `J${nodes.length}`;
    idByKey.set(key, id);
    nodes.push({ id, lon: pt[0], lat: pt[1], routeId });
  }
  return idByKey.get(key);
}

// ---- edges ----
const edgeSet = new Set();
const edges = [];
function addEdge(from, to, minutes, kind) {
  for (const [a, b] of [[from, to], [to, from]]) {
    const k = `${a}->${b}`;
    if (edgeSet.has(k)) continue;
    edgeSet.add(k);
    edges.push({ id: `${a}_${b}`, from: a, to: b, minutes: +minutes.toFixed(3), kind });
  }
}

for (const [routeId, wps] of Object.entries(routes)) {
  for (let i = 0; i < wps.length - 1; i++) {
    const a = nodeId(wps[i], routeId);
    const b = nodeId(wps[i + 1], routeId);
    if (a !== b) addEdge(a, b, minutesBetween(wps[i], wps[i + 1]), "route");
  }
}

// cross-links between nearby junctions on different loops
for (let i = 0; i < nodes.length; i++) {
  for (let j = i + 1; j < nodes.length; j++) {
    if (nodes[i].routeId === nodes[j].routeId) continue;
    const km = haversineKm([nodes[i].lon, nodes[i].lat], [nodes[j].lon, nodes[j].lat]);
    if (km * 1000 <= CROSSLINK_M) {
      addEdge(nodes[i].id, nodes[j].id, (km / SPEED_KMH) * 60, "crosslink");
    }
  }
}

const graph = { note: "SYNTHETIC road graph for the demo re-planner. No real data.", nodes, edges };
const out = path.resolve(__dirname, "../backend/agent-invoker/road-graph.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(graph, null, 2));
console.log(`wrote ${nodes.length} junctions, ${edges.length} directed road edges -> ${out}`);

// ---- optionally load into AuraDB Free ----
async function loadNeo4j() {
  const { NEO4J_URI, NEO4J_USER = "neo4j", NEO4J_PASSWORD, NEO4J_DATABASE } = process.env;
  if (!NEO4J_URI || !NEO4J_PASSWORD) {
    console.log("(NEO4J_URI / NEO4J_PASSWORD not set - skipped loading the graph into Aura)");
    return;
  }
  const neo4j = require("../backend/agent-invoker/node_modules/neo4j-driver");
  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
  const database = NEO4J_DATABASE || undefined;
  await driver.executeQuery("MATCH (n:Junction) DETACH DELETE n", {}, { database });
  await driver.executeQuery(
    `UNWIND $nodes AS n MERGE (j:Junction {id: n.id})
       SET j.lon = n.lon, j.lat = n.lat, j.routeId = n.routeId`,
    { nodes }, { database });
  await driver.executeQuery(
    `UNWIND $edges AS e
       MATCH (a:Junction {id: e.from}), (b:Junction {id: e.to})
       MERGE (a)-[r:ROAD {id: e.id}]->(b)
       SET r.minutes = e.minutes, r.kind = e.kind`,
    { edges }, { database });
  const c = await driver.executeQuery(
    "MATCH (:Junction)-[r:ROAD]->(:Junction) RETURN count(r) AS c", {}, { database });
  console.log(`loaded into Aura: ${nodes.length} junctions, ${c.records[0].get("c")} road edges`);
  await driver.close();
}

loadNeo4j().catch((e) => { console.error("Aura load failed:", e.message); process.exitCode = 1; });
