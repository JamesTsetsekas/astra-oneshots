import * as THREE from "three";
import { buildings, units, WORLD_DEPTH, WORLD_WIDTH } from "./data";
import { GameAudio } from "./audio";
import { GameSimulation } from "./simulation";
import { animateModel, makeBuilding, makeUnit, terrain } from "./art";
import type {
  BuildingType,
  Entity,
  Faction,
  GameOptions,
  GameSnapshot,
  MatchEvent,
  ResourceNode,
  UnitType,
  Vec2,
  WatchPylon,
} from "./types";

interface RuntimeCallbacks {
  onSnapshot: (snapshot: GameSnapshot) => void;
  onHotkey: (action: "build" | "pause" | "settings") => void;
  onError?: (message:string)=>void;
}

export interface RuntimeSettings {
  shadows: boolean;
  edgeScroll: boolean;
  sound: boolean;
  reducedMotion: boolean;
  quality: "low" | "medium" | "high";
}

interface EntityView {
  group: THREE.Group;
  body: THREE.Group;
  ring: THREE.Mesh;
  healthGroup: THREE.Group;
  healthFill: THREE.Mesh;
  cargo?: THREE.Object3D;
  lastAttackTimer: number;
  lastHp: number;
}

interface TimedEffect {
  object: THREE.Object3D;
  age: number;
  duration: number;
  material: THREE.Material;
  grow?: boolean;
}

type CommandMode =
  | { kind: "build"; type: BuildingType; ghost: THREE.Group }
  | { kind: "attackMove" }
  | { kind: "rally" }
  | undefined;

function makeMaterial(color: number, emissive = 0x000000, roughness = 0.68, metalness = 0.18): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: emissive ? 0.55 : 0, roughness, metalness });
}

function factionPalette(faction: Faction, team: Entity["team"]): { base: number; accent: number; dark: number } {
  const enemyShift = team === "ai" ? 0.72 : 1;
  if (faction === "helix") {
    return {
      base: team === "ai" ? 0x85483a : 0xb8c0ca,
      accent: team === "ai" ? 0xff5a43 : 0xffaf48,
      dark: Math.floor(0x1b2732 * enemyShift),
    };
  }
  return {
    base: team === "ai" ? 0x762f51 : 0x4f6c63,
    accent: team === "ai" ? 0xff557d : 0xb96dff,
    dark: Math.floor(0x172522 * enemyShift),
  };
}

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  result.position.set(...position);
  result.scale.set(...scale);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

export class GameRuntime {
  readonly simulation: GameSimulation;
  readonly audio = new GameAudio();

  private container: HTMLElement;
  private minimap: HTMLCanvasElement;
  private callbacks: RuntimeCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private ground: THREE.Mesh;
  private entityViews = new Map<number, EntityView>();
  private nodeViews = new Map<number, THREE.Group>();
  private pylonViews = new Map<number, THREE.Group>();
  private effects: TimedEffect[] = [];
  private fogCanvas = document.createElement("canvas");
  private fogContext!: CanvasRenderingContext2D;
  private fogTexture!: THREE.CanvasTexture;
  private fogMaterial!: THREE.MeshBasicMaterial;
  private explored!: Uint8Array;
  private selectionMarquee = document.createElement("div");
  private commandMode: CommandMode;
  private animationFrame = 0;
  private lastFrame = performance.now();
  private frameTimes: number[] = [];
  private lastUiUpdate = 0;
  private lastFogUpdate = 0;
  private keys = new Set<string>();
  private cameraTarget = new THREE.Vector3(-30, 0, 21);
  private cameraHeight = 34;
  private pointerScreen?: { x: number; y: number };
  private dragStart?: { x: number; y: number };
  private middleDrag?: { x: number; y: number };
  private lastClickTime = 0;
  private lastClickType?: string;
  private controlGroups = new Map<number, number[]>();
  private lastGroupTap = new Map<number, number>();
  private settings: RuntimeSettings;
  private disposed = false;
  private resizeObserver: ResizeObserver;
  private timeScale = 1;

  constructor(
    container: HTMLElement,
    minimap: HTMLCanvasElement,
    options: GameOptions,
    callbacks: RuntimeCallbacks,
    settings: RuntimeSettings,
    saved?:string,
  ) {
    this.container = container;
    this.minimap = minimap;
    this.callbacks = callbacks;
    this.settings = settings;
    this.simulation = new GameSimulation(options);
    if(saved)this.simulation.restore(saved);
    if(import.meta.env.DEV)(window as unknown as {__shardfront:unknown}).__shardfront={simulation:this.simulation,screenPoint:(x:number,z:number)=>{const p=new THREE.Vector3(x,1,z).project(this.camera);return {x:(p.x*.5+.5)*this.container.clientWidth,y:(-p.y*.5+.5)*this.container.clientHeight};},stats:()=>({calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles})};
    this.audio.setEnabled(settings.sound);

    this.renderer = new THREE.WebGLRenderer({ antialias: settings.quality !== "low", powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.quality === "high" ? 2 : 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.13;
    this.renderer.shadowMap.enabled = settings.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = "game-canvas";
    this.container.prepend(this.renderer.domElement);

    this.ground = this.createWorld();
    this.fogCanvas.width = 240;
    this.fogCanvas.height = 180;
    this.fogContext = this.fogCanvas.getContext("2d", { willReadFrequently: true })!;
    this.fogTexture = new THREE.CanvasTexture(this.fogCanvas);
    this.fogTexture.colorSpace = THREE.SRGBColorSpace;
    this.fogMaterial = new THREE.MeshBasicMaterial({ map: this.fogTexture, transparent: true, depthWrite: false, opacity: 1 });
    this.explored = new Uint8Array(this.fogCanvas.width * this.fogCanvas.height);
    const fogPlane = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_WIDTH, WORLD_DEPTH), this.fogMaterial);
    fogPlane.rotation.x = -Math.PI / 2;
    fogPlane.position.y = 0.13;
    fogPlane.renderOrder = 50;
    this.scene.add(fogPlane);

    this.selectionMarquee.className = "selection-marquee";
    this.container.append(this.selectionMarquee);

    this.createStaticViews();
    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
    this.updateCamera();
    this.renderLoop = this.renderLoop.bind(this);
    this.animationFrame = requestAnimationFrame(this.renderLoop);
  }

