# Implementation Prompt: Breachline — Browser Arcade Military FPS

You are a senior first-person-shooter engineer, multiplayer/network specialist, combat designer, level designer, technical artist, and browser performance engineer. Build **Breachline**, an original fast-respawn browser FPS inspired by the tempo, readable gunplay, custom loadouts, compact maps, score rewards, and match flow of late-2000s arcade military shooters. It must run from a URL in a modern desktop browser and provide a complete multiplayer match loop, not a shooting-range mockup.

Do not copy real-game faction names, characters, maps, weapons as branded products, announcer lines, UI layouts, emblems, sounds, music, exact streaks, perk names, balance values, or campaign situations. Use fictional near-future security factions, original weapon profiles and models, and abstract genre principles. Do not use real extremist branding or recreate real attacks.

## Status and Product Contract

- Platform: desktop Chrome, Edge, and Firefox; Safari best effort. No native client.
- Mode: authoritative 6v6 Team Clash, with server bots filling empty seats. Private/local bot match must work when no public backend is configured.
- Session: 8 minutes or first to 75 points; warmup under 20 seconds; post-match under 25 seconds unless players opt out.
- Combat target: responsive, low time-to-kill without unreadable one-frame deaths; reliable hit feedback and fair spawn logic.
- Target performance: 60 FPS at 1080p medium with 12 players, effects, and environment active.
- Server target: authoritative 60 Hz simulation for players/weapons, 20 Hz bandwidth-shaped snapshots, geographically regional rooms.
- Complete loop: launch, authenticate anonymously or enter bot mode, choose loadout, join match, spawn, fight, earn support actions, die/respawn, complete match, view progression, requeue.

## Game Vision

Breachline is a kinetic 6v6 FPS set at a fictional island communications facility during a corporate evacuation. Players move quickly, aim down sights, switch between a primary and sidearm, throw tactical/lethal equipment, and earn limited-use support actions by contributing to the team. Maps are small enough for frequent contact but contain power positions, flank routes, traversal choices, and safe spawn regions.

The desired emotional cadence is anticipation → contact → decisive gunfight → quick reset → adaptation. Death should be understandable, respawns quick, and progression rewarding without giving veterans unfair base damage or health. Support actions create spectacle but must have counterplay and strict uptime limits so infantry gunplay remains primary.

## Inspiration Analysis

Preserve these genre principles:

- Immediate first-person controls, quick aim-down-sights transitions, crisp weapon identity, and readable recoil are the foundation.
- Compact, interlocking routes create frequent fights and opportunities to learn timings.
- Create-a-loadout lets players express range, mobility, stealth, and objective preferences.
- Fast respawn reduces downtime, while a short kill recap teaches why the player died.
- Streak-like rewards produce escalating excitement, but this game awards **Momentum** for kills, assists, objective contribution, and destroying hostile support devices. Momentum resets on death.
- Persistent XP unlocks sidegrades, attachment options, and cosmetics—not higher health, universal damage multipliers, or paid power.
- Strong audio, hit markers, damage direction, score popups, medal text, and animation make outcomes legible.

## Core Gameplay Loop

1. Open URL; load a minimal shell, graphics settings, and essential first-person assets.
2. Choose Play Online or Practice. Online creates/uses a guest profile, selects region automatically, and enters matchmaking.
3. In lobby, inspect five loadouts, edit allowed attachments/perks/equipment, and see map/mode rules.
4. Spawn after a short countdown; move, sprint, mantle, crouch, aim, fire, reload, melee, and use equipment.
5. Eliminate enemies and assist teammates to score. Earn Momentum within one life and deploy support actions at thresholds.
6. On death, show a 2.5-second recap with attacker, weapon archetype, hit timeline, damage direction, and optional shortened killer view; respawn after 3 seconds at a scored safe spawn.
7. First team to 75 points or leading team at 8 minutes wins; ties enter a 60-second sudden-death target of +5 points.
8. Display scoreboard, accuracy by weapon, objective/assist contribution, best streak, network quality, XP, unlocks, and Play Again.
9. Persist profile/loadouts/settings and rotate the next map when added later.

## Browser Technology

