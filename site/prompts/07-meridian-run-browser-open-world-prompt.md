# Implementation Prompt: Meridian Run — Browser Open-World Urban Action Game

You are a senior open-world game engineer, gameplay and mission designer, vehicle-physics engineer, AI engineer, technical artist, and browser streaming/performance specialist. Build **Meridian Run**, an original browser-based third-person urban action sandbox inspired by the systemic freedom of modern open-world driving/action games. It must launch from a URL and provide a living city district with pedestrians, traffic, enterable cars and motorcycles, driving, on-foot movement, weapons, law-enforcement escalation, missions, and free exploration.

Do not copy any existing franchise's city, characters, story, missions, radio content, car designs or brands, UI, map, wanted icons, dialogue, logos, satirical businesses, sounds, music, animations, or visual assets. Create an original coastal city, fictional vehicles and institutions, original mission structure, and distinct tone. The inheritance is systemic: seamlessly alternate walking/driving/combat, cause-and-response city simulation, escalating pursuit, authored missions inside an explorable world, and emergent interactions.

## Status and Product Contract

- Platform: desktop Chrome, Edge, and Firefox; Safari best effort. URL launch with progressive asset streaming, no native client.
- MVP: single-player, one polished 0.8 km² district, 20–35 minute story slice plus repeatable free-roam activities.
- Client/server boundary: core MVP runs client-side and can be installed as an offline-capable PWA after first load. Optional backend handles cloud saves, leaderboards, and content manifests only. It must not be required for basic play.
- Target: 60 FPS at 1080p medium on a modern gaming PC; 30 FPS low fallback.
- Complete loop: launch/load save, explore, enter and drive vehicles, interact with residents, accept mission, evade or fight threats, trigger wanted response, escape, complete objectives, earn money/reputation, purchase/refill gear, save, and continue/free roam.

## Game Vision

Meridian Run is set in **Port Meridian**, a sunlit vertical harbor city built around floodwalls, tram viaducts, markets, and steep hillside neighborhoods. The player is Rowan Vey, an independent courier pulled into a conflict over a corrupt automated port contract. The MVP covers the South Quay district during one afternoon-to-night cycle.

The city should feel alive without pretending to simulate an entire metropolis. Traffic follows rules but reacts to danger. Pedestrians have schedules, destinations, conversations, fear, curiosity, and emergency behaviors. Police respond to witnessed/reported crimes, search last-known areas, pursue on foot or in vehicles, and de-escalate when the player breaks identification. Missions use the same driving, combat, stealth, pursuit, and world systems as free roam.

Tone: stylish, energetic, characterful, and lightly satirical, but not a replica of any existing series. Civilian harm is discouraged through mission scoring, rapid wanted escalation, reduced rewards, and optional nonlethal tools. Do not reward indiscriminate violence.

## Inspiration Analysis

Preserve these high-level principles:

- On-foot movement, vehicles, combat, world interaction, map navigation, and missions transition without separate minigame loading.
- A living city is an illusion produced by density, variation, reactions, and streaming—not by simulating thousands of fully detailed actors.
- Driving should be accessible and responsive while still distinguishing vehicle mass, traction, drivetrain, and damage.
- Wanted response should escalate by evidence and threat, then shift from pursuit to search and cooldown rather than spawning endlessly in view.
- Missions should establish a goal, permit limited tactical choice, checkpoint sensibly, react to player actions, and return control to free roam.
- Landmarks and road hierarchy teach navigation. Shortcuts and alleys reward city knowledge.
- The world should offer small unscripted activities between missions: deliveries, races, theft recovery, stunt routes, stores, and viewpoints.
- Player freedom needs robust failure recovery, despawning/respawning rules, and clear systemic boundaries.

## Core Gameplay Loop

