# Implementation Prompt: Skybreak — Browser No-Build Battle Royale

You are a senior battle-royale engineer, multiplayer/network architect, third-person combat designer, open-world level designer, technical artist, and browser performance specialist. Build **Skybreak**, an original no-build browser Battle Royale inspired by the accessible drop-loot-rotate-survive loop, readable rarity system, expressive traversal, and colorful spectacle of modern third-person Battle Royale games. It must launch from a URL and deliver a complete last-player-or-team-standing match—not a visual island demo.

Building mechanics are explicitly excluded. Do not copy any existing game's island, characters, battle vehicle, glider designs, weapons, item names, rarity iconography beyond generic industry conventions, animations, UI layout, sounds, music, visual effects, branded cosmetics, or exact storm timings. Use original worldbuilding, silhouettes, locations, traversal devices, and balance.

## Status and Product Contract

- Platform: desktop Chrome, Edge, and Firefox; Safari best effort. Keyboard/mouse; controller can follow later.
- MVP: 24 players in Solo on one 1.2 km × 1.2 km island. Server bots fill empty seats so every match starts promptly. Architecture must scale toward 60 players after profiling.
- Match duration: 14–18 minutes, including 35-second staging and aerial insertion.
- Target: 60 FPS at 1080p medium on a reasonably modern gaming PC, with dynamic resolution and lower presets.
- Server: authoritative 30 Hz player/combat simulation, interest-managed 10–20 Hz state deltas, client prediction/reconciliation, lag-compensated hitscan within a clamp.
- Complete loop: launch, queue, stage, insertion route, choose drop, glide, loot, fight, heal/shield, manage inventory/ammo/rarity, rotate through contraction zones, become last survivor, see results, requeue.

## Game Vision

Skybreak takes place on an island lifted into a permanent atmospheric fracture. Players deploy from a high-altitude transit skiff, descend using original wing-sails, scavenge weapons and supplies from settlements and resonance caches, and remain inside a shrinking **Calmfield** while the surrounding **Riftstorm** grows lethal. With no building, survival depends on terrain reading, cover-to-cover movement, elevation, concealment, inventory decisions, and route timing.

The visual tone is adventurous rather than militaristic: bold silhouettes, bright weather, ancient wind machinery, modern salvage camps, and crystalline storm effects. Early game delivers risky landing competition, midgame combines rotations and opportunistic fights, and late game compresses players into legible tactical terrain with enough natural cover for counterplay.

## Inspiration Analysis

Preserve these principles:

- Every match starts equal; drop timing and destination trade immediate loot against early contest risk.
- Weapons are easy to categorize, while rarity creates fast value judgments without making low-tier weapons useless.
- A small slot inventory forces meaningful weapon/heal/utility choices.
- Health plus a separately replenished shield-like resource supports recovery and loot decisions.
- A shrinking safe area prevents indefinite hiding and creates route conflict.
- No-respawn Solo stakes make scouting, disengagement, audio, and positioning essential.
- Third-person movement should include sprint, crouch, slide, jump, mantle, zipline/ascender, and swimming or shallow-water traversal to replace building's mobility options.
- Named locations support route learning; smaller landmarks make unpopular drops viable.
- Spectacle must never overwhelm combat readability or quality-preset parity.

## Core Gameplay Loop

1. Open URL and load the menu shell. Select Quick Drop or Practice Range.
2. Matchmaker assigns a regional room and guest/account identity; download verified match-critical bundles while showing progress.
3. Enter a 35-second staging pier with non-damaging movement and equipment practice. Server waits for required clients up to a cap, then fills with bots.
4. A transit skiff crosses one of several seeded paths. Player opens full map, places a marker, chooses jump time, freefalls, then deploys wing-sail automatically at minimum altitude or manually earlier.
5. Land, search floor loot, resonance chests, and supply lockers; acquire weapons, ammunition, shield tonics, med injectors, and utility.
6. Fight or disengage, swap inventory slots, compare rarity, heal/shield, traverse terrain, and monitor Calmfield timer/map.
7. Rotate before or during each contraction. The Riftstorm deals escalating damage outside the safe area.
8. Mid/late game adds falling supply capsules and a single moving high-value caravan drone that broadcasts its approximate location.
9. Final field shrinks through small moving circles with natural cover. Last living player wins.
10. Results show placement, eliminations/assists, damage, accuracy, survival time, distance, loot history, storm damage, and match timeline. Persist cosmetics/mastery only, then requeue.

