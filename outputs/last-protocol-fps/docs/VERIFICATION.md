# Verification

Executed on the supplied Windows machine with Node, Vitest, TypeScript/Vite and actual Chromium. Local checks, not a production certification or a test of ten networked clients.

## Automated

- `npm test`: **38/38 pass**. Starting funds, phase/side/unknown-item validation, deduplication, utility caps, prior-armor restoration, primary replacement without refund duplication, independent ammo/reserves, survivor refill, eliminated inventory reset and halftime.
- Objective: both sites, 3.2-second arm, interruption/illegal zone, 5/8-second disarm, carrier drop/recovery, continued armed clock with dead attackers, upload and no respawn.
- Combat: all 12 weapons use real ammo and hit a target; Lumen's held trigger fires exactly three rounds; smoke blocks perception then expires; capsule separation; collision-free site routes and no spawn sightline.
- Three standard-match bot soaks complete both halves, remain within currency bounds and plant. Final overlap/rotation-fix benchmark seeds 41/815/2709: **9–6 / 1–9 / 8–10**, **651 / 441 / 718** simulated seconds, **6 / 4 / 5** plants and **3 / 3 / 3** disarms. Seed outcomes, not a statistical balance study.
- Simulation p95 tick **0.197 / 0.111 / 0.117 ms** for those runs, excluding render/network cost.
- `npm run build`: TypeScript + production Vite build succeeds. JS approximately 821 KB before gzip, title illustration 2.14 MB. No runtime CDN fetches.
- `npm audit --omit=dev`: **0 runtime vulnerabilities** when checked. Dev advisory status is separate; no forced breaking audit upgrade.

## Actual input-driven browser

`tools/browser-driver.js` reads only the development copied snapshot, sends keyboard/mouse events and clicks real buy buttons. It does **not** mutate health, credits, ammo, position, time, result or simulation state. Its programmed aim/navigation is a functional test, not evidence of human difficulty.

A complete Rapid Practice match reached **5–5 deadlock**, **10 rounds**, **6:13**, **7 kills / 6 deaths / 3 assists**, **3 plants / 1 disarm**, **$17,150 spent**. It used real purchases across eight buy phases. The result was independently read back from saved browser history. Screenshot: `round-match-result.png`.

A second, Full Protocol browser match also completed both halves and persisted its real result: **1–9**, **10 rounds**, **7:11**, **4 kills / 9 deaths**, **2 plants**, nine actual buy-menu purchases. Screenshot: `full-match-result.png`. This longer final-campus run sampled **75 FPS minimum / 177 peak draw calls** while the rest of the collection was being built on the same machine. The scripted player is not a tuning benchmark.

Final real buy-control smoke test (`tools/buy-smoke.js`): vest purchase reduced $800 to $150 and set armor100; refund restored $800/armor0; Rook purchase left $100 and equipped Rook. All three assertions passed without mutating simulation state. Final browser error check was empty.

That run preceded final inventory/burst/capsule/weapon-framing polish; those changes received added tests, rerun full bot soaks and a further actual gameplay pass. The complete run sampled **92 FPS minimum / 161 maximum draw calls**; early rounds in the richer final campus sampled **114 FPS minimum / 177 maximum draw calls**. Informal samples, not formal 1%-low/GPU/heap measurements, and not claimed as 1080p measurements.

Screenshots in the project root:

- `menu-verified.png`: original title illustration and functional menu.
- `deploy-verified.png`: real first-person renderer and deploy/pause state.
- `gameplay-verified.png`: final actual rendered gameplay, launcher thumbnail.
- `round-match-result.png`: completed match and timeline.

Checked deploy/pointer lock, move/look/fire/reload, buying, round transitions, death/team spectating, arm/disarm, halftime, match result and history. No browser exceptions were reported during the complete run. Console is checked again after final shader/audio changes.

## Limits

- No video claimed: the environment could not complete recording. Input evidence and screenshots are retained.
- Chromium actually exercised; Firefox/Safari/low-end GPU compatibility is not certified.
- No networking, latency, matchmaking/rating, visibility-security, signed-replay or ten-human load tests exist for this static Practice build.
- Bot matches usually finish faster than the prompt's 22–35-minute target on this compact map. Pricing/balance remains a starting point, not competitive tuning.
- Unimplemented modes, controls, animation and production systems are listed in `PROMPT-COVERAGE.md`.
