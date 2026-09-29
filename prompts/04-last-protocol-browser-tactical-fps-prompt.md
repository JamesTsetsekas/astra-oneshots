# Implementation Prompt: Last Protocol — Browser Competitive Tactical FPS

You are a senior competitive-FPS engineer, server/netcode specialist, economy designer, level designer, anti-cheat engineer, and browser performance specialist. Build **Last Protocol**, an original browser-based 5v5 tactical shooter inspired by the round structure, weapon economy, precision gunplay, utility, information control, and attack/defend mind games of classic bomb-defusal shooters. It must launch from a URL and support a full authoritative match—not merely a movement or aim demo.

Do not copy any existing game's faction names, map layouts/callouts, weapon names or recognizable models, skins, economy numbers, recoil patterns, grenade lineups, UI, announcer, sounds, logos, or ranks. Use fictional security teams, an original objective, original architecture, and original weapon silhouettes. The inspiration is systemic: no-respawn rounds, buy decisions, high lethality, movement accuracy tradeoffs, learnable recoil, utility-driven space control, and team economy across rounds.

## Status and Product Contract

- Platform: desktop Chrome, Edge, and Firefox; Safari best effort. Keyboard/mouse only for competitive queue initially.
- Mode: 5v5 **Cipher Breach** on one original map; Practice and bot fill are included.
- Server: authoritative 64 Hz simulation with high-resolution input timestamps, 20–32 Hz delta snapshots, lag-compensated hitscan, server-controlled economy/objective.
- Match length: first to 9 rounds, side swap after 8, win by 2 with a maximum of 20 rounds; MVP match target 22–35 minutes.
- Round: 20-second buy phase, 105-second action clock, 35-second armed-objective timer, 8-second defuse without kit/5 seconds with kit.
- Target performance: stable 60 FPS at 1080p medium; input/render paths must be stable enough for competitive aiming.
- Definition of done: ten clients can join, buy, play both sides, use weapons/utility, plant/defuse the Cipher, die and spectate, manage economy, swap sides, finish a match, and receive a result.

## Game Vision

Two five-player teams contest a secure research complex. The **Intrusion** side carries a Cipher Spike and must arm it at either of two network vaults. The **Custodian** side must prevent arming, eliminate attackers, or disarm the Spike. Players have one life per round. Money carries between rounds, forcing choices between full buys, partial buys, and saving.

Every sound, sightline, grenade, and timing matters. Gunplay rewards stopping before firing, controlling a learnable recoil path, crosshair placement, and team trades. Utility lets teams block vision, force defenders out of cover, delay pushes, and gather imperfect information. The game must be competitively legible: identical gameplay visibility across quality presets, predictable collision, explicit economy, and server-replayable outcomes.

## Inspiration Analysis

Preserve these principles:

- Round death creates stakes, observation time, and strategic adjustment.
- Purchases connect one round to the next; losing can still create a plan through save bonuses and recovered equipment.
- High lethality is fair only when movement, recoil, peeking, network feedback, and map sightlines are consistent.
- Attacker/defender asymmetry emerges from time and objective pressure, not different health or movement.
- Utility is a finite tactical language. Each item must claim space, deny sight, reveal a clue, or displace a position.
- Information has value: footsteps, reloads, weapon drops, broken glass, utility trails, teammate callouts, and the missing Spike all support inference.
- Maps need chokepoints, rotation routes, staging space, fallback positions, wallbang surfaces, and risk/reward shortcuts.
- Competitive integrity requires server authority, constrained lag compensation, stable tick timing, deterministic weapon state, and no quality-setting advantage.

## Core Gameplay Loop

