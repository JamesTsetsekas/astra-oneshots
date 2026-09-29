# Browser Game Implementation Prompt Pack

Eight self-contained, implementation-ready prompts are included. Each defines an original game that captures genre-level design strengths without reproducing protected names, characters, maps, art, audio, story, or other proprietary expression.

## Play the Astra builds

The implemented games are separate projects in this folder. Run `node outputs/arcade/serve.mjs` from the workspace to open the local collection at `http://127.0.0.1:4160`. See [the collection guide](GAME-COLLECTION.md) for individual games, startup instructions, verification evidence, and documented scope limits. The original prompt pack below is preserved.

## Prompt Files

1. [Shardfront — Browser Competitive RTS](01-shardfront-browser-rts-prompt.md)
2. [Ashfall Covenant — Browser Action RPG](02-ashfall-covenant-browser-arpg-prompt.md)
3. [Breachline — Browser Arcade Military FPS](03-breachline-browser-arcade-fps-prompt.md)
4. [Last Protocol — Browser Competitive Tactical FPS](04-last-protocol-browser-tactical-fps-prompt.md)
5. [Crownfall — Browser Lane-and-Objective MOBA](05-crownfall-browser-moba-prompt.md)
6. [Skybreak — Browser No-Build Battle Royale](06-skybreak-browser-battle-royale-prompt.md)
7. [Meridian Run — Browser Open-World Urban Action Game](07-meridian-run-browser-open-world-prompt.md)
8. [Farestorm — Browser Arcade Taxi Driving Game](08-farestorm-browser-arcade-driving-prompt.md)

## Recommended Use

Give one prompt at a time to a capable coding agent. Tell it to treat the document as the source-of-truth product and technical contract, to preserve the stated MVP boundary, and to surface any proposed divergence before implementation. A strong delivery sequence is:

1. Scaffold the repository, content schemas, fixed-step simulation, automated tests, and benchmark scene.
2. Build one ugly-but-complete gameplay loop with debug assets.
3. Validate authority boundaries, save/network recovery, and performance budgets before expanding content.
4. Replace debug assets with original optimized production assets and complete audiovisual feedback.
5. Run every acceptance criterion and publish a traceable pass/fail checklist with captures and benchmark data.

Do not ask an implementation agent to build all eight games in one repository or one pass. Each prompt is intentionally a substantial standalone project.

## Research Synthesis

The briefs were derived from mechanics and design principles rather than copied content:

