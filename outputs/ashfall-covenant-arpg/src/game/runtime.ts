import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Engine } from "@babylonjs/core/Engines/engine";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { createActor, animateRig, dressWorld, type Rig } from "./presentation";
import "@babylonjs/core/Culling/ray";
import { abilities, classLoadouts, enemies, WORLD_SIZE } from "./content";
import { AshfallAudio } from "./audio";
import { GameSimulation } from "./simulation";
import type { CharacterSave, CombatFx, Enemy, GameOptions, GameSnapshot, Pickup, SkillId, Vec2 } from "./types";

export interface RuntimeSettings {
  sound: boolean;
  shadows: boolean;
  reducedMotion: boolean;
  damageNumbers: boolean;
  screenShake: boolean;
  quality: "low" | "medium" | "high";
}

export interface RuntimeCallbacks {
  onSnapshot(snapshot: GameSnapshot): void;
  onPanel(panel: "inventory" | "skills" | "character" | "quests" | "map"): void;
  onPause(): void;
  onSaveRequested(): void;
}

interface ActorView {
  root: TransformNode;
  body: Mesh[];
  healthBack?: Mesh;
  healthFill?: Mesh;
  targetRing?: Mesh;
  deadAt?: number;
  rig?: Rig;
}

interface PickupView {
  root: TransformNode;
  ring: Mesh;
}

interface FxView {
  mesh: Mesh;
  elapsed: number;
  duration: number;
  startScale: number;
  rise?: number;
}

function material(scene: Scene, name: string, diffuse: string, emissive?: string, alpha = 1): StandardMaterial {
  const value = new StandardMaterial(name, scene);
  value.diffuseColor = Color3.FromHexString(diffuse);
  value.specularColor = new Color3(0.18, 0.18, 0.18);
  value.alpha = alpha;
  if (emissive) value.emissiveColor = Color3.FromHexString(emissive);
  return value;
}

function tagPickable(meshes: AbstractMesh[], enemyId?: number, ground = false): void {
  for (const mesh of meshes) {
    mesh.isPickable = Boolean(enemyId || ground);
    mesh.metadata = enemyId ? { enemyId } : ground ? { ground: true } : undefined;
  }
}

function formatZone(zone: GameSnapshot["zone"]): string {
  return { refuge: "EMBER REFUGE", march: "THE SOOT MARCH", archive: "HOLLOW ARCHIVE", engine: "ENGINE VAULT" }[zone];
}

export class GameRuntime {
  readonly simulation: GameSimulation;
  readonly audio = new AshfallAudio();

  private canvas: HTMLCanvasElement;
  private engine: Engine;
  private scene: Scene;
  private camera: FreeCamera;
  private callbacks: RuntimeCallbacks;
  private minimap: HTMLCanvasElement;
  private actorViews = new Map<number | "hero", ActorView>();
  private pickupViews = new Map<number, PickupView>();
  private hazardViews = new Map<number, Mesh>();
  private fxViews: FxView[] = [];
  private materials = new Map<string, StandardMaterial>();
  private settings: RuntimeSettings;
  private lastTime = performance.now();
  private lastSnapshot = 0;
  private frameSamples: number[] = [];
  private disposed = false;
  private hoverPoint: Vec2 = { x: 0, z: 0 };
  private targetPoint: Vec2 = { x: 0, z: 0 };
  private keys = new Set<string>();
  private zoneLabel = "";
  private shake = 0;
  private glow: GlowLayer;
  private shadow?: ShadowGenerator;
  private zoom = 18;
  private damageLabels: Array<{ node: HTMLSpanElement; point: Vector3; age: number }> = [];
  private labels = document.createElement('div');
  private lastFxId = 0;
  private attackVisual = 0;
  private lastAttackTimer = 0;
  private victorySoundPlayed = false;
  private objectiveLabel = document.createElement('div');
  private objectiveRing?: Mesh;

