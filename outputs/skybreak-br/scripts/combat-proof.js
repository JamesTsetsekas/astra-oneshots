// Aim using read-only positions, then exercise only pointer/keyboard input handlers.
(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    canvas = document.querySelector("#game-canvas");
  const key = (code, down) =>
    window.dispatchEvent(
      new KeyboardEvent(down ? "keydown" : "keyup", { code, bubbles: true }),
    );
  key("Digit1", true);
  await wait(80);
  key("Digit1", false);
  const start = window.__skybreak.snapshot().player;
  for (let frame = 0; frame < 35; frame++) {
    const p = window.__skybreak.snapshot().player,
      target = window.__skybreak.world().actors.find((a) => a.id === 3);
    if (!target?.alive) break;
    const camera = {
      x:
        p.x -
        Math.sin(p.yaw) * Math.cos(p.pitch) * 5.3 +
        Math.cos(p.yaw) * 0.87,
      y: p.y + 1.75 + Math.sin(p.pitch) * 5.3 + 0.4,
      z:
        p.z -
        Math.cos(p.yaw) * Math.cos(p.pitch) * 5.3 -
        Math.sin(p.yaw) * 0.87,
    };
    const dx = target.x - camera.x,
      dz = target.z - camera.z,
      desiredYaw = Math.atan2(dx, dz),
      desiredPitch = Math.atan2(
        camera.y - (target.y + 1.15),
        Math.hypot(dx, dz),
      );
    const yawDiff = Math.atan2(
      Math.sin(desiredYaw - p.yaw),
      Math.cos(desiredYaw - p.yaw),
    );
    canvas.dispatchEvent(
      new PointerEvent("pointerdown", { button: 0, bubbles: true }),
    );
    window.dispatchEvent(
      new MouseEvent("mousemove", {
        movementX: yawDiff / 0.0022,
        movementY: (desiredPitch - p.pitch) / 0.0022,
        bubbles: true,
      }),
    );
    await wait(100);
  }
  window.dispatchEvent(
    new PointerEvent("pointerup", { button: 0, bubbles: true }),
  );
  const end = window.__skybreak.snapshot().player;
  if (end.kills <= start.kills)
    throw Error("Combat did not eliminate the aimed training target");
  return {
    shots: end.shots - start.shots,
    hits: end.hits - start.hits,
    damage: end.damage - start.damage,
    kills: end.kills - start.kills,
    targetAlive: window.__skybreak.world().actors.find((a) => a.id === 3).alive,
  };
})();
