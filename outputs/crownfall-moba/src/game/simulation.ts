import {
  HEROES,
  ITEMS,
  LANES,
  BRUSH,
  heroById,
  distance,
  toward,
  clamp,
  type HeroId,
  type Point,
  type Team,
  type Talent,
} from "./content";
export type Kind =
  | "hero"
  | "guard"
  | "bolt"
  | "siege"
  | "vanguard"
  | "tower"
  | "seal"
  | "coreTower"
  | "engine"
  | "camp"
  | "catalyst"
  | "colossus"
  | "ward"
  | "wall"
  | "decoy";
export interface Unit extends Point {
  id: number;
  kind: Kind;
  team: Team;
  name: string;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  shield: number;
  armor: number;
  ward: number;
  damage: number;
  power: number;
  speed: number;
  range: number;
  attackSpeed: number;
  hero?: HeroId;
  level: number;
  xp: number;
  gold: number;
  ranks: number[];
  points: number;
  cooldowns: number[];
  items: number[];
  itemCds: number[];
  kills: number;
  deaths: number;
  assists: number;
  lastHits: number;
  damageDone: number;
  structures: number;
  visionScore: number;
  lane: number;
  waypoint: number;
  target?: number;
  move?: Point;
  angle: number;
  attackTimer: number;
  animation: number;
  dead: number;
  slow: number;
  stun: number;
  silence: number;
  haste: number;
  recall: number;
  charge: number;
  attacks: number;
  lastTarget?: number;
  bot: boolean;
  forced?: number;
  aggroUntil: number;
  expires?: number;
  home: Point;
  respawn: number;
}
export interface Projectile extends Point {
  id: number;
  owner: number;
  team: Team;
  dx: number;
  dz: number;
  speed: number;
  remaining: number;
  damage: number;
  radius: number;
  arcane: boolean;
  kind: string;
  pierce: boolean;
  hit: number[];
  target?: number;
}
export interface Zone extends Point {
  id: number;
  owner: number;
  team: Team;
  radius: number;
  delay: number;
  life: number;
  tick: number;
  damage: number;
  kind: string;
  hit: boolean;
  direction?: Point;
  length?: number;
}
export interface Event extends Point {
  id: number;
  time: number;
  text: string;
  kind: string;
  team: Team;
  value?: number;
}
export interface Options {
  hero: HeroId;
  seed: number;
  mode: "skirmish" | "practice" | "tutorial";
  talents: [Talent, Talent];
}
export interface Result {
  id: string;
  winner: Team;
  duration: number;
  hero: HeroId;
  scoreboard: Array<{
    name: string;
    hero: HeroId;
    team: Team;
    kills: number;
    deaths: number;
    assists: number;
    gold: number;
    damage: number;
    structures: number;
    lastHits: number;
    items: number[];
    level: number;
  }>;
  events: Event[];
  seed: number;
  mode: string;
}
export interface Replay {
  version: 1;
  options: Options;
  commands: Array<{ tick: number; type: string; value: unknown }>;
  result?: Result;
}
export interface Snapshot {
  time: number;
  paused: boolean;
  player: Unit;
  heroes: Unit[];
  visible: Unit[];
  alliedKills: number;
  enemyKills: number;
  result?: Result;
  events: Event[];
  talentCds: number[];
  wardCharges: number;
  objectiveTimers: number[];
  buffs: number[];
  tutorial: number;
  message: string;
  auto: boolean;
  speed: number;
}
const structure = (u: Unit) =>
  ["tower", "seal", "coreTower", "engine"].includes(u.kind);
const fighter = (u: Unit) =>
  !structure(u) && !["ward", "wall", "decoy"].includes(u.kind);
const finitePoint = (p: unknown): p is Point =>
  !!p &&
  typeof p === "object" &&
  Number.isFinite((p as Point).x) &&
  Number.isFinite((p as Point).z);
