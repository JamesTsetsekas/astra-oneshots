# Skybreak · The Highwake

An original, playable **local third-person battle royale** for desktop browsers. It is built from the Skybreak implementation prompt as a self-contained local edition, not an online service. The other 23 scavengers are clearly identified local bots.

## Run

```sh
npm ci
npm run dev       # http://127.0.0.1:4179
npm test
npm run build
npm run preview   # same port; stop the dev server first
```

The production `dist/` directory can be served by any static HTTP server. No account, API key, remote game server, CDN asset, or network connection to a backend is required. Use an HTTP server, not a `file://` page. Settings and the most recent 40 flight reports stay in this browser's local storage.

## Play

Choose **Take the Drop** for a 24-scavenger match or **Visit the practice range** to learn every weapon against five stationary targets. Quick flights use a compressed storm clock (~6 minutes); Full flights use the original phase timings (~13 minutes, potentially ending sooner through combat).

In Solo you start unarmed. Press **E** to board the skiff, **Space** to jump, and **Z** to deploy your wing-sail early. It opens automatically near terrain. Mark a landing with **M**. Weapons are visible outside buildings; resonance chests inside supply more equipment and ammunition.

| Input | Action |
| --- | --- |
| WASD / mouse | Move / look |
| Left / right mouse | Fire or use equipment / aim |
| Shift / Ctrl | Sprint / crouch; crouch while sprinting to slide |
| Space | Jump, or leave the skiff |
| E | Pick up gear, open a chest, use a cable or wind vent |
| R / F | Reload / melee |
| 1–5 | Select one of five universal equipment slots |
| Tab | Inventory: swap or drop equipment |
| M | Tactical map and landing marker |
| Z / X | Wing-sail / switch camera shoulder |
| Esc | Release mouse and pause |

Click the world to capture the pointer. If capture is unavailable, hold a mouse button and drag to look. Pause, inventory, and map pause the entire local simulation. Controls are rebindable from lobby settings; map, inventory, and equipment numbers remain reserved. This edition is designed for keyboard and mouse, not touch.

## Implemented

- A complete local staging → skiff → freefall/wing-sail → loot/combat/storm → elimination/spectator → actual last-survivor result → requeue loop.
- Six named regions on a 1.2 km map: Aerie Market, Sunken Array, Kilnworks, Orchard Steps, Wind Abbey, and Breaker Docks. Sixty-one enterable structures, procedural coast/hills, trees, orchard rows, animated windmills, and original 3D scavenger/equipment models.
- Babylon.js WebGL rendering with an over-the-shoulder collision camera, atmospheric sky, shadows, fog, weapon traces, hit feedback, articulated locomotion, wing-sails, and three rendering presets.
- A fixed 30 Hz simulation, Rapier player character movement, shared collision/sight geometry, bounded stamina, crouch/slide/jump, swimming, animated cable transit and forward grapple travel, and a wind vent.
- Nine weapons, five bounded rarity tiers, four ammunition pools, five inventory slots, chest loot, elimination caches, and a late-game supply capsule.
- Health, rechargeable Aegis, consumable Reserve Shield, timed healing, interrupted trauma kits, mist cover, historical-footstep Echo Beacons, and displacement utilities.
- Twenty-three local bots that scavenge, navigate around collision, select visible targets, fire/reload with finite ammunition, fight one another, and rotate into the shrinking safe area. Bots cannot select combat targets through buildings, terrain, or mist.
- Practice, four cosmetic palettes, guide, accessibility/settings, local career history, honest early-exit results, and a read-only development inspector that is removed from production.

## Scope and limitations

This is the polished **local-play slice**, not every backend/stretch requirement in the source prompt. There is no multiplayer, matchmaking, authoritative remote server, account, anti-cheat, persistence service, replay video, season economy, cosmetics store, telemetry, or cloud save. Solo bots begin at regional spawn points rather than performing individual airborne drops.

Combat uses local hitscan and visual tracers; rail/launcher behavior and traversal are simplified compared with the full prompt. The grapple uses a forward clear-sight route rather than arbitrary surface anchors, and cable/vent travel follows an exposed scripted path. There are no separate ascender objects, advanced mantle animations, physical ropes, destructible props, or custom imported skeletal assets. Bot steering is lightweight obstacle avoidance, not an exhaustive navmesh; occasional local congestion is possible. Bot healing uses a small fixed recovery reserve. Practice targets do not fire back or respawn automatically; requeue to reset them.

There is no promise of 60 FPS on every device. The measured browser session and exact checks are recorded in [docs/VERIFICATION.md](docs/VERIFICATION.md). Rapier emits an upstream compatibility initialization deprecation warning, but it initializes successfully. Its embedded WASM bundle remains large; the production build reports a size warning rather than hiding it.

See [architecture](docs/ARCHITECTURE.md) and [asset provenance](docs/ASSETS.md).