1. Launch the URL, complete graphics/netcode checks, choose Competitive, Unranked, or Practice.
2. Matchmaker creates balanced teams by region and rating; players accept and load required bundles.
3. A short warmup allows movement and shooting while all clients become ready.
4. Buy phase: spawn in protected zones, purchase weapon, armor, utility, and defuse kit if eligible; drop gear for teammates.
5. Action phase: attackers gather information, use utility, take map control, commit to a vault, arm the Cipher, then defend it. Defenders hold, rotate, retake, save, or disarm.
6. Dead players spectate living teammates with team-only information and can use text/pings subject to rate limits.
7. Round end awards money, preserves surviving gear, applies loss bonus, logs the decisive event, and begins the next buy phase.
8. At halftime, teams swap roles while keeping score; economy resets to starting amount.
9. At match end, show score, round timeline, economy graph, kills/deaths/assists, opening duels, trades, utility effectiveness, objective actions, and rating change only in Competitive.
10. Requeue, review replay later, or return to lobby.

## Browser Technology

- **Rendering:** Babylon.js with WebGL 2 baseline and optional WebGPU. Use baked lighting, PBR materials, deterministic gameplay-smoke volumes, limited decals, and strict visibility parity.
- **Client/runtime:** TypeScript with fixed-step prediction, interpolation, and render separation. React for menus, lobby, buy menu, scoreboard, settings, match history; non-React in-frame HUD state adapter.
- **Physics:** query-driven capsules and convex/static map collision using Rapier WASM client-side; identical simplified collision representation on server. Avoid dynamic rigid bodies in competitive paths.
- **Networking:** secure WebSockets using a Node.js/TypeScript authoritative room service such as Colyseus. Inputs are sequenced and timestamped; server sends delta snapshots and reliable round/economy events.
- **Bots:** server-side navmesh, visibility graph, grenade target library, team tactics blackboard.
- **Services:** matchmaker/rating, reservations, game rooms, account/profile, inventory cosmetics later, match/replay storage, reports. PostgreSQL durable data; Redis queue/presence/rate limits; object storage for compressed replays.
- **Assets:** glTF/GLB with mesh compression, KTX2 textures, WebP/AVIF UI, OGG/Opus audio.
- **Testing/tooling:** Vite, strict schemas, Vitest, Playwright, server simulation, network-condition lab, map visibility/fairness scanner, recoil verifier, replay determinism tests, load tests.

## Camera

- First person, default 90° horizontal FOV at 16:9, adjustable 80–105° if competitive visibility remains equivalent.
- Pointer Lock raw mouse input; no artificial acceleration. Sensitivity, zoom sensitivity, and scoped multiplier are numeric and exportable.
- Gameplay aim ray is unaffected by head bob, breathing, cosmetic weapon sway, damage overlay, or viewmodel FOV.
- ADS/scopes only on designated weapons; ordinary rifles use hip/shoulder crosshair-free aiming where the center ray defines aim.
- Dead spectator modes: first-person teammates, fixed tactical camera only after team elimination, and delayed GOTV-style observer for authorized spectators. Never free-cam live enemy information to players.
- Flash effects are angle, distance, line-of-sight, and occlusion based; accessibility can reduce pure-white intensity while preserving obscuration duration.

## Controls

- WASD move; mouse aim; left fire; right alternate fire/scope.
- Shift walk silently; Ctrl crouch; Space jump; no sprint, slide, mantle, or prone.
- R reload; E interact/arm/disarm; F inspect; G drop current weapon; Q quick-switch previous weapon.
- 1 primary, 2 sidearm, 3 knife/tool, 4–7 utility slots, mouse wheel cycle.
- B buy menu only in buy zone/phase; Tab scoreboard/economy; M tactical map/ping; Z/X/C radio wheels.
- Escape menu; console is developer-only and disabled in production.
- Support hold/toggle crouch and walk, jump-throw binding as an explicit accessible action if its trajectory is server-consistent, key rebinding, crosshair editor, left-hand viewmodel cosmetic option.

## Player Movement

Data-driven starting values:

