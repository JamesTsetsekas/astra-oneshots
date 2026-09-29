import assert from "node:assert/strict";
import http from "node:http";

const base = "http://127.0.0.1:4160";
const response = await fetch(base + "/api/games");
assert.equal(response.status, 200);
const games = await response.json();
assert.equal(games.length, 8);
assert.equal(new Set(games.map((g) => g.port)).size, 8);
for (const game of games) {
  assert.ok(
    game.running && game.built && game.screenshot,
    `${game.name}: incomplete readiness`,
  );
  const page = await fetch(`http://127.0.0.1:${game.port}/`);
  const html = await page.text();
  assert.equal(page.status, 200);
  assert.ok(
    !html.includes("/@vite/client"),
    `${game.name}: development server instead of production`,
  );
  const assets = [
    ...html.matchAll(/(?:src|href)=["']((?:\.\/|\/)?assets\/[^"']+)["']/g),
  ].map((m) => m[1]);
  assert.ok(assets.length > 0, `${game.name}: missing production assets`);
  for (const asset of assets) {
    const file = await fetch(new URL(asset, `http://127.0.0.1:${game.port}/`));
    assert.equal(file.status, 200, `${game.name}: ${asset}`);
    assert.ok(
      !file.headers.get("content-type")?.includes("text/html"),
      `${game.name}: asset fallback HTML`,
    );
    const mime = file.headers.get("content-type")?.split(";")[0].trim();
    if (asset.endsWith(".js"))
      assert.ok(
        ["text/javascript", "application/javascript"].includes(mime),
        `${game.name}: incorrect JavaScript MIME`,
      );
    if (asset.endsWith(".css"))
      assert.equal(mime, "text/css", `${game.name}: incorrect CSS MIME`);
    await file.arrayBuffer();
  }
  const screenshot = await fetch(base + "/screenshots/" + game.id);
  assert.equal(screenshot.status, 200);
  assert.equal(screenshot.headers.get("content-type"), "image/png");
  assert.ok((await screenshot.arrayBuffer()).byteLength > 10000);
  if (game.id === "breachline") assert.equal(game.relayReady, true);
  console.log(
    `PASS ${game.name}: production page, ${assets.length} entry assets, actual gameplay capture`,
  );
}

function raw(path) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { hostname: "127.0.0.1", port: 4160, path },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      },
    );
    request.on("error", reject);
    request.end();
  });
}
assert.equal(await raw("http://["), 400);
assert.equal(await raw("/%2e%2e%2fmeridian-run/package.json"), 403);
assert.equal(await raw("/%E0%A4%A"), 400);
assert.equal((await fetch(base)).status, 200);
console.log(
  "PASS malformed URL rejection, path confinement, and launcher survival",
);

await new Promise((resolve, reject) => {
  const socket = new WebSocket("ws://127.0.0.1:4176/relay");
  const timeout = setTimeout(() => {
    socket.close();
    reject(new Error("Relay greeting timed out"));
  }, 5000);
  socket.addEventListener("error", () => {
    clearTimeout(timeout);
    reject(new Error("Relay unavailable"));
  });
  socket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "welcome") {
      assert.ok(data.id && data.snapshot);
      clearTimeout(timeout);
      socket.close();
      resolve();
    }
  });
});
console.log(
  "PASS bundled Breachline relay WebSocket handshake; all eight games ready",
);
