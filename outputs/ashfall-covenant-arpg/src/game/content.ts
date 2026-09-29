import type { AbilityDefinition, EnemyDefinition, EnemyType, HeroClass, ItemSlot, SkillId } from "./types";

export const WORLD_SIZE = 76;
export const TICK_RATE = 30;

const skill = (
  id: SkillId,
  heroClass: HeroClass,
  name: string,
  short: string,
  description: string,
  tags: string[],
  cost: number,
  cooldown: number,
  targeting: AbilityDefinition["targeting"],
  range: number,
  coefficient: number,
  damageType: AbilityDefinition["damageType"],
  ailmentChance: number,
  castTime: number,
  cancelWindow: number,
  threat: AbilityDefinition["threat"],
): AbilityDefinition => ({
  id, class: heroClass, name, short, description, tags, cost, cooldown, targeting, range, coefficient,
  damageType, ailmentChance, castTime, cancelWindow, threat, vfx: `vfx.${id}`, sfx: `sfx.${id}`,
});

export const abilities: Record<SkillId, AbilityDefinition> = {
  ironLitany: skill("ironLitany", "cinder", "Iron Litany", "Mace sequence", "A measured three-hit mace chain. The final strike releases a frontal shockwave.", ["basic", "melee", "physical"], 0, 0, "target", 2.25, 1, "physical", 0, 0.28, 0.2, "low"),
  brandArc: skill("brandArc", "cinder", "Brand Arc", "Burning sweep", "Sweep a crescent of flame. Burning enemies take increased damage.", ["core", "melee", "ember", "burn"], 25, 1.2, "direction", 4.5, 1.65, "ember", 55, 0.42, 0.3, "medium"),
  bastionStep: skill("bastionStep", "cinder", "Bastion Step", "Shield rush", "Rush forward, stagger lesser enemies, and gain Guard for two seconds.", ["mobility", "guard", "physical"], 0, 6, "direction", 6, 0.85, "physical", 0, 0.18, 0.1, "medium"),
  cinderRing: skill("cinderRing", "cinder", "Cinder Ring", "Delayed eruption", "Prime a circular blast around the Warden after a clear delay.", ["area", "ember", "burn"], 35, 7, "self", 5.5, 2.1, "ember", 75, 0.65, 0.48, "high"),
  vowChain: skill("vowChain", "cinder", "Vow Chain", "Pulling chain", "Launch a chain that pulls light foes and damages heavy targets.", ["control", "physical", "skillshot"], 20, 5, "direction", 11, 1.25, "physical", 0, 0.34, 0.22, "medium"),
  furnaceHeart: skill("furnaceHeart", "cinder", "Furnace Heart", "Heat stance", "Consume stored Heat to convert attacks to Ember and increase attack speed.", ["stance", "ember", "heat"], 0, 12, "self", 0, 0, "ember", 0, 0.2, 0.12, "high"),
  ashenStandard: skill("ashenStandard", "cinder", "Ashen Standard", "Defensive banner", "Plant a standard that grants armor and draws nearby lesser foes.", ["ultimate", "defense", "area"], 50, 22, "point", 9, 0.4, "physical", 0, 0.5, 0.36, "high"),
  quickshot: skill("quickshot", "ranger", "Quickshot", "Mobile bow shot", "Loose a fast arrow. Moving before the shot applies a Trace mark.", ["basic", "ranged", "physical", "trace"], 0, 0, "target", 12, 0.9, "physical", 0, 0.18, 0.12, "low"),
  splinterVolley: skill("splinterVolley", "ranger", "Splinter Volley", "Arrow cone", "Fire a short cone of arrows through clustered enemies.", ["core", "ranged", "area"], 22, 1, "direction", 9, 1.3, "physical", 0, 0.3, 0.2, "medium"),
  ghostline: skill("ghostline", "ranger", "Ghostline", "Piercing detonation", "A piercing star-metal arrow detonates all Trace marks it crosses.", ["ranged", "pierce", "trace"], 28, 5, "direction", 15, 1.7, "physical", 0, 0.38, 0.25, "high"),
  snareBloom: skill("snareBloom", "ranger", "Snare Bloom", "Rooting trap", "Place a trap that arms quickly, roots lesser foes, and slows bosses.", ["trap", "control", "blight"], 18, 6, "point", 10, 0.7, "blight", 100, 0.26, 0.18, "medium"),
  mothcloak: skill("mothcloak", "ranger", "Mothcloak", "Brief camouflage", "Gain speed and one guaranteed evade. Attacking breaks the cloak.", ["utility", "evade", "mobility"], 0, 10, "self", 0, 0, "physical", 0, 0.12, 0.08, "low"),
  backstepFlask: skill("backstepFlask", "ranger", "Backstep Flask", "Retreating Blight", "Leap backward and leave a damaging Blight pool at your origin.", ["mobility", "area", "blight"], 20, 7, "direction", 5, 1.1, "blight", 45, 0.2, 0.12, "medium"),
  horizonCall: skill("horizonCall", "ranger", "Horizon Call", "Arrow storm", "Call a moving corridor of arrows through the battlefield.", ["ultimate", "ranged", "area"], 55, 20, "direction", 16, 2.8, "physical", 0, 0.7, 0.52, "high"),
};

