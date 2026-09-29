import { describe, it, expect } from "vitest";
import { Session, stormAt, PHASES } from "./session";
import { AMMO_CAP, WEAPONS } from "./content";
import { EMPTY_INPUT, type Actor, type Input, type Options } from "./types";
import {
  heightAt,
  OBSTACLES,
  PRACTICE,
  rayBox,
  clearSight,
  BUILDINGS,
} from "./world";
const options = (mode: Options["mode"] = "practice", seed = 421): Options => ({
  mode,
  seed,
  skin: 0,
  pace: "quick",
});
const advance = (
  s: Session,
  seconds: number,
  input: Input = { ...EMPTY_INPUT, yaw: Math.PI },
) => {
  for (let i = 0; i < Math.ceil(seconds * 30); i++) s.step(input, 1 / 30);
};
describe("storm and world contracts", () => {
  it("starts with a safe 550m radius and ends in a lethal final field", () => {
    expect(stormAt(0, "standard", 3).radius).toBe(550);
    expect(stormAt(900, "standard", 3)).toMatchObject({
      radius: 0,
      damage: 35,
    });
    expect(stormAt(400, "quick", 3).radius).toBe(0);
  });
  it("is deterministic, continuously shrinks, and keeps each target circle contained", () => {
    for (const seed of [1, 4, 19, 421, 999]) {
      let previous = 550;
      for (let t = 0; t < 850; t += 3) {
        const a = stormAt(t, "standard", seed);
        expect(a).toEqual(stormAt(t, "standard", seed));
        expect(a.radius).toBeLessThanOrEqual(previous + 0.001);
        expect(
          Math.hypot(a.nextX - a.x, a.nextZ - a.z) + a.nextRadius,
        ).toBeLessThanOrEqual(a.radius + 0.01);
        previous = a.radius;
      }
    }
  });
  it("defines six populated zones, nine balanced weapon profiles, and blocked building walls", () => {
    expect(BUILDINGS.length).toBeGreaterThan(50);
    expect(Object.keys(WEAPONS)).toHaveLength(9);
    for (const w of Object.values(WEAPONS)) {
      expect(w.mag).toBeGreaterThan(0);
      expect(w.reload).toBeGreaterThan(0);
      expect(w.damage * w.pellets).toBeLessThanOrEqual(120);
    }
    const wall = OBSTACLES[0];
    const from = { x: wall.x - 2, y: wall.y + 1, z: wall.z },
      to = { x: wall.x + 2, y: wall.y + 1, z: wall.z };
    expect(clearSight(from, to)).toBe(false);
    expect(rayBox(from, { x: 1, y: 0, z: 0 }, wall, 10)).toBeGreaterThan(0);
  });
});
describe("local gameplay", () => {
  it("creates an unarmed 24-scavenger solo and a supplied practice range", async () => {
    const solo = await Session.create(options("solo"));
    const range = await Session.create(options());
    try {
      expect(solo.actors).toHaveLength(24);
      expect(solo.player.inventory.every((i) => !i)).toBe(true);
      expect(solo.phase).toBe("staging");
      expect(range.actors).toHaveLength(6);
      expect(range.player.inventory[0]?.id).toBe("rifle");
      expect(range.player.ammo).toEqual(AMMO_CAP);
    } finally {
      solo.dispose();
      range.dispose();
    }
  });
  it("actually moves a Rapier character, respects collision, and freezes while paused", async () => {
    const s = await Session.create(options());
    try {
      advance(s, 1);
      expect(
        Math.abs(s.player.y - heightAt(s.player.x, s.player.z)),
      ).toBeLessThan(0.5);
      const z = s.player.z;
      advance(s, 2, { ...EMPTY_INPUT, yaw: Math.PI, forward: 1 });
      expect(s.player.z).toBeLessThan(z - 9);
      s.paused = true;
      const before = { x: s.player.x, z: s.player.z, time: s.time };
      advance(s, 3, { ...EMPTY_INPUT, yaw: Math.PI, forward: 1 });
      expect({ x: s.player.x, z: s.player.z, time: s.time }).toEqual(before);
      s.paused = false;
      const wall = OBSTACLES[0];
      Object.assign(s.player, { x: wall.x - 3, y: wall.y + 0.1, z: wall.z });
      s.physics.teleport(s.player);
      advance(s, 4, { ...EMPTY_INPUT, yaw: Math.PI / 2, forward: 1 });
      expect(s.player.x).toBeLessThan(wall.x - 0.4);
      expect(s.player.x).toBeGreaterThan(wall.x - 2);
      expect(Number.isFinite(s.player.y)).toBe(true);
    } finally {
      s.dispose();
    }
  });
  it("boards, jumps, deploys the wing and lands without an invented starter weapon", async () => {
    const s = await Session.create(options("solo"));
    try {
      s.board();
      expect(s.phase).toBe("skiff");
      s.jumpSkiff();
      expect(s.phase).toBe("dropping");
      advance(s, 40, { ...EMPTY_INPUT, yaw: 1.7, glide: true });
      expect(s.phase).toBe("playing");
      expect(s.player.grounded).toBe(true);
      expect(s.player.inventory.every((i) => !i)).toBe(true);
    } finally {
      s.dispose();
    }
  });
  it("fires authoritative ammo, damages Aegis before health, eliminates and drops gear", async () => {
    const s = await Session.create(options());
    try {
      const target = s.actors[3];
      const origin = { x: s.player.x, y: s.player.y + 1.2, z: s.player.z },
        d = {
          x: target.x - origin.x,
          y: target.y + 1.2 - origin.y,
          z: target.z - origin.z,
        },
        len = Math.hypot(d.x, d.y, d.z);
      const input = {
        ...EMPTY_INPUT,
        yaw: Math.PI,
        fire: true,
        ads: true,
        aimOrigin: origin,
        aimDirection: { x: d.x / len, y: d.y / len, z: d.z / len },
      };
      advance(s, 0.1, input);
      expect(s.player.inventory[0]!.loaded).toBeLessThan(30);
      expect(target.aegis).toBeLessThan(50);
      expect(target.hp).toBe(100);
      advance(s, 2, input);
      expect(target.alive).toBe(false);
      expect(s.player.kills).toBe(1);
      expect(s.loot.some((l) => l.source === "cache")).toBe(true);
      expect(s.player.damage).toBeGreaterThanOrEqual(150);
    } finally {
      s.dispose();
    }
  });
  it("reloads only available ammo and cancels reload when switching slots", async () => {
    const s = await Session.create(options());
    try {
      s.player.inventory[0]!.loaded = 0;
      s.player.ammo.light = 7;
      advance(s, 0.05, { ...EMPTY_INPUT, reload: true, yaw: Math.PI });
      expect(s.player.reload).toBeGreaterThan(0);
      advance(s, 3);
      expect(s.player.inventory[0]!.loaded).toBe(7);
      expect(s.player.ammo.light).toBe(0);
      s.player.ammo.light = 20;
      advance(s, 0.1, { ...EMPTY_INPUT, reload: true, yaw: Math.PI });
      s.selectSlot(1);
      expect(s.player.reload).toBe(0);
    } finally {
      s.dispose();
    }
  });
  it("uses timed consumables, clamps health, rearranges and drops inventory", async () => {
    const s = await Session.create(options());
    try {
      s.player.hp = 80;
      s.selectSlot(2);
      advance(s, 0.1, { ...EMPTY_INPUT, use: true, yaw: Math.PI });
      expect(s.player.action).toBeGreaterThan(0);
      advance(s, 4);
      expect(s.player.hp).toBe(100);
      expect(s.player.inventory[2]!.quantity).toBe(3);
      s.swapSlots(0, 1);
      expect(s.player.inventory[1]!.id).toBe("rifle");
      const count = s.loot.length;
      s.dropSlot(1);
      expect(s.player.inventory[1]).toBe(null);
      expect(s.loot.length).toBe(count + 1);
    } finally {
      s.dispose();
    }
  });
  it("never names a living leader as winner when a player ends a match early", async () => {
    const s = await Session.create(options("solo"));
    try {
      s.finish();
      expect(s.result!.victory).toBe(false);
      expect(s.result!.winner).toContain("Undecided");
      expect(s.result!.place).toBe(0);
    } finally {
      s.dispose();
    }
  });
  it("lets 23 local bots loot, fight and rotate to one real survivor", async () => {
    const s = await Session.create(options("solo", 7382));
    try {
      s.phase = "playing";
      s.player.alive = false;
      s.player.hp = 0;
      s.deathPlace = 24;
      s.deathTime = 0;
      advance(s, 420);
      expect(s.result).toBeDefined();
      expect(s.alive).toHaveLength(1);
      expect(s.result!.winner).toBe(s.alive[0].name);
      expect(s.result!.place).toBe(24);
      expect(s.actors.some((a) => a.shots > 0)).toBe(true);
      expect(s.actors.some((a) => a.kills > 0)).toBe(true);
      expect(
        s.actors.every((a) => Number.isFinite(a.x) && Number.isFinite(a.z)),
      ).toBe(true);
    } finally {
      s.dispose();
    }
  }, 45000);
});
