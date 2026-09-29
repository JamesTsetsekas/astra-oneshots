import { abilities, classLoadouts, enemies, questText, TICK_RATE, WORLD_SIZE } from "./content";
import { generateItem, placeInventory, SeededRandom } from "./loot";
import type {
  CharacterSave,
  CombatFx,
  Difficulty,
  Enemy,
  EnemyType,
  GameEvent,
  GameOptions,
  GameSnapshot,
  HeroClass,
  HeroState,
  LootItem,
  Pickup,
  QuestStep,
  SkillId,
  Vec2,
  Zone,
} from "./types";

const DT = 1 / TICK_RATE;

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalize(from: Vec2, to: Vec2): Vec2 {
  const x = to.x - from.x;
  const z = to.z - from.z;
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
}

function baseHero(heroClass: HeroClass, name: string): HeroState {
  return {
    class: heroClass,
    name,
    level: 1,
    xp: 0,
    xpNext: 100,
    hp: heroClass === "cinder" ? 230 : 175,
    maxHp: heroClass === "cinder" ? 230 : 175,
    focus: 75,
    maxFocus: 100,
    heat: 0,
    damage: heroClass === "cinder" ? 23 : 21,
    armor: heroClass === "cinder" ? 28 : 15,
    critChance: heroClass === "cinder" ? 0.08 : 0.14,
    x: -28,
    z: -20,
    attackTimer: 0,
    castTimer: 0,
    evadeCharges: 3,
    evadeRecovery: 0,
    invulnerable: 0,
    guard: 0,
    camouflage: 0,
    furnace: 0,
    potions: 3,
    maxPotions: 5,
    gold: 75,
    dust: 0,
    skillPoints: 1,
    attributePoints: 0,
    skills: {},
    equipment: {},
    inventory: [],
    deaths: 0,
    kills: 0,
  };
}

interface Hazard extends Vec2 {
  id: number;
  kind: "ember" | "blight" | "snare" | "standard" | "beam";
  radius: number;
  time: number;
  duration: number;
  damage: number;
  hostile: boolean;
  tick: number;
}

export class GameSimulation {
  readonly options: GameOptions;
  readonly hero: HeroState;
  readonly enemyMap = new Map<number, Enemy>();
  readonly pickupMap = new Map<number, Pickup>();
  readonly hazards: Hazard[] = [];
  readonly events: GameEvent[] = [];
  readonly effects: CombatFx[] = [];
  readonly cooldowns = new Map<SkillId, number>();

  time = 0;
  paused = false;
  running = true;
  victory = false;
  questStep: QuestStep = "keeper";
  waypointActive = false;
  artificerRescued = false;
  veteranUnlocked = false;
  private nextId = 1;
  private accumulator = 0;
  private random: SeededRandom;
  private eventId = 1;
  private fxId = 1;
  private attackSequence = 0;
  private movedSinceShot = 0;
  private autoSaveTimer = 0;
  private bossRewardPity = 0;

  constructor(options: GameOptions, restored?: CharacterSave["payload"]) {
    this.options = options;
    this.random = new SeededRandom(options.seed);
    this.hero = restored ? structuredClone(restored.hero) : baseHero(options.heroClass, options.heroName);
    if (restored) {
      this.questStep = restored.questStep;
      this.waypointActive = restored.waypointActive;
      this.artificerRescued = restored.artificerRescued;
      this.veteranUnlocked = restored.veteranUnlocked;
      this.hero.moveTarget = undefined;
      this.hero.attackTarget = undefined;
      if(!this.hero.equipment.weapon){
        for(let i=0;i<300;i++){const weapon=generateItem((options.seed^0x117)+i,1,options.heroClass,false,'tempered');if(weapon.slot==='weapon'){this.hero.equipment.weapon=weapon;break;}}
        this.recalculateHero();
      }
    } else {
      this.giveStarterEquipment();
    }
    for (const id of Object.keys(abilities) as SkillId[]) this.cooldowns.set(id, 0);
    this.spawnExpedition();
    if (options.targetHunt) {
      this.questStep = 'orison'; this.waypointActive = true; this.artificerRescued = true;
      this.hero.x = 21; this.hero.z = 13; this.hero.hp = this.hero.maxHp; this.hero.focus = this.hero.maxFocus;
      this.hero.potions = this.hero.maxPotions; this.syncStageVisibility();
      for(const enemy of this.enemyMap.values())if(enemy.x<19){enemy.state='dead';enemy.hp=0;enemy.lootDropped=true;}
    }
    if(restored && !options.targetHunt) {
      const passedKeeper = ['artificer','orison','complete'].includes(this.questStep);
      for(const enemy of this.enemyMap.values())if((enemy.type==='tollKeeper'&&passedKeeper)||(enemy.type==='orison'&&this.questStep==='complete')){enemy.state='dead';enemy.hp=0;enemy.lootDropped=true;}
      this.victory=this.questStep==='complete';
    }
    this.pushEvent("quest", "The refuge gate is open. Speak with Warden Maelin.");
  }

  private giveStarterEquipment(): void {
    let weapon = generateItem(this.options.seed ^ 0x117, 1, this.options.heroClass, false, "tempered");
    for(let i=1;weapon.slot!=='weapon'&&i<300;i++)weapon=generateItem((this.options.seed^0x117)+i,1,this.options.heroClass,false,'tempered');
    const chest = generateItem(this.options.seed ^ 0x991, 1, this.options.heroClass, false, "worn");
    this.hero.equipment.weapon = weapon.slot === "weapon" ? weapon : undefined;
    if (!this.hero.equipment.weapon) this.hero.inventory.push(weapon);
    if (chest.slot === "chest") this.hero.equipment.chest = chest;
    else this.hero.inventory.push(chest);
    this.recalculateHero();
  }

