# Crownfall — The Broken Diadem

An original, playable sky-island MOBA vertical slice. Choose one of six heroes and fight alongside two allied bots against three enemy bots. This release is explicitly **local/offline bot play**, not online matchmaking.

## Run

Requires Node.js 22+ and npm.

```sh
npm install
npm run dev
```

Open `http://127.0.0.1:4178`. Production: `npm run build`, then `npm run preview`. The entire `dist/` directory can be hosted on a static HTTP server. No accounts, API, environment variables, external asset hosts, or game server are required. Opening `index.html` directly with `file://` is not supported.

## Play

Buy a starter at your fountain and learn a skill with its gold **+** button. Follow a minion wave into either lane. Earn gold and experience by fighting, last-hitting, and breaking structures. Return to the fountain to combine components into completed items. Break a lane's three towers in order, then its Seal, both Core Towers, and finally the Crown Engine.

| Control | Action |
|---|---|
| Right mouse | Move; attack a clicked enemy |
| Left mouse | Select a unit |
| A + left mouse | Move/attack command |
| Q W E R | Quick-cast learned ability toward cursor |
| Ctrl + Q W E R | Spend a skill point |
| D / F | Chosen universal talents |
| B | Seven-second recall; movement or damage interrupts |
| P | Fountain shop |
| 1, 2, 3, 5, 6 | Item actives in those slots; click slot 4 for its active |
| 4 | Place a vision ward |
| G | Ground ping |
| S / H | Stop |
| Y | Toggle camera follow |
| Space / F1 | Recenter camera; hold Space to follow |
| Arrow keys | Pan unlocked camera |
| Mouse wheel / minimap click | Zoom / pan |
| Tab / Escape | Scoreboard / pause |

The visible **BOT PILOT** button gives your hero to the same rule-bound AI used by teammates. While enabled, the adjacent **1× / 2× / 4×** button accelerates the local simulation. Turning the pilot off restores normal speed. This is useful for learning the lanes or observing a complete match. It does not alter damage, currency, health, or victory rules.

## Implemented

- Six original heroes, distinct animated 3D silhouettes, passive mechanics, and 24 castable abilities: Brannoch, Suri Vale, Oru, Kesh, Ilyra Quill, and Vey. Mana, cooldowns, rank caps, level-gated ultimates, shields, slows, stuns, silence, dashes, destructible walls, delayed warnings, and swept projectiles.
- Two curved lanes, floating-island terrain, procedural cobblestone/grass textures, instanced mistwood trees, sky ruins, fountains, gilded defensive towers, and color-coded team effects. Generated original title art; actual gameplay uses Three.js geometry, not a painted screenshot.
- Six-hero local matches, minion waves every 30 seconds, siege units, empowered/vanguard waves, fountain regeneration, recall, deaths/respawns, last-hit gold, XP and skill ranks, team structure gold, tower aggro and backdoor protection.
- Four neutral camps, two timed Catalysts, Aether Colossus, objective rewards, brush concealment, allied vision and temporary wards. The renderer hides unseen enemies; the local simulation necessarily holds both teams' state.
- Thirty-two items, role recommendations, search/category filters, six inventory slots, component discounts, active items, and selling. Six selectable universal talents.
- Local pause and focus-loss pause, quality/sound/reduced-motion/damage-number settings, introductory coaching mode, reference field guide, live scoreboard, results, replay input-log export, local history, and mastery totals.
- IndexedDB profile with schema/checksum validation, a previous-profile backup, duplicate-result protection, and graceful persistence failure. Match history retains the latest 30 results. Saves are specific to browser and origin.
- Original Web Audio music pattern and effects; sound starts after a user gesture and is optional.

## Honest scope

This is a polished local vertical slice of the much larger prompt, **not the complete networked production MOBA**. There is no online transport/server authority, matchmaking, accounts, reconnect, ranked play, anti-cheat, social system, monetization, or cloud profile. The input-log export is data, not a replay viewer/importer. It is not promised to replay across future game versions.

The map uses a flat movement plane and waypoint bot routing; scenery is decorative, not full navmesh collision. Ability variants are intentionally simplified; the in-game descriptions describe the shipped behaviors. There are no talent trees, item undo, full attack-move acquisition, cast-range previews, key rebinding, gamepad/touch layout, localization, screen-reader combat alternative, spectator tooling, or comprehensive accessibility certification. The tutorial is lightweight contextual coaching, not a gated scenario campaign. Practice currently uses the regular bot rules.

Bots share normal combat, fog, shopping and skill rules but remain heuristic opponents, not competitive-level AI. Balance and duration have not been validated through a large human playtest. Desktop Chromium has been browser-tested; other browsers, low-end hardware, mobile, audio quality by listening, and sustained hardware FPS are unverified. Keyboard/mouse and at least 1280×720 are recommended.

## Validation and architecture

`npm test` runs deterministic simulation tests. `npm run build` typechecks and builds. See [verification](docs/VERIFICATION.md) for actual browser evidence and [asset provenance](docs/ASSETS.md).

- `src/game/content.ts`: hero, item, talent and map content.
- `src/game/simulation.ts`: deterministic 30 Hz local match rules and input log.
- `src/game/runtime.ts`: input, camera, rendering, vision, HUD projection and audio integration.
- `src/render/world.ts`: original procedural world and articulated character rigs.
- `src/ui/`: React front end, draft, HUD, shop, settings, result and history views.
- `src/game/persistence.ts`: versioned local profiles and export.

Development exposes a read/intent-only `window.__crownfallQA` bridge; production does not include it. Final browser match verification used the production UI's visible bot pilot, not that bridge or state injection.
