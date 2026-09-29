import { describe, expect, it } from "vitest";
import { MatchSimulation, idleInput, type Combatant } from "./simulation";
import {
  blocked,
  clearLine,
  findPath,
  patrolPoints,
  walkableLine,
  wallDistance,
} from "./navigation";
import { defaultLoadouts, validLoadout, weapons, type WeaponId } from "./data";
const advance = (m: MatchSimulation, seconds: number) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) m.step(1 / 60);
};
function duel(weapon: WeaponId = "jackal") {
  const m = new MatchSimulation(123);
  const a = m.addHuman("a", "A", { ...defaultLoadouts[0], primary: weapon }),
    b = m.addHuman("b", "B");
  Object.assign(a, { x: 0, z: 0, y: 0, protection: 0 });
  Object.assign(b, { x: 0, z: 8, y: 0, protection: 0 });
  return { m, a, b };
}
describe("authoritative combat", () => {
  it.each(Object.keys(weapons) as WeaponId[])("fires and consumes ammunition for %s", (id) => {
    const { m, a, b } = duel(["relay", "rook", "cinder"].includes(id) ? "jackal" : id);
    if (["relay", "rook", "cinder"].includes(id)) { a.loadout.sidearm = id; a.slot = 1; a.ammo = weapons[id].mag; }
    const before = a.ammo;
    m.setInput("a", { ...idleInput(), fire: true, ads: true, pitch: .047 });
    m.step();
    expect(a.ammo).toBe(before - 1);
    expect(b.hp).toBeLessThan(100);
  });
  it("assigns six humans to each team while replacing bots", () => {
    const m = new MatchSimulation(1);
    m.fillBots();
    for (let i = 0; i < 12; i++) m.addHuman(`p${i}`, "Human");
    expect(m.players.size).toBe(12);
    expect(
      [...m.players.values()].filter((p) => p.team === "atlas").length,
    ).toBe(6);
    expect([...m.players.values()].every((p) => !p.bot)).toBe(true);
  });
  it("moves forward +Z and screen-right -X at heading zero", () => {
    const { m, a } = duel();
    m.setInput("a", { ...idleInput(), x: 1, z: 1 });
    advance(m, 1);
    expect(a.x).toBeLessThan(-2);
    expect(a.z).toBeGreaterThan(2);
    expect(Math.hypot(a.x, a.z)).toBeLessThan(5.3);
  });
  it("rejects malformed kits and queues valid kits until respawn", () => {
    const { m, a } = duel();
    expect(validLoadout({ ...defaultLoadouts[0], lethal: "nuke" })).toBe(false);
    expect(m.setLoadout("a", { ...defaultLoadouts[1], primary: "relay" })).toBe(
      false,
    );
    expect(m.setLoadout("a", defaultLoadouts[1])).toBe(true);
    expect(a.loadout.primary).toBe("jackal");
    a.alive = false;
    a.respawn = 0.01;
    advance(m, 0.03);
    expect(a.loadout.primary).toBe("kestrel");
  });
  it("pitch changes actual ray hits: looking upward cannot hit a body", () => {
    const { m, a, b } = duel();
    m.setInput("a", { ...idleInput(), fire: true, pitch: -0.8, ads: true });
    advance(m, 0.5);
    expect(b.hp).toBe(100);
    expect(a.ammo).toBeLessThan(30);
  });
  it("uses geometric head hits rather than random headshot flags", () => {
    const { m, b } = duel();
    m.setInput("a", { ...idleInput(), fire: true, ads: true });
    m.step(1 / 60);
    expect(b.hp).toBe(54);
    expect(m.events.some((e) => e.kind === "hit" && e.head)).toBe(true);
  });
  it("fires semi-auto only once per press", () => {
    const { m, a } = duel("mesa");
    m.setInput("a", { ...idleInput(), fire: true, pitch: -1 });
    advance(m, 1);
    expect(a.ammo).toBe(weapons.mesa.mag - 1);
    m.setInput("a", idleInput());
    m.step();
    m.setInput("a", { ...idleInput(), fire: true, pitch: -1 });
    m.step();
    expect(a.ammo).toBe(weapons.mesa.mag - 2);
  });
  it("blocks structural wall shots", () => {
    const { m, a, b } = duel();
    Object.assign(a, { x: -43, z: 0 });
    Object.assign(b, { x: -37, z: 0 });
    m.setInput("a", {
      ...idleInput(),
      yaw: Math.PI / 2,
      ads: true,
      fire: true,
    });
    advance(m, 1);
    expect(b.hp).toBe(100);
  });
  it("permits shooting over low barriers but stops body-level rays", () => {
    expect(wallDistance(10, 1.68, -17, 0, 0, 1, 20)).toBe(20);
    expect(wallDistance(10, 0.8, -17, 0, 0, 1, 20)).toBeLessThan(8);
  });
  it("respects three-second respawn and resets per-life supports", () => {
    const { m, a, b } = duel();
    b.supports = [1, 1, 1];
    m.setInput("a", { ...idleInput(), fire: true, ads: true });
    advance(m, 0.3);
    expect(b.alive).toBe(false);
    expect(a.kills).toBe(1);
    m.setInput("a", idleInput());
    advance(m, 3.1);
    expect(b.alive).toBe(true);
    expect(b.hp).toBe(100);
    expect(b.supports).toEqual([0, 0, 0]);
  });
  it("reload consumes reserve and cannot create ammo", () => {
    const { m, a } = duel();
    a.ammo = 2;
    a.reserve = 5;
    m.setInput("a", { ...idleInput(), reload: true });
    advance(m, 2.3);
    expect(a.ammo).toBe(7);
    expect(a.reserve).toBe(0);
  });
  it("equipment actions are consumed and projectiles terminate", () => {
    const { m, a } = duel();
    m.setInput("a", { ...idleInput(), lethal: true });
    advance(m, 0.1);
    expect(a.lethal).toBe(0);
    expect(m.projectiles.length).toBe(1);
    advance(m, 2.2);
    expect(m.projectiles.length).toBe(0);
    expect(m.events.some((e) => e.kind === "explosion")).toBe(true);
  });
  it("support kills never extend momentum", () => {
    const { m, a, b } = duel();
    a.momentum = 8;
    b.hp = 50;
    m.setInput("a", { ...idleInput(), support: true });
    m.step();
    expect(a.kills).toBe(1);
    expect(a.momentum).toBe(8);
    expect(a.supports[2]).toBe(1);
  });
  it("fixed seed reproduces bot outcomes", () => {
    const a = new MatchSimulation(91, 30, 10),
      b = new MatchSimulation(91, 30, 10);
    a.fillBots();
    b.fillBots();
    advance(a, 8);
    advance(b, 8);
    expect(a.snapshot()).toEqual(b.snapshot());
  });
});
describe("navigation and complete matches", () => {
  it("connects all authored interest points without cutting corners", () => {
    for (const a of patrolPoints)
      for (const b of patrolPoints) {
        const path = findPath(a, b);
        expect(path.length).toBeGreaterThan(0);
        let from = a;
        for (const to of path) {
          expect(walkableLine(from, to), JSON.stringify({ from, to })).toBe(
            true,
          );
          from = to;
        }
        expect(Math.hypot(from.x - b.x, from.z - b.z)).toBeLessThan(3);
      }
  });
  it("scores safe candidates across 10000 adversarial respawns", () => {
    const m = new MatchSimulation(42);
    m.fillBots();
    const p = [...m.players.values()][0];
    const spawn = (m as unknown as { spawn(p: Combatant): void }).spawn.bind(m);
    for (let i = 0; i < 10000; i++) {
      for (const enemy of m.players.values())
        if (enemy.team !== p.team) {
          enemy.x = -45 + ((i * 13 + enemy.name.length * 7) % 90);
          enemy.z = -32 + ((i * 7 + enemy.name.length * 3) % 64);
          if (blocked(enemy.x, enemy.z)) {
            enemy.x = 0;
            enemy.z = 35;
          }
        }
      spawn(p);
      expect(blocked(p.x, p.z)).toBe(false);
      const hasSafe = [-49, -32, -22, -2, 22, 32, 49]
        .flatMap((x) => [-42, -37].map((z) => ({ x, z })))
        .filter((a) => !blocked(a.x, a.z))
        .some(
          (a) =>
            ![...m.players.values()].some(
              (e) =>
                e.team !== p.team &&
                e.alive &&
                Math.hypot(a.x - e.x, a.z - e.z) < 25 &&
                clearLine(a, e),
            ),
        );
      if (hasSafe)
        expect(
          [...m.players.values()].some(
            (e) =>
              e.team !== p.team &&
              e.alive &&
              Math.hypot(p.x - e.x, p.z - e.z) < 25 &&
              clearLine(p, e),
          ),
        ).toBe(false);
    }
  });
  it.each([17, 815, 2309])(
    "bots complete full Team Clash seed %i and actively score",
    (seed) => {
      const m = new MatchSimulation(seed);
      m.fillBots();
      advance(m, 541);
      expect(m.winner).toBeTruthy();
      expect(Math.max(...m.score)).toBeGreaterThanOrEqual(35);
      expect(
        [...m.players.values()].filter((p) => p.kills > 0).length,
      ).toBeGreaterThanOrEqual(10);
      for (const p of m.players.values()) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(blocked(p.x, p.z, 0.35, p.y)).toBe(false);
      }
    },
    120000,
  );
});
