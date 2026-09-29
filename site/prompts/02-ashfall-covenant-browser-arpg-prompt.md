# Implementation Prompt: Ashfall Covenant — Browser Action RPG

You are a senior action-RPG engineer, combat designer, systems designer, technical artist, and browser performance specialist. Build **Ashfall Covenant**, an original isometric browser action RPG inspired by the deliberate combat, dangerous exploration, build experimentation, randomized loot, and repeated boss-farming loop of classic gothic ARPGs. It must launch from a URL in a modern desktop browser and be a complete playable vertical slice rather than a static demo.

Do not copy any existing franchise's names, classes, skills, monsters, items, item art, levels, story, UI, fonts, sounds, music, visual motifs, recipes, exact drop tables, or balance values. Keep only genre-level principles: click-to-move combat, readable enemy packs, finite resources, skill trees, equipment-driven builds, randomized affixes, procedural variation, waypoints, escalating difficulty, and meaningful replay.

## Status and Product Contract

- Platform: desktop Chrome, Edge, and Firefox; Safari best effort. No installer, plugin, native launcher, or downloaded executable.
- Primary experience: offline-capable single-player, entirely client-side after assets load. Backend is optional for account sync and future co-op.
- Target session: 20–35 minutes for one complete MVP run; individual dungeon excursions 5–12 minutes.
- Camera: fixed-angle isometric 3D with optional small zoom range.
- Target: stable 60 FPS at 1080p medium on a reasonably modern gaming PC.
- Save: local IndexedDB with explicit versioning, backups, checksum, and recovery; never rely only on localStorage.
- Definition of done: the player can create a hero, clear wilderness and dungeon spaces, fight a boss, collect/equip loot, allocate skills, return via waypoint, complete the act, raise difficulty, and replay for stronger items.

## Game Vision

The player is a Warden entering the ash-covered frontier of Varrow, where a buried star has corrupted animals, dead settlers, and ancient machines. From a small refuge, the player explores a semi-random wilderness, delves into a handcrafted/procedural hybrid crypt, rescues a craftsperson, defeats a multi-phase boss, and refines a character build through skills and loot.

Combat should be readable and tactile: positioning matters, enemies telegraph dangerous actions, animation locks are short but real, recovery resources are finite, and the player wins by understanding a build rather than by holding one button. Loot should frequently offer understandable tradeoffs and occasionally create a strong new direction. The tone is bleak and mysterious, but gameplay feedback remains crisp and colorful enough to read instantly.

## Inspiration Analysis

Preserve these design principles:

- Town, wilderness, dungeon, waypoint, boss, and return-to-town form a satisfying expedition rhythm.
- Randomized item properties create replay value when anchored to stable base items and clear affix rules.
- Character identity comes from class mechanics, skill allocation, attributes, equipment, and resource management together.
- Ordinary packs test area control and target priority; elites change a pack's rules; bosses test recognition and execution.
- Maps benefit from procedural variation, but memorable rooms, landmarks, shortcuts, and quest beats should be authored.
- Death should matter without deleting the character: lost momentum, a retrieval challenge, and durability/gold pressure are enough.
- Difficulty changes should improve enemy behavior, affix density, resistances, and rewards—not merely multiply health.
- Repeated runs need fast access to relevant targets after the first story completion.

## Core Gameplay Loop

1. Launch URL, load shell, detect graphics capability, then Continue or Create Warden.
2. Choose one of two original classes and a body/voice preset; appearance is cosmetic and avoids character-stat differences.
3. Enter Ember Refuge, speak to the quest giver, inspect stash/vendor, and take the wilderness gate.
4. Click to move and attack; fight packs, open containers, collect gold, potions, equipment, glyphs, and waypoint fragments.
5. Compare item tooltips, equip upgrades, allocate attribute and skill points, and adapt hotbar assignments.
6. Find and activate the Ashway waypoint, locate the procedural crypt entrance, and rescue the trapped Artificer.
7. Return to town through the waypoint, identify rare items, salvage unwanted gear, craft one targeted upgrade, then re-enter.
8. Traverse the crypt, defeat an elite guardian, open a shortcut, and fight the act boss.
9. Receive guaranteed boss rewards, complete the act, unlock Veteran difficulty and target-farm portal, and view build/run summary.
10. Replay the boss route or start a new seeded expedition to pursue synergistic items and higher challenge.

