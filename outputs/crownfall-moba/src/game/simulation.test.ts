import { describe, it, expect } from "vitest";
import replaySource from '../../docs/browser-match-evidence.json?raw';
import { Simulation, type Options } from "./simulation";
import { HEROES, ITEMS } from "./content";
import { checksum, decodeProfile } from "./persistence";
const options: Options = {
  hero: "suri",
  seed: 20260928,
  mode: "skirmish",
  talents: ["Blink", "Mend"],
};
describe("Crownfall rules", () => {
  it('reproduces the actual production-browser match from its exported player inputs',()=>{
    const replay=JSON.parse(replaySource);
    const s=new Simulation(replay.options);let input=0;
    for(let tick=0;tick<30000&&!s.result;tick++){
      while(input<replay.commands.length&&replay.commands[input].tick===s.tick){const command=replay.commands[input++];s.command(command.type,command.value);}
      s.step();
    }
    expect(s.result).toEqual(replay.result);
  },30000);
  it("rejects malformed rank, sell and talent indices", () => {
    const s = new Simulation(options);
    s.command("buy", 0);
    for (const invalid of [NaN, Infinity, -1, 0.5, 99]) {
      expect(s.command("rank", invalid)).toBe(false);
      expect(s.command("sell", invalid)).toBe(false);
      expect(
        s.command("talent", { index: invalid, point: { x: 0, z: 0 } }),
      ).toBe(false);
    }
    expect(s.player.items).toEqual([0]);
  });
  it("casts all twenty-four hero abilities with legal trained fixtures", () => {
    for (const hero of HEROES) {
      const s = new Simulation({ ...options, hero: hero.id });
      s.player.level = 6;
      s.player.points = 4;
      for (let slot = 0; slot < 4; slot++) {
        expect(s.command("rank", slot), hero.name).toBe(true);
        s.player.mana = 1000;
        expect(
          s.command("cast", { slot, point: { x: -54, z: 0 } }),
          `${hero.name} ${slot}`,
        ).toBe(true);
        expect(s.player.cooldowns[slot]).toBeGreaterThan(0);
      }
    }
  });
  it("completes a bot recall without restarting its channel", () => {
    const s = new Simulation(options);
    const bot = s.units.find(
      (u) => u.team === 0 && u.bot && u.kind === "hero",
    )!;
    bot.x = -10;
    bot.z = 0;
    bot.hp = 20;
    for (let i = 0; i < 230; i++) s.step();
    expect(Math.hypot(bot.x - bot.home.x, bot.z - bot.home.z)).toBeLessThan(8);
    expect(bot.hp).toBeGreaterThan(20);
  });
  it("discounts consumed recipe components without resetting other item cooldowns", () => {
    const s = new Simulation(options);
    s.player.gold = 5000;
    s.command("buy", 19);
    s.command("item", 0);
    s.command("buy", 6);
    s.command("buy", 13);
    expect(s.player.itemCds[0]).toBe(50);
    const before = s.player.gold;
    s.command("buy", 16);
    expect(before - s.player.gold).toBe(820);
    expect(s.player.items).toEqual([19, 16]);
    expect(s.player.itemCds[0]).toBe(50);
  });
  it("wards reveal opponents outside normal hero sight and expire", () => {
    const s = new Simulation(options);
    const e = s.units.find((u) => u.team === 1 && u.kind === "hero")!;
    e.x = -36;
    e.z = 0;
    expect(s.visibleTo(0, e)).toBe(false);
    expect(s.command("ward", { x: -53, z: 0 })).toBe(true);
    expect(s.visibleTo(0, e)).toBe(true);
    const ward = s.units.find((u) => u.kind === "ward")!;
    ward.hp = 0;
    expect(s.visibleTo(0, e)).toBe(false);
  });
  it("validates local profiles and detects corruption before use", () => {
    const data = { version: 1 as const, history: [], mastery: { suri: 120 } };
    expect(decodeProfile({ data, checksum: checksum(data) })).toEqual(data);
    expect(decodeProfile({ data, checksum: "bad" })).toBeUndefined();
    expect(
      decodeProfile({
        data: { ...data, history: [{}] },
        checksum: checksum({ ...data, history: [{}] }),
      }),
    ).toBeUndefined();
    expect(decodeProfile(null)).toBeUndefined();
  });
  it("limits accelerated simulation to the visible bot pilot", () => {
    const s = new Simulation(options);
    expect(s.command("speed", 4)).toBe(false);
    s.command("auto");
    expect(s.command("speed", 4)).toBe(true);
    s.command("auto");
    expect(s.speed).toBe(1);
  });
  it("has six unique kits and 32 priced items", () => {
    expect(HEROES).toHaveLength(6);
    expect(ITEMS).toHaveLength(32);
    expect(
      new Set(HEROES.flatMap((h) => h.abilities.map((a) => a.name))).size,
    ).toBe(24);
  });
  it("rejects illegal abilities, ranks and non-finite movement", () => {
    const s = new Simulation(options);
    expect(s.command("cast", { slot: 3, point: { x: 0, z: 0 } })).toBe(false);
    expect(s.command("rank", 3)).toBe(false);
    expect(s.command("move", { x: NaN, z: 0 })).toBe(false);
    expect(s.command("rank", 0)).toBe(true);
    expect(s.command("cast", { slot: 0, point: { x: -30, z: -25 } })).toBe(
      true,
    );
    expect(s.player.mana).toBe(270);
  });
  it("only permits purchases in the fountain with enough gold", () => {
    const s = new Simulation(options);
    expect(s.command("buy", 0)).toBe(true);
    expect(s.player.gold).toBe(150);
    expect(s.command("buy", 16)).toBe(false);
    s.player.x = 0;
    expect(s.command("buy", 30)).toBe(false);
  });
  it("preserves tower, Seal and Engine vulnerability order", () => {
    const s = new Simulation(options);
    const lane = s.units.filter((u) => u.team === 1 && u.lane === 0);
    const outer = lane.find((u) => u.kind === "tower" && u.waypoint === 0)!,
      inner = lane.find((u) => u.kind === "tower" && u.waypoint === 1)!,
      seal = lane.find((u) => u.kind === "seal")!,
      engine = s.units.find((u) => u.team === 1 && u.kind === "engine")!;
    expect(s.vulnerable(outer)).toBe(true);
    expect(s.vulnerable(inner)).toBe(false);
    expect(s.vulnerable(seal)).toBe(false);
    expect(s.vulnerable(engine)).toBe(false);
    outer.hp = 0;
    expect(s.vulnerable(inner)).toBe(true);
    for (const u of lane) if (u.kind === "tower") u.hp = 0;
    expect(s.vulnerable(seal)).toBe(true);
    seal.hp = 0;
    for (const u of s.units)
      if (u.team === 1 && u.kind === "coreTower") u.hp = 0;
    expect(s.vulnerable(engine)).toBe(true);
  });
  it("hides opponents beyond allied vision and reveals them with wards", () => {
    const s = new Simulation(options);
    const e = s.units.find((u) => u.team === 1 && u.kind === "hero")!;
    expect(s.visibleTo(0, e)).toBe(false);
    e.x = -54;
    e.z = 0;
    expect(s.visibleTo(0, e)).toBe(true);
  });
  it("pauses without progressing simulation or spending gold", () => {
    const s = new Simulation(options);
    s.paused = true;
    s.update(1);
    expect(s.time).toBe(0);
    expect(s.command("buy", 0)).toBe(false);
  });
  it("reproduces a fixed input sequence deterministically", () => {
    const run = () => {
      const s = new Simulation(options);
      s.command("rank", 0);
      s.command("move", { x: -30, z: -32 });
      for (let i = 0; i < 900; i++) s.step();
      return s.snapshot();
    };
    expect(run()).toEqual(run());
  });
  it("starts objective clocks and minion waves", () => {
    const s = new Simulation(options);
    for (let i = 0; i < 160; i++) s.step();
    expect(s.units.some((u) => u.kind === "guard")).toBe(true);
    expect(s.objectives[0]).toBeLessThan(210);
  });
  it("finishes a complete six-bot match through actual structure destruction", () => {
    const s = new Simulation(options);
    s.auto = true;
    for (let i = 0; i < 30 * 1800 && !s.result; i++) s.step();
    expect(
      s.result,
      `t=${s.time.toFixed(0)} living towers=${s.units.filter((u) => u.kind === "tower" && u.hp > 0).length}`,
    ).toBeDefined();
    expect(s.units.some((u) => u.kind === "engine" && u.hp <= 0)).toBe(true);
    expect(s.result?.scoreboard).toHaveLength(6);
  }, 30000);
});
