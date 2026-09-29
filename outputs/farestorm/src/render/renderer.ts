import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Materials/standardMaterial";
import {
  createTaxiModel,
  createTrafficModel,
  animateTaxi,
  type TaxiModel,
} from "./vehicles";
import { buildCity, flatMaterial, textSign } from "./city";
import { BUILDINGS, LANDMARKS, heightAt } from "../game/world";
import { PASSENGER_ARCHETYPES } from "../game/content";
import type {
  GameSnapshot,
  SessionOptions,
  Settings,
  Replay,
  InputFrame,
  FareTier,
} from "../game/types";

const angleLerp = (a: number, b: number, t: number) =>
  a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
const tierColors: Record<FareTier, string> = {
  short: "#82e4af",
  medium: "#ffd36a",
  long: "#d792e8",
  special: "#85dcf4",
};
export class GameRenderer {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly canvas: HTMLCanvasElement;
  private camera: FreeCamera;
  private player: TaxiModel;
  private sun: DirectionalLight;
  private shadows: ShadowGenerator;
  private signals: [StandardMaterial, StandardMaterial];
  private traffic = new Map<number, TransformNode>();
  private passengers = new Map<number, { root: TransformNode; arm: Mesh }>();
  private ring: Mesh;
  private innerRing: Mesh;
  private marker: Mesh;
  private route: Mesh[] = [];
  private dust: Mesh[] = [];
  private smokeMaterial: StandardMaterial;
  private cameraHeading = 0;
  private cameraReady = false;
  private markerDrop = false;
  private elapsed = 0;
  private ghost?: TaxiModel;
  private ghostReplay?: Replay;
  private ghostIndex = 0;
  private steerCamera = 0;
  private lastSkid?: Vector3;
  private skidPoints: Vector3[][] = [];
  private skidMesh?: LinesMesh;
  private frame = 0;
  private resizeObserver: ResizeObserver;
  private settings: Settings;
  constructor(host: HTMLElement, options: SessionOptions, settings: Settings) {
    this.settings = settings;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "game-canvas";
    this.canvas.setAttribute("aria-label", "Galeport driving view");
    this.canvas.tabIndex = 0;
    host.appendChild(this.canvas);
    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      powerPreference: "high-performance",
      antialias: true,
    });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = Color4.FromHexString("#a6d1d6ff");
    this.scene.ambientColor = new Color3(0.18, 0.21, 0.19);
    this.scene.fogMode = Scene.FOGMODE_LINEAR;
    this.scene.fogStart = 260;
    this.scene.fogEnd = 1250;
    this.scene.fogColor = Color3.FromHexString("#b8d6d4");
    this.scene.imageProcessingConfiguration.contrast = 1.08;
    this.scene.imageProcessingConfiguration.exposure = 0.96;
    this.scene.skipPointerMovePicking = true;
    this.scene.autoClear = true;
    this.camera = new FreeCamera(
      "spring chase",
      new Vector3(0, 4, -308),
      this.scene,
    );
    this.camera.minZ = 0.15;
    this.camera.maxZ = 4000;
    this.camera.fov = 1.24;
    this.camera.inputs.clear();
    const fill = new HemisphericLight(
      "soft sea sky",
      new Vector3(0.2, 1, 0),
      this.scene,
    );
    fill.intensity = 0.58;
    fill.diffuse = Color3.FromHexString("#e9f3ed");
    fill.groundColor = Color3.FromHexString("#7e8d89");
    this.sun = new DirectionalLight(
      "late afternoon sun",
      new Vector3(-0.46, -0.84, 0.32),
      this.scene,
    );
    this.sun.intensity = 0.88;
    this.sun.diffuse = Color3.FromHexString("#fff0d0");
    this.sun.position = new Vector3(100, 180, -100);
    this.sun.autoCalcShadowZBounds = false;
    this.sun.shadowMinZ = 1;
    this.sun.shadowMaxZ = 400;
    this.sun.shadowOrthoScale = 0;
    this.sun.orthoLeft = -130;
    this.sun.orthoRight = 130;
    this.sun.orthoTop = 130;
    this.sun.orthoBottom = -130;
    this.shadows = new ShadowGenerator(
      settings.quality === "high" ? 2048 : 1024,
      this.sun,
    );
    this.shadows.usePercentageCloserFiltering = true;
    this.shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    this.shadows.bias = 0.0012;
    this.shadows.normalBias = 0.055;
    this.shadows.setDarkness(0.23);
    const city = buildCity(this.scene);
    this.signals = city.signals;
    for (const mesh of city.casters) this.shadows.addShadowCaster(mesh);
    const sky = MeshBuilder.CreateSphere(
      "painted coastal atmosphere",
      { diameter: 6800, segments: 24, sideOrientation: Mesh.BACKSIDE },
      this.scene,
    );
    const skyMat = new ShaderMaterial(
      "coastal sky gradient",
      this.scene,
      {
        vertexSource:
          "precision highp float; attribute vec3 position; uniform mat4 worldViewProjection; varying float altitude; void main(){ altitude=position.y; gl_Position=worldViewProjection*vec4(position,1.0); }",
        fragmentSource:
          "precision highp float; varying float altitude; void main(){ float h=clamp(altitude/1800.0,0.0,1.0); vec3 horizon=vec3(0.74,0.84,0.81); vec3 zenith=vec3(0.26,0.57,0.73); gl_FragColor=vec4(mix(horizon,zenith,pow(h,0.65)),1.0); }",
      },
      { attributes: ["position"], uniforms: ["worldViewProjection"] },
    );
    skyMat.backFaceCulling = false;
    skyMat.disableDepthWrite = true;
    sky.material = skyMat;
    sky.isPickable = false;
    sky.infiniteDistance = true;
    this.player = createTaxiModel(this.scene, options.taxi, options.color);
    this.player.meshes.forEach((m) => this.shadows.addShadowCaster(m));
    // Soft contact patch keeps the body anchored even outside the close shadow volume.
    const shadowMat = flatMaterial(this.scene, "taxi contact patch", "#293e3d");
    shadowMat.alpha = 0.19;
    shadowMat.disableLighting = true;
    shadowMat.emissiveColor = Color3.FromHexString("#233d3a");
    const contact = MeshBuilder.CreateDisc(
      "tire contact shade",
      { radius: 1, tessellation: 32 },
      this.scene,
    );
    contact.rotation.x = Math.PI / 2;
    contact.scaling.set(1.35, 2.6, 1);
    contact.position.y = 0.04;
    contact.parent = this.player.root;
    contact.material = shadowMat;
    const pickupMat = flatMaterial(this.scene, "fare ring gold", "#ffd36a");
    pickupMat.emissiveColor = new Color3(0.55, 0.32, 0.04);
    this.ring = MeshBuilder.CreateTorus(
      "pickup stop zone",
      { diameter: 7, thickness: 0.13, tessellation: 64 },
      this.scene,
    );
    this.ring.material = pickupMat;
    this.innerRing = MeshBuilder.CreateTorus(
      "pickup stop zone inner",
      { diameter: 6.7, thickness: 0.05, tessellation: 64 },
      this.scene,
    );
    this.innerRing.material = pickupMat;
    this.marker = textSign(this.scene, "PICK UP", "#a26920", 3.3, 0.62);
    this.marker.billboardMode = Mesh.BILLBOARDMODE_ALL;
    const routeMat = flatMaterial(this.scene, "route mint", "#6cf5da");
    routeMat.emissiveColor = new Color3(0.26, 0.65, 0.5);
    routeMat.backFaceCulling = false;
    for (let i = 0; i < 30; i++) {
      const arrow = new Mesh("road guidance chevron", this.scene),
        data = new VertexData();
      data.positions = [
        -1, 0, -0.9, 0, 0, 0, 1, 0, -0.9, 1, 0, -0.3, 0, 0, 0.6, -1, 0, -0.3,
      ];
      data.indices = [0, 1, 5, 1, 4, 5, 1, 2, 4, 2, 3, 4];
      data.normals = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
      data.applyToMesh(arrow);
      arrow.material = routeMat;
      arrow.setEnabled(false);
      this.route.push(arrow);
    }
    this.smokeMaterial = flatMaterial(this.scene, "tire haze", "#e6d5bb");
    this.smokeMaterial.alpha = 0.32;
    this.smokeMaterial.disableLighting = true;
    this.smokeMaterial.emissiveColor = Color3.FromHexString("#e1d0af");
    for (let i = 0; i < 24; i++) {
      const p = MeshBuilder.CreateSphere(
        "tire smoke",
        { diameter: 1, segments: 4 },
        this.scene,
      );
      p.material = this.smokeMaterial;
      p.isVisible = false;
      this.dust.push(p);
    }
    // Stylized cloud banks: quiet silhouettes, no downloaded sky dependency.
    const cloudMat = flatMaterial(this.scene, "warm clouds", "#eff2e3");
    cloudMat.disableLighting = true;
    cloudMat.emissiveColor = Color3.FromHexString("#dbe9e3");
    for (let i = 0; i < 14; i++) {
      const cloud = MeshBuilder.CreateSphere(
        "coastal cloud",
        { diameter: 1, segments: 5 },
        this.scene,
      );
      cloud.position.set(
        Math.sin(i * 2.7) * 1700,
        230 + (i % 4) * 32,
        Math.cos(i * 2.7) * 1700,
      );
      cloud.scaling.set(240 + (i % 3) * 70, 24, 110);
      cloud.material = cloudMat;
      cloud.isPickable = false;
    }
    this.resizeObserver = new ResizeObserver(() => this.engine.resize());
    this.resizeObserver.observe(host);
    this.setSettings(settings);
    this.canvas.focus({ preventScroll: true });
  }
  setSettings(settings: Settings): void {
    this.settings = settings;
    const ratio = window.devicePixelRatio || 1;
    this.engine.setHardwareScalingLevel(
      settings.quality === "low"
        ? Math.max(1.35, ratio)
        : settings.quality === "medium"
          ? Math.max(1, ratio / 1.2)
          : Math.max(1, ratio / 1.5),
    );
    this.shadows.getShadowMap()!.refreshRate =
      settings.quality === "low" ? 2 : 1;
    this.shadows.setDarkness(settings.quality === "low" ? 0.3 : 0.23);
  }
  setGhost(replay: Replay): void {
    if (replay.samples.length < 2) return;
    this.ghostReplay = replay;
    this.ghost = createTaxiModel(
      this.scene,
      replay.options.taxi,
      "#85e1d1",
      true,
    );
    this.ghost.meshes.forEach((m) => {
      if (m.material) m.material.alpha = 0.22;
    });
  }
  render(s: GameSnapshot, input: InputFrame, delta: number): void {
    this.elapsed += delta;
    this.frame++;
    const v = s.vehicle;
    this.player.root.position.set(v.x, v.y - 0.88, v.z);
    this.player.root.rotation.y = v.heading;
    animateTaxi(
      this.player,
      v.wheelSpin,
      v.steering,
      v.roll,
      v.pitch,
      v.suspension,
      delta,
    );
    for (const lamp of this.player.brakeLights) {
      const mat = lamp.material as StandardMaterial;
      mat.emissiveColor.set(input.brake > 0.1 ? 1 : 0.35, 0.04, 0.02);
    }
    this.player.turbine.rotation.z +=
      delta * (v.boost ? 45 : Math.abs(v.speed) * 0.8);
    this.sun.position.set(v.x + 95, v.y + 160, v.z - 80);
    const nsGreen = s.time % 14 < 7;
    this.signals.forEach((m, i) => {
      const color = Color3.FromHexString(
        (i === 0 ? nsGreen : !nsGreen) ? "#65efaf" : "#ee6652",
      );
      m.diffuseColor = color;
      m.emissiveColor = color.scale(0.65);
    });
    this.updateCamera(s, input, delta);
    for (const car of s.traffic) {
      let model = this.traffic.get(car.id);
      if (!model) {
        model = createTrafficModel(this.scene, car.variant, car.color);
        this.traffic.set(car.id, model);
      }
      const near = Math.hypot(v.x - car.x, v.z - car.z) < 310;
      model.setEnabled(near);
      if (near) {
        model.position.set(car.x, car.y, car.z);
        model.rotation.y = car.heading;
      }
    }
    const active = new Set<number>();
    for (const passenger of s.passengers) {
      if (!passenger.active) continue;
      active.add(passenger.id);
      let model = this.passengers.get(passenger.id);
      if (!model) {
        model = this.makePassenger(
          passenger.id,
          passenger.archetype,
          passenger.tier,
        );
        this.passengers.set(passenger.id, model);
      }
      model.root.setEnabled(
        Math.hypot(v.x - passenger.x, v.z - passenger.z) < 180,
      );
      model.root.position.set(
        passenger.x + 4,
        heightAt(passenger.x, passenger.z),
        passenger.z,
      );
      model.arm.rotation.z =
        -0.85 + Math.sin(this.elapsed * 5 + passenger.id) * 0.4;
    }
    for (const [id, p] of this.passengers)
      if (!active.has(id)) p.root.setEnabled(false);
    const target = s.target;
    this.ring.setEnabled(!!target);
    this.innerRing.setEnabled(!!target);
    this.marker.setEnabled(!!target);
    if (target) {
      const drop = !!s.activeFare,
        x = target.x,
        z = target.z,
        y = heightAt(x, z);
      this.ring.position.set(x, y + 0.19, z);
      this.innerRing.position.set(x, y + 0.19, z);
      const radius = drop ? 2.6 : 1;
      this.ring.scaling.set(radius, 1, radius);
      this.innerRing.scaling.set(radius, 1, radius);
      this.innerRing.rotation.y = this.elapsed * 0.3;
      this.marker.position.set(
        x,
        y +
          4.6 +
          (this.settings.reducedMotion ? 0 : Math.sin(this.elapsed * 2) * 0.12),
        z,
      );
      const mat = this.ring.material as StandardMaterial;
      mat.diffuseColor = Color3.FromHexString(
        drop
          ? "#83edb3"
          : "tier" in target
            ? tierColors[target.tier]
            : "#ffd36a",
      );
      mat.emissiveColor = mat.diffuseColor.scale(0.3);
      if (drop !== this.markerDrop) {
        this.markerDrop = drop;
        this.marker.dispose(false, true);
        this.marker = textSign(
          this.scene,
          drop ? "DROP OFF" : "PICK UP",
          drop ? "#23735f" : "#a26920",
          drop ? 5 : 3.3,
          0.72,
        );
        this.marker.billboardMode = Mesh.BILLBOARDMODE_ALL;
        this.marker.position.set(x, y + 4.6, z);
      }
    }
    // Short, spaced chevrons point along the actual road graph rather than through buildings.
    let used = 0;
    for (let i = 1; i < s.route.length && used < this.route.length; i++) {
      const a = s.route[i - 1],
        b = s.route[i],
        length = Math.hypot(b.x - a.x, b.z - a.z);
      for (let t = 10; t < length && used < this.route.length; t += 14) {
        const x = a.x + ((b.x - a.x) * t) / length,
          z = a.z + ((b.z - a.z) * t) / length;
        if (Math.hypot(x - v.x, z - v.z) > 180) continue;
        const m = this.route[used++];
        m.setEnabled(true);
        m.position.set(x, heightAt(x, z) + 0.17, z);
        m.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
        m.scaling.setAll(1.2);
      }
    }
    for (let i = used; i < this.route.length; i++)
      this.route[i].setEnabled(false);
    this.updateEffects(s, delta);
    if (this.ghost && this.ghostReplay) {
      const samples = this.ghostReplay.samples;
      while (
        this.ghostIndex < samples.length - 2 &&
        samples[this.ghostIndex + 1].t < s.time
      )
        this.ghostIndex++;
      const a = samples[this.ghostIndex],
        b = samples[this.ghostIndex + 1],
        t = Math.max(0, Math.min(1, (s.time - a.t) / (b.t - a.t || 1)));
      this.ghost.root.position.set(
        a.x + (b.x - a.x) * t,
        a.y + (b.y - a.y) * t,
        a.z + (b.z - a.z) * t,
      );
      this.ghost.root.rotation.y = angleLerp(a.heading, b.heading, t);
      this.ghost.root.setEnabled(s.time < samples[samples.length - 1].t);
    }
    if (this.ghost) this.ghost.root.position.y -= 0.88;
    this.scene.render();
  }
  private updateCamera(s: GameSnapshot, input: InputFrame, dt: number): void {
    const v = s.vehicle,
      reduced = this.settings.reducedMotion,
      mode = this.settings.camera;
    this.cameraHeading = angleLerp(
      this.cameraHeading,
      v.heading,
      Math.min(1, dt * (reduced ? 10 : 6)),
    );
    if (!this.cameraReady) {
      this.cameraHeading = v.heading;
      this.cameraReady = true;
    }
    this.steerCamera +=
      (Math.max(-1, Math.min(1, input.lookX)) * 2.62 - this.steerCamera) *
      Math.min(1, dt * 6);
    const heading =
        this.cameraHeading + this.steerCamera + (input.lookBack ? Math.PI : 0),
      speed = Math.min(1, Math.abs(v.speed) / 40),
      distance =
        mode === 1 ? 11 + speed * 2 : mode === 2 ? -2.4 : 7.5 + speed * 1.4,
      height = mode === 1 ? 5 : mode === 2 ? 0.28 : 3.05;
    const fx = Math.sin(heading),
      fz = Math.cos(heading);
    let x = v.x - fx * distance,
      z = v.z - fz * distance,
      y = v.y + height + (mode === 2 ? 0 : speed * 0.5);
    // A chase camera must not disappear inside a corner building.
    if (mode !== 2) {
      const obstacles = [...BUILDINGS, ...LANDMARKS.filter((l) => l.solid)];
      for (let t = 0.12; t <= 1; t += 0.08) {
        const px = v.x - fx * distance * t,
          pz = v.z - fz * distance * t;
        if (
          obstacles.some(
            (b) =>
              Math.abs(px - b.x) < b.width / 2 + 0.65 &&
              Math.abs(pz - b.z) < b.depth / 2 + 0.65 &&
              y < heightAt(b.x, b.z) + b.height,
          )
        ) {
          const safe = Math.max(0.1, t - 0.1);
          x = v.x - fx * distance * safe;
          z = v.z - fz * distance * safe;
          break;
        }
      }
    }
    y = Math.max(y, heightAt(x, z) + 1);
    const targetPos = new Vector3(x, y, z);
    if (this.frame < 3 || mode === 2) this.camera.position.copyFrom(targetPos);
    else
      Vector3.LerpToRef(
        this.camera.position,
        targetPos,
        Math.min(1, dt * (reduced ? 20 : 12)),
        this.camera.position,
      );
    const look = new Vector3(
      v.x + fx * (mode === 2 ? 16 : 6 + speed * 4),
      v.y + (mode === 2 ? 0.22 : 1.55),
      v.z + fz * (mode === 2 ? 16 : 6 + speed * 4),
    );
    this.camera.setTarget(look);
    const fov =
      (mode === 2 ? 1.36 : 1.16) +
      (reduced ? 0 : speed * 0.15 + (v.boost ? 0.06 : 0));
    this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 3);
  }
  private updateEffects(s: GameSnapshot, dt: number): void {
    const v = s.vehicle;
    for (let i = 0; i < this.dust.length; i++) {
      const p = this.dust[i],
        age = (this.elapsed * 3 + i / this.dust.length) % 1;
      p.isVisible =
        (v.drift || v.boost) &&
        Math.abs(v.speed) > 5 &&
        !this.settings.reducedMotion;
      if (p.isVisible) {
        const side = i % 2 ? 1 : -1,
          back = 1.5 + age * 7;
        p.position.set(
          v.x -
            Math.sin(v.heading) * back +
            Math.cos(v.heading) * side * (1 + age),
          v.y + 0.2 + age * 0.7,
          v.z -
            Math.cos(v.heading) * back -
            Math.sin(v.heading) * side * (1 + age),
        );
        p.scaling.setAll(0.2 + age * 0.8);
        p.visibility = (1 - age) * 0.45;
      }
    }
    if (this.frame % 5 === 0 && v.drift && v.grounded) {
      const pos = new Vector3(v.x, heightAt(v.x, v.z) + 0.15, v.z);
      if (this.lastSkid && Vector3.Distance(this.lastSkid, pos) < 9) {
        this.skidPoints.push([this.lastSkid.clone(), pos]);
        if (this.skidPoints.length > 180) this.skidPoints.shift();
        this.skidMesh?.dispose();
        this.skidMesh = MeshBuilder.CreateLineSystem(
          "rubber on asphalt",
          { lines: this.skidPoints },
          this.scene,
        );
        this.skidMesh.color = Color3.FromHexString("#3a4a4b");
        this.skidMesh.alpha = 0.65;
      }
      this.lastSkid = pos;
    } else if (!v.drift) this.lastSkid = undefined;
  }
  private makePassenger(
    id: number,
    archetype: number,
    tier: FareTier,
  ): { root: TransformNode; arm: Mesh } {
    const root = new TransformNode("waiting rider " + id, this.scene),
      person = PASSENGER_ARCHETYPES[archetype % PASSENGER_ARCHETYPES.length],
      cloth = flatMaterial(this.scene, "rider coat " + id, person.color),
      skin = flatMaterial(
        this.scene,
        "rider skin " + id,
        ["#c99168", "#e3b388", "#976b50"][id % 3],
      ),
      dark = flatMaterial(this.scene, "rider trousers " + id, "#263d48");
    const body = MeshBuilder.CreateCapsule(
      "rider coat",
      { height: 0.75, radius: 0.22, tessellation: 8 },
      this.scene,
    );
    body.position.y = 1.1;
    body.material = cloth;
    body.parent = root;
    const head = MeshBuilder.CreateSphere(
      "rider face",
      { diameter: 0.35, segments: 8 },
      this.scene,
    );
    head.position.y = 1.72;
    head.material = skin;
    head.parent = root;
    for (const side of [-1, 1]) {
      const leg = MeshBuilder.CreateBox(
        "rider leg",
        { width: 0.17, height: 0.7, depth: 0.2 },
        this.scene,
      );
      leg.position.set(side * 0.13, 0.37, 0);
      leg.material = dark;
      leg.parent = root;
    }
    const arm = MeshBuilder.CreateCapsule(
      "waving arm",
      { height: 0.65, radius: 0.09, tessellation: 6 },
      this.scene,
    );
    arm.position.set(0.34, 1.49, 0);
    arm.rotation.z = -0.8;
    arm.parent = root;
    arm.material = cloth;
    const beacon =
      tier === "short"
        ? MeshBuilder.CreateSphere(
            "short fare sphere",
            { diameter: 0.6, segments: 8 },
            this.scene,
          )
        : MeshBuilder.CreatePolyhedron(
            "fare shape " + tier,
            {
              type: tier === "medium" ? 1 : tier === "long" ? 0 : 2,
              size: 0.39,
            },
            this.scene,
          );
    beacon.position.y = 2.65;
    beacon.material = flatMaterial(
      this.scene,
      "fare beacon " + id,
      tierColors[tier],
    );
    beacon.parent = root;
    return { root, arm };
  }
  dispose(): void {
    this.resizeObserver.disconnect();
    this.scene.dispose();
    this.engine.dispose();
    this.canvas.remove();
  }
}
