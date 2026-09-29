# Meridian Run verification

Verified locally on Windows in Chromium on 2026-09-28. This is a playable, original single-player vertical slice, not a claim that every commercial-scale feature in the source prompt has been delivered.

## Build and automated checks

- `npm test`: 18 tests passed in two suites.
- `npm run build`: TypeScript and Vite production build passed. The main game bundle is approximately 3.91 MB uncompressed / 1.27 MB gzip; Vite reports a large-chunk warning, not a failed build.
- `npm audit --omit=dev --audit-level=high`: zero reported production dependency vulnerabilities at verification time.
- Tests cover grounded walking/jumping, normal-input bike entry/driving/braking/exit, physical room doors and occlusion, delayed evidence, five alert tiers, ammunition, stun combat, held investigation input, reward idempotency, story prerequisites, shop distance, save checksum/schema validation, wanted evidence on continue, replay vehicle reset, and clearing pending witness reports on mission retry.

## Full story integration run

`npx tsx tools/verify-story.ts` completed all four cases through public simulation inputs and mission methods. The driver does not teleport Rowan, grant equipment, change health/cash, or directly advance objectives. It follows routes, drives, aims, fires, reloads, interacts, heals, repairs, and uses smoke through the game controls. This repeatable simulation run uses traffic and crowds set to zero and precise automated aiming; it is not a claim of four manually completed browser missions.

| Case | Grade | Reward | Mission seconds |
| --- | --- | ---: | ---: |
| First Shift | S | $350 | 31.08 |
| Lost Manifest | S | $650 | 120.58 |
| Hot Cargo | A | $950 | 171.08 |
| Signal at the Breakwater | A | $1,600 | 263.52 |

Final result: 35,180 ticks, 586.27 simulation seconds, all four cases recorded, $3,640 cash after a normal $90 repair, 85.6 health. This includes both building investigations, rival combat, vehicle delivery, the timed upload/survival, police escape, return home, and final payout. The run passed again after the independent-review retry fix.

## Browser evidence

- Started a new shift, walked to the motorcycle with WASD, entered with E, drove using normal key events, stopped at Tide Market, exited with F, and handed over the parcel with E. Default traffic and pedestrian settings were enabled.
- First Shift browser result: S grade, $350 reward, +1 trust, 152.38 mission seconds including idle tool time, $530 total cash. Screenshot: `../meridian-first-shift-result.png`.
- Saved and continued from the title screen. One completed case and $530 were retained; checkpoint loading returned the player safely to the courier office as designed.
- Checked production title, live scene, vehicle entry, map, phone and prerequisite-locked cases, pause controls, and keyboard interactions. Captures: `../meridian-title.png`, `../meridian-final-gameplay.png`, `../meridian-map.png`, `../meridian-contacts.png`.
- In a fresh production-browser context, waited for the service worker to activate and cache 99 game resources. Set the browser offline, navigated afresh, started a new shift from the cached title, and moved to the motorcycle without a prior gameplay session in that context. `navigator.onLine` was false and gameplay was visibly active. Capture: `../meridian-offline.png`.
- No runtime exceptions or Vite error overlay appeared in these checks. `window.__meridian` is absent from the production build; the read-only development inspection bridge is not shipped.
- On the final production build served by the collection launcher, started a new shift, paused, and saved twice through the real pause-menu controls. Read-only IndexedDB inspection confirmed both simulation and mission clocks remained exactly 7.1 seconds. The gameplay scene, controls, and absence of the development bridge were rechecked with no runtime errors.
- The complete four-case simulation test and unit tests use the final source. Browser First Shift and offline checks preceded the narrow delayed-witness/retry fix; the final production launch is additionally checked through the collection launcher.
- A final audit corrected HUD FPS instrumentation: the manual Babylon render loop now calls its frame hooks. Earlier captures showing a fixed 60 FPS are not performance evidence. This did not change simulation or mission rules.
- After that instrumentation fix, all 18 tests and the production build passed again. A fresh browser cached all 99 resources, went offline, loaded the title, started gameplay, and walked to the bike using normal inputs with no errors. The corrected HUD sampled 119 FPS on this host; this is an informal local sample, not a benchmark guarantee. Capture: `../../arcade/production-meridian.png`.

## Remaining validation and product limits

Keyboard/mouse desktop Chromium was exercised. Other browsers, physical gamepads, touch-only devices, low-end integrated GPUs, suspend/resume across OS restarts, and browser storage-denial paths are not certified. No formal cross-device performance guarantee is made. No video capture is included; this environment did not provide the required recording backend.

There is no multiplayer backend, cloud save, account system, or public deployment. Save files are local checkpoint envelopes, not exact replays of every city actor. Full feature and asset-pipeline scope cuts are explicitly listed in the project README and `ASSETS.md`.