## Browser Technology

- **Client/rendering:** Babylon.js using WebGL 2 baseline and optional WebGPU after capability testing. Use baked lighting plus a small dynamic-light budget.
- **UI:** React for menus, character sheet, inventory, skill tree, vendor, crafting, quests, settings, and accessible overlays. Keep combat HUD on a lightweight reactive store with batched updates.
- **Physics:** Rapier 3D WebAssembly for player capsule, enemy capsules, triggers, and simple destructibles. Use authored query shapes, not detailed render meshes.
- **Navigation:** Recast-style navmesh tiles generated offline for authored chunks; connect procedural chunks through validated portals. Use crowd avoidance with explicit attack slots around targets.
- **Game simulation:** fixed 30 Hz combat simulation, render interpolation, data-driven abilities/effects, deterministic seeded loot and dungeon layout.
- **Workers:** generate dungeon plan, decompress optional asset bundles, and calculate expensive item-filter/search tasks off the main thread.
- **Audio:** Web Audio API spatial mixer with buses, ducking, and pooled voices.
- **Assets:** glTF/GLB with meshopt/Draco; KTX2/Basis textures; WebP/AVIF icons and backdrops; OGG/Opus audio; JSON or compact binary tables for items, affixes, enemies, and rooms.
- **Tooling:** Vite, strict TypeScript, schema validation, Vitest, Playwright, visual regression shots, deterministic seed fixtures.
- **Optional services:** Node.js API for accounts/cloud saves/leaderboards and separate authoritative room servers for future co-op. The single-player game must remain playable without them.

## Camera

- Perspective camera at 38° pitch and 45° yaw, looking 18 world units ahead/down at the player; 42° vertical FOV.
- Mouse wheel zoom from 13 to 24 world units, eased over 120 ms.
- Camera follows with a 70 ms soft lag and anticipates movement by up to 1.2 units, but snaps no more than 0.4 units per frame.
- Tall foreground roofs/walls use authored occluder volumes to fade to 15% opacity with dithered edges.
- Camera collision shortens the boom only in rare enclosed rooms; it must not oscillate.
- Holding middle mouse allows a limited ±25° yaw orbit if enabled. Default yaw remains fixed to preserve authored composition.
- Boss arenas lock zoom no closer than 16 units and bias framing toward the boss while keeping the player controllable.
- Screen shake is layered by source, amplitude capped, disabled by reduced-motion, and never affects pointer raycasting.

## Controls

- Left click ground: move; left click enemy: basic attack; hold: continuously path/attack current target.
- Right click: assigned core skill. Q/W/E/R: active skills. 1–4: consumable belt slots.
- Shift: stand still while attacking/casting. Alt: show ground labels. Ctrl: compare equipped item.
- Space: evasive step. It has brief collision phasing against small enemies but no damage invulnerability unless granted by a skill.
- Tab: automap. M: full map. I: inventory. K: skills. C: character. J: quest log.
- F: interact/pick up focused object; optional auto-pickup applies only to gold, glyph dust, and potions below belt cap.
- T: town-gate channel, interrupted by damage. Escape: pause in local game and open menu.
- Mouse buttons 4/5 may be rebound. Every gameplay key is rebindable; include left-handed preset and attack-without-move toggle.

## Player Movement

- Walk speed: 4.6 m/s. Evasive step: 4.5 m over 320 ms, 3 charges, 2.8-second charge recovery.
- Movement follows navmesh paths but aggressively shortens and replans at corners for responsive click-to-move behavior.
- The player rotates toward attack/cast targets during anticipation. Most core attacks allow movement after 60–75% of their animation.
- Hit reactions do not fully lock the player except for explicit stun/knockdown effects with diminishing duration.
- Path clicks outside reachable space project to the nearest valid point and show a brief invalid cursor when projection exceeds 1.5 m.
- Doorways, stairs, bridges, and clutter must accommodate the player plus at least two small enemies without trapping.

## Combat Model

