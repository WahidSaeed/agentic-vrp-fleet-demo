// Synthetic conference demo - no real data.
// Minimal WebSocket client with auto-reconnect + exponential backoff.
// Duplicated verbatim in the AML demo repo by design.

export function createWsClient({ url, token, role = "driver", onMessage, onStatus = () => {} }) {
  let ws = null;
  let closedByUs = false;
  let attempt = 0;
  let heartbeat = null;

  function connect() {
    const full = `${url}?token=${encodeURIComponent(token)}&role=${encodeURIComponent(role)}`;
    onStatus("connecting");
    ws = new WebSocket(full);

    ws.onopen = () => {
      attempt = 0;
      onStatus("connected");
      send({ action: "subscribe" });
      heartbeat = setInterval(() => send({ action: "subscribe" }), 5 * 60 * 1000);
    };
    ws.onmessage = (e) => {
      try { onMessage(JSON.parse(e.data)); } catch { /* ignore non-JSON */ }
    };
    ws.onclose = () => {
      clearInterval(heartbeat);
      if (closedByUs) return;
      const delay = Math.min(1000 * 2 ** attempt++, 15000);
      onStatus(`reconnecting in ${Math.round(delay / 1000)}s`);
      setTimeout(connect, delay);
    };
    ws.onerror = () => ws && ws.close();
  }

  function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }

  connect();

  return {
    send,
    approve: (approvalId) => send({ action: "approve", approvalId }),
    reject: (approvalId) => send({ action: "reject", approvalId }),
    close: () => { closedByUs = true; clearInterval(heartbeat); ws && ws.close(); },
  };
}
