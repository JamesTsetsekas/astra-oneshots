import {
  weapons,
  utilities,
  price,
  rulesets,
  sites,
  type WeaponId,
  type Team,
  type Loadout,
  type Utility,
  type Purchase,
  type MatchRules,
} from "./data";
import {
  blocked,
  clearLine,
  findPath,
  wallDistance,
  type Point,
} from "./navigation";
export type Input = {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  fire: boolean;
  ads: boolean;
  walk: boolean;
  crouch: boolean;
  interact: boolean;
  reload?: boolean;
  jump?: boolean;
  swap?: boolean;
  slot?: 0 | 1;
  throw?: Utility;
  drop?: boolean;
  melee?: boolean;
};
export const idleInput = (): Input => ({
  x: 0,
  z: 0,
  yaw: 0,
  pitch: 0,
  fire: false,
  ads: false,
  walk: false,
  crouch: false,
  interact: false,
});
export type Combatant = {
  id: string;
  name: string;
  team: Team;
  bot: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  pitch: number;
  hp: number;
  armor: number;
  helmet: boolean;
  kit: boolean;
  alive: boolean;
  kills: number;
  deaths: number;
  assists: number;
  plants: number;
  defuses: number;
  money: number;
  spent: number;
  shots: number;
  hits: number;
  ammo: number;
  reserve: number;
  sideAmmo: number;
  sideReserve: number;
  burstRemaining: number;
  slot: 0 | 1;
  primary?: WeaponId;
  loadout: Loadout;
  utility: Record<Utility, number>;
  input: Input;
  lastShot: number;
  lastDamage: number;
  damageYaw: number;
  fireWait: number;
  reloadTime: number;
  recoil: number;
  crouch: boolean;
  ads: boolean;
  sprint: boolean;
  flash: number;
  jumpVelocity: number;
  interactProgress: number;
  killer: string;
  killedWith: string;
  carry: boolean;
  hasFired: boolean;
};
export type CombatEvent = {
  id: number;
  kind: "shot" | "hit" | "kill" | "reload" | "support" | "explosion" | "info";
  text: string;
  time: number;
  actor?: string;
  victim?: string;
  x?: number;
  y?: number;
  z?: number;
  endX?: number;
  endY?: number;
  endZ?: number;
  head?: boolean;
  damage?: number;
  source?: string;
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
  kind: Utility;
};
export type Area = {
  id: number;
  kind: "veil" | "thermite" | "pulse";
  x: number;
  z: number;
  radius: number;
  remaining: number;
  actor: string;
  nextPulse: number;
};
export type Objective = {
  state: "carried" | "dropped" | "armed" | "resolved";
  carrier?: string;
  x: number;
  z: number;
  site?: "A" | "B";
  remaining: number;
  progress: number;
  actor?: string;
};
export type RoundRecord = {
  round: number;
  winner: Team;
  reason: string;
  score: [number, number];
  attacker: Team;
  duration: number;
  economy: [number, number];
};
export type Snapshot = {
  time: number;
  round: number;
  phase: "buy" | "action" | "armed" | "end" | "finished";
  remaining: number;
  score: [number, number];
  players: Combatant[];
  events: CombatEvent[];
  projectiles: Projectile[];
  areas: Area[];
  objective: Objective;
  attacker: Team;
  winner?: Team | "draw";
  roundWinner?: Team;
  reason: string;
  history: RoundRecord[];
  rules: MatchRules;
  matchId: string;
  dropped: Array<{
    id: number;
    x: number;
    z: number;
    weapon: WeaponId;
    ammo: number;
    reserve: number;
  }>;
};
export const eyeHeight = (p: Combatant) => p.y + (p.crouch ? 1.15 : 1.68);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)),
  distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z),
  angle = (a: number, b: number) =>
    Math.atan2(Math.sin(a - b), Math.cos(a - b));
type Brain = {
  path: Point[];
  repath: number;
  target?: string;
  reaction: number;
  goal?: Point;
  role: number;
  last: Point;
  stuck: number;
  buy: boolean;
  strafe: number;
};
type Inventory = Pick<
  Combatant,
  | "primary"
  | "loadout"
  | "slot"
  | "ammo"
  | "reserve"
  | "sideAmmo"
  | "sideReserve"
  | "armor"
  | "helmet"
  | "kit"
  | "utility"
