import type { Building, Destination, Road, Shortcut, Vec2, Vec3 } from './types';

export const WORLD_BOUNDS = { minX: -700, maxX: 700, minZ: -500, maxZ: 500 };
export const ROAD_X = [-600, -400, -200, 0, 200, 400, 600];
export const ROAD_Z = [-420, -210, 0, 210, 420];
const smooth = (a: number, b: number, t: number) => { const n = Math.max(0, Math.min(1, (t - a) / (b - a))); return n * n * (3 - 2 * n); };

/** The same continuous terrain is sampled by the renderer, roads and Rapier heightfield. */
export function heightAt(x: number, z: number): number {
  return 27 * smooth(40, 360, z) * (1 - .48 * smooth(-300, 430, x)) + 4 * smooth(-650, -430, x) * smooth(-240, -50, z);
}
export function districtAt(x: number, z: number): string {
  if (z < -220) return x > 300 ? 'Sunward Beach' : 'Harbor Loop';
  if (x > 300) return z > 180 ? 'Highline' : 'Sunward Beach';
  if (x < -250) return z > 70 ? 'Old Steps' : 'Lantern Ward';
  return z > 70 ? 'Civic Crown' : 'Lantern Ward';
}
const points = (xs: Vec2[]): Vec3[] => xs.flatMap((p, i) => {
  if (!i) return [{ ...p, y: heightAt(p.x, p.z) }];
  const previous = xs[i - 1];
  const count = Math.ceil(Math.hypot(p.x - previous.x, p.z - previous.z) / 20);
  return Array.from({ length: count }, (_, j) => { const t = (j + 1) / count; const x = previous.x + (p.x - previous.x) * t; const z = previous.z + (p.z - previous.z) * t; return { x, y: heightAt(x, z), z }; });
});
export const ROADS: Road[] = [
  ...ROAD_X.map((x, i) => ({ id: `avenue-${i}`, name: ['Lantern Quay', 'Tram Street', 'Orchard Avenue', 'Stormway', 'Civic Avenue', 'Sunward Drive', 'Coast Road'][i], points: points([{ x, z: -450 }, { x, z: 450 }]), width: i === 3 ? 32 : 28, surface: 'asphalt' as const })),
  ...ROAD_Z.map((z, i) => ({ id: `boulevard-${i}`, name: ['Harbor Boulevard', 'Ferry Approach', 'Market Cross', 'Crown Terrace', 'Skyline Parkway'][i], points: points([{ x: -640, z }, { x: 640, z }]), width: 30, surface: i === 3 ? 'cobble' as const : 'asphalt' as const })),
  { id: 'harbor-loop', name: 'Harbor Loop', points: points([{ x: -600, z: -420 }, { x: -655, z: -370 }, { x: -655, z: -260 }, { x: -600, z: -210 }]), width: 27, surface: 'asphalt' },
  { id: 'beach-loop', name: 'Sunward Promenade', points: points([{ x: 600, z: -420 }, { x: 650, z: -350 }, { x: 650, z: 120 }, { x: 600, z: 210 }]), width: 30, surface: 'sand' },
  { id: 'crown-cut', name: 'Observatory Rise', points: points([{ x: 0, z: 210 }, { x: 200, z: 420 }]), width: 25, surface: 'asphalt' },
  { id: 'market-cut', name: 'Tram Ribbon', points: points([{ x: -400, z: 0 }, { x: -200, z: 210 }]), width: 24, surface: 'cobble' },
];

