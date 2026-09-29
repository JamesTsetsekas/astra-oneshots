export type Faction = "helix" | "chorus";
export type Team = "player" | "ai" | "neutral";
export type UnitType =
  | "worker"
  | "scout"
  | "soldier"
  | "lancer"
  | "healer"
  | "siege"
  | "heavy"
  | "guard";
export type BuildingType = "hq" | "supply" | "barracks" | "tech" | "turret" | "extractor";
export type EntityType = UnitType | BuildingType;
export type ResourceKind = "ore" | "flux";
export type Difficulty = "easy" | "normal" | "hard";
export type MatchMode = "skirmish" | "tutorial";
export type OrderKind = "idle" | "move" | "attack" | "attackMove" | "gather" | "hold" | "brace";

export interface Vec2 {
  x: number;
  z: number;
}

export interface Cost {
  ore: number;
  flux: number;
  supply?: number;
}

export interface UnitDefinition {
  type: UnitType;
  label: Record<Faction, string>;
  role: string;
  cost: Cost;
  buildTime: number;
  hp: number;
  speed: number;
  radius: number;
  damage: number;
  range: number;
  minRange?: number;
  attackPeriod: number;
  vision: number;
  armor: number;
  projectileSpeed: number;
  splash?: number;
  canHeal?: boolean;
  strongVs?: string;
  hotkey: string;
}

export interface BuildingDefinition {
  type: BuildingType;
  label: Record<Faction, string>;
  role: string;
  cost: Cost;
  buildTime: number;
  hp: number;
  radius: number;
  vision: number;
  supply: number;
  hotkey: string;
  produces?: UnitType[];
  requires?: BuildingType;
}

export interface ProductionItem {
  type: UnitType | "attackUpgrade" | "armorUpgrade";
  elapsed: number;
  duration: number;
  cost: Cost;
}

export interface Entity {
  id: number;
  team: Exclude<Team, "neutral">;
  faction: Faction;
  kind: "unit" | "building";
  type: EntityType;
  x: number;
  z: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  armor: number;
  vision: number;
  complete: boolean;
  buildProgress: number;
  selected: boolean;
  visible: boolean;
  lastSeen: number;
  order: OrderKind;
  moveTarget?: Vec2;
  targetId?: number;
  gatherNodeId?: number;
  cargoKind?: ResourceKind;
  cargoAmount: number;
  actionTimer: number;
  attackTimer: number;
  queue: ProductionItem[];
  rally?: Vec2;
  brace: boolean;
  slowTimer: number;
  waypoints?: Array<Vec2 & { attackMove: boolean }>;
  navPath?: Vec2[];
  navGoal?: Vec2;
  navTime?: number;
  navVersion?: number;
  abilityCooldown?: number;
  lastDamaged?: number;
  deathTimer?: number;
}

export interface ResourceNode {
  id: number;
  kind: ResourceKind;
  x: number;
  z: number;
  amount: number;
  maxAmount: number;
  radius: number;
}

export interface WatchPylon {
  id: number;
  x: number;
  z: number;
  owner: Team;
  capture: number;
  capturing: Team;
}

export interface TeamEconomy {
  ore: number;
  flux: number;
  supplyUsed: number;
  supplyCap: number;
  attackLevel: number;
  armorLevel: number;
  gatheredOre: number;
  gatheredFlux: number;
  unitsCreated: number;
  unitsLost: number;
  structuresBuilt: number;
}

export interface MatchEvent {
  time: number;
  kind: "info" | "warning" | "combat" | "milestone";
  text: string;
}

export interface GameOptions {
  faction: Faction;
  difficulty: Difficulty;
  mode: MatchMode;
  replay?: RecordedCommand[];
}

export interface RecordedCommand {
  tick: number;
  kind: string;
  selected: number[];
  args: unknown[];
}

export interface GameResult {
  winner: Exclude<Team, "neutral">;
  duration: number;
  reason: string;
}

export interface GameSnapshot {
  running: boolean;
  paused: boolean;
  time: number;
  faction: Faction;
  difficulty: Difficulty;
  mode: MatchMode;
  economy: TeamEconomy;
  selectedIds: number[];
  selectedLabel: string;
  selectedHp: string;
  selectedQueue: ProductionItem[];
  canBuild: boolean;
  selectedBuilding?: BuildingType;
  alerts: MatchEvent[];
  result?: GameResult;
  tutorialStep: number;
  tutorialText?: string;
  fps: number;
  entityCount: number;
}

export interface CommandButton {
  id: string;
  label: string;
  subtitle: string;
  hotkey?: string;
  disabled?: boolean;
  progress?: number;
}
