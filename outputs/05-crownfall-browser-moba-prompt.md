# Implementation Prompt: Crownfall — Browser Lane-and-Objective MOBA

You are a senior MOBA engineer, combat and champion designer, multiplayer/network specialist, AI engineer, level designer, technical artist, and browser performance engineer. Build **Crownfall**, an original browser-based team MOBA inspired by the strategic depth of lane pressure, last-hitting, role synergy, vision control, item builds, neutral objectives, and base destruction. It must launch from a URL and provide a full match from hero selection to victory, not a static arena demo.

Do not copy any existing game's champions, abilities, silhouettes, lore, map geometry, objective creatures, item names/icons, formulas, sound/music, UI, terminology, or exact balance. Use an original world, original hero kits, a compact original map, and genre-level principles only.

## Status and Product Contract

- Platform: modern desktop Chrome, Edge, and Firefox; Safari best effort. No native client.
- MVP format: 3v3 on a compact two-lane map with jungle pockets, six fully original heroes, server bots, unranked matchmaking, and 14–22 minute matches.
- Long-term architecture: supports 5v5 and larger maps without rewriting combat, fog, navigation, items, or netcode.
- Server: authoritative 30 Hz game simulation, 10–20 Hz interest-filtered deltas/events, client-side local intent prediction and render interpolation.
- Target: 60 FPS at 1080p medium with 60 lane units, six heroes, jungle actors, structures, projectiles, and effects.
- Victory: break one lane's Seal, destroy both Core Towers, then destroy the enemy Crown Engine.
- Complete loop: launch, tutorial, queue, hero draft, load, lane/jungle progression, objectives/team fights, base victory, results, progression, requeue.

## Game Vision

Crownfall takes place on a shattered sky-island where two guilds race to seize a reality engine. Three players per side select heroes with complementary roles, gain gold and experience during the match, buy items, destroy defensive structures, contest neutral catalysts, create vision, and coordinate team fights. The map is compact enough to learn quickly but supports meaningful rotations between upper and lower lanes through a central mistwood.

The desired experience is legible strategic escalation. Early play emphasizes lane spacing, last hits, resource trades, and gank awareness. Midgame opens through fallen towers and neutral objectives. Late game centers on coordinated fights, wave pressure, vision denial, and committing to the Crown Engine. Mechanical mastery matters, but decisions should remain readable to new players through strong telegraphs, clear objectives, build recommendations, and bots that model sensible play.

## Inspiration Analysis

Preserve these principles:

- Heroes begin each match weak and grow through XP, skill points, gold, and items.
- Lanes continuously create pressure through AI minion waves; converting a fight into structures matters more than kills alone.
- Last-hitting provides controllable income, while nearby XP ensures players still progress.
- Roles emerge through kit strengths, economy needs, and map responsibilities—not forced queues in the MVP.
- Fog of war, wards, brush, sound/VFX, and missing enemies make information a strategic resource.
- Towers create safe territory and punish reckless dives with explicit targeting rules.
- Neutral objectives offer team-wide benefits and force conflict away from lanes.
- Items allow adaptation while avoiding a few universally correct purchases.
- Comeback mechanisms should create chances without erasing an earned lead.

## Core Gameplay Loop

1. Open URL, choose Tutorial or Play, and complete capability/network checks.
2. Matchmaker seats six players, filling with named bots if necessary in Unranked.
3. Simultaneous hero select for MVP: choose among six heroes, view roles/difficulty/kit, select two universal Talents, lock in. Duplicate hero not allowed per team but mirrored enemy pick is allowed.
4. Load the map, buy a starter item, assign first skill point, and leave the fountain.
5. Lane or jungle: last-hit minions/monsters, trade damage, manage mana/energy, place wards, and avoid ganks.
6. Gain levels 1–12, rank skills, buy items on recall, destroy outer towers, contest catalysts, and rotate.
7. Defeat the central **Aether Colossus** to empower nearby allied minions and create a timed siege window.
8. Break an enemy lane Seal, enabling Vanguard minions in that lane. Destroy both Core Towers and the Crown Engine.
9. Show result, match timeline, hero/items/skill build, damage, gold, vision, structures, objective participation, and commendation.
10. Persist cosmetic mastery and match history; requeue or enter build review.

## Browser Technology

