import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { TaxiId } from "../game/types";

export type TaxiModel = {
  root: TransformNode;
  wheels: TransformNode[];
  steering: TransformNode[];
  body: TransformNode;
  turbine: TransformNode;
  brakeLights: Mesh[];
  meshes: Mesh[];
};
const hex = (color: string) => Color3.FromHexString(color);

function material(
  scene: Scene,
  name: string,
  color: string,
  gloss = 40,
): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = hex(color);
  mat.specularColor = new Color3(0.42, 0.5, 0.49);
  mat.specularPower = gloss;
  return mat;
}

/** Original coachwork mesh, built from beveled cross sections instead of stacked cubes. */
function coachwork(
  scene: Scene,
  name: string,
  sections: number[][],
  parent: TransformNode,
  mat: StandardMaterial,
): Mesh {
  const positions: number[] = [],
    indices: number[] = [],
    normals: number[] = [];
  for (const [z, width, bottom, top, bevel] of sections) {
    for (const [x, y] of [
      [-width + bevel, bottom],
      [width - bevel, bottom],
      [width, bottom + bevel],
      [width, top - bevel],
      [width - bevel, top],
      [-width + bevel, top],
      [-width, top - bevel],
      [-width, bottom + bevel],
    ])
      positions.push(x, y, z);
  }
  for (let s = 0; s < sections.length - 1; s++)
    for (let p = 0; p < 8; p++) {
      const a = s * 8 + p,
        b = s * 8 + ((p + 1) % 8),
        c = (s + 1) * 8 + p,
        d = (s + 1) * 8 + ((p + 1) % 8);
      indices.push(a, c, b, b, c, d);
    }
  // Separate cap vertices keep the broad hood and hatch reflections smooth and symmetric.
  const rearCap = positions.length / 3;
  positions.push(...positions.slice(0, 24));
  const frontCap = positions.length / 3;
  positions.push(
    ...positions.slice((sections.length - 1) * 24, sections.length * 24),
  );
  for (let p = 1; p < 7; p++) {
    indices.push(rearCap, rearCap + p, rearCap + p + 1);
    indices.push(frontCap, frontCap + p + 1, frontCap + p);
  }
  VertexData.ComputeNormals(positions, indices, normals);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  const mesh = new Mesh(name, scene);
  data.applyToMesh(mesh);
  mesh.material = mat;
  mesh.parent = parent;
  return mesh;
}

function plate(
  scene: Scene,
  name: string,
  points: number[][],
  parent: TransformNode,
  mat: StandardMaterial,
): Mesh {
  const positions = points.flat(),
    indices = [0, 1, 2, 0, 2, 3],
    normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  data.uvs = [0, 0, 1, 0, 1, 1, 0, 1];
  const mesh = new Mesh(name, scene);
  data.applyToMesh(mesh);
  mesh.material = mat;
  mesh.parent = parent;
  return mesh;
}