export class Simulation {
  readonly options: Options;
  units: Unit[] = [];
  projectiles: Projectile[] = [];
  zones: Zone[] = [];
  events: Event[] = [];
  time = 0;
  tick = 0;
  paused = false;
  result?: Result;
  player!: Unit;
  auto = false;
  speed = 1;
  message =
    "Buy a starter at the fountain, then follow a lane with your minions.";
  tutorial = 0;
  talentCds = [0, 0];
  wardCharges = 2;
  buffs = [0, 0];
  objectives = [210, 210, 540];
  commands: Replay["commands"] = [];
  private id = 1;
  private randomState: number;
  private accumulator = 0;
  private waveTimer = 4;
  private waves = 0;
  private aiTimer = 0;
  private wardTimer = 0;
  private sequence = 0;
  private contributors = new Map<number, Map<number, number>>();
  constructor(options: Options) {
    this.options = options;
    this.randomState = options.seed;
    const own = [
      options.hero,
      ...HEROES.map((h) => h.id).filter((h) => h !== options.hero),
    ].slice(0, 3) as HeroId[];
    const other: HeroId[] = ["kesh", "ilyra", "vey"];
    for (const team of [0, 1] as const)
      for (let i = 0; i < 3; i++) {
        const hero = (team === 0 ? own : other)[i],
          def = heroById(hero);
        const u = this.add(
          "hero",
          team,
          team === 0 ? -64 : 64,
          (i - 1) * 2,
          def.name,
        );
        u.hero = hero;
        u.bot = team === 1 || i !== 0;
        u.lane = i === 2 ? 1 : 0;
        u.gold = 450;
        u.points = 1;
        u.ranks = [0, 0, 0, 0];
        u.home = { x: team === 0 ? -64 : 64, z: 0 };
        this.recalculate(u);
        u.hp = u.maxHp;
        u.mana = u.maxMana;
        if (team === 0 && i === 0) this.player = u;
        else {
          u.ranks[0] = 1;
          u.points = 0;
          this.buy(u, i === 0 ? 1 : i === 1 ? 2 : 0);
        }
      }
    for (const team of [0, 1] as const) {
      const sign = team === 0 ? -1 : 1;
      for (const lane of [0, 1]) {
        const z = lane === 0 ? -1 : 1;
        for (const [n, x, zz, hp] of [
          [0, 30, 32, 1100],
          [1, 44, 24, 1400],
          [2, 53, 13, 1600],
        ]) {
          const u = this.add(
            "tower",
            team,
            sign * x,
            z * zz,
            `${["Outer", "Inner", "Seal guard"][n]} ${lane === 0 ? "north" : "south"}`,
          );
          u.maxHp = u.hp = hp;
          u.lane = lane;
          u.waypoint = n;
          u.damage = 100 + n * 16;
          u.range = 10;
          u.armor = 30;
        }
        const seal = this.add(
          "seal",
          team,
          sign * 57,
          z * 8,
          `${lane === 0 ? "North" : "South"} Seal`,
        );
        seal.hp = seal.maxHp = 800;
        seal.lane = lane;
      }
      for (const z of [-5, 5]) {
        const u = this.add("coreTower", team, sign * 60, z, "Core Tower");
        u.hp = u.maxHp = 1700;
        u.damage = 130;
        u.range = 9;
        u.armor = 35;
      }
      const engine = this.add("engine", team, sign * 66, 0, "Crown Engine");
      engine.hp = engine.maxHp = 2500;
      engine.armor = 25;
    }
    for (const [x, z] of [
      [-35, -5],
      [-20, 19],
      [35, 4],
      [21, -17],
    ]) {
      const camp = this.add("camp", 2, x, z, "Mossback sentinel");
      camp.hp = camp.maxHp = 520;
      camp.damage = 35;
      camp.range = 2.5;
      camp.speed = 2.4;
      camp.respawn = 70;
    }
    if (options.mode === "tutorial") {
      this.player.gold = 800;
      this.message =
        "1 / 8 · Right-click a destination. Left-click enemies to inspect.";
    }
    this.emit("announce", "Dawnwright and Vesper enter the Broken Diadem.", 0, {
      x: 0,
      z: 0,
    });
  }
  private random() {
    this.randomState =
      (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }
  private add(
    kind: Kind,
    team: Team,
    x: number,
    z: number,
    name: string,
  ): Unit {
    const u: Unit = {
      id: this.id++,
      kind,
      team,
      x,
      z,
      name,
      hp: 200,
      maxHp: 200,
      mana: 300,
      maxMana: 300,
      shield: 0,
      armor: 0,
      ward: 0,
      damage: 25,
      power: 0,
      speed: 3.8,
      range: 2,
      attackSpeed: 1,
      level: 1,
      xp: 0,
      gold: 0,
      ranks: [0, 0, 0, 0],
      points: 0,
      cooldowns: [0, 0, 0, 0],
      items: [],
      itemCds: [],
      kills: 0,
      deaths: 0,
      assists: 0,
      lastHits: 0,
      damageDone: 0,
      structures: 0,
      visionScore: 0,
      lane: 0,
      waypoint: 0,
      angle: 0,
      attackTimer: 0,
      animation: 0,
      dead: 0,
      slow: 0,
      stun: 0,
      silence: 0,
      haste: 0,
      recall: 0,
      charge: 0,
      attacks: 0,
      bot: true,
      aggroUntil: 0,
      home: { x, z },
      respawn: 0,
    };
    this.units.push(u);
    return u;
  }
  private emit(
    kind: string,
    text: string,
    team: Team,
    point: Point,
    value?: number,
  ) {
    const event = {
      id: ++this.sequence,
      time: this.time,
      kind,
      text,
      team,
      x: point.x,
      z: point.z,
      value,
    };
    this.events.push(event);
    if (this.events.length > 100) this.events.shift();
  }
  update(delta: number) {
    if (this.paused || this.result) return;
    this.accumulator = Math.min(0.25, this.accumulator + delta * this.speed);
    while (this.accumulator >= 1 / 30) {
      this.step(1 / 30);
      this.accumulator -= 1 / 30;
    }
  }
  step(dt = 1 / 30) {
    if (this.paused || this.result) return;
    this.time += dt;
    this.tick++;
    this.waveTimer -= dt;
    this.aiTimer -= dt;
    this.wardTimer += dt;
    if (this.waveTimer <= 0) {
      this.waveTimer = 30;
      this.spawnWaves();
    }
    if (this.wardTimer > 60) {
      this.wardTimer = 0;
      this.wardCharges = Math.min(2, this.wardCharges + 1);
    }
    this.talentCds = this.talentCds.map((c) => Math.max(0, c - dt));
    this.buffs = this.buffs.map((c) => Math.max(0, c - dt));
    for (let i = 0; i < this.objectives.length; i++) {
      this.objectives[i] -= dt;
      if (this.objectives[i] <= 0) {
        const kind = i === 2 ? "colossus" : "catalyst";
        if (
          !this.units.some((u) => u.kind === kind && u.lane === i && u.hp > 0)
        ) {
          const u = this.add(
            kind,
            2,
            i === 0 ? -3 : i === 1 ? 7 : 0,
            i === 0 ? -22 : i === 1 ? 23 : 0,
            i === 2
              ? "Aether Colossus"
              : i === 0
                ? "North Catalyst"
                : "South Catalyst",
          );
          u.lane = i;
          u.hp = u.maxHp = i === 2 ? 2600 : 1300;
          u.damage = i === 2 ? 95 : 58;
          u.range = 6;
          u.armor = 25;
          u.speed = 2;
          this.emit("objective", `${u.name} has awakened.`, 2, u);
        }
        this.objectives[i] = 99999;
      }
    }
    if (this.aiTimer <= 0) {
      this.aiTimer = 0.25;
      for (const u of this.units)
        if (
          u.kind === "hero" &&
          u.hp > 0 &&
          (u.bot || (u === this.player && this.auto))
        )
          this.thinkHero(u);
    }
    for (const u of this.units) {
      if (u.hp <= 0) {
        if (u.kind === "hero" || u.kind === "camp") {
          u.dead -= dt;
          if (u.dead <= 0) {
            u.hp = u.maxHp;
            u.mana = u.maxMana;
            u.x = u.home.x;
            u.z = u.home.z;
            u.target = undefined;
            u.move = undefined;
            u.shield = 0;
          }
        }
        continue;
      }
      if (u.expires !== undefined) {
        u.expires -= dt;
        if (u.expires <= 0) {
          u.hp = 0;
          continue;
        }
      }
      u.attackTimer = Math.max(0, u.attackTimer - dt);
      u.animation = Math.max(0, u.animation - dt);
      u.slow = Math.max(0, u.slow - dt);
      u.stun = Math.max(0, u.stun - dt);
      u.silence = Math.max(0, u.silence - dt);
      u.haste = Math.max(0, u.haste - dt);
      u.shield = Math.max(0, u.shield - dt * 3);
      u.cooldowns = u.cooldowns.map((c) => Math.max(0, c - dt));
      u.itemCds = u.itemCds.map((c) => Math.max(0, c - dt));
      if (u.kind === "hero") {
        u.gold += dt * 2.2;
        u.hp = Math.min(u.maxHp, u.hp + dt * 1.3);
        u.mana = Math.min(u.maxMana, u.mana + dt * 4.3);
        const atHome = distance(u, u.home) < 7;
        if (atHome) {
          u.hp = Math.min(u.maxHp, u.hp + dt * u.maxHp * 0.17);
          u.mana = Math.min(u.maxMana, u.mana + dt * 90);
        }
        if (u.recall > 0) {
          u.recall -= dt;
          if (u.recall <= 0) {
            u.x = u.home.x;
            u.z = u.home.z;
            u.move = undefined;
            u.target = undefined;
            if (u === this.player) this.advanceTutorial(5);
          }
          continue;
        }
        if (
          u.hero === "brannoch" &&
          this.units.some(
            (e) =>
              e.kind === "hero" &&
              e.team !== u.team &&
              e.hp > 0 &&
              distance(e, u) < 6,
          )
        )
          u.charge = Math.min(18, u.charge + dt * 6);
        else if (u.hero === "brannoch")
          u.charge = Math.max(0, u.charge - dt * 3);
      }
      if (u.stun > 0) continue;
      if (structure(u)) {
        if (["tower", "coreTower"].includes(u.kind)) this.structureAttack(u);
        continue;
      }
      if (["ward", "wall", "decoy"].includes(u.kind)) continue;
      if (u.team === 2) {
        const nearby = this.units.filter(
          (e) => e.team !== 2 && e.hp > 0 && fighter(e) && distance(e, u) < 7,
        );
        if (nearby.length)
          u.target = nearby.sort(
            (a, b) => distance(a, u) - distance(b, u),
          )[0].id;
        else if (distance(u, u.home) > 1) {
          u.move = u.home;
          u.target = undefined;
        }
        if (distance(u, u.home) > 9) {
          u.hp = Math.min(u.maxHp, u.hp + dt * 200);
          u.move = u.home;
          u.target = undefined;
        }
      }
      if (u.kind !== "hero" && u.team !== 2) {
        const available = this.enemies(u, 11).filter(
          (e) => e.kind !== "ward" && this.vulnerable(e),
        );
        if (available.length)
          u.target = available.sort(
            (a, b) => distance(u, a) - distance(u, b),
          )[0].id;
        else {
          u.target = undefined;
          const path =
            u.team === 0 ? LANES[u.lane] : [...LANES[u.lane]].reverse();
          if (distance(u, path[Math.min(u.waypoint, path.length - 1)]) < 2)
            u.waypoint = Math.min(path.length - 1, u.waypoint + 1);
          u.move = path[u.waypoint];
        }
      }
      let target = u.target
        ? this.units.find((e) => e.id === u.target && e.hp > 0)
        : undefined;
      if (
        target &&
        (!this.vulnerable(target) || !this.visibleTo(u.team, target))
      ) {
        u.target = undefined;
        target = undefined;
      }
      if (!target && u.kind === "hero" && !u.move)
        target = this.enemies(u, u.range + 0.4)
          .filter((e) => this.vulnerable(e))
          .sort((a, b) => distance(u, a) - distance(u, b))[0];
      if (target) {
        const d = distance(u, target);
        u.angle = Math.atan2(target.x - u.x, target.z - u.z);
        if (d <= u.range + (structure(target) ? 1.3 : 0.5)) {
          u.move = undefined;
          this.basic(u, target);
        } else u.move = { x: target.x, z: target.z };
      }
      if (u.move) {
        const d = distance(u, u.move);
        if (d < 0.12) u.move = undefined;
        else {
          const dir = toward(u, u.move);
          const speed =
            u.speed * (u.slow > 0 ? 0.58 : 1) * (u.haste > 0 ? 1.28 : 1);
          const step = Math.min(d, speed * dt);
          const next = {
            x: clamp(u.x + dir.x * step, -72, 72),
            z: clamp(u.z + dir.z * step, -47, 47),
          };
          const wall = this.units.find(
            (w) =>
              w.kind === "wall" &&
              w.hp > 0 &&
              w.team !== u.team &&
              distance(w, next) < 2,
          );
          if (wall) {
            u.target = wall.id;
            u.move = undefined;
          } else {
            u.x = next.x;
            u.z = next.z;
            u.angle = Math.atan2(dir.x, dir.z);
            if (u.hero === "suri") u.charge = Math.min(6, u.charge + step);
            if (u.hero === "vey" && BRUSH.some((b) => distance(u, b) < b.r))
              u.charge = 1;
          }
        }
      }
    }
    this.updateProjectiles(dt);
    this.updateZones(dt);
    if (this.tick % 90 === 0)
      this.units = this.units.filter(
        (u) =>
          u.hp > 0 || u.kind === "hero" || u.kind === "camp" || structure(u),
      );
  }
  private spawnWaves() {
    this.waves++;
    for (const team of [0, 1] as const)
      for (const lane of [0, 1]) {
        const types: Kind[] = [
          "guard",
          "guard",
          "guard",
          "bolt",
          "bolt",
          "bolt",
        ];
        if (this.waves % 3 === 0) types.push("siege");
        if (
          this.units.some(
            (u) =>
              u.team !== team &&
              u.kind === "seal" &&
              u.lane === lane &&
              u.hp <= 0,
          )
        )
          types.push("vanguard");
        for (let i = 0; i < types.length; i++) {
          const u = this.add(
            types[i],
            team,
            (team === 0 ? -63 : 63) + (i % 2) * 0.8,
            (i - 3) * 0.65,
            types[i],
          );
          u.lane = lane;
          u.hp = u.maxHp =
            types[i] === "vanguard"
              ? 650
              : types[i] === "siege"
                ? 400
                : types[i] === "guard"
                  ? 230
                  : 170;
          u.damage =
            (types[i] === "siege" ? 42 : types[i] === "vanguard" ? 65 : 24) *
            (1 + this.time / 600);
          u.range = types[i] === "bolt" || types[i] === "siege" ? 7 : 2;
          u.speed = 4.3;
          u.attackSpeed = types[i] === "siege" ? 0.7 : 1;
          if (this.buffs[team] > 0) {
            u.maxHp *= 1.35;
            u.hp = u.maxHp;
            u.damage *= 1.3;
          }
        }
      }
  }
  private thinkHero(u: Unit) {
    if (u.points > 0) {
      const order = u.level >= 6 ? [3, 0, 1, 2] : [0, 1, 2];
      for (const slot of order) if (this.rank(u, slot)) break;
    }
    if (u.recall > 0) return;
    if (distance(u, u.home) < 7) {
      for (const id of this.recommend(u).filter((id) => !u.items.includes(id)))
        if (this.buy(u, id)) break;
      if (u.hp < u.maxHp * 0.92) {
        u.target = undefined;
        u.move = undefined;
        return;
      }
    }
    if (u.hp < u.maxHp * 0.23) {
      u.target = undefined;
      u.move = u.home;
      if (this.enemies(u, 12).length === 0 && distance(u, u.home) > 12) {
        u.recall = 7;
        u.move = undefined;
      }
      return;
    }
    const threats = this.enemies(u, 14).filter(
      (e) => fighter(e) && this.vulnerable(e),
    );
    const target = threats.sort(
      (a, b) =>
        (a.kind === "hero" ? -3 : 0) +
        distance(u, a) -
        (b.kind === "hero" ? -3 : 0) -
        distance(u, b),
    )[0];
    if (target) {
      u.target = target.id;
      for (const slot of [0, 1, 2, 3]) {
        if (u.hero === "oru" && slot === 2) this.cast(u, slot, u);
        else this.cast(u, slot, target);
      }
      return;
    }
    const neutral = this.units.find(
      (e) =>
        ["catalyst", "colossus"].includes(e.kind) &&
        e.hp > 0 &&
        distance(e, u) < 17 &&
        u.level >= 4,
    );
    if (neutral && this.time % 130 < 40) {
      u.target = neutral.id;
      return;
    }
    const enemyTeam = u.team === 0 ? 1 : 0;
    const laneStructures = this.units.filter(
      (e) =>
        e.team === enemyTeam &&
        e.hp > 0 &&
        structure(e) &&
        this.vulnerable(e) &&
        (e.kind === "coreTower" || e.kind === "engine" || e.lane === u.lane),
    );
    const goal = laneStructures.sort(
      (a, b) => distance(a, u) - distance(b, u),
    )[0];
    if (!goal) return;
    const wave = this.units.some(
      (e) =>
        e.team === u.team &&
        e.kind !== "hero" &&
        !structure(e) &&
        e.hp > 0 &&
        distance(e, goal) < 13,
    );
    if (distance(u, goal) < 14 && wave) u.target = goal.id;
    else {
      u.target = undefined;
      const path = u.team === 0 ? LANES[u.lane] : [...LANES[u.lane]].reverse();
      const ahead = path.filter((p) =>
        u.team === 0 ? p.x > u.x + 2 : p.x < u.x - 2,
      );
      u.move =
        distance(u, goal) > 16 && ahead.length
          ? ahead[0]
          : { x: goal.x + (u.team === 0 ? -1 : 1) * 12, z: goal.z };
    }
  }
  private enemies(u: Unit, range: number) {
    return this.units.filter(
      (e) =>
        e.team !== u.team &&
        e.hp > 0 &&
        distance(e, u) < range &&
        this.visibleTo(u.team, e),
    );
  }
  visibleTo(team: Team, u: Unit): boolean {
    if (
      u.team === team ||
      team === 2 ||
      structure(u) ||
      ["catalyst", "colossus"].includes(u.kind)
    )
      return true;
    const brush = BRUSH.find((b) => distance(b, u) < b.r);
    return this.units.some(
      (a) =>
        a.team === team &&
        a.hp > 0 &&
        distance(a, u) <
          (a.kind === "ward" ? 18 : a.kind === "hero" ? 16 : 11) &&
        (!brush ||
          distance(a, brush) < brush.r ||
          a.kind === "ward" ||
          distance(a, u) < 3),
    );
  }
  vulnerable(u: Unit): boolean {
    if (u.kind === "seal")
      return !this.units.some(
        (t) =>
          t.kind === "tower" &&
          t.team === u.team &&
          t.lane === u.lane &&
          t.hp > 0,
      );
    if (u.kind === "coreTower")
      return this.units.some(
        (t) => t.kind === "seal" && t.team === u.team && t.hp <= 0,
      );
    if (u.kind === "engine")
      return (
        this.units.some(
          (t) => t.kind === "seal" && t.team === u.team && t.hp <= 0,
        ) &&
        !this.units.some(
          (t) => t.kind === "coreTower" && t.team === u.team && t.hp > 0,
        )
      );
    if (u.kind === "tower")
      return !this.units.some(
        (t) =>
          t.kind === "tower" &&
          t.team === u.team &&
          t.lane === u.lane &&
          t.waypoint < u.waypoint &&
          t.hp > 0,
      );
    return true;
  }
  private structureAttack(u: Unit) {
    const targets = this.enemies(u, u.range).filter(
      (e) => fighter(e) && e.team !== 2,
    );
    const forced = targets.find(
      (e) => e.id === u.forced && this.time < u.aggroUntil,
    );
    const target =
      forced ??
      targets.sort(
        (a, b) =>
          (a.kind === "hero" ? 10 : 0) +
          distance(a, u) -
          (b.kind === "hero" ? 10 : 0) -
          distance(b, u),
      )[0];
    if (target) {
      u.angle = Math.atan2(target.x - u.x, target.z - u.z);
      this.basic(u, target);
    }
  }
  private basic(u: Unit, target: Unit) {
    if (u.attackTimer > 0 || u.stun > 0) return;
    u.attacks++;
    u.attackTimer =
      (1.05 / Math.max(0.3, u.attackSpeed)) * (u.haste > 0 ? 0.8 : 1);
    u.animation = 0.4;
    let amount = u.damage;
    if (u.hero === "suri" && u.charge >= 6) {
      amount += 35 + u.level * 3;
      u.charge = 0;
    }
    if (u.hero === "vey" && u.charge) {
      amount += 40;
      u.charge = 0;
    }
    if (u.hero === "kesh" && u.lastTarget === target.id && u.attacks % 3 === 0)
      u.hp = Math.min(u.maxHp, u.hp + 24);
    u.lastTarget = target.id;
    if (u.items.includes(16) && u.attacks % 3 === 0) amount += 20;
    if (u.range > 4)
      this.launch(u, target, amount, false, "attack", 0.35, false, target.id);
    else {
      this.hit(u, target, amount, false);
      this.emit("slash", "", u.team, target, Math.round(amount));
    }
  }
  private launch(
    u: Unit,
    p: Point,
    damage: number,
    arcane: boolean,
    kind: string,
    radius: number,
    pierce: boolean,
    target?: number,
  ) {
    const dir = toward(u, p);
    this.projectiles.push({
      id: this.id++,
      owner: u.id,
      team: u.team,
      x: u.x,
      z: u.z,
      dx: dir.x,
      dz: dir.z,
      speed: kind === "attack" ? 24 : 30,
      remaining:
        kind === "corridor" ? 32 : kind === "attack" ? distance(u, p) + 2 : 22,
      damage,
      radius,
      arcane,
      kind,
      pierce,
      hit: [],
      target,
    });
  }
  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      const source = this.units.find((u) => u.id === p.owner);
      if (!source) {
        p.remaining = 0;
        continue;
      }
      if (p.target) {
        const target = this.units.find((u) => u.id === p.target && u.hp > 0);
        if (!target) {
          p.remaining = 0;
          continue;
        }
        const d = toward(p, target);
        p.dx = d.x;
        p.dz = d.z;
      }
      const old = { x: p.x, z: p.z };
      p.x += p.dx * p.speed * dt;
      p.z += p.dz * p.speed * dt;
      p.remaining -= p.speed * dt;
      for (const u of this.units) {
        if (
          u.hp <= 0 ||
          u.team === p.team ||
          p.hit.includes(u.id) ||
          !this.vulnerable(u) ||
          (p.target && u.id !== p.target)
        )
          continue;
        const vx = p.x - old.x,
          vz = p.z - old.z,
          t = clamp(
            ((u.x - old.x) * vx + (u.z - old.z) * vz) /
              (vx * vx + vz * vz || 1),
            0,
            1,
          );
        if (
          distance(u, { x: old.x + vx * t, z: old.z + vz * t }) <
          p.radius + (structure(u) ? 1.3 : 0.65)
        ) {
          this.hit(source, u, p.damage, p.arcane);
          p.hit.push(u.id);
          this.emit("hit", "", p.team, u, Math.round(p.damage));
          if (!p.pierce) {
            p.remaining = 0;
            break;
          }
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.remaining > 0);
  }
  private hit(source: Unit, target: Unit, amount: number, arcane: boolean) {
    if (target.hp <= 0 || !this.vulnerable(target)) return;
    let defense = arcane
      ? target.ward
      : target.armor + (target.hero === "brannoch" ? target.charge : 0);
    amount *= 1 - defense / (100 + Math.abs(defense));
    if (
      structure(target) &&
      !this.units.some(
        (u) =>
          u.hp > 0 &&
          u.team === source.team &&
          ["guard", "bolt", "siege", "vanguard"].includes(u.kind) &&
          distance(u, target) < 12,
      )
    )
      amount *= 0.22;
    const absorbed = Math.min(amount, target.shield);
    target.shield -= absorbed;
    amount -= absorbed;
    target.hp -= amount;
    target.recall = 0;
    source.damageDone += amount;
    if (source.kind === "hero") {
      const contributors = this.contributors.get(target.id) ?? new Map();
      contributors.set(source.id, this.time);
      this.contributors.set(target.id, contributors);
      if (target.kind === "hero")
        for (const tower of this.units)
          if (
            tower.team === target.team &&
            ["tower", "coreTower"].includes(tower.kind) &&
            distance(tower, source) < 11
          ) {
            tower.forced = source.id;
            tower.aggroUntil = this.time + 3;
          }
      if (source.hero === "ilyra" && arcane) {
        target.charge++;
        if (target.charge >= 3) {
          target.charge = 0;
          target.hp -= 65;
          this.emit("burst", "MARGIN NOTES", source.team, target, 65);
        }
      }
    }
    if (target.hp <= 0) this.die(source, target);
  }
  private die(source: Unit, target: Unit) {
    target.hp = 0;
    target.move = undefined;
    target.target = undefined;
    target.deaths++;
    const hero = source.kind === "hero";
    const allies = this.units.filter(
      (u) =>
        u.kind === "hero" &&
        u.team === source.team &&
        u.hp > 0 &&
        distance(u, target) < 20,
    );
    const xp =
      target.kind === "hero"
        ? 170
        : structure(target)
          ? 130
          : target.kind === "colossus"
            ? 280
            : 45;
    for (const u of allies) this.xp(u, xp / Math.max(1, allies.length * 0.7));
    if (target.kind === "hero") {
      target.dead = 8 + target.level * 1.1;
      source.kills++;
      source.gold += hero ? 180 + Math.min(180, target.kills * 18) : 0;
      for (const [id, time] of this.contributors.get(target.id) ?? [])
        if (id !== source.id && this.time - time < 10) {
          const assist = this.units.find((u) => u.id === id);
          if (assist) {
            assist.assists++;
            assist.gold += 70;
          }
        }
      this.emit(
        "kill",
        `${source.name} defeated ${target.name}`,
        source.team,
        target,
      );
    } else if (structure(target)) {
      source.structures++;
      for (const u of this.units)
        if (u.kind === "hero" && u.team === source.team)
          u.gold += target.kind === "seal" ? 180 : 130;
      this.emit("structure", `${target.name} has fallen`, source.team, target);
      if (target.kind === "engine") this.finish(source.team);
    } else if (target.kind === "camp") {
      target.dead = 70;
      source.gold += 90;
    } else if (target.kind === "catalyst" || target.kind === "colossus") {
      this.objectives[target.lane] = target.kind === "colossus" ? 360 : 240;
      if (source.team !== 2)
        this.buffs[source.team] = target.kind === "colossus" ? 150 : 90;
      for (const u of this.units)
        if (u.kind === "hero" && u.team === source.team)
          u.gold += target.kind === "colossus" ? 230 : 130;
      this.emit(
        "objective",
        `${source.team === 0 ? "Dawnwright" : "Vesper"} claimed ${target.name}`,
        source.team,
        target,
      );
    } else if (hero) {
      source.gold += target.kind === "siege" ? 65 : 24;
      source.lastHits++;
      if (source === this.player) this.advanceTutorial(3);
    }
  }
  private xp(u: Unit, amount: number) {
    u.xp += amount;
    while (u.level < 12 && u.xp >= 120 + u.level * 60) {
      u.xp -= 120 + u.level * 60;
      u.level++;
      u.points++;
      const old = u.maxHp;
      this.recalculate(u);
      u.hp += u.maxHp - old;
      this.emit("level", `${u.name} reached level ${u.level}`, u.team, u);
    }
  }
  cast(u: Unit, slot: number, point: Point): boolean {
    if (
      this.paused ||
      this.result ||
      u.hp <= 0 ||
      u.stun > 0 ||
      u.silence > 0 ||
      !u.hero ||
      !finitePoint(point) ||
      !Number.isInteger(slot) ||
      slot < 0 ||
      slot > 3
    )
      return false;
    const def = heroById(u.hero).abilities[slot],
      rank = u.ranks[slot];
    if (!rank || u.cooldowns[slot] > 0 || u.mana < def.cost) return false;
    const dir = toward(u, point),
      d = Math.min(distance(u, point), def.range || 1),
      p = {
        x: clamp(u.x + dir.x * d, -70, 70),
        z: clamp(u.z + dir.z * d, -46, 46),
      };
    u.mana -= def.cost;
    u.cooldowns[slot] =
      def.cooldown * (100 / (100 + this.itemStat(u, "haste")));
    u.recall = 0;
    u.angle = Math.atan2(dir.x, dir.z);
    u.animation = 0.55;
    const power =
        (def.power + u.power * 0.62 + u.damage * 0.22) * (1 + (rank - 1) * 0.2),
      kind = def.kind;
    if (["bolt", "line", "corridor"].includes(kind)) {
      if (kind === "corridor")
        this.addZone(u, p, 2.2, 0.65, 0.25, power, kind, dir, 29);
      else this.launch(u, point, power, true, kind, def.radius, true);
    } else if (
      ["anchor", "dash", "burrow", "strike", "leap", "decoy"].includes(kind)
    ) {
      if (kind === "leap")
        this.addZone(u, p, def.radius, 0.7, 0.3, power, kind);
      else {
        const old = { x: u.x, z: u.z };
        u.x = p.x;
        u.z = p.z;
        u.move = undefined;
        this.emit("dash", "", u.team, p);
        if (kind === "anchor" || kind === "decoy") u.shield += power;
        if (kind === "burrow" || kind === "dash") u.haste = 4;
        if (kind === "strike")
          for (const enemy of this.enemies(u, 3))
            this.hit(u, enemy, power, false);
        if (kind === "dash") this.addZone(u, old, 3, 0, 4, 0, "speed");
        if (kind === "decoy") {
          const decoy = this.add("decoy", u.team, old.x, old.z, u.name);
          decoy.expires = 3;
          decoy.hero = u.hero;
        }
      }
    } else if (kind === "wall") {
      const wall = this.add("wall", u.team, p.x, p.z, "Rampart Fold");
      wall.expires = 3;
      wall.hp = wall.maxHp = 230;
      this.addZone(u, p, 3, 0, 3, 0, "wall");
    } else if (kind === "shield") {
      u.shield += power;
      this.addZone(u, u, 4, 2, 0.3, 45, "slow");
    } else if (kind === "draft") {
      for (const ally of this.units)
        if (ally.team === u.team && ally.hp > 0 && distance(ally, u) < 6) {
          ally.shield += power;
          ally.hp = Math.min(ally.maxHp, ally.hp + power * 0.15);
          ally.haste = 3;
        }
      this.addZone(u, u, 6, 0, 0.5, 0, "shield");
    } else if (kind === "swarm" || kind === "migration") {
      for (const enemy of this.enemies(u, def.range)) {
        const v = toward(u, enemy);
        if (v.x * dir.x + v.z * dir.z > 0.45) {
          this.hit(u, enemy, power, true);
          if (kind === "migration") enemy.stun = 1.1;
        }
      }
      for (const ally of this.units)
        if (
          ally.team === u.team &&
          ally.hp > 0 &&
          distance(ally, p) < def.radius + 3
        ) {
          ally.shield += power * 0.8;
          ally.hp = Math.min(ally.maxHp, ally.hp + power * 0.12);
        }
      this.addZone(u, p, def.radius, 0, 0.7, 0, "moths");
    } else if (kind === "slam" || kind === "cleave" || kind === "cut") {
      for (const enemy of this.enemies(u, def.range)) {
        const v = toward(u, enemy);
        if (v.x * dir.x + v.z * dir.z > 0.15) {
          this.hit(
            u,
            enemy,
            power + (kind === "cleave" ? (enemy.maxHp - enemy.hp) * 0.08 : 0),
            false,
          );
          enemy.slow = 2;
          if (kind === "cut" && enemy.kind === "ward") enemy.hp = 0;
        }
      }
      this.addZone(
        u,
        { x: u.x + dir.x * 2, z: u.z + dir.z * 2 },
        def.radius,
        0,
        0.4,
        0,
        "slash",
      );
    } else if (kind === "rings") {
      for (let i = 0; i < 3; i++)
        this.addZone(u, p, 2.5 + i * 1.7, 0.5 + i * 0.6, 0.3, power, kind);
    } else {
      this.addZone(
        u,
        p,
        def.radius,
        kind === "sigil"
          ? 0.9
          : kind === "bomb" || kind === "sentence"
            ? 1.2
            : 0.25,
        kind === "hush" ? 4 : kind === "marsh" ? 7 : 0.3,
        power,
        kind,
      );
      if (kind === "redact")
        this.zones = this.zones.filter(
          (z) => z.team === u.team || distance(z, p) > 4,
        );
    }
    if (u === this.player) this.advanceTutorial(2);
    return true;
  }
  private addZone(
    u: Unit,
    p: Point,
    radius: number,
    delay: number,
    life: number,
    damage: number,
    kind: string,
    direction?: Point,
    length?: number,
  ) {
    this.zones.push({
      id: this.id++,
      owner: u.id,
      team: u.team,
      x: p.x,
      z: p.z,
      radius,
      delay,
      life,
      tick: 0,
      damage,
      kind,
      hit: false,
      direction,
      length,
    });
  }
  private updateZones(dt: number) {
    for (const z of this.zones) {
      if (z.delay > 0) {
        z.delay -= dt;
        continue;
      }
      const source = this.units.find((u) => u.id === z.owner);
      if (!source) {
        z.life = 0;
        continue;
      }
      if (z.kind === "leap" && !z.hit) {
        source.x = z.x;
        source.z = z.z;
      }
      if (z.kind === "corridor" && !z.hit) {
        this.launch(
          source,
          {
            x: source.x + (z.direction?.x ?? 1) * 30,
            z: source.z + (z.direction?.z ?? 0) * 30,
          },
          z.damage,
          true,
          "corridor",
          2.2,
          true,
        );
        z.hit = true;
      }
      z.life -= dt;
      z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = 0.8;
        for (const u of this.units) {
          if (u.hp <= 0 || distance(u, z) > z.radius + 0.4) continue;
          if (u.team === z.team) {
            if (["speed", "marsh"].includes(z.kind)) u.haste = 1;
            continue;
          }
          if (z.damage > 0 && z.kind !== "corridor")
            this.hit(source, u, z.damage, true);
          if (["hush", "marsh", "slow", "wall"].includes(z.kind)) u.slow = 1.2;
          if (z.kind === "hush" || z.kind === "redact") u.silence = 1;
          if (z.kind === "leap" || z.kind === "rings") u.stun = 0.85;
        }
        z.hit = true;
      }
    }
    this.zones = this.zones.filter((z) => z.life > 0);
  }
  rank(u: Unit, slot: number) {
    if (
      !u.hero ||
      !Number.isInteger(slot) ||
      slot < 0 ||
      slot > 3 ||
      u.points < 1 ||
      u.ranks[slot] >= (slot === 3 ? 2 : 4) ||
      (slot === 3 && u.level < (u.ranks[slot] === 0 ? 6 : 11))
    )
      return false;
    u.ranks[slot]++;
    u.points--;
    return true;
  }
  private itemStat(
    u: Unit,
    key:
      | "haste"
      | "damage"
      | "power"
      | "armor"
      | "ward"
      | "speed"
      | "hp"
      | "attackSpeed",
  ) {
    return u.items.reduce(
      (sum, id) => sum + (ITEMS.find((i) => i.id === id)?.[key] ?? 0),
      0,
    );
  }
  private recalculate(u: Unit) {
    if (!u.hero) return;
    const h = heroById(u.hero);
    u.maxHp = h.hp + (u.level - 1) * 65 + this.itemStat(u, "hp");
    u.maxMana = 300 + (u.level - 1) * 22;
    u.damage = h.damage + (u.level - 1) * 4 + this.itemStat(u, "damage");
    u.power = this.itemStat(u, "power");
    u.armor = h.armor + (u.level - 1) * 2 + this.itemStat(u, "armor");
    u.ward = 20 + this.itemStat(u, "ward");
    u.speed = h.speed + this.itemStat(u, "speed");
    u.attackSpeed = 1 + (u.level - 1) * 0.025 + this.itemStat(u, "attackSpeed");
    u.range = h.range;
  }
  itemCost(u: Unit, id: number) {
    const item = ITEMS.find((i) => i.id === id);
    if (!item) return Infinity;
    const owned = [...u.items];
    let cost = item.cost;
    for (const part of item.recipe ?? []) {
      const at = owned.indexOf(part);
      if (at >= 0) {
        cost -= ITEMS.find((i) => i.id === part)!.cost;
        owned.splice(at, 1);
      }
    }
    return Math.max(0, cost);
  }
  buy(u: Unit, id: number) {
    const item = ITEMS.find((i) => i.id === id);
    if (!item || distance(u, u.home) > 8 || u.hp <= 0) return false;
    const cost = this.itemCost(u, id);
    if (u.gold < cost) return false;
    const consume = [...u.items];
    const cooldowns = [...u.itemCds];
    for (const part of item.recipe ?? []) {
      const at = consume.indexOf(part);
      if (at >= 0) {
        consume.splice(at, 1);
        cooldowns.splice(at, 1);
      }
    }
    if (consume.length >= 6) return false;
    u.items = consume;
    u.items.push(id);
    u.itemCds = [...cooldowns, 0];
    u.gold -= cost;
    this.recalculate(u);
    if (u === this.player) {
      this.message = `Purchased ${item.name}.`;
      this.advanceTutorial(4);
    }
    return true;
  }
  sell(u: Unit, index: number) {
    if (
      distance(u, u.home) > 8 ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= u.items.length ||
      u.hp <= 0
    )
      return false;
    u.gold += Math.floor(
      ITEMS.find((i) => i.id === u.items[index])!.cost * 0.65,
    );
    u.items.splice(index, 1);
    u.itemCds.splice(index, 1);
    this.recalculate(u);
    u.hp = Math.min(u.hp, u.maxHp);
    return true;
  }
  recommend(u: Unit) {
    const role = u.hero;
    return role === "brannoch"
      ? [1, 28, 17, 24, 22]
      : role === "oru"
        ? [3, 28, 19, 20, 25]
        : role === "ilyra"
          ? [2, 28, 18, 23, 27]
          : role === "kesh"
            ? [4, 29, 26, 17, 16]
            : [0, 28, 16, 21, 26];
  }
  command(type: string, value?: unknown) {
    if (this.result || this.paused) return false;
    const u = this.player;
    this.commands.push({ tick: this.tick, type, value });
    if (this.commands.length > 20000) this.commands.shift();
    if (type === "auto") {
      this.auto = !this.auto;
      if (!this.auto) this.speed = 1;
      return true;
    }
    if (type === "speed" && this.auto && [1, 2, 4].includes(Number(value))) {
      this.speed = Number(value);
      return true;
    }
    if (u.hp <= 0) return false;
    if (type === "move" && finitePoint(value)) {
      u.move = { x: clamp(value.x, -72, 72), z: clamp(value.z, -47, 47) };
      u.target = undefined;
      u.recall = 0;
      this.advanceTutorial(1);
      return true;
    }
    if (type === "attack" && typeof value === "number") {
      const e = this.units.find(
        (e) =>
          e.id === value &&
          e.hp > 0 &&
          e.team !== u.team &&
          this.visibleTo(u.team, e),
      );
      if (!e) return false;
      u.target = e.id;
      u.recall = 0;
      return true;
    }
    if (type === "cast" && value && typeof value === "object") {
      const v = value as { slot: number; point: Point };
      return this.cast(u, v.slot, v.point);
    }
    if (type === "rank") return this.rank(u, Number(value));
    if (type === "buy") return this.buy(u, Number(value));
    if (type === "sell") return this.sell(u, Number(value));
    if (type === "stop") {
      u.move = undefined;
      u.target = undefined;
      u.recall = 0;
      return true;
    }
    if (type === "recall") {
      u.recall = 7;
      u.move = undefined;
      u.target = undefined;
      this.emit("recall", "Recall · remain undamaged for 7 seconds", 0, u);
      return true;
    }
    if (
      type === "ward" &&
      finitePoint(value) &&
      this.wardCharges > 0 &&
      distance(u, value) < 13
    ) {
      const ward = this.add("ward", 0, value.x, value.z, "Dawnward");
      ward.expires = 90;
      ward.hp = ward.maxHp = 100;
      this.wardCharges--;
      u.visionScore++;
      this.advanceTutorial(6);
      this.emit("ward", "Vision placed for 90 seconds", 0, ward);
      return true;
    }
    if (type === "talent" && value && typeof value === "object") {
      const v = value as { index: number; point: Point };
      if (
        !Number.isInteger(v.index) ||
        v.index < 0 ||
        v.index > 1 ||
        this.talentCds[v.index] > 0 ||
        !finitePoint(v.point)
      )
        return false;
      const talent = this.options.talents[v.index];
      this.talentCds[v.index] = talent === "Blink" ? 75 : 60;
      if (talent === "Mend")
        u.hp = Math.min(u.maxHp, u.hp + 180 + u.level * 12);
      if (talent === "Clarity") u.mana = Math.min(u.maxMana, u.mana + 220);
      if (talent === "Barrier") u.shield += 220;
      if (talent === "Fleet") u.haste = 6;
      if (talent === "Blink") {
        const d = toward(u, v.point);
        u.x = clamp(u.x + d.x * 7, -72, 72);
        u.z = clamp(u.z + d.z * 7, -47, 47);
      }
      if (talent === "Farsight") {
        const w = this.add("ward", 0, v.point.x, v.point.z, "Farsight");
        w.expires = 12;
      }
      this.emit("talent", talent, 0, u);
      return true;
    }
    if (type === "item") {
      const index = Number(value),
        id = u.items[index],
        item = ITEMS.find((i) => i.id === id);
      if (!item?.active || (u.itemCds[index] ?? 0) > 0) return false;
      if (item.active === "heal") u.hp = Math.min(u.maxHp, u.hp + 220);
      if (item.active === "mana") u.mana = Math.min(u.maxMana, u.mana + 180);
      if (item.active === "shield") u.shield += 200;
      if (item.active === "cleanse") {
        u.slow = 0;
        u.stun = 0;
        u.silence = 0;
        u.shield += 100;
      }
      if (item.category === "consumable") {
        u.items.splice(index, 1);
        u.itemCds.splice(index, 1);
      } else u.itemCds[index] = 50;
      return true;
    }
    if (type === "ping" && finitePoint(value)) {
      this.emit("ping", "On my way", 0, value);
      return true;
    }
    return false;
  }
  private advanceTutorial(stage: number) {
    if (this.options.mode !== "tutorial") return;
    this.tutorial = Math.max(this.tutorial, stage);
    this.message = [
      "Right-click to move.",
      "Use Ctrl+Q to learn Q, then cast Q toward a target.",
      "Last-hit a lane unit to earn gold.",
      "Press P at your fountain and purchase a starter item.",
      "Press B to recall; taking damage interrupts it.",
      "Press 4 to place a ward at your cursor.",
      "Push behind a minion wave. Towers punish solo dives.",
      "Break a lane Seal, both Core Towers, then the Crown Engine.",
    ][Math.min(7, this.tutorial)];
  }
  private finish(winner: Team) {
    if (this.result) return;
    this.emit(
      "victory",
      `${winner === 0 ? "Dawnwright" : "Vesper"} claimed the Crown Engine`,
      winner,
      { x: 0, z: 0 },
    );
    this.result = {
      id: `crown-${this.options.seed}-${this.tick}`,
      winner,
      duration: this.time,
      hero: this.options.hero,
      seed: this.options.seed,
      mode: this.options.mode,
      scoreboard: this.units
        .filter((u) => u.kind === "hero")
        .map((u) => ({
          name: u.name,
          hero: u.hero!,
          team: u.team,
          kills: u.kills,
          deaths: u.deaths,
          assists: u.assists,
          gold: Math.floor(u.gold),
          damage: Math.round(u.damageDone),
          structures: u.structures,
          lastHits: u.lastHits,
          items: [...u.items],
          level: u.level,
        })),
      events: this.events.filter((e) =>
        ["kill", "structure", "objective", "victory"].includes(e.kind),
      ),
    };
  }
  snapshot(): Snapshot {
    return {
      time: this.time,
      paused: this.paused,
      player: structuredClone(this.player),
      heroes: this.units
        .filter((u) => u.kind === "hero")
        .map((u) => structuredClone(u)),
      visible: this.units
        .filter((u) => u.hp > 0 && this.visibleTo(0, u))
        .map((u) => ({ ...u })),
      alliedKills: this.units
        .filter((u) => u.kind === "hero" && u.team === 0)
        .reduce((s, u) => s + u.kills, 0),
      enemyKills: this.units
        .filter((u) => u.kind === "hero" && u.team === 1)
        .reduce((s, u) => s + u.kills, 0),
      result: this.result,
      events: this.events.slice(-8).reverse(),
      talentCds: [...this.talentCds],
      wardCharges: this.wardCharges,
      objectiveTimers: [...this.objectives],
      buffs: [...this.buffs],
      tutorial: this.tutorial,
      message: this.message,
      auto: this.auto,
      speed: this.speed,
    };
  }
  replay(): Replay {
    return {
      version: 1,
      options: this.options,
      commands: this.commands,
      result: this.result,
    };
  }
}
