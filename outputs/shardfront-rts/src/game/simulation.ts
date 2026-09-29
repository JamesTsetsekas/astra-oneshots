import {
  AI_SPAWN,
  buildings,
  PLAYER_SPAWN,
  TICK_RATE,
  units,
  WORLD_DEPTH,
  WORLD_WIDTH,
} from "./data";
import { findPath, navigable, terrainBlocked } from "./world";
import type {
  BuildingType,
  Cost,
  Entity,
  EntityType,
  Faction,
  GameOptions,
  GameResult,
  GameSnapshot,
  MatchEvent,
  ProductionItem,
  ResourceKind,
  ResourceNode,
  Team,
  TeamEconomy,
  UnitType,
  Vec2,
  WatchPylon,
  RecordedCommand,
} from "./types";

const DT = 1 / TICK_RATE;
const PLAYER: Exclude<Team, "neutral"> = "player";
const AI: Exclude<Team, "neutral"> = "ai";

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

class SeededRandom {
  state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
}

function emptyEconomy(): TeamEconomy {
  return {
    ore: 300,
    flux: 0,
    supplyUsed: 0,
    supplyCap: 0,
    attackLevel: 0,
    armorLevel: 0,
    gatheredOre: 0,
    gatheredFlux: 0,
    unitsCreated: 0,
    unitsLost: 0,
    structuresBuilt: 0,
  };
}

function canAfford(economy: TeamEconomy, cost: Cost): boolean {
  return economy.ore >= cost.ore && economy.flux >= cost.flux;
}

function spend(economy: TeamEconomy, cost: Cost): void {
  economy.ore -= cost.ore;
  economy.flux -= cost.flux;
}

function opposite(faction: Faction): Faction {
  return faction === "helix" ? "chorus" : "helix";
}

export interface SimulationView {
  entities: Entity[];
  nodes: ResourceNode[];
  pylons: WatchPylon[];
  events: MatchEvent[];
  result?: GameResult;
}

export class GameSimulation {
  readonly options: GameOptions;
  readonly entities = new Map<number, Entity>();
  readonly nodes: ResourceNode[] = [];
  readonly pylons: WatchPylon[] = [];
  readonly events: MatchEvent[] = [];
  readonly economy: Record<Exclude<Team, "neutral">, TeamEconomy> = {
    player: emptyEconomy(),
    ai: emptyEconomy(),
  };

  time = 0;
  paused = false;
  running = true;
  result?: GameResult;
  tutorialStep = 0;
  private nextId = 1;
  private accumulator = 0;
  private economyTimer = 0;
  private aiTimer = 0;
  private snapshotTimer = 0;
  private random = new SeededRandom(0x5a17f00d);
  private lastEventCursor = 0;
  private playerSelection = new Set<number>();
  private enemyKnown = new Set<number>();
  private attackWave = 0;
  private revealPulseTimer = 0;
  private aiHasSeenPlayerBase = false;
  private navVersion = 0;
  readonly commands: RecordedCommand[] = [];
  private replayCursor = 0;
  private replayDispatch = false;
  private aiKnownBase?: Vec2;

  constructor(options: GameOptions) {
    this.options = options;
    this.setupMap();
    this.setupTeam(PLAYER, options.faction, PLAYER_SPAWN);
    this.setupTeam(AI, opposite(options.faction), AI_SPAWN);
    this.assignInitialWorkers();
    this.recalculateEconomy();
    this.pushEvent("milestone", `Deployment complete. ${this.teamFaction(PLAYER) === "helix" ? "Core Relay" : "Heartgrove"} online.`);
  }

  get view(): SimulationView {
    return {
      entities: [...this.entities.values()],
      nodes: this.nodes,
      pylons: this.pylons,
      events: this.events,
      result: this.result,
    };
  }

  get selectedIds(): number[] {
    return [...this.playerSelection].filter((id) => this.entities.has(id));
  }

  get selectedEntities(): Entity[] {
    return this.selectedIds.map((id) => this.entities.get(id)!).filter(Boolean);
  }

  update(frameDt: number): boolean {
    if (!this.running || this.paused) return false;
    this.accumulator = Math.min(this.accumulator + frameDt, 0.25);
    let changed = false;
    while (this.accumulator >= DT) {
      this.step(DT);
      this.accumulator -= DT;
      changed = true;
    }
    return changed;
  }

  private step(dt: number): void {
    if(this.options.replay){
      const tick=Math.round(this.time*TICK_RATE);
      while(this.replayCursor<this.options.replay.length && this.options.replay[this.replayCursor].tick<=tick){
        const command=this.options.replay[this.replayCursor++];
        this.replayDispatch=true;this.select(command.selected);
        const methods:Record<string,(...args:any[])=>unknown>={move:this.commandMove.bind(this),target:this.commandTarget.bind(this),gather:this.commandGather.bind(this),stop:this.stopSelected.bind(this),hold:this.holdSelected.bind(this),ability:this.toggleBrace.bind(this),rally:this.setRally.bind(this),build:this.build.bind(this),train:this.train.bind(this),research:this.research.bind(this),cancel:this.cancelQueue.bind(this),group:this.recordGroup.bind(this)};
        methods[command.kind]?.(...command.args);this.replayDispatch=false;
      }
    }
    this.time += dt;
    this.economyTimer += dt;
    this.aiTimer += dt;
    this.snapshotTimer += dt;
    this.revealPulseTimer += dt;

    this.updateConstructionAndProduction(dt);
    this.updateEntities(dt);
    this.resolveSeparation();
    this.updatePylons(dt);
    this.cleanupDead(dt);
    this.updateVisibilityKnowledge();
    this.updateTutorial();

    const aiCadence = this.options.difficulty === "hard" ? 0.75 : this.options.difficulty === "easy" ? 2.25 : 1.25;
    if (this.aiTimer >= aiCadence) {
      this.aiTimer = 0;
      this.updateAi();
    }

    if (this.economyTimer >= 0.5) {
      this.economyTimer = 0;
      this.recalculateEconomy();
    }

    if (this.time >= 18 * 60 && this.revealPulseTimer >= 90) {
      this.revealPulseTimer = 0;
      this.pushEvent("milestone", "Glass Ravine emits a reveal pulse. Resource yield accelerated.");
      for (const entity of this.entities.values()) entity.lastSeen = this.time;
    }

    this.checkVictory();
  }