  private spawnExpedition(): void {
    const packs: Array<{ at: Vec2; types: EnemyType[]; elite?: Enemy["elite"] }> = [
      { at: { x: -20, z: -15 }, types: ["crawler", "crawler", "crawler", "hound"] },
      { at: { x: -13, z: -10 }, types: ["husk", "archer", "crawler", "scribe"] },
      { at: { x: -4, z: -3 }, types: ["mite", "crawler", "pilgrim", "archer"], elite: "ember" },
      { at: { x: 4, z: 2 }, types: ["hound", "hound", "adept", "crawler"] },
      { at: { x: 14, z: 8 }, types: ["warden", "swarm", "scribe", "archer"], elite: "frost" },
      { at: { x: 21, z: 13 }, types: ["warden", "adept", "pilgrim", "mite"] },
      { at: { x: 27, z: 17 }, types: ["swarm", "hound", "scribe", "husk"], elite: "rallying" },
    ];
    for (const pack of packs) {
      pack.types.forEach((type, index) => {
        const angle = (index / pack.types.length) * Math.PI * 2 + this.random.next();
        this.spawnEnemy(type, pack.at.x + Math.cos(angle) * (1.8 + index * 0.25), pack.at.z + Math.sin(angle) * (1.8 + index * 0.25), index === 0 ? pack.elite : undefined);
      });
    }
    this.spawnEnemy("tollKeeper", 10, 5);
    this.spawnEnemy("orison", 32, 20);
    this.syncStageVisibility();
  }

  private spawnEnemy(type: EnemyType, x: number, z: number, elite?: Enemy["elite"]): Enemy {
    const definition = enemies[type];
    const difficultyScale = this.options.difficulty === "veteran" ? 1.42 : 1;
    const eliteScale = elite ? 1.55 : 1;
    const entity: Enemy = {
      id: this.nextId++,
      type,
      x,
      z,
      hp: Math.round(definition.hp * difficultyScale * eliteScale),
      maxHp: Math.round(definition.hp * difficultyScale * eliteScale),
      state: "dormant",
      stateTimer: 0,
      attackTimer: this.random.next() * 0.5,
      elite,
      burning: 0,
      slowed: 0,
      rooted: 0,
      stagger: 0,
      phase: 1,
      visible: true,
      lootDropped: false,
    };
    this.enemyMap.set(entity.id, entity);
    return entity;
  }

  private syncStageVisibility(): void {
    for (const enemy of this.enemyMap.values()) {
      if (enemy.type === "tollKeeper") enemy.visible = ["tollKeeper", "artificer", "orison", "complete"].includes(this.questStep);
      if (enemy.type === "orison") enemy.visible = ["orison", "complete"].includes(this.questStep);
    }
  }

  update(frameDelta: number): boolean {
    if (!this.running || this.paused) return false;
    this.accumulator = Math.min(this.accumulator + frameDelta, 0.25);
    let changed = false;
    while (this.accumulator >= DT) {
      this.step(DT);
      this.accumulator -= DT;
      changed = true;
    }
    return changed;
  }

  private step(dt: number): void {
    this.time += dt;
    this.autoSaveTimer += dt;
    this.hero.attackTimer = Math.max(0, this.hero.attackTimer - dt);
    this.hero.castTimer = Math.max(0, this.hero.castTimer - dt);
    this.hero.invulnerable = Math.max(0, this.hero.invulnerable - dt);
    this.hero.guard = Math.max(0, this.hero.guard - dt);
    this.hero.camouflage = Math.max(0, this.hero.camouflage - dt);
    this.hero.furnace = Math.max(0, this.hero.furnace - dt);
    this.updateCooldowns(dt);
    this.updateEvade(dt);
    this.updateHeroMovement(dt);
    this.updateHeroAttack();
    this.updateEnemies(dt);
    this.updateHazards(dt);
    this.updatePickups();
    this.syncStageVisibility();
  }

  private updateCooldowns(dt: number): void {
    for (const [id, value] of this.cooldowns) this.cooldowns.set(id, Math.max(0, value - dt));
  }

  private updateEvade(dt: number): void {
    if (this.hero.evadeCharges >= 3) {
      this.hero.evadeRecovery = 0;
      return;
    }
    this.hero.evadeRecovery += dt;
    if (this.hero.evadeRecovery >= 2.8) {
      this.hero.evadeCharges += 1;
      this.hero.evadeRecovery = 0;
    }
  }

  private updateHeroMovement(dt: number): void {
    const target = this.hero.moveTarget;
    if (!target || this.hero.castTimer > 0.12) return;
    const remaining = distance(this.hero, target);
    if (remaining < 0.16) {
      this.hero.moveTarget = undefined;
      return;
    }
    const direction = normalize(this.hero, target);
    const speed = 4.6 * (this.hero.camouflage > 0 ? 1.28 : 1) * this.statMultiplier("moveSpeed", 1);
    const step = Math.min(remaining, speed * dt);
    this.hero.x = clamp(this.hero.x + direction.x * step, -WORLD_SIZE / 2, WORLD_SIZE / 2);
    this.hero.z = clamp(this.hero.z + direction.z * step, -WORLD_SIZE / 2, WORLD_SIZE / 2);
    this.movedSinceShot += step;
  }

  private updateHeroAttack(): void {
    const target = this.hero.attackTarget ? this.enemyMap.get(this.hero.attackTarget) : undefined;
    if (!target || target.state === "dead" || !target.visible) {
      this.hero.attackTarget = undefined;
      return;
    }
    const loadout = classLoadouts[this.hero.class];
    const ability = abilities[loadout.basic];
    const gap = distance(this.hero, target);
    if (gap > ability.range) {
      this.hero.moveTarget = { x: target.x, z: target.z };
      return;
    }
    this.hero.moveTarget = undefined;
    if (this.hero.attackTimer > 0 || this.hero.castTimer > 0) return;
    this.executeAbility(loadout.basic, target);
  }