- Base velocity varies by carried weapon: tool 5.5 m/s, sidearm 5.2, SMG 5.0, rifle 4.7, heavy/sniper 4.3.
- Silent walk 52% speed; crouch 40%. Acceleration 24 m/s², counter-strafe deceleration 30 m/s².
- Firing accuracy uses horizontal speed at server shot time. Rifle standing accuracy reaches its tight baseline below 0.45 m/s; crouching slightly improves it.
- Jump apex ~0.78 m. Landing creates a short accuracy penalty based on fall velocity. Repeated jumps lose speed and accuracy; there is no skill-less auto-hop gain.
- Crouch transitions are server stateful and rate-limited to prevent animation/hitbox abuse.
- Footstep events depend on surface, speed, stance, landing, and listener occlusion. Silent walk is nearly silent but still produces close-range gear sound.
- Peeker behavior must be measured under latency. Animation, hitbox, and camera all derive from the same authoritative stance and quantized pose.

## Combat and Ballistics

- 100 health. Optional armor absorbs a portion of ballistic damage by hit zone and degrades; helmet specifically reduces head damage from non-penetrating weapons.
- Hit zones: head, chest, abdomen, arms, legs. Damage, armor penetration, falloff, and wall penetration are weapon data.
- Hitscan ray starts from server-validated eye/weapon origin and view direction. Lag compensation rewinds target hitboxes to a clamped shot time using clock synchronization, never beyond 200 ms and never rewinds the shooter.
- Each automatic weapon has a deterministic learnable recoil path plus small seeded deviation. Recoil resets over a weapon-specific recovery time. Server checks fire sequence and seed.
- Movement inaccuracy, airborne inaccuracy, ladder state later, sustained-fire spread, and recovery are explicit. Crosshair can visualize dynamic inaccuracy if enabled.
- Bullet penetration subtracts energy by material thickness and type. Only tagged surfaces permit penetration; debug tools visualize entry, exit, damage loss.
- Reload stages are authoritative. Weapons keep remaining magazine state between drops/pickups. Reserve ammunition persists through a round for survivors.
- Tool/knife attacks are short, directional, and never the dominant economy strategy.
- No health regeneration. No revive. Round win immediately locks damaging input but lets presentation finish safely.
- Kill credit and assists use damage/time thresholds. Team damage is enabled in Competitive with reduced damage plus grief tracking; off by default in Unranked MVP if moderation is incomplete.

## Weapons and Equipment

All names/models are fictional. Prices below are provisional and must be simulation-tested.

### Sidearms

- **P-5 Vela** — $300: balanced 15-round starter sidearm.
- **Rook .44** — $700: six-shot precision sidearm, high recoil, armor pressure.
- **Needle-9** — $900: compact automatic sidearm, close-range emergency weapon.

### SMGs

- **Kite-9** — $1,250: mobile, forgiving recoil, weak armor penetration.
- **Vectora-7** — $1,700: high rate, sharp early climb, strong close entry role.

### Rifles

- **Aster 4** — $2,650: controllable all-purpose rifle; helmet headshot lethal only inside tuned range.
- **Krait 7** — $2,900: slower heavy rifle; lethal helmet headshot, demanding recoil.
- **Lumen Burst** — $2,350: three-round burst/semi-auto, low first-shot spread, punish missed burst.

### Precision/Heavy

- **Longglass M2** — $4,650: bolt-action scope rifle, lethal torso except legs/through heavy obstruction, visible scope glint only at narrow opponent-facing angle.
- **Sable DMR** — $3,100: semi-auto scoped rifle with two-hit body profile.
- **Rampart 12** — $1,900: pump shotgun for close holds.
- **Atlas LMG** — $3,800: high capacity, slow mobility, suppression through penetrable cover but difficult recoil.

### Armor and kit

- Vest $650; vest+helmet package $1,000; Custodian defuse tool $400.

### Utility

Maximum four carried, with per-type caps and team economy pressure.

- **Veil Canister $300:** creates a server-defined opaque volume for 17 seconds after bloom. Projectile and explosions temporarily carve short sight gaps only if implemented consistently on all clients; otherwise omit carving in MVP.
- **Arc Flash $200:** line-of-sight/angle flash with bounce and fuse.
- **Thermite Vial $450:** area denial for 7 seconds; spreads only across authored surface cells, not arbitrary physics.
- **Pulse Shard $350:** emits two audible motion pings; reveals a coarse directional wedge, not exact silhouettes, and can be destroyed before second pulse.
- **Fragment Charge $300:** lethal displacement grenade with falloff and cover occlusion.