const destinationRows: Array<[string, number, number, Destination['landmark'], string]> = [
  ['MARIGOLD DINER', 0, -155, 'cafe', '#ff825d'], ['TURBINE TERMINAL', -200, -395, 'ferry', '#37cbd7'],
  ['THE CORAL PALMS', 400, -315, 'hotel', '#ff8c81'], ['GALEPORT AQUARIUM', 200, -390, 'museum', '#48cde0'],
  ['NORTHSTAR STADIUM', 0, 365, 'stadium', '#caff68'], ['MUSEUM OF TOMORROW', 200, 285, 'museum', '#ac9afa'],
  ['THE LANTERN MARKET', -400, -85, 'market', '#ff7863'], ['SUNWARD PIER', 600, -305, 'ferry', '#5dd4e9'],
  ['CROWN CONSERVATORY', -200, 285, 'park', '#b9e86b'], ['SKYLINE OBSERVATORY', 400, 340, 'tower', '#8ed5ea'],
  ['STORM RADIO', 0, 130, 'tower', '#ffaf60'], ['PAPER MOON CINEMA', -200, -95, 'museum', '#d09cfa'],
  ['THE BRASS EXCHANGE', -400, 135, 'market', '#e9bf61'], ['FERRY NINE', -400, -360, 'ferry', '#58bec8'],
  ['SEA GLASS HOTEL', 600, -90, 'hotel', '#5bdfc5'], ['BOARDWALK ARCADE', 400, -110, 'market', '#ff86b8'],
  ['ORCHARD STEPS', -400, 335, 'park', '#a6cf71'], ['CLOCKWORK CAFÉ', -600, 140, 'cafe', '#ffd76a'],
  ['HIGHLINE CLUB', 600, 320, 'tower', '#dc89fc'], ['MISTRAL GARDENS', 200, 120, 'park', '#d9ee8b'],
  ['ANCHOR RECORDS', -200, -280, 'market', '#e3a7f4'], ['CIVIC POOL', 200, -100, 'park', '#6bdded'],
  ['CROWN COURT', 0, 285, 'museum', '#ecceb0'], ['EAST WIND HOTEL', 600, 100, 'hotel', '#edb178'],
  ['TRAMWORKS', -600, 335, 'market', '#ee7a65'], ['COPPER KETTLE', -600, -100, 'cafe', '#daa26e'],
  ['MARINER HALL', -600, -325, 'museum', '#8fd7ca'], ['THE SIGNAL HOUSE', 0, -380, 'tower', '#95d7ea'],
  ['SUNSET GALLERIA', 400, 90, 'market', '#f69c7a'], ['HORIZON BATHS', 400, 285, 'park', '#c9e888'],
  ['MOONBRIDGE', -200, 130, 'hotel', '#adacdf'], ['BREAKWATER DEPOT', 200, -290, 'ferry', '#f5c358'],
];
export const DESTINATIONS: Destination[] = destinationRows.map(([name, x, z, landmark, color], id) => ({ id, name, x, z, landmark, color, radius: 10, district: districtAt(x, z) }));

