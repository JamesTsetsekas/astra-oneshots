import { describe, expect, it } from "vitest";
import { generateItem, itemPower } from "./loot";
import { checksum, isValidSave } from "./persistence";
import { GameSimulation } from "./simulation";
import type { CharacterSave, GameOptions } from "./types";

const options: GameOptions = { heroClass: "cinder", heroName: "Eira Voss", difficulty: "normal", seed: 0xa51fa11 };

function advance(simulation: GameSimulation, seconds: number): void {
  for (let tick = 0; tick < seconds * 30; tick += 1) simulation.update(1 / 30);
}

describe("Ashfall Covenant systems", () => {
  it("generates deterministic, class-compatible loot", () => {
    const first = generateItem(9917, 8, "ranger", true, "inscribed");
    const second = generateItem(9917, 8, "ranger", true, "inscribed");
    expect(first).toEqual(second);
    expect(first.classTag === undefined || first.classTag === "ranger").toBe(true);
    expect(first.affixes.length).toBeGreaterThanOrEqual(3);
    expect(itemPower(first)).toBeGreaterThan(0);
  });

  it("advances the authored quest anchors in order", () => {
    const simulation = new GameSimulation(options);
    simulation.hero.x = -25;
    simulation.hero.z = -18;
    expect(simulation.interact()).toContain("frontier gate");
    expect(simulation.questStep).toBe("waypoint");

    simulation.hero.x = -7;
    simulation.hero.z = -5;
    expect(simulation.interact()).toContain("activated");
    expect(simulation.waypointActive).toBe(true);
    expect(simulation.questStep).toBe("tollKeeper");
  });

  it("keeps Ember Refuge safe while the Warden prepares", () => {
    const simulation = new GameSimulation(options);
    const startingHealth = simulation.hero.hp;
    expect(simulation.interact()).toContain("frontier gate");
    advance(simulation, 45);
    expect(simulation.hero.hp).toBe(startingHealth);
    expect(simulation.hero.deaths).toBe(0);
    expect([...simulation.enemyMap.values()].filter((enemy) => enemy.visible).every((enemy) => enemy.state === "dormant")).toBe(true);
  });

  it("runs combat through telegraph, execution, death, and loot", () => {
    const simulation = new GameSimulation(options);
    simulation.hero.x = -20;
    simulation.hero.z = -15;
    const target = [...simulation.enemyMap.values()].find((enemy) => enemy.type === "crawler")!;
    target.x = -18.5;
    target.z = -15;
    target.hp = 1;
    simulation.attack(target.id);
    advance(simulation, 1.5);
    expect(target.state).toBe("dead");
    expect(simulation.hero.kills).toBeGreaterThan(0);
    expect(simulation.pickupMap.size).toBeGreaterThan(0);
  });

  it("spends Focus and starts ability cooldowns", () => {
    const simulation = new GameSimulation(options);
    const before = simulation.hero.focus;
    expect(simulation.cast("cinderRing", simulation.hero)).toBe(true);
    expect(simulation.hero.focus).toBe(before - 35);
    expect(simulation.cooldowns.get("cinderRing")).toBe(7);
    advance(simulation, 1);
    expect(simulation.cooldowns.get("cinderRing")).toBeLessThan(7);
  });

  it("rejects a save whose payload no longer matches its checksum", () => {
    const simulation = new GameSimulation(options);
    const payload: CharacterSave["payload"] = {
      heroClass: "cinder", heroName: "Eira Voss", difficulty: "normal", seed: options.seed,
      hero: simulation.hero, questStep: "keeper", waypointActive: false, artificerRescued: false, veteranUnlocked: false,
    };
    const save: CharacterSave = { schemaVersion: 1, savedAt: 1, checksum: checksum(payload), payload };
    expect(isValidSave(save)).toBe(true);
    save.payload.hero.gold += 1;
    expect(isValidSave(save)).toBe(false);
  });
});