Each item has hand model, equip/throw timings, bounce coefficients, trail, fuse, team color cues, audio, and deterministic server trajectory. Practice shows optional trajectory preview; competitive does not.

## Economy

- Starting money $800; cap $12,000.
- Round win $3,000. Loss begins $1,900 and increases by $400 for consecutive losses to $3,100, resetting one tier after a win.
- Arming reward: $300 personal plus $600 team at round end even if attackers lose. Defuse $300 personal. Elimination rewards vary modestly by weapon class; avoid gimmick farming.
- Surviving keeps weapons, armor state, utility, and kit. Attackers who lose by timer after failing to arm receive reduced loss reward, discouraging passive saving.
- Purchases can be refunded during buy phase if the item was not fired, thrown, dropped to another player, or damaged.
- Buy UI shows personal money, predicted next-round minimum, teammate money/equipment, requests, and dropped offers.
- Server is sole authority for balances and item ownership. Every transaction is idempotent and logged in the match replay.

## Objective Rules

- One attacker spawns with the Cipher Spike; it can be dropped and picked up.
- Arming requires 3.2 uninterrupted seconds within either vault zone, facing no specific prop. The carrier cannot fire while arming.
- Once armed, a 35-second timer starts. Beeps accelerate according to a fixed readable schedule.
- Disarm requires 8 seconds or 5 with kit and may be resumed from zero only; no partial persistence. Server validates zone, line, alive state, and held interaction.
- Attackers win on detonation or elimination when defenders cannot still disarm. Defenders win on time before arm, elimination before arm, or successful disarm.
- If all attackers die after arm, round continues. If all defenders die after arm, round ends immediately unless a rare active environmental effect could change nothing; prefer immediate result.

## World and Map

Build **Aperture Annex**, a compact research campus with two vaults and original geometry:

- Intrusion spawn in a freight yard; Custodian spawn in a security atrium.
- Vault A: tall data turbine hall with two ground entrances, a high but exposed gantry, penetrable service wall, and defender fallback lane.
- Vault B: low hydroponics lab with obscuring planters, a long glass corridor, maintenance crawl passage, and safer plant position with harder post-arm sightline.
- Mid: split-level calibration chamber connecting both sites and both spawns.
- Attacker staging areas must permit utility setup without defender spawn shots.
- Defender rotations: safe long route 13–16 seconds, risky mid route 8–10 seconds.
- Attacker fastest site contact 10–13 seconds. First engagement timing is deliberately different at A and B.
- Each site has at least three entry vectors, but only two are practical without mid control.
- Mark penetrable surfaces consistently by material and damage decal. Avoid decorative gaps that look shootable but are blocked.
- Provide original neutral callouts via tactical map, signage, and location HUD. Keep callouts short and unambiguous.
- Automated map analysis must test spawn sightlines, route length, choke width, grenade clipping, bomb-zone bounds, stuck points, light contrast, and collision/render mismatch.

## Game Modes

- **Unranked Cipher Breach:** full rules, reconnect, bot fill only during warmup/first two rounds, rating hidden.
- **Competitive Cipher Breach:** full 5v5 only, visible rating after placement, surrender/reconnect/abandon penalties, no live backfill.
- **Practice:** local/private server with bots, infinite money/ammo options, grenade camera, recoil wall, damage log, nav/collision debug.
- Future: 2v2 single-vault mode, retake drills, deathmatch warmup. Do not dilute MVP with them.

## AI

Bots run on the authoritative server and obey identical information rules.

- Perception: line of sight, field of view, smoke occlusion, hearing events with uncertainty radius, teammate radio, seen Spike, known utility.
- Team planner selects defaults, site takes, fakes, holds, rotations, retakes, and save decisions based on time, players alive, equipment, money, and observations.
- Roles: entry, trade, support, lurk, anchor, rotator. Roles are temporary behaviors, not aim bonuses.
- Tactical states: hold angle, shoulder-check, clear waypoint sequence, throw utility at validated target, trade teammate, plant, defend, defuse, save, retrieve weapon.
- Difficulty affects reaction, aim error, recoil control, information memory, utility timing, and coordination. Bots never know unseen positions or grenade trajectories after losing sensory contact.
- Bots should communicate short original callouts and uncertainty: “two heard near Glass,” not perfect counts when only one source was heard.

