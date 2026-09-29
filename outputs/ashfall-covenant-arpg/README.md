# Ashfall Covenant — Astra remake

Ashfall Covenant is an original isometric browser action RPG vertical slice. It uses React for the shell and Babylon.js for the procedural 3D expedition.

## Run

```powershell
npm install
npm run dev
```

Production checks:

```powershell
npm test
npm run build
```

## Controls

- Left click ground to move. Left click an enemy to pursue and use the basic attack.
- Right click uses the class core skill at the pointer.
- `Q`, `W`, `E`, and `R` cast active abilities.
- `V` uses Ashen Standard (Cinder) or Horizon Call (Ranger). Mouse wheel adjusts the isometric zoom.
- `Space` evades. `1` drinks a health potion. `F` interacts or collects nearby equipment.
- `I` opens inventory, `K` skills, `C` character, `J` quests, and `Tab` or `M` opens the automap.
- `T` returns to Ember Refuge after the Ashway is active. `Escape` pauses.

## Playable slice

- Create a Cinder Vow or Veil Ranger and follow a full expedition from Ember Refuge through the Soot March and Hollow Archive.
- Fight ten enemy archetypes, elite variants, the Toll-Keeper, and the three-phase Orison Engine.
- Use class-specific Focus, Heat, Trace, cooldown, evade, potion, ailment, stagger, armor, and resistance-adjacent combat systems.
- Collect deterministic seeded equipment across four rarities, compare power, equip upgrades, favorite items, and salvage unwanted drops to dust.
- Earn levels and skill points, allocate three ranks in each active ability, view derived character statistics, and refund a build.
- Activate the Ashway, rescue Artificer Sable, complete the act, and unlock Veteran and Target Hunt replay options.
- Persist the character in versioned IndexedDB records with checksums and one-generation backup recovery.

## Architecture

- `src/game/simulation.ts`: deterministic 30 Hz combat, AI, progression, quests, bosses, drops, and player actions.
- `src/game/runtime.ts`: Babylon.js scene, procedural actors and environment, picking, camera, minimap, effects, and input.
- `src/game/loot.ts`: seeded base-item, rarity, affix, inventory-placement, and power rules.
- `src/game/persistence.ts`: IndexedDB schema, checksum validation, active record, and backup recovery.
- `src/game/content.ts`: shared ability, enemy, item-base, affix, class, and quest definitions.
- `src/ui/App.tsx`: menus, creation, HUD, inventory, skills, character, quest, map, settings, pause, and victory surfaces.

## Asset license

The menu key art was generated specifically for this project. The 3D world, actors, VFX, minimap, and sound are generated procedurally at runtime. No third-party game assets, fonts, music, or sound effects are included.

## Known scope limits

This is a local single-player vertical slice. Online co-op, authoritative servers, trading, controller support, full glTF production art, and long-form multi-act content remain future work.

## Astra edition changes

The expedition now uses articulated armored/cloth heroes, animated limbs and weapons, distinct quadruped/caster/armored silhouettes, a chain-bearing Toll-Keeper and an armillary Orison Engine. The refuge, ruined causeway and library approach have masonry, terraces, weathered stone, braziers, bookshelves and authored foliage. Combat has grounded rings, floating damage, sparks and readable objective labels. Camera zoom and focus-loss pause are functional.

Gameplay fixes include non-overlapping grid packing; class-compatible starter weapons (including repair of older weaponless saves); paused-action protection; ability-specific ranks; working attribute points and capstone choices; protected Relic salvage; an Artificer refinement action; refuge supplies; and Veteran/Target Hunt preserving the Warden's gear and levels. The final reward can be collected before replaying. Save payloads are cloned before asynchronous writes.

## Validation and honest scope

`npm test` currently passes 15 checks, including two complete normal expeditions driven through the public simulation intents, one for each class. See [verification](docs/ASTRA-VERIFICATION.md) for browser evidence and remaining gaps. `npm run build` typechecks and generates `dist/`.

This remains a compact authored expedition, not the original prompt's entire 20–35 minute production specification. The world is a connected outdoor-to-archive route, not three streamed procedural crypt floors. Navigation/collision is simplified and decorative architecture is not a full navmesh. Several future catalog affixes are excluded from new loot until they have a simulated effect. Existing narrative Relic powers are not all bespoke scripted powers. Four potion types, stash/loadouts, a full vendor economy, Echo retrieval, save-file import/export, advanced key rebinding, and controller support are not implemented. No online features or benchmark-machine performance are claimed.

Production registers a same-origin service worker to cache assets after loading; an unvisited resource is not guaranteed to work offline. Existing saves stay in the `ashfall-covenant` IndexedDB database and retain schema version 1. Only one active character plus its backup is supported.
