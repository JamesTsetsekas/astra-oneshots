export type HeroId = "brannoch" | "suri" | "oru" | "kesh" | "ilyra" | "vey";
export type Team = 0 | 1 | 2;
export interface Point {
  x: number;
  z: number;
}
export interface Ability {
  name: string;
  description: string;
  cost: number;
  cooldown: number;
  range: number;
  power: number;
  kind: string;
  radius: number;
}
export interface HeroDef {
  id: HeroId;
  name: string;
  title: string;
  role: string;
  color: string;
  hp: number;
  damage: number;
  range: number;
  speed: number;
  armor: number;
  passive: string;
  abilities: Ability[];
}
const a = (
  name: string,
  description: string,
  cost: number,
  cooldown: number,
  range: number,
  power: number,
  kind: string,
  radius = 3,
): Ability => ({
  name,
  description,
  cost,
  cooldown,
  range,
  power,
  kind,
  radius,
});
export const HEROES: HeroDef[] = [
  {
    id: "brannoch",
    name: "Brannoch",
    title: "Bastion Mason",
    role: "Vanguard · protector",
    color: "#91a978",
    hp: 940,
    damage: 53,
    range: 2.4,
    speed: 4.1,
    armor: 38,
    passive:
      "Set in Stone: staying close to enemy heroes builds up to 18 armor.",
    abilities: [
      a(
        "Fault Hammer",
        "Frontal stone shockwave. Damages and slows enemies for 2 seconds.",
        35,
        6,
        7,
        85,
        "slam",
        3.5,
      ),
      a(
        "Rampart Fold",
        "Raise a destructible stone barrier. Enemies inside are slowed.",
        45,
        13,
        8,
        0,
        "wall",
        3,
      ),
      a(
        "Anchor Line",
        "Pull to your cursor and gain a 140-point shield.",
        40,
        10,
        7,
        140,
        "anchor",
      ),
      a(
        "Citybreaker",
        "Leap into a marked area after a warning, damaging and stunning enemies.",
        90,
        52,
        13,
        230,
        "leap",
        5,
      ),
    ],
  },
  {
    id: "suri",
    name: "Suri Vale",
    title: "Ember Courier",
    role: "Marksman · skirmisher",
    color: "#e99067",
    hp: 650,
    damage: 68,
    range: 8.2,
    speed: 4.6,
    armor: 18,
    passive:
      "Hot Route: moving 6 meters charges your next basic attack for 35 bonus damage.",
    abilities: [
      a(
        "Ricochet Bolt",
        "A fast piercing bolt that cuts through a line of enemies.",
        30,
        5,
        16,
        90,
        "bolt",
        0.65,
      ),
      a(
        "Slipstream",
        "Dash and leave a speed lane for allies.",
        35,
        12,
        7,
        0,
        "dash",
        2,
      ),
      a(
        "Parcel Charge",
        "Place an explosive parcel. Its warning circle erupts after 1.2 seconds.",
        45,
        9,
        10,
        135,
        "bomb",
        3,
      ),
      a(
        "Redline Delivery",
        "Warn a long corridor, then send an empowered piercing shot.",
        90,
        48,
        29,
        260,
        "corridor",
        2.2,
      ),
    ],
  },
  {
    id: "oru",
    name: "Oru",
    title: "Choir of Moths",
    role: "Support · controller",
    color: "#d7bc74",
    hp: 710,
    damage: 45,
    range: 7.2,
    speed: 4.3,
    armor: 22,
    passive:
      "Shared Wing: shields restore a small amount of health when applied.",
    abilities: [
      a(
        "Luminous Swarm",
        "Send a moth swarm that damages enemies and shields nearby allies.",
        30,
        5,
        12,
        72,
        "swarm",
        3,
      ),
      a(
        "Hush Field",
        "Create a slowing field that damages enemies and silences casts.",
        50,
        12,
        11,
        32,
        "hush",
        4.5,
      ),
      a(
        "Guiding Draft",
        "Speed and shield nearby allies, restoring a little health.",
        45,
        10,
        9,
        95,
        "draft",
        5,
      ),
      a(
        "Night Migration",
        "A broad wave roots enemies and shields allies along its path.",
        85,
        50,
        20,
        170,
        "migration",
        4,
      ),
    ],
  },
  {
    id: "kesh",
    name: "Kesh",
    title: "Mirebound",
    role: "Fighter · jungler",
    color: "#78ae8b",
    hp: 820,
    damage: 64,
    range: 2.9,
    speed: 4.4,
    armor: 30,
    passive:
      "Predator’s Patience: every third attack against the same target heals 24 health.",
    abilities: [
      a(
        "Reed Cleaver",
        "Sweep your blade in a cone, adding missing-health damage.",
        30,
        6,
        5,
        105,
        "cleave",
        3,
      ),
      a(
        "Bogskin",
        "Gain a strong shield; its burst slows nearby enemies.",
        35,
        11,
        0,
        175,
        "shield",
        4,
      ),
      a(
        "Sinkstep",
        "Burrow toward the cursor and gain attack speed for 4 seconds.",
        35,
        10,
        8,
        0,
        "burrow",
      ),
      a(
        "Fen Claim",
        "Claim a marsh for 7 seconds. Damage and slow enemies; haste yourself.",
        85,
        48,
        10,
        28,
        "marsh",
        6,
      ),
    ],
  },
  {
    id: "ilyra",
    name: "Ilyra Quill",
    title: "Archive Exile",
    role: "Mage · artillery",
    color: "#aaa0d4",
    hp: 630,
    damage: 44,
    range: 7.5,
    speed: 4.1,
    armor: 17,
    passive:
      "Margin Notes: every third ability hit on a hero causes a 65-damage burst.",
    abilities: [
      a(
        "Linebreak",
        "Fire a narrow piercing ink lance through enemies.",
        35,
        5,
        19,
        115,
        "line",
        0.75,
      ),
      a(
        "Footnote",
        "Place an ink sigil that erupts after a 0.9-second warning.",
        45,
        10,
        13,
        120,
        "sigil",
        3.3,
      ),
      a(
        "Redaction",
        "Erase enemy zones and silence foes inside the marked area.",
        55,
        12,
        13,
        80,
        "redact",
        3.5,
      ),
      a(
        "Final Draft",
        "Three expanding rings strike in sequence, each briefly stunning enemies.",
        100,
        55,
        16,
        105,
        "rings",
        6,
      ),
    ],
  },
  {
    id: "vey",
    name: "Vey",
    title: "Glassknife",
    role: "Assassin · roamer",
    color: "#6bc1c4",
    hp: 670,
    damage: 64,
    range: 2.5,
    speed: 4.7,
    armor: 22,
    passive:
      "Refraction: entering mistwood empowers your next attack by 40 damage.",
    abilities: [
      a(
        "Shardstep",
        "Dash through the nearest enemy at your cursor and strike.",
        30,
        6,
        8,
        110,
        "strike",
        2,
      ),
      a(
        "Mirror Decoy",
        "Blink toward your cursor, leaving an illusion, and gain a brief shield.",
        35,
        13,
        8,
        95,
        "decoy",
        2,
      ),
      a(
        "Cut the Light",
        "A sharp cone disables wards and damages nearby enemies.",
        40,
        8,
        7,
        100,
        "cut",
        4,
      ),
      a(
        "Prism Sentence",
        "Mark a small area; after a clear warning, deliver a powerful strike.",
        90,
        50,
        12,
        310,
        "sentence",
        2,
      ),
    ],
  },
];
export const heroById = (id: HeroId) => HEROES.find((h) => h.id === id)!;
export interface Item {
  id: number;
  name: string;
  category:
    | "starter"
    | "component"
    | "attack"
    | "ability"
    | "defense"
    | "support"
    | "boots"
    | "consumable";
  cost: number;
  description: string;
  damage?: number;
  power?: number;
  hp?: number;
  armor?: number;
  ward?: number;
  speed?: number;
  haste?: number;
  attackSpeed?: number;
  recipe?: number[];
  active?: "heal" | "mana" | "cleanse" | "shield";
}
export const ITEMS: Item[] = [
  {
    id: 0,
    name: "Courier’s Pin",
    category: "starter",
    cost: 300,
    damage: 12,
    hp: 50,
    description: "Early attack pressure and a little resilience.",
  },
  {
    id: 1,
    name: "Mason’s Token",
    category: "starter",
    cost: 300,
    hp: 130,
    armor: 8,
    description: "A sturdy opening for the frontline.",
  },
  {
    id: 2,
    name: "Student’s Quill",
    category: "starter",
    cost: 300,
    power: 20,
    hp: 40,
    description: "A focused start for spellcasters.",
  },
  {
    id: 3,
    name: "Wingseed",
    category: "starter",
    cost: 300,
    power: 10,
    hp: 80,
    description: "Balanced protection for a supporting role.",
  },
  {
    id: 4,
    name: "Mireknife",
    category: "starter",
    cost: 300,
    damage: 9,
    attackSpeed: 0.1,
    description: "Fast attacks for lane and jungle.",
  },
  {
    id: 5,
    name: "Glass Charm",
    category: "starter",
    cost: 300,
    damage: 10,
    speed: 0.15,
    description: "Mobility for finding the right angle.",
  },
  ...[
    ["Brass Edge", 200, "damage", 10],
    ["Aether Lens", 220, "power", 18],
    ["Woven Guard", 200, "armor", 12],
    ["Heartstone", 230, "hp", 130],
    ["Clock Spring", 240, "haste", 10],
    ["Silk Tread", 220, "speed", 0.3],
    ["Ward Prism", 210, "ward", 15],
    ["Drawcord", 230, "attackSpeed", 0.18],
    ["Gilded Point", 340, "damage", 18],
    ["Azure Folio", 340, "power", 28],
  ].map((v, i) => ({
    id: i + 6,
    name: v[0] as string,
    category: "component" as const,
    cost: v[1] as number,
    [v[2] as string]: v[3] as number,
    description: "A building block for a completed item.",
  })),
  {
    id: 16,
    name: "Sunspoke Bow",
    category: "attack",
    cost: 1250,
    damage: 32,
    attackSpeed: 0.35,
    recipe: [6, 13],
    description:
      "Fast sustained attacks. Every third hit deals 20 bonus damage.",
  },
  {
    id: 17,
    name: "Kilnheart Plate",
    category: "defense",
    cost: 1250,
    hp: 300,
    armor: 40,
    recipe: [8, 9],
    description: "Heavy armor and health for holding a contested lane.",
  },
  {
    id: 18,
    name: "Quiet Index",
    category: "ability",
    cost: 1250,
    power: 85,
    haste: 18,
    recipe: [7, 10],
    description: "Potent spell damage with shorter ability cooldowns.",
  },
  {
    id: 19,
    name: "Beacon Loom",
    category: "support",
    cost: 1100,
    power: 35,
    hp: 200,
    haste: 15,
    recipe: [9, 10],
    description: "A durable support weave. Active: shield yourself.",
    active: "shield",
  },
  {
    id: 20,
    name: "Null Bell",
    category: "support",
    cost: 1050,
    ward: 40,
    hp: 180,
    recipe: [9, 12],
    description: "Active: remove slows and stuns, gain a brief shield.",
    active: "cleanse",
  },
  {
    id: 21,
    name: "Glasswind Fang",
    category: "attack",
    cost: 1350,
    damage: 55,
    speed: 0.25,
    recipe: [6, 14],
    description: "A strong blade for flanking and burst attacks.",
  },
  {
    id: 22,
    name: "Orchard Heart",
    category: "defense",
    cost: 1200,
    hp: 450,
    ward: 25,
    recipe: [9, 12],
    description: "Deep reserves for surviving repeated trades.",
  },
  {
    id: 23,
    name: "Storm Manuscript",
    category: "ability",
    cost: 1450,
    power: 115,
    recipe: [7, 15],
    description: "Heavy spell amplification without defensive stats.",
  },
  {
    id: 24,
    name: "Anchor Crown",
    category: "defense",
    cost: 1400,
    hp: 300,
    armor: 55,
    recipe: [8, 9],
    description: "A tank’s commitment to the front line.",
  },
  {
    id: 25,
    name: "Dawn Relay",
    category: "support",
    cost: 1200,
    power: 40,
    haste: 25,
    speed: 0.2,
    recipe: [10, 11],
    description: "Rapid utility rotations and swift movement.",
  },
  {
    id: 26,
    name: "Reedwake Axe",
    category: "attack",
    cost: 1300,
    damage: 40,
    hp: 220,
    recipe: [9, 14],
    description: "Damage and staying power for close-range fighters.",
  },
  {
    id: 27,
    name: "Prismatic Dial",
    category: "ability",
    cost: 1300,
    power: 65,
    ward: 30,
    haste: 15,
    recipe: [7, 12],
    description: "Spell pressure with protection against retaliation.",
  },
  {
    id: 28,
    name: "Riverglass Boots",
    category: "boots",
    cost: 650,
    speed: 0.9,
    recipe: [11],
    description: "Swift rotations across the Broken Diadem.",
  },
  {
    id: 29,
    name: "Ironstep Boots",
    category: "boots",
    cost: 700,
    speed: 0.65,
    armor: 22,
    recipe: [11, 8],
    description: "Movement with protection from physical attacks.",
  },
  {
    id: 30,
    name: "Sunwell Tonic",
    category: "consumable",
    cost: 80,
    description: "Active: restore 220 health over a moment.",
    active: "heal",
  },
  {
    id: 31,
    name: "Aether Flask",
    category: "consumable",
    cost: 70,
    description: "Active: restore 180 mana.",
    active: "mana",
  },
];
export const TALENTS = [
  "Blink",
  "Mend",
  "Barrier",
  "Fleet",
  "Clarity",
  "Farsight",
] as const;
export type Talent = (typeof TALENTS)[number];
export const LANES: Point[][] = [
  [
    { x: -64, z: 0 },
    { x: -50, z: -19 },
    { x: -32, z: -32 },
    { x: 0, z: -37 },
    { x: 32, z: -32 },
    { x: 50, z: -19 },
    { x: 64, z: 0 },
  ],
  [
    { x: -64, z: 0 },
    { x: -49, z: 20 },
    { x: -28, z: 32 },
    { x: 3, z: 40 },
    { x: 30, z: 28 },
    { x: 50, z: 18 },
    { x: 64, z: 0 },
  ],
];
export const BRUSH = [
  { x: -21, z: -10, r: 6 },
  { x: 20, z: 12, r: 6 },
  { x: -10, z: 19, r: 5 },
  { x: 10, z: -20, r: 5 },
  { x: -42, z: 5, r: 5 },
  { x: 41, z: -4, r: 5 },
];
export const TEAM_NAMES = ["Dawnwright", "Vesper"];
export const TEAM_COLORS = ["#62c7c5", "#ec846d"];
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.z - b.z);
export const toward = (a: Point, b: Point) => {
  const d = distance(a, b) || 1;
  return { x: (b.x - a.x) / d, z: (b.z - a.z) / d };
};
export const clamp = (v: number, a: number, b: number) =>
  Math.max(a, Math.min(b, v));
