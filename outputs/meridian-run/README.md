# Meridian Run — A South Quay Story

An original, local single-player open-world vertical slice. Play Rowan Vey, a courier in a sunlit coastal district whose delivery route becomes an investigation into a stolen port contract.

## Play

From this folder:

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:4187`. The collection launcher at `../arcade` can serve this production build alongside the other seven games.

```powershell
npm test
npm run build
npm run preview
npx tsx tools/verify-story.ts
```

Use a desktop browser with WebGL enabled. There is no account, analytics, server-side save, or external runtime service. The production service worker caches the game and its dependency graph for subsequent offline launches after the initial download completes.

## The playable slice

- A 900 × 900 metre district with a graded northern hill, harbor, art-deco storefronts, glass towers, market, alleys, and seven furnished enterable locations. Interior doors, walls, collision, sight tests, and navigation use shared metadata.
- On-foot third-person movement, sprint stamina, crouching, jumping and low-step traversal. Collision-tested orbit/shoulder camera and animated original character rigs.
- Eight driveable vehicle definitions, including two modeled motorcycles, a delivery van, compact, coupe, sedans, and a Civic Safety interceptor. Rapier rigid chassis, four suspension probes, arcade tire grip, steering assistance, reverse, handbrake, condition, collision damage, and repair.
- Four sequenced story cases: First Shift, Lost Manifest, Hot Cargo, and Signal at the Breakwater. Repeatable courier, three-lap street circuit, and vehicle recovery activities. Case replay never duplicates story payouts.
- Seven weapon profiles; ammunition, reloads, aim, melee, armor, medical kits, and a smoke gadget. The starting stun projector is nonlethal. Civilians cannot be attacked for cash or score.
- Pedestrian reactions, delayed witness reports, camera evidence, five alert segments, responding officers and a pursuing patrol car, last-known-position searches, cooling, and a low-tier compliance/fine outcome.
- A job phone, district map and route, supplies shop, repair interaction, cash, neighborhood trust, grades and results, failure/restart, settings, and pause.
- Versioned IndexedDB checkpoint plus verified backup, checksum validation, import/export, mission-transition and 45-second autosave. Loading returns Rowan to the courier office while preserving case stage, equipment, cash, progress, active-vehicle condition and wanted evidence. This is a checkpoint system, not an exact whole-city rewind.
- Original Web Audio score, engine loop, action sounds and wanted cues. Local Barlow typography and original procedural 3D assets.

## Controls

| Action | Input |
| --- | --- |
| Walk / vehicle throttle & steer | WASD or arrows |
| Sprint / crouch | Shift / Ctrl or C |
| Jump / vehicle handbrake | Space |
| Interact / enter stopped vehicle | E |
| Exit slowly moving vehicle | F |
| Ready / holster equipment | Q |
| Aim and rotate camera | Hold right mouse and drag |
| Fire / reload / melee | Left mouse / R / V |
| Smoke / medical kit | G / H |
| Phone / map / pause / help | Tab / M / Escape / K |

Basic gamepad axes and buttons are wired, but physical-controller behavior has not been verified. Keyboard and mouse are the supported, verified controls.

Visit **Night Shift Supplies** on Lantern Street for weapons, ammo, armor, and medical kits. Weapons replace the equipped profile; reload afterward. At **Mara’s Motor Works**, E repairs a nearby vehicle for $90. Clothing identification reduction requires first breaking police sight.

## Scope and limits

This is a compact, stylized implementation of the prompt’s central loop, not a claim of a commercial-scale open-world game. It uses original procedural low-poly geometry and articulated rigs rather than a complete glTF/PBR animation and motion-capture pipeline. Buildings have detailed façades; the seven interiors are deliberately compact. Most small decorative furniture is visual rather than individually simulated.

Traffic follows a bounded lane/traffic-light simulation rather than a general city-driving planner. Pedestrians have lightweight routines; dialogue is captioned. Enemy search uses last-seen positions and road/doorway routing, not a full tactical navmesh or general cover planner. One patrol vehicle responds alongside foot officers; this is not a citywide dispatch fleet. The shotgun uses a close-range weapon profile rather than a multi-pellet ballistic simulation. There is no destructible city, full daily citizen schedule, voiced cinematics, clothing wardrobe UI, swimming, online mode, or full controller remapping. The 45-minute clock subtly shifts light intensity; it is not a complete weather/day-night system.

Build and test evidence, browser scope, and remaining validation limits are in `docs/VERIFICATION.md`. Asset provenance and module boundaries are in `docs/ASSETS.md` and `docs/ARCHITECTURE.md`.
