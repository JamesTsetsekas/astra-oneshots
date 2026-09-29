import { performance } from "node:perf_hooks";
import { ProtocolMatch } from "../src/game/simulation";
const results = [];
for (const seed of [41, 815, 2709]) {
  const m = new ProtocolMatch(seed, "standard"),
    times: number[] = [];
  for (let i = 0; i < 64 * 3000 && !m.winner; i++) {
    const t = performance.now();
    m.step();
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  results.push({
    seed,
    winner: m.winner,
    score: m.score,
    rounds: m.round,
    duration: Math.round(m.time),
    plants: m.players.reduce((n, p) => n + p.plants, 0),
    defuses: m.players.reduce((n, p) => n + p.defuses, 0),
    p95TickMs: Number(times[Math.floor(times.length * 0.95)].toFixed(3)),
    reasons: m.history.map((r) => r.reason),
  });
}
console.log(JSON.stringify(results, null, 2));
