import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Scene } from '@babylonjs/core/scene';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import '@babylonjs/core/Rendering/outlineRenderer';
import type { EnemyType, HeroClass } from './types';

export interface Rig {
  root: TransformNode;
  meshes: Mesh[];
  arms: TransformNode[];
  legs: TransformNode[];
  torso: TransformNode;
  weapon?: TransformNode;
  cloak?: Mesh;
  kind: string;
}

function mat(scene: Scene, name: string, color: string, glow = 0): StandardMaterial {
  const found = scene.getMaterialByName(name);
  if (found) return found as StandardMaterial;
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(color);
  m.specularColor = new Color3(.04, .04, .035);
  m.emissiveColor = m.diffuseColor.scale(glow);
  return m;
}

export function createActor(scene: Scene, kind: HeroClass | EnemyType, shadow?: ShadowGenerator): Rig {
  const root = new TransformNode(kind, scene);
  const torso = new TransformNode(`${kind} chest pivot`, scene); torso.parent = root;
  const rig: Rig = { root, torso, meshes: [], arms: [], legs: [], kind };
  const hero = kind === 'cinder' || kind === 'ranger';
  const mechanical = ['warden', 'orison', 'tollKeeper'].includes(kind);
  const cloth = mat(scene, `${kind} cloth`, hero ? (kind === 'cinder' ? '#763e32' : '#265951') : kind === 'adept' ? '#594657' : '#494945');
  const armor = mat(scene, `${kind} metal`, hero ? '#9eaaae' : mechanical ? '#6c797a' : '#626359');
  const dark = mat(scene, 'joint leather', '#242c2b');
  const brass = mat(scene, 'aged gold', '#a38851');
  const bone = mat(scene, 'bone faces', '#b5afa0');
  const glow = mat(scene, `${kind} eye light`, hero || kind === 'orison' || kind === 'warden' ? '#64d8ce' : '#f49253', .9);
  const add = (m: Mesh, material: StandardMaterial, p: TransformNode, x: number, y: number, z: number) => {
    m.material = material; m.parent = p; m.position.set(x, y, z); m.isPickable = false; m.receiveShadows = true; rig.meshes.push(m); shadow?.addShadowCaster(m); return m;
  };
  const box = (name: string, w: number, h: number, d: number, m: StandardMaterial, p: TransformNode, x=0,y=0,z=0) => add(MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene),m,p,x,y,z);
  const ball = (name: string, w: number,h:number,d:number,m:StandardMaterial,p:TransformNode,x=0,y=0,z=0) => add(MeshBuilder.CreateSphere(name,{diameter:1,segments:8},scene),m,p,x,y,z).scaling.set(w,h,d);
  const tube = (name:string,h:number,top:number,bottom:number,m:StandardMaterial,p:TransformNode,x=0,y=0,z=0) => add(MeshBuilder.CreateCylinder(name,{height:h,diameterTop:top,diameterBottom:bottom,tessellation:8},scene),m,p,x,y,z);
  const pivot = (name:string,p:TransformNode,x:number,y:number,z:number) => { const n=new TransformNode(name,scene);n.parent=p;n.position.set(x,y,z);return n; };

  if (['crawler','hound','mite','swarm'].includes(kind)) {
    const spider = kind==='crawler'||kind==='mite'||kind==='swarm';
    torso.position.y = spider ? .62 : .83;
    ball('carapace',spider?1.2:.82,.8,spider?1.3:1.8,armor,torso,0,0,-.14);
    ball('low skull',.63,.59,.71,bone,torso,0,.05,.88);
    for(const side of [-1,1]) {
      ball('ember eye',.12,.12,.12,glow,torso,side*.22,.15,1.19);
      for(let i=0;i<(spider?3:2);i++) {
        const leg=pivot('jointed leg',torso,side*.42,-.06,(i-(spider?1:.5))*.65);rig.legs.push(leg);
        const limb=tube('shin',.65,.15,.11,dark,leg,side*.22,-.25,0);limb.rotation.z=side*.85;
        tube('claw',.38,.12,.05,bone,leg,side*.47,-.58,.09);
      }
    }
    for(let i=0;i<3;i++) { const thorn=tube('spine',.42,0,.23,bone,torso,0,.45,(i-1)*.35);thorn.rotation.x=-.35; }
    if(kind==='mite') ball('lantern sac',.72,.82,.8,glow,torso,0,.12,-.48);
  } else if(kind==='orison') {
    torso.position.y=2.4;
    ball('engine heart',2.4,2.8,2.4,dark,torso);
    ball('buried star',1.7,1.7,1.7,glow,torso,0,.25,.65);
    for(let n=0;n<3;n++) { const ring=add(MeshBuilder.CreateTorus('armillary ring',{diameter:3.4+n*.55,thickness:.16,tessellation:32},scene),brass,torso,0,.3,0);ring.rotation.set(n*.66,.2,n*.85);rig.arms.push(ring); }
    for(const side of [-1,1]) {
      const arm=pivot('engine limb',torso,side*1.35,.25,0);rig.legs.push(arm);
      const bonePart=tube('engine limb',2.7,.52,.75,armor,arm,side*.7,-1,0);bonePart.rotation.z=side*.6;
      box('engine foot',1.5,.5,2,brass,arm,side*1.5,-2.3,.4);
      box('shoulder fin',.35,2.5,1,armor,torso,side*1.5,.7,-.2).rotation.z=-side*.5;
    }
  } else {
    const bulky = kind==='cinder'||kind==='husk'||kind==='tollKeeper'||kind==='warden';
    torso.position.y=1.3;
    tube('layered cuirass',.95,bulky?1.12:.78,bulky?.75:.54,armor,torso,0,.19,0);
    box('breastplate',bulky?.73:.52,.63,.16,hero?brass:dark,torso,0,.27,.37);
    tube('belt',.16,.8,.8,brass,torso,0,-.29,0);
    box('belt clasp',.17,.22,.1,glow,torso,0,-.28,.43);
    const robe = ['scribe','adept','pilgrim'].includes(kind);
    if(robe) tube('layered robe',1.3,.7,1.3,cloth,torso,0,-.62,-.02);
    for(const side of [-1,1]) {
      const leg=pivot('hip',root,side*.25,.93,0);rig.legs.push(leg);
      tube('greave',.66,.27,.22,armor,leg,0,-.29,0);
      box('boot',.3,.25,.53,dark,leg,0,-.77,.1);
      const arm=pivot('shoulder',torso,side*(bulky?.62:.45),.51,0);rig.arms.push(arm);
      ball('pauldron',bulky?.61:.38,.35,.6,hero?brass:armor,arm,0,.02,0);
      tube('upper arm',.55,.28,.22,cloth,arm,0,-.3,0);
      tube('gauntlet',.48,.29,.24,armor,arm,0,-.74,.04);
    }
    ball('head',.53,.63,.54,hero?armor:bone,torso,0,1.03,.03);
    if(kind==='ranger'||robe) {
      ball('hood',.7,.65,.65,cloth,torso,0,1.13,-.06);
      box('face shadow',.34,.37,.1,dark,torso,0,1.08,.28);
    } else {
      box('helmet brow',.65,.13,.58,armor,torso,0,1.16,.05);
      box('visor',.49,.1,.08,dark,torso,0,1.01,.34);
      box('visor light',.34,.035,.09,glow,torso,0,1.01,.35);
    }
    const cape=add(MeshBuilder.CreateCylinder('split mantle',{height:1.46,diameterTop:.65,diameterBottom:1.18,tessellation:4,arc:.5,cap:Mesh.NO_CAP},scene),cloth,torso,0,-.08,-.23);cape.rotation.y=Math.PI;rig.cloak=cape;
    const weapon=pivot('weapon',rig.arms[1],0,-.83,.13);rig.weapon=weapon;
    if(kind==='ranger'||kind==='archer') {
      const bow=add(MeshBuilder.CreateTube('recurve bow',{path:Array.from({length:17},(_,i)=>new Vector3(0,Math.cos(i/16*Math.PI)*.8,Math.sin(i/16*Math.PI)*.42)),radius:.045,tessellation:6},scene),brass,weapon,0,.25,.35);
      bow.rotation.y=.12;
      box('arrow shaft',.035,.035,1.5,bone,weapon,0,.23,.55);
      tube('quiver',.85,.35,.3,dark,torso,-.3,.1,-.43).rotation.z=-.3;
      for(let a=0;a<3;a++) tube('quiver arrow',.55,.025,.025,bone,torso,-.3+a*.08,.68,-.47);
    } else if(robe) {
      tube('ritual staff',2.25,.085,.085,brass,weapon,0,.7,.04);
      ball('star staff',.42,.55,.42,glow,weapon,0,1.84,.04);
    } else {
      tube('mace haft',1.45,.1,.12,dark,weapon,0,.46,.08);
      const head=box('flanged mace',.5,.48,.5,armor,weapon,0,1.18,.08);head.rotation.y=Math.PI/4;
      box('mace light',.08,.55,.08,glow,weapon,0,1.18,.36);
      const shield=box('tower shield',.12,1.3,.9,hero?cloth:armor,rig.arms[0],-.12,-.59,.19);shield.rotation.z=-.13;
      box('shield ridge',.15,1.2,.12,brass,rig.arms[0],-.19,-.59,.19);
    }
    if(kind==='tollKeeper') {
      root.scaling.setAll(1.8);
      for(const side of [-1,1]) { const horn=tube('keeper horn',.85,0,.23,brass,torso,side*.35,1.62,0);horn.rotation.z=-side*.4; }
      for(let n=0;n<6;n++) { const link=add(MeshBuilder.CreateTorus('chain link',{diameter:.26,thickness:.05,tessellation:8},scene),brass,weapon,.15+n*.14,-.1-n*.2,.1);link.rotation.x=n%2?Math.PI/2:0; }
    } else if(kind==='husk') root.scaling.set(1.3,1.22,1.3);
  }
  return rig;
}

