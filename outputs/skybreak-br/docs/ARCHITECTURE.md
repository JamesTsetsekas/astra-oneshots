# Architecture

`src/game/session.ts` owns match authority. Input commands enter a fixed 30 Hz loop; UI components never directly compute damage, loot ownership, storm damage, or victory. Its deterministic random source is seeded per match. Gameplay timing follows simulation ticks rather than wall-clock callbacks. A surviving actor is named winner only when exactly one actor remains. Eliminated players retain their real placement while spectating; an early exit reports an undecided winner, and an alive early exit is DNF rather than a fabricated placement.

`world.ts` defines height, buildings, shared solid obstacles, ray/terrain visibility, and traversal anchors. `physics.ts` constructs Rapier's heightfield and obstacle colliders from the same source. The player's capsule is a kinematic character with slopes, stepping, ground snap, gravity, and camera-side collision avoidance. Bots use cheaper planar collision steering over the same obstacle data, and combat visibility includes terrain samples.

`content.ts` contains weapon/consumable/rarity/cosmetic data. The five-slot inventory stores independent magazine counts. Reload draws only from bounded reserve ammunition. Damage drains Aegis, then Reserve Shield, then Health; storm damage affects Health directly. Elimination releases actual held items. Utility effects operate on simulation state; Echo Beacons take a snapshot of footsteps at least 1.5 seconds old, never moving live enemy silhouettes.

`runtime.ts` connects keyboard/pointer input, frame scheduling, pointer-lock fallback, cleanup, audio, view updates, and a throttled React HUD snapshot. It clears input on lost focus, modal opening, and pointer release. Physics resources, event listeners, audio context, render loop, and scene are disposed on exit/requeue.

`render/island.ts` constructs the island, original buildings and terrain. Static geometry merges by material. `models.ts` builds original articulated scavengers, wing-sails, weapons, and utility props. `game-view.ts` updates the third-person camera, near-player loot visuals, storm wall, effects, historical footprint markers, and dynamic shadows. Babylon imports are explicit subpaths; Vite groups only already-imported modules instead of pulling the complete engine barrel.

React owns menu, settings, guide, map, inventory, results, and career presentation. Settings and reports are versioned local storage data. Missing/corrupt storage falls back safely; storage exceptions do not prevent playing. There are no network APIs or embedded secrets. Production excludes the read-only `window.__skybreak` inspector.

## Verification seams

Vitest exercises deterministic storm containment, player collision, deployment, damage/ammunition/reload, healing/inventory, true-winner behavior, full bot convergence, storage recovery, and original model/terrain geometry. `scripts/browser-proof.js` and `scripts/combat-proof.js` are development-only browser drivers: they read the inspector and send keyboard/pointer events through ordinary game handlers. They do not set health, ammo, positions, timers, outcomes, or scores.
