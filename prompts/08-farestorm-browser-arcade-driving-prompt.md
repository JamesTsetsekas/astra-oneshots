# Implementation Prompt: Farestorm — Browser Arcade Taxi Driving Game

You are a senior arcade-driving engineer, vehicle-physics designer, traffic AI engineer, level designer, technical artist, audio designer, and browser performance specialist. Build **Farestorm**, an original browser arcade driving game inspired by the concentrated passenger-pickup, destination-delivery, countdown, shortcut, drift, near-miss, and score-chasing loop of classic taxi games. It must launch from a URL and provide replayable complete shifts—not a car-handling prototype.

Do not copy any existing game's city, drivers, taxis, passenger characters, destination names, exact special-move inputs, announcer phrases, arrow design, soundtrack, licensed music, UI layout, vehicle livery, logos, or level geometry. Use an original city, original taxi designs, original scoring names, and original audiovisual identity. Preserve only genre principles: race the clock, select fares by risk/reward, take aggressive shortcuts, perform expressive arcade maneuvers, deliver accurately, extend the shift, and chase a higher grade.

## Status and Product Contract

- Platform: desktop Chrome, Edge, and Firefox; Safari best effort. Keyboard/mouse and gamepad support.
- MVP: one polished open city, three taxi handling variants, 24 passenger archetypes, 32 destinations, Arcade Shift, Time Trial, and Skill School.
- Core game is client-side and offline-capable after first load. Optional backend stores verified leaderboards and daily seeds.
- Session: 5–12 minutes for Arcade Shift, 2–4 minutes per Time Trial, immediate restart.
- Target: stable 60 FPS at 1080p medium with dense traffic, pedestrians at safe/noncollision zones, particles, and audio.
- Definition of done: choose driver/taxi, start a shift, identify/pick a passenger, follow or outsmart route guidance, deliver before passenger timer, earn fare/time/style bonuses, chain multiple fares, end shift, receive rank, save best score, and retry.

## Game Vision

Farestorm is set in **Galeport**, a steep coastal city of market terraces, tram viaducts, beaches, tunnels, and ferry ramps. The player drives a licensed “storm cab,” picks up vividly readable passengers, and delivers them to destinations while an overall shift clock runs down. Fast, stylish driving builds **Pulse**, multiplying tips and charging a brief **Tailwind** speed burst. Deliveries award extra shift time based on distance and performance, letting skilled players extend a run.

The handling should feel immediately joyful on keyboard but reward mastery. Traffic is an obstacle and opportunity. Shortcuts are deliberately authored: stair streets, parking decks, tram cuts, alleys, beach routes, ferry ramps, and hill drops. Crashes lose speed and break style chains but do not cause realistic injury or vehicle destruction. The tone is exuberant, bright, musical, and nonviolent.

## Inspiration Analysis

Preserve these principles:

- Passenger selection is a route-planning decision. Color/shape/distance class communicates trip length before pickup.
- An overall shift timer creates urgency; delivery rewards can extend play when the player performs well.
- A per-passenger patience timer grades the delivery and creates a second pressure layer.
- The navigation arrow points toward the goal but is intentionally not always the fastest path; map knowledge and shortcuts create mastery.
- Aggressive driving—near misses, drifts, jumps, controlled oncoming traffic, shortcut discovery—generates tips and combo.
- Passengers react to driving, strengthening feedback and personality without long dialogue interruptions.
- Sessions start instantly, score is always legible, and restart is one input away.
- Advanced maneuvers should emerge from a small, teachable input vocabulary, not opaque gear-switch copying.

## Core Gameplay Loop

