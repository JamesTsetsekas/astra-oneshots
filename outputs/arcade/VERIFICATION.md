# Collection verification

Windows / Node.js 22.12 / automated Chromium, 2026-09-28. Each game has its own detailed verification ledger linked from `../GAME-COLLECTION.md`.

## Launcher and production hosting

`node outputs/arcade/verify.mjs` passes:

- Eight separate game ports and eight production entry pages; no `/@vite/client` injected into any entrypoint.
- Each game's production entry JavaScript/CSS exists and is served with the expected MIME type rather than an HTML fallback.
- Eight actual gameplay capture routes return PNG images with nonempty image bodies.
- Malformed absolute-form URL and malformed percent encoding return 400. Encoded parent-directory traversal returns 403. The launcher continues serving afterward.
- The cold-started Breachline combined static/WebSocket server responds to `/health` with the expected identity, and `/relay` sends a real welcome plus match snapshot.

The UI retries readiness during server startup and offers a manual refresh button. Existing listeners are preserved rather than killed. The launcher's own servers bind to loopback only; there is no external deployment.

For final handoff, all prior development/preview processes and the unused relay on 4196 were stopped. A read-only port check confirmed every collection port was free. One fresh launcher then started all eight production games itself (including its Breachline child); the full verifier passed again, and a fresh browser showed all eight Play links and no errors. The final collection screenshot was refreshed from this exact launch.

## Browser launcher check

- Actual page renders eight named game cards, each with the correct separate-port Play link, actual screenshot, status and accessible link/button semantics.
- All eight loaded images have a nonzero natural width; status reads `8 / 8 READY TO PLAY`.
- At 1440 px the four-column layout and full-page capture were visually reviewed. At 390 px it switches to one column without horizontal document overflow. This validates the launcher layout, not mobile playability of the games.
- Manual status refresh works. No browser errors were reported.
- Main capture: `collection-final.png`. Individual final static-production browser captures, where available, use the `production-*.png` prefix.

## Fresh static-production gameplay smoke

Separate fresh Chromium contexts were used against the actual collection-served URLs, not development servers:

| Game | Observed behavior |
| --- | --- |
| Ashfall Covenant | Created Cinder hero, rendered refuge and character, clock advanced from 0:00 to 0:20, F quest interaction advanced to Ashway. |
| Crownfall | Menu and Suri draft entered a rendered match; clock advanced from 0:00 to 0:21, minions and minimap active, visible pilot purchased a starter and learned Q. |
| Breachline | Pointer lock, scene, WASD/mouse input, firing from 30 to 26 rounds, advancing clock and working respawn. Development inspector absent. |
| Last Protocol | Pointer lock, scene, WASD/mouse input, firing from 15 to 14 rounds, 8-second buy phase transitioned to the 60-second action clock. Development inspector absent. |
| Meridian Run | Started a new shift in the rendered city; mission and controls present, development inspector absent; twice-saved paused clock stayed exactly 7.1 seconds. Final render-instrumentation rebuild also passed a fresh cold offline launch and normal-input walking. |
| Farestorm | Quick Shift rendered Galeport, taxi and traffic; countdown advanced from 5:00 to 4:35. Approved source unchanged. |
| Skybreak | Production staging, skiff, drop and landing proceeded into a complete 296.97-second Solo match; player placed 14th, the true remaining winner was Ari Breaker, and the report persisted in Career. Fresh final build also passed practice, inventory, map, results and requeue with no development inspector or browser errors. |

No browser errors were reported in these checks. Browser sessions were closed afterward. Screenshots are `production-ashfall.png`, `production-crownfall.png`, `production-breachline.png`, `production-protocol.png`, `production-farestorm.png`, and `production-meridian.png`. Shardfront and Skybreak final production flows are documented by their respective game ledgers.

## What this check does not prove

HTTP readiness alone does not certify a working 3D scene or a completable match. Per-game scene/input/result checks are separately recorded in the individual verification ledgers. Browser checks are desktop Chromium on this machine, not Safari/Firefox certification, multiplayer load testing, or hardware performance certification. The prompt documents describe a broader target than these deliberately bounded local vertical slices.

The eight project ledgers record **180 passing automated tests** in total: 18 Shardfront, 15 Ashfall, 27 Breachline, 38 Last Protocol, 17 Crownfall, 17 Skybreak, 18 Meridian Run, and 30 in the preserved Farestorm build. All eight have successful production builds. These totals do not replace the separate browser and scope qualifications above.
