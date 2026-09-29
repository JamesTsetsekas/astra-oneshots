import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Entity } from './types';
import { RIDGES, BRIDGES } from './world';

const mat=(color:number,emissive=0,metalness=.3)=>new T.MeshStandardMaterial({color,emissive,emissiveIntensity:.6,metalness,roughness:.62,flatShading:true});
function part(root:T.Group,g:T.BufferGeometry,m:T.Material,x=0,y=0,z=0,sx=1,sy=1,sz=1){const a=new T.Mesh(g,m);a.position.set(x,y,z);a.scale.set(sx,sy,sz);a.castShadow=a.receiveShadow=true;root.add(a);return a;}
const box=(r:T.Group,m:T.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>part(r,new T.BoxGeometry(w,h,d),m,x,y,z);
const orb=(r:T.Group,m:T.Material,x:number,y:number,z:number,s:number,sx=1,sy=1,sz=1)=>part(r,new T.IcosahedronGeometry(s,1),m,x,y,z,sx,sy,sz);
function beam(r:T.Group,m:T.Material,a:T.Vector3,b:T.Vector3,width:number){const p=part(r,new T.CylinderGeometry(width,width,a.distanceTo(b),6),m);p.position.copy(a).add(b).multiplyScalar(.5);p.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());return p;}
function consolidate(root:T.Group){const buckets=new Map<T.Material,T.BufferGeometry[]>();for(const child of [...root.children])if(child instanceof T.Mesh&&!child.name){child.updateMatrix();const geometry=(child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone()).applyMatrix4(child.matrix);const m=child.material as T.Material;const arr=buckets.get(m)??[];arr.push(geometry);buckets.set(m,arr);root.remove(child);child.geometry.dispose();}for(const [m,geos]of buckets){const geo=mergeGeometries(geos,false);if(geo){const p=part(root,geo,m);p.name='hull';}geos.forEach(g=>g.dispose());}}

