import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { SKINS, WEAPONS, isWeapon } from "../game/content";
import type { Actor, ItemId } from "../game/types";
export class Palette {
  private colors = new Map<string, StandardMaterial>();
  constructor(private scene: Scene) {}
  get(hex: string, glow = 0, alpha = 1) {
    const key = hex + glow + alpha;
    let material = this.colors.get(key);
    if (!material) {
      material = new StandardMaterial(key, this.scene);
      material.diffuseColor = Color3.FromHexString(hex);
      material.specularColor = new Color3(0.07, 0.07, 0.07);
      material.emissiveColor = Color3.FromHexString(hex).scale(glow);
      material.alpha = alpha;
      material.backFaceCulling = false;
      this.colors.set(key, material);
    }
    return material;
  }
}
export class Maker {
  constructor(
    public scene: Scene,
    public palette: Palette,
  ) {}
  box(
    name: string,
    size: number[],
    p: number[],
    color: string,
    parent?: TransformNode,
    rotation?: number[],
  ) {
    const m = MeshBuilder.CreateBox(
      name,
      { width: size[0], height: size[1], depth: size[2] },
      this.scene,
    );
    m.position.set(p[0], p[1], p[2]);
    m.material = this.palette.get(color);
    m.parent = parent ?? null;
    if (rotation) m.rotation.set(rotation[0], rotation[1], rotation[2]);
    return m;
  }
  sphere(
    name: string,
    size: number[],
    p: number[],
    color: string,
    parent?: TransformNode,
  ) {
    const m = MeshBuilder.CreateSphere(
      name,
      { diameter: 1, segments: 5 },
      this.scene,
    );
    m.scaling.set(size[0], size[1], size[2]);
    m.position.set(...(p as [number, number, number]));
    m.material = this.palette.get(color);
    m.parent = parent ?? null;
    return m;
  }
  cylinder(
    name: string,
    diameter: number,
    height: number,
    p: number[],
    color: string,
    parent?: TransformNode,
    tessellation = 8,
    top = diameter,
  ) {
    const m = MeshBuilder.CreateCylinder(
      name,
      { diameterBottom: diameter, diameterTop: top, height, tessellation },
      this.scene,
    );
    m.position.set(...(p as [number, number, number]));
    m.material = this.palette.get(color);
    m.parent = parent ?? null;
    return m;
  }
}
export class StaticBatch extends Maker {
  parts: Mesh[] = [];
  override box(...args: Parameters<Maker["box"]>) {
    const m = super.box(...args);
    this.parts.push(m);
    return m;
  }
  override sphere(...args: Parameters<Maker["sphere"]>) {
    const m = super.sphere(...args);
    this.parts.push(m);
    return m;
  }
  override cylinder(...args: Parameters<Maker["cylinder"]>) {
    const m = super.cylinder(...args);
    this.parts.push(m);
    return m;
  }
  finish() {
    const groups = new Map<StandardMaterial, Mesh[]>();
    for (const m of this.parts) {
      m.computeWorldMatrix(true);
      const mat = m.material as StandardMaterial;
      const group = groups.get(mat) ?? [];
      group.push(m);
      groups.set(mat, group);
    }
    const result: Mesh[] = [];
    for (const [material, parts] of groups) {
      const merged = Mesh.MergeMeshes(
        parts,
        true,
        true,
        undefined,
        false,
        false,
      );
      if (merged) {
        merged.material = material;
        merged.name = "island-" + material.name;
        merged.freezeWorldMatrix();
        result.push(merged);
      }
    }
    this.parts = [];
    return result;
  }
}
export class WeaponModel {
  root: TransformNode;
  constructor(
    scene: Scene,
    palette: Palette,
    id: ItemId,
    parent?: TransformNode,
  ) {
    this.root = new TransformNode("equipment-" + id, scene);
    this.root.parent = parent ?? null;
    const m = new Maker(scene, palette),
      weapon = isWeapon(id);
    if (weapon) {
      const def = WEAPONS[id];
      m.box(
        "ceramic receiver",
        [0.19, 0.19, 0.5],
        [0, 0, 0.08],
        def.color,
        this.root,
      );
      m.box(
        "dark mechanism",
        [0.16, 0.11, 0.48],
        [0, 0.035, 0.13],
        "#253c40",
        this.root,
      );
      const barrel = m.cylinder(
        "copper barrel",
        id === "launcher" ? 0.17 : 0.07,
        id === "pistol" ? 0.2 : 0.6,
        [0, 0.035, 0.47],
        "#b47748",
        this.root,
      );
      barrel.rotation.x = Math.PI / 2;
      m.box(
        "stock",
        [0.15, 0.12, 0.24],
        [0, -0.02, -0.26],
        "#78533e",
        this.root,
      );
      m.box(
        "handle",
        [0.07, 0.2, 0.08],
        [0, -0.14, -0.07],
        "#273c40",
        this.root,
        [0.24, 0, 0],
      );
      m.box(
        "magazine",
        [0.1, 0.22, 0.14],
        [0, -0.14, 0.13],
        "#b17d4e",
        this.root,
        [0.1, 0, 0],
      );
      m.box("sight", [0.08, 0.08, 0.16], [0, 0.14, 0.08], "#253c40", this.root);
      if (id === "rail" || id === "dmr") {
        const scope = m.cylinder(
          "optic",
          0.1,
          0.25,
          [0, 0.18, 0.04],
          "#314448",
          this.root,
        );
        scope.rotation.x = Math.PI / 2;
      }
      m.box(
        "energy filament",
        [0.2, 0.025, 0.07],
        [0, 0.055, 0.19],
        "#97eecc",
        this.root,
      );
    } else {
      m.cylinder(
        "canister",
        0.3,
        0.42,
        [0, 0, 0],
        id === "med" || id === "trauma"
          ? "#e28f6e"
          : id === "shield" || id === "aegis"
            ? "#79b8db"
            : "#b7b37c",
        this.root,
      );
      m.cylinder("cap", 0.26, 0.07, [0, 0.245, 0], "#e7e7cb", this.root);
      m.box("label", [0.315, 0.11, 0.04], [0, 0, 0.145], "#f4f0d9", this.root);
    }
  }
  dispose() {
    this.root.dispose(false, false);
  }
}
export class Avatar {
  root: TransformNode;
  private torso: TransformNode;
  private leftLeg: TransformNode;
  private rightLeg: TransformNode;
  private leftArm: TransformNode;
  private rightArm: TransformNode;
  private sail: TransformNode;
  private weapon?: WeaponModel;
  private equipped = "";
  private shadow: Mesh;
  constructor(
    private scene: Scene,
    private palette: Palette,
    skin: number,
  ) {
    const colors = SKINS[skin % SKINS.length],
      m = new Maker(scene, palette);
    this.root = new TransformNode("scavenger", scene);
    this.torso = new TransformNode("torso", scene);
    this.torso.parent = this.root;
    this.torso.position.y = 0.92;
    m.box(
      "tailored expedition jacket",
      [0.63, 0.58, 0.36],
      [0, 0.37, 0],
      colors.coat,
      this.torso,
    );
    m.box(
      "shoulder yoke",
      [0.7, 0.16, 0.4],
      [0, 0.65, 0],
      colors.accent,
      this.torso,
    );
    m.box(
      "scarf",
      [0.25, 0.24, 0.055],
      [0.05, 0.57, 0.23],
      colors.accent,
      this.torso,
    );
    m.box(
      "scarf tail",
      [0.11, 0.38, 0.05],
      [0.28, 0.3, -0.24],
      colors.accent,
      this.torso,
      [0.1, 0, -0.1],
    );
    m.box("belt", [0.64, 0.08, 0.39], [0, 0.08, 0], "#574e39", this.torso);
    m.box(
      "buckle",
      [0.13, 0.09, 0.045],
      [0, 0.08, 0.22],
      "#c6a36b",
      this.torso,
    );
    m.box(
      "pouch",
      [0.17, 0.21, 0.16],
      [0.32, 0.04, 0.13],
      "#9b7755",
      this.torso,
    );
    m.box(
      "backpack",
      [0.42, 0.48, 0.24],
      [0, 0.4, -0.25],
      "#527878",
      this.torso,
    );
    m.cylinder(
      "turbine pack",
      0.26,
      0.2,
      [0, 0.46, -0.41],
      "#c39258",
      this.torso,
    ).rotation.x = Math.PI / 2;
    m.box(
      "pack straps",
      [0.45, 0.07, 0.3],
      [0, 0.27, -0.29],
      "#d0b57d",
      this.torso,
    );
    m.sphere(
      "face",
      [0.35, 0.39, 0.32],
      [0, 0.98, 0.035],
      "#bf8867",
      this.torso,
    );
    m.sphere(
      "dark hair",
      [0.38, 0.23, 0.35],
      [0, 1.1, 0],
      "#393e36",
      this.torso,
    );
    m.box(
      "goggle band",
      [0.38, 0.08, 0.27],
      [0, 1.02, 0.025],
      "#845f40",
      this.torso,
    );
    m.box(
      "goggle lenses",
      [0.3, 0.105, 0.08],
      [0, 1.03, 0.18],
      "#a3d9d6",
      this.torso,
    );
    m.box("neck", [0.17, 0.16, 0.18], [0, 0.78, 0], "#bf8867", this.torso);
    this.leftLeg = this.limb(
      m,
      "left leg",
      [-0.18, 0.91, 0],
      [0.21, 0.65, 0.23],
      colors.pants,
      [-0.03, -0.34, 0],
    );
    this.rightLeg = this.limb(
      m,
      "right leg",
      [0.18, 0.91, 0],
      [0.21, 0.65, 0.23],
      colors.pants,
      [0.03, -0.34, 0],
    );
    for (const leg of [this.leftLeg, this.rightLeg]) {
      m.box("knee guard", [0.22, 0.17, 0.08], [0, -0.38, 0.13], "#617c77", leg);
      m.box("boot", [0.24, 0.2, 0.39], [0, -0.8, 0.07], "#3d493e", leg);
      m.box("boot cuff", [0.245, 0.1, 0.25], [0, -0.66, 0], "#947551", leg);
    }
    this.leftArm = this.limb(
      m,
      "left arm",
      [-0.4, 1.51, 0.025],
      [0.19, 0.48, 0.2],
      colors.coat,
      [0, -0.22, 0],
    );
    this.rightArm = this.limb(
      m,
      "right arm",
      [0.4, 1.51, 0.025],
      [0.19, 0.48, 0.2],
      colors.coat,
      [0, -0.22, 0],
    );
    for (const arm of [this.leftArm, this.rightArm])
      m.box("glove", [0.18, 0.18, 0.18], [0, -0.5, 0.02], "#594d3c", arm);
    this.sail = new TransformNode("wing sail", scene);
    this.sail.parent = this.root;
    this.sail.position.y = 2.3;
    for (const side of [-1, 1]) {
      m.box(
        "fabric wing",
        [2.6, 0.065, 1.05],
        [side * 1.25, 0.1, 0],
        "#eee5c9",
        this.sail,
        [0, 0, side * 0.13],
      );
      m.box(
        "wing edge",
        [2.5, 0.08, 0.12],
        [side * 1.2, 0.12, -0.5],
        colors.accent,
        this.sail,
        [0, 0, side * 0.13],
      );
      const strut = m.cylinder(
        "strut",
        0.055,
        2,
        [side * 0.75, -0.75, 0],
        "#b88754",
        this.sail,
      );
      strut.rotation.z = side * 0.45;
    }
    this.sail.setEnabled(false);
    this.shadow = MeshBuilder.CreateDisc(
      "contact shadow",
      { radius: 0.58, tessellation: 20 },
      scene,
    );
    this.shadow.rotation.x = Math.PI / 2;
    this.shadow.material = palette.get("#263d39", 0, 0.23);
    this.shadow.isPickable = false;
  }
  private limb(
    m: Maker,
    name: string,
    p: number[],
    size: number[],
    color: string,
    offset: number[],
  ) {
    const n = new TransformNode(name, this.scene);
    n.parent = this.root;
    n.position.set(...(p as [number, number, number]));
    m.box(name, size, offset, color, n);
    return n;
  }
  update(a: Actor, time: number, isPlayer: boolean, ads: boolean) {
    this.root.setEnabled(a.alive);
    this.shadow.setEnabled(a.alive && a.grounded);
    if (!a.alive) return;
    this.root.position.set(a.x, a.y, a.z);
    this.root.rotation.y = a.yaw;
    const stride =
      Math.sin(time * (a.speed > 6 ? 13 : 9) + a.id) *
      Math.min(0.7, a.speed * 0.085);
    this.leftLeg.rotation.x = stride;
    this.rightLeg.rotation.x = -stride;
    this.leftArm.rotation.x = -stride * 0.5;
    this.rightArm.rotation.x = stride * 0.5;
    const crouched = a.stance === "crouch" || a.stance === "slide";
    this.torso.position.y = crouched ? 0.64 : 0.92;
    this.root.rotation.z = a.stance === "slide" ? 0.35 : 0;
    const id = a.inventory[a.slot]?.id ?? "";
    if (id !== this.equipped) {
      this.weapon?.dispose();
      this.weapon = undefined;
      if (id) {
        this.weapon = new WeaponModel(
          this.scene,
          this.palette,
          id as ItemId,
          this.root,
        );
        this.weapon.root.position.set(0.34, 1.16, 0.43);
      }
      this.equipped = id;
    }
    if (id) {
      this.rightArm.rotation.x = -1.15;
      this.leftArm.rotation.x = -0.8;
      this.leftArm.rotation.z = -0.4;
      if (this.weapon) this.weapon.root.rotation.x = a.pitch;
      this.torso.rotation.y = isPlayer && ads ? -0.05 : 0;
    }
    const gliding = a.stance === "glide";
    this.sail.setEnabled(gliding);
    if (gliding) {
      this.leftArm.rotation.x = -2.7;
      this.rightArm.rotation.x = -2.7;
      this.leftLeg.rotation.x = 0.22;
      this.rightLeg.rotation.x = 0.3;
    }
    this.shadow.position.set(a.x, a.y + 0.035, a.z);
  }
  dispose() {
    this.root.dispose(false, false);
    this.shadow.dispose();
  }
}
