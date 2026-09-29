# Breachline — Astra rebuild

Original, playable 6v6 arcade FPS at Relay Station K-17. This build is a complete **local Practice game** plus a **self-hosted authoritative room**, not a public competitive service.

## Run

```powershell
npm install
npm run dev
```

Open http://127.0.0.1:4176. Choose Deploy / Practice, select full Team Clash (75 points / 8 minutes) or Quick Skirmish (30 / 3), then click Deploy to capture the mouse.

For the local relay, run `npm run server` in another terminal. Vite proxies `/relay` to port **4196**. After `npm run build`, the same server serves the production build at http://127.0.0.1:4196. It binds only to loopback. No external deployment or public matchmaking has been configured.

## Controls

WASD move; mouse aim; left click fire; right click ADS; Shift sprint; Ctrl/C crouch; Space jump/mantle low crates; R reload; 1/2 weapons; wheel swap; Q tactical; G charge; F melee; 4 highest ready support; Tab scoreboard; Esc pause/release mouse. Practice freezes when paused; relay matches continue with neutral local input.

## What's rebuilt

- Correct camera/aim/movement coordinate agreement; authoritative vertical head/body hits, cover occlusion, semi-auto triggers, ammo, reload, regen, assists, score and respawn.
- Collision-aware A* paths with corner-safe smoothing. Bots use visible targets, last-seen positions, audible unsuppressed shots, reaction delays, bursts and reloads; they no longer run indefinitely into solid buildings.
- Three linked lanes through accessible Operations and Maintenance interiors, authored low-cover mantle route, exact shared ballistic geometry and overhead dish.
- Batched, detailed procedural environment and nine original weapon variants; animated arms, ADS, sprint, reload, recoil, actors, tracers, impacts, charges, shadows, material textures and coastal horizon.
- Original reusable synthesized audio graph, with distance attenuation, stereo direction and bounded voices.
- Five editable kits, three perks, four equipment choices, three Momentum actions, difficulty settings, full/quick modes, death kit selection, pause/recovery, match results, local profile/XP, export/reset and replayable deterministic simulation seeds.

## Validation

```powershell
npm test
npm run build
npm run benchmark
# With npm run server already running:
npm run test:relay
```

See [verification](docs/VERIFICATION.md), [prompt coverage and limits](docs/PROMPT-COVERAGE.md), [architecture / threat model](docs/ARCHITECTURE.md), and [asset licenses](docs/ASSETS.md).

The original prompt also specifies a production multiplayer fleet, prediction/rewind, nine perks, six equipment items, six support choices, advanced animation/physics pipelines and broader browser/network certification. Those are **not claimed by this build**; the coverage document lists the remaining work explicitly.
