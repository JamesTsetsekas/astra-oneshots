# Last Protocol — Aperture Annex

A complete **local 5v5 tactical Practice game**: one player, nine bots, twelve fictional weapons, buy economy, two Cipher vaults, one life per round, spectating, halftime, results and browser-local history. No account or network service is required.

This is not a hosted competitive product. Public matchmaking, ten-human authoritative rooms, ranking, reconnect and rewind netcode are not implemented or simulated with fake UI. See [prompt coverage](docs/PROMPT-COVERAGE.md) for precise boundaries.

## Play

```powershell
npm install
npm run dev
```

Open http://127.0.0.1:4177. Choose **Enter Protocol**, a format, then **Deploy to Annex**. Click **Deploy** to capture the mouse. Escape pauses the local match; click Resume to capture again. Requires desktop keyboard/mouse, WebGL and pointer lock.

The collection launcher can serve `dist` directly. No backend, remote assets, API keys or runtime CDN dependencies.

```powershell
npm test
npm run benchmark
npm run build
```

## Controls

| Action                                     | Control                      |
| ------------------------------------------ | ---------------------------- |
| Move / aim                                 | WASD / mouse                 |
| Fire / precision scope                     | Left / right mouse           |
| Walk / crouch / jump                       | Shift / Ctrl or C / Space    |
| Reload / switch / slots                    | R / Q or mouse wheel / 1–2   |
| Arm, disarm, recover Spike or weapon       | Hold E                       |
| Drop Spike, otherwise equipped primary     | G                            |
| Veil / flash / thermite / pulse / fragment | 4 / 5 / 6 / 7 / 8            |
| Buy / scoreboard / tactical map            | B / hold Tab / hold M        |
| Pause / resume                             | Escape / click Resume        |
| Spectate next living teammate              | Left mouse after elimination |

Ordinary rifles do not zoom. Stop before shooting: movement and airborne shots widen spread. Lumen fires three rounds per trigger pull. Drop a primary from the buy menu to make room for a replacement; dropping invalidates earlier refunds. Both weapons keep independent magazines and reserves. Surviving gear carries between rounds; ammunition refills for the new round.

## Rules

- **Full Protocol:** first to 9 with two-round lead, side swap after 8, cap20 (10–10 deadlock possible). Buy20s, action105s, armed35s.
- **Rapid Practice:** first to5 with two-round lead, swap after4, cap10. Buy8s, action60s, armed25s.
- Arm inside either pink vault boundary for3.2 uninterrupted seconds. Disarm in8s or5s with a $400 Custodian kit. Killing all attackers after arming does not stop the clock.
- Start $800, cap $12,000. Win +$3,000; loss support $1,900–$3,100. Arm +$300 personally plus $600 per attacker at round end; disarm and kill +$300. Timer-losing surviving attackers get reduced support.
- No health regeneration, respawn, revive or friendly damage. Four utility items maximum, two flashes or one of each other type.
- Losing mouse capture pauses local play except while the buy menu is open. If buying expires with the menu open, click Resume to begin action.

## Implementation

React/TypeScript menus; Three.js renderer; original procedural map, models, textures and synthesized audio; pure fixed-step64Hz match simulation. The menu illustration is original generated artwork, not a gameplay screenshot.

See [architecture](docs/ARCHITECTURE.md), [verification](docs/VERIFICATION.md), [assets](docs/ASSETS.md) and [coverage](docs/PROMPT-COVERAGE.md). Settings and the most recent30 results are stored only in this browser. No analytics or personal-data upload occurs.
