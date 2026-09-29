import { describe, it, expect } from "vitest";
import { ProtocolMatch, idleInput, type Combatant } from "./simulation";
import { sites, weapons, type WeaponId } from "./data";
import { blocked, findPath, walkableLine, clearLine } from "./navigation";
const advance = (m: ProtocolMatch, seconds: number) => {
  for (let i = 0; i < Math.ceil(seconds * 64); i++) m.step(1 / 64);
};
function fixture() {
  const m = new ProtocolMatch(42, "quick");
  const p = m.addHuman();
  for (const a of m.players) a.bot = false;
  m.phase = "action";
  m.remaining = 60;
  return { m, p };
}
function plantFixture() {
  const { m, p } = fixture();
  Object.assign(p, { x: sites[0].x, z: sites[0].z, carry: true });
  m.objective = {
    state: "carried",
    carrier: p.id,
    x: p.x,
    z: p.z,
    remaining: 25,
    progress: 0,
  };
  m.setInput(p.id, { ...idleInput(), interact: true });
  return { m, p };
}
describe("authoritative economy", () => {
  it("keeps separate weapon magazines and reserves when switching", () => {
    const m = new ProtocolMatch(1),
      p = m.addHuman();
    for (const a of m.players) a.bot = false;
    p.money = 12000;
    m.buy(p.id, "aster", "gun");
    m.buy(p.id, "rook", "pistol");
    expect(p.ammo).toBe(30);
    expect(p.reserve).toBe(90);
    expect(p.sideAmmo).toBe(6);
    expect(p.sideReserve).toBe(18);
    m.phase = "action";
    p.ammo = 11;
    p.reserve = 47;
    m.setInput(p.id, { ...idleInput(), slot: 1 });
    m.step();
    expect(p.ammo).toBe(6);
    expect(p.reserve).toBe(18);
    m.setInput(p.id, { ...idleInput(), slot: 0 });
    m.step();
    expect(p.ammo).toBe(11);
    expect(p.reserve).toBe(47);
  });
  it("can drop a primary during buy and replace it without refund duplication", () => {
    const m = new ProtocolMatch(1),
      p = m.addHuman();
    p.money = 12000;
    m.buy(p.id, "aster", "gun");
    p.reserve = 17;
    expect(m.dropPrimary(p.id).ok).toBe(true);
    expect(m.refund(p.id).ok).toBe(false);
    expect(m.dropped[0].reserve).toBe(17);
    expect(m.buy(p.id, "longglass", "next").ok).toBe(true);
    expect(p.primary).toBe("longglass");
  });
  it("refills surviving weapons and selects the correct primary at a new round", () => {
    const m = new ProtocolMatch(1),
      p = m.addHuman();
    p.money = 12000;
    m.buy(p.id, "aster", "gun");
    m.phase = "action";
    m.setInput(p.id, { ...idleInput(), slot: 1 });
    m.step();
    p.ammo = 2;
    (m as unknown as { finishRound(w: string, r: string): void }).finishRound(
      "aurora",
      "TEST",
    );
    advance(m, 4.1);
    expect(p.slot).toBe(0);
    expect(p.ammo).toBe(30);
    expect(p.sideAmmo).toBe(15);
    expect(p.reserve).toBe(90);
  });
  it("starts at800 with a starter pistol and no primary", () => {
    const m = new ProtocolMatch(1),
      p = m.addHuman();
    expect(p.money).toBe(800);
    expect(p.primary).toBeUndefined();
    expect(p.loadout.sidearm).toBe("vela");
  });
  it("validates balance, side restrictions and idempotent purchases", () => {
    const m = new ProtocolMatch(1),
      p = m.addHuman();
    expect(m.buy(p.id, "aster", "1").ok).toBe(false);
    expect(m.buy(p.id, "kit", "2").ok).toBe(false);
    expect(m.buy(p.id, "vest", "3").ok).toBe(true);
    expect(p.money).toBe(150);
    expect(m.buy(p.id, "vest", "3").ok).toBe(false);
    expect(p.money).toBe(150);
  });
  it("refund restores previous armor rather than erasing it", () => {
    const m = new ProtocolMatch(1),
      p = m.addHuman();
    p.money = 2000;
    p.armor = 43;
    m.buy(p.id, "helmet", "1");
    expect(p.armor).toBe(100);
    expect(m.refund(p.id).ok).toBe(true);
    expect(p.money).toBe(2000);
    expect(p.armor).toBe(43);
    expect(p.helmet).toBe(false);
  });
  it("rejects unknown equipment and out-of-phase buys", () => {
    const { m, p } = fixture();
    p.money = 12000;
    expect(m.buy(p.id, "aster", "1").ok).toBe(false);
    m.phase = "buy";
    expect(m.buy(p.id, "hack" as WeaponId, "2").ok).toBe(false);
  });
  it("enforces four utility capacity and per-type limits", () => {
    const m = new ProtocolMatch(1),
      p = m.addHuman();
    p.money = 12000;
    expect(m.buy(p.id, "veil", "1").ok).toBe(true);
    expect(m.buy(p.id, "veil", "2").ok).toBe(false);
    expect(m.buy(p.id, "flash", "3").ok).toBe(true);
    expect(m.buy(p.id, "flash", "4").ok).toBe(true);
    expect(m.buy(p.id, "frag", "5").ok).toBe(true);
    expect(m.buy(p.id, "thermite", "6").ok).toBe(false);
  });
  it("preserves survivor weapons and clears eliminated inventory next round", () => {
    const m = new ProtocolMatch(1),
      p = m.addHuman();
    p.money = 12000;
    m.buy(p.id, "aster", "1");
    const other = m.players[1];
    other.primary = "krait";
    other.alive = false;
    (m as unknown as { finishRound(w: string, r: string): void }).finishRound(
      "aurora",
      "TEST",
    );
    advance(m, 4.1);
    expect(p.primary).toBe("aster");
    expect(other.primary).toBeUndefined();
  });
  it("swaps sides and resets economy at halftime", () => {
    const m = new ProtocolMatch(1, "quick");
    m.addHuman();
    for (let i = 0; i < 4; i++) {
      (m as unknown as { finishRound(w: string, r: string): void }).finishRound(
        i % 2 ? "obsidian" : "aurora",
        "TEST",
      );
      advance(m, 4.1);
    }
    expect(m.round).toBe(5);
    expect(m.attacker).toBe("obsidian");
    expect(m.players.every((p) => p.money === 800)).toBe(true);
  });
});
describe("Cipher objective", () => {
  it("arms only after3.2 uninterrupted seconds at a legal site", () => {
    const { m, p } = plantFixture();
    advance(m, 3.0);
    expect(m.objective.state).toBe("carried");
    advance(m, 0.25);
    expect(m.objective.state).toBe("armed");
    expect(p.plants).toBe(1);
    expect(p.money).toBe(1100);
  });
  it("moving or releasing interact resets arming progress", () => {
    const { m, p } = plantFixture();
    advance(m, 2);
    m.setInput(p.id, idleInput());
    advance(m, 0.1);
    expect(m.objective.progress).toBe(0);
    m.setInput(p.id, { ...idleInput(), interact: true });
    advance(m, 2);
    expect(m.objective.state).toBe("carried");
  });
  it("rejects arming outside both vaults", () => {
    const { m, p } = plantFixture();
    p.x = 0;
    p.z = -15;
    advance(m, 4);
    expect(m.objective.state).toBe("carried");
  });
  it("both A and B accept the objective", () => {
    const { m, p } = plantFixture();
    p.x = sites[1].x;
    p.z = sites[1].z;
    advance(m, 3.3);
    expect(m.objective.site).toBe("B");
  });
  it.each([false, true])("disarms with correct kit=%s timing", (kit) => {
    const { m, p } = plantFixture();
    advance(m, 3.3);
    p.x = -48;
    p.z = -30;
    m.setInput(p.id, idleInput());
    const d = m.players.find((a) => a.team !== m.attacker)!;
    Object.assign(d, { x: sites[0].x, z: sites[0].z, kit });
    d.input = { ...idleInput(), interact: true };
    const duration = kit ? 5 : 8;
    advance(m, duration - 0.2);
    expect(m.phase).toBe("armed");
    advance(m, 0.3);
    expect(m.reason).toBe("CIPHER DISARMED");
    expect(d.defuses).toBe(1);
  });
  it("keeps armed round live after all attackers die", () => {
    const { m } = plantFixture();
    advance(m, 3.3);
    m.players.filter((p) => m.isAttacker(p)).forEach((p) => (p.alive = false));
    advance(m, 1);
    expect(m.phase).toBe("armed");
    advance(m, 25);
    expect(m.reason).toBe("CIPHER UPLOADED");
  });
  it("drops the carried Spike on death and supports teammate pickup", () => {
    const { m, p } = plantFixture(),
      enemy = m.players.find((e) => e.team !== p.team)!;
    (
      m as unknown as {
        damage(v: Combatant, a: Combatant, n: number, s: string): void;
      }
    ).damage(p, enemy, 200, "vela");
    expect(m.objective.state).toBe("dropped");
    const ally = m.players.find((e) => e.team === p.team && e !== p)!;
    Object.assign(ally, { x: p.x, z: p.z });
    ally.input = { ...idleInput(), interact: true };
    advance(m, 0.1);
    expect(ally.carry).toBe(true);
    expect(m.objective.carrier).toBe(ally.id);
  });
  it("does not revive dead players mid-round", () => {
    const { m, p } = fixture();
    p.alive = false;
    advance(m, 10);
    expect(p.alive).toBe(false);
  });
});
describe("combat, smoke and map", () => {
  it("Lumen fires exactly three rounds per held trigger pull", () => {
    const { m, p } = fixture();
    Object.assign(p, { primary: "lumen", slot: 0, ammo: 24, x: 0, z: -15 });
    m.setInput(p.id, { ...idleInput(), fire: true, pitch: -1 });
    advance(m, 0.6);
    expect(p.ammo).toBe(21);
    m.setInput(p.id, idleInput());
    m.step();
    m.setInput(p.id, { ...idleInput(), fire: true, pitch: -1 });
    advance(m, 0.5);
    expect(p.ammo).toBe(18);
  });
  it("resolves overlapping alive capsules without pushing into walls", () => {
    const { m, p } = fixture(),
      a = m.players[1];
    Object.assign(p, { x: 0, z: -15 });
    Object.assign(a, { x: 0, z: -15 });
    advance(m, 0.2);
    expect(Math.hypot(p.x - a.x, p.z - a.z)).toBeGreaterThanOrEqual(0.7);
    expect(blocked(p.x, p.z)).toBe(false);
    expect(blocked(a.x, a.z)).toBe(false);
  });
  it.each(Object.keys(weapons) as WeaponId[])(
    "fires %s with authoritative ammo",
    (id) => {
      const { m, p } = fixture(),
        w = weapons[id];
      Object.assign(p, {
        x: 0,
        z: -15,
        ammo: w.mag,
        slot: w.role === "Sidearm" ? 1 : 0,
        primary: w.role === "Sidearm" ? undefined : id,
      });
      if (w.role === "Sidearm") p.loadout.sidearm = id;
      else p.loadout.primary = id;
      const enemy = m.players.find((e) => e.team !== p.team)!;
      Object.assign(enemy, { x: 0, z: -8, armor: 0 });
      m.setInput(p.id, { ...idleInput(), fire: true, pitch: 0.054 });
      m.step();
      expect(p.ammo).toBe(w.mag - 1);
      expect(enemy.hp).toBeLessThan(100);
    },
  );
  it("smoke blocks bot information equally, then expires", () => {
    const { m, p } = fixture(),
      enemy = m.players.find((e) => e.team !== p.team)!;
    Object.assign(p, { x: 0, z: -15 });
    Object.assign(enemy, { x: 0, z: -8 });
    expect(m.visible(p, enemy)).toBe(true);
    m.areas.push({
      id: 999,
      kind: "veil",
      x: 0,
      z: -11,
      radius: 3,
      remaining: 1,
      actor: p.id,
      nextPulse: 0,
    });
    expect(m.visible(p, enemy)).toBe(false);
    advance(m, 1.1);
    expect(m.visible(p, enemy)).toBe(true);
  });
  it("has collision-free routes from both spawns to both sites", () => {
    for (const from of [
      { x: -6, z: -41 },
      { x: 6, z: -41 },
      { x: -6, z: 42 },
      { x: 6, z: 42 },
    ])
      for (const site of sites) {
        const path = findPath(from, site);
        expect(path.length).toBeGreaterThan(0);
        let p = from;
        for (const to of path) {
          expect(walkableLine(p, to)).toBe(true);
          p = to;
        }
      }
    expect(clearLine({ x: 0, z: -41 }, { x: 0, z: 42 })).toBe(false);
  });
  it.each([41, 815, 2709])(
    "bots play both halves and complete standard match seed %i",
    (seed) => {
      const m = new ProtocolMatch(seed, "standard");
      for (let i = 0; i < 64 * 3000 && !m.winner; i++) m.step();
      expect(m.winner).toBeTruthy();
      expect(m.round).toBeGreaterThanOrEqual(9);
      expect(m.history.some((r) => r.attacker === "obsidian")).toBe(true);
      expect(
        m.players.every(
          (p) => Number.isFinite(p.money) && p.money >= 0 && p.money <= 12000,
        ),
      ).toBe(true);
      expect(m.players.reduce((sum, p) => sum + p.plants, 0)).toBeGreaterThan(
        0,
      );
    },
    120000,
  );
});