  constructor(
    host: HTMLElement,
    minimap: HTMLCanvasElement,
    options: GameOptions,
    callbacks: RuntimeCallbacks,
    settings: RuntimeSettings,
    restored?: CharacterSave["payload"],
  ) {
    this.callbacks = callbacks;
    this.settings = settings;
    this.minimap = minimap;
    this.simulation = new GameSimulation(options, restored);
    this.audio.setEnabled(settings.sound);
    this.canvas = document.createElement("canvas");
    this.canvas.className = "world-canvas";
    this.canvas.tabIndex = 0;
    host.prepend(this.canvas);
    this.labels.className = 'world-labels';
    host.append(this.labels);
    this.objectiveLabel.className='objective-world-label';this.labels.append(this.objectiveLabel);
    this.engine = new Engine(this.canvas, settings.quality !== "low", { preserveDrawingBuffer: false, stencil: true, powerPreference: "high-performance" });
    this.engine.setHardwareScalingLevel(settings.quality === "high" ? 1 / Math.min(devicePixelRatio, 1.6) : settings.quality === "medium" ? 1 : 1.25);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.016, 0.02, 0.023, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogColor = new Color3(0.095, 0.13, 0.125);
    this.scene.fogDensity = 0.009;
    this.camera = new FreeCamera("isometric", new Vector3(-15, 20, -7), this.scene);
    this.camera.fov = 0.73;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 130;
    this.scene.activeCamera = this.camera;
    this.glow = new GlowLayer("star-metal glow", this.scene, { blurKernelSize: settings.quality === "high" ? 48 : 24 });
    this.glow.intensity = 0.45;
    this.createWorld();
    this.createHeroView();
    this.objectiveRing=MeshBuilder.CreateTorus('objective marker',{diameter:3.2,thickness:.06,tessellation:40},this.scene);
    this.objectiveRing.material=this.mat('objective amber','#d3ba72','#75613d');this.objectiveRing.isPickable=false;
    this.bindEvents();
    this.resize();
    this.engine.runRenderLoop(() => this.frame());
    if(import.meta.env.DEV){
      (window as unknown as {__ashfallQA:unknown}).__ashfallQA={
        inspect:()=>({snapshot:this.simulation.getSnapshot(0),enemies:[...this.simulation.enemyMap.values()].map(e=>({...e})),pickups:[...this.simulation.pickupMap.values()].map(p=>({...p}))}),
        intent:(type:string,value?:number|string|Vec2)=>{
          if(type==='move')this.simulation.moveTo(value as Vec2);
          if(type==='attack')this.simulation.attack(value as number);
          if(type==='cast')this.castSkill(value as SkillId);
          if(type==='aim')this.hoverPoint=value as Vec2;
          if(type==='evade')this.evade();
          if(type==='interact')this.interact();
          if(type==='potion')this.usePotion();
          if(type==='restock')this.simulation.restock();
        },
        project:(point:Vec2)=>{const p=Vector3.Project(new Vector3(point.x,1,point.z),Matrix.Identity(),this.scene.getTransformMatrix(),this.camera.viewport.toGlobal(this.engine.getRenderWidth(),this.engine.getRenderHeight()));return {x:p.x/this.engine.getRenderWidth()*this.canvas.clientWidth,y:p.y/this.engine.getRenderHeight()*this.canvas.clientHeight};}
      };
    }
  }

  private mat(name: string, diffuse: string, emissive?: string, alpha = 1): StandardMaterial {
    const key = `${name}:${alpha}`;
    const existing = this.materials.get(key);
    if (existing) return existing;
    const value = material(this.scene, name, diffuse, emissive, alpha);
    this.materials.set(key, value);
    return value;
  }

  private createWorld(): void {
    const ambient = new HemisphericLight("cold moon fill", new Vector3(-0.3, 1, -0.2), this.scene);
    ambient.diffuse = new Color3(0.39, 0.48, 0.53);
    ambient.groundColor = new Color3(0.06, 0.035, 0.027);
    ambient.intensity = 0.8;
    const moon = new DirectionalLight("moon", new Vector3(-0.45, -1, 0.3), this.scene);
    moon.position = new Vector3(24, 36, -20);
    moon.diffuse = new Color3(0.7, 0.84, 0.9);
    moon.intensity = 1.25;
    const shadows = new ShadowGenerator(this.settings.quality === "high" ? 2048 : 1024, moon);
    this.shadow = shadows;
    this.scene.shadowsEnabled = this.settings.shadows;
    shadows.usePercentageCloserFiltering = true;
    shadows.filteringQuality = 1;
    shadows.bias = 0.003;
    shadows.normalBias = 0.04;

    const ground = MeshBuilder.CreateGround("ash field", { width: WORLD_SIZE + 6, height: WORLD_SIZE + 6, subdivisions: 2 }, this.scene);
    ground.material = this.mat("ash earth", "#1b1b1a");
    ground.receiveShadows = true;
    tagPickable([ground], undefined, true);

    const pathMaterial = this.mat("bleached path", "#4d4b45");
    const pathPoints = [
      [-29, -21, 11, 7], [-22, -16, 11, 6], [-15, -11, 11, 5.5], [-8, -6, 11, 5], [-1, -1, 11, 5],
      [6, 3, 10, 5], [13, 7, 10, 5], [20, 12, 10, 5], [27, 17, 10, 5], [33, 21, 10, 7],
    ];
    for (const [x, z, width, depth] of pathPoints) {
      const path = MeshBuilder.CreateBox("broken causeway", { width, depth, height: 0.12 }, this.scene);
      path.position.set(x, 0.03, z);
      path.rotation.y = -0.61;
      path.material = pathMaterial;
      path.receiveShadows = true;
      path.isPickable = false;
    }

    this.createRefuge(shadows);
    this.createWaypoint();
    this.createTollGate(shadows);
    this.createArchive(shadows);
    this.scatterProps(shadows);
    dressWorld(this.scene, shadows, this.simulation.options.seed);
  }