## Physics and Competitive Consistency

- Static map collision uses simplified, versioned meshes identical in client/server builds and verified by hash.
- Player capsules/hitboxes use quantized animation poses. Cosmetic cloth and ragdolls never affect hits.
- Grenades use fixed-step swept collision with material-specific restitution and deterministic sleep; trajectory matches Practice preview within 5 cm under no network delay.
- Doors in MVP are fixed open/closed per map and cannot be toggled, eliminating desync ambiguity.
- Dropped weapons have server-owned resting transforms selected from deterministic traces, then render cosmetically. They cannot block movement or bullets.
- Ragdolls, debris, shell casings, and decals are client-only, pooled, and quality-scaled.

## Items and Inventory

No random loot. A player carries one primary, one sidearm, tool, Spike when assigned, armor, kit if defender, and up to four utility items. Weapons can be dropped/picked up. Buy inventory resets according to survival and side swap rules.

Persistent inventory contains cosmetics only in future. MVP includes five free original finish variants unlocked by play; finishes cannot change silhouette, muzzle flash visibility, scope geometry, or audio.

## Progression and Rating

- Unranked account level and onboarding unlock cosmetics only; all competitive weapons/equipment are available from the start.
- Competitive rating updates from match result and confidence, not raw kill count. Parties and placement matches are future-compatible.
- Track match/round statistics, weapon accuracy, headshot ratio, opening duels, trades, plants/defuses, utility damage, enemies flashed, smoke blocks, economy spent/saved.
- Do not expose hidden anti-cheat risk scores. Allow match history privacy controls.

## UI and UX

- Main menu: Play, Practice, Loadout/Finish, Match History, Learn, Settings, Credits.
- Lobby: party, region/ping, queue type, estimated wait, ready status.
- Buy menu: category radial/list, time, money, team equipment, requests, refunds, keyboard number shortcuts.
- HUD: minimal crosshair, ammo/reserve, health/armor, utility slots, money during buy, round score/timer, team-alive strip, objective state, location callout, kill feed.
- Tactical map: teammates and known objective; no enemy positions except legal reveals.
- Spectator HUD distinguishes live knowledge, teammate knowledge, and delayed broadcast overlays.
- Scoreboard: economy/equipment summary during buy, K/D/A, objective/utility stats, ping, mute/report.
- Round end: win condition (“Cipher disarmed,” “team eliminated,” “time expired”), 4-second highlight summary, then buy.
- Match end: round timeline and economy chart make turning points understandable.
- Crosshair editor supports static/dynamic gap, thickness, outline, center dot, color and colorblind presets; it cannot show hidden recoil beyond allowed dynamic inaccuracy.
- Errors/recovery: reconnect countdown, server paused for technical issue, abandon warning, version mismatch, anti-cheat validation failure without sensitive details, graphics loss, asset checksum mismatch.

## Visual Direction

Use clean, slightly stylized near-future research architecture: pale mineral concrete, dark acoustic panels, verdant hydroponics, magenta network conduits, and warm emergency lights. Competitive contrast outranks cinematic darkness. Character teams have distinct helmet and torso silhouettes plus cyan/amber IFF elements that remain recognizable under colorblind modes.

Weapon finishes stay matte and physically plausible. Muzzle flashes are short and do not obscure sight. Blood is restrained and adjustable; hit confirmation does not depend on gore. Veil smoke has the same authoritative boundary and opacity across presets. Thermite ground area shows a crisp border under effects-low. Dynamic exposure is slow and bounded; no player can hide in crushed blacks or blown highlights.

## Models and Assets

Required: two team character rigs, 12 weapon models plus viewmodels, five utility items, Spike and kit, hands, complete Annex environment kit, material/penetration variants, tactical map, icons, particles, decals, and animations.

