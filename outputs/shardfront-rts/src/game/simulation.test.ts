import { describe, expect, it } from "vitest";
import { GameSimulation } from "./simulation";

const options = { faction: "helix", difficulty: "easy", mode: "skirmish" } as const;

function advance(simulation: GameSimulation, seconds: number): void {
  for (let tick = 0; tick < seconds * 20; tick += 1) simulation.update(0.05);
}

describe("Shardfront simulation", () => {
  it("deploys mirrored starting forces with a functioning economy", () => {
    const simulation = new GameSimulation(options);
    const entities = [...simulation.entities.values()];

    expect(entities.filter((entity) => entity.team === "player" && entity.type === "hq")).toHaveLength(1);
    expect(entities.filter((entity) => entity.team === "ai" && entity.type === "hq")).toHaveLength(1);
    expect(entities.filter((entity) => entity.team === "player" && entity.type === "worker")).toHaveLength(6);
    expect(simulation.getSnapshot(60).economy.supplyCap).toBe(12);

    advance(simulation, 18);
    expect(simulation.economy.player.gatheredOre).toBeGreaterThan(0);
    expect(simulation.economy.player.ore).toBeGreaterThan(300);
  });

  it("constructs support infrastructure and expands the supply cap", () => {
    const simulation = new GameSimulation(options);
    const worker = [...simulation.entities.values()].find(
      (entity) => entity.team === "player" && entity.type === "worker",
    );
    expect(worker).toBeDefined();
    simulation.select([worker!.id]);

    expect(simulation.build("supply", -52, 36)).toBe(true);
    advance(simulation, 24);

    const support = [...simulation.entities.values()].find(
      (entity) => entity.team === "player" && entity.type === "supply",
    );
    expect(support?.complete).toBe(true);
    expect(simulation.getSnapshot(60).economy.supplyCap).toBe(20);
  });

  it("trains units through a headquarters production queue", () => {
    const simulation = new GameSimulation(options);
    const headquarters = [...simulation.entities.values()].find(
      (entity) => entity.team === "player" && entity.type === "hq",
    );
    expect(headquarters).toBeDefined();
    simulation.select([headquarters!.id]);

    expect(simulation.train("worker")).toBe(true);
    expect(headquarters!.queue).toHaveLength(1);
    advance(simulation, 8);

    const workers = [...simulation.entities.values()].filter(
      (entity) => entity.team === "player" && entity.type === "worker",
    );
    expect(workers).toHaveLength(7);
    expect(headquarters!.queue).toHaveLength(0);
  });

  it("lets a scout capture a neutral watch pylon", () => {
    const simulation = new GameSimulation(options);
    const scout = [...simulation.entities.values()].find(
      (entity) => entity.team === "player" && entity.type === "scout",
    );
    const pylon = simulation.pylons[0];
    expect(scout).toBeDefined();
    simulation.select([scout!.id]);
    simulation.commandMove({ x: pylon.x, z: pylon.z });

    advance(simulation, 16);
    expect(pylon.owner).toBe("player");
  });
});

describe('Astra gameplay regression coverage',()=>{
 it.each(['helix','chorus'] as const)('saves and deterministically resumes %s',faction=>{const first=new GameSimulation({...options,faction});advance(first,35);const second=new GameSimulation({...options,faction});second.restore(first.save());expect(second.stateHash()).toBe(first.stateHash());advance(first,40);advance(second,40);expect(second.stateHash()).toBe(first.stateHash());});
 it('replays validated player commands to identical state hashes',()=>{const original=new GameSimulation(options);const worker=[...original.entities.values()].find(e=>e.team==='player'&&e.type==='worker')!;const hq=[...original.entities.values()].find(e=>e.team==='player'&&e.type==='hq')!;original.select([hq.id]);original.train('worker');advance(original,5);original.select([worker.id]);original.build('supply',-52,36);advance(original,45);const replay=new GameSimulation({...options,replay:structuredClone(original.commands)});advance(replay,50);expect(replay.stateHash()).toBe(original.stateHash());});
 it('preserves shift-queued movement instead of replacing orders',()=>{const s=new GameSimulation(options),scout=[...s.entities.values()].find(e=>e.team==='player'&&e.type==='scout')!;s.select([scout.id]);s.commandMove({x:-25,z:20});s.commandMove({x:-20,z:5},false,true);expect(scout.moveTarget).toEqual({x:-25,z:20});expect(scout.waypoints).toHaveLength(1);advance(s,18);expect(Math.hypot(scout.x+20,scout.z-5)).toBeLessThan(1);});
 it('rejects an attack command against a hidden headquarters',()=>{const s=new GameSimulation(options),scout=[...s.entities.values()].find(e=>e.team==='player'&&e.type==='scout')!,enemy=[...s.entities.values()].find(e=>e.team==='ai'&&e.type==='hq')!;s.select([scout.id]);s.commandTarget(enemy.id);expect(scout.targetId).toBeUndefined();});
 it('both resources require a real extractor and supply blocks do not spend resources',()=>{const s=new GameSimulation(options),worker=[...s.entities.values()].find(e=>e.team==='player'&&e.type==='worker')!,vent=s.nodes.find(n=>n.kind==='flux'&&n.x<0&&n.z>15)!;s.select([worker.id]);s.commandGather(vent.id);advance(s,1);expect(s.economy.player.gatheredFlux).toBe(0);expect(s.build('extractor',vent.x,vent.z)).toBe(true);advance(s,24);s.commandGather(vent.id);advance(s,30);expect(s.economy.player.gatheredFlux).toBeGreaterThan(0);const hq=[...s.entities.values()].find(e=>e.team==='player'&&e.type==='hq')!;s.select([hq.id]);while(s.train('worker')){}const before=s.economy.player.ore;expect(s.train('worker')).toBe(false);expect(s.economy.player.ore).toBe(before);});
 it('produces an outcome when the only surviving command core falls',()=>{const s=new GameSimulation(options);const hq=[...s.entities.values()].find(e=>e.team==='ai'&&e.type==='hq')!;hq.hp=0;hq.deathTimer=.05;advance(s,.1);expect(s.result?.winner).toBe('player');expect(s.running).toBe(false);});
});
