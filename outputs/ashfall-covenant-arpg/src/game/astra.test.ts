import {describe,it,expect} from 'vitest';
import {GameSimulation} from './simulation';
import {classLoadouts, enemies} from './content';
import {generateItem,placeInventory} from './loot';
import type {GameOptions,HeroClass} from './types';

const options:GameOptions={heroClass:'cinder',heroName:'Astra',difficulty:'normal',seed:55881};
const tick=(s:GameSimulation,n=30)=>{for(let i=0;i<n;i++)s.update(1/30);};

describe('Astra gameplay regressions',()=>{
  it('keeps saved inventory placements non-overlapping on pickup',()=>{
    const items=Array.from({length:9},(_,i)=>generateItem(313+i,2,'cinder'));
    const packed=placeInventory(placeInventory(items.slice(0,5)).concat(items.slice(5)));
    const cells=new Set<string>();
    for(const item of packed){expect(item.x).toBeDefined();for(let y=item.y!;y<item.y!+item.size[1];y++)for(let x=item.x!;x<item.x!+item.size[0];x++){expect(cells.has(`${x},${y}`)).toBe(false);cells.add(`${x},${y}`);}}
  });
  it('always creates a class-compatible starter weapon',()=>{
    for(let seed=1;seed<30;seed++){const s=new GameSimulation({...options,seed});expect(s.hero.equipment.weapon?.slot).toBe('weapon');}
  });
  it('pauses resource spending, evade, attacks and movement',()=>{
    const s=new GameSimulation(options);s.setPaused(true);const before=structuredClone(s.hero);
    expect(s.cast('cinderRing')).toBe(false);expect(s.evade()).toBe(false);s.moveTo({x:30,z:20});tick(s,60);expect(s.hero).toEqual(before);
  });
  it('rejects Furnace Heart before spending Focus or cooldown',()=>{
    const s=new GameSimulation(options);const focus=s.hero.focus;expect(s.cast('furnaceHeart')).toBe(false);expect(s.hero.focus).toBe(focus);expect(s.cooldowns.get('furnaceHeart')).toBe(0);
  });
  it('replays a hunt retaining owned equipment and character progression',()=>{
    const s=new GameSimulation(options);s.hero.level=7;s.hero.gold=811;
    const r=new GameSimulation({...options,targetHunt:true,difficulty:'veteran'},{...options,hero:s.hero,questStep:'complete',waypointActive:true,artificerRescued:true,veteranUnlocked:true});
    expect(r.hero.level).toBe(7);expect(r.hero.gold).toBe(811);expect(r.hero.equipment).toEqual(s.hero.equipment);expect(r.questStep).toBe('orison');expect(r.hero.x).toBe(21);
  });
  it('makes rank allocation strengthen its own ability',()=>{
    const damage=(rank:number)=>{const s=new GameSimulation(options);s.hero.skills.cinderRing=rank;s.hero.x=-20;s.hero.z=-15;const enemy=[...s.enemyMap.values()][0];enemy.x=-19;enemy.z=-15;enemy.hp=10000;const before=enemy.hp;s.cast('cinderRing');return before-enemy.hp;};
    expect(damage(3)).toBeGreaterThan(damage(0));
  });
  it('makes attributes, protected Relics and refining actionable',()=>{
    const s=new GameSimulation(options);s.hero.attributePoints=1;const hp=s.hero.maxHp;expect(s.allocateAttribute('vigor')).toBe(true);expect(s.hero.maxHp).toBe(hp+15);
    const relic=generateItem(51,8,'cinder',true,'relic');s.hero.inventory.push(relic);expect(s.salvage(relic.id)).toBe(false);
    s.artificerRescued=true;s.hero.dust=4;s.hero.gold=20;expect(s.refine(relic.id)).toBe(true);expect(s.hero.dust).toBe(0);expect(s.hero.gold).toBe(0);
  });
});

// Drives only the same public intents as the browser. No combat values or enemies are modified.
function completeAct(heroClass:HeroClass){
  const s=new GameSimulation({...options,heroClass});
  for(let frame=0;frame<30*900&&!s.victory;frame++){
    if(frame%6===0){
      s.interact();
      if(s.hero.hp<s.hero.maxHp*.48)s.usePotion();
      for(const item of [...s.hero.inventory])s.equip(item.id);
      const goal={keeper:{x:-25,z:-18},waypoint:{x:-7,z:-5},tollKeeper:{x:10,z:5},artificer:{x:17,z:11},orison:{x:32,z:20},complete:{x:32,z:20}}[s.questStep];
      const targets=[...s.enemyMap.values()].filter(e=>e.visible&&e.state!=='dead').sort((a,b)=>Math.hypot(a.x-s.hero.x,a.z-s.hero.z)-Math.hypot(b.x-s.hero.x,b.z-s.hero.z));
      const enemy=targets[0];const gap=enemy?Math.hypot(enemy.x-s.hero.x,enemy.z-s.hero.z):100;
      if(enemy&&gap<11&&s.questStep!=='keeper'){
        s.attack(enemy.id);
        const loadout=classLoadouts[heroClass];s.cast(loadout.core,enemy);
        for(const skill of loadout.keys)s.cast(skill,enemy);
        if(enemy.state==='telegraph'&&gap<(enemies[enemy.type].boss?5:2.5))s.evade({x:s.hero.x+(s.hero.z-enemy.z)*2,z:s.hero.z-(s.hero.x-enemy.x)*2});
      } else s.moveTo(goal);
      if(s.zone==='refuge'&&s.hero.gold>=15&&s.hero.potions<2)s.restock();
    }
    s.update(1/30);
  }
  return s;
}

describe('complete expedition intent playback',()=>{
  for(const heroClass of ['cinder','ranger'] as const)it(`${heroClass} reaches the act result and earns boss loot`,()=>{
    const s=completeAct(heroClass);
    expect(s.questStep,`${heroClass}: ${s.hero.kills} kills / ${s.hero.deaths} deaths at ${s.time.toFixed(0)}s`).toBe('complete');
    expect(s.veteranUnlocked).toBe(true);expect(s.hero.kills).toBeGreaterThan(10);
    expect([...s.pickupMap.values()].some(p=>p.item&&['inscribed','relic'].includes(p.item.rarity))).toBe(true);
  });
});
