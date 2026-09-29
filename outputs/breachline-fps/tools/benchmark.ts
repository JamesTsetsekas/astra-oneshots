import { performance } from "node:perf_hooks";
import { MatchSimulation } from "../src/game/simulation";
const results = [];
for (const seed of [17, 815, 2309]) {
  const m = new MatchSimulation(seed);
  m.fillBots();
  const ticks: number[] = [];
  for (let i = 0; i < 60 * 541 && !m.winner; i++) {
    const start = performance.now();
    m.step(1 / 60);
    ticks.push(performance.now() - start);
  }
  ticks.sort((a, b) => a - b);
  results.push({
    seed,
    winner: m.winner,
    score: m.score,
    durationSeconds: Number(m.time.toFixed(2)),
    activeScorers: [...m.players.values()].filter((p) => p.kills > 0).length,
    tickP50ms: Number(ticks[Math.floor(ticks.length * 0.5)].toFixed(3)),
    tickP95ms: Number(ticks[Math.floor(ticks.length * 0.95)].toFixed(3)),
  });
}
console.log(
  JSON.stringify(
    { benchmark: "12 authoritative bots / fixed 60 Hz / no renderer", results },
    null,
    2,
  ),
);