- **Rendering:** Babylon.js, WebGL 2 baseline with optional WebGPU. Use forward/clustered lighting appropriate to a compact FPS map, baked global illumination/lightmaps, cascaded sun shadows, decals, GPU particles, and post-processing by quality tier.
- **Client:** strict TypeScript. Separate fixed simulation/prediction from rendering. React handles shell, menus, loadout editor, scoreboard, settings, and results; in-match HUD uses a batched lightweight state layer.
- **Physics:** Rapier WASM for client prediction queries and offline bots. Online server uses the same collision primitives and movement code in a headless deterministic/quantized simulation; server does not need to render.
- **Networking:** Colyseus or a similarly authoritative Node.js/TypeScript room layer over secure WebSockets. Use input commands, snapshots, client prediction, reconciliation, interpolation, lag-compensated hitscan history, and interest filtering.
- **Navigation:** baked navmesh plus cover/interest nodes for bots. Bot decision logic runs server-side.
- **Audio:** Web Audio API with HRTF/panning, occlusion approximation, reverb zones, bus compression, and voice limits.
- **Assets:** glTF/GLB, meshopt/Draco, KTX2/Basis, WebP/AVIF, OGG/Opus. Use immutable hashed bundles and progressive loading.
- **Services:** matchmaker, game-room processes, profile/loadout API, PostgreSQL for durable profiles, Redis for presence/queues/rate limits. Practice uses embedded equivalents and IndexedDB.
- **Tooling:** Vite, Vitest, Playwright, headless server simulation tests, net-emulation tests, replay capture, asset validation, performance benchmark.

## Camera

- First-person camera; 90° horizontal FOV at 16:9 default, adjustable 75–110° with vertical-FOV conversion handled correctly.
- Viewmodel FOV separately adjustable 55–75° and never changes gameplay ray origin.
- Mouse input uses Pointer Lock, raw movement where available, no acceleration added by the game, sensitivity 0.1–10 with per-optic multiplier.
- ADS interpolates to each optic FOV over weapon-specific 140–320 ms. Sensitivity can scale by monitor distance.
- Camera height: standing 1.68 m, crouched 1.15 m, smoothed without disconnecting server capsule.
- Sprint bob, landing impulse, recoil, damage shake, and explosions are additive layers with independent accessibility sliders. Never move the actual aim ray through decorative bob.
- Spectator/kill recap uses a sanitized server replay buffer, not the opponent's live client camera.

## Controls

- WASD move; mouse aim; left fire; right ADS.
- Shift sprint; Ctrl crouch toggle/hold option; Space jump/mantle; C optional crouch alias.
- R reload; E interact; F quick melee; G lethal equipment; Q tactical equipment.
- 1 primary, 2 sidearm, mouse wheel switch; 3 support action selector; 4 deploy selected support.
- V fire-mode toggle where supported; X ping; Tab scoreboard; M loadout on death; Escape menu.
- B inspects weapon only when safe; it has no gameplay effect and is cancellable instantly.
- Full remapping, hold/toggle choices for ADS/crouch/sprint, separate scoped sensitivity, colorblind and reduced-motion options.

## Player Movement

All values are starting tuning targets and must be data-driven:

- Standing speed 5.2 m/s; crouch 2.8 m/s; sprint 7.1 m/s; ADS multiplier 0.58–0.82 by weapon.
- Ground acceleration 32 m/s², deceleration 38 m/s², air control 20% of ground. Jump vertical velocity tuned for a 0.85 m apex.
- Sprint starts after 120 ms and lowers weapon; sprint-to-fire 180–330 ms by weapon class.
- Mantle valid ledges 0.6–1.35 m; server validates approach, top clearance, movement state, and duration. No slide in MVP.
- Crouching improves hip spread recovery and lowers audio radius but does not make movement silent.
- No prone, lean, wall-running, bunny-hop speed gain, or movement exploits in MVP.
- Server simulates a capsule, step height, slopes, gravity, moving doors, and spawn volumes. Client predicts using identical parameters and smooths reconciliation errors under 20 cm; larger errors snap with a debug metric.

## Combat

- Base health 100; no regenerating armor. Health begins regenerating 5 seconds after last damage at 22 HP/s, interrupted by new damage.
- Limb multipliers: head, upper torso, lower torso, limbs. Keep minimum plausible kill time above roughly 150 ms for full-auto body shots at intended range; exact values emerge from testing.
- Hitscan for ordinary firearms. Simulated projectile for launcher and thrown equipment. Server owns ammo, rate of fire, spread seed, recoil validation envelope, hit, damage, death, and score.
- Recoil combines deterministic weapon climb pattern, small seeded shot variance, view kick, and visual weapon movement. Client predicts feedback; server validates shot cadence and direction tolerance.
- Hip spread expands with movement/fire and recovers continuously. ADS accuracy and falloff vary by archetype. First-shot behavior is explicit in stats.
- Penetration applies through tagged thin materials using remaining penetration energy; never through thick structural walls.
- Reload has start, magazine-out, magazine-in, and chamber events. Tactical and empty reload timings differ. Interrupting after magazine-in retains new ammo.
- Melee is a short-range server-validated sweep, two-hit from full health, with clear lunge cap and no teleport.
- Friendly fire off in Team Clash. Spawn protection ends after 2 seconds, after firing, or after moving 5 m; protected players cannot earn damage.
- Damage feedback: directional indicator, desaturation/vignette at low health, flinch capped and decoupled from severe aim displacement, hit markers by normal/head/kill, armor-equipment impact variant, and concise score text.