  private setupMap(): void {
    const clusters = [
      { x: -35, z: 26 },
      { x: 35, z: -26 },
      { x: -27, z: 8 },
      { x: 27, z: -8 },
      { x: -36, z: -25 },
      { x: 36, z: 25 },
      { x: 0, z: 0 },
    ];
    for (const [clusterIndex, cluster] of clusters.entries()) {
      const count = clusterIndex === 6 ? 5 : 7;
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 + Math.floor(clusterIndex/2)*.41 + (clusterIndex%2?Math.PI:0);
        this.nodes.push({
          id: this.nextId++,
          kind: "ore",
          x: cluster.x + Math.cos(angle) * (3.2 + (i % 2) * 0.7),
          z: cluster.z + Math.sin(angle) * (3.2 + (i % 2) * 0.7),
          amount: clusterIndex === 6 ? 480 : 900,
          maxAmount: clusterIndex === 6 ? 480 : 900,
          radius: 0.85,
        });
      }
      if (clusterIndex !== 6) {
        this.nodes.push({
          id: this.nextId++,
          kind: "flux",
          x: cluster.x + (clusterIndex%2?-6.5:6.5),
          z: cluster.z + (clusterIndex%2?1.5:-1.5),
          amount: 950,
          maxAmount: 950,
          radius: 1.35,
        });
      }
    }
    this.pylons.push(
      { id: this.nextId++, x: -8, z: -2, owner: "neutral", capture: 0, capturing: "neutral" },
      { id: this.nextId++, x: 9, z: 5, owner: "neutral", capture: 0, capturing: "neutral" },
    );
  }

  private setupTeam(team: Exclude<Team, "neutral">, faction: Faction, spawn: Vec2): void {
    this.createBuilding(team, faction, "hq", spawn.x, spawn.z, true);
    for (let i = 0; i < 6; i += 1) {
      const angle=(i/6)*Math.PI*2;
      this.createUnit(team, faction, "worker", spawn.x + Math.cos(angle)*5.2, spawn.z + Math.sin(angle)*5.2);
    }
    this.createUnit(team, faction, "scout", spawn.x + (team === PLAYER ? 5 : -5), spawn.z + (team === PLAYER ? -4 : 4));
  }

  private assignInitialWorkers(): void {
    for (const team of [PLAYER, AI] as const) {
      const hq = this.findTeamBuilding(team, "hq");
      if (!hq) continue;
      const ore = this.nearestNode(hq, "ore");
      if (!ore) continue;
      const seams=this.nodes.filter(n=>n.kind==='ore').sort((a,b)=>distance(a,hq)-distance(b,hq)).slice(0,7);
      this.teamUnits(team, "worker").forEach((worker,i)=>this.assignGather(worker,seams[i%seams.length]));
    }
    const aiScout = this.teamUnits(AI, "scout")[0];
    if (aiScout) {
      aiScout.order = "move";
      aiScout.moveTarget = { x: -15, z: 10 };
    }
  }

  private createUnit(team: Exclude<Team, "neutral">, faction: Faction, type: UnitType, x: number, z: number): Entity {
    const def = units[type];
    const hpModifier = faction === "chorus" && type === "heavy" ? 1.07 : 1;
    const entity: Entity = {
      id: this.nextId++,
      team,
      faction,
      kind: "unit",
      type,
      x: clamp(x, -WORLD_WIDTH / 2 + 1, WORLD_WIDTH / 2 - 1),
      z: clamp(z, -WORLD_DEPTH / 2 + 1, WORLD_DEPTH / 2 - 1),
      y: type === "scout" && faction === "chorus" ? 1.2 : 0,
      radius: def.radius,
      hp: def.hp * hpModifier,
      maxHp: def.hp * hpModifier,
      armor: def.armor,
      vision: def.vision,
      complete: true,
      buildProgress: 1,
      selected: false,
      visible: team === PLAYER,
      lastSeen: team === PLAYER ? this.time : -Infinity,
      order: "idle",
      cargoAmount: 0,
      actionTimer: 0,
      attackTimer: this.random.range(0, 0.3),
      queue: [],
      brace: false,
      slowTimer: 0,
    };
    this.entities.set(entity.id, entity);
    this.economy[team].unitsCreated += 1;
    return entity;
  }

  private createBuilding(
    team: Exclude<Team, "neutral">,
    faction: Faction,
    type: BuildingType,
    x: number,
    z: number,
    complete: boolean,
  ): Entity {
    const def = buildings[type];
    const entity: Entity = {
      id: this.nextId++,
      team,
      faction,
      kind: "building",
      type,
      x,
      z,
      y: 0,
      radius: def.radius,
      hp: complete ? def.hp : Math.max(25, def.hp * 0.1),
      maxHp: def.hp,
      armor: type === "hq" ? 4 : type === "turret" ? 3 : 2,
      vision: def.vision,
      complete,
      buildProgress: complete ? 1 : 0,
      selected: false,
      visible: team === PLAYER,
      lastSeen: team === PLAYER ? this.time : -Infinity,
      order: "idle",
      cargoAmount: 0,
      actionTimer: 0,
      attackTimer: 0,
      queue: [],
      brace: false,
      slowTimer: 0,
    };
    this.entities.set(entity.id, entity);
    this.navVersion++;
    if (complete) this.economy[team].structuresBuilt += 1;
    return entity;
  }

  private updateConstructionAndProduction(dt: number): void {
    for (const entity of this.entities.values()) {
      if (entity.kind !== "building" || entity.deathTimer !== undefined) continue;
      const def = buildings[entity.type as BuildingType];
      if (!entity.complete) {
        const nearbyWorker = this.teamUnits(entity.team, "worker").find((worker) => distance(worker, entity) <= entity.radius + 1.5);
        const speed = nearbyWorker ? 1 : 0.3;
        entity.buildProgress = Math.min(1, entity.buildProgress + (dt / def.buildTime) * speed);
        entity.hp = Math.max(entity.hp, entity.maxHp * entity.buildProgress);
        if (entity.buildProgress >= 1) {
          entity.complete = true;
          entity.hp = entity.maxHp;
          this.economy[entity.team].structuresBuilt += 1;
          if(entity.team===PLAYER)this.pushEvent("milestone", `${def.label[entity.faction]} complete.`);
        }
        continue;
      }

      const item = entity.queue[0];
      if (!item) continue;
      if(item.type in units&&this.economy[entity.team].supplyUsed>this.economy[entity.team].supplyCap)continue;
      item.elapsed += dt;
      if (item.elapsed < item.duration) continue;
      entity.queue.shift();
      if (item.type === "attackUpgrade") {
        this.economy[entity.team].attackLevel = Math.min(2, this.economy[entity.team].attackLevel + 1);
        if(entity.team===PLAYER)this.pushEvent("milestone", "Your weapon lattice upgraded.");
      } else if (item.type === "armorUpgrade") {
        this.economy[entity.team].armorLevel = Math.min(2, this.economy[entity.team].armorLevel + 1);
        if(entity.team===PLAYER)this.pushEvent("milestone", "Your armor weave upgraded.");
      } else {
        const spawnAngle = this.random.range(0, Math.PI * 2);
        const spawnDistance = entity.radius + 2;
        const unit = this.createUnit(
          entity.team,
          entity.faction,
          item.type,
          entity.x + Math.cos(spawnAngle) * spawnDistance,
          entity.z + Math.sin(spawnAngle) * spawnDistance,
        );
        if (entity.rally) {
          unit.order = "move";
          unit.moveTarget = { ...entity.rally };
        }
        if (entity.team === PLAYER) this.pushEvent("info", `${units[item.type].label[entity.faction]} deployed.`);
      }
    }
  }

  private updateEntities(dt: number): void {
    for (const entity of this.entities.values()) {
      if (!entity.complete || entity.deathTimer !== undefined) continue;
      entity.attackTimer = Math.max(0, entity.attackTimer - dt);
      entity.slowTimer = Math.max(0, entity.slowTimer - dt);
      entity.abilityCooldown = Math.max(0,(entity.abilityCooldown??0)-dt);
      if(entity.type==='scout')entity.vision=(entity.abilityCooldown??0)>22?22:units.scout.vision;
      if(entity.faction==='chorus'&&this.time-(entity.lastDamaged??0)>6)entity.hp=Math.min(entity.maxHp,entity.hp+dt*(entity.type==='heavy'?3:1.2));
      if (entity.kind === "building") {
        if (entity.type === "turret") this.updateTurret(entity);
        continue;
      }
      if (entity.type === "healer") this.updateHealer(entity, dt);
      if (entity.order === "gather" && entity.type === "worker") {
        this.updateGatherer(entity, dt);
        continue;
      }
      this.updateCombatUnit(entity, dt);
    }
  }

  private updateGatherer(worker: Entity, dt: number): void {
    const node = this.nodes.find((candidate) => candidate.id === worker.gatherNodeId && candidate.amount > 0);
    if (!node) {
      worker.order = "idle";
      worker.gatherNodeId = undefined;
      return;
    }
    if (node.kind === "flux" && !this.hasExtractorNear(worker.team, node)) {
      worker.order = "idle";
      if (worker.team === PLAYER) this.pushEvent("warning", "Build a Flux Tap on the vent before harvesting Flux.");
      return;
    }

    if (worker.cargoAmount > 0) {
      const hq = this.nearestBuilding(worker, worker.team, "hq");
      if (!hq) return;
      if (distance(worker, hq) > hq.radius + worker.radius + 0.7) {
        this.moveToward(worker, hq, dt);
      } else {
        const kind = worker.cargoKind ?? node.kind;
        this.economy[worker.team][kind] += worker.cargoAmount;
        if (kind === "ore") this.economy[worker.team].gatheredOre += worker.cargoAmount;
        else this.economy[worker.team].gatheredFlux += worker.cargoAmount;
        worker.cargoAmount = 0;
        worker.actionTimer = 0;
      }
      return;
    }

    if (distance(worker, node) > (node.kind==='flux'?2.3:node.radius) + worker.radius + 0.3) {
      this.moveToward(worker, node, dt);
      return;
    }
    worker.actionTimer += dt;
    if (worker.actionTimer >= 1.6) {
      worker.actionTimer = 0;
      const accelerated = this.time >= 18 * 60 ? 1.15 : 1;
      const amount = Math.min(node.amount, Math.round((node.kind === "ore" ? 10 : 7) * accelerated));
      node.amount -= amount;
      worker.cargoKind = node.kind;
      worker.cargoAmount = amount;
      if (node.amount <= 0 && worker.team === PLAYER) this.pushEvent("warning", `${node.kind === "ore" ? "Prism seam" : "Flux vent"} depleted.`);
    }
  }

  private updateCombatUnit(entity: Entity, dt: number): void {
    let target = entity.targetId ? this.entities.get(entity.targetId) : undefined;
    if (!target || target.deathTimer !== undefined || target.team === entity.team) {
      entity.targetId = undefined;
      target = undefined;
    }

    const def = units[entity.type as UnitType];
    if (target && !this.isVisibleTo(entity.team,target)) { entity.targetId=undefined; target=undefined; }
    if (!target && entity.order !== "move" && entity.type !== "worker" && entity.type !== "healer" && !(entity.faction==='chorus'&&entity.type==='scout')) {
      target = this.findNearestEnemy(entity, entity.order === "attackMove" ? entity.vision : Math.max(def.range + 2.5, 5));
      if (target) entity.targetId = target.id;
    }

    if (target) {
      const range = this.attackRange(entity);
      const gap = distance(entity, target) - target.radius - entity.radius;
      if (gap > range || (def.minRange && gap < def.minRange)) {
        if (entity.order === "idle" || entity.order==='brace') {entity.targetId=undefined;return;}
        if (entity.order !== "hold") this.moveToward(entity, target, dt, gap < (def.minRange ?? 0) ? -1 : 1);
      } else if (entity.attackTimer <= 0) {
        this.attack(entity, target);
      }
      return;
    }

    if (entity.moveTarget && (entity.order === "move" || entity.order === "attackMove")) {
      if (distance(entity, entity.moveTarget) <= 0.3) {
        const next=entity.waypoints?.shift();
        entity.moveTarget = next ? {x:next.x,z:next.z}:undefined;
        entity.order = next ? next.attackMove?'attackMove':'move' : "idle";
      } else {
        this.moveToward(entity, entity.moveTarget, dt);
      }
    }
  }

  private updateTurret(turret: Entity): void {
    const target = this.findNearestEnemy(turret, 9);
    if (!target || turret.attackTimer > 0) return;
    turret.attackTimer = 1.05;
    this.dealDamage(turret, target, 22);
  }

  private updateHealer(healer: Entity, dt: number): void {
    if (healer.attackTimer > 0) return;
    let candidate: Entity | undefined;
    let lowest = 1;
    for (const ally of this.entities.values()) {
      if (ally.team !== healer.team || ally.deathTimer !== undefined || !ally.complete || ally.id === healer.id) continue;
      const health = ally.hp / ally.maxHp;
      if (health < lowest && distance(healer, ally) <= 5.7) {
        candidate = ally;
        lowest = health;
      }
    }
    if (candidate) {
      const amount = 15 * (healer.faction === "chorus" ? 1.15 : 1);
      candidate.hp = Math.min(candidate.maxHp, candidate.hp + amount);
      healer.attackTimer = Math.max(0.7, units.healer.attackPeriod - dt);
    }
  }

  private attack(attacker: Entity, target: Entity): void {
    const def = units[attacker.type as UnitType];
    const attackPeriod = def.attackPeriod * (attacker.brace ? 1.15 : 1);
    attacker.attackTimer = attackPeriod;
    let damage = this.attackDamage(attacker);
    if (attacker.type === "lancer" && (target.type === "heavy" || target.kind === "building")) damage *= 1.28;
    if (attacker.type === "soldier" && (target.type === "worker" || target.type === "scout" || target.type === "soldier")) damage *= 1.12;
    if (attacker.type === "siege" && target.kind === "building") damage *= 1.45;
    this.dealDamage(attacker, target, damage);

    if (attacker.type === "siege") {
      for (const splash of this.entities.values()) {
        if (splash.id === target.id || splash.team === attacker.team || splash.deathTimer !== undefined) continue;
        if (distance(splash, target) <= (def.splash ?? 0)) this.dealDamage(attacker, splash, damage * 0.35);
      }
    }
    if (attacker.faction === "chorus" && attacker.type === "lancer") target.slowTimer = 1.2;
  }

  private dealDamage(attacker: Entity, target: Entity, rawDamage: number): void {
    if(target.type==='guard'&&target.brace&&attacker.type!=='siege')rawDamage*=.6;
    const defense = target.armor + this.economy[target.team].armorLevel * 1.5;
    const damage = Math.max(1, rawDamage - defense);
    target.hp -= damage;
    target.lastDamaged=this.time;
    target.lastSeen = this.time;
    if (target.hp <= 0 && target.deathTimer === undefined) {
      target.hp = 0;
      target.deathTimer = target.kind === "building" ? 1.2 : 0.65;
      if (target.kind === "unit") this.economy[target.team].unitsLost += 1;
      if (target.type === "hq") {
        this.pushEvent("combat", `${target.team === PLAYER ? "Your" : "Enemy"} command core has fallen.`);
      } else if (target.team === PLAYER || attacker.team === PLAYER) {
        this.pushEvent("combat", `${this.entityLabel(target)} destroyed.`);
      }
    }
  }

  private updatePylons(dt: number): void {
    for (const pylon of this.pylons) {
      const playerNear = [...this.entities.values()].some(
        (entity) => entity.team === PLAYER && entity.kind === "unit" && entity.deathTimer === undefined && distance(entity, pylon) <= 3.5,
      );
      const aiNear = [...this.entities.values()].some(
        (entity) => entity.team === AI && entity.kind === "unit" && entity.deathTimer === undefined && distance(entity, pylon) <= 3.5,
      );
      const capturing: Team = playerNear === aiNear ? "neutral" : playerNear ? PLAYER : AI;
      if (capturing === "neutral") {
        pylon.capturing = "neutral";
        pylon.capture = Math.max(0, pylon.capture - dt * 0.25);
        continue;
      }
      if (pylon.capturing !== capturing) {
        pylon.capturing = capturing;
        pylon.capture = 0;
      }
      pylon.capture += dt / 3;
      if (pylon.capture >= 1 && pylon.owner !== capturing) {
        pylon.owner = capturing;
        pylon.capture = 0;
        this.pushEvent("milestone", `${capturing === PLAYER ? "You control" : "Enemy controls"} a Watch Pylon.`);
      }
    }
  }

  private cleanupDead(dt: number): void {
    for (const entity of [...this.entities.values()]) {
      if (entity.deathTimer === undefined) continue;
      entity.deathTimer -= dt;
      if (entity.deathTimer > 0) continue;
      this.entities.delete(entity.id);
      if(entity.kind==='building')this.navVersion++;
      this.playerSelection.delete(entity.id);
      for (const other of this.entities.values()) if (other.targetId === entity.id) other.targetId = undefined;
    }
  }

  private moveToward(entity: Entity, target: Vec2, dt: number, direction = 1): void {
    const hovering=entity.type==='scout'&&entity.faction==='chorus';
    const blockers=[...this.entities.values()].filter(e=>e.kind==='building'&&e.deathTimer===undefined&&distance(entity,e)>e.radius+entity.radius*.7).map(e=>({x:e.x,z:e.z,radius:e.radius}));
    let goal={x:target.x,z:target.z};
    for(const b of blockers){if(Math.hypot(goal.x-b.x,goal.z-b.z)<b.radius+entity.radius+.25){const origin=Math.hypot(goal.x-b.x,goal.z-b.z)>.2?goal:entity;const d=Math.hypot(origin.x-b.x,origin.z-b.z)||1;goal={x:b.x+(origin.x-b.x)/d*(b.radius+entity.radius+.4),z:b.z+(origin.z-b.z)/d*(b.radius+entity.radius+.4)};}}
    if(direction<0){const d=Math.hypot(entity.x-goal.x,entity.z-goal.z)||1;goal={x:entity.x+(entity.x-goal.x)/d*4,z:entity.z+(entity.z-goal.z)/d*4};}
    if(!hovering&&(!entity.navGoal||distance(entity.navGoal,goal)>2||entity.navVersion!==this.navVersion||this.time-(entity.navTime??0)>3)){
      entity.navGoal=goal;entity.navPath=findPath(entity,goal,entity.radius*.75,blockers);entity.navVersion=this.navVersion;entity.navTime=this.time;
    }
    while(entity.navPath?.length&&distance(entity,entity.navPath[0])<.35)entity.navPath.shift();
    const waypoint=hovering?goal:entity.navPath?.[0]??goal;
    const dx = waypoint.x - entity.x;
    const dz = waypoint.z - entity.z;
    const len = Math.hypot(dx, dz) || 1;
    const def = units[entity.type as UnitType];
    let speed = def.speed;
    if (entity.faction === "chorus" && entity.type === "soldier") speed *= 1.13;
    if (entity.brace) speed = 0;
    if (entity.slowTimer > 0) speed *= 0.65;
    const step = Math.min(len,speed * dt);
    const next={x:clamp(entity.x+(dx/len)*step,-58,58),z:clamp(entity.z+(dz/len)*step,-43,43)};
    if(hovering||navigable(next,entity.radius*.7,blockers)){entity.x=next.x;entity.z=next.z;}
  }

  private resolveSeparation(): void {
    const active = [...this.entities.values()].filter((entity) => entity.kind === "unit" && entity.deathTimer === undefined);
    for (let i = 0; i < active.length; i += 1) {
      const a = active[i];
      for (let j = i + 1; j < active.length; j += 1) {
        const b = active[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dz);
        const min = (a.radius + b.radius) * 0.78;
        if (len <= 0.001 || len >= min) continue;
        const push = (min - len) * 0.25;
        const nx = dx / len;
        const nz = dz / len;
        a.x -= nx * push;
        a.z -= nz * push;
        b.x += nx * push;
        b.z += nz * push;
      }
    }
    const blockers=[...this.entities.values()].filter(e=>e.kind==='building'&&e.deathTimer===undefined);
    for(const entity of active){if(entity.faction==='chorus'&&entity.type==='scout')continue;for(const b of blockers){const dx=entity.x-b.x,dz=entity.z-b.z,len=Math.hypot(dx,dz),min=b.radius+entity.radius*.75+.19;if(len<min){const angle=len<.001?entity.id*2.4:Math.atan2(dz,dx);entity.x=b.x+Math.cos(angle)*min;entity.z=b.z+Math.sin(angle)*min;}}}
  }

  private updateVisibilityKnowledge(): void {
    const playerVision = this.visionSources(PLAYER);
    const aiVision = this.visionSources(AI);
    for (const entity of this.entities.values()) {
      if (entity.team === PLAYER) {
        entity.visible = true;
        entity.lastSeen = this.time;
      } else {
        const seen = playerVision.some((source) => distance(source, entity) <= source.vision);
        entity.visible = seen;
        if (seen) {
          entity.lastSeen = this.time;
          this.enemyKnown.add(entity.id);
        }
      }
      if (entity.team===PLAYER&&entity.type === "hq" && aiVision.some((source) => distance(source, entity) <= source.vision)) {this.aiHasSeenPlayerBase = true;this.aiKnownBase={x:entity.x,z:entity.z};}
    }
  }

  private visionSources(team: Exclude<Team, "neutral">): Array<Vec2 & { vision: number }> {
    const sources = [...this.entities.values()]
      .filter((entity) => entity.team === team && entity.complete && entity.deathTimer === undefined)
      .map((entity) => ({ x: entity.x, z: entity.z, vision: entity.vision }));
    for (const pylon of this.pylons) if (pylon.owner === team) sources.push({ x: pylon.x, z: pylon.z, vision: 18 });
    return sources;
  }

  private updateTutorial(): void {
    if (this.options.mode !== "tutorial") return;
    const playerBuildings = (type: BuildingType) => this.teamBuildings(PLAYER, type).some((entity) => entity.complete);
    const combatCount = this.teamUnits(PLAYER).filter((entity) => !["worker", "scout"].includes(entity.type)).length;
    if (this.tutorialStep === 0 && this.selectedEntities.some((entity) => entity.type === "worker")) this.tutorialStep = 1;
    if (this.tutorialStep === 1 && this.economy.player.gatheredOre >= 20) this.tutorialStep = 2;
    if (this.tutorialStep === 2 && playerBuildings("supply")) this.tutorialStep = 3;
    if (this.tutorialStep === 3 && playerBuildings("barracks")) this.tutorialStep = 4;
    if (this.tutorialStep === 4 && combatCount >= 3) this.tutorialStep = 5;
    if (this.tutorialStep === 5 && this.pylons.some((pylon) => pylon.owner === PLAYER)) this.tutorialStep = 6;
    const commands=this.options.replay?.slice(0,this.replayCursor)??this.commands;
    if(this.tutorialStep===6&&commands.some(c=>c.kind==='group'))this.tutorialStep=7;
    if(this.tutorialStep===7&&commands.some(c=>c.kind==='ability'))this.tutorialStep=8;
  }

  private updateAi(): void {
    if (!this.running) return;
    const economy = this.economy.ai;
    const faction = this.teamFaction(AI);
    const hq = this.findTeamBuilding(AI, "hq");
    if (!hq) return;
    const workers = this.teamUnits(AI, "worker");
    const army = this.teamUnits(AI).filter((unit) => unit.type !== "worker");

    for (const worker of workers) {
      if(this.teamBuildings(AI).some(b=>!b.complete&&distance(worker,b)<b.radius+3))continue;
      if (worker.order !== "gather" || !worker.gatherNodeId) {
        const fluxWorkers = workers.filter((candidate) => candidate.gatherNodeId && this.nodes.find((n) => n.id === candidate.gatherNodeId)?.kind === "flux").length;
        const targetKind: ResourceKind = this.hasCompletedBuilding(AI, "extractor") && fluxWorkers < Math.max(2, Math.floor(workers.length / 3)) ? "flux" : "ore";
        const node = this.nearestNode(worker, targetKind, AI);
        if (node) this.assignGather(worker, node);
      }
    }

    if (workers.length < 10 && hq.queue.length < 2) this.queueProduction(hq, "worker", true);
    if (economy.supplyCap - economy.supplyUsed < 5 && !this.hasIncompleteBuilding(AI, "supply")) this.aiBuild("supply", hq, faction);
    if (!this.hasCompletedBuilding(AI, "barracks") && !this.hasIncompleteBuilding(AI, "barracks")) this.aiBuild("barracks", hq, faction);
    if (this.time > 60 && !this.hasCompletedBuilding(AI, "extractor") && !this.hasIncompleteBuilding(AI, "extractor")) this.aiBuildExtractor(hq, faction);
    if (this.time > 155 && this.hasCompletedBuilding(AI, "barracks") && !this.hasCompletedBuilding(AI, "tech") && !this.hasIncompleteBuilding(AI, "tech")) this.aiBuild("tech", hq, faction);
    if (this.time > 120 && this.teamBuildings(AI, "turret").length < 2 && economy.ore > 220) this.aiBuild("turret", hq, faction);

    const barracks = this.findTeamBuilding(AI, "barracks");
    if (barracks?.complete && barracks.queue.length < 2) {
      const roll = this.random.next();
      this.queueProduction(barracks, roll < 0.58 ? "soldier" : roll < 0.85 ? "lancer" : "healer", true);
    }
    const tech = this.findTeamBuilding(AI, "tech");
    if (tech?.complete && tech.queue.length < 1) {
      if (economy.attackLevel < 1 && economy.ore > 250 && economy.flux > 150) this.queueUpgrade(tech, "attackUpgrade", true);
      else this.queueProduction(tech, this.random.next() < 0.7 ? "siege" : "heavy", true);
    }

    const tutorialHold = this.options.mode === "tutorial" && this.tutorialStep < 5;
    const scout=army.find(unit=>unit.type==='scout');
    if(scout&&!this.aiHasSeenPlayerBase&&scout.order!=='attack'&&(scout.order==='idle'||this.time>35&&scout.moveTarget?.x===-15)){scout.order='move';scout.moveTarget={...PLAYER_SPAWN};}
    const threshold = this.options.difficulty === "hard" ? 7 : this.options.difficulty === "easy" ? 12 : 9;
    const canAttack = !tutorialHold && (army.length >= threshold || this.time > 7 * 60);
    if (canAttack && army.filter(unit=>unit.order !== "attackMove" && unit.order !== "attack").length>=Math.min(4,threshold)) {
      this.attackWave += 1;
      const knownTarget = this.aiHasSeenPlayerBase ? this.aiKnownBase : undefined;
      const target = knownTarget ?? { x: -12, z: 5 };
      for (const unit of army) {
        unit.order = "attackMove";
        unit.moveTarget = { x: target.x + this.random.range(-4, 4), z: target.z + this.random.range(-4, 4) };
      }
      if(army.some(e=>e.visible))this.pushEvent("warning", `Enemy strike group ${this.attackWave} is mobilizing.`);
    }
  }

  private aiBuild(type: BuildingType, hq: Entity, faction: Faction): void {
    const def = buildings[type];
    if (!canAfford(this.economy.ai, def.cost)) return;
    const angle = this.random.range(0, Math.PI * 2);
    const radius = type === "turret" ? 8 : 6 + this.teamBuildings(AI).length * 0.55;
    const x = clamp(hq.x + Math.cos(angle) * radius, -WORLD_WIDTH / 2 + 4, WORLD_WIDTH / 2 - 4);
    const z = clamp(hq.z + Math.sin(angle) * radius, -WORLD_DEPTH / 2 + 4, WORLD_DEPTH / 2 - 4);
    if (!this.canPlace(type, x, z, AI)) return;
    spend(this.economy.ai, def.cost);
    this.createBuilding(AI, faction, type, x, z, false);
    const worker = this.nearestEntity({ x, z }, this.teamUnits(AI, "worker"));
    if (worker) {
      worker.order = "move";
      worker.moveTarget = { x, z };
    }
  }

  private aiBuildExtractor(hq: Entity, faction: Faction): void {
    const node = this.nearestNode(hq, "flux", AI);
    if (!node || !canAfford(this.economy.ai, buildings.extractor.cost)) return;
    spend(this.economy.ai, buildings.extractor.cost);
    this.createBuilding(AI, faction, "extractor", node.x, node.z, false);
    const worker = this.nearestEntity(node, this.teamUnits(AI, "worker"));
    if (worker) {
      worker.order = "move";
      worker.moveTarget = { x: node.x, z: node.z };
    }
  }

  private checkVictory(): void {
    if (this.result) return;
    const playerHq = this.findTeamBuilding(PLAYER, "hq", false);
    const aiHq = this.findTeamBuilding(AI, "hq", false);
    if (playerHq && aiHq) return;
    const winner = playerHq ? PLAYER : AI;
    this.result = {
      winner,
      duration: this.time,
      reason: winner === PLAYER ? "Enemy command core destroyed" : "Your command core was destroyed",
    };
    this.running = false;
    this.pushEvent("milestone", winner === PLAYER ? "Glass Ravine secured." : "Expedition lost.");
    this.saveMatchHistory();
  }

  private saveMatchHistory(): void {
    try {
      const key = "shardfront.matchHistory";
      const history = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
      history.unshift({
        date: new Date().toISOString(),
        faction: this.options.faction,
        difficulty: this.options.difficulty,
        mode: this.options.mode,
        result: this.result,
        economy: this.economy.player,
        events: this.events.slice(-30),
      });
      localStorage.setItem(key, JSON.stringify(history.slice(0, 12)));
    } catch {
      // Persistence is optional; gameplay must survive storage denial.
    }
  }

  private recalculateEconomy(): void {
    for (const team of [PLAYER, AI] as const) {
      let used = 0;
      let cap = 0;
      for (const entity of this.entities.values()) {
        if (entity.team !== team || entity.deathTimer !== undefined) continue;
        if (entity.kind === "unit") used += units[entity.type as UnitType].cost.supply ?? 0;
        else if (entity.complete) cap += buildings[entity.type as BuildingType].supply;
        for (const queued of entity.queue) if (queued.type in units) used += units[queued.type as UnitType].cost.supply ?? 0;
      }
      this.economy[team].supplyUsed = used;
      this.economy[team].supplyCap = Math.min(120, cap);
    }
  }

  select(ids: number[], additive = false): void {
    if (!additive) this.playerSelection.clear();
    for (const id of ids) {
      const entity = this.entities.get(id);
      if (entity?.team === PLAYER && entity.deathTimer === undefined) {
        if (additive && this.playerSelection.has(id)) this.playerSelection.delete(id);
        else this.playerSelection.add(id);
      }
    }
    this.syncSelectionFlags();
  }

  clearSelection(): void {
    this.playerSelection.clear();
    this.syncSelectionFlags();
  }

  selectType(type: EntityType): void {
    this.playerSelection.clear();
    for (const entity of this.entities.values()) if (entity.team === PLAYER && entity.type === type && entity.deathTimer === undefined) this.playerSelection.add(entity.id);
    this.syncSelectionFlags();
  }

  private syncSelectionFlags(): void {
    for (const entity of this.entities.values()) entity.selected = this.playerSelection.has(entity.id);
  }

  commandMove(target: Vec2, attackMove = false, queued = false): void {
    if(!this.record('move',[target,attackMove,queued]))return;
    const unitsSelected = this.selectedEntities.filter((entity) => entity.kind === "unit");
    const columns = Math.max(1, Math.ceil(Math.sqrt(unitsSelected.length)));
    unitsSelected.forEach((entity, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const offsetX = (col - (columns - 1) / 2) * 1.6;
      const offsetZ = (row - (Math.ceil(unitsSelected.length / columns) - 1) / 2) * 1.6;
      const destination = {
        x: clamp(target.x + offsetX, -WORLD_WIDTH / 2 + 1, WORLD_WIDTH / 2 - 1),
        z: clamp(target.z + offsetZ, -WORLD_DEPTH / 2 + 1, WORLD_DEPTH / 2 - 1),
      };
      if(queued&&entity.moveTarget){entity.waypoints??=[];entity.waypoints.push({...destination,attackMove});return;}
      entity.order = attackMove ? "attackMove" : "move";
      entity.moveTarget=destination;entity.targetId=undefined;entity.waypoints=[];entity.navGoal=undefined;entity.brace=false;
    });
  }

  commandTarget(targetId: number): void {
    if(!this.record('target',[targetId]))return;
    const target = this.entities.get(targetId);
    if (!target || target.team === PLAYER || !target.visible) return;
    for (const entity of this.selectedEntities) {
      if (entity.kind !== "unit" || entity.type==='healer'||entity.faction==='chorus'&&entity.type==='scout') continue;
      entity.order = "attack";
      entity.targetId = target.id;
      entity.moveTarget = undefined;
    }
  }

  commandGather(nodeId: number): void {
    if(!this.record('gather',[nodeId]))return;
    const node = this.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    const workers = this.selectedEntities.filter((entity) => entity.type === "worker");
    for (const worker of workers) this.assignGather(worker, node);
    if (workers.length > 0) this.pushEvent("info", `Harvest order: ${node.kind === "ore" ? "Prism Ore" : "Flux"}.`);
  }

  stopSelected(): void {
    if(!this.record('stop',[]))return;
    for (const entity of this.selectedEntities) {
      entity.order = "idle";
      entity.moveTarget = undefined;
      entity.targetId = undefined;
      entity.waypoints=[];entity.navGoal=undefined;entity.brace=false;
    }
  }

  holdSelected(): void {
    if(!this.record('hold',[]))return;
    for (const entity of this.selectedEntities) {
      if (entity.kind !== "unit") continue;
      entity.order = "hold";
      entity.moveTarget = undefined;
    }
  }

  toggleBrace(): void {
    if(!this.record('ability',[]))return;
    for (const entity of this.selectedEntities) {
      if (entity.kind!=='unit'||(entity.abilityCooldown??0)>0) continue;
      if(entity.type==='worker'){const target=this.nearestEntity(entity,this.teamBuildings(PLAYER).filter(b=>b.hp<b.maxHp));if(target&&distance(entity,target)<7&&this.economy.player.flux>=15){this.economy.player.flux-=15;target.hp=Math.min(target.maxHp,target.hp+60);entity.abilityCooldown=12;this.pushEvent('milestone','Emergency repair restored 60 structure integrity.');}continue;}
      if(entity.type==='healer'){for(const ally of this.teamUnits(PLAYER))if(distance(ally,entity)<7)ally.hp=Math.min(ally.maxHp,ally.hp+30);entity.abilityCooldown=20;this.pushEvent('milestone','Restoration field deployed.');continue;}
      if(entity.type==='scout'){entity.vision=22;entity.abilityCooldown=30;this.pushEvent('milestone','Sensor sweep reveals a wider area.');continue;}
      entity.brace = !entity.brace;
      entity.order = entity.brace ? "brace" : "idle";
      entity.moveTarget = undefined;
    }
  }

  setRally(target: Vec2): void {
    if(!this.record('rally',[target]))return;
    for (const entity of this.selectedEntities) if (entity.kind === "building") entity.rally = { ...target };
  }

  build(type: BuildingType, x: number, z: number): boolean {
    if(!this.record('build',[type,x,z]))return false;
    const workers = this.selectedEntities.filter((entity) => entity.type === "worker");
    if (workers.length === 0) return false;
    const def = buildings[type];
    if (def.requires && !this.hasCompletedBuilding(PLAYER, def.requires)) {
      this.pushEvent("warning", `${buildings[def.requires].label[this.options.faction]} required.`);
      return false;
    }
    if (!canAfford(this.economy.player, def.cost)) {
      this.pushEvent("warning", "Insufficient resources.");
      return false;
    }
    if (!this.canPlace(type, x, z, PLAYER)) {
      this.pushEvent("warning", "Invalid construction site.");
      return false;
    }
    if (type === "extractor") {
      const vent = this.nodes.find((node) => node.kind === "flux" && distance(node, { x, z }) <= 2.5);
      if (!vent) {
        this.pushEvent("warning", "Flux Taps must be placed on a Flux vent.");
        return false;
      }
      x = vent.x;
      z = vent.z;
    }
    spend(this.economy.player, def.cost);
    const building = this.createBuilding(PLAYER, this.options.faction, type, x, z, false);
    const worker = this.nearestEntity(building, workers);
    if (worker) {
      worker.order = "move";
      worker.moveTarget = { x, z };
    }
    this.pushEvent("info", `${def.label[this.options.faction]} foundation placed.`);
    return true;
  }

  train(type: UnitType): boolean {
    if(!this.record('train',[type]))return false;
    if(type==='guard'&&this.options.faction==='helix')return false;
    const building = this.selectedEntities.find(
      (entity) => entity.kind === "building" && entity.complete && buildings[entity.type as BuildingType].produces?.includes(type),
    );
    if (!building) return false;
    return this.queueProduction(building, type, false);
  }

  research(kind: "attackUpgrade" | "armorUpgrade"): boolean {
    if(!this.record('research',[kind]))return false;
    const tech = this.selectedEntities.find((entity) => entity.type === "tech" && entity.complete);
    if (!tech) return false;
    return this.queueUpgrade(tech, kind, false);
  }

  cancelQueue(index = 0): void {
    if(!this.record('cancel',[index]))return;
    const building = this.selectedEntities.find((entity) => entity.kind === "building" && entity.queue[index]);
    if (!building) return;
    const [item] = building.queue.splice(index, 1);
    this.economy.player.ore += Math.round(item.cost.ore * 0.75);
    this.economy.player.flux += Math.round(item.cost.flux * 0.75);
  }

  private queueProduction(building: Entity, type: UnitType, silent: boolean): boolean {
    if (building.queue.length >= 5) return false;
    const def = units[type];
    const economy = this.economy[building.team];
    this.recalculateEconomy();
    if (economy.supplyUsed + (def.cost.supply ?? 0) > economy.supplyCap) {
      if (!silent && building.team === PLAYER) this.pushEvent("warning", "Supply limit reached. Build a support node.");
      return false;
    }
    if (!canAfford(economy, def.cost)) {
      if (!silent && building.team === PLAYER) this.pushEvent("warning", "Insufficient resources.");
      return false;
    }
    spend(economy, def.cost);
    building.queue.push({ type, elapsed: 0, duration: def.buildTime, cost: { ...def.cost } });
    this.recalculateEconomy();
    return true;
  }

  private queueUpgrade(building: Entity, kind: "attackUpgrade" | "armorUpgrade", silent: boolean): boolean {
    const level = kind === "attackUpgrade" ? this.economy[building.team].attackLevel : this.economy[building.team].armorLevel;
    if (level >= 2 || building.queue.some((item) => item.type === kind)) return false;
    const cost: Cost = level === 0 ? { ore: 150, flux: 100 } : { ore: 250, flux: 180 };
    if (!canAfford(this.economy[building.team], cost)) {
      if (!silent && building.team === PLAYER) this.pushEvent("warning", "Insufficient resources for research.");
      return false;
    }
    spend(this.economy[building.team], cost);
    building.queue.push({ type: kind, elapsed: 0, duration: level === 0 ? 22 : 34, cost });
    return true;
  }

  private canPlace(type: BuildingType, x: number, z: number, team: Exclude<Team, "neutral">): boolean {
    const def = buildings[type];
    if(!Number.isFinite(x)||!Number.isFinite(z)||terrainBlocked(x,z,def.radius))return false;
    if (Math.abs(x) > WORLD_WIDTH / 2 - def.radius - 1 || Math.abs(z) > WORLD_DEPTH / 2 - def.radius - 1) return false;
    if (Math.abs(x) < 5 && Math.abs(z) < 16) return false;
    if (type !== "extractor") {
      for (const node of this.nodes) if (distance(node, { x, z }) < def.radius + node.radius + 1) return false;
    }
    for (const entity of this.entities.values()) {
      if (entity.deathTimer !== undefined || entity.kind==='unit') continue;
      if (distance(entity, { x, z }) < def.radius + entity.radius + 0.8) return false;
    }
    const networks=this.teamBuildings(team).filter(e=>e.complete&&(e.type==='hq'||e.type==='supply'));
    if (type !== "hq" && type !== "extractor" && !networks.some(e=>distance(e,{x,z})<=22)) return false;
    return true;
  }

  private assignGather(worker: Entity, node: ResourceNode): void {
    worker.order = "gather";
    worker.gatherNodeId = node.id;
    worker.targetId = undefined;
    worker.moveTarget = undefined;
  }

  private hasExtractorNear(team: Exclude<Team, "neutral">, node: ResourceNode): boolean {
    return this.teamBuildings(team, "extractor").some((building) => building.complete && distance(building, node) <= 3);
  }

  private hasCompletedBuilding(team: Exclude<Team, "neutral">, type: BuildingType): boolean {
    return this.teamBuildings(team, type).some((entity) => entity.complete);
  }

  private hasIncompleteBuilding(team: Exclude<Team, "neutral">, type: BuildingType): boolean {
    return this.teamBuildings(team, type).some((entity) => !entity.complete);
  }

  private teamBuildings(team: Exclude<Team, "neutral">, type?: BuildingType): Entity[] {
    return [...this.entities.values()].filter(
      (entity) => entity.team === team && entity.kind === "building" && entity.deathTimer === undefined && (!type || entity.type === type),
    );
  }

  private teamUnits(team: Exclude<Team, "neutral">, type?: UnitType): Entity[] {
    return [...this.entities.values()].filter(
      (entity) => entity.team === team && entity.kind === "unit" && entity.deathTimer === undefined && (!type || entity.type === type),
    );
  }

  private findTeamBuilding(team: Exclude<Team, "neutral">, type: BuildingType, includeDying = true): Entity | undefined {
    return [...this.entities.values()].find(
      (entity) => entity.team === team && entity.kind === "building" && entity.type === type && (includeDying || entity.deathTimer === undefined),
    );
  }

  private teamFaction(team: Exclude<Team, "neutral">): Faction {
    return [...this.entities.values()].find((entity) => entity.team === team)?.faction ?? (team === PLAYER ? this.options.faction : opposite(this.options.faction));
  }

  private nearestNode(origin: Vec2, kind?: ResourceKind, team?: Exclude<Team, "neutral">): ResourceNode | undefined {
    const candidates = this.nodes.filter((node) => node.amount > 0 && (!kind || node.kind === kind));
    if (team && kind === "flux") {
      const connected = candidates.filter((node) => this.hasExtractorNear(team, node));
      if (connected.length > 0) return this.nearestEntity(origin, connected);
    }
    return this.nearestEntity(origin, candidates);
  }

  private nearestBuilding(origin: Vec2, team: Exclude<Team, "neutral">, type: BuildingType): Entity | undefined {
    return this.nearestEntity(origin, this.teamBuildings(team, type).filter((entity) => entity.complete));
  }

  private nearestEntity<T extends Vec2>(origin: Vec2, candidates: T[]): T | undefined {
    let best: T | undefined;
    let bestDistance = Infinity;
    for (const candidate of candidates) {
      const d = distance(origin, candidate);
      if (d < bestDistance) {
        best = candidate;
        bestDistance = d;
      }
    }
    return best;
  }

  private findNearestEnemy(origin: Entity, range: number): Entity | undefined {
    let best: Entity | undefined;
    let bestDistance = range;
    for (const candidate of this.entities.values()) {
      if (candidate.team === origin.team || candidate.deathTimer !== undefined || !candidate.complete) continue;
      if(!this.isVisibleTo(origin.team,candidate))continue;
      const d = distance(origin, candidate) - candidate.radius;
      if (d < bestDistance) {
        best = candidate;
        bestDistance = d;
      }
    }
    return best;
  }

  private attackRange(entity: Entity): number {
    if (entity.kind === "building") return entity.type === "turret" ? 9 : 0;
    const def = units[entity.type as UnitType];
    return (entity.faction==='chorus'&&entity.type==='soldier'?1.25:def.range) + (entity.brace ? 1.8 : 0);
  }

  private attackDamage(entity: Entity): number {
    if (entity.kind === "building") return entity.type === "turret" ? 22 : 0;
    const def = units[entity.type as UnitType];
    let damage = def.damage * (1 + this.economy[entity.team].attackLevel * 0.1);
    if (entity.faction === "chorus" && entity.type === "soldier") damage *= 1.28;
    if (entity.brace) damage *= 1.15;
    return damage;
  }

  private entityLabel(entity: Entity): string {
    return entity.kind === "unit"
      ? units[entity.type as UnitType].label[entity.faction]
      : buildings[entity.type as BuildingType].label[entity.faction];
  }

  private pushEvent(kind: MatchEvent["kind"], text: string): void {
    const previous = this.events[this.events.length - 1];
    if (previous && previous.text === text && this.time - previous.time < 3) return;
    this.events.push({ time: this.time, kind, text });
    if (this.events.length > 60) {
      this.events.shift();
      this.lastEventCursor = Math.max(0, this.lastEventCursor - 1);
    }
  }

  consumeNewEvents(): MatchEvent[] {
    const result = this.events.slice(this.lastEventCursor);
    this.lastEventCursor = this.events.length;
    return result;
  }

  getTutorialText(): string | undefined {
    if (this.options.mode !== "tutorial") return undefined;
    return [
      "Select a Fabricator/Tender with left click or drag a box.",
      "Right-click a cyan Prism Ore seam to begin harvesting.",
      "Select a worker, press B, then place a supply structure.",
      "Build an Assembly Bay or Brood Hollow to unlock combat units.",
      "Select production and deploy at least three combat units.",
      "Attack-move to a central Watch Pylon and hold it for 3 seconds.",
      "Select your army, then hold Ctrl and press 1 to create a control group. Press 1 to recall it.",
      "Select a combat unit and press Q to brace or root. Move orders release the stance.",
      "Destroy the enemy command core. Use A then left-click for attack-move.",
    ][this.tutorialStep];
  }

  getSnapshot(fps: number): GameSnapshot {
    const selected = this.selectedEntities;
    const primary = selected[0];
    let selectedLabel = "No selection";
    let selectedHp = "";
    if (selected.length === 1 && primary) {
      selectedLabel = this.entityLabel(primary);
      selectedHp = `${Math.ceil(primary.hp)} / ${Math.ceil(primary.maxHp)}`;
    } else if (selected.length > 1) {
      const types = new Set(selected.map((entity) => entity.type));
      selectedLabel = `${selected.length} units${types.size === 1 ? ` · ${this.entityLabel(primary)}` : ""}`;
      selectedHp = `${selected.filter((entity) => entity.hp < entity.maxHp).length} damaged`;
    }
    return {
      running: this.running,
      paused: this.paused,
      time: this.time,
      faction: this.options.faction,
      difficulty: this.options.difficulty,
      mode: this.options.mode,
      economy: { ...this.economy.player },
      selectedIds: this.selectedIds,
      selectedLabel,
      selectedHp,
      selectedQueue: primary?.kind === "building" ? primary.queue.map((item) => ({ ...item })) : [],
      canBuild: selected.some((entity) => entity.type === "worker"),
      selectedBuilding: primary?.kind === "building" ? (primary.type as BuildingType) : undefined,
      alerts: this.events.slice(-4),
      result: this.result,
      tutorialStep: this.tutorialStep,
      tutorialText: this.getTutorialText(),
      fps,
      entityCount: this.entities.size,
    };
  }

  getBuildableTypes(): BuildingType[] {
    return ["supply", "barracks", "extractor", "tech", "turret", "hq"];
  }

  getProducibleTypes(): UnitType[] {
    const selected = this.selectedEntities[0];
    if (!selected || selected.kind !== "building") return [];
    return (buildings[selected.type as BuildingType].produces ?? []).filter(type=>type!=='guard'||selected.faction==='chorus');
  }

  togglePause(): void {
    if (!this.running) return;
    this.paused = !this.paused;
  }

  setPaused(value: boolean): void {
    if (this.running) this.paused = value;
  }

  placementValid(type: BuildingType,x:number,z:number):boolean { return this.canPlace(type,x,z,PLAYER); }
  recordGroup():void{this.record('group',[]);}

  private isVisibleTo(team: Exclude<Team,'neutral'>,target:Vec2):boolean {
    return this.visionSources(team).some(source=>distance(source,target)<=source.vision);
  }

  private record(kind:string,args:unknown[]):boolean {
    if(this.options.replay&&!this.replayDispatch)return false;
    if(!this.running)return false;
    if(!this.replayDispatch)this.commands.push({tick:Math.round(this.time*TICK_RATE),kind,args:structuredClone(args),selected:this.selectedIds});
    return true;
  }

  /** Save is a versioned simulation snapshot, not renderer state. No credentials or telemetry. */
  save():string {
    return JSON.stringify({version:2,options:{faction:this.options.faction,difficulty:this.options.difficulty,mode:this.options.mode},time:this.time,entities:[...this.entities.values()].map(e=>({...e,lastSeen:Number.isFinite(e.lastSeen)?e.lastSeen:-1e9})),nodes:this.nodes,pylons:this.pylons,economy:this.economy,events:this.events,result:this.result,running:this.running,tutorialStep:this.tutorialStep,nextId:this.nextId,economyTimer:this.economyTimer,aiTimer:this.aiTimer,snapshotTimer:this.snapshotTimer,revealPulseTimer:this.revealPulseTimer,random:this.random.state,selection:this.selectedIds,enemyKnown:[...this.enemyKnown],attackWave:this.attackWave,aiHasSeenPlayerBase:this.aiHasSeenPlayerBase,aiKnownBase:this.aiKnownBase,navVersion:this.navVersion,commands:this.commands});
  }

  restore(serialized:string):void {
    const s=JSON.parse(serialized);
    if(s.version!==2||!Array.isArray(s.entities)||s.entities.length>1200||!Number.isFinite(s.time)||s.time<0||s.options.faction!==this.options.faction)throw new Error('This save is damaged or belongs to another game version.');
    this.entities.clear();for(const e of s.entities){if(!Number.isFinite(e.x)||!Number.isFinite(e.z)||!Number.isFinite(e.hp)||!(e.type in units||e.type in buildings))throw new Error('Save contains invalid entity data.');if(e.lastSeen<=-1e8)e.lastSeen=-Infinity;this.entities.set(e.id,e);}
    this.nodes.splice(0,this.nodes.length,...s.nodes);this.pylons.splice(0,this.pylons.length,...s.pylons);
    Object.assign(this.economy.player,s.economy.player);Object.assign(this.economy.ai,s.economy.ai);this.events.splice(0,this.events.length,...s.events);
    this.time=s.time;this.result=s.result;this.running=s.running;this.tutorialStep=s.tutorialStep;this.nextId=s.nextId;this.economyTimer=s.economyTimer;this.aiTimer=s.aiTimer;this.snapshotTimer=s.snapshotTimer;this.revealPulseTimer=s.revealPulseTimer;this.random.state=s.random;this.playerSelection=new Set(s.selection);this.enemyKnown=new Set(s.enemyKnown);this.attackWave=s.attackWave;this.aiHasSeenPlayerBase=s.aiHasSeenPlayerBase;this.aiKnownBase=s.aiKnownBase;this.navVersion=s.navVersion;this.commands.splice(0,this.commands.length,...s.commands);this.accumulator=0;this.paused=false;this.lastEventCursor=this.events.length;
  }

  stateHash():string {
    const content=JSON.stringify({tick:Math.round(this.time*TICK_RATE),entities:[...this.entities.values()].map(e=>[e.id,e.type,e.x,e.z,e.hp,e.order,e.cargoAmount,e.queue]),economy:this.economy,nodes:this.nodes.map(n=>n.amount),pylons:this.pylons,result:this.result});
    let hash=2166136261;for(let i=0;i<content.length;i++)hash=Math.imul(hash^content.charCodeAt(i),16777619);return (hash>>>0).toString(16);
  }
}

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