- **Rendering:** Three.js behind a small renderer abstraction. Start with `WebGLRenderer` for the broadly proven WebGL 2 path; add `WebGPURenderer` only after hero VFX, picking, fog, and material parity tests pass. A custom Three.js layer suits the MOBA's planar world, instanced lane units, server-owned 2.5D simulation, and strict need to keep rendering independent from gameplay. Use stylized PBR/unlit hybrid materials, baked lighting, GPU particles, decals, instancing, and scalable shadows.
- **Client:** strict TypeScript. Render/entity view is separate from authoritative state. React handles shell, draft, item shop, settings, scoreboard, results; combat HUD updates through batched read models.
- **Simulation:** server-side data-oriented ECS at fixed 30 Hz. Shared pure definitions for targeting, stats, abilities, and items; server alone mutates truth.
- **Navigation:** navmesh/path graph plus deterministic lane splines. Hero movement uses server path requests and client-predicted cursor intent. Minions use lane waypoints and local avoidance.
- **Networking:** Node.js/TypeScript authoritative rooms over secure WebSockets using Colyseus or equivalent; state deltas filtered by team fog; command/event streams; reconnect snapshots.
- **Physics:** custom 2.5D shapes for actors, projectiles, blockers, and areas. Full rigid-body physics is unnecessary and risks nondeterminism.
- **Audio:** Web Audio API spatial mixer, announcer/event priority, music intensity layers.
- **Assets:** glTF/GLB with mesh compression, KTX2, WebP/AVIF, OGG/Opus, schema-validated hero/item/ability/map data.
- **Services:** matchmaker, guest/account identity, profile/match history, rating later, reports; PostgreSQL and Redis; object storage for replays.
- **Tools:** ability graph/data editor, item simulator, headless balance matches, nav/fog viewer, replay inspector, network lab, asset/performance validator.

## Camera

- Perspective isometric camera at 52° pitch and 45° yaw, default 34 world-unit height and 45° vertical FOV.
- Camera pans via edge scroll, middle-mouse drag, or WASD; Space follows hero while held; F1 centers hero.
- Mouse wheel zoom 28–42 units. Clamp to team-relevant map bounds with extra spectator rules.
- Optional camera lock toggled by Y, with soft look-ahead toward cursor capped at 2 m.
- Height remains stable over terrain; map is gameplay-planar except authored ramps/bridges represented by navigation layers.
- Large foreground props fade with dither. The camera never passes through geometry or changes ability raycast.
- Screen shake is minimal, layered, and accessibility-controlled. High-threat ultimates may use world-space emphasis without moving the aim point.

## Controls

- Right click ground: move; right click enemy: move/attack; A then click: attack-move.
- Q/W/E/R: hero abilities. Ctrl+Q/W/E/R: rank skill. D/F: selected universal Talents.
- 1–6: item actives/consumables; B: recall; P: shop when in range/fountain; 4 default ward trinket if not occupied.
- S: stop; H: hold; Space: center/follow hero; Y: camera lock.
- Tab: scoreboard; C: advanced stats; M: expanded map; G or Alt+click: contextual ping wheel.
- Shift+Enter team chat, Enter allied chat in MVP; text is filtered/rate-limited and can be disabled.
- Alt shows ranges/extended tooltips; Ctrl compares item; Escape cancels targeting/menu.
- Quick cast, quick cast with indicator, and normal cast are configurable per ability. Full key remapping and edge-scroll alternatives are required.

## Player Movement

- Heroes use click-to-move with base speeds 3.4–3.9 m/s, radius 0.45–0.65 m, acceleration smoothing 80–120 ms for animation only. Server path state changes immediately on valid command.
- Pathfinding must shorten against navmesh corners, detect blocked endpoints, and handle unit collision without orbiting.
- Allied heroes soft-collide; enemy heroes block. Minions have soft allied separation and limited enemy blocking so body-blocking exists but cannot permanently trap at spawn.
- Dashes define start, direction/target, distance, speed curve, collision behavior, interrupt rules, and endpoint correction. Teleports define target validation and reveal behavior.
- Roots prevent movement commands/dashes according to tags; slows combine by strongest-only unless explicitly multiplicative. Stun, airborne, suppression, silence, disarm, blind, and cripple are separate effect tags with clear UI.

## Combat and Stat Model

