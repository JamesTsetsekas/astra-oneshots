export type HeroClass = "cinder" | "ranger";
export type Difficulty = "normal" | "veteran";
export type Zone = "refuge" | "march" | "archive" | "engine";
export type DamageType = "physical" | "ember" | "frost" | "blight";
export type EnemyType =
  | "crawler"
  | "husk"
  | "archer"
  | "scribe"
  | "mite"
  | "pilgrim"
  | "warden"
  | "swarm"
  | "hound"
  | "adept"
  | "tollKeeper"
  | "orison";
export type EnemyState = "dormant" | "approach" | "reposition" | "telegraph" | "execute" | "recover" | "dead";
export type ItemRarity = "worn" | "tempered" | "inscribed" | "relic";
export type ItemSlot = "weapon" | "offhand" | "head" | "chest" | "gloves" | "boots" | "belt" | "amulet" | "ring";
export type SkillId =
  | "ironLitany"
  | "brandArc"
  | "bastionStep"
  | "cinderRing"
  | "vowChain"
  | "furnaceHeart"
  | "ashenStandard"
  | "quickshot"
  | "splinterVolley"
  | "ghostline"
  | "snareBloom"
  | "mothcloak"
  | "backstepFlask"
  | "horizonCall";

export interface Vec2 {
  x: number;
  z: number;
}

export interface AbilityDefinition {
  id: SkillId;
  class: HeroClass;
  name: string;
  short: string;
  description: string;
  tags: string[];
  cost: number;
  cooldown: number;
  targeting: "self" | "target" | "point" | "direction";
  range: number;
  coefficient: number;
  damageType: DamageType;
  ailmentChance: number;
  castTime: number;
  cancelWindow: number;
  vfx: string;
  sfx: string;
  threat: "low" | "medium" | "high";
}

export interface EnemyDefinition {
  type: EnemyType;
  name: string;
  role: string;
  hp: number;
  damage: number;
  speed: number;
  range: number;
  attackPeriod: number;
  telegraph: number;
  recovery: number;
  xp: number;
  radius: number;
  damageType: DamageType;
  boss?: boolean;
}

export interface Affix {
  id: string;
  name: string;
  stat: string;
  value: number;
  tier: number;
  prefix: boolean;
}

export interface LootItem {
  id: string;
  baseId: string;
  name: string;
  slot: ItemSlot;
  rarity: ItemRarity;
  itemLevel: number;
  affixes: Affix[];
  armor: number;
  damage: number;
  size: [number, number];
  classTag?: HeroClass;
  special?: string;
  favorite: boolean;
  identified: boolean;
  durability: number;
  x?: number;
  y?: number;
}

export interface Equipment {
  weapon?: LootItem;
  offhand?: LootItem;
  head?: LootItem;
  chest?: LootItem;
  gloves?: LootItem;
  boots?: LootItem;
  belt?: LootItem;
  amulet?: LootItem;
  ring?: LootItem;
  ring2?: LootItem;
}

export interface Enemy extends Vec2 {
  id: number;
  type: EnemyType;
  hp: number;
  maxHp: number;
  state: EnemyState;
  stateTimer: number;
  attackTimer: number;
  targetPoint?: Vec2;
  elite?: "ember" | "frost" | "rallying";
  burning: number;
  slowed: number;
  rooted: number;
  stagger: number;
  phase: number;
  visible: boolean;
  lootDropped: boolean;
}

export interface Pickup extends Vec2 {
  id: number;
  kind: "gold" | "potion" | "item" | "dust";
  amount: number;
  item?: LootItem;
  label: string;
  rarity?: ItemRarity;
}

export interface HeroState extends Vec2 {
  class: HeroClass;
  name: string;
  level: number;
  xp: number;
  xpNext: number;
  hp: number;
  maxHp: number;
  focus: number;
  maxFocus: number;
  heat: number;
  damage: number;
  armor: number;
  critChance: number;
  moveTarget?: Vec2;
  attackTarget?: number;
  attackTimer: number;
  castTimer: number;
  evadeCharges: number;
  evadeRecovery: number;
  invulnerable: number;
  guard: number;
  camouflage: number;
  furnace: number;
  potions: number;
  maxPotions: number;
  gold: number;
  dust: number;
  skillPoints: number;
  attributePoints: number;
  attributes?: { might: number; finesse: number; will: number; vigor: number };
  skills: Record<string, number>;
  equipment: Equipment;
  inventory: LootItem[];
  deaths: number;
  kills: number;
}

export type QuestStep = "keeper" | "waypoint" | "tollKeeper" | "artificer" | "orison" | "complete";

export interface GameEvent {
  id: number;
  kind: "info" | "quest" | "loot" | "danger" | "level";
  text: string;
  time: number;
}

export interface CombatFx {
  id: number;
  kind: "hit" | "crit" | "ember" | "frost" | "blight" | "heal" | "telegraph" | "loot" | "evade" | "level";
  x: number;
  z: number;
  radius: number;
  value?: number;
  text?: string;
}

export interface GameSnapshot {
  running: boolean;
  paused: boolean;
  time: number;
  zone: Zone;
  difficulty: Difficulty;
  hero: HeroState;
  questStep: QuestStep;
  questTitle: string;
  questDetail: string;
  enemiesAlive: number;
  boss?: { name: string; hp: number; maxHp: number; phase: number };
  events: GameEvent[];
  nearbyPickup?: Pickup;
  waypointActive: boolean;
  artificerRescued: boolean;
  veteranUnlocked: boolean;
  victory: boolean;
  seed: number;
  fps: number;
}

export interface CharacterSave {
  schemaVersion: 1;
  savedAt: number;
  checksum: string;
  payload: {
    heroClass: HeroClass;
    heroName: string;
    difficulty: Difficulty;
    seed: number;
    hero: HeroState;
    questStep: QuestStep;
    waypointActive: boolean;
    artificerRescued: boolean;
    veteranUnlocked: boolean;
  };
}

export interface GameOptions {
  heroClass: HeroClass;
  heroName: string;
  difficulty: Difficulty;
  seed: number;
  targetHunt?: boolean;
}