  private createWorld(): THREE.Mesh {
    this.scene.background = new THREE.Color(0x405659);
    this.scene.fog = new THREE.FogExp2(0x405659, 0.0022);
    this.scene.add(new THREE.HemisphereLight(0xc1e8eb, 0x59645a, 2.6));
    const sun = new THREE.DirectionalLight(0xffe2b8, 3.7);
    sun.position.set(-28, 65, 35);
    sun.castShadow = this.settings.shadows;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -68; sun.shadow.camera.right = 68;
    sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55;
    sun.shadow.normalBias = .08;
    sun.shadow.bias = -.0003;
    this.scene.add(sun);
    return terrain(this.scene);
  }

  private createStaticViews(): void {
    for (const node of this.simulation.nodes) {
      const view = this.createResourceView(node);
      this.nodeViews.set(node.id, view);
      this.scene.add(view);
    }
    for (const pylon of this.simulation.pylons) {
      const view = this.createPylonView(pylon);
      this.pylonViews.set(pylon.id, view);
      this.scene.add(view);
    }
  }

  private createResourceView(node: ResourceNode): THREE.Group {
    const group = new THREE.Group();
    group.position.set(node.x, 0, node.z);
    group.userData.resourceId = node.id;
    if (node.kind === "ore") {
      const shardMaterial = makeMaterial(0x50d4d3, 0x1a9698, 0.25, 0.35);
      for (let i = 0; i < 3; i += 1) {
        const shard = mesh(
          new THREE.OctahedronGeometry(0.42 + i * 0.08, 0),
          shardMaterial,
          [(i - 1) * 0.38, 0.38 + i * 0.12, (i % 2) * 0.25],
          [0.65, 1.6 + i * 0.2, 0.65],
        );
        shard.userData.resourceId = node.id;
        group.add(shard);
      }
    } else {
      const ring = mesh(new THREE.TorusGeometry(0.95, 0.18, 10, 24), makeMaterial(0x9f69ff, 0x6c35c9, 0.3, 0.5), [0, 0.2, 0]);
      ring.rotation.x = Math.PI / 2;
      ring.userData.resourceId = node.id;
      const core = mesh(new THREE.CylinderGeometry(0.33, 0.55, 1.3, 10), makeMaterial(0x36265b, 0x8f50ff), [0, 0.65, 0]);
      core.userData.resourceId = node.id;
      group.add(ring, core);
    }
    return group;
  }

  private createPylonView(pylon: WatchPylon): THREE.Group {
    const group = new THREE.Group();
    group.position.set(pylon.x, 0, pylon.z);
    const base = mesh(new THREE.CylinderGeometry(1.4, 1.8, 0.45, 10), makeMaterial(0x26313b, 0x123337), [0, 0.23, 0]);
    const mast = mesh(new THREE.CylinderGeometry(0.18, 0.32, 3.7, 8), makeMaterial(0x596971, 0x000000, 0.6, 0.55), [0, 2.1, 0]);
    const halo = mesh(new THREE.TorusGeometry(0.85, 0.08, 8, 28), makeMaterial(0x6ed7d7, 0x38bbbb), [0, 3.5, 0]);
    halo.name = "pylon-halo";
    halo.rotation.x = Math.PI / 2;
    group.add(base, mast, halo);
    return group;
  }

  private createEntityView(entity: Entity): EntityView {
    const group = new THREE.Group();
    const body = entity.kind === "unit" ? this.createUnitBody(entity) : this.createBuildingBody(entity);
    group.add(body);
    group.position.set(entity.x, entity.y, entity.z);
    group.userData.entityId = entity.id;
    group.traverse((object) => {
      object.userData.entityId = entity.id;
    });

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: entity.team === "player" ? 0x6de9db : 0xff5e6e,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(entity.radius * 1.05, entity.radius * 1.25, 32), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    ring.visible = false;
    group.add(ring);

    const healthGroup = new THREE.Group();
    healthGroup.position.set(0, entity.kind === "building" ? 4.2 : 2.8, 0);
    const back = mesh(
      new THREE.PlaneGeometry(entity.kind === "building" ? 3.6 : 2.2, 0.23),
      new THREE.MeshBasicMaterial({ color: 0x130f14, transparent: true, opacity: 0.88, depthWrite: false }),
      [0, 0, 0],
    );
    const healthFill = mesh(
      new THREE.PlaneGeometry(entity.kind === "building" ? 3.45 : 2.05, 0.13),
      new THREE.MeshBasicMaterial({ color: entity.team === "player" ? 0x69edbb : 0xff6874, depthWrite: false }),
      [0, 0.01, -0.01],
    );
    healthGroup.add(back, healthFill);
    healthGroup.visible = false;
    group.add(healthGroup);

    this.scene.add(group);
    return { group, body, ring, healthGroup, healthFill, cargo: body.getObjectByName("cargo"), lastAttackTimer: entity.attackTimer, lastHp: entity.hp };
  }