- Player has Health, Focus resource, armor, elemental resistances, stamina charges for evade, attack/cast speed, critical chance, and ailment resistance.
- Damage types: Physical, Ember, Frost, and Blight. Resistances use a clear capped percentage model; armor reduces physical hits with diminishing returns based on hit magnitude.
- Attacks resolve through authored hitboxes, swept melee arcs, projectiles, ground zones, or targeted effects. Cursor targeting must select the closest valid combat target near the ray, favoring visible threats.
- Basic attacks generate Focus. Core skills spend it. Utility and ultimate skills use cooldowns and, when appropriate, charges.
- Health does not regenerate quickly in combat. Potions, class sustain, globes, and shrines provide recovery. Avoid universal life-steal dominance.
- Critical hits use larger damage numbers, a distinct impact layer, and audio; do not obscure enemy telegraphs.
- Crowd control categories: slow, root, stagger, stun, knockback. Bosses convert hard control to stagger-meter damage.
- Elites receive two modifiers on Veteran and up to three later. Modifier combinations have incompatibility tags and a threat budget.
- Player death drops an Echo at the death point containing 10% of carried gold and a temporary 8% maximum-health blessing. Reclaim it once; dying again moves the Echo but does not compound loss. Respawn at the last waypoint with equipment durability reduced 5%.

## Classes, Skills, and Abilities

Implement both classes completely. Each has a basic attack, one class resource interaction, six unlockable active skills, six passive nodes, and two mutually exclusive capstones. The MVP level cap is 20 with enough points to create distinct builds but not unlock everything.

### Cinder Vow — armored close-range battlemage

Identity: converts blocked or endured damage into Heat, then spends Heat for explosive control.

- **Iron Litany:** basic mace sequence; third hit emits a small frontal wave.
- **Brand Arc:** right-click sweeping flame attack; Focus cost; bonus against burning targets.
- **Bastion Step:** short shield rush that interrupts light enemies and grants Guard for 2 seconds.
- **Cinder Ring:** delayed circular eruption centered on the player; clear 650 ms telegraph.
- **Vow Chain:** skillshot chain that pulls light enemies or pulls the player toward heavy targets.
- **Furnace Heart:** temporary stance consuming Heat over time for attack speed and Ember conversion.
- **Ashen Standard:** plant a standard that increases defense and periodically taunts nearby lesser enemies.
- Passives support block/Heat, burning, two-handed burst, one-handed defense, potion efficiency, and retaliation.
- Capstones: **Living Crucible** for Heat cycling or **Unbroken Oath** for Guard/retaliation.

### Veil Ranger — mobile bow and trap specialist

Identity: marks targets through movement and alternating attacks, then detonates marks or controls lanes.

- **Quickshot:** basic bow shot; firing after moving at least 2 m adds one Trace mark.
- **Splinter Volley:** short cone of arrows; strong against clustered enemies.
- **Ghostline:** piercing arrow that detonates Trace marks for secondary damage.
- **Snare Bloom:** placed trap that arms after 500 ms, roots lesser enemies, and slows elites/bosses.
- **Mothcloak:** 1.5 seconds of camouflage broken by attacking; grants movement and one guaranteed evade, not permanent invisibility.
- **Backstep Flask:** leap backward and leave a Blight pool at origin.
- **Horizon Call:** ultimate that rains a moving line of arrows across a targeted corridor.
- Passives support marks, traps, critical positioning, ailment application, evade, and resource recovery.
- Capstones: **Thousand Trails** for mark chains or **Patient Hunter** for traps and heavy single shots.

Every skill definition must include tags, cost, cooldown, targeting type, animation timing, coefficients, ailment chance, allowed modifiers, VFX/SFX IDs, cancel window, and AI threat response. Tooltips derive from the same data used by simulation.

## World and Maps

### Ember Refuge

A compact safe hub with stash, vendor, healer, Artificer station after rescue, waypoint, quest NPCs, training dummies, and portals. It loads in one chunk and has no combat.

### The Soot March

A semi-procedural wilderness assembled from 20 authored tiles into a 4×4 logical grid, selecting 10–12 tiles per seed. Required anchors: refuge gate, ruined tollhouse, waypoint shrine, crypt entrance, optional hunter camp, one elite event, and a boss-gate vista. Tiles may rotate only when lighting and landmarks remain coherent. Paths create at least one loop and one shortcut; no objective may spawn in a dead-end longer than 20 seconds of travel without a reward.

