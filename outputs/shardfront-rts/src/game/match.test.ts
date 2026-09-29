import {it,expect}from'vitest';
import{GameSimulation}from'./simulation';
import{buildings,units}from'./data';
import type{BuildingType,UnitType}from'./types';

/** Scripted commander uses only the same validated public commands as the UI. */
it('completes an economy-to-combat skirmish through public player commands',()=>{
 const s=new GameSimulation({faction:'helix',difficulty:'easy',mode:'skirmish'});
 for(let tick=0;tick<18000&&!s.result;tick++){
  if(tick%60===0){
   const own=[...s.entities.values()].filter(e=>e.team==='player'&&e.deathTimer===undefined),workers=own.filter(e=>e.type==='worker'),hq=own.find(e=>e.type==='hq')!;
   if(!hq)break;
   const build=(type:BuildingType)=>{const cost=buildings[type].cost;if(s.economy.player.ore<cost.ore||s.economy.player.flux<cost.flux)return;const w=workers.find(e=>!own.some(b=>b.kind==='building'&&!b.complete&&Math.hypot(e.x-b.x,e.z-b.z)<b.radius+4));if(!w)return;s.select([w.id]);if(type==='extractor'){const n=s.nodes.find(n=>n.kind==='flux'&&n.x<0&&n.z>15)!;s.build(type,n.x,n.z);return;}for(let z=12;z<=40;z+=5)for(let x=-54;x<=-24;x+=5)if(s.placementValid(type,x,z)&&s.build(type,x,z))return;};
   if(workers.length<10&&hq.queue.length<2){s.select([hq.id]);s.train('worker');}
   if(s.economy.player.supplyCap-s.economy.player.supplyUsed<8&&!own.some(e=>e.type==='supply'&&!e.complete))build('supply');
   if(own.filter(e=>e.type==='barracks').length<2)build('barracks');
   if(!own.some(e=>e.type==='extractor'))build('extractor');
   if(!own.some(e=>e.type==='tech')&&s.economy.player.gatheredFlux>80)build('tech');
   const extractor=own.find(e=>e.type==='extractor'&&e.complete);
   for(const [i,w]of workers.entries()){
    if(own.some(b=>b.kind==='building'&&!b.complete&&Math.hypot(w.x-b.x,w.z-b.z)<b.radius+4))continue;
    if(w.order!=='gather'||(extractor&&i<3&&s.nodes.find(n=>n.id===w.gatherNodeId)?.kind!=='flux')){const kind=extractor&&i<3?'flux':'ore';const n=s.nodes.filter(n=>n.kind===kind&&n.amount>0&&Math.hypot(n.x-hq.x,n.z-hq.z)<25).sort((a,b)=>Math.hypot(w.x-a.x,w.z-a.z)-Math.hypot(w.x-b.x,w.z-b.z))[i%3];if(n){s.select([w.id]);s.commandGather(n.id);}}
   }
   for(const b of own.filter(e=>e.kind==='building'&&e.complete&&(e.type==='barracks'||e.type==='tech')&&e.queue.length<2)){s.select([b.id]);const type:UnitType=b.type==='tech'?'siege':tick%180===0?'lancer':tick%240===0?'healer':'soldier';if(s.economy.player.ore>=units[type].cost.ore)s.train(type);s.setRally({x:-22,z:18});}
   const army=own.filter(e=>e.kind==='unit'&&!['worker','scout'].includes(e.type));
   if(army.length>=13||s.time>420){s.select(army.filter(e=>e.order!=='attackMove'&&e.order!=='attack').map(e=>e.id));s.commandMove({x:45,z:-30},true);}
  }
  s.update(.05);
 }
 expect(s.economy.player.gatheredOre).toBeGreaterThan(1500);
 expect(s.economy.player.gatheredFlux).toBeGreaterThan(100);
 expect(s.economy.player.unitsCreated).toBeGreaterThan(20);
 expect(s.result,`Match did not resolve; ${s.stateHash()} ${s.time}`).toBeDefined();
},30000);