  private createUnitBody(entity: Entity): THREE.Group {
    return makeUnit(entity);
  }

  private createBuildingBody(entity: Entity): THREE.Group {
    return makeBuilding(entity);
  }

  private updateEntityViews(dt: number, now: number): void {
    const existing = new Set<number>();
    for (const entity of this.simulation.entities.values()) {
      existing.add(entity.id);
      let view = this.entityViews.get(entity.id);
      if (!view) {
        view = this.createEntityView(entity);
        this.entityViews.set(entity.id, view);
      }
      const ghostBuilding = entity.team === "ai" && entity.kind === "building" && !entity.visible && entity.lastSeen > -Infinity;
      view.group.visible = entity.team === "player" || entity.visible || ghostBuilding;
      view.group.position.x += (entity.x - view.group.position.x) * Math.min(1, dt * 18);
      view.group.position.z += (entity.z - view.group.position.z) * Math.min(1, dt * 18);
      view.group.position.y = entity.y + (entity.kind === "unit" && entity.faction === "chorus" ? Math.sin(now * 0.002 + entity.id) * 0.06 : 0);
      view.ring.visible = entity.selected;
      view.healthGroup.visible = !ghostBuilding && (entity.selected || entity.hp < entity.maxHp);
      view.healthGroup.quaternion.copy(this.camera.quaternion);
      const health = Math.max(0.001, entity.hp / entity.maxHp);
      view.healthFill.scale.x = health;
      view.healthFill.position.x = -(1 - health) * (entity.kind === "building" ? 1.72 : 1.02);
      if(!ghostBuilding)view.body.scale.y += ((entity.complete ? 1 : Math.max(0.08, entity.buildProgress)) - view.body.scale.y) * Math.min(1, dt * 8);
      view.body.traverse((object) => {
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) {
          object.material.transparent = ghostBuilding || entity.deathTimer !== undefined;
          object.material.opacity = ghostBuilding ? 0.17 : entity.deathTimer !== undefined ? Math.max(0, entity.deathTimer / 1.2) : 1;
        }
      });
      if (view.cargo) view.cargo.visible = entity.cargoAmount > 0;
      const moving = entity.kind === "unit" && (Math.abs(entity.x-view.group.position.x)+Math.abs(entity.z-view.group.position.z)>.01);
      animateModel(view.body, moving, now*.001+entity.id, entity.attackTimer>.8, this.settings.reducedMotion);
      const facing = entity.targetId ? this.simulation.entities.get(entity.targetId) : entity.moveTarget;
      if (facing) {
        const desired = Math.atan2(facing.x - entity.x, facing.z - entity.z);
        let delta = desired - view.body.rotation.y;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        view.body.rotation.y += delta * Math.min(1, dt * 8);
      }

      if (view.group.visible && entity.attackTimer > view.lastAttackTimer + 0.05 && entity.targetId) {
        const target = this.simulation.entities.get(entity.targetId);
        if (target) this.spawnShot(entity, target);
      }
      if (view.group.visible && entity.hp < view.lastHp - 0.5) this.spawnImpact(entity);
      view.lastAttackTimer = entity.attackTimer;
      view.lastHp = entity.hp;
    }