## Weapons, Attachments, Perks, and Support Actions

Create entirely original models and fictional designations.

### Primary weapons

- **AR-4 Jackal:** balanced rifle, 720 RPM, controllable vertical pattern, medium falloff.
- **M7 Kestrel:** high-rate compact weapon, 900 RPM, fast handling, strong falloff and lateral recoil.
- **BR-12 Mesa:** semi-auto battle rifle, high per-shot damage, 360 RPM cap, heavier flinch/recoil.
- **SG-8 Breacher:** pump shotgun, eight pellets, tight close-range role, low penetration.
- **LMG-60 Anchor:** 60-round support weapon, slow ADS/reload, strong sustained accuracy when crouched.
- **MR-1 Warden:** bolt-action marksman rifle, lethal headshot and upper torso only inside a defined range, visible scope glint.

### Sidearms

- **P9 Relay:** quick semi-auto pistol.
- **H3 Rook:** slower heavy pistol with range.
- **Cinder Auto:** machine pistol with severe recoil and small magazine.

### Attachments

One optic, barrel, underbarrel, magazine, and stock slot; maximum three attachments in MVP. Every attachment has a visible tradeoff. Examples: reflex sight, 2× optic, suppressor, compensator, light barrel, angled grip, stable grip, extended magazine, quick magazine, light stock, fixed stock. Never present false precision; use plain-language bars plus exact advanced stats.

### Perks

Select one from each group:

- Mobility: Fleet Boots, Quick Mantle, Light Kit.
- Awareness: Trace Reader (longer footprints of sprinting enemies), Signal Filter (reduced scan duration), Munitions Eye.
- Sustain: Rapid Ready (faster weapon swap), Field Patch (regen begins 0.8 s sooner), Scavenger Rig (ammo only).

Perks must not directly increase bullet damage, maximum health, or headshot multiplier.

### Equipment

- Lethal: fragmentation charge with cook, adhesive charge with lower radius, directional breach mine with visible laser.
- Tactical: flash pulse with line-of-sight/angle calculation, obscurant canister using volumetric-style opaque field, signal dart revealing movement pulses in a small radius.

### Momentum support actions

Earn at 3, 5, and 8 Momentum; select one per tier before match. Momentum resets on death and support kills contribute score but not Momentum.

- Tier 3: Recon Sweep (three minimap pulses; countered by Signal Filter), Ammo Pod.
- Tier 5: Hunter Drone (30-second destructible marking drone, no autonomous lethal fire), Mortar Mark (two clearly telegraphed shells on outdoor target).
- Tier 8: Interdiction Flight (one directional strafing pass with loud warning and indoor counterplay), Team Uplink (20 seconds of faster equipment recharge and assist sharing).

Only one Tier-8 action per team may be active. All support actions have server-owned targeting, line/sky validation, cooldown, cancellation, and friendly-safe rules.

## World and Map

Build one original map, **Relay Station K-17**, approximately 115×95 m:

- West operations wing: close corridors, control room, breakable interior glass.
- Central dish courtyard: medium sightlines, waist-high cover, underground service tunnel, outdoor support-action exposure.
- East maintenance bay: vertical catwalk, vehicle props, flank door, strong but penetrable power position.
- North ridge: long but interrupted marksman lane with two cross routes.
- South utility route: low-visibility pipes, short range, slower traversal.
- Three primary lanes with at least four connectors. No dead end longer than 6 seconds unless it contains a tactical overlook and alternate drop.
- Spawn regions have two exits, sight blockers, and distance to first contact above 5 seconds.
- Traversal metrics: average center travel 10–13 seconds, flank 15–18 seconds, no cross-map unbroken sightline into spawn.
- Use original industrial/oceanic architecture, fictional signage, and neutral corporate color language.

## Game Modes

