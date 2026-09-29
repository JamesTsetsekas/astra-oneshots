import { describe, it, expect, afterEach } from "vitest";
import { GameSession } from "./session";
import {
  DEFAULT_SETTINGS,
  EMPTY_INPUT,
  type InputFrame,
  type SaveGame,
} from "./types";
import { encodeSave, decodeSave } from "./storage";
import {
  heightAt,
  INTERIORS,
  INTERIOR_WALLS,
  blocked,
  lineClear,
} from "./world";
import { MISSIONS, VEHICLES } from "./content";
const sessions: GameSession[] = [];
const settings = { ...DEFAULT_SETTINGS, traffic: 0, crowds: 0 };
async function game(save?: SaveGame) {
  const s = await GameSession.create(settings, save);
  sessions.push(s);
  return s;
}
function tick(s: GameSession, count: number, input: Partial<InputFrame> = {}) {
  for (let i = 0; i < count; i++) s.step({ ...EMPTY_INPUT, ...input }, 1 / 60);
}
function walk(s: GameSession, x: number, z: number, limit = 3600) {
  for (
    let i = 0;
    i < limit && Math.hypot(s.player.x - x, s.player.z - z) > 0.6;
    i++
  ) {
    const dx = x - s.player.x,
      dz = z - s.player.z,
      d = Math.hypot(dx, dz);
    tick(s, 1, { moveX: dx / d, moveZ: dz / d, sprint: true });
  }
}
afterEach(() => {
  sessions.splice(0).forEach((s) => s.dispose());
});
describe("Port Meridian content and world", () => {
  it("has eight original driveable models, seven weapon definitions, four ordered cases and three activities", () => {
    expect(VEHICLES).toHaveLength(8);
    expect(VEHICLES.filter((v) => v.kind === "bike")).toHaveLength(2);
    expect(MISSIONS.filter((m) => m.kind === "story")).toHaveLength(4);
    expect(MISSIONS.filter((m) => m.kind === "activity")).toHaveLength(3);
    expect(
      MISSIONS.find((m) => m.id === "circuit")!.stages.filter(
        (s) => s.type === "circuit",
      ),
    ).toHaveLength(12);
  });
  it("shares physical room walls and actual doorway openings with line-of-sight", () => {
    expect(INTERIORS.length).toBeGreaterThanOrEqual(6);
    for (const room of INTERIORS) {
      expect(INTERIOR_WALLS.some((w) => w.id === room.id)).toBe(true);
      expect(blocked(room.door.x, room.door.z, 0.2)).toBe(false);
    }
    expect(lineClear({ x: -205, z: -300 }, { x: -195, z: -300 })).toBe(true);
    expect(lineClear({ x: -205, z: -300 }, { x: -205, z: -325 })).toBe(false);
  });
});
describe("fixed-step playable simulation", () => {
  it("walks on a grounded capsule, sprints with stamina, jumps and lands without sinking", async () => {
    const s = await game();
    const z = s.player.z;
    tick(s, 120, { moveZ: 1, sprint: true });
    expect(s.player.z - z).toBeGreaterThan(10);
    expect(s.player.stamina).toBeLessThan(8);
    tick(s, 1, { jump: true });
    tick(s, 12);
    expect(s.player.y).toBeGreaterThan(heightAt(s.player.x, s.player.z) + 0.4);
    tick(s, 180);
    expect(s.player.grounded).toBe(true);
    expect(s.player.y).toBeCloseTo(heightAt(s.player.x, s.player.z), 0);
  });
  it("enters, accelerates, brakes and safely exits a stopped motorcycle using normal inputs", async () => {
    const s = await game();
    walk(s, -177, -300);
    tick(s, 2, { interact: true });
    expect(s.player.vehicleId).toBe(0);
    expect(s.mission?.stage).toBe(1);
    const start = s.player.z;
    tick(s, 180, { throttle: 1 });
    expect(s.player.z - start).toBeGreaterThan(20);
    expect(s.player.speed).toBeGreaterThan(10);
    expect(s.exitVehicle()).toBe(false);
    tick(s, 150, { handbrake: true });
    expect(s.player.speed).toBeLessThan(1);
    expect(s.exitVehicle()).toBe(true);
    tick(s, 60);
    expect(s.player.vehicleId).toBeUndefined();
    expect(Number.isFinite(s.player.y)).toBe(true);
  });
  it("blocks story skipping, remote purchases and magazine-refill-by-switching", async () => {
    const s = await game();
    expect(s.startMission("signal-breakwater")).toBe(false);
    expect(s.startMission("signal-breakwater", true)).toBe(false);
    const money = s.player.cash;
    expect(s.buy("armor")).toBe(false);
    expect(s.player.cash).toBe(money);
    s.player.ammo = 2;
    s.setWeapon("stun");
    expect(s.player.ammo).toBe(2);
    s.setWeapon("pistol");
    expect(s.player.ammo).toBe(0);
  });
  it("does not create wanted attention without a witness, officer or camera", async () => {
    const s = await game();
    s.reportCrime("No-witness test", 20, { x: 80, z: -310 });
    tick(s, 360);
    expect(s.alert.tier).toBe(0);
    expect(s.crimes).toHaveLength(0);
  });
  it("uses delayed witness reporting and caps all five alert tiers consistently", async () => {
    const s = await game();
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
    s.reportCrime("Witnessed taking", 10);
    expect(s.alert.state).toBe("Witness reporting");
    expect(s.alert.tier).toBe(0);
    tick(s, 200);
    expect(s.alert.tier).toBeGreaterThan(0);
    s.reportCrime("Serious witnessed crime", 80);
    tick(s, 360);
    expect(s.alert.tier).toBeLessThanOrEqual(5);
    expect(s.alert.tier).toBeGreaterThanOrEqual(4);
  });
  it("ray-based stun combat consumes ammunition and subdues a real target", async () => {
    const s = await game();
    s.player.holstered = false;
    s.enemies.push({
      id: 900,
      x: s.player.x,
      y: s.player.y,
      z: s.player.z + 10,
      heading: Math.PI,
      hp: 100,
      role: "rival",
      state: "patrol",
      cooldown: 9,
      home: { x: s.player.x, z: s.player.z + 10 },
      alerted: false,
      stun: 0,
    });
    tick(s, 100, { fire: true, aim: true, aimYaw: 0, aimPitch: -0.035 });
    expect(s.enemies[0].hp).toBe(0);
    expect(s.player.ammo).toBeLessThan(8);
    expect(s.enemies[0].stun).toBeGreaterThan(900);
  });
  it("cannot repeatedly reward a completed mission and freezes the result simulation", async () => {
    const s = await game();
    s.startMission("courier");
    const m = s.mission!;
    m.stage = 2;
    const checkpoint = s.save();
    checkpoint.player = {
      ...checkpoint.player,
      x: -174,
      z: 340,
      y: heightAt(-174, 340),
    };
    checkpoint.mission = { ...m };
    const restored = await game(checkpoint);
    tick(restored, 3, { interact: true });
    expect(restored.result?.reward).toBe(240);
    const money = restored.player.cash,
      time = restored.time;
    tick(restored, 600, { interact: true });
    expect(restored.player.cash).toBe(money);
    expect(restored.time).toBe(time);
  });
  it("holds rather than taps investigation interaction", async () => {
    const s = await game();
    const save = s.save();
    save.completed = ["first-shift"];
    save.mission = {
      id: "lost-manifest",
      stage: 1,
      elapsed: 0,
      progress: 0,
      checkpoint: 1,
      replay: false,
      damage: 0,
      civilianHarm: 0,
      started: 0,
    };
    save.player = { ...save.player, x: -284, z: -155, y: heightAt(-284, -155) };
    const r = await game(save);
    r.enemies.forEach((e) => (e.cooldown = 100));
    tick(r, 1, { interact: true });
    tick(r, 90);
    expect(r.mission?.stage).toBe(1);
    expect(r.mission?.progress).toBeLessThan(0.1);
    tick(r, 310, { interact: true });
    expect(r.mission?.stage).toBeGreaterThanOrEqual(2);
  });
});
describe("versioned checkpoint protection", () => {
  it("roundtrips a detached save and rejects altered payloads", async () => {
    const s = await game();
    const save = s.save(),
      e = encodeSave(save);
    expect(decodeSave(e).player.cash).toBe(180);
    s.player.cash = 20;
    expect(decodeSave(e).player.cash).toBe(180);
    expect(() =>
      decodeSave({ ...e, payload: e.payload.replace("180", "99999") }),
    ).toThrow(/checksum/);
  });
  it("restores case progression, cash and parked vehicle condition without duplicating rewards", async () => {
    const s = await game();
    s.player.cash = 760;
    s.completed.push("first-shift");
    const save = s.save();
    save.vehicle = {
      definition: "current",
      condition: 67,
      x: -173,
      z: -332,
      heading: 1,
    };
    const restored = await game(decodeSave(encodeSave(save)));
    expect(restored.player.cash).toBe(760);
    expect(restored.completed).toEqual(["first-shift"]);
    expect(
      restored.vehicles.find((v) => v.definition === "current")?.condition,
    ).toBe(67);
    expect(restored.player.vehicleId).toBeUndefined();
    expect(restored.startMission("first-shift", true)).toBe(true);
    expect(restored.mission?.replay).toBe(true);
  });
});