  private createRefuge(shadows: ShadowGenerator): void {
    const stone = this.mat("refuge stone", "#575750");
    const ember = this.mat("refuge ember", "#9f3f22", "#dc582c");
    for (const side of [-1, 1]) {
      const tower = MeshBuilder.CreateCylinder("refuge watch", { height: 6, diameter: 3.8, tessellation: 8 }, this.scene);
      tower.position.set(-28 + side * 6.7, 2.2, -18 - side * 4.8);
      tower.scaling.set(.7,.72,.7);
      tower.material = stone;
      tower.receiveShadows = true;
      shadows.addShadowCaster(tower);
      const fire = MeshBuilder.CreateSphere("refuge brazier", { diameter: 0.8, segments: 8 }, this.scene);
      fire.position = tower.position.add(new Vector3(0, 3.5, 0));
      fire.material = ember;
    }
    const arch = MeshBuilder.CreateBox("refuge lintel", { width: 8, height: 1.1, depth: 1.4 }, this.scene);
    arch.position.set(-25, 4.7, -18);
    arch.rotation.y = -0.62;
    arch.material = stone;
    shadows.addShadowCaster(arch);
    for (const offset of [-3.6, 3.6]) {
      const pillar = MeshBuilder.CreateBox("refuge gate pillar", { width: 1.3, height: 8, depth: 1.5 }, this.scene);
      pillar.position.set(-25 + offset * 0.82, 2.25, -18 - offset * 0.57);
      pillar.scaling.y = .56;
      pillar.rotation.y = -0.62;
      pillar.material = stone;
      shadows.addShadowCaster(pillar);
    }
    const npc = MeshBuilder.CreateCylinder("Warden Maelin", { height: 2.1, diameterTop: 0.48, diameterBottom: 0.85, tessellation: 8 }, this.scene);
    npc.position.set(-25, 1.05, -18);
    npc.material = this.mat("warden cloak", "#4b2520");
    npc.metadata = { interactable: "keeper" };
  }

  private createWaypoint(): void {
    const brass = this.mat("waypoint brass", "#69543c");
    const cyan = this.mat("star metal", "#2c8b8e", "#4fd8d4");
    const base = MeshBuilder.CreateCylinder("ashway base", { diameter: 4.8, height: 0.55, tessellation: 12 }, this.scene);
    base.position.set(-7, 0.26, -5);
    base.material = brass;
    const ring = MeshBuilder.CreateTorus("ashway ring", { diameter: 3.2, thickness: 0.22, tessellation: 32 }, this.scene);
    ring.position.set(-7, 1.8, -5);
    ring.rotation.x = Math.PI / 2;
    ring.material = cyan;
    const shard = MeshBuilder.CreatePolyhedron("ashway shard", { type: 1, size: 0.85 }, this.scene);
    shard.position.set(-7, 1.8, -5);
    shard.material = cyan;
  }

  private createTollGate(shadows: ShadowGenerator): void {
    const stone = this.mat("toll stone", "#4f4d48");
    for (const side of [-1, 1]) {
      const column = MeshBuilder.CreateBox("toll gate column", { width: 2.4, height: 9, depth: 2.4 }, this.scene);
      column.position.set(10 + side * 5, 4.5, 5 - side * 3);
      column.rotation.y = -0.55;
      column.material = stone;
      shadows.addShadowCaster(column);
      const crown = MeshBuilder.CreateTorus("broken celestial crown", { diameter: 4.2, thickness: 0.28, tessellation: 20 }, this.scene);
      crown.position = column.position.add(new Vector3(0, 5.2, 0));
      crown.rotation.set(Math.PI / 2, 0, side * 0.8);
      crown.material = this.mat("oxidized brass", "#69523a");
    }
  }

  private createArchive(shadows: ShadowGenerator): void {
    const archiveStone = this.mat("archive stone", "#34383a");
    const star = this.mat("archive star", "#275d61", "#43c9ca");
    for (let index = 0; index < 8; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const step = Math.floor(index / 2);
      const pillar = MeshBuilder.CreateBox("archive rib", { width: 1.3, height: 5 + step * 0.4, depth: 1.3 }, this.scene);
      pillar.position.set(17 + step * 5 + side * 4, 2.5, 11 + step * 3 - side * 3);
      pillar.rotation.y = -0.6;
      pillar.material = archiveStone;
      shadows.addShadowCaster(pillar);
    }
    const engineBase = MeshBuilder.CreateCylinder("engine dais", { diameter: 12, height: 0.65, tessellation: 16 }, this.scene);
    engineBase.position.set(32, 0.3, 20);
    engineBase.material = archiveStone;
    const channels = MeshBuilder.CreateTorus("engine channel", { diameter: 8.5, thickness: 0.16, tessellation: 48 }, this.scene);
    channels.position.set(32, 0.68, 20);
    channels.material = star;
  }

  private scatterProps(shadows: ShadowGenerator): void {
    const rock = this.mat("charcoal rocks", "#282827");
    const deadwood = this.mat("dead timber", "#2c211d");
    const random = new SeededVisual(this.simulation.options.seed ^ 0xa51f);
    for (let index = 0; index < 95; index += 1) {
      const x = random.range(-36, 36);
      const z = random.range(-36, 36);
      if (Math.abs(z - (x * 0.68 - 1)) < 6 || (x < -21 && z < -13) || (x > 26 && z > 13)) continue;
      if (index % 4 === 0) {
        const tree = MeshBuilder.CreateCylinder("ash tree", { height: random.range(2.5, 5.5), diameterTop: 0.1, diameterBottom: 0.5, tessellation: 6 }, this.scene);
        tree.position.set(x, tree.getBoundingInfo().boundingBox.extendSize.y, z);
        tree.rotation.z = random.range(-0.2, 0.2);
        tree.material = deadwood;
        shadows.addShadowCaster(tree);
      } else {
        const stone = MeshBuilder.CreatePolyhedron("ash rock", { type: 1, size: random.range(0.35, 1.25) }, this.scene);
        stone.position.set(x, random.range(0.15, 0.45), z);
        stone.scaling.y = random.range(0.45, 1.4);
        stone.rotation.y = random.range(0, Math.PI);
        stone.material = rock;
        stone.receiveShadows = true;
      }
    }
  }