const cuts: Array<[string, number, number, number, number, Shortcut['kind']]> = [
  ['Container Run', -190, -410, -10, -230, 'deck'], ['Ferry Launch', -590, -410, -410, -230, 'ramp'],
  ['Boardwalk Flyer', 410, -410, 590, -230, 'beach'], ['Dune Runner', 410, -200, 590, -10, 'beach'],
  ['Market Thread', -390, -200, -210, -10, 'alley'], ['Lantern Cut', -590, -200, -410, -10, 'alley'],
  ['Tram Maintenance', -390, 10, -210, 200, 'tram'], ['Crown Lawn', 10, 10, 190, 200, 'park'],
  ['Orchard Stair', -590, 220, -410, 410, 'ramp'], ['Upper Arcade', -390, 220, -210, 410, 'alley'],
  ['Museum Deck', 210, 220, 390, 410, 'deck'], ['Highline Drop', 410, 220, 590, 410, 'ramp'],
  ['Palm Alley', 210, -200, 390, -10, 'alley'], ['Radio Ribbon', -190, 10, -10, 200, 'tram'],
  ['Canal Hop', -190, -200, -10, -10, 'ramp'], ['Hotel Forecourt', 410, 10, 590, 200, 'park'],
  ['North Service', -190, 220, -10, 410, 'deck'], ['Sunset Tunnel', 210, 10, 390, 200, 'alley'],
];
export const SHORTCUTS: Shortcut[] = cuts.map(([name, x, z, ex, ez, kind], id) => ({ id, name, entry: { x, z }, exit: { x: ex, z: ez }, kind, width: kind === 'alley' ? 17 : 22, bonus: 350 + (kind === 'ramp' ? 150 : 0) }));
export const RAMPS = SHORTCUTS.filter(s => s.kind === 'ramp').map(s => {
  const distance = Math.hypot(s.exit.x - s.entry.x, s.exit.z - s.entry.z);
  const ux = (s.exit.x - s.entry.x) / distance, uz = (s.exit.z - s.entry.z) / distance;
  return { id: s.id, x: s.entry.x + ux * 52, z: s.entry.z + uz * 52, heading: Math.atan2(ux, uz), width: 12, length: 24, height: 4.5 };
});
export function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
}
export function roadAt(x: number, z: number): Road | undefined {
  return ROADS.find(r => r.points.some((p, i) => i > 0 && distanceToSegment({ x, z }, r.points[i - 1], p) < r.width * .52));
}
export const LANDMARKS = DESTINATIONS.map(d => {
  const side = d.id % 2 === 0 ? -1 : 1;
  const candidates = [45, 65, 85, -45, -65, -85].flatMap(offset => [0, 28, -28, 46, -46].map(dz => ({ x: d.x + offset * side, z: d.z + dz })));
  const placement = candidates.find(p => !ROADS.some(r => r.points.some((v, i) => i > 0 && distanceToSegment(p, r.points[i - 1], v) < r.width / 2 + 20)) && !SHORTCUTS.some(s => distanceToSegment(p, s.entry, s.exit) < s.width / 2 + 20)) ?? { x: d.x + side * 45, z: d.z };
  return { destinationId: d.id, ...placement, width: 24, depth: 24, height: d.landmark === 'tower' ? 56 : d.landmark === 'hotel' ? 36 : d.landmark === 'museum' ? 24 : d.landmark === 'stadium' ? 19 : 18, solid: d.landmark !== 'park' };
});
const palette = ['#ecd4b0', '#f1ddc7', '#e0a693', '#b6cec6', '#ebbe88', '#aacac9', '#d9b9aa', '#9cbab8'];
function buildCity(): Building[] {
  const result: Building[] = []; let random = 88317;
  const rng = () => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random / 4294967296; };
  for (let x = -648; x <= 648; x += 32) for (let z = -451; z <= 451; z += 32) {
    const px = x + (rng() - .5) * 4, pz = z + (rng() - .5) * 4;
    const width = 18 + rng() * 9, depth = 18 + rng() * 9, clearance = Math.hypot(width, depth) / 2;
    if (ROADS.some(r => r.points.some((p, i) => i > 0 && distanceToSegment({ x: px, z: pz }, r.points[i - 1], p) < r.width / 2 + clearance + 4))) continue;
    if (SHORTCUTS.some(s => distanceToSegment({ x: px, z: pz }, s.entry, s.exit) < s.width / 2 + clearance + 4)) continue;
    if (DESTINATIONS.some(d => Math.hypot(d.x - px, d.z - pz) < 42)) continue;
    if (LANDMARKS.some(l => Math.abs(l.x - px) < l.width / 2 + width / 2 + 3 && Math.abs(l.z - pz) < l.depth / 2 + depth / 2 + 3)) continue;
    const district = districtAt(px, pz);
    const style: Building['style'] = district === 'Highline' ? 'tower' : district === 'Harbor Loop' ? 'warehouse' : district === 'Old Steps' ? 'market' : rng() < .25 ? 'glass' : 'stucco';
    result.push({ id: result.length, x: px, z: pz, width, depth, height: style === 'tower' ? 48 + rng() * 72 : style === 'warehouse' ? 8 + rng() * 10 : 12 + rng() * 34, rotation: 0, style, color: palette[Math.floor(rng() * palette.length)], district });
  }
  return result;
}
export const BUILDINGS = buildCity();