- **Team Clash (MVP):** 6v6; elimination 1 point; assist score does not increase team score; 75 points/8 minutes; fast respawn.
- **Practice:** same rules with configurable bots, score/time, latency simulation, and aim diagnostics.
- Future: Zone Control, Demolition, Free-for-All, 2v2, private rulesets. Do not implement before Team Clash is polished.

## AI Bots

Server-side bots fill open seats and can be disabled in private matches.

- Perception uses vision cones, occlusion, heard events, teammate pings, recent damage, and last-known positions; no wall vision.
- Strategic states: Spawn, Route, Seek Contact, Hold Angle, Push Threat, Flank, Regroup, Use Support, Retreat/Reload.
- Tactical states: aim acquisition with skill-dependent reaction delay, burst control, strafing, crouch usage, grenade safety, cover selection, weapon-range preference.
- Bots use heat maps to avoid repeated deaths and contribute to spawn danger scoring.
- Easy/Normal/Hard change reaction time, aim noise, burst length, prediction, route diversity, and teamwork—not health, damage, or awareness cheats.
- Bots must not fire before the target is perceptually acquired and must respect obscurant volumes.

## Physics

- Server-authoritative capsule movement and query-based weapon collision.
- Doors use deterministic open/closed states; avoid fully dynamic door physics in competitive paths.
- Equipment uses fixed-step projectile physics with continuous collision for fast objects.
- Ragdolls are client cosmetic, capped at six and replaced with static death poses quickly. They never block shots or players.
- Small props may react locally but are non-authoritative and reset on join. Critical cover remains static.
- Bullet impacts select material-specific decal/VFX/audio from server-confirmed surface tag; pool and cap decals.

## Items, Inventory, and Loadouts

There is no world loot. Before match, configure five loadouts containing primary, sidearm, up to three attachments, one perk from each group, one lethal, one tactical, and three support actions. During death screen, a player may switch loadout; change applies next spawn.

Persistent unlocks are sidegrades. Starter profile must have one competitive choice in every category. Challenges unlock alternatives/cosmetics, never raw universal power. Validate loadouts server-side against owned/unlocked IDs and ruleset version.

## Progression

- Match XP from participation, kills, assists, support destruction, wins, and a modest completion bonus.
- Account levels 1–30 unlock sidegrade weapons and attachments at a brisk pace; all gameplay unlocks are also available in private Practice.
- Weapon mastery unlocks reticles, finish variants, badges, and attachment sidegrades, with no stat boosts beyond the attachment's explicit tradeoff.
- Five onboarding challenges teach ADS, equipment, assists, support counterplay, and map routes.
- Persistent stats include matches, wins, accuracy, objective contribution later, and per-weapon usage; allow privacy reset/export.

## UI and UX

- Main menu: Quick Play, Practice, Loadouts, Profile, Settings, Credits.
- Matchmaking: selected region/ping estimate, elapsed time, cancel; no fake player counts.
- Lobby: teams, map, countdown, loadout access, network warnings.
- HUD: crosshair; ammo/magazines bottom-right; health bottom-left; equipment and support actions; minimap top-left; score/timer top-center; kill feed top-right; Momentum meter near center edge.
- Hit/kill/assist score feedback is brief and center-weighted without covering targets.
- Minimap shows teammates, pings, firing enemies only according to weapon/support rules, and map boundaries. It never leaks hidden server state.
- Scoreboard: score, kills, deaths, assists, ping, support actions destroyed; mute/report future-ready.
- Death recap: attacker, weapon icon, distance, received hit timeline, final damage direction, support source if relevant. Do not reveal hidden enemy teammates.
- Loadout editor shows exact tradeoffs and validates conflicts immediately.
- Settings: render scale/dynamic resolution, preset, shadows, effects, texture quality, anti-aliasing, FOV, viewmodel FOV, mouse, ADS multipliers, keybinds, audio, subtitles, hit-marker audio, colorblind/reduced-motion/photosensitivity controls.
- Errors: Pointer Lock refusal, WebSocket loss, version mismatch, server full, high ping, kicked/invalid loadout, graphics context loss, low memory. Offer recovery/reconnect where possible.

## Visual Direction

Use grounded but fictional near-future industrial design: storm-cleared blue sky, sea mist, sun-bleached composite walls, safety orange machinery, dark graphite weapons, and cyan communications equipment. Silhouettes distinguish both teams through helmet, vest, pack, and emissive IFF accents—not entire-body red/blue paint.

