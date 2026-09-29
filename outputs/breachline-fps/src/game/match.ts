import {
  defaultLoadouts,
  validLoadout,
  weapons,
  type Loadout,
  type Team,
  type WeaponId,
} from "./data";
import {
  blocked,
  clearLine,
  findPath,
  floorAt,
  patrolPoints,
  wallDistance,
  type Point,
} from "./navigation";
export { blocked } from "./navigation";
export type Input = {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  fire: boolean;
  ads: boolean;
  sprint: boolean;
  crouch: boolean;
  jump?: boolean;
  reload?: boolean;
  swap?: boolean;
  slot?: 0 | 1;
  lethal?: boolean;
  tactical?: boolean;
  support?: boolean;
  melee?: boolean;
  seq?: number;
};
export type Combatant = {
  id: string;
  name: string;
  team: Team;
  bot: boolean;
  x: number;
  z: number;
  y: number;
  yaw: number;
  pitch: number;
  hp: number;
  kills: number;
  deaths: number;
  assists: number;
  momentum: number;
  best: number;
  ammo: number;
  reserve: number;
  sideAmmo: number;
  slot: 0 | 1;
  alive: boolean;
  protection: number;
  respawn: number;
  fireWait: number;
  reloadTime: number;
  lastDamage: number;
  crouch: boolean;
  ads: boolean;
  sprint: boolean;
  lethal: number;
  tactical: number;
  supports: number[];
  loadout: Loadout;
  input: Input;
  lastShot: number;
  spotted: number;
  jumpVelocity: number;
  shots: number;
  hits: number;
  flash: number;
  killer: string;
  killedWith: string;
  damageYaw: number;
  vx: number;
  vz: number;
  spawnX: number;
  spawnZ: number;
};
export type CombatEvent = {
  id: number;
  kind: "kill" | "hit" | "shot" | "support" | "info" | "explosion" | "reload";
  text: string;
  x?: number;
  y?: number;
  z?: number;
  endX?: number;
  endY?: number;
  endZ?: number;
  actor?: string;
  victim?: string;
  damage?: number;
  head?: boolean;
  source?: string;
  time: number;
};
export type Projectile = {
  id: number;
  actor: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fuse: number;
  kind: "frag" | "adhesive";
};
export type Snapshot = {
  time: number;
  remaining: number;
  score: [number, number];
  players: Combatant[];
  events: CombatEvent[];
  projectiles: Projectile[];
  winner?: Team | "draw";
  phase: "active" | "finished";
  matchId: string;
  scoreLimit: number;
  overtime: boolean;
};
export const idleInput = (): Input => ({
  x: 0,
  z: 0,
  yaw: 0,
  pitch: 0,
  fire: false,
  ads: false,
  sprint: false,
  crouch: false,
});
export const eyeHeight = (p: Combatant) => p.y + (p.crouch ? 1.15 : 1.68);
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const delta = (a: number, b: number) =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b));
const names = [
  "Mercer",
  "Tamsin",
  "Rook",
  "Vale",
  "Mako",
  "Crest",
  "Aster",
  "Ibis",
  "Slate",
  "Kite",
  "Coda",
  "Venn",
];
type Memory = {
  path: Point[];
  goal?: Point;
  replan: number;
  target?: string;
  reaction: number;
  lost: number;
  strafe: number;
  burst: number;
  stuck: number;
  last: Point;
};