export function animateRig(rig: Rig, time: number, moving: boolean, attack: number, telegraph=0): void {
  const gait=Math.sin(time*9.5);
  rig.legs.forEach((leg,i)=> { leg.rotation.x=moving?gait*(i%2?1:-1)*.55:Math.sin(time*2+i)*.018; });
  rig.arms.forEach((arm,i)=> {
    if(rig.kind==='orison') {arm.rotation.y=time*(i%2?.3:-.2); return;}
    arm.rotation.x = moving ? gait*(i%2?-1:1)*.25 : 0;
    if(i===1) arm.rotation.x -= attack*1.6 + telegraph*.8;
    arm.rotation.z = i===1 ? attack*.45 : -.08;
  });
  rig.torso.rotation.y=Math.sin(attack*Math.PI)*.35;
  rig.torso.rotation.x=telegraph*-.18;
  if(rig.cloak) rig.cloak.rotation.x=.08+Math.sin(time*4)*.05+(moving?.22:0);
}

export function dressWorld(scene: Scene, shadow: ShadowGenerator, seed: number): void {
  let state=seed>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const stone=mat(scene,'dressing limestone','#777b73');
  const darkStone=mat(scene,'crypt basalt','#404e50');
  const pale=mat(scene,'carved edges','#a5a58e');
  const brass=mat(scene,'aged gold','#a38851');
  const wood=mat(scene,'charred branch','#3b3932');
  const fire=mat(scene,'dressing flame','#ffaf67',1);
  const pavement=[mat(scene,'pavement slate','#575d54'),mat(scene,'pavement worn','#64695e')];
  const batches=new Map<StandardMaterial,Mesh[]>();
  const add=(mesh:Mesh,m:StandardMaterial,x:number,y:number,z:number,ry=0)=>{mesh.material=m;mesh.position.set(x,y,z);mesh.rotation.y=ry;mesh.isPickable=false;mesh.receiveShadows=true;const list=batches.get(m)??[];list.push(mesh);batches.set(m,list);return mesh;};
  const box=(w:number,h:number,d:number,m:StandardMaterial,x:number,y:number,z:number,ry=0)=>add(MeshBuilder.CreateBox('masonry',{width:w,height:h,depth:d},scene),m,x,y,z,ry);
  const cylinder=(h:number,top:number,bottom:number,m:StandardMaterial,x:number,y:number,z:number)=>add(MeshBuilder.CreateCylinder('dressed column',{height:h,diameterTop:top,diameterBottom:bottom,tessellation:8},scene),m,x,y,z);
  const texture=new DynamicTexture('hand laid ground',{width:2048,height:2048},scene,false);
  const ctx=texture.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle='#343c36';ctx.fillRect(0,0,2048,2048);
  for(let i=0;i<65000;i++){const v=38+random()*25;ctx.fillStyle=`rgba(${v+5},${v+6},${v},.35)`;ctx.fillRect(random()*2048,random()*2048,1+random()*5,1+random()*4);}
  const map=(v:number)=>(v+39)/78*2048;
  ctx.strokeStyle='#696b5c';ctx.lineWidth=210;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(map(-31),map(24));ctx.lineTo(map(33),map(-21));ctx.stroke();
  for(let i=0;i<16000;i++) {const x=random()*78-39,z=random()*78-39;if(Math.abs(z-(x*.68-1))>4.3)continue;ctx.fillStyle=`rgba(${90+random()*25},${92+random()*25},${82+random()*20},.2)`;ctx.fillRect(map(x),map(-z),3+random()*12,3+random()*10);}
  texture.update();
  const ground=scene.getMeshByName('ash field');
  if(ground) {const earth=mat(scene,'painted terrain','#d8d6b9');earth.diffuseTexture=texture;earth.specularColor.set(.015,.02,.015);ground.material=earth;}
  scene.meshes.filter(m=>m.name==='broken causeway').forEach(m=>m.setEnabled(false));
  const farGround=MeshBuilder.CreateGround('distant ash terrain',{width:240,height:240},scene);farGround.position.y=-.18;farGround.material=mat(scene,'distant earth','#343d36');farGround.isPickable=false;
  // Small, non-identical flagstones add scale instead of a single flat strip.
  for(let row=0;row<100;row++){
    const x=-31+row*.67,z=x*.68-1;
    for(let col=-2;col<=2;col++){
      if(random()<.12)continue;
      const slab=box(.72+random()*.3,.035,1.2+random()*.28,pavement[random()>.6?1:0],x+col*.96,.035,z-col*1.39,-.6+(random()-.5)*.06);
      slab.visibility=.9;
    }
  }
  const brick=new DynamicTexture('weathered stone courses',{width:256,height:256},scene,false);
  const bc=brick.getContext() as CanvasRenderingContext2D;
  bc.fillStyle='#6d7168';bc.fillRect(0,0,256,256);
  for(let row=0;row<8;row++)for(let col=-1;col<5;col++){
    const c=96+random()*34;bc.fillStyle=`rgb(${c+5},${c+7},${c})`;bc.fillRect(col*64+(row%2)*32+2,row*32+2,60,28);
    bc.fillStyle='rgba(205,203,170,.18)';bc.fillRect(col*64+(row%2)*32+3,row*32+2,57,2);
  }
  for(let i=0;i<4000;i++){bc.fillStyle=random()>.5?'rgba(18,27,24,.09)':'rgba(213,206,183,.09)';bc.fillRect(random()*256,random()*256,1+random()*4,1+random()*3);}
  brick.update();brick.uScale=2;brick.vScale=2;
  for(const name of ['refuge stone','toll stone','archive stone','dressing limestone','crypt basalt']){
    const m=scene.getMaterialByName(name) as StandardMaterial|undefined;if(m){m.diffuseTexture=brick;m.specularColor.set(.03,.03,.03);}
  }
  const lintel=scene.getMeshByName('refuge lintel');lintel?.setEnabled(false);
  for(let n=0;n<15;n++){
    const a=n/14*Math.PI;const x=-25+Math.cos(a)*4.2,z=-18-Math.cos(a)*2.6;
    const voussoir=box(.8,.8,1.25,stone,x,3.35+Math.sin(a)*2.2,z,-.59);voussoir.rotation.z=a-Math.PI/2;
  }
  for(const side of [-1,1]){
    const tx=-28+side*6.7,tz=-18-side*4.8;
    cylinder(.24,3.1,3.1,pale,tx,4.2,tz);cylinder(.22,3,3,stone,tx,.24,tz);
    for(let n=0;n<8;n++){const a=n/8*Math.PI*2;box(.5,.48,.5,stone,tx+Math.sin(a)*1.2,4.54,tz+Math.cos(a)*1.2,a);}
  }

  // Authored stone terraces and low ruins keep combat space open and readable.
  for(let i=0;i<115;i++) {const x=-31+i*.58,z=x*.68-1;for(const side of [-1,1]) {if(i%7===0)continue;box(.65,.2,.6,i%3?stone:pale,x+side*3.4,.06,z-side*4.5,-.59);}}
  for(let i=0;i<90;i++) {
    const x=random()*74-37,z=random()*70-35;if(Math.abs(z-(x*.68-1))<6||Math.hypot(x+28,z+20)<7||Math.hypot(x-32,z-20)<8)continue;
    if(i%3===0) {
      const h=2+random()*3.7;const trunk=cylinder(h,.13,.42,wood,x,h/2,z);trunk.rotation.z=(random()-.5)*.24;
      for(let b=0;b<3;b++){const branch=cylinder(1.3+random(),.035,.16,wood,x+(b%2?-.35:.35),h*.6+b*.3,z);branch.rotation.z=(b%2?-1:1)*(.6+random()*.4);}
    } else {
      for(let n=0;n<2+Math.floor(random()*4);n++)box(1.1,.65,1,stone,x+(n%2)*.8,n*.52+.3,z,.2);
      if(i%4===0){box(1.2,.15,1.3,pale,x,2.7,z);box(.26,1.7,.4,pale,x,2.2,z);}
    }
  }
  for(const [x,z,scale] of [[-36,-17,.7],[-33,-8,.8],[-22,-8,.65]] ) {
    box(5*scale,3.6*scale,4*scale,stone,x,1.8*scale,z,-.59);
    const roof=add(MeshBuilder.CreateCylinder('pitched slate roof',{height:5.8*scale,diameter:5*scale,tessellation:3},scene),darkStone,x,4*scale,z,-.59);roof.rotation.z=Math.PI/2;
    box(.9,1.8,.1,wood,x,1.1,z+2.05*scale,-.59);
    for(const side of [-1,1])box(.55,.7,.08,fire,x+side*1.4,2.1,z+2.08*scale);
    cylinder(1.5,.5,.6,stone,x+1.3,5,z-.7);
  }
  // Archive colonnade, shelves and broken rib vaults; open camera-facing side.
  for(let i=0;i<5;i++) {
    const x=15+i*4.4,z=9+i*2.9;
    for(const side of [-1,1]) {
      const px=x+side*4.5,pz=z-side*5;
      cylinder(4.7,.8,1.1,darkStone,px,2.35,pz);
      box(1.8,.24,1.8,pale,px,4.65,pz,-.59);
      box(1.6,.4,1.6,stone,px,.2,pz,-.59);
      if(side===-1) {
        box(3.5,3.2,.7,darkStone,px-1,1.6,pz+1,-.59);
        for(let shelf=0;shelf<3;shelf++){box(3.4,.12,.9,wood,px-1,.6+shelf*.8,pz+1,-.59);for(let book=0;book<7;book++)box(.2,.5,.35,book%2?brass:clothMaterial(scene),px-2.1+book*.34,.92+shelf*.8,pz+.5,-.59);}
      }
    }
    for(let n=0;n<5;n++)box(2.1,.08,2.1,n%2?stone:darkStone,x+(n-2)*1.4,.08,z-(n-2)*1.8,-.59);
  }
  for(const [x,z] of [[-25,-18],[-10,-8],[8,3],[17,11],[27,17],[34,23]]) {
    cylinder(1.1,.2,.45,brass,x-3,.55,z+3);
    cylinder(.3,1,.55,brass,x-3,1.18,z+3);
    const flame=add(MeshBuilder.CreateSphere('brazier ember',{diameter:.65,segments:8},scene),fire,x-3,1.55,z+3);flame.scaling.y=1.6;
    const light=new PointLight('warm brazier',new Vector3(x-3,2.2,z+3),scene);light.diffuse=Color3.FromHexString('#f9a468');light.intensity=.7;light.range=9;
  }
  const circle=MeshBuilder.CreateTorus('ritual arena engraving',{diameter:13,thickness:.09,tessellation:64},scene);add(circle,brass,32,.72,20);
  for(let n=0;n<12;n++){const a=n/12*Math.PI*2;box(.5,.13,1.3,pale,32+Math.cos(a)*6,.73,20+Math.sin(a)*6,-a);}
  for(const [m,meshes] of batches) {const merged=Mesh.MergeMeshes(meshes,true,true,undefined,false,true);if(merged){merged.name=`Varrow masonry ${m.name}`;merged.isPickable=false;merged.receiveShadows=true;shadow.addShadowCaster(merged);}}
}

function clothMaterial(scene: Scene) {return mat(scene,'bound volumes','#624f3e');}
