import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";
import {
  BUILDINGS,
  DESTINATIONS,
  LANDMARKS,
  ROADS,
  SHORTCUTS,
  RAMPS,
  heightAt,
} from "../game/world";
import type { Vec3 } from "../game/types";
import "@babylonjs/core/Meshes/thinInstanceMesh";

export type CityVisuals = {
  casters: Mesh[];
  ocean: Mesh;
  signs: Mesh[];
  signals: [StandardMaterial, StandardMaterial];
};
export function flatMaterial(
  scene: Scene,
  name: string,
  color: string,
  gloss = 8,
): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = Color3.FromHexString(color);
  mat.specularColor = new Color3(0.13, 0.16, 0.15);
  mat.specularPower = gloss;
  return mat;
}

/** Static architecture is GPU-instanced by material, not thousands of draw calls. */
class CityBatch {
  private entries = new Map<string, { mesh: Mesh; data: number[] }>();
  constructor(private scene: Scene) {}
  box(
    mat: StandardMaterial,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    ry = 0,
    rz = 0,
  ): void {
    this.add(mat, "box", x, y, z, w, h, d, ry, rz);
  }
  cylinder(
    mat: StandardMaterial,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    ry = 0,
    rz = 0,
  ): void {
    this.add(mat, "cylinder", x, y, z, w, h, w, ry, rz);
  }
  crown(
    mat: StandardMaterial,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ): void {
    this.add(mat, "crown", x, y, z, w, h, d, 0, 0);
  }
  frond(
    mat: StandardMaterial,
    x: number,
    y: number,
    z: number,
    angle: number,
  ): void {
    this.add(mat, "frond", x, y, z, 1, 1, 1, angle, 0);
  }
  private add(
    mat: StandardMaterial,
    shape: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    ry: number,
    rz: number,
  ): void {
    const key = mat.name + shape;
    let entry = this.entries.get(key);
    if (!entry) {
      const mesh =
        shape === "box"
          ? MeshBuilder.CreateBox(key, { size: 1 }, this.scene)
          : shape === "cylinder"
            ? MeshBuilder.CreateCylinder(
                key,
                { height: 1, diameter: 1, tessellation: 7 },
                this.scene,
              )
            : shape === "frond"
              ? new Mesh(key, this.scene)
              : MeshBuilder.CreateSphere(
                  key,
                  { diameter: 1, segments: 5 },
                  this.scene,
                );
      if (shape === "frond") {
        const positions = [
            0, 0, 0, -0.5, 0.45, 1.6, 0, 0.75, 1.6, 0.5, 0.45, 1.6, -0.42, -0.1,
            3.4, 0, 0.18, 3.4, 0.42, -0.1, 3.4, 0, -1.25, 5.1,
          ],
          indices = [
            0, 1, 2, 0, 2, 3, 1, 4, 2, 2, 4, 5, 2, 5, 3, 3, 5, 6, 4, 7, 5, 5, 7,
            6,
          ],
          normals: number[] = [];
        VertexData.ComputeNormals(positions, indices, normals);
        const v = new VertexData();
        Object.assign(v, { positions, indices, normals });
        v.applyToMesh(mesh);
        mat.backFaceCulling = false;
      }
      mesh.material = mat;
      mesh.isPickable = false;
      mesh.receiveShadows = true;
      entry = { mesh, data: [] };
      this.entries.set(key, entry);
    }
    entry.data.push(
      ...Matrix.Compose(
        new Vector3(w, h, d),
        Quaternion.RotationYawPitchRoll(ry, 0, rz),
        new Vector3(x, y, z),
      ).asArray(),
    );
  }
  finish(): Mesh[] {
    return [...this.entries.values()].map(({ mesh, data }) => {
      mesh.thinInstanceSetBuffer("matrix", new Float32Array(data), 16, true);
      mesh.thinInstanceRefreshBoundingInfo(true);
      mesh.freezeWorldMatrix();
      return mesh;
    });
  }
}