### Hollow Archive

A three-floor crypt using authored rooms connected by procedural graph rules. Floor 1 teaches traps and undead machines. Floor 2 introduces corrupted scholars and a lever shortcut. Floor 3 is a handcrafted boss approach and arena. Each floor must have a visual landmark, predictable exit rules, and a cap on repeated room templates.

### Encounter Spacing

- Alternate traversal, small pack, medium pack, interactable, and set-piece beats.
- Maintain at least 6 m of telegraph space around dangerous ranged packs.
- Pack budgets use role points: fodder 1, skirmisher 2, controller 3, bruiser 4, elite +6. MVP normal packs target 5–10 points.
- Do not spawn enemies in camera-obscured foreground or within 4 m of the player outside explicit ambush warnings.

## Game Modes

- **Story Expedition:** the canonical Normal/Veteran act progression with quests, saves, waypoints, loot, and boss unlocks.
- **Target Hunt:** unlocked after first act completion; opens a short seeded route to either defeated boss, preserving normal resource/loot rules and recording completion time without replacing the main expedition.
- **Training Cell:** accessible from Ember Refuge; configurable target dummies and basic enemies, damage breakdown, free skill/hotbar experimentation, and no loot/XP rewards.
- Future co-op, seasonal realms, PvP, and endless dungeons are not part of the MVP.

## Enemies and AI

Create at least ten normal enemy types, three elite templates, and two bosses:

- Ash Crawler: fast fodder, surrounds but yields attack slots.
- Bell Husk: slow bruiser with a telegraphed overhead slam.
- Soot Archer: repositions to range and leads shots slightly.
- Grave Scribe: raises one fragile ward that buffs allies; priority target.
- Lantern Mite: explodes after a clear wind-up; can damage enemies.
- Chain Pilgrim: hook attack, then slow advance.
- Archive Warden: shield facing and punishable turn time.
- Quill Swarm: flock entity that splits at half health.
- Mire Hound: flanks and retreats after a lunge.
- Censer Adept: lays persistent zones and moves away from melee.

AI uses perception, navigation, attack slots, and state machines: Dormant, Investigate, Approach, Reposition, Telegraph, Execute, Recover, Flee/Regroup, Dead. Groups elect a limited number of simultaneous heavy attackers so combat stays readable. Ranged enemies avoid stacking. Enemies can lose sight and search last-known positions.

Elite modifiers: Ember Wake, Mirror Shell, Rallying, Frost Pulse, Burrowing, Vampiric Bond. Define exclusions, cooldowns, telegraphs, and reward budget. Never combine effects that eliminate all safe space.

Bosses:

- **The Toll-Keeper:** wilderness gatekeeper with chain sweeps, summoned lanterns, and a breakable armor meter. Teaches lateral dodging and add priority.
- **Orison Engine:** final three-phase machine-organism. Phase 1 rotates beam lanes and summons repair scribes. Phase 2 exposes three conduits while arena quadrants gain delayed Blight. Phase 3 combines a slower beam pattern with a stagger race. Checkpoint immediately before arena; no unskippable cutscene on retry.

Bosses expose deterministic patterns with weighted variation, anti-repeat rules, health thresholds, enrage after a generous time, and telemetry for cause of death.

## Physics and Environmental Interaction

- Capsule collision for actors; swept shapes for fast projectiles; trigger volumes for hazards and pickups.
- Small props break cosmetically with pooled debris that loses collision after 500 ms.
- Doors, levers, bridges, traps, urns, and explosive braziers are gameplay interactables. Explosives damage enemies and player with clearly colored radius preview.
- Corpses become non-colliding immediately and fade after loot resolution. Ragdolls are optional cosmetic simulations limited to six active bodies.
- Ground effects conform to walkable surfaces and may not render through floors.

## Items, Loot, and Inventory

### Equipment

Slots: weapon main hand, off hand, head, chest, gloves, boots, belt, amulet, and two rings. Two-handed weapons occupy both hands. Inventory is a 10×6 grid where items occupy 1×1, 1×2, or 2×3 cells. Add sort, rotate only if art supports it, compare, favorite, drop, equip, salvage, and item filter.

