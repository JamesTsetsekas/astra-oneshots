import { GameSession } from "../src/game/session";
import {
  DEFAULT_SETTINGS,
  EMPTY_INPUT,
  type InputFrame,
  type Vec2,
} from "../src/game/types";
import { MISSIONS } from "../src/game/content";
import { findRoute, lineClear, blocked } from "../src/game/world";
const s = await GameSession.create({
  ...DEFAULT_SETTINGS,
  traffic: 0,
  crowds: 0,
});
const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
let ticks = 0;
const maxTicks = 180000;
function step(input: Partial<InputFrame> = {}) {
  if (++ticks > maxTicks) throw new Error("Story pilot timed out");
  const enemies = s.enemies
    .filter(
      (e) => e.hp > 0 && distance(e, s.player) < 23 && lineClear(e, s.player),
    )
    .sort((a, b) => distance(a, s.player) - distance(b, s.player));
  const e = enemies[0];
  input.heal = s.player.health < 45 && ticks % 15 === 0;
  if (s.alert.tier > 0 && s.player.speed < 1 && ticks % 240 === 0)
    input.gadget = true;
  if (e && s.player.vehicleId === undefined) {
    if (s.player.holstered) s.toggleHolster();
    input.aim = true;
    input.aimYaw = Math.atan2(e.x - s.player.x, e.z - s.player.z);
    input.aimPitch = Math.atan2(
      e.y + 1.1 - (s.player.y + 1.45),
      distance(e, s.player),
    );
    input.fire = true;
    input.reload = s.player.ammo < 1;
    input.heal = s.player.health < 40 && ticks % 15 === 0;
  }
  s.step({ ...EMPTY_INPUT, ...input }, 1 / 60);
  if (s.player.dead)
    throw new Error(
      "Pilot incapacitated at " + s.mission?.id + " stage " + s.mission?.stage,
    );
}
function pulse(key: keyof InputFrame) {
  step({ [key]: true });
  step();
}
function walk(goal: Vec2, radius = 1.2) {
  let route = findRoute(s.player, goal),
    idx = 1,
    stuck = 0,
    last = { x: s.player.x, z: s.player.z };
  for (let n = 0; n < 18000 && distance(s.player, goal) > radius; n++) {
    let point = lineClear(s.player, goal) ? goal : (route[idx] ?? goal);
    if (distance(s.player, point) < 2 && idx < route.length - 1) {
      idx++;
      point = route[idx];
    }
    const dx = point.x - s.player.x,
      dz = point.z - s.player.z,
      d = Math.hypot(dx, dz);
    step({ moveX: dx / d, moveZ: dz / d, sprint: !s.player.aiming });
    if (n % 90 === 0) {
      stuck = distance(last, s.player) < 0.5 ? stuck + 1 : 0;
      last = { x: s.player.x, z: s.player.z };
      if (stuck > 3)
        throw new Error(
          `Walk stuck at ${s.player.x.toFixed(1)},${s.player.z.toFixed(1)} → ${goal.x},${goal.z}`,
        );
    }
  }
}
function drive(points: Vec2[], stop = true, fast = false) {
  let idx = 0,
    stalled = 0;
  for (let n = 0; n < 24000; n++) {
    const goal = points[idx],
      d = distance(s.player, goal);
    if (d < 9 && idx < points.length - 1) {
      idx++;
      continue;
    }
    if (idx === points.length - 1 && d < 10 && (!stop || s.player.speed < 2)) {
      step();
      return;
    }
    stalled = s.player.speed < 0.5 && d > 12 ? stalled + 1 : 0;
    if (stalled > 150) {
      for (let j = 0; j < 100; j++)
        step({
          brake: 1,
          steer: 1,
          gadget: j === 0,
          heal: j === 0 && s.player.health < 60,
        });
      stalled = 0;
    }
    const heading = Math.atan2(goal.x - s.player.x, goal.z - s.player.z),
      error = Math.atan2(
        Math.sin(heading - s.player.heading),
        Math.cos(heading - s.player.heading),
      );
    const desired =
      idx === points.length - 1 && d < 10 && stop
        ? 0
        : Math.abs(error) > 0.6
          ? 5
          : Math.min(fast ? 29 : 15, 6 + d * 0.16);
    step({
      steer: Math.abs(error) < 0.07 ? 0 : Math.max(-1, Math.min(1, error * 2)),
      throttle: s.player.speed < desired - 0.5 ? 1 : 0,
      brake: s.player.speed > desired + 1 ? 1 : 0,
      handbrake: desired === 0,
    });
  }
  throw new Error("Drive timed out " + JSON.stringify(s.player));
}
function result() {
  if (!s.result) throw new Error("Expected result " + s.mission?.id);
  console.log(
    JSON.stringify({
      mission: s.result.name,
      grade: s.result.grade,
      reward: s.result.reward,
      seconds: s.result.duration,
      health: s.player.health,
      cash: s.player.cash,
    }),
  );
  s.dismissResult();
}
try {
  walk({ x: -177, z: -300 });
  pulse("interact");
  drive([
    { x: -174, z: -194 },
    { x: -162, z: -180 },
    { x: -15, z: -180 },
    { x: 0, z: -193 },
    { x: 0, z: -255 },
  ]);
  pulse("exit");
  walk({ x: 3, z: -249 }, 3);
  pulse("interact");
  result();
  s.startMission("lost-manifest");
  walk({ x: 0, z: -180 });
  walk({ x: -284, z: -180 }, 2);
  walk({ x: -284, z: -155 }, 2);
  for (let i = 0; i < 330; i++) step({ interact: true });
  for (let i = 0; i < 200; i++) step();
  walk({ x: -284, z: -180 });
  walk({ x: -180, z: -180 });
  walk({ x: -180, z: -300 });
  walk({ x: -192, z: -300 }, 2);
  pulse("interact");
  result();
  s.startMission("hot-cargo");
  walk({ x: -180, z: 0 });
  walk({ x: 180, z: 0 });
  walk({ x: 180, z: 80 }, 6);
  for (let i = 0; i < 800 && s.mission?.stage === 1; i++) step();
  walk({ x: 184, z: 81 }, 2);
  pulse("interact");
  drive([
    { x: 180, z: 20 },
    { x: 180, z: -260 },
    { x: 180, z: -275 },
  ]);
  pulse("exit");
  walk({ x: 194, z: -275 }, 3);
  pulse("interact");
  result();
  s.startMission("signal-breakwater");
  walk({ x: 184, z: -270 }, 4);
  pulse("interact");
  if (s.player.vehicleId === undefined) {
    const van = s.vehicles[2];
    walk(van, 4);
    pulse("interact");
  }
  drive([
    { x: 180, z: -344 },
    { x: 166, z: -360 },
    { x: 20, z: -360 },
    { x: 8, z: -344 },
    { x: 8, z: 165 },
    { x: 20, z: 180 },
    { x: 290, z: 180 },
  ]);
  pulse("exit");
  walk({ x: 290, z: 202 }, 2);
  for (let i = 0; i < 500; i++) step({ interact: true });
  for (let i = 0; i < 2500 && s.mission?.stage === 2; i++) step();
  walk({ x: 290, z: 180 }, 3);
  const van = s.vehicles[2];
  walk(van, 4);
  pulse("interact");
  drive(
    [
      { x: 346, z: 180 },
      { x: 360, z: 162 },
      { x: 360, z: -344 },
      { x: 343, z: -360 },
      { x: -160, z: -360 },
      { x: -180, z: -344 },
      { x: -180, z: -300 },
    ],
    true,
    true,
  );
  pulse("exit");
  walk({ x: -202, z: -300 }, 2);
  for (let i = 0; i < 7200 && s.alert.tier > 0; i++) step({ crouch: true });
  for (let i = 0; i < 200; i++) step();
  pulse("interact");
  result();
  console.log(
    JSON.stringify({
      status: "complete",
      ticks,
      simulationSeconds: s.time,
      completed: s.completed,
      cash: s.player.cash,
      health: s.player.health,
    }),
  );
} catch (e) {
  console.error(String(e));
  console.error(
    JSON.stringify({
      ticks,
      player: s.player,
      mission: s.mission,
      vehicle: s.snapshot().vehicle,
      van: s.vehicles[2],
      patrol: s.vehicles[7],
      enemies: s.enemies.map((e) => ({
        hp: e.hp,
        x: e.x,
        z: e.z,
        role: e.role,
      })),
      alert: s.alert,
    }),
  );
  process.exitCode = 1;
} finally {
  s.dispose();
}