- Damage types: Physical, Arcane, and Pure. Armor and Ward use `reduction = defense / (100 + abs(defense))` for nonnegative values; negative values amplify with a mirrored bounded formula.
- Core stats: max health, health regen, mana/energy, resource regen, attack damage, ability power, attack speed, armor, ward, move speed, haste, critical chance, penetration, healing/shield power.
- Basic attacks have windup, release, backswing, range, missile speed if ranged, and attack-speed scaling. Moving after release cancels backswing but not the attack.
- Abilities use targeted, direction, point, vector, self, channel, toggle, or passive targeting. Every cast has cost, cooldown, range, cast time, lockout, interrupt rules, shapes, tags, and server validation.
- Health bars segment at useful thresholds; shield layer is distinct. Damage numbers are optional and locally aggregate multi-hit spam.
- Lethal damage triggers death; respawn time starts 7 seconds and scales to 34 seconds by level and match time. Killer/assist gold uses contribution windows; team receives no global kill gold.
- Recall channels 7 seconds, canceled by champion/structure damage and explicit displacement. Fountain heals quickly and shop works only in fountain.
- Bounties accumulate modestly for kill streak and large gold lead, capped and visible. A comeback team never receives hidden damage buffs.

## Original Hero Roster

Implement six complete heroes. Each has passive, Q/W/E/R, original model/animation/VFX/audio, recommended items, bot behavior, and at least two viable build directions.

### 1. Brannoch, Bastion Mason — Vanguard/Tank

- Passive **Set in Stone:** after standing near an enemy hero for 3 seconds, gain a small decaying armor/ward stack; moving far resets build-up.
- Q **Fault Hammer:** short frontal slam; outer edge slows, inner edge deals bonus stagger.
- W **Rampart Fold:** raise a short curved wall for 3 seconds; blocks movement/projectiles but has health and can be destroyed.
- E **Anchor Line:** tether to ally or terrain; recast pulls Brannoch toward it and grants a brief shield.
- R **Citybreaker:** long telegraphed leap and circular knock-up; cannot cross the whole map.

### 2. Suri Vale, Ember Courier — Marksman/Skirmisher

- Passive **Hot Route:** moving charges the next basic attack with Ember damage; repeated attacks without movement lose bonus.
- Q **Ricochet Bolt:** skillshot that bounces once from terrain with a preview line.
- W **Slipstream:** short dash leaving a speed lane allies can use once.
- E **Parcel Charge:** attach a timed charge to an enemy/minion; attacks accelerate detonation.
- R **Redline Delivery:** channel briefly, then fire a long corridor shot; damage increases with travel distance and reveals Suri during windup.

### 3. Oru, Choir of Moths — Support/Controller

- Passive **Shared Wing:** shields Oru grants return a small portion as delayed health if not broken.
- Q **Luminous Swarm:** slow projectile that damages enemies or shields an ally.
- W **Hush Field:** circular zone reducing enemy vision radius and muting noncritical audio without hiding mandated telegraphs.
- E **Guiding Draft:** targeted ally gains speed; next ability hit on an enemy marks them for team vision.
- R **Night Migration:** a wide moving wave that shields allies and briefly roots enemies only at its leading edge.

### 4. Kesh, Mirebound — Fighter/Jungler

- Passive **Predator's Patience:** damaging a new monster or hero marks it; attacking the same mark heals slightly after a cooldown.
- Q **Reed Cleaver:** two-swing cone; second swing deals missing-health damage.
- W **Bogskin:** temporary damage reduction followed by an area slow proportional to damage absorbed, capped.
- E **Sinkstep:** burrow a short distance through brush/soft terrain, emerging with attack speed.
- R **Fen Claim:** create a marsh zone; Kesh moves faster while enemies leave visible wakes and are slowed.

### 5. Ilyra Quill, Archive Exile — Mage/Artillery

- Passive **Margin Notes:** ability hits add unique annotations; at three different annotations, the target takes a small Arcane burst.
- Q **Linebreak:** narrow piercing projectile, reduced damage after first hero.
- W **Footnote:** place a delayed sigil that repeats 40% of the next basic spell cast through it at a new angle.
- E **Redaction:** rectangle that briefly silences and erases enemy-created non-ultimate zones/projectiles below a power threshold.
- R **Final Draft:** target area receives three expanding manuscript rings; each ring damages, final ring stuns enemies hit by two prior rings.