/** Pure authoritative simulation. Rendering never determines a hit or a score. */
export class MatchSimulation {
  readonly players = new Map<string, Combatant>();
  readonly events: CombatEvent[] = [];
  readonly projectiles: Projectile[] = [];
  readonly matchId: string;
  time = 0;
  score: [number, number] = [0, 0];
  winner?: Team | "draw";
  overtime = false;
  private eventId = 0;
  private seed: number;
  private botCounter = 0;
  private memories = new Map<string, Memory>();
  private held = new Map<string, boolean>();
  private pending = new Map<string, Loadout>();
  private credits = new Map<string, Map<string, number>>();
  private endTime: number;
  private overtimeTarget = Infinity;
  constructor(
    seed = Date.now() >>> 0,
    readonly duration = 480,
    readonly scoreLimit = 75,
    readonly difficulty: "easy" | "normal" | "hard" = "normal",
  ) {
    this.seed = seed >>> 0;
    this.matchId = seed.toString(36);
    this.endTime = duration;
  }
  private random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  private event(
    kind: CombatEvent["kind"],
    text: string,
    extra: Partial<CombatEvent> = {},
  ) {
    this.events.push({
      id: ++this.eventId,
      kind,
      text,
      time: this.time,
      ...extra,
    });
    if (this.events.length > 128) this.events.shift();
  }
  addHuman(id: string, name: string, loadout = defaultLoadouts[0]): Combatant {
    const humans = [...this.players.values()].filter((p) => !p.bot);
    const team: Team =
      humans.filter((p) => p.team === "atlas").length <=
      humans.filter((p) => p.team === "cobalt").length
        ? "atlas"
        : "cobalt";
    const replacement = [...this.players.values()].find(
      (p) => p.bot && p.team === team,
    );
    if (replacement) {
      this.players.delete(replacement.id);
      this.memories.delete(replacement.id);
    }
    const p = this.create(
      id,
      name.slice(0, 22),
      team,
      false,
      validLoadout(loadout) ? loadout : defaultLoadouts[0],
    );
    this.players.set(id, p);
    this.spawn(p);
    return p;
  }
  removeHuman(id: string) {
    this.players.delete(id);
    this.held.delete(id);
    this.pending.delete(id);
    this.fillBots();
  }
  fillBots() {
    for (const team of ["atlas", "cobalt"] as const)
      while (
        [...this.players.values()].filter((p) => p.team === team).length < 6
      ) {
        const n = this.botCounter++,
          p = this.create(
            `bot-${n}`,
            names[n % names.length],
            team,
            true,
            defaultLoadouts[n % 5],
          );
        this.players.set(p.id, p);
        this.spawn(p);
      }
  }
  private create(
    id: string,
    name: string,
    team: Team,
    bot: boolean,
    loadout: Loadout,
  ): Combatant {
    return {
      id,
      name,
      team,
      bot,
      x: 0,
      z: 0,
      y: 0,
      yaw: 0,
      pitch: 0,
      hp: 100,
      kills: 0,
      deaths: 0,
      assists: 0,
      momentum: 0,
      best: 0,
      ammo: 0,
      reserve: 0,
      sideAmmo: 0,
      slot: 0,
      alive: true,
      protection: 2,
      respawn: 0,
      fireWait: 0,
      reloadTime: 0,
      lastDamage: -99,
      crouch: false,
      ads: false,
      sprint: false,
      lethal: 1,
      tactical: 1,
      supports: [0, 0, 0],
      loadout: { ...loadout },
      input: idleInput(),
      lastShot: -99,
      spotted: 0,
      jumpVelocity: 0,
      shots: 0,
      hits: 0,
      flash: 0,
      killer: "",
      killedWith: "",
      damageYaw: 0,
      vx: 0,
      vz: 0,
      spawnX: 0,
      spawnZ: 0,
    };
  }
  private spawn(p: Combatant) {
    const side = p.team === "atlas" ? -1 : 1,
      enemies = [...this.players.values()].filter(
        (e) => e.team !== p.team && e.alive,
      );
    const points = [-49, -32, -22, -2, 22, 32, 49]
      .flatMap((x) => [side * 42, side * 37].map((z) => ({ x, z })))
      .filter((a) => !blocked(a.x, a.z));
    const safe = points.filter(
        (a) => !enemies.some((e) => dist(a, e) < 25 && clearLine(a, e)),
      ),
      pool = safe.length ? safe : points;
    const ranked = pool
      .map((a) => ({
        ...a,
        value:
          Math.min(
            80,
            ...enemies.map((e) => dist(a, e) + (clearLine(a, e) ? 0 : 24)),
          ) +
          this.random() * 4,
      }))
      .sort((a, b) => b.value - a.value);
    const chosen = ranked[
      Math.floor(this.random() * Math.min(3, ranked.length))
    ] ?? { x: 0, z: side * 42 };
    p.loadout = this.pending.get(p.id) ?? p.loadout;
    this.pending.delete(p.id);
    Object.assign(p, {
      x: chosen.x,
      z: chosen.z,
      spawnX: chosen.x,
      spawnZ: chosen.z,
      y: 0,
      hp: 100,
      alive: true,
      respawn: 0,
      protection: 2,
      ammo: weapons[p.loadout.primary].mag,
      reserve:
        weapons[p.loadout.primary].mag *
        (p.loadout.perk === "scavenger" ? 6 : 4),
      sideAmmo: weapons[p.loadout.sidearm].mag,
      slot: 0,
      lethal: 1,
      tactical: 1,
      reloadTime: 0,
      fireWait: 0,
      momentum: 0,
      yaw: side < 0 ? 0 : Math.PI,
      pitch: 0,
      vx: 0,
      vz: 0,
      jumpVelocity: 0,
      supports: [0, 0, 0],
      flash: 0,
      lastDamage: -99,
    });
    p.input = { ...idleInput(), yaw: p.yaw };
    this.credits.delete(p.id);
    this.held.delete(p.id);
    this.memories.set(p.id, {
      path: [],
      replan: 0,
      reaction: 0,
      lost: 0,
      strafe: this.random() < 0.5 ? -1 : 1,
      burst: 0,
      stuck: 0,
      last: { x: p.x, z: p.z },
    });
  }
  setInput(id: string, input: Input) {
    const p = this.players.get(id);
    if (!p || p.bot || !input || typeof input !== "object") return;
    const b = (key: keyof Input) => input[key] === true;
    p.input = {
      x: clamp(Number(input.x) || 0, -1, 1),
      z: clamp(Number(input.z) || 0, -1, 1),
      yaw: Number.isFinite(input.yaw) ? input.yaw % (Math.PI * 2) : p.yaw,
      pitch: clamp(Number(input.pitch) || 0, -1.35, 1.35),
      fire: b("fire"),
      ads: b("ads"),
      sprint: b("sprint"),
      crouch: b("crouch"),
      jump: b("jump"),
      reload: b("reload"),
      swap: b("swap"),
      slot: input.slot === 0 || input.slot === 1 ? input.slot : undefined,
      lethal: b("lethal"),
      tactical: b("tactical"),
      support: b("support"),
      melee: b("melee"),
    };
  }
  setLoadout(id: string, loadout: Loadout) {
    if (!this.players.has(id) || !validLoadout(loadout)) return false;
    this.pending.set(id, { ...loadout });
    return true;
  }
  step(dt = 1 / 60) {
    if (this.winner) return;
    dt = clamp(dt, 0, 0.05);
    this.time += dt;
    for (const p of this.players.values()) {
      if (!p.alive) {
        p.respawn -= dt;
        if (p.respawn <= 0) this.spawn(p);
        continue;
      }
      if (p.bot) this.botInput(p, dt);
      p.protection = Math.max(0, p.protection - dt);
      p.fireWait = Math.max(0, p.fireWait - dt);
      p.spotted = Math.max(0, p.spotted - dt);
      p.flash = Math.max(0, p.flash - dt);
      p.crouch = p.input.crouch;
      p.ads = p.input.ads;
      p.sprint = p.input.sprint && !p.ads && !p.input.fire && p.input.z > 0.1;
      p.yaw = p.input.yaw;
      p.pitch = p.input.pitch;
      if (
        p.input.swap ||
        (p.input.slot !== undefined && p.input.slot !== p.slot)
      ) {
        const old = p.ammo;
        p.ammo = p.sideAmmo;
        p.sideAmmo = old;
        p.slot = p.slot === 0 ? 1 : 0;
        p.reloadTime = 0;
        p.fireWait = 0.22;
      }
      p.input.swap = false;
      p.input.slot = undefined;
      const weapon =
        weapons[p.slot === 0 ? p.loadout.primary : p.loadout.sidearm];
      if (
        p.input.reload &&
        p.reloadTime <= 0 &&
        p.ammo < weapon.mag &&
        p.reserve > 0
      ) {
        p.reloadTime = weapon.reload;
        this.event("reload", "RELOADING", { actor: p.id });
      }
      p.input.reload = false;
      if (p.reloadTime > 0) {
        p.reloadTime -= dt;
        if (p.reloadTime <= 0) {
          const count = Math.min(weapon.mag - p.ammo, p.reserve);
          p.ammo += count;
          p.reserve -= count;
        }
      }
      const floor = floorAt(p.x, p.z, p.y + 0.14);
      if (p.input.jump && p.y <= floor + 0.03) {
        const ahead = {
            x: p.x + Math.sin(p.yaw) * 0.9,
            z: p.z + Math.cos(p.yaw) * 0.9,
          },
          ledge = floorAt(ahead.x, ahead.z, p.y + 1.35);
        if (ledge > p.y + 0.3 && !blocked(ahead.x, ahead.z, 0.38, ledge)) {
          p.y = ledge;
          p.x = ahead.x;
          p.z = ahead.z;
          p.jumpVelocity = 0;
        } else p.jumpVelocity = 4.7;
      }
      p.input.jump = false;
      p.jumpVelocity -= 13 * dt;
      p.y = Math.max(floor, p.y + p.jumpVelocity * dt);
      if (p.y === floor) p.jumpVelocity = 0;
      this.move(p, dt);
      const held = this.held.get(p.id) ?? false;
      if (
        p.input.fire &&
        (!held || weapon.automatic || p.bot) &&
        p.fireWait <= 0 &&
        p.reloadTime <= 0 &&
        !p.sprint
      )
        this.fire(p, weapon);
      this.held.set(p.id, p.input.fire);
      if (p.input.melee && p.fireWait <= 0) {
        p.fireWait = 0.55;
        this.melee(p);
      }
      p.input.melee = false;
      if (p.input.lethal && p.lethal > 0) {
        p.lethal--;
        this.throwCharge(p);
      }
      p.input.lethal = false;
      if (p.input.tactical && p.tactical > 0) {
        p.tactical--;
        this.signal(p, p.loadout.tactical === "flash");
      }
      p.input.tactical = false;
      if (p.input.support) this.support(p);
      p.input.support = false;
      if (
        this.time - p.lastDamage > (p.loadout.perk === "patch" ? 4.2 : 5) &&
        p.hp < 100
      )
        p.hp = Math.min(100, p.hp + 22 * dt);
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const g = this.projectiles[i];
      g.fuse -= dt;
      g.vy -= 12 * dt;
      const nx = g.x + g.vx * dt,
        nz = g.z + g.vz * dt;
      if (!blocked(nx, nz, 0.1, g.y)) {
        g.x = nx;
        g.z = nz;
      } else {
        g.vx *= -0.35;
        g.vz *= -0.35;
        if (g.kind === "adhesive") g.vx = g.vz = g.vy = 0;
      }
      g.y += g.vy * dt;
      if (g.y < 0.15) {
        g.y = 0.15;
        g.vy *= -0.3;
        g.vx *= 0.65;
        g.vz *= 0.65;
      }
      if (g.fuse <= 0) {
        this.explode(g);
        this.projectiles.splice(i, 1);
      }
    }
    const limit = this.overtime ? this.overtimeTarget : this.scoreLimit;
    if (Math.max(...this.score) >= limit || this.time >= this.endTime) {
      if (!this.overtime && this.score[0] === this.score[1]) {
        this.overtime = true;
        this.endTime = this.time + 60;
        this.overtimeTarget = this.score[0] + 5;
        this.event("info", "OVERTIME · FIRST TO FIVE");
      } else {
        this.winner =
          this.score[0] === this.score[1]
            ? "draw"
            : this.score[0] > this.score[1]
              ? "atlas"
              : "cobalt";
        this.event(
          "info",
          this.winner === "draw"
            ? "MATCH DRAW"
            : `${this.winner.toUpperCase()} VICTORY`,
        );
      }
    }
  }
  private move(p: Combatant, dt: number) {
    const speed =
        (p.crouch ? 2.8 : p.sprint ? 7.1 : 5.2) *
        (p.ads ? 0.68 : 1) *
        (p.loadout.perk === "fleet" ? 1.08 : 1),
      length = Math.max(1, Math.hypot(p.input.x, p.input.z)),
      sx = p.input.x / length,
      sz = p.input.z / length;
    const tx = (-Math.cos(p.yaw) * sx + Math.sin(p.yaw) * sz) * speed,
      tz = (Math.sin(p.yaw) * sx + Math.cos(p.yaw) * sz) * speed,
      accel = (sx || sz ? 32 : 38) * dt;
    p.vx += clamp(tx - p.vx, -accel, accel);
    p.vz += clamp(tz - p.vz, -accel, accel);
    if (!blocked(p.x + p.vx * dt, p.z, 0.38, p.y)) p.x += p.vx * dt;
    else p.vx = 0;
    if (!blocked(p.x, p.z + p.vz * dt, 0.38, p.y)) p.z += p.vz * dt;
    else p.vz = 0;
    if (Math.hypot(p.x - p.spawnX, p.z - p.spawnZ) > 5) p.protection = 0;
  }
  private fire(p: Combatant, w: (typeof weapons)[WeaponId]) {
    if (p.ammo <= 0) {
      p.fireWait = 0.15;
      return;
    }
    p.ammo--;
    p.shots++;
    p.fireWait = 60 / w.rpm;
    p.lastShot = this.time;
    p.protection = 0;
    const spread =
      w.spread *
      (p.ads ? 0.22 : 1) *
      (p.crouch ? 0.75 : 1) *
      (p.loadout.barrel === "compensator" ? 0.83 : 1);
    let hitAny = false,
      end = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < (w.pellets ?? 1); i++) {
      const yaw = p.yaw + (this.random() - 0.5) * spread * 2,
        pitch = p.pitch + (this.random() - 0.5) * spread * 2,
        dx = Math.sin(yaw) * Math.cos(pitch),
        dz = Math.cos(yaw) * Math.cos(pitch),
        dy = -Math.sin(pitch),
        y = eyeHeight(p);
      let nearest: Combatant | undefined,
        head = false,
        nearestT = wallDistance(p.x, y, p.z, dx, dy, dz, w.range);
      for (const other of this.players.values()) {
        if (!other.alive || other.team === p.team || other.protection > 0)
          continue;
        const ox = other.x - p.x,
          oz = other.z - p.z,
          t = (ox * dx + oz * dz) / (dx * dx + dz * dz);
        if (t <= 0 || t >= nearestT) continue;
        const side = Math.hypot(ox - dx * t, oz - dz * t),
          hitY = y + dy * t - other.y,
          headY = other.crouch ? 1.16 : 1.68,
          isHead = side < 0.25 && Math.abs(hitY - headY) < 0.23;
        if (isHead || (side < 0.37 && hitY > 0.12 && hitY < headY - 0.18)) {
          nearest = other;
          nearestT = t;
          head = isHead;
        }
      }
      if (nearest) {
        const falloff = clamp(
          1 - Math.max(0, nearestT - w.range * 0.55) / (w.range * 1.3),
          0.55,
          1,
        );
        this.damage(
          nearest,
          p,
          Math.round(w.damage * falloff * (head ? 1.65 : 1)),
          w.id,
          head,
        );
        hitAny = true;
      }
      end = {
        x: p.x + dx * nearestT,
        y: y + dy * nearestT,
        z: p.z + dz * nearestT,
      };
    }
    if (hitAny) p.hits++;
    this.event("shot", hitAny ? "HIT" : "", {
      actor: p.id,
      x: p.x,
      y: eyeHeight(p),
      z: p.z,
      endX: end.x,
      endY: end.y,
      endZ: end.z,
      source: w.id,
    });
  }
  private damage(
    v: Combatant,
    a: Combatant,
    value: number,
    source: string,
    head = false,
    support = false,
  ) {
    if (!v.alive || v.protection > 0 || v.team === a.team) return;
    v.hp = Math.max(0, v.hp - value);
    v.lastDamage = this.time;
    v.damageYaw = Math.atan2(a.x - v.x, a.z - v.z);
    const credits = this.credits.get(v.id) ?? new Map<string, number>();
    credits.set(a.id, this.time);
    this.credits.set(v.id, credits);
    this.event("hit", `${value}`, {
      actor: a.id,
      victim: v.id,
      damage: value,
      head,
      x: v.x,
      z: v.z,
      source,
    });
    if (v.hp > 0) return;
    v.alive = false;
    v.respawn = 3;
    v.deaths++;
    v.momentum = 0;
    v.killer = a.name;
    v.killedWith =
      source in weapons
        ? weapons[source as WeaponId].name
        : source.toUpperCase();
    a.kills++;
    if (!support) a.momentum++;
    a.best = Math.max(a.best, a.momentum);
    for (const [id, time] of credits)
      if (id !== a.id && this.time - time < 8) {
        const p = this.players.get(id);
        if (p) p.assists++;
      }
    if (a.loadout.perk === "scavenger") a.reserve += 12;
    this.score[a.team === "atlas" ? 0 : 1]++;
    this.event("kill", `${a.name} › ${v.name}`, {
      actor: a.id,
      victim: v.id,
      x: v.x,
      z: v.z,
      source,
      head,
    });
    if ([3, 5, 8].includes(a.momentum))
      this.event("support", "SUPPORT READY", { actor: a.id });
  }
  private melee(p: Combatant) {
    for (const target of this.players.values())
      if (
        target.team !== p.team &&
        target.alive &&
        dist(p, target) < 2.2 &&
        clearLine(p, target) &&
        Math.cos(Math.atan2(target.x - p.x, target.z - p.z) - p.yaw) > 0.65
      ) {
        this.damage(target, p, 55, "melee");
        break;
      }
  }
  private throwCharge(p: Combatant) {
    p.protection = 0;
    this.projectiles.push({
      id: ++this.eventId,
      actor: p.id,
      x: p.x,
      y: eyeHeight(p),
      z: p.z,
      vx: Math.sin(p.yaw) * 12,
      vy: 4 - Math.sin(p.pitch) * 8,
      vz: Math.cos(p.yaw) * 12,
      fuse: p.loadout.lethal === "adhesive" ? 1.5 : 2,
      kind: p.loadout.lethal,
    });
    this.event("support", "CHARGE OUT", { actor: p.id });
  }
  private explode(g: Projectile) {
    const a = this.players.get(g.actor);
    if (!a) return;
    const radius = g.kind === "adhesive" ? 4.5 : 6;
    this.event("explosion", "CHARGE DETONATED", {
      actor: g.actor,
      x: g.x,
      y: g.y,
      z: g.z,
    });
    for (const p of this.players.values())
      if (
        p.team !== a.team &&
        p.alive &&
        dist(g, p) < radius &&
        clearLine(g, p, Math.max(0.4, g.y))
      )
        this.damage(
          p,
          a,
          Math.round(115 * (1 - dist(g, p) / (radius * 1.2))),
          "charge",
        );
  }
  private signal(p: Combatant, flash = false) {
    for (const t of this.players.values())
      if (t.team !== p.team && t.alive && dist(p, t) < (flash ? 18 : 30)) {
        if (flash && clearLine(p, t))
          t.flash =
            2.3 *
            Math.max(0.2, Math.cos(Math.atan2(p.x - t.x, p.z - t.z) - t.yaw));
        else if (!flash) t.spotted = 6;
      }
    this.event("support", flash ? "FLASH PULSE" : "SIGNAL PULSE", {
      actor: p.id,
      x: p.x,
      z: p.z,
    });
  }
  private support(p: Combatant) {
    const tier =
      p.momentum >= 8 && !p.supports[2]
        ? 2
        : p.momentum >= 5 && !p.supports[1]
          ? 1
          : p.momentum >= 3 && !p.supports[0]
            ? 0
            : -1;
    if (tier < 0) return;
    p.supports[tier] = 1;
    if (tier === 0) {
      this.signal(p);
      this.event("support", "RECON SWEEP ACTIVE", { actor: p.id });
    }
    if (tier === 1) {
      p.lethal++;
      p.tactical++;
      p.reserve += weapons[p.loadout.primary].mag * 3;
      this.event("support", "AMMO POD RECEIVED", { actor: p.id });
    }
    if (tier === 2) {
      for (const e of this.players.values())
        if (e.team !== p.team && e.alive && dist(p, e) < 30 && clearLine(p, e))
          this.damage(e, p, 70, "interdiction", false, true);
      this.event("explosion", "INTERDICTION PASS", {
        actor: p.id,
        x: p.x + Math.sin(p.yaw) * 15,
        y: 2,
        z: p.z + Math.cos(p.yaw) * 15,
      });
    }
  }
  private botInput(p: Combatant, dt: number) {
    const m = this.memories.get(p.id)!,
      w = weapons[p.slot === 0 ? p.loadout.primary : p.loadout.sidearm],
      skill =
        this.difficulty === "easy"
          ? 0.8
          : this.difficulty === "hard"
            ? 1.7
            : 1.15;
    m.replan -= dt;
    m.burst -= dt;
    const visible = [...this.players.values()]
      .filter(
        (e) =>
          e.team !== p.team &&
          e.alive &&
          e.protection <= 0 &&
          dist(p, e) < 45 &&
          (Math.cos(Math.atan2(e.x - p.x, e.z - p.z) - p.yaw) > -0.25 ||
            this.time - p.lastDamage < 1) &&
          clearLine(p, e, Math.min(eyeHeight(p), eyeHeight(e))),
      )
      .sort((a, b) => dist(p, a) - dist(p, b))[0];
    p.input = {
      ...idleInput(),
      yaw: p.yaw,
      pitch: p.pitch,
      reload: p.ammo < 2 || (p.ammo < w.mag * 0.4 && !visible),
    };
    if (visible) {
      if (m.target !== visible.id) {
        m.target = visible.id;
        m.reaction = 0.48 / skill + this.random() * 0.18;
      }
      m.reaction -= dt;
      m.lost = 2;
      m.goal = { x: visible.x, z: visible.z };
      m.path = [];
      const aim = Math.atan2(visible.x - p.x, visible.z - p.z),
        distance = dist(p, visible),
        noise =
          (Math.sin(this.time * 7 + Number(p.id.split("-")[1])) * 0.013) /
          skill;
      p.input.yaw = p.yaw + clamp(delta(aim + noise, p.yaw), -dt * 5, dt * 5);
      p.input.pitch =
        Math.atan2(
          eyeHeight(p) - (visible.y + (visible.crouch ? 0.85 : 1.23)),
          distance,
        ) +
        Math.sin(this.time * 11) * 0.007;
      p.input.ads = distance > 8;
      p.input.z =
        distance > Math.min(w.range * 0.7, 22) ? 0.8 : distance < 6 ? -0.4 : 0;
      p.input.x = m.strafe * 0.45;
      p.input.fire =
        m.reaction <= 0 &&
        p.flash < 0.1 &&
        distance < w.range &&
        Math.abs(delta(aim, p.yaw)) < 0.045 &&
        m.burst > -0.8;
      if (m.burst < -1.1) m.burst = 0.65 + this.random() * 0.65;
      if (
        blocked(
          p.x + Math.cos(p.yaw) * m.strafe,
          p.z - Math.sin(p.yaw) * m.strafe,
          0.6,
        )
      )
        m.strafe *= -1;
      if (
        m.reaction <= 0 &&
        distance > 8 &&
        distance < 17 &&
        p.lethal > 0 &&
        this.random() < dt * 0.05
      )
        p.input.lethal = true;
      if (p.momentum >= 3 && this.random() < dt * 0.2) p.input.support = true;
      return;
    }
    m.target = undefined;
    m.lost -= dt;
    // Interest nodes and last-seen / audible positions, never hidden enemy coordinates.
    const heard = [...this.players.values()].find(
      (e) =>
        e.team !== p.team &&
        e.alive &&
        this.time - e.lastShot < 0.25 &&
        dist(p, e) < 26 &&
        e.loadout.barrel !== "suppressor",
    );
    if (heard && m.replan <= 0) m.goal = { x: heard.x, z: heard.z };
    if (!m.goal || dist(p, m.goal) < 2 || m.stuck > 1.5) {
      m.goal = patrolPoints[Math.floor(this.random() * patrolPoints.length)];
      m.replan = 0;
      m.stuck = 0;
    }
    if (m.replan <= 0) {
      m.path = findPath(p, m.goal);
      m.replan = 1.5 + this.random();
    }
    while (m.path.length && dist(p, m.path[0]) < 0.8) m.path.shift();
    const next = m.path[0];
    if (next) {
      const aim = Math.atan2(next.x - p.x, next.z - p.z);
      p.input.yaw = p.yaw + clamp(delta(aim, p.yaw), -dt * 6, dt * 6);
      p.input.pitch *= 0.8;
      if (Math.abs(delta(aim, p.input.yaw)) < 0.3) p.input.z = 1;
      p.input.sprint = m.lost < 0 && dist(p, next) > 6;
    } else if (m.replan < 1) m.goal = undefined;
    if (dist(p, m.last) < 0.008 && p.input.z > 0) m.stuck += dt;
    else m.stuck = Math.max(0, m.stuck - dt * 2);
    m.last = { x: p.x, z: p.z };
  }
  snapshot(): Snapshot {
    return {
      time: this.time,
      remaining: Math.max(0, this.endTime - this.time),
      score: [...this.score],
      players: [...this.players.values()].map((p) => ({
        ...p,
        loadout: { ...p.loadout },
        supports: [...p.supports],
        input: idleInput(),
      })),
      events: this.events.filter((e) => this.time - e.time < 4),
      projectiles: this.projectiles.map((g) => ({ ...g })),
      winner: this.winner,
      phase: this.winner ? "finished" : "active",
      matchId: this.matchId,
      scoreLimit: this.scoreLimit,
      overtime: this.overtime,
    };
  }
}