1. Launch URL; load menu shell and last safe checkpoint. New Game begins with a short in-world courier tutorial.
2. Move through the district, consult map/phone, steal or borrow an unlocked vehicle, or use Rowan's delivery motorcycle.
3. Travel to a contact or activity, obeying or ignoring traffic. Explore shops, alleys, rooftops, and waterfront routes.
4. Accept a mission from the in-world phone/contact. Mission banner states objective, optional constraints, and reward.
5. Use driving, parkour-lite traversal, stealth, dialogue choice, nonlethal or lethal combat, and vehicle interaction to complete staged objectives.
6. Crimes witnessed by civilians/cameras create an evidence report; police investigate, identify, pursue, search, and escalate based on player behavior.
7. Escape sight, change vehicle or appearance marker where allowed, leave the search area, and wait out recognition.
8. Complete mission; receive cash, neighborhood Trust, vehicle/gear unlock, and grade based on time, damage, civilian safety, and optional goals.
9. Spend cash on ammo, medical supplies, vehicle repair, safehouse upgrades, and cosmetic clothing. Trust unlocks contacts/activities, not raw damage.
10. Continue the story slice, replay missions from the safehouse board, or free roam; save automatically at safe checkpoints and manual safehouse rest.

## Browser Technology

- **Rendering:** Babylon.js using WebGL 2 baseline and optional WebGPU. Chunked scene loading, hierarchical LOD, occlusion/frustum culling, baked GI/lightmaps, reflection probes, one sun/moon, limited shadowed lights, GPU crowds/traffic impostors at distance.
- **Client:** strict TypeScript. Gameplay fixed step 30/60 Hz depending system; render interpolation. React only for main menu, map/phone, inventory, shops, mission replay, settings; in-world HUD through batched state.
- **Physics:** Rapier 3D WASM for characters, props, projectiles, and contact queries. Implement stable raycast/suspension vehicle dynamics atop or alongside Rapier, with arcade assists and deterministic tuning. Do not use high-detail render meshes as colliders.
- **Navigation:** layered pedestrian navmesh, road-lane graph, parking/vehicle spawn graph, police pursuit graph, mission splines. Run route queries/streaming prep in Web Workers.
- **World streaming:** divide district into 80–120 m cells with lightweight always-loaded road/collision graph, render HLOD, actor spawn descriptors, audio/reverb metadata, mission anchors. Stream in priority rings based on player velocity and camera.
- **AI:** utility/state machines plus crowd/traffic-specific lightweight agents. Full simulation bubble near player, reduced semantic simulation farther away, population synthesis at portals.
- **Audio:** Web Audio API with vehicle layers, city emitters, occlusion/reverb zones, radio-like original station streams from bundled segments.
- **Assets:** glTF/GLB, meshopt/Draco, KTX2, WebP/AVIF, OGG/Opus, schema-validated world/mission/vehicle/AI data.
- **Persistence:** IndexedDB save repository with versioned snapshots, journaled writes, rolling backups, import/export. Optional signed cloud adapter.
- **Tooling:** district cell exporter, road/nav editor, traffic heatmap, mission graph editor, pursuit debugger, vehicle telemetry, asset validator, benchmark route, Playwright smoke tests.

## Camera

### On foot

- Third-person shoulder camera: boom 3.2 m, height 0.45 m, horizontal FOV 85° default adjustable 75–100°.
- Free orbit with mouse; recenters gently behind movement only when enabled. Right mouse aims and tightens camera/FOV.
- Shoulder swap on X. Camera sphere-casts against world and fades small foreground foliage.
- Aim ray casts from camera to target point, then weapon muzzle to target, preventing shots through camera-only gaps.

### Vehicle

- Chase camera 5–8 m by vehicle class, speed-based FOV 78–96°, spring damping, look-ahead along velocity, collision shortening.
- Mouse free-look returns behind vehicle after configurable delay. C cycles near/far/hood cameras; hood is cosmetic and uses same control model.
- Reverse camera biases backward; airborne camera preserves horizon; crash shake is capped.
- Mission cinematic cameras are brief, skippable, never seize input during danger, and respect reduced motion.

## Controls

### On foot

- WASD move; mouse camera/aim; Shift sprint; Ctrl crouch; Space jump/vault/mantle; E interact/enter vehicle/pickup.
- Left fire/attack; right aim; R reload; F melee/nonlethal takedown; G throwable; Q gadget wheel; Tab weapon wheel/inventory quick view.
- M map; P phone; X shoulder swap; H holster; Esc pause.

