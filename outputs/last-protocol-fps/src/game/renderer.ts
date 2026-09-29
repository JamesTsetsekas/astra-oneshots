import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { cover, weapons, type WeaponId } from "./data";
import { eyeHeight, type Combatant, type Snapshot } from "./simulation";

const material = (color: number, metalness = 0.15, roughness = 0.78) =>
  new T.MeshStandardMaterial({ color, metalness, roughness });
const palette = {
  graphite: material(0x4b5a5f, 0.35, 0.45),
  wall: material(0xc2c6b4),
  orange: material(0xb86593, 0.2, 0.56),
  teal: material(0x4b6f75, 0.25, 0.42),
  dark: material(0x283a3e, 0.18),
  floor: material(0xa8aca1),
  ivory: material(0xdedaca),
  rubber: material(0x283234, 0.05),
  glass: material(0x4f9b9d, 0.4, 0.2),
  skin: material(0x9e8064),
  cloth: material(0x758174),
  gunmetal: material(0x607378, 0.55, 0.34),
  steel: material(0x9aacae, 0.72, 0.25),
};
function surfaceTexture(kind: "concrete" | "metal") {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!,
    data = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const n = ((x * 73856093) ^ (y * 19349663)) >>> 0,
        shade = kind === "concrete" ? 214 + (n % 36) : 226 + (n % 22),
        index = (y * 256 + x) * 4;
      data.data[index] = shade;
      data.data[index + 1] = shade;
      data.data[index + 2] = shade;
      data.data[index + 3] = 255;
    }
  ctx.putImageData(data, 0, 0);
  if (kind === "metal") {
    ctx.strokeStyle = "#657171";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, 255, 255);
    for (const x of [7, 249])
      for (const y of [7, 249]) {
        ctx.fillStyle = "#697775";
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
  } else {
    ctx.fillStyle = "#475c5520";
    for (let i = 0; i < 50; i++) {
      ctx.beginPath();
      ctx.ellipse(
        (i * 71) % 256,
        (i * 117) % 256,
        2 + (i % 11),
        0.5 + (i % 3),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}
type Actor = {
  root: T.Group;
  legs: T.Group[];
  arms: T.Group[];
  flash: T.Mesh;
  last: T.Vector3;
};
type Effect = { mesh: T.Object3D; age: number; duration: number };
const mesh = (g: T.BufferGeometry, m: T.Material) => new T.Mesh(g, m);
function part(
  root: T.Object3D,
  w: number,
  h: number,
  d: number,
  m: T.Material,
  x: number,
  y: number,
  z: number,
) {
  const p = mesh(new T.BoxGeometry(w, h, d), m);
  p.position.set(x, y, z);
  root.add(p);
  return p;
}
function cylinder(
  root: T.Object3D,
  r: number,
  h: number,
  m: T.Material,
  x: number,
  y: number,
  z: number,
  axis: "y" | "x" | "z" = "y",
) {
  const p = mesh(new T.CylinderGeometry(r, r, h, 12), m);
  p.position.set(x, y, z);
  if (axis === "z") p.rotation.x = Math.PI / 2;
  if (axis === "x") p.rotation.z = Math.PI / 2;
  root.add(p);
  return p;
}
function batchChildren(root: T.Object3D, exclude?: T.Object3D) {
  const groups = new Map<T.Material, T.BufferGeometry[]>();
  for (const child of [...root.children]) {
    if (
      !(child instanceof T.Mesh) ||
      Array.isArray(child.material) ||
      child === exclude
    )
      continue;
    child.updateMatrix();
    const geometry = child.geometry.clone().applyMatrix4(child.matrix);
    const parts = groups.get(child.material) ?? [];
    parts.push(geometry);
    groups.set(child.material, parts);
    root.remove(child);
    child.geometry.dispose();
  }
  for (const [m, parts] of groups) {
    const combined = mergeGeometries(parts, false);
    if (combined) root.add(mesh(combined, m));
    for (const g of parts) g.dispose();
  }
}

/** Original geometry kit, batched environment, animated readable silhouettes. */
export class ProtocolRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly camera: T.PerspectiveCamera;
  readonly scene = new T.Scene();
  private renderer: T.WebGLRenderer;
  private actors = new Map<string, Actor>();
  private weapon = new T.Group();
  private flash: T.Mesh;
  private gunId = "";
  private staticParts = new Map<T.Material, T.BufferGeometry[]>();
  private effects: Effect[] = [];
  private grenades = new Map<number, T.Mesh>();
  private volumes = new Map<number, T.Mesh>();
  private spike = new T.Group();
  private drops = new Map<number, T.Mesh>();
  private lastEvent = 0;
  private lastShot = -99;
  private recoil = 0;
  private ads = 0;
  private time = 0;
  private horizontalFov = 90;
  private reduced = false;
  private width = 1;
  private height = 1;
  private fpsCount = 0;
  private fpsTime = 0;
  fps = 60;
  drawCalls = 0;
  constructor(
    private host: HTMLElement,
    fov = 90,
    reduced = false,
  ) {
    if (!palette.wall.map) {
      const concrete = surfaceTexture("concrete"),
        metal = surfaceTexture("metal");
      palette.wall.map = concrete;
      palette.floor.map = concrete;
      palette.graphite.map = metal;
      palette.teal.map = metal;
      palette.ivory.map = concrete;
    }
    this.reduced = reduced;
    this.horizontalFov = fov;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "game-canvas";
    host.append(this.canvas);
    this.renderer = new T.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.camera = new T.PerspectiveCamera(59, 1, 0.045, 700);
    this.scene.background = new T.Color(0xb3d6df);
    this.scene.fog = new T.Fog(0xb3d6df, 100, 360);
    const sky = mesh(
      new T.SphereGeometry(480, 32, 20),
      new T.ShaderMaterial({
        side: T.BackSide,
        depthWrite: false,
        uniforms: {
          top: { value: new T.Color(0x618da4) },
          horizon: { value: new T.Color(0xe3dfc8) },
        },
        vertexShader:
          "varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
        fragmentShader:
          "uniform vec3 top;uniform vec3 horizon;varying vec3 vPosition;void main(){float h=pow(clamp((normalize(vPosition).y+0.02)*1.3,0.0,1.0),0.65);gl_FragColor=vec4(mix(horizon,top,h),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}",
      }),
    );
    this.scene.add(sky);
    this.scene.add(new T.HemisphereLight(0xdbf5ff, 0x8a9a86, 2.6));
    this.scene.add(new T.AmbientLight(0xe3f0e7, 0.8));
    const sun = new T.DirectionalLight(0xffebcf, 3.1);
    sun.position.set(-45, 75, 35);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -68,
      right: 68,
      top: 68,
      bottom: -68,
      near: 1,
      far: 180,
    });
    sun.shadow.bias = -0.00035;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun);
    this.buildWorld();
    this.flushStatic();
    this.camera.add(this.weapon);
    this.scene.add(this.camera);
    const kitLight = new T.PointLight(0xd6e9ed, 1.8, 3, 1);
    kitLight.position.set(-0.4, 0.8, -0.3);
    this.camera.add(kitLight);
    this.flash = mesh(
      new T.OctahedronGeometry(0.065),
      new T.MeshBasicMaterial({
        color: 0xffde8e,
        transparent: true,
        opacity: 0.85,
      }),
    );
    this.flash.visible = false;
    this.camera.add(this.flash);
    this.resize();
    window.addEventListener("resize", this.resize);
  }
  setFov(fov: number) {
    this.horizontalFov = fov;
  }
  private solid(
    w: number,
    h: number,
    d: number,
    m: T.Material,
    x: number,
    y: number,
    z: number,
    rotation = 0,
  ) {
    const g = new T.BoxGeometry(w, h, d),
      uv = g.getAttribute("uv"),
      normal = g.getAttribute("normal");
    for (let i = 0; i < uv.count; i++) {
      const nx = Math.abs(normal.getX(i)),
        ny = Math.abs(normal.getY(i));
      uv.setXY(
        i,
        (uv.getX(i) * (nx > 0.5 ? d : w)) / 3,
        (uv.getY(i) * (ny > 0.5 ? d : h)) / 3,
      );
    }
    g.rotateY(rotation);
    g.translate(x, y, z);
    this.addStatic(g, m);
  }
  private addStatic(g: T.BufferGeometry, m: T.Material) {
    const entries = this.staticParts.get(m) ?? [];
    entries.push(g);
    this.staticParts.set(m, entries);
  }
  private flushStatic() {
    for (const [m, parts] of this.staticParts) {
      const merged = mergeGeometries(parts, false);
      if (merged) {
        const item = mesh(merged, m);
        item.castShadow = true;
        item.receiveShadow = true;
        this.scene.add(item);
      }
      for (const g of parts) g.dispose();
    }
    this.staticParts.clear();
  }
  private label(
    text: string,
    x: number,
    y: number,
    z: number,
    w = 5,
    h = 1,
    rotation = 0,
    color = "#d8e3d7",
    background = "#24454a",
  ) {
    const c = document.createElement("canvas");
    c.width = 768;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 768, 128);
    ctx.fillStyle = "#d57740";
    ctx.fillRect(0, 0, 14, 128);
    ctx.fillStyle = color;
    ctx.font = "700 54px Bahnschrift, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 384, 68, 714);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    const sign = mesh(
      new T.PlaneGeometry(w, h),
      new T.MeshBasicMaterial({ map: tex }),
    );
    sign.position.set(x, y, z);
    sign.rotation.y = rotation;
    this.scene.add(sign);
  }
  private buildWorld() {
    this.solid(118, 0.8, 98, palette.floor, 0, -0.42, 0);
    this.solid(124, 4, 104, palette.wall, 0, -2.5, 0);
    // Distinct Annex architecture: two research pavilions around a calibration court.
    for (const c of cover) {
      const m =
        c.kind === "wall"
          ? palette.wall
          : c.kind === "container"
            ? palette.teal
            : c.kind === "barrier"
              ? palette.ivory
              : palette.dark;
      this.solid(c.w, c.h, c.d, m, c.x, c.h / 2, c.z);
      this.solid(
        c.w + 0.03,
        0.12,
        c.d + 0.03,
        palette.dark,
        c.x,
        c.h + 0.05,
        c.z,
      );
      this.solid(c.w + 0.04, 0.08, c.d + 0.04, palette.orange, c.x, 0.38, c.z);
      if (c.kind === "wall") {
        this.solid(c.w + 0.04, 0.2, c.d + 0.04, palette.teal, c.x, 2.6, c.z);
        if (c.d > c.w)
          for (let z = c.z - c.d / 2 + 0.4; z < c.z + c.d / 2; z += 3)
            this.solid(
              0.06,
              c.h,
              0.06,
              palette.ivory,
              c.x + c.w / 2 + 0.03,
              c.h / 2,
              z,
            );
        else
          for (let x = c.x - c.w / 2 + 0.4; x < c.x + c.w / 2; x += 3)
            this.solid(
              0.06,
              c.h,
              0.06,
              palette.ivory,
              x,
              c.h / 2,
              c.z + c.d / 2 + 0.03,
            );
      }
    }
    // Courtyard circulation, with bands and ground-level light channels.
    for (const x of [-31, 0, 31])
      this.solid(9, 0.026, 87, palette.ivory, x, 0.01, 0);
    for (const z of [-14, 31])
      this.solid(110, 0.025, 5, palette.ivory, 0, 0.02, z);
    for (let x = -56; x < 57; x += 6)
      for (let z = -45; z < 46; z += 6) {
        this.solid(5.96, 0.015, 0.025, palette.teal, x, 0.028, z);
        this.solid(0.025, 0.015, 5.96, palette.teal, x, 0.028, z);
      }
    for (const x of [-15, 15])
      this.solid(0.08, 0.035, 70, palette.orange, x, 0.04, 0);
    // Turbine hall: ring gantry above play, overhead glass and magenta cable rails.
    this.solid(27, 0.26, 34, palette.ivory, -31, 7.25, 11);
    this.solid(28, 0.3, 1, palette.orange, -31, 6.8, -5.8);
    this.solid(28, 0.3, 1, palette.orange, -31, 6.8, 27.8);
    for (const z of [-3, 5, 13, 21, 26]) {
      this.solid(25, 0.13, 0.2, palette.teal, -31, 6.9, z);
      for (const x of [-43, -19])
        this.solid(0.22, 7, 0.22, palette.teal, x, 3.5, z);
    }
    const turbine = new T.Group();
    turbine.position.set(-37, 2.8, 17);
    cylinder(turbine, 1.2, 5, palette.graphite, 0, 2.4, 0);
    for (let i = 0; i < 7; i++) {
      const ring = mesh(
        new T.TorusGeometry(1.45, 0.045, 8, 32),
        i % 2 ? palette.orange : palette.ivory,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = i * 0.7;
      turbine.add(ring);
    }
    this.scene.add(turbine);
    this.label("A  /  TURBINE", -31, 5.9, -6.1, 9, 1.0, Math.PI);
    this.label("TURBINE  /  A", -31, 5.9, 28.1, 9, 1.0);
    this.label("DATA VAULT 01", -43.45, 3.8, 13, 5, 0.7, Math.PI / 2);
    // Garden lab: precise hydroponic planters, trellis fins and glazed clerestory.
    this.solid(28, 0.22, 34, palette.ivory, 31, 4.5, 11);
    for (const z of [-3, 3, 9, 15, 21, 27])
      this.solid(26, 0.11, 0.14, palette.graphite, 31, 4.28, z);
    for (const x of [20, 26, 32, 38, 43])
      this.solid(0.14, 0.08, 32, palette.glass, x, 4.36, 11);
    this.label("B  /  GARDEN", 31, 3.45, -6.05, 9, 0.8, Math.PI);
    this.label("GARDEN  /  B", 31, 3.45, 28.1, 9, 0.8);
    const leaf = material(0x5b8656, 0.05, 0.9),
      leafLight = material(0x7f9c63, 0.05, 0.9);
    for (const c of cover.filter((c) => c.x > 18 && c.kind === "barrier")) {
      this.solid(
        c.w - 0.2,
        0.1,
        c.d - 0.2,
        palette.cloth,
        c.x,
        c.h + 0.08,
        c.z,
      );
      for (let i = 0; i < 12; i++) {
        const x = c.x - c.w / 2 + 0.4 + ((i % 3) * (c.w - 0.8)) / 2,
          z = c.z - c.d / 2 + 0.4 + (Math.floor(i / 3) * (c.d - 0.8)) / 3;
        const g = new T.IcosahedronGeometry(0.32, 0);
        g.scale(0.8, 1.8, 1);
        g.translate(x, c.h + 0.45, z);
        this.addStatic(g, i % 2 ? leaf : leafLight);
      }
    }
    // Calibration sculptural arches, with a large original three-ring instrument.
    const calibration = new T.Group();
    calibration.position.set(0, 5, -1);
    for (let i = 0; i < 3; i++) {
      const ring = mesh(
        new T.TorusGeometry(3.1 - i * 0.45, 0.075, 10, 64),
        i === 1 ? palette.orange : palette.ivory,
      );
      ring.rotation.set(i * 0.7, i * 0.8, 0.35 * i);
      calibration.add(ring);
    }
    this.scene.add(calibration);
    this.label("CALIBRATION", 0, 2.0, 3.06, 6, 0.8);
    this.label("CALIBRATION", 0, 2.0, -5.06, 6, 0.8, Math.PI);
    // Authored vault boundary, crisp and invariant for every rendering quality.
    for (const site of [
      { x: -31, z: 15, id: "A" },
      { x: 31, z: 15, id: "B" },
    ]) {
      const ring = mesh(
        new T.RingGeometry(5.35, 5.5, 64),
        new T.MeshBasicMaterial({ color: 0xba739d, side: T.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(site.x, 0.055, site.z);
      this.scene.add(ring);
      const small = mesh(
        new T.RingGeometry(0.8, 1, 6),
        new T.MeshBasicMaterial({ color: 0xb8719b, side: T.DoubleSide }),
      );
      small.rotation.x = -Math.PI / 2;
      small.position.set(site.x, 0.06, site.z);
      this.scene.add(small);
    }
    // Non-playable campus wings frame the horizon without obscuring combat silhouettes.
    for (const side of [-1, 1]) {
      for (const z of [-32, 16, 58]) {
        const x = side * 76,
          h = z === 16 ? 19 : 12;
        this.solid(23, h, 33, palette.wall, x, h / 2 - 2, z);
        this.solid(25, 0.45, 35, palette.ivory, x, h - 2, z);
        this.solid(
          0.12,
          h - 3,
          29,
          palette.glass,
          x - side * 11.57,
          (h - 3) / 2,
          z,
        );
        for (let iz = -12; iz <= 12; iz += 4)
          this.solid(
            0.25,
            h - 2,
            0.12,
            palette.ivory,
            x - side * 11.7,
            (h - 2) / 2,
            z + iz,
          );
        for (let y = 3; y < h - 3; y += 3.5)
          this.solid(0.2, 0.14, 30, palette.dark, x - side * 11.8, y, z);
        this.solid(3, 1.4, 8, palette.teal, x + side * 6, h - 1.3, z);
      }
    }
    for (const x of [-17, 17])
      for (const z of [-24, 35]) {
        this.label(
          "ANNEX / FIELD EQUIPMENT",
          x,
          1.65,
          z - 1.53,
          4.6,
          0.55,
          Math.PI,
        );
        for (const side of [-1, 1])
          this.solid(
            0.12,
            2.3,
            0.06,
            palette.ivory,
            x + side * 3.5,
            1.2,
            z - 1.55,
          );
      }
    // Perimeter parapet, campus lights and attached facade panels.
    for (const z of [-47, 47]) {
      this.solid(115, 0.65, 0.4, palette.ivory, 0, 0.32, z);
      this.solid(115, 0.06, 0.45, palette.teal, 0, 0.7, z);
    }
    for (const x of [-57, 57]) {
      this.solid(0.4, 0.65, 94, palette.ivory, x, 0.32, 0);
      this.solid(0.45, 0.06, 94, palette.teal, x, 0.7, 0);
    }
    for (const x of [-50, -12, 12, 50])
      for (const z of [-34, 34]) {
        this.solid(0.13, 5, 0.13, palette.dark, x, 2.5, z);
        this.solid(0.4, 0.1, 1.6, palette.ivory, x, 5, z);
        this.solid(0.08, 2, 0.08, palette.orange, x + 0.1, 3.5, z);
      }
    for (let i = 0; i < 22; i++) {
      const g = new T.IcosahedronGeometry(1, 1);
      g.scale(35 + (i % 5) * 8, 20 + (i % 4) * 6, 30);
      g.rotateY(i * 0.6);
      g.translate(Math.cos(i * 0.35) * 170, -10, Math.sin(i * 0.35) * 170);
      this.addStatic(g, leaf);
    }
    const ground = mesh(new T.PlaneGeometry(1600, 1600), material(0x90a291));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -12;
    this.scene.add(ground);
    this.label("FREIGHT / INTRUSION", 0, 2, -46.7, 10, 1);
    this.label("SECURITY ATRIUM", 0, 2, 46.7, 10, 1, Math.PI);
    const crystal = mesh(
      new T.OctahedronGeometry(0.38),
      new T.MeshStandardMaterial({
        color: 0xc45a9e,
        emissive: 0x6e1c50,
        emissiveIntensity: 0.7,
        metalness: 0.5,
        roughness: 0.25,
      }),
    );
    crystal.position.y = 0.5;
    this.spike.add(crystal);
    part(this.spike, 0.65, 0.14, 0.65, palette.graphite, 0, 0.09, 0);
    this.scene.add(this.spike);
  }
  private actor(p: Combatant): Actor {
    const root = new T.Group(),
      kit = p.team === "aurora" ? palette.cloth : palette.graphite,
      iff = p.team === "aurora" ? palette.orange : palette.glass;
    part(root, 0.57, 0.62, 0.32, kit, 0, 1.22, 0);
    part(root, 0.62, 0.46, 0.4, palette.dark, 0, 1.24, 0.03);
    part(root, 0.42, 0.5, 0.2, kit, 0, 1.25, -0.28);
    for (const x of [-0.2, 0, 0.2])
      part(root, 0.14, 0.19, 0.1, palette.teal, x, 1.24, 0.26);
    const helmet = mesh(new T.SphereGeometry(0.25, 14, 10), kit);
    helmet.position.set(0, 1.74, 0);
    helmet.scale.y = 0.82;
    root.add(helmet);
    part(root, 0.4, 0.105, 0.09, iff, 0, 1.75, 0.22);
    part(root, 0.32, 0.16, 0.23, palette.dark, 0, 1.56, 0.12);
    const legs: T.Group[] = [],
      arms: T.Group[] = [];
    for (const side of [-1, 1]) {
      const leg = new T.Group();
      leg.position.set(side * 0.17, 0.88, 0);
      part(leg, 0.24, 0.46, 0.26, kit, 0, -0.22, 0);
      part(leg, 0.23, 0.42, 0.24, kit, 0, -0.63, 0.03);
      part(leg, 0.25, 0.13, 0.37, palette.rubber, 0, -0.82, 0.09);
      part(leg, 0.2, 0.18, 0.05, palette.dark, 0, -0.45, 0.16);
      legs.push(leg);
      root.add(leg);
      const arm = new T.Group();
      arm.position.set(side * 0.39, 1.48, 0);
      part(arm, 0.21, 0.34, 0.22, kit, 0, -0.13, 0);
      part(arm, 0.2, 0.18, 0.4, kit, side * -0.04, -0.29, 0.19);
      part(arm, 0.12, 0.1, 0.11, iff, 0, 0.03, 0.13);
      arms.push(arm);
      root.add(arm);
    }
    part(root, 0.12, 0.15, 0.7, palette.dark, 0.24, 1.21, 0.5);
    cylinder(root, 0.027, 0.3, palette.graphite, 0.24, 1.25, 1, "z");
    const flash = mesh(
      new T.OctahedronGeometry(0.09),
      new T.MeshBasicMaterial({ color: 0xffd294 }),
    );
    flash.position.set(0.24, 1.25, 1.17);
    root.add(flash);
    for (const limb of [...legs, ...arms]) batchChildren(limb);
    batchChildren(root, flash);
    root.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.scene.add(root);
    return { root, legs, arms, flash, last: new T.Vector3(p.x, p.y, p.z) };
  }
  private makeWeapon(id: WeaponId, optic: string, barrel: string) {
    this.weapon.traverse((o) => {
      if (o instanceof T.Mesh) o.geometry.dispose();
    });
    this.weapon.clear();
    const gun = new T.Group();
    this.weapon.add(gun);
    const pistol = ["vela", "rook", "needle"].includes(id),
      long = id === "longglass",
      heavy = id === "atlas",
      shotgun = id === "rampart";
    const length = pistol ? 0.42 : long ? 1.06 : shotgun ? 0.88 : 0.77,
      width = heavy ? 0.2 : pistol ? 0.1 : 0.15;
    part(gun, width, 0.16, length, palette.gunmetal, 0, 0, -0.32);
    part(gun, width + 0.015, 0.04, length * 0.8, palette.dark, 0, 0.105, -0.32);
    for (let i = 0; i < (pistol ? 5 : 11); i++)
      part(
        gun,
        width + 0.03,
        0.017,
        0.019,
        palette.steel,
        0,
        0.135,
        (pistol ? -0.22 : -0.03) - i * (pistol ? 0.035 : 0.052),
      );
    part(
      gun,
      width * 0.84,
      0.15,
      0.13,
      palette.dark,
      0,
      -0.12,
      -0.07,
    ).rotation.x = 0.24;
    const magazine = part(
      gun,
      heavy ? 0.24 : 0.095,
      heavy ? 0.22 : pistol ? 0.18 : 0.25,
      heavy ? 0.2 : 0.17,
      palette.dark,
      0,
      -0.18,
      -0.24,
    );
    magazine.rotation.x = -0.11;
    cylinder(
      gun,
      0.028,
      long ? 0.48 : 0.3,
      palette.dark,
      0,
      0.025,
      -0.35 - length / 2,
      "z",
    );
    cylinder(
      gun,
      barrel === "suppressor" ? 0.048 : 0.037,
      barrel === "suppressor" ? 0.3 : 0.055,
      palette.graphite,
      0,
      0.025,
      -0.51 - length / 2,
      "z",
    );
    if (!pistol) {
      part(gun, 0.13, 0.17, 0.3, palette.dark, 0, -0.005, 0.2);
      part(gun, 0.15, 0.24, 0.075, palette.rubber, 0, -0.02, 0.34);
      part(gun, 0.09, 0.04, 0.32, palette.orange, 0, 0.025, -0.36);
      for (let i = 0; i < 6; i++)
        part(
          gun,
          0.005,
          0.065,
          0.032,
          palette.dark,
          width / 2 + 0.003,
          0.015,
          -0.37 - i * 0.04,
        );
    }
    part(
      gun,
      0.045,
      0.085,
      0.045,
      palette.graphite,
      0,
      0.175,
      -0.32 - length * 0.32,
    );
    part(
      gun,
      0.018,
      0.021,
      0.012,
      palette.glass,
      0,
      0.221,
      -0.32 - length * 0.32,
    );
    if (optic !== "iron" && !pistol) {
      part(gun, 0.12, 0.025, 0.12, palette.dark, 0, 0.15, -0.16);
      if (optic === "2x") {
        cylinder(gun, 0.06, 0.25, palette.dark, 0, 0.23, -0.19, "z");
        cylinder(gun, 0.05, 0.006, palette.glass, 0, 0.23, -0.059, "z");
      } else {
        for (const side of [-1, 1])
          part(
            gun,
            0.018,
            0.11,
            0.06,
            palette.graphite,
            side * 0.056,
            0.215,
            -0.18,
          );
        part(gun, 0.128, 0.018, 0.06, palette.graphite, 0, 0.27, -0.18);
        const glass = new T.MeshBasicMaterial({
          color: 0x71cccc,
          transparent: true,
          opacity: 0.22,
        });
        part(gun, 0.095, 0.08, 0.006, glass, 0, 0.214, -0.18);
        part(
          gun,
          0.008,
          0.008,
          0.007,
          new T.MeshBasicMaterial({ color: 0xff6744 }),
          0,
          0.212,
          -0.175,
        );
      }
    }
    // Gloved hands and sleeves: support hand wraps the fore-end, trigger arm angles in.
    part(gun, 0.11, 0.13, 0.16, palette.rubber, 0.005, -0.18, -0.055);
    part(gun, 0.16, 0.16, 0.3, palette.cloth, 0.03, -0.3, 0.03).rotation.x =
      -0.48;
    if (!pistol) {
      part(gun, 0.13, 0.12, 0.16, palette.rubber, -0.065, -0.095, -0.54);
      part(
        gun,
        0.16,
        0.16,
        0.4,
        palette.cloth,
        -0.16,
        -0.22,
        -0.42,
      ).rotation.z = -0.45;
    }
    part(gun, 0.04, 0.025, 0.16, palette.ivory, width / 2 + 0.001, 0.005, -0.2);
    part(
      gun,
      0.018,
      0.07,
      0.04,
      palette.orange,
      -width / 2 - 0.015,
      0.05,
      -0.07,
    );
    batchChildren(gun);
    gun.position.set(0.28, -0.31, -0.72);
    this.gunId = `${id}:${optic}:${barrel}`;
  }
  render(s: Snapshot, id: string, yaw: number, pitch: number, dt: number) {
    const p = s.players.find((a) => a.id === id);
    if (!p) return;
    this.time += dt;
    this.fpsCount++;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      this.fps = Math.round(this.fpsCount / this.fpsTime);
      this.fpsCount = 0;
      this.fpsTime = 0;
    }
    this.camera.position.set(p.x, eyeHeight(p), p.z);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = Math.PI + yaw;
    this.camera.rotation.x = -pitch;
    const weaponId = p.slot === 0 ? p.loadout.primary : p.loadout.sidearm;
    if (this.gunId !== `${weaponId}:${p.loadout.optic}:${p.loadout.barrel}`)
      this.makeWeapon(weaponId, p.loadout.optic, p.loadout.barrel);
    this.ads += (Number(p.ads) - this.ads) * Math.min(1, dt * 13);
    const fov =
      this.horizontalFov *
      (1 - this.ads * (p.loadout.optic === "2x" ? 0.37 : 0.2));
    this.camera.fov = T.MathUtils.radToDeg(
      2 *
        Math.atan(Math.tan(T.MathUtils.degToRad(fov) / 2) / this.camera.aspect),
    );
    this.camera.updateProjectionMatrix();
    const moving = Math.min(1, Math.hypot(p.vx, p.vz) / 5),
      bob = this.reduced
        ? 0
        : Math.sin(this.time * (p.sprint ? 16 : 11)) * moving;
    if (p.lastShot > this.lastShot) {
      this.lastShot = p.lastShot;
      this.recoil = 0.042;
    }
    this.recoil *= Math.exp(-dt * 18);
    this.weapon.visible = p.alive;
    const reload =
      p.reloadTime > 0
        ? Math.sin(Math.PI * (1 - p.reloadTime / weapons[weaponId].reload))
        : 0;
    this.weapon.position.set(
      -0.28 * this.ads + bob * 0.003 * (1 - this.ads),
      this.ads * 0.09 + Math.abs(bob) * 0.007 * (1 - this.ads) - reload * 0.22,
      -this.ads * 0.12 + this.recoil,
    );
    this.weapon.rotation.set(
      this.reduced ? 0 : this.recoil * 2 + reload * 0.4,
      p.sprint ? 0.35 : reload * -0.22 + (1 - this.ads) * 0.12,
      (p.sprint ? -0.35 : 0) + reload * 0.34,
    );
    this.flash.position.set(
      0.28 * (1 - this.ads),
      -0.28 + this.ads * 0.09,
      -1.45,
    );
    this.flash.visible = p.alive && s.time - p.lastShot < 0.045;
    this.flash.rotation.z = this.time * 100;
    for (const a of s.players) {
      if (a.id === id) continue;
      let view = this.actors.get(a.id);
      if (!view) {
        view = this.actor(a);
        this.actors.set(a.id, view);
      }
      view.root.visible = a.alive;
      view.root.position.lerp(
        new T.Vector3(a.x, a.y, a.z),
        Math.min(1, dt * 23),
      );
      view.root.rotation.y = a.yaw;
      view.root.scale.y = a.crouch ? 0.74 : 1;
      const speed = Math.hypot(a.vx, a.vz),
        stride =
          Math.sin(this.time * 10 + Number(a.id.replace(/\D/g, ""))) *
          Math.min(0.6, speed * 0.09);
      view.legs[0].rotation.x = stride;
      view.legs[1].rotation.x = -stride;
      view.flash.visible = s.time - a.lastShot < 0.045;
    }
    for (const [actor, v] of this.actors)
      if (!s.players.some((a) => a.id === actor)) {
        this.scene.remove(v.root);
        this.actors.delete(actor);
      }
    for (const e of s.events)
      if (e.id > this.lastEvent) {
        if (
          e.kind === "shot" &&
          e.x !== undefined &&
          e.endX !== undefined &&
          e.endY !== undefined &&
          e.endZ !== undefined
        ) {
          const points = [
            new T.Vector3(e.x, e.y ?? 1.4, e.z),
            new T.Vector3(e.endX, e.endY, e.endZ),
          ];
          const line = new T.Line(
            new T.BufferGeometry().setFromPoints(points),
            new T.LineBasicMaterial({
              color: e.actor === id ? 0xffdc9e : 0xf7ad75,
              transparent: true,
              opacity: 0.7,
            }),
          );
          this.scene.add(line);
          this.effects.push({ mesh: line, age: 0, duration: 0.06 });
          const impact = mesh(
            new T.OctahedronGeometry(0.07),
            new T.MeshBasicMaterial({ color: 0xffdfab }),
          );
          impact.position.copy(points[1]);
          this.scene.add(impact);
          this.effects.push({ mesh: impact, age: 0, duration: 0.15 });
        }
        if (e.kind === "explosion") {
          const boom = mesh(
            new T.SphereGeometry(1, 12, 8),
            new T.MeshBasicMaterial({
              color: 0xffb35b,
              transparent: true,
              opacity: 0.7,
            }),
          );
          boom.position.set(e.x ?? 0, e.y ?? 1, e.z ?? 0);
          this.scene.add(boom);
          this.effects.push({ mesh: boom, age: 0, duration: 0.55 });
        }
        this.lastEvent = e.id;
      }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.age += dt;
      if (e.duration > 0.5) {
        e.mesh.scale.setScalar(1 + e.age * 7);
        const m = (e.mesh as T.Mesh).material as T.MeshBasicMaterial;
        m.opacity = Math.max(0, 0.7 * (1 - e.age / e.duration));
      }
      if (e.age > e.duration || this.effects.length > 120) {
        this.scene.remove(e.mesh);
        (e.mesh as T.Mesh).geometry.dispose();
        ((e.mesh as T.Mesh).material as T.Material).dispose();
        this.effects.splice(i, 1);
      }
    }
    for (const g of s.projectiles) {
      let m = this.grenades.get(g.id);
      if (!m) {
        m = mesh(new T.SphereGeometry(0.13, 10, 8), palette.orange);
        this.grenades.set(g.id, m);
        this.scene.add(m);
      }
      m.position.set(g.x, g.y, g.z);
    }
    for (const [id, m] of this.grenades)
      if (!s.projectiles.some((g) => g.id === id)) {
        this.scene.remove(m);
        m.geometry.dispose();
        this.grenades.delete(id);
      }
    this.spike.visible =
      s.objective.state === "armed" || s.objective.state === "dropped";
    this.spike.position.set(s.objective.x, 0, s.objective.z);
    this.spike.rotation.y = this.time * 0.7;
    for (const area of s.areas) {
      let view = this.volumes.get(area.id);
      if (!view) {
        const smoke = area.kind === "veil";
        view = mesh(
          smoke
            ? new T.SphereGeometry(area.radius, 18, 12)
            : new T.CylinderGeometry(area.radius, area.radius, 0.08, 40),
          new T.MeshBasicMaterial({
            color: smoke
              ? 0x9daca8
              : area.kind === "thermite"
                ? 0xe58942
                : 0xb573af,
            side: T.DoubleSide,
            transparent: !smoke,
            opacity: smoke ? 1 : 0.45,
          }),
        );
        if (smoke) view.scale.y = 0.7;
        this.volumes.set(area.id, view);
        this.scene.add(view);
      }
      view.position.set(area.x, area.kind === "veil" ? 1.7 : 0.08, area.z);
    }
    for (const [id, view] of this.volumes)
      if (!s.areas.some((a) => a.id === id)) {
        this.scene.remove(view);
        view.geometry.dispose();
        (view.material as T.Material).dispose();
        this.volumes.delete(id);
      }
    for (const drop of s.dropped) {
      let view = this.drops.get(drop.id);
      if (!view) {
        view = mesh(new T.BoxGeometry(0.14, 0.16, 0.8), palette.orange);
        this.drops.set(drop.id, view);
        this.scene.add(view);
      }
      view.position.set(drop.x, 0.16, drop.z);
      view.rotation.y = 0.5;
    }
    for (const [id, view] of this.drops)
      if (!s.dropped.some((d) => d.id === id)) {
        this.scene.remove(view);
        view.geometry.dispose();
        this.drops.delete(id);
      }
    this.renderer.render(this.scene, this.camera);
    this.drawCalls = this.renderer.info.render.calls;
  }
  private resize = () => {
    this.width = this.host.clientWidth || 1;
    this.height = this.host.clientHeight || 1;
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  };
  dispose() {
    window.removeEventListener("resize", this.resize);
    this.scene.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.Line) {
        o.geometry.dispose();
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of materials) {
          if (m instanceof T.MeshBasicMaterial) m.map?.dispose();
          if (!Object.values(palette).includes(m as T.MeshStandardMaterial))
            m.dispose();
        }
      }
    });
    this.renderer.dispose();
    this.canvas.remove();
  }
}
