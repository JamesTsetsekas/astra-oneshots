# Verification — 2026-09-28

## Automated

`npm test`: 18 tests in four suites. Economy, supply construction, production, pylon capture, both-faction deterministic save/restore, command-replay hash parity, queued movement, hidden-target rejection, extractor-gated Flux, supply-block spending, victory resolution, obstacle-aware A*, symmetric ridges, storage corruption, a full public-command skirmish, and geometry validation for every unit/building in both factions.

`src/game/match.test.ts` runs a scripted commander through ordinary build/train/gather/rally/attack-move methods. It does not grant resources, spawn an army or force a winner. `npm run build` passes TypeScript and Vite. The standard large-chunk warning remains because Three.js is bundled.

## Browser evidence

Verified automated desktop Chromium at approximately 1264 × 625 on this Windows host:

1. Menu and actual faction model previews load without errors.
2. Helix Tutorial: canvas pointer selection; B opens construction; pointer placement builds Grid Pylon, then Assembly Bay with a second worker. Pylon raises cap to 20.
3. Ctrl+1 assigns a group. Select completed Assembly Bay through canvas; press B three times; three Bulwarks complete training.
4. Esc pauses. Save writes IndexedDB. Abandon/Continue restores time 52.7 s, selected worker and pylon progress, then resumes.
5. Chorus Skirmish renders its distinct models. Public-command automation reaches AI victory at 224.00000000001668 s: 4,380 Prism / 112 Flux, 25 units created, 22 lost, seven structures completed.
6. Watch last replay reaches precisely the same time/outcome and state hash `5ab896f2`.
7. No browser console errors at the end of the verified flows.

Final production smoke: menu and Tutorial render, browser console is clean, two expected game/minimap canvases exist, and the development bridge is absent. An indexed/non-indexed geometry-merge defect found in the final server log was fixed and covered by the new asset tests before rebuilding and rechecking the production bundle.

The complete match used the same scripted public-command commander and accelerated fixed clock, not manual real-time play. Selection/build/training/save controls used normal browser pointer/keyboard events. Development-only projection/stats helpers are removed from the production bundle.

Screenshots: `astra-menu.png`, `astra-battlefield.png`, `astra-construction.png`, `astra-production.png`, `astra-chorus.png`, `astra-results.png`, `astra-replay.png`. Baselines are `baseline-menu.png` and `baseline-game.png`. Video encoding was unavailable; no successful export is claimed.

## Performance and compatibility

Warm early-game HUD readings around 120 FPS on this host are observations, not the prompt's 1080p/220-unit certification. A 22-entity view reported 397 calls before fog-aware resource suppression; later production/three-unit army view reported 311 calls / 12,118 triangles.

| Environment | Status |
| --- | --- |
| Automated desktop Chromium / WebGL | Flows above verified |
| Separately installed Chrome/Edge | Not separately certified |
| Firefox / Safari | Not tested |
| Mobile | Unsupported target |
| 125% / 150% browser scaling | Not verified |
| Forced WebGL context loss | Handler implemented, not forced-test certified |

Remaining scope gaps are explicit in README.