1. Launch URL; select Arcade Shift, taxi, driver cosmetic, control preset, and traffic difficulty.
2. Spawn at one of three hubs with 60 seconds on the Shift Clock.
3. Follow the passenger radar/markers, decide between short/medium/long fares, pull into a pickup ring, and stop within tolerance.
4. Passenger boards quickly; destination, distance tier, patience meter, route arrow, and par time appear.
5. Accelerate, drift, thread traffic, jump, use shortcuts, and manage Tailwind. Style actions build a chain and multiply tips.
6. Enter the destination arrival zone and stop under the target speed. Fare, time grade, accuracy, style tips, and shift-time bonus are awarded.
7. Immediately choose another nearby passenger. The city repopulates fares based on route distribution and avoids repetitive backtracking.
8. When Shift Clock reaches zero, finish an already-entered destination zone only within a 2-second grace; otherwise the run ends.
9. Show total fare score, deliveries, best chain, route efficiency, collisions, shortcut discoveries, grade, leaderboard eligibility, and replay/restart.
10. Persist best scores, discovered shortcuts, medals, taxi cosmetics, settings, and optional ghost replay.

## Browser Technology

- **Rendering:** Babylon.js with WebGL 2 baseline and optional WebGPU. Use baked lighting, one sun, reflection probes, GPU-instanced traffic/props, LOD/HLOD, particles, and dynamic resolution.
- **Client:** strict TypeScript, fixed 60 Hz vehicle simulation where possible, render interpolation, React menus/results/settings/leaderboards, lightweight in-game HUD.
- **Physics:** Rapier 3D WASM plus custom raycast-wheel arcade vehicle controller. Use simplified static collision and deterministic-enough input replay validation.
- **Traffic:** lane graph with signals, speed profiles, spawn/despawn portals, obstacle avoidance, authored stunt exceptions. Pathfinding and density planning can run in Web Workers.
- **World:** city split into streaming cells, but the road/collision/lane graph around all likely routes is prefetched. At MVP scale, keep a low-detail full-city HLOD always resident.
- **Audio:** Web Audio API with layered engine, tire, collision, city zones, passenger voices, adaptive original music.
- **Assets:** glTF/GLB, meshopt/Draco, KTX2, WebP/AVIF, OGG/Opus, JSON/binary routes/passengers/destinations/score rules.
- **Persistence:** IndexedDB settings/scores/ghosts/unlocks with versioned migrations.
- **Optional leaderboard:** Node.js API with daily seed challenge, signed session nonce, compressed input replay, build/rules version, plausibility verification.
- **Tools:** road/lane/shortcut editor, route-par calculator, passenger distribution simulator, vehicle telemetry/replay, traffic stress test, asset validator, benchmark run.

## Camera

- Default chase camera 6.2 m behind and 2.5 m above taxi, 78° FOV at low speed widening to 96° at high speed.
- Spring arm follows velocity with controlled yaw lag, looks ahead 3–9 m by speed, and sphere-casts against geometry.
- Right stick/mouse free-look ±150°, returning behind after 0.8 seconds. Q/E quick side glance; X look back.
- Camera tilts slightly into drift, lowers near ground at boost, and pulls back on large jumps. All effects capped and reduced-motion compatible.
- Reverse camera eases toward rear view but retains steering readability.
- C cycles near chase, far chase, and bumper camera. Gameplay route arrow remains visible in all modes.
- Crash shake uses short impulses, never sustained random vibration.

## Controls

### Keyboard

- W throttle; S brake/reverse; A/D steer; Space handbrake/drift.
- Shift Tailwind boost when meter has charge.
- E passenger pickup/confirm if not automatic; pickup should normally trigger by stopping in ring.
- Q/E quick side glance unless E is contextual; resolve conflict by using Z/C glances and E interact.
- X look back; R reset after hold in a stuck state with score/time penalty; M map; Esc pause.
- **Surge Start:** tap throttle inside a 220 ms window after releasing brake at low speed.
- **Snap Drift:** steer sharply while tapping handbrake above 35 km/h; maintain with throttle/steer, exit by countersteer.
- **Grip Turn:** tap brake then throttle during a drift to tighten without copying gear-shift sequences from existing games.

### Gamepad

- RT throttle, LT brake/reverse, left stick steer, A handbrake/drift, B Tailwind, right stick look, Y look back, D-pad camera/map.

