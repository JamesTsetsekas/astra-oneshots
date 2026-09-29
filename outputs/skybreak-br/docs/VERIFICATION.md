# Verification · 2026-09-28

## Automated checks

- `npm run build` — TypeScript and production Vite build pass. The final import-pruned build transforms 626 modules. Main application ~345 KB raw / 111 KB gzip; Babylon ~1.72 MB / 406 KB gzip; Rapier with embedded WASM ~2.24 MB / 830 KB gzip. The latter intentionally retains Vite's chunk-size warning. Key art is ~2.41 MB.
- `npm test -- --reporter=dot` — **17 tests pass in 3 files**. Final recorded run: 21:30:57 local, approximately 9.6 seconds wall time.
- `npm audit --omit=dev --json` — zero production dependency vulnerabilities in this run. This is not a security certification or a statement about all development dependencies.

Tests cover seeded storm determinism/containment, all nine weapon profiles, shared wall visibility, true unarmed 24-player setup, supplied practice, Rapier movement and wall collision, pause, skiff/drop/landing, Aegis-before-Health damage, elimination gear drops, ammunition/reload/switch cancellation, timed healing, swap/drop, honest early-exit reports, and a complete 23-bot match ending with exactly one living actor whose name matches the winner. Storage checks cover corrupt/disabled storage, validation, settings persistence, bounded reports, and deduplication. Rendering tests construct every weapon/skin, verify terrain vertex/index counts and upward normals, and explicitly guard camera-ray registration.

## Browser input checks

The dedicated `astra-skybreak` browser session ran at 1440×900 on the local development and production HTTP server, port 4179. Menu navigation and game entry used browser buttons. The two checked-in QA scripts send keyboard/pointer events through the ordinary runtime handlers and read only the development inspector; they never set gameplay state or outcomes.

`scripts/browser-proof.js` recorded:

- 6.23 metres of actual forward movement from holding W.
- E recovered an Advanced Needler SMG from the training supply row.
- Tab opened inventory and froze simulation time while the local modal was open.
- M opened the map; clicking it changed the real landing marker.
- Left mouse fired 7 shots, R started and completed a real reload, a Shield Flask added 25 Reserve Shield, and Space produced an airborne jump.

`scripts/combat-proof.js` aimed via mouse movement and fired at a training target. It recorded **8 shots, 5 hits, 150 damage, 1 elimination**, with the target actually dead and its equipment released. This is practice evidence, not a claimed Solo victory.

## Bugs caught and corrected during verification

1. Terrain triangle winding culled the upper island surface. Reversed it for Babylon's coordinate convention; added upward-normal/geometry tests.
2. A wall-collision test originally ran through a legitimate street gap. Replaced it with an explicit, shared world-wall target.
3. Direct engine imports initially omitted Babylon's camera-ray registration and stopped the first production frame. Added the registration, startup rendering probes, and a regression test. A blank frame or a frozen timer was never accepted as successful gameplay.
4. Held crouch/sprint could continually retrigger slide. Slide now requires a fresh crouch edge and stamina.
5. Full inventory stacking could discard excess consumables. Leftover quantity now remains available on the floor.
6. Early exits could name the healthiest current survivor as winner. Only a sole survivor is now a winner; an alive early exit is DNF.
7. HUD FPS initially read Babylon's default before frame measurement started. Explicit begin/end frame hooks now make the final build's display a real measurement. Earlier screenshots showing 60 must not be used as performance evidence.

## Production match and final fresh-build check

The production Solo run completed without altering health, ammunition, positions, clock, or outcomes. The player boarded/jumped using input, landed, remained idle, was eliminated, and spectated until the bots produced a true final survivor.

- Saved report: `skybreak-1567378062-8909`.
- Seed: `1567378062`.
- Finished: `2026-09-29T01:33:05.728Z` (September 28 local time).
- Total simulation: 8,909 ticks / 30 Hz = **296.97 seconds (4:57)**.
- Player placement: **14th**; survival after landing: **54.4 seconds**; distance 154 metres; zero eliminations. This was a loss-path/spectator test, not a claimed human victory.
- Actual winner: **Ari Breaker**. Final elimination event: **Ari Breaker eliminated Mira Sails**.
- Fresh error and unhandled-rejection listeners recorded no errors during the progressing match. `window.__skybreak` was absent from production.
- Return to lobby and Career displayed the persisted report.

The final FPS-frame-hook build was then loaded in a **fresh browser process**. Practice, inventory, map, finish/results, and Drop Again all worked. The requeued session reset to six living actors and its original ammunition/inventory. Browser error collection returned `errors: []`; console contained only the Babylon startup log and the documented Rapier warning. The development inspector remained absent. A warmed practice HUD sampled 102–122 FPS on this particular local run; startup shader compilation briefly showed 5 FPS. These isolated samples are not a sustained benchmark or a general device guarantee.

### Actual browser captures

| File | Evidence |
| --- | --- |
| `skybreak-menu.png` | Generated original title art integrated into the real menu |
| `skybreak-gameplay.png` | Final production, actual 3D practice gameplay; collection-card image |
| `skybreak-combat.png` | Input-driven damage/elimination in the practice scene |
| `skybreak-staging.png` | Production Solo staging |
| `skybreak-skiff.png` | Actual transit skiff |
| `skybreak-drop.png` | Actual freefall over the island |
| `skybreak-solo.png` | Landed Solo gameplay |
| `skybreak-storm-spectator.png` | Running shrinking-zone match after player elimination |
| `skybreak-results.png` | Actual 14th-place result and Ari Breaker winner |
| `skybreak-career.png` | Persisted Solo report in Career |
| `skybreak-inventory.png` | Final production five-slot inventory modal |
| `skybreak-map.png` | Final production six-region tactical map |
| `skybreak-practice-results.png` | Practice finish/results before successful requeue |

## Verification boundaries

No broad hardware/browser performance claim is made. This run is a desktop Chromium verification, not a 30-device certification. No real multiplayer, network latency, packet-loss recovery, mobile touch, server authority, cloud persistence, or anti-cheat was tested because those services are outside this local edition. Recording video was not attempted as a workaround for the environment's recording limitation. Evidence consists of actual browser screenshots, input-driven observations, and repeatable tests.

Rapier's compatibility package prints an initialization deprecation warning. Its physics initializes and passes tests; the warning is not misreported as an application exception.
