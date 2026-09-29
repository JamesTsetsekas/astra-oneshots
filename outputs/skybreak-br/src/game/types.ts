export interface V2 {
  x: number;
  z: number;
}
export interface V3 extends V2 {
  y: number;
}
export type WeaponId =
  | "rifle"
  | "carbine"
  | "scattergun"
  | "coil"
  | "smg"
  | "dmr"
  | "rail"
  | "pistol"
  | "launcher";
export type ItemId =
  | WeaponId
  | "med"
  | "trauma"
  | "shield"
  | "aegis"
  | "mist"
  | "grapple"
  | "echo"
  | "orb";
export type Ammo = "light" | "shell" | "heavy" | "charge";
export type Rarity = 0 | 1 | 2 | 3 | 4;
export interface Weapon {
  id: WeaponId;
  name: string;
  category: string;
  ammo: Ammo;
  mag: number;
  damage: number;
  rate: number;
  reload: number;
  range: number;
  spread: number;
  pellets: number;
  automatic: boolean;
  color: string;
  description: string;
}
export interface Item {
  id: ItemId;
  rarity: Rarity;
  quantity: number;
  loaded: number;
  uid: number;
}
export interface Actor extends V3 {
  id: number;
  name: string;
  bot: boolean;
  alive: boolean;
  hp: number;
  aegis: number;
  reserve: number;
  yaw: number;
  pitch: number;
  vy: number;
  speed: number;
  stamina: number;
  stance: "stand" | "crouch" | "slide" | "glide" | "fall" | "swim";
  grounded: boolean;
  inventory: (Item | null)[];
  slot: number;
  ammo: Record<Ammo, number>;
  reload: number;
  action: number;
  actionItem?: ItemId;
  cooldown: number;
  lastDamage: number;
  kills: number;
  damage: number;
  shots: number;
  hits: number;
  distance: number;
  stormDamage: number;
  skin: number;
  target?: number;
  goal?: V2;
  think: number;
  reaction: number;
  slide: number;
  lastJump: boolean;
  lastInteract: boolean;
  lastReload: boolean;
  lastUse: boolean;
  lastMelee: boolean;
  lastGlide: boolean;
  healStock: number;
}
export interface Loot extends V3 {
  id: number;
  item: Item;
  active: boolean;
  source: "floor" | "chest" | "cache" | "supply";
  ammo?: Ammo;
  amount?: number;
}
export interface Chest extends V3 {
  id: number;
  opened: boolean;
  kind: "chest" | "locker" | "supply";
}
export interface Building extends V2 {
  id: number;
  width: number;
  depth: number;
  height: number;
  style: "house" | "warehouse" | "ruin" | "tower";
  color: string;
  roof: string;
  rotation: number;
  door: boolean;
}
export interface Obstacle extends V3 {
  width: number;
  depth: number;
  height: number;
  kind: "wall" | "rock" | "building";
}
export interface Landmark extends V2 {
  id: string;
  name: string;
  radius: number;
  style: string;
  color: string;
}
export interface Traversal extends V3 {
  id: number;
  kind: "zipline" | "ascender" | "vent";
  end: V3;
  radius: number;
}
export interface Storm {
  phase: number;
  x: number;
  z: number;
  radius: number;
  nextX: number;
  nextZ: number;
  nextRadius: number;
  remaining: number;
  moving: boolean;
  damage: number;
  progress: number;
}
export interface Options {
  mode: "solo" | "practice";
  seed: number;
  skin: number;
  pace: "quick" | "standard";
}
export interface Settings {
  quality: "low" | "medium" | "high";
  sound: boolean;
  music: boolean;
  sensitivity: number;
  fov: number;
  reducedMotion: boolean;
  colorblind: boolean;
  shadows: boolean;
  invertY: boolean;
  bindings: Record<string, string>;
}
export const DEFAULT_SETTINGS: Settings = {
  quality: "high",
  sound: true,
  music: true,
  sensitivity: 1,
  fov: 90,
  reducedMotion: false,
  colorblind: false,
  shadows: true,
  invertY: false,
  bindings: {
    forward: "KeyW",
    back: "KeyS",
    left: "KeyA",
    right: "KeyD",
    jump: "Space",
    sprint: "ShiftLeft",
    crouch: "ControlLeft",
    interact: "KeyE",
    reload: "KeyR",
    melee: "KeyF",
    glide: "KeyZ",
    shoulder: "KeyX",
  },
};
export interface Input {
  forward: number;
  right: number;
  yaw: number;
  pitch: number;
  fire: boolean;
  ads: boolean;
  sprint: boolean;
  crouch: boolean;
  jump: boolean;
  interact: boolean;
  reload: boolean;
  melee: boolean;
  glide: boolean;
  use: boolean;
  slot?: number;
  drop: boolean;
  aimOrigin?: V3;
  aimDirection?: V3;
}
export const EMPTY_INPUT: Input = {
  forward: 0,
  right: 0,
  yaw: 0,
  pitch: 0,
  fire: false,
  ads: false,
  sprint: false,
  crouch: false,
  jump: false,
  interact: false,
  reload: false,
  melee: false,
  glide: false,
  use: false,
  drop: false,
};
export interface GameEvent {
  id: number;
  time: number;
  type:
    | "shot"
    | "hit"
    | "kill"
    | "pickup"
    | "storm"
    | "heal"
    | "info"
    | "land"
    | "reload";
  text: string;
  actor?: number;
  target?: number;
  position?: V3;
  end?: V3;
  amount?: number;
  head?: boolean;
  shield?: boolean;
}
export interface MatchResult {
  version: 1;
  id: string;
  date: string;
  seed: number;
  mode: Options["mode"];
  place: number;
  winner: string;
  victory: boolean;
  kills: number;
  damage: number;
  accuracy: number;
  survival: number;
  distance: number;
  stormDamage: number;
  loot: number;
  timeline: string[];
}
export interface Snapshot {
  phase: "staging" | "skiff" | "dropping" | "playing" | "ended";
  time: number;
  stageTime: number;
  player: Actor;
  alive: number;
  storm: Storm;
  events: GameEvent[];
  result?: MatchResult;
  nearby?: {
    label: string;
    detail: string;
    kind: "loot" | "chest" | "traversal";
    id: number;
    rarity?: Rarity;
  };
  location: string;
  marker: V2;
  outside: boolean;
  fps: number;
  paused: boolean;
  hitMarker: number;
  damageFlash: number;
}
