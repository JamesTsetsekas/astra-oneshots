import { afterEach, describe, expect, it } from 'vitest';
import { TAXIS } from './content';
import { findRoute, routeLength } from './navigation';
import { ScoreKeeper } from './scoring';
import { GameSession } from './session';
import { EMPTY_INPUT, type InputFrame, type SessionOptions, type Vec2 } from './types';
import { ArcadeVehicle, initializePhysics } from './vehicle';
import { BUILDINGS, DESTINATIONS, heightAt, LANDMARKS, ROAD_Z, SHORTCUTS } from './world';

const options: SessionOptions = { mode: 'arcade', taxi: 'breaker', color: '#f27b50', seed: 91425, trial: 0, lesson: 0, traffic: 0, assists: true };
const sessions: GameSession[] = [];
const create = async (opts: Partial<SessionOptions> = {}) => { const session = await GameSession.create({ ...options, ...opts }); sessions.push(session); return session; };
afterEach(() => sessions.splice(0).forEach(s => s.dispose()));
const tick = (session: GameSession, seconds: number, input: InputFrame = EMPTY_INPUT, hz = 60) => { for (let i = 0; i < Math.ceil(seconds * hz); i++) session.step(input, 1 / hz); };
function driveStraight(session: GameSession, target: Vec2, until: () => boolean) {
  for (let i = 0; i < 2400 && !until(); i++) {
    const car = session.snapshot().vehicle, remaining = target.z - car.z;
    const desired = Math.min(25, Math.sqrt(Math.max(0, Math.abs(remaining) - .8) * 2 * 13));
    session.step({ ...EMPTY_INPUT, throttle: car.speed < desired - .8 && remaining > .4 ? 1 : 0, brake: car.speed > desired + .25 ? 1 : 0 }, 1 / 60);
  }
}
function followRoute(session: GameSession): InputFrame {
  const state = session.snapshot(), car = state.vehicle, target = state.target;
  if (!target || state.countdown || state.status === 'boarding') return EMPTY_INPUT;
  const waypoint = state.route.find((p, i) => i > 0 && Math.hypot(p.x - car.x, p.z - car.z) > Math.max(7, car.speed * .58)) ?? target;
  const bearing = Math.atan2(waypoint.x - car.x, waypoint.z - car.z), angle = Math.atan2(Math.sin(bearing - car.heading), Math.cos(bearing - car.heading));
  const desired = Math.min(Math.abs(angle) > 1.1 ? 6 : Math.abs(angle) > .55 ? 10 : 24, Math.sqrt(Math.max(0, Math.hypot(target.x - car.x, target.z - car.z) - 1) * 22));
  return { ...EMPTY_INPUT, steer: Math.max(-1, Math.min(1, angle * 1.7)), throttle: car.speed < desired - .6 ? 1 : 0, brake: car.speed > desired + .35 ? Math.max(.25, Math.min(1, (car.speed - desired) / 4)) : 0 };
}

describe('Galeport world and route contract', () => {
  it('authors 32 reachable destinations, 18 shortcuts and clear main roads', () => {
    expect(DESTINATIONS).toHaveLength(32); expect(SHORTCUTS).toHaveLength(18); expect(BUILDINGS.length).toBeGreaterThan(150);
    for (const d of DESTINATIONS) { const route = findRoute({ x: 0, z: -300 }, d); expect(route.length).toBeGreaterThan(1); expect(route.at(-1)?.x).toBe(d.x); expect(routeLength(route)).toBeLessThan(2100); }
  });
  it('guides the introductory fare directly up Stormway', () => { const route = findRoute({ x: 0, z: -269 }, DESTINATIONS[0]); expect(routeLength(route)).toBeCloseTo(114); expect(route.every(p => p.x === 0)).toBe(true); });
  it('all authored shortcut centerlines retain chassis clearance from solid geometry', () => {
    for (const shortcut of SHORTCUTS) for (let i = 0; i <= 100; i++) {
      const x = shortcut.entry.x + (shortcut.exit.x - shortcut.entry.x) * i / 100, z = shortcut.entry.z + (shortcut.exit.z - shortcut.entry.z) * i / 100;
      expect([...BUILDINGS, ...LANDMARKS.filter(l => l.solid)].some(b => Math.abs(x - b.x) < b.width / 2 + 2 && Math.abs(z - b.z) < b.depth / 2 + 2), shortcut.name).toBe(false);
    }
  });
});

