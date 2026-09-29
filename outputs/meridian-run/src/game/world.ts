import type {
  Building,
  Destination,
  Road,
  Shortcut,
  Vec2,
  Vec3,
} from "./types";
export const WORLD_BOUNDS = { minX: -450, maxX: 450, minZ: -450, maxZ: 450 };
export const ROAD_X = [-360, -180, 0, 180, 360],
  ROAD_Z = [-360, -180, 0, 180, 360];
const smooth = (a: number, b: number, t: number) => {
  const n = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return n * n * (3 - 2 * n);
};
export function heightAt(x: number, z: number) {
  return 27 * smooth(20, 340, z) * (1 - 0.6 * smooth(-260, 260, x));
}
export function districtAt(x: number, z: number) {
  return z < -220
    ? "South Quay"
    : x < -220
      ? "Foundry Row"
      : x > 220
        ? "Glassline"
        : z > 200
          ? "Lantern Hill"
          : z > 0
            ? "Canal Loop"
            : "Tide Market";
}
export function distanceToSegment(p: Vec2, a: Vec2, b: Vec2) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1),
      ),
    );
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
}
const samples = (a: Vec2, b: Vec2) => {
  const count = Math.ceil(Math.hypot(a.x - b.x, a.z - b.z) / 15);
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count,
      x = a.x + (b.x - a.x) * t,
      z = a.z + (b.z - a.z) * t;
    return { x, z, y: heightAt(x, z) };
  });
};
export const ROADS: Road[] = [
  ...ROAD_X.map((x, i) => ({
    id: "avenue" + i,
    name: [
      "Foundry Way",
      "Lantern Street",
      "Meridian Avenue",
      "Glassline Drive",
      "Breakwater Road",
    ][i],
    width: i === 2 ? 26 : 23,
    surface: "asphalt" as const,
    points: samples({ x, z: -415 }, { x, z: 410 }),
  })),
  ...ROAD_Z.map((z, i) => ({
    id: "cross" + i,
    name: [
      "Quay Boulevard",
      "Cargo Cross",
      "Canal Road",
      "Signal Avenue",
      "Hillcrest",
    ][i],
    width: 24,
    surface: i === 4 ? ("cobble" as const) : ("asphalt" as const),
    points: samples({ x: -410, z }, { x: 410, z }),
  })),
];
export const SHORTCUTS: Shortcut[] = [
  {
    id: 0,
    name: "Tram maintenance",
    entry: { x: -350, z: -350 },
    exit: { x: -190, z: -190 },
    width: 15,
    kind: "tram",
    bonus: 0,
  },
  {
    id: 1,
    name: "Garden path",
    entry: { x: 12, z: 12 },
    exit: { x: 167, z: 164 },
    width: 14,
    kind: "park",
    bonus: 0,
  },
  {
    id: 2,
    name: "Container cut",
    entry: { x: 195, z: -347 },
    exit: { x: 343, z: -195 },
    width: 16,
    kind: "deck",
    bonus: 0,
  },
  {
    id: 3,
    name: "Hillside service",
    entry: { x: -165, z: 196 },
    exit: { x: -15, z: 346 },
    width: 14,
    kind: "alley",
    bonus: 0,
  },
];
export const RAMPS = [
  {
    id: 1,
    x: 256,
    z: -280,
    heading: Math.PI / 4,
    width: 10,
    length: 18,
    height: 3.2,
  },
];
export const DESTINATIONS: Destination[] = [
  ["TIDE MARKET", 0, -255, "market", "#dca46b"],
  ["VEY COURIER OFFICE", -180, -300, "cafe", "#6c9591"],
  ["MARA MOTOR WORKS", 180, -275, "market", "#b66f54"],
  ["LANTERN HILL", -180, 340, "park", "#91ac80"],
  ["NIGHT SHIFT SUPPLIES", -180, -80, "market", "#e3bf78"],
  ["MERIDIAN CIVIC SAFETY", 360, 90, "museum", "#90a9b7"],
  ["BREAKWATER CONTROL", 290, 180, "tower", "#b79773"],
  ["WAREHOUSE 12", -285, -180, "ferry", "#b1afa1"],
  ["ORIEL CINEMA", 0, 270, "museum", "#c597ae"],
  ["GLASSLINE EXCHANGE", 360, 285, "tower", "#83b8bd"],
  ["SOUTH QUAY TERMINAL", 180, -375, "ferry", "#dbb475"],
  ["THREADLINE", 0, -215, "market", "#c59792"],
].map((v, id) => ({
  id,
  name: v[0] as string,
  x: v[1] as number,
  z: v[2] as number,
  landmark: v[3] as Destination["landmark"],
  color: v[4] as string,
  district: districtAt(v[1] as number, v[2] as number),
  radius: 10,
}));
export const LANDMARKS = DESTINATIONS.map((d) => ({
  destinationId: d.id,
  x: d.x + (d.id % 2 ? -37 : 37),
  z: d.z,
  width: 24,
  depth: 24,
  height: d.landmark === "tower" ? 54 : d.landmark === "museum" ? 26 : 17,
  solid: ![1, 2, 4, 5, 6, 7, 11].includes(d.id) && d.landmark !== "park",
}));
export const INTERIORS = [
  {
    id: "safehouse",
    name: "Vey Courier Office",
    x: -205,
    z: -300,
    w: 18,
    d: 20,
    door: { x: -195, z: -300 },
  },
  {
    id: "garage",
    name: "Mara’s Motor Works",
    x: 205,
    z: -275,
    w: 20,
    d: 24,
    door: { x: 193, z: -275 },
  },
  {
    id: "store",
    name: "Night Shift Supplies",
    x: -205,
    z: -80,
    w: 18,
    d: 18,
    door: { x: -195, z: -80 },
  },
  {
    id: "precinct",
    name: "Civic Safety Lobby",
    x: 385,
    z: 90,
    w: 20,
    d: 22,
    door: { x: 374, z: 90 },
  },
  {
    id: "warehouse",
    name: "Warehouse 12",
    x: -284,
    z: -158,
    w: 28,
    d: 30,
    door: { x: -284, z: -174 },
  },
  {
    id: "control",
    name: "Port Control",
    x: 290,
    z: 205,
    w: 28,
    d: 32,
    door: { x: 290, z: 187 },
  },
  {
    id: "kiosk",
    name: "Threadline",
    x: 25,
    z: -228,
    w: 10,
    d: 12,
    door: { x: 19, z: -228 },
  },
];
let seed = 987123;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
export const BUILDINGS: Building[] = [];
for (let x = -414; x < 430; x += 34)
  for (let z = -414; z < 430; z += 34) {
    const px = x + random() * 5,
      pz = z + random() * 5,
      w = 19 + random() * 8,
      d = 19 + random() * 8,
      r = Math.hypot(w, d) / 2;
    if (
      ROADS.some((road) =>
        road.points.some(
          (p, i) =>
            i > 0 &&
            distanceToSegment({ x: px, z: pz }, road.points[i - 1], p) <
              road.width / 2 + r + 3,
        ),
      )
    )
      continue;
    if (
      SHORTCUTS.some(
        (s) =>
          distanceToSegment({ x: px, z: pz }, s.entry, s.exit) <
          s.width / 2 + r + 2,
      ) ||
      DESTINATIONS.some((p) => Math.hypot(p.x - px, p.z - pz) < 48) ||
      INTERIORS.some(
        (b) =>
          Math.abs(px - b.x) < b.w / 2 + w / 2 + 8 &&
          Math.abs(pz - b.z) < b.d / 2 + d / 2 + 8,
      )
    )
      continue;
    const district = districtAt(px, pz),
      style: Building["style"] =
        district === "Glassline"
          ? "tower"
          : district === "Foundry Row"
            ? "warehouse"
            : random() < 0.22
              ? "glass"
              : random() < 0.35
                ? "market"
                : "stucco";
    BUILDINGS.push({
      id: BUILDINGS.length,
      x: px,
      z: pz,
      width: w,
      depth: d,
      height:
        style === "tower"
          ? 40 + random() * 50
          : style === "warehouse"
            ? 9 + random() * 8
            : 14 + random() * 25,
      rotation: 0,
      style,
      color: ["#d6c7ac", "#bcbea6", "#ba8e78", "#a8b5ab", "#cbb790", "#799d9d"][
        Math.floor(random() * 6)
      ],
      district,
    });
  }
