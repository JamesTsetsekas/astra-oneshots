import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { buildCity, textSign } from "./city";
import {
  makeActor,
  animateActor,
  makeVehicle,
  box,
  mat,
  type Actor,
  type CarModel,
} from "./actors";
import { heightAt, INTERIORS, INTERIOR_WALLS, blocked } from "../game/world";
import { VEHICLES, CONTACTS } from "../game/content";
import type { Snapshot, Settings } from "../game/types";
const turn = (a: number, b: number, t: number) =>
  a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
export class GameRenderer {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: UniversalCamera;
  private sun: DirectionalLight;
  private hemi: HemisphericLight;
  private hero: Actor;
  private cars = new Map<number, CarModel>();
  private actors = new Map<string, Actor>();
  private roofs = new Map<string, Mesh>();
  private marker: Mesh;
  private ring: Mesh;
  private targetRing: Mesh;
  private shadow?: ShadowGenerator;
  private target = new Vector3(-184, 1.5, -300);
  private effects: { mesh: Mesh; until: number }[] = [];
  private lastEvent = 0;
  private contacts: Actor[] = [];
  private yaw = 0;
  private pitch = 0.3;
  private ready = false;
  constructor(
    readonly canvas: HTMLCanvasElement,
    private settings: Settings,
  ) {
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
    this.engine.setHardwareScalingLevel(
      settings.quality === "low"
        ? 1.7
        : Math.max(1, window.devicePixelRatio / 1.35),
    );
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.73, 0.82, 0.82, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.00165;
    this.scene.fogColor = new Color3(0.7, 0.79, 0.78);
    this.scene.skipPointerMovePicking = true;
    this.camera = new UniversalCamera(
      "courier camera",
      new Vector3(-191, 5, -310),
      this.scene,
    );
    this.camera.minZ = 0.08;
    this.camera.maxZ = 1900;
    this.camera.fov = 0.82;
    this.camera.inputs.clear();
    this.hemi = new HemisphericLight(
      "coastal skylight",
      new Vector3(0, 1, 0),
      this.scene,
    );
    this.hemi.intensity = 0.85;
    this.hemi.groundColor = new Color3(0.3, 0.32, 0.29);
    this.sun = new DirectionalLight(
      "late afternoon",
      new Vector3(0.45, -0.82, 0.32),
      this.scene,
    );
    this.sun.position.set(-170, 260, -210);
    this.sun.intensity = 2;
    this.sun.diffuse = new Color3(1, 0.88, 0.68);
    const city = buildCity(this.scene);
    if (settings.quality !== "low") {
      this.shadow = new ShadowGenerator(1024, this.sun);
      this.shadow.usePercentageCloserFiltering = true;
      this.shadow.filteringQuality = ShadowGenerator.QUALITY_LOW;
      this.shadow.bias = 0.001;
      this.shadow.normalBias = 0.04;
      city.casters.forEach((m) => this.shadow!.addShadowCaster(m));
      this.sun.shadowMinZ = 1;
      this.sun.shadowMaxZ = 700;
      this.sun.autoUpdateExtends = true;
    }
    this.sun.autoUpdateExtends = false;
    this.sun.orthoLeft = -110;
    this.sun.orthoRight = 110;
    this.sun.orthoTop = 110;
    this.sun.orthoBottom = -110;
    const sky = MeshBuilder.CreateSphere(
      "Port Meridian atmosphere",
      { diameter: 3000, segments: 24, sideOrientation: Mesh.BACKSIDE },
      this.scene,
    );
    const skyMat = new ShaderMaterial(
      "painted sky",
      this.scene,
      {
        vertexSource:
          "precision highp float; attribute vec3 position; uniform mat4 worldViewProjection; varying float altitude; void main(){altitude=position.y;gl_Position=worldViewProjection*vec4(position,1.0);}",
        fragmentSource:
          "precision highp float; varying float altitude;void main(){float h=clamp(altitude/900.0,0.0,1.0);gl_FragColor=vec4(mix(vec3(.78,.83,.76),vec3(.28,.52,.64),pow(h,.65)),1.0);}",
      },
      { attributes: ["position"], uniforms: ["worldViewProjection"] },
    );
    skyMat.backFaceCulling = false;
    skyMat.disableDepthWrite = true;
    sky.material = skyMat;
    sky.isPickable = false;
    sky.infiniteDistance = true;
    this.hero = makeActor(this.scene, "#b97955", true);
    this.hero.meshes.forEach((m) => this.shadow?.addShadowCaster(m));
    const shadowMat = new StandardMaterial("soft contact shade", this.scene);
    shadowMat.alpha = 0.22;
    shadowMat.disableLighting = true;
    shadowMat.emissiveColor = new Color3(0.1, 0.16, 0.17);
    const contact = MeshBuilder.CreateDisc(
      "courier contact shadow",
      { radius: 0.5, tessellation: 28 },
      this.scene,
    );
    contact.parent = this.hero.root;
    contact.rotation.x = Math.PI / 2;
    contact.position.y = 0.05;
    contact.scaling.y = 0.7;
    contact.material = shadowMat;
    contact.isPickable = false;
    this.buildInteriors();
    CONTACTS.forEach((c, i) => {
      if (["contact", "shop", "garage", "safehouse"].includes(c.kind)) {
        const a = makeActor(
          this.scene,
          ["#7c9b88", "#ba9d66", "#718593"][i % 3],
        );
        a.root.position.set(c.x, heightAt(c.x, c.z), c.z);
        a.root.rotation.y = i;
        a.head.rotation.y = 0.2;
        this.contacts.push(a);
      }
    });
    this.marker = MeshBuilder.CreateCylinder(
      "objective column",
      { diameter: 0.18, height: 9, tessellation: 8 },
      this.scene,
    );
    this.marker.material = mat(this.scene, "#eac080");
    this.marker.isPickable = false;
    this.ring = MeshBuilder.CreateTorus(
      "objective halo",
      { diameter: 3.4, thickness: 0.08, tessellation: 48 },
      this.scene,
    );
    this.ring.material = mat(this.scene, "#f0c380");
    this.ring.isPickable = false;
    this.targetRing = MeshBuilder.CreateTorus(
      "destination parking zone",
      { diameter: 14, thickness: 0.12, tessellation: 64 },
      this.scene,
    );
    this.targetRing.material = mat(this.scene, "#ecd6a4");
    this.targetRing.isPickable = false;
    this.scene.imageProcessingConfiguration.contrast = 1.08;
    this.scene.imageProcessingConfiguration.exposure = 0.96;
    window.addEventListener("resize", this.resize);
  }
  private resize = () => this.engine.resize();
  private buildInteriors() {
    for (const room of INTERIORS) {
      const root = new TransformNode(room.id, this.scene),
        base = heightAt(room.x, room.z);
      root.position.set(room.x, base, room.z);
      box(
        this.scene,
        root,
        "tiled floor",
        room.w,
        0.05,
        room.d,
        0,
        0.06,
        0,
        "#b3aa90",
      );
      const roof = box(
        this.scene,
        root,
        "cutaway roof",
        room.w + 0.5,
        0.3,
        room.d + 0.5,
        0,
        4.3,
        0,
        "#859588",
      );
      this.roofs.set(room.id, roof);
      for (const wall of INTERIOR_WALLS.filter((w) => w.id === room.id)) {
        const mesh = box(
          this.scene,
          root,
          "interior wall",
          wall.width,
          4,
          wall.depth,
          wall.x - room.x,
          2,
          wall.z - room.z,
          room.id === "warehouse" ? "#a59e82" : "#cebea2",
        );
        this.shadow?.addShadowCaster(mesh);
        box(
          this.scene,
          root,
          "copper cornice",
          wall.width + 0.08,
          0.18,
          wall.depth + 0.08,
          wall.x - room.x,
          3.5,
          wall.z - room.z,
          "#926c4e",
        );
      }
      for (let x = -room.w / 2 + 2; x < room.w / 2; x += 3)
        for (let z = -room.d / 2 + 2; z < room.d / 2; z += 3)
          box(
            this.scene,
            root,
            "floor inlay",
            2.94,
            0.01,
            2.94,
            x,
            0.091,
            z,
            Math.round(x + z) % 2 ? "#b5b1a0" : "#c1bba6",
          );
      const sign = textSign(
        this.scene,
        room.name.toUpperCase(),
        "#24454a",
        Math.min(12, room.w - 2),
        1.3,
      );
      sign.position.set(room.door.x, base + 3.25, room.door.z);
      sign.rotation.y =
        Math.abs(room.door.x - room.x) > room.w / 3
          ? room.door.x > room.x
            ? Math.PI / 2
            : -Math.PI / 2
          : Math.PI;
      const deskZ =
        room.id === "warehouse"
          ? 3
          : room.id === "control"
            ? -3
            : room.d / 2 - 3;
      box(
        this.scene,
        root,
        "service counter",
        5,
        1.05,
        1.4,
        0,
        0.6,
        deskZ,
        "#785f48",
      );
      box(
        this.scene,
        root,
        "counter surface",
        5.2,
        0.1,
        1.6,
        0,
        1.17,
        deskZ,
        "#dfd2b0",
      );
      box(
        this.scene,
        root,
        "computer base",
        0.6,
        0.04,
        0.42,
        0,
        1.25,
        deskZ,
        "#263f43",
      );
      box(
        this.scene,
        root,
        "terminal",
        0.7,
        0.46,
        0.08,
        0,
        1.49,
        deskZ + 0.2,
        "#344e52",
      );
      const screen = box(
        this.scene,
        root,
        "lit terminal screen",
        0.61,
        0.36,
        0.015,
        0,
        1.5,
        deskZ + 0.15,
        "#9abca3",
      );
      (screen.material as StandardMaterial).emissiveColor = new Color3(
        0.15,
        0.2,
        0.12,
      );
      for (const side of [-1, 1]) {
        box(
          this.scene,
          root,
          "wall shelf",
          1.2,
          2.4,
          room.d * 0.6,
          side * (room.w / 2 - 1),
          1.3,
          0,
          "#566665",
        );
        for (let n = 0; n < 5; n++) {
          box(
            this.scene,
            root,
            "stored parcels",
            0.95,
            0.65,
            1.2,
            side * (room.w / 2 - 1),
            0.65 + (n % 2),
            -room.d / 4 + n * 2,
            side < 0 ? "#b89765" : "#8b9a86",
          );
        }
      }
      if (room.id === "safehouse") {
        box(
          this.scene,
          root,
          "worn leather sofa",
          3,
          0.7,
          1.3,
          -4,
          0.45,
          -4,
          "#9e7859",
        );
        box(
          this.scene,
          root,
          "sofa back",
          3,
          1.1,
          0.3,
          -4,
          0.8,
          -4.6,
          "#8b6b54",
        );
        box(
          this.scene,
          root,
          "route board",
          4,
          2,
          0.12,
          0,
          2,
          room.d / 2 - 0.4,
          "#3b6261",
        );
      }
      if (room.id === "garage")
        for (const x of [-3, 3])
          box(
            this.scene,
            root,
            "service lift",
            0.3,
            2.6,
            3,
            x,
            1.4,
            -4,
            "#b28c50",
          );
    }
  }
  update(s: Snapshot, dt: number, yaw: number, pitch: number, menu = false) {
    const p = s.player;
    this.yaw = yaw;
    this.pitch = pitch;
    this.hero.root.position.set(p.x, p.y, p.z);
    this.hero.root.rotation.y = p.heading;
    animateActor(
      this.hero,
      s.time,
      p.speed,
      p.aiming || !p.holstered,
      p.crouching,
      false,
      p.dead,
    );
    this.hero.root.setEnabled(
      p.vehicleId === undefined ||
        s.vehicles.find((v) => v.id === p.vehicleId)?.definition === "needle" ||
        s.vehicles.find((v) => v.id === p.vehicleId)?.definition === "mistral",
    );
    if (s.vehicle && this.hero.root.isEnabled()) {
      this.hero.root.position.y = p.y + 0.9;
      this.hero.root.position.x -= Math.sin(p.heading) * 0.22;
      this.hero.root.position.z -= Math.cos(p.heading) * 0.22;
      animateActor(this.hero, s.time, 0, false, false, true);
    }
    const active = new Set<string>();
    for (const npc of [
      ...s.pedestrians.map((n) => ({
        ...n,
        key: "p" + n.id,
        hp: 100,
        stun: 0,
      })),
      ...s.enemies.map((n) => ({
        ...n,
        key: "e" + n.id,
        color:
          n.role === "police"
            ? "#3d6375"
            : n.role === "rival"
              ? "#a36a60"
              : "#899788",
        phase: s.time,
      })),
    ]) {
      active.add(npc.key);
      let a = this.actors.get(npc.key);
      const near = Math.hypot(npc.x - p.x, npc.z - p.z) < 105;
      if (!a && near) {
        a = makeActor(this.scene, npc.color, false, npc.role);
        this.actors.set(npc.key, a);
      }
      if (a) {
        a.root.setEnabled(near);
        if (near) {
          a.root.position.set(npc.x, npc.y, npc.z);
          a.root.rotation.y = npc.heading;
          animateActor(
            a,
            s.time + (npc.phase ?? 0),
            ["walk", "chase", "flee"].includes(npc.state)
              ? npc.state === "walk"
                ? 1.5
                : 3.5
              : 0,
            npc.state === "attack",
            false,
            false,
            npc.hp <= 0,
          );
        }
      }
    }
    for (const [id, a] of this.actors)
      if (!active.has(id)) {
        a.root.dispose();
        this.actors.delete(id);
      }
    for (const v of s.vehicles) {
      let model = this.cars.get(v.id);
      const near = Math.hypot(v.x - p.x, v.z - p.z) < 180;
      if (!model && near) {
        model = makeVehicle(
          this.scene,
          VEHICLES.find((d) => d.id === v.definition)!,
          v.id > 7,
        );
        this.cars.set(v.id, model);
      }
      if (model) {
        model.root.setEnabled(near);
        if (near) {
          model.root.position.set(v.x, v.y, v.z);
          model.root.rotation.y = v.heading;
          model.wheels.forEach((w) => (w.rotation.x += (v.speed * dt) / 0.38));
          if (v.id === p.vehicleId && s.vehicle) {
            model.root.position.y = s.vehicle.y - 0.88;
            model.body.rotation.z = model.bike
              ? -s.vehicle.steering * Math.min(0.3, v.speed * 0.018)
              : s.vehicle.roll;
            model.body.rotation.x = -s.vehicle.pitch;
          }
        }
      }
    }
    for (const [id, roof] of this.roofs)
      roof.setEnabled(
        p.inside !== id &&
          !(
            Math.hypot(
              p.x - roof.absolutePosition.x,
              p.z - roof.absolutePosition.z,
            ) < 18
          ),
      );
    if (s.target && !menu) {
      const y = heightAt(s.target.x, s.target.z);
      this.marker.setEnabled(true);
      this.ring.setEnabled(true);
      this.targetRing.setEnabled(true);
      this.marker.position.set(s.target.x, y + 5, s.target.z);
      this.ring.position.set(
        s.target.x,
        y + 2.6 + Math.sin(s.time * 2) * 0.2,
        s.target.z,
      );
      this.targetRing.position.set(s.target.x, y + 0.15, s.target.z);
      const stage = s.missionDefinition?.stages[s.mission?.stage ?? 0];
      this.targetRing.scaling.setAll(
        stage?.type === "enter"
          ? 0.32
          : stage?.type === "drive" || stage?.type === "circuit"
            ? 1
            : 0.45,
      );
    } else {
      this.marker.setEnabled(false);
      this.ring.setEnabled(false);
      this.targetRing.setEnabled(false);
    }
    for (const e of s.events)
      if (e.id > this.lastEvent) {
        this.lastEvent = e.id;
        if (e.kind === "shot" && e.position && e.end) {
          const mesh = MeshBuilder.CreateLines(
            "projectile tracer",
            {
              points: [
                new Vector3(e.position.x, e.position.y, e.position.z),
                new Vector3(e.end.x, e.end.y, e.end.z),
              ],
            },
            this.scene,
          );
          mesh.color = new Color3(1, 0.78, 0.4);
          this.effects.push({ mesh, until: s.time + 0.12 });
        }
        if (e.kind === "hit" && e.position) {
          const mesh = MeshBuilder.CreateSphere(
            "impact spark",
            { diameter: 0.12, segments: 4 },
            this.scene,
          );
          mesh.position.copyFromFloats(
            e.position.x,
            e.position.y,
            e.position.z,
          );
          mesh.material = mat(this.scene, "#f3dda0");
          this.effects.push({ mesh, until: s.time + 0.22 });
        }
      }
    this.effects = this.effects.filter((e) => {
      if (s.time > e.until) {
        e.mesh.dispose();
        return false;
      }
      return true;
    });
    const seated = !!s.vehicle,
      dist = p.aiming
        ? 2.7
        : seated
          ? this.settings.camera === 0
            ? 8.2
            : this.settings.camera === 1
              ? 12
              : 5.5
          : 5.8;
    let cyaw = yaw,
      cpitch = p.aiming ? pitch : pitch + 0.05;
    if (menu) {
      cyaw = s.time * 0.045 + 0.65;
      cpitch = 0.12;
    }
    const aimHeight = p.crouching ? 1 : seated ? 1.6 : 1.45;
    this.target.copyFromFloats(p.x, p.y + aimHeight, p.z);
    let desired = this.target.add(
      new Vector3(
        -Math.sin(cyaw) * dist * Math.cos(cpitch),
        Math.sin(cpitch) * dist + 0.35,
        -Math.cos(cyaw) * dist * Math.cos(cpitch),
      ),
    );
    if (p.aiming)
      desired.addInPlace(
        new Vector3(Math.cos(cyaw) * 0.55, 0, -Math.sin(cyaw) * 0.55),
      );
    for (let t = 0.15; t < 1; t += 0.05) {
      const check = Vector3.Lerp(this.target, desired, t);
      if (blocked(check.x, check.z, 0.2)) {
        desired = Vector3.Lerp(this.target, desired, Math.max(0.12, t - 0.07));
        break;
      }
    }
    desired.y = Math.max(heightAt(desired.x, desired.z) + 0.55, desired.y);
    this.camera.position = Vector3.Lerp(
      this.camera.position,
      desired,
      this.ready ? 1 - Math.exp(-dt * (p.aiming ? 20 : 8)) : 1,
    );
    this.ready = true;
    const look = p.aiming
      ? this.target.add(
          new Vector3(
            Math.sin(yaw) * 30,
            Math.sin(-pitch) * 30,
            Math.cos(yaw) * 30,
          ),
        )
      : this.target;
    this.camera.setTarget(look);
    this.camera.fov = p.aiming
      ? 0.65
      : seated
        ? 0.83 + Math.min(0.14, p.speed * 0.003)
        : 0.86;
    const sunlight = 0.75 + 0.25 * Math.cos(s.day * Math.PI * 2);
    this.sun.position.set(p.x - 75, p.y + 140, p.z - 60);
    this.sun.intensity = 0.88 * sunlight;
    this.hemi.intensity = 0.58;
    this.engine.beginFrame();
    this.scene.render();
    this.engine.endFrame();
  }
  reset() {
    this.lastEvent = 0;
    this.ready = false;
    this.effects.forEach((e) => e.mesh.dispose());
    this.effects = [];
  }
  configure(settings: Settings) {
    this.settings = settings;
  }
  fps() {
    return this.engine.getFps();
  }
  dispose() {
    window.removeEventListener("resize", this.resize);
    this.scene.dispose();
    this.engine.dispose();
  }
}