describe('physics and complete fare loop', () => {
  it('settles on the same heightfield used by rendering and has no countdown creep', async () => {
    const s = await create(); tick(s, 3);
    const car = s.snapshot().vehicle;
    expect(car.x).toBeCloseTo(0, 2); expect(car.z).toBeCloseTo(-300, 2); expect(car.y - heightAt(car.x, car.z)).toBeGreaterThan(.65); expect(car.y - heightAt(car.x, car.z)).toBeLessThan(1.1);
  });
  it('drives, picks up automatically, delivers, adds time and produces a result/replay', async () => {
    const s = await create(); tick(s, 2.5);
    driveStraight(s, { x: 0, z: -269 }, () => Boolean(s.snapshot().activeFare));
    expect(s.snapshot().activeFare?.destination.id).toBe(0);
    const before = s.snapshot().shiftRemaining;
    tick(s, 1);
    driveStraight(s, DESTINATIONS[0], () => s.snapshot().deliveries === 1);
    const result = s.snapshot();
    expect(result.deliveries).toBe(1); expect(result.delivery?.grade).toBe('BLAZING'); expect(result.delivery?.timeBonus).toBe(4); expect(result.score).toBeGreaterThan(800); expect(result.shiftRemaining).toBeGreaterThan(before - 20); expect(result.passengers.length).toBeGreaterThanOrEqual(5);
    s.finish(); expect(s.snapshot().result?.deliveries).toBe(1); expect(s.replay().samples.length).toBeGreaterThan(30); expect(s.replay().frames[0]).toHaveLength(4);
  });
  it('ends an entire arcade clock and keeps Quick Shift fixed at five minutes', async () => {
    const arcade = await create(); tick(arcade, 63); expect(arcade.snapshot().status).toBe('finished'); expect(arcade.snapshot().result?.duration).toBeCloseTo(60, 1);
    const quick = await create({ mode: 'quick' }); tick(quick, 303); expect(quick.snapshot().status).toBe('finished'); expect(quick.snapshot().result?.duration).toBeCloseTo(300, 1);
  }, 20000);
  it('produces the same fixed-step motion and traffic at 30, 60 and 120 render Hz', async () => {
    const simulations = await Promise.all([30, 60, 120].map(() => create({ traffic: 1 })));
    [30, 60, 120].forEach((hz, i) => { tick(simulations[i], 3, EMPTY_INPUT, hz); tick(simulations[i], 4, { ...EMPTY_INPUT, throttle: 1, steer: .15 }, hz); });
    const states = simulations.map(s => s.snapshot());
    expect(states[0].traffic.length).toBeGreaterThanOrEqual(35);
    for (const state of states.slice(1)) { expect(state.vehicle.x).toBeCloseTo(states[0].vehicle.x, 4); expect(state.vehicle.z).toBeCloseTo(states[0].vehicle.z, 4); expect(state.traffic.map(t => [t.x, t.z])).toEqual(states[0].traffic.map(t => [t.x, t.z])); }
  });
  it('the CCD chassis collides with buildings instead of tunneling through them', async () => {
    await initializePhysics(); const building = BUILDINGS.find(b => ROAD_Z.some(z => b.z - z > 34 && b.z - z < 48))!;
    const road = ROAD_Z.find(z => building.z - z > 34 && building.z - z < 48)!;
    const vehicle = new ArcadeVehicle(TAXIS[1], building.x, road, 0);
    let hit = false;
    for (let i = 0; i < 480; i++) { const feedback = vehicle.step({ ...EMPTY_INPUT, throttle: 1 }, false); hit ||= feedback.impact > 0; }
    expect(hit).toBe(true); expect(vehicle.snapshot().z).toBeLessThan(building.z - building.depth / 2); vehicle.dispose();
  });
  it('hits a bus and van at their visible longer bumpers, not a compact car-sized collider', async () => {
    await initializePhysics(); const stops: number[] = [];
    for (const variant of [0, 3, 4]) {
      const vehicle = new ArcadeVehicle(TAXIS[1], 0, -310, 0);
      vehicle.setTraffic([{ id: 0, x: 0, y: 0, z: -275, heading: 0, speed: 0, variant, color: '#ffffff', state: 'brake' }]);
      for (let i = 0; i < 480; i++) vehicle.step({ ...EMPTY_INPUT, throttle: 1 }, false);
      stops.push(vehicle.snapshot().z); vehicle.dispose();
    }
    expect(stops[0] - stops[1]).toBeCloseTo((7.2 - 4.3) / 2, 1);
    expect(stops[0] - stops[2]).toBeCloseTo((5.6 - 4.3) / 2, 1);
  });
  it('completes the acceleration school objective through normal driving', async () => {
    const s = await create({ mode: 'school', lesson: 0 }); tick(s, 11, { ...EMPTY_INPUT, throttle: 1 }); expect(s.snapshot().lesson?.complete).toBe(true); expect(s.snapshot().result?.lesson).toBe(0);
  });
  it('uses the authored ramp and lands a scored jump', async () => {
    const s = await create({ mode: 'school', lesson: 6 }); tick(s, 18, { ...EMPTY_INPUT, throttle: 1 }); expect(s.snapshot().lesson?.complete).toBe(true); expect(s.snapshot().result?.lesson).toBe(6);
  });
  it('discovers a shortcut only after entering and exiting the authored gates', async () => {
    const s = await create({ mode: 'school', lesson: 7 }); tick(s, 20, { ...EMPTY_INPUT, throttle: 1 }); expect(s.snapshot().lesson?.complete).toBe(true); expect(s.snapshot().discovered).toContain(0);
  });
  it('holds reset for 1.5 seconds and applies its time and score penalty once', async () => {
    const s = await create(); tick(s, 2.5); const before = s.snapshot().shiftRemaining;
    tick(s, 1.6, { ...EMPTY_INPUT, reset: true });
    expect(before - s.snapshot().shiftRemaining).toBeCloseTo(4.6, 1); expect(s.snapshot().vehicle.speed).toBeLessThan(.1); expect(s.snapshot().events.some(e => e.label.includes('BACK ON THE ROAD'))).toBe(true);
  });
  it('teaches brake-release Surge Start with the stated input timing', async () => {
    const s = await create({ mode: 'school', lesson: 2 }); tick(s, 2.5); tick(s, .1, { ...EMPTY_INPUT, brake: 1 }); tick(s, .1); tick(s, 2, { ...EMPTY_INPUT, throttle: 1 });
    expect(s.snapshot().result?.lesson).toBe(2);
  });
  it('banks a sustained Snap Drift through ordinary steering and handbrake input', async () => {
    const s = await create({ mode: 'school', lesson: 3 }); tick(s, 2.5); tick(s, 3, { ...EMPTY_INPUT, throttle: 1 }); tick(s, .15, { ...EMPTY_INPUT, throttle: 1, steer: .65, handbrake: true }); tick(s, 1.5, { ...EMPTY_INPUT, throttle: 1, steer: .65 }); tick(s, 2.5, { ...EMPTY_INPUT, throttle: 1 });
    expect(s.snapshot().result?.lesson).toBe(3);
  });
  it('recognizes Grip Turn only after braking inside an active drift', async () => {
    const s = await create({ mode: 'school', lesson: 4 }); tick(s, 2.5); tick(s, 3, { ...EMPTY_INPUT, throttle: 1 }); tick(s, .15, { ...EMPTY_INPUT, throttle: 1, steer: .6, handbrake: true }); tick(s, .4, { ...EMPTY_INPUT, throttle: 1, steer: .6 }); tick(s, .12, { ...EMPTY_INPUT, brake: 1, steer: .6 }); tick(s, 2, { ...EMPTY_INPUT, throttle: 1 });
    expect(s.snapshot().result?.lesson).toBe(4);
  });
  it('stages a passable traffic car for the Near Miss school lesson', async () => {
    const s = await create({ mode: 'school', lesson: 5, traffic: 1 }); tick(s, 15, { ...EMPTY_INPUT, throttle: 1 });
    expect(s.snapshot().result?.lesson).toBe(5);
  });
  it('completes the braking lesson after reaching speed and stopping', async () => {
    const s = await create({ mode: 'school', lesson: 1 }); tick(s, 2.5); tick(s, 3, { ...EMPTY_INPUT, throttle: 1 }); tick(s, .77, { ...EMPTY_INPUT, brake: 1 }); tick(s, 2);
    expect(s.snapshot().result?.lesson).toBe(1);
  });
  it.each([8, 9])('completes delivery school lesson %i without bypassing driving or fare rules', async (lesson) => {
    const s = await create({ mode: 'school', lesson }); tick(s, 2.5);
    driveStraight(s, { x: 0, z: -269 }, () => Boolean(s.snapshot().activeFare)); tick(s, 1);
    driveStraight(s, DESTINATIONS[0], () => s.snapshot().deliveries === 1); tick(s, 2);
    expect(s.snapshot().result?.lesson).toBe(lesson);
  });
  it('finishes the authored Harbor Hustle trial with all three relay fares and a medal', async () => {
    const s = await create({ mode: 'trial', trial: 0 });
    for (let i = 0; i < 245 * 60 && !s.snapshot().result; i++) s.step(followRoute(s), 1 / 60);
    expect(s.snapshot().result?.deliveries).toBe(3); expect(s.snapshot().result?.medal).toBeDefined(); expect(s.snapshot().result?.seed).toBe(73411);
  }, 20000);
});

