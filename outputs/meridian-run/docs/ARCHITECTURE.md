# Module boundaries

`src/game/world.ts` is the shared spatial source: roads, terrain height, buildings, districts, interior wall rectangles and open doorways. Physics, render geometry, minimap, ray occlusion and routes consume this metadata. Thin walls use segment/AABB tests, not coarse sampling that can skip walls.

`src/game/content.ts` owns original vehicle, equipment, contact and mission definitions. Story prerequisites, stage conditions, rewards, replay exclusions and activity sequences are data-driven.

`src/game/session.ts` is the authoritative local simulation. It consumes input frames in bounded 60 Hz fixed steps, applies character/vehicle control, NPC reactions, evidence and police updates, ammunition and ray combat, mission transitions and cash/progression. Result/failure states freeze simulation. The UI cannot award money or advance objectives directly.

`src/game/vehicle.ts` owns the Rapier world, swept dynamic chassis, kinematic traffic obstacles, suspension probes and tire forces. The on-foot capsule uses Rapier’s kinematic character controller. Entering a different vehicle rebuilds the physics world from shared static metadata and carries its persistent condition separately.

`src/game/runtime.ts` maps keyboard, mouse and basic gamepad input, handles pause/focus, advances the simulation, renders each frame, and publishes a read model to React at approximately 10 Hz. Its development-only bridge is read-only; production bundles omit it. Short interaction keypresses are latched long enough to survive frame boundaries.

`src/render/` builds original coachwork, motorcycles, character rigs, interior props, batched architecture, sun/sky, markers, view camera and bounded shot effects. Distant actors and vehicles are disabled by range. Directional shadows use a player-centered local volume rather than mapping the entire district into one low-resolution shadow texture.

`src/game/storage.ts` serializes a detached versioned checkpoint into an envelope, validates its checksum and key numeric invariants, retains a previously verified backup, and uses IndexedDB. No imported save is executable code. Storage failure is surfaced without blocking local play.

`src/game/audio.ts` synthesizes all audio after an explicit user gesture and caps concurrent voices. Pausing suspends the audio context; new shifts reset event cursors.

`src/main.tsx` and `src/style.css` provide title, HUD, map, contacts/jobs, supplies, controls, pause, settings and results. The map uses the same coordinates as the 3D city. Imports return to title and paused autosaves do not overwrite an imported checkpoint.

The production service worker follows same-origin Vite asset references, including dynamic engine shader chunks and CSS fonts, before activation. Each collection game runs on its own origin/port, so root-relative assets, service workers and saves remain isolated.
