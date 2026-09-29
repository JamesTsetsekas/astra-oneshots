import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { Engine } from "@babylonjs/core/Engines/engine";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Camera } from "@babylonjs/core/Cameras/camera";
import "@babylonjs/core/Culling/ray";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { heightAt, OBSTACLES, rayBox } from "../game/world";
import type { Session } from "../game/session";
import { RARITIES } from "../game/content";
import type { GameEvent, Input, Settings, V3 } from "../game/types";
import { Avatar, Maker, Palette, WeaponModel } from "./models";
import { Island } from "./island";
type Trail = { mesh: Mesh; life: number };
const exposedEchoes = new WeakMap<Session, { stamp: number; meshes: Mesh[] }>();
export class GameView {
  engine: Engine;
  scene: Scene;
  camera: FreeCamera;
  palette: Palette;
  private island: Island;
  private avatars: Avatar[];
  private lootModels = new Map<number, { model: WeaponModel; ring: Mesh }>();
  private chests = new Map<number, Mesh[]>();
  private trails: Trail[] = [];
  private stormWall: Mesh;
  private nextRing: Mesh;
  private marker: Mesh;
  private skiff: Mesh[] = [];
  private smokes = new Map<number, Mesh>();
  private camReady = false;
  private shoulder = 1;
  private damageKick = 0;
  constructor(
    canvas: HTMLCanvasElement,
    public session: Session,
    public settings: Settings,
  ) {
    this.engine = new Engine(
      canvas,
      true,
      { preserveDrawingBuffer: false, stencil: true, antialias: true },
      false,
    );
    this.engine.setHardwareScalingLevel(
      settings.quality === "low"
        ? 1.7
        : settings.quality === "medium"
          ? 1.2
          : Math.min(1.5, window.devicePixelRatio || 1),
    );
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.66, 0.8, 0.77, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.0015;
    this.scene.fogColor = new Color3(0.66, 0.8, 0.77);
    this.scene.ambientColor = new Color3(0.18, 0.2, 0.15);
    const sun = new DirectionalLight(
      "sun",
      new Vector3(-0.5, -1, 0.5),
      this.scene,
    );
    sun.diffuse = Color3.FromHexString("#fff0d6");
    sun.intensity = 1.02;
    const hemi = new HemisphericLight("sky", new Vector3(0, 1, 0), this.scene);
    hemi.intensity = 0.68;
    hemi.groundColor = Color3.FromHexString("#52654f");
    this.palette = new Palette(this.scene);
    this.island = new Island(this.scene, this.palette);
    this.camera = new FreeCamera(
      "shoulder camera",
      new Vector3(0, 30, 0),
      this.scene,
    );
    this.camera.inputs.clear();
    this.camera.minZ = 0.12;
    this.camera.maxZ = 2000;
    this.camera.fovMode = Camera.FOVMODE_HORIZONTAL_FIXED;
    this.camera.fov = (settings.fov * Math.PI) / 180;
    this.avatars = session.actors.map(
      (a) => new Avatar(this.scene, this.palette, a.skin),
    );
    if (settings.shadows && settings.quality !== "low") {
      sun.shadowMinZ = 1;
      sun.shadowMaxZ = 260;
      sun.orthoLeft = -85;
      sun.orthoRight = 85;
      sun.orthoTop = 85;
      sun.orthoBottom = -85;
      sun.autoUpdateExtends = false;
      const shadows = new ShadowGenerator(
        settings.quality === "high" ? 2048 : 1024,
        sun,
      );
      shadows.usePercentageCloserFiltering = true;
      shadows.filteringQuality = ShadowGenerator.QUALITY_LOW;
      shadows.bias = 0.002;
      shadows.normalBias = 0.04;
      shadows.setDarkness(0.22);
      for (const mesh of this.scene.meshes) {
        if (
          mesh.name === "voidsea" ||
          mesh.name === "atmosphere" ||
          mesh.name === "contact shadow" ||
          mesh.name.includes("#d9e7d4") ||
          mesh.name === "the-highwake"
        )
          continue;
        mesh.receiveShadows = true;
        shadows.addShadowCaster(mesh);
      }
      this.scene.onBeforeRenderObservable.add(() => {
        const p = this.session.player.alive
          ? this.session.player
          : (this.session.alive[0] ?? this.session.player);
        sun.position.set(p.x + 70, p.y + 130, p.z - 70);
      });
    }
    this.stormWall = MeshBuilder.CreateCylinder(
      "riftstorm boundary",
      {
        diameter: 2,
        height: 300,
        tessellation: 120,
        sideOrientation: Mesh.DOUBLESIDE,
        cap: Mesh.NO_CAP,
      },
      this.scene,
    );
    const stormMat = this.palette.get("#8677c6", 0.6, 0.24);
    this.stormWall.material = stormMat;
    this.stormWall.isPickable = false;
    this.nextRing = MeshBuilder.CreateTorus(
      "next calmfield",
      { diameter: 2, thickness: 0.009, tessellation: 100 },
      this.scene,
    );
    this.nextRing.material = this.palette.get("#efefba", 0.5, 0.55);
    this.marker = MeshBuilder.CreateCylinder(
      "landing marker",
      { diameter: 0.35, height: 120, tessellation: 8 },
      this.scene,
    );
    this.marker.material = this.palette.get("#e7c579", 0.5, 0.45);
    const m = new Maker(this.scene, this.palette);
    this.skiff.push(
      m.box("transit skiff", [7, 0.8, 17], [0, 0, 0], "#ccb981"),
      m.box("deck", [6, 0.3, 14], [0, 0.65, 0], "#618f8c"),
      m.box("bow", [5, 2, 3], [0, 1, 8], "#e5d7b3"),
    );
    for (const s of [-1, 1]) {
      this.skiff.push(
        m.box("skiff wing", [10, 0.15, 8], [s * 6, 1, 0], "#e9deba"),
        m.box("turbine", [2, 2, 5], [s * 4, -1, -5], "#98774e"),
      );
    }
    for (const mesh of this.skiff) mesh.setEnabled(false);
  }
  swapShoulder() {
    this.shoulder *= -1;
  }
  aim(): { aimOrigin: V3; aimDirection: V3 } {
    const ray = this.camera.getForwardRay();
    return {
      aimOrigin: { x: ray.origin.x, y: ray.origin.y, z: ray.origin.z },
      aimDirection: {
        x: ray.direction.x,
        y: ray.direction.y,
        z: ray.direction.z,
      },
    };
  }
  event(e: GameEvent) {
    if (e.type === "shot" && e.position && e.end) {
      const line = MeshBuilder.CreateLines(
        "ballistic tracer",
        {
          points: [
            new Vector3(e.position.x, e.position.y, e.position.z),
            new Vector3(e.end.x, e.end.y, e.end.z),
          ],
        },
        this.scene,
      );
      line.color = Color3.FromHexString(e.actor === 0 ? "#ffdc8a" : "#efb899");
      line.alpha = 0.8;
      this.trails.push({ mesh: line, life: 0.09 });
      if (e.actor === 0 && !this.settings.reducedMotion)
        this.damageKick = 0.045;
    }
    if (e.type === "hit" && e.position) {
      const spark = MeshBuilder.CreateSphere(
        "impact",
        { diameter: 0.32, segments: 4 },
        this.scene,
      );
      spark.position.set(e.position.x, e.position.y, e.position.z);
      spark.material = this.palette.get(e.shield ? "#a7dfed" : "#f6c489", 0.8);
      this.trails.push({ mesh: spark, life: 0.14 });
    }
  }
  update(dt: number, input: Input) {
    this.engine.beginFrame();
    const s = this.session,
      p = s.player;
    const visualTime = this.settings.reducedMotion ? 0 : s.time;
    this.island.update(visualTime);
    this.avatars.forEach((avatar, i) =>
      avatar.update(s.actors[i], s.time, i === 0, input.ads),
    );
    let focus = p;
    if (!p.alive) focus = s.alive[0] ?? p;
    const yaw = p.alive ? input.yaw : focus.yaw,
      pitch = p.alive ? input.pitch : 0.12;
    const direction = new Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      -Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    );
    const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    let target = new Vector3(
        focus.x,
        focus.y + (focus.stance === "crouch" ? 1.25 : 1.75),
        focus.z,
      ),
      distance = input.ads ? 2.3 : 5.3,
      offset = input.ads ? 0.64 : 0.87;
    if (s.phase === "dropping") {
      distance = 8;
      offset = 0.35;
      target.y += 0.6;
    }
    if (s.phase === "skiff") {
      distance = 18;
      target.y += 4;
      offset = 0;
    }
    const desired = target
      .subtract(direction.scale(distance))
      .add(right.scale(offset * this.shoulder));
    desired.y += input.ads ? 0.05 : 0.4;
    const delta = desired.subtract(target),
      length = delta.length(),
      dir = delta.scale(1 / length);
    let near = length;
    for (const o of OBSTACLES) {
      const t = rayBox(target, dir, o, near);
      if (t !== undefined) near = Math.max(0.45, t - 0.25);
    }
    const cameraPosition = target.add(dir.scale(near));
    cameraPosition.y = Math.max(
      heightAt(cameraPosition.x, cameraPosition.z) + 0.45,
      cameraPosition.y,
    );
    if (!this.camReady) {
      this.camera.position.copyFrom(cameraPosition);
      this.camReady = true;
    } else
      this.camera.position = Vector3.Lerp(
        this.camera.position,
        cameraPosition,
        Math.min(1, dt * 18),
      );
    const look = this.camera.position.add(direction.scale(100));
    look.y += this.damageKick;
    this.damageKick = Math.max(0, this.damageKick - dt * 0.7);
    this.camera.setTarget(look);
    const fov = ((this.settings.fov * Math.PI) / 180) * (input.ads ? 0.72 : 1);
    this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 14);
    this.stormWall.scaling.set(
      Math.max(0.01, s.storm.radius),
      1,
      Math.max(0.01, s.storm.radius),
    );
    this.stormWall.position.set(s.storm.x, 130, s.storm.z);
    this.stormWall.setEnabled(
      s.options.mode === "solo" && s.phase !== "staging",
    );
    this.nextRing.position.set(
      s.storm.nextX,
      Math.max(1, heightAt(s.storm.nextX, s.storm.nextZ)) + 0.35,
      s.storm.nextZ,
    );
    this.nextRing.scaling.set(s.storm.nextRadius, 1, s.storm.nextRadius);
    this.nextRing.setEnabled(s.options.mode === "solo");
    this.marker.position.set(
      s.marker.x,
      heightAt(s.marker.x, s.marker.z) + 60,
      s.marker.z,
    );
    this.marker.setEnabled(s.phase === "skiff" || s.phase === "dropping");
    for (const loot of s.loot) {
      const visible =
        loot.active && Math.hypot(loot.x - focus.x, loot.z - focus.z) < 85;
      let entry = this.lootModels.get(loot.id);
      if (visible && !entry) {
        const model = new WeaponModel(this.scene, this.palette, loot.item.id);
        model.root.scaling.setAll(1.3);
        const ring = MeshBuilder.CreateTorus(
          "loot rarity",
          { diameter: 1, thickness: 0.045, tessellation: 16 },
          this.scene,
        );
        ring.position.set(loot.x, loot.y + 0.05, loot.z);
        ring.material = this.palette.get(RARITIES[loot.item.rarity].color, 0.6);
        entry = { model, ring };
        this.lootModels.set(loot.id, entry);
      }
      if (entry) {
        entry.model.root.setEnabled(visible);
        entry.ring.setEnabled(visible);
        if (visible) {
          entry.model.root.position.set(
            loot.x,
            loot.y + 0.65 + Math.sin(visualTime * 2 + loot.id) * 0.12,
            loot.z,
          );
          entry.model.root.rotation.y = visualTime * 0.5 + loot.id;
        }
      }
    }
    for (const chest of s.chests) {
      let meshes = this.chests.get(chest.id);
      if (!meshes && Math.hypot(chest.x - focus.x, chest.z - focus.z) < 95) {
        const m = new Maker(this.scene, this.palette);
        meshes = [
          m.box(
            "resonance chest",
            [1.45, 0.85, 0.8],
            [chest.x, chest.y + 0.43, chest.z],
            "#ab8351",
          ),
          m.box(
            "ceramic chest lid",
            [1.5, 0.2, 0.85],
            [chest.x, chest.y + 0.95, chest.z],
            "#e0c58d",
          ),
          m.box(
            "chest seal",
            [0.18, 0.6, 0.85],
            [chest.x, chest.y + 0.63, chest.z],
            "#7cc7c1",
          ),
        ];
        this.chests.set(chest.id, meshes);
      }
      if (meshes) {
        meshes[1].rotation.x = chest.opened ? -0.8 : 0;
        meshes[2].setEnabled(!chest.opened);
      }
    }
    for (const mesh of this.skiff) {
      mesh.setEnabled(s.phase === "skiff");
      if (s.phase === "skiff") {
        if (!mesh.metadata) mesh.metadata = { local: mesh.position.clone() };
        const local = mesh.metadata.local as Vector3;
        mesh.position.set(p.x + local.x, p.y - 1 + local.y, p.z + local.z);
      }
    }
    const echoStamp = s.echoes[0]?.time ?? -1,
      previous = exposedEchoes.get(s);
    if (previous?.stamp !== echoStamp) {
      previous?.meshes.forEach((m) => m.dispose());
      const meshes = s.echoes.map((f) => {
        const m = MeshBuilder.CreateDisc(
          "historical footstep",
          { radius: 0.22, tessellation: 6 },
          this.scene,
        );
        m.position.set(f.x, f.y, f.z);
        m.rotation.x = Math.PI / 2;
        m.material = this.palette.get("#efd68b", 0.65, 0.85);
        return m;
      });
      exposedEchoes.set(s, { stamp: echoStamp, meshes });
    }
    if (!this.settings.shadows)
      for (const mesh of this.scene.meshes)
        if (mesh.name === "contact shadow") mesh.setEnabled(false);
    if (this.settings.reducedMotion) this.island.update(0);
    const activeSmoke = new Set<number>();
    s.smoke.forEach((mist) => {
      activeSmoke.add(mist.until);
      let mesh = this.smokes.get(mist.until);
      if (!mesh) {
        mesh = MeshBuilder.CreateSphere(
          "mist screen",
          { diameter: 15, segments: 10 },
          this.scene,
        );
        mesh.material = this.palette.get("#dbe2c6", 0.15, 0.65);
        this.smokes.set(mist.until, mesh);
      }
      mesh.position.set(mist.x, mist.y + 3, mist.z);
    });
    for (const [id, mesh] of this.smokes)
      if (!activeSmoke.has(id)) {
        mesh.dispose();
        this.smokes.delete(id);
      }
    for (const trail of this.trails) {
      trail.life -= dt;
      trail.mesh.scaling.scaleInPlace(1 + dt * 3);
      if (trail.life <= 0) trail.mesh.dispose();
    }
    this.trails = this.trails.filter((t) => t.life > 0);
    this.scene.render();
    this.engine.endFrame();
  }
  resize() {
    this.engine.resize();
  }
  dispose() {
    this.scene.dispose();
    this.engine.dispose();
  }
}