Animations: first-person idle/move/fire/recoil/reload stages/draw/holster/inspect/throw/arm/disarm; third-person locomotion by stance, aim offsets, fire, reload, throw, hit/death, arm/disarm. Third-person pose drives server hitbox selection through a bounded pose state, not raw client animation time.

Use three LODs, collision proxies, baked lightmaps, KTX2 textures, mesh compression, and asset validation. Character LOD0 <75k triangles; first-person arms+weapon <110k; map visible triangle target follows performance budget.

## Audio

- Footsteps, jumps, landings, weapon handling, reload, scope, drops, arming, and disarming are tactical information with authored audible radii and occlusion.
- Each weapon has original shot, tail, mechanical, suppressed if applicable, dry, reload, and distant variants. No sampled/copycat sounds.
- Grenade bounce materials and fuse cues are distinct. Veil bloom, thermite ignition, Pulse Shard pings, and flash detonation must be identifiable.
- Cipher beep timing is exact and readable. Final seconds use sound plus HUD, not sound alone.
- Sparse original music only in menus, warmup, halftime, and match result; no music masks live-round cues.
- HRTF/panning, obstruction low-pass, room reverb zones, priority voice allocation, hearing accessibility indicators limited to critical objective/utility events.

## Multiplayer and Anti-Cheat Architecture

- Server owns all mutable match truth. Clients send input intent, view direction, item selection, and purchase requests; they never send hit/damage/money results.
- Input sampling 64 Hz when active with sequence/tick/time; server maps client time using continuous clock sync and clamps anomalies.
- Local movement prediction/reconciliation; remote player interpolation 80–120 ms based on jitter. Do not extrapolate a peeking player through a wall for more than two snapshots.
- Lag compensation stores 250 ms of quantized hitbox/world-state history. Rewind is capped by measured RTT and policy; shooter receives authoritative hit confirmation.
- Reliable ordered events: purchases, round state, objective, deaths, chat, result. Unreliable/delta channel semantics can ride WebSocket with explicit supersession and sequence dropping.
- Interest filtering still sends audibility events without transforms when appropriate. Never send hidden live enemy transforms to ordinary clients.
- Match servers create signed, idempotent result records. Rating/profile service accepts only room credentials and unique match IDs.
- Anti-cheat layers: schema validation, message quotas, movement/fire/economy invariants, view-angle and reaction analytics, impossible wall-hit review, signed build manifest, map/collision hashes, server replay, reporting, and moderation workflow.
- Browser limitations mean client integrity cannot be guaranteed. Design the server so modified clients gain as little authority as possible; do not promise kernel-style detection.
- Reconnect restores team/seat/economy/state and spectates until next safe round if rejoin occurs mid-round after control was lost.

## Performance and Network Budget

- Client frame: ≤7 ms CPU and ≤10 ms GPU typical at 1080p medium; p99 input processing must not wait on UI/render work.
- Draw calls <220 typical/<320 peak; visible triangles <2.0M high/<1.0M medium/<550k low.
- GPU texture memory <550 MB high/<300 MB medium; heap <600 MB steady state.
- Gameplay smoke budget ≤4 simultaneous overlapping volumes; same occlusion result on every preset.
- Decals ≤120 local/300 global pooled; ragdolls ≤6; GPU particles ≤10k high/3k low.
- Audio ≤48 voices with priority.
- Client transfer: shell/menu <8 MB; match-critical map/characters/weapons <100 MB; total cached MVP <250 MB.
- Network target <30 KB/s downstream and <10 KB/s upstream average/player. Measure p95 snapshot size, input backlog, jitter buffer, rewind age, and reconciliation.
- Server 64 Hz p95 tick <10 ms with ten players and four spectators on target hardware; no GC pause >4 ms during live round.

## Architecture