function ribbon(
  scene: Scene,
  name: string,
  points: Vec3[],
  width: number,
  mat: StandardMaterial,
  offset = 0.08,
): Mesh {
  const positions: number[] = [],
    indices: number[] = [],
    normals: number[] = [],
    uvs: number[] = [];
  points.forEach((p, i) => {
    const a = points[Math.max(0, i - 1)],
      b = points[Math.min(points.length - 1, i + 1)],
      dx = b.x - a.x,
      dz = b.z - a.z,
      len = Math.hypot(dx, dz) || 1;
    for (const side of [-1, 1]) {
      const x = p.x + (((side * dz) / len) * width) / 2,
        z = p.z - (((side * dx) / len) * width) / 2;
      positions.push(x, heightAt(x, z) + offset, z);
      uvs.push((side + 1) / 2, i);
    }
    if (i) {
      const a = (i - 1) * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  VertexData.ComputeNormals(positions, indices, normals);
  const data = new VertexData();
  Object.assign(data, { positions, indices, normals, uvs });
  const mesh = new Mesh(name, scene);
  data.applyToMesh(mesh);
  mesh.material = mat;
  mesh.receiveShadows = true;
  mesh.isPickable = false;
  return mesh;
}

export function textSign(
  scene: Scene,
  text: string,
  color: string,
  width = 12,
  height = 2,
): Mesh {
  const texture = new DynamicTexture(
    `sign: ${text}`,
    { width: 1024, height: 192 },
    scene,
    false,
  );
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1024, 192);
  ctx.strokeStyle = "#f4e4c1";
  ctx.lineWidth = 8;
  ctx.strokeRect(14, 14, 996, 164);
  ctx.font = `900 ${text.length > 19 ? 54 : 66}px Arial`;
  ctx.fillStyle = "#fff0d2";
  ctx.textAlign = "center";
  ctx.fillText(text, 512, 119);
  texture.update();
  const mat = new StandardMaterial(`lettering ${text}`, scene);
  mat.diffuseTexture = texture;
  mat.specularColor = Color3.Black();
  mat.emissiveColor = new Color3(0.08, 0.08, 0.07);
  mat.backFaceCulling = false;
  const mesh = MeshBuilder.CreatePlane(
    text,
    { width, height, sideOrientation: Mesh.DOUBLESIDE },
    scene,
  );
  mesh.material = mat;
  mesh.isPickable = false;
  return mesh;
}

export function buildCity(scene: Scene): CityVisuals {
  const batch = new CityBatch(scene),
    casters: Mesh[] = [],
    signs: Mesh[] = [];
  const sand = flatMaterial(scene, "warm pale stone", "#9ba586"),
    grass = flatMaterial(scene, "coastal lawn", "#76977a");
  const paving = flatMaterial(scene, "limestone sidewalks", "#ccbda4"),
    asphalt = flatMaterial(scene, "blue charcoal asphalt", "#536569");
  const cobble = flatMaterial(scene, "old town stone", "#6e7770"),
    line = flatMaterial(scene, "lane ivory", "#ddcfb3"),
    yellow = flatMaterial(scene, "lane saffron", "#efbd6c");
  const cream = flatMaterial(scene, "cornice limestone", "#f1dec0"),
    coral = flatMaterial(scene, "sunset coral", "#dc745b"),
    teal = flatMaterial(scene, "painted petrol", "#276b6c");
  const shadow = flatMaterial(scene, "window recess", "#2b4a50"),
    glass = flatMaterial(scene, "reflective turquoise windows", "#528b92", 90),
    wood = flatMaterial(scene, "warm cedar", "#8c6650");
  const trunk = flatMaterial(scene, "palm bark", "#ad9270"),
    leaf = flatMaterial(scene, "palm emerald", "#376e58"),
    leafLight = flatMaterial(scene, "palm jade", "#548e62");
  const roof = flatMaterial(scene, "roof gravel", "#a69d86"),
    white = flatMaterial(scene, "canvas awnings", "#f5e5c7");
  const signalNS = flatMaterial(scene, "north south signal", "#73e7b2"),
    signalEW = flatMaterial(scene, "east west signal", "#f17358");
  const oceanMat = flatMaterial(scene, "cobalt sea", "#248fba", 160);
  oceanMat.specularColor = new Color3(0.65, 0.85, 0.85);
  const ocean = MeshBuilder.CreateGround(
    "the endless cobalt bay",
    { width: 20000, height: 20000 },
    scene,
  );
  ocean.position.y = -3.8;
  ocean.material = oceanMat;
  ocean.isPickable = false;
  const terrain = MeshBuilder.CreateGround(
    "Port Meridian island",
    { width: 930, height: 930, subdivisions: 100, updatable: true },
    scene,
  );
  const pos = terrain.getVerticesData("position")!;
  for (let i = 0; i < pos.length; i += 3)
    pos[i + 1] = heightAt(pos[i], pos[i + 2]) - 0.05;
  terrain.updateVerticesData("position", pos);
  terrain.createNormals(true);
  terrain.material = sand;
  terrain.receiveShadows = true;
  terrain.isPickable = false;
  // Waterfront apron, retaining walls, and distant coastal headlands.
  batch.box(paving, 0, -1.9, -456, 928, 3.5, 8);
  batch.box(cream, 0, 0.45, -454, 928, 0.7, 1.6);
  batch.box(paving, 460, -1.9, 0, 9, 3.5, 918);
  batch.box(cream, 459, 0.45, 0, 1.5, 0.7, 918);
  for (let x = -440; x <= 440; x += 40)
    for (const z of [-449, 449]) {
      const y = heightAt(x, z);
      batch.box(paving, x, y + 0.7, z, 40, 1.4, 2);
      batch.box(teal, x, y + 2.35, z, 40, 0.22, 0.16);
      for (const dx of [-20, -10, 0, 10, 20])
        batch.box(teal, x + dx, y + 1.8, z, 0.12, 1.5, 0.12);
    }
  for (let z = -440; z <= 440; z += 40)
    for (const x of [-449, 449]) {
      const y = heightAt(x, z);
      batch.box(paving, x, y + 0.7, z, 2, 1.4, 40);
      batch.box(teal, x, y + 2.35, z, 0.16, 0.22, 40);
      for (const dz of [-20, -10, 0, 10, 20])
        batch.box(teal, x, y + 1.8, z + dz, 0.12, 1.5, 0.12);
    }
  for (let i = 0; i < 12; i++) {
    const x = -2200 + i * 380;
    batch.crown(
      grass,
      x,
      -22 + Math.sin(i * 3) * 15,
      1100 + Math.sin(i) * 190,
      750,
      220 + Math.cos(i) * 100,
      490,
    );
  }
  for (const road of ROADS) {
    ribbon(
      scene,
      road.name + " sidewalks",
      road.points,
      road.width + 10,
      paving,
      0.025,
    );
    ribbon(
      scene,
      road.name,
      road.points,
      road.width,
      road.surface === "cobble" ? cobble : asphalt,
      0.085,
    );
    for (let i = 1; i < road.points.length; i++) {
      const p = road.points[i],
        a = road.points[i - 1],
        dx = p.x - a.x,
        dz = p.z - a.z,
        len = Math.hypot(dx, dz),
        angle = Math.atan2(dx, dz),
        x = (p.x + a.x) / 2,
        z = (p.z + a.z) / 2;
      // Broken lane lines and a thin central separator retain fast readability.
      for (const side of [-1, 1]) {
        const ox = Math.cos(angle) * side * road.width * 0.245,
          oz = -Math.sin(angle) * side * road.width * 0.245;
        batch.box(
          line,
          x + ox,
          heightAt(x + ox, z + oz) + 0.103,
          z + oz,
          0.17,
          0.025,
          Math.min(5, len * 0.38),
          angle,
        );
      }
      batch.box(
        yellow,
        x,
        heightAt(x, z) + 0.108,
        z,
        0.17,
        0.027,
        len * 0.8,
        angle,
      );
      if (i % 2 === 0) {
        for (const side of [-1, 1]) {
          const ox = Math.cos(angle) * side * (road.width / 2 + 3.2),
            oz = -Math.sin(angle) * side * (road.width / 2 + 3.2);
          const tx = x + ox,
            tz = z + oz;
          if (
            ROADS.some(
              (r) =>
                r.id !== road.id &&
                r.points.some(
                  (p) => Math.hypot(p.x - tx, p.z - tz) < r.width * 0.62,
                ),
            )
          )
            continue;
          palm(tx, tz, 7 + (i % 3));
          lamp(
            tx + Math.cos(angle) * side * 1.6,
            tz - Math.sin(angle) * side * 1.6,
            angle + (side * Math.PI) / 2,
          );
          batch.box(cream, tx, heightAt(tx, tz) + 0.27, tz, 2.1, 0.55, 2.1);
          batch.box(grass, tx, heightAt(tx, tz) + 0.56, tz, 1.8, 0.06, 1.8);
          // Curb furniture and cafe benches make the promenade feel occupied at driving speed.
          const bx = tx + Math.sin(angle) * 4,
            bz = tz + Math.cos(angle) * 4;
          batch.box(
            wood,
            bx,
            heightAt(bx, bz) + 0.55,
            bz,
            0.65,
            0.15,
            2.1,
            angle,
          );
          batch.box(
            teal,
            bx,
            heightAt(bx, bz) + 0.3,
            bz,
            0.55,
            0.6,
            0.15,
            angle,
          );
        }
      }
    }
  }
  // Four crossing approaches at each grid junction.
  for (const x of [-360, -180, 0, 180, 360])
    for (const z of [-360, -180, 0, 180, 360])
      for (const axis of [0, 1])
        for (const s of [-1, 1])
          for (let k = -5; k <= 5; k++) {
            const px = x + (axis === 0 ? k * 1.8 : s * 19),
              pz = z + (axis === 0 ? s * 19 : k * 1.8);
            batch.box(
              line,
              px,
              heightAt(px, pz) + 0.13,
              pz,
              axis === 0 ? 0.8 : 3.8,
              0.028,
              axis === 0 ? 3.8 : 0.8,
            );
          }
  for (const x of [-360, -180, 0, 180, 360])
    for (const z of [-360, -180, 0, 180, 360])
      for (const axis of [0, 1])
        for (const s of [-1, 1]) {
          const px = x + (axis === 0 ? s * 18 : s * 14),
            pz = z + (axis === 0 ? s * 14 : -s * 18),
            y = heightAt(px, pz);
          batch.cylinder(teal, px, y + 2.6, pz, 0.17, 5.2);
          batch.box(
            shadow,
            px,
            y + 5,
            pz,
            axis === 0 ? 0.58 : 0.45,
            1.1,
            axis === 0 ? 0.45 : 0.58,
          );
          batch.box(
            axis === 0 ? signalNS : signalEW,
            px + (axis === 0 ? 0 : s * 0.24),
            y + 5,
            pz + (axis === 0 ? s * 0.24 : 0),
            axis === 0 ? 0.35 : 0.04,
            0.4,
            axis === 0 ? 0.04 : 0.35,
          );
        }
  for (const cut of SHORTCUTS) {
    const points = Array.from({ length: 24 }, (_, i) => {
      const t = i / 23,
        x = cut.entry.x + (cut.exit.x - cut.entry.x) * t,
        z = cut.entry.z + (cut.exit.z - cut.entry.z) * t;
      return { x, z, y: heightAt(x, z) };
    });
    ribbon(
      scene,
      cut.name,
      points,
      cut.width,
      cut.kind === "park"
        ? grass
        : cut.kind === "beach"
          ? paving
          : cut.kind === "tram"
            ? cobble
            : roof,
      0.07,
    );
    if (cut.kind === "tram") {
      const dx = cut.exit.x - cut.entry.x,
        dz = cut.exit.z - cut.entry.z,
        len = Math.hypot(dx, dz);
      for (const side of [-1, 1])
        ribbon(
          scene,
          "tram rails",
          points.map((p) => ({
            ...p,
            x: p.x + ((side * dz) / len) * 0.8,
            z: p.z - ((side * dx) / len) * 0.8,
          })),
          0.12,
          shadow,
          0.11,
        );
    }
    const angle = Math.atan2(
      cut.exit.x - cut.entry.x,
      cut.exit.z - cut.entry.z,
    );
    for (const p of [cut.entry, cut.exit]) {
      for (const s of [-1, 1])
        batch.box(
          teal,
          p.x + Math.cos(angle) * s * cut.width * 0.5,
          heightAt(p.x, p.z) + 2.5,
          p.z - Math.sin(angle) * s * cut.width * 0.5,
          0.4,
          5,
          0.4,
        );
    }
  }
  for (const ramp of RAMPS) {
    const positions = [
        -ramp.width / 2,
        0,
        -ramp.length / 2,
        ramp.width / 2,
        0,
        -ramp.length / 2,
        -ramp.width / 2,
        ramp.height,
        ramp.length / 2,
        ramp.width / 2,
        ramp.height,
        ramp.length / 2,
        -ramp.width / 2,
        0,
        ramp.length / 2,
        ramp.width / 2,
        0,
        ramp.length / 2,
      ],
      indices = [0, 2, 1, 1, 2, 3, 0, 4, 2, 1, 3, 5, 2, 4, 3, 3, 4, 5],
      normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    const v = new VertexData();
    Object.assign(v, { positions, indices, normals });
    const mesh = new Mesh("striped service ramp", scene);
    v.applyToMesh(mesh);
    mesh.position.set(ramp.x, heightAt(ramp.x, ramp.z) + 0.14, ramp.z);
    mesh.rotation.y = ramp.heading;
    mesh.material = teal;
    mesh.receiveShadows = true;
    casters.push(mesh);
    for (let i = -4; i <= 4; i += 2) {
      const lx = i,
        lz = 0;
      batch.box(
        yellow,
        ramp.x + Math.cos(ramp.heading) * lx,
        heightAt(ramp.x, ramp.z) + ramp.height / 2 + 0.18,
        ramp.z - Math.sin(ramp.heading) * lx,
        0.65,
        0.09,
        5,
        ramp.heading,
      );
    }
  }
  const facades = new Map<string, StandardMaterial>();
  const architecture = [
    ...BUILDINGS,
    ...LANDMARKS.filter((l) => l.solid).map((l) => ({
      id: 500 + l.destinationId,
      x: l.x,
      z: l.z,
      width: l.width,
      depth: l.depth,
      height: l.height,
      style:
        DESTINATIONS[l.destinationId].landmark === "tower" ? "tower" : "stucco",
      color: DESTINATIONS[l.destinationId].color,
    })),
  ];
  for (const b of architecture) {
    let wall = facades.get(b.color);
    if (!wall) {
      wall = flatMaterial(scene, "stucco " + b.color, b.color);
      facades.set(b.color, wall);
    }
    const base = heightAt(b.x, b.z),
      w = b.width,
      d = b.depth,
      h = b.height,
      tower = b.style === "tower" || b.style === "glass";
    batch.box(wall, b.x, base + h / 2 - 2, b.z, w, h + 4, d);
    batch.box(roof, b.x, base + h + 0.16, b.z, w - 0.4, 0.3, d - 0.4);
    batch.box(cream, b.x, base + h - 0.3, b.z, w + 0.6, 0.7, d + 0.6);
    batch.box(cream, b.x, base + 3.5, b.z, w + 0.3, 0.45, d + 0.3);
    // Architectural windows on all four sides; dark inset, bright lintel, occasional shutters.
    const floors = Math.min(17, Math.floor((h - 4) / 3.5));
    for (let face = 0; face < 4; face++) {
      const horizontal = face % 2 === 0,
        sign = face < 2 ? 1 : -1,
        span = horizontal ? w : d,
        n = Math.max(2, Math.floor(span / 4.8));
      for (let floor = 0; floor < floors; floor++)
        for (let col = 0; col < n; col++) {
          const offset = ((col - (n - 1) / 2) * span) / n,
            px = b.x + (horizontal ? offset : sign * (w / 2 + 0.035)),
            pz = b.z + (horizontal ? sign * (d / 2 + 0.035) : offset),
            py = base + 5.7 + floor * 3.5;
          const mw = (span / n) * (tower ? 0.79 : 0.5),
            mh = tower ? 2.35 : 1.8;
          batch.box(
            (col + floor + b.id) % 5 === 0 ? glass : shadow,
            px,
            py,
            pz,
            horizontal ? mw : 0.08,
            mh,
            horizontal ? 0.08 : mw,
          );
          if (!tower) {
            batch.box(
              cream,
              px,
              py - mh / 2 - 0.07,
              pz,
              horizontal ? mw + 0.35 : 0.25,
              0.16,
              horizontal ? 0.25 : mw + 0.35,
            );
            if (b.id % 3 === 0 && floor % 2 === 0) {
              batch.box(
                coral,
                px + (horizontal ? mw * 0.7 : 0),
                py,
                pz + (horizontal ? 0 : mw * 0.7),
                horizontal ? 0.35 : 0.13,
                mh,
                horizontal ? 0.13 : 0.35,
              );
            }
          }
        }
      const px = b.x + (horizontal ? 0 : sign * (w / 2 + 0.06)),
        pz = b.z + (horizontal ? sign * (d / 2 + 0.06) : 0);
      batch.box(
        shadow,
        px,
        base + 1.65,
        pz,
        horizontal ? w * 0.72 : 0.12,
        2.8,
        horizontal ? 0.12 : d * 0.72,
      );
      if (!tower) {
        const awning = b.id % 3 === 0 ? coral : b.id % 3 === 1 ? teal : white;
        batch.box(
          awning,
          px,
          base + 3.1,
          pz,
          horizontal ? w * 0.82 : 2.2,
          0.2,
          horizontal ? 2.2 : d * 0.82,
        );
        // Slim balcony boxes create a readable silhouette without noisy tiny geometry.
        if (b.id % 4 === 0 && h > 18)
          batch.box(
            cream,
            px,
            base + 10.9,
            pz,
            horizontal ? w * 0.72 : 2.1,
            0.22,
            horizontal ? 2.1 : d * 0.72,
          );
      }
    }
    if (b.id % 3 === 0) {
      batch.box(cream, b.x + 3, base + h + 1, b.z - 3, w * 0.24, 2, d * 0.25);
      batch.cylinder(teal, b.x - 5, base + h + 1.2, b.z + 4, 2.2, 2.4);
    }
    if (b.id % 4 === 0)
      batch.box(coral, b.x, base + h + 1.4, b.z, w * 0.8, 2.4, 0.8);
  }
  for (const destination of DESTINATIONS) {
    const landmark = LANDMARKS.find((l) => l.destinationId === destination.id)!,
      side = landmark.x > destination.x ? 1 : -1,
      x = landmark.x - side * (landmark.width / 2 + 1.8),
      z = landmark.z,
      base = heightAt(x, z);
    const sign = textSign(
      scene,
      destination.name,
      destination.landmark === "cafe" ? "#b25443" : "#20676a",
      16,
      2.6,
    );
    sign.position.set(x, base + 5.3, z);
    sign.rotation.y = (side * Math.PI) / 2;
    signs.push(sign);
    batch.box(teal, x, base + 3, z - 7.4, 0.35, 6, 0.35);
    batch.box(teal, x, base + 3, z + 7.4, 0.35, 6, 0.35);
    batch.box(paving, x, base + 0.07, z, 20, 0.18, 28);
    for (const zz of [-11, 11]) palm(x + side * 6, z + zz, 8);
    if (destination.landmark === "park") {
      batch.box(grass, x + side * 8, base + 0.12, z, 24, 0.14, 23);
      for (let i = 0; i < 5; i++) {
        const tx = x + side * (7 + (i % 2) * 7),
          tz = z + (i - 2) * 5;
        batch.cylinder(trunk, tx, base + 2, tz, 0.5, 4);
        batch.crown(leafLight, tx, base + 5, tz, 6, 6, 6);
      }
    }
    if (destination.landmark === "ferry" && landmark.solid) {
      batch.box(coral, x + side * 12, base + 2.5, z, 7, 5, 19);
      for (let i = -2; i <= 2; i++)
        batch.box(cream, x + side * 8.45, base + 3, z + i * 3, 0.12, 1.7, 2);
    }
    if (destination.landmark === "cafe" || destination.landmark === "market") {
      for (let i = -1; i <= 1; i++) {
        batch.cylinder(wood, x + side * 3, base + 1, z + i * 6, 1.4, 2);
        batch.cylinder(white, x + side * 3, base + 2.65, z + i * 6, 4, 0.16);
      }
    }
  }
  // Quiet harbor life: mooring pontoons, small ferries, and boardwalk sun shades.
  for (let i = 0; i < 9; i++) {
    const x = -390 + i * 90;
    batch.box(wood, x, -0.15, -474, 9, 1, 38);
    batch.box(cream, x + 13, -1.2, -483, 7, 2.5, 16);
    batch.box(teal, x + 13, 0.5, -483, 5, 1.8, 8);
    batch.box(coral, x + 13, 1.5, -484, 5.3, 0.4, 8.5);
  }
  casters.push(...batch.finish());
  return { casters, ocean, signs, signals: [signalNS, signalEW] };

  function palm(x: number, z: number, height: number): void {
    const y = heightAt(x, z);
    batch.cylinder(trunk, x, y + height / 2, z, 0.48, height);
    for (let i = 0; i < 9; i++) {
      const angle = (i * Math.PI * 2) / 9 + (x + z) * 0.07;
      batch.frond(i % 2 ? leaf : leafLight, x, y + height, z, angle);
    }
    batch.crown(leaf, x, y + height + 0.2, z, 0.9, 1.4, 0.9);
  }
  function lamp(x: number, z: number, angle: number): void {
    const y = heightAt(x, z);
    batch.cylinder(teal, x, y + 3.5, z, 0.16, 7);
    const dx = Math.sin(angle),
      dz = Math.cos(angle);
    batch.box(
      teal,
      x + dx * 0.65,
      y + 6.9,
      z + dz * 0.65,
      0.12,
      0.14,
      1.5,
      angle,
    );
    batch.box(
      cream,
      x + dx * 1.1,
      y + 6.82,
      z + dz * 1.1,
      0.45,
      0.2,
      0.8,
      angle,
    );
  }
}