### Rarity

- Worn: base item, no affix; common early salvage.
- Tempered: 1–2 affixes.
- Inscribed: 3–4 affixes and a slightly elevated roll range.
- Relic: fixed original special power plus 2–3 supporting rolls; visually and audibly distinct.

Rarity must not automatically dominate item level and affix synergy. Use color plus text/icon shape; never rely on color alone.

### Affix Model

Use base type, item level, rarity budget, prefix pool, suffix pool, weights, tiers, tags, incompatibilities, and roll range. Affixes include attributes, flat damage, percentage damage by tag, attack/cast speed, armor, resistances, health/focus, potion properties, skill ranks, conditional bonuses, and ailment interactions. Do not generate useless affixes that cannot affect either class unless the item filter labels them clearly.

Loot RNG is seeded per run. Bosses guarantee one Inscribed-or-better item on first completion and use bad-luck protection for Relics. Display item level and advanced ranges behind an option.

### Consumables and Crafting

- Belt carries four potion stacks with a max of 5 each: red health, blue Focus, white cleanse, gold resistance tonic.
- Glyphs socket into eligible gear and add a single predictable modifier. Three lower glyphs combine into one higher tier.
- Artificer can identify Inscribed/Relic items, salvage to dust, reroll one chosen affix with escalating cost, repair durability, and add one socket when allowed.
- Gold is used for vendors, repairs, identification, and crafting. Dust is crafting-only. No premium currency.

## Progression

- **Session/character:** XP from enemies and quests; level cap 20. Each level grants one skill point; every other level grants one attribute point. Attributes are Might, Finesse, Will, and Vigor with explicit derived-stat previews.
- **Quest:** unlock waypoint, rescue Artificer, open Archive, defeat Engine. Optional hunter event grants one permanent potion capacity upgrade.
- **Difficulty:** Normal then Veteran. Veteran begins at recommended level 15, adds elite density, new boss pattern variants, resistance pressure, and better affix tiers.
- **Persistent:** each character save retains level, gear, stash, unlocked waypoints, recipes, act completion, and difficulty. Account-wide local profile stores cosmetics and tutorial flags only.
- Respec costs modest gold and is free through level 8. The player may save two named loadout snapshots, but changing gear still requires owning items.

## UI and UX

- Main menu: Continue, Create Warden, Characters, Settings, Credits. Show save timestamp and corruption recovery option.
- HUD: red health orb left; Focus/class resource right; skill bar center; potions 1–4; XP strip; minimap top-right; quest tracker beneath; buffs/debuffs with durations; boss bar top-center.
- Inventory: grid, equipment silhouette, gold/dust, sort, search/filter, side-by-side comparison, affix explanations.
- Skill tree: zoomable but small; show prerequisites, current/next values, tags, and refund cost. Avoid fake complexity with hundreds of filler nodes.
- Character panel: base and advanced stats with formula tooltips and current caps.
- Ground labels: collision avoidance, rarity priority, distance fade, stack count, and filter rules. Alt toggles persistent display mode.
- Automap: discovered rooms/paths, waypoint, exits, quest zones, party markers later; never reveal unexplored procedural layout.
- Vendor/crafting: preview cost and result constraints before confirmation; prevent accidental destruction of favorited/equipped/Relic items.
- Death: clear cause, damage type, respawn and Echo explanation. Victory: drops remain available before summary.
- Settings: quality preset, dynamic resolution, shadows, particles, gore/debris, screen shake, damage numbers, item labels, keybinds, audio buses, subtitle/flash/reduced-motion/colorblind options.
- Loading/error states: asset retry, save migration failure, graphics initialization failure, low-memory fallback, offline state, future cloud conflict resolution.

## Visual Direction

Use painterly gothic fantasy with original industrial-celestial motifs: charcoal earth, bleached stone, oxidized brass mechanisms, dim red ash, cold moonlight, and rare cyan star-metal. Characters use strong shoulder/weapon silhouettes and restrained material detail at isometric scale. Enemies are readable by posture and emission pattern before surface texture.

