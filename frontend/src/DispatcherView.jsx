// Synthetic conference demo - no real data.
import MapView from "./MapView.jsx";
import { useFleet } from "./useFleet.js";

export default function DispatcherView() {
  const { state, status, mode, approve, reject } = useFleet("dispatcher");
  const p = state.proposal;
  const pending = p && p.requiresApproval && !p.resolved;

  return (
    <div className="view">
      <MapView vehicles={state.vehicles} disruption={state.disruption} />
      <aside className="panel">
        <div className="status-row">
          <span className={`dot ${status === "connected" || status === "replay" ? "ok" : "warn"}`} />
          <span>{mode.toUpperCase()} · {status}</span>
        </div>

        <h2>Approval queue</h2>
        {!p && <p className="muted">No pending re-routes.</p>}

        {p && (
          <div className={`card ${pending ? "alert" : ""}`}>
            <h3>Vehicle {p.vehicleId}</h3>
            <p className="rationale">{p.rationale}</p>
            <p className="muted">
              {p.affectedStops} stops · ~{p.estDelayMin} min added
              {p.resolved ? ` · ${p.resolved}` : p.requiresApproval ? " · HIGH IMPACT" : " · auto-approved"}
            </p>
            {pending && (
              <div className="actions">
                <button className="approve" onClick={() => approve(p.approvalId)}>Approve &amp; dispatch</button>
                <button className="reject" onClick={() => reject(p.approvalId)}>Reject</button>
              </div>
            )}
          </div>
        )}

        <details className="pattern">
          <summary>Architecture pattern (Talk 2)</summary>
          <p>ingest → <b>stream</b> → process → deliver. Same shape as the AML demo:
          Kinesis → Lambda → DynamoDB → WebSocket broadcast.</p>
        </details>
      </aside>
    </div>
  );
}
