import { cover, MAP_HALF_X, MAP_HALF_Z } from "./data";
export type Point = { x: number; z: number };
export function blocked(
  x: number,
  z: number,
  radius = 0.38,
  feet = 0,
): boolean {
  if (Math.abs(x) > MAP_HALF_X - radius || Math.abs(z) > MAP_HALF_Z - radius)
    return true;
  return cover.some(
    (c) =>
      c.h > feet + 0.12 &&
      Math.abs(x - c.x) < c.w / 2 + radius &&
      Math.abs(z - c.z) < c.d / 2 + radius,
  );
}
export function floorAt(x: number, z: number, maximum: number): number {
  let floor = 0;
  for (const c of cover)
    if (
      c.h <= maximum &&
      Math.abs(x - c.x) < c.w / 2 + 0.3 &&
      Math.abs(z - c.z) < c.d / 2 + 0.3
    )
      floor = Math.max(floor, c.h);
  return floor;
}
// Exact ray/slab intersection; shared by server hitscan, vision and renderer tracers.
export function wallDistance(
  x: number,
  y: number,
  z: number,
  dx: number,
  dy: number,
  dz: number,
  limit: number,
): number {
  let result = limit;
  for (const c of cover) {
    let near = 0,
      far = result;
    for (const [origin, direction, low, high] of [
      [x, dx, c.x - c.w / 2, c.x + c.w / 2],
      [y, dy, 0, c.h],
      [z, dz, c.z - c.d / 2, c.z + c.d / 2],
    ]) {
      if (Math.abs(direction) < 1e-8) {
        if (origin < low || origin > high) {
          far = -1;
          break;
        }
      } else {
        const a = (low - origin) / direction,
          b = (high - origin) / direction;
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
      }
    }
    if (near <= far && far >= 0) result = Math.min(result, Math.max(0, near));
  }
  return result;
}
export function clearLine(a: Point, b: Point, height = 1.5): boolean {
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  return (
    length < 0.01 ||
    wallDistance(
      a.x,
      height,
      a.z,
      (b.x - a.x) / length,
      0,
      (b.z - a.z) / length,
      length,
    ) >=
      length - 0.1
  );
}
const cell = 2,
  width = 57,
  height = 47;
const grid = new Uint8Array(width * height);
const position = (n: number): Point => ({
  x: (n % width) * cell - 56,
  z: Math.floor(n / width) * cell - 46,
});
for (let i = 0; i < grid.length; i++) {
  const p = position(i);
  grid[i] = Number(!blocked(p.x, p.z, 0.7));
}
function nearest(p: Point): number {
  const x = Math.max(0, Math.min(width - 1, Math.round((p.x + 56) / cell))),
    z = Math.max(0, Math.min(height - 1, Math.round((p.z + 46) / cell)));
  if (grid[z * width + x]) return z * width + x;
  let best = -1,
    distance = Infinity;
  for (let i = 0; i < grid.length; i++)
    if (grid[i]) {
      const a = position(i),
        d = Math.hypot(a.x - p.x, a.z - p.z);
      if (d < distance) {
        distance = d;
        best = i;
      }
    }
  return best;
}
export function walkableLine(a: Point, b: Point): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.45));
  for (let i = 0; i <= steps; i++)
    if (
      blocked(
        a.x + ((b.x - a.x) * i) / steps,
        a.z + ((b.z - a.z) * i) / steps,
        0.55,
      )
    )
      return false;
  return true;
}
export function findPath(a: Point, b: Point): Point[] {
  if (walkableLine(a, b)) return [b];
  const start = nearest(a),
    end = nearest(b);
  if (start < 0 || end < 0) return [];
  const distance = new Float32Array(grid.length).fill(Infinity),
    previous = new Int32Array(grid.length).fill(-1),
    closed = new Uint8Array(grid.length);
  distance[start] = 0;
  const queue = [start];
  const goal = position(end);
  while (queue.length) {
    let index = 0,
      priority = Infinity;
    for (let j = 0; j < queue.length; j++) {
      const n = queue[j],
        p = position(n),
        f = distance[n] + Math.hypot(p.x - goal.x, p.z - goal.z) / cell;
      if (f < priority) {
        priority = f;
        index = j;
      }
    }
    const n = queue.splice(index, 1)[0];
    if (n === end) break;
    if (closed[n]) continue;
    closed[n] = 1;
    const nx = n % width,
      nz = Math.floor(n / width);
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        if (
          (!dx && !dz) ||
          nx + dx < 0 ||
          nx + dx >= width ||
          nz + dz < 0 ||
          nz + dz >= height
        )
          continue;
        const next = n + dx + dz * width;
        if (
          !grid[next] ||
          closed[next] ||
          (dx && dz && (!grid[n + dx] || !grid[n + dz * width]))
        )
          continue;
        const cost = distance[n] + (dx && dz ? 1.4143 : 1);
        if (cost < distance[next]) {
          distance[next] = cost;
          previous[next] = n;
          queue.push(next);
        }
      }
  }
  if (start !== end && previous[end] === -1) return [];
  const path: Point[] = [];
  let n = end;
  while (n !== start && n >= 0) {
    path.unshift(position(n));
    n = previous[n];
  }
  // String-pull only collision-free segments, never cutting a convex corner.
  const result: Point[] = [];
  let from = a;
  while (path.length) {
    let furthest = 0;
    for (let i = 1; i < path.length; i++) {
      if (walkableLine(from, path[i])) furthest = i;
      else break;
    }
    const next = path[furthest];
    result.push(next);
    from = next;
    path.splice(0, furthest + 1);
  }
  return result;
}
export const patrolPoints: Point[] = [
  { x: -47, z: 0 },
  { x: -31, z: 4 },
  { x: -29, z: -15 },
  { x: -15, z: -18 },
  { x: 0, z: -20 },
  { x: 12, z: 2 },
  { x: 0, z: 26 },
  { x: -20, z: 18 },
  { x: 31, z: 4 },
  { x: 31, z: -16 },
  { x: 48, z: -7 },
  { x: 25, z: 22 },
];