export const classLoadouts: Record<HeroClass, { basic: SkillId; core: SkillId; keys: SkillId[] }> = {
  cinder: { basic: "ironLitany", core: "brandArc", keys: ["bastionStep", "cinderRing", "vowChain", "furnaceHeart"] },
  ranger: { basic: "quickshot", core: "splinterVolley", keys: ["ghostline", "snareBloom", "mothcloak", "horizonCall"] },
};

const enemy = (type: EnemyType, name: string, role: string, hp: number, damage: number, speed: number, range: number, attackPeriod: number, telegraph: number, recovery: number, xp: number, radius: number, damageType: EnemyDefinition["damageType"], boss = false): EnemyDefinition => ({ type, name, role, hp, damage, speed, range, attackPeriod, telegraph, recovery, xp, radius, damageType, boss });

export const enemies: Record<EnemyType, EnemyDefinition> = {
  crawler: enemy("crawler", "Ash Crawler", "Fodder", 42, 8, 3.8, 1.3, 1.2, 0.28, 0.35, 12, 0.55, "physical"),
  husk: enemy("husk", "Bell Husk", "Bruiser", 145, 23, 1.55, 1.8, 2.7, 0.85, 0.9, 34, 0.9, "physical"),
  archer: enemy("archer", "Soot Archer", "Ranged", 66, 13, 2.3, 10.5, 1.8, 0.52, 0.55, 24, 0.55, "physical"),
  scribe: enemy("scribe", "Grave Scribe", "Support", 82, 9, 1.8, 8, 2.5, 0.65, 0.7, 31, 0.65, "blight"),
  mite: enemy("mite", "Lantern Mite", "Exploder", 38, 34, 3.2, 2.2, 3.2, 1, 0.3, 22, 0.5, "ember"),
  pilgrim: enemy("pilgrim", "Chain Pilgrim", "Controller", 118, 18, 1.8, 7.5, 3.1, 0.75, 0.7, 33, 0.78, "physical"),
  warden: enemy("warden", "Archive Warden", "Shield", 175, 21, 1.45, 2, 2.3, 0.68, 0.85, 42, 0.92, "physical"),
  swarm: enemy("swarm", "Quill Swarm", "Splitter", 92, 11, 2.8, 5.5, 1.5, 0.4, 0.4, 26, 0.8, "physical"),
  hound: enemy("hound", "Mire Hound", "Flanker", 76, 17, 3.5, 1.6, 2, 0.46, 0.6, 27, 0.62, "blight"),
  adept: enemy("adept", "Censer Adept", "Area denial", 96, 14, 1.7, 8.5, 2.6, 0.72, 0.65, 36, 0.66, "blight"),
  tollKeeper: enemy("tollKeeper", "The Toll-Keeper", "Wilderness boss", 980, 28, 1.55, 4.5, 2.5, 0.9, 0.8, 360, 1.65, "physical", true),
  orison: enemy("orison", "Orison Engine", "Act boss", 1850, 35, 1.1, 9.5, 2.65, 0.85, 0.75, 800, 2.2, "blight", true),
};

export const classCopy: Record<HeroClass, { name: string; epithet: string; description: string; resource: string }> = {
  cinder: { name: "Cinder Vow", epithet: "Armored battlemage", description: "Endure pressure, bank Heat, and turn a disciplined melee rhythm into explosive control.", resource: "Heat" },
  ranger: { name: "Veil Ranger", epithet: "Bow and trap specialist", description: "Stay in motion, mark priority targets, and control lanes with traps and piercing shots.", resource: "Trace" },
};

export interface BaseItemDefinition { id: string; name: string; slot: ItemSlot; damage: number; armor: number; size: [number, number]; classTag?: HeroClass; }

