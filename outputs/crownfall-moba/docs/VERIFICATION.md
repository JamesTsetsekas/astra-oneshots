# Crownfall verification — September 28, 2026

## Automated

- `npm test`: **17 passed**, including six unique kits/32 items, every ability casting from legal trained fixtures, rank/mana constraints, non-finite input rejection, fountain restrictions, structure unlocking, fog/ward visibility, recall completion, recipes preserving unrelated cooldowns, profile corruption detection, fixed-input determinism, minion waves, pause, speed restrictions, a complete six-bot match, and exact reproduction of the recorded production-browser match.
- The browser replay fixture in `browser-match-evidence.json` was downloaded through the actual result-screen **EXPORT MATCH LOG** button. A regression test replays its inputs at their recorded ticks and compares the entire result, including six scoreboards, against the real browser result. It does not inject health, rewards, structures or victory.
- `npm run build`: TypeScript and Vite production build pass. Approximately 870 KB minified JS, 21 KB CSS, and 2.57 MB original key art. No external runtime asset requests are required.
- `npm audit --omit=dev`: zero production advisories at verification time. The initial full install reported two moderate development dependency advisories; no claim is made that all development tooling is vulnerability-free.

## Actual production-browser flow

Served the built `dist/` through Vite preview at `http://127.0.0.1:4178`, using Chromium via agent-browser session `astra-crownfall`. The inspected script URL was the built `/assets/index-B59SV1vr.js`, not the development source.

1. Title menu, hero draft and real 3D preview loaded. Selected Suri Vale, Blink and Mend.
2. Learned Q with the HUD button; cast Q with the keyboard (mana/cooldown changed). Placed a ward with the HUD (charges 2 → 1).
3. Opened the shop, bought Courier's Pin, and observed gold/inventory/stat changes. Closed the paused shop.
4. Issued a real right-mouse movement command on the canvas. The exported input log records its world coordinates.
5. Enabled the visible bot pilot and its 2× then 4× speed. The ordinary simulation ran both lanes, hero combat, deaths/respawns, experience, shopping, structure destruction, Catalyst claim and empowered waves to completion.
6. **Dawnwright victory at 4:56 / 296.7667 simulation seconds**, seed `3928030693`, tick `8903`. Team kills **12–11**. Suri: **level 7, 3 kills / 6 deaths / 3 assists, 32 last hits, 16,131 damage**. Crown Engine destruction was present in the event log. Result screen showed all six builds and scores.
7. Exported the real 4,203-byte JSON input log. Returned to menu, reloaded the page, opened history, and verified **VICTORY / Suri Vale / 4:56 / 3 kills / EA20FDE5** persisted. The fixture is included alongside this document.
8. Started a second match as Brannoch. Observed live lane combat, skill advancement, purchases, death/respawn and a working pause/resume. At **1280×720**, page width was exactly 1280 and the HUD/world/minimap fit without horizontal overflow. Also captured at **1440×900**.
9. Closed the automation browser session after verification to release its resources.

A production error/unhandled-rejection listener observed **zero errors** during the completed match. The browser's accumulated error buffer retained one earlier **development-only HMR invalid-hook error** while source files and dependencies were hot-updated. Reloading cleared the broken development page; production matches and the reload/history flow were unaffected. That stale error is not represented as a clean lifetime console history.

## Screenshots

- `astra-menu.png`: original title-screen presentation.
- `astra-draft.png`: final Suri draft and actual 3D hero model.
- `astra-shop.png`: real starter purchase UI.
- `astra-gameplay.png`: final live Brannoch lane-combat scene and Crownfall HUD — recommended collection thumbnail.
- `astra-1280.png`: live combat and full HUD at 1280×720.
- `astra-victory.png`: actual completed production match.
- `astra-history.png`: result persisted after reload.

Earlier development captures are not acceptance evidence. Screenshots show the live browser; no screenshot state was painted or composited into the game.

## Unverified / scoped out

No hardware FPS claim, audio-listening assessment, long-duration leak soak, Firefox/Safari/mobile test, online synchronization test, competitive balance claim, or complete original-prompt compliance is made. See README for explicit vertical-slice limitations. Browser runtime exports no production debug bridge.