### Vehicle

- W throttle; S brake/reverse; A/D steer; Space handbrake; Shift boost only on vehicles explicitly equipped later, not default.
- F exit/enter; E horn; Q/E look/lean is conflicting, so use mouse look and bind horn to H by default; final bindings must avoid collisions contextually.
- R reset vehicle only in races after a hold and penalty; C camera; X look back; left mouse aim/fire from allowed vehicle state, right mouse focus aim.
- Motorcycles use same base controls with lean assist.

All controls are rebindable, with hold/toggle aim/crouch/sprint, sensitivity, steering sensitivity, and reduced quick-time input options.

## Player Movement

- Walk 2.1 m/s, jog 4.4, sprint 6.2 with 8-second stamina and contextual recovery. Sprint never affects weapon accuracy while aim is held because aim cancels sprint.
- Crouch 1.8 m/s and reduces detection/noise. Jump apex 0.85 m.
- Contextual vault 0.5–1.0 m and mantle 1.0–1.6 m. Use clear hand markers/IK and serverless local validation.
- No wall-running or superhero traversal. Short ladders and fire escapes use authored links.
- Cover is soft/contextual: aiming near a waist/chest-high surface lowers exposure and changes stance, but the player is never glued to walls. Lean/peek follows aim with collision checks.
- Hit reactions are brief and severity-based; player retains agency unless knocked down by vehicle/explosion/heavy melee.
- Water deeper than waist triggers swim in designated harbor areas; lethal currents/void boundaries use warning and safe respawn.

## Vehicles and Driving

Implement eight original vehicles: three compact/sedan cars, one muscle coupe, one delivery van, one police interceptor, and two motorcycles.

### Vehicle model

- Data: mass, center of mass, wheelbase/track, suspension rest/travel/stiffness/damping, tire longitudinal/lateral grip curves, torque curve, gearing or simplified drive ratio, brake/handbrake, steering curve, drag/downforce, damage zones, seats, audio set.
- Use raycast wheels and per-wheel suspension forces. Apply speed-sensitive steering, mild stability assist, traction control on accessible preset, and anti-roll forces.
- Cars should oversteer under handbrake, recover predictably, and remain controllable on keyboard through input smoothing. Motorcycles use auto-balance/lean target and low-speed assist.
- Surface materials alter grip, rolling sound, particles, and braking: asphalt, wet asphalt, concrete, gravel, dirt, metal, shallow water.
- Vehicle damage: body deformation is approximated through blend shapes/detachable cosmetic parts; gameplay damage affects engine response, steering pull, tire grip, lights, and eventual stall. Avoid full soft-body simulation.
- Collision with civilians triggers strong consequences and non-graphic presentation; do not create a scoring reward.
- Enter/exit: select nearest valid seat/door, path actor, play cancellable animation, attach at a defined event. Emergency warp only after timeout and only if unseen/clear.
- Player can steal occupied civilian vehicles: driver reaction depends on fear/traffic context; animations are non-gratuitous. Locked/high-security vehicles require a timed bypass minigame later; MVP uses locked/unlocked tags.

## On-Foot Combat and Weapons

- Health 100 and optional light armor 50. Health regenerates only to 30 after 8 seconds; medical kits restore more. Armor is purchased/found and degrades.
- Weapons: compact pistol, machine pistol, carbine, pump shotgun, marksman rifle, stun projector, smoke canister, distraction chirper, and melee baton. All fictional and original.
- Hitscan firearms with range falloff, recoil, movement accuracy, reload stages, material penetration for tagged thin cover, head/torso/limb zones. No RPG/large explosives in MVP.
- Aim assist is off for mouse. Optional low-pressure snap for accessibility is disabled in score leaderboards.
- Player carries sidearm, one long gun, melee, two gadget slots, ammo, two medkits, and armor—not an unlimited arsenal.
- Enemy AI uses cover, suppression, flanks, retreat, nonlethal arrest attempts at lower threat, and limited grenades.
- Civilians are never combatants. Weapon discharge triggers panic, witness reports, and police response.
- Death returns to last safehouse/checkpoint with mission retry option, modest medical fee, and no loss of unique gear.