## Browser Technology

- **Rendering:** Babylon.js, WebGL 2 compatibility baseline with optional WebGPU. Use terrain chunks, hierarchical LOD, baked lighting/probes, one sun, cascaded/contact shadows, GPU vegetation/particles, occlusion/frustum culling, dynamic resolution.
- **Client:** strict TypeScript. Prediction, interpolation, streaming, and render systems separate from React. React handles menus, queue, map/inventory screens, settings, results; HUD consumes batched read models.
- **Physics:** Rapier WASM for local prediction/practice queries; server uses shared simplified collision primitives, character controller, projectiles, vehicles later, and loot triggers.
- **Networking:** secure WebSockets via authoritative Node.js/TypeScript game rooms such as Colyseus. Spatial interest grid, delta compression, reliable inventory/storm/death events, snapshots and reconnect spectating.
- **World streaming:** offline-authored terrain/navigation/collision cells in addressable bundles. Server always has lightweight world collision; client streams visual cells by position/drop path and prefetch direction.
- **AI:** server bots with hierarchical navigation, drop/loot/rotate/combat planners, perception limited by sight/audio/storm knowledge.
- **Audio:** Web Audio API with prioritized spatial gunshots/footsteps, approximate occlusion, environment zones, and distance tails.
- **Assets:** glTF/GLB with meshopt/Draco, KTX2/Basis, WebP/AVIF, OGG/Opus, immutable hashed content manifests.
- **Services:** matchmaking/presence, profiles/cosmetics, match records, reports, telemetry; PostgreSQL, Redis, object storage for internal replays.
- **Tools:** island cell editor/exporter, loot heatmap simulator, storm seed viewer, drop-path simulator, bot soak tests, replay inspector, network lab, performance benchmark.

## Camera

- Third-person over-right-shoulder camera, default horizontal FOV 90° at 16:9, adjustable 80–105°.
- Hip camera boom 3.1 m, shoulder offset 0.55 m, height 0.35 m. ADS tightens to 1.8–2.4 m by weapon and adjusts FOV.
- Shoulder swap on X, disabled during certain cover collisions only if necessary.
- Camera collision uses sphere cast, damped return, and transparent foliage; aim uses camera ray to target point then muzzle-to-target obstruction check, preventing corner shooting.
- Freefall and glide cameras widen FOV slightly and look ahead along velocity. Landing blends to ground camera without sudden yaw.
- Spectator follows surviving player with delayed legal state; free-camera available only after match end/internal replay.
- Recoil, damage, sprint, slide, and explosion camera layers are accessibility-adjustable and do not move the authoritative aim ray unpredictably.

## Controls

- WASD move; mouse aim; left fire; right ADS.
- Shift sprint; Ctrl crouch/slide while sprinting; Space jump/mantle; X shoulder swap.
- E interact/open/pick focused item; hold E for revive later (not in Solo). R reload; F quick melee.
- 1–5 inventory slots; mouse wheel cycles; G throws equipped throwable if selected normally rather than a hidden extra slot.
- Tab inventory; M full map; middle mouse ping/marker; Alt free-look during glide/run where allowed.
- Z deploy/stow wing-sail only in valid airborne volumes; Space can use zipline/ascender prompt.
- Escape menu; V optional inspect; H holster weapon for small sprint benefit if included.
- Full remapping, hold/toggle ADS/crouch/sprint, independent scoped sensitivity, colorblind/reduced-motion settings.

## Player Movement

- Walk 4.8 m/s, tactical run 5.8, sprint 7.3, crouch 2.8. Sprint uses a 5-second energy bar that regenerates after 1.25 seconds.
- Slide begins above 5.5 m/s, lasts up to 1 second, preserves downhill momentum, and has a 1.2-second repeat gate.
- Jump apex ~0.9 m. Mantle ledges 0.6–1.5 m with server-validated clearance and fixed duration based on height.
- Swimming applies at water depth >1.1 m: surface speed 4.2 m/s, sprint swim 5.2, no firing except sidearm from shallow water.
- Fall damage begins above a tuned vertical speed; wing-sail and marked air vents prevent it.
- Ziplines move at fixed speed, allow directional dismount, and expose the rider. Ascenders move vertically with safe exit checks.
- Freefall has forward/vertical control and terminal speed. Wing-sail trades descent rate for horizontal movement, has no fuel, cannot redeploy except from authored vents/high jumps.
- Local client predicts movement; server validates stamina, mantle, slide, glide state, collision, and maximum displacement.

