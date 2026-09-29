export type Team = "aurora" | "obsidian";
export type WeaponId =
  | "vela"
  | "rook"
  | "needle"
  | "kite"
  | "vectora"
  | "aster"
  | "krait"
  | "lumen"
  | "longglass"
  | "sable"
  | "rampart"
  | "atlas";
export type Weapon = {
  id: WeaponId;
  name: string;
  role: string;
  price: number;
  damage: number;
  range: number;
  rpm: number;
  mag: number;
  reload: number;
  spread: number;
  automatic: boolean;
  burst?: number;
  pellets?: number;
  move: number;
  penetration: number;
  scope?: boolean;
};
export const weapons: Record<WeaponId, Weapon> = {
  vela: {
    id: "vela",
    name: "P-5 Vela",
    role: "Sidearm",
    price: 300,
    damage: 29,
    range: 38,
    rpm: 360,
    mag: 15,
    reload: 1.6,
    spread: 0.012,
    automatic: false,
    move: 5.2,
    penetration: 0.45,
  },
  rook: {
    id: "rook",
    name: "Rook .44",
    role: "Sidearm",
    price: 700,
    damage: 55,
    range: 52,
    rpm: 180,
    mag: 6,
    reload: 2.2,
    spread: 0.008,
    automatic: false,
    move: 5.2,
    penetration: 0.72,
  },
  needle: {
    id: "needle",
    name: "Needle-9",
    role: "Sidearm",
    price: 900,
    damage: 20,
    range: 24,
    rpm: 840,
    mag: 20,
    reload: 1.9,
    spread: 0.023,
    automatic: true,
    move: 5.2,
    penetration: 0.4,
  },
  kite: {
    id: "kite",
    name: "Kite-9",
    role: "SMG",
    price: 1250,
    damage: 25,
    range: 35,
    rpm: 780,
    mag: 30,
    reload: 2.0,
    spread: 0.02,
    automatic: true,
    move: 5,
    penetration: 0.42,
  },
  vectora: {
    id: "vectora",
    name: "Vectora-7",
    role: "SMG",
    price: 1700,
    damage: 24,
    range: 36,
    rpm: 930,
    mag: 28,
    reload: 2.25,
    spread: 0.021,
    automatic: true,
    move: 5,
    penetration: 0.5,
  },
  aster: {
    id: "aster",
    name: "Aster 4",
    role: "Rifle",
    price: 2650,
    damage: 34,
    range: 75,
    rpm: 660,
    mag: 30,
    reload: 2.5,
    spread: 0.006,
    automatic: true,
    move: 4.7,
    penetration: 0.75,
  },
  krait: {
    id: "krait",
    name: "Krait 7",
    role: "Rifle",
    price: 2900,
    damage: 39,
    range: 80,
    rpm: 540,
    mag: 25,
    reload: 2.7,
    spread: 0.009,
    automatic: true,
    move: 4.7,
    penetration: 0.9,
  },
  lumen: {
    id: "lumen",
    name: "Lumen Burst",
    role: "Rifle",
    price: 2350,
    damage: 32,
    range: 70,
    rpm: 300,
    mag: 24,
    reload: 2.3,
    spread: 0.005,
    automatic: false,
    burst: 3,
    move: 4.7,
    penetration: 0.7,
  },
  longglass: {
    id: "longglass",
    name: "Longglass M2",
    role: "Precision",
    price: 4650,
    damage: 112,
    range: 115,
    rpm: 44,
    mag: 5,
    reload: 3.3,
    spread: 0.0015,
    automatic: false,
    move: 4.3,
    penetration: 0.95,
    scope: true,
  },
  sable: {
    id: "sable",
    name: "Sable DMR",
    role: "Precision",
    price: 3100,
    damage: 63,
    range: 90,
    rpm: 220,
    mag: 16,
    reload: 2.8,
    spread: 0.004,
    automatic: false,
    move: 4.3,
    penetration: 0.8,
    scope: true,
  },
  rampart: {
    id: "rampart",
    name: "Rampart 12",
    role: "Heavy",
    price: 1900,
    damage: 15,
    range: 22,
    rpm: 85,
    mag: 8,
    reload: 3.1,
    spread: 0.095,
    automatic: false,
    move: 4.3,
    penetration: 0.4,
    pellets: 8,
  },
  atlas: {
    id: "atlas",
    name: "Atlas LMG",
    role: "Heavy",
    price: 3800,
    damage: 32,
    range: 68,
    rpm: 600,
    mag: 70,
    reload: 4.8,
    spread: 0.024,
    automatic: true,
    move: 4.3,
    penetration: 0.8,
  },
};
export type Utility = "veil" | "flash" | "thermite" | "pulse" | "frag";
export const utilities: Record<
  Utility,
  { name: string; price: number; description: string }