/** Original modular walkers and asymmetrical bio-synthetic organisms. Forward is +Z. */
export function makeUnit(e:Entity):T.Group{
 const r=new T.Group(),helix=e.faction==='helix',type=e.type,large=type==='heavy'?1.5:type==='siege'?1.2:type==='guard'?1.3:1;
 const armor=mat(helix?0xc4cecb:0x597f6c,0,helix?.55:.08),dark=mat(0x25363b),edge=mat(helix?0x778e91:0x95b390),accent=mat(e.team==='ai'?0xef665c:helix?0xe9b365:0xc79be4,e.team==='ai'?0xa23027:helix?0xaa6b24:0x734998),glass=mat(0x1c4149,0x2d7d8a,.7);
 if(helix){
  if(type==='scout'||type==='healer'||type==='siege'){
   box(r,dark,0,.48,0,1.3,.42,1.8);box(r,armor,0,.88,0,1.18,.5,1.6);
   for(const x of [-.8,.8])for(const z of [-.65,.65]){const w=part(r,new T.CylinderGeometry(.36,.36,.28,10),dark,x,.4,z);w.rotation.z=Math.PI/2;const hub=part(r,new T.CylinderGeometry(.17,.17,.3,8),edge,x,.4,z);hub.rotation.z=Math.PI/2;}
   if(type==='scout'){box(r,glass,0,1.17,.3,.82,.19,.65);box(r,accent,0,.83,1,.62,.12,.12);beam(r,dark,new T.Vector3(.45,1,-.5),new T.Vector3(.45,2,-.5),.045);}
   if(type==='siege'){part(r,new T.CylinderGeometry(.62,.7,.4,8),armor,0,1.32,0);const gun=part(r,new T.CylinderGeometry(.15,.24,2.35,8),dark,0,1.7,.9);gun.rotation.x=Math.PI/2-.27;box(r,accent,0,1.75,1.8,.33,.22,.35);}
   if(type==='healer'){orb(r,glass,0,1.4,0,.55);box(r,accent,0,1.5,.5,.15,.65,.08);box(r,accent,0,1.5,.5,.65,.15,.08);for(const x of [-1,1])beam(r,edge,new T.Vector3(x*.45,1,0),new T.Vector3(x*.95,1.7,.4),.08);}
  }else{
   box(r,dark,0,1.15,0,.8,.45,.66);const torso=box(r,armor,0,1.65,0,1.12,.7,.75);torso.rotation.x=-.08;box(r,edge,0,1.74,.42,.95,.38,.16);box(r,glass,0,2.08,.24,.48,.28,.39);box(r,accent,0,2.08,.46,.38,.065,.02);
   for(const side of [-1,1]){const leg=new T.Group();leg.name=`leg${side}`;leg.position.set(side*.39,1.15,0);r.add(leg);box(leg,dark,0,-.28,0,.23,.62,.25);box(leg,armor,0,-.63,.12,.35,.4,.42);box(leg,dark,0,-.92,.23,.42,.18,.62);orb(r,edge,0,-.43,.08,.18);box(r,armor,side*.68,1.72,0,.38,.4,.62);}
   if(type==='worker'){for(const side of [-1,1]){beam(r,dark,new T.Vector3(side*.65,1.65,0),new T.Vector3(side*.7,1.05,.65),.09);box(r,accent,side*.7,1.06,.7,.24,.25,.26);}box(r,dark,0,1.5,-.5,.55,.5,.3);}
   else{box(r,dark,.76,1.38,.56,.25,.25,type==='lancer'?1.85:1.15);box(r,accent,.76,1.38,type==='lancer'?1.55:1.1,.22,.12,.18);if(type==='heavy'){box(r,armor,-.86,1.28,.43,.7,1.05,.25);box(r,accent,-.86,1.28,.59,.6,.12,.05);}}
  }
 }else{
  const shell=orb(r,armor,0,1.03,0,.7,type==='guard'?1.3:1,type==='soldier'||type==='guard'?.68:1.15,1.2);shell.rotation.z=.12;
  for(let n=0;n<3;n++){const p=orb(r,edge,0,1.25+n*.12,-.45+n*.36,.5,1.2,.35,.6);p.rotation.x=.25;}
  const count=type==='heavy'?6:4;for(let i=0;i<count;i++){const a=i/count*Math.PI*2;const leg=new T.Group();leg.name=`leg${i}`;leg.position.set(Math.cos(a)*.45,.85,Math.sin(a)*.45);r.add(leg);beam(leg,dark,new T.Vector3(),new T.Vector3(Math.cos(a)*.5,-.25,Math.sin(a)*.5),.095);beam(leg,edge,new T.Vector3(Math.cos(a)*.5,-.25,Math.sin(a)*.5),new T.Vector3(Math.cos(a)*.65,-.75,Math.sin(a)*.6+.2),.055);}
  orb(r,accent,.12,1,.68,.24,.8,.6,1);for(const s of [-1,1]){const horn=part(r,new T.ConeGeometry(.13,type==='heavy'?1.6:.85,5),edge,s*.36,1.6,.25);horn.rotation.z=s*-.5;}
  if(type==='scout'){for(const side of [-1,1]){const wing=orb(r,accent,side*.9,1.32,0,.6,1.45,.08,.6);wing.name=`wing${side}`;wing.rotation.z=side*.2;}}
  if(type==='lancer'||type==='siege'){for(const s of [-1,1]){const stalk=part(r,new T.ConeGeometry(.18,1.8,7),dark,s*.45,1.85,-.25);stalk.rotation.z=s*.25;orb(r,accent,s*.65,2.65,-.25,.27);} }
  if(type==='healer'){const halo=part(r,new T.TorusGeometry(.65,.055,5,20),accent,0,2.1,0);halo.rotation.x=Math.PI/2;halo.name='halo';}
 }
 if(type==='worker'){const cargo=orb(r,mat(0x8becdc,0x399f95),0,1.78,-.55,.32);cargo.name='cargo';cargo.visible=false;}
 r.scale.setScalar(large);consolidate(r);return r;
}