## Living City: Pedestrian AI

Target 35–60 nearby rendered pedestrians, but only 12–20 full-detail thinkers inside the high-fidelity bubble.

- Semantic roles: commuter, vendor, dock worker, tourist, courier, musician, resident, security guard, police.
- Daily schedule selects home/entry portal, destination, path, activity, break, and exit. MVP time cycle can compress one afternoon/evening into 45 minutes.
- States: Spawn/Enter, WalkRoute, CrossStreet, WaitSignal, Browse, Sit, Talk, WorkLoop, ReactCurious, AvoidObstacle, Panic, Flee, Hide, CallEmergency, AssistInjured, Return/Despawn.
- Perception uses sight, distance, hearing event category, and threat memory. Witnesses need plausible view/hearing and a phone/camera action before a crime becomes fully reported unless police/camera sees it.
- Crowd agents avoid each other, wait at crossings, choose sidewalk direction, and recover from blocked paths. They do not all mirror the same reaction.
- Conversations are short original bark pairs, subtitle-ready, with cooldown and context tags. Never synthesize personal data or offensive harassment.
- Distant pedestrians collapse to route tokens/animated impostors and materialize out of direct view near portals.

## Traffic AI

Target 20–35 active vehicles near player and semantic flow tokens farther away.

- Lane graph includes lane direction, speed, priority, signals, turns, yields, crosswalks, parking, spawn/despawn portals, emergency pull-over nodes.
- States: Cruise, Follow, StopSignal, YieldCrosswalk, Turn, ChangeLane, Park, PullOut, AvoidObstacle, Panic, Flee, PullOverEmergency, CollisionRecovery, Despawn.
- Drivers have cautious/normal/impatient profiles affecting gap choice and horn use within safe limits.
- Dynamic obstacle response first brakes, then changes lane or uses local bypass; timeouts reposition only out of sight.
- Traffic lights are globally simulated and synchronized with pedestrian crossings. Mission scripts request phases through a narrow API rather than directly overriding cars.
- Police and emergency vehicles request path priority and siren response; civilian traffic pulls aside where graph permits.

## Police, Crime, and Wanted System

Use a five-tier **Alert** system based on evidence plus threat. Display tier with original segmented beacon, not stars.

### Crime evidence

- Events: vehicle theft, assault, weapon display, gunfire, trespass, property damage, collision injury, attacking police.
- A crime record includes type, severity, time, location, suspect appearance, current vehicle description/plate, witnesses, camera ID, and confidence.
- Immediate police observation creates identification. Civilian report has a 2–5 second call delay that can be interrupted only through nonviolent intimidation/distraction; do not reward harming witnesses.
- Changing vehicle or entering a clothing kiosk/mission disguise after breaking sight reduces identification, but nearby police may remember behavior.

### Alert tiers

- Tier 0: no active response.
- Tier 1: patrol investigates last-known location and may question/attempt stop.
- Tier 2: active foot/vehicle pursuit; road units coordinate, nonlethal arrest preferred if threat is low.
- Tier 3: multiple cars, roadblocks on predicted routes, trained armed response.
- Tier 4: tactical vans, wider search perimeter, spike strips, harbor drone observation.
- Tier 5: district lockdown for extreme mission-only threat; strong response and rapid checkpoints, but finite spawn budget.

### Pursuit/search/cooldown

- Response units spawn at valid stations/road portals outside direct camera and travel physically.
- When no unit/camera sees the identified player, pursuit becomes Search. Map shows last-known search region but not every police location.
- Police search streets, alleys, parking areas, and probable exits using a shared blackboard. Hiding has risks; police investigate abandoned identified vehicles.
- Alert decays after the player stays unidentified outside direct sight for tier-specific time. Continuing visible crimes refreshes/escalates.
- Arrest occurs when low-health/unarmed player is cornered and complies; pay fine and lose contraband, then respawn at precinct. Resisting resumes pursuit.
- Cap concurrent police units and use reinforcement budget to prevent endless CPU/spawn floods.