### 6. Vey, Glassknife — Assassin/Roamer

- Passive **Refraction:** after entering brush or fog, Vey's next attack from a new angle gains penetration; target sees a warning glint at close range.
- Q **Shardstep:** dash through a target; cannot repeat the same target for several seconds.
- W **Mirror Decoy:** sends a non-damaging decoy along a chosen path; recast swaps only if within limited range.
- E **Cut the Light:** cone strike that disables wards for 5 seconds and damages heroes.
- R **Prism Sentence:** mark a hero, then after 1.2 seconds strike from current direction; target can break line of sight to reduce damage and cancel blink component.

Keep burst, mobility, crowd control, sustain, range, and safety within explicit power budgets. Every ultimate has a clear enemy response.

## Minions, Structures, and Objectives

### Lane waves

- Waves spawn every 30 seconds, alternating toward both lanes. Each wave: three Guard minions, three Bolt minions; every third wave adds a Siege minion.
- Minions follow lane splines, acquire targets by aggro priority, and reset after chase limits. Attacking an enemy hero near their minions draws minion aggro for a defined duration.
- Last hit grants gold; nearby allied heroes within XP range share experience with a small group penalty. Ambient passive gold prevents total starvation.

### Structures

- Each lane: outer Tower, inner Tower, Seal Guard Tower, then one Seal. Base has two Core Towers and Crown Engine.
- Towers prioritize aggressing heroes only after they damage a protected allied hero inside tower range; otherwise minions, summoned units, then heroes. Target changes and damage ramp are visible.
- Structures have backdoor mitigation when no allied minion is nearby. Seals are invulnerable until their Guard Tower falls.
- Destroyed Seals respawn after 4 minutes once; while down, that lane spawns one Vanguard minion per wave. Crown Engine becomes targetable after any Seal is down and both Core Towers fall.

### Jungle and vision

- Four small camps and two buff camps per side; camps have leash zones, reset behavior, and role-readable attacks.
- Brush hides units from outside unless warded or revealed. Enter/exit visibility has a 100 ms grace to reduce flicker.
- Each player gets a free ward trinket: two charges, 90-second ward duration, visible to true sight, team ward cap.
- Vision is server-filtered by team; hidden transforms are not transmitted.

### Neutral objectives

- **Twin Catalysts:** north/south river creatures spawn at 3:30, respawn 4 minutes. Killing grants team gold and one of two predictable 4-minute buffs: movement out of combat or structure damage.
- **Aether Colossus:** central pit spawns at 9:00, respawns 6 minutes. Killer team gains 150 seconds of nearby-minion empowerment and recall speed. Last-hit ownership is server-resolved, but objective HP and damage are public.

## World and Map

Build **The Broken Diadem**, roughly 150×115 m:

- Upper and lower lanes curve around a central mistwood rather than mirroring exact geometry.
- Each side has two jungle quadrants, two buff camps, safe fountain/shop, and multiple base exits.
- Central river/skybridge links lanes; Colossus pit sits at the center with two entrances and one vision ledge.
- Catalysts sit in opposite river pockets, creating split-map decisions.
- Route targets: lane-to-lane rotation 12–16 seconds through safe route, 8–11 seconds through risky center; fountain-to-outer-tower 18–22 seconds.
- Walls, brush, ramps, and decorative cliffs must match navigation/vision. Use debug overlays for walkability, projectile blockers, brush membership, tower range, and fog polygons.
- Symmetry uses equivalent travel/value metrics, not copied geometry. Automated fairness checks compare resource access, route times, objective approaches, tower safety, and ward coverage.

## Game Modes

- **Tutorial:** movement, basic attack, ability cast, last hit, shop/recall, ward, tower rules, objective, victory.
- **Unranked 3v3:** full map and bots/backfill at match start; no mid-match human backfill after 4 minutes.
- **Custom/Practice:** player plus bots, selectable hero, pause/time scale, gold/level controls, damage and range visualization.
- Future: ranked 3v3, 5v5 larger map, single-lane quick mode. Do not implement them in the MVP.

## AI

Bots are server-side and share player rules/information.