  private updateEnemies(dt: number): void {
    for (const enemy of this.enemyMap.values()) {
      if (!enemy.visible || enemy.state === "dead") continue;
      enemy.attackTimer = Math.max(0, enemy.attackTimer - dt);
      enemy.burning = Math.max(0, enemy.burning - dt);
      enemy.slowed = Math.max(0, enemy.slowed - dt);
      enemy.rooted = Math.max(0, enemy.rooted - dt);
      if (enemy.burning > 0) this.damageEnemy(enemy, 2.2 * dt * this.statMultiplier("emberDamage", 1), false, "ember");
      if (enemy.hp <= 0) continue;

      const definition = enemies[enemy.type];
      const gap = distance(enemy, this.hero);
      const refugeProtected = distance(this.hero, { x: -28, z: -20 }) < 6.5;
      if (refugeProtected && !definition.boss) {
        enemy.state = "dormant";
        enemy.targetPoint = undefined;
        continue;
      }
      if (enemy.state === "dormant") {
        if (gap < (definition.boss ? 15 : 12)) enemy.state = "approach";
        continue;
      }
      if (enemy.state === "telegraph") {
        enemy.stateTimer -= dt;
        if (enemy.stateTimer <= 0) {
          enemy.state = "execute";
          enemy.stateTimer = 0.08;
          this.enemyAttack(enemy);
        }
        continue;
      }
      if (enemy.state === "execute" || enemy.state === "recover") {
        enemy.stateTimer -= dt;
        if (enemy.stateTimer <= 0) enemy.state = enemy.state === "execute" ? "recover" : "approach";
        if (enemy.state === "recover" && enemy.stateTimer <= 0) enemy.stateTimer = definition.recovery;
        continue;
      }

      const preferred = definition.range > 3 ? Math.max(4.8, definition.range * 0.72) : definition.range * 0.82;
      if (gap <= definition.range && enemy.attackTimer <= 0) {
        enemy.state = "telegraph";
        enemy.stateTimer = definition.telegraph;
        enemy.targetPoint = { x: this.hero.x, z: this.hero.z };
        this.emitFx("telegraph", enemy.x, enemy.z, enemy.type === "orison" ? 5.5 : enemy.type === "tollKeeper" ? 4.2 : Math.max(1.3, definition.radius * 2.1));
        if (definition.boss) this.pushEvent("danger", `${definition.name} prepares ${enemy.type === "orison" ? "a beam lattice" : "a chain sweep"}.`);
        continue;
      }
      if (enemy.rooted > 0) continue;
      const direction = normalize(enemy, this.hero);
      const speed = definition.speed * (enemy.slowed > 0 ? 0.55 : 1);
      const moveDirection = definition.range > 3 && gap < preferred * 0.7 ? -1 : 1;
      enemy.x += direction.x * speed * dt * moveDirection;
      enemy.z += direction.z * speed * dt * moveDirection;
      enemy.state = definition.range > 3 && moveDirection < 0 ? "reposition" : "approach";
    }
    this.resolveEnemySeparation();
  }

  private enemyAttack(enemy: Enemy): void {
    const definition = enemies[enemy.type];
    enemy.attackTimer = definition.attackPeriod;
    const targetPoint = enemy.targetPoint ?? this.hero;
    const veteran = this.options.difficulty === "veteran" ? 1.18 : 1;
    let damage = definition.damage * veteran * (enemy.elite ? 1.18 : 1);
    if (enemy.type === "tollKeeper") {
      const phase = enemy.hp / enemy.maxHp < 0.5 ? 2 : 1;
      enemy.phase = phase;
      this.areaDamageHero(enemy, phase === 2 ? 5 : 4, damage * (phase === 2 ? 1.15 : 1), "physical");
      if (phase === 2) this.spawnEnemy("mite", enemy.x + 3, enemy.z - 2);
    } else if (enemy.type === "orison") {
      const ratio = enemy.hp / enemy.maxHp;
      enemy.phase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
      this.addHazard("beam", targetPoint.x, targetPoint.z, 3.2 + enemy.phase * 0.6, 1.1, damage, true);
      if (enemy.phase >= 2 && this.random.next() < 0.45) this.addHazard("blight", this.hero.x + this.random.int(-4, 4), this.hero.z + this.random.int(-4, 4), 3, 4.5, 9, true);
    } else if (enemy.type === "mite") {
      this.areaDamageHero(enemy, 3, damage, "ember");
      this.damageEnemy(enemy, enemy.maxHp * 2, false, "ember");
    } else if (distance(targetPoint, this.hero) <= Math.max(1.8, definition.range * 0.5)) {
      this.damageHero(damage, definition.damageType, definition.name);
    }
    this.emitFx(definition.damageType === "physical" ? "hit" : definition.damageType, targetPoint.x, targetPoint.z, definition.boss ? 4 : 1.5, Math.round(damage));
  }

  private areaDamageHero(origin: Vec2, radius: number, damage: number, damageType: "physical" | "ember" | "frost" | "blight"): void {
    if (distance(origin, this.hero) <= radius) this.damageHero(damage, damageType, "area attack");
  }

  private resolveEnemySeparation(): void {
    const living = [...this.enemyMap.values()].filter((enemy) => enemy.visible && enemy.state !== "dead");
    for (let a = 0; a < living.length; a += 1) {
      for (let b = a + 1; b < living.length; b += 1) {
        const first = living[a];
        const second = living[b];
        const gap = distance(first, second);
        const minimum = (enemies[first.type].radius + enemies[second.type].radius) * 0.75;
        if (gap <= 0.001 || gap >= minimum) continue;
        const direction = normalize(first, second);
        const push = (minimum - gap) * 0.2;
        first.x -= direction.x * push;
        first.z -= direction.z * push;
        second.x += direction.x * push;
        second.z += direction.z * push;
      }
    }
  }

