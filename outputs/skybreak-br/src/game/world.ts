import type { Building, Landmark, Obstacle, Traversal, V2, V3 } from "./types";
export const WORLD_SIZE = 1200;
export const LANDMARKS: Landmark[] = [
  {
    id: "aerie",
    name: "Aerie Market",
    x: -245,
    z: 135,
    radius: 75,
    style: "town",
    color: "#dd876c",
  },
  {
    id: "array",
    name: "Sunken Array",
    x: -280,
    z: -210,
    radius: 80,
    style: "array",
    color: "#8dc7d6",
  },
  {
    id: "kiln",
    name: "Kilnworks",
    x: 25,
    z: -35,
    radius: 70,
    style: "industrial",
    color: "#c48b60",
  },
  {
    id: "orchard",
    name: "Orchard Steps",
    x: 240,
    z: 240,
    radius: 90,
    style: "orchard",
    color: "#b9ce85",
  },
  {
    id: "abbey",
    name: "Wind Abbey",
    x: 195,
    z: -285,
    radius: 75,
    style: "ruin",
    color: "#ddd9b6",
  },
  {
    id: "docks",
    name: "Breaker Docks",
    x: 45,
    z: 380,
    radius: 75,
    style: "harbor",
    color: "#76b4bf",
  },
];
const rawHeight = (x: number, z: number) =>
  14 +
  Math.sin(x * 0.007) * 5 +
  Math.cos(z * 0.01) * 4 +
  Math.sin((x + z) * 0.015) * 2 +
  35 * Math.exp(-((x - 195) ** 2 + (z + 285) ** 2) / 12500);
export function heightAt(x: number, z: number): number {
  let h = rawHeight(x, z);
  for (const p of LANDMARKS) {
    const d = Math.hypot(x - p.x, z - p.z),
      blend = Math.max(0, Math.min(1, (p.radius + 30 - d) / 35));
    h = h * (1 - blend) + rawHeight(p.x, p.z) * blend;
  }
  const edge = Math.max(0, Math.min(1, (550 - Math.hypot(x, z)) / 65));
  return h * edge - (1 - edge) * 12;
}
export const locationAt = (p: V2) =>
  LANDMARKS.find((l) => Math.hypot(p.x - l.x, p.z - l.z) < l.radius + 25)
    ?.name ?? (heightAt(p.x, p.z) < 1 ? "The Voidsea" : "Highwake Wilds");