- High-level roles: lane assignment, jungle route, support pairing, roam. Team blackboard tracks visible enemies, last-known positions, wave states, tower pressure, objectives, power spikes, and retreat votes.
- States: Lane, LastHit, Harass, AvoidThreat, RecallBuy, Ward, JungleCamp, Gank, Defend, Push, RotateObjective, TeamFight, ChaseLimited, Retreat.
- Ability use is kit-authored through utility scoring: hit probability, target value, ally synergy, escape reserve, resource, cooldown, and danger.
- Bots manage item purchases from build graphs with conditional branches, not hardcoded single lists.
- Difficulty changes reaction, aim prediction, last-hit tolerance, map planning, ward use, and coordination. It never changes stats or grants hidden vision.
- Disconnected players receive a conservative bot after 20 seconds: retreat, farm safe wave, follow majority objective. Reconnected player resumes only after snapshot ready.

## Physics

- Gameplay is 2.5D with circle/capsule actors, height layers, polygon walls, line-segment projectile blockers, and zone shapes.
- Projectiles use swept collision at fixed tick. Fast missiles may substep; visuals interpolate.
- Knockback and pulls validate destination, slide along walls, and prevent invalid wall embedding.
- Created terrain like Rampart Fold updates a small dynamic blocker list and expires deterministically; path queries replan locally.
- Corpses and cosmetic debris never block. Ragdolls are not needed; use authored death animations/dissolves.

## Items and Shop

Implement 32 items: six starters, 10 components, 12 completed items, two boots upgrades, and two consumables. Items form shallow recipes and all completed items serve at least two heroes/builds.

Categories: attack, ability, defense, movement, support. Examples of original effects:

- **Sunspoke Bow:** attack speed; every third attack fires a reduced-damage bolt at a nearby marked target.
- **Kilnheart Plate:** health/armor; taking repeated physical hits grants capped temporary armor.
- **Quiet Index:** ability power/haste; hitting from beyond a range refunds a small cooldown once per cast.
- **Riverglass Boots:** speed; brief out-of-combat river acceleration.
- **Beacon Loom:** support stats; shielding an ally briefly reveals a small area around them.
- **Null Bell:** active short self/ally cleanse with long cooldown, cannot remove airborne/suppression.

Inventory has six item slots plus ward/trinket slot. Buying requires shop/fountain presence. Undo is allowed if the player has not left fountain, used the item, dealt/taken damage, or changed gold afterward. Selling returns 65%. Recommended builds update by role and enemy damage profile but are explainable, not automated purchases.

## Progression

- **In-match:** levels 1–12, skill ranks, gold, items, towers, objectives, vision, bounties.
- R rank available at levels 6 and 11. Q/W/E each rank up to four; player cannot max everything.
- **Persistent:** hero mastery XP, profile level, match history, cosmetics/banners only. All heroes and gameplay items are available from the start in MVP.
- Future rating is result/team-performance based but must not use opaque per-match stat chasing that distorts team play.

## UI and UX

- Main menu: Play, Tutorial, Heroes, Items, Match History, Settings, Credits.
- Draft: hero model, role tags, difficulty, kit video/diagram, ally picks, countdown, Talents.
- HUD: minimap bottom-right; hero portrait/health/resource/stats bottom-left; abilities/items bottom-center; gold/level/XP; team kills, structure/objective status and clock top; kill/objective feed side.
- Health bars distinguish heroes/minions/monsters/structures and show shields, level, key crowd control.
- Targeting indicators show range, collision, area, valid terrain, and cast mode. Server rejection gives a precise reason without noisy text.
- Shop supports search, filters, item tree, owned components, buy/undo/sell, recommended logic, exact advanced tooltip.
- Scoreboard: hero, K/D/A, last hits, items, level, objective participation, ward score, latency, mute/report.
- Pings: danger, on my way, assist, missing, defend, objective. Rate-limit and allow mute; use world+map indicators and optional voice line.
- Death recap: damage sources over final 8 seconds, crowd control chain, killer/assists, respawn timer; avoid revealing hidden builds beyond items already public.
- Tutorial and bot suggestions can be disabled. Loading, reconnect, surrender later, AFK, server pause, version mismatch, context loss, and local settings corruption need explicit states.

## Visual Direction

Use bright mythic-industrial fantasy: broken ivory causeways, brass mechanisms, deep blue void, green mistwood, coral sky growths, and magenta Aether. Heroes use exaggerated but original silhouettes with readable weapons and locomotion. Team affiliation appears through ground rings, health bars, small emissive accents, and minimap—not full recoloring.

