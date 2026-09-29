import { useEffect, useRef, useState } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { createTaxiModel } from "../render/vehicles";
import type { TaxiId } from "../game/types";

export function GaragePreview({
  taxi,
  color,
  reducedMotion,
}: {
  taxi: TaxiId;
  color: string;
  reducedMotion: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    let engine: Engine | undefined;
    let observer: ResizeObserver | undefined;
    try {
      engine = new Engine(ref.current, true, {
        stencil: true,
        preserveDrawingBuffer: false,
      });
      engine.setHardwareScalingLevel(
        Math.max(1, window.devicePixelRatio / 1.5),
      );
      const scene = new Scene(engine);
      scene.clearColor = new Color4(0.075, 0.235, 0.245, 1);
      const camera = new ArcRotateCamera(
        "garage-camera",
        -1.0,
        1.22,
        8.5,
        new Vector3(0, 0.8, 0),
        scene,
      );
      camera.attachControl(ref.current, true);
      camera.lowerRadiusLimit = 7;
      camera.upperRadiusLimit = 12;
      camera.lowerBetaLimit = 0.4;
      camera.upperBetaLimit = 1.5;
      camera.wheelPrecision = 35;
      const fill = new HemisphericLight(
        "garage-fill",
        new Vector3(0, 1, 0),
        scene,
      );
      fill.intensity = 0.56;
      fill.groundColor = new Color3(0.35, 0.42, 0.43);
      const key = new DirectionalLight(
        "garage-key",
        new Vector3(-1, -2, 1),
        scene,
      );
      key.intensity = 0.78;
      key.position = new Vector3(5, 8, -4);
      const rim = new HemisphericLight(
        "garage-rim",
        new Vector3(1, 0.4, -1),
        scene,
      );
      rim.diffuse = new Color3(0.7, 0.96, 1);
      rim.intensity = 0.18;
      const model = createTaxiModel(scene, taxi, color);
      const shadows = new ShadowGenerator(1024, key);
      shadows.useBlurExponentialShadowMap = true;
      shadows.blurKernel = 20;
      shadows.darkness = 0.32;
      for (const mesh of model.meshes) shadows.addShadowCaster(mesh, false);
      const stage = MeshBuilder.CreateCylinder(
        "turntable",
        { diameter: 7.2, height: 0.22, tessellation: 80 },
        scene,
      );
      stage.position.y = -0.16;
      const stageMat = new StandardMaterial("stage-paint", scene);
      stageMat.diffuseColor = new Color3(0.16, 0.34, 0.35);
      stageMat.specularColor = new Color3(0.03, 0.035, 0.035);
      stage.material = stageMat;
      stage.receiveShadows = true;
      const ring = MeshBuilder.CreateTorus(
        "stage-stripe",
        { diameter: 6.8, thickness: 0.06, tessellation: 80 },
        scene,
      );
      ring.position.y = -0.035;
      const ringMat = new StandardMaterial("stripe", scene);
      ringMat.diffuseColor = Color3.FromHexString("#f5ce83");
      ringMat.emissiveColor = new Color3(0.15, 0.09, 0.02);
      ring.material = ringMat;
      let dragged = false;
      const stopSpin = () => {
        dragged = true;
      };
      ref.current.addEventListener("pointerdown", stopSpin);
      const canvas = ref.current;
      engine.runRenderLoop(() => {
        if (!reducedMotion && !dragged) model.root.rotation.y += 0.0012;
        scene.render();
      });
      observer = new ResizeObserver(() => engine?.resize());
      observer.observe(canvas);
      return () => {
        canvas.removeEventListener("pointerdown", stopSpin);
        observer?.disconnect();
        scene.dispose();
        engine?.dispose();
      };
    } catch {
      setFailed(true);
      engine?.dispose();
      observer?.disconnect();
    }
  }, [taxi, color, reducedMotion]);
  return (
    <div className="garage-preview">
      <canvas
        ref={ref}
        aria-label="Interactive 3D taxi preview. Drag to rotate and scroll to zoom."
      />
      {failed ? (
        <p>Preview unavailable on this device.</p>
      ) : (
        <span>Drag to look around</span>
      )}
    </div>
  );
}