## World and Map

Build the **South Quay** district, roughly 900×900 m with a smaller richly detailed playable footprint (~0.8 km²):

- Tide Market: dense pedestrian plaza, stalls, alleys, tram stop, clothing kiosk.
- Foundry Row: warehouses, loading yards, industrial shortcuts, mission interiors.
- Glassline: newer offices, parking garage, police substation, broad avenues.
- Lantern Hill: steep residences, switchbacks, stair alleys, viewpoint.
- Breakwater: docks, seawall road, container stacks, repair shop.
- Canal Loop: bridges, shallow service channel, bike path, tunnel.

Road hierarchy: arterial loop, collectors, neighborhood streets, alleys, parking lots. Place memorable silhouettes at navigation decision points. Every cell has entrance portals, population zones, traffic lanes, foot nav, cover nodes, audio zones, mission anchors, and fallback HLOD.

Enterable spaces in MVP: safehouse, convenience store, garage, clothing kiosk, police lobby, warehouse mission interior, port control office. Other storefronts use convincing facades; do not imply every building is enterable.

## Missions and Activities

Implement four story missions and three repeatable activities using a data-driven mission graph.

### Story 1: First Shift

Tutorial delivery on motorcycle: navigation, traffic, parking zone, package interaction, optional time bonus. No combat.

### Story 2: Lost Manifest

Investigate a warehouse. Choose quiet side entrance with lock-bypass timing or front conversation. Photograph manifests, avoid/disable cameras, escape security. Introduces stealth and low-tier Alert.

### Story 3: Hot Cargo

Recover a stolen courier van. Track it through witness clues, intercept moving vehicle, force a stop without destroying cargo, drive to garage while rivals pursue. Police react only to observed crimes, independent from scripted rivals.

### Story 4: Signal at the Breakwater

Finale: infiltrate port control, upload evidence, survive a timed counterattack, choose motorcycle or car escape, break a Tier-3 search, reach safehouse. Checkpoints before upload and pursuit; grading rewards civilian safety and optional server-room shutdown.

### Activities

- **Courier Runs:** procedurally paired pickup/drop anchors with fragile/urgent/quiet modifiers.
- **Street Circuit:** three-lap time trial through live traffic with ghost replay and reset penalties.
- **Recovery Calls:** locate reported stolen vehicle within a search area and return it with damage bonus.

Mission graph nodes: start, objective, trigger, dialogue, spawn request, world-state set, branch, fail condition, checkpoint, reward, cleanup. Scripts may request systems but cannot directly teleport arbitrary traffic/police into view.

## Game Modes

- **Story / Free Roam:** one continuous save in which missions and activities coexist with the living district. Abandoning a mission restores reserved actors/world state and returns the player to free roam.
- **Mission Replay:** unlocked missions start from a clean authored loadout/world snapshot, record grade, and return to the main save without duplicating rewards.
- **Street Circuit Time Trial:** seeded traffic category with local/optional verified times and ghost playback; assists are recorded with the result.
- A separate online mode, competitive deathmatch, and co-op are explicitly outside the MVP.

## Physics and Environmental Interaction

- Character capsule, vehicle bodies/raycast wheels, projectile raycasts, doors, breakable glass, movable small props, triggers, water volumes.
- Static collision uses optimized cell meshes with consistent material tags. Render/collision mismatch tests sample roads, curbs, doors, covers, and stairs.
- Traffic collisions use damage impulse and temporary lane obstruction, then tow/despawn recovery out of sight.
- Ragdolls are cosmetic, capped, non-blocking, and toned down for civilians. Use recovery animation for nonfatal knockdowns.
- Props like bins, cones, boxes, gates, and glass react; buildings/large infrastructure are not destructible in MVP.

## Items, Inventory, Economy, and Progression

