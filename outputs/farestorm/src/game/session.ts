import { LESSONS, PASSENGER_ARCHETYPES, TAXIS, TRIALS } from './content';
import { distance, findRoute, nearestStreet, routeLength } from './navigation';
import { ScoreKeeper } from './scoring';
import type { ActiveFare, DeliveryReceipt, Destination, GameResult, GameSnapshot, GhostSample, InputFrame, LessonState, Passenger, Replay, SessionOptions, TrafficVehicle, Vec2, Vec3 } from './types';
import { EMPTY_INPUT } from './types';
import { ArcadeVehicle, FIXED_DT, initializePhysics } from './vehicle';
import { DESTINATIONS, districtAt, heightAt, RAMPS, ROAD_X, ROAD_Z, SHORTCUTS } from './world';

export const RULES_VERSION = 1;
export function seededRandom(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
type TrafficAgent = { view: TrafficVehicle; route: Vec2[]; lengths: number[]; total: number; progress: number; cruise: number; recovery: number };
const trafficColors = ['#e2b862', '#eb795e', '#78aeac', '#ece2cc', '#63859c', '#b4be98', '#b3889c', '#505f6d', '#87b5c2', '#d1a58b'];

function smoothLoop(corners: Vec2[]): Vec2[] {
  return corners.flatMap((p, i) => {
    const prev = corners[(i + corners.length - 1) % corners.length], next = corners[(i + 1) % corners.length];
    const da = distance(prev, p), db = distance(p, next), radius = 12;
    const a = { x: p.x + (prev.x - p.x) / da * radius, z: p.z + (prev.z - p.z) / da * radius };
    const b = { x: p.x + (next.x - p.x) / db * radius, z: p.z + (next.z - p.z) / db * radius };
    return Array.from({ length: 7 }, (_, j) => { const t = j / 6; return { x: (1 - t) ** 2 * a.x + 2 * t * (1 - t) * p.x + t * t * b.x, z: (1 - t) ** 2 * a.z + 2 * t * (1 - t) * p.z + t * t * b.z }; });
  });
}
function trafficSample(agent: TrafficAgent, progress: number) {
  let d = ((progress % agent.total) + agent.total) % agent.total;
  for (let i = 0; i < agent.route.length; i++) {
    const length = agent.lengths[i];
    if (d <= length) {
      const a = agent.route[i], b = agent.route[(i + 1) % agent.route.length], t = d / Math.max(.001, length);
      const heading = Math.atan2(b.x - a.x, b.z - a.z);
      return { x: a.x + (b.x - a.x) * t + Math.cos(heading) * 5.1, z: a.z + (b.z - a.z) * t - Math.sin(heading) * 5.1, heading };
    }
    d -= length;
  }
  return { ...agent.route[0], heading: 0 };
}

export class GameSession {
  readonly options: SessionOptions;
  readonly vehicle: ArcadeVehicle;
  readonly scoring = new ScoreKeeper();
  private random: () => number;
  private time = 0;
  private accumulator = 0;
  private countdown = 2.4;
  private shiftRemaining = 60;
  private status: GameSnapshot['status'] = 'playing';
  private passengers: Passenger[] = [];
  private traffic: TrafficAgent[] = [];
  private activeFare?: ActiveFare;
  private receipt?: DeliveryReceipt;
  private result?: GameResult;
  private deliveries = 0;
  private collisions = 0;
  private fareTotal = 0;
  private totalRoute = 0;
  private totalDriven = 0;
  private fareDriven = 0;
  private fareStartTips = 0;
  private nextPassenger = 0;
  private nextReceipt = 0;
  private nextBoarding = 0;
  private boardingUntil = 0;
  private receiptUntil = 0;
  private lastImpact = -10;
  private resetHeld = 0;
  private lastPosition: Vec2;
  private lastSafe: Vec2;
  private driftDuration = 0;
  private driftDistance = 0;
  private cleanDuration = 0;
  private oncomingDuration = 0;
  private nearMissTime = -10;
  private shortcutEntries = new Map<number, number>();
  private discovered = new Set<number>();
  private frames: Replay['frames'] = [];
  private samples: GhostSample[] = [];
  private frameNumber = 0;
  private route: Vec3[] = [];
  private nextRouteUpdate = 0;
  private lesson?: LessonState;
  private lessonHadSpeed = false;
  private lessonCompleteAt = Infinity;
  private expiryGrace = 0;
  private disposed = false;

  static async create(options: SessionOptions): Promise<GameSession> {
    await initializePhysics();
    return new GameSession(options);
  }
  private constructor(options: SessionOptions) {
    const trial = TRIALS[clamp(options.trial, 0, TRIALS.length - 1)];
    this.options = { ...options, seed: options.mode === 'trial' ? trial.seed : options.seed };
    this.random = seededRandom(this.options.seed);
    let start = { x: 0, z: -300 }, heading = 0;
    if (options.mode === 'school') {
      const index = clamp(options.lesson, 0, LESSONS.length - 1), item = LESSONS[index];
      this.lesson = { index, title: item.title, description: item.description, progress: 0, complete: false };
      if (index === 6) { const ramp = RAMPS[0]; start = { x: ramp.x - Math.sin(ramp.heading) * 52, z: ramp.z - Math.cos(ramp.heading) * 52 }; heading = ramp.heading; }
      if (index === 7) { const cut = SHORTCUTS[0]; const length = distance(cut.entry, cut.exit); start = { x: cut.entry.x - (cut.exit.x - cut.entry.x) / length * 15, z: cut.entry.z - (cut.exit.z - cut.entry.z) / length * 15 }; heading = Math.atan2(cut.exit.x - cut.entry.x, cut.exit.z - cut.entry.z); }
    }
    this.vehicle = new ArcadeVehicle(TAXIS.find(t => t.id === options.taxi) ?? TAXIS[1], start.x, start.z, heading);
    this.lastPosition = { ...start }; this.lastSafe = { ...start };
    this.shiftRemaining = options.mode === 'quick' ? 300 : options.mode === 'trial' ? 240 : options.mode === 'school' ? 600 : 60;
    this.spawnTraffic();
    this.passengers.push({ id: this.nextPassenger++, x: 0, z: -269, archetype: 0, tier: 'short', destination: options.mode === 'trial' ? trial.destinations[0] : 0, active: true });
    if (options.mode !== 'trial') this.populatePassengers();
    this.route = findRoute(start, this.passengers[0]);
  }
  private populatePassengers() {
    const recent = this.activeFare?.destination.id;
    for (const pickup of DESTINATIONS) {
      if (this.passengers.filter(p => p.active).length >= 23) break;
      if (pickup.id === recent || distance(pickup, this.vehicle.snapshot()) < 35 || this.passengers.some(p => p.active && distance(p, pickup) < 40)) continue;
      const options = DESTINATIONS.filter(d => d.id !== pickup.id && distance(d, pickup) > 140 && distance(d, pickup) < 740);
      const destination = options[Math.floor(this.random() * options.length)];
      const length = distance(pickup, destination), tier = length < 285 ? 'short' : length < 510 ? 'medium' : 'long';
      this.passengers.push({ id: this.nextPassenger++, x: pickup.x + 7, z: pickup.z + 8, archetype: Math.floor(this.random() * PASSENGER_ARCHETYPES.length), tier, destination: destination.id, active: true });
    }
  }
  private spawnTraffic() {
    const count = this.options.traffic <= 0 ? 0 : Math.round(35 + clamp(this.options.traffic, .2, 1.5) / 1.5 * 20);
    for (let id = 0; id < count; id++) {
      const c = Math.floor(this.random() * 5), r = Math.floor(this.random() * 3), width = this.random() < .45 ? 2 : 1, depth = this.random() < .4 ? 2 : 1;
      let corners = [{ x: ROAD_X[c], z: ROAD_Z[r] }, { x: ROAD_X[c + width], z: ROAD_Z[r] }, { x: ROAD_X[c + width], z: ROAD_Z[r + depth] }, { x: ROAD_X[c], z: ROAD_Z[r + depth] }];
      if (this.random() < .5) corners = corners.reverse();
      const route = smoothLoop(corners), lengths = route.map((p, i) => distance(p, route[(i + 1) % route.length]));
      const total = lengths.reduce((sum, v) => sum + v, 0);
      const agent: TrafficAgent = { view: { id, x: 0, y: 0, z: 0, heading: 0, speed: 0, variant: id % 22, color: trafficColors[id % trafficColors.length], state: 'cruise' }, route, lengths, total, progress: this.random() * total, cruise: 8 + this.random() * 8, recovery: 0 };
      let sample = trafficSample(agent, agent.progress);
      for (let attempts = 0; attempts < 12 && (distance(sample, this.lastPosition) < 90 || this.traffic.some(t => distance(t.view, sample) < 20)); attempts++) { agent.progress = this.random() * total; sample = trafficSample(agent, agent.progress); }
      Object.assign(agent.view, sample, { y: heightAt(sample.x, sample.z), speed: agent.cruise }); this.traffic.push(agent);
    }
    if (this.lesson?.index === 5 && this.traffic[0]) {
      const t = this.traffic[0];
      t.route = smoothLoop([{ x: 0, z: -420 }, { x: 0, z: 0 }, { x: 200, z: 0 }, { x: 200, z: -420 }]);
      t.lengths = t.route.map((p, i) => distance(p, t.route[(i + 1) % t.route.length])); t.total = t.lengths.reduce((a, b) => a + b, 0); t.progress = 150; t.cruise = 6;
    }
    this.vehicle.setTraffic(this.traffic.map(t => t.view));
  }
  private updateTraffic(dt: number, input: InputFrame) {
    const car = this.vehicle.snapshot();
    for (const agent of this.traffic) {
      const p = agent.view, sx = Math.sin(p.heading), cz = Math.cos(p.heading);
      let target = agent.cruise;
      const northSouth = Math.abs(cz) > .8, along = northSouth ? p.z : p.x, dir = northSouth ? Math.sign(cz) : Math.sign(sx);
      const intersections = northSouth ? ROAD_Z : ROAD_X;
      const nextCross = intersections.find(v => dir > 0 && v > along + 3) ?? [...intersections].reverse().find(v => dir < 0 && v < along - 3);
      const greenNS = this.time % 14 < 7;
      if (nextCross !== undefined && northSouth !== greenNS && Math.abs(nextCross - along) < 28 && Math.abs(nextCross - along) > 11) target = Math.min(target, Math.max(0, (Math.abs(nextCross - along) - 15) * 1.1));
      for (const other of this.traffic) {
        if (other === agent) continue;
        const dx = other.view.x - p.x, dz = other.view.z - p.z, ahead = dx * sx + dz * cz, lateral = Math.abs(dx * cz - dz * sx);
        if (ahead > 0 && ahead < 23 && lateral < 2.7 && Math.cos(other.view.heading - p.heading) > .7) target = Math.min(target, Math.max(0, (ahead - 8) * .8));
      }
      const dx = car.x - p.x, dz = car.z - p.z, ahead = dx * sx + dz * cz;
      if (ahead > 0 && ahead < (input.horn ? 42 : 19) && Math.abs(dx * cz - dz * sx) < 3.1) target = Math.min(target, Math.max(0, (ahead - 7) * .7));
      agent.recovery = Math.max(0, agent.recovery - dt);
      if (agent.recovery > 0) target = 1;
      p.speed += clamp(target - p.speed, -10 * dt, 3.5 * dt);
      agent.progress += p.speed * dt;
      const sample = trafficSample(agent, agent.progress);
      p.state = agent.recovery > 0 ? 'recover' : p.speed < 3 ? 'brake' : Math.abs(Math.sin(sample.heading * 2)) > .1 ? 'turn' : 'cruise';
      Object.assign(p, sample, { y: heightAt(sample.x, sample.z) });
    }
    this.vehicle.setTraffic(this.traffic.map(t => t.view));
  }
  step(input: InputFrame, dt: number) {
    if (this.disposed || this.result) return;
    this.accumulator += clamp(dt, 0, .25);
    let steps = 0;
    while (this.accumulator + 1e-9 >= FIXED_DT && steps < 15) {
      this.accumulator -= FIXED_DT; this.fixedStep(input); steps++;
      if (this.result) break;
    }
  }
  private fixedStep(input: InputFrame) {
    const dt = FIXED_DT;
    if (this.countdown > 0) { this.countdown = Math.max(0, this.countdown - dt); this.vehicle.step(EMPTY_INPUT, false); return; }
    this.time += dt; this.frameNumber++;
    const bits = (input.handbrake ? 1 : 0) | (input.boost ? 2 : 0) | (input.interact ? 4 : 0) | (input.reset ? 8 : 0) | (input.horn ? 16 : 0);
    this.frames.push([Math.round(input.throttle * 255), Math.round(input.brake * 255), Math.round(input.steer * 127), bits]);
    this.updateTraffic(dt, input);
    const boost = input.boost && this.scoring.tailwind > 1 && this.vehicle.snapshot().speed > 3;
    const boarding = this.time < this.boardingUntil;
    const controls = boarding ? { ...EMPTY_INPUT } : input;
    const feedback = this.vehicle.step(controls, boost && !boarding, this.options.assists);
    const car = this.vehicle.snapshot();
    this.scoring.tick(dt, this.time, boost);
    const travelled = distance(car, this.lastPosition);
    this.lastPosition = { x: car.x, z: car.z };
    if (travelled < 10) { this.totalDriven += travelled; if (this.activeFare) this.fareDriven += travelled; }
    if (car.surface === 'asphalt' && car.grounded && car.speed > 2) this.lastSafe = nearestStreet(car);
    if (this.frameNumber % 6 === 0) this.samples.push({ t: this.time, x: car.x, y: car.y, z: car.z, heading: car.heading, speed: car.speed });
    if (input.horn && this.frameNumber % 30 === 0) this.scoring.push('info', 'HORN', 0, this.time);
    if (feedback.impact > 3.2 && this.time - this.lastImpact > .8) {
      this.lastImpact = this.time; this.collisions++; this.cleanDuration = 0; this.driftDuration = 0; this.driftDistance = 0;
      this.scoring.collision(feedback.impact > 20, this.time);
      if (feedback.trafficId !== undefined) { const agent = this.traffic.find(t => t.view.id === feedback.trafficId); if (agent) agent.recovery = 2.1; }
      if (this.activeFare) this.activeFare.line = PASSENGER_ARCHETYPES[this.activeFare.passenger.archetype].collisionLine;
    }
    if (feedback.surge) { this.style('surge', 'SURGE START', 180, { minSpeed: 0, cooldown: 12, minTravel: 35 }); this.completeLesson(2); }
    if (feedback.gripTurn) { this.style('drift', 'GRIP TURN', 220, { cooldown: 4, minTravel: 35 }); this.completeLesson(4); }
    this.detectStyle(dt, travelled, feedback.landed);
    this.updateLessons(car.speedKmh, dt);
    this.resetHeld = input.reset && car.speed < 3 ? this.resetHeld + dt : 0;
    if (feedback.reset || this.resetHeld >= 1.5) {
      this.vehicle.reset(this.lastSafe.x, this.lastSafe.z, car.heading); this.lastPosition = { ...this.lastSafe }; this.resetHeld = 0;
      this.shiftRemaining = Math.max(0, this.shiftRemaining - 3); this.scoring.score = Math.max(0, this.scoring.score - 100); this.scoring.collision(true, this.time); this.scoring.push('info', 'BACK ON THE ROAD  -3s', 0, this.time);
    }
    if (this.options.mode !== 'school' && (!boarding || this.options.mode === 'quick' || this.options.mode === 'trial')) this.shiftRemaining = Math.max(0, this.shiftRemaining - dt);
    if (!boarding) {
      if (this.activeFare) {
        this.activeFare.elapsed += dt; this.activeFare.remaining -= dt; this.activeFare.distance = distance(car, this.activeFare.destination);
        this.activeFare.tips = this.scoring.tips - this.fareStartTips;
        if (distance(car, this.activeFare.destination) < this.activeFare.destination.radius && car.speed < 8 / 3.6) this.deliver();
        else if (this.activeFare.remaining < -2) {
          this.scoring.push('info', 'FARE MISSED. FIND YOUR NEXT RIDE.', 0, this.time); this.activeFare = undefined; this.nextBoarding = this.time + 1.2;
          if (this.options.mode === 'trial') this.finish();
        }
      } else if (this.time > this.nextBoarding && this.shiftRemaining > 0 && (!this.lesson || this.lesson.index >= 8)) {
        const candidate = this.passengers.find(p => p.active && distance(p, car) < 3.5 && car.speed < 5 / 3.6);
        if (candidate) this.pickup(candidate);
      }
    }
    if (this.status === 'boarding' && !boarding) this.status = 'playing';
    if (this.status === 'delivery' && this.time > this.receiptUntil) this.status = 'playing';
    if (this.receipt && this.time > this.receiptUntil + .5) this.receipt = undefined;
    if (this.shiftRemaining <= 0 && !this.result) {
      const inArrival = this.activeFare && distance(car, this.activeFare.destination) < this.activeFare.destination.radius;
      if (inArrival && this.expiryGrace < 2) this.expiryGrace += dt;
      else this.finish();
    }
    if (this.time >= this.lessonCompleteAt) this.finish();
    if (this.time > this.nextRouteUpdate) { this.updateRoute(); this.nextRouteUpdate = this.time + .35; }
  }
  private style(kind: Parameters<ScoreKeeper['award']>[0], label: string, points: number, options: Parameters<ScoreKeeper['award']>[6] = {}) {
    const car = this.vehicle.snapshot();
    const preference = this.activeFare ? PASSENGER_ARCHETYPES[this.activeFare.passenger.archetype].preference : undefined;
    const factor = preference === 'style' && ['drift', 'air', 'nearMiss'].includes(kind) ? 1.25 : preference === 'chain' && this.scoring.multiplier >= 2 ? 1.2 : preference === 'clean' && kind === 'clean' ? 1.4 : preference === 'scenic' && kind === 'shortcut' ? 1.3 : 1;
    const added = this.scoring.award(kind, label, points, this.time, car, car.speed, { ...options, boosting: car.boost, preference: factor });
    if (added && this.activeFare && this.time % 5 < 1) this.activeFare.line = PASSENGER_ARCHETYPES[this.activeFare.passenger.archetype].styleLine;
    return added;
  }
  private detectStyle(dt: number, travelled: number, landed: number) {
    const car = this.vehicle.snapshot();
    if (car.drift && car.speed > 9.72 && Math.abs(car.slipAngle) > .045) { this.driftDuration += dt; this.driftDistance += travelled; }
    else if (this.driftDuration > 0) {
      if (this.driftDuration >= 1.2 && this.driftDistance > 15 && this.time - this.lastImpact > 1) { this.style('drift', 'SNAP DRIFT', Math.round(100 + this.driftDuration * 90), { cooldown: 2.5, minTravel: 22 }); this.completeLesson(3); }
      this.driftDuration = 0; this.driftDistance = 0;
    }
    if (this.lesson?.index === 3) this.lesson.progress = clamp(this.driftDuration / 1.2, 0, .95);
    if (landed > .3 && car.speed > 8 && this.time - this.lastImpact > .7) { this.style('air', 'SOFT LANDING', Math.round(200 + landed * 350), { cooldown: 4, minTravel: 45 }); this.completeLesson(6); }
    if (car.speed > 50 / 3.6) {
      for (const agent of this.traffic) {
        const d = distance(car, agent.view), relative = Math.hypot(car.vx - Math.sin(agent.view.heading) * agent.view.speed, car.vz - Math.cos(agent.view.heading) * agent.view.speed);
        if (d > 2.5 && d < 5.7 && relative > 6 && this.time - this.lastImpact > .9) {
          const scored = this.style('nearMiss', 'NEAR MISS', 150, { key: `traffic-${agent.view.id}`, cooldown: 12, minTravel: 60, minSpeed: 50 / 3.6 });
          if (scored) { if (this.time - this.nearMissTime < .7) this.style('nearMiss', 'THREAD THE NEEDLE', 360, { key: 'thread', cooldown: 5, minTravel: 55 }); this.nearMissTime = this.time; this.completeLesson(5); }
        }
      }
    }
    for (const shortcut of SHORTCUTS) {
      if (distance(car, shortcut.entry) < shortcut.width) this.shortcutEntries.set(shortcut.id, this.time);
      const entered = this.shortcutEntries.get(shortcut.id);
      if (entered !== undefined && this.time - entered < 35 && distance(car, shortcut.exit) < shortcut.width && this.time - entered > 1.5) {
        this.shortcutEntries.delete(shortcut.id);
        const first = !this.discovered.has(shortcut.id);
        this.style('shortcut', first ? `DISCOVERED: ${shortcut.name.toUpperCase()}` : 'SHORTCUT', first ? shortcut.bonus : 70, { key: `shortcut-${shortcut.id}`, cooldown: 30, minTravel: 120 });
        this.discovered.add(shortcut.id); this.completeLesson(7);
      }
    }
    if (this.activeFare && car.speed > 19.4 && car.grounded && this.time - this.lastImpact > 10) {
      this.cleanDuration += dt;
      if (this.cleanDuration >= 10) { this.style('clean', 'CLEAN SECTOR', 450, { cooldown: 10, minTravel: 150 }); this.cleanDuration = 0; }
    } else this.cleanDuration = 0;
    const roadX = ROAD_X.find(x => Math.abs(car.x - x) < 12), roadZ = ROAD_Z.find(z => Math.abs(car.z - z) < 12);
    const oncoming = roadX !== undefined && Math.abs(car.vz) > 15 ? (car.x - roadX) * car.vz < -30 : roadZ !== undefined && Math.abs(car.vx) > 15 ? (car.z - roadZ) * car.vx > 30 : false;
    if (oncoming && this.activeFare) { this.oncomingDuration += dt; if (this.oncomingDuration >= 3) { this.style('nearMiss', 'AGAINST THE FLOW', 200, { key: 'oncoming', cooldown: 6, minTravel: 70 }); this.oncomingDuration = 0; } }
    else this.oncomingDuration = 0;
  }
  private pickup(passenger: Passenger) {
    const destination = DESTINATIONS[passenger.destination], legal = routeLength(findRoute(passenger, destination));
    const par = clamp(legal / 15.5 + 18, 25, 80);
    passenger.active = false;
    const person = PASSENGER_ARCHETYPES[passenger.archetype];
    this.fareStartTips = this.scoring.tips; this.fareDriven = 0;
    this.activeFare = { passenger: { ...passenger }, destination, remaining: par, par, elapsed: 0, base: Math.round(220 + legal * 2.6), tips: 0, distance: distance(passenger, destination), startDistance: legal, line: person.pickupLine };
    this.style('pickup', 'CLEAN PICKUP', 250, { key: `pickup-${passenger.id}`, minSpeed: 0, minTravel: 0, cooldown: 0 });
    this.status = 'boarding'; this.boardingUntil = this.time + .75; this.nextRouteUpdate = 0;
    if (this.options.mode !== 'trial') this.populatePassengers();
  }
  private deliver() {
    const fare = this.activeFare; if (!fare) return;
    const fraction = fare.remaining / fare.par;
    const grade: DeliveryReceipt['grade'] = fraction >= .25 ? 'BLAZING' : fraction >= .1 ? 'FAST' : fraction > 0 ? 'CLOSE' : 'LATE';
    const gradeTime = { BLAZING: 3, FAST: 2, CLOSE: 1, LATE: 0 }[grade];
    const tierBonus = { short: 1, medium: 2, long: 3, special: 3 }[fare.passenger.tier];
    const accuracy = Math.round(250 * clamp(1 - distance(this.vehicle.snapshot(), fare.destination) / fare.destination.radius, 0, 1));
    const fareBonus = Math.round(fare.base * Math.max(0, fraction) * .65);
    const fareScore = fare.base + fareBonus;
    const timeBonus = gradeTime + tierBonus;
    if (this.options.mode === 'arcade') this.shiftRemaining = Math.min(120, this.shiftRemaining + timeBonus);
    this.deliveries++; this.fareTotal += fareScore + accuracy; this.totalRoute += fare.startDistance;
    const tips = this.scoring.tips - this.fareStartTips;
    this.receipt = { id: ++this.nextReceipt, grade, destination: fare.destination.name, fare: fareScore, tips, accuracy, timeBonus: this.options.mode === 'arcade' ? timeBonus : 0, total: fareScore + tips + accuracy, time: this.time };
    this.scoring.delivery(fareScore + accuracy, this.time);
    if (accuracy > 160) { this.scoring.push('delivery', 'PRECISION STOP', accuracy, this.time); this.completeLesson(8); }
    this.scoring.push('info', PASSENGER_ARCHETYPES[fare.passenger.archetype].arrivalLine, 0, this.time);
    this.vehicle.damage = 0; this.activeFare = undefined; this.status = 'delivery'; this.receiptUntil = this.time + 2.1; this.nextBoarding = this.time + 1.3;
    this.completeLesson(9);
    if (this.options.mode === 'trial') {
      const trial = TRIALS[this.options.trial];
      if (this.deliveries >= trial.destinations.length) { this.finish(); return; }
      const p: Passenger = { id: this.nextPassenger++, x: this.vehicle.snapshot().x, z: this.vehicle.snapshot().z, archetype: this.deliveries * 3, tier: 'medium', destination: trial.destinations[this.deliveries], active: true };
      this.passengers = [p];
    } else {
      const car = this.vehicle.snapshot();
      const destinations = DESTINATIONS.filter(d => d.id !== fare.destination.id && distance(d, car) > 130 && distance(d, car) < 420);
      const next = destinations[Math.floor(this.random() * destinations.length)] ?? DESTINATIONS[(fare.destination.id + 1) % 32];
      this.passengers.push({ id: this.nextPassenger++, x: fare.destination.x + 6, z: fare.destination.z + 24, archetype: Math.floor(this.random() * 24), tier: distance(next, car) < 285 ? 'short' : 'medium', destination: next.id, active: true });
    }
    this.nextRouteUpdate = 0;
  }
  private updateLessons(speedKmh: number, _dt: number) {
    if (!this.lesson || this.lesson.complete) return;
    if (this.lesson.index === 0) { this.lesson.progress = clamp(speedKmh / 70, 0, 1); if (speedKmh >= 70) this.completeLesson(0); }
    if (this.lesson.index === 1) { if (speedKmh >= 50) this.lessonHadSpeed = true; this.lesson.progress = this.lessonHadSpeed ? .65 : speedKmh / 100; if (this.lessonHadSpeed && speedKmh < 2) this.completeLesson(1); }
  }
  private completeLesson(index: number) {
    if (this.lesson && this.lesson.index === index && !this.lesson.complete) { this.lesson.complete = true; this.lesson.progress = 1; this.lessonCompleteAt = this.time + 1.5; this.scoring.push('delivery', 'LESSON COMPLETE', 1000, this.time); this.scoring.score += 1000; }
  }
  private target(): Destination | Passenger | undefined {
    if (this.activeFare) return this.activeFare.destination;
    if (this.lesson?.index === 6) { const ramp = RAMPS[0]; return { id: -2, name: 'FERRY LAUNCH', district: 'Harbor Loop', color: '#65e0df', landmark: 'ferry', radius: 8, x: ramp.x + Math.sin(ramp.heading) * 60, z: ramp.z + Math.cos(ramp.heading) * 60 }; }
    if (this.lesson?.index === 7) return { ...SHORTCUTS[0].exit, id: -3, name: 'CONTAINER RUN', district: 'Harbor Loop', color: '#65e0df', landmark: 'ferry', radius: 8 };
    const car = this.vehicle.snapshot();
    return this.passengers.filter(p => p.active).reduce<Passenger | undefined>((a, b) => !a || distance(b, car) < distance(a, car) ? b : a, undefined);
  }
  private updateRoute() { const target = this.target(); this.route = target ? findRoute(this.vehicle.snapshot(), target) : []; }
  snapshot(): GameSnapshot {
    return { status: this.status, time: this.time, shiftRemaining: this.shiftRemaining, score: this.scoring.score, fareTotal: this.fareTotal, tips: this.scoring.tips, deliveries: this.deliveries, collisions: this.collisions, bestChain: this.scoring.bestChain, pulse: this.scoring.pulse, multiplier: this.scoring.multiplier, tailwind: this.scoring.tailwind, vehicle: this.vehicle.snapshot(), traffic: this.traffic.map(t => ({ ...t.view })), passengers: this.passengers.filter(p => p.active).map(p => ({ ...p })), activeFare: this.activeFare ? { ...this.activeFare } : undefined, target: this.target(), route: this.route, events: this.scoring.events.slice(), delivery: this.receipt, result: this.result, lesson: this.lesson ? { ...this.lesson } : undefined, discovered: [...this.discovered], district: districtAt(this.vehicle.snapshot().x, this.vehicle.snapshot().z), fps: 60, countdown: this.countdown };
  }
  finish() {
    if (this.result) return;
    this.status = 'finished';
    const score = Math.round(this.scoring.score), trial = TRIALS[this.options.trial] ?? TRIALS[0];
    const trialDone = this.options.mode === 'trial' && this.deliveries >= trial.destinations.length;
    const medal = trialDone ? this.time <= trial.gold ? 'gold' : this.time <= trial.silver ? 'silver' : this.time <= trial.bronze ? 'bronze' : undefined : undefined;
    const rank = this.lesson?.complete ? 'S' : score >= 20000 ? 'S' : score >= 10000 ? 'A' : score >= 5000 ? 'B' : score >= 1800 ? 'C' : 'D';
    this.result = { id: `${this.options.seed}-${this.options.mode}-${Date.now()}`, mode: this.options.mode, taxi: this.options.taxi, seed: this.options.seed, score, fares: this.fareTotal, tips: this.scoring.tips, deliveries: this.deliveries, bestChain: this.scoring.bestChain, collisions: this.collisions, shortcuts: [...this.discovered], duration: this.time, rank, efficiency: this.totalDriven > 0 ? clamp(this.totalRoute / this.totalDriven, 0, 1.5) : 0, assist: this.options.assists, trial: this.options.trial, medal, lesson: this.lesson?.complete ? this.lesson.index : undefined, date: Date.now() };
  }
  replay(): Replay { return { version: 1, options: { ...this.options }, frames: this.frames.map(f => [...f] as [number, number, number, number]), samples: this.samples.map(s => ({ ...s })), result: this.result ? { ...this.result } : undefined }; }
  dispose() { if (!this.disposed) { this.vehicle.dispose(); this.disposed = true; } }
}
