// Synthetic conference demo - no real data.
// Replay-mode engine. Feeds a pre-recorded JSON event log into the same handler
// the live WebSocket client uses, on the original timeline, so the frontend
// cannot tell live from replay. Duplicated verbatim in the AML demo repo by
// design (no shared package / submodule).
//
// Event log shape: { events: [ { at: <ms since start>, ...payload } ] }
// Each payload is delivered to onMessage exactly as a live WS message would be.

export function createReplayEngine(log, onMessage, { loop = true, speed = 1 } = {}) {
  let timers = [];
  let running = false;

  function scheduleOnce(startOffset = 0) {
    const events = log.events || [];
    const maxAt = events.length ? events[events.length - 1].at : 0;
    for (const evt of events) {
      const { at, ...payload } = evt;
      timers.push(setTimeout(() => onMessage(payload), (at / speed) + startOffset));
    }
    if (loop) {
      timers.push(setTimeout(() => { clear(); scheduleOnce(0); }, (maxAt / speed) + 1500 + startOffset));
    }
  }

  function clear() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  return {
    start() {
      if (running) return;
      running = true;
      scheduleOnce();
    },
    stop() {
      running = false;
      clear();
    },
    isRunning: () => running,
  };
}

export async function loadReplayLog(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`replay log ${url}: ${res.status}`);
  return res.json();
}