VFX prioritize shape language: damage is sharp/warm, shields are layered cyan, healing uses upward gold motes, enemy danger zones use saturated edge plus patterned fill, allied beneficial zones use cooler edges. Every major ability is recognizable at default zoom from silhouette, timing, color, and audio. Effects-low preserves all gameplay boundaries, projectiles, and windups while reducing particles and distortion.

Map lighting is baked with one soft directional light and limited dynamic hero lights. Shadows are contact/blob on low and filtered cascades on high. No weather may conceal wards, projectiles, or ground areas.

## Models and Assets

Required: six hero rigs and skins/base colors, minion classes for two teams, six jungle creature families, two Catalysts, Colossus boss, towers/Seals/Core, complete map kit, brush/vision markers, wards, 32 item icons, ability icons, portraits, 80+ VFX, UI, announcer, and audio.

Each hero needs idle, run, turn/lean, basic windup/release/recovery, Q/W/E/R, hit, crowd-control reactions, death, recall, emote. Simulation timing is data; animation events drive presentation only. Use LOD0–2, simplified shadow/collision, 1K/2K atlases, and CI checks for scale, bounds, skeleton, materials, clip names, compression.

## Audio

- Original adaptive match music: calm lane, contest, team fight, objective, base siege, victory/defeat. Avoid constant intensity.
- Each hero has concise move/attack/ability/low-health/death lines and ability SFX; use shuffle bags/cooldowns.
- Minions, towers, objectives, wards, pings, recall, shop, level-up, kill streak, structure loss, and spawn timers require distinct cues.
- High-threat enemy ultimates have priority telegraphs that remain audible under effects.
- Spatialize world events, approximate occlusion, and virtualize distant combat. Announcer covers objective/structure events without narrating every kill.
- Captions and visual equivalents for critical events are mandatory.

## Multiplayer Architecture

- Server owns movement resolution, visibility, attacks, abilities, effects, health/resource, gold/XP, items, AI, objectives, structures, match result, and RNG.
- Client sends sequenced commands: move target, attack target, cast slot + target payload, stop/hold, item, buy/sell/undo, ping. Never send final transform/damage/gold.
- Local hero movement intent may be predicted along a validated nav path; server periodically reconciles. Abilities show immediate pre-cast feedback but damage/effect waits for authoritative event.
- Remote entities interpolate from 10–20 Hz deltas. High-importance projectiles/events use explicit spawn trajectories.
- Team fog filtering occurs before serialization. Opponents receive only visible entities and legal reveal/last-known events. Reconnect snapshot is team-filtered.
- Interest management considers camera/hero radius, global structure/objective summaries, minion lane aggregation outside interest, and sound/event relevance.
- Matchmaker handles region, party size, skill later, and ready checks. Servers issue signed idempotent result records.
- Reconnect window 120 seconds; conservative bot takes over after 20 seconds. AFK detection uses inputs/location/context, with warnings and safe penalties.
- Anti-cheat: authoritative rules, command rate/target validation, fog filtering, impossible cast/movement detection, replay logs, anomaly analytics, signed ruleset/build manifest, report pipeline.

## Performance and Network Budget

- ≤8 ms CPU and ≤11 ms GPU typical at 1080p medium; no per-frame React rendering.
- Simulate ≤80 minions, 20 jungle/neutral actors, six heroes, 20 structures, 60 projectiles/zones.
- <260 draw calls typical/<400 peak; <2.2M triangles high/<1.1M medium/<600k low.
- GPU textures <550 MB high/<300 MB medium; heap <650 MB steady.
- GPU particles <22k high/<7k low; active gameplay zones ≤24; audio voices ≤48.
- Initial shell/draft <12 MB compressed; match-critical assets <120 MB; full MVP cached <300 MB. Stream nonselected hero high LOD and cosmetics after essentials.
- Network <35 KB/s downstream/<8 KB/s upstream average per player. Track fog-filter cost, delta size, command latency, correction, and reconnect snapshot.
- Server 30 Hz p95 tick <18 ms for full match with bots on target hardware; AI path queries budgeted and staggered.
- Use instancing for minions/props, LOD, culling, pooled VFX, texture/mesh compression, baked lighting, event aggregation, and lane-AI frequency scaling outside combat.

