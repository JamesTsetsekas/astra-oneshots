import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import {
  BUILDINGS,
  heightAt,
  LANDMARKS,
  OBSTACLES,
  TRAVERSALS,
} from "../game/world";
import { Maker, Palette, StaticBatch } from "./models";
export class Island {
  private rotors: TransformNode[] = [];
  private water: Mesh;
  constructor(
    public scene: Scene,
    public palette: Palette,
  ) {
    this.terrain();
    const b = new StaticBatch(scene, palette);
    for (const o of OBSTACLES) {
      if (o.kind === "building") continue;
      if (o.kind === "rock") {
        const mesh = b.sphere(
          "weathered limestone",
          [o.width, o.height, o.depth],
          [o.x, o.y + o.height * 0.44, o.z],
          "#aeb9a0",
        );
        mesh.rotation.y = o.x;
      } else {
        b.box(
          "garden wall",
          [o.width, o.height, o.depth],
          [o.x, o.y + o.height / 2, o.z],
          "#c5c4a4",
        );
        b.box(
          "wall coping",
          [o.width + 0.2, 0.18, o.depth + 0.2],
          [o.x, o.y + o.height, o.z],
          "#e4dfbd",
        );
      }
    }
    for (const building of BUILDINGS) {
      const { x, z, width: w, depth: d, height: h, color, roof } = building,
        y = heightAt(x, z);
      const slab = (
        ww: number,
        hh: number,
        dd: number,
        xx: number,
        yy: number,
        zz: number,
        c = color,
      ) => b.box("limestone architecture", [ww, hh, dd], [xx, yy, zz], c);
      slab(w + 0.7, 0.28, d + 0.7, x, y + 0.06, z, "#cccaac");
      slab(0.55, h, d, x - w / 2, y + h / 2, z);
      slab(0.55, h, d, x + w / 2, y + h / 2, z);
      slab(w, h, 0.55, x, y + h / 2, z - d / 2);
      for (const side of [-1, 1])
        slab(w / 2 - 2, h, 0.55, x + side * (w / 4 + 1), y + h / 2, z + d / 2);
      slab(4, h - 3, 0.55, x, y + (h + 3) / 2, z + d / 2);
      slab(w + 0.8, 0.4, d + 0.8, x, y + h + 0.2, z, roof);
      slab(w + 0.9, 0.14, d + 0.9, x, y + h - 0.12, z, "#ede4c5");
      for (const side of [-1, 1]) {
        slab(
          0.5,
          h + 0.3,
          0.65,
          x + (side * w) / 2,
          y + h / 2,
          z + d / 2,
          "#d0c6a7",
        );
        for (const dz of [-d * 0.26, d * 0.2]) {
          slab(
            0.09,
            1.45,
            1.5,
            x + side * (w / 2 + 0.3),
            y + 2.4,
            z + dz,
            "#365456",
          );
          slab(
            0.14,
            0.12,
            1.8,
            x + side * (w / 2 + 0.35),
            y + 1.65,
            z + dz,
            "#ebe1be",
          );
          slab(
            0.15,
            1.5,
            0.09,
            x + side * (w / 2 + 0.36),
            y + 2.4,
            z + dz,
            "#c69d62",
          );
        }
        slab(
          1.5,
          1.5,
          0.07,
          x + side * (w * 0.29),
          y + 2.5,
          z + d / 2 + 0.3,
          "#355453",
        );
        slab(
          1.75,
          0.12,
          0.15,
          x + side * (w * 0.29),
          y + 1.7,
          z + d / 2 + 0.35,
          "#e9dfbd",
        );
        slab(
          0.07,
          1.55,
          0.15,
          x + side * (w * 0.29),
          y + 2.5,
          z + d / 2 + 0.35,
          "#b69762",
        );
      }
      slab(
        4.2,
        0.2,
        2.9,
        x,
        y + 3.25,
        z + d / 2 + 1.15,
        building.id % 2 ? "#539c99" : "#d28b68",
      );
      slab(0.13, 3.1, 0.13, x - 2, y + 1.55, z + d / 2 + 2.3, "#a38258");
      slab(0.13, 3.1, 0.13, x + 2, y + 1.55, z + d / 2 + 2.3, "#a38258");
      slab(4, 0.1, 0.22, x, y + 0.2, z + d / 2 + 2.5, "#b7ae8d");
      slab(0.2, 3, 1.2, x - w * 0.35, y + 1.5, z + d / 2 + 1, "#506f68");
      slab(0.2, 3, 1.2, x + w * 0.35, y + 1.5, z + d / 2 + 1, "#506f68");
      if (building.style === "tower") {
        slab(w * 0.45, 2.8, d * 0.45, x, y + h + 1.7, z, color);
        slab(w * 0.5, 0.22, d * 0.5, x, y + h + 3.2, z, roof);
        slab(1.2, 1.4, 0.1, x, y + h + 1.8, z + d * 0.23, "#456663");
      } else {
        slab(1.3, 1.6, 1.3, x + w * 0.29, y + h + 1, z - d * 0.3, "#d4caad");
        slab(1.6, 0.2, 1.6, x + w * 0.29, y + h + 1.8, z - d * 0.3, "#b59370");
      }
      if (building.style === "warehouse")
        for (let i = 0; i < 3; i++)
          slab(
            1.7,
            1.3,
            1.7,
            x - w * 0.32 + i * 2,
            y + 0.7,
            z - d * 0.32,
            "#b08b5d",
          );
      else {
        slab(1.8, 0.65, 1.2, x - w * 0.28, y + 0.35, z, "#99785b");
        slab(1.9, 0.1, 1.3, x - w * 0.28, y + 0.72, z, "#b8a581");
      }
      for (const side of [-1, 1]) {
        b.cylinder(
          "terracotta planter",
          0.95,
          1,
          [x + side * (w / 2 + 1.2), y + 0.5, z + d / 2],
          "#a97858",
        );
        b.sphere(
          "planter bush",
          [1.6, 1.3, 1.4],
          [x + side * (w / 2 + 1.2), y + 1.3, z + d / 2],
          "#598b66",
        );
      }
    }
    // Orchards and wild groves use merged low-poly canopies, not billboard trees.
    for (let i = 0; i < 290; i++) {
      const a = i * 2.39996,
        r = 65 + ((i * 127) % 455),
        x = Math.cos(a) * r,
        z = Math.sin(a) * r;
      if (
        heightAt(x, z) < 2 ||
        BUILDINGS.some(
          (o) =>
            Math.abs(x - o.x) < o.width / 2 + 5 &&
            Math.abs(z - o.z) < o.depth / 2 + 5,
        )
      )
        continue;
      this.tree(b, x, z, 3.2 + (i % 4), i);
    }
    for (let row = 0; row < 5; row++)
      for (let col = 0; col < 8; col++)
        this.tree(b, 205 + col * 9, 285 + row * 8, 3.5, row + col);
    for (const l of LANDMARKS) {
      this.windmill(b, l.x + 52, l.z + 52, l.id === "abbey" ? 19 : 13);
      const y = heightAt(l.x, l.z + 55);
      b.cylinder(
        "wayfinding post",
        0.24,
        3.5,
        [l.x, y + 1.75, l.z + 55],
        "#9a7a51",
      );
      b.box(
        "regional banner",
        [2.3, 1.1, 0.1],
        [l.x, y + 3, l.z + 55],
        l.color,
      );
      for (let i = 0; i < 4; i++) {
        const x = l.x + 14 + i * 4,
          z = l.z + 51;
        b.box(
          "merchant crate",
          [1.7, 0.9, 1.4],
          [x, heightAt(x, z) + 0.45, z],
          i % 2 ? "#a37b52" : "#c29b68",
        );
        b.sphere(
          "harvest",
          [1.8, 0.35, 1.4],
          [x, heightAt(x, z) + 1, z],
          "#d9b969",
        );
      }
    }
    for (const t of TRAVERSALS) {
      if (t.kind === "vent") {
        for (let i = 0; i < 4; i++) {
          const ring = MeshBuilder.CreateTorus(
            "wind ring",
            { diameter: 4, thickness: 0.08, tessellation: 24 },
            scene,
          );
          ring.position.set(t.x, t.y - 8 + i * 2, t.z);
          ring.material = palette.get("#b6e6d0", 0.35, 0.6);
        }
      } else {
        for (const p of [t, t.end]) {
          b.cylinder("cable mast", 0.28, 10, [p.x, p.y - 5, p.z], "#a18158");
          b.box("cable bracket", [1.8, 0.25, 0.25], [p.x, p.y, p.z], "#d0aa6d");
        }
        const cable = MeshBuilder.CreateLines(
          "transit cable",
          {
            points: [
              new Vector3(t.x, t.y, t.z),
              new Vector3(t.end.x, t.end.y, t.end.z),
            ],
          },
          scene,
        );
        cable.color = Color3.FromHexString("#76654b");
      }
    }
    this.windmill(b, -245, 90, 24);
    for (let i = 0; i < 600; i++) {
      const angle = i * 2.399963,
        r = 8 + ((i * 7.33) % 130),
        x = -245 + Math.cos(angle) * r,
        z = 155 + Math.sin(angle) * r;
      if (
        BUILDINGS.some(
          (o) =>
            Math.abs(x - o.x) < o.width / 2 + 2 &&
            Math.abs(z - o.z) < o.depth / 2 + 2,
        )
      )
        continue;
      const y = heightAt(x, z);
      for (let blade = 0; blade < 3; blade++) {
        const grass = b.cylinder(
          "meadow grasses",
          0.09,
          0.23 + (i % 3) * 0.09,
          [x + blade * 0.11, y + 0.13, z + blade * 0.07],
          i % 4 ? "#69885a" : "#a4a76b",
          undefined,
          3,
          0,
        );
        grass.rotation.z = (blade - 1) * 0.3;
      }
      if (i % 8 === 0)
        b.sphere(
          "meadow flower",
          [0.14, 0.09, 0.14],
          [x, y + 0.4, z],
          "#dfb778",
        );
    }
    b.finish();
    this.water = MeshBuilder.CreateGround(
      "voidsea",
      { width: 4000, height: 4000, subdivisions: 1 },
      scene,
    );
    this.water.position.y = -0.8;
    this.water.material = palette.get("#398e99", 0.05);
    const clouds = new StaticBatch(scene, palette);
    for (let i = 0; i < 45; i++) {
      const x = Math.sin(i * 4.4) * 850,
        z = Math.cos(i * 6.3) * 850;
      for (let j = 0; j < 3; j++)
        clouds.sphere(
          "cloud",
          [55 + j * 18, 12 + j * 4, 35],
          [x + j * 28, 160 + (i % 4) * 20, z],
          "#d9e7d4",
        );
    }
    clouds.finish();
    const sky = MeshBuilder.CreateSphere(
      "atmosphere",
      { diameter: 2800, segments: 16, sideOrientation: Mesh.BACKSIDE },
      scene,
    );
    sky.infiniteDistance = true;
    sky.isPickable = false;
    sky.applyFog = false;
    const atmosphere = new ShaderMaterial(
      "daylight atmosphere",
      scene,
      {
        vertexSource:
          "precision highp float;attribute vec3 position;uniform mat4 worldViewProjection;varying vec3 direction;void main(){direction=position;gl_Position=worldViewProjection*vec4(position,1.0);}",
        fragmentSource:
          "precision highp float;varying vec3 direction;void main(){vec3 d=normalize(direction);float h=smoothstep(-0.07,0.65,d.y);vec3 c=mix(vec3(0.78,0.85,0.78),vec3(0.34,0.66,0.76),h);float sun=pow(max(dot(d,normalize(vec3(0.5,0.8,-0.5))),0.0),180.0);c+=vec3(0.25,0.21,0.12)*sun;gl_FragColor=vec4(c,1.0);}",
      },
      { attributes: ["position"], uniforms: ["worldViewProjection"] },
    );
    atmosphere.backFaceCulling = false;
    atmosphere.disableDepthWrite = true;
    sky.material = atmosphere;
  }
  private tree(
    b: StaticBatch,
    x: number,
    z: number,
    height: number,
    i: number,
  ) {
    const y = heightAt(x, z);
    b.cylinder(
      "tree trunk",
      0.55,
      height,
      [x, y + height / 2, z],
      "#897454",
      undefined,
      6,
      0.32,
    );
    const color = ["#4a7d5b", "#5c8c5c", "#739a60", "#588566"][i % 4];
    b.sphere(
      "olive canopy",
      [height * 1.25, height * 0.95, height * 1.2],
      [x, y + height, z],
      color,
    );
    b.sphere(
      "olive crown",
      [height * 0.9, height * 0.85, height * 0.8],
      [x + height * 0.23, y + height * 1.32, z - 0.4],
      color,
    );
  }
  private windmill(b: StaticBatch, x: number, z: number, height: number) {
    const y = heightAt(x, z);
    b.cylinder(
      "mill tower",
      3.5,
      height,
      [x, y + height / 2, z],
      "#d2c8a8",
      undefined,
      10,
      2,
    );
    b.cylinder(
      "mill cap",
      3,
      2,
      [x, y + height + 0.5, z],
      "#a67652",
      undefined,
      10,
      0.3,
    );
    const root = new TransformNode("copper wind rotor", this.scene);
    root.position.set(x, y + height - 1, z + 1.8);
    const m = new Maker(this.scene, this.palette);
    for (let i = 0; i < 4; i++) {
      const arm = new TransformNode("sail arm", this.scene);
      arm.parent = root;
      arm.rotation.z = (i * Math.PI) / 2;
      m.box(
        "rotor beam",
        [0.18, height * 0.56, 0.17],
        [0, height * 0.26, 0],
        "#9c7548",
        arm,
      );
      m.box(
        "linen turbine sail",
        [1.25, height * 0.29, 0.08],
        [0.46, height * 0.34, 0.1],
        "#e7d4ac",
        arm,
      );
    }
    m.cylinder(
      "rotor hub",
      0.6,
      0.45,
      [0, 0, 0.1],
      "#a27b4a",
      root,
    ).rotation.x = Math.PI / 2;
    this.rotors.push(root);
  }
  private terrain() {
    const grid = 180,
      positions: number[] = [],
      colors: number[] = [],
      indices: number[] = [],
      normals: number[] = [];
    const green = Color3.FromHexString("#83a26a"),
      sand = Color3.FromHexString("#c9bf92"),
      deep = Color3.FromHexString("#719999"),
      path = Color3.FromHexString("#c3b58d");
    for (let z = 0; z <= grid; z++)
      for (let x = 0; x <= grid; x++) {
        const wx = -600 + (x / grid) * 1200,
          wz = -600 + (z / grid) * 1200,
          h = heightAt(wx, wz);
        positions.push(wx, h, wz);
        const variation = Math.sin(wx * 0.08) * Math.sin(wz * 0.07) * 0.035;
        let c = Color3.Lerp(sand, green, Math.max(0, Math.min(1, (h - 1) / 9)));
        if (h < 0) c = deep;
        const poi = LANDMARKS.find(
          (p) => Math.hypot(wx - p.x, wz - p.z) < p.radius,
        );
        if (
          poi &&
          (Math.abs((wx - poi.x + 48) % 24) < 5 ||
            Math.abs((wz - poi.z + 28) % 28) < 5)
        )
          c = Color3.Lerp(c, path, 0.75);
        colors.push(c.r + variation, c.g + variation, c.b + variation, 1);
        // Babylon uses clockwise front faces in its default left-handed world.
        if (x < grid && z < grid) {
          const a = z * (grid + 1) + x,
            b = a + 1,
            cidx = a + grid + 1,
            d = cidx + 1;
          indices.push(a, b, cidx, b, d, cidx);
        }
      }
    VertexData.ComputeNormals(positions, indices, normals);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.normals = normals;
    data.colors = colors;
    const mesh = new Mesh("the-highwake", this.scene);
    data.applyToMesh(mesh);
    const material = new StandardMaterial("terrain", this.scene);
    material.diffuseColor = Color3.White();
    material.specularColor = Color3.Black();
    material.backFaceCulling = false;
    mesh.material = material;
    mesh.receiveShadows = true;
    mesh.freezeWorldMatrix();
  }
  update(time: number) {
    for (const rotor of this.rotors) rotor.rotation.z = time * 0.35;
  }
}
