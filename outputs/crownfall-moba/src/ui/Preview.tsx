import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createRig } from "../render/world";
import { Simulation } from "../game/simulation";
import type { HeroId } from "../game/content";
export function HeroPreview({ hero }: { hero: HeroId }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const h = host.current;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(h.clientWidth, h.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    h.append(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(
        32,
        h.clientWidth / h.clientHeight,
        0.1,
        100,
      );
    camera.position.set(4.1, 2.9, 6.1);
    camera.lookAt(0, 1.15, 0);
    scene.add(new THREE.HemisphereLight("#e2f2ec", "#283f51", 3));
    const light = new THREE.DirectionalLight("#ffe1a2", 3);
    light.position.set(-3, 7, 4);
    scene.add(light);
    const sim = new Simulation({
      hero,
      mode: "practice",
      seed: 1,
      talents: ["Blink", "Mend"],
    });
    const rig = createRig(sim.player);
    scene.add(rig.root);
    rig.root.position.set(0, 0, 0);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.85, 0.22, 48),
      new THREE.MeshStandardMaterial({ color: "#52706f", roughness: 0.8 }),
    );
    base.position.y = -0.16;
    scene.add(base);
    let frame = 0;
    const render = (t: number) => {
      rig.root.rotation.y = Math.sin(t * 0.0002) * 0.4 - 0.35;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [hero]);
  return <div className="hero-preview" ref={host} />;
}
