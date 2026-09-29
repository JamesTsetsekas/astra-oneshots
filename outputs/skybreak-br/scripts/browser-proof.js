// DEV-only proof driver. Evaluated in the dedicated browser tab after clicking Practice.
// All actions pass through normal input/UI handlers; the inspector is read-only.
(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const read = () => window.__skybreak.snapshot();
  const assert = (value, message) => {
    if (!value) throw Error(message);
  };
  const key = (code, down) =>
    window.dispatchEvent(
      new KeyboardEvent(down ? "keydown" : "keyup", { code, bubbles: true }),
    );
  const tap = async (code) => {
    key(code, true);
    await wait(100);
    key(code, false);
    await wait(100);
  };
  const click = (text) => {
    const button = [...document.querySelectorAll("button")].find(
      (b) =>
        b.textContent.trim() === text || b.getAttribute("aria-label") === text,
    );
    assert(button, "Button exists: " + text);
    button.click();
  };
  const canvas = document.querySelector("#game-canvas");
  const mouse = (down) =>
    (down ? canvas : window).dispatchEvent(
      new PointerEvent(down ? "pointerdown" : "pointerup", {
        button: 0,
        bubbles: true,
      }),
    );
  const initial = read();
  assert(initial.phase === "playing", "Start in Practice range");
  key("KeyW", true);
  await wait(1100);
  key("KeyW", false);
  await wait(100);
  const moved = read();
  assert(moved.player.z < initial.player.z - 4, "W moves character");
  await tap("KeyE");
  const picked = read();
  assert(
    picked.events.some((e) => e.type === "pickup"),
    "E picked up a range weapon",
  );
  await tap("Tab");
  assert(
    document.body.innerText.includes("Travel light. Hit hard."),
    "Inventory opens",
  );
  const frozen = read().time;
  await wait(400);
  assert(read().time === frozen, "Inventory pauses local simulation");
  click("Resume game");
  await wait(150);
  await tap("KeyM");
  assert(document.body.innerText.includes("Know your next move."), "Map opens");
  const map = document.querySelector('canvas[aria-label^="Highwake tactical"]'),
    rect = map.getBoundingClientRect();
  map.dispatchEvent(
    new MouseEvent("click", {
      clientX: rect.left + rect.width * 0.7,
      clientY: rect.top + rect.height * 0.5,
      bubbles: true,
    }),
  );
  await wait(150);
  assert(read().marker.x > 0, "Map marker changed");
  click("Resume game");
  await wait(150);
  await tap("Digit1");
  mouse(true);
  await wait(650);
  mouse(false);
  const fired = read();
  assert(fired.player.shots > 0, "Mouse fires weapon");
  await tap("KeyR");
  assert(read().player.reload > 0, "R starts reload");
  await wait(3300);
  assert(read().player.reload === 0, "Reload completed");
  await tap("Digit4");
  mouse(true);
  await wait(100);
  mouse(false);
  await wait(2900);
  assert(read().player.reserve === 25, "Flask grants Reserve Shield");
  await tap("Space");
  await wait(100);
  assert(!read().player.grounded, "Space jumps");
  await wait(1000);
  window.__skybreakProof = {
    movementMetres: initial.player.z - moved.player.z,
    pickup: picked.events.filter((e) => e.type === "pickup").map((e) => e.text),
    shots: fired.player.shots,
    map: true,
    inventoryPause: true,
    reload: true,
    shieldFlask: true,
    jump: true,
  };
  return window.__skybreakProof;
})();
