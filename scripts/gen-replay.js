#!/usr/bin/env node
// Synthetic conference demo - no real data.
// Generates replay-data/session.json in the SAME wire format the live WebSocket
// API broadcasts, so replay mode is byte-for-byte indistinguishable downstream.
// Re-run after changing routes: `node scripts/gen-replay.js`
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const routes = require("../simulator/routes");

const routeIds = Object.keys(routes);
const lerp = (a, b, t) => a + (b - a) * t;
const jit = (v) => v + (Math.random() - 0.5) * 0.0003;

const vehicles = Array.from({ length: 8 }, (_, i) => ({
  vehicleId: `veh-${i + 1}`,
  routeId: routeIds[i % routeIds.length],
  seg: Math.floor(Math.random() * 4),
  t: Math.random(),
}));

function pos(v) {
  const wp = routes[v.routeId];
  const a = wp[v.seg % wp.length];
  const b = wp[(v.seg + 1) % wp.length];
  v.t += 0.07;
  if (v.t >= 1) { v.t -= 1; v.seg = (v.seg + 1) % wp.length; }
  return {
    type: "position", vehicleId: v.vehicleId, routeId: v.routeId,
    lat: +jit(lerp(a[1], b[1], v.t)).toFixed(6),
    lon: +jit(lerp(a[0], b[0], v.t)).toFixed(6),
    heading: 0, speed: 28, stopsRemaining: wp.length - (v.seg % wp.length), ts: Date.now(),
  };
}

const events = [];
const DURATION = 38;
const disruptedVehicle = "veh-3";
const disruptionId = randomUUID();
const approvalId = randomUUID();
let detourWaypoints = [];

for (let s = 0; s < DURATION; s++) {
  const at = s * 1500;
  for (const v of vehicles) {
    const p = pos(v);
    events.push({ at, event: "position", vehicle: p });
    if (v.vehicleId === disruptedVehicle && s === 6) {
      detourWaypoints = [
        [p.lon + 0.0018, p.lat + 0.0004],
        [p.lon + 0.0020, p.lat + 0.0016],
        [p.lon + 0.0006, p.lat + 0.0022],
      ];
      events.push({ at: at + 200, event: "disruption", disruption: {
        type: "disruption", disruptionId, kind: "road_closure", vehicleId: disruptedVehicle,
        lat: p.lat, lon: p.lon, note: "Street closed for event (synthetic)", ts: Date.now(),
      }});
    }
  }
  if (s === 9) {
    events.push({ at, event: "agent_proposal",
      approvalId, vehicleId: disruptedVehicle,
      rationale: "Marienstrasse is closed for a street event, blocking the next two stops on this loop. Routing one block east via Luisenstrasse adds about 9 minutes and clears the closure without reordering the remaining deliveries.",
      affectedStops: 3, estDelayMin: 9, detourWaypoints, requiresApproval: true });
  }
  if (s === 16) {
    events.push({ at, event: "route_update", vehicleId: disruptedVehicle, detourWaypoints, approvalId, autoApplied: false });
  }
}

const out = path.resolve(__dirname, "../replay-data/session.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({
  note: "SYNTHETIC capture for offline replay mode. No real data.",
  disruptedVehicleId: disruptedVehicle,
  detourWaypoints,
  events,
}, null, 2));
console.log(`wrote ${events.length} events -> ${out}`);
