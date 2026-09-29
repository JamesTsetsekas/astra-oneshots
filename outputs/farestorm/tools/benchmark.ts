import { performance } from 'node:perf_hooks';
import { GameSession } from '../src/game/session';
import { ArcadeVehicle, initializePhysics } from '../src/game/vehicle';
import { TAXIS } from '../src/game/content';
import { EMPTY_INPUT, type InputFrame, type SessionOptions } from '../src/game/types';
import { BUILDINGS, DESTINATIONS, SHORTCUTS, heightAt } from '../src/game/world';

const options: SessionOptions = { mode: 'quick', taxi: 'breaker', color: '#ef8655', seed: 6172026, trial: 0, lesson: 0, traffic: 1.5, assists: true };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function controller(session: GameSession): InputFrame {
  const snapshot = session.snapshot(), car = snapshot.vehicle;
  if (snapshot.countdown > 0 || snapshot.status === 'boarding') return EMPTY_INPUT;
  const target = snapshot.target;
  if (!target) return EMPTY_INPUT;
  const route = snapshot.route;
  const lookahead = Math.max(7, car.speed * .58);
  const waypoint = route.find((p, i) => i > 0 && Math.hypot(p.x - car.x, p.z - car.z) > lookahead) ?? target;
  const bearing = Math.atan2(waypoint.x - car.x, waypoint.z - car.z);
  const angle = Math.atan2(Math.sin(bearing - car.heading), Math.cos(bearing - car.heading));
  const directDistance = Math.hypot(target.x - car.x, target.z - car.z);
  const speed = Math.min(Math.abs(angle) > 1.1 ? 6 : Math.abs(angle) > .55 ? 10 : 24, Math.sqrt(Math.max(0, directDistance - 1) * 22));
  return { ...EMPTY_INPUT, steer: clamp(angle * 1.7, -1, 1), throttle: car.speed < speed - .6 ? 1 : 0, brake: car.speed > speed + .35 ? clamp((car.speed - speed) / 4, .25, 1) : 0, reset: car.speed < 1 && snapshot.time > 40 && directDistance > 20 };
}

await initializePhysics();
const tuning = [];
for (const taxi of TAXIS) {
  const vehicle = new ArcadeVehicle(taxi, 0, -420);
  let time = 0, time100: number | undefined, highestSpeed = 0;
  const samples = [];
  for (let i = 0; i < 14 * 60; i++) {
    vehicle.step({ ...EMPTY_INPUT, throttle: 1 }, false); time += 1 / 60;
    const snapshot = vehicle.snapshot(); highestSpeed = Math.max(highestSpeed, snapshot.speedKmh);
    if (!time100 && snapshot.speedKmh >= 100) time100 = time;
    if (i % 60 === 0) samples.push({ second: Math.round(time), kmh: Math.round(snapshot.speedKmh * 10) / 10 });
  }
  tuning.push({ taxi: taxi.id, zeroTo100Seconds: time100 && Math.round(time100 * 100) / 100, observed14SecondSpeed: Math.round(highestSpeed), samples }); vehicle.dispose();
}
const session = await GameSession.create(options);
const durations: number[] = [];
let invalidTransforms = 0, belowTerrain = 0;
const start = performance.now();
for (let frame = 0; frame < 310 * 60; frame++) {
  const input = controller(session), before = performance.now();
  session.step(input, 1 / 60); durations.push(performance.now() - before);
  const snapshot = session.snapshot();
  if (![snapshot.vehicle.x, snapshot.vehicle.y, snapshot.vehicle.z].every(Number.isFinite)) invalidTransforms++;
  if (snapshot.vehicle.y < heightAt(snapshot.vehicle.x, snapshot.vehicle.z) - 1) belowTerrain++;
  if (snapshot.result) break;
}
const elapsed = performance.now() - start;
durations.sort((a, b) => a - b);
console.log(JSON.stringify({ scope: 'Node headless fixed-step physics and traffic, not a browser GPU/FPS benchmark', world: { buildings: BUILDINGS.length, destinations: DESTINATIONS.length, shortcuts: SHORTCUTS.length }, simulationSteps: durations.length, wallSeconds: +(elapsed / 1000).toFixed(2), simulationMs: { mean: +(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(3), p50: +durations[Math.floor(durations.length * .5)].toFixed(3), p95: +durations[Math.floor(durations.length * .95)].toFixed(3), p99: +durations[Math.floor(durations.length * .99)].toFixed(3) }, traffic: session.snapshot().traffic.length, invalidTransforms, belowTerrain, result: session.snapshot().result, replayFrames: session.replay().frames.length, ghostSamples: session.replay().samples.length, tuning }, null, 2));
session.dispose();
