// Synthetic conference demo - no real data.
// The road-network graph the re-planner reasons over.
//
// System of record: an AuraDB Free instance, loaded by scripts/build-graph.js
// (junctions as :Junction, road segments as :ROAD {minutes}). At runtime the
// agent pulls the whole graph in one Cypher query - it is tiny (~50 nodes) - so
// the pathfinding + matrix logic below runs identically whether the graph came
// from Neo4j or from the bundled road-graph.json fallback.
//
// Secret (NEO4J_SECRET_ARN) JSON:
//   { "uri": "...", "user": "...", "password": "...", "database": "..." }
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

let neo4j = null;
try { neo4j = require("neo4j-driver"); } catch { /* disabled */ }

const SECRET_ARN = process.env.NEO4J_SECRET_ARN;
const sm = new SecretsManagerClient({});
const STATIC_GRAPH = require("./road-graph.json");
const CLOSE_M = 120; // a disruption within this distance of a road segment closes it

let graphPromise = null;

async function creds() {
  // direct env (local dev) takes precedence over the Secrets Manager lookup
  if (process.env.NEO4J_URI && process.env.NEO4J_PASSWORD) {
    return {
      uri: process.env.NEO4J_URI, user: process.env.NEO4J_USER || "neo4j",
      password: process.env.NEO4J_PASSWORD, database: process.env.NEO4J_DATABASE,
    };
  }
  const res = await sm.send(new GetSecretValueCommand({ SecretId: SECRET_ARN }));
  return JSON.parse(res.SecretString || "{}");
}

async function fetchFromNeo4j() {
  const { uri, user, password, database } = await creds();
  if (!uri || !password) throw new Error("secret missing uri/password");
  const driver = neo4j.driver(uri, neo4j.auth.basic(user || "neo4j", password), {
    connectionAcquisitionTimeout: 5000, maxConnectionPoolSize: 3,
  });
  try {
    await driver.verifyConnectivity();
    const db = database || undefined;
    const nq = await driver.executeQuery(
      "MATCH (j:Junction) RETURN j.id AS id, j.lon AS lon, j.lat AS lat, j.routeId AS routeId", {}, { database: db });
    const eq = await driver.executeQuery(
      "MATCH (a:Junction)-[r:ROAD]->(b:Junction) RETURN r.id AS id, a.id AS from, b.id AS to, r.minutes AS minutes", {}, { database: db });
    if (!nq.records.length) throw new Error("no :Junction nodes in Aura - run scripts/build-graph.js");
    const nodes = nq.records.map((r) => ({ id: r.get("id"), lon: r.get("lon"), lat: r.get("lat"), routeId: r.get("routeId") }));
    const edges = eq.records.map((r) => ({ id: r.get("id"), from: r.get("from"), to: r.get("to"), minutes: r.get("minutes") }));
    console.log(`[graph] loaded from Aura: ${nodes.length} junctions, ${edges.length} road edges`);
    return { nodes, edges, source: "neo4j" };
  } finally {
    await driver.close();
  }
}

async function getGraph() {
  if (!graphPromise) {
    graphPromise = (async () => {
      if (neo4j && (SECRET_ARN || process.env.NEO4J_URI)) {
        try { return index(await fetchFromNeo4j()); }
        catch (err) { console.warn("[graph] Aura unavailable, using bundled road-graph.json:", err.message); }
      } else {
        console.log("[graph] no Neo4j configured - using bundled road-graph.json");
      }
      return index({ ...STATIC_GRAPH, source: "bundled" });
    })();
  }
  return graphPromise;
}

// add adjacency + helpers to a raw {nodes, edges}
function index(g) {
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const adj = new Map(g.nodes.map((n) => [n.id, []]));
  for (const e of g.edges) adj.get(e.from)?.push(e);
  return { ...g, byId, adj };
}

const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
function metres(a, b) {
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// local-plane metres relative to a reference lat (fine at city scale)
function xy(p, ref) {
  return [toRad(p.lon) * R * Math.cos(toRad(ref)), toRad(p.lat) * R];
}
// distance from point p to segment a-b, in metres
function pointToSegment(p, a, b) {
  const ref = a.lat;
  const [px, py] = xy(p, ref), [ax, ay] = xy(a, ref), [bx, by] = xy(b, ref);
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function nearestJunction(g, lon, lat, routeId) {
  const p = { lon, lat };
  let best = null, bestD = Infinity;
  for (const n of g.nodes) {
    if (routeId && n.routeId !== routeId) continue;
    const d = metres(n, p);
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}

// segments whose midpoint is within CLOSE_M of the disruption coordinate
function closedEdgeIds(g, disruption) {
  if (!disruption || disruption.lat == null) return new Set();
  const p = { lon: disruption.lon, lat: disruption.lat };
  const cand = g.edges
    .map((e) => {
      const a = g.byId.get(e.from), b = g.byId.get(e.to);
      return a && b ? { e, d: pointToSegment(p, a, b) } : null;
    })
    .filter(Boolean)
    .sort((x, y) => x.d - y.d);
  const closed = new Set();
  for (const { e, d } of cand) {
    // close everything within CLOSE_M; if nothing qualifies, close the single
    // nearest segment so a disruption always has an effect.
    if (d <= CLOSE_M || (closed.size === 0 && d <= 400)) {
      closed.add(e.id);
      closed.add(`${e.to}_${e.from}`);
      closed.add(`${e.from}_${e.to}`);
    }
  }
  return closed;
}

// Dijkstra: shortest travel time (minutes) from -> to, skipping closed edges.
function dijkstra(g, fromId, toId, closed) {
  const dist = new Map([[fromId, 0]]);
  const prev = new Map();
  const seen = new Set();
  while (seen.size < g.nodes.length) {
    let u = null, ud = Infinity;
    for (const [k, d] of dist) if (!seen.has(k) && d < ud) { u = k; ud = d; }
    if (u == null) break;
    if (u === toId) break;
    seen.add(u);
    for (const e of g.adj.get(u) || []) {
      if (closed.has(e.id)) continue;
      const nd = ud + e.minutes;
      if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, u); }
    }
  }
  if (!dist.has(toId)) return { minutes: Infinity, path: [] };
  const path = [toId];
  while (prev.has(path[0])) path.unshift(prev.get(path[0]));
  return { minutes: dist.get(toId), path };
}

// The next `k` junctions along a vehicle's loop, starting after `currentId`.
function remainingStops(g, routeId, currentId, k) {
  const loop = g.nodes.filter((n) => n.routeId === routeId);
  if (!loop.length) return [];
  let start = loop.findIndex((n) => n.id === currentId);
  if (start < 0) start = 0;
  const out = [];
  for (let i = 1; i <= k; i++) out.push(loop[(start + i) % loop.length]);
  return out;
}

// all-pairs travel-time matrix over an ordered list of junction ids
function matrix(g, ids, closed) {
  return ids.map((a) => ids.map((b) => (a === b ? 0 : dijkstra(g, a, b, closed).minutes)));
}

function pathCoords(g, fromId, toId, closed, limit = 6) {
  const { path } = dijkstra(g, fromId, toId, closed);
  const pts = path.map((id) => g.byId.get(id)).filter(Boolean).map((n) => [n.lon, n.lat]);
  if (pts.length <= limit) return pts;
  // keep endpoints, thin the middle
  const step = (pts.length - 1) / (limit - 1);
  return Array.from({ length: limit }, (_, i) => pts[Math.round(i * step)]);
}

module.exports = {
  getGraph, nearestJunction, closedEdgeIds, remainingStops, matrix, pathCoords, dijkstra,
};
