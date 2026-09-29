import type { StyleEvent, Vec2 } from './types';
import { distance } from './navigation';
export type StyleKind = StyleEvent['kind'];
export class ScoreKeeper {
  score = 0;
  tips = 0;
  pulse = 0;
  tailwind = 38;
  bestChain = 0;
  chain = 0;
  events: StyleEvent[] = [];
  private eventId = 0;
  private lastStyle = -100;
  private lastKind: StyleKind | undefined;
  private repetition = 0;
  private visited = new Map<string, { time: number; position: Vec2 }>();
  get multiplier() { return this.pulse >= 72 ? 5 : this.pulse >= 43 ? 3 : this.pulse >= 18 ? 2 : 1; }
  tick(dt: number, time: number, boosting: boolean) {
    if (time - this.lastStyle > 3.5) { this.pulse = Math.max(0, this.pulse - dt * 11); if (this.pulse === 0) this.chain = 0; }
    if (boosting) this.tailwind = Math.max(0, this.tailwind - dt * 45.46);
    this.events = this.events.filter(e => time - e.time < 3.4).slice(-5);
  }
  /** All farmable events need travel and cooldown; boost never enters this scoring path. */
  award(kind: StyleKind, label: string, base: number, time: number, position: Vec2, speed: number, options: { key?: string; cooldown?: number; minTravel?: number; minSpeed?: number; boosting?: boolean; preference?: number } = {}): number {
    const key = options.key ?? kind;
    const previous = this.visited.get(key);
    if (speed < (options.minSpeed ?? 6)) return 0;
    if (previous && (time - previous.time < (options.cooldown ?? 1) || distance(previous.position, position) < (options.minTravel ?? 18))) return 0;
    this.repetition = this.lastKind === kind ? this.repetition + 1 : 0;
    const reduction = Math.max(.08, Math.pow(.56, this.repetition));
    const points = Math.max(1, Math.round(base * this.multiplier * reduction * (options.preference ?? 1)));
    this.visited.set(key, { time, position: { ...position } });
    this.lastKind = kind; this.lastStyle = time;
    this.chain++; this.bestChain = Math.max(this.bestChain, this.chain);
    this.pulse = Math.min(100, this.pulse + 12 * reduction);
    if (!options.boosting) this.tailwind = Math.min(100, this.tailwind + 7.5 * reduction);
    this.score += points; this.tips += points;
    this.push(kind, label, points, time);
    return points;
  }
  push(kind: StyleKind, label: string, points: number, time: number) {
    this.events.push({ id: ++this.eventId, kind, label, points, time });
    this.events = this.events.slice(-5);
  }
  collision(hard: boolean, time: number) {
    this.pulse = hard ? 0 : this.pulse > 72 ? 60 : this.pulse > 43 ? 31 : Math.max(0, this.pulse - 20);
    if (hard) this.chain = 0;
    this.push('collision', hard ? 'HEAVY IMPACT' : 'SHAKE IT OFF', 0, time);
  }
  delivery(points: number, time: number) { this.score += points; this.tailwind = Math.min(100, this.tailwind + 26); this.push('delivery', 'FARE COMPLETE', points, time); }
}
