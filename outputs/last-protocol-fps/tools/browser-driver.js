// Input-only QA: no mutable simulation access, no damage/money/time edits.
(async () => {
  const nav = await import("/src/game/navigation.ts");
  const key = (code, down) =>
    window.dispatchEvent(
      new KeyboardEvent(down ? "keydown" : "keyup", { code }),
    );
  const mouse = (button, down) =>
    window.dispatchEvent(
      new MouseEvent(down ? "mousedown" : "mouseup", { button }),
    );
  const button = (text) =>
    Array.from(document.querySelectorAll("button")).find(
      (b) =>
        !b.disabled &&
        (b.innerText.trim() === text || b.innerText.includes(text)),
    );
  let path = [],
    repath = 0,
    lastRound = 0,
    buyStage = 0,
    buyStarted = 0;
  window.__protocolQa = {
    frames: 0,
    minFps: 999,
    maxDrawCalls: 0,
    maxKills: 0,
    plants: 0,
    defuses: 0,
    rounds: 0,
    buyClicks: 0,
  };
  window.__protocolQaTimer = setInterval(() => {
    const d = window.__protocolDebug?.read();
    if (!d) return;
    const s = d.snapshot,
      p = s.players.find((p) => p.id === "local"),
      q = window.__protocolQa;
    q.frames++;
    q.minFps = Math.min(q.minFps, d.fps);
    q.maxDrawCalls = Math.max(q.maxDrawCalls, d.drawCalls);
    q.maxKills = Math.max(q.maxKills, p.kills);
    q.plants = p.plants;
    q.defuses = p.defuses;
    q.rounds = s.round;
    q.score = s.score;
    q.time = s.time;
    q.phase = s.phase;
    q.attacker = s.attacker;
    if (s.round !== lastRound) {
      lastRound = s.round;
      buyStage = 0;
      path = [];
    }
    if (s.phase === "buy") {
      if (!buyStage) {
        if (document.pointerLockElement) {
          key("KeyB", true);
          key("KeyB", false);
        } else button("B / BUY EQUIPMENT")?.click();
        buyStage = 1;
        buyStarted = performance.now();
        return;
      }
      if (performance.now() - buyStarted < 350) return;
      if (buyStage === 1) {
        button(p.money >= 2650 && !p.primary ? "Rifle" : "Armor")?.click();
        buyStage = 2;
        buyStarted = performance.now();
        return;
      }
      if (buyStage === 2) {
        const choice =
          p.money >= 2900 && !p.primary
            ? "Krait 7"
            : p.money >= 2650 && !p.primary
              ? "Aster 4"
              : p.money >= 1000 && !p.helmet
                ? "Vest + helmet"
                : p.money >= 650 && p.armor < 100
                  ? "Ballistic vest"
                  : undefined;
        if (choice) {
          button(choice)?.click();
          q.buyClicks++;
        }
        buyStage = 3;
        buyStarted = performance.now();
        return;
      }
      if (buyStage === 3) {
        button("READY / CLOSE")?.click();
        buyStage = 4;
        return;
      }
      return;
    }
    if (!document.pointerLockElement) return;
    for (const code of ["KeyW", "KeyS", "KeyA", "KeyD", "KeyE", "ShiftLeft"])
      key(code, false);
    mouse(0, false);
    mouse(2, false);
    if (!p.alive || s.phase === "end") return;
    if (p.ammo < 2) {
      key("KeyR", true);
      key("KeyR", false);
    }
    const attack = p.team === s.attacker;
    const objective = s.objective;
    if (
      (p.carry && Math.hypot(p.x - 31, p.z - 15) < 4) ||
      (objective.state === "armed" &&
        !attack &&
        Math.hypot(p.x - objective.x, p.z - objective.z) < 2.6)
    ) {
      key("KeyE", true);
      return;
    }
    const visible = s.players
      .filter(
        (e) =>
          e.alive &&
          e.team !== p.team &&
          Math.hypot(e.x - p.x, e.z - p.z) < 45 &&
          nav.clearLine(p, e, 1.5) &&
          !s.areas.some((a) => {
            if (a.kind !== "veil") return false;
            const dx = e.x - p.x,
              dz = e.z - p.z,
              t = Math.max(
                0,
                Math.min(
                  1,
                  ((a.x - p.x) * dx + (a.z - p.z) * dz) / (dx * dx + dz * dz),
                ),
              );
            return (
              Math.hypot(a.x - p.x - dx * t, a.z - p.z - dz * t) < a.radius
            );
          }),
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
        p.y + 1.68 - (visible.y + (visible.crouch ? 0.9 : 1.3)),
        Math.hypot(visible.x - p.x, visible.z - p.z),
      );
      if (p.primary === "longglass" || p.primary === "sable") mouse(2, true);
      if (p.reloadTime <= 0 && p.ammo > 0 && Math.hypot(p.vx, p.vz) < 0.4)
        mouse(0, true);
    } else {
      const goal =
        objective.state === "armed" && !attack
          ? objective
          : objective.state === "dropped" && attack
            ? objective
            : attack
              ? { x: 31, z: 15 }
              : { x: -25, z: 10 };
      if (
        objective.state === "dropped" &&
        attack &&
        Math.hypot(p.x - goal.x, p.z - goal.z) < 1.8
      ) {
        key("KeyE", true);
        return;
      }
      if (!path.length || repath++ % 20 === 0) path = nav.findPath(p, goal);
      while (path.length && Math.hypot(p.x - path[0].x, p.z - path[0].z) < 0.7)
        path.shift();
      if (path.length) {
        yaw = Math.atan2(path[0].x - p.x, path[0].z - p.z);
        key("KeyW", true);
      }
    }
    if (yaw !== undefined) {
      const delta = Math.atan2(Math.sin(yaw - d.yaw), Math.cos(yaw - d.yaw));
      window.dispatchEvent(
        new MouseEvent("mousemove", {
          movementX: -delta / 0.00225,
          movementY: (pitch - d.pitch) / 0.00225,
        }),
      );
    }
  }, 65);
  return "Protocol QA uses keyboard/mouse and real buy buttons only";
})();
