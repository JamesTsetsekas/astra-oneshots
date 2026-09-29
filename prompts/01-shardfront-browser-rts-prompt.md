# Implementation Prompt: Shardfront — Browser Competitive RTS

You are a senior game engineer, technical designer, network engineer, and real-time rendering specialist. Build **Shardfront**, an original browser-based real-time strategy game inspired by the strategic qualities of classic asymmetric science-fiction RTS games. It must launch from a URL in a modern desktop browser and deliver a polished, genuinely playable vertical slice—not a mockup.

Do not copy names, factions, units, buildings, maps, silhouettes, lore, UI layouts, sound cues, music, voice lines, visual effects, or balance values from any existing franchise. The desired inheritance is abstract: asymmetric factions, worker-driven economy, base construction, fog of war, scouting, tech progression, positional army control, counters, and the tension between macroeconomics and micro-control.

## Status and Product Contract

- Phase: first playable vertical slice with production-oriented architecture.
- Platform: desktop Chrome, Edge, and Firefox; Safari is a best-effort target. No native client or browser extension.
- Primary mode: 1v1 skirmish versus server-side AI; architecture must support authoritative online 1v1 later.
- Target session: 12–20 minutes for the MVP balance set.
- Target performance: stable 60 FPS at 1920×1080 on a reasonably modern gaming PC; functional 30 FPS fallback on lower quality.
- Input: keyboard and mouse, with remapping and edge-scroll alternatives.
- Core quality bar: selection and orders must feel immediate; units must read clearly in combat; economy, production, scouting, and victory must form one complete loop.

## Game Vision

Shardfront is a top-down 3D RTS played on a compact alien moon fractured by energy wells. The player commands one of two original factions, establishes harvesting routes, expands to new wells, builds a tech tree, scouts the opponent, produces a combined-arms force, and destroys the enemy Core Relay.

The intended experience alternates between calm planning and short bursts of high-attention control. A player should continuously make meaningful tradeoffs: workers or soldiers, expansion or technology, vision or firepower, direct assault or economic harassment. Information is deliberately incomplete. Winning should usually follow a chain of understandable decisions rather than one hidden hard counter.

## Inspiration Analysis

Preserve these genre principles:

- A two-resource economy makes basic expansion and advanced technology compete for attention.
- Bases are production networks, not decorative cities. Building placement affects travel, defense, vision, and vulnerability.
- Asymmetry should change how a faction expands and fights, while both obey the same readable rules for supply, economy, vision, armor, and damage.
- Scouting is actionable: players can see faction, building silhouettes, construction progress, unit counts, expansions, and recent attack indicators, but fog conceals current state.
- Macro and micro coexist. Queues, rally points, control groups, and command chaining reduce chores; positioning, focus fire, kiting, flanking, and ability timing create mastery.
- Map control converts into economy, vision, safer reinforcement routes, and access to neutral tactical sites.
- A counter system should be soft enough that excellent positioning can partially overcome a composition disadvantage.

Do not reproduce any recognizable franchise race triangle. The two MVP factions below require original geometry, motion language, effects, and terminology.

## Core Gameplay Loop

1. Launch the URL; detect graphics capability and show a lightweight loading shell immediately.
2. Enter the main menu, choose Tutorial or Skirmish, select a faction and difficulty, then load the map progressively.
3. Spawn with one Core Relay, six workers, one scout, and a starting supply cap.
4. Assign workers to Prism Ore, erect a Flux Tap on a vent, and build supply plus production structures.
5. Scout enemy routes and expansions while choosing an early technology branch.
6. Produce units, set rally points, research upgrades, and expand to a second resource cluster.
7. Contest watch pylons and canyon lanes; raid workers or defend reinforcement paths.
8. Use combined arms and faction abilities to break outer defenses and destroy the enemy Core Relay.
9. Show a victory/defeat summary with duration, resource collection, army value over time, units created/lost, expansion timing, and a timeline of major events.
10. Offer immediate rematch, return to lobby, or replay. Persist settings, tutorial completion, match history, and purely cosmetic profile progression locally for the MVP.

