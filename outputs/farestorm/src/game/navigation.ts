import type { Vec2, Vec3 } from './types';
import { heightAt, ROAD_X, ROAD_Z } from './world';
export const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
export const routeLength = (route: Vec2[]) => route.reduce((sum, p, i) => sum + (i ? distance(p, route[i - 1]) : 0), 0);
const nearest = (n: number, values: number[]) => values.reduce((a, b) => Math.abs(n - a) < Math.abs(n - b) ? a : b);
function roadProjection(p: Vec2): Vec2 {
  const x = nearest(p.x, ROAD_X), z = nearest(p.z, ROAD_Z);
  return Math.abs(x - p.x) < Math.abs(z - p.z) ? { x, z: Math.max(-450, Math.min(450, p.z)) } : { x: Math.max(-640, Math.min(640, p.x)), z };
}
/** Small deterministic street graph; shortcuts intentionally remain a driver's discovery. */
export function findRoute(start: Vec2, end: Vec2): Vec3[] {
  const from = roadProjection(start), to = roadProjection(end);
  const nodes: Vec2[] = [from, to, ...ROAD_X.flatMap(x => ROAD_Z.map(z => ({ x, z })))];
  const cost = new Float64Array(nodes.length).fill(Infinity); cost[0] = 0;
  const previous = new Int16Array(nodes.length).fill(-1), visited = new Set<number>();
  for (let n = 0; n < nodes.length; n++) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (u < 0 || cost[i] < cost[u])) u = i;
    if (u < 0 || !Number.isFinite(cost[u]) || u === 1) break;
    visited.add(u);
    for (let v = 0; v < nodes.length; v++) {
      if (visited.has(v)) continue;
      if (Math.abs(nodes[u].x - nodes[v].x) > .01 && Math.abs(nodes[u].z - nodes[v].z) > .01) continue;
      const next = cost[u] + distance(nodes[u], nodes[v]);
      if (next < cost[v]) { cost[v] = next; previous[v] = u; }
    }
  }
  const path: Vec2[] = [end]; let index = 1;
  while (index !== -1) { path.unshift(nodes[index]); index = previous[index]; }
  path.unshift(start);
  const distinct = path.filter((p, i) => i === 0 || distance(p, path[i - 1]) > .2);
  return distinct.filter((p, i) => {
    if (i === 0 || i === distinct.length - 1) return true;
    const a = distinct[i - 1], b = distinct[i + 1];
    return Math.abs((p.x - a.x) * (b.z - p.z) - (p.z - a.z) * (b.x - p.x)) > .1;
  }).map(p => ({ ...p, y: heightAt(p.x, p.z) + .12 }));
}
export function nearestStreet(p: Vec2): Vec2 { return roadProjection(p); }