export function roadAt(x: number, z: number) {
  return ROADS.find((r) =>
    r.points.some(
      (p, i) =>
        i > 0 && distanceToSegment({ x, z }, r.points[i - 1], p) < r.width / 2,
    ),
  );
}
// Shared by physics, sight tests, and interior meshes. Every room has a four-metre doorway.
export const INTERIOR_WALLS = INTERIORS.flatMap((b) => {
  const east = b.door.x > b.x + b.w / 3,
    west = b.door.x < b.x - b.w / 3,
    south = b.door.z < b.z - b.d / 3;
  const walls: {
    id: string;
    x: number;
    z: number;
    width: number;
    depth: number;
    height: number;
  }[] = [];
  for (const sign of [-1, 1]) {
    const opening = sign > 0 ? east : west;
    if (opening) {
      for (const half of [-1, 1])
        walls.push({
          id: b.id,
          x: b.x + (sign * b.w) / 2,
          z: b.z + half * (b.d / 4 + 1),
          width: 0.55,
          depth: b.d / 2 - 2,
          height: 4,
        });
    } else
      walls.push({
        id: b.id,
        x: b.x + (sign * b.w) / 2,
        z: b.z,
        width: 0.55,
        depth: b.d,
        height: 4,
      });
    const openZ = sign < 0 && south;
    if (openZ) {
      for (const half of [-1, 1])
        walls.push({
          id: b.id,
          x: b.x + half * (b.w / 4 + 1),
          z: b.z + (sign * b.d) / 2,
          width: b.w / 2 - 2,
          depth: 0.55,
          height: 4,
        });
    } else
      walls.push({
        id: b.id,
        x: b.x,
        z: b.z + (sign * b.d) / 2,
        width: b.w,
        depth: 0.55,
        height: 4,
      });
  }
  return walls;
});
export const OBSTACLES = [
  ...BUILDINGS,
  ...LANDMARKS.filter((l) => l.solid),
  ...INTERIOR_WALLS,
];
export function blocked(x: number, z: number, r = 0.4) {
  return (
    Math.abs(x) > 447 ||
    Math.abs(z) > 447 ||
    OBSTACLES.some(
      (b) =>
        Math.abs(x - b.x) < b.width / 2 + r &&
        Math.abs(z - b.z) < b.depth / 2 + r,
    )
  );
}
export function lineClear(a: Vec2, b: Vec2) {
  const dx = b.x - a.x,
    dz = b.z - a.z;
  for (const wall of OBSTACLES) {
    let near = 0,
      far = 1;
    for (const [start, delta, min, max] of [
      [a.x, dx, wall.x - wall.width / 2, wall.x + wall.width / 2],
      [a.z, dz, wall.z - wall.depth / 2, wall.z + wall.depth / 2],
    ]) {
      if (Math.abs(delta) < 1e-8) {
        if (start < min || start > max) {
          near = 2;
          break;
        }
      } else {
        let t1 = (min - start) / delta,
          t2 = (max - start) / delta;
        if (t1 > t2) [t1, t2] = [t2, t1];
        near = Math.max(near, t1);
        far = Math.min(far, t2);
      }
    }
    if (near <= far && far > 0.001 && near < 0.999) return false;
  }
  return true;
}
export function findRoute(a: Vec2, b: Vec2): Vec3[] {
  const roomAt = (p: Vec2) =>
    INTERIORS.find(
      (room) =>
        Math.abs(p.x - room.x) < room.w / 2 - 0.5 &&
        Math.abs(p.z - room.z) < room.d / 2 - 0.5,
    );
  const fromRoom = roomAt(a),
    toRoom = roomAt(b),
    point = (p: Vec2) => ({ ...p, y: heightAt(p.x, p.z) });
  if (fromRoom && fromRoom !== toRoom)
    return [
      point(a),
      point(fromRoom.door),
      ...findRoute(fromRoom.door, b).slice(1),
    ];
  if (toRoom && fromRoom !== toRoom)
    return [...findRoute(a, toRoom.door), point(b)];
  if (fromRoom && fromRoom === toRoom) return [point(a), point(b)];
  const nearest = (n: number) =>
    ROAD_X.reduce((p, c) => (Math.abs(c - n) < Math.abs(p - n) ? c : p));
  const start = { x: nearest(a.x), z: nearest(a.z) },
    end = { x: nearest(b.x), z: nearest(b.z) };
  const candidates = [
    [
      a,
      { x: start.x, z: a.z },
      start,
      { x: end.x, z: start.z },
      end,
      { x: end.x, z: b.z },
      b,
    ],
    [
      a,
      { x: a.x, z: start.z },
      start,
      { x: start.x, z: end.z },
      end,
      { x: b.x, z: end.z },
      b,
    ],
  ];
  const score = (route: Vec2[]) =>
    route.reduce(
      (n, p, i) =>
        i
          ? n +
            Math.hypot(p.x - route[i - 1].x, p.z - route[i - 1].z) +
            (lineClear(route[i - 1], p) ? 0 : 500)
          : 0,
      0,
    );
  const route =
    score(candidates[0]) < score(candidates[1]) ? candidates[0] : candidates[1];
  if (lineClear(a, b) && roadAt(a.x, a.z)?.id === roadAt(b.x, b.z)?.id)
    return [
      { ...a, y: heightAt(a.x, a.z) },
      { ...b, y: heightAt(b.x, b.z) },
    ];
  return route
    .filter(
      (p, i) =>
        !i || Math.hypot(p.x - route[i - 1].x, p.z - route[i - 1].z) > 0.4,
    )
    .map((p) => ({ ...p, y: heightAt(p.x, p.z) }));
}