  private createHeroView(): void {
    const rig = createActor(this.scene, this.simulation.hero.class, this.shadow);
    const {root, meshes: body} = rig;
    for(const part of body){part.renderOutline=true;part.outlineWidth=.018;part.outlineColor=Color3.FromHexString('#254e48');}
    const cinder = this.simulation.hero.class === "cinder";
    const ring = MeshBuilder.CreateTorus("hero ground ring", { diameter: cinder ? 2.2 : 1.8, thickness: 0.07, tessellation: 32 }, this.scene);
    ring.position.y = 0.08;
    ring.material = this.mat("hero selection", "#b28b4c", "#d1a657");
    ring.parent = root;
    body.push(ring);
    this.actorViews.set("hero", { root, body, rig });
  }

  private createEnemyView(enemy: Enemy): ActorView {
    const rig = createActor(this.scene, enemy.type, this.shadow);
    const {root, meshes: body} = rig;
    const definition = enemies[enemy.type];
    const colors: Record<string, [string, string?]> = {
      crawler: ["#4f3b31", "#8d3f28"], husk: ["#5d5850", "#8b3c28"], archer: ["#4d4239", "#96512e"], scribe: ["#383b43", "#7e526d"],
      mite: ["#6f492f", "#e05d2f"], pilgrim: ["#48433e", "#9b4a2e"], warden: ["#596066", "#6e8e91"], swarm: ["#3b3533", "#a36b47"],
      hound: ["#42372e", "#7d5330"], adept: ["#40343f", "#884f7e"], tollKeeper: ["#595147", "#d26436"], orison: ["#3d4649", "#3fc8c8"],
    };
    const [, glowColor] = colors[enemy.type];
    const scale = definition.radius * (definition.boss ? 1.22 : 1);
    if (["archer", "scribe", "adept", "orison"].includes(enemy.type)) {
      const focus = MeshBuilder.CreateSphere(`${enemy.type} focus`, { diameter: scale * 0.45, segments: 8 }, this.scene);
      focus.position.set(0, scale * 1.65, -scale * 0.7);
      focus.material = this.mat(`${enemy.type} focus mat`, glowColor ?? "#86452e", glowColor ?? "#b6542f");
      focus.parent = root;
      body.push(focus);
    }
    if (enemy.elite) {
      const crown = MeshBuilder.CreateTorus("elite crown", { diameter: scale * 2.2, thickness: 0.08, tessellation: 24 }, this.scene);
      crown.position.y = scale * 2.8;
      crown.material = this.mat(`${enemy.elite} elite`, enemy.elite === "frost" ? "#69a2b1" : enemy.elite === "ember" ? "#9d3d24" : "#8b7454", enemy.elite === "frost" ? "#87d0df" : "#db6235");
      crown.parent = root;
      body.push(crown);
    }
    const healthBack = MeshBuilder.CreatePlane("enemy health back", { width: definition.boss ? 3.5 : 1.7, height: 0.13 }, this.scene);
    healthBack.position.y = scale * 3.05;
    healthBack.billboardMode = Mesh.BILLBOARDMODE_ALL;
    healthBack.material = this.mat("health empty", "#161719", undefined, 0.9);
    healthBack.parent = root;
    const healthFill = MeshBuilder.CreatePlane("enemy health fill", { width: definition.boss ? 3.42 : 1.62, height: 0.07 }, this.scene);
    healthFill.position.set(0, scale * 3.05, -0.01);
    healthFill.billboardMode = Mesh.BILLBOARDMODE_ALL;
    healthFill.material = this.mat("enemy health", definition.boss ? "#c55a35" : "#ac4437", "#542019");
    healthFill.parent = root;
    const targetRing = MeshBuilder.CreateTorus("target ring", { diameter: definition.radius * 2.8, thickness: 0.08, tessellation: 28 }, this.scene);
    targetRing.position.y = 0.06;
    targetRing.material = this.mat("targeted enemy", "#d5b06b", "#a56431");
    targetRing.isVisible = false;
    targetRing.parent = root;
    body.push(targetRing);
    tagPickable(body, enemy.id);
    return { root, body, healthBack, healthFill, targetRing, rig };
  }

