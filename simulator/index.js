#!/usr/bin/env node
// Synthetic conference demo - no real data.
// Vehicle telemetry simulator. Publishes synthetic GPS positions for N vehicles
// to a Kinesis Data Stream at a fixed interval, following predefined routes with
// small random jitter. Also exposes a "disruption" command to inject a road
// closure / breakdown event mid-demo.
//
// Usage:
//   node simulator/index.js run   --stream fleet-demo-telemetry --vehicles 8 --region eu-central-1
//   node simulator/index.js disrupt --stream fleet-demo-telemetry --vehicle veh-3 --kind road_closure
//   node simulator/index.js capture --out ../replay-data/session.json   (records what it would send)

const { KinesisClient, PutRecordsCommand, PutRecordCommand } = require("@aws-sdk/client-kinesis");
const { randomUUID } = require("crypto");
const fs = require("fs");
const path = require("path");
const routes = require("./routes");

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
const STREAM = args.stream || process.env.TELEMETRY_STREAM || "fleet-demo-telemetry";
const REGION = args.region || process.env.AWS_REGION || "eu-central-1";
const client = new KinesisClient({ region: REGION });

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) out[argv[i].slice(2)] = argv[i + 1]?.startsWith("--") ? true : argv[++i];
    else out._.push(argv[i]);
  }
  return out;
}

const jitter = (v, amt) => v + (Math.random() - 0.5) * amt;
const lerp = (a, b, t) => a + (b - a) * t;

function makeVehicles(n) {
  const routeIds = Object.keys(routes);
  return Array.from({ length: n }, (_, i) => {
    const routeId = routeIds[i % routeIds.length];
    return {
      vehicleId: `veh-${i + 1}`,
      routeId,
      seg: Math.floor(Math.random() * routes[routeId].length),
      t: Math.random(),
      speedKph: 24 + Math.random() * 12,
      disrupted: false,
    };
  });
}

function step(v) {
  const wp = routes[v.routeId];
  const a = wp[v.seg % wp.length];
  const b = wp[(v.seg + 1) % wp.length];
  v.t += 0.06 + Math.random() * 0.03;
  if (v.t >= 1) { v.t -= 1; v.seg = (v.seg + 1) % wp.length; }
  const lon = jitter(lerp(a[0], b[0], v.t), 0.0004);
  const lat = jitter(lerp(a[1], b[1], v.t), 0.0004);
  const heading = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI;
  return {
    type: "position",
    vehicleId: v.vehicleId,
    routeId: v.routeId,
    lat: +lat.toFixed(6),
    lon: +lon.toFixed(6),
    heading: +heading.toFixed(1),
    speed: +v.speedKph.toFixed(1),
    stopsRemaining: (wp.length - (v.seg % wp.length)),
    ts: Date.now(),
  };
}

async function putBatch(records) {
  if (!records.length) return;
  await client.send(new PutRecordsCommand({
    StreamName: STREAM,
    Records: records.map((r) => ({ Data: Buffer.from(JSON.stringify(r)), PartitionKey: r.vehicleId })),
  }));
}

async function runLive() {
  const n = parseInt(args.vehicles || "8", 10);
  const intervalMs = parseInt(args.interval || "1500", 10);
  const vehicles = makeVehicles(n);
  console.log(`[simulator] SYNTHETIC DATA. ${n} vehicles -> ${STREAM} (${REGION}) every ${intervalMs}ms`);
  const tick = async () => {
    const batch = vehicles.map(step);
    try { await putBatch(batch); process.stdout.write("."); }
    catch (e) { console.error("\n[simulator] put failed:", e.message); }
  };
  await tick();
  setInterval(tick, intervalMs);
}

async function disrupt() {
  const vehicleId = args.vehicle || "veh-3";
  const kind = args.kind || "road_closure";
  // place the disruption slightly ahead of the vehicle's current segment
  const v = makeVehicles(8).find((x) => x.vehicleId === vehicleId) || makeVehicles(8)[0];
  const pos = step(v);
  const evt = {
    type: "disruption",
    disruptionId: randomUUID(),
    kind,
    vehicleId,
    lat: pos.lat,
    lon: pos.lon,
    note: kind === "breakdown" ? "Disabled vehicle blocking the lane (synthetic)" : "Street closed for event (synthetic)",
    ts: Date.now(),
  };
  await client.send(new PutRecordCommand({
    StreamName: STREAM, Data: Buffer.from(JSON.stringify(evt)), PartitionKey: vehicleId,
  }));
  console.log("[simulator] disruption injected:", JSON.stringify(evt));
}

async function capture() {
  const out = path.resolve(args.out || "../replay-data/session.json");
  const seconds = parseInt(args.seconds || "40", 10);
  const vehicles = makeVehicles(parseInt(args.vehicles || "8", 10));
  const events = [];
  const t0 = Date.now();
  for (let s = 0; s < seconds; s++) {
    for (const v of vehicles) events.push({ at: Date.now() - t0, ...step(v) });
    if (s === 10) {
      const p = step(vehicles[2]);
      events.push({ at: Date.now() - t0, type: "disruption", disruptionId: randomUUID(), kind: "road_closure", vehicleId: vehicles[2].vehicleId, lat: p.lat, lon: p.lon, note: "Street closed for event (synthetic)", ts: Date.now() });
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ note: "SYNTHETIC capture for replay mode", events }, null, 2));
  console.log(`[simulator] wrote ${events.length} events -> ${out}`);
}

(async () => {
  if (cmd === "run") return runLive();
  if (cmd === "disrupt") return disrupt();
  if (cmd === "capture") return capture();
  console.log("commands: run | disrupt | capture  (see file header for flags)");
  process.exit(1);
})();