Lighting combines baked probes/lightmaps, one directional moon, localized fire/skill lights with strict caps, SSAO on medium+, and contact shadows. Use fog volumes to separate depth without veiling ground telegraphs. Blood/gore is stylized and adjustable. VFX colors are semantic: player-safe/beneficial teal-gold, enemy Ember orange-red, Frost pale blue, Blight acid violet, physical neutral white/gray. Colorblind patterns and boundary lines remain available.

Animation uses decisive anticipation and recovery, not floaty blending. Foot planting matters. Enemies freeze briefly on strong impacts (hit stop 25–55 ms, simulation-safe), while the UI and camera continue smoothly.

## Models and Assets

Required: two player rigs with weapon variations; 10 normal enemy families; three elite overlays; two bosses; town NPCs; modular wilderness and crypt kits; props; destructibles; waypoint; portals; loot models; icons; portraits; UI frames; 60+ VFX; and a complete audio set.

Player animation set: locomotion in eight directions, idle variants, weapon basics, six skills per class, evade, hit, stagger, death, revive, interaction, town-gate. Use animation events only as presentation cues; simulation timings come from data. Enemy animation state names follow a validated convention.

Use shared 1K/2K atlases, trim sheets, vertex color variation, and three LODs for major actors. A single ordinary enemy should generally stay below 25k triangles at LOD0; bosses below 120k. Provide simplified shadow/collision meshes. Validate glTF scale, pivots, skeleton bounds, materials, texture compression, and animation clips in CI.

## Audio

- Original dark ambient score with town, wilderness, crypt, elite, boss phase, victory, and low-health states. Music must not imitate recognizable melodies.
- Weapons need layered swing, contact by material, critical, block, and miss/air sounds.
- Enemy telegraphs use distinct pre-attack cues that remain audible through combat mix. Dangerous off-screen projectiles receive directionally biased warnings.
- Spatial ambience: wind, ash, distant bells, insects, machinery, dripping vaults, room reverb zones.
- UI: loot rarity, equip, compare, invalid action, potion, skill ready, waypoint, quest update, and level-up cues.
- Limit repetitive barks with cooldowns and shuffle bags. Include subtitles for story speech and visual equivalents for critical audio cues.

## Multiplayer Architecture

Multiplayer is deferred, but future 1–4 player co-op must be architecturally possible.

- Local MVP owns simulation and writes versioned save state client-side.
- Future room server owns enemies, loot rolls, item IDs, combat, quest state, nav authority, and trade. Clients send input intents and predict only local locomotion/cosmetic casts.
- Server tick 30 Hz; snapshots 10–15 Hz with interpolation, reconciliation, ability event stream, interest management by room/adjacency, and lag-compensated hit validation only where fair.
- Instanced loot is generated and signed by server. Item payloads use immutable unique IDs and server-side provenance to prevent duplication.
- Town/lobby, invite, reconnect, host migration avoidance, save merge rules, party scaling, downed/revive, and anti-cheat require separate roadmap work.
- Never implement peer-hosted authority for public progression.

## Performance Budget

- Frame budget: ≤8 ms CPU and ≤11 ms GPU typical at 1080p medium; no garbage collection spike over 4 ms during combat.
- Visible actors: 45 normal enemies, 3 elites, 1 boss, player, 20 pickups; simulate at most 90 active agents per zone.
- Draw calls: <300 typical, <450 peak. Visible triangles: <2.5M high, <1.2M medium, <650k low.
- GPU texture budget: <550 MB high, <300 MB medium. JS/WASM heap steady state <700 MB.
- Dynamic lights casting shadows: one; unshadowed local lights ≤12 visible. Decals ≤80 active. GPU particles ≤25k high/8k low.
- Physics and navigation combined average <3 ms/frame; update distant AI at reduced frequency without changing combat results.
- Initial shell <2 MB compressed; first playable town/tutorial assets <35 MB; progressive act download <180 MB. Preload boss bundle before the approach, not during combat.
- Audio ≤40 simultaneous voices, with priority virtualization.
- Cache immutable hashed assets in a service worker; retain a version manifest and safe cache eviction path.

## Architecture