## Combat

- 100 Health plus 50 rechargeable **Aegis** and up to 50 consumable **Reserve Shield**. Aegis recharges after 8 seconds without damage at 10/s; damage depletes Aegis, Reserve, then Health. This supports no-build cover transitions without making healing irrelevant.
- Hitscan for rifles/SMGs/shotguns/pistol; projectiles for marksman rail, grenades, and launch utility. Server owns fire cadence, ammo, spread/recoil seed, hit, damage, shield, death.
- Damage zones: head, torso, limbs. Head multiplier 1.5–2.0 by weapon; helmets are not separate loot in MVP.
- Weapons use deterministic recoil pattern plus seeded bloom. ADS, crouch, movement, sustained fire, rarity, and attachments influence accuracy within clear bounds.
- Shotgun pellets use one server-seeded pattern per shot with a minimum/maximum aggregate damage cap to reduce extreme RNG.
- Damage falloff and projectile travel are visible in advanced stats. Long-range elimination requires exposure/travel skill, not hitscan across the whole island with no warning.
- Healing locks or slows movement depending on item, can be canceled, and is server-timed. Taking damage cancels only items marked interruptible.
- No respawn in Solo. On death, inventory bursts into a consolidated loot cache plus a few visible priority items to avoid dozens of physics objects.
- Kill attribution uses damage contribution over 12 seconds; environmental eliminations credit recent attacker when appropriate.

## Original Weapons and Rarity

Rarity tiers use both color and shape/name prefix: Field (gray circle), Tuned (green chevron), Advanced (blue diamond), Masterwork (violet crown), Prototype (gold star). Higher rarity modestly improves two or three stats and attachment completeness; it never doubles damage.

### Weapons

- **Wayfarer Rifle:** balanced medium-range automatic, 30-round light ammo.
- **Tempest Carbine:** high rate, close-medium recoil challenge, 28-round light ammo.
- **Breakwater Scattergun:** pump shotgun, five shells, high close burst.
- **Coil Shotgun:** semi-auto lower-damage shotgun, six shells.
- **Needler SMG:** 36-round close weapon, fast swap, sharp falloff.
- **Sundial DMR:** semi-auto precision rifle, 12 heavy rounds, strong head pressure.
- **Longwake Rail:** projectile marksman rifle with charge tone and scope glint, 5 heavy rounds.
- **Harbor Pistol:** common reliable sidearm, 15 light rounds.
- **Gale Launcher:** utility launcher firing concussive wind orbs; low damage, strong displacement, rare ammo.

### Rarity tuning

- Field is fully usable baseline.
- Tuned improves reload or handling plus ~3% effective DPS.
- Advanced improves recoil/accuracy plus another small DPS increase.
- Masterwork adds a fixed appropriate attachment behavior, not random magical effects.
- Prototype has one strong identity modifier with a drawback and appears only in supply capsules/caravan, capped per match.

Stats and rarity curves must be data-driven. Pickups show weapon, rarity, ammo type, key stat arrows, current-slot comparison, and hold-to-swap behavior.

## Items, Loot, and Inventory

- Five universal inventory slots for weapons, heals, shield, or utilities. Ammo and one resource key stack outside the five slots; no crafting/build materials.
- At most three weapon slots can be occupied; UI warns but does not forbid more if balance testing prefers pure flexibility. Recommended rule: weapons, heals, and utility all compete equally.
- Ammo types: Light, Shell, Heavy, Charge. Caps prevent hoarding: 240/48/80/18.
- **Med Injectors:** stack 4, restore 35 Health over 3 seconds, movement slowed.
- **Trauma Kit:** stack 2, restore to 100 Health over 7 seconds, canceled by damage.
- **Shield Flask:** stack 4, restore 25 Reserve Shield over 2.5 seconds, max 50.
- **Aegis Cell:** stack 2, instantly begins Aegis recharge after a 3-second use but restores no Reserve.
- **Mist Capsule:** stack 2, creates temporary visual cover with same boundary on all quality presets.
- **Grapple Spool:** three charges in one slot, pulls player to valid terrain with exposed travel and range cap.
- **Echo Beacon:** reveals recent movement trails in a radius for 8 seconds; gives direction/age, not live wall silhouettes.
- **Wind Orb:** throwable concussive utility that displaces players with low damage.

