// Dev-only QA driver. Reads the read-only inspector and uses normal DOM input events.
// Does not mutate simulation state, health, ammo, scores, or clock.
(async () => {
  const nav = await import("/src/game/navigation.ts");
  const press = (code, down) =>
    window.dispatchEvent(
      new KeyboardEvent(down ? "keydown" : "keyup", { code }),
    );
  const mouse = (button, down) =>
    window.dispatchEvent(
      new MouseEvent(down ? "mousedown" : "mouseup", { button }),
    );
  let goal = 0,
    path = [],
    tick = 0;
  window.__breachlineQa = {
    frames: 0,
    minFps: 999,
    maxKills: 0,
    shots: 0,
    maxDrawCalls: 0,
  };
  window.__breachlineQaTimer = setInterval(() => {
    const d = window.__breachlineDebug?.read();
    if (!d?.snapshot || !document.pointerLockElement) return;
    const s = d.snapshot,
      p = s.players.find((p) => p.id === d.id);
    if (!p) return;
    const q = window.__breachlineQa;
    q.frames++;
    q.minFps = Math.min(q.minFps, d.fps);
    q.maxKills = Math.max(q.maxKills, p.kills);
    q.shots = p.shots;
    q.maxDrawCalls = Math.max(q.maxDrawCalls, d.drawCalls);
    q.score = s.score;
    q.time = s.time;
    press("KeyW", false);
    press("ShiftLeft", false);
    mouse(0, false);
    mouse(2, false);
    if (!p.alive) return;
    if (p.ammo < 3) {
      press("KeyR", true);
      press("KeyR", false);
    }
    const visible = s.players
      .filter(
        (e) =>
          e.team !== p.team &&
          e.alive &&
          e.protection <= 0 &&
          Math.hypot(e.x - p.x, e.z - p.z) < 40 &&
          nav.clearLine(p, e, 1.5),
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
      )[0];
    let yaw,
      pitch = 0;
    if (visible) {
      yaw = Math.atan2(visible.x - p.x, visible.z - p.z);
      pitch = Math.atan2(
        p.y +
          (p.crouch ? 1.15 : 1.68) -
          (visible.y + (visible.crouch ? 0.88 : 1.3)),
        Math.hypot(visible.x - p.x, visible.z - p.z),
      );
      mouse(2, true);
      if (p.ammo > 0 && p.reloadTime <= 0) mouse(0, true);
    } else {
      if (!path.length || ++tick % 20 === 0) {
        if (
          Math.hypot(
            p.x - nav.patrolPoints[goal].x,
            p.z - nav.patrolPoints[goal].z,
          ) < 3
        )
          goal = (goal + 1) % nav.patrolPoints.length;
        path = nav.findPath(p, nav.patrolPoints[goal]);
      }
      while (path.length && Math.hypot(p.x - path[0].x, p.z - path[0].z) < 0.8)
        path.shift();
      if (path.length) {
        yaw = Math.atan2(path[0].x - p.x, path[0].z - p.z);
        press("KeyW", true);
        press("ShiftLeft", true);
      } else goal = (goal + 1) % nav.patrolPoints.length;
    }
    if (yaw !== undefined) {
      const difference = Math.atan2(
        Math.sin(yaw - d.yaw),
        Math.cos(yaw - d.yaw),
      );
      window.dispatchEvent(
        new MouseEvent("mousemove", {
          movementX: -difference / 0.00225,
          movementY: (pitch - d.pitch) / 0.00225,
        }),
      );
    }
  }, 60);
  return "QA driving via keyboard/mouse events";
})();