export function createTaxiModel(
  scene: Scene,
  taxiId: TaxiId,
  color = "#19aaa4",
  simple = false,
): TaxiModel {
  const root = new TransformNode(`taxi-${taxiId}`, scene),
    body = new TransformNode("sprung coachwork", scene);
  body.parent = root;
  const paint = material(scene, `enamel-${color}`, color, 100),
    cream = material(scene, "warm ivory roof", "#f4e6c6", 80);
  const glass = material(scene, "smoked teal glass", "#123b46", 130);
  glass.specularColor = new Color3(0.75, 0.9, 1);
  glass.backFaceCulling = false;
  const trim = material(scene, "graphite trim", "#162f34", 55),
    rubber = material(scene, "tire compound", "#1b292d", 10),
    chrome = material(scene, "satin alloy", "#b4d4cd", 120),
    coral = material(scene, "coral coachline", "#ef7754", 60);
  const lamp = material(scene, "headlamp", "#fff4ce");
  lamp.emissiveColor = hex("#dbbd6e");
  const brake = material(scene, "tail lamp", "#df4f45");
  brake.emissiveColor = hex("#6d1d1a");
  const meshes: Mesh[] = [],
    wheels: TransformNode[] = [],
    steering: TransformNode[] = [],
    brakeLights: Mesh[] = [];
  const length = taxiId === "gull" ? 0.88 : taxiId === "tempest" ? 1.14 : 1;
  const width = taxiId === "tempest" ? 1.1 : taxiId === "gull" ? 0.94 : 1;
  const box = (
    name: string,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: StandardMaterial,
    parent: TransformNode = body,
  ) => {
    const mesh = MeshBuilder.CreateBox(
      name,
      { width: w, height: h, depth: d },
      scene,
    );
    mesh.position.set(x, y, z);
    mesh.material = mat;
    mesh.parent = parent;
    meshes.push(mesh);
    return mesh;
  };
  meshes.push(
    coachwork(
      scene,
      "sculpted lower body",
      [
        [-2.32 * length, 0.8 * width, 0.52, 0.95, 0.14],
        [-2.04 * length, 1.05 * width, 0.45, 1.12, 0.14],
        [-1.1 * length, 1.1 * width, 0.45, 1.2, 0.12],
        [0.65 * length, 1.1 * width, 0.45, 1.15, 0.12],
        [1.8 * length, 1.04 * width, 0.5, 1.05, 0.14],
        [2.28 * length, 0.84 * width, 0.62, 0.94, 0.15],
      ],
      body,
      paint,
    ),
  );
  meshes.push(
    coachwork(
      scene,
      "upper cabin",
      [
        [-1.55 * length, 0.92 * width, 1.03, 1.32, 0.08],
        [-0.97 * length, 0.83 * width, 1.05, 1.93, 0.08],
        [0.43 * length, 0.82 * width, 1.05, 1.91, 0.08],
        [1.06 * length, 0.95 * width, 1.05, 1.18, 0.07],
      ],
      body,
      cream,
    ),
  );
  const frontGlass = plate(
    scene,
    "panoramic windscreen",
    [
      [-0.76 * width, 1.84, 0.49 * length],
      [0.76 * width, 1.84, 0.49 * length],
      [0.87 * width, 1.19, 1.095 * length],
      [-0.87 * width, 1.19, 1.095 * length],
    ],
    body,
    glass,
  );
  meshes.push(frontGlass);
  meshes.push(
    plate(
      scene,
      "rear glass",
      [
        [0.83 * width, 1.36, -1.565 * length],
        [-0.83 * width, 1.36, -1.565 * length],
        [-0.75 * width, 1.84, -1.105 * length],
        [0.75 * width, 1.84, -1.105 * length],
      ],
      body,
      glass,
    ),
  );
  for (const sign of [-1, 1]) {
    meshes.push(
      plate(
        scene,
        "front side window",
        [
          [sign * 0.965 * width, 1.23, 0.9 * length],
          [sign * 0.842 * width, 1.82, 0.37 * length],
          [sign * 0.845 * width, 1.83, -0.16 * length],
          [sign * 0.96 * width, 1.23, -0.16 * length],
        ],
        body,
        glass,
      ),
    );
    meshes.push(
      plate(
        scene,
        "rear side window",
        [
          [sign * 0.96 * width, 1.23, -0.24 * length],
          [sign * 0.85 * width, 1.83, -0.24 * length],
          [sign * 0.85 * width, 1.81, -0.88 * length],
          [sign * 0.95 * width, 1.23, -1.4 * length],
        ],
        body,
        glass,
      ),
    );
    box(
      "coral sill",
      0.09,
      0.13,
      3.5 * length,
      sign * 1.106 * width,
      0.62,
      -0.05,
      coral,
    );
    box(
      "door handle",
      0.06,
      0.055,
      0.22,
      sign * 1.105 * width,
      1.04,
      0.15 * length,
      chrome,
    );
    box(
      "rear door handle",
      0.06,
      0.055,
      0.22,
      sign * 1.105 * width,
      1.04,
      -0.8 * length,
      chrome,
    );
    const mirror = box(
      "wing mirror",
      0.29,
      0.15,
      0.26,
      sign * 1.11 * width,
      1.33,
      0.59 * length,
      paint,
    );
    mirror.rotation.y = sign * 0.2;
    box(
      "headlight",
      0.47,
      0.16,
      0.085,
      sign * 0.57 * width,
      0.87,
      2.245 * length,
      lamp,
    );
    const light = box(
      "tail lamp",
      0.5,
      0.14,
      0.065,
      sign * 0.56 * width,
      0.88,
      -2.295 * length,
      brake,
    );
    brakeLights.push(light);
    box(
      "lower lamp",
      0.27,
      0.065,
      0.055,
      sign * 0.62 * width,
      0.65,
      2.25 * length,
      lamp,
    );
  }
  box("front grille", 0.8, 0.16, 0.06, 0, 0.76, 2.29 * length, trim);
  box("rear bumper", 1.71 * width, 0.16, 0.17, 0, 0.51, -2.28 * length, chrome);
  box("front splitter", 1.68 * width, 0.09, 0.25, 0, 0.54, 2.21 * length, trim);
  box("hood stripe", 0.3, 0.015, 0.9 * length, 0, 1.101, 1.48 * length, cream);
  box(
    "rear registration plate",
    0.44,
    0.15,
    0.03,
    0,
    0.64,
    -2.37 * length,
    cream,
  );
  box(
    "rear hatch coachline",
    1.62 * width,
    0.035,
    0.035,
    0,
    1.005,
    -2.18 * length,
    cream,
  );
  box(
    "rear window wiper",
    0.024,
    0.024,
    0.5,
    0,
    1.4,
    -1.55 * length,
    trim,
  ).rotation.x = -0.7;
  for (const x of [-1.07 * width, 1.07 * width])
    for (const z of [-1.4 * length, 1.39 * length]) {
      const steer = new TransformNode("steered wheel", scene);
      steer.position.set(x, 0.445, z);
      steer.parent = root;
      const spin = new TransformNode("spinning wheel", scene);
      spin.parent = steer;
      const tire = MeshBuilder.CreateCylinder(
        "beveled tire",
        { height: 0.3, diameter: 0.9, tessellation: simple ? 12 : 28 },
        scene,
      );
      tire.rotation.z = Math.PI / 2;
      tire.material = rubber;
      tire.parent = spin;
      meshes.push(tire);
      const rim = MeshBuilder.CreateCylinder(
        "alloy wheel",
        { height: 0.315, diameter: 0.59, tessellation: simple ? 10 : 24 },
        scene,
      );
      rim.rotation.z = Math.PI / 2;
      rim.material = chrome;
      rim.parent = spin;
      meshes.push(rim);
      const hub = MeshBuilder.CreateCylinder(
        "recessed wheel hub",
        { height: 0.322, diameter: 0.39, tessellation: 12 },
        scene,
      );
      hub.rotation.z = Math.PI / 2;
      hub.material = trim;
      hub.parent = spin;
      meshes.push(hub);
      if (!simple)
        for (let i = 0; i < 6; i++) {
          const spoke = box(
            "six-spoke alloy",
            0.33,
            0.055,
            0.48,
            0,
            0,
            0,
            chrome,
            spin,
          );
          spoke.rotation.x = (i * Math.PI) / 3;
        }
      wheels.push(spin);
      if (z > 0) steering.push(steer);
    }
  const turbine = new TransformNode("roof turbine rotor", scene);
  turbine.parent = body;
  turbine.position.set(0, 2.13, -0.49 * length);
  if (!simple) {
    const housing = MeshBuilder.CreateCylinder(
      "roof turbine nacelle",
      { height: 0.52, diameter: 0.58, tessellation: 24 },
      scene,
    );
    housing.rotation.x = Math.PI / 2;
    housing.position.set(0, 2.14, -0.5 * length);
    housing.material = paint;
    housing.parent = body;
    meshes.push(housing);
    const inlet = MeshBuilder.CreateTorus(
      "polished turbine inlet",
      { diameter: 0.54, thickness: 0.06, tessellation: 24 },
      scene,
    );
    inlet.rotation.x = Math.PI / 2;
    inlet.position.set(0, 2.14, -0.21 * length);
    inlet.material = chrome;
    inlet.parent = body;
    meshes.push(inlet);
    const outlet = MeshBuilder.CreateCylinder(
      "dark turbine exhaust",
      { height: 0.025, diameter: 0.43, tessellation: 20 },
      scene,
    );
    outlet.rotation.x = Math.PI / 2;
    outlet.position.set(0, 2.14, -0.78 * length);
    outlet.material = trim;
    outlet.parent = body;
    meshes.push(outlet);
    for (let n = 0; n < 7; n++) {
      const blade = box(
        "fan blade",
        0.045,
        0.42,
        0.035,
        0,
        0,
        0.285,
        trim,
        turbine,
      );
      blade.rotation.z = (n * Math.PI) / 7;
    }
    const fareBox = box(
      "fare display housing",
      0.68,
      0.25,
      0.22,
      0,
      2.065,
      0.45 * length,
      trim,
    );
    const tex = new DynamicTexture(
      "fare sign lettering",
      { width: 256, height: 96 },
      scene,
      false,
    );
    tex.hasAlpha = false;
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = "#12373b";
    ctx.fillRect(0, 0, 256, 96);
    ctx.font = "bold 54px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffce84";
    ctx.fillText("STORM", 128, 68);
    tex.update();
    const signMat = new StandardMaterial("warm fare sign", scene);
    signMat.diffuseTexture = tex;
    signMat.emissiveTexture = tex;
    signMat.emissiveColor = new Color3(0.4, 0.35, 0.2);
    signMat.specularColor = Color3.Black();
    const sign = MeshBuilder.CreatePlane(
      "fare sign front",
      { width: 0.61, height: 0.21 },
      scene,
    );
    sign.parent = body;
    sign.position.set(0, 2.065, 0.568 * length);
    sign.rotation.y = Math.PI;
    sign.material = signMat;
    meshes.push(sign);
    fareBox.isPickable = false;
    // Visible interior silhouettes give glass areas depth without expensive transparency.
    const driver = box(
      "driver silhouette",
      0.35,
      0.48,
      0.28,
      -0.43,
      1.41,
      0.05,
      trim,
    );
    driver.rotation.x = -0.08;
    const head = MeshBuilder.CreateSphere(
      "driver head",
      { diameter: 0.23, segments: 8 },
      scene,
    );
    head.position.set(-0.43, 1.7, 0.1);
    head.parent = body;
    head.material = material(scene, "driver skin", "#b97958");
    meshes.push(head);
  }
  for (const mesh of meshes) {
    mesh.isPickable = false;
    mesh.receiveShadows = true;
  }
  return { root, wheels, steering, body, turbine, brakeLights, meshes };
}