### Loot sources

- Floor loot at validated sockets, biased to guarantee a weapon in every meaningful building cluster.
- Resonance chests: audible at short range; two item rolls plus ammo/heal.
- Supply lockers: predictable ammo/heal utility.
- Defeated players: consolidated cache preserves exact items/ammo.
- Supply capsules after zone 2: high rarity, visible descent, broadcasts map pulse.
- Caravan drone: mobile contested cache, cannot enter final zone, loudly shielded.

Server seeds and owns all loot. Loot tables use location tier, category weights, duplicate suppression per chest, match-wide Prototype caps, and minimum distribution guarantees.

## World and Map

Build one 1.2 km square island, **The Highwake**, surrounded by void-sea:

- **Aerie Market:** dense rooftop town, plentiful loot, ziplines, early close fights.
- **Sunken Array:** partially flooded dishes and service tunnels, mixed ranges.
- **Kilnworks:** industrial foundry with catwalks, lava-like heat channels as damage hazards, high-tier central vault.
- **Orchard Steps:** terraced farms with stone walls, lower loot density, safer rotations.
- **Wind Abbey:** hilltop ruin, long sightlines, air vent redeploy, risky exposure.
- **Breaker Docks:** warehouses and cranes, shoreline movement, balanced loot.
- Eight smaller landmarks: watch huts, bridge station, quarry, campsite, turbine, cave, relay shack, wreck.

Terrain uses ridges, gullies, boulders, trees, walls, buildings, and dips so final circles always retain cover. Generate final centers from authored valid-zone polygons that reject open water, severe cliffs, inaccessible roofs, and cover-poor areas. Building interiors are compact and stream as part of their cell.

Loot fairness tools measure weapons per expected player, chest density, time-to-first-weapon, route value, sightline length, and escape options. Named locations need at least two ground exits and one alternate traversal route.

## Calmfield / Riftstorm

Use deterministic server seeds revealed progressively:

- Phase 0: whole island; 90 seconds until first move.
- Phase 1: radius 430→320 m over 120 s; 1 storm damage/s.
- Phase 2: wait 70 s, 320→210 m over 90 s; 2 damage/s.
- Phase 3: wait 55 s, 210→125 m over 75 s; 4 damage/s.
- Phase 4: wait 40 s, 125→70 m over 60 s; 7 damage/s.
- Phase 5: wait 30 s, 70→35 m over 45 s; 10 damage/s.
- Endgame: moving 30 m field, 45-second legs, then final collapse.

Show current/next field, timers, distance, route line, and storm damage intensity. New circle must remain substantially within previous circle until moving endgame. Server applies damage; client renders boundary from server parameters.

## Game Modes

- **Solo Quick Drop (MVP):** 24 players/bots, last alive wins.
- **Practice Range:** offline/private small zone with all weapons, movement course, target bots, damage/recoil data, graphics benchmark.
- Future: Duos/Squads with downed/revive and reboot rules, ranked Solo, limited modes. Do not implement squad UI/logic partially in MVP.

## AI Bots

Server bots must participate convincingly without perfect aim or knowledge.

- Strategic phases: ChooseDrop, Freefall/Glide, InitialLoot, AssessLoadout, Rotate, SeekAdvantage, AvoidThreat, Engage, DisengageHeal, LootKill, FinalField.
- Bots select drops by skiff path, desired risk, estimated population from visible players, and loot density.
- Perception uses sight, line of sight, gunshot/footstep events, chest and door state, damage direction, legal map pings. No hidden player transforms.
- Loot planner scores current slot needs, rarity gain, ammo, heal/shield stock, storm time, and danger.
- Combat uses cover points, range preference, peek timing, recoil/accuracy error, limited utility, and retreat thresholds.
- Rotation planner compares storm arrival time with path length, terrain risk, and known fights. Bots can use ziplines, ascenders, vents, swimming, and grapple only with valid navigation links.
- Difficulty varies reaction, aim noise, loot efficiency, positioning, and risk—not health, damage, or vision.