  private updateHazards(dt: number): void {
    for (let index = this.hazards.length - 1; index >= 0; index -= 1) {
      const hazard = this.hazards[index];
      hazard.time += dt;
      hazard.tick -= dt;
      if (hazard.kind === "snare") {
        for (const enemy of this.enemiesInRadius(hazard, hazard.radius)) {
          enemy.rooted = Math.max(enemy.rooted, enemies[enemy.type].boss ? 0 : 0.35);
          enemy.slowed = Math.max(enemy.slowed, 1);
        }
      }
      if (hazard.tick <= 0) {
        hazard.tick = 0.45;
        if (hazard.hostile && distance(hazard, this.hero) <= hazard.radius) this.damageHero(hazard.damage, hazard.kind === "beam" ? "frost" : "blight", hazard.kind);
        if (!hazard.hostile && ["ember", "blight"].includes(hazard.kind)) {
          for (const enemy of this.enemiesInRadius(hazard, hazard.radius)) this.damageEnemy(enemy, hazard.damage, false, hazard.kind === "ember" ? "ember" : "blight");
        }
      }
      if (hazard.time >= hazard.duration) this.hazards.splice(index, 1);
    }
  }

  private updatePickups(): void {
    for (const pickup of [...this.pickupMap.values()]) {
      if (distance(pickup, this.hero) > 1.45) continue;
      if (pickup.kind === "gold") {
        this.hero.gold += pickup.amount;
        this.pickupMap.delete(pickup.id);
      } else if (pickup.kind === "dust") {
        this.hero.dust += pickup.amount;
        this.pickupMap.delete(pickup.id);
      } else if (pickup.kind === "potion" && this.hero.potions < this.hero.maxPotions) {
        this.hero.potions = Math.min(this.hero.maxPotions, this.hero.potions + pickup.amount);
        this.pickupMap.delete(pickup.id);
      }
    }
  }

  moveTo(point: Vec2): void {
    if (!this.running || this.paused) return;
    this.hero.moveTarget = { x: clamp(point.x, -WORLD_SIZE / 2, WORLD_SIZE / 2), z: clamp(point.z, -WORLD_SIZE / 2, WORLD_SIZE / 2) };
    this.hero.attackTarget = undefined;
  }

  attack(enemyId: number): void {
    if(this.paused || !this.running)return;
    const enemy = this.enemyMap.get(enemyId);
    if (!enemy || enemy.state === "dead" || !enemy.visible) return;
    this.hero.attackTarget = enemyId;
    this.hero.moveTarget = undefined;
  }

  cast(id: SkillId, point?: Vec2, targetId?: number): boolean {
    if(this.paused || !this.running)return false;
    const ability = abilities[id];
    if (ability.class !== this.hero.class) return false;
    if ((this.cooldowns.get(id) ?? 0) > 0 || this.hero.castTimer > 0) return false;
    if(id==='furnaceHeart'&&this.hero.heat<30){this.pushEvent('info','Furnace Heart requires 30 Heat.');return false;}
    const cost=ability.cost*Math.max(.4,2-this.statMultiplier('focusCost',1));
    if (this.hero.focus < cost) {
      this.pushEvent("info", "Not enough Focus.");
      return false;
    }
    const target = targetId ? this.enemyMap.get(targetId) : undefined;
    if (ability.targeting === "target" && !target) return false;
    this.hero.focus -= cost;
    this.hero.castTimer = ability.castTime;
    this.hero.camouflage = 0;
    this.cooldowns.set(id, ability.cooldown*Math.max(.45,2-this.statMultiplier('cooldown',1)));
    this.executeAbility(id, target, point);
    return true;
  }