Offer steering sensitivity, input smoothing, assists, vibration, remapping, and a simplified one-button drift preset. Advanced moves must have visible training feedback and tolerant windows.

## Player Movement and Vehicle Handling

Starting targets, tuned by telemetry:

- Top speed 150–180 km/h by taxi, 0–100 km/h in 5–7 seconds, strong arcade braking.
- Raycast wheels calculate suspension, tire forces, surfaces, and wheel slip. Apply speed-sensitive steering and stability assist.
- Maintain controllability during collisions through bounded angular impulse, anti-roll force, upright recovery torque, and forgiving curb handling.
- Air control is subtle: steering adjusts yaw up to a cap; brake/throttle biases pitch slightly. Landing evaluates alignment/speed for style.
- Handbrake breaks rear grip and increases yaw; drift angle, speed, duration, and proximity determine score. Do not allow stationary drift farming.
- Tailwind consumes meter for up to 2.2 seconds, improves acceleration and modestly raises speed cap. It cannot recharge while active.
- Surfaces: asphalt, wet road, cobble, grass, sand, metal deck, shallow water. Each changes grip, drag, audio, particles, and scoring eligibility.
- Three taxis:
  - **Gull Compact:** agile, easy drift, lower mass/top speed.
  - **Breaker Sedan:** balanced default.
  - **Tempest Wagon:** heavy, stable, stronger traffic shove, slower rotation.
- Cosmetic damage uses dents/scratches/loose panels; it affects score feedback but never ends a run. Severe repeated collisions slightly reduce top acceleration until next delivery reset/repair flash.

## Passenger and Fare System

### Passenger markers

- Short fare: green circle, 20–35 seconds par, lower base fare, clustered in dense city.
- Medium: amber diamond, 35–55 seconds, balanced.
- Long: magenta star, 55–80 seconds, high fare and route risk.
- Special: cyan hexagon, conditional route/challenge unlocked by chain or event.

Marker height, color, icon, and ground ring communicate type. At least five candidate fares remain reachable, with spawn rules that consider player location, recent destinations, district distribution, and city traffic.

### Pickup

- Enter ring below 35 km/h and stop below 5 km/h within 3.5 m. Clean centered stop grants 250 style points; rough stop still boards with a small patience penalty.
- Boarding animation is capped at 1.2 seconds and can overlap route briefing. Shift Clock pauses for at most 1 second during boarding/unloading to preserve pace.

### Delivery

- Passenger patience begins at trip start. Par time varies by graph shortest legal route plus traffic and distance tier.
- Arrival ring accepts entry from multiple directions. Stop below 8 km/h within radius; overshoot remains recoverable.
- Grades: Blazing (≥25% time left), Fast (10–24%), Close (1–9%), Late (0 within 2-second personal grace), Failed after grace.
- Shift-time awards: +3/+2/+1/+0 seconds base by grade plus distance tier bonus of +1/+2/+3, capped to prevent infinite trivial loops.
- Fare score = base distance fare + time bonus + current style tips + accuracy bonus + discovery bonus. Show breakdown for 1.5 seconds without blocking driving.

### Passenger personalities

Implement 24 visual/voice archetypes with preferences: thrill-seeker likes drifts/jumps; fragile-cargo courier dislikes collisions; tourist gives bonus for scenic landmark route; late worker values raw speed; musician builds extra tip from long chains. Preferences modify tips, not the destination timer unfairly. Use short original barks with cooldowns and subtitles.

## Scoring, Pulse, and Advanced Driving

Style events:

- Near Miss: pass traffic within safe proximity at >50 km/h; one score per vehicle per cooldown.
- Drift: continuous based on speed/angle, banked on clean exit.
- Thread the Needle: near-miss two obstacles within 0.7 seconds.
- Airtime/Landing: duration plus alignment; repeated tiny bumps do not score.
- Oncoming: drive correctly against lane direction only on marked road segments and at speed; high risk.
- Shortcut: enter and exit an authored shortcut volume in correct order, with first-discovery bonus.
- Clean Sector: travel 10 seconds at high speed without collision while carrying passenger.
- Precision Stop: centered low-speed destination arrival.