## Physics and Environment

- Server-authoritative character controller, mantles, ziplines, ascenders, swimming, glide, jump pads/vents, projectiles, damage hazards.
- Static world collision is cell-based, simplified, hash-validated between client/server.
- Doors and basic chest lids are server stateful. Avoid widespread destructible buildings in MVP; small breakable crates are cosmetic or server-simple.
- Foliage collision is sparse and consistent. Grass never hides a standing player completely on one preset but not another.
- Loot settles to authored sockets or server traces and then becomes nonphysical to reduce bandwidth.
- Death ragdoll is client cosmetic; gameplay cache position is server-owned.

## Progression

- **In-match only:** loot quality, ammo, consumables, position, eliminations, surviving players, field phase. No levels or stat growth.
- **Persistent:** account/mastery XP, challenges, banners, glider/wing-sail visual skins, outfits constrained by silhouette, emotes, and match history. No paid or earned gameplay stat boosts.
- Starter profile has all weapons/items because they are world loot, and all movement capability.
- Daily/weekly challenge systems are deferred unless they can be implemented without manipulating matchmaking or encouraging griefing.

## UI and UX

- Main menu: Quick Drop, Practice, Locker later/Appearance, Career, Settings, Credits.
- Queue: region/ping, elapsed, cancel, party state placeholder hidden for MVP.
- Staging/drop: player count, skiff path, map marker, jump prompt, altitude, wing-sail state.
- HUD: health/Aegis/Reserve bottom-left; five-slot inventory and ammo bottom-right; minimap/field timer top-right; alive/eliminations top; compass and pings top-center; contextual pickup/interact.
- Full map: current/next field, skiff path, player marker/direction, placed marker, named locations, supply/caravan legal pings. No live enemies without a legal reveal.
- Inventory: drag or key-swap slots, split/drop ammo/stack, compare, rarity accessibility shapes, exact advanced stats.
- Combat: hit markers by shield/health/head, shield-break cue, damage direction, elimination/assist, concise kill feed.
- Spectator: killer after a delay, report/leave, placement, next/previous legal players; prevent stream of hidden opponents.
- Results: placement, winner, eliminations, assists, damage, survival, travel, storm, inventory/rarity history, timeline/map route.
- Settings: preset, render/dynamic resolution, textures, view distance, shadows, foliage, effects, anti-aliasing, FOV, sensitivity/scopes, keybinds, audio, captions, visual sound indicators with balanced precision, colorblind/reduced motion/photosensitivity.
- Error flows: failed bundle/cell, insufficient memory, Pointer Lock, lost context, socket drop, match already ended, reconnect to spectate, kicked/version mismatch.

## Visual Direction

Use optimistic atmospheric salvage fantasy: turquoise sky fractures, cream limestone, copper turbines, saturated fabric canopies, deep green orchards, and violet storm energy. Characters are adventurous scavengers with readable backpacks/armor and original silhouettes. Weapons combine wind instruments, ceramic housings, and practical mechanisms rather than copying modern or existing game guns.

The Riftstorm is beautiful but threatening: layered translucent wall, inward-moving crystal motes, distant lightning, and screen-edge distortion outside. It cannot hide nearby enemies or induce photosensitive strobing. Rarity pickups use subtle beams at close distance, outline shape, label, and audio—not screen-filling glow.

Use baked GI/probes, one sun, limited dynamic lights, cascaded shadows near player, contact shadows on low. Foliage uses GPU instancing and wind shaders. Interiors maintain exposure consistency. Effects-low preserves smoke boundary, muzzle origin, tracers, projectile threats, shield state, and storm.

## Models and Assets

Required: at least four player cosmetic bodies sharing validated hitbox families, nine weapon models plus pickups/viewmodels where needed, consumables/utilities, wing-sail, skiff, caravan drone, supply capsule, chest/locker, complete island modular kit, terrain/foliage, UI map/icons, VFX, and animation sets.

