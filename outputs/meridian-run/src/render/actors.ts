import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { VehicleDefinition } from "../game/types";
import { createTaxiModel, createTrafficModel } from "./vehicles";
export type Actor = {
  root: TransformNode;
  torso: TransformNode;
  arms: TransformNode[];
  legs: TransformNode[];
  head: TransformNode;
  weapon: Mesh;
  meshes: Mesh[];
};
const cache = new WeakMap<Scene, Map<string, StandardMaterial>>();
export function mat(scene: Scene, color: string) {
  let map = cache.get(scene);
  if (!map) {
    map = new Map();
    cache.set(scene, map);
  }
  if (map.has(color)) return map.get(color)!;
  const m = new StandardMaterial(color, scene);
  m.diffuseColor = Color3.FromHexString(color);
  m.specularColor.set(0.12, 0.15, 0.16);
  map.set(color, m);
  return m;
}
export function box(
  scene: Scene,
  parent: TransformNode,
  name: string,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  color: string,
) {
  const round = ["rolled sleeve", "forearm", "trouser", "glove"].includes(name);
  const m = round
    ? MeshBuilder.CreateCapsule(
        name,
        {
          radius: w / 2,
          height: Math.max(h, w),
          tessellation: 10,
          subdivisions: 1,
          capSubdivisions: 2,
        },
        scene,
      )
    : MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
  if (round) m.scaling.z = d / w;
  m.parent = parent;
  m.position.set(x, y, z);
  m.material = mat(scene, color);
  m.isPickable = false;
  m.receiveShadows = true;
  return m;
}
export function makeActor(
  scene: Scene,
  color = "#b77654",
  hero = false,
  role = "civilian",
): Actor {
  const root = new TransformNode(role, scene),
    torso = new TransformNode("jacket rig", scene);
  torso.parent = root;
  torso.position.y = 0.92;
  const arms: TransformNode[] = [],
    legs: TransformNode[] = [];
  const skin = hero ? "#b58064" : role === "police" ? "#ba967c" : "#ac826b",
    pants = role === "police" ? "#2d4251" : "#343b3d";
  const body = MeshBuilder.CreateCylinder(
    "tailored jacket",
    { height: 0.62, diameterTop: 0.46, diameterBottom: 0.36, tessellation: 8 },
    scene,
  );
  body.parent = torso;
  body.position.y = 0.29;
  body.scaling.z = 0.66;
  body.material = mat(scene, color);
  box(
    scene,
    torso,
    "jacket placket",
    0.035,
    0.54,
    0.025,
    0.04,
    0.3,
    0.166,
    "#dbb58a",
  );
  box(scene, torso, "collar", 0.3, 0.085, 0.26, 0, 0.62, 0, pants);
  box(scene, torso, "hip belt", 0.38, 0.09, 0.25, 0, -0.04, 0, pants);
  if (hero) {
    box(
      scene,
      torso,
      "courier satchel",
      0.35,
      0.43,
      0.17,
      0,
      0.32,
      -0.23,
      "#705744",
    );
    box(
      scene,
      torso,
      "parcel label",
      0.15,
      0.14,
      0.014,
      0.03,
      0.38,
      -0.32,
      "#e2d2ac",
    );
    box(
      scene,
      torso,
      "shoulder strap",
      0.055,
      0.64,
      0.032,
      -0.16,
      0.28,
      0.173,
      "#493f35",
    );
  }
  if (role === "police" || role === "security") {
    box(
      scene,
      torso,
      "protective vest",
      0.4,
      0.38,
      0.12,
      0,
      0.3,
      0.17,
      "#283945",
    );
    box(
      scene,
      torso,
      "civic badge",
      0.085,
      0.1,
      0.02,
      -0.12,
      0.44,
      0.24,
      "#e2bd71",
    );
  }
  const head = new TransformNode("head rig", scene);
  head.parent = torso;
  head.position.y = 0.76;
  const skull = MeshBuilder.CreateSphere(
    "face",
    { diameter: 0.255, segments: 8 },
    scene,
  );
  skull.scaling.y = 1.15;
  skull.parent = head;
  skull.material = mat(scene, skin);
  box(
    scene,
    head,
    "sculpted hair",
    0.25,
    0.1,
    0.23,
    0,
    0.13,
    -0.025,
    hero ? "#342c28" : "#49453d",
  );
  box(scene, head, "nose", 0.055, 0.052, 0.075, 0, 0, 0.12, skin);
  if (hero)
    box(scene, head, "undercut", 0.22, 0.16, 0.08, 0, 0.04, -0.1, "#342c28");
  for (const sign of [-1, 1]) {
    const arm = new TransformNode("shoulder", scene);
    arm.parent = torso;
    arm.position.set(sign * 0.26, 0.51, 0);
    box(scene, arm, "rolled sleeve", 0.17, 0.3, 0.19, 0, -0.13, 0, color);
    box(scene, arm, "forearm", 0.12, 0.29, 0.13, 0, -0.4, 0.018, skin);
    box(scene, arm, "glove", 0.14, 0.13, 0.14, 0, -0.55, 0.02, pants);
    arms.push(arm);
    const leg = new TransformNode("hip", scene);
    leg.parent = root;
    leg.position.set(sign * 0.112, 0.9, 0);
    box(scene, leg, "trouser", 0.185, 0.68, 0.22, 0, -0.34, 0, pants);
    box(scene, leg, "boot", 0.19, 0.15, 0.31, 0, -0.79, 0.04, "#293334");
    legs.push(leg);
  }
  const weapon = box(
    scene,
    arms[1],
    "held equipment",
    0.1,
    0.14,
    0.31,
    0,
    -0.55,
    0.19,
    "#8eaca8",
  );
  weapon.setEnabled(false);
  const meshes = root.getChildMeshes() as Mesh[];
  meshes.forEach((m) => {
    m.isPickable = false;
    m.receiveShadows = true;
  });
  return { root, torso, arms, legs, head, weapon, meshes };
}
export function animateActor(
  a: Actor,
  time: number,
  speed: number,
  aim = false,
  crouch = false,
  seated = false,
  down = false,
) {
  const pace = time * (speed > 4 ? 11 : 7),
    stride = Math.min(0.8, speed * 0.18);
  a.torso.position.y = crouch ? 0.69 : 0.92;
  a.torso.rotation.x = seated ? 0.2 : crouch ? 0.3 : 0;
  a.root.rotation.z = down ? Math.PI / 2 : 0;
  a.legs.forEach((p, i) => {
    p.rotation.x = seated ? -1.35 : Math.sin(pace + i * Math.PI) * stride;
    p.position.y = crouch ? 0.67 : 0.9;
  });
  a.arms.forEach((p, i) => {
    p.rotation.x =
      aim || seated ? -1.3 : -Math.sin(pace + i * Math.PI) * stride * 0.6;
    p.rotation.z = aim ? (i ? -0.15 : 0.35) : i ? -0.05 : 0.05;
  });
  a.head.rotation.x = seated ? -0.1 : 0;
  a.weapon.setEnabled(aim && !seated);
}
export type CarModel = {
  root: TransformNode;
  wheels: TransformNode[];
  body: TransformNode;
  bike: boolean;
  lights: Mesh[];
};
export function makeVehicle(
  scene: Scene,
  d: VehicleDefinition,
  simple = false,
): CarModel {
  if (d.kind !== "bike") {
    if (d.kind === "van" || simple) {
      const root = createTrafficModel(scene, d.kind === "van" ? 4 : 1, d.color);
      return { root, wheels: [], body: root, bike: false, lights: [] };
    }
    const m = createTaxiModel(scene, d.model, d.color, true);
    if (d.kind === "coupe") m.body.scaling.y = 0.88;
    if (d.kind === "police") {
      box(
        scene,
        m.body,
        "white safety band",
        2.12,
        0.18,
        2.9,
        0,
        0.88,
        0,
        "#e0dfd0",
      );
      for (const s of [-1, 1]) {
        const lamp = box(
          scene,
          m.body,
          "civic beacon",
          0.48,
          0.17,
          0.28,
          s * 0.4,
          2.06,
          0,
          s < 0 ? "#d78d4e" : "#638baf",
        );
      }
    }
    return {
      root: m.root,
      wheels: m.wheels,
      body: m.body,
      bike: false,
      lights: m.brakeLights,
    };
  }
  const root = new TransformNode("motorcycle", scene),
    body = new TransformNode("leaning frame", scene);
  body.parent = root;
  const wheels: TransformNode[] = [];
  for (const z of [-0.88, 0.88]) {
    const spin = new TransformNode("motorcycle wheel", scene);
    spin.parent = body;
    spin.position.set(0, 0.38, z);
    for (const [diameter, height, color] of [
      [0.77, 0.21, "#222c30"],
      [0.55, 0.22, "#adbbb4"],
      [0.4, 0.23, "#37474b"],
    ] as const) {
      const m = MeshBuilder.CreateCylinder(
        "wheel",
        { height, diameter, tessellation: 20 },
        scene,
      );
      m.parent = spin;
      m.rotation.z = Math.PI / 2;
      m.material = mat(scene, color);
    }
    wheels.push(spin);
  }
  box(scene, body, "engine block", 0.42, 0.4, 0.62, 0, 0.52, -0.1, "#485b5d");
  for (let i = 0; i < 5; i++)
    box(
      scene,
      body,
      "cooling fins",
      0.46,
      0.025,
      0.4,
      0,
      0.4 + i * 0.06,
      -0.1,
      "#a1aaa1",
    );
  const tank = MeshBuilder.CreateSphere(
    "sculpted fuel tank",
    { diameter: 0.65, segments: 12 },
    scene,
  );
  tank.scaling.set(0.75, 0.65, 1.15);
  tank.position.set(0, 0.93, 0.22);
  tank.parent = body;
  tank.material = mat(scene, d.color);
  box(scene, body, "rider saddle", 0.38, 0.13, 0.6, 0, 0.94, -0.36, "#383839");
  box(scene, body, "rear mudguard", 0.3, 0.12, 0.52, 0, 0.83, -0.84, d.color);
  box(
    scene,
    body,
    "headlamp housing",
    0.35,
    0.3,
    0.26,
    0,
    1.11,
    0.8,
    "#333f43",
  );
  box(scene, body, "headlamp lens", 0.29, 0.21, 0.035, 0, 1.1, 0.95, "#f3dab0");
  for (const s of [-1, 1]) {
    const fork = box(
      scene,
      body,
      "front fork",
      0.07,
      0.8,
      0.08,
      s * 0.16,
      0.74,
      0.73,
      "#c5c5b6",
    );
    fork.rotation.x = -0.2;
    box(
      scene,
      body,
      "handlebar",
      0.38,
      0.055,
      0.065,
      s * 0.18,
      1.22,
      0.56,
      "#3a4343",
    );
    box(
      scene,
      body,
      "mirror stem",
      0.03,
      0.22,
      0.03,
      s * 0.3,
      1.35,
      0.58,
      "#b3b7aa",
    );
    box(
      scene,
      body,
      "mirror",
      0.17,
      0.1,
      0.035,
      s * 0.3,
      1.47,
      0.58,
      "#739295",
    );
    const frame = box(
      scene,
      body,
      "tubular chassis",
      0.08,
      0.55,
      0.08,
      s * 0.23,
      0.62,
      0,
      "#293d40",
    );
    frame.rotation.x = 0.7;
    box(
      scene,
      body,
      "footpeg",
      0.2,
      0.055,
      0.08,
      s * 0.28,
      0.41,
      -0.24,
      "#b3b7aa",
    );
  }
  box(
    scene,
    body,
    "exhaust silencer",
    0.13,
    0.15,
    0.9,
    0.27,
    0.31,
    -0.47,
    "#a2aeab",
  );
  box(scene, body, "parcel rack", 0.46, 0.055, 0.44, 0, 1.02, -0.87, "#acb5a6");
  if (d.id === "needle") {
    box(
      scene,
      body,
      "courier cargo crate",
      0.52,
      0.43,
      0.44,
      0,
      1.25,
      -0.86,
      "#ceaa65",
    );
    box(
      scene,
      body,
      "parcel strap",
      0.07,
      0.45,
      0.46,
      0,
      1.25,
      -0.86,
      "#564d39",
    );
  }
  root.getChildMeshes().forEach((m) => {
    m.isPickable = false;
    m.receiveShadows = true;
  });
  return { root, wheels, body, bike: true, lights: [] };
}