Pulse chain begins on first event, multiplier climbs 1×→2×→3×→5× after increasing thresholds, and decays after 3.5 seconds without a valid event. Collision with traffic/solid prop drops one multiplier tier; hard crash resets it. Repeating the same action yields diminishing charge until another category occurs. Score logic is fixed-step, deterministic, and tested against farming exploits.

Tailwind meter charges from varied style and good deliveries. HUD communicates ready state. Boost itself does not award score, preventing circular farming.

## World and Map

Build **Galeport**, approximately 1.4×1.0 km but designed as a dense looping arcade space:

- Harbor Loop: wide fast boulevard, ferry ramp, containers, seawall jump.
- Old Steps: steep switchbacks, narrow market streets, stair-road shortcut, tram crossing.
- Sunward Beach: sand route, boardwalk, hotel forecourt, drainage tunnel.
- Highline: elevated highway/viaduct, long speed section, risky exits.
- Civic Crown: plaza, museum, stadium, parking garage spiral.
- Lantern Ward: neon alleys, canal bridges, covered arcade.

Required route grammar:

- Three concentric/overlapping loops so a wrong turn rarely dead-ends the run.
- At least 18 authored shortcuts with entrance readability and distinct mastery: alleys, ramps, garage cut, grass terrace, tunnel, construction deck, ferry hold, tram maintenance lane.
- 32 destinations distributed so consecutive fares create varied flows. Destinations have large silhouettes and unique local audio/color.
- Road signage and landmarks support memory. The direction arrow points along a legal route but can be beaten by known shortcuts.
- Barriers prevent leaving playable world without invisible-wall surprises; cliff/water failures respawn rapidly with time/score penalty.

## Game Modes

- **Arcade Shift:** start 60 seconds; deliveries extend time; traffic medium; global/local best score.
- **Quick Shift:** fixed 5 minutes, no time extension, accessible predictable session.
- **Time Trial:** six authored passenger chains with identical traffic seed and medal times.
- **Skill School:** 10 compact lessons: acceleration, braking, Surge Start, drift, tight drift, near miss, jump, shortcut, precision stop, full fare.
- Future: two-player asynchronous ghosts, online head-to-head fare race, stunt challenges. Do not add real-time multiplayer to MVP.

## Traffic and Pedestrian AI

### Traffic

- 35–55 active vehicles near player, HLOD/impostor flows at distance.
- Lane-graph states: cruise, follow, stop signal, turn, change lane, cross, avoid, panic, recover, despawn.
- Traffic follows rules but yields imperfectly; profiles vary speed and gap. It reacts to horn/taxi trajectory and collisions.
- Spawn portals select models/colors/routes, never pop in direct view or inside collision risk. Density scales without changing time-trial seed.
- When struck, vehicles use physics impulse then recover to lane or despawn out of sight. Buses/trucks are heavier but not immovable walls.
- Emergency or set-piece vehicles appear in seeded events; do not create unavoidable blockage.

### Pedestrians

Pedestrians remain primarily on sidewalks, plazas, and pickup/destination animations. Use crossing logic and generous avoidance; the taxi automatically applies a non-scoring safety deflection/brake assist to prevent graphic impacts. A collision risk causes jump-away animation and score/time penalty, not harm. Toggle crowd density independently without changing route collision.

## Physics

- Raycast-wheel taxis and traffic rigid bodies use fixed 60 Hz physics. If frame rate drops, cap catch-up steps and preserve input stability.
- Static collision uses simplified road/building/shortcut meshes with tagged surfaces.
- Continuous collision or swept checks for high-speed taxi against thin barriers.
- Props: cones, boxes, café chairs, barriers, market crates may scatter with capped impulse and pooling. They must not accumulate into route-blocking piles.
- Ramps/jumps use authored takeoff geometry and landing clear zones. Detect stuck/upside-down/void states; offer reset after 1.5 seconds with 3-second and score penalty.
- No vehicle-to-pedestrian ragdoll. No fuel, realistic drivetrain failures, tire punctures, police, combat, or traffic tickets.