export const BUILDINGS: Building[] = [];
export const OBSTACLES: Obstacle[] = [];
export const TRAVERSALS: Traversal[] = [];
let id = 1;
for (const [region, l] of LANDMARKS.entries()) {
  const count = region === 0 ? 14 : region === 3 ? 7 : 10;
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / 4),
      col = i % 4,
      x = l.x + (col - 1.5) * 24,
      z = l.z + (row - 1) * 28;
    const width = 12 + (i % 3) * 2,
      depth = 13 + (i % 2) * 3,
      height = 5 + (i % 3) * 2;
    const b: Building = {
      id: id++,
      x,
      z,
      width,
      depth,
      height,
      style:
        region === 4
          ? "ruin"
          : region === 2 || region === 5
            ? "warehouse"
            : i % 6 === 0
              ? "tower"
              : "house",
      color: ["#eee2c9", "#d6d7bd", "#d3ddd1", "#e6d2b5"][i % 4],
      roof: ["#a3654e", "#55898d", "#c09562"][region % 3],
      rotation: 0,
      door: true,
    };
    BUILDINGS.push(b);
    const y = heightAt(x, z);
    // Four walls, an actual doorway and walkable roof. Boxes are shared by Rapier and sight tests.
    OBSTACLES.push(
      { x: x - width / 2, z, y, width: 0.55, depth, height, kind: "building" },
      { x: x + width / 2, z, y, width: 0.55, depth, height, kind: "building" },
      { x, z: z - depth / 2, y, width, depth: 0.55, height, kind: "building" },
    );
    for (const side of [-1, 1])
      OBSTACLES.push({
        x: x + side * (width / 4 + 1),
        z: z + depth / 2,
        y,
        width: width / 2 - 2,
        depth: 0.55,
        height,
        kind: "building",
      });
    OBSTACLES.push(
      {
        x,
        z: z + depth / 2,
        y: y + 3,
        width: 4,
        depth: 0.55,
        height: height - 3,
        kind: "building",
      },
      {
        x,
        z,
        y: y + height,
        width: width + 0.8,
        depth: depth + 0.8,
        height: 0.4,
        kind: "building",
      },
    );
  }
  const bx = l.x - 48,
    bz = l.z - 38;
  for (let i = 0; i < 7; i++)
    OBSTACLES.push({
      x: bx + i * 14,
      z: bz,
      y: heightAt(bx + i * 14, bz),
      width: 8,
      depth: 1,
      height: 1.2,
      kind: "wall",
    });
  TRAVERSALS.push({
    id: id++,
    kind: region === 4 ? "vent" : "zipline",
    x: l.x - 36,
    y: heightAt(l.x - 36, l.z) + 9,
    z: l.z,
    end: { x: l.x + 36, y: heightAt(l.x + 36, l.z + 38) + 9, z: l.z + 38 },
    radius: 3,
  });
}
for (let i = 0; i < 100; i++) {
  const a = i * 2.399963,
    r = 90 + ((i * 83) % 440),
    x = Math.cos(a) * r,
    z = Math.sin(a) * r;
  if (LANDMARKS.some((l) => Math.hypot(x - l.x, z - l.z) < l.radius + 20))
    continue;
  OBSTACLES.push({
    x,
    z,
    y: heightAt(x, z),
    width: 2 + (i % 4),
    depth: 2 + (i % 3),
    height: 2 + (i % 3),
    kind: "rock",
  });
}
export const PRACTICE = { x: -245, z: 218 };
export function rayBox(
  origin: V3,
  dir: V3,
  b: Obstacle,
  max: number,
): number | undefined {
  let near = 0,
    far = max;
  for (const [o, d, min, maxv] of [
    [origin.x, dir.x, b.x - b.width / 2, b.x + b.width / 2],
    [origin.y, dir.y, b.y, b.y + b.height],
    [origin.z, dir.z, b.z - b.depth / 2, b.z + b.depth / 2],
  ]) {
    if (Math.abs(d) < 1e-8) {
      if (o < min || o > maxv) return;
      continue;
    }
    let a = (min - o) / d,
      c = (maxv - o) / d;
    if (a > c) [a, c] = [c, a];
    near = Math.max(near, a);
    far = Math.min(far, c);
    if (near > far) return;
  }
  return near;
}
export function clearSight(a: V3, b: V3): boolean {
  const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  if (len < 0.01) return true;
  const dir = {
    x: (b.x - a.x) / len,
    y: (b.y - a.y) / len,
    z: (b.z - a.z) / len,
  };
  for (let distance = 2; distance < len - 1; distance += 3) {
    const x = a.x + dir.x * distance,
      z = a.z + dir.z * distance;
    if (a.y + dir.y * distance < heightAt(x, z) + 0.1) return false;
  }
  return !OBSTACLES.some((o) => {
    const t = rayBox(a, dir, o, len);
    return t !== undefined && t < len - 0.2;
  });
}
export function blockedAt(
  x: number,
  z: number,
  radius = 0.45,
  y = heightAt(x, z),
): boolean {
  return OBSTACLES.some(
    (o) =>
      y + 1.6 > o.y &&
      y < o.y + o.height &&
      Math.abs(x - o.x) < o.width / 2 + radius &&
      Math.abs(z - o.z) < o.depth / 2 + radius,
  );
}
export function safePoint(p: V2): V2 {
  if (!blockedAt(p.x, p.z)) return p;
  for (let r = 2; r < 30; r += 2)
    for (let i = 0; i < 12; i++) {
      const q = {
        x: p.x + Math.cos((i * Math.PI) / 6) * r,
        z: p.z + Math.sin((i * Math.PI) / 6) * r,
      };
      if (!blockedAt(q.x, q.z)) return q;
    }
  return { x: 0, z: 50 };
}