Weapons have mechanically plausible moving parts but no copied branded shape. Lighting prioritizes visibility: bright exteriors, lifted interior shadows, restrained bloom, calibrated exposure transitions, and no deep-black camping corners. Smoke/obscurant is gameplay-authoritative in shape and opaque enough to block sight consistently on all presets. Muzzle flashes are brief; tracer ratio is limited; impact particles never hide the target for longer than 100 ms.

First-person animation quality is a flagship: locomotion sway, sprint, ADS, recoil, reload stages, empty reload, inspect, equipment, melee, mantle, and spawn. Third-person animation must remain synchronized enough for hitbox readability.

## Models and Assets

Required: two team character kits with modular cosmetic pieces; six primary and three secondary weapons; attachments; hands/viewmodels; equipment; drone/pod/support models; complete K-17 environment kit; sky/ocean; decals; particles; UI icon set; and animation library.

Use first-person and world weapon models with shared material identity but separate budgets. Characters need LOD0–2 and simplified shadow/hitbox rigs. Character LOD0 target <70k triangles, first-person weapon+arms <100k, ordinary environment props <20k. Texture families are mainly 1K/2K KTX2; unique 4K maps are prohibited in the MVP except a shared environment atlas proven necessary.

## Audio

- Original modern percussive/electronic menu and match music; music drops during active combat and rises near score limit.
- Each firearm needs close mechanical layer, report, distant tail, suppressed variant, interior/exterior convolution or filters, dry fire, reload, handling, and impact material set.
- Footsteps vary by material, stance, and speed; audio radius is server-semantic while playback is client-spatial.
- Equipment pin/throw/bounce/detonation and support-action warnings must be identifiable without looking.
- Announcer communicates start, lead changes, score thresholds, support threats, and result with original concise lines.
- Mix priorities ensure enemy footsteps/telegraphs remain audible without unfair amplification; accessibility includes visual directional cues for critical sounds, not exact wall-through positions.

## Multiplayer Architecture

- Server is authoritative for movement, stance, ammo, fire cadence, spread seed, hitboxes, damage, health, Momentum, support actions, spawns, score, and match clock.
- Client sends input frames at 60 Hz when changed/active: sequence, client tick, move axes, look delta/quantized view, buttons, selected slot. Batch and acknowledge sequences.
- Client predicts local movement, stance, weapon timing, ammo display, and cosmetic shot feedback; reconciles to server and replays unacknowledged inputs.
- Other players render from 20 Hz delta snapshots with a 100 ms interpolation buffer adaptive to jitter. Extrapolate briefly, then freeze/fade rather than teleport.
- Hitscan lag compensation rewinds target hitboxes to a clamped estimated shot time using per-player clock offset and latency, maximum 200 ms. Never rewind world doors into impossible states without versioned history.
- Server validates view-angle velocity envelope, rate of fire, ammo, state, target history, movement speed, support eligibility, and message rate.
- Spawn director scores candidate groups by enemy distance, line of sight, recent deaths, teammate presence, grenade/support danger, and objective context; keep a deterministic audit reason.
- Matchmaker prioritizes region latency, then skill band and party size later. Backfill only before 70% score/time and use bots immediately.
- Reconnect within 30 seconds restores seat and score; an AI bot may temporarily control only movement-to-safe-cover, never farm kills.
- Anti-cheat: secure session tokens, server-owned truth, binary schema validation, quotas, anomaly telemetry, replayable input logs, impossible-stat detection, report tooling. Do not claim client obfuscation prevents cheats.

## Performance and Network Budget

- Client: ≤8 ms CPU and ≤11 ms GPU typical at 1080p medium. Input-to-photon path must avoid React/per-frame allocations.
- ≤220 draw calls typical/350 peak; ≤2.5M visible triangles high/1.2M medium/650k low.
- GPU textures <600 MB high/<320 MB medium; heap steady state <650 MB.
- ≤15k visible GPU particles high/5k low; ≤60 decals near player, global pooled cap 250.
- Audio ≤48 active voices with priority/virtualization.
- Initial shell/menu <8 MB compressed; join-critical map/weapons/characters <80 MB; total MVP cached assets <220 MB. The match must not start until required collision and combat assets are ready.
- Network target per player: <35 KB/s downstream average, <12 KB/s upstream average; no unbounded JSON snapshots. Measure p50/p95 packet size, jitter, reconciliation count, and snapshot age.
- Game room target: 60 Hz with <8 ms p95 simulation time for 12 humans plus 4 standby bots on intended server hardware.
- Use instancing, occlusion/frustum culling, baked lighting, LOD, texture/mesh compression, pooled VFX/decals/audio, interest filtering, delta compression, and lazy cosmetics.

