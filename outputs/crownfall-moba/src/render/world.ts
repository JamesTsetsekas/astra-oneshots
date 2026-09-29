import * as THREE from "three";
import {
  LANES,
  BRUSH,
  TEAM_COLORS,
  heroById,
  type HeroId,
  type Point,
} from "../game/content";
import type { Unit } from "../game/simulation";
const mats = new Map<string, THREE.MeshStandardMaterial>();
export function material(color: string, emissive = 0) {
  const key = `${color}:${emissive}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.78,
      metalness: 0.12,
      emissive: color,
      emissiveIntensity: emissive,
    });
    mats.set(key, m);
  }
  return m;
}
export interface Rig {
  root: THREE.Group;
  arms: THREE.Object3D[];
  legs: THREE.Object3D[];
  body: THREE.Group;
  accent: THREE.Mesh;
  kind: string;
}
export function createRig(unit: Unit): Rig {
  const root = new THREE.Group(),
    body = new THREE.Group();
  root.add(body);
  const arms: THREE.Object3D[] = [],
    legs: THREE.Object3D[] = [];
  const color = unit.hero
    ? heroById(unit.hero).color
    : TEAM_COLORS[unit.team === 1 ? 1 : 0];
  const add = (
    g: THREE.BufferGeometry,
    c: string,
    p: THREE.Object3D,
    x = 0,
    y = 0,
    z = 0,
    glow = 0,
  ) => {
    const m = new THREE.Mesh(g, material(c, glow));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    p.add(m);
    return m;
  };
  const box = (
    w: number,
    h: number,
    d: number,
    c: string,
    p: THREE.Object3D,
    x = 0,
    y = 0,
    z = 0,
  ) => add(new THREE.BoxGeometry(w, h, d), c, p, x, y, z);
  const orb = (r: number, c: string, p: THREE.Object3D, x = 0, y = 0, z = 0) =>
    add(new THREE.IcosahedronGeometry(r, 1), c, p, x, y, z);
  const cylinder = (
    top: number,
    bottom: number,
    h: number,
    c: string,
    p: THREE.Object3D,
    x = 0,
    y = 0,
    z = 0,
  ) => add(new THREE.CylinderGeometry(top, bottom, h, 8), c, p, x, y, z);
  const joint = (p: THREE.Object3D, x: number, y: number, z: number) => {
    const j = new THREE.Group();
    j.position.set(x, y, z);
    p.add(j);
    return j;
  };
  const ring = add(
    new THREE.TorusGeometry(
      unit.kind === "hero"
        ? 1.05
        : unit.kind === "engine"
          ? 3.5
          : unit.kind.includes("Tower") || unit.kind === "tower"
            ? 1.8
            : 0.65,
      0.04,
      5,
      36,
    ),
    TEAM_COLORS[unit.team === 1 ? 1 : 0],
    root,
    0,
    0.07,
    0,
    0.4,
  );
  ring.rotation.x = -Math.PI / 2;
  if (unit.kind === "hero" || unit.kind === "decoy") {
    const h = unit.hero!;
    const bulky = h === "brannoch" || h === "kesh";
    body.position.y = 1.15;
    cylinder(
      bulky ? 0.7 : 0.4,
      bulky ? 0.48 : 0.3,
      0.95,
      h === "brannoch" ? "#d8d6b6" : color,
      body,
      0,
      0.15,
      0,
    );
    box(0.55, 0.64, 0.1, "#b39a61", body, 0, 0.23, 0.41);
    for (const side of [-1, 1]) {
      const leg = joint(root, side * 0.25, 0.96, 0);
      legs.push(leg);
      add(
        new THREE.CapsuleGeometry(0.145, 0.47, 3, 7),
        "#314452",
        leg,
        0,
        -0.34,
        0,
      );
      const boot = orb(0.24, bulky ? "#e3ddc1" : "#40504d", leg, 0, -0.78, 0.1);
      boot.scale.set(0.76, 0.7, 1.3);
      cylinder(0.17, 0.16, 0.18, "#aa8b53", leg, 0, -0.61, 0);
      const arm = joint(body, side * (bulky ? 0.7 : 0.44), 0.53, 0);
      arms.push(arm);
      orb(bulky ? 0.37 : 0.19, h === "brannoch" ? "#e6dfbd" : "#c8ac65", arm);
      add(new THREE.CapsuleGeometry(0.13, 0.43, 3, 7), color, arm, 0, -0.38, 0);
      cylinder(0.16, 0.15, 0.2, "#405558", arm, 0, -0.61, 0);
      orb(0.13, "#d6b895", arm, 0, -0.8, 0.05);
    }
    orb(
      bulky ? 0.38 : 0.28,
      h === "kesh" ? "#7a9d68" : "#d2b18e",
      body,
      0,
      0.94,
      0.03,
    );
    const hair = orb(
      bulky ? 0.37 : 0.285,
      h === "brannoch" ? "#e3dec8" : h === "vey" ? "#d4f0ed" : "#263d45",
      body,
      0,
      1.105,
      -0.06,
    );
    hair.scale.set(1, 0.64, 1);
    if (bulky)
      box(
        0.43,
        0.065,
        0.075,
        h === "brannoch" ? "#77c5a2" : "#162e3b",
        body,
        0,
        0.97,
        0.3,
      );
    else
      for (const side of [-1, 1]) {
        orb(0.034, "#203642", body, side * 0.105, 0.965, 0.275);
        orb(0.025, "#f7efce", body, side * 0.099, 0.975, 0.296);
      }
    cylinder(
      bulky ? 0.58 : 0.36,
      bulky ? 0.58 : 0.36,
      0.1,
      "#aa915a",
      body,
      0,
      -0.22,
      0,
    );
    box(0.16, 0.15, 0.07, "#e1c87c", body, 0, -0.22, 0.37);
    if (h !== "brannoch" && h !== "kesh") {
      const cape = add(
        new THREE.ConeGeometry(0.6, 1.5, 5, 1, true, 0.1, Math.PI),
        h === "suri" ? "#f1dfbb" : color,
        body,
        0,
        -0.06,
        -0.16,
      );
      cape.rotation.x = 0.15;
      cape.rotation.y = Math.PI;
    }
    const weapon = joint(arms[1], 0, -0.67, 0.25);
    if (h === "brannoch") {
      cylinder(0.08, 0.09, 1.5, "#88733e", weapon, 0, 0.1, 0.1);
      box(0.9, 0.5, 0.52, "#e8e2c2", weapon, 0, 0.95, 0.1);
      box(0.75, 0.15, 0.62, "#86ad76", weapon, 0, 0.99, 0.1);
      for (const side of [-1, 1])
        orb(0.25, "#71964d", body, side * 0.55, 0.7, -0.24);
      root.scale.setScalar(1.17);
    }
    if (h === "suri") {
      box(0.08, 0.09, 1.05, "#b9964e", weapon, 0, 0, 0.5);
      const bow = add(
        new THREE.TorusGeometry(0.5, 0.04, 5, 18, Math.PI),
        "#e5c57a",
        weapon,
        0,
        0,
        0.4,
      );
      bow.rotation.y = Math.PI / 2;
      box(0.62, 0.1, 0.12, "#db6a46", body, 0, 0.62, 0.42);
      const scarf = box(0.19, 0.6, 0.05, "#db6a46", body, 0.24, 0.32, 0.44);
      scarf.rotation.z = -0.15;
      orb(0.16, "#263d45", body, 0, 0.96, -0.36);
      box(0.25, 0.34, 0.19, "#99764b", body, -0.42, -0.13, 0);
    }
    if (h === "oru") {
      for (const side of [-1, 1]) {
        const wing = add(
          new THREE.SphereGeometry(1, 8, 6),
          "#d9dba9",
          body,
          side * 0.8,
          0.2,
          -0.35,
        );
        wing.scale.set(0.6, 0.8, 0.09);
        wing.rotation.z = side * -0.5;
      }
      cylinder(0.055, 0.055, 2, "#ac9356", weapon, 0, 0.5, 0);
      orb(0.25, "#88dfd5", weapon, 0, 1.65, 0);
    }
    if (h === "kesh") {
      for (const side of [-1, 1]) {
        const horn = add(
          new THREE.ConeGeometry(0.1, 0.5, 5),
          "#e1d6a5",
          body,
          side * 0.25,
          1.3,
          0,
        );
        horn.rotation.z = -side * 0.4;
      }
      const blade = box(0.12, 1.2, 0.45, "#c2d6b0", weapon, 0, 0.4, 0.1);
      blade.rotation.z = -0.2;
    }
    if (h === "ilyra") {
      box(0.7, 0.08, 0.46, "#d2be7d", weapon, 0, 0.2, 0.1).rotation.x = 0.2;
      for (let i = 0; i < 3; i++) {
        const page = box(
          0.35,
          0.025,
          0.25,
          "#eee5c9",
          body,
          Math.cos(i * 2.1) * 0.9,
          0.5 + i * 0.22,
          Math.sin(i * 2.1) * 0.8,
        );
        page.rotation.set(0.1, i * 0.6, 0.2);
      }
      orb(0.18, "#cfb2ed", weapon, 0, 0.55, 0.1);
    }
    if (h === "vey") {
      for (const arm of arms) {
        const knife = add(
          new THREE.ConeGeometry(0.12, 1.15, 3),
          "#bfe8e2",
          arm,
          0,
          -0.55,
          0.45,
          0.15,
        );
        knife.rotation.x = Math.PI / 2;
      }
    }
  } else if (["tower", "coreTower", "seal", "engine"].includes(unit.kind)) {
    const engine = unit.kind === "engine",
      seal = unit.kind === "seal";
    const height = engine ? 3.2 : seal ? 1.1 : 4.3;
    cylinder(
      engine ? 3 : 1.5,
      engine ? 3.3 : 1.9,
      0.45,
      "#b3b697",
      root,
      0,
      0.22,
      0,
    );
    cylinder(
      engine ? 2.3 : 1.02,
      engine ? 2.7 : 1.25,
      height,
      "#e6e0be",
      root,
      0,
      height / 2 + 0.4,
      0,
    );
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      box(
        0.3,
        height,
        0.5,
        "#b1a16e",
        root,
        Math.sin(angle) * (engine ? 2.35 : 1.08),
        height / 2 + 0.35,
        Math.cos(angle) * (engine ? 2.35 : 1.08),
      );
    }
    cylinder(
      engine ? 2.7 : 1.6,
      engine ? 2.7 : 1.4,
      0.22,
      "#cfb97c",
      root,
      0,
      height + 0.35,
      0,
    );
    const gem = orb(
      engine ? 1.15 : seal ? 0.55 : 0.62,
      TEAM_COLORS[unit.team === 1 ? 1 : 0],
      body,
      0,
      height + 1.15,
      0,
    );
    gem.material = material(color, 0.3);
    arms.push(gem);
    for (let i = 0; i < (engine ? 3 : 1); i++) {
      const orbit = add(
        new THREE.TorusGeometry(engine ? 1.9 + i * 0.35 : 1.1, 0.075, 6, 40),
        "#bfa365",
        body,
        0,
        height + 1.05,
        0,
      );
      orbit.rotation.set(0.7 + i * 0.5, i * 0.7, 0.4);
      arms.push(orbit);
    }
  } else if (["colossus", "catalyst", "camp"].includes(unit.kind)) {
    const s =
      unit.kind === "colossus" ? 2.5 : unit.kind === "catalyst" ? 1.55 : 1;
    root.scale.setScalar(s);
    body.position.y = 1.1;
    orb(
      0.95,
      unit.kind === "colossus" ? "#cec7dc" : "#8fa785",
      body,
      0,
      0.4,
      0,
    );
    orb(0.62, "#dad7b5", body, 0, 0.9, 0.6);
    orb(0.18, "#bc79d0", body, 0, 0.88, 1.14);
    for (const side of [-1, 1]) {
      const leg = joint(root, side * 0.73, 0.9, 0);
      legs.push(leg);
      box(0.55, 1.2, 0.75, "#b6b99b", leg, 0, -0.3, 0);
      box(0.9, 0.3, 1.05, "#d5d3b1", leg, 0, -0.8, 0.18);
      const arm = joint(body, side * 1.05, 0.6, 0);
      arms.push(arm);
      box(0.55, 1.15, 0.55, "#a6af93", arm, 0, -0.45, 0.2);
      orb(0.3, "#7eaf67", body, side * 0.65, 1, -0.2);
    }
  } else if (unit.kind === "ward") {
    cylinder(0.15, 0.35, 0.85, "#e1d2a4", root, 0, 0.4, 0);
    orb(0.25, "#73d6d3", root, 0, 1, 0);
  } else if (unit.kind === "wall") {
    box(4, 1.7, 0.65, "#bfcaad", root, 0, 0.85, 0);
  } else {
    const siege = unit.kind === "siege" || unit.kind === "vanguard";
    root.scale.setScalar(siege ? 1 : 0.72);
    cylinder(0.45, 0.35, 0.8, color, body, 0, 0.7, 0);
    orb(0.27, "#e4dcbc", body, 0, 1.3, 0);
    box(0.48, 0.1, 0.4, "#ab996a", body, 0, 1.38, 0);
    for (const side of [-1, 1]) {
      const foot = box(0.19, 0.4, 0.27, "#374b4a", body, side * 0.21, 0.2, 0);
      legs.push(foot);
    }
    if (unit.kind === "bolt")
      cylinder(0.04, 0.04, 1.3, "#d7b96b", body, 0.5, 0.75, 0);
    else box(0.15, 0.85, 0.35, "#d5d9ba", body, 0.55, 0.75, 0);
  }
  root.userData.unitId = unit.id;
  root.traverse((o) => {
    o.userData.unitId = unit.id;
  });
  return { root, body, arms, legs, accent: ring, kind: unit.kind };
}
export function animateRig(r: Rig, u: Unit, time: number) {
  const moving = Boolean(u.move) && u.hp > 0;
  const gait = Math.sin(time * 9 + u.id);
  r.legs.forEach((leg, i) => {
    leg.rotation.x = moving ? gait * (i % 2 ? 1 : -1) * 0.45 : 0;
  });
  r.arms.forEach((arm, i) => {
    if (["engine", "tower", "coreTower", "seal"].includes(u.kind)) {
      arm.rotation.y = time * 0.35;
      return;
    }
    arm.rotation.x =
      (moving ? gait * (i % 2 ? -1 : 1) * 0.2 : 0) -
      (u.animation > 0 ? Math.sin((u.animation / 0.55) * Math.PI) * 1.4 : 0);
  });
  if (u.hero === "oru") r.body.position.y = 1.15 + Math.sin(time * 2) * 0.1;
  r.root.position.set(u.x, u.hp <= 0 ? -0.6 : 0, u.z);
  r.root.rotation.y = u.angle;
}

export function buildMap(scene: THREE.Scene, seed: number) {
  let state = seed >>> 0;
  const rand = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const turfCanvas = document.createElement("canvas");
  turfCanvas.width = 512;
  turfCanvas.height = 512;
  const turf = turfCanvas.getContext("2d")!;
  turf.fillStyle = "#65764b";
  turf.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 14000; i++) {
    const v = rand();
    turf.fillStyle =
      v > 0.7 ? "#8c985950" : v > 0.3 ? "#4c663a50" : "#acc37524";
    turf.fillRect(rand() * 512, rand() * 512, 1 + rand() * 5, 1 + rand() * 3);
  }
  for (let i = 0; i < 80; i++) {
    const x = rand() * 512,
      y = rand() * 512,
      r = 10 + rand() * 30,
      g = turf.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "#a6a46722");
    g.addColorStop(1, "#8a955500");
    turf.fillStyle = g;
    turf.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const turfTexture = new THREE.CanvasTexture(turfCanvas);
  turfTexture.wrapS = turfTexture.wrapT = THREE.RepeatWrapping;
  turfTexture.repeat.set(5, 5);
  turfTexture.colorSpace = THREE.SRGBColorSpace;
  const turfMat = new THREE.MeshStandardMaterial({
    map: turfTexture,
    color: "#c4d2a3",
    roughness: 1,
  });
  const island = new THREE.Mesh(new THREE.CylinderGeometry(77, 66, 8, 80), [
    material("#506f58"),
    turfMat,
    material("#40525a"),
  ]);
  island.position.y = -4.1;
  island.scale.z = 0.73;
  island.receiveShadow = true;
  scene.add(island);
  const cliff = new THREE.Mesh(
    new THREE.CylinderGeometry(67, 36, 15, 19),
    material("#526773"),
  );
  cliff.position.y = -14;
  cliff.scale.z = 0.72;
  scene.add(cliff);
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 256;
  textureCanvas.height = 256;
  const c = textureCanvas.getContext("2d")!;
  c.fillStyle = "#c9c6a7";
  c.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++)
    for (let col = -1; col < 6; col++) {
      const v = 171 + rand() * 32;
      c.fillStyle = `rgb(${v + 12},${v + 8},${v - 9})`;
      c.fillRect(col * 54 + (row % 2) * 27 + 1, row * 32 + 1, 51, 29);
    }
  for (let i = 0; i < 2000; i++) {
    c.fillStyle = "rgba(76,86,60,.08)";
    c.fillRect(rand() * 256, rand() * 256, rand() * 6, rand() * 5);
  }
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  const roadMat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 1,
    color: "#eee8c7",
  });
  const treeData: Array<{ x: number; z: number; s: number; color: number }> =
    [];
  const stoneData: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D();
  for (const lane of LANES) {
    const curve = new THREE.CatmullRomCurve3(
      lane.map((p) => new THREE.Vector3(p.x, 0.035, p.z)),
    );
    const positions: number[] = [],
      uv: number[] = [],
      indices: number[] = [];
    for (let i = 0; i <= 240; i++) {
      const t = i / 240,
        p = curve.getPoint(t),
        tangent = curve.getTangent(t),
        side = new THREE.Vector3(-tangent.z, 0, tangent.x);
      for (const k of [-1, 1]) {
        const v = p.clone().addScaledVector(side, 3.3 * k);
        positions.push(v.x, v.y, v.z);
        uv.push((k + 1) / 2, i / 12);
      }
      if (i < 240) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
      if (i % 4 === 0)
        for (const s of [-1, 1]) {
          const v = p.clone().addScaledVector(side, 3.7 * s);
          dummy.position.set(v.x, 0.1, v.z);
          dummy.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0);
          dummy.scale.set(0.5, 0.3, 1.6);
          dummy.updateMatrix();
          stoneData.push(dummy.matrix.clone());
        }
    }
    // Reverse each triangle so the road's front face points toward the camera above.
    for (let i = 0; i < indices.length; i += 3) {
      const second = indices[i + 1];
      indices[i + 1] = indices[i + 2];
      indices[i + 2] = second;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geom.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    const mesh = new THREE.Mesh(geom, roadMat);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  const curbs = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    material("#d6d1b3"),
    stoneData.length,
  );
  stoneData.forEach((m, i) => curbs.setMatrixAt(i, m));
  curbs.castShadow = true;
  curbs.receiveShadow = true;
  scene.add(curbs);
  for (const x of [-64, 64]) {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 9, 0.22, 48),
      roadMat,
    );
    base.position.set(x, 0.07, 0);
    base.receiveShadow = true;
    scene.add(base);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(7.5, 0.1, 5, 64),
      material(x < 0 ? "#71cbcc" : "#e69d7f", 0.3),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.22, 0);
    scene.add(ring);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(7, 0.4, 73), roadMat);
  bridge.position.set(0, 0.12, 0);
  bridge.receiveShadow = true;
  scene.add(bridge);
  const center = new THREE.Mesh(
    new THREE.CylinderGeometry(8, 9, 0.5, 32),
    material("#c5c3ab"),
  );
  center.position.y = 0.15;
  center.receiveShadow = true;
  scene.add(center);
  const centerRing = new THREE.Mesh(
    new THREE.TorusGeometry(6.9, 0.12, 5, 64),
    material("#b992c8", 0.2),
  );
  centerRing.rotation.x = -Math.PI / 2;
  centerRing.position.y = 0.44;
  scene.add(centerRing);
  const roadNear = (x: number, z: number) =>
    LANES.some((lane) =>
      lane.some((p, i) => {
        const q = lane[Math.min(i + 1, lane.length - 1)],
          dx = q.x - p.x,
          dz = q.z - p.z,
          t = Math.max(
            0,
            Math.min(
              1,
              ((x - p.x) * dx + (z - p.z) * dz) / (dx * dx + dz * dz || 1),
            ),
          );
        return Math.hypot(x - p.x - dx * t, z - p.z - dz * t) < 7;
      }),
    );
  for (let i = 0; i < 400; i++) {
    const x = (rand() - 0.5) * 145,
      z = (rand() - 0.5) * 102;
    if (
      (x * x) / 5400 + (z * z) / 2600 > 1 ||
      roadNear(x, z) ||
      Math.hypot(x, z) < 13 ||
      Math.abs(x) < 5 ||
      Math.abs(x) > 55
    )
      continue;
    treeData.push({ x, z, s: 1 + rand() * 1.2, color: i % 4 });
  }
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.2, 0.36, 3, 6),
    material("#6c7560"),
    treeData.length,
  );
  const crowns = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    material("#72905d"),
    treeData.length * 3,
  );
  treeData.forEach((p, i) => {
    dummy.position.set(p.x, p.s * 1.2, p.z);
    dummy.rotation.set(0, rand() * 6, 0.04);
    dummy.scale.setScalar(p.s);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    for (let n = 0; n < 3; n++) {
      dummy.position.set(
        p.x + (n - 1) * 0.7,
        p.s * (2.6 + n * 0.25),
        p.z + (n % 2) * 0.8,
      );
      dummy.scale.set(p.s * 1.5, p.s * (1.1 + n * 0.17), p.s * 1.4);
      dummy.updateMatrix();
      crowns.setMatrixAt(i * 3 + n, dummy.matrix);
      crowns.setColorAt(
        i * 3 + n,
        new THREE.Color(
          p.color === 0
            ? "#d99575"
            : n === 0
              ? "#638553"
              : n === 1
                ? "#85a665"
                : "#a3b97a",
        ),
      );
    }
  });
  trunks.castShadow = true;
  crowns.castShadow = true;
  crowns.receiveShadow = true;
  scene.add(trunks, crowns);
  for (const brush of BRUSH) {
    const leaves = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.36, 1.7, 4),
      material("#508f77"),
      45,
    );
    for (let i = 0; i < 45; i++) {
      const a = rand() * Math.PI * 2,
        r = Math.sqrt(rand()) * brush.r;
      dummy.position.set(
        brush.x + Math.cos(a) * r,
        0.5,
        brush.z + Math.sin(a) * r,
      );
      dummy.rotation.set(0.1, rand() * 6, rand() * 0.3);
      dummy.scale.setScalar(0.8 + rand() * 0.5);
      dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
    }
    scene.add(leaves);
  }
  const clouds = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 8, 5),
    new THREE.MeshBasicMaterial({
      color: "#acc4d0",
      transparent: true,
      opacity: 0.17,
      depthWrite: false,
    }),
    45,
  );
  for (let i = 0; i < 45; i++) {
    const a = (i / 45) * Math.PI * 2,
      r = 100 + rand() * 45;
    dummy.position.set(Math.sin(a) * r, -13 - rand() * 15, Math.cos(a) * r);
    dummy.scale.set(12 + rand() * 15, 2 + rand() * 3, 7 + rand() * 10);
    dummy.updateMatrix();
    clouds.setMatrixAt(i, dummy.matrix);
  }
  scene.add(clouds);
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2,
      x = Math.sin(a) * 75,
      z = Math.cos(a) * 53;
    const ruin = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.45, 4 + rand() * 5, 5),
      material("#b0b6a8"),
    );
    ruin.position.set(x, -1, z);
    ruin.rotation.y = rand() * 3;
    ruin.castShadow = true;
    scene.add(ruin);
  }
  const tufts: Array<{ x: number; z: number; s: number }> = [];
  for (let i = 0; i < 1800; i++) {
    const x = (rand() - 0.5) * 147,
      z = (rand() - 0.5) * 100;
    if (
      (x * x) / 5300 + (z * z) / 2500 > 1 ||
      roadNear(x, z) ||
      Math.abs(x) < 5 ||
      Math.hypot(x, z) < 10
    )
      continue;
    tufts.push({ x, z, s: 0.25 + rand() * 0.45 });
  }
  const grass = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.42, 1, 3),
    material("#89a062"),
    tufts.length,
  );
  tufts.forEach((p, i) => {
    dummy.position.set(p.x, p.s * 0.3, p.z);
    dummy.rotation.set(0.16, rand() * 6, 0.1);
    dummy.scale.set(p.s, p.s, p.s);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
    if (i % 11 === 0) grass.setColorAt(i, new THREE.Color("#edb191"));
    else
      grass.setColorAt(i, new THREE.Color(i % 3 === 0 ? "#b6c77f" : "#83a969"));
  });
  grass.receiveShadow = true;
  scene.add(grass);
  return () => {
    texture.dispose();
    turfTexture.dispose();
    turfMat.dispose();
    mats.forEach((m) => m.dispose());
    mats.clear();
  };
}