- Inventory: sidearm, one long gun, melee, two gadgets, armor, medkits, mission items, cash. Weapon wheel pauses local single-player at normal difficulty; optional real-time on hard.
- Pickups: ammo by category, medkit, armor plate, temporary vehicle repair kit, mission keys/data, cash bundles only in authored contexts.
- Cash comes from missions/activities; spending: ammo, medical supplies, repairs, impound fees, clothing, safehouse garage slot. No random loot rarity treadmill.
- Trust level 0–5 unlocks contacts, harder deliveries, vehicle access, and cosmetics. It does not raise health/damage.
- Skills improve by authored milestones: driving focus ability later is out of MVP; instead unlock convenience moves such as faster vehicle entry only if animation/counterplay remains grounded. Avoid stat grind.
- Save records player transform at safe locations, vehicles in owned slots, mission state/checkpoint, cash, Trust, inventory, time/weather, activities, settings. It never saves mid-physics crash.

## UI and UX

- Main menu: Continue, New Game, Load, Settings, Credits.
- HUD: health/armor bottom-left; minimap with GPS route; ammo/gadget bottom-right; cash/Alert contextually; objective text; vehicle speed/condition/fuel omitted in MVP unless meaningful.
- Minimap rotates or stays north by preference. GPS uses road graph and updates after missed turns; it never drives the car automatically.
- Full map/phone: missions, contacts, activities, shops, garage, discovered landmarks, waypoint. Filters and legend required.
- Interaction prompts name action and consequence where important (“Hold E — take vehicle; owner may report”).
- Weapon/item wheel shows ammo and nonlethal/lethal classification.
- Alert UI shows identification state: Unnoticed, Witness Reporting, Identified, Pursuit, Search, Cooling.
- Mission UI: current objective, optional goals, timed progress, checkpoint/fail/retry. Failure explains cause and offers Retry Checkpoint, Abandon, or Free Roam.
- Vehicle HUD: speedometer, gear, condition warning, route cue, wanted indicators; keep compact.
- Settings: preset/dynamic resolution, texture/view/traffic/pedestrian density, shadows/reflections/effects, FOV, camera/aim/steering, keybinds, audio buses/radio, subtitles, reduced motion/flashes, colorblind, driving assists, gore.
- Loading/streaming errors, save recovery, WebGL context loss, low-memory density reduction, missing audio permission, and optional cloud conflict need explicit resolution paths.

## Visual Direction

Use coastal neo-modernism with Art Deco remnants: sun-washed stone, oxidized copper, colored tile, flood barriers, glass offices, hanging gardens, cargo infrastructure, and elevated trams. The afternoon begins warm and clear, moves through long sunset shadows, and reaches a rain-slick neon evening after the finale.

Character clothing combines courier utility, maritime workwear, and stylish local patterns. Vehicles use original proportions and badges; avoid direct replicas. Pedestrians vary body, age, clothing palettes, accessories, gait, and activity while sharing rigs responsibly.

Lighting: baked diffuse/lightmaps and probes per cell, one directional sun/moon, local unshadowed lights, selective hero shadows, screen-space reflections or cubemaps by quality. Wetness changes materials and tire grip subtly. Exposure remains stable entering interiors. UI uses translucent map-paper/glass panels with original typography.

VFX: tire smoke, water spray, sparks, glass, dust, muzzle flashes, impact materials, rain, police lightbars, and damage smoke. Keep emergency flashes photosensitivity-safe with setting and frequency limits.

## Models and Assets

Required: Rowan rig/outfits; modular pedestrians; police/security/rival variants; eight driveable vehicles with interiors/doors/wheels/damage; traffic variants; district modular buildings/roads/props; six enterable interiors; weapons/gadgets; mission props; UI/map/icons; VFX and audio.

Animation sets: on-foot locomotion/aim/fire/reload/melee/hit/death, vault/mantle/ladder/swim, interaction, vehicle enter/exit by seat, drive/steer/shift, motorcycle lean, NPC activities, panic, police arrest, cover combat. Use motion matching only if feasible; a well-tuned blend tree is preferred for MVP.