## Items, Pickups, and Inventory

There is no conventional inventory or loot. Optional route pickups:

- **Tailwind token:** small boost charge, placed off optimal line so pickup is a choice.
- **Clock spark:** rare +1 second, capped three per shift and placed on risky shortcuts.
- **Repair arch:** removes handling penalty from cosmetic damage but costs route time.

Pickups use deterministic seeded respawns and cannot be farmed by circling; once collected, they do not respawn during that shift. The player's meaningful resources are Shift Clock, passenger patience, Pulse multiplier, and Tailwind charge.

## Progression

- **Within a shift:** score, fare total, delivery count, Pulse, Tailwind, time, shortcut knowledge.
- **Persistent:** driver rank, best scores, medals, discovered shortcuts, taxi cosmetic colors/decals, driver outfits, music tracks, ghost replays. All three taxi handling types unlock through Skill School/early medals, not grind.
- No mechanical upgrades in leaderboard modes. Any assist setting affecting performance marks the run category transparently rather than invalidating casual play.
- Daily seeded route challenge is optional backend content and uses identical taxi/traffic/passenger seed for all verified runs.

## UI and UX

- Main menu: Arcade Shift, Quick Shift, Time Trial, Skill School, Garage, Records, Settings, Credits.
- Taxi select: handling bars plus exact advanced stats, preview, control tutorial.
- HUD: huge readable Shift Clock top-center; passenger patience/destination below; route arrow world/top; fare/score top-left; Pulse multiplier/chain center-left; Tailwind meter bottom-right; speed compact; minimap optional lower corner.
- Passenger candidates have world markers and edge indicators only when off-screen. Avoid marker clutter through distance/priority.
- Route guidance: 3D arrow points toward next road decision or direct bearing depending accessibility setting; minimap route is optional. Expert mode uses destination bearing only and awards no extra score unless explicitly balanced.
- Style callouts stack/aggregate, showing action, points, multiplier, and bank/reset. They never cover road center.
- Delivery overlay shows grade and breakdown briefly while next candidates fade in.
- Pause: resume/restart/abandon/settings; local simulation pauses fully.
- Results: rank S/A/B/C/D, total, fares, tips, time bonuses, deliveries, best chain, collisions, shortcut discoveries, route efficiency, ghost save/upload.
- Settings: preset/dynamic resolution, textures/shadows/reflections/effects/crowd/traffic, camera/FOV/shake, keyboard smoothing/steering, gamepad dead zones/vibration, assists, keybinds, audio buses/music, subtitles, colorblind/reduced motion/photosensitivity.
- Error states: graphics init/context loss, asset retry, save/ghost corruption, leaderboard offline/rejected/version mismatch, gamepad disconnect.

## Visual Direction

Use colorful turn-of-the-century coastal futurism: cream stucco, teal glass, coral trams, yellow-black road paint, lush terraces, cobalt water, neon night alleys, and oversized destination silhouettes. Taxis are bold original shapes with roof turbines and animated fare displays, but no familiar yellow-livery replication.

Lighting is a clear late-afternoon sun progressing slightly toward sunset during long runs without changing visibility. Use baked lightmaps/probes, one directional shadow, reflection probes, contact shadows, wet-look materials only in a later weather mode. Speed lines, boost trails, tire smoke, sparks, dust, confetti-like fare bursts, and passenger reaction animations convey velocity.

UI uses chunky tilted typography, saturated gradients, sticker-like icons, and elastic transitions with a reduced-motion alternative. It must feel energetic but remain readable at speed.

## Models and Assets

Required: three taxis with LODs/interiors/wheel/suspension/damage variants; 20+ traffic vehicle variants through modular materials; 24 passenger archetypes; simplified crowd set; complete city modular kit; 32 destinations; shortcut props/ramps; pickups; signs; UI/icons; VFX.