  private executeAbility(id: SkillId, target?: Enemy, point?: Vec2): void {
    const ability = abilities[id];
    const aim = point ?? target ?? this.hero.moveTarget ?? { x: this.hero.x + 1, z: this.hero.z };
    const direction = normalize(this.hero, aim);
    const furnaceMultiplier = this.hero.furnace > 0 ? 1.32 : 1;
    const rankBonus = 1 + (this.hero.skills[id]??0)*.12;
    const capstoneBonus = this.hero.skills.capstone === 1 ? (this.hero.class==='cinder' && this.hero.heat>=30 ? 1.25 : this.hero.class==='ranger' ? 1.15 : 1) : 1;
    const baseDamage = this.hero.damage * ability.coefficient * rankBonus * capstoneBonus * furnaceMultiplier * this.statMultiplier(`${ability.damageType}Damage`, 1) * this.statMultiplier(this.hero.class==='cinder'?'cinderSkill':'rangerSkill',1);
    let critical = this.random.next() < this.hero.critChance * this.statMultiplier("critChance", 1);
    const damage = baseDamage * (critical ? 1.7 + this.statMultiplier("critDamage", 0) * 0.01 : 1);

    if (id === "ironLitany" || id === "quickshot") {
      if (!target) return;
      if (id === "ironLitany") {
        this.attackSequence = (this.attackSequence + 1) % 3;
        this.damageEnemy(target, damage * (this.attackSequence === 0 ? 1.35 : 1), critical, "physical");
        if (this.attackSequence === 0) for (const enemy of this.enemiesInRadius(target, 2.4)) if (enemy.id !== target.id) this.damageEnemy(enemy, damage * 0.45, false, "physical");
        this.hero.heat = Math.min(100, this.hero.heat + 8*this.statMultiplier('heatGain',1));
      } else {
        const traceBonus = this.movedSinceShot >= 2 ? 0.18 : 0;
        this.damageEnemy(target, damage * (1 + traceBonus*this.statMultiplier('traceDamage',1)), critical, "physical");
        if (traceBonus > 0) target.stagger = Math.min(3, target.stagger + 1);
        this.movedSinceShot = 0;
      }
      this.hero.focus = Math.min(this.hero.maxFocus, this.hero.focus + 11 * this.statMultiplier("focusGain", 1));
      this.hero.attackTimer = (this.hero.class === "cinder" ? 0.72 : 0.55)/this.statMultiplier('attackSpeed',1);
      this.emitFx(critical ? "crit" : "hit", target.x, target.z, 1.2, Math.round(damage));
      return;
    }

    switch (id) {
      case "brandArc":
      case "splinterVolley": {
        const radius = id === "brandArc" ? 4.6 : 8;
        for (const enemy of this.enemiesInCone(this.hero, direction, radius, id === "brandArc" ? 0.2 : 0.45)) {
          const burningBonus = id === "brandArc" && enemy.burning > 0 ? 1.35 : 1;
          this.damageEnemy(enemy, damage * burningBonus, critical, ability.damageType);
          if (id === "brandArc") enemy.burning = 3.2;
        }
        this.emitFx(id === "brandArc" ? "ember" : "hit", this.hero.x + direction.x * 2, this.hero.z + direction.z * 2, radius * 0.65, Math.round(damage));
        break;
      }
      case "bastionStep": {
        this.hero.x += direction.x * 5;
        this.hero.z += direction.z * 5;
        this.hero.guard = 2*this.statMultiplier('guardDuration',1);
        for (const enemy of this.enemiesInRadius(this.hero, 2.2)) this.damageEnemy(enemy, damage, false, "physical");
        this.emitFx("evade", this.hero.x, this.hero.z, 2);
        break;
      }
      case "cinderRing": {
        for (const enemy of this.enemiesInRadius(this.hero, 5.5)) {
          this.damageEnemy(enemy, damage, critical, "ember");
          enemy.burning = 4;
        }
        this.addHazard("ember", this.hero.x, this.hero.z, 5.5, 2.2, damage * 0.12, false);
        this.emitFx("ember", this.hero.x, this.hero.z, 5.5, Math.round(damage));
        break;
      }
      case "vowChain": {
        const hit = this.closestAlongLine(direction, 11);
        if (hit) {
          this.damageEnemy(hit, damage, critical, "physical");
          const pull = normalize(hit, this.hero);
          if (!enemies[hit.type].boss) { hit.x += pull.x * 3.5; hit.z += pull.z * 3.5; }
          else { this.hero.x -= pull.x * 2.5; this.hero.z -= pull.z * 2.5; }
        }
        this.emitFx("hit", this.hero.x + direction.x * 5, this.hero.z + direction.z * 5, 1.2, Math.round(damage));
        break;
      }
      case "furnaceHeart":
        if (this.hero.heat >= 30) { this.hero.heat -= 30; this.hero.furnace = 8; this.emitFx("ember", this.hero.x, this.hero.z, 2.4); }
        else this.pushEvent("info", "Furnace Heart requires 30 Heat.");
        break;
      case "ashenStandard":
        this.addHazard("standard", aim.x, aim.z, 5, 9, 0, false);
        this.hero.guard = 9*this.statMultiplier('guardDuration',1);
        break;
      case "ghostline": {
        for (const enemy of this.enemiesAlongLine(direction, 15, 1.2)) {
          const traces = Math.floor(enemy.stagger);
          this.damageEnemy(enemy, damage * (1 + traces * 0.32*this.statMultiplier('markedDamage',1)), critical, "physical");
          enemy.stagger = 0;
        }
        this.emitFx("crit", this.hero.x + direction.x * 7, this.hero.z + direction.z * 7, 1.1, Math.round(damage));
        break;
      }
      case "snareBloom":
        this.addHazard("snare", aim.x, aim.z, 3.4, 5.5, damage * 0.18, false);
        for(const enemy of this.enemiesInRadius(aim,3.4))this.damageEnemy(enemy,damage*this.statMultiplier('trapDamage',1),false,'blight');
        this.emitFx("blight", aim.x, aim.z, 3.4);
        break;
      case "mothcloak":
        this.hero.camouflage = 1.5;
        this.hero.invulnerable = 0.45;
        this.emitFx("evade", this.hero.x, this.hero.z, 2.3);
        break;
      case "backstepFlask": {
        const origin = { x: this.hero.x, z: this.hero.z };
        this.hero.x -= direction.x * 4.5;
        this.hero.z -= direction.z * 4.5;
        this.addHazard("blight", origin.x, origin.z, 3.2, 5, damage * 0.16, false);
        this.emitFx("blight", origin.x, origin.z, 3.2);
        break;
      }
      case "horizonCall":
        for (const enemy of this.enemiesAlongLine(direction, 17, 3)) this.damageEnemy(enemy, damage, critical, "physical");
        this.emitFx("crit", this.hero.x + direction.x * 8, this.hero.z + direction.z * 8, 5, Math.round(damage));
        break;
    }
  }

  evade(toward?: Vec2): boolean {
    if(this.paused || !this.running)return false;
    if (this.hero.evadeCharges <= 0 || this.hero.castTimer > 0.4) return false;
    const target = toward ?? this.hero.moveTarget ?? { x: this.hero.x + 1, z: this.hero.z };
    const direction = normalize(this.hero, target);
    this.hero.x = clamp(this.hero.x + direction.x * 4.5, -WORLD_SIZE / 2, WORLD_SIZE / 2);
    this.hero.z = clamp(this.hero.z + direction.z * 4.5, -WORLD_SIZE / 2, WORLD_SIZE / 2);
    this.hero.evadeCharges -= 1;
    this.hero.invulnerable = 0.18;
    this.hero.moveTarget = undefined;
    this.emitFx("evade", this.hero.x, this.hero.z, 2.3);
    return true;
  }

