// Synthetic conference demo - no real data.
import MapView from "./MapView.jsx";
import { useFleet } from "./useFleet.js";

export default function DriverView() {
  const { state, status, mode } = useFleet("driver");
  const count = Object.keys(state.vehicles).length;
  return (
    <div className="view">
      <MapView vehicles={state.vehicles} disruption={state.disruption} />
      <aside className="panel">
        <div className="status-row">
          <span className={`dot ${status === "connected" || status === "replay" ? "ok" : "warn"}`} />
          <span>{mode.toUpperCase()} · {status} · {count} vehicles</span>
        </div>
        {state.disruption && (
          <div className="card alert">
            <h3>Disruption detected</h3>
            <p>{state.disruption.note}</p>
            <p className="muted">Vehicle {state.disruption.vehicleId} · {state.disruption.kind}</p>
          </div>
        )}
        {state.proposal && (
          <div className="card">
            <h3>Agent re-route {state.proposal.resolved ? `(${state.proposal.resolved})` : "proposed"}</h3>
            <p>{state.proposal.rationale}</p>
            <p className="muted">
              {state.proposal.affectedStops} stops affected · ~{state.proposal.estDelayMin} min ·
              {state.proposal.requiresApproval ? " awaiting dispatcher" : " auto-applied"}
            </p>
          </div>
        )}
        {!state.disruption && !state.proposal && <p className="muted">All routes nominal.</p>}
      </aside>
    </div>
  );
}