- `protocol`: versioned schemas, input/snapshot/event types, compatibility handshake.
- `simulation`: movement, weapons, recoil, grenades, damage, objective, economy, rounds.
- `client-netcode`: prediction, reconciliation, interpolation, clock sync, event de-duplication.
- `server-room`: match state, history, lag compensation, validation, result signing.
- `map-runtime`: collision, zones, material tags, navmesh, callouts, hash manifest.
- `bots`: senses, blackboard, team plan, utility, combat.
- `renderer`: scene, characters, viewmodels, animation, smoke, VFX, quality parity.
- `ui`: shell, lobby, buy, HUD, spectator, scoreboard, history, settings.
- `services`: identity, queues, rating, profiles, match/replay store, reports.
- `content`: weapons, prices, rewards, utility, match rules, cosmetic safety tags.
- `tools`: recoil lab, grenade lab, map scanner, replay viewer, net lab, performance harness.

Keep simulation formulas shared and pure where useful, but server state private. Content changes require a ruleset version saved in every replay and match record.

## MVP

Deliver Aperture Annex, Cipher Breach, Unranked/Competitive/Practice, 5v5 authoritative rooms, 12 weapons, five utility types, armor/kit/economy, complete objective, side swap/overtime, bots, spectating, reconnect, rating, post-match analysis, settings, accessibility, and internal server replays.

Defer public cosmetic marketplace, user-generated maps, voice chat, tournaments, clans, demo editor, multiple maps, extra modes, and cross-platform controller queue.

## Expansion Roadmap

1. Public replay viewer, overwatch/moderation tools, surrender/timeouts, party restrictions, improved anti-cheat analytics.
2. Two new original competitive maps, map veto, per-map rating insights.
3. 2v2 and retake training; workshop-style private maps only after sandbox/security design.
4. Seasons, leaderboards, spectator broadcast, tournament API, cosmetic inventory/trading only with fraud controls.
5. WebGPU render improvements that do not change competitive visibility.

## Testing and Acceptance Criteria

- [ ] Ten browser clients can accept a match, finish warmup, play both halves and overtime if required, produce one winner, persist one result, and return to lobby.
- [ ] Buy, refund, drop, pickup, survival carryover, loss bonus, plant reward, side reset, money cap, and invalid-purchase rejection match automated economy fixtures.
- [ ] The Cipher can be carried, dropped, armed at either legal vault, defended, disarmed with both timings, and detonated with correct win resolution.
- [ ] Movement accuracy, recoil sequence, rate of fire, reload stages, armor, hit zones, falloff, penetration, and grenade paths are server authoritative and reproducible in test fixtures.
- [ ] At 100 ms RTT/20 ms jitter/1% loss, no duplicate purchases/shots, stuck input, impossible objective completion, or unbounded correction occurs.
- [ ] A player cannot see live enemy state through snapshots, spectator, minimap, smoke quality settings, or reconnect payloads unless rules legally reveal it.
- [ ] Every map route and site passes collision, spawn-sightline, callout, stuck-point, grenade-clipping, and render-vs-ballistic visibility tests.
- [ ] Bots can execute a coordinated site take, default, rotate, plant, post-arm hold, retake, defuse, and save while obeying fog/sound information.
- [ ] Death/spectator view does not allow communication of live enemy information beyond what teammates legally know.
- [ ] Rejoining a match restores seat and state safely; abandoned clients cannot control two sessions.
- [ ] Target client sustains 60 FPS median/≥50 FPS 1% low; server meets 64 Hz p95 budget in a full match load test.
- [ ] Crosshair, keybinds, audio, captions, reduced flash/reduced motion, and colorblind options persist and do not confer hidden visibility advantages.
- [ ] No proprietary names, branded weapon models, copied recoil, maps, UI, ranks, audio, logos, or assets are present.

## Required Delivery Artifacts

Provide source and deployable builds, protocol/ruleset schemas, server fleet guide, matchmaker/rating notes, threat model, replay format/viewer, authoritative collision hash pipeline, map source and automated analysis, economy and weapon tables, bot behavior tests, latency lab, load test, browser compatibility matrix, accessibility/visibility parity checklist, asset licenses, and a recorded full match showing buy decisions, arm/retake, halftime, and result.
