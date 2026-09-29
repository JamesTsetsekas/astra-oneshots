import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { defaultLoadouts } from "../src/game/data";
import type { Snapshot } from "../src/game/simulation";
const peers: Array<{ socket: WebSocket; id: string; latest?: Snapshot }> = [];
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
try {
  for (let i = 0; i < 12; i++) {
    const socket = new WebSocket("ws://127.0.0.1:4196/relay");
    const peer = { socket, id: "", latest: undefined as Snapshot | undefined };
    peers.push(peer);
    await new Promise<void>((resolve, reject) => {
      socket.on("message", (raw) => {
        const m = JSON.parse(raw.toString());
        if (m.id) peer.id = m.id;
        if (m.snapshot) peer.latest = m.snapshot;
        if (m.type === "welcome") {
          socket.send(
            JSON.stringify({
              type: "join",
              name: `QA-${i}`,
              loadout: defaultLoadouts[i % 5],
            }),
          );
          resolve();
        }
      });
      socket.once("error", reject);
    });
  }
  await delay(300);
  const state = peers[0].latest!;
  assert.equal(state.players.filter((p) => !p.bot).length, 12);
  assert.equal(state.players.filter((p) => p.team === "atlas").length, 6);
  assert.equal(state.players.filter((p) => p.team === "cobalt").length, 6);
  const extra = new WebSocket("ws://127.0.0.1:4196/relay");
  const closed = await new Promise<number>((r) =>
    extra.once("close", (code) => r(code)),
  );
  assert.equal(closed, 1013);
  const peer = peers[0],
    before = peer.latest!.players.find((p) => p.id === peer.id)!;
  peer.socket.send(
    JSON.stringify({
      type: "input",
      input: {
        x: 0,
        z: 999,
        yaw: 0,
        pitch: 999,
        fire: false,
        ads: false,
        sprint: true,
        crouch: false,
        seq: 1,
      },
    }),
  );
  await delay(700);
  const after = peer.latest!.players.find((p) => p.id === peer.id)!;
  assert.ok(Math.hypot(after.x - before.x, after.z - before.z) < 2.5);
  assert.ok(Math.abs(after.pitch) <= 1.35);
  assert.equal(after.input.fire, false);
  console.log(
    JSON.stringify(
      {
        passed: true,
        clients: 12,
        teams: [6, 6],
        thirteenthClientRejected: true,
        staleInputStopped: true,
        viewAndMovementClamped: true,
        snapshotBytes: Buffer.byteLength(JSON.stringify(peer.latest)),
        protocol: "local authoritative JSON WebSocket",
      },
      null,
      2,
    ),
  );
} finally {
  for (const peer of peers) peer.socket.close();
}
