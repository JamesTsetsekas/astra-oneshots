export type Team = "atlas" | "cobalt";
export type WeaponId =
  | "jackal"
  | "kestrel"
  | "mesa"
  | "breacher"
  | "anchor"
  | "warden"
  | "relay"
  | "rook"
  | "cinder";
export type Weapon = {
  id: WeaponId;
  name: string;
  role: string;
  damage: number;
  range: number;
  rpm: number;
  mag: number;
  reload: number;
  spread: number;
  pellets?: number;
  automatic: boolean;
};
export const weapons: Record<WeaponId, Weapon> = {
  jackal: {
    id: "jackal",
    name: "AR-4 Jackal",
    role: "Balanced rifle",
    damage: 28,
    range: 48,
    rpm: 720,
    mag: 30,
    reload: 2.1,
    spread: 0.018,
    automatic: true,
  },
  kestrel: {
    id: "kestrel",
    name: "M7 Kestrel",
    role: "Compact automatic",
    damage: 23,
    range: 29,
    rpm: 900,
    mag: 32,
    reload: 1.9,
    spread: 0.027,
    automatic: true,
  },
  mesa: {
    id: "mesa",
    name: "BR-12 Mesa",
    role: "Battle rifle",
    damage: 48,
    range: 65,
    rpm: 360,
    mag: 18,
    reload: 2.4,
    spread: 0.012,
    automatic: false,
  },
  breacher: {
    id: "breacher",
    name: "SG-8 Breacher",
    role: "Pump shotgun",
    damage: 14,
    range: 17,
    rpm: 90,
    mag: 8,
    reload: 3.1,
    spread: 0.12,
    pellets: 8,
    automatic: false,
  },
  anchor: {
    id: "anchor",
    name: "LMG-60 Anchor",
    role: "Support weapon",
    damage: 26,
    range: 51,
    rpm: 660,
    mag: 60,
    reload: 4.4,
    spread: 0.033,
    automatic: true,
  },
  warden: {
    id: "warden",
    name: "MR-1 Warden",
    role: "Marksman rifle",
    damage: 82,
    range: 90,
    rpm: 55,
    mag: 6,
    reload: 3.0,
    spread: 0.006,
    automatic: false,
  },
  relay: {
    id: "relay",
    name: "P9 Relay",
    role: "Sidearm",
    damage: 27,
    range: 26,
    rpm: 420,
    mag: 15,
    reload: 1.35,
    spread: 0.025,
    automatic: false,
  },
  rook: {
    id: "rook",
    name: "H3 Rook",
    role: "Heavy sidearm",
    damage: 39,
    range: 34,
    rpm: 280,
    mag: 8,
    reload: 1.6,
    spread: 0.019,
    automatic: false,
  },
  cinder: {
    id: "cinder",
    name: "Cinder Auto",
    role: "Machine sidearm",
    damage: 18,
    range: 19,
    rpm: 840,
    mag: 20,
    reload: 1.6,
    spread: 0.04,
    automatic: true,
  },
};
export type Loadout = {
  name: string;
  primary: WeaponId;
  sidearm: WeaponId;
  optic: "reflex" | "2x" | "iron";
  barrel: "standard" | "suppressor" | "compensator";
  perk: "fleet" | "patch" | "scavenger";
  lethal: "frag" | "adhesive";
  tactical: "flash" | "signal";
};
export const defaultLoadouts: Loadout[] = [
  {
    name: "Vanguard",
    primary: "jackal",
    sidearm: "relay",
    optic: "reflex",
    barrel: "standard",
    perk: "patch",
    lethal: "frag",
    tactical: "flash",
  },
  {
    name: "Runner",
    primary: "kestrel",
    sidearm: "cinder",
    optic: "iron",
    barrel: "suppressor",
    perk: "fleet",
    lethal: "adhesive",
    tactical: "signal",
  },
  {
    name: "Sentinel",
    primary: "mesa",
    sidearm: "rook",
    optic: "2x",
    barrel: "compensator",
    perk: "scavenger",
    lethal: "frag",
    tactical: "signal",
  },
  {
    name: "Breach",
    primary: "breacher",
    sidearm: "relay",
    optic: "iron",
    barrel: "standard",
    perk: "fleet",
    lethal: "adhesive",
    tactical: "flash",
  },
  {
    name: "Overwatch",
    primary: "warden",
    sidearm: "rook",
    optic: "2x",
    barrel: "standard",
    perk: "patch",
    lethal: "frag",
    tactical: "signal",
  },
];
export type Cover = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color?: string;
  kind?: "wall" | "crate" | "barrier" | "container";
  y?: number;
};
export const cover: Cover[] = [
  // Operations wing: open north/south passages and a courtyard connector.
  { x: -40, z: -6, w: 1, d: 34, h: 6, kind: "wall" },
  { x: -21, z: -16, w: 1, d: 14, h: 6, kind: "wall" },
  { x: -21, z: 8, w: 1, d: 8, h: 6, kind: "wall" },
  { x: -36, z: -23, w: 9, d: 1, h: 6, kind: "wall" },
  { x: -23, z: -23, w: 5, d: 1, h: 6, kind: "wall" },
  { x: -37, z: 12, w: 7, d: 1, h: 6, kind: "wall" },
  { x: -24, z: 12, w: 7, d: 1, h: 6, kind: "wall" },
  { x: -33, z: -3, w: 10, d: 1, h: 2.5, kind: "wall" },
  // Maintenance hangar has large open portals on both ends.
  { x: 21, z: -5, w: 1, d: 30, h: 7, kind: "wall" },
  { x: 42, z: -5, w: 1, d: 30, h: 7, kind: "wall" },
  { x: 23, z: -20, w: 5, d: 1, h: 7, kind: "wall" },
  { x: 40, z: -20, w: 5, d: 1, h: 7, kind: "wall" },
  { x: 23, z: 10, w: 5, d: 1, h: 7, kind: "wall" },
  { x: 40, z: 10, w: 5, d: 1, h: 7, kind: "wall" },
  // A staircase of cargo boxes permits a mantle overlook, with two drops.
  { x: 37, z: 2, w: 3, d: 3, h: 0.65, kind: "crate" },
  { x: 37, z: -1, w: 3, d: 3, h: 1.2, kind: "crate" },
  { x: 37, z: -5, w: 3, d: 5, h: 1.8, kind: "crate" },
  { x: 29, z: -9, w: 4, d: 7, h: 1.4, kind: "crate" },
  // Courtyard sight breaks, waist cover and flank containers.
  { x: -4, z: -3, w: 5, d: 5, h: 2.3, kind: "crate" },
  { x: 10, z: -12, w: 7, d: 2, h: 1.1, kind: "barrier" },
  { x: 6, z: 15, w: 9, d: 2, h: 1.1, kind: "barrier" },
  { x: -12, z: 23, w: 6, d: 3, h: 1.3, kind: "crate" },
  { x: -15, z: 3, w: 3, d: 6, h: 2.4, kind: "container" },
  { x: 17, z: 31, w: 4, d: 7, h: 2.5, kind: "container" },
  { x: -11, z: -31, w: 8, d: 3, h: 2.5, kind: "container" },
  { x: 9, z: -32, w: 4, d: 5, h: 1.8, kind: "crate" },
  { x: -32, z: 27, w: 12, d: 3, h: 2.5, kind: "container" },
  { x: 32, z: 27, w: 9, d: 3, h: 2.5, kind: "container" },
  { x: -47, z: -31, w: 4, d: 3, h: 1.2, kind: "barrier" },
  { x: 48, z: 26, w: 4, d: 3, h: 1.2, kind: "barrier" },
];
export const MAP_HALF_X = 57.5;
export const MAP_HALF_Z = 47.5;
export const TEAM_NAMES: Record<Team, string> = {
  atlas: "ATLAS",
  cobalt: "COBALT",
};

export const primaryIds: WeaponId[] = [
  "jackal",
  "kestrel",
  "mesa",
  "breacher",
  "anchor",
  "warden",
];
export const sidearmIds: WeaponId[] = ["relay", "rook", "cinder"];
export function validLoadout(value: unknown): value is Loadout {
  if (!value || typeof value !== "object") return false;
  const l = value as Loadout;
  return (
    typeof l.name === "string" &&
    l.name.length <= 32 &&
    primaryIds.includes(l.primary) &&
    sidearmIds.includes(l.sidearm) &&
    ["iron", "reflex", "2x"].includes(l.optic) &&
    ["standard", "suppressor", "compensator"].includes(l.barrel) &&
    ["fleet", "patch", "scavenger"].includes(l.perk) &&
    ["frag", "adhesive"].includes(l.lethal) &&
    ["flash", "signal"].includes(l.tactical)
  );
}
