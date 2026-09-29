# Verification — 2026-09-28

## Automated

- Production TypeScript + Vite build passed.
- Unit/simulation suite covers 27 tests: all nine weapons consume ammo and hit; team 6v6 replacement; movement basis/normalization; illegal kits; respawn-only kit application; vertical aim; geometric head hits; semi-auto; structural cover; firing over waist cover; respawn timing; reserve-aware reload; one-shot charges; support Momentum isolation; seeded determinism; every interest-node path; 10,000 safe-spawn fixtures; and three complete full-rule bot matches.
- Seeds 17 / 815 / 2309 reached 75–54 / 75–62 / 75–62 in 171.87 / 190.48 / 188.25 simulated seconds. Ten to twelve bots earned eliminations in each run. Local simulation p95 tick: 1.023 / 0.796 / 0.552ms. These are this machine's headless results, not a certified hosting benchmark.
- Real local relay test: twelve WebSocket clients joined one room with balanced teams; thirteenth rejected; malformed axes/pitch clamped; stale movement stopped. Snapshot ~10,294 bytes. This does not prove 12 rendered browsers or loss/jitter tolerance.
- `npm audit --omit=dev`: zero vulnerabilities reported.

## Actual browser

Chromium via the agent-browser session `astra-breachline`, default 1264×625 viewport:

- Menu, mission setup, Practice launch and pointer lock worked; no console errors captured.
- A Quick Skirmish completed 14–30, produced a debrief, saved profile progress, and offered requeue.
- A full Team Clash ran through the normal runtime using keyboard/mouse events from `tools/browser-driver.js`. The driver reads the dev-only read-only inspector; it does not alter the simulation. Result: **75–44**, 2:27 duration; controlled player 47 eliminations, 4 deaths, 5 assists, 97% accuracy. The high accuracy reflects scripted aiming, not difficulty tuning for humans.
- Ammo expenditure, reload, kills, death/respawn, assist attribution, match score, results, saved XP and Play Again were observed end to end.
- Observed FPS during the full run: minimum sampled 103; common values 128–134. This is not a formal 1% low measurement or 1080p certification.
- After final actor/weapon batching, the initial playable scene measured **122 draw calls / 130 FPS**. A paused-clock check held exactly at 0.30 seconds after pointer-lock release. The before-batching full match peaked at 313 calls.
- Screenshots: `menu-astra.png`, `combat-verified.png`, `full-match-result.png`, `pause-verified.png` in project root. Earlier intermediate screenshots are also retained.
- Video recording was attempted; encoding failed because ffmpeg is unavailable. **No successful gameplay video is claimed.**

## Browser matrix / unverified items

| Surface | Status |
|---|---|
| Local automated Chromium, keyboard/mouse | Functional full-match verification above |
| Production build | Build checked; same simulation/render source |
| Edge / Firefox / Safari | Not tested in this environment |
| 1080p target hardware / 1% low | Not certified |
| Physical gamepad | Not supported by this keyboard/mouse design |
| 80/150ms RTT, jitter, packet loss | Not certified; prediction/rewind not implemented |
| Public HTTPS deployment / remote profile | Not configured |

See `PROMPT-COVERAGE.md` for explicit differences from the much larger production prompt.
