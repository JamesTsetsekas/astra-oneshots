import {useEffect,useRef}from'react';
import * as THREE from 'three';
import{makeUnit,animateModel}from'../game/art';
import type{Entity,Faction}from'../game/types';

export function FactionPreview({faction}:{faction:Faction}){
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const element=host.current;if(!element)return;
  let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}catch{return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(element.clientWidth,145);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;element.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,element.clientWidth/145,.1,50);camera.position.set(4,3.6,6.5);camera.lookAt(0,1.15,0);scene.add(new THREE.HemisphereLight(0xcbe9ee,0x697367,3));const light=new THREE.DirectionalLight(0xffdeb2,4);light.position.set(-3,6,4);scene.add(light);
  const e={id:0,faction,type:faction==='helix'?'heavy':'siege',team:'player',kind:'unit'}as Entity;const model=makeUnit(e);model.rotation.y=-.25;scene.add(model);const base=new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.8,.15,48),new THREE.MeshStandardMaterial({color:0x24393c,metalness:.65,roughness:.55}));base.position.y=-.1;scene.add(base);
  let raf=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;const render=(now:number)=>{model.rotation.y=-.25+(reduced?0:Math.sin(now*.0003)*.2);animateModel(model,false,now*.001,false,reduced);renderer.render(scene,camera);raf=requestAnimationFrame(render);};raf=requestAnimationFrame(render);
  return()=>{cancelAnimationFrame(raf);scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});renderer.dispose();renderer.domElement.remove();};
 },[faction]);
 return <div className="faction-preview" ref={host} aria-hidden="true"/>;
}
