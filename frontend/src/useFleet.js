// Synthetic conference demo - no real data.
// Single source of truth for fleet state. Wires either the live WebSocket client
// or the replay engine to the same message handler, so the UI is identical.
import { useEffect, useRef, useReducer, useCallback, useState } from "react";
import { createWsClient } from "@shared/wsClient.js";
import { createReplayEngine, loadReplayLog } from "@shared/replayEngine.js";

const MODE = import.meta.env.VITE_DEMO_MODE || "replay";

const initial = { vehicles: {}, disruption: null, proposal: null, lastEvent: null };

function reducer(state, msg) {
  switch (msg.event) {
    case "position": {
      const v = msg.vehicle;
      return { ...state, vehicles: { ...state.vehicles, [v.vehicleId]: { ...state.vehicles[v.vehicleId], ...v } }, lastEvent: msg };
    }
    case "disruption":
      return { ...state, disruption: msg.disruption, lastEvent: msg };
    case "agent_proposal":
      return { ...state, proposal: msg, lastEvent: msg };
    case "route_update": {
      const cur = state.vehicles[msg.vehicleId] || {};
      return {
        ...state,
        disruption: null,
        proposal: state.proposal ? { ...state.proposal, resolved: "approved" } : null,
        vehicles: { ...state.vehicles, [msg.vehicleId]: { ...cur, activeDetour: msg.detourWaypoints } },
        lastEvent: msg,
      };
    }
    case "proposal_rejected":
      return { ...state, proposal: state.proposal ? { ...state.proposal, resolved: "rejected" } : null, disruption: null, lastEvent: msg };
    default:
      return { ...state, lastEvent: msg };
  }
}

export function useFleet(role = "driver") {
  const [state, dispatch] = useReducer(reducer, initial);
  const [status, setStatus] = useState(MODE === "replay" ? "replay" : "connecting");
  const clientRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    if (MODE === "replay") {
      loadReplayLog(import.meta.env.VITE_REPLAY_URL || "/session.json")
        .then((log) => {
          if (cancelled) return;
          const engine = createReplayEngine(log, dispatch, { loop: true });
          engine.start();
          clientRef.current = {
            replay: true,
            engine,
            approve: () => dispatch({ event: "route_update", vehicleId: log.disruptedVehicleId || "veh-3", detourWaypoints: log.detourWaypoints || [] }),
            reject: () => dispatch({ event: "proposal_rejected" }),
          };
          setStatus("replay");
        })
        .catch((e) => setStatus("replay log missing: " + e.message));
      return () => { cancelled = true; clientRef.current?.engine?.stop(); };
    }

    const client = createWsClient({
      url: import.meta.env.VITE_WS_URL,
      token: import.meta.env.VITE_WS_TOKEN,
      role,
      onMessage: dispatch,
      onStatus: setStatus,
    });
    clientRef.current = client;
    return () => client.close();
  }, [role]);

  const approve = useCallback((id) => {
    const c = clientRef.current;
    if (!c) return;
    c.replay ? c.approve(id) : c.approve(id);
  }, []);
  const reject = useCallback((id) => {
    const c = clientRef.current;
    if (!c) return;
    c.replay ? c.reject(id) : c.reject(id);
  }, []);

  return { state, status, mode: MODE, approve, reject };
}