## Architecture

- `shared-protocol`: versioned inputs, snapshots, events, loadouts, errors.
- `shared-simulation`: movement, weapon state, damage, equipment, Momentum, match rules.
- `client-runtime`: prediction, reconciliation, interpolation, entity views, input.
- `renderer`: map, characters, weapons, animation, VFX, decals, quality.
- `client-ui`: shell, HUD, loadouts, scoreboard, settings, results.
- `game-server`: room lifecycle, authoritative ticks, history/rewind, bots, spawns, scoring.
- `matchmaker`: queues, region routing, seat reservations, backfill.
- `profile-service`: guest/account profile, unlocks, loadouts, match results, idempotency.
- `content-data`: weapons, attachments, perks, maps, support actions with schemas/version.
- `audio`: events, spatial mix, zones, music.
- `tools-tests`: map metrics, recoil viewer, latency lab, replay inspector, asset validator, benchmarks.

Server and client may share pure formulas/data but not mutable state. The server never imports rendering/UI packages. Match results use idempotent signed submissions from the room, not client claims.

## MVP

Ship Relay Station K-17, Team Clash and Practice, 6v6 with bots/backfill, nine weapons, attachments, nine perks, six equipment items, six support actions, five loadout slots, account/guest profile, progression to level 30, complete HUD/menus/settings, authoritative netcode, post-match flow, and full audiovisual feedback.

Defer campaign, co-op missions, vehicles, ranked play, clans, prestige reset, cosmetic store, voice chat, replays for end users, multiple maps, and additional modes. Build internal replays for debugging now.

## Expansion Roadmap

1. Harden latency/jitter behavior, add reconnect polish, moderation/report pipeline, and server fleet metrics.
2. Add two maps and Zone Control; validate spawn rules per mode.
3. Add Demolition with round economy-free loadout rules distinct from the tactical FPS prompt.
4. Add ranked skill matchmaking, parties, private matches, spectator/replay, seasonal cosmetics.
5. Add co-op operations and broader accessibility/controller support.

## Testing and Acceptance Criteria

- [ ] A user can launch the URL, enter Practice without an account, choose a loadout, spawn, complete a full match, see results, and play again.
- [ ] Online, 12 browser clients can join one room, select legal loadouts, fight, respawn, reach a deterministic winner, receive one idempotent result, and requeue.
- [ ] Movement supports walk, sprint, crouch, jump, mantle, ADS slowdown, collision, and reconciliation without sustained rubber-banding at 80 ms RTT/10 ms jitter.
- [ ] Every weapon fires, recoils, consumes ammo, reloads by correct stages, applies falloff/hit zones, gives feedback, and can kill a server-authoritative opponent.
- [ ] Lethal/tactical equipment and every support action have clear targeting, warnings, counterplay, server validation, and score effects.
- [ ] A player can earn all three Momentum tiers in one life; support kills do not extend Momentum.
- [ ] Death recap matches server damage history and does not reveal information the victim should not know.
- [ ] Spawn tests across 10,000 simulated respawns show no candidate with direct enemy sight within the configured unsafe distance when a safe candidate exists.
- [ ] Bots use perception, routes, weapons, equipment, support, reload/retreat, and legal aim delays without hidden-state awareness.
- [ ] Loadout and progression data persist, invalid/tampered loadouts are rejected, and no unlock raises base health or universal damage.
- [ ] At 150 ms RTT, 2% loss, and 30 ms jitter, play remains understandable: no duplicate shots, ammo desync, stuck input, or unbounded reconciliation.
- [ ] Target hardware sustains 60 FPS median/≥50 FPS 1% low in the benchmark; game server holds its p95 tick budget.
- [ ] Pointer Lock loss, tab hiding, socket drop, version mismatch, context loss, and server shutdown show safe recovery behavior.
- [ ] No proprietary names, assets, map geometry, UI, voice lines, branded weapons, or copied audio/music are present.

## Required Delivery Artifacts

Provide source, deployable client/server builds, local bot-mode instructions, hosted architecture guide, protocol schema, map collision/nav source, balance tables, profile schema/migrations, asset licenses, load test, latency test presets, replay inspector, benchmark captures, browser compatibility matrix, threat/anti-cheat notes, accessibility checklist, and a gameplay video showing matchmaking through post-match.