- `app-shell`: boot, capability checks, routes, service worker, crash recovery.
- `game-session`: lifecycle, fixed timestep, pause, seed, difficulty, save checkpoints.
- `entity-combat`: actors, attributes, effects, hit resolution, threat, death.
- `abilities`: data schemas, targeting, execution graphs, cooldown/resource rules.
- `items`: base items, affixes, generation, inventory grid, equipment, filters, serialization.
- `progression`: XP, attributes, skill trees, quests, difficulty, respec.
- `world-generation`: seed graph, tile constraints, landmark placement, validation.
- `navigation-ai`: nav tiles, perception, attack slots, behaviors, boss director.
- `renderer-vfx`: scene, actor views, animation, decals, particles, lights, quality.
- `ui`: HUD, inventory, skills, vendors, quests, menus, accessibility.
- `audio`: mixer, spatial zones, adaptive music, concurrency.
- `persistence`: IndexedDB repository, migrations, backup/restore, optional cloud adapter.
- `content-tools`: schema compiler, loot simulator, seed browser, encounter editor, asset validator, performance benchmark.

Simulation owns truth; animation, VFX, and UI consume typed events. Do not put item generation, damage, or quest completion in React components. All content definitions are schema-validated and versioned.

## MVP

Ship two classes, levels 1–20, one town, one semi-procedural wilderness, one three-floor dungeon, ten normal enemies, three elite modifier templates, two bosses, roughly 80 base items, at least 45 affixes, eight original Relics, glyphs, vendor, crafting/salvage, stash, waypoints, quests, Normal/Veteran, save/load, settings, and complete audio/visual feedback.

Defer online co-op, trading, seasons, ladders, more acts, mercenaries, PvP, global auction systems, endless dungeons, monetization, and hundreds of skills. Do not show dead buttons for deferred features.

## Expansion Roadmap

1. Balance instrumentation, more Relics, skill variants, item filter presets, controller support.
2. Account/cloud save service with explicit conflict UI and import/export.
3. Authoritative 1–4 player co-op, party scaling, instanced loot, reconnect, and abuse controls.
4. Second act biome, third class, companion, additional bosses, advanced crafting.
5. Seasonal challenge realms, target-farm rotations, leaderboards with server-verified runs.
6. WebGPU-enhanced lighting/particles while retaining a functional WebGL 2 path.

## Testing and Acceptance Criteria

- [ ] A first-time user can launch the URL, create either class, finish an input tutorial, and enter the refuge without an external account.
- [ ] The player can click to move, basic attack, cast all equipped skills, evade, use potions, interact, loot, compare, equip, salvage, craft, allocate points, and respec.
- [ ] A complete seed contains every required landmark, a valid connected route, no unreachable objective, no blocked portal, and no duplicate forbidden room sequence.
- [ ] The player can activate the waypoint, rescue the Artificer, open the Archive, defeat both bosses, see credits/summary, and unlock Veteran.
- [ ] Each class supports at least two viable level-20 builds with materially different rotation, gear priorities, and strengths.
- [ ] Every enemy attack that can remove more than 20% of expected player health has visible anticipation, audio cue, valid avoidance window, and post-attack recovery.
- [ ] Loot respects item level, rarity budget, class usability rules, affix exclusions, deterministic seed, favoriting protections, and bad-luck guarantee.
- [ ] Save/load restores character, inventory layout, stash, quests, waypoints, skills, difficulty, seed, and settings. Interrupted writes recover from the last good backup.
- [ ] Death, Echo recovery, durability, town-gate interruption, full inventory, full potion belt, unreachable click, and item-destruction confirmation all behave as specified.
- [ ] The target benchmark sustains 60 FPS median and ≥50 FPS 1% low at 1080p medium with 45 enemies and heavy VFX.
- [ ] UI is usable at 100%, 125%, and 150% browser scaling, with remapped keys and colorblind/reduced-motion modes.
- [ ] No proprietary assets, names, story beats, monsters, item art, fonts, sound, music, or copied level layouts are present.

## Required Delivery Artifacts

Provide source, production build, setup/deployment guide, architecture notes, content schemas, asset manifest/licenses, save format and migration plan, deterministic seed fixtures, item/affix balance tables, encounter telemetry hooks, automated tests, benchmark scene, browser compatibility matrix, known limitations, and a short capture showing character creation through boss victory and one Veteran replay.