Taxi animations/rig: wheels, steering, suspension, body roll, doors, driver hands/head, passenger boarding/exit/reactions, loose cosmetic parts. Passenger animation: hail, wait variants, enter by door, seated reactions, cheer/complain, exit. Traffic needs wheel/steer and driver silhouettes.

Use LOD0–3, HLOD/impostors, shared atlases, trim sheets, KTX2, mesh compression, baked lightmaps, simplified colliders. Validate pivots, wheel positions, seats, route clearance, material count, texture budget, and cell dependencies.

## Audio

- Original high-energy soundtrack combining surf percussion, brass stabs, breakbeats, and electronic bass. Compose short loopable tracks with clean transitions; no licensed or soundalike songs.
- Engine audio uses RPM/load layers per taxi; transmission whine, exhaust pops, tire slip by surface, suspension, wind, boost, collisions, horn.
- Passenger archetypes have concise original pickup, navigation, stunt, collision, urgency, arrival, and failure barks with subtitle IDs and cooldowns.
- City zones: harbor, market, beach, tunnel, highway, plaza, tram, crowds. Doppler kept tasteful.
- UI/countdown/Pulse/Tailwind/fare grade/rank cues are musically compatible and instantly distinct.
- Dynamic mix ducks music slightly for urgent passenger/collision cues, not constantly.

## Multiplayer and Leaderboard Architecture

Real-time multiplayer is deferred. Core game is fully client-side.

- Local runs store seed, taxi ID, rules version, assist flags, input frames, periodic physics hashes, result, and ghost transform samples.
- Verified daily challenge begins from server-issued signed seed/nonce and uploads compressed input replay/result. Server/headless verifier checks build version, impossible time/score, action frequency, route order, pickup caps, and periodic tolerances.
- Global leaderboard separates verified daily, local arcade, and assist categories. Never accept raw client score alone.
- Ghost download includes only transform/animation samples and display metadata; sanitize names and cap size.
- Future head-to-head needs authoritative or lockstep-with-referee design; do not market local ghost racing as cheat-proof real-time competition.

## Performance Budget

- 60 FPS: ≤8 ms CPU and ≤11 ms GPU typical. Vehicle physics+traffic <4 ms average.
- 35–55 active traffic vehicles; 40–80 rendered pedestrians/crowd agents with only 12 high-detail thinkers.
- Draw calls <350 typical/<550 high peak; visible triangles <3M high/<1.5M medium/<750k low.
- GPU textures <650 MB high/<350 MB medium; JS/WASM heap <700 MB.
- Active rigid bodies <100; dynamic props <60; particle count <25k high/<8k low; audio voices ≤56.
- Initial shell/menu <8 MB; first hub/car/city ring <60 MB; adjacent route cells prefetch; full MVP cache <450 MB.
- Streaming integration <2.5 ms/frame p95 and never loads collision after the player reaches it. High-speed prefetch uses road graph and velocity.
- Ghost/input recording <2 MB for a 12-minute run compressed.
- Use HLOD, instancing, impostors, baked lighting, pooled traffic/crowds/props/VFX/audio, compressed assets, cell streaming, worker route calculations.

## Architecture

- `app-shell`: boot, PWA/cache, mode routing, recovery.
- `game-session`: fixed clock, mode rules, seed, pause, result.
- `vehicle`: physics, inputs, assists, taxi tuning, collisions, reset.
- `traffic`: lane graph, signals, agents, spawn/despawn, recovery.
- `world`: cells, road/shortcut/destination metadata, streaming, hazards.
- `fares`: passenger candidates, pickup, destination, patience, payout, distribution.
- `score`: style detectors, Pulse, Tailwind, anti-farm, rank.
- `camera-input`: chase/free look, keyboard/gamepad, remapping.
- `renderer`: city, vehicles, crowds, animation, VFX, quality.
- `audio`: engine, city zones, passengers, music, UI mix.
- `ui`: menus, garage, HUD, map, results, records, settings.
- `persistence`: IndexedDB, scores, medals, unlocks, ghosts, migrations.
- `leaderboard-adapter`: challenge tokens, replay upload, verification response.
- `tools`: lane/shortcut/destination editor, route par solver, telemetry/replay, benchmark.