  usePotion(): boolean {
    if(this.paused || !this.running)return false;
    if (this.hero.potions <= 0 || this.hero.hp >= this.hero.maxHp) return false;
    this.hero.potions -= 1;
    const amount = this.hero.maxHp * 0.42 * this.statMultiplier("potionHeal", 1);
    this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + amount);
    this.emitFx("heal", this.hero.x, this.hero.z, 1.8, Math.round(amount));
    return true;
  }

  interact(): string | undefined {
    if(this.paused || !this.running)return undefined;
    const pickup = this.nearestPickup(2.6);
    if (pickup?.kind === "item" && pickup.item) {
      if (this.hero.inventory.length >= 24) return "Inventory full.";
      const packed = placeInventory([...this.hero.inventory, pickup.item]);
      if(packed.some(item=>item.x===undefined)){this.pushEvent('info','No room in the field pack. Equip or salvage an item.');return 'Inventory full.';}
      this.hero.inventory = packed;
      this.pickupMap.delete(pickup.id);
      this.pushEvent("loot", `${pickup.item.name} collected.`);
      return pickup.item.name;
    }
    const locations: Record<Exclude<QuestStep, "complete">, Vec2> = {
      keeper: { x: -25, z: -18 }, waypoint: { x: -7, z: -5 }, tollKeeper: { x: 10, z: 5 }, artificer: { x: 17, z: 11 }, orison: { x: 32, z: 20 },
    };
    if (this.questStep === "complete") return undefined;
    const marker = locations[this.questStep];
    if (distance(this.hero, marker) > (this.questStep === "tollKeeper" || this.questStep === "orison" ? 7 : 4.2)) return undefined;
    if (this.questStep === "keeper") {
      this.questStep = "waypoint";
      this.pushEvent("quest", "Find the Ashway waypoint across the Soot March.");
      return "Warden Maelin opens the frontier gate.";
    }
    if (this.questStep === "waypoint") {
      this.waypointActive = true;
      this.questStep = "tollKeeper";
      this.syncStageVisibility();
      this.pushEvent("quest", "Ashway restored. The Toll-Keeper stirs ahead.");
      this.emitFx("level", marker.x, marker.z, 4);
      return "Ashway activated.";
    }
    if (this.questStep === "artificer") {
      this.artificerRescued = true;
      this.questStep = "orison";
      this.syncStageVisibility();
      this.pushEvent("quest", "Artificer Sable is free. Enter the engine vault.");
      return "Sable returns to Ember Refuge.";
    }
    return undefined;
  }

  townGate(): boolean {
    if (!this.waypointActive) return false;
    this.hero.x = -27;
    this.hero.z = -20;
    this.hero.moveTarget = undefined;
    this.hero.attackTarget = undefined;
    this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + this.hero.maxHp * 0.3);
    this.pushEvent("info", "The Ashway returns you to Ember Refuge.");
    return true;
  }

  equip(itemId: string): boolean {
    const index = this.hero.inventory.findIndex((item) => item.id === itemId);
    if (index < 0) return false;
    const item = this.hero.inventory[index];
    if (item.classTag && item.classTag !== this.hero.class) return false;
    const slot = item.slot;
    const current = this.hero.equipment[slot];
    this.hero.equipment[slot] = item;
    this.hero.inventory.splice(index, 1);
    if (current) this.hero.inventory.push(current);
    this.hero.inventory = placeInventory(this.hero.inventory.map((entry) => ({ ...entry, x: undefined, y: undefined })));
    this.recalculateHero();
    return true;
  }

  salvage(itemId: string): boolean {
    const index = this.hero.inventory.findIndex((item) => item.id === itemId && !item.favorite && item.rarity !== 'relic');
    if (index < 0) return false;
    const [item] = this.hero.inventory.splice(index, 1);
    this.hero.dust += item.rarity === "relic" ? 18 : item.rarity === "inscribed" ? 9 : item.rarity === "tempered" ? 4 : 1;
    this.hero.inventory = placeInventory(this.hero.inventory.map((entry) => ({ ...entry, x: undefined, y: undefined })));
    return true;
  }

  toggleFavorite(itemId: string): void {
    const item = this.hero.inventory.find((entry) => entry.id === itemId);
    if (item) item.favorite = !item.favorite;
  }

  allocateSkill(id: SkillId): boolean {
    if (abilities[id].class !== this.hero.class || this.hero.skillPoints <= 0 || (this.hero.skills[id] ?? 0) >= 3) return false;
    this.hero.skills[id] = (this.hero.skills[id] ?? 0) + 1;
    this.hero.skillPoints -= 1;
    return true;
  }

  respec(): boolean {
    const invested = Object.values(this.hero.skills).reduce((sum, value) => sum + value, 0);
    const cost = this.hero.level <= 8 ? 0 : invested * 50;
    if (this.hero.gold < cost) return false;
    this.hero.gold -= cost;
    this.hero.skillPoints += invested;
    this.hero.skills = {};
    return true;
  }

  allocateAttribute(stat: 'might'|'finesse'|'will'|'vigor'): boolean {
    if(this.hero.attributePoints<1)return false;
    this.hero.attributes??={might:0,finesse:0,will:0,vigor:0};
    this.hero.attributes[stat]++;this.hero.attributePoints--;this.recalculateHero();return true;
  }

  selectCapstone(choice:1|2):boolean {
    if(this.hero.level<15)return false;
    this.hero.skills.capstone=choice;this.recalculateHero();return true;
  }

  refine(itemId:string):boolean {
    const item=this.hero.inventory.find(i=>i.id===itemId);
    if(!item || !this.artificerRescued || this.hero.dust<4 || this.hero.gold<20)return false;
    this.hero.dust-=4;this.hero.gold-=20;item.damage+=item.slot==='weapon'?3:0;item.armor+=item.slot!=='weapon'?2:0;item.itemLevel++;return true;
  }

  restock():boolean {
    if(this.zone!=='refuge'||this.hero.gold<15)return false;
    this.hero.gold-=15;this.hero.potions=this.hero.maxPotions;this.hero.hp=this.hero.maxHp;this.hero.focus=this.hero.maxFocus;return true;
  }

  private damageEnemy(enemy: Enemy, amount: number, critical: boolean, damageType: "physical" | "ember" | "frost" | "blight"): void {
    if (enemy.state === "dead") return;
    const gap=distance(this.hero,enemy);
    amount*=gap<3?this.statMultiplier('closeDamage',1):gap>6?this.statMultiplier('distanceDamage',1):1;
    if(enemy.hp/enemy.maxHp<.3)amount*=this.statMultiplier('executeDamage',1);
    if(this.hero.hp/this.hero.maxHp<.35)amount*=this.statMultiplier('lowHealthDamage',1);
    amount+=(this.statMultiplier('flatPhysical',0)+this.statMultiplier('flatEmber',0)+this.statMultiplier('flatFrost',0)+this.statMultiplier('flatBlight',0))*100;
    enemy.hp -= amount;
    if (damageType === "ember" && this.random.next() < 0.35) enemy.burning = Math.max(enemy.burning, 3);
    if(this.random.next()<this.statMultiplier('burnChance',0))enemy.burning=Math.max(enemy.burning,2);
    if(this.random.next()<this.statMultiplier('slowChance',0))enemy.slowed=Math.max(enemy.slowed,2);
    if (damageType === "frost") enemy.slowed = Math.max(enemy.slowed, 2);
    if (critical) this.emitFx("crit", enemy.x, enemy.z, 1.2, Math.round(amount));
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  private killEnemy(enemy: Enemy): void {
    if (enemy.state === "dead") return;
    enemy.hp = 0;
    enemy.state = "dead";
    enemy.stateTimer = 2;
    this.hero.kills += 1;
    const definition = enemies[enemy.type];
    this.grantXp(definition.xp * (this.options.difficulty === "veteran" ? 1.2 : 1));
    this.dropLoot(enemy);
    if (enemy.type === "tollKeeper" && this.questStep === "tollKeeper") {
      this.questStep = "artificer";
      this.pushEvent("quest", "The Toll-Keeper has fallen. Search the Archive approach for Sable.");
    }
    if (enemy.type === "orison" && this.questStep === "orison") {
      this.questStep = "complete";
      this.veteranUnlocked = true;
      this.victory = true;
      this.pushEvent("quest", "The Orison Engine is silent. Veteran difficulty is unlocked.");
    }
  }

  private grantXp(amount: number): void {
    this.hero.xp += amount;
    while (this.hero.xp >= this.hero.xpNext && this.hero.level < 20) {
      this.hero.xp -= this.hero.xpNext;
      this.hero.level += 1;
      this.hero.xpNext = Math.round(this.hero.xpNext * 1.22 + 30);
      this.hero.skillPoints += 1;
      if (this.hero.level % 2 === 0) this.hero.attributePoints += 1;
      this.hero.maxHp += this.hero.class === "cinder" ? 18 : 13;
      this.hero.hp = this.hero.maxHp;
      this.hero.damage += 2;
      this.pushEvent("level", `Level ${this.hero.level}. A skill point is ready.`);
      this.emitFx("level", this.hero.x, this.hero.z, 4);
    }
  }

  private dropLoot(enemy: Enemy): void {
    if (enemy.lootDropped) return;
    enemy.lootDropped = true;
    const boss = enemies[enemy.type].boss ?? false;
    const gold = Math.round((boss ? this.random.int(55, 90) : this.random.int(4, 13))*this.statMultiplier('goldFind',1));
    this.addPickup("gold", enemy.x + 0.4, enemy.z, gold, `${gold} gold`);
    if (this.random.next() < 0.17) this.addPickup("potion", enemy.x - 0.4, enemy.z + 0.2, 1, "Votive draught");
    if (boss || enemy.elite || this.random.next() < 0.28) {
      const forced = boss ? this.bossRewardPity>=3 ? 'relic' as const : undefined : undefined;
      const item = generateItem(this.options.seed ^ enemy.id ^ Math.round(this.time * 100), Math.max(1, this.hero.level + (boss ? 2 : 0)), this.hero.class, boss, forced);
      this.addPickup("item", enemy.x, enemy.z + 0.7, 1, item.name, item);
      if (boss) this.bossRewardPity += 1;
    }
  }

  private addPickup(kind: Pickup["kind"], x: number, z: number, amount: number, label: string, item?: LootItem): void {
    const pickup: Pickup = { id: this.nextId++, kind, x, z, amount, label, item, rarity: item?.rarity };
    this.pickupMap.set(pickup.id, pickup);
    this.emitFx("loot", x, z, item?.rarity === "relic" ? 2.5 : 1.3);
  }

  private damageHero(amount: number, damageType: "physical" | "ember" | "frost" | "blight", source: string): void {
    if (this.hero.invulnerable > 0 || this.hero.camouflage > 0) return;
    const armorReduction = damageType === "physical" ? this.hero.armor / (this.hero.armor + amount * 12 + 80) : 0.08;
    const guardReduction = this.hero.guard > 0 ? (this.hero.skills.capstone===2 ? .5 : .35) : this.hero.skills.capstone===2 ? .12 : 0;
    const resistance=Math.min(.7,this.statMultiplier('allResist',0)+this.statMultiplier(`${damageType}Resist`,0));
    const blocked=this.random.next()<Math.min(.45,this.statMultiplier('blockChance',0))?.5:1;
    const finalDamage = Math.max(1, amount * (1 - armorReduction) * (1 - guardReduction)*(1-resistance)*blocked);
    this.hero.hp -= finalDamage;
    if (this.hero.class === "cinder") this.hero.heat = Math.min(100, this.hero.heat + finalDamage * 0.6);
    this.emitFx(damageType === "physical" ? "hit" : damageType, this.hero.x, this.hero.z, 1.4, Math.round(finalDamage));
    if (this.hero.hp <= 0) this.handleDeath(source, damageType);
  }

  private handleDeath(source: string, damageType: string): void {
    const lost = Math.floor(this.hero.gold * 0.1);
    this.hero.gold -= lost;
    this.hero.deaths += 1;
    this.hero.hp = this.hero.maxHp;
    this.hero.focus = this.hero.maxFocus * 0.5;
    this.hero.x = this.waypointActive ? -7 : -27;
    this.hero.z = this.waypointActive ? -5 : -20;
    this.hero.moveTarget = undefined;
    this.hero.attackTarget = undefined;
    this.pushEvent("danger", `${source} dealt fatal ${damageType} damage. Echo lost ${lost} gold.`);
  }

  private recalculateHero(): void {
    const items = Object.values(this.hero.equipment).filter(Boolean) as LootItem[];
    this.hero.damage = (this.hero.class === "cinder" ? 20 : 18) + (this.hero.level-1)*2 + (this.hero.attributes?.might??0)*2 + items.reduce((sum, item) => sum + item.damage, 0);
    this.hero.armor = (this.hero.class === "cinder" ? 18 : 9) + items.reduce((sum, item) => sum + item.armor, 0) + this.statMultiplier('armor',0)*100;
    const healthBonus = items.flatMap((item) => item.affixes).filter((affix) => affix.stat === "maxHealth").reduce((sum, affix) => sum + affix.value, 0);
    this.hero.maxHp = (this.hero.class === "cinder" ? 230 : 175) + (this.hero.level - 1) * (this.hero.class === "cinder" ? 18 : 13) + healthBonus + (this.hero.attributes?.vigor??0)*15;
    this.hero.damage+=this.statMultiplier('might',0)*200;
    this.hero.maxHp+=this.statMultiplier('vigor',0)*1500;
    this.hero.maxFocus=100+(this.hero.attributes?.will??0)*8+this.statMultiplier('maxFocus',0)*100+this.statMultiplier('will',0)*800;
    this.hero.critChance=(this.hero.class==='cinder'?.08:.14)+(this.hero.attributes?.finesse??0)*.01+this.statMultiplier('finesse',0);
    this.hero.maxPotions=5+Math.min(2,Math.floor(this.statMultiplier('potionCapacity',0)*10));
    this.hero.hp = Math.min(this.hero.hp, this.hero.maxHp);
  }

  private statMultiplier(stat: string, base: number): number {
    const affixes = (Object.values(this.hero.equipment).filter(Boolean) as LootItem[]).flatMap((item) => item.affixes);
    const total = affixes.filter((affix) => affix.stat === stat).reduce((sum, affix) => sum + affix.value, 0);
    return base + total / 100;
  }

  private addHazard(kind: Hazard["kind"], x: number, z: number, radius: number, duration: number, damage: number, hostile: boolean): void {
    this.hazards.push({ id: this.nextId++, kind, x, z, radius, duration, damage, hostile, time: 0, tick: kind === "beam" ? 0.85 : 0 });
  }

  private enemiesInRadius(origin: Vec2, radius: number): Enemy[] {
    return [...this.enemyMap.values()].filter((enemy) => enemy.visible && enemy.state !== "dead" && distance(enemy, origin) <= radius);
  }

  private enemiesInCone(origin: Vec2, direction: Vec2, range: number, minimumDot: number): Enemy[] {
    return [...this.enemyMap.values()].filter((enemy) => {
      if (!enemy.visible || enemy.state === "dead" || distance(origin, enemy) > range) return false;
      const toward = normalize(origin, enemy);
      return toward.x * direction.x + toward.z * direction.z >= minimumDot;
    });
  }

  private enemiesAlongLine(direction: Vec2, range: number, width: number): Enemy[] {
    return [...this.enemyMap.values()].filter((enemy) => {
      if (!enemy.visible || enemy.state === "dead") return false;
      const dx = enemy.x - this.hero.x;
      const dz = enemy.z - this.hero.z;
      const projection = dx * direction.x + dz * direction.z;
      const perpendicular = Math.abs(dx * direction.z - dz * direction.x);
      return projection > 0 && projection <= range && perpendicular <= width;
    });
  }

  private closestAlongLine(direction: Vec2, range: number): Enemy | undefined {
    return this.enemiesAlongLine(direction, range, 1.35).sort((a, b) => distance(this.hero, a) - distance(this.hero, b))[0];
  }

  private nearestPickup(radius: number): Pickup | undefined {
    return [...this.pickupMap.values()].filter((pickup) => distance(pickup, this.hero) <= radius).sort((a, b) => distance(a, this.hero) - distance(b, this.hero))[0];
  }

  private emitFx(kind: CombatFx["kind"], x: number, z: number, radius: number, value?: number, text?: string): void {
    this.effects.push({ id: this.fxId++, kind, x, z, radius, value, text });
    if(this.effects.length>120)this.effects.shift();
  }

  private pushEvent(kind: GameEvent["kind"], text: string): void {
    this.events.unshift({ id: this.eventId++, kind, text, time: this.time });
    if (this.events.length > 7) this.events.length = 7;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  get zone(): Zone {
    if (this.hero.x < -21) return "refuge";
    if (this.hero.x < 13) return "march";
    if (this.hero.x < 28) return "archive";
    return "engine";
  }

  getSnapshot(fps: number): GameSnapshot {
    const [questTitle, questDetail] = questText[this.questStep];
    const boss = [...this.enemyMap.values()].find((enemy) => enemy.visible && enemy.state !== "dead" && enemies[enemy.type].boss && distance(enemy, this.hero) < 18);
    return {
      running: this.running,
      paused: this.paused,
      time: this.time,
      zone: this.zone,
      difficulty: this.options.difficulty,
      hero: structuredClone(this.hero),
      questStep: this.questStep,
      questTitle,
      questDetail,
      enemiesAlive: [...this.enemyMap.values()].filter((enemy) => enemy.visible && enemy.state !== "dead").length,
      boss: boss ? { name: enemies[boss.type].name, hp: boss.hp, maxHp: boss.maxHp, phase: boss.phase } : undefined,
      events: this.events.map((event) => ({ ...event })),
      nearbyPickup: this.nearestPickup(3),
      waypointActive: this.waypointActive,
      artificerRescued: this.artificerRescued,
      veteranUnlocked: this.veteranUnlocked,
      victory: this.victory,
      seed: this.options.seed,
      fps,
    };
  }
}

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}
