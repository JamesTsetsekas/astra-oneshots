import RAPIER from '@dimforge/rapier3d-compat';
import { getTrafficDimensions } from './content';
import type { InputFrame, TaxiDefinition, TrafficVehicle, VehicleState } from './types';
import { BUILDINGS, distanceToSegment, heightAt, LANDMARKS, RAMPS, roadAt, SHORTCUTS, WORLD_BOUNDS } from './world';

let initialized: Promise<void> | undefined;
export const initializePhysics = () => initialized ??= RAPIER.init();
export const FIXED_DT = 1 / 60;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export type VehicleFeedback = { impact: number; trafficId?: number; surge: boolean; gripTurn: boolean; landed: number; reset: boolean };

/** Bounded arcade tire model with four Rapier suspension probes and a swept rigid chassis. */
export class ArcadeVehicle {
  readonly world: RAPIER.World;
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  readonly definition: TaxiDefinition;
  readonly events = new RAPIER.EventQueue(true);
  private ground = new Set<number>();
  private trafficBodies = new Map<number, { body: RAPIER.RigidBody; collider: RAPIER.Collider }>();
  private trafficHandles = new Map<number, number>();
  private heading = 0;
  private steering = 0;
  private wheelSpin = 0;
  private driftTime = 0;
  private airTime = 0;
  private lastBrake = false;
  private brakeRelease = -10;
  private driftBrake = -10;
  private lastThrottle = false;
  private surgeUntil = -10;
  private time = 0;
  private pitch = 0;
  private roll = 0;
  damage = 0;
  private state: VehicleState;