    for (const [id, view] of this.entityViews) {
      if (existing.has(id)) continue;
      this.scene.remove(view.group);
      this.disposeObject(view.group);
      this.entityViews.delete(id);
    }
  }

  private spawnShot(attacker: Entity, target: Entity): void {
    this.audio.shot(attacker.faction==='chorus',(attacker.x-this.cameraTarget.x)/25,Math.hypot(attacker.x-this.cameraTarget.x,attacker.z-this.cameraTarget.z),attacker.type==='siege');
    const color = attacker.faction === "helix" ? 0xffbe65 : 0xc777ff;
    const start = new THREE.Vector3(attacker.x, attacker.kind === "building" ? 2.1 : 1.35, attacker.z);
    const end = new THREE.Vector3(target.x, target.kind === "building" ? 1.5 : 0.9, target.z);
    if (attacker.type === "siege") {
      const orb = mesh(new THREE.SphereGeometry(0.24, 8, 6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }), [end.x, end.y, end.z]);
      this.scene.add(orb);
      this.effects.push({ object: orb, age: 0, duration: 0.45, material: orb.material as THREE.Material, grow: true });
      this.audio.impact(true);
      return;
    }
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 3;
    this.scene.add(line);
    this.effects.push({ object: line, age: 0, duration: 0.11, material });
  }

  private spawnImpact(entity: Entity): void {
    const material = new THREE.MeshBasicMaterial({ color: entity.team === "player" ? 0x6fffd3 : 0xff6e73, transparent: true, opacity: 0.7, depthWrite: false });
    const burst = mesh(new THREE.RingGeometry(0.2, 0.42, 16), material, [entity.x, entity.kind === "building" ? 1.4 : 0.8, entity.z]);
    burst.rotation.x = -Math.PI / 2;
    this.scene.add(burst);
    this.effects.push({ object: burst, age: 0, duration: 0.22, material, grow: true });
  }

  private updateEffects(dt: number): void {
    for (const effect of this.effects) {
      effect.age += dt;
      const t = effect.age / effect.duration;
      if (effect.grow) effect.object.scale.setScalar(1 + t * 2.4);
      if ("opacity" in effect.material) (effect.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - t);
    }
    for (const effect of this.effects.filter((item) => item.age >= item.duration)) {
      this.scene.remove(effect.object);
      this.disposeObject(effect.object);
    }
    this.effects = this.effects.filter((item) => item.age < item.duration);
  }

  private updateStaticViews(now: number): void {
    const vision=[...this.simulation.entities.values()].filter(e=>e.team==='player'&&e.deathTimer===undefined);
    for (const node of this.simulation.nodes) {
      const view = this.nodeViews.get(node.id);
      if (!view) continue;
      if(vision.some(e=>Math.hypot(e.x-node.x,e.z-node.z)<=e.vision+1))view.userData.seen=true;
      view.visible=!!view.userData.seen;
      const ratio = node.maxAmount <= 0 ? 0 : node.amount / node.maxAmount;
      view.scale.setScalar(0.35 + ratio * 0.65);
      view.rotation.y = Math.sin(now * 0.0002 + node.id) * 0.15;
    }
    for (const pylon of this.simulation.pylons) {
      const view = this.pylonViews.get(pylon.id);
      if (!view) continue;
      const halo = view.getObjectByName("pylon-halo") as THREE.Mesh | undefined;
      if (halo?.material instanceof THREE.MeshStandardMaterial) {
        const color = pylon.owner === "player" ? 0x55e7d2 : pylon.owner === "ai" ? 0xff5b69 : 0x7ba8ad;
        halo.material.color.setHex(color);
        halo.material.emissive.setHex(color);
      }
      if (halo) halo.rotation.z = now * 0.0007;
    }
    const dust = this.scene.getObjectByName("ambient-dust");
    if (dust) dust.rotation.y = now * 0.000015;
  }

  private updateFog(now: number): void {
    if (now - this.lastFogUpdate < 180) return;
    this.lastFogUpdate = now;
    const width = this.fogCanvas.width;
    const height = this.fogCanvas.height;
    const visible = new Uint8Array(width * height);
    const sources: Array<Vec2 & { vision: number }> = [];
    for (const entity of this.simulation.entities.values()) {
      if (entity.team === "player" && entity.complete && entity.deathTimer === undefined) sources.push({ x: entity.x, z: entity.z, vision: entity.vision });
    }
    for (const pylon of this.simulation.pylons) if (pylon.owner === "player") sources.push({ x: pylon.x, z: pylon.z, vision: 18 });
    for (const source of sources) {
      const cx = ((source.x + WORLD_WIDTH / 2) / WORLD_WIDTH) * width;
      const cy = ((source.z + WORLD_DEPTH / 2) / WORLD_DEPTH) * height;
      const rx = (source.vision / WORLD_WIDTH) * width;
      const ry = (source.vision / WORLD_DEPTH) * height;
      const minX = Math.max(0, Math.floor(cx - rx));
      const maxX = Math.min(width - 1, Math.ceil(cx + rx));
      const minY = Math.max(0, Math.floor(cy - ry));
      const maxY = Math.min(height - 1, Math.ceil(cy + ry));
      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const dx = (x - cx) / rx;
          const dy = (y - cy) / ry;
          const radius=Math.sqrt(dx*dx+dy*dy);
          if (radius <= 1) {
            const index = y * width + x;
            visible[index] = Math.max(visible[index],Math.min(255,Math.round((1-radius)/.17*255)));
            this.explored[index] = 1;
          }
        }
      }
    }
    const image = this.fogContext.createImageData(width, height);
    for (let i = 0; i < visible.length; i += 1) {
      const offset = i * 4;
      image.data[offset] = 3;
      image.data[offset + 1] = 8;
      image.data[offset + 2] = 14;
      image.data[offset + 3] = (this.explored[i]?135:205)*(1-visible[i]/255);
    }
    this.fogContext.putImageData(image, 0, 0);
    this.fogTexture.needsUpdate = true;
  }

  private drawMinimap(): void {
    const rect = this.minimap.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio);
    const width = Math.max(1, Math.floor(rect.width * ratio));
    const height = Math.max(1, Math.floor(rect.height * ratio));
    if (this.minimap.width !== width || this.minimap.height !== height) {
      this.minimap.width = width;
      this.minimap.height = height;
    }
    const context = this.minimap.getContext("2d")!;
    context.clearRect(0, 0, width, height);
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#173037");
    gradient.addColorStop(1, "#221923");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    const toMap = (x: number, z: number): [number, number] => [((x + WORLD_WIDTH / 2) / WORLD_WIDTH) * width, ((z + WORLD_DEPTH / 2) / WORLD_DEPTH) * height];
    context.globalAlpha = 0.42;
    context.strokeStyle = "#91c8c5";
    context.lineWidth = ratio;
    context.beginPath();
    context.moveTo(width * 0.5, 0);
    context.lineTo(width * 0.5, height);
    context.stroke();
    context.globalAlpha = 1;
    for (const node of this.simulation.nodes) {
      if (node.amount <= 0) continue;
      const [x, y] = toMap(node.x, node.z);
      context.fillStyle = node.kind === "ore" ? "#59d9d2" : "#a376ff";
      context.fillRect(x - 1.5 * ratio, y - 1.5 * ratio, 3 * ratio, 3 * ratio);
    }
    for (const pylon of this.simulation.pylons) {
      const [x, y] = toMap(pylon.x, pylon.z);
      context.fillStyle = pylon.owner === "player" ? "#55ebca" : pylon.owner === "ai" ? "#ff6671" : "#b1c7c8";
      context.beginPath();
      context.arc(x, y, 3 * ratio, 0, Math.PI * 2);
      context.fill();
    }
    for (const entity of this.simulation.entities.values()) {
      if (entity.deathTimer !== undefined || (entity.team === "ai" && !entity.visible)) continue;
      const [x, y] = toMap(entity.x, entity.z);
      context.fillStyle = entity.team === "player" ? "#69efd1" : "#ff5f6d";
      const size = (entity.kind === "building" ? 4 : 2.4) * ratio;
      if (entity.kind === "building") context.fillRect(x - size / 2, y - size / 2, size, size);
      else {
        context.beginPath();
        context.arc(x, y, size / 2, 0, Math.PI * 2);
        context.fill();
      }
    }
    const cameraWidth = (this.cameraHeight / 64) * width * 0.45;
    const cameraHeight = (this.cameraHeight / 64) * height * 0.35;
    const [cx, cy] = toMap(this.cameraTarget.x, this.cameraTarget.z);
    context.strokeStyle = "rgba(255,255,255,.75)";
    context.lineWidth = ratio;
    context.strokeRect(cx - cameraWidth / 2, cy - cameraHeight / 2, cameraWidth, cameraHeight);
  }

  private bindEvents(): void {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('webglcontextlost',this.onContextLost);
    canvas.addEventListener('webglcontextrestored',this.onContextRestored);
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.minimap.addEventListener("contextmenu", (event) => event.preventDefault());
    this.minimap.addEventListener("pointerdown", this.onMinimapPointer);
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (this.simulation.paused || this.simulation.result) return;
    this.audio.unlock();
    if (event.button === 1) {
      this.middleDrag = { x: event.clientX, y: event.clientY };
      event.preventDefault();
      return;
    }
    if (event.button === 0) {
      this.dragStart = { x: event.clientX, y: event.clientY };
      this.selectionMarquee.style.display = "block";
      this.selectionMarquee.style.left = `${event.offsetX}px`;
      this.selectionMarquee.style.top = `${event.offsetY}px`;
      this.selectionMarquee.style.width = "0px";
      this.selectionMarquee.style.height = "0px";
    } else if (event.button === 2) {
      this.issueContextOrder(event);
    }
  };

  private onPointerMove = (event: PointerEvent): void => {
    const bounds=this.container.getBoundingClientRect();
    this.pointerScreen = event.target === this.renderer.domElement ? {x:event.clientX-bounds.left,y:event.clientY-bounds.top} : undefined;
    if (this.middleDrag) {
      const dx = event.clientX - this.middleDrag.x;
      const dy = event.clientY - this.middleDrag.y;
      this.cameraTarget.x -= dx * (this.cameraHeight / 520);
      this.cameraTarget.z -= dy * (this.cameraHeight / 520);
      this.middleDrag = { x: event.clientX, y: event.clientY };
      this.clampCameraTarget();
      return;
    }
    if (this.dragStart) {
      const rect = this.container.getBoundingClientRect();
      const x1 = this.dragStart.x - rect.left;
      const y1 = this.dragStart.y - rect.top;
      const x2 = event.clientX - rect.left;
      const y2 = event.clientY - rect.top;
      this.selectionMarquee.style.left = `${Math.min(x1, x2)}px`;
      this.selectionMarquee.style.top = `${Math.min(y1, y2)}px`;
      this.selectionMarquee.style.width = `${Math.abs(x2 - x1)}px`;
      this.selectionMarquee.style.height = `${Math.abs(y2 - y1)}px`;
    }
    if (this.commandMode?.kind === "build") {
      const point = this.pickGround(event);
      if (point) {
        this.commandMode.ghost.position.set(point.x, 0.08, point.z);
        const valid = this.simulation.placementValid(this.commandMode.type, point.x, point.z);
        this.commandMode.ghost.traverse(o=>{if(o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial){o.material.color.setHex(valid?0x79d8b1:0xee786b);o.material.opacity=.52;}});
      }
    }
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (event.button === 1) {
      this.middleDrag = undefined;
      return;
    }
    if (event.button !== 0 || !this.dragStart) return;
    const start = this.dragStart;
    this.dragStart = undefined;
    this.selectionMarquee.style.display = "none";
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7;

    if (this.commandMode) {
      const point = this.pickGround(event);
      if (point) {
        if (this.commandMode.kind === "build") {
          const success = this.simulation.build(this.commandMode.type, point.x, point.z);
          success ? this.audio.complete() : this.audio.invalid();
          if (!event.shiftKey) this.clearCommandMode();
        } else if (this.commandMode.kind === "attackMove") {
          this.simulation.commandMove(point, true, event.shiftKey);
          this.audio.order();
          if (!event.shiftKey) this.clearCommandMode();
        } else {
          this.simulation.setRally(point);
          this.audio.order();
          this.clearCommandMode();
        }
      }
      return;
    }

    if (moved) {
      this.boxSelect(start, { x: event.clientX, y: event.clientY }, event.shiftKey);
      return;
    }
    const pick = this.pick(event);
    if (pick.entityId) {
      const entity = this.simulation.entities.get(pick.entityId);
      if (entity?.team === "player") {
        const now = performance.now();
        if (now - this.lastClickTime < 320 && this.lastClickType === entity.type) this.simulation.selectType(entity.type);
        else this.simulation.select([entity.id], event.shiftKey);
        this.lastClickTime = now;
        this.lastClickType = entity.type;
        this.audio.select();
        return;
      }
    }
    if (!event.shiftKey) this.simulation.clearSelection();
  };

  private issueContextOrder(event: PointerEvent): void {
    const pick = this.pick(event);
    if (pick.entityId) {
      const target = this.simulation.entities.get(pick.entityId);
      if (target?.team === "ai") {
        this.simulation.commandTarget(target.id);
        this.audio.order();
        return;
      }
    }
    if (pick.resourceId) {
      this.simulation.commandGather(pick.resourceId);
      this.audio.order();
      return;
    }
    if (pick.point) {
      this.showOrder(pick.point);
      const selected = this.simulation.selectedEntities;
      if (selected.length > 0 && selected.every((entity) => entity.kind === "building")) this.simulation.setRally(pick.point);
      else this.simulation.commandMove(pick.point, false, event.shiftKey);
      this.audio.order();
    }
  }

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.cameraHeight = THREE.MathUtils.clamp(this.cameraHeight + event.deltaY * 0.032, 24, 66);
  };

  private showOrder(point:Vec2):void{
    const material=new THREE.MeshBasicMaterial({color:0xa7f2c2,transparent:true,opacity:.9,depthWrite:false});
    const marker=new THREE.Mesh(new THREE.RingGeometry(.55,.68,32),material);marker.rotation.x=-Math.PI/2;marker.position.set(point.x,.18,point.z);this.scene.add(marker);this.effects.push({object:marker,age:0,duration:.65,material,grow:true});
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (["INPUT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName)) return;
    this.keys.add(event.code);
    if (this.simulation.paused && event.code!=="Escape" && event.code!=="F10") return;
    if (event.code.startsWith("Arrow") || event.code === "Space") event.preventDefault();
    if (event.repeat && !event.code.startsWith("Digit")) return;
    const production=this.getProducibleTypes().find(type=>units[type].hotkey===event.key.toUpperCase());
    if(production){this.train(production);event.preventDefault();return;}
    if(event.code==='KeyQ'){this.brace();return;}
    if(event.code==='KeyR'&&this.simulation.selectedEntities.some(e=>e.kind==='building')){this.setRallyMode();return;}
    if (event.code === "KeyA") {
      this.setAttackMoveMode();
      event.preventDefault();
    } else if (event.code === "KeyS") {
      this.simulation.stopSelected();
    } else if (event.code === "KeyH") {
      this.simulation.holdSelected();
    } else if (event.code === "KeyB") {
      this.callbacks.onHotkey("build");
    } else if (event.code === "KeyF") {
      this.focusSelection();
    } else if (event.code === "Home") {
      this.cameraTarget.set(-42, 0, 27);
    } else if (event.code === "Escape" || event.code === "F10") {
      if (this.commandMode) this.clearCommandMode();
      else this.callbacks.onHotkey("pause");
      event.preventDefault();
    } else if (event.code === "F11") {
      if (!document.fullscreenElement) void this.container.requestFullscreen();
      else void document.exitFullscreen();
      event.preventDefault();
    } else if (event.code.startsWith("Digit")) {
      const digit = Number(event.code.slice(5));
      if (digit >= 1 && digit <= 9) this.handleControlGroup(digit, event.ctrlKey, event.shiftKey);
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };
  private onBlur = (): void => { this.keys.clear(); this.pointerScreen=undefined; };
  private onContextLost=(event:Event):void=>{event.preventDefault();if(!this.simulation.paused)this.callbacks.onHotkey('pause');this.callbacks.onError?.('Graphics context lost. Your match is still in memory. Save the expedition, then reload if the display does not recover.');};
  private onContextRestored=():void=>{this.callbacks.onError?.('Graphics context restored. Resume when ready.');};
  private onVisibility = (): void => { if(document.hidden){this.onBlur();if(!this.simulation.paused&&!this.simulation.result)this.callbacks.onHotkey("pause");} };

  private onMinimapPointer = (event: PointerEvent): void => {
    const rect = this.minimap.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WORLD_WIDTH - WORLD_WIDTH / 2;
    const z = ((event.clientY - rect.top) / rect.height) * WORLD_DEPTH - WORLD_DEPTH / 2;
    if (event.button === 2) {
      this.simulation.commandMove({ x, z }, false, event.shiftKey);
      this.audio.order();
    } else {
      this.cameraTarget.set(x, 0, z);
      this.clampCameraTarget();
    }
  };

  private handleControlGroup(group: number, assign: boolean, add: boolean): void {
    if (assign) {
      const current = this.simulation.selectedIds;
      this.controlGroups.set(group, add ? [...new Set([...(this.controlGroups.get(group) ?? []), ...current])] : current);
      this.simulation.recordGroup();
      this.audio.complete();
      return;
    }
    const ids = this.controlGroups.get(group)?.filter((id) => this.simulation.entities.has(id)) ?? [];
    this.simulation.select(ids, add);
    const now = performance.now();
    if (now - (this.lastGroupTap.get(group) ?? 0) < 350) this.focusSelection();
    this.lastGroupTap.set(group, now);
  }

  private boxSelect(start: { x: number; y: number }, end: { x: number; y: number }, additive: boolean): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const minX = Math.min(start.x, end.x) - rect.left;
    const maxX = Math.max(start.x, end.x) - rect.left;
    const minY = Math.min(start.y, end.y) - rect.top;
    const maxY = Math.max(start.y, end.y) - rect.top;
    const ids: number[] = [];
    const projected = new THREE.Vector3();
    for (const entity of this.simulation.entities.values()) {
      if (entity.team !== "player" || entity.kind !== "unit" || entity.deathTimer !== undefined) continue;
      projected.set(entity.x, entity.y + 1, entity.z).project(this.camera);
      const x = (projected.x * 0.5 + 0.5) * rect.width;
      const y = (-projected.y * 0.5 + 0.5) * rect.height;
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) ids.push(entity.id);
    }
    this.simulation.select(ids, additive);
    if (ids.length > 0) this.audio.select();
  }

  private pick(event: PointerEvent): { entityId?: number; resourceId?: number; point?: Vec2 } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObjects(this.scene.children, true);
    for (const intersection of intersections) {
      let ancestor:THREE.Object3D|null=intersection.object,hidden=false;while(ancestor){if(!ancestor.visible)hidden=true;ancestor=ancestor.parent;}if(hidden)continue;
      const entityId = this.findUserData(intersection.object, "entityId");
      if (typeof entityId === "number") return { entityId, point: { x: intersection.point.x, z: intersection.point.z } };
      const resourceId = this.findUserData(intersection.object, "resourceId");
      if (typeof resourceId === "number") return { resourceId, point: { x: intersection.point.x, z: intersection.point.z } };
      if (intersection.object.userData.ground) return { point: { x: intersection.point.x, z: intersection.point.z } };
    }
    return {};
  }

  private pickGround(event: PointerEvent): Vec2 | undefined {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.ground, false)[0];
    return hit ? { x: hit.point.x, z: hit.point.z } : undefined;
  }

  private findUserData(object: THREE.Object3D, key: string): unknown {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current.userData[key] !== undefined) return current.userData[key];
      current = current.parent;
    }
    return undefined;
  }

  private updateCameraInput(dt: number): void {
    const speed = (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? 28 : 17) * (this.cameraHeight / 43) * dt;
    const allowWasd = this.simulation.selectedIds.length === 0 || this.keys.has("AltLeft") || this.keys.has("AltRight");
    if ((allowWasd && this.keys.has("KeyW")) || this.keys.has("ArrowUp")) this.cameraTarget.z -= speed;
    if ((allowWasd && this.keys.has("KeyS")) || this.keys.has("ArrowDown")) this.cameraTarget.z += speed;
    if ((allowWasd && this.keys.has("KeyA")) || this.keys.has("ArrowLeft")) this.cameraTarget.x -= speed;
    if ((allowWasd && this.keys.has("KeyD")) || this.keys.has("ArrowRight")) this.cameraTarget.x += speed;
    if (this.settings.edgeScroll && !this.dragStart && this.pointerScreen && document.hasFocus()) {
      const p=this.pointerScreen;
      if(p.x<18)this.cameraTarget.x-=speed;
      if(p.x>this.container.clientWidth-18)this.cameraTarget.x+=speed;
      if(p.y<18)this.cameraTarget.z-=speed;
      if(p.y>this.container.clientHeight-18)this.cameraTarget.z+=speed;
    }
    this.clampCameraTarget();
  }

  private clampCameraTarget(): void {
    this.cameraTarget.x = clamp(this.cameraTarget.x, -WORLD_WIDTH / 2 + 6, WORLD_WIDTH / 2 - 6);
    this.cameraTarget.z = clamp(this.cameraTarget.z, -WORLD_DEPTH / 2 + 5, WORLD_DEPTH / 2 - 5);
  }

  private updateCamera(): void {
    this.camera.position.set(this.cameraTarget.x, this.cameraHeight, this.cameraTarget.z + this.cameraHeight * 0.78);
    this.camera.lookAt(this.cameraTarget.x, 0, this.cameraTarget.z);
  }

  private renderLoop(now: number): void {
    if (this.disposed) return;
    const frameDt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.frameTimes.push(frameDt);
    if (this.frameTimes.length > 40) this.frameTimes.shift();
    const fps = this.frameTimes.length / Math.max(0.001, this.frameTimes.reduce((sum, value) => sum + value, 0));

    this.updateCameraInput(frameDt);
    this.updateCamera();
    for(let i=0;i<this.timeScale;i++)this.simulation.update(frameDt);
    this.updateEntityViews(frameDt, now);
    this.updateStaticViews(now);
    this.updateEffects(frameDt);
    this.updateFog(now);
    this.drawMinimap();
    this.handleEvents(this.simulation.consumeNewEvents());
    if(!this.simulation.paused)this.audio.update(this.simulation.time,this.effects.length>4);
    this.renderer.render(this.scene, this.camera);

    if (now - this.lastUiUpdate > 90 || this.simulation.result) {
      this.lastUiUpdate = now;
      this.callbacks.onSnapshot(this.simulation.getSnapshot(Math.round(fps)));
    }
    this.animationFrame = requestAnimationFrame(this.renderLoop);
  }

  private handleEvents(events: MatchEvent[]): void {
    for (const event of events) {
      if (event.kind === "warning") this.audio.alert();
      else if (event.kind === "milestone") this.audio.complete();
      else if (event.kind === "combat") this.audio.impact(event.text.includes("command core"));
    }
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  setBuildMode(type: BuildingType): void {
    this.clearCommandMode();
    const entity: Entity = {
      id: -1,
      team: "player",
      faction: this.simulation.options.faction,
      kind: "building",
      type,
      x: 0,
      z: 0,
      y: 0,
      radius: buildings[type].radius,
      hp: 1,
      maxHp: 1,
      armor: 0,
      vision: 0,
      complete: true,
      buildProgress: 1,
      selected: false,
      visible: true,
      lastSeen: 0,
      order: "idle",
      cargoAmount: 0,
      actionTimer: 0,
      attackTimer: 0,
      queue: [],
      brace: false,
      slowTimer: 0,
    };
    const ghost = this.createBuildingBody(entity);
    ghost.traverse((object) => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) {
        object.material = object.material.clone();
        object.material.transparent = true;
        object.material.opacity = 0.46;
        object.material.depthWrite = false;
      }
    });
    ghost.position.set(this.cameraTarget.x, 0.08, this.cameraTarget.z);
    this.scene.add(ghost);
    this.commandMode = { kind: "build", type, ghost };
    this.container.dataset.command = `PLACE ${buildings[type].label[this.simulation.options.faction].toUpperCase()}`;
  }

  setAttackMoveMode(): void {
    this.clearCommandMode();
    this.commandMode = { kind: "attackMove" };
    this.container.dataset.command = "ATTACK-MOVE";
  }

  setRallyMode(): void {
    this.clearCommandMode();
    this.commandMode = { kind: "rally" };
    this.container.dataset.command = "SET RALLY";
  }

  clearCommandMode(): void {
    if (this.commandMode?.kind === "build") {
      this.scene.remove(this.commandMode.ghost);
      this.disposeObject(this.commandMode.ghost);
    }
    this.commandMode = undefined;
    delete this.container.dataset.command;
  }

  focusSelection(): void {
    const selected = this.simulation.selectedEntities;
    if (selected.length === 0) return;
    const average = selected.reduce((sum, entity) => ({ x: sum.x + entity.x, z: sum.z + entity.z }), { x: 0, z: 0 });
    this.cameraTarget.set(average.x / selected.length, 0, average.z / selected.length);
    this.clampCameraTarget();
  }

  train(type: UnitType): boolean {
    const success = this.simulation.train(type);
    success ? this.audio.complete() : this.audio.invalid();
    return success;
  }

  research(kind: "attackUpgrade" | "armorUpgrade"): boolean {
    const success = this.simulation.research(kind);
    success ? this.audio.complete() : this.audio.invalid();
    return success;
  }

  stop(): void {
    this.simulation.stopSelected();
  }

  hold(): void {
    this.simulation.holdSelected();
  }

  brace(): void {
    this.simulation.toggleBrace();
  }

  cancelQueue(): void {
    this.simulation.cancelQueue();
  }

  togglePause(): void {
    this.simulation.togglePause();
  }

  setPaused(value: boolean): void {
    this.simulation.setPaused(value);
  }
  setSpeed(value:number):void{this.timeScale=value===4?4:value===2?2:1;}

  updateSettings(settings: RuntimeSettings): void {
    this.settings = settings;
    this.audio.setEnabled(settings.sound);
    this.renderer.shadowMap.enabled = settings.shadows;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.quality === "high" ? 2 : settings.quality === "medium" ? 1.5 : 1));
    this.resize();
  }

  getBuildableTypes(): BuildingType[] {
    return this.simulation.getBuildableTypes();
  }

  getProducibleTypes(): UnitType[] {
    return this.simulation.getProducibleTypes();
  }

  destroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('webglcontextlost',this.onContextLost);
    canvas.removeEventListener('webglcontextrestored',this.onContextRestored);
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.minimap.removeEventListener("pointerdown", this.onMinimapPointer);
    this.clearCommandMode();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.fogTexture.dispose();
    this.renderer.dispose();
    this.audio.dispose();
    canvas.remove();
    this.selectionMarquee.remove();
  }

  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Points) {
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) material.dispose();
      }
    });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
