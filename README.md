# Agentic VRP — Self-Healing Logistics (conference demo)

A small, live-demoable fleet-management system where an LLM reasoning agent detects
delivery disruptions and re-plans vehicle routes automatically, with a
human-in-the-loop approval gate for high-impact changes. Built for a ~5-minute
live segment at an AWS community event.

> **This is demo code with 100% synthetic data — not a production system.**
> All vehicle telemetry, routes, driver activity, and disruptions are generated.
> Infrastructure is plain AWS CloudFormation (via SAM) so it tears down to nothing
> with a single `delete-stack` call.
>
> Talk: _Agentic VRP — Self-Healing Logistics_ (link TBD — add slide URL here).
> Companion demo: [`aml-streaming-demo`](https://github.com/WahidSaeed/aml-streaming-demo) (same ingest→stream→process→deliver pattern).

---

## Architecture (demo-scoped)

```
 simulator (local Node)                     AWS (infra/fleet-demo.yaml)
 ┌────────────────────┐   PutRecords   ┌──────────────────────────────────────────┐
 │ synthetic GPS +    │ ─────────────► │ Kinesis Data Stream (on-demand)          │
 │ disruption events  │                │        │                                 │
 └────────────────────┘                │        ▼                                 │
                                       │ Lambda: stream-processor                 │
                                       │   • upsert VehicleState (DynamoDB)       │
                                       │   • broadcast position deltas (WS)       │
                                       │   • on disruption → invoke agent         │
                                       │        │                                 │
                                       │        ▼                                 │
                                       │ Lambda: agent-invoker                    │
                                       │   • Bedrock Converse → re-route + reason │
                                       │   • approval gate → PendingApprovals     │
                                       │   • broadcast agent_proposal (WS)        │
                                       │        │                                 │
                                       │        ▼                                 │
                                       │ Lambda: dispatcher ($default WS route)   │
                                       │   • approve/reject → route_update (WS)   │
                                       │                                          │
                                       │ API Gateway WebSocket API ──► frontend   │
                                       │ (driver map + dispatcher approval panel) │
                                       └──────────────────────────────────────────┘
```

**Deliberate simplifications** (production would differ):
- Simulator publishes **directly to Kinesis**. Production would use AWS IoT Core.
- Route graph is a small in-code adjacency list, not Neo4j. Local Docker Neo4j is
  fine for dev but is intentionally *not* in the CloudFormation template.
- Orchestration is a plain Lambda chain, not Step Functions.
- Frontend is a static build on **S3 + CloudFront**, both declared in the template
  so they tear down with `delete-stack`. The hosted page defaults to replay mode;
  `?live` on the URL drives the deployed WebSocket API. You can also run it locally
  (`npm run dev`) against the same stack.
- WebSocket auth is a shared short-lived demo token, not IAM/JWT. It is baked into
  the public bundle for `?live` mode — rotate `DemoName` per event.

**One bootstrap resource outside the template:** `deploy.sh` creates a dedicated,
private, un-versioned S3 bucket `fleet-demo-artifacts-<account>-<region>` to hold
the packaged Lambda zips (a bucket must exist *before* CloudFormation can be
packaged). It is **not** the shared `aws-sam-cli-managed-default` stack — this demo
owns it, it is tagged `Demo=fleet`, and `teardown.sh` empties and deletes it.

## Repo layout

| Path | What |
|---|---|
| `infra/fleet-demo.yaml` | The entire stack (SAM/CloudFormation). |
| `backend/stream-processor` | Kinesis-triggered: state + broadcast + agent trigger. |
| `backend/agent-invoker` | Bedrock reasoning + approval gate. |
| `backend/dispatcher` | WebSocket `$default` route: approve/reject. |
| `backend/ws-handlers` | `$connect` (token check) / `$disconnect`. |
| `simulator/` | Local vehicle telemetry + `disrupt` command. |
| `frontend/` | React + Vite + MapLibre; `/driver` and `/dispatcher`. |
| `shared/` | Replay engine + WS client (duplicated in the AML repo by design). |
| `replay-data/session.json` | Captured good run for offline **replay mode**. |
| `scripts/` | `deploy.sh`, `teardown.sh`, `seed-data.sh`, `smoke-test.sh`, `gen-replay.js`. |

---

## Setup from a clean machine (~10–15 min)

Prereqs: AWS CLI v2 (authenticated), AWS SAM CLI, Node 20+, and **Bedrock model
access** enabled in your region. Default is the `eu-central-1` cross-region
inference profile `eu.amazon.nova-lite-v1:0` (fast + cheap,
ideal on stage); override `BedrockModelId` in `infra/samconfig.toml` for another.

```bash
git clone https://github.com/WahidSaeed/agentic-vrp-fleet-demo
cd agentic-vrp-fleet-demo

# 1. infra config
cp infra/samconfig.toml.example infra/samconfig.toml   # edit region / model id if needed

# 2. deploy: stack + builds/publishes the frontend to CloudFront, prints outputs
#    incl. SiteUrl (hosted, replay) and SiteUrl/?live (deployed WebSocket API)
./scripts/deploy.sh

# 3. (local dev, optional) deploy.sh writes frontend/.env.production; for `npm run dev`
#    copy frontend/.env.example -> .env.local and fill VITE_WS_URL / VITE_WS_TOKEN
cd frontend && npm install && npm run dev      # http://localhost:5173/driver

# 4. simulator (feeds both local + hosted ?live)
cd simulator && npm install
node index.js run --stream <TelemetryStreamName output> --region eu-central-1 --vehicles 8
```

### Replay mode (offline — no AWS needed)

```bash
cd frontend
cp .env.example .env.local          # VITE_DEMO_MODE=replay  (the default)
npm install && npm run dev
```

Replay mode feeds `replay-data/session.json` through the exact same UI code path
as live mode — visually identical. Regenerate the log with `node scripts/gen-replay.js`.

---

## Live demo script (~5 min)

| Time | Action | On screen |
|---|---|---|
| 0:00 | Open `/driver`. 8 vehicles moving on the Berlin map. | "Synthetic fleet, live telemetry through Kinesis." |
| 0:40 | Switch to `/dispatcher`, show empty approval queue. | "A human still owns high-impact calls." |
| 1:10 | Trigger disruption: `node simulator/index.js disrupt --stream <name> --vehicle veh-3 --kind road_closure` | Red pulse appears on the map; vehicle marker turns red. |
| 1:25 | Stream processor fires the agent. | Driver view: "Disruption detected". |
| 1:40 | Agent proposal arrives (Bedrock rationale). | Dispatcher: rationale text + "HIGH IMPACT · 3 stops · ~9 min". |
| 2:10 | Read the rationale aloud — **the explainability moment**. | 2–3 sentence plain-language re-route reason. |
| 2:30 | Click **Approve & dispatch**. | Orange dashed detour draws on the map; red clears. |
| 2:50 | Switch to `/driver` — detour is live there too. | "Same broadcast, every client." |
| 3:10 | Recap the loop: detect → reason → gate → dispatch, < 30 s. | Point at the architecture slide. |
| 3:40 | (Talk 2 tie-in) Expand "Architecture pattern" on the dispatcher panel. | "Identical shape to the AML demo." |

Full disruption → re-plan → approval → dispatch completes well under 30 seconds.

---

## Troubleshooting on stage

| Failure | Symptom | Recover live |
|---|---|---|
| **Conference Wi-Fi drops** | WS status shows `reconnecting`; map freezes. | Stop talking to AWS: kill the dev server, set `VITE_DEMO_MODE=replay` in `.env.local`, `npm run dev`, reload. Replay is visually identical. Practise this switch — it's ~15 s. |
| **AWS throttling / slow Bedrock** | Proposal takes >5 s or never arrives. | The agent Lambda has a deterministic fallback proposal — it will still arrive with a canned-but-sensible rationale. If nothing comes, re-run the `disrupt` command; it's idempotent for the demo. |
| **Browser refresh mid-demo** | State resets, queue empty. | The driver view rebuilds from the next position broadcasts within ~2 s. If a proposal was mid-flight, re-run `disrupt`. In replay mode just wait — the loop restarts every ~40 s. |
| **A view throws** | "View hiccup — recovering" card. | Click "Reload view"; the error boundary keeps the rest of the app alive. |

---

## Cost

On-demand everything, no idle hourly charges:

| Resource | Idle cost | During a demo run |
|---|---|---|
| Kinesis Data Stream (on-demand) | ~$0 (no data) / ~$0.04/hr baseline while it exists | pennies |
| DynamoDB (on-demand) | $0 | pennies |
| Lambda | $0 | free-tier / pennies |
| API Gateway WebSocket | $0 | pennies |
| Bedrock (Amazon Nova Lite) | $0 | well under $0.01 per proposal |
| CloudWatch Logs (3-day retention) | negligible | negligible |

**Estimate: under $2/month if left running, ~$0 once torn down.** The only resource
with any standing cost is the Kinesis on-demand stream — tear the stack down when
not rehearsing.

---

## How to prove it's really gone (after the conference)

```bash
./scripts/teardown.sh          # delete-stack + wait + tag verification, exits non-zero if anything remains
```

Manual double-check:

```bash
# 1. stack no longer exists
aws cloudformation describe-stacks --stack-name fleet-demo --region eu-central-1
#   -> "Stack with id fleet-demo does not exist"

# 2. nothing tagged for this demo remains
aws resourcegroupstaggingapi get-resources --region eu-central-1 \
  --tag-filters Key=Project,Values=aws-community-day-demo Key=Demo,Values=fleet \
  --query "ResourceTagMappingList[].ResourceARN"
#   -> []

# 3. no leftover log groups
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/fleet-demo --region eu-central-1 \
  --query "logGroups[].logGroupName"
#   -> []
```

All stateful resources in `fleet-demo.yaml` set `DeletionPolicy: Delete` explicitly
(no `Retain` anywhere), and log groups are declared in the template rather than
auto-created by Lambda, so `delete-stack` removes everything.
