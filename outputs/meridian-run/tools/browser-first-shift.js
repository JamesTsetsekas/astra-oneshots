// Reproducible normal-input browser test. Reads a DEV-only snapshot; never changes game state.
(() => {
  const bridge = window.__meridian;
  if (!bridge) throw new Error("DEV read-only bridge unavailable");
  const held = new Set();
  const set = (codes) => {
    const desired = new Set(codes);
    for (const code of held)
      if (!desired.has(code)) {
        window.dispatchEvent(
          new KeyboardEvent("keyup", { code, bubbles: true }),
        );
        held.delete(code);
      }
    for (const code of desired)
      if (!held.has(code)) {
        held.add(code);
        window.dispatchEvent(
          new KeyboardEvent("keydown", { code, bubbles: true }),
        );
      }
  };
  const pulse = (code) => {
    set([code]);
    setTimeout(() => set([]), 140);
  };
  const points = [
    { x: -174, z: -194 },
    { x: -162, z: -180 },
    { x: -15, z: -180 },
    { x: 0, z: -193 },
    { x: 0, z: -255 },
  ];
  let index = 0,
    lastPulse = 0;
  const begun = Date.now();
  window.__pilot = { phase: "driving", log: [] };
  const timer = setInterval(() => {
    const s = bridge.snapshot(),
      p = s.player,
      now = Date.now(),
      m = s.mission;
    if (now - begun > 240000 || s.result || p.dead) {
      clearInterval(timer);
      set([]);
      window.__pilot.result = s.result ?? "timed out";
      window.__pilot.final = { player: p, mission: m };
      return;
    }
    if (bridge.status().paused) return;
    if (s.time % 2 < 0.06)
      window.__pilot.log.push({
        time: s.time,
        x: p.x,
        z: p.z,
        speed: p.speed,
        stage: m?.stage,
      });
    if (m?.stage === 0) {
      const dx = -174 - p.x,
        dz = -298 - p.z;
      if (Math.hypot(dx, dz) < 4.7) {
        if (now - lastPulse > 700) {
          pulse("KeyE");
          lastPulse = now;
        }
        return;
      }
      const yaw = bridge.camera().yaw,
        right = dx * Math.cos(yaw) - dz * Math.sin(yaw),
        forward = dx * Math.sin(yaw) + dz * Math.cos(yaw);
      set([
        ...(right > 1 ? ["KeyD"] : right < -1 ? ["KeyA"] : []),
        ...(forward > 1 ? ["KeyW"] : forward < -1 ? ["KeyS"] : []),
      ]);
      return;
    }
    if (m?.stage === 1 && p.vehicleId !== undefined) {
      const goal = points[index],
        dx = goal.x - p.x,
        dz = goal.z - p.z,
        d = Math.hypot(dx, dz);
      if (d < 9 && index < points.length - 1) {
        index++;
        return;
      }
      let error = Math.atan2(dx, dz) - p.heading;
      error = Math.atan2(Math.sin(error), Math.cos(error));
      const desired =
        index === points.length - 1 && d < 10
          ? 0
          : Math.abs(error) > 0.6
            ? 5
            : Math.min(15, 6 + d * 0.15);
      const codes = [];
      if (error > 0.075) codes.push("KeyD");
      if (error < -0.075) codes.push("KeyA");
      if (p.speed > desired + 1) codes.push("KeyS");
      else if (p.speed < desired - 0.5) codes.push("KeyW");
      if (desired === 0) codes.push("Space");
      set(codes);
      window.__pilot.waypoint = index;
      return;
    }
    if (m?.stage === 2) {
      window.__pilot.phase = "handoff";
      if (p.vehicleId !== undefined) {
        if (p.speed > 1) set(["Space"]);
        else if (now - lastPulse > 600) {
          pulse("KeyF");
          lastPulse = now;
        }
        return;
      }
      const dx = 3 - p.x,
        dz = -249 - p.z;
      if (Math.hypot(dx, dz) < 4.3) {
        if (now - lastPulse > 600) {
          pulse("KeyE");
          lastPulse = now;
        }
        return;
      }
      const yaw = bridge.camera().yaw,
        right = dx * Math.cos(yaw) - dz * Math.sin(yaw),
        forward = dx * Math.sin(yaw) + dz * Math.cos(yaw);
      set([
        ...(right > 0.8 ? ["KeyD"] : right < -0.8 ? ["KeyA"] : []),
        ...(forward > 0.8 ? ["KeyW"] : forward < -0.8 ? ["KeyS"] : []),
      ]);
    }
  }, 30);
  return "First Shift input-only pilot started";
})();