  constructor(definition: TaxiDefinition, x = 0, z = -300, heading = 0) {
    this.definition = definition;
    this.world = new RAPIER.World({ x: 0, y: -22, z: 0 });
    this.world.timestep = FIXED_DT;
    this.world.numSolverIterations = 6;
    const rows = 100, cols = 140;
    const heights = new Float32Array((rows + 1) * (cols + 1));
    for (let c = 0; c <= cols; c++) for (let r = 0; r <= rows; r++) heights[r + c * (rows + 1)] = heightAt(-700 + c * 10, -500 + r * 10);
    this.ground.add(this.world.createCollider(RAPIER.ColliderDesc.heightfield(rows, cols, heights, { x: 1400, y: 1, z: 1000 }).setFriction(.05)).handle);
    for (const b of BUILDINGS) this.world.createCollider(RAPIER.ColliderDesc.cuboid(b.width / 2, (b.height + 6) / 2, b.depth / 2).setTranslation(b.x, heightAt(b.x, b.z) + (b.height - 6) / 2, b.z).setFriction(.18).setRestitution(.04));
    for (const b of LANDMARKS.filter(l => l.solid)) this.world.createCollider(RAPIER.ColliderDesc.cuboid(b.width / 2, (b.height + 6) / 2, b.depth / 2).setTranslation(b.x, heightAt(b.x, b.z) + (b.height - 6) / 2, b.z).setFriction(.12).setRestitution(.06));
    for (const ramp of RAMPS) {
      const w = ramp.width / 2, l = ramp.length / 2;
      const hull = RAPIER.ColliderDesc.convexHull(new Float32Array([-w, -1, -l, w, -1, -l, -w, -1, l, w, -1, l, -w, 0, -l, w, 0, -l, -w, ramp.height, l, w, ramp.height, l]));
      if (hull) this.ground.add(this.world.createCollider(hull.setTranslation(ramp.x, heightAt(ramp.x, ramp.z) + .05, ramp.z).setRotation({ x: 0, y: Math.sin(ramp.heading / 2), z: 0, w: Math.cos(ramp.heading / 2) }).setFriction(.08)).handle);
    }
    // Follow the visible 2.5m guards. Foundations reach the lower slope endpoint,
    // while the top stays at the rendered segment height; no invisible high walls.
    const boundary = (ax: number, az: number, bx: number, bz: number) => {
      const length = Math.hypot(bx - ax, bz - az), count = Math.ceil(length / 20), segment = length / count;
      for (let i = 0; i < count; i++) {
        const start = i / count, end = (i + 1) / count, middle = (start + end) / 2;
        const x = ax + (bx - ax) * middle, z = az + (bz - az) * middle;
        const bottom = Math.min(heightAt(ax + (bx - ax) * start, az + (bz - az) * start), heightAt(ax + (bx - ax) * end, az + (bz - az) * end)) - .3;
        const top = heightAt(x, z) + 2.5;
        this.world.createCollider(RAPIER.ColliderDesc.cuboid(ax === bx ? .4 : segment / 2 + .02, (top - bottom) / 2, az === bz ? .4 : segment / 2 + .02).setTranslation(x, (top + bottom) / 2, z).setFriction(.16).setRestitution(.05));
      }
    };
    boundary(-699, -499, -699, 499); boundary(699, -499, 699, 499);
    boundary(-699, -499, 699, -499); boundary(-699, 499, 699, 499);
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, heightAt(x, z) + .88, z).setCanSleep(false).setCcdEnabled(true).setLinearDamping(.02).setAngularDamping(8).lockRotations();
    this.body = this.world.createRigidBody(bodyDesc);
    this.collider = this.world.createCollider(RAPIER.ColliderDesc.roundCuboid(.87, .36, 1.86, .12).setMass(definition.mass).setFriction(.08).setRestitution(.12).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), this.body);
    this.heading = heading;
    this.body.setRotation({ x: 0, y: Math.sin(heading / 2), z: 0, w: Math.cos(heading / 2) }, true);
    this.state = { x, y: heightAt(x, z) + .88, z, heading, speed: 0, speedKmh: 0, vx: 0, vz: 0, steering: 0, slipAngle: 0, drift: false, boost: false, grounded: true, pitch: 0, roll: 0, wheelSpin: 0, suspension: [0, 0, 0, 0], damage: 0, surface: 'asphalt' };
    this.world.step(this.events);
  }
  setTraffic(traffic: TrafficVehicle[]) {
    for (const t of traffic) {
      const dimensions = getTrafficDimensions(t.variant);
      const floor = .3, top = dimensions.bodyHeight + .68, center = (floor + top) / 2;
      let entry = this.trafficBodies.get(t.id);
      if (!entry) {
        const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(t.x, t.y + center, t.z));
        const collider = this.world.createCollider(RAPIER.ColliderDesc.roundCuboid(dimensions.width / 2 - .1, (top - floor) / 2 - .1, dimensions.length / 2 - .1, .1).setFriction(.05).setRestitution(.15), body);
        entry = { body, collider }; this.trafficBodies.set(t.id, entry); this.trafficHandles.set(collider.handle, t.id);
      }
      entry.body.setNextKinematicTranslation({ x: t.x, y: t.y + center, z: t.z });
      entry.body.setNextKinematicRotation({ x: 0, y: Math.sin(t.heading / 2), z: 0, w: Math.cos(t.heading / 2) });
    }
  }
  step(input: InputFrame, boost: boolean, assists = true): VehicleFeedback {
    const dt = FIXED_DT; this.time += dt;
    const feedback: VehicleFeedback = { impact: 0, surge: false, gripTurn: false, landed: 0, reset: false };
    const p = this.body.translation(), velocity = this.body.linvel();
    const speedBefore = Math.hypot(velocity.x, velocity.z);
    if (this.lastBrake && input.brake < .2) this.brakeRelease = this.time;
    if (input.throttle > .6 && !this.lastThrottle && this.time - this.brakeRelease <= .22 && speedBefore < 3) { this.surgeUntil = this.time + .65; feedback.surge = true; }
    this.lastBrake = input.brake > .4; this.lastThrottle = input.throttle > .6;
    const onRoad = roadAt(p.x, p.z);
    const cut = onRoad ? undefined : SHORTCUTS.find(s => distanceToSegment(p, s.entry, s.exit) < s.width / 2);
    const surface = onRoad?.surface ?? (cut ? cut.kind === 'beach' ? 'sand' : cut.kind === 'tram' ? 'cobble' : cut.kind === 'deck' ? 'metal' : 'asphalt' : p.x > 530 ? 'sand' : 'grass');
    const steerRate = assists ? 7.5 : 11;
    this.steering = mix(this.steering, clamp(input.steer, -1, 1), 1 - Math.exp(-steerRate * dt));
    if (input.handbrake && speedBefore > 9.72 && Math.abs(this.steering) > .2) this.driftTime = .65;
    const drifting = this.driftTime > 0 && speedBefore > 6;
    if (drifting && Math.abs(input.steer) > .15 && input.throttle > .25) this.driftTime = Math.max(this.driftTime, .18);
    this.driftTime -= dt;
    if (drifting && input.brake > .4) this.driftBrake = this.time;
    if (drifting && input.throttle > .6 && input.brake < .2 && this.time - this.driftBrake < .32) { feedback.gripTurn = true; this.driftBrake = -10; this.driftTime = .12; }
    const previousForward = velocity.x * Math.sin(this.heading) + velocity.z * Math.cos(this.heading);
    const turn = this.steering * Math.min(1.4, speedBefore * .12) / (1 + speedBefore * .021) * (this.definition.handling / 83) * (drifting ? 1.5 : 1) * (previousForward < -.5 ? -1 : 1) * (this.state.grounded ? 1 : .36);
    this.heading += turn * dt;
    const sx = Math.sin(this.heading), cz = Math.cos(this.heading);
    let longitudinal = velocity.x * sx + velocity.z * cz;
    let lateral = velocity.x * cz - velocity.z * sx;
    const surfaceGrip = surface === 'sand' ? .55 : surface === 'grass' ? .65 : surface === 'cobble' ? .88 : 1;
    const grip = (drifting ? 1.5 : assists ? 10.5 : 8) * surfaceGrip * (this.state.grounded ? 1 : .12);
    lateral *= Math.exp(-grip * dt);
    const topSpeed = this.definition.topSpeed / 3.6 * (boost ? 1.12 : 1);
    const damageFactor = Math.max(.86, 1 - this.damage * .025);
    const acceleration = this.definition.acceleration * .83 * damageFactor * (boost ? 1.8 : 1) + (this.time < this.surgeUntil ? 8 : 0);
    longitudinal += input.throttle * acceleration * dt;
    if (input.brake > 0) {
      if (longitudinal > .35) longitudinal = Math.max(0, longitudinal - input.brake * 23 * dt);
      else longitudinal = Math.max(-10, longitudinal - input.brake * 9 * dt);
    }
    const drag = .1 + (surface === 'grass' ? .47 : surface === 'sand' ? .24 : .016) * Math.abs(longitudinal) + .0005 * longitudinal * longitudinal;
    longitudinal = Math.sign(longitudinal) * Math.max(0, Math.abs(longitudinal) - drag * dt);
    if (input.handbrake && !drifting) longitudinal *= Math.exp(-1.6 * dt);
    longitudinal = clamp(longitudinal, -10, topSpeed);
    if (input.throttle < .01 && input.brake < .01 && Math.abs(longitudinal) < .22) longitudinal = 0;
    const suspension: number[] = [];
    const hits: number[] = [];
    const axle = this.definition.wheelbase / 2;
    for (const [side, front] of [[-.83, axle], [.83, axle], [-.83, -axle], [.83, -axle]]) {
      const origin = { x: p.x + side * cz + front * sx, y: p.y + .6, z: p.z - side * sx + front * cz };
      const hit = this.world.castRay(new RAPIER.Ray(origin, { x: 0, y: -1, z: 0 }), 2.8, true, undefined, undefined, this.collider, this.body, c => this.ground.has(c.handle));
      if (hit) { hits.push(origin.y - hit.timeOfImpact); suspension.push(clamp(1.45 - hit.timeOfImpact, -.4, .4)); }
      else { hits.push(heightAt(origin.x, origin.z)); suspension.push(-.4); }
    }
    const terrainTarget = Math.max(...hits) + .88;
    const grounded = p.y - terrainTarget < .55 && velocity.y < 8;
    let vy = velocity.y;
    if (grounded) {
      const spring = clamp((terrainTarget - p.y) * 110 - vy * 15 + 22, -24, 115);
      vy += spring * dt;
      const ramp = RAMPS.find(r => {
        const dx = p.x - r.x, dz = p.z - r.z;
        const forward = dx * Math.sin(r.heading) + dz * Math.cos(r.heading);
        const across = dx * Math.cos(r.heading) - dz * Math.sin(r.heading);
        return Math.abs(across) < r.width / 2 && forward > r.length / 2 - 3 && forward < r.length / 2 + 2 && speedBefore > 11 && Math.cos(this.heading - r.heading) > .7;
      });
      if (ramp) vy = Math.max(vy, 7.6 + speedBefore * .13);
      if (this.airTime > .26) feedback.landed = this.airTime;
      this.airTime = 0;
    } else this.airTime += dt;
    if (grounded && p.y < terrainTarget - .7) { this.body.setTranslation({ x: p.x, y: terrainTarget - .12, z: p.z }, true); vy = Math.max(0, vy); }
    this.body.setRotation({ x: 0, y: Math.sin(this.heading / 2), z: 0, w: Math.cos(this.heading / 2) }, true);
    this.body.setLinvel({ x: sx * longitudinal + cz * lateral, y: vy, z: cz * longitudinal - sx * lateral }, true);
    this.world.step(this.events);
    const after = this.body.translation(), afterVelocity = this.body.linvel();
    this.events.drainCollisionEvents((h1, h2, started) => {
      if (!started || (h1 !== this.collider.handle && h2 !== this.collider.handle)) return;
      const other = h1 === this.collider.handle ? h2 : h1;
      if (!this.ground.has(other) && speedBefore > 3.2) {
        feedback.impact = Math.max(feedback.impact, speedBefore);
        feedback.trafficId = this.trafficHandles.get(other);
      }
    });
    if (feedback.impact > 5) this.damage = Math.min(5, this.damage + .6);
    const speed = Math.hypot(afterVelocity.x, afterVelocity.z);
    const slopePitch = Math.atan2((hits[0] + hits[1] - hits[2] - hits[3]) / 2, this.definition.wheelbase);
    this.pitch = mix(this.pitch, grounded ? slopePitch + input.throttle * .018 - input.brake * .035 : clamp(afterVelocity.y / 45, -.18, .2), .11);
    this.roll = mix(this.roll, clamp(-turn * speed * .0035, -.12, .12), .12);
    this.wheelSpin += longitudinal * dt / .34;
    this.state = { x: after.x, y: after.y, z: after.z, heading: this.heading, speed, speedKmh: speed * 3.6, vx: afterVelocity.x, vz: afterVelocity.z, steering: this.steering, slipAngle: Math.atan2(lateral, Math.max(1, Math.abs(longitudinal))), drift: drifting && speed > 8, boost, grounded, pitch: this.pitch, roll: this.roll, wheelSpin: this.wheelSpin, suspension, damage: this.damage, surface };
    if (!Number.isFinite(after.y) || after.y < -20 || Math.abs(after.x) > WORLD_BOUNDS.maxX + 5 || Math.abs(after.z) > WORLD_BOUNDS.maxZ + 5) feedback.reset = true;
    return feedback;
  }
  snapshot(): VehicleState { return { ...this.state, suspension: [...this.state.suspension] }; }
  reset(x: number, z: number, heading = this.heading) {
    this.heading = heading; this.steering = 0; this.airTime = 0; this.driftTime = 0;
    this.body.setTranslation({ x, y: heightAt(x, z) + .9, z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true); this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setRotation({ x: 0, y: Math.sin(heading / 2), z: 0, w: Math.cos(heading / 2) }, true);
    this.state = { ...this.state, x, z, y: heightAt(x, z) + .9, heading, speed: 0, speedKmh: 0, vx: 0, vz: 0, boost: false, drift: false, grounded: true };
  }
  dispose() { this.events.free(); this.world.free(); }
}