Score rules consume typed physics/gameplay events and do not inspect render transforms. Mode rules, scoring, taxi stats, fares, destinations, and traffic seeds are versioned.

## MVP

Ship Galeport, three taxis, 24 passenger archetypes, 32 destinations, 18 shortcuts, dense traffic/crowds, Arcade/Quick Shift/Time Trial/Skill School, complete score/Pulse/Tailwind/time systems, keyboard/gamepad controls, local records/ghosts, optional verified daily leaderboard, full audiovisual feedback, settings/accessibility, and benchmark.

Defer walking outside taxi, police, combat, vehicle customization beyond cosmetics, online head-to-head, multiple cities, licensed music, narrative campaign, taxi fleet management, and realistic damage/fuel/maintenance.

## Expansion Roadmap

1. Add two taxis, more passenger preferences, stunt challenges, replay camera, route heatmaps.
2. Add rain/night variants with separate verified categories and retuned grip/visibility.
3. Add second district/city connected by bridge/ferry, new destination chains and music.
4. Implement authoritative 2–4 player fare race prototype with shared passenger contention.
5. Seasonal daily challenges, tournaments, spectator ghosts, community route playlists after moderation/security design.

## Testing and Acceptance Criteria

- [ ] A new user can launch, complete Skill School, choose a taxi, start Arcade Shift, pick up/deliver at least one passenger, see time/score award, end, view rank, and restart.
- [ ] All three taxis are controllable by keyboard and gamepad and measurably differ in acceleration, mass, drift, steering, and top speed without one dominating all routes.
- [ ] Surge Start, Snap Drift, Grip Turn, Tailwind, jump/landing, near miss, oncoming, shortcut, clean sector, and precision stop trigger only under specified conditions.
- [ ] Pulse increases through varied skill, decays, loses tiers/resets on collision, and resists stationary/repeated-action farming.
- [ ] Passenger candidates remain available and distributed; pickup/boarding, patience, route guidance, destination stop, grades, fare, tips, shift-time extension, failure, and barks all function.
- [ ] All 32 destinations are reachable by legal road and at least one candidate route; all 18 shortcuts have valid entry/exit, collision, reset safety, and time advantage or tactical purpose.
- [ ] Traffic obeys lanes/signals, avoids obstacles, reacts to the taxi, collides/recoveries, and never deliberately spawns an unavoidable blocker.
- [ ] Pedestrian safety assist/penalty prevents graphic impacts and cannot be exploited for speed/score.
- [ ] Fixed-seed Time Trial produces repeatable passenger chain, traffic events, pickups, par times, and scoring across supported frame rates.
- [ ] A stuck/upside-down/void taxi can reset within 2 seconds with the correct penalty and no save/physics corruption.
- [ ] Local score/ghost persists and replays within positional tolerance; verified leaderboard rejects raw/tampered/incompatible submissions.
- [ ] Target hardware sustains 60 FPS median/≥50 FPS 1% low on the densest benchmark route; streaming exposes no void/missing collision.
- [ ] HUD remains readable at speed and at 100/125/150% scaling; remapping, assists, subtitles, colorblind/reduced-motion/photosensitivity modes work.
- [ ] No proprietary drivers, taxis, city layout, passenger lines, arrow/UI, special-move names/inputs, licensed music, logos, or assets are present.

## Required Delivery Artifacts

Provide source, production PWA build, deployment guide, road/lane/shortcut/destination source data, taxi tuning sheets and telemetry plots, fare/scoring formulas, anti-farm tests, deterministic seed/replay format, leaderboard verifier design, traffic soak tests, performance benchmark route/results, browser/gamepad compatibility matrix, asset licenses, accessibility checklist, and a full Arcade Shift capture ending in results and ghost replay.
