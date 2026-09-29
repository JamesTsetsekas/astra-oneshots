import { affixCatalog, itemBases } from "./content";
import type { Affix, HeroClass, ItemRarity, LootItem } from "./types";

export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    let value = this.state += 0x6d2b79f5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(values: readonly T[]): T {
    return values[this.int(0, values.length - 1)];
  }
}

const rarityAffixes: Record<ItemRarity, [number, number]> = {
  worn: [0, 0],
  tempered: [1, 2],
  inscribed: [3, 4],
  relic: [2, 3],
};

const relicPowers = [
  "Blocking a heavy hit releases a ring of cinders.",
  "Trace detonations chain once to a nearby marked enemy.",
  "Evading through an enemy restores 8 Focus.",
  "Burning enemies deal 10% less damage to you.",
  "Potions leave a brief restorative star-metal field.",
  "Every fifth core skill costs no Focus.",
  "Elite kills reset one evade charge.",
  "Boss stagger windows last 20% longer.",
];

export function rarityForRoll(roll: number, luck = 0, boss = false): ItemRarity {
  if (boss && roll > 0.92 - luck) return "relic";
  if (boss || roll > 0.75 - luck) return "inscribed";
  if (roll > 0.28) return "tempered";
  return "worn";
}

export function generateItem(seed: number, level: number, heroClass: HeroClass, boss = false, forcedRarity?: ItemRarity): LootItem {
  const random = new SeededRandom(seed);
  const compatible = itemBases.filter((base) => !base.classTag || base.classTag === heroClass);
  const base = random.pick(compatible);
  const rarity = forcedRarity ?? rarityForRoll(random.next(), Math.min(0.08, level * 0.002), boss);
  const [minimum, maximum] = rarityAffixes[rarity];
  const unsupported = new Set(['frostDamage','poisonChance','staggerResist','retaliation','dustFind']);
  const cinderOnly = new Set(['emberDamage','heatGain','cinderSkill','guardDuration']);
  const rangerOnly = new Set(['blightDamage','traceDamage','trapDamage','rangerSkill','markedDamage']);
  const pool=affixCatalog.filter(row=>!unsupported.has(row[2])&&!(heroClass==='cinder'&&rangerOnly.has(row[2]))&&!(heroClass==='ranger'&&cinderOnly.has(row[2])));
  const count = random.int(minimum, maximum);
  const affixes: Affix[] = [];
  const used = new Set<string>();
  for (let i = 0; i < count; i += 1) {
    let row = random.pick(pool);
    let safety = 0;
    while (used.has(row[2]) && safety++ < 20) row = random.pick(pool);
    used.add(row[2]);
    const tier = Math.max(1, Math.min(5, Math.ceil((level + random.int(-2, 4)) / 4)));
    affixes.push({
      id: row[0],
      name: row[1],
      stat: row[2],
      value: Math.round((2.5 + tier * 2.2 + random.next() * (3 + tier)) * 10) / 10,
      tier,
      prefix: i % 2 === 0,
    });
  }
  const prefix = affixes.find((affix) => affix.prefix)?.name;
  const suffix = affixes.find((affix) => !affix.prefix)?.name;
  const levelScale = 1 + level * 0.075;
  return {
    id: `itm-${seed.toString(16)}-${level}`,
    baseId: base.id,
    name: rarity === "relic" ? `Starfallen ${base.name}` : `${prefix ? `${prefix} ` : ""}${base.name}${suffix ? ` ${suffix}` : ""}`,
    slot: base.slot,
    rarity,
    itemLevel: level,
    affixes,
    armor: Math.round(base.armor * levelScale),
    damage: Math.round(base.damage * levelScale),
    size: base.size,
    classTag: base.classTag,
    special: rarity === "relic" ? random.pick(relicPowers) : undefined,
    favorite: false,
    identified: rarity !== "relic" || boss,
    durability: 100,
  };
}

export function itemPower(item: LootItem): number {
  return item.damage * 2 + item.armor + item.affixes.reduce((sum, affix) => sum + affix.value * affix.tier, 0) + (item.special ? 45 : 0);
}

export function placeInventory(items: LootItem[]): LootItem[] {
  const occupied = Array.from({ length: 6 }, () => Array.from({ length: 10 }, () => false));
  return items.map((item) => {
    const [width, height] = item.size;
    for (let y = 0; y <= 6 - height; y += 1) {
      for (let x = 0; x <= 10 - width; x += 1) {
        let clear = true;
        for (let cy = y; cy < y + height; cy += 1) for (let cx = x; cx < x + width; cx += 1) if (occupied[cy][cx]) clear = false;
        if (!clear) continue;
        for (let cy = y; cy < y + height; cy += 1) for (let cx = x; cx < x + width; cx += 1) occupied[cy][cx] = true;
        return { ...item, x, y };
      }
    }
    return { ...item, x: undefined, y: undefined };
  });
}
