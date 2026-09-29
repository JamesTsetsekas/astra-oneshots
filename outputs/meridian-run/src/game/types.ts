export type Vec2 = { x: number; z: number };
export type Vec3 = Vec2 & { y: number };
export type TaxiId = "gull" | "breaker" | "tempest";
export type TaxiDefinition = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  color: string;
  topSpeed: number;
  acceleration: number;
  handling: number;
  drift: number;
  mass: number;
  wheelbase: number;
};
export type VehicleDefinition = TaxiDefinition & {
  kind: "compact" | "sedan" | "coupe" | "van" | "police" | "bike";
  model: TaxiId;
  length: number;
  width: number;
};
export type VehicleState = Vec3 & {
  heading: number;
  speed: number;
  speedKmh: number;
  vx: number;
  vz: number;
  steering: number;
  slipAngle: number;
  drift: boolean;
  boost: boolean;
  grounded: boolean;
  pitch: number;
  roll: number;
  wheelSpin: number;
  suspension: number[];
  damage: number;
  surface: string;
};
export type InputFrame = {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
  boost: boolean;
  interact: boolean;
  reset: boolean;
  lookX: number;
  lookBack: boolean;
  horn: boolean;
  moveX: number;
  moveZ: number;
  aimYaw: number;
  aimPitch: number;
  aim: boolean;
  fire: boolean;
  reload: boolean;
  jump: boolean;
  crouch: boolean;
  sprint: boolean;
  exit: boolean;
  melee: boolean;
  gadget: boolean;
  heal: boolean;
};
export const EMPTY_INPUT: InputFrame = {
  throttle: 0,
  brake: 0,
  steer: 0,
  handbrake: false,
  boost: false,
  interact: false,
  reset: false,
  lookX: 0,
  lookBack: false,
  horn: false,
  moveX: 0,
  moveZ: 0,
  aimYaw: 0,
  aimPitch: 0,
  aim: false,
  fire: false,
  reload: false,
  jump: false,
  crouch: false,
  sprint: false,
  exit: false,
  melee: false,
  gadget: false,
  heal: false,
};
export type Road = {
  id: string;
  name: string;
  points: Vec3[];
  width: number;
  surface: "asphalt" | "cobble" | "sand" | "metal";
};
export type Building = {
  id: number;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  rotation: number;
  style: "stucco" | "glass" | "market" | "tower" | "warehouse";
  color: string;
  district: string;
};
export type Destination = Vec2 & {
  id: number;
  name: string;
  district: string;
  color: string;
  landmark:
    | "hotel"
    | "museum"
    | "stadium"
    | "ferry"
    | "market"
    | "cafe"
    | "tower"
    | "park";
  radius: number;
};
export type Shortcut = {
  id: number;
  name: string;
  entry: Vec2;
  exit: Vec2;
  width: number;
  kind: "alley" | "ramp" | "beach" | "tram" | "park" | "deck";
  bonus: number;
};
export type TrafficVehicle = Vec3 & {
  id: number;
  heading: number;
  speed: number;
  variant: number;
  color: string;
  state: "cruise" | "brake" | "turn" | "recover";
};
export type WorldVehicle = TrafficVehicle & {
  definition: string;
  condition: number;
  locked: boolean;
  owned: boolean;
  parked: boolean;
  driver: "civilian" | "police" | "none";
  stolen: boolean;
};
export type Pedestrian = Vec3 & {
  id: number;
  heading: number;
  role: string;
  color: string;
  state: "walk" | "wait" | "talk" | "flee" | "report" | "work";
  phase: number;
  report: number;
  home: Vec2;
  goal: Vec2;
};
export type Enemy = Vec3 & {
  id: number;
  heading: number;
  hp: number;
  role: "security" | "rival" | "police";
  state: "patrol" | "investigate" | "chase" | "attack" | "stunned" | "search";
  cooldown: number;
  home: Vec2;
  alerted: boolean;
  stun: number;
  lastSeen?: Vec2;
  seenAt?: number;
};
export type WeaponId =
  | "stun"
  | "pistol"
  | "machine"
  | "carbine"
  | "shotgun"
  | "marksman"
  | "baton";