describe('scoring cannot be farmed stationary or by holding boost', () => {
  it('rejects low-speed, repeated-object and no-travel events', () => {
    const score = new ScoreKeeper();
    expect(score.award('nearMiss', 'NEAR MISS', 150, 0, { x: 0, z: 0 }, 0)).toBe(0);
    expect(score.award('nearMiss', 'NEAR MISS', 150, 1, { x: 0, z: 0 }, 20, { key: 'car1' })).toBe(150);
    expect(score.award('nearMiss', 'NEAR MISS', 150, 30, { x: 0, z: 0 }, 20, { key: 'car1' })).toBe(0);
    expect(score.award('nearMiss', 'NEAR MISS', 150, 1.1, { x: 50, z: 0 }, 20, { key: 'car1' })).toBe(0);
  });
  it('repeated categories charge less, variety restores charge, boost cannot recharge itself', () => {
    const score = new ScoreKeeper(); score.tailwind = 0;
    score.award('drift', 'DRIFT', 100, 1, { x: 0, z: 0 }, 20); const first = score.tailwind;
    score.award('drift', 'DRIFT', 100, 4, { x: 40, z: 0 }, 20); expect(score.tailwind - first).toBeLessThan(first);
    const before = score.tailwind; score.award('air', 'AIR', 100, 6, { x: 80, z: 0 }, 20, { boosting: true }); expect(score.tailwind).toBe(before);
    score.tick(1, 7, true); expect(score.tailwind).toBe(0);
    score.tick(20, 30, false); expect(score.pulse).toBe(0);
  });
});
