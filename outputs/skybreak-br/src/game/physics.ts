import RAPIER from "@dimforge/rapier3d-compat";
import { heightAt, OBSTACLES, WORLD_SIZE } from "./world";
import type { V3 } from "./types";
let initialized: Promise<void> | undefined;
export const initPhysics = () => (initialized ??= RAPIER.init());
export class PlayerPhysics {
  readonly world: RAPIER.World;
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  readonly controller: RAPIER.KinematicCharacterController;
  constructor(position: V3) {
    this.world = new RAPIER.World({ x: 0, y: -20, z: 0 });
    this.world.timestep = 1 / 30;
    const count = 120,
      heights = new Float32Array((count + 1) ** 2);
    for (let c = 0; c <= count; c++)
      for (let r = 0; r <= count; r++)
        heights[r + c * (count + 1)] = heightAt(-600 + c * 10, -600 + r * 10);
    this.world.createCollider(
      RAPIER.ColliderDesc.heightfield(count, count, heights, {
        x: WORLD_SIZE,
        y: 1,
        z: WORLD_SIZE,
      }),
    );
    for (const o of OBSTACLES)
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(
          o.width / 2,
          o.height / 2,
          o.depth / 2,
        ).setTranslation(o.x, o.y + o.height / 2, o.z),
      );
    this.body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        position.x,
        position.y + 0.9,
        position.z,
      ),
    );
    this.collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(0.55, 0.33),
      this.body,
    );
    this.controller = this.world.createCharacterController(0.035);
    this.controller.enableAutostep(0.85, 0.3, true);
    this.controller.enableSnapToGround(0.4);
    this.controller.setMaxSlopeClimbAngle(0.85);
    this.world.step();
  }
  move(delta: V3): { position: V3; grounded: boolean } {
    this.controller.computeColliderMovement(this.collider, delta);
    const p = this.body.translation(),
      m = this.controller.computedMovement();
    this.body.setNextKinematicTranslation({
      x: p.x + m.x,
      y: p.y + m.y,
      z: p.z + m.z,
    });
    this.world.step();
    const q = this.body.translation();
    return {
      position: { x: q.x, y: q.y - 0.9, z: q.z },
      grounded: this.controller.computedGrounded(),
    };
  }
  teleport(p: V3): void {
    this.body.setTranslation({ x: p.x, y: p.y + 0.9, z: p.z }, true);
    this.body.setNextKinematicTranslation({ x: p.x, y: p.y + 0.9, z: p.z });
    this.world.step();
  }
  dispose() {
    this.world.free();
  }
}