## Architecture

- `shared-content`: hero, ability, item, effect, objective, map schemas and versions.
- `server-simulation`: ECS, tick, stats, combat, abilities, movement, fog, economy, structures, victory.
- `server-ai`: hero bots, minions, monsters, team planner.
- `protocol`: commands, deltas, reliable events, visibility filters, errors.
- `client-runtime`: input, prediction, interpolation, entity/event read models.
- `client-renderer`: map, actors, animation, VFX, fog, quality tiers.
- `client-ui`: shell, draft, HUD, shop, scoreboard, results, settings.
- `services`: identity, matchmaking, profiles, match history, reports, rating later.
- `audio`: world/event mixer, announcer, music.
- `tools`: ability sandbox, seedless headless match, item optimizer, map/fog validator, replay/net/performance labs.

Abilities should be composable typed effect graphs or small code modules with strict interfaces—not arbitrary scripts running unchecked. Server unit tests cover each skill's cast validation, damage/effect, interruption, visibility, and edge cases.

## MVP

Ship the Broken Diadem map, six heroes, 32 items, two Talents per player selected from six universal options, full minion/tower/Seal/Core rules, jungle, wards/fog, Twin Catalysts, Aether Colossus, Unranked/Practice/Tutorial, server bots, authoritative rooms, reconnect, match history, settings, accessibility, and post-match analysis.

Defer ranked queue, 5v5 map, 50+ heroes, rune systems, skins store, clans, voice chat, spectator broadcast, tournaments, surrender until AFK/reconnect rules are stable, and complex user-generated content.

## Expansion Roadmap

1. Balance telemetry, draft improvements, public replay viewer, moderation, surrender/remake, party support.
2. Add six more heroes and 20 items only after counter/readability coverage review.
3. Ranked 3v3 with placements, role preference, leaderboards, seasonal cosmetics.
4. Full 5v5 three-lane map with additional epic objective and champion select phases.
5. Spectator/broadcast, tournaments, practice scenarios, controller experiments.

## Testing and Acceptance Criteria

- [ ] A new user can launch, complete Tutorial, understand move/attack/cast/last-hit/shop/recall/ward/tower/objective/base victory, and start Practice.
- [ ] Six clients can draft unique allied heroes, load, buy, level, allocate skills, kill minions/monsters/heroes, destroy structures, and reach one authoritative victory.
- [ ] All six heroes have complete passive/Q/W/E/R behavior, legal targeting, tooltips from data, VFX/SFX/animations, bot use, and at least two viable build paths.
- [ ] Fog/brush/wards hide and reveal correctly without transmitting live hidden transforms to opponents.
- [ ] Minion aggro, tower targeting/ramp, last hits, shared XP, passive gold, bounties, death/respawn, recall, shop, and item undo pass deterministic fixtures.
- [ ] Twin Catalysts and Aether Colossus spawn, leash, reset, award correct team buffs, and create visible timers/status.
- [ ] A Seal cannot be attacked early; its destruction spawns Vanguards; Core Towers and Crown Engine follow vulnerability rules; victory fires once.
- [ ] Bots lane, last-hit, trade, ward, gank, jungle, buy, recall, contest, team fight, retreat, defend, push, and finish without hidden information/stat cheats.
- [ ] At 120 ms RTT/20 ms jitter/1% loss, commands remain ordered, casts do not duplicate, gold/items stay authoritative, and movement corrections are bounded.
- [ ] Reconnect restores the correct team-filtered state and relinquishes bot control safely.
- [ ] Target client sustains 60 FPS median/≥50 FPS 1% low in a late-game benchmark; server meets tick budget with six bots.
- [ ] UI works at 100/125/150% scaling, supports quick-cast variants/remapping, and preserves mandatory telegraphs on low effects and colorblind modes.
- [ ] No proprietary hero designs, skills, item art/names, map geometry, terminology, sound/music, UI, or assets are present.

## Required Delivery Artifacts

Provide source and deployable client/server builds, setup/deployment guide, protocol and content schemas, hero/ability/item balance data, map source/fairness report, fog test suite, bot behavior documentation, authoritative replay inspector, latency/load tests, performance benchmark, browser compatibility matrix, asset licenses, accessibility/readability checklist, and a full match recording from draft through Crown Engine destruction.