export function makeBuilding(e:Entity):T.Group{
 const r=new T.Group(),helix=e.faction==='helix',type=e.type,radius=e.radius;
 const armor=mat(helix?0xa6b6b4:0x658673,0,helix?.6:.05),dark=mat(0x243338),edge=mat(helix?0x526b70:0x98b99b),accent=mat(e.team==='ai'?0xed6959:helix?0xe9b96e:0xc19add,e.team==='ai'?0x87281d:helix?0xa86b29:0x764999),glass=mat(0x235b66,0x24606a);
 const base=part(r,new T.CylinderGeometry(radius*.88,radius,.36,8),dark,0,.18,0);base.rotation.y=Math.PI/8;
 if(helix){
  if(type==='hq'){
   box(r,armor,0,1.05,0,4.2,1.65,3.6);box(r,dark,0,1.5,0,3.5,1,3.1);box(r,armor,0,2.35,-.4,2.6,1.35,2.4);box(r,glass,0,2.45,.85,2.4,.55,.06);box(r,edge,0,3.13,-.4,2.8,.24,2.6);
   for(const s of [-1,1]){box(r,armor,s*2.2,.72,.25,1.1,1.15,2.8);box(r,accent,s*2.2,1.33,.25,.75,.1,2.2);box(r,dark,s*1.45,.8,2,.7,1.2,.45);}
   const antenna=part(r,new T.CylinderGeometry(.09,.16,2.9,8),edge,.8,4.15,-1);const dish=part(r,new T.TorusGeometry(.65,.11,6,20),accent,.8,5.1,-1);dish.rotation.x=.35;antenna.name='antenna';
  }else if(type==='barracks'){
   box(r,armor,0,1.15,0,4,1.9,3.65);box(r,dark,0,1.05,1.87,2.7,1.75,.06);for(const x of [-1.65,1.65])box(r,accent,x,1.25,1.9,.12,1.6,.1);for(let i=0;i<4;i++)box(r,edge,0,2.22,-1.2+i*.75,4.15,.18,.32);box(r,glass,0,1.15,1.93,2.2,.13,.05);
  }else if(type==='tech'){
   for(const s of [-1,1]){box(r,armor,s*1.25,1.5,0,1.5,2.6,2.7);for(let i=0;i<3;i++)box(r,glass,s*1.25,1+i*.55,1.38,1.25,.22,.04);}part(r,new T.CylinderGeometry(.7,1,3.8,8),dark,0,2.1,0);const h=part(r,new T.TorusGeometry(1.1,.13,8,24),accent,0,3.6,0);h.rotation.x=Math.PI/2;h.name='halo';
  }else if(type==='supply'){
   part(r,new T.CylinderGeometry(.28,.75,3,8),armor,0,1.65,0);for(const s of [-1,1]){box(r,dark,s*.65,2.75,0,.75,1,.7);box(r,accent,s*.65,2.75,.37,.58,.75,.07);}box(r,edge,0,3.4,0,2.2,.22,1);
  }else if(type==='turret'){
   part(r,new T.CylinderGeometry(.55,.95,1.8,8),armor,0,1.2,0);box(r,armor,0,2.3,0,1.45,.65,1.05);for(const s of [-1,1]){box(r,dark,s*.36,2.32,.95,.2,.2,1.3);box(r,accent,s*.36,2.32,1.62,.16,.13,.08);}
  }else{
   for(let i=0;i<3;i++){const a=i/3*Math.PI*2;box(r,armor,Math.cos(a)*1.1,1,Math.sin(a)*1.1,.65,1.7,.65);}part(r,new T.CylinderGeometry(.65,.8,1.7,10),glass,0,1.3,0);const h=part(r,new T.TorusGeometry(1,.12,6,24),accent,0,2.1,0);h.rotation.x=Math.PI/2;h.name='halo';
  }
  for(let i=0;i<4;i++){const a=i/4*Math.PI*2+Math.PI/4;box(r,accent,Math.cos(a)*radius*.79,.43,Math.sin(a)*radius*.79,.28,.08,.28);}
 }else{
  const height=type==='hq'?4.1:type==='supply'?3.6:2.9;
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2;beam(r,dark,new T.Vector3(Math.cos(a)*radius*.92,.2,Math.sin(a)*radius*.92),new T.Vector3(Math.cos(a)*radius*.3,height*.7,Math.sin(a)*radius*.3),.2);const petal=orb(r,armor,Math.cos(a)*radius*.45,height*.43,Math.sin(a)*radius*.45,radius*.48,.7,height/(radius*.85),.45);petal.rotation.z=Math.cos(a)*-.27;petal.rotation.x=Math.sin(a)*.27;orb(r,accent,Math.cos(a)*radius*.65,height*.69,Math.sin(a)*radius*.65,.18);}
  orb(r,accent,0,height*.77,0,radius*.32,.8,1.2,.8);if(type==='turret'||type==='tech'){part(r,new T.ConeGeometry(.35,2.7,7),edge,0,height+.4,0);}
 }
 consolidate(r);return r;
}

