import { describe, it, expect } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { Palette, WeaponModel, Avatar } from "./models";
import { Island } from "./island";
import "./game-view";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { WEAPONS } from "../game/content";
import type { WeaponId } from "../game/types";
describe("original 3D geometry", () => {
  it("registers the camera aiming ray used by the production runtime", () => {
    const engine=new NullEngine(),scene=new Scene(engine);
    try {
      const camera=new FreeCamera("camera registration test",new Vector3(0,2,0),scene);
      expect(camera.getForwardRay().direction.length()).toBeCloseTo(1);
    } finally { scene.dispose();engine.dispose(); }
  });
  it("constructs all weapons and every scavenger skin without invalid geometry", () => {
    const engine = new NullEngine(),
      scene = new Scene(engine),
      palette = new Palette(scene);
    try {
      for (const id of Object.keys(WEAPONS) as WeaponId[]) {
        const model = new WeaponModel(scene, palette, id);
        expect(model.root.getChildMeshes().length).toBeGreaterThan(4);
        model.dispose();
      }
      for (let i = 0; i < 4; i++) {
        const avatar = new Avatar(scene, palette, i);
        expect(avatar.root.getChildMeshes().length).toBeGreaterThan(20);
        avatar.dispose();
      }
    } finally {
      scene.dispose();
      engine.dispose();
    }
  });
  it("renders a complete terrain surface with upward normals and merged settlements", () => {
    const engine = new NullEngine(),
      scene = new Scene(engine);
    try {
      new Island(scene, new Palette(scene));
      const terrain = scene.getMeshByName("the-highwake")!;
      expect(terrain.getTotalVertices()).toBe(181 ** 2);
      expect(terrain.getTotalIndices()).toBe(180 ** 2 * 6);
      const normals = terrain.getVerticesData(VertexBuffer.NormalKind)!;
      expect(normals[1]).toBeGreaterThan(0.7);
      expect(
        scene.meshes.filter((m) => m.name.startsWith("island-")).length,
      ).toBeGreaterThan(10);
      expect(
        scene.meshes.every((m) =>
          Number.isFinite(m.getBoundingInfo().boundingBox.maximumWorld.x),
        ),
      ).toBe(true);
    } finally {
      scene.dispose();
      engine.dispose();
    }
  }, 10000);
});
