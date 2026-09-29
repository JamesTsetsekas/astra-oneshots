# Astra game collection

Eight separate, original browser-game projects from the prompt pack. Shardfront and Ashfall Covenant were remade, Breachline was rebuilt, four further games were created, and the approved Farestorm build was preserved. These are local, playable vertical slices with complete genre-specific loops—not eight commercial-scale releases or fully hosted multiplayer services. Each project documents its remaining prompt-scope gaps.

## Play all eight

From the workspace root:

```powershell
node outputs/arcade/serve.mjs
```

Open [the local collection](http://127.0.0.1:4160). Keep the terminal running. Each Play link opens a separate game. Desktop keyboard/mouse and a WebGL2-capable browser are the verified target. Ports and browser storage are separate so one game's assets, offline cache, and saves do not overwrite another's.

The launcher serves the existing production `dist` folders. On a fresh Git clone, run `npm run setup` from the repository root first; dependencies and build output are not committed. The launcher does not silently rebuild projects or require a public account. It binds to `127.0.0.1` only. It preserves already-running servers and stops only the servers it starts when you press Ctrl+C. If an unrelated process occupies one of the listed ports, stop that process yourself or use the relevant game's README to choose another port.

| Game | Play | Source and notes | Verification |
| --- | --- | --- | --- |
| Shardfront | [4173](http://127.0.0.1:4173) | [RTS remake](shardfront-rts/README.md) | [18 tests, build, construction/production/save and completed match replay](shardfront-rts/docs/VERIFICATION.md) |
| Ashfall Covenant | [4174](http://127.0.0.1:4174) | [Action-RPG remake](ashfall-covenant-arpg/README.md) | [15 tests, build, browser boss victory and Veteran Hunt](ashfall-covenant-arpg/docs/ASTRA-VERIFICATION.md) |
| Breachline | [4176](http://127.0.0.1:4176) | [Arcade-FPS rebuild](breachline-fps/README.md) | [27 tests, build, complete 75-point browser match and 12-client local relay](breachline-fps/docs/VERIFICATION.md) |
| Last Protocol | [4177](http://127.0.0.1:4177) | [Tactical FPS](last-protocol-fps/README.md) | [38 tests, build, full ten-round browser match with purchases, plants and disarm](last-protocol-fps/docs/VERIFICATION.md) |
| Crownfall | [4178](http://127.0.0.1:4178) | [Lane-and-objective battle arena](crownfall-moba/README.md) | [17 tests, build, browser victory and exact input replay](crownfall-moba/docs/VERIFICATION.md) |
| Skybreak | [4179](http://127.0.0.1:4179) | [No-build battle royale](skybreak-br/README.md) | [17 tests, build, input-driven combat and complete production Solo match](skybreak-br/docs/VERIFICATION.md) |
| Meridian Run | [4187](http://127.0.0.1:4187) | [Open-world courier adventure](meridian-run/README.md) | [18 tests, build, browser delivery, four-case simulation and offline gameplay](meridian-run/docs/VERIFICATION.md) |
| Farestorm | [4180](http://127.0.0.1:4180) | [Approved arcade-driving game](farestorm/README.md) | [30 tests, build, complete Arcade run and offline verification](farestorm/docs/verification.md) |

## Local and network scope

All eight can be played locally without an account. Competitive genres use bots for the verified local loop. Breachline additionally includes an optional authoritative local WebSocket room; the collection launcher starts its combined static/relay server on port 4176 when that port is free. The launcher verifies `/health`, and `node outputs/arcade/verify.mjs` checks its WebSocket greeting. An existing static-only server can still run the bot game but is not advertised as a verified relay.

There is no public matchmaking, ranked service, deployed fleet, or online-player population implied by the games' interfaces. The larger networking and content requirements in the original prompts are explicitly deferred in the project notes. Publishing this source repository to GitHub does not deploy a hosted game service.

## Source, rebuilds, and checks

Each game has its own package.json, lockfile, tests, source, build output, and README. For example:

```powershell
npm --prefix outputs/meridian-run test
npm --prefix outputs/meridian-run run build
```

Dependencies are already installed on the original build machine. On a fresh clone, `npm run setup` installs each project's locked dependencies and builds all eight games. Keep development dependencies installed for Breachline's TypeScript local relay (`tsx`). The static games need only their generated `dist` folders and a local web server at runtime. Use Node.js 22.x (22.12+) or 24+ for the locked development tools, collection launcher, and built-in WebSocket verifier.

With the launcher running:

```powershell
node outputs/arcade/verify.mjs
```

This checks eight production pages, entry assets and MIME types, real gameplay captures, separate ports, malformed-URL handling, path confinement, and Breachline relay availability. Browser verification is separate: screenshots and flow-by-flow notes live in each game folder. Automated precise aiming/command drivers are identified as such; test results are not represented as manual human play or cross-hardware performance certification.

## What to expect

Each game has its own visual treatment, controls, playable loop, results or progression, and honest scope notes. The visuals are stylized original procedural models and, where documented, generated title art. Browser prompts for pointer lock/audio are expected in the FPS games. Esc pauses or releases the pointer. The in-game help explains the relevant controls.

Farestorm and Meridian Run have specifically verified production offline play after their initial download. Do not assume every title is offline-installable. Saves and settings are browser-local; exporting a save/replay where provided is preferable before clearing site storage. Safari/Firefox, mobile-only controls, physical gamepads, public multiplayer, and low-end hardware are not comprehensively certified.

The original eight prompt documents and their research links remain in [the prompt index](README.md).
