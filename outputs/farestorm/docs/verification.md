# Verification ledger

This file separates observed checks from targets. The product target is 60 FPS at 1080p; a successful production build does not establish that frame rate or cross-browser compatibility.

## Automated checks

| Check | Evidence |
| --- | --- |
| Save checksum tampering and unknown version rejection | `src/game/persistence.test.ts` |
| Recovery from damaged active save | Same test suite, valid previous record restored |
| Concurrent result writes and duplicate IDs | Same test suite, two results retained and delivery totals counted once |
| Invalid ghost isolation | Same test suite, damaged samples do not discard valid scores |
| Settings bounds and clear-records behavior | Same test suite, preferences survive profile reset |
| Profile migration and valid ghost round trip | Same test suite |
| Medal upgrades only | Same test suite, gold cannot become bronze |

The complete test suite passed 30 tests on Windows / Node 22.12.0: seven persistence tests and 23 simulation tests. Coverage includes world/route data, acceleration, valid fare completion, fixed shift timers, frame-rate input sampling, traffic collision, ramp landing, shortcut order, reset penalty and score farming restrictions. All ten Skill School objectives were exercised through normal throttle, brake and steering inputs. A full three-fare Harbor Hustle trial completed with a medal. The tests use Vitest 4.1.11 or later; `npm audit` reported zero vulnerabilities after the development dependency update. The final production build also passed TypeScript and Vite compilation.

## Browser and controller matrix

| Environment | Status |
| --- | --- |
| Desktop Chromium, keyboard | Headless Chromium 153 on Windows; menu, driving, pause, results, local records and route playback verified |
| Microsoft Edge, keyboard | Not separately tested |
| Firefox, keyboard | Not separately tested |
| Safari | Best effort; not tested |
| Standard-mapped Xbox controller | Input implementation present; hardware not tested |
| Standard-mapped DualSense / DualShock | Input implementation present; hardware not tested |
| Controller disconnect during a shift | Integration verification pending |
| PWA offline reload | Chromium production preview: menu reload and first gameplay initialization succeeded with the browser offline; installed-window UX not separately tested |
| 1080p hardware performance | Not measured on a named physical GPU |

Do not infer Firefox, Safari, physical-controller support or a 60 FPS guarantee from an automated Chromium pass. Record the browser version, viewport, display scaling, GPU, quality preset and traffic density with any measured performance result.

## Browser acceptance evidence

A complete Arcade Shift using seed 697693950 finished with two deliveries, 6,041 points, rank B, zero collisions and a duration of 70.5167 seconds. Reloading the application retained the 6,041-point local record, and the saved-route playback opened successfully. The browser sequence used game inputs and normal pickup/delivery rules.

The saved route was played after reloading Records: its timeline advanced from 0 to 2.4 seconds and the mapped vehicle followed the recorded path. A fresh browser session reported zero page errors. Escape pause held simulation time exactly at 0.583333 seconds across multiple checks; resuming advanced it to 1.983333 seconds. Menu, garage, trials and settings were also checked at 960 × 600 and 1264 × 625. Visual evidence: [current city](final-gameplay.png), [Arcade result](arcade-results.png), [saved route playback](route-replay.png). The older result capture precedes a labeling correction from “Best Pulse” to “Best chain”; the underlying count was correct.

An independent production-preview session at 1264 × 625 loaded only the menu while online. After network access was disabled, the menu reloaded and Arcade Shift initialized its previously unopened gameplay module, WebGL scene and Rapier physics. There were no page errors. A short driven session then finished through the pause menu; its 150-point result and 320 ghost samples were read back from the browser's actual IndexedDB envelope and remained present after reload. The final service-worker v2 build was verified again: 113 cached resources, zero template-placeholder paths, successful offline menu reload and successful offline gameplay initialization. This confirms offline startup and local writes, independently of the Node fallback-storage tests. Screenshots: [online menu](pwa-menu-online.png), [offline city](pwa-game-offline.png).

## Accessibility checks

- Keyboard controls and keyboard-operable menu buttons are part of the implementation.
- The settings contract includes subtitles, reduced motion, colorblind palette, steering assist, audio buses, sensitivity, camera and minimap.
- Fare markers use shape as well as color; this must remain true in every quality preset.
- Verify 100%, 125% and 150% display scaling for HUD clipping and destination readability.
- Verify reduced motion removes optional shake/tilt/flashes without changing physics.
- Verify music/effects zero values silence the intended bus while preserving the other.
- Gamepad vibration depends on browser and physical device support.

Items above that require real device or visual checks are not claimed complete until observed. Avoid assuming an exposed settings toggle proves its implementation.

## Suggested full-shift acceptance run

1. Clear only this origin's game profile, then complete a Skill School lesson.
2. Select each taxi in Garage, inspect the changes and start Arcade Shift.
3. Stop in a passenger ring, follow the route and deliver inside the marked arrival ring.
4. Observe a fare score increase, patience grade and shift-time extension.
5. Trigger a moving drift, near miss and Tailwind; verify an idle taxi earns no style.
6. Pause for several seconds; verify shift/passenger timers and vehicle audio remain stopped.
7. Finish a complete shift, inspect rank and fare totals, restart, then reopen the page to confirm saved records.
8. View/export the ghost and verify the route positions are plausible.
9. Repeat a fixed-seed trial and compare route, traffic and scoring with identical inputs.
10. Install the production service worker, switch browser network offline, reload, start and finish a fare.

## Benchmark

Run `npm run benchmark` for reproducible simulation measurements. The recorded [raw benchmark](benchmark-2026-09-28.json) used a 300-second Quick Shift, Breaker Sedan, seed 6172026, steering assist and 55 traffic vehicles. Its route controller completed four fares, earned 12,487 points, registered four collisions and reached rank A. Across 18,145 steps it produced zero invalid transforms and zero below-terrain frames. The recording contains 18,000 input frames and 3,000 ghost samples.

Measured simulation-step CPU time was 0.445 ms mean, 1.096 ms p95 and 2.519 ms p99. This run occurred during concurrent development/browser work; timing includes machine contention. It does not establish browser render/GPU time, display latency, audio quality or 1% low frame rate. The output records 214 city buildings, 32 destinations and 18 shortcuts.

The environment policy blocked the attempted video-recording command. No full-shift video is delivered. Screenshots and the normal-input browser acceptance sequence provide the available visual evidence.

The same run measured full-throttle zero-to-100 times of 4.87 / 5.10 / 5.70 seconds for Gull / Breaker / Tempest. Fourteen-second observed maxima were 158 / 172 / 180 km/h. The [acceleration plot](taxi-telemetry.svg) uses the recorded one-second samples. These are physics measurements, not estimates from the Garage bar graphics.
