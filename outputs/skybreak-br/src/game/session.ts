import {
  AMMO_CAP,
  BOT_NAMES,
  ITEMS,
  isWeapon,
  itemName,
  RARITIES,
  WEAPONS,
} from "./content";
import {
  BUILDINGS,
  blockedAt,
  clearSight,
  heightAt,
  LANDMARKS,
  locationAt,
  OBSTACLES,
  PRACTICE,
  rayBox,
  safePoint,
  TRAVERSALS,
} from "./world";
import { initPhysics, PlayerPhysics } from "./physics";
import {
  EMPTY_INPUT,
  type Actor,
  type Ammo,
  type Chest,
  type GameEvent,
  type Input,
  type Item,
  type ItemId,
  type Loot,
  type MatchResult,
  type Options,
  type Rarity,
  type Snapshot,
  type Storm,
  type V2,
  type V3,
  type WeaponId,
} from "./types";
const DT = 1 / 30,
  clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n)),
  dist = (a: V2, b: V2) => Math.hypot(a.x - b.x, a.z - b.z);
export class Random {
  constructor(public state: number) {}
  next() {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 4294967296;
  }
  range(a: number, b: number) {
    return a + (b - a) * this.next();
  }
}
export const PHASES = [
  { wait: 90, move: 120, radius: 320, damage: 1 },
  { wait: 70, move: 90, radius: 210, damage: 2 },
  { wait: 55, move: 75, radius: 125, damage: 4 },
  { wait: 40, move: 60, radius: 70, damage: 7 },
  { wait: 30, move: 45, radius: 35, damage: 10 },
  { wait: 0, move: 45, radius: 25, damage: 14 },
  { wait: 0, move: 45, radius: 0, damage: 25 },
];
export function stormAt(
  time: number,
  pace: Options["pace"],
  seed: number,
): Storm {
  const rng = new Random(seed ^ 0x77ab33),
    factor = pace === "quick" ? 0.45 : 1;
  let x = 0,
    z = 0,
    radius = 550,
    elapsed = 0;
  for (let phase = 0; phase < PHASES.length; phase++) {
    const def = PHASES[phase],
      wait = def.wait * factor,
      move = def.move * factor;
    const angle = rng.next() * Math.PI * 2,
      offset = Math.max(0, radius - def.radius) * 0.35;
    let nx = x + Math.cos(angle) * offset,
      nz = z + Math.sin(angle) * offset;
    const safe = safePoint({ x: nx, z: nz });
    nx = safe.x;
    nz = safe.z;
    const total = wait + move;
    if (time < elapsed + total) {
      const local = time - elapsed,
        moving = local >= wait,
        t = moving ? clamp((local - wait) / move, 0, 1) : 0;
      return {
        phase,
        x: x + (nx - x) * t,
        z: z + (nz - z) * t,
        radius: radius + (def.radius - radius) * t,
        nextX: nx,
        nextZ: nz,
        nextRadius: def.radius,
        remaining: moving ? total - local : wait - local,
        moving,
        damage: def.damage,
        progress: t,
      };
    }
    elapsed += total;
    x = nx;
    z = nz;
    radius = def.radius;
  }
  return {
    phase: 7,
    x,
    z,
    radius: 0,
    nextX: x,
    nextZ: z,
    nextRadius: 0,
    remaining: 0,
    moving: true,
    damage: 35,
    progress: 1,
  };
}
export class Session {
  readonly actors: Actor[] = [];
  readonly loot: Loot[] = [];
  readonly chests: Chest[] = [];
  readonly events: GameEvent[] = [];
  readonly options: Options;
  readonly random: Random;
  readonly physics: PlayerPhysics;
  time = 0;
  playTime = 0;
  phase: Snapshot["phase"] = "staging";
  stageTime = 0;
  paused = false;
  result?: MatchResult;
  marker: V2 = { x: -245, z: 200 };
  storm: Storm;
  hitMarker = 0;
  damageFlash = 0;
  lootCount = 0;
  deathPlace?: number;
  deathTime?: number;
  private nextId = 100;
  private accumulator = 0;
  private previousFire = false;
  private previousCrouch = false;
  private supplyDropped = false;
  private snapshots = 0;
  private mist: Array<V3 & { until: number }> = [];
  private echoUntil = 0;
  private stageElapsed = 0;
  private footprints: Array<V3 & { time: number }> = [];
  private echoMarks: Array<V3 & { time: number }> = [];
  private footstepTimer = 0;
  private transit?: {
    from: V3;
    to: V3;
    remaining: number;
    duration: number;
    glide: boolean;
  };
  static async create(options: Options) {
    await initPhysics();
    return new Session(options);
  }
  private constructor(options: Options) {
    this.options = options;
    this.random = new Random(options.seed);
    this.storm = stormAt(0, options.pace, options.seed);
    const start = { ...PRACTICE, y: heightAt(PRACTICE.x, PRACTICE.z) + 0.2 };
    this.actors.push(this.actor(0, false, start));
    for (let i = 0; i < (options.mode === "practice" ? 5 : 23); i++) {
      const l = LANDMARKS[i % 6],
        p = safePoint({
          x: l.x + this.random.range(-65, 65),
          z: l.z + this.random.range(-65, 65),
        });
      this.actors.push(
        this.actor(i + 1, true, { ...p, y: heightAt(p.x, p.z) }),
      );
    }
    this.physics = new PlayerPhysics(start);
    this.populateLoot();
    if (options.mode === "practice") {
      this.phase = "playing";
      this.player.inventory = [
        this.item("rifle", 1),
        this.item("scattergun", 1),
        this.item("med", 0, 4),
        this.item("shield", 0, 4),
        this.item("grapple", 2, 3),
      ];
      this.player.ammo = { light: 240, shell: 48, heavy: 80, charge: 18 };
      this.player.yaw = Math.PI;
      this.emit("info", "PRACTICE RANGE · Every weapon is on the supply line.");
    } else {
      this.stageTime = options.pace === "quick" ? 10 : 35;
      this.emit("info", "LOCAL SOLO · 23 rivals are piloted by bots.");
    }
  }
  get player() {
    return this.actors[0];
  }
  get alive() {
    return this.actors.filter((a) => a.alive);
  }
  get smoke() {
    return this.mist;
  }
  get echo() {
    return this.echoUntil > this.time;
  }
  get echoes() {
    return this.echo ? this.echoMarks : [];
  }
  private actor(id: number, bot: boolean, p: V3): Actor {
    return {
      id,
      name: bot ? BOT_NAMES[(id - 1) % BOT_NAMES.length] : "You",
      bot,
      alive: true,
      ...p,
      hp: 100,
      aegis: 50,
      reserve: 0,
      yaw: bot ? this.random.range(-Math.PI, Math.PI) : Math.PI,
      pitch: 0,
      vy: 0,
      speed: 0,
      stamina: 5,
      stance: "stand",
      grounded: true,
      inventory: [null, null, null, null, null],
      slot: 0,
      ammo: { light: 0, shell: 0, heavy: 0, charge: 0 },
      reload: 0,
      action: 0,
      cooldown: 0,
      lastDamage: -10,
      kills: 0,
      damage: 0,
      shots: 0,
      hits: 0,
      distance: 0,
      stormDamage: 0,
      skin: bot ? id % 4 : this.options.skin,
      think: 0,
      reaction: 0.35 + this.random.next() * 0.4,
      slide: 0,
      lastJump: false,
      lastInteract: false,
      lastReload: false,
      lastUse: false,
      lastMelee: false,
      lastGlide: false,
      healStock: 1,
    };
  }
  private item(id: ItemId, rarity: Rarity = 0, quantity = 1): Item {
    return {
      id,
      rarity,
      quantity,
      loaded: isWeapon(id) ? WEAPONS[id].mag : 0,
      uid: this.nextId++,
    };
  }
  private addLoot(
    id: ItemId,
    p: V3,
    rarity: Rarity = 0,
    quantity = 1,
    source: Loot["source"] = "floor",
  ) {
    const loot: Loot = {
      id: this.nextId++,
      item: this.item(id, rarity, quantity),
      ...p,
      active: true,
      source,
    };
    this.loot.push(loot);
    return loot;
  }
  private populateLoot() {
    const ids = Object.keys(WEAPONS) as WeaponId[];
    for (const [bidx, b] of BUILDINGS.entries()) {
      const x = b.x,
        z = b.z + b.depth / 2 + 2.2,
        y = heightAt(x, z) + 0.2;
      this.addLoot(ids[bidx % ids.length], { x, z, y }, (bidx % 3) as Rarity);
      this.addLoot(bidx % 2 ? "shield" : "med", { x: x + 2.2, z, y }, 0, 2);
      this.chests.push({
        id: this.nextId++,
        x: b.x,
        z: b.z,
        y: heightAt(b.x, b.z) + 0.25,
        opened: false,
        kind: bidx % 4 ? "chest" : "locker",
      });
    }
    // A clearly visible training supply row outside Aerie Market; no hidden starter advantage in Solo.
    if (this.options.mode === "practice") {
      ids.forEach((id, i) =>
        this.addLoot(
          id,
          {
            x: PRACTICE.x + (i - 4) * 3,
            z: PRACTICE.z - 8,
            y: heightAt(PRACTICE.x + (i - 4) * 3, PRACTICE.z - 8) + 0.2,
          },
          2,
        ),
      );
      Object.keys(ITEMS).forEach((id, i) =>
        this.addLoot(
          id as ItemId,
          {
            x: PRACTICE.x + (i - 3.5) * 3,
            z: PRACTICE.z + 7,
            y: heightAt(PRACTICE.x + (i - 3.5) * 3, PRACTICE.z + 7) + 0.2,
          },
          0,
          2,
        ),
      );
      for (let i = 1; i < this.actors.length; i++) {
        const a = this.actors[i];
        a.x = PRACTICE.x + (i - 3) * 8;
        a.z = PRACTICE.z - 30;
        a.y = heightAt(a.x, a.z);
        a.inventory[0] = this.item("pistol");
        a.ammo.light = 60;
      }
    }
  }
  step(input: Input, dt: number) {
    if (this.paused || this.result) return;
    this.accumulator = Math.min(0.25, this.accumulator + dt);
    while (this.accumulator >= DT) {
      this.tick(input);
      this.accumulator -= DT;
    }
  }
  private tick(input: Input) {
    this.time += DT;
    this.stageElapsed += DT;
    this.hitMarker = Math.max(0, this.hitMarker - DT);
    this.damageFlash = Math.max(0, this.damageFlash - DT);
    this.mist = this.mist.filter((m) => m.until > this.time);
    if (this.phase === "staging") {
      this.stageTime = Math.max(0, this.stageTime - DT);
      this.movePlayer(input);
      if ((input.interact && !this.player.lastInteract) || this.stageTime === 0)
        this.board();
      this.player.lastInteract = input.interact;
      return;
    }
    if (this.phase === "skiff") {
      this.stageTime = Math.max(0, this.stageTime - DT);
      this.player.x = -430 + (22 - this.stageTime) * 28;
      this.player.z = 135;
      this.player.y = 220;
      this.physics.teleport(this.player);
      if ((input.jump && !this.player.lastJump) || this.stageTime === 0)
        this.jumpSkiff();
      this.player.lastJump = input.jump;
      return;
    }
    if (this.phase === "dropping") {
      this.movePlayer(input);
      if (this.player.grounded) {
        this.phase = "playing";
        this.emit(
          "land",
          "THE HIGHWAKE · Find a weapon. Stay inside the Calmfield.",
        );
      }
      return;
    }
    this.playTime += DT;
    const oldPhase = this.storm.phase;
    this.storm = stormAt(this.playTime, this.options.pace, this.options.seed);
    if (this.options.mode === "practice")
      this.storm = {
        ...this.storm,
        radius: 800,
        remaining: 0,
        moving: false,
        damage: 0,
      };
    if (this.storm.phase !== oldPhase)
      this.emit(
        "storm",
        `CALMFIELD ${this.storm.phase + 1} · Rotate toward the next circle.`,
      );
    this.updateActorTimers(this.player);
    this.movePlayer(input);
    if (this.player.alive) {
      if (input.slot !== undefined) this.selectSlot(input.slot);
      if (input.reload && !this.player.lastReload) this.reload(this.player);
      if (input.interact && !this.player.lastInteract) this.interact();
      if (input.use && !this.player.lastUse) this.useItem(this.player, input);
      if (input.drop) this.dropSlot(this.player.slot);
      if (input.melee && !this.player.lastMelee) this.melee(this.player);
      const item = this.player.inventory[this.player.slot];
      if (
        input.fire &&
        item &&
        isWeapon(item.id) &&
        (WEAPONS[item.id].automatic || !this.previousFire)
      )
        this.firePlayer(input);
      else if (input.fire && item && !isWeapon(item.id) && !this.previousFire)
        this.useItem(this.player, input);
    }
    this.player.lastReload = input.reload;
    this.player.lastInteract = input.interact;
    this.player.lastUse = input.use;
    this.player.lastMelee = input.melee;
    this.previousFire = input.fire;
    for (const bot of this.actors.slice(1)) {
      if (!bot.alive) continue;
      this.updateActorTimers(bot);
      if (this.options.mode === "solo" && this.alive.length > 1)
        this.updateBot(bot);
    }
    this.footstepTimer += DT;
    if (this.footstepTimer > 0.5) {
      this.footstepTimer = 0;
      for (const bot of this.actors)
        if (bot.bot && bot.alive && bot.speed > 1)
          this.footprints.push({
            x: bot.x,
            y: bot.y + 0.06,
            z: bot.z,
            time: this.time,
          });
      this.footprints = this.footprints
        .filter((f) => this.time - f.time < 8)
        .slice(-400);
    }
    if (this.options.mode === "solo") {
      for (const actor of this.alive)
        if (
          this.alive.length > 1 &&
          dist(actor, this.storm) > this.storm.radius
        ) {
          const damage = this.storm.damage * DT;
          actor.stormDamage += damage;
          this.damage(actor, damage, undefined, true);
        }
      if (this.storm.phase >= 2 && !this.supplyDropped) {
        this.supplyDropped = true;
        const p = safePoint({ x: this.storm.nextX + 24, z: this.storm.nextZ });
        this.chests.push({
          id: this.nextId++,
          x: p.x,
          z: p.z,
          y: heightAt(p.x, p.z) + 0.2,
          opened: false,
          kind: "supply",
        });
        this.emit(
          "info",
          "A high-tier supply capsule has reached the Calmfield.",
        );
      }
      if (this.alive.length <= 1) this.finish();
    }
  }
  board() {
    if (this.phase !== "staging") return;
    this.phase = "skiff";
    this.stageTime = 22;
    this.stageElapsed = 0;
    this.player.y = 220;
    this.emit("info", "TRANSIT SKIFF · Space to jump · M to mark a landing.");
  }
  jumpSkiff() {
    if (this.phase !== "skiff") return;
    this.phase = "dropping";
    this.player.grounded = false;
    this.player.stance = "fall";
    this.player.vy = -12;
    this.player.yaw = Math.atan2(
      this.marker.x - this.player.x,
      this.marker.z - this.player.z,
    );
    this.physics.teleport(this.player);
    this.emit(
      "info",
      "WING-SAIL · Z deploys early. It opens automatically near terrain.",
    );
  }
  private movePlayer(input: Input) {
    const p = this.player;
    if (!p.alive) return;
    const justCrouched = input.crouch && !this.previousCrouch;
    this.previousCrouch = input.crouch;
    p.yaw = input.yaw;
    p.pitch = input.pitch;
    const old = { x: p.x, z: p.z };
    if (this.transit) {
      const t = this.transit;
      t.remaining = Math.max(0, t.remaining - DT);
      const f = 1 - t.remaining / t.duration;
      p.x = t.from.x + (t.to.x - t.from.x) * f;
      p.z = t.from.z + (t.to.z - t.from.z) * f;
      p.y = t.from.y + (t.to.y - t.from.y) * f + Math.sin(f * Math.PI) * 2;
      this.physics.teleport(p);
      p.grounded = false;
      p.speed = dist(old, p) / DT;
      p.distance += dist(old, p);
      if (t.remaining === 0) {
        p.vy = 0;
        p.stance = t.glide ? "glide" : "stand";
        this.transit = undefined;
      }
      return;
    }
    let sx = Math.sin(input.yaw),
      cz = Math.cos(input.yaw);
    let mx = sx * input.forward + cz * input.right,
      mz = cz * input.forward - sx * input.right;
    const length = Math.hypot(mx, mz);
    if (length > 1) {
      mx /= length;
      mz /= length;
    }
    const dropping = this.phase === "dropping" || p.stance === "glide";
    if (dropping) {
      const altitude = p.y - heightAt(p.x, p.z);
      if ((input.glide && !p.lastGlide) || altitude < 38) p.stance = "glide";
      p.lastGlide = input.glide;
      const gliding = p.stance === "glide";
      p.vy = gliding ? -7.5 : Math.max(-36, p.vy - 20 * DT);
      const speed = gliding ? 17 : 12;
      const steer = length > 0.1 ? { x: mx, z: mz } : { x: sx, z: cz };
      const moved = this.physics.move({
        x: steer.x * speed * DT,
        y: p.vy * DT,
        z: steer.z * speed * DT,
      });
      Object.assign(p, moved.position);
      p.grounded = moved.grounded;
      if (p.grounded) {
        p.vy = 0;
        p.stance = "stand";
      }
      p.distance += dist(old, p);
      return;
    }
    p.slide = Math.max(0, p.slide - DT);
    const swimming = heightAt(p.x, p.z) < -1.1;
    let speed = input.crouch ? 2.8 : 5.8;
    if (
      input.sprint &&
      !input.crouch &&
      p.stamina > 0 &&
      length > 0.1 &&
      !input.ads
    ) {
      speed = swimming ? 5.2 : 7.3;
      p.stamina = Math.max(0, p.stamina - DT);
    } else p.stamina = Math.min(5, p.stamina + DT * 0.85);
    if (
      justCrouched &&
      input.sprint &&
      p.stamina > 0.2 &&
      p.speed > 5.5 &&
      p.slide <= 0
    ) {
      p.slide = 1;
      p.stamina = Math.max(0, p.stamina - 0.6);
    }
    if (p.slide > 0) {
      speed = 10 * p.slide + 3;
      mx = sx;
      mz = cz;
      p.stance = "slide";
    } else p.stance = swimming ? "swim" : input.crouch ? "crouch" : "stand";
    if (input.ads) speed *= 0.65;
    if (p.action > 0) speed *= 0.4;
    if (input.jump && !p.lastJump && p.grounded) {
      p.vy = 6.1;
      p.grounded = false;
    }
    p.lastJump = input.jump;
    if (p.grounded && p.vy < 0) p.vy = -2;
    else p.vy -= 20 * DT;
    const movement = this.physics.move({
      x: mx * speed * DT,
      y: p.vy * DT,
      z: mz * speed * DT,
    });
    const impact = p.vy;
    Object.assign(p, movement.position);
    p.grounded = movement.grounded;
    if (p.grounded) {
      if (impact < -19 && this.phase === "playing")
        this.damage(p, (-impact - 19) * 3);
      p.vy = -2;
    }
    if (swimming && p.y < -0.3) {
      p.y = -0.3;
      p.vy = 0;
      this.physics.teleport(p);
    }
    p.speed = dist(old, p) / DT;
    p.distance += dist(old, p);
    if (Math.abs(p.x) > 595 || Math.abs(p.z) > 595) {
      p.x = clamp(p.x, -590, 590);
      p.z = clamp(p.z, -590, 590);
      this.physics.teleport(p);
    }
  }
  private updateActorTimers(a: Actor) {
    a.cooldown = Math.max(0, a.cooldown - DT);
    if (this.time - a.lastDamage > 8) a.aegis = Math.min(50, a.aegis + 10 * DT);
    if (a.reload > 0) {
      a.reload = Math.max(0, a.reload - DT);
      if (a.reload === 0) {
        const item = a.inventory[a.slot];
        if (item && isWeapon(item.id)) {
          const def = WEAPONS[item.id],
            take = Math.min(def.mag - item.loaded, a.ammo[def.ammo]);
          item.loaded += take;
          a.ammo[def.ammo] -= take;
        }
      }
    }
    if (a.action > 0) {
      a.action = Math.max(0, a.action - DT);
      if (a.action === 0) this.completeItem(a);
    }
  }
  selectSlot(slot: number) {
    if (slot < 0 || slot >= 5 || !Number.isInteger(slot)) return;
    if (this.player.slot !== slot) {
      this.player.slot = slot;
      this.player.reload = 0;
      this.player.action = 0;
    }
  }
  private reload(a: Actor) {
    const item = a.inventory[a.slot];
    if (!item || !isWeapon(item.id) || a.reload > 0 || a.action > 0) return;
    const def = WEAPONS[item.id];
    if (item.loaded >= def.mag || a.ammo[def.ammo] <= 0) return;
    a.reload = def.reload * (1 - item.rarity * 0.04);
    this.emit("reload", a.bot ? "" : `Reloading ${def.name}`, a.id);
  }
  private firePlayer(input: Input) {
    const p = this.player,
      item = p.inventory[p.slot];
    if (
      !item ||
      !isWeapon(item.id) ||
      p.cooldown > 0 ||
      p.reload > 0 ||
      p.action > 0
    )
      return;
    const def = WEAPONS[item.id];
    if (item.loaded <= 0) {
      this.reload(p);
      return;
    }
    item.loaded--;
    p.cooldown = 1 / def.rate;
    p.shots++;
    const origin = input.aimOrigin ?? { x: p.x, y: p.y + 1.45, z: p.z };
    const aim = input.aimDirection ?? {
      x: Math.sin(p.yaw) * Math.cos(p.pitch),
      y: -Math.sin(p.pitch),
      z: Math.cos(p.yaw) * Math.cos(p.pitch),
    };
    let point = {
      x: origin.x + aim.x * def.range,
      y: origin.y + aim.y * def.range,
      z: origin.z + aim.z * def.range,
    };
    let nearest = def.range;
    for (const o of OBSTACLES) {
      const t = rayBox(origin, aim, o, nearest);
      if (t !== undefined) {
        nearest = t;
        point = {
          x: origin.x + aim.x * t,
          y: origin.y + aim.y * t,
          z: origin.z + aim.z * t,
        };
      }
    }
    const muzzle = { x: p.x, y: p.y + 1.35, z: p.z };
    const spread =
      def.spread *
      (input.ads ? 0.28 : 1) *
      (p.speed > 3 ? 1.3 : 1) *
      (1 - item.rarity * 0.05);
    const results = new Map<number, { damage: number; head: boolean }>();
    for (let pellet = 0; pellet < def.pellets; pellet++) {
      const dir = {
        x: aim.x + this.random.range(-spread, spread),
        y: aim.y + this.random.range(-spread, spread),
        z: aim.z + this.random.range(-spread, spread),
      };
      const length = Math.hypot(dir.x, dir.y, dir.z);
      dir.x /= length;
      dir.y /= length;
      dir.z /= length;
      let hit: Actor | undefined,
        hitT = nearest,
        head = false;
      for (const a of this.alive) {
        if (a.id === 0) continue;
        const center = { x: a.x, y: a.y + 1, z: a.z };
        const t =
          (center.x - origin.x) * dir.x +
          (center.y - origin.y) * dir.y +
          (center.z - origin.z) * dir.z;
        if (t < 0 || t > hitT) continue;
        const x = origin.x + dir.x * t,
          z = origin.z + dir.z * t,
          y = origin.y + dir.y * t;
        if (
          Math.hypot(x - a.x, z - a.z) < 0.62 &&
          y > a.y + 0.05 &&
          y < a.y + 1.9 &&
          clearSight(muzzle, { x: a.x, y: a.y + 1.1, z: a.z })
        ) {
          hit = a;
          hitT = t;
          head = y > a.y + 1.5;
        }
      }
      if (hit) {
        const falloff = clamp(
            1 - Math.max(0, hitT - def.range * 0.35) / (def.range * 0.9),
            0.35,
            1,
          ),
          damage =
            def.damage *
            RARITIES[item.rarity].mult *
            falloff *
            (head ? 1.65 : 1);
        const entry = results.get(hit.id) ?? { damage: 0, head: false };
        entry.damage += damage;
        entry.head ||= head;
        results.set(hit.id, entry);
        point = { x: hit.x, y: hit.y + 1, z: hit.z };
      }
    }
    for (const [id, hit] of results) {
      const a = this.actors.find((a) => a.id === id)!;
      const dmg = def.pellets > 1 ? Math.min(120, hit.damage) : hit.damage;
      this.damage(a, dmg, p, false, hit.head);
      p.hits++;
      this.hitMarker = 0.2;
      if (item.id === "launcher") this.displace(a, p, 10);
    }
    this.emit("shot", "", 0, undefined, { ...muzzle }, point);
    if (results.size === 0 && point.y < heightAt(point.x, point.z))
      point.y = heightAt(point.x, point.z);
  }
  private damage(
    target: Actor,
    amount: number,
    attacker?: Actor,
    storm = false,
    head = false,
  ) {
    if (!target.alive || amount <= 0) return;
    let remain = amount;
    const shield = target.aegis + target.reserve > 0;
    if (!storm) {
      const a = Math.min(target.aegis, remain);
      target.aegis -= a;
      remain -= a;
      const reserve = Math.min(target.reserve, remain);
      target.reserve -= reserve;
      remain -= reserve;
    }
    const dealt = Math.min(target.hp, remain);
    target.hp = Math.max(0, target.hp - remain);
    target.lastDamage = this.time;
    if (target.actionItem === "trauma") target.action = 0;
    if (attacker) attacker.damage += amount - remain + dealt;
    if (target.id === 0) this.damageFlash = 0.35;
    if (attacker?.id === 0 || target.id === 0)
      this.emit(
        "hit",
        shield ? "AEGIS HIT" : "HEALTH HIT",
        attacker?.id,
        target.id,
        { x: target.x, y: target.y + 1, z: target.z },
        undefined,
        amount,
        head,
        shield,
      );
    if (target.hp <= 0) {
      target.alive = false;
      if (target.id === 0) {
        this.deathPlace = this.alive.length + 1;
        this.deathTime = this.playTime;
      }
      if (attacker) attacker.kills++;
      for (const item of target.inventory) {
        if (item)
          this.loot.push({
            id: this.nextId++,
            item: { ...item },
            x: target.x + this.random.range(-1, 1),
            y: target.y + 0.2,
            z: target.z + this.random.range(-1, 1),
            active: true,
            source: "cache",
          });
      }
      target.inventory = [null, null, null, null, null];
      this.emit(
        "kill",
        `${attacker?.name ?? "Riftstorm"} eliminated ${target.name}`,
        attacker?.id,
        target.id,
        { ...target },
      );
    }
  }
  private updateBot(bot: Actor) {
    bot.think -= DT;
    if (bot.think <= 0) {
      bot.think = 0.25 + this.random.next() * 0.3;
      const enemy = this.alive
        .filter(
          (a) =>
            a.id !== bot.id &&
            dist(a, bot) < 90 &&
            clearSight(
              { x: bot.x, y: bot.y + 1.3, z: bot.z },
              { x: a.x, y: a.y + 1.3, z: a.z },
            ) &&
            !this.mist.some((m) => dist(m, a) < 8 || dist(m, bot) < 8),
        )
        .sort((a, b) => dist(a, bot) - dist(b, bot))[0];
      bot.target = enemy?.id;
      const outside =
        dist(bot, this.storm) > Math.max(10, this.storm.radius - 25);
      if (outside)
        bot.goal = safePoint({
          x: this.storm.nextX + this.random.range(-15, 15),
          z: this.storm.nextZ + this.random.range(-15, 15),
        });
      else if (!bot.inventory.some((i) => i && isWeapon(i.id))) {
        const loot = this.loot
          .filter((l) => l.active && isWeapon(l.item.id) && dist(l, bot) < 110)
          .sort((a, b) => dist(a, bot) - dist(b, bot))[0];
        bot.goal = loot
          ? { x: loot.x, z: loot.z }
          : safePoint(LANDMARKS[bot.id % 6]);
        if (loot && dist(loot, bot) < 2.4) this.pickup(bot, loot);
      } else if (enemy) {
        const desired = bot.inventory[bot.slot]?.id === "scattergun" ? 12 : 30;
        if (dist(bot, enemy) > desired) bot.goal = { x: enemy.x, z: enemy.z };
        else
          bot.goal = safePoint({
            x: bot.x + Math.cos(this.time + bot.id) * 4,
            z: bot.z + Math.sin(this.time + bot.id) * 4,
          });
      } else if (!bot.goal || dist(bot, bot.goal) < 5)
        bot.goal = safePoint({
          x:
            this.storm.x +
            this.random.range(
              -this.storm.radius * 0.65,
              this.storm.radius * 0.65,
            ),
          z:
            this.storm.z +
            this.random.range(
              -this.storm.radius * 0.65,
              this.storm.radius * 0.65,
            ),
        });
      if (bot.hp < 55 && bot.healStock > 0 && !enemy) {
        bot.hp = Math.min(100, bot.hp + 35);
        bot.healStock--;
      }
    }
    const target = this.actors.find((a) => a.id === bot.target && a.alive);
    if (bot.goal) {
      const dx = bot.goal.x - bot.x,
        dz = bot.goal.z - bot.z,
        length = Math.hypot(dx, dz);
      if (length > 1) {
        const speed =
          dist(bot, this.storm) > this.storm.radius ? 7.3 : target ? 3.8 : 5.8;
        const angle = Math.atan2(dx, dz);
        let moved = false;
        for (const turn of [0, 0.7, -0.7, 1.3, -1.3, 2, -2]) {
          const nx = bot.x + Math.sin(angle + turn) * speed * DT,
            nz = bot.z + Math.cos(angle + turn) * speed * DT;
          if (!blockedAt(nx, nz, 0.5)) {
            bot.distance += Math.hypot(nx - bot.x, nz - bot.z);
            bot.x = nx;
            bot.z = nz;
            bot.y = heightAt(nx, nz);
            bot.speed = speed;
            bot.yaw = angle + turn;
            moved = true;
            break;
          }
        }
        if (!moved) bot.goal = undefined;
      }
    }
    if (
      target &&
      bot.inventory[bot.slot] &&
      clearSight(
        { x: bot.x, y: bot.y + 1.2, z: bot.z },
        { x: target.x, y: target.y + 1.2, z: target.z },
      )
    ) {
      bot.yaw = Math.atan2(target.x - bot.x, target.z - bot.z);
      bot.reaction -= DT;
      if (bot.reaction <= 0) this.fireBot(bot, target);
    } else bot.reaction = 0.35;
  }
  private fireBot(bot: Actor, target: Actor) {
    const item = bot.inventory[bot.slot];
    if (!item || !isWeapon(item.id) || bot.cooldown > 0 || bot.reload > 0)
      return;
    const def = WEAPONS[item.id];
    if (item.loaded <= 0) {
      this.reload(bot);
      return;
    }
    if (dist(bot, target) > def.range) return;
    item.loaded--;
    bot.cooldown = 1 / def.rate;
    bot.shots++;
    const chance =
      clamp(0.58 - dist(bot, target) / 180, 0.16, 0.58) *
      (target.speed > 5 ? 0.75 : 1);
    if (this.random.next() < chance) {
      this.damage(
        target,
        def.damage * RARITIES[item.rarity].mult * (def.pellets > 1 ? 3 : 1),
        bot,
      );
      bot.hits++;
    }
    if (dist(bot, this.player) < 130)
      this.emit(
        "shot",
        "",
        bot.id,
        target.id,
        { x: bot.x, y: bot.y + 1.3, z: bot.z },
        { x: target.x, y: target.y + 1, z: target.z },
      );
  }
  private melee(actor: Actor) {
    if (actor.cooldown > 0) return;
    actor.cooldown = 0.75;
    const enemy = this.alive.find(
      (a) => a.id !== actor.id && dist(a, actor) < 2.8,
    );
    if (enemy) this.damage(enemy, 32, actor);
    this.emit(
      "shot",
      "Windblade strike",
      actor.id,
      enemy?.id,
      { ...actor },
      enemy ? { ...enemy } : undefined,
    );
  }
  private displace(actor: Actor, origin: V2, amount: number) {
    const d = dist(actor, origin) || 1;
    const p = safePoint({
      x: actor.x + ((actor.x - origin.x) / d) * amount,
      z: actor.z + ((actor.z - origin.z) / d) * amount,
    });
    actor.x = p.x;
    actor.z = p.z;
    actor.y = heightAt(p.x, p.z);
    if (actor.id === 0) this.physics.teleport(actor);
  }
  nearby(): Snapshot["nearby"] {
    const p = this.player;
    const loot = this.loot
      .filter((l) => l.active && dist(l, p) < 3.2 && Math.abs(l.y - p.y) < 3)
      .sort((a, b) => dist(a, p) - dist(b, p))[0];
    if (loot)
      return {
        label: itemName(loot.item.id),
        detail: `${RARITIES[loot.item.rarity].name} · ${isWeapon(loot.item.id) ? WEAPONS[loot.item.id].category : `×${loot.item.quantity}`} · E pick up`,
        kind: "loot",
        id: loot.id,
        rarity: loot.item.rarity,
      };
    const chest = this.chests.find(
      (c) => !c.opened && dist(c, p) < 3 && Math.abs(c.y - p.y) < 3,
    );
    if (chest)
      return {
        label:
          chest.kind === "supply"
            ? "Supply capsule"
            : chest.kind === "locker"
              ? "Supply locker"
              : "Resonance chest",
        detail: "E open · gear, ammo and recovery",
        kind: "chest",
        id: chest.id,
      };
    const traversal = TRAVERSALS.find(
      (t) => dist(t, p) < 4 && Math.abs(t.y - p.y) < 11,
    );
    if (traversal)
      return {
        label: traversal.kind === "vent" ? "Wind vent" : "Cable transit",
        detail: "E use · exposed traversal",
        kind: "traversal",
        id: traversal.id,
      };
    return undefined;
  }
  interact() {
    const near = this.nearby();
    if (!near || this.transit) return;
    if (near.kind === "loot") {
      const l = this.loot.find((l) => l.id === near.id);
      if (l) this.pickup(this.player, l);
    } else if (near.kind === "chest") {
      const chest = this.chests.find((c) => c.id === near.id)!;
      chest.opened = true;
      const ids = Object.keys(WEAPONS) as WeaponId[];
      const rarity = (
        chest.kind === "supply" ? 4 : 1 + Math.floor(this.random.next() * 3)
      ) as Rarity;
      this.addLoot(
        ids[Math.floor(this.random.next() * ids.length)],
        { x: chest.x + 1.2, y: chest.y, z: chest.z },
        rarity,
        1,
        chest.kind === "supply" ? "supply" : "chest",
      );
      this.addLoot(
        this.random.next() > 0.5 ? "shield" : "med",
        { x: chest.x - 1.2, y: chest.y, z: chest.z },
        0,
        2,
        "chest",
      );
      for (const type of Object.keys(AMMO_CAP) as Ammo[])
        this.player.ammo[type] = Math.min(
          AMMO_CAP[type],
          this.player.ammo[type] +
            (type === "light" ? 45 : type === "charge" ? 3 : 12),
        );
      this.emit("pickup", "CACHE OPENED · Equipment and ammunition recovered.");
    } else {
      const t = TRAVERSALS.find((t) => t.id === near.id)!;
      const duration = t.kind === "vent" ? 1.4 : 3.2;
      this.transit = {
        from: { ...this.player },
        to:
          t.kind === "vent"
            ? { x: this.player.x, y: this.player.y + 35, z: this.player.z }
            : { ...t.end, y: t.end.y - 1.3 },
        remaining: duration,
        duration,
        glide: t.kind === "vent",
      };
      this.emit(
        "info",
        t.kind === "vent"
          ? "WIND VENT · Catch the updraft."
          : "CABLE TRANSIT · Exposed while moving.",
      );
    }
  }
  private pickup(a: Actor, loot: Loot) {
    if (!loot.active || dist(a, loot) > 3.5) return false;
    const item = loot.item;
    let slot = a.inventory.findIndex((i) => !i);
    if (!isWeapon(item.id)) {
      const existing = a.inventory.find(
        (i) =>
          i?.id === item.id &&
          i.quantity < ITEMS[item.id as keyof typeof ITEMS].stack,
      );
      if (existing) {
        const take = Math.min(
          ITEMS[item.id].stack - existing.quantity,
          item.quantity,
        );
        existing.quantity += take;
        item.quantity -= take;
        loot.active = item.quantity > 0;
        if (a.id === 0) this.emit("pickup", `${itemName(item.id)} +${take}`);
        return true;
      }
    }
    if (slot < 0) {
      slot = a.slot;
      const old = a.inventory[slot];
      if (old)
        this.loot.push({
          id: this.nextId++,
          item: { ...old },
          x: a.x + 1,
          y: a.y + 0.2,
          z: a.z,
          active: true,
          source: "cache",
        });
    }
    a.inventory[slot] = { ...item };
    loot.active = false;
    a.slot = slot;
    a.reload = 0;
    a.action = 0;
    if (isWeapon(item.id)) {
      const type = WEAPONS[item.id].ammo;
      a.ammo[type] = Math.min(
        AMMO_CAP[type],
        a.ammo[type] + WEAPONS[item.id].mag * 2,
      );
    }
    if (a.id === 0) {
      this.lootCount++;
      this.emit(
        "pickup",
        `${RARITIES[item.rarity].name.toUpperCase()} ${itemName(item.id)}`,
      );
    }
    return true;
  }
  dropSlot(slot: number) {
    const a = this.player,
      item = a.inventory[slot];
    if (!item) return;
    this.loot.push({
      id: this.nextId++,
      item: { ...item },
      x: a.x + Math.sin(a.yaw) * 1.5,
      y: a.y + 0.2,
      z: a.z + Math.cos(a.yaw) * 1.5,
      active: true,
      source: "cache",
    });
    a.inventory[slot] = null;
    a.action = 0;
    a.reload = 0;
  }
  swapSlots(a: number, b: number) {
    if (a < 0 || a > 4 || b < 0 || b > 4) return;
    [this.player.inventory[a], this.player.inventory[b]] = [
      this.player.inventory[b],
      this.player.inventory[a],
    ];
    this.player.reload = 0;
    this.player.action = 0;
  }
  private useItem(a: Actor, input: Input) {
    const item = a.inventory[a.slot];
    if (!item || isWeapon(item.id) || a.action > 0 || a.reload > 0) return;
    if (
      ((item.id === "med" || item.id === "trauma") && a.hp >= 100) ||
      (item.id === "shield" && a.reserve >= 50)
    )
      return;
    a.actionItem = item.id;
    a.action = ITEMS[item.id].duration;
    if (item.id === "grapple") {
      const target = safePoint({
        x: a.x + Math.sin(input.yaw) * 24,
        z: a.z + Math.cos(input.yaw) * 24,
      });
      if (
        clearSight(
          { x: a.x, y: a.y + 2, z: a.z },
          { x: target.x, y: heightAt(target.x, target.z) + 2, z: target.z },
        )
      ) {
        this.transit = {
          from: { ...a },
          to: { ...target, y: heightAt(target.x, target.z) + 0.2 },
          remaining: 0.8,
          duration: 0.8,
          glide: false,
        };
      } else {
        a.action = 0;
        this.emit("info", "Grapple blocked · Choose an open route.");
      }
    }
  }
  private completeItem(a: Actor) {
    const item = a.inventory[a.slot];
    if (!item || item.id !== a.actionItem || isWeapon(item.id)) return;
    switch (item.id) {
      case "med":
        a.hp = Math.min(100, a.hp + 35);
        break;
      case "trauma":
        a.hp = 100;
        break;
      case "shield":
        a.reserve = Math.min(50, a.reserve + 25);
        break;
      case "aegis":
        a.lastDamage = this.time - 9;
        break;
      case "mist":
        this.mist.push({ x: a.x, y: a.y + 1, z: a.z, until: this.time + 12 });
        break;
      case "echo":
        this.echoUntil = this.time + 8;
        this.echoMarks = this.footprints
          .filter((f) => this.time - f.time > 1.5 && dist(f, a) < 60)
          .map((f) => ({ ...f }));
        break;
      case "orb":
        for (const other of this.alive)
          if (other.id !== a.id && dist(other, a) < 10) {
            this.damage(other, 12, a);
            this.displace(other, a, 12);
          }
        break;
    }
    item.quantity--;
    if (item.quantity <= 0) a.inventory[a.slot] = null;
    this.emit("heal", `${itemName(item.id)} used`, a.id);
    a.actionItem = undefined;
  }
  setMarker(p: V2) {
    this.marker = { x: clamp(p.x, -550, 550), z: clamp(p.z, -550, 550) };
  }
  finish() {
    if (this.result) return;
    this.phase = "ended";
    const survivors = this.alive,
      winner = survivors.length === 1 ? survivors[0] : undefined;
    const p = this.player;
    this.result = {
      version: 1,
      id: `skybreak-${this.options.seed}-${Math.round(this.time * 30)}`,
      date: new Date().toISOString(),
      seed: this.options.seed,
      mode: this.options.mode,
      place: this.deathPlace ?? (winner?.id === 0 ? 1 : 0),
      winner:
        winner?.name ??
        (survivors.length
          ? "Undecided · session ended early"
          : "The Riftstorm"),
      victory: winner?.id === 0,
      kills: p.kills,
      damage: Math.round(p.damage),
      accuracy: p.shots
        ? Math.min(100, Math.round((p.hits / p.shots) * 100))
        : 0,
      survival: this.deathTime ?? this.playTime,
      distance: Math.round(p.distance),
      stormDamage: Math.round(p.stormDamage),
      loot: this.lootCount,
      timeline: this.events
        .filter((e) => e.text)
        .slice(-15)
        .map((e) => e.text),
    };
  }
  endPractice() {
    if (this.options.mode === "practice") this.finish();
  }
  private emit(
    type: GameEvent["type"],
    text: string,
    actor?: number,
    target?: number,
    position?: V3,
    end?: V3,
    amount?: number,
    head?: boolean,
    shield?: boolean,
  ) {
    this.events.push({
      id: this.nextId++,
      time: this.time,
      type,
      text,
      actor,
      target,
      position,
      end,
      amount,
      head,
      shield,
    });
    if (this.events.length > 150)
      this.events.splice(0, this.events.length - 150);
  }
  snapshot(fps = 60): Snapshot {
    return {
      phase: this.phase,
      time: this.time,
      stageTime: this.stageTime,
      player: {
        ...this.player,
        inventory: this.player.inventory.map((i) => (i ? { ...i } : null)),
        ammo: { ...this.player.ammo },
      },
      alive: this.alive.length,
      storm: { ...this.storm },
      events: this.events
        .filter((e) => e.text && this.time - e.time < 6)
        .slice(-5),
      result: this.result,
      nearby: this.nearby(),
      location: locationAt(this.player),
      marker: { ...this.marker },
      outside: dist(this.player, this.storm) > this.storm.radius,
      fps,
      paused: this.paused,
      hitMarker: this.hitMarker,
      damageFlash: this.damageFlash,
    };
  }
  dispose() {
    this.physics.dispose();
  }
}