export const itemBases: BaseItemDefinition[] = [
  { id: "mace-char", name: "Charred Litany", slot: "weapon", damage: 12, armor: 0, size: [1, 3], classTag: "cinder" },
  { id: "maul-iron", name: "Ironfall Maul", slot: "weapon", damage: 18, armor: 0, size: [2, 3], classTag: "cinder" },
  { id: "bow-ash", name: "Ashwood Recurve", slot: "weapon", damage: 11, armor: 0, size: [2, 3], classTag: "ranger" },
  { id: "bow-star", name: "Starwire Bow", slot: "weapon", damage: 16, armor: 0, size: [2, 3], classTag: "ranger" },
  { id: "shield-toll", name: "Tollplate Shield", slot: "offhand", damage: 0, armor: 16, size: [2, 2], classTag: "cinder" },
  { id: "quiver-moth", name: "Mothsilk Quiver", slot: "offhand", damage: 5, armor: 2, size: [1, 2], classTag: "ranger" },
  { id: "head-cowl", name: "Sootbound Cowl", slot: "head", damage: 0, armor: 8, size: [2, 2] },
  { id: "head-helm", name: "Bellguard Helm", slot: "head", damage: 0, armor: 12, size: [2, 2] },
  { id: "chest-coat", name: "Marcher Coat", slot: "chest", damage: 0, armor: 17, size: [2, 3] },
  { id: "chest-plate", name: "Covenant Plate", slot: "chest", damage: 0, armor: 25, size: [2, 3] },
  { id: "glove-brass", name: "Brasslink Grips", slot: "gloves", damage: 0, armor: 6, size: [2, 2] },
  { id: "glove-quill", name: "Quillhide Gloves", slot: "gloves", damage: 1, armor: 5, size: [2, 2] },
  { id: "boot-cinder", name: "Cinderwake Boots", slot: "boots", damage: 0, armor: 7, size: [2, 2] },
  { id: "boot-mire", name: "Mirestrider Boots", slot: "boots", damage: 0, armor: 6, size: [2, 2] },
  { id: "belt-votive", name: "Votive Belt", slot: "belt", damage: 0, armor: 5, size: [2, 1] },
  { id: "amulet-orison", name: "Orison Fragment", slot: "amulet", damage: 2, armor: 0, size: [1, 1] },
  { id: "ring-ember", name: "Ember Signet", slot: "ring", damage: 2, armor: 0, size: [1, 1] },
  { id: "ring-veil", name: "Veiled Loop", slot: "ring", damage: 1, armor: 1, size: [1, 1] },
];

export const affixCatalog = [
  ["mighty", "Mighty", "might"], ["keen", "Keen", "finesse"], ["hallowed", "Hallowed", "will"], ["hale", "Hale", "vigor"],
  ["smiting", "Smiting", "physicalDamage"], ["kindled", "Kindled", "emberDamage"], ["riming", "Riming", "frostDamage"], ["blighted", "Blighted", "blightDamage"],
  ["swift", "Swift", "attackSpeed"], ["guarded", "Guarded", "armor"], ["vital", "Vital", "maxHealth"], ["lucid", "Lucid", "maxFocus"],
  ["precise", "Precise", "critChance"], ["searing", "Searing", "burnChance"], ["freezing", "Freezing", "slowChance"], ["venomous", "Venomous", "poisonChance"],
  ["unyielding", "Unyielding", "staggerResist"], ["sheltering", "Sheltering", "allResist"], ["fireward", "Fireward", "emberResist"], ["winterward", "Winterward", "frostResist"],
  ["mireward", "Mireward", "blightResist"], ["ironward", "Ironward", "physicalResist"], ["restoring", "Restoring", "potionHeal"], ["capacious", "Capacious", "potionCapacity"],
  ["fleet", "Fleet", "moveSpeed"], ["focused", "Focused", "focusGain"], ["thrifty", "Thrifty", "focusCost"], ["heated", "Heated", "heatGain"],
  ["tracing", "Tracing", "traceDamage"], ["trapping", "Trapping", "trapDamage"], ["retaliating", "Retaliating", "retaliation"], ["blocking", "Blocking", "blockChance"],
  ["ferocious", "Ferocious", "critDamage"], ["relentless", "Relentless", "executeDamage"], ["patient", "Patient", "distanceDamage"], ["closebound", "Closebound", "closeDamage"],
  ["of embers", "of Embers", "flatEmber"], ["of rime", "of Rime", "flatFrost"], ["of mire", "of Mire", "flatBlight"], ["of force", "of Force", "flatPhysical"],
  ["of the vow", "of the Vow", "cinderSkill"], ["of the veil", "of the Veil", "rangerSkill"], ["of echoes", "of Echoes", "goldFind"], ["of glyphs", "of Glyphs", "dustFind"],
  ["of recovery", "of Recovery", "cooldown"], ["of shelter", "of Shelter", "guardDuration"], ["of pursuit", "of Pursuit", "markedDamage"], ["of ash", "of Ash", "lowHealthDamage"],
] as const;

export const questText = {
  keeper: ["A bell beneath the ash", "Speak with Warden Maelin at the refuge gate."],
  waypoint: ["The Ashway", "Cross the Soot March and awaken the star-metal waypoint."],
  tollKeeper: ["The Broken Toll", "Defeat the Toll-Keeper beyond the ruined causeway."],
  artificer: ["A voice in the Archive", "Reach the sealed stacks and free Artificer Sable."],
  orison: ["The Buried Star", "Enter the engine vault and silence the Orison Engine."],
  complete: ["Covenant fulfilled", "The Archive is still. Veteran expeditions are unlocked."],
} as const;