  private createPickupView(pickup: Pickup): PickupView {
    const root = new TransformNode(`pickup ${pickup.label}`, this.scene);
    const colors = { worn: "#aaa69a", tempered: "#5aa47b", inscribed: "#5e93b5", relic: "#d28a42" };
    const color = pickup.kind === "gold" ? "#d0a554" : pickup.kind === "potion" ? "#a9473e" : pickup.kind === "dust" ? "#7b8b90" : colors[pickup.rarity ?? "worn"];
    const glowMat = this.mat(`pickup ${color}`, color, color);
    const shape = pickup.kind === "item"
      ? MeshBuilder.CreatePolyhedron("equipment drop", { type: 1, size: 0.42 }, this.scene)
      : MeshBuilder.CreateSphere("resource drop", { diameter: 0.5, segments: 8 }, this.scene);
    shape.position.y = 0.65;
    shape.material = glowMat;
    shape.parent = root;
    shape.isPickable = false;
    const ring = MeshBuilder.CreateTorus("loot ring", { diameter: pickup.kind === "item" ? 1.35 : 0.85, thickness: 0.05, tessellation: 24 }, this.scene);
    ring.position.y = 0.06;
    ring.material = glowMat;
    ring.parent = root;
    ring.isPickable = false;
    return { root, ring };
  }

  private bindEvents(): void {
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("contextmenu", this.onContextMenu);
    this.canvas.addEventListener("wheel", this.onWheel, {passive: false});
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("resize", this.resize);
    window.addEventListener("blur", this.onBlur);
  }

  private onBlur = (): void => { if (!this.simulation.paused && !this.simulation.victory) this.callbacks.onPause(); };
  private onWheel = (event: WheelEvent): void => { event.preventDefault(); this.zoom = Math.max(13,Math.min(24,this.zoom+event.deltaY*.012)); };

  private onContextMenu = (event: MouseEvent): void => event.preventDefault();

  private onPointerMove = (event: PointerEvent): void => {
    const hit = this.scene.pick(event.offsetX, event.offsetY, (mesh) => Boolean(mesh.metadata?.ground));
    if (hit?.pickedPoint) this.hoverPoint = { x: hit.pickedPoint.x, z: hit.pickedPoint.z };
  };