Use LOD0–3 and HLOD, impostors, shared skeletons, trim sheets, KTX2, mesh compression, lightmap atlases, simplified colliders. Vehicles/characters get dedicated close LOD; distant crowds use animation texture/impostor strategy. Validate scale, pivots, doors/wheels, seats, skeleton, materials, clips, compression, and cell dependency graph.

## Audio

- Layered city ambience by district/time/weather: traffic bed, harbor horns, market chatter, gulls, industry, tram, rain.
- Eight vehicles need RPM/load engine loops, intake/exhaust, transmission, tire surface/slip, suspension, collision, horn, damage, starter, siren where applicable.
- Firearms, melee, gadgets, glass, props, footsteps, clothing, doors, shops, phones, UI, wanted escalation all need original sounds.
- Create two short original radio stations—electronic harbor beat and local indie—with licensed/original instrumental loops, station IDs, and fictional talk snippets. Provide streamer mode to disable music.
- Police dispatch is contextual but imperfect; it reports locations/descriptions only from evidence. Subtitles required.
- Use reverb/occlusion zones, voice concurrency, distance virtualization, and priority for pursuit/combat cues.

## Multiplayer Architecture

Multiplayer is not part of the MVP. Do not burden single-player with always-online authority.

- Client owns the local simulation and save.
- Optional backend owns account/cloud copy, signed leaderboard times, content version manifest, and crash/aggregate telemetry with consent.
- Time-trial leaderboard submissions need a server-issued challenge seed, input/replay hash, build version, and plausibility checks; local unverified times remain visible separately.
- Future online co-op would require a dedicated authoritative redesign for traffic ownership, pedestrians, vehicles, missions, and police. Do not imply a simple peer-to-peer toggle can safely add it.

## Performance Budget

- 60 FPS frame target: ≤8 ms game/AI CPU, ≤11 ms GPU typical; 30 FPS low mode doubles simulation presentation budget but keeps controls stable.
- Nearby: 35–60 rendered pedestrians, 20–35 vehicles, up to 12 combatants, 6 police vehicles. Full AI thinkers capped and dynamically allocated.
- Draw calls <450 typical/<700 peak high; <300 medium. Visible triangles <3.5M high/<1.8M medium/<900k low.
- GPU textures <800 MB high/<450 MB medium; JS/WASM heap <900 MB steady. Low-memory mode <550 MB total target.
- Physics active bodies <120, sleeping/kinematic <350. Ragdolls ≤6. Particles ≤35k high/10k low. Decals ≤200 nearby.
- Navigation/AI average <5 ms/frame across workers/main integration; traffic update tiers by distance.
- Initial shell/menu <10 MB; first safehouse/tutorial cell <70 MB; neighboring cells prefetch; total MVP cache <700 MB. Show optional high-resolution pack and allow cache clearing.
- Cell integration <3 ms/frame p95; never block driving with synchronous decode. Maintain collision/nav safety ring ahead of visuals.
- Audio ≤64 voices with virtualized city emitters.
- Use HLOD, impostors, instancing, occlusion, cell streaming, pooled actors/vehicles/VFX, baked lighting, compressed assets, worker decoding where supported, and semantic far simulation.

## Architecture

- `app-shell`: boot, PWA/cache, capability, menus, recovery.
- `game-session`: fixed clock, pause, time/weather, save checkpoints.
- `world-streaming`: cells, dependencies, HLOD, collision/nav safety rings, population portals.
- `character`: movement, interaction, combat, cover, inventory.
- `vehicles`: physics, input assists, damage, seats, enter/exit, audio.
- `traffic`: lane graph, signals, drivers, spawn/despawn, recovery.
- `pedestrians`: schedules, navigation, activities, perception, reactions, witnesses.
- `police`: crimes/evidence, identification, response dispatch, pursuit/search, arrest.
- `missions`: versioned graph runtime, objectives, checkpoints, cleanup, rewards.
- `renderer`: scenes, actors, LOD/HLOD, lighting, VFX, quality.
- `audio`: city zones, vehicles, radio, dialogue, mix.
- `ui`: HUD, map/phone, shops, inventory, missions, settings.
- `persistence`: IndexedDB journal, migrations, backups, cloud adapter.
- `tools`: cell/road/nav/mission editors, AI/pursuit debugger, vehicle telemetry, benchmark.