>;
export class ProtocolMatch {
  readonly players: Combatant[] = [];
  readonly events: CombatEvent[] = [];
  readonly projectiles: Projectile[] = [];
  readonly areas: Area[] = [];
  readonly history: RoundRecord[] = [];
  readonly dropped: Array<{
    id: number;
    x: number;
    z: number;
    weapon: WeaponId;
    ammo: number;
    reserve: number;
  }> = [];
  readonly rules: MatchRules;
  readonly matchId: string;
  time = 0;
  round = 0;
  phase: Snapshot["phase"] = "buy";
  remaining = 0;
  score: [number, number] = [0, 0];
  attacker: Team = "aurora";
  winner?: Team | "draw";
  roundWinner?: Team;
  reason = "";
  objective: Objective = {
    state: "carried",
    x: 0,
    z: 0,
    remaining: 0,
    progress: 0,
  };
  private seed: number;
  private serial = 0;
  private brains = new Map<string, Brain>();
  private held = new Map<string, boolean>();
  private losses: Record<Team, number> = { aurora: 0, obsidian: 0 };
  private transactions = new Set<string>();
  private receipts = new Map<
    string,
    Array<{ item: Purchase; amount: number; before: Inventory }>
  >();
  private roundStartTime = 0;
  private sitePlan = 0;
  private credits = new Map<string, Map<string, number>>();
  constructor(
    seed = Date.now() >>> 0,
    mode: "standard" | "quick" = "standard",
    readonly difficulty: "easy" | "normal" | "hard" = "normal",
  ) {
    this.seed = seed;
    this.matchId = seed.toString(36);
    this.rules = { ...rulesets[mode] };
    const names = [
      "Arden",
      "Lark",
      "Mira",
      "Hale",
      "Wren",
      "Soren",
      "Koa",
      "Faye",
      "Nell",
      "Ivo",
    ];
    for (let i = 0; i < 10; i++)
      this.players.push(
        this.create(`bot-${i}`, names[i], i < 5 ? "aurora" : "obsidian", i % 5),
      );
    this.nextRound(true);
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
      id: ++this.serial,
      kind,
      text,
      time: this.time,
      ...extra,
    });
    if (this.events.length > 160) this.events.shift();
  }
  private create(
    id: string,
    name: string,
    team: Team,
    role: number,
  ): Combatant {
    this.brains.set(id, {
      path: [],
      repath: 0,
      reaction: 0,
      role,
      last: { x: 0, z: 0 },
      stuck: 0,
      buy: false,
      strafe: role % 2 ? 1 : -1,
    });
    return {
      id,
      name,
      team,
      bot: true,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vz: 0,
      yaw: 0,
      pitch: 0,
      hp: 100,
      armor: 0,
      helmet: false,
      kit: false,
      alive: true,
      kills: 0,
      deaths: 0,
      assists: 0,
      plants: 0,
      defuses: 0,
      money: 800,
      spent: 0,
      shots: 0,
      hits: 0,
      ammo: 15,
      reserve: 75,
      sideAmmo: 15,
      sideReserve: 75,
      burstRemaining: 0,
      slot: 1,
      loadout: {
        primary: "aster",
        sidearm: "vela",
        optic: "iron",
        barrel: "standard",
      },
      utility: { veil: 0, flash: 0, thermite: 0, pulse: 0, frag: 0 },
      input: idleInput(),
      lastShot: -99,
      lastDamage: -99,
      damageYaw: 0,
      fireWait: 0,
      reloadTime: 0,
      recoil: 0,
      crouch: false,
      ads: false,
      sprint: false,
      flash: 0,
      jumpVelocity: 0,
      interactProgress: 0,
      killer: "",
      killedWith: "",
      carry: false,
      hasFired: false,
    };
  }
  addHuman(name = "Operator") {
    const p = this.players.find((p) => p.bot && p.team === "aurora")!;
    const prior = p.id;
    p.id = "local";
    p.name = name.slice(0, 22);
    p.bot = false;
    if (this.objective.carrier === prior) this.objective.carrier = p.id;
    return p;
  }
  isAttacker(p: Combatant) {
    return p.team === this.attacker;
  }
  currentWeapon(p: Combatant) {
    return weapons[p.slot === 0 && p.primary ? p.primary : p.loadout.sidearm];
  }
  setInput(id: string, input: Input) {
    const p = this.players.find((p) => p.id === id);
    if (!p || p.bot) return;
    const b = (k: keyof Input) => input[k] === true;
    p.input = {
      x: clamp(Number(input.x) || 0, -1, 1),
      z: clamp(Number(input.z) || 0, -1, 1),
      yaw: Number.isFinite(input.yaw) ? input.yaw : p.yaw,
      pitch: clamp(Number(input.pitch) || 0, -1.3, 1.3),
      fire: b("fire"),
      ads: b("ads"),
      walk: b("walk"),
      crouch: b("crouch"),
      interact: b("interact"),
      reload: b("reload"),
      jump: b("jump"),
      swap: b("swap"),
      slot: input.slot === 0 || input.slot === 1 ? input.slot : undefined,
      throw: input.throw && input.throw in utilities ? input.throw : undefined,
      drop: b("drop"),
      melee: b("melee"),
    };
  }
  buy(
    id: string,
    item: Purchase,
    transaction: string,
  ): { ok: boolean; reason: string } {
    const key = `${id}:${transaction}`;
    if (this.transactions.has(key))
      return { ok: false, reason: "Transaction already processed" };
    const p = this.players.find((p) => p.id === id);
    if (!p || !p.alive || this.phase !== "buy")
      return { ok: false, reason: "Buy phase only" };
    if (
      ![
        ...Object.keys(weapons),
        ...Object.keys(utilities),
        "vest",
        "helmet",
        "kit",
      ].includes(item)
    )
      return { ok: false, reason: "Unknown equipment" };
    const spawnZ = this.isAttacker(p) ? -40 : 41;
    if (Math.abs(p.z - spawnZ) > 10)
      return { ok: false, reason: "Return to your buy zone" };
    if (item === "kit" && (this.isAttacker(p) || p.kit))
      return { ok: false, reason: "Custodians only / already equipped" };
    if (item === "vest" && p.armor >= 100)
      return { ok: false, reason: "Vest already intact" };
    if (item === "helmet" && p.helmet && p.armor >= 100)
      return { ok: false, reason: "Armor already equipped" };
    if (
      item in utilities &&
      (Object.values(p.utility).reduce((a, b) => a + b, 0) >= 4 ||
        p.utility[item as Utility] >= (item === "flash" ? 2 : 1))
    )
      return { ok: false, reason: "Utility capacity reached" };
    if (item in weapons) {
      const w = weapons[item as WeaponId];
      if (w.role === "Sidearm" && p.loadout.sidearm === item)
        return { ok: false, reason: "Already equipped" };
      if (w.role !== "Sidearm" && p.primary)
        return { ok: false, reason: "Refund or drop the primary first" };
    }
    const cost = price(item);
    if (p.money < cost) return { ok: false, reason: "Insufficient credits" };
    const before: Inventory = {
      primary: p.primary,
      loadout: { ...p.loadout },
      slot: p.slot,
      ammo: p.ammo,
      reserve: p.reserve,
      sideAmmo: p.sideAmmo,
      sideReserve: p.sideReserve,
      armor: p.armor,
      helmet: p.helmet,
      kit: p.kit,
      utility: { ...p.utility },
    };
    this.transactions.add(key);
    p.money -= cost;
    p.spent += cost;
    const receipts = this.receipts.get(id) ?? [];
    receipts.push({ item, amount: cost, before });
    this.receipts.set(id, receipts);
    if (item in weapons) {
      const w = weapons[item as WeaponId];
      if (w.role === "Sidearm") {
        p.loadout.sidearm = w.id;
        if (p.slot === 1) {
          p.ammo = w.mag;
          p.reserve = w.mag * 3;
        } else {
          p.sideAmmo = w.mag;
          p.sideReserve = w.mag * 3;
        }
      } else {
        if (p.slot === 1) {
          p.sideAmmo = p.ammo;
          p.sideReserve = p.reserve;
        }
        p.primary = w.id;
        p.loadout.primary = w.id;
        p.slot = 0;
        p.ammo = w.mag;
        p.reserve = w.mag * 3;
      }
      p.loadout.optic = this.currentWeapon(p).scope ? "2x" : "iron";
    } else if (item in utilities) p.utility[item as Utility]++;
    else if (item === "kit") p.kit = true;
    else {
      p.armor = 100;
      if (item === "helmet") p.helmet = true;
    }
    return { ok: true, reason: "Purchased" };
  }
  refund(id: string): { ok: boolean; reason: string } {
    const p = this.players.find((p) => p.id === id),
      items = this.receipts.get(id);
    if (!p || this.phase !== "buy" || !items?.length || p.hasFired)
      return { ok: false, reason: "Nothing refundable" };
    const item = items.pop()!;
    p.money = Math.min(12000, p.money + item.amount);
    p.spent -= item.amount;
    Object.assign(p, item.before);
    return { ok: true, reason: "Last purchase refunded" };
  }
  dropPrimary(id: string): { ok: boolean; reason: string } {
    const p = this.players.find((p) => p.id === id);
    if (
      !p?.alive ||
      !p.primary ||
      !["buy", "action", "armed"].includes(this.phase)
    )
      return { ok: false, reason: "No primary to drop" };
    if (p.slot === 1) this.swapSlot(p);
    this.dropped.push({
      id: ++this.serial,
      x: p.x + 1,
      z: p.z,
      weapon: p.primary,
      ammo: p.ammo,
      reserve: p.reserve,
    });
    p.primary = undefined;
    p.slot = 1;
    p.ammo = p.sideAmmo;
    p.reserve = p.sideReserve;
    p.reloadTime = 0;
    p.burstRemaining = 0;
    p.loadout.optic = this.currentWeapon(p).scope ? "2x" : "iron";
    this.receipts.delete(id);
    return {
      ok: true,
      reason:
        "Primary dropped. Purchases before this drop are no longer refundable.",
    };
  }
  private swapSlot(p: Combatant) {
    if (!p.primary) return;
    [p.ammo, p.sideAmmo] = [p.sideAmmo, p.ammo];
    [p.reserve, p.sideReserve] = [p.sideReserve, p.reserve];
    p.slot = p.slot === 0 ? 1 : 0;
    p.fireWait = 0.23;
    p.reloadTime = 0;
    p.burstRemaining = 0;
    p.loadout.optic = this.currentWeapon(p).scope ? "2x" : "iron";
  }
  private nextRound(reset = false) {
    this.round++;
    const halftime = this.round === this.rules.half + 1;
    if (halftime) {
      this.attacker = this.attacker === "aurora" ? "obsidian" : "aurora";
      reset = true;
      this.losses = { aurora: 0, obsidian: 0 };
    }
    this.phase = "buy";
    this.remaining = this.rules.buy;
    this.roundStartTime = this.time;
    this.roundWinner = undefined;
    this.reason = halftime ? "HALFTIME · SIDES SWITCHED" : "BUY PHASE";
    this.projectiles.length = 0;
    this.areas.length = 0;
    this.dropped.length = 0;
    this.credits.clear();
    this.receipts.clear();
    this.transactions.clear();
    this.held.clear();
    this.sitePlan = Math.floor(this.random() * 2);
    for (const p of this.players) {
      if (reset) {
        p.money = 800;
        p.primary = undefined;
        p.alive = false;
      }
      if (!p.alive) {
        p.primary = undefined;
        p.loadout.sidearm = "vela";
        p.utility = { veil: 0, flash: 0, thermite: 0, pulse: 0, frag: 0 };
        p.armor = 0;
        p.helmet = false;
        p.kit = false;
        p.slot = 1;
      } else if (p.primary && p.slot === 1) this.swapSlot(p);
      p.ammo = this.currentWeapon(p).mag;
      p.reserve = p.ammo * 3;
      p.sideAmmo = weapons[p.loadout.sidearm].mag;
      p.sideReserve = p.sideAmmo * 3;
      p.burstRemaining = 0;
      p.loadout.primary = p.primary ?? "aster";
      p.loadout.optic = this.currentWeapon(p).scope ? "2x" : "iron";
      const index = this.players.filter((a) => a.team === p.team).indexOf(p),
        attack = this.isAttacker(p);
      Object.assign(p, {
        x: (index - 2) * 3.2,
        z: attack ? -41 : 42,
        y: 0,
        hp: 100,
        alive: true,
        vx: 0,
        vz: 0,
        yaw: attack ? 0 : Math.PI,
        pitch: 0,
        reloadTime: 0,
        fireWait: 0,
        recoil: 0,
        flash: 0,
        lastDamage: -99,
        interactProgress: 0,
        carry: false,
        jumpVelocity: 0,
        hasFired: false,
      });
      p.input = { ...idleInput(), yaw: p.yaw };
      const brain = this.brains.get(p.id);
      if (brain)
        Object.assign(brain, {
          path: [],
          repath: 0,
          target: undefined,
          stuck: 0,
          buy: false,
          goal: undefined,
        });
    }
    const attackers = this.players.filter((p) => this.isAttacker(p)),
      carrier = attackers.find((p) => !p.bot) ?? attackers[0];
    carrier.carry = true;
    this.objective = {
      state: "carried",
      carrier: carrier.id,
      x: carrier.x,
      z: carrier.z,
      remaining: this.rules.armed,
      progress: 0,
    };
    this.event("info", this.reason);
  }
  private finishRound(winner: Team, reason: string) {
    if (this.phase === "end" || this.phase === "finished") return;
    this.roundWinner = winner;
    this.reason = reason;
    this.score[winner === "aurora" ? 0 : 1]++;
    const loser: Team = winner === "aurora" ? "obsidian" : "aurora";
    this.losses[loser]++;
    this.losses[winner] = Math.max(0, this.losses[winner] - 1);
    for (const p of this.players) {
      let reward =
        p.team === winner
          ? 3000
          : Math.min(3100, 1900 + (this.losses[p.team] - 1) * 400);
      if (reason === "TIME EXPIRED" && this.isAttacker(p) && p.alive)
        reward = Math.floor(reward * 0.5);
      if (this.objective.site && this.isAttacker(p)) reward += 600;
      p.money = Math.min(12000, p.money + reward);
      p.input = idleInput();
    }
    this.history.push({
      round: this.round,
      winner,
      reason,
      score: [...this.score],
      attacker: this.attacker,
      duration: this.time - this.roundStartTime,
      economy: [
        this.players
          .filter((p) => p.team === "aurora")
          .reduce((a, p) => a + p.money, 0),
        this.players
          .filter((p) => p.team === "obsidian")
          .reduce((a, p) => a + p.money, 0),
      ],
    });
    const lead = Math.abs(this.score[0] - this.score[1]),
      max = Math.max(...this.score);
    if (
      (max >= this.rules.target && lead >= 2) ||
      this.round >= this.rules.maximum
    ) {
      this.winner =
        this.score[0] === this.score[1]
          ? "draw"
          : this.score[0] > this.score[1]
            ? "aurora"
            : "obsidian";
      this.phase = "finished";
      this.remaining = 0;
      this.event("info", "PROTOCOL COMPLETE");
    } else {
      this.phase = "end";
      this.remaining = 4;
      this.event("info", reason);
    }
  }
  visible(a: Combatant, b: Combatant) {
    if (!clearLine(a, b, Math.min(eyeHeight(a), eyeHeight(b)))) return false;
    for (const area of this.areas)
      if (area.kind === "veil") {
        const dx = b.x - a.x,
          dz = b.z - a.z,
          t = clamp(
            ((area.x - a.x) * dx + (area.z - a.z) * dz) /
              (dx * dx + dz * dz || 1),
            0,
            1,
          );
        if (
          Math.hypot(area.x - a.x - dx * t, area.z - a.z - dz * t) < area.radius
        )
          return false;
      }
    return true;
  }
  step(dt = 1 / 64) {
    if (this.phase === "finished") return;
    dt = clamp(dt, 0, 0.04);
    this.time += dt;
    this.remaining -= dt;
    if (this.phase === "end") {
      if (this.remaining <= 0) this.nextRound();
      return;
    }
    if (this.phase === "buy") {
      for (const p of this.players)
        if (p.bot) {
          const b = this.brains.get(p.id)!;
          if (!b.buy && this.remaining < this.rules.buy - 1) {
            b.buy = true;
            const preferred =
              p.money >= 3650
                ? "krait"
                : p.money >= 3000
                  ? "aster"
                  : p.money >= 1550
                    ? "kite"
                    : undefined;
            if (preferred && !p.primary)
              this.buy(p.id, preferred, `r${this.round}-gun`);
            if (p.money >= 1000)
              this.buy(p.id, "helmet", `r${this.round}-armor`);
            else if (p.money >= 650)
              this.buy(p.id, "vest", `r${this.round}-armor`);
            if (!this.isAttacker(p) && p.money >= 400)
              this.buy(p.id, "kit", `r${this.round}-kit`);
            if (p.money >= 300) this.buy(p.id, "veil", `r${this.round}-veil`);
            if (p.money >= 200) this.buy(p.id, "flash", `r${this.round}-flash`);
          }
        }
      if (this.remaining <= 0) {
        this.phase = "action";
        this.remaining = this.rules.action;
        this.event("info", "CIPHER BREACH · LIVE");
      }
      return;
    }
    for (const p of this.players) {
      if (!p.alive) continue;
      if (p.bot) this.bot(p, dt);
      p.fireWait = Math.max(0, p.fireWait - dt);
      p.flash = Math.max(0, p.flash - dt);
      p.recoil = Math.max(0, p.recoil - dt * 2.6);
      p.yaw = p.input.yaw;
      p.pitch = p.input.pitch;
      p.crouch = p.input.crouch;
      p.ads = p.input.ads && Boolean(this.currentWeapon(p).scope);
      if (
        p.input.swap ||
        (p.input.slot !== undefined && p.input.slot !== p.slot)
      )
        this.swapSlot(p);
      p.input.swap = false;
      p.input.slot = undefined;
      const w = this.currentWeapon(p);
      if (
        p.input.reload &&
        p.reloadTime <= 0 &&
        p.ammo < w.mag &&
        p.reserve > 0
      ) {
        p.reloadTime = w.reload;
        p.burstRemaining = 0;
        this.event("reload", "RELOADING", { actor: p.id });
      }
      p.input.reload = false;
      if (p.reloadTime > 0) {
        p.reloadTime -= dt;
        if (p.reloadTime <= 0) {
          const n = Math.min(w.mag - p.ammo, p.reserve);
          p.ammo += n;
          p.reserve -= n;
        }
      }
      if (p.input.jump && p.y < 0.01) {
        p.jumpVelocity = 4.4;
        p.vx *= 0.65;
        p.vz *= 0.65;
      }
      p.input.jump = false;
      p.jumpVelocity -= 13 * dt;
      p.y = Math.max(0, p.y + p.jumpVelocity * dt);
      if (!p.y) p.jumpVelocity = 0;
      const speed = w.move * (p.crouch ? 0.4 : p.input.walk ? 0.52 : 1),
        length = Math.max(1, Math.hypot(p.input.x, p.input.z)),
        x = p.input.x / length,
        z = p.input.z / length,
        accel = (x || z ? 24 : 30) * dt;
      p.vx += clamp(
        (-Math.cos(p.yaw) * x + Math.sin(p.yaw) * z) * speed - p.vx,
        -accel,
        accel,
      );
      p.vz += clamp(
        (Math.sin(p.yaw) * x + Math.cos(p.yaw) * z) * speed - p.vz,
        -accel,
        accel,
      );
      if (!blocked(p.x + p.vx * dt, p.z)) p.x += p.vx * dt;
      else p.vx = 0;
      if (!blocked(p.x, p.z + p.vz * dt)) p.z += p.vz * dt;
      else p.vz = 0;
      if (p.input.drop) {
        if (p.carry) {
          p.carry = false;
          this.objective = {
            ...this.objective,
            state: "dropped",
            carrier: undefined,
            x: p.x,
            z: p.z,
          };
        } else if (p.slot === 0 && p.primary) this.dropPrimary(p.id);
      }
      p.input.drop = false;
      const interacting = this.interact(p, dt);
      if (!interacting && p.fireWait <= 0 && p.reloadTime <= 0) {
        if (p.burstRemaining > 0) this.fire(p);
        else if (
          p.input.fire &&
          (!this.held.get(p.id) || w.automatic || p.bot)
        ) {
          p.burstRemaining = w.burst ?? 0;
          this.fire(p);
        }
      }
      this.held.set(p.id, p.input.fire);
      if (p.input.throw && p.utility[p.input.throw] > 0 && !interacting) {
        p.utility[p.input.throw]--;
        p.hasFired = true;
        this.projectiles.push({
          id: ++this.serial,
          actor: p.id,
          x: p.x,
          y: eyeHeight(p),
          z: p.z,
          vx: Math.sin(p.yaw) * 11,
          vy: 4 - Math.sin(p.pitch) * 7,
          vz: Math.cos(p.yaw) * 11,
          fuse: 1.5,
          kind: p.input.throw,
        });
      }
      p.input.throw = undefined;
    }
    // Capsule separation prevents a squad collapsing into an overlapping firing stack.
    for (let i = 0; i < this.players.length; i++)
      for (let j = i + 1; j < this.players.length; j++) {
        const a = this.players[i],
          b = this.players[j];
        if (!a.alive || !b.alive || Math.abs(a.y - b.y) > 1.5) continue;
        const dx = b.x - a.x,
          dz = b.z - a.z,
          d = Math.hypot(dx, dz);
        if (d >= 0.72) continue;
        const push = (0.72 - d) * 0.5,
          nx = d > 0.001 ? dx / d : 1,
          nz = d > 0.001 ? dz / d : 0;
        if (!blocked(a.x - nx * push, a.z - nz * push)) {
          a.x -= nx * push;
          a.z -= nz * push;
        }
        if (!blocked(b.x + nx * push, b.z + nz * push)) {
          b.x += nx * push;
          b.z += nz * push;
        }
      }
    this.utilityStep(dt);
    const attackers = this.players.filter((p) => this.isAttacker(p) && p.alive),
      defenders = this.players.filter((p) => !this.isAttacker(p) && p.alive);
    if (this.phase !== "action" && this.phase !== "armed") return;
    if (!defenders.length)
      this.finishRound(this.attacker, "CUSTODIANS ELIMINATED");
    else if (!attackers.length && this.objective.state !== "armed")
      this.finishRound(defenders[0].team, "INTRUSION ELIMINATED");
    else if (this.objective.state === "armed") {
      this.objective.remaining -= dt;
      this.remaining = this.objective.remaining;
      if (this.objective.remaining <= 0) {
        this.objective.state = "resolved";
        this.event("explosion", "CIPHER UPLOAD COMPLETE", {
          x: this.objective.x,
          y: 1,
          z: this.objective.z,
        });
        this.finishRound(this.attacker, "CIPHER UPLOADED");
      }
    } else if (this.remaining <= 0)
      this.finishRound(
        this.attacker === "aurora" ? "obsidian" : "aurora",
        "TIME EXPIRED",
      );
  }
  private interact(p: Combatant, dt: number): boolean {
    if (p.carry) {
      this.objective.x = p.x;
      this.objective.z = p.z;
    }
    if (!p.input.interact || p.y > 0.05 || Math.hypot(p.vx, p.vz) > 0.4) {
      p.interactProgress = 0;
      if (this.objective.actor === p.id) {
        this.objective.progress = 0;
        this.objective.actor = undefined;
      }
      return false;
    }
    if (
      this.objective.state === "dropped" &&
      this.isAttacker(p) &&
      distance(p, this.objective) < 2
    ) {
      p.carry = true;
      this.objective.state = "carried";
      this.objective.carrier = p.id;
      this.event("support", "CIPHER RECOVERED", { actor: p.id });
      return false;
    }
    if (p.carry && this.objective.state === "carried") {
      const site = sites.find((s) => distance(p, s) < s.radius);
      if (!site) return false;
      p.interactProgress += dt;
      this.objective.progress = p.interactProgress / 3.2;
      this.objective.actor = p.id;
      if (p.interactProgress >= 3.2) {
        p.carry = false;
        p.plants++;
        p.money = Math.min(12000, p.money + 300);
        this.objective = {
          state: "armed",
          x: p.x,
          z: p.z,
          site: site.id,
          remaining: this.rules.armed,
          progress: 0,
        };
        this.phase = "armed";
        this.remaining = this.rules.armed;
        p.interactProgress = 0;
        this.event("info", `CIPHER ARMED AT ${site.id}`);
      }
      return true;
    }
    if (
      this.objective.state === "armed" &&
      !this.isAttacker(p) &&
      distance(p, this.objective) < 3 &&
      clearLine(p, this.objective)
    ) {
      if (this.objective.actor && this.objective.actor !== p.id) return false;
      p.interactProgress += dt;
      this.objective.progress = p.interactProgress / (p.kit ? 5 : 8);
      this.objective.actor = p.id;
      if (p.interactProgress >= (p.kit ? 5 : 8)) {
        p.defuses++;
        p.money = Math.min(12000, p.money + 300);
        this.objective.state = "resolved";
        this.finishRound(p.team, "CIPHER DISARMED");
      }
      return true;
    }
    const drop = this.dropped.find((d) => distance(p, d) < 2);
    if (drop) {
      if (p.primary)
        this.dropped.push({
          id: ++this.serial,
          x: p.x + 1,
          z: p.z,
          weapon: p.primary,
          ammo: p.slot === 0 ? p.ammo : p.sideAmmo,
          reserve: p.slot === 0 ? p.reserve : p.sideReserve,
        });
      p.primary = drop.weapon;
      p.loadout.primary = drop.weapon;
      if (p.slot === 1) {
        p.sideAmmo = p.ammo;
        p.sideReserve = p.reserve;
      }
      p.ammo = drop.ammo;
      p.slot = 0;
      p.reserve = drop.reserve;
      p.loadout.optic = weapons[drop.weapon].scope ? "2x" : "iron";
      this.dropped.splice(this.dropped.indexOf(drop), 1);
    }
    return false;
  }
  private fire(p: Combatant) {
    const w = this.currentWeapon(p);
    if (p.ammo <= 0) {
      p.fireWait = 0.15;
      p.burstRemaining = 0;
      return;
    }
    p.ammo--;
    p.shots++;
    p.hasFired = true;
    p.lastShot = this.time;
    p.burstRemaining = Math.max(0, p.burstRemaining - 1);
    p.fireWait = p.burstRemaining > 0 ? 0.075 : 60 / w.rpm;
    const movement = Math.hypot(p.vx, p.vz),
      spread =
        w.spread * (p.crouch ? 0.8 : 1) +
        (movement > 0.45 ? movement * 0.014 : 0) +
        (p.y > 0.05 ? 0.12 : 0) +
        p.recoil * 0.002;
    const recoilPitch = w.automatic ? p.recoil * 0.0025 : 0,
      recoilYaw = Math.sin(p.recoil * 1.17) * p.recoil * 0.0006;
    p.recoil = Math.min(12, p.recoil + 1);
    let hit = false,
      end = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < (w.pellets ?? 1); i++) {
      const yaw = p.yaw + recoilYaw + (this.random() - 0.5) * spread * 2,
        pitch = p.pitch - recoilPitch + (this.random() - 0.5) * spread * 2,
        dx = Math.sin(yaw) * Math.cos(pitch),
        dz = Math.cos(yaw) * Math.cos(pitch),
        dy = -Math.sin(pitch),
        origin = eyeHeight(p);
      let t = wallDistance(p.x, origin, p.z, dx, dy, dz, w.range),
        target: Combatant | undefined,
        head = false;
      for (const e of this.players) {
        if (e.team === p.team || !e.alive) continue;
        const ox = e.x - p.x,
          oz = e.z - p.z,
          d = (ox * dx + oz * dz) / (dx * dx + dz * dz);
        if (d <= 0 || d >= t) continue;
        const side = Math.hypot(ox - dx * d, oz - dz * d),
          height = origin + dy * d - e.y,
          headY = e.crouch ? 1.16 : 1.68,
          headHit = side < 0.24 && Math.abs(height - headY) < 0.22;
        if (headHit || (side < 0.35 && height > 0.1 && height < headY - 0.18)) {
          target = e;
          t = d;
          head = headHit;
        }
      }
      if (target) {
        let damage =
          w.damage *
          (head ? 3.6 : 1) *
          clamp(1 - Math.max(0, t - w.range * 0.65) / (w.range * 1.8), 0.65, 1);
        if (target.armor > 0 && (!head || target.helmet)) {
          const absorbed = Math.min(
            target.armor,
            damage * (1 - w.penetration) * 0.7,
          );
          target.armor = Math.max(0, target.armor - absorbed);
          damage -= absorbed;
        }
        this.damage(target, p, Math.round(damage), w.id, head);
        hit = true;
      }
      end = { x: p.x + dx * t, y: origin + dy * t, z: p.z + dz * t };
    }
    if (hit) p.hits++;
    this.event("shot", hit ? "HIT" : "", {
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
  ) {
    if (
      !v.alive ||
      v.team === a.team ||
      this.phase === "end" ||
      this.phase === "finished"
    )
      return;
    v.hp = Math.max(0, v.hp - value);
    v.lastDamage = this.time;
    v.damageYaw = Math.atan2(a.x - v.x, a.z - v.z);
    const credits = this.credits.get(v.id) ?? new Map<string, number>();
    credits.set(a.id, this.time);
    this.credits.set(v.id, credits);
    this.event("hit", String(value), {
      actor: a.id,
      victim: v.id,
      damage: value,
      head,
      x: v.x,
      z: v.z,
    });
    if (v.hp > 0) return;
    v.alive = false;
    v.deaths++;
    v.killer = a.name;
    v.killedWith =
      source in weapons
        ? weapons[source as WeaponId].name
        : source.toUpperCase();
    a.kills++;
    a.money = Math.min(12000, a.money + 300);
    v.interactProgress = 0;
    if (this.objective.actor === v.id) {
      this.objective.actor = undefined;
      this.objective.progress = 0;
    }
    if (v.carry) {
      v.carry = false;
      this.objective = {
        ...this.objective,
        state: "dropped",
        carrier: undefined,
        x: v.x,
        z: v.z,
        progress: 0,
      };
    }
    if (v.primary)
      this.dropped.push({
        id: ++this.serial,
        x: v.x,
        z: v.z,
        weapon: v.primary,
        ammo: v.slot === 0 ? v.ammo : v.sideAmmo,
        reserve: v.slot === 0 ? v.reserve : v.sideReserve,
      });
    for (const [id, t] of credits)
      if (id !== a.id && this.time - t < 8) {
        const p = this.players.find((p) => p.id === id);
        if (p) p.assists++;
      }
    this.event("kill", `${a.name} › ${v.name}`, {
      actor: a.id,
      victim: v.id,
      head,
      source,
      x: v.x,
      z: v.z,
    });
  }
  private utilityStep(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const g = this.projectiles[i];
      g.fuse -= dt;
      g.vy -= 12 * dt;
      const nx = g.x + g.vx * dt,
        nz = g.z + g.vz * dt;
      if (!blocked(nx, nz, 0.13, g.y)) {
        g.x = nx;
        g.z = nz;
      } else {
        g.vx *= -0.4;
        g.vz *= -0.4;
      }
      g.y += g.vy * dt;
      if (g.y < 0.14) {
        g.y = 0.14;
        g.vy *= -0.3;
        g.vx *= 0.6;
        g.vz *= 0.6;
      }
      if (g.fuse > 0) continue;
      this.projectiles.splice(i, 1);
      const actor = this.players.find((p) => p.id === g.actor);
      if (!actor) continue;
      if (g.kind === "veil" || g.kind === "thermite" || g.kind === "pulse") {
        if (
          g.kind === "veil" &&
          this.areas.filter((a) => a.kind === "veil").length >= 4
        )
          this.areas.splice(
            this.areas.findIndex((a) => a.kind === "veil"),
            1,
          );
        this.areas.push({
          id: g.id,
          kind: g.kind,
          x: g.x,
          z: g.z,
          radius: g.kind === "veil" ? 4.2 : g.kind === "thermite" ? 3.5 : 12,
          remaining: g.kind === "veil" ? 17 : g.kind === "thermite" ? 7 : 5,
          actor: g.actor,
          nextPulse: 0,
        });
        this.event(
          "support",
          g.kind === "veil"
            ? "VEIL DEPLOYED"
            : g.kind === "thermite"
              ? "THERMITE ACTIVE"
              : "PULSE SHARD ACTIVE",
          { actor: g.actor, x: g.x, z: g.z },
        );
      } else if (g.kind === "flash") {
        for (const p of this.players)
          if (
            p.team !== actor.team &&
            p.alive &&
            distance(g, p) < 20 &&
            clearLine(g, p)
          ) {
            p.flash =
              2.5 *
              Math.max(
                0.15,
                Math.cos(Math.atan2(g.x - p.x, g.z - p.z) - p.yaw),
              );
          }
        this.event("support", "ARC FLASH", { actor: g.actor, x: g.x, z: g.z });
      } else {
        this.event("explosion", "FRAGMENT CHARGE", {
          actor: g.actor,
          x: g.x,
          y: g.y,
          z: g.z,
        });
        for (const p of this.players)
          if (
            p.team !== actor.team &&
            p.alive &&
            distance(g, p) < 6 &&
            clearLine(g, p, 0.8)
          )
            this.damage(
              p,
              actor,
              Math.round(110 * (1 - distance(g, p) / 7.2)),
              "fragment",
            );
      }
    }
    for (let i = this.areas.length - 1; i >= 0; i--) {
      const a = this.areas[i];
      a.remaining -= dt;
      const owner = this.players.find((p) => p.id === a.actor)!;
      if (a.kind === "thermite") {
        for (const p of this.players)
          if (
            p.alive &&
            p.team !== owner.team &&
            distance(a, p) < a.radius &&
            clearLine(a, p, 0.6)
          )
            this.damage(p, owner, 22 * dt, "thermite");
      }
      if (a.kind === "pulse") {
        a.nextPulse -= dt;
        if (a.nextPulse <= 0) {
          a.nextPulse = 2.5;
          const count = this.players.filter(
            (p) =>
              p.alive &&
              p.team !== owner.team &&
              distance(a, p) < a.radius &&
              Math.hypot(p.vx, p.vz) > 0.5,
          ).length;
          this.event(
            "support",
            count ? "MOVEMENT NEAR PULSE SHARD" : "PULSE AREA QUIET",
            { actor: a.actor },
          );
        }
      }
      if (a.remaining <= 0) this.areas.splice(i, 1);
    }
  }
  private bot(p: Combatant, dt: number) {
    const b = this.brains.get(p.id)!;
    b.repath -= dt;
    const w = this.currentWeapon(p),
      skill =
        this.difficulty === "easy"
          ? 0.72
          : this.difficulty === "hard"
            ? 1.5
            : 1;
    const seen = this.players
      .filter(
        (e) =>
          e.team !== p.team &&
          e.alive &&
          distance(p, e) < 48 &&
          (Math.cos(Math.atan2(e.x - p.x, e.z - p.z) - p.yaw) > -0.25 ||
            this.time - p.lastDamage < 1) &&
          this.visible(p, e),
      )
      .sort((a, c) => distance(p, a) - distance(p, c))[0];
    p.input = {
      ...idleInput(),
      yaw: p.yaw,
      pitch: p.pitch,
      reload: p.ammo < 2 || (!seen && p.ammo < w.mag * 0.35),
    };
    if (
      this.objective.state === "armed" &&
      !this.isAttacker(p) &&
      distance(p, this.objective) < 2.6 &&
      (!seen || distance(p, seen) > 10)
    ) {
      p.input.interact = true;
      return;
    }
    if (
      p.carry &&
      sites.some((s) => distance(p, s) < s.radius - 1) &&
      (!seen || distance(p, seen) > 8)
    ) {
      p.input.interact = true;
      return;
    }
    if (seen) {
      if (b.target !== seen.id) {
        b.target = seen.id;
        // A prepared defender holding an angle acquires a visible target sooner.
        b.reaction =
          (this.isAttacker(p) ? 0.43 : 0.3) / skill + this.random() * 0.2;
      }
      b.reaction -= dt;
      const desired = Math.atan2(seen.x - p.x, seen.z - p.z);
      p.input.yaw =
        p.yaw +
        clamp(
          angle(
            desired + (Math.sin(this.time * 9 + b.role) * 0.008) / skill,
            p.yaw,
          ),
          -dt * 6,
          dt * 6,
        );
      p.input.pitch = Math.atan2(
        eyeHeight(p) - (seen.y + (seen.crouch ? 0.9 : 1.25)),
        distance(p, seen),
      );
      p.input.ads = Boolean(w.scope);
      p.input.fire =
        b.reaction <= 0 &&
        p.flash < 0.1 &&
        Math.abs(angle(desired, p.yaw)) < 0.045 &&
        distance(p, seen) < w.range &&
        Math.hypot(p.vx, p.vz) < 0.7;
      if (distance(p, seen) > w.range * 0.85) p.input.z = 0.45;
      if (
        b.reaction < -1 &&
        p.utility.flash &&
        distance(p, seen) < 17 &&
        this.random() < dt * 0.06
      )
        p.input.throw = "flash";
      return;
    }
    b.target = undefined;
    let goal: Point;
    if (this.objective.state === "armed") {
      if (this.isAttacker(p)) {
        const offsets = [
            [-6, -4],
            [5, -5],
            [-5, 5],
            [5, 5],
            [0, -7],
          ],
          offset = offsets[b.role];
        goal = {
          x: this.objective.x + offset[0],
          z: this.objective.z + offset[1],
        };
      } else goal = { x: this.objective.x, z: this.objective.z };
    } else if (this.isAttacker(p)) {
      if (this.objective.state === "dropped") {
        goal = { x: this.objective.x, z: this.objective.z };
        if (distance(p, goal) < 1.8) {
          p.input.interact = true;
          return;
        }
      } else {
        const site =
            sites[b.role === 4 && !p.carry ? 1 - this.sitePlan : this.sitePlan],
          offset = p.carry ? 0 : (b.role - 2) * 1.3;
        goal = {
          x: site.x + offset,
          z: site.z + (p.carry ? 0 : b.role % 2 ? 3 : -3),
        };
      }
    } else {
      const index = b.role < 2 ? 0 : 1,
        site = sites[index];
      goal = {
        x: site.x + (b.role % 2 ? -7 : 6),
        z: site.z + (b.role % 2 ? 6 : -5),
      };
      if (b.role === 4) goal = { x: 0, z: 22 };
      // A visible teammate contact is legal radio knowledge; rotate immediately rather than waiting for half the clock.
      const alert = this.players.find(
        (enemy) =>
          enemy.team !== p.team &&
          enemy.alive &&
          this.players.some(
            (ally) =>
              ally.team === p.team &&
              ally.alive &&
              distance(ally, enemy) < 38 &&
              Math.cos(
                Math.atan2(enemy.x - ally.x, enemy.z - ally.z) - ally.yaw,
              ) > 0 &&
              this.visible(ally, enemy),
          ),
      );
      if (alert && distance(p, alert) > 22) {
        const target =
          sites[
            Math.abs(alert.x - sites[0].x) < Math.abs(alert.x - sites[1].x)
              ? 0
              : 1
          ];
        goal = { x: target.x + (b.role % 2 ? 5 : -5), z: target.z + 6 };
      }
    }
    if (distance(p, goal) < 1.4) {
      if (!this.isAttacker(p) || this.objective.state === "armed") {
        const facing = this.isAttacker(p) ? Math.PI : Math.PI;
        p.input.yaw = p.yaw + clamp(angle(facing, p.yaw), -dt * 2, dt * 2);
      }
      return;
    }
    if (b.repath <= 0 || !b.goal || distance(b.goal, goal) > 3 || b.stuck > 1) {
      b.path = findPath(p, goal);
      b.goal = goal;
      b.repath = 1.1 + this.random() * 0.6;
      b.stuck = 0;
    }
    while (b.path.length && distance(p, b.path[0]) < 0.7) b.path.shift();
    const next = b.path[0];
    if (next) {
      const desired = Math.atan2(next.x - p.x, next.z - p.z);
      p.input.yaw = p.yaw + clamp(angle(desired, p.yaw), -dt * 6, dt * 6);
      p.input.pitch *= 0.8;
      if (Math.abs(angle(desired, p.input.yaw)) < 0.3) p.input.z = 1;
    }
    if (
      p.utility.veil &&
      this.isAttacker(p) &&
      distance(p, goal) < 13 &&
      distance(p, goal) > 8 &&
      this.random() < dt * 0.07
    )
      p.input.throw = "veil";
    if (distance(p, b.last) < 0.006 && p.input.z) b.stuck += dt;
    b.last = { x: p.x, z: p.z };
  }
  snapshot(): Snapshot {
    return {
      time: this.time,
      round: this.round,
      phase: this.phase,
      remaining: Math.max(0, this.remaining),
      score: [...this.score],
      players: this.players.map((p) => ({
        ...p,
        input: idleInput(),
        loadout: { ...p.loadout },
        utility: { ...p.utility },
      })),
      events: this.events.filter((e) => this.time - e.time < 5),
      projectiles: this.projectiles.map((g) => ({ ...g })),
      areas: this.areas.map((a) => ({ ...a })),
      objective: { ...this.objective },
      attacker: this.attacker,
      winner: this.winner,
      roundWinner: this.roundWinner,
      reason: this.reason,
      history: this.history.map((h) => ({
        ...h,
        score: [...h.score],
        economy: [...h.economy],
      })),
      rules: { ...this.rules },
      matchId: this.matchId,
      dropped: this.dropped.map((d) => ({ ...d })),
    };
  }
}