No stalemate may be permanent. After 18 minutes, resource wells yield 15% faster and the neutral center emits a map-wide reveal pulse every 90 seconds; this creates an understandable endgame without arbitrary damage escalation.

## Browser Technology

Use a TypeScript monorepo:

- **Client/rendering:** Three.js. Use `WebGPURenderer` through an engine adapter when capability and visual-parity tests pass, with its WebGL 2 fallback; retain an explicit stable WebGL 2 quality path. Three.js is appropriate here because the RTS needs a thin, highly customized renderer around instancing, selection, fog, terrain, and an independent data-oriented simulation rather than a general rigid-body game runtime. Use a fixed simulation clock independent from render interpolation.
- **UI:** React for menus, settings, post-game, tech browser, and accessible overlays. Use a small event adapter so React never owns per-frame entity state.
- **Simulation/ECS:** a deterministic, data-oriented TypeScript simulation. Use integer entity IDs, structure-of-arrays for hot components, and fixed-point or carefully quantized numeric state for multiplayer-sensitive values.
- **Navigation:** hierarchical grid navigation with precomputed static regions, dynamic occupancy, flow fields for large groups, and local reciprocal avoidance. Run expensive path queries in Web Workers.
- **Physics:** lightweight custom 2.5D collision/steering; do not run full rigid-body physics for units. Use Three.js raycasting plus a static mesh BVH for ground selection and projectile visuals.
- **Audio:** Web Audio API through a thin custom mixer, with grouped buses and pooled spatial sources.
- **Assets:** glTF/GLB, meshopt or Draco geometry compression, KTX2/Basis textures, WebP/AVIF UI art, OGG/Opus audio, JSON data definitions.
- **Build/tooling:** Vite, strict TypeScript, ESLint, Vitest, Playwright, and a deterministic headless simulation test runner.
- **Future multiplayer:** Node.js/TypeScript authoritative match processes over WebSockets, with a lobby/matchmaker, signed session tokens, deterministic command validation, snapshots, replay logs, and server-side AI.

Why this stack: the game needs many animated entities, robust browser 3D tooling, compressed glTF assets, strong UI separation, and a simulation that can later run identically without rendering on a server.

## Camera

- Perspective camera pitched 55° downward; yaw fixed in MVP, with optional 90° rotation on Q/E behind a setting.
- Default FOV 45° vertical. Zoom via wheel across a 24–68 world-unit height range using eased interpolation.
- WASD or arrow-key pan; cursor edge-scroll off by default but available. Middle-mouse drag pans the world.
- Pan speed scales with zoom. Shift increases pan speed by 60%.
- Clamp to playable bounds plus a small framing margin; do not expose void geometry.
- Double-tap a control-group number to center on it. Space jumps to the latest alert. Home centers the starting base.
- Camera must remain responsive during simulation slowdown; use unscaled render time for camera easing.
- Terrain and tall structures fade or dither only when they occlude selected units for more than 250 ms.

## Controls