Player animations: locomotion by speed/stance, sprint, slide, jump/fall/land, mantle heights, swim, zipline, ascend, freefall, glide, weapon poses, fire/reload/equip, heal/shield uses, throw, hit/down/death. Server uses bounded pose/stance state for hitboxes, not client animation time.

Use LOD0–3, impostors for distant vegetation/buildings, collision proxies, shared trim sheets, 1K/2K KTX2 textures, mesh compression, and automated asset validation. Stream cells in concentric priority rings.

## Audio

- Original upbeat atmospheric score for menu/drop, then sparse adaptive tension during field closures and final players.
- Gunshots include close report/mechanics/distant tails by biome/interior, with server-semantic audible radius.
- Footsteps vary by surface, speed, stance; slide/mantle/swim/zipline/glide have distinct cues.
- Chests hum locally; supply capsules and caravan broadcast recognizable global/local sounds.
- Shield hit/break/recharge, health hit, headshot, healing, rarity pickup, inventory full, storm warning, and final-field cues are distinct.
- Approximate audio occlusion/reverb by cell/portal. Prioritize threats and virtualize distant ambience.
- Captions/visual sound indicators convey category and direction within a broad cone, not exact distance through walls.

## Multiplayer Architecture

- Server owns player state, collision result, stamina/movement mode, inventory, loot, ammo, firing, hits/damage, shields/heals, storm, alive state, bots, and winner.
- Client sends 30–60 Hz sequenced input frames (movement, look, buttons, selected slot) and reliable action requests. It predicts local movement/weapon presentation but reconciles to server.
- Spatial interest grid sends nearby players, loot, doors, projectiles, audio events, and cell state. Far gunshots may be event-only. Global sends alive count, storm, supply pings, and match clock.
- Other players interpolate with an adaptive 100–150 ms buffer; brief extrapolation is capped. Dormant/hidden actors are removed cleanly.
- Hitscan lag compensation rewinds player hitboxes to clamped shot time (max 180 ms) using clock sync. Projectiles remain server-simulated forward.
- Server validates rate of fire, ammo, view delta envelope, movement mode, inventory ownership, interaction range, heal duration, glide/zipline links, and message quotas.
- Match start has readiness gates and bot fill. Reconnect within 60 seconds restores a living player only if their server actor remained safely idle/AI-directed; otherwise spectates. Define and test exploit-resistant behavior.
- Internal replay stores initial seed, inputs, reliable events, periodic world keyframes, ruleset/map versions; use for reports and desync analysis.
- Anti-cheat: server truth, interest filtering, schema/rate validation, movement/fire anomalies, impossible visibility/hit analysis, signed content manifest, report pipeline. Do not rely on hiding JavaScript.

## Performance and Network Budget

- Client ≤8 ms CPU/≤11 ms GPU typical at 1080p medium; p95 streaming integration <3 ms/frame.
- Visible player actors ≤24, typical 4–10; loot renderers ≤160 nearby; world cells and foliage aggressively LOD/cull.
- Draw calls <350 typical/<550 peak; visible triangles <3M high/<1.5M medium/<800k low.
- GPU texture memory <700 MB high/<380 MB medium; JS/WASM heap <750 MB steady.
- GPU particles <30k high/<10k low; decals <120 nearby; audio ≤56 voices.
- Initial shell/menu <10 MB compressed; staging/drop essentials <80 MB; nearby landing cells ready before forced deployment; total cached MVP <450 MB. Use progressive download and clear required/optional indicators.
- Network target <45 KB/s downstream/<12 KB/s upstream average per human; bound snapshot spikes and world-cell state.
- Game server 30 Hz p95 tick <20 ms with 24 players/bots. AI perception/pathfinding staggered; static spatial indexes prebuilt.
- Use terrain chunking, HLOD/impostors, instancing, mesh/texture compression, baked lighting, pooled VFX/audio/loot, spatial interest, delta/supersession, lazy cosmetics.

## Architecture