  private onPointerDown = (event: PointerEvent): void => {
    if(this.simulation.paused)return;
    void this.audio.resume();
    const actorHit = this.scene.pick(event.offsetX, event.offsetY, (mesh) => Boolean(mesh.metadata?.enemyId));
    const groundHit = this.scene.pick(event.offsetX, event.offsetY, (mesh) => Boolean(mesh.metadata?.ground));
    const point = groundHit?.pickedPoint ? { x: groundHit.pickedPoint.x, z: groundHit.pickedPoint.z } : this.hoverPoint;
    this.targetPoint = point;
    if (event.button === 2) {
      const core = classLoadouts[this.simulation.hero.class].core;
      const targetId = actorHit?.pickedMesh?.metadata?.enemyId as number | undefined;
      if (this.simulation.cast(core, point, targetId)) this.audio.cue("cast");
      return;
    }
    if (event.button !== 0) return;
    const enemyId = actorHit?.pickedMesh?.metadata?.enemyId as number | undefined;
    if (enemyId) this.simulation.attack(enemyId);
    else this.simulation.moveTo(point);
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (["INPUT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName)) return;
    this.keys.add(event.code);
    if (event.repeat) return;
    const panels: Record<string, RuntimeCallbacks["onPanel"] extends (panel: infer T) => void ? T : never> = {
      KeyI: "inventory", KeyK: "skills", KeyC: "character", KeyJ: "quests", Tab: "map", KeyM: "map",
    };
    if (panels[event.code]) {
      event.preventDefault();
      this.callbacks.onPanel(panels[event.code]);
      return;
    }
    const keyIndex = ["KeyQ", "KeyW", "KeyE", "KeyR"].indexOf(event.code);
    if (keyIndex >= 0) {
      const id = classLoadouts[this.simulation.hero.class].keys[keyIndex];
      if (this.simulation.cast(id, this.hoverPoint)) { this.audio.cue("cast");this.attackVisual=.55; }
      return;
    }
    if (event.code === "Space") {
      event.preventDefault();
      if (this.simulation.evade(this.hoverPoint)) this.audio.cue("cast");
    } else if (event.code === "Digit1") {
      if (this.simulation.usePotion()) this.audio.cue("heal");
    } else if (event.code === "KeyF") {
      const result = this.simulation.interact();
      if (result) this.audio.cue(result.includes("activated") ? "waypoint" : "loot");
    } else if (event.code === 'KeyV') {
      this.castSkill(this.simulation.hero.class==='cinder'?'ashenStandard':'horizonCall');
    } else if (event.code === "KeyT") {
      this.simulation.townGate();
    } else if (event.code === "Escape") {
      this.callbacks.onPause();
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => { this.keys.delete(event.code); };

  private frame(): void {
    if (this.disposed) return;
    const now = performance.now();
    const delta = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.frameSamples.push(delta);
    if (this.frameSamples.length > 50) this.frameSamples.shift();
    const changed = this.simulation.update(delta);
    if (changed) {this.consumeEffects(this.simulation.effects);this.simulation.effects.length=0;}
    this.updateViews(delta);
    this.updateCamera(delta);
    this.drawMinimap();
    this.scene.render();
    this.updateLabels(delta);
    if (now - this.lastSnapshot > 100) {
      this.lastSnapshot = now;
      const average = this.frameSamples.reduce((sum, value) => sum + value, 0) / Math.max(1, this.frameSamples.length);
      this.callbacks.onSnapshot(this.simulation.getSnapshot(Math.round(1 / Math.max(0.001, average))));
    }
  }

  private updateViews(delta: number): void {
    const heroView = this.actorViews.get("hero")!;
    heroView.root.position.set(this.simulation.hero.x, 0, this.simulation.hero.z);
    if(this.simulation.hero.attackTimer>this.lastAttackTimer+.05) this.attackVisual=.55;
    this.lastAttackTimer=this.simulation.hero.attackTimer;
    this.attackVisual=Math.max(0,this.attackVisual-delta);
    const target=this.simulation.hero.attackTarget?this.simulation.enemyMap.get(this.simulation.hero.attackTarget):undefined;
    if(target)heroView.root.rotation.y=Math.atan2(target.x-this.simulation.hero.x,target.z-this.simulation.hero.z);
    if(heroView.rig)animateRig(heroView.rig,this.simulation.time,Boolean(this.simulation.hero.moveTarget),Math.sin(this.attackVisual/.55*Math.PI));
    if (this.simulation.hero.moveTarget) {
      const direction = normalize2(this.simulation.hero, this.simulation.hero.moveTarget);
      heroView.root.rotation.y = Math.atan2(direction.x, direction.z);
      heroView.root.position.y = Math.abs(Math.sin(this.simulation.time * 11)) * 0.035;
    }
    heroView.root.scaling.setAll(this.simulation.hero.invulnerable > 0 && Math.floor(this.simulation.time * 18) % 2 === 0 ? 0.94 : 1);

    for (const enemy of this.simulation.enemyMap.values()) {
      let view = this.actorViews.get(enemy.id);
      if (!enemy.visible) {
        if (view) view.root.setEnabled(false);
        continue;
      }
      if (!view) {
        view = this.createEnemyView(enemy);
        this.actorViews.set(enemy.id, view);
      }
      view.root.setEnabled(true);
      view.root.position.set(enemy.x, 0, enemy.z);
      const direction = normalize2(enemy, this.simulation.hero);
      view.root.rotation.y = Math.atan2(direction.x, direction.z);
      const health = Math.max(0, enemy.hp / enemy.maxHp);
      if (view.healthFill) {
        view.healthFill.scaling.x = health;
        view.healthFill.position.x = -(1 - health) * (enemies[enemy.type].boss ? 1.71 : 0.81);
      }
      if (view.healthBack) view.healthBack.isVisible = enemy.state !== "dead" && (health < 1 || enemies[enemy.type].boss === true);
      if (view.healthFill) view.healthFill.isVisible = view.healthBack?.isVisible ?? false;
      if (view.targetRing) view.targetRing.isVisible = this.simulation.hero.attackTarget === enemy.id && enemy.state !== "dead";
      if(view.rig)animateRig(view.rig,this.simulation.time,enemy.state==='approach'||enemy.state==='reposition',enemy.state==='execute'?1:0,enemy.state==='telegraph'?Math.max(0,1-enemy.stateTimer/enemies[enemy.type].telegraph):0);
      if (enemy.state === "dead") {
        view.deadAt ??= this.simulation.time;
        const progress = Math.min(1, (this.simulation.time - view.deadAt) / 1.8);
        view.root.scaling.y = Math.max(0.05, 1 - progress);
        view.root.position.y = -progress * 0.3;
      }
    }

    for (const pickup of this.simulation.pickupMap.values()) {
      let view = this.pickupViews.get(pickup.id);
      if (!view) {
        view = this.createPickupView(pickup);
        this.pickupViews.set(pickup.id, view);
      }
      view.root.position.set(pickup.x, 0.06 + Math.sin(this.simulation.time * 2.5 + pickup.id) * 0.08, pickup.z);
      view.root.rotation.y += delta * 0.8;
      view.ring.scaling.setAll(0.92 + Math.sin(this.simulation.time * 3 + pickup.id) * 0.08);
    }
    for (const [id, view] of this.pickupViews) if (!this.simulation.pickupMap.has(id)) { view.root.dispose(); this.pickupViews.delete(id); }

    for (const hazard of this.simulation.hazards) {
      let mesh = this.hazardViews.get(hazard.id);
      if (!mesh) {
        mesh = MeshBuilder.CreateCylinder(`hazard ${hazard.kind}`, { diameter: hazard.radius * 2, height: 0.045, tessellation: 36 }, this.scene);
        const color = hazard.kind === "ember" ? "#b64724" : hazard.kind === "blight" ? "#70506f" : hazard.kind === "beam" ? "#72aebd" : hazard.kind === "snare" ? "#667c66" : "#ad8950";
        mesh.material = this.mat(`hazard ${hazard.kind}`, color, color, 0.38);
        mesh.isPickable = false;
        this.hazardViews.set(hazard.id, mesh);
      }
      mesh.position.set(hazard.x, 0.1, hazard.z);
      mesh.scaling.setAll(0.96 + Math.sin(this.simulation.time * 5 + hazard.id) * 0.04);
    }
    for (const [id, mesh] of this.hazardViews) if (!this.simulation.hazards.some((hazard) => hazard.id === id)) { mesh.dispose(); this.hazardViews.delete(id); }

    for (let index = this.fxViews.length - 1; index >= 0; index -= 1) {
      const fx = this.fxViews[index];
      fx.elapsed += delta;
      const progress = Math.min(1, fx.elapsed / fx.duration);
      fx.mesh.scaling.setAll(fx.startScale * (0.3 + progress * 1.35));
      fx.mesh.visibility = 1 - progress;
      if (fx.rise) fx.mesh.position.y += delta * fx.rise;
      if (progress >= 1) { fx.mesh.dispose(); this.fxViews.splice(index, 1); }
    }
  }

  private consumeEffects(effects: CombatFx[]): void {
    for (const effect of effects) {
      if(effect.id<=this.lastFxId)continue;
      this.lastFxId=effect.id;
      const color = { hit: "#d8d1c1", crit: "#e6ba67", ember: "#db572e", frost: "#8cc9d4", blight: "#876487", heal: "#5ca18f", telegraph: "#c94b2f", loot: "#d1a65b", evade: "#6ca6a5", level: "#56c4c1" }[effect.kind];
      const ring = MeshBuilder.CreateTorus(`fx ${effect.kind}`, { diameter: Math.max(0.8, effect.radius * 1.4), thickness: effect.kind === "telegraph" ? 0.16 : 0.09, tessellation: 28 }, this.scene);
      ring.position.set(effect.x, effect.kind === "loot" ? 0.5 : 0.12, effect.z);
      ring.material = this.mat(`fx ${effect.kind}`, color, color, effect.kind === "telegraph" ? 0.72 : 0.9);
      ring.isPickable = false;
      this.fxViews.push({ mesh: ring, elapsed: 0, duration: effect.kind === "telegraph" ? 0.7 : 0.45, startScale: 0.4, rise: effect.kind === "loot" ? 0.7 : undefined });
      if(effect.value&&this.settings.damageNumbers){
        const node=document.createElement('span');node.className=`damage-float ${effect.kind}`;node.textContent=String(effect.value);this.labels.append(node);
        this.damageLabels.push({node,point:new Vector3(effect.x,2.2,effect.z),age:0});
      }
      if(effect.kind!=='telegraph'&&effect.kind!=='loot')for(let i=0;i<4;i++){
        const spark=MeshBuilder.CreatePolyhedron('impact spark',{type:1,size:effect.kind==='crit'?.1:.065},this.scene);
        spark.position.set(effect.x+Math.cos(i*1.6)*.35,.8+i*.18,effect.z+Math.sin(i*1.6)*.35);
        spark.material=this.mat(`spark ${effect.kind}`,color,color);spark.isPickable=false;
        this.fxViews.push({mesh:spark,elapsed:0,duration:.3+i*.035,startScale:1,rise:1.2});
      }
      if (effect.kind === "crit") { this.audio.cue("crit"); this.shake = Math.max(this.shake, 0.2); }
      else if (effect.kind === "hit") this.audio.cue("hit");
      else if (effect.kind === "telegraph") this.audio.cue("danger");
      else if (effect.kind === "loot") this.audio.cue("loot");
      else if (effect.kind === "level") this.audio.cue("waypoint");
      if (["ember", "frost", "blight"].includes(effect.kind) && this.settings.screenShake) this.shake = Math.max(this.shake, 0.12);
    }
    if (this.simulation.victory&&!this.victorySoundPlayed) {this.audio.cue("victory");this.victorySoundPlayed=true;}
  }

  private updateCamera(delta: number): void {
    const hero = this.simulation.hero;
    const zoom = this.zoom;
    const desired = new Vector3(hero.x + zoom * 0.72, zoom * 0.82, hero.z - zoom * 0.72);
    const follow = 1 - Math.exp(-delta * 10);
    this.camera.position = Vector3.Lerp(this.camera.position, desired, follow);
    if (this.shake > 0 && !this.settings.reducedMotion && this.settings.screenShake) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.5;
      this.shake = Math.max(0, this.shake - delta * 0.8);
    }
    this.camera.setTarget(new Vector3(hero.x + 0.5, 0.4, hero.z + 0.5));
    const zone = formatZone(this.simulation.zone);
    if (zone !== this.zoneLabel) this.zoneLabel = zone;
  }

  private updateLabels(delta:number):void {
    const viewport=this.camera.viewport.toGlobal(this.engine.getRenderWidth(),this.engine.getRenderHeight());
    for(let i=this.damageLabels.length-1;i>=0;i--){const label=this.damageLabels[i];label.age+=delta;
      const p=Vector3.Project(label.point,Matrix.Identity(),this.scene.getTransformMatrix(),viewport);
      label.node.style.left=`${p.x/this.engine.getRenderWidth()*100}%`;label.node.style.top=`${p.y/this.engine.getRenderHeight()*100}%`;
      label.node.style.transform=`translate(-50%,${-label.age*60}px)`;label.node.style.opacity=String(1-label.age/.85);
      if(label.age>.85){label.node.remove();this.damageLabels.splice(i,1);}
    }
    const targets={keeper:{x:-25,z:-18,label:'F · SPEAK TO MAELIN'},waypoint:{x:-7,z:-5,label:'F · RESTORE THE ASHWAY'},tollKeeper:{x:10,z:5,label:'THE TOLL-KEEPER'},artificer:{x:17,z:11,label:'F · FREE ARTIFICER SABLE'},orison:{x:32,z:20,label:'ORISON ENGINE'},complete:{x:-28,z:-20,label:'T · RETURN TO REFUGE'}};
    const target=targets[this.simulation.questStep];const gap=distance2(target,this.simulation.hero);
    if(this.objectiveRing){this.objectiveRing.position.set(target.x,.13,target.z);this.objectiveRing.visibility=.6+Math.sin(this.simulation.time*2)*.2;}
    const p=Vector3.Project(new Vector3(target.x,2.9,target.z),Matrix.Identity(),this.scene.getTransformMatrix(),viewport);
    this.objectiveLabel.style.display=gap<19?'block':'none';this.objectiveLabel.style.left=`${p.x/this.engine.getRenderWidth()*100}%`;this.objectiveLabel.style.top=`${p.y/this.engine.getRenderHeight()*100}%`;
    this.objectiveLabel.textContent=target.label;
  }

  private drawMinimap(): void {
    const context = this.minimap.getContext("2d");
    if (!context) return;
    const width = this.minimap.width = Math.max(220, Math.round(this.minimap.clientWidth * devicePixelRatio));
    const height = this.minimap.height = Math.max(150, Math.round(this.minimap.clientHeight * devicePixelRatio));
    context.clearRect(0, 0, width, height);
    context.fillStyle = "rgba(8, 10, 11, .88)";
    context.fillRect(0, 0, width, height);
    const map = (point: Vec2) => ({ x: ((point.x + WORLD_SIZE / 2) / WORLD_SIZE) * width, y: ((point.z + WORLD_SIZE / 2) / WORLD_SIZE) * height });
    context.strokeStyle = "rgba(154, 146, 126, .42)";
    context.lineWidth = 10 * devicePixelRatio;
    context.lineCap = "round";
    context.beginPath();
    const path = [{ x: -29, z: -21 }, { x: -7, z: -5 }, { x: 10, z: 5 }, { x: 22, z: 13 }, { x: 33, z: 21 }];
    path.forEach((point, index) => { const mapped = map(point); if (index === 0) context.moveTo(mapped.x, mapped.y); else context.lineTo(mapped.x, mapped.y); });
    context.stroke();
    for (const enemy of this.simulation.enemyMap.values()) {
      if (!enemy.visible || enemy.state === "dead" || distance2(enemy, this.simulation.hero) > 16) continue;
      const point = map(enemy);
      context.fillStyle = enemies[enemy.type].boss ? "#e06b3e" : "#9b4738";
      context.beginPath(); context.arc(point.x, point.y, (enemies[enemy.type].boss ? 4 : 2) * devicePixelRatio, 0, Math.PI * 2); context.fill();
    }
    const markers = [{ x: -7, z: -5 }, { x: 10, z: 5 }, { x: 17, z: 11 }, { x: 32, z: 20 }];
    context.fillStyle = "#bba06a";
    for (const marker of markers) { const point = map(marker); context.fillRect(point.x - 2, point.y - 2, 4, 4); }
    const hero = map(this.simulation.hero);
    context.fillStyle = "#54c4c1";
    context.beginPath(); context.arc(hero.x, hero.y, 4 * devicePixelRatio, 0, Math.PI * 2); context.fill();
    context.strokeStyle = "rgba(84, 196, 193, .25)";
    context.beginPath(); context.arc(hero.x, hero.y, 16 / WORLD_SIZE * width, 0, Math.PI * 2); context.stroke();
  }

  castSkill(id: SkillId): boolean {
    const cast = this.simulation.cast(id, this.hoverPoint);
    if (cast) this.audio.cue("cast");
    return cast;
  }

  usePotion(): void { if (this.simulation.usePotion()) this.audio.cue("heal"); }
  interact(): void { this.simulation.interact(); }
  evade(): void { this.simulation.evade(this.hoverPoint); }
  setPaused(paused: boolean): void { this.simulation.setPaused(paused); }

  updateSettings(settings: RuntimeSettings): void {
    this.settings = settings;
    this.audio.setEnabled(settings.sound);
    this.scene.shadowsEnabled = settings.shadows;
    this.engine.setHardwareScalingLevel(settings.quality === "high" ? 1 / Math.min(devicePixelRatio, 1.6) : settings.quality === "medium" ? 1 : 1.25);
  }

  private resize = (): void => this.engine.resize();

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    this.canvas.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("blur", this.onBlur);
    this.engine.stopRenderLoop();
    this.audio.dispose();
    this.scene.dispose();
    this.engine.dispose();
    this.canvas.remove();
    this.labels.remove();
  }
}

class SeededVisual {
  private state: number;
  constructor(seed: number) { this.state = seed >>> 0; }
  next(): number { this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0; return this.state / 4294967296; }
  range(minimum: number, maximum: number): number { return minimum + (maximum - minimum) * this.next(); }
}

function normalize2(from: Vec2, to: Vec2): Vec2 {
  const x = to.x - from.x;
  const z = to.z - from.z;
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
}

function distance2(a: Vec2, b: Vec2): number { return Math.hypot(a.x - b.x, a.z - b.z); }