Mission scripts communicate through typed commands/events. They may reserve actors/vehicles and set high-level goals but must not fork core vehicle, police, or combat logic.

## MVP

Ship South Quay, Rowan, eight driveable vehicles including motorcycles/police, live traffic/signals, pedestrian population, enter/exit, on-foot movement/combat, eight tools/weapons, five-tier Alert with evidence/pursuit/search/arrest, four missions, three repeatable activities, six enterable interiors, map/GPS/phone, economy/Trust, day-to-night/weather transition, save/load/recovery, settings/accessibility, and a benchmark route.

Defer multiple protagonists, huge city, aircraft/boats, property empire, online multiplayer, complex character customization, destructible buildings, hundreds of interiors, dynamic story generator, radio streaming service, and paid cosmetics.

## Expansion Roadmap

1. Add two adjacent districts through the same cell contract; extend road/traffic/police graphs and activities.
2. Add vehicle customization, taxis/transit, more interiors, side characters, branching missions.
3. Add boats and harbor systems, then a limited aerial vehicle only after streaming/physics profiling.
4. Add photo/replay tools, richer schedules, emergency services, world events.
5. Explore authoritative 2–4 player co-op as a separate technical milestone with dedicated server prototypes.

## Testing and Acceptance Criteria

- [ ] A new user can launch the URL, start New Game, complete the motorcycle delivery tutorial, reach free roam, save, reload, and resume safely.
- [ ] The player can walk/jog/sprint/crouch/jump/vault/mantle/swim, aim/fire/reload/use gadgets, take damage/heal, and recover from death/checkpoint.
- [ ] The player can enter and exit every vehicle type, drive/brake/reverse/handbrake/steer, collide, take damage, stall, repair, and use motorcycles without uncontrolled physics explosions.
- [ ] Traffic obeys lanes/signals/crosswalks, reacts to obstruction/emergency, and recovers from blocked routes without spawning/despawning in direct view.
- [ ] Pedestrians navigate, cross, perform activities, converse, react differently to danger, flee/call police when plausible, and return/despawn without mass path failure.
- [ ] Crimes create evidence only through valid witnesses/cameras/police; Alert escalates, units arrive from valid portals, pursuit becomes search, disguise/vehicle change affects identification, and cooldown returns to Tier 0.
- [ ] The player can be arrested at low threat, pay consequence, and resume; extreme escalation is capped and performant.
- [ ] All four story missions can be started, completed, failed for defined reasons, retried from sensible checkpoints, abandoned, replayed, and cleaned up without corrupting free roam.
- [ ] Courier, circuit, and recovery activities generate valid routes/targets, score correctly, and pay rewards once.
- [ ] Streaming while driving the fastest route never exposes void, missing collision, unlit cells, or a main-thread hitch over the defined threshold.
- [ ] Save migration/recovery restores mission checkpoint, player inventory/cash/Trust, owned vehicle, world time/weather, and settings after interrupted write.
- [ ] Target hardware sustains 60 FPS median/≥50 FPS 1% low on the benchmark route at medium density; low mode remains playable at 30 FPS.
- [ ] Controls, captions, colorblind/reduced motion/photosensitivity, driving assists, and density settings work without hiding gameplay-critical cues.
- [ ] No proprietary city, characters, missions, vehicle brands/designs, UI, audio/music, logos, dialogue, or assets are present.

## Required Delivery Artifacts

Provide source, production PWA build, hosting/deployment guide, world cell/road/nav/mission schemas, district source, vehicle tuning sheets and telemetry, AI state documentation, crime/evidence tests, save schema/migrations/recovery fixtures, asset manifest/licenses, benchmark route/results, browser compatibility matrix, accessibility checklist, known limitations, and a gameplay capture showing free roam, traffic/pedestrians, vehicle theft, police escape, one mission, and saving/reloading.