- `shared-protocol`: inputs, snapshots, inventory actions, match events, versions.
- `shared-content`: weapons, rarity, items, loot tables, storm phases, movement constants.
- `server-match`: lifecycle, players, storm, loot, combat, winner, replay.
- `server-spatial`: interest grid, world collision cells, audio visibility, lag history.
- `server-bots`: drop, loot, rotation, perception, combat, final field.
- `client-runtime`: prediction, reconciliation, interpolation, streaming, entity views.
- `renderer-world`: terrain cells, HLOD, actors, weapons, animation, VFX, quality.
- `client-ui`: shell, queue, HUD, inventory, map, spectator, results, settings.
- `services`: identity, matchmaking, profile/cosmetics, matches, reports.
- `audio`: spatial events, zones, priority, music.
- `tools`: island exporter/validator, loot/storm simulator, replay/net lab, bot soak, benchmark.

The world source of truth must separate lightweight collision/gameplay metadata from heavy render assets. Content/rules changes are versioned and recorded per match.

## MVP

Ship the Highwake island, 24-player Solo with bots, staging/skiff/freefall/wing-sail, all traversal listed, nine weapons, five rarity tiers, four ammo types, eight consumable/utility items, floor/chest/locker/player/supply/caravan loot, full storm phases, authoritative combat, spectator/results, Practice Range, guest/profile progression, settings and accessibility.

Defer building, Duos/Squads, vehicles, crafting, NPC vendors/quests, respawn/reboot, ranked, user-generated islands, large cosmetic catalog/store, voice chat, and 60–100 players. The architecture may reserve fields; the UI must not show unusable features.

## Expansion Roadmap

1. Optimize/soak to 40 then 60 players; add two more named locations and route telemetry.
2. Duos/Squads with downed state, revive, team pings, split loot, fair spectating, and reconnect.
3. Two lightweight vehicle types with server physics and counters.
4. Ranked Solo/Squads, parties, seasons, public replay, moderation, tournaments.
5. Rotating island variants, weather that preserves visibility, additional weapons/utilities, and WebGPU enhancements.

## Testing and Acceptance Criteria

- [ ] A player can launch, enter Practice without an account, learn movement/firing/inventory/healing, then queue a Solo match.
- [ ] A 24-seat match stages, runs a skiff path, lets each actor jump/glide/land, progresses every field phase, and declares exactly one winner or a deterministic tie-break.
- [ ] The player can loot a chest, pick up/swap/drop five slots, collect/cap ammo, compare rarities, reload, heal Health, restore Reserve Shield, trigger Aegis recharge, and use utility.
- [ ] All nine weapons apply correct server fire cadence, ammo, recoil/spread seed, hit zones, falloff/projectile, rarity modifiers, shield/health damage, and death cache.
- [ ] Storm circles only choose valid authored centers, display current/next state, apply correct server damage, and do not create inaccessible final fields.
- [ ] Sprint, slide, crouch, jump, mantle, swim, zipline, ascender, freefall, glide, air vent, and grapple are server-validated and recover safely from interruption.
- [ ] Bots choose legal drops, obtain viable loadouts, rotate before lethal storm, fight using perceived information, heal, use cover/utility, and contest final field without aim/vision cheats.
- [ ] At 120 ms RTT/25 ms jitter/1% loss, inputs do not stick, inventory actions do not duplicate, shots/ammo remain authoritative, and corrections are bounded.
- [ ] Interest filtering never sends live distant enemy transforms outside legitimate relevance, including to spectator/reconnect payloads.
- [ ] Island streaming never exposes missing collision; if a render cell is late, the client gates movement/drop or renders a safe fallback.
- [ ] Target hardware sustains 60 FPS median/≥50 FPS 1% low in Aerie Market combat and final-field benchmarks; server meets p95 tick target with bots.
- [ ] Low quality preserves identical smoke/storm/cover-critical visibility; remapping, colorblind, reduced motion, captions, and visual sound modes work.
- [ ] No proprietary island, characters, weapons, gliders, UI, audio/music, effects, branded terms, or assets are present.

## Required Delivery Artifacts

Provide source and deployable client/server/services, local bot mode, island source and cell manifests, collision/hash pipeline, loot/storm tables and simulation reports, protocol schema, authoritative replay inspector, bot soak results, latency/load tests, streaming/performance benchmark, browser compatibility matrix, threat model, asset licenses, accessibility/visibility parity checklist, and a full-match recording from skiff to final elimination.