> = {
  veil: {
    name: "Veil Canister",
    price: 300,
    description: "Opaque smoke / 17 seconds",
  },
  flash: {
    name: "Arc Flash",
    price: 200,
    description: "Line-of-sight disorientation",
  },
  thermite: {
    name: "Thermite Vial",
    price: 450,
    description: "Area denial / 7 seconds",
  },
  pulse: {
    name: "Pulse Shard",
    price: 350,
    description: "Two coarse motion cues",
  },
  frag: {
    name: "Fragment Charge",
    price: 300,
    description: "Cover-aware blast damage",
  },
};
export type Purchase = WeaponId | Utility | "vest" | "helmet" | "kit";
export type Loadout = {
  primary: WeaponId;
  sidearm: WeaponId;
  optic: "iron" | "2x";
  barrel: "standard";
};
export const TEAM_NAMES: Record<Team, string> = {
  aurora: "AURORA",
  obsidian: "OBSIDIAN",
};
export type Cover = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  kind?: "wall" | "crate" | "barrier" | "container";
  penetrable?: boolean;
};
export const MAP_HALF_X = 57.5,
  MAP_HALF_Z = 47.5;
export const sites = [
  { id: "A", name: "TURBINE", x: -31, z: 15, radius: 5.5 },
  { id: "B", name: "GARDEN", x: 31, z: 15, radius: 5.5 },
] as const;
export const cover: Cover[] = [
  // Turbine hall, with south staging, east connector and north retake portal.
  { x: -44, z: 11, w: 1, d: 32, h: 7, kind: "wall" },
  { x: -18, z: 1, w: 1, d: 12, h: 7, kind: "wall" },
  { x: -18, z: 24, w: 1, d: 7, h: 7, kind: "wall" },
  { x: -40, z: -5, w: 9, d: 1, h: 7, kind: "wall" },
  { x: -20, z: -5, w: 5, d: 1, h: 7, kind: "wall" },
  { x: -40, z: 27, w: 9, d: 1, h: 7, kind: "wall" },
  { x: -20, z: 27, w: 5, d: 1, h: 7, kind: "wall" },
  { x: -37, z: 17, w: 3, d: 3, h: 2.7, kind: "container" },
  { x: -27, z: 6, w: 5, d: 1.2, h: 1.1, kind: "barrier" },
  { x: -29, z: 22, w: 4, d: 1, h: 1.1, kind: "barrier" },
  // Hydroponics lab has a diagonal arrangement of planters and a glass corridor.
  { x: 44, z: 11, w: 1, d: 32, h: 4.2, kind: "wall" },
  { x: 18, z: 0, w: 1, d: 10, h: 4.2, kind: "wall" },
  { x: 18, z: 24, w: 1, d: 7, h: 4.2, kind: "wall" },
  { x: 21, z: -5, w: 7, d: 1, h: 4.2, kind: "wall" },
  { x: 41, z: -5, w: 7, d: 1, h: 4.2, kind: "wall" },
  { x: 21, z: 27, w: 7, d: 1, h: 4.2, kind: "wall" },
  { x: 41, z: 27, w: 7, d: 1, h: 4.2, kind: "wall" },
  { x: 24, z: 12, w: 3, d: 6, h: 1.1, kind: "barrier" },
  { x: 37, z: 18, w: 3, d: 6, h: 1.1, kind: "barrier" },
  { x: 34, z: 3, w: 4, d: 2, h: 1.1, kind: "barrier" },
  // Mid calibration / staging / sight blockers. No spawn-to-spawn lane.
  { x: 0, z: -1, w: 9, d: 8, h: 3, kind: "container" },
  { x: -9, z: 17, w: 5, d: 2, h: 1.25, kind: "barrier" },
  { x: 9, z: 13, w: 5, d: 2, h: 1.25, kind: "barrier" },
  { x: -17, z: -24, w: 11, d: 3, h: 2.5, kind: "crate" },
  { x: 17, z: -24, w: 11, d: 3, h: 2.5, kind: "crate" },
  { x: 0, z: -31, w: 5, d: 3, h: 2.5, kind: "crate" },
  { x: -16, z: 35, w: 9, d: 3, h: 2.5, kind: "crate" },
  { x: 16, z: 35, w: 9, d: 3, h: 2.5, kind: "crate" },
  { x: 0, z: 30, w: 5, d: 3, h: 2.5, kind: "crate" },
  { x: -49, z: -19, w: 4, d: 5, h: 1.4, kind: "barrier" },
  { x: 49, z: -19, w: 4, d: 5, h: 1.4, kind: "barrier" },
];
export type MatchRules = {
  name: string;
  buy: number;
  action: number;
  armed: number;
  target: number;
  half: number;
  maximum: number;
};
export const rulesets: Record<"standard" | "quick", MatchRules> = {
  standard: {
    name: "Full Protocol",
    buy: 20,
    action: 105,
    armed: 35,
    target: 9,
    half: 8,
    maximum: 20,
  },
  quick: {
    name: "Rapid Practice",
    buy: 8,
    action: 60,
    armed: 25,
    target: 5,
    half: 4,
    maximum: 10,
  },
};
export const price = (id: Purchase) =>
  id in weapons
    ? weapons[id as WeaponId].price
    : id in utilities
      ? utilities[id as Utility].price
      : id === "vest"
        ? 650
        : id === "helmet"
          ? 1000
          : 400;
export const locationAt = (x: number, z: number) =>
  z < -27
    ? "FREIGHT"
    : z > 32
      ? "ATRIUM"
      : x < -18
        ? "TURBINE"
        : x > 18
          ? "GARDEN"
          : z < -8
            ? "STAGING"
            : "CALIBRATION";