export type Player = Vec3 & {
  heading: number;
  speed: number;
  health: number;
  armor: number;
  stamina: number;
  cash: number;
  trust: number;
  weapon: WeaponId;
  ammo: number;
  reserve: number;
  reload: number;
  medkits: number;
  gadgets: number;
  crouching: boolean;
  aiming: boolean;
  holstered: boolean;
  vertical: number;
  grounded: boolean;
  vehicleId?: number;
  inside?: string;
  dead: boolean;
};
export type Crime = {
  id: number;
  type: string;
  severity: number;
  time: number;
  location: Vec2;
  reported: boolean;
  delay: number;
  witness: number;
};
export type AlertState = {
  tier: number;
  heat: number;
  state:
    | "Unnoticed"
    | "Witness reporting"
    | "Identified"
    | "Pursuit"
    | "Search"
    | "Cooling";
  lastKnown: Vec2;
  unseen: number;
  identifiedVehicle?: number;
  crime?: string;
};
export type MissionDefinition = {
  id: string;
  name: string;
  contact: string;
  description: string;
  reward: number;
  trust: number;
  kind: "story" | "activity";
  stages: MissionStage[];
};
export type MissionStage = {
  text: string;
  type:
    | "enter"
    | "drive"
    | "interact"
    | "investigate"
    | "combat"
    | "survive"
    | "escape"
    | "circuit";
  target: Vec2;
  radius: number;
  duration?: number;
  requiresVehicle?: boolean;
  label: string;
};
export type Mission = {
  id: string;
  stage: number;
  elapsed: number;
  progress: number;
  checkpoint: number;
  fail?: string;
  replay: boolean;
  damage: number;
  civilianHarm: number;
  started: number;
};
export type MissionResult = {
  id: string;
  name: string;
  grade: "S" | "A" | "B" | "C";
  reward: number;
  trust: number;
  duration: number;
  damage: number;
  replay: boolean;
  date: number;
};
export type GameEvent = {
  id: number;
  time: number;
  kind:
    | "info"
    | "shot"
    | "hit"
    | "crime"
    | "mission"
    | "reward"
    | "collision"
    | "pickup"
    | "death";
  text: string;
  position?: Vec3;
  end?: Vec3;
  value?: number;
};
export type Settings = {
  quality: "low" | "medium" | "high";
  sound: boolean;
  music: number;
  effects: number;
  sensitivity: number;
  steeringAssist: boolean;
  reducedMotion: boolean;
  subtitles: boolean;
  colorblind: boolean;
  traffic: number;
  crowds: number;
  camera: 0 | 1 | 2;
  fov: number;
};
export const DEFAULT_SETTINGS: Settings = {
  quality: "high",
  sound: true,
  music: 0.25,
  effects: 0.7,
  sensitivity: 1,
  steeringAssist: true,
  reducedMotion: false,
  subtitles: true,
  colorblind: false,
  traffic: 1,
  crowds: 1,
  camera: 0,
  fov: 85,
};
export type Snapshot = {
  time: number;
  player: Player;
  vehicle?: VehicleState;
  vehicles: WorldVehicle[];
  pedestrians: Pedestrian[];
  enemies: Enemy[];
  mission?: Mission;
  missionDefinition?: MissionDefinition;
  completed: string[];
  alert: AlertState;
  events: GameEvent[];
  result?: MissionResult;
  target?: Vec2;
  route: Vec3[];
  interaction?: {
    label: string;
    kind: "vehicle" | "contact" | "shop" | "door" | "mission" | "save";
    id: string;
  };
  day: number;
  district: string;
  fps: number;
  notification?: string;
};
export type SaveGame = {
  version: 1;
  player: Player;
  completed: string[];
  time: number;
  results: MissionResult[];
  mission?: Mission;
  alert?: AlertState;
  vehicle?: {
    definition: string;
    condition: number;
    x: number;
    z: number;
    heading: number;
    owned?: boolean;
    stolen?: boolean;
  };
  settings?: Settings;
  checkpoint: Vec3;
  date: number;
};