export function animateTaxi(
  model: TaxiModel,
  spin: number,
  steer: number,
  roll: number,
  pitch: number,
  suspension: number[],
  delta: number,
): void {
  model.wheels.forEach((wheel, index) => {
    wheel.rotation.x = spin;
    const parent = wheel.parent as TransformNode;
    parent.position.y = 0.445 + (suspension[[2, 0, 3, 1][index]] ?? 0) * 0.07;
  });
  model.steering.forEach((wheel) => (wheel.rotation.y = steer * 0.5));
  model.body.rotation.z +=
    (roll - model.body.rotation.z) * Math.min(1, delta * 9);
  model.body.rotation.x +=
    (-pitch - model.body.rotation.x) * Math.min(1, delta * 8);
  model.turbine.rotation.z += delta * 9;
}

export function createTrafficModel(
  scene: Scene,
  variant: number,
  color: string,
): TransformNode {
  const root = new TransformNode("traffic vehicle", scene),
    paint = material(scene, `traffic paint ${color}`, color, 65),
    glass = material(scene, "traffic glass", "#23454e", 90),
    rubber = material(scene, "traffic tire", "#223136", 8),
    silver = material(scene, "traffic trim", "#c4d0c7", 70);
  const kind = variant % 5,
    w = kind === 3 ? 2.5 : 2.05,
    l = kind === 3 ? 7.2 : kind === 4 ? 5.6 : 4.3,
    h = kind === 3 ? 2.6 : kind === 4 ? 2 : 1.15;
  const body = coachwork(
    scene,
    "traffic coachwork",
    [
      [-l / 2, (0.8 * w) / 2, 0.48, h, 0.12],
      [-l / 2 + 0.4, w / 2, 0.43, h + 0.06, 0.1],
      [l / 2 - 0.5, w / 2, 0.43, h, 0.1],
      [l / 2, (0.8 * w) / 2, 0.55, h - 0.12, 0.1],
    ],
    root,
    paint,
  );
  body.isPickable = false;
  const cabin = MeshBuilder.CreateBox(
    "traffic canopy",
    { width: w * 0.82, height: kind === 3 ? 0.6 : 0.72, depth: l * 0.48 },
    scene,
  );
  cabin.position.set(0, h + 0.22, -0.2);
  cabin.material = glass;
  cabin.parent = root;
  const roof = MeshBuilder.CreateBox(
    "traffic roof",
    { width: w * 0.83, height: 0.12, depth: l * 0.49 },
    scene,
  );
  roof.position.set(0, h + 0.62, -0.2);
  roof.material = paint;
  roof.parent = root;
  for (const side of [-1, 1])
    for (const end of [-1, 1]) {
      const wheel = MeshBuilder.CreateCylinder(
        "traffic wheel",
        { height: 0.24, diameter: 0.83, tessellation: 10 },
        scene,
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * w * 0.5, 0.42, end * l * 0.31);
      wheel.material = rubber;
      wheel.parent = root;
    }
  for (const side of [-1, 1]) {
    const lamp = MeshBuilder.CreateBox(
      "traffic lamp",
      { width: 0.4, height: 0.13, depth: 0.055 },
      scene,
    );
    lamp.position.set(side * w * 0.29, 0.82, l / 2 + 0.03);
    lamp.material = silver;
    lamp.parent = root;
  }
  root.getChildMeshes().forEach((m) => {
    m.isPickable = false;
    m.receiveShadows = true;
  });
  return root;
}
