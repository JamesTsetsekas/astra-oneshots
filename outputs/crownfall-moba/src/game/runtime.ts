import * as THREE from "three";
import {
  Simulation,
  type Options,
  type Snapshot,
  type Unit,
  type Result,
} from "./simulation";
import {
  TEAM_COLORS,
  LANES,
  BRUSH,
  heroById,
  distance,
  type Point,
} from "./content";
import {
  createRig,
  animateRig,
  buildMap,
  material,
  type Rig,
} from "../render/world";
import { AudioDirector } from "./audio";
export interface Settings {
  sound: boolean;
  quality: "high" | "medium" | "low";
  reducedMotion: boolean;
  damageNumbers: boolean;
  cameraLock: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  quality: "high",
  reducedMotion: false,
  damageNumbers: true,
  cameraLock: true,
};
export interface Callbacks {
  snapshot(s: Snapshot): void;
  panel(type: "shop" | "scoreboard" | "pause"): void;
  result(r: Result): void;
}
export class Runtime {
  readonly sim: Simulation;
  readonly audio = new AudioDirector();
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(46, 1, 0.1, 500);
  private host: HTMLElement;
  private callbacks: Callbacks;
  private settings: Settings;
  private overlay = document.createElement("canvas");
  private minimap: HTMLCanvasElement;
  private ray = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private aim: Point = { x: 0, z: 0 };
  private focus = new THREE.Vector3();
  private zoom = 31;
  private keys = new Set<string>();
  private rigs = new Map<number, Rig>();
  private projectileViews = new Map<number, THREE.Mesh>();
  private zones = new Map<number, THREE.Group>();
  private cleanupMap: () => void;
  private frameId = 0;
  private last = performance.now();
  private lastSnapshot = 0;
  private resultSent = false;
  private lastEvent = 0;
  private frameTimes: number[] = [];
  private disposed = false;
  private marker: THREE.Mesh;
  private markerLife = 0;
  private selected?: number;
  private fogCanvas = document.createElement("canvas");
  private fogTexture: THREE.CanvasTexture;
  private fogTimer = 0;
  private effectLabels: Array<{
    x: number;
    z: number;
    value: number;
    age: number;
    color: string;
  }> = [];
  fps = 0;
  constructor(
    host: HTMLElement,
    minimap: HTMLCanvasElement,
    options: Options,
    settings: Settings,
    callbacks: Callbacks,
  ) {
    this.host = host;
    this.minimap = minimap;
    this.settings = settings;
    this.callbacks = callbacks;
    this.sim = new Simulation(options);
    this.focus.set(this.sim.player.x, 0, this.sim.player.z);
    this.renderer = new THREE.WebGLRenderer({
      antialias: settings.quality !== "low",
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, settings.quality === "high" ? 1.6 : 1),
    );
    this.renderer.shadowMap.enabled = settings.quality !== "low";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.domElement.className = "world-canvas";
    this.renderer.domElement.tabIndex = 0;
    host.append(this.renderer.domElement);
    this.overlay.className = "world-overlay";
    host.append(this.overlay);
    this.scene.background = new THREE.Color("#2c4b69");
    this.scene.fog = new THREE.Fog("#56758a", 100, 235);
    const ambient = new THREE.HemisphereLight("#e3f1f0", "#536858", 2.2);
    this.scene.add(ambient);
    const sun = new THREE.DirectionalLight("#ffe7b1", 3.1);
    sun.position.set(-32, 80, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -90;
    sun.shadow.camera.right = 90;
    sun.shadow.camera.top = 70;
    sun.shadow.camera.bottom = -70;
    sun.shadow.camera.far = 220;
    sun.shadow.normalBias = 0.15;
    sun.shadow.bias = -0.0003;
    this.scene.add(sun);
    this.cleanupMap = buildMap(this.scene, options.seed);
    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.65, 32),
      new THREE.MeshBasicMaterial({
        color: "#f4e5ab",
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.y = 0.15;
    this.scene.add(this.marker);
    this.fogCanvas.width = 300;
    this.fogCanvas.height = 220;
    this.fogTexture = new THREE.CanvasTexture(this.fogCanvas);
    const fog = new THREE.Mesh(
      new THREE.PlaneGeometry(150, 110),
      new THREE.MeshBasicMaterial({
        map: this.fogTexture,
        transparent: true,
        depthWrite: false,
      }),
    );
    fog.rotation.x = -Math.PI / 2;
    fog.position.y = 0.52;
    fog.renderOrder = 3;
    this.scene.add(fog);
    this.audio.setEnabled(settings.sound);
    this.bind();
    this.resize();
    this.frame();
    if (import.meta.env.DEV)
      (window as unknown as { __crownfallQA: unknown }).__crownfallQA = {
        inspect: () => this.sim.snapshot(),
        intent: (type: string, value?: unknown) =>
          this.sim.command(type, value),
      };
  }
  private bind() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointermove", this.pointerMove);
    canvas.addEventListener("pointerdown", this.pointerDown);
    canvas.addEventListener("contextmenu", this.context);
    canvas.addEventListener("wheel", this.wheel, { passive: false });
    window.addEventListener("keydown", this.keyDown);
    window.addEventListener("keyup", this.keyUp);
    window.addEventListener("resize", this.resize);
    window.addEventListener("blur", this.blur);
    this.minimap.addEventListener("pointerdown", this.mapClick);
  }
  private context = (e: MouseEvent) => e.preventDefault();
  private pointerMove = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      (-(e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.mouse, this.camera);
    const hit = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(this.ground, hit))
      this.aim = { x: hit.x, z: hit.z };
  };
  private pointerDown = (e: PointerEvent) => {
    void this.audio.resume();
    this.pointerMove(e);
    if (this.sim.paused || this.sim.result) return;
    const hits = this.ray.intersectObjects(
      [...this.rigs.values()].map((r) => r.root),
      true,
    );
    const id = hits[0]?.object.userData.unitId as number | undefined;
    const target = id ? this.sim.units.find((u) => u.id === id) : undefined;
    if (e.button === 0 && !this.keys.has("KeyA")) {
      this.selected = target?.id;
      return;
    }
    if (e.button === 2 || e.button === 0) {
      e.preventDefault();
      if (target && target.team !== 0) this.sim.command("attack", target.id);
      else this.sim.command("move", this.aim);
      this.marker.position.set(this.aim.x, 0.19, this.aim.z);
      this.markerLife = 1;
    }
  };
  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    this.zoom = Math.max(24, Math.min(42, this.zoom + e.deltaY * 0.015));
  };
  private keyDown = (e: KeyboardEvent) => {
    if (
      ["INPUT", "TEXTAREA", "SELECT"].includes(
        (e.target as HTMLElement)?.tagName,
      )
    )
      return;
    this.keys.add(e.code);
    const slot = ["KeyQ", "KeyW", "KeyE", "KeyR"].indexOf(e.code);
    if (slot >= 0) {
      e.preventDefault();
      if (!e.repeat) {
        const cast = this.sim.command(
          e.ctrlKey ? "rank" : "cast",
          e.ctrlKey ? slot : { slot, point: this.aim },
        );
        if (cast && !e.ctrlKey) this.audio.cue("cast");
      }
      return;
    }
    if (e.repeat) return;
    if (e.code === "KeyP") {
      e.preventDefault();
      this.callbacks.panel("shop");
    } else if (e.code === "Tab") {
      e.preventDefault();
      this.callbacks.panel("scoreboard");
    } else if (e.code === "Escape") this.callbacks.panel("pause");
    else if (e.code === "KeyB") this.sim.command("recall");
    else if (e.code === "KeyS" || e.code === "KeyH") this.sim.command("stop");
    else if (e.code === "KeyY")
      this.settings.cameraLock = !this.settings.cameraLock;
    else if (e.code === "Space" || e.code === "F1") {
      e.preventDefault();
      this.focus.set(this.sim.player.x, 0, this.sim.player.z);
    } else if (e.code === "Digit4") this.sim.command("ward", this.aim);
    else if (e.code === "KeyD" || e.code === "KeyF") {
      if (
        this.sim.command("talent", {
          index: e.code === "KeyD" ? 0 : 1,
          point: this.aim,
        })
      )
        this.audio.cue("cast");
    } else if (e.code === "KeyG") this.sim.command("ping", this.aim);
    else if (/^Digit[1-6]$/.test(e.code))
      this.sim.command("item", Number(e.code.at(-1)) - 1);
  };
  private keyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private blur = () => {
    this.keys.clear();
    if (!this.sim.paused && !this.sim.result) this.callbacks.panel("pause");
  };
  private mapClick = (e: PointerEvent) => {
    const rect = this.minimap.getBoundingClientRect();
    this.focus.set(
      ((e.clientX - rect.left) / rect.width) * 150 - 75,
      0,
      ((e.clientY - rect.top) / rect.height) * 110 - 55,
    );
    this.settings.cameraLock = false;
  };
  private frame = () => {
    if (this.disposed) return;
    this.frameId = requestAnimationFrame(this.frame);
    const now = performance.now(),
      delta = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.frameTimes.push(delta);
    if (this.frameTimes.length > 60) this.frameTimes.shift();
    this.fps = Math.round(
      1 /
        (this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length ||
          1),
    );
    this.sim.update(delta);
    this.updateActors(delta);
    this.updateCamera(delta);
    this.renderer.render(this.scene, this.camera);
    this.drawOverlay(delta);
    this.drawMinimap();
    this.fogTimer -= delta;
    if (this.fogTimer <= 0) {
      this.fogTimer = 0.2;
      this.drawFog();
    }
    if (now - this.lastSnapshot > 100) {
      this.lastSnapshot = now;
      this.callbacks.snapshot(this.sim.snapshot());
    }
    if (this.sim.result && !this.resultSent) {
      this.resultSent = true;
      this.audio.cue("victory");
      this.callbacks.result(this.sim.result);
    }
  };
  private updateActors(delta: number) {
    const present = new Set<number>();
    for (const u of this.sim.units) {
      if (u.hp <= 0 || !this.sim.visibleTo(0, u)) continue;
      present.add(u.id);
      let rig = this.rigs.get(u.id);
      if (!rig) {
        rig = createRig(u);
        this.rigs.set(u.id, rig);
        this.scene.add(rig.root);
      }
      rig.root.visible = true;
      animateRig(rig, u, this.sim.time);
      rig.accent.visible =
        u.kind === "hero" || structureKind(u) || u.id === this.selected;
    }
    for (const [id, rig] of this.rigs)
      if (!present.has(id)) {
        rig.root.visible = false;
        if (!this.sim.units.some((u) => u.id === id)) {
          this.scene.remove(rig.root);
          this.rigs.delete(id);
        }
      }
    for (const p of this.sim.projectiles) {
      if (
        p.team !== 0 &&
        !this.sim.units.some(
          (u) => u.team === 0 && u.hp > 0 && distance(p, u) < 18,
        )
      )
        continue;
      let view = this.projectileViews.get(p.id);
      if (!view) {
        view = new THREE.Mesh(
          new THREE.SphereGeometry(p.kind === "attack" ? 0.13 : 0.26, 6, 5),
          new THREE.MeshBasicMaterial({
            color: p.team === 0 ? "#88e8e0" : "#ff9b68",
          }),
        );
        this.projectileViews.set(p.id, view);
        this.scene.add(view);
      }
      view.position.set(p.x, 1.3, p.z);
      view.scale.z = p.kind === "attack" ? 2.2 : 3.5;
      view.rotation.y = Math.atan2(p.dx, p.dz);
    }
    for (const [id, view] of this.projectileViews)
      if (!this.sim.projectiles.some((p) => p.id === id)) {
        this.scene.remove(view);
        view.geometry.dispose();
        (view.material as THREE.Material).dispose();
        this.projectileViews.delete(id);
      }
    for (const z of this.sim.zones) {
      let view = this.zones.get(z.id);
      if (!view) {
        view = new THREE.Group();
        const color = z.team === 0 ? "#89d4bd" : "#ef886c";
        const edge = new THREE.Mesh(
          new THREE.RingGeometry(z.radius - 0.07, z.radius + 0.07, 48),
          new THREE.MeshBasicMaterial({
            color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
          }),
        );
        edge.rotation.x = -Math.PI / 2;
        const fill = new THREE.Mesh(
          new THREE.CircleGeometry(z.radius, 48),
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        fill.rotation.x = -Math.PI / 2;
        view.add(edge, fill);
        view.position.set(z.x, 0.25, z.z);
        this.scene.add(view);
        this.zones.set(z.id, view);
      }
      view.scale.setScalar(
        z.delay > 0 ? 0.86 + Math.sin(this.sim.time * 9) * 0.06 : 1,
      );
    }
    for (const [id, v] of this.zones)
      if (!this.sim.zones.some((z) => z.id === id)) {
        this.scene.remove(v);
        v.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            (o.material as THREE.Material).dispose();
          }
        });
        this.zones.delete(id);
      }
    this.markerLife = Math.max(0, this.markerLife - delta);
    this.marker.visible = this.markerLife > 0;
    this.marker.scale.setScalar(1 + (1 - this.markerLife) * 1.3);
    for (const e of this.sim.events)
      if (e.id > this.lastEvent) {
        this.lastEvent = e.id;
        if (
          ["kill", "structure", "objective", "level", "ward"].includes(e.kind)
        )
          this.audio.cue(e.kind);
        if (
          e.value &&
          this.settings.damageNumbers &&
          this.effectLabels.length < 30
        )
          this.effectLabels.push({
            x: e.x,
            z: e.z,
            value: e.value,
            age: 0,
            color: e.team === 0 ? "#fff1be" : "#efab96",
          });
      }
  }
  private updateCamera(delta: number) {
    const follow = this.settings.cameraLock || this.keys.has("Space");
    if (follow) {
      const desired = new THREE.Vector3(
        this.sim.player.x,
        0,
        this.sim.player.z,
      );
      this.focus.lerp(
        desired,
        this.settings.reducedMotion ? 1 : 1 - Math.exp(-delta * 7),
      );
    } else {
      const speed = delta * 24;
      if (this.keys.has("ArrowLeft")) this.focus.x -= speed;
      if (this.keys.has("ArrowRight")) this.focus.x += speed;
      if (this.keys.has("ArrowUp")) this.focus.z -= speed;
      if (this.keys.has("ArrowDown")) this.focus.z += speed;
    }
    this.focus.x = Math.max(-69, Math.min(69, this.focus.x));
    this.focus.z = Math.max(-44, Math.min(44, this.focus.z));
    this.camera.position.set(
      this.focus.x + this.zoom * 0.62,
      this.zoom,
      this.focus.z + this.zoom * 0.7,
    );
    this.camera.lookAt(this.focus.x, 0, this.focus.z);
  }
  private project(x: number, y: number, z: number) {
    const p = new THREE.Vector3(x, y, z).project(this.camera);
    return {
      x: ((p.x + 1) / 2) * this.overlay.width,
      y: ((1 - p.y) / 2) * this.overlay.height,
      visible: p.z < 1,
    };
  }
  private drawOverlay(delta: number) {
    const c = this.overlay.getContext("2d")!;
    c.clearRect(0, 0, this.overlay.width, this.overlay.height);
    const scale = this.overlay.width / this.overlay.clientWidth;
    for (const u of this.sim.units) {
      if (
        u.hp <= 0 ||
        !this.sim.visibleTo(0, u) ||
        u.kind === "ward" ||
        u.kind === "decoy"
      )
        continue;
      if (
        u.kind !== "hero" &&
        u.hp === u.maxHp &&
        !structureKind(u) &&
        u.team !== 2
      )
        continue;
      const p = this.project(
        u.x,
        structureKind(u)
          ? u.kind === "engine"
            ? 5.9
            : 6.5
          : u.kind === "colossus"
            ? 7
            : 3,
        u.z,
      );
      if (!p.visible) continue;
      const w = (u.kind === "hero" ? 58 : structureKind(u) ? 74 : 36) * scale,
        h = 5 * scale;
      c.fillStyle = "#112c33";
      c.fillRect(p.x - w / 2 - 1, p.y - 1, w + 2, h + 2);
      c.fillStyle = TEAM_COLORS[u.team === 1 ? 1 : 0];
      c.fillRect(p.x - w / 2, p.y, w * Math.max(0, u.hp / u.maxHp), h);
      if (u.shield) {
        c.fillStyle = "#f1e4ad";
        c.fillRect(
          p.x - w / 2,
          p.y - 3 * scale,
          w * Math.min(1, u.shield / u.maxHp),
          2 * scale,
        );
      }
      if (u.kind === "hero") {
        c.font = `600 ${10 * scale}px Segoe UI`;
        c.textAlign = "center";
        c.fillStyle = "#eef1db";
        c.fillText(`${u.name} · ${u.level}`, p.x, p.y - 6 * scale);
        c.fillStyle = "#80b6ce";
        c.fillRect(
          p.x - w / 2,
          p.y + 7 * scale,
          (w * u.mana) / u.maxMana,
          2 * scale,
        );
      }
      if (structureKind(u) && !this.sim.vulnerable(u)) {
        c.fillStyle = "#d5d3b3";
        c.font = `${9 * scale}px Segoe UI`;
        c.textAlign = "center";
        c.fillText("PROTECTED", p.x, p.y - 5 * scale);
      }
    }
    for (const e of this.effectLabels) {
      e.age += delta;
      const p = this.project(e.x, 2 + e.age * 1.4, e.z);
      c.globalAlpha = Math.max(0, 1 - e.age / 0.8);
      c.fillStyle = e.color;
      c.font = `700 ${16 * scale}px Georgia`;
      c.textAlign = "center";
      c.fillText(String(e.value), p.x, p.y);
    }
    c.globalAlpha = 1;
    this.effectLabels = this.effectLabels.filter((e) => e.age < 0.8);
    if (this.sim.player.dead > 0) {
      c.fillStyle = "#142d3977";
      c.fillRect(0, 0, this.overlay.width, this.overlay.height);
    }
  }
  private drawFog() {
    const c = this.fogCanvas.getContext("2d")!;
    c.clearRect(0, 0, 300, 220);
    c.fillStyle = "rgba(23,43,55,.52)";
    c.fillRect(0, 0, 300, 220);
    c.globalCompositeOperation = "destination-out";
    for (const u of this.sim.units) {
      if (u.team !== 0 || u.hp <= 0) continue;
      const x = (u.x + 75) * 2,
        y = (55 - u.z) * 2,
        r = (u.kind === "ward" ? 18 : u.kind === "hero" ? 17 : 12) * 2;
      const gradient = c.createRadialGradient(x, y, r * 0.55, x, y, r);
      gradient.addColorStop(0, "rgba(0,0,0,1)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = gradient;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
    c.globalCompositeOperation = "source-over";
    this.fogTexture.needsUpdate = true;
  }
  private drawMinimap() {
    const c = this.minimap.getContext("2d")!,
      w = this.minimap.width,
      h = this.minimap.height;
    const project = (p: Point) => ({
      x: ((p.x + 75) / 150) * w,
      y: ((p.z + 55) / 110) * h,
    });
    c.fillStyle = "#143545";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#476756";
    c.beginPath();
    c.ellipse(w / 2, h / 2, w * 0.49, h * 0.48, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#aab29b";
    c.lineWidth = 4;
    for (const lane of LANES) {
      c.beginPath();
      lane.forEach((p, i) => {
        const v = project(p);
        if (!i) c.moveTo(v.x, v.y);
        else c.lineTo(v.x, v.y);
      });
      c.stroke();
    }
    for (const b of BRUSH) {
      const p = project(b);
      c.fillStyle = "#345b46";
      c.beginPath();
      c.arc(p.x, p.y, (b.r / 150) * w, 0, Math.PI * 2);
      c.fill();
    }
    for (const u of this.sim.units) {
      if (u.hp <= 0 || !this.sim.visibleTo(0, u)) continue;
      const p = project(u);
      c.fillStyle = u.team === 2 ? "#d0a8df" : TEAM_COLORS[u.team];
      const r = u.kind === "hero" ? 4 : structureKind(u) ? 3 : 1.4;
      c.beginPath();
      c.arc(p.x, p.y, r, 0, Math.PI * 2);
      c.fill();
      if (u === this.sim.player) {
        c.strokeStyle = "#fff4cf";
        c.lineWidth = 1.5;
        c.stroke();
      }
    }
    const p = project({ x: this.focus.x, z: this.focus.z });
    c.strokeStyle = "#c4e1d8aa";
    c.lineWidth = 1;
    c.strokeRect(p.x - 20, p.y - 16, 40, 32);
  }
  command(type: string, value?: unknown) {
    const result = this.sim.command(type, value);
    if (result && (type === "buy" || type === "cast"))
      this.audio.cue(type === "buy" ? "shop" : "cast");
    return result;
  }
  cast(slot: number) {
    return this.command("cast", { slot, point: this.aim });
  }
  talent(index: number) {
    return this.command("talent", { index, point: this.aim });
  }
  setPaused(paused: boolean) {
    this.sim.paused = paused;
  }
  setSettings(settings: Settings) {
    this.settings = { ...settings };
    this.audio.setEnabled(settings.sound);
    this.renderer.shadowMap.enabled = settings.quality !== "low";
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, settings.quality === "high" ? 1.6 : 1),
    );
    this.resize();
  }
  private resize = () => {
    this.renderer.setSize(this.host.clientWidth, this.host.clientHeight);
    this.camera.aspect = this.host.clientWidth / this.host.clientHeight;
    this.camera.updateProjectionMatrix();
    this.overlay.width = this.host.clientWidth * devicePixelRatio;
    this.overlay.height = this.host.clientHeight * devicePixelRatio;
  };
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointermove", this.pointerMove);
    canvas.removeEventListener("pointerdown", this.pointerDown);
    canvas.removeEventListener("contextmenu", this.context);
    canvas.removeEventListener("wheel", this.wheel);
    window.removeEventListener("keydown", this.keyDown);
    window.removeEventListener("keyup", this.keyUp);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("blur", this.blur);
    this.minimap.removeEventListener("pointerdown", this.mapClick);
    this.audio.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
      }
    });
    this.fogTexture.dispose();
    this.cleanupMap();
    this.renderer.dispose();
    canvas.remove();
    this.overlay.remove();
  }
}
function structureKind(u: Unit) {
  return ["tower", "seal", "coreTower", "engine"].includes(u.kind);
}