export function terrain(scene:T.Scene):T.Mesh{
 const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=1152;const c=canvas.getContext('2d')!;
 let seed=113;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 c.fillStyle='#546563';c.fillRect(0,0,canvas.width,canvas.height);
 for(let i=0;i<11000;i++){const x=rnd()*1536,y=rnd()*1152,s=1+rnd()*12;c.fillStyle=`rgba(${rnd()>.5?'167,168,143':'26,45,43'},${.025+rnd()*.09})`;c.fillRect(x,y,s,s*.6);}
 for(let i=0;i<70;i++){const x=rnd()*1536,y=rnd()*1152,s=15+rnd()*60;const g=c.createRadialGradient(x,y,0,x,y,s);g.addColorStop(0,'#3f504f66');g.addColorStop(1,'#3f504f00');c.fillStyle=g;c.fillRect(x-s,y-s,s*2,s*2);}
 const road=(points:number[][],width:number)=>{c.strokeStyle='#a1a08a38';c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();points.forEach(([x,z],i)=>i?c.lineTo((x+60)*12.8,(z+45)*12.8):c.moveTo((x+60)*12.8,(z+45)*12.8));c.stroke();};
 road([[-48,31],[-27,16],[-12,22],[12,22],[32,11],[48,-31]],90);road([[-48,31],[-32,-8],[-12,-22],[12,-22],[32,-16],[48,-31]],75);road([[-32,14],[-14,0],[14,0],[32,-14]],58);
 for(const [x,z]of [[-45,30],[45,-30]]){c.strokeStyle='#c1b79544';c.lineWidth=3;c.beginPath();c.arc((x+60)*12.8,(z+45)*12.8,125,0,Math.PI*2);c.stroke();}
 const tx=new T.CanvasTexture(canvas);tx.colorSpace=T.SRGBColorSpace;tx.anisotropy=8;
 const ground=new T.Mesh(new T.PlaneGeometry(180,140),new T.MeshStandardMaterial({map:tx,roughness:1,color:0xbfc7bb}));
 // The playable texture maps to the 120 × 90 field; surrounding ground prevents camera voids.
 ground.geometry.dispose();ground.geometry=new T.PlaneGeometry(120,90);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.userData.ground=true;scene.add(ground);
 const outer=new T.Mesh(new T.PlaneGeometry(220,170),mat(0x3e504c));outer.rotation.x=-Math.PI/2;outer.position.y=-.08;scene.add(outer);
 const rockMat=mat(0x526369),capMat=mat(0x9bada5),seamMat=mat(0x4b958e,0x29665f);
 const group=new T.Group();scene.add(group);
 for(const ridge of RIDGES){for(let i=0;i<6;i++){const x=(i%2-.5)*ridge.width*.65,z=ridge.z+(Math.floor(i/2)-1)*ridge.depth*.3;const p=part(group,new T.CylinderGeometry(2.6,3.7,ridge.height,5),rockMat,x,ridge.height/2-.25,z,1,1,1.35);p.rotation.y=i*.6;const cap=part(group,new T.CylinderGeometry(2.55,2.7,.35,5),capMat,x,ridge.height-.2,z,1,1,1.35);cap.rotation.y=p.rotation.y;}}
 for(const z of BRIDGES){box(group,rockMat,0,.04,z,14,.08,7);for(const side of [-1,1]){box(group,capMat,0,.3,z+side*3.4,14,.5,.45);for(let i=-6;i<=6;i+=3)box(group,seamMat,i,.59,z+side*3.4,.2,.05,.5);}for(let i=-5;i<=5;i++)box(group,capMat,i*1.1,.09,z,.08,.01,6.2);}
 for(let i=0;i<150;i++){const x=(rnd()-.5)*166,z=(rnd()-.5)*126;if(Math.abs(x)<58&&Math.abs(z)<43)continue;const h=1+rnd()*5;const p=part(group,new T.IcosahedronGeometry(1,0),rockMat,x,h*.35,z,1+rnd()*3,h,1+rnd()*3);p.rotation.set(rnd(),rnd(),rnd());}
 for(let i=0;i<65;i++){const x=(rnd()-.5)*116,z=(rnd()-.5)*86;if(Math.abs(x)<12||Math.hypot(x+45,z-30)<13||Math.hypot(x-45,z+30)<13)continue;const p=part(group,new T.IcosahedronGeometry(.23+rnd()*.35,0),rockMat,x,.1,z,1,.45,1);p.rotation.y=rnd()*6;}
 consolidate(group);return ground;
}

export function animateModel(body:T.Group,moving:boolean,time:number,attacking:boolean,reduced:boolean){
 if(reduced)return;
 body.children.forEach((p,i)=>{if(p.name.startsWith('leg'))p.rotation.x=moving?Math.sin(time*10+i*2.6)*.48:0;if(p.name.startsWith('wing'))p.rotation.z=Math.sin(time*9+i)*.18;if(p.name==='halo')p.rotation.z=time*.7;});
 body.position.y=moving?Math.abs(Math.sin(time*10))*.045:Math.sin(time*1.6)*.013;
 body.rotation.x=attacking?-.06:0;
}