- The RTS brief emphasizes resource saturation, continuous worker production, expansion pressure, scouting, control groups, kiting, attack-move behavior, and spending resources—principles documented in Blizzard's official [StarCraft II resource guide](https://news.blizzard.com/en-us/article/4488900/game-guide-resources), [economy guide](https://news.blizzard.com/en-us/article/4488313/game-guide-economy), and [unit-control guide](https://news.blizzard.com/en-us/article/4552957/game-guide-unit-control).
- The ARPG brief emphasizes class builds, strengths/weaknesses, loot quality, replayable difficulty, risk/reward zones, waypoints, recipes, and target farming, informed by Blizzard's [Diablo II: Resurrected class guide](https://news.blizzard.com/en-us/article/23719810/diablo-ii-resurrected-class-guide-showcase-ft-dbrunski125), [offline difficulty notes](https://news.blizzard.com/en-gb/article/23746020/diablo-ii-resurrected-patch-2-3-highlights-coming-soon), and [ladder/recipe notes](https://news.blizzard.com/en-gb/article/23788293/diablo-ii-resurrected-patch-2-4-ladder-now-live).
- The arcade military FPS brief abstracts quick multiplayer matches, custom loadouts, perks, progression, and selectable streak rewards. The 2009 manual describes multiplayer maps/modes and unlocking weapons, attachments, and perks; see the [Modern Warfare 2 manual](https://cdn.akamai.steamstatic.com/steam/apps/10180/manuals/CODMW2_Manual.pdf?t=1436565389). Activision's later official [multiplayer basics](https://blog.activision.com/call-of-duty/2019-10/Getting-Started-in-Modern-Warfare-Multiplayer) and [loadout guide](https://blog.activision.com/call-of-duty/2019-10/The-Basics-of-Call-of-Duty-Modern-Warfare-Loadouts) corroborate the durable design language of primary/secondary weapons, perks, equipment, fast modes, and streak rewards.
- The tactical FPS brief derives from round-based objective play and an inter-round economy. Valve's official [CS:GO overview](https://blog.counter-strike.net/about/) describes objective rounds, purchasing armor/weapons/kits, and economy management; the official [Counter-Strike 2 overview](https://www.counter-strike.net/cs2) highlights responsive input timing, dynamic smoke, updated lighting, particles, and competitive rating.
- The MOBA brief preserves lane clearing, team fights, roles, structures, minions, objectives, items, gold, XP, and base destruction. Riot's official [League of Legends homepage](https://www.leagueoflegends.com/en-us/) characterizes the game as a 5v5 MOBA centered on lane clearing, team fights, and destroying the enemy base, while Riot's [jungle design discussion](https://www.leagueoflegends.com/en-us/news/dev/lol-pls-preseason-2023-jungle-changes/) explains the strategic distinction between laning and jungle play.
- The no-build Battle Royale brief uses the genre loop of lobby, aerial drop, looting, chests, limited inventory, storm contraction, no respawn, and last survivor. Epic's original [Battle Royale flow notes](https://www.fortnite.com/news/patch-v-1-6-fortnite-battle-royale) explicitly describe choosing a drop, finding weapons/ammo/chests, staying inside the shrinking storm, five carried slots, and last-player-standing victory. Epic's [Zero Build overview](https://www.fortnite.com/news/fortnite-zero-build-take-the-offensive-in-this-no-build-battle-royale) highlights no-build traversal and a recharging overshield; the prompt translates those ideas into original mechanics and content.
- The open-world brief abstracts free exploration, missions, driving, shooting, cover, living streets, and law response. The [Grand Theft Auto V overview](https://en.wikipedia.org/wiki/Grand_Theft_Auto_V) documents the open-world/action structure and revised driving/shooting focus, while Rockstar's [Race Creator guide](https://media.rockstargames.com/rockstargames/img/global/news/upload/GTAO_Race_Creator_Guide.pdf) confirms traffic and wanted-level interactions as configurable gameplay ingredients. The implementation prompt replaces the reference setting and expression with an original, tightly scoped city district.
- The taxi brief is grounded in the original manual's concentrated arcade contract: race the clock, pick up customers, follow a directional cue, deliver within a time limit, perform advanced driving moves, and earn extra fare. See Sega's [Crazy Taxi PC manual](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/71230/manuals/DC_CT_PC_MG_EFIGS_FINAL_lr.pdf?t=1733765150). Farestorm uses different maneuver inputs, scoring terminology, city, characters, UI, vehicles, and music.

## Browser Architecture Research

The stack choices are intentionally not identical across all genres. The RTS and MOBA use a thin Three.js renderer around their custom data-oriented 2.5D simulations; Three's official docs describe both the maintained [WebGL 2 renderer](https://threejs.org/docs/pages/WebGLRenderer.html) and the newer [WebGPU renderer with WebGL 2 fallback](https://threejs.org/manual/pages/webgpurenderer). The more animation-, physics-, and world-tooling-heavy games select Babylon.js because its official feature set includes WebGL/WebGPU and web physics support; see [Babylon.js specifications](https://www.babylonjs.com/specifications/) and its [WebGPU support documentation](https://github.com/BabylonJS/Documentation/blob/master/content/setup/support/webGPU.md). WebGL 2 remains the minimum contract, with WebGPU used only after capability and parity checks.

For physics-heavy projects, Rapier's JavaScript bindings are a WebAssembly module and therefore fit a worker-aware asynchronous browser boot pipeline; see the official [Rapier JavaScript getting-started guide](https://rapier.rs/docs/user_guides/templates/getting_started_js/). Multiplayer prompts specify authoritative rooms, matchmaking, state deltas, prediction, reconciliation, and lag compensation because those capabilities are central to a browser multiplayer architecture; see the official [Colyseus documentation](https://docs.colyseus.io/), [server/netcode overview](https://docs.colyseus.io/server), and [netcode guide](https://docs.colyseus.io/netcode).

## Shared Design Decisions

- WebGL 2 is the minimum renderer contract; WebGPU is an enhancement, not a hard dependency.
- Menus and complex panels may use React, but per-frame simulation and rendering state must not live in React.
- Multiplayer combat truth is server authoritative. Clients send input/commands, predict only safe local state, and never decide damage, inventory ownership, score, economy, or victory.
- Single-player games remain playable without an always-online backend. Cloud saves and verified leaderboards are optional adapters.
- All content and rules are data-driven, schema-validated, versioned, and recorded with saves/replays/matches.
- Assets use browser-friendly compression and progressive loading. Every prompt defines practical draw-call, geometry, texture, memory, particle, audio, network, and streaming budgets.
- Every MVP is a polished vertical slice with a complete loop. Deferred features are hidden rather than represented by unusable buttons.
- Accessibility, recovery states, context loss, low-memory behavior, input remapping, and browser scaling are part of acceptance—not post-launch polish.

## IP and Content Boundary

These prompts use references only to identify broad gameplay patterns. All titles, worlds, factions, heroes, units, enemies, weapons, vehicles, missions, maps, UI treatments, sounds, music, dialogue, art direction, balance, and assets specified in the pack are original starting points. Any production team should still perform its own trademark search, visual-similarity review, audio provenance audit, and asset-license audit before public release.
