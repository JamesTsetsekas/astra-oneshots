# Prompt coverage

Source: `../03-breachline-browser-arcade-fps-prompt.md` in the parent outputs directory. The Astra pass upgrades the unfinished prior implementation without changing its Three.js stack.

| Prompt area | Implemented and source | Remaining / not claimed |
|---|---|---|
| Complete loop | `ui/App.tsx`, `game/runtime.ts`: mission setup, kits, deployment, combat, death, respawn, final result, local XP, requeue | Public queue, regional routing, accounts, moderation |
| 6v6 Team Clash | `game/match.ts`: 75 / 480s, quick 30 / 180s, 60s tie overtime, 3s respawn | Lobby/warmup service, public backfill policy |
| Movement | Acceleration/deceleration, sprint, crouch, jump and low-ledge mantle, shared AABB collision | Rapier capsules, moving doors, full staged mantle animation |
| Weapons | Nine functional archetypes, mags/reserve, semi/auto, geometric elevation and head/body hits, falloff, occlusion, reload, ADS | Limb-specific hitboxes, wall penetration, tactical/empty staged magazine ownership, recoil validation envelope |
| Loadouts | Five slots, optic/barrel, three perks, four equipment variants, three supports | Full three-perk groups, five attachment slots, six utility/support choices, sidegrade unlock ownership |
| Momentum | Recon at 3; Ammo at 5; Interdiction at 8; reset on death; support kills do not extend it | Destructible drones, aircraft telegraph/counterplay, per-team tier-8 concurrency |
| Map | Original three-lane map, two traversable building interiors, low-cover overlook, route signs and sight blockers | Underground tunnel, full catwalk system, breakable glass, baked navmesh and lightmaps |
| Bots | Shared rules, A* paths, reaction/aim variance, visible/audible/last-seen targets, bursts, strafing, equipment | Team blackboard, death heat map, elaborate squad support planner |
| Audio/visual | Three.js WebGL, procedural textured kit, geometry batches, shadows, weapon/limb animation, shot/impact/throw effects, one audio graph | glTF/KTX2 pipeline, authored motion capture, HRTF/convolution zones, announcer/music soundtrack |
| Settings / access | FOV, sensitivity, audio, reduced motion, visible focus, input guidance, clear respawn/pause | Full remapping, render presets, colorblind presets, independent flash/exposure controls |
| Local persistence | Versioned local keys for profile/loadouts/settings, validation, export/reset | IndexedDB migration/checksum recovery and cloud signed profiles |
| Relay | Local Node WebSocket server owns simulation, inputs, score, kits, cadence; 12 seats tested | Binary/delta compression, prediction/reconciliation, lag compensation, reconnect reservations, 150ms/loss certification |
| Services | Architecture/threat notes and local room | PostgreSQL, Redis, signed results, secure public identity, regional fleets |

Do not market this implementation as ranked, cheat-proof, latency-certified, or a full production implementation of every prompt requirement.