- Left click: select one unit/structure; drag: box select; double-click: select visible units of same type.
- Shift+click: add/remove from selection. Ctrl+click: select visible same type.
- Right click: contextual move, attack, gather, repair, enter, or rally order.
- A then click: attack-move. S: stop. H: hold. P: patrol. G: guard/follow.
- Shift while issuing orders: append waypoints/actions. Alt+right-click: force move without auto-acquiring targets.
- Ctrl+1–9: assign control group; 1–9: select; Shift+number: add selection to group.
- Tab/Shift+Tab: cycle unit subtypes in selection. F: focus selected. Escape: cancel mode/open pause.
- B: construction palette for workers. R: production structure rally mode.
- Ability hotkeys: Q/W/E/R by command-card slot; show range and valid placement preview.
- F10: menu; F11: browser fullscreen; `: toggle compact performance panel in development builds only.
- All bindings must be rebindable; prevent browser scrolling/context menus only while the canvas owns focus.

## Player Movement

The player has no embodied avatar; “movement” means camera navigation and responsive unit command. Camera movement is defined above. Unit motion is server/simulation authoritative: a move command resolves to a reachable ground point, uses the unit's data-driven speed/turn/acceleration profile, follows a shared group corridor where possible, and preserves queued waypoints. Units may begin turning immediately, but attack release, setup, root, stun, and construction states can delay translation. Hovering scouts ignore ground blockers but not map bounds or dedicated no-fly volumes. Formation placement must keep faster units from permanently trapping slower units, compress through chokepoints, and expand after exit. A selected unit's destination, path failure, movement impairment, and current command must be visible through decals/status UI.

## Player Economy, Supply, and Construction

- **Prism Ore:** common resource mined from finite crystal seams; funds workers, basic units, and structures.
- **Flux:** advanced resource extracted from vents after building a Flux Tap; funds specialists, abilities, and higher technology.
- Workers reserve a harvest node, perform a 1.6-second gather, carry a visible load, return to the nearest active drop-off, and re-evaluate when blocked.
- Display current workers, ideal saturation, and travel inefficiency per base. Over-saturation must be possible but clearly inefficient.
- Supply comes from faction-specific support structures. A queue item that would exceed supply pauses visibly rather than disappearing.
- Construction shows a foundation, progress, hit points proportional to completion, worker animation, and a readable cancel refund. Placement preview displays power/territory rules, path blockage, slope, collision, and range.
- Production queues expose cost, duration, prerequisites, hotkeys, pause reason, cancellation, and rally path.

## Factions, Units, Abilities, and Buildings

### Helix Directorate

Industrial expeditionaries using modular walkers, projectile weapons, and deployable field engineering. Their identity is durable firing lines and positional setup.

- **Fabricator:** worker; mines, repairs mechanical targets, and constructs. Emergency Weld restores 60 structure HP over 4 seconds at Flux cost.
- **Kestrel:** fast wheeled scout with long sight and low damage. Sensor Spike grants temporary vision in a small area but is detectable.
- **Bulwark:** basic rifle walker; reliable against light targets. Can brace for +range and -movement.
- **Arc Lancer:** slow anti-armor unit; line projectile can overpenetrate one light unit.
- **Mender Rig:** support drone vehicle; repairs nearby mechanical units using Flux charge but cannot attack.
- **Mortar Crawler:** siege unit with minimum range, visible shell arc, setup time, and strong structure damage.
- **Aegis Frame:** late heavy unit with a directional shield that blocks a limited amount of frontal projectile damage.
- **Core Relay:** headquarters and resource drop-off.
- **Assembly Bay:** basic unit production.
- **Signal Foundry:** advanced tech and upgrades.
- **Grid Pylon:** supply and construction field.
- **Sentry Arc:** short-range defense whose firing cone is visible during placement.

### Verdant Chorus

A distributed bio-synthetic ecology grown from seed organisms. It expands through living root zones, favors mobility, regeneration, and encirclement, and uses organic silhouettes unrelated to existing RTS factions.

- **Tender:** worker; harvests and germinates structures. Can Rootstep quickly between two friendly groves on a cooldown.
- **Glimmerwing:** hovering scout; no basic attack, excellent sight, briefly reveals cloaked Sensor Spikes.
- **Thornling:** cheap melee screen that gains speed near damaged enemies.
- **Sporecaster:** ranged skirmisher; attacks apply a short non-stacking slow.
- **Carapace Guard:** anti-ranged tank; can curl into immobility and reduce frontal damage.
- **Bloom Sage:** support caster with Mend Spores and a telegraphed silence patch.
- **Rift Stag:** mobile artillery creature firing delayed ground eruptions; weak if engaged.
- **Crownbeast:** late assault unit that projects a regeneration aura outside combat.
- **Heartgrove:** headquarters and resource drop-off.
- **Brood Hollow:** basic unit growth.
- **Memory Bloom:** technology and upgrades.
- **Root Node:** supply and extension of the living build zone.
- **Needle Pod:** defensive structure that prioritizes air/hovering scouts, then closest threats.

### Shared Combat Rules

- Unit roles use Light, Armored, Massive, Biological, and Mechanical tags. Damage bonuses are displayed in tooltips.
- Attacks expose base damage, attack period, range, projectile speed, bonuses, and splash shape.
- High ground grants +2 vision range and can block vision through cliff edges, but provides no hidden accuracy dice.
- Friendly units do not deal friendly fire in the MVP except clearly marked siege ground effects.
- Each faction has three attack and three armor upgrades across two tiers. No upgrade exceeds 12% effective power alone.

## Combat and Feedback

- Target acquisition uses stance, threat, range, recent attacker, and player focus target. Never override a queued player order unless it becomes invalid.
- Projectiles distinguish simulated hits from decorative tracers. Deterministic projectiles resolve in simulation; VFX interpolate independently.
- Death states: play a 0.4–1.2 second faction-specific collapse/dissolve, remove gameplay collision immediately, pool debris, and never hide lethal feedback.
- Selection decals show team color and current command. Health bars appear for selected, damaged, or hovered units.
- Give every attack a complete feedback chain: anticipation, muzzle/cast flash, projectile or contact, impact, health response, sound, and optional camera-space alert.
- Avoid screen shake for ordinary attacks. Large siege impacts use a subtle 2–4 pixel impulse and respect reduced-motion settings.

## World and Map

Build one original symmetrical-but-not-identical 1v1 map, **Glass Ravine**:

- Two protected main bases on opposite corners.
- One nearby natural expansion each with a defensible ramp and alternate harassment path.
- Two risky side expansions and one depleted central resource field.
- A canyon center with two bridges, a lower route, destructible crystal barriers, and flanking brush that blocks vision but not movement.
- Two neutral Watch Pylons. A unit channeling for 3 seconds captures one, granting vision over a route until contested.
- Cliffs must create readable topology. Walkable, buildable, blocked, hover-only, and vision-blocking surfaces require debug visualization.
- Spawn fairness tests must compare rush distance, expansion distance, total nearby resources, sight lines, and choke width within 3% tolerance.

## Game Modes

- **Tutorial:** guided 8–10 minute scenario teaching selection, economy, production, control groups, combat, and victory. Instructions pause only when necessary and validate actions, not exact clicks.
- **Skirmish:** player versus Easy/Normal/Hard AI, either faction, with standard destroy-HQ victory.
- **Sandbox:** optional developer-facing mode with unit spawning, fog toggle, time scale, and combat telemetry; exclude it from normal progression.
- Later: unranked online 1v1, ranked 1v1, observer/replay, co-op defense, and additional maps. Do not put these in the MVP critical path.

## AI

Implement server-compatible utility AI, not omniscient scripts:

- It obeys fog of war and maintains memory records with last-known time and confidence decay.
- Strategic states: Opening, Establish Economy, Scout, Defend Threat, Harass, Expand, Tech, Assemble, Attack, Recover, Final Push.
- A build planner evaluates supply blocks, worker saturation, prerequisites, desired composition, reserve budget, and known enemy tags.
- Army squads use rally, approach, engage, kite, retreat, reinforce, and regroup states.
- Normal AI scouts before countering. Hard AI has faster decision cadence and better multi-pronged control, not resource or vision cheats.
- AI workers evacuate credible raids, repair priority structures, and return when local threat falls.
- Navigation failures time out, request a new path, and ultimately select a safe fallback; no permanent command loops.

## Physics and Navigation

- Terrain is 2.5D; gameplay elevation is discrete by region, while rendering may be smoothly sculpted.
- Use circles/capsules for unit separation and convex/static blockers for structures and cliffs.
- Large selections request a shared corridor, assign formation slots, then use local avoidance. Do not issue one expensive global path per unit every frame.
- Units may compress formation through chokes but must not overlap. Detect and resolve stuck pairs deterministically.
- Destructible barriers change navigation regions through localized updates rather than rebuilding the entire map.

## Items, Loot, and Inventory

Traditional loot and inventory are intentionally out of scope. The only map interactables are resource nodes, Watch Pylons, destructible blockers, and a small number of neutral salvage pods that grant a fixed one-time resource bundle. Pods use deterministic spawn points and never contain combat upgrades, preventing random match-deciding power.

## Progression

- **In-match:** economy, expansions, supply, tech prerequisites, army composition, and upgrades.
- **Persistent MVP:** tutorial badges, match history, faction mastery XP, and unlockable profile banners/color accents only. No stat bonuses, paid power, randomized rewards, or grind-gated units.
- Store local progress in IndexedDB behind a repository interface so authenticated cloud persistence can replace it later.

## UI and UX

- Main menu: Play, Tutorial, Tech Archive, Replays, Settings, Credits.
- Pre-match: faction cards, concise difficulty explanations, map preview, and start button.
- HUD: minimap bottom-left; selection/portrait and stats bottom-center; contextual command card bottom-right; resources, supply, workers, and match timer top-right; objective top-center.
- Drag-select and minimap orders must work reliably at different device pixel ratios.
- Alerts: under attack, construction complete, insufficient resource, supply blocked, research complete, expansion depleted. Stack by priority and rate-limit audio.
- Tooltip layers: immediate label/cost/hotkey, then expanded stats after 350 ms.
- Fogged enemy structures show a desaturated last-known silhouette with timestamp; fogged mobile units disappear.
- Post-game: result, metrics, timeline, economy/army graphs, rematch.
- Pause/settings: graphics preset, render scale, shadows, effects, anti-aliasing, audio buses, camera, scroll, keybinds, colorblind palettes, subtitle/notification options.
- Handle loading, WebGL/WebGPU initialization failure, lost context, disconnected future match, and corrupted local save with actionable messages.

## Visual Direction

Use stylized hard-surface science fiction with readable silhouettes and restrained surface noise. Glass Ravine combines dark basalt, pale mineral shelves, teal crystalline seams, and warm industrial lighting. The Directorate uses angular modules, exposed actuators, amber-white lamps, and coherent muzzle flashes. The Chorus uses layered translucent membranes, asymmetrical branching forms, violet bioluminescence, and drifting spores.

Maintain team identification using base ring, emissive stripe, health-bar accent, and minimap color; never recolor the whole model. Units should read at the default camera height from silhouette, locomotion, projectile, and audio. Use baked indirect lighting plus one sun, clustered local lights only for hero moments, cascaded shadows on high quality, blob/contact shadows on low. Weather is subtle drifting dust; it must not obscure competitive information.

VFX must communicate gameplay shapes: area effects show edge, duration, team ownership, and activation time. Avoid opaque explosions over health bars. UI uses matte dark panels, thin luminous borders, large numeric hierarchy, and no visual resemblance to existing RTS interfaces.

## Models and Assets

Create original assets for 14 units, 10 core structures, two resource types, terrain kit, cliffs, bridges, barriers, capture pylons, vegetation/crystals, decals, UI icons, portraits, cursors, and VFX atlases. Each mobile unit needs idle, move, turn/lean, attack anticipation, attack recovery, hit, ability, and death states as appropriate. Workers additionally need gather, carry, construct, and repair.

Author three LODs for major units and two for small units. Use separate simplified selection/collision meshes. Texture sets should generally be 1K per unit/structure family, 2K only for shared hero atlases or terrain sheets. All imported assets need automated scale, pivot, material-count, animation-name, and compression checks.

## Audio

- Original adaptive score with low-intensity economy, threat, battle, and endgame stems; transitions use intensity hysteresis.
- Distinct faction palettes: percussive machinery and electrical relays versus breathy organic pulses and granular chimes.
- Positional combat audio with distance attenuation and concurrency limits. Important off-screen events receive a separate UI cue.
- Each unit needs select, move acknowledgment, attack acknowledgment, under-fire bark group, weapon, impact, ability, and death sound variants without repetitive chatter.
- Minimap pings, alerts, queue completion, invalid orders, and victory/defeat require unique nonverbal signatures.

## Multiplayer Architecture

The MVP can run locally against AI, but organize it around the same command protocol intended for multiplayer.

- Server owns simulation, RNG seed, resources, production, unit state, fog visibility, damage, abilities, victory, and replay log.
- Client sends sequenced commands with selected entity IDs, command kind, target, queue modifier, and intended simulation tick—not transforms or damage.
- Authoritative simulation tick: 20 Hz. Render at display refresh rate using interpolation. Command batching may occur every 50 ms.
- Validate ownership, visibility where required, ability state, cost, prerequisites, target legality, and rate limits.
- Use short input delay (target 2–4 ticks depending on measured latency), periodic state hashes, and selective compressed snapshots for recovery. Do not trust deterministic lockstep alone across heterogeneous browser runtimes.
- Fog-filter state per player. Never send currently hidden enemy transforms merely because the client promises not to render them.
- Reconnect flow requests a signed seat, full filtered snapshot, recent command tail, and current tick.
- Spectators use delayed, omniscient snapshots. Replays store versioned initial seed plus validated command stream and keyframe snapshots.
- Anti-cheat: authenticated sessions, command quotas, impossible-action rejection, server-side fog enforcement, build-version handshake, match audit metrics. Client obfuscation is not security.

## Performance Budget

- 60 FPS target: 16.7 ms frame; reserve ≤8 ms CPU simulation/UI and ≤11 ms GPU in typical combat, leaving headroom.
- Up to 220 active mobile units and 80 structures in MVP; stress test 400 units.
- ≤250 visible draw calls typical, ≤400 peak high quality. Use instancing/merged static terrain and material atlases.
- Visible triangles: 1.5–2.5 million high, <1.2 million medium, <650k low.
- Texture GPU memory: <500 MB high, <300 MB medium. Total JS/WASM heap steady state <600 MB; warn/recover before 900 MB.
- Particles: <20k GPU particles visible high, <7k low; CPU gameplay particles are prohibited.
- Navigation: amortized <2 ms/frame; path requests budgeted and processed in workers.
- Initial transfer: shell <2 MB compressed; playable tutorial/skirmish essentials <30 MB; full MVP asset cache <120 MB. Show progress by bundle and allow retry.
- Audio: ≤32 positional voices plus 8 UI/music buses; virtualize distant sources.
- Network target: <15 KB/s average downstream and <4 KB/s upstream per player after compression in 1v1; snapshot spikes must be bounded.
- Use LOD, frustum culling, fog-aware render suppression, GPU instancing, object pools, texture compression, mesh compression, and lazy loading. Add a reproducible benchmark scene.

## Architecture

Use packages/modules with narrow interfaces:

- `app-shell`: boot, capability detection, routing, error boundaries, service worker.
- `simulation-core`: fixed clock, ECS, commands, RNG, economy, production, combat, upgrades, victory.
- `faction-data`: schema-validated units, structures, technologies, and balance tables.
- `world`: terrain metadata, occupancy, visibility, resource nodes, capture points.
- `navigation`: region graph, flow fields, path worker, local avoidance, stuck recovery.
- `renderer`: scene lifecycle, entity views, materials, animation, VFX, selection, quality tiers.
- `input-camera`: pointer/keyboard mapping, command modes, selection, camera.
- `ai`: blackboard, economy planner, scouting memory, squad control.
- `audio`: buses, spatial sources, adaptive score, accessibility.
- `ui`: menus, HUD, command card, minimap, settings, post-game.
- `network-protocol`: versioned commands, snapshots, hashes, serialization.
- `persistence`: IndexedDB profiles, match history, replays, migrations.
- `tools`: map validation, balance simulator, asset validation, benchmark, debug overlays.

Render code must never decide damage or resource results. UI dispatches commands and observes read models. Balance content must be data-driven and schema validated. All time-based simulation uses ticks, never wall-clock time.

## Security, Privacy, and Browser Safety

- Apply a restrictive Content Security Policy; avoid runtime `eval` and untrusted asset URLs.
- Treat player names and future chat as untrusted text. Sanitize and length-limit all labels.
- Do not collect gameplay telemetry by default. If added later, use opt-in, content-free aggregate events.
- Do not store auth tokens in localStorage; use secure, same-site cookies or short-lived memory tokens.
- Pause or reduce work when the tab is hidden in local play. In online play, continue receiving state and make the AFK state explicit.

## MVP

Deliver one polished map, both complete faction rosters above, Tutorial, three AI levels, one skirmish win condition, fog of war, minimap, control groups, replays, settings, audio, and post-game stats. A normal match must demonstrate economy, building, expansion, technology, scouting, army composition, abilities, combat, and victory.

Defer online matchmaking, ranked play, cosmetics store, campaign, map editor, third faction, naval/air layers, and more than one competitive map. Stubs and architecture are welcome; inaccessible placeholder buttons are not.

## Expansion Roadmap

1. Harden deterministic tests and add authoritative unranked 1v1 plus reconnect/replay verification.
2. Add observer mode, ranked matchmaking, skill rating, reports, and server-side match history.
3. Add two maps with different topology and automated fairness telemetry.
4. Add a third faction only after counter coverage and readability budgets are validated.
5. Add co-op scenarios, campaign scripting, map editor, and mod-safe data packs.
6. Improve WebGPU-specific compute culling and large-army rendering while retaining WebGL 2 fallback.

## Testing and Acceptance Criteria

Automate simulation tests at multiple frame rates and seeds, and manually test common browsers.

- [ ] A fresh user can open the URL, complete capability detection, load the Tutorial, and receive actionable progress/error feedback.
- [ ] Tutorial completion proves select, move, gather, build, produce, control group, attack-move, ability, and destroy-objective actions.
- [ ] In Skirmish, the player can collect both resources, avoid/resolve a supply block, research technology, expand, command at least 40 units, destroy the enemy Core Relay, view results, and rematch.
- [ ] Both factions are fully playable and each unit/building has a purpose, tooltip, cost, prerequisite, animation, sound, selection behavior, and counter relationship.
- [ ] Fog hides live enemy state, preserves appropriate last-known structures, and prevents AI from responding to unseen information.
- [ ] Queued commands, control groups, rally points, minimap orders, camera jumps, and remapped controls work at 100%, 125%, and 150% browser scaling.
- [ ] Replaying a recorded local match reaches the same periodic state hashes and outcome.
- [ ] Normal AI can execute workers, supply, production, scouting, expansion, composition changes, attacks, retreats, and rebuilding without resource or vision cheats.
- [ ] Units do not permanently overlap or remain stuck for more than 3 seconds in the map's narrowest valid choke.
- [ ] The benchmark holds a 60 FPS median and ≥50 FPS 1% low on the target PC at 1080p medium with 220 active units.
- [ ] The app survives WebGL/WebGPU context loss by showing recovery UI and either restoring the local match from a recent snapshot or returning safely to menu.
- [ ] No proprietary names, logos, sounds, music, map layouts, character designs, or extracted assets are present.

## Required Delivery Artifacts

Provide source code, setup instructions, architecture notes, asset manifest with licenses, balance data, map schema, protocol schema, test suite, automated benchmark, browser compatibility matrix, known limitations, and a production build that can be hosted as static client assets plus an optional Node game service. Include a short gameplay capture showing the complete loop and a debug capture showing navigation, fog, entity count, frame time, and draw calls.
