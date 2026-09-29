/* Browser acceptance driver: reads development telemetry and emits ordinary keyboard input.
 * No teleport, clock, score, session, or world mutations. Run with agent-browser eval. */
(() => {
  if (window.farestormAcceptanceTimer) clearInterval(window.farestormAcceptanceTimer);
  const held = new Set();
  const log = []; let lastReceipt = -1;
  const keys = desired => {
    for (const code of held) if (!desired.has(code)) {
      document.querySelector('canvas.game-canvas')?.dispatchEvent(new KeyboardEvent('keyup', { code, key: code.replace('Key', '').toLowerCase(), bubbles: true })); held.delete(code);
    }
    for (const code of desired) if (!held.has(code)) {
      document.querySelector('canvas.game-canvas')?.dispatchEvent(new KeyboardEvent('keydown', { code, key: code.replace('Key', '').toLowerCase(), bubbles: true })); held.add(code);
    }
  };
  window.farestormAcceptanceLog = log;
  window.farestormAcceptanceTimer = setInterval(() => {
    const s = window.__FARESTORM__?.snapshot();
    if (!s) return;
    if (s.result) { keys(new Set()); log.push({ result: s.result, metrics: window.__FARESTORM__.metrics() }); clearInterval(window.farestormAcceptanceTimer); return; }
    if (s.delivery && s.delivery.id !== lastReceipt) { lastReceipt = s.delivery.id; log.push({ receipt: s.delivery, position: s.vehicle }); }
    const desired = new Set();
    if (s.countdown <= 0 && s.status !== 'boarding' && s.target) {
      const v = s.vehicle, t = s.target;
      const distance = Math.hypot(t.x - v.x, t.z - v.z);
      const lookahead = Math.max(7, v.speed * .58);
      const p = s.route.find((p, i) => i > 0 && Math.hypot(p.x - v.x, p.z - v.z) > lookahead) || t;
      const angle = Math.atan2(Math.sin(Math.atan2(p.x - v.x, p.z - v.z) - v.heading), Math.cos(Math.atan2(p.x - v.x, p.z - v.z) - v.heading));
      const goalSpeed = distance < 2.5 ? 0 : Math.min(Math.abs(angle) > 1.1 ? 5 : Math.abs(angle) > .55 ? 9 : 24, Math.sqrt(Math.max(0, distance - 2) * 20));
      if (angle > .07) desired.add('KeyD'); else if (angle < -.07) desired.add('KeyA');
      if (v.speed < goalSpeed - .6) desired.add('KeyW');
      if (v.speed > goalSpeed + .4) desired.add('KeyS');
      if (distance < 4) desired.add('KeyE');
    }
    keys(desired);
  }, 16);
  return 'Acceptance driver running through real keyboard events.';
})();
