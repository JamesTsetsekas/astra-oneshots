import { it, expect } from "vitest";
import { GameSession } from "./session";
import { DEFAULT_SETTINGS, EMPTY_INPUT } from "./types";
import { decodeSave, encodeSave } from "./storage";
import { findRoute, lineClear } from "./world";
const settings = { ...DEFAULT_SETTINGS, traffic: 0, crowds: 0 };
it("retry resolves pending witness reports instead of re-alerting the restarted case", async () => {
  const s = await GameSession.create(settings);
  try {
    s.pedestrians.push({
      id: 99,
      x: -180,
      y: 0,
      z: -304,
      heading: 0,
      role: "resident",
      color: "#aaaaaa",
      state: "walk",
      phase: 0,
      report: 0,
      home: { x: -180, z: -304 },
      goal: { x: -180, z: -304 },
    });
    s.reportCrime("Witnessed taking", 20);
    expect(s.crimes.some((crime) => !crime.reported)).toBe(true);
    s.retry();
    for (let i = 0; i < 360; i++) s.step(EMPTY_INPUT, 1 / 60);
    expect(s.alert.tier).toBe(0);
    expect(s.crimes).toHaveLength(0);
    expect(s.enemies.some((enemy) => enemy.role === "police")).toBe(false);
  } finally {
    s.dispose();
  }
});
it("routes through the real Port Control doorway, never through a thin side wall", () => {
  const route = findRoute({ x: 282, z: 183 }, { x: 290, z: 202 });
  expect(route.some((p) => p.x === 290 && p.z === 187)).toBe(true);
  for (let i = 1; i < route.length; i++)
    expect(lineClear(route[i - 1], route[i])).toBe(true);
});
it("walking into a visit zone progresses without requiring vehicle-like braking", async () => {
  const s = await GameSession.create(settings);
  try {
    s.completed.push("first-shift");
    const saved = s.save();
    saved.player = { ...saved.player, x: -284, z: -185, y: 0 };
    saved.mission = {
      id: "lost-manifest",
      stage: 0,
      elapsed: 0,
      progress: 0,
      checkpoint: 0,
      replay: false,
      damage: 0,
      civilianHarm: 0,
      started: 0,
    };
    const r = await GameSession.create(settings, saved);
    try {
      r.step({ ...EMPTY_INPUT, moveZ: 1, sprint: true }, 1 / 60);
      expect(r.player.speed).toBeGreaterThan(3);
      expect(r.mission?.stage).toBe(1);
    } finally {
      r.dispose();
    }
  } finally {
    s.dispose();
  }
});
it("keeps wanted evidence on continue rather than clearing an escape objective by reloading", async () => {
  const s = await GameSession.create(settings);
  try {
    s.alert.tier = 3;
    s.alert.heat = 54;
    s.alert.lastKnown = { x: 290, z: 180 };
    const encoded = encodeSave(s.save()),
      restored = await GameSession.create(settings, decodeSave(encoded));
    try {
      expect(restored.alert.tier).toBe(3);
      expect(restored.alert.heat).toBe(54);
      expect(restored.alert.state).toBe("Search");
      expect(restored.alert.unseen).toBe(0);
    } finally {
      restored.dispose();
    }
  } finally {
    s.dispose();
  }
});
it("rejects valid-checksum payloads with unknown weapon IDs or impossible wanted tiers", async () => {
  const s = await GameSession.create(settings);
  try {
    const save = s.save();
    const bad = structuredClone(save);
    bad.player.weapon = "unknown" as never;
    expect(() => decodeSave(encodeSave(bad))).toThrow(/weapon/);
    bad.player.weapon = "stun";
    bad.alert = { ...s.alert, tier: 99 };
    expect(() => decodeSave(encodeSave(bad))).toThrow(/evidence/);
  } finally {
    s.dispose();
  }
});
it("replays reset inactive mission vehicles and never turn replay into a paid first completion", async () => {
  const s = await GameSession.create(settings);
  try {
    s.completed.push("first-shift");
    s.vehicles[0].x = 300;
    s.vehicles[0].z = 200;
    s.vehicles[0].condition = 50;
    expect(s.startMission("first-shift", true)).toBe(true);
    expect(s.vehicles[0].x).toBe(-174);
    expect(s.vehicles[0].condition).toBe(100);
    expect(s.mission?.replay).toBe(true);
  } finally {
    s.dispose();
  }
});
