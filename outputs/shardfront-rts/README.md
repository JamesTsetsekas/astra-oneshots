# Shardfront — Astra rebuild

A local original-IP 3D RTS across Glass Ravine. This pass rebuilds the battlefield and faction models, adds physical navigation, fixes command/fog defects, and introduces resumable matches and deterministic command replays. This is a playable vertical slice, not a claim that every production-scale target in the source prompt is complete.

## Run

```sh
npm install
npm run dev
```

Open http://127.0.0.1:4173. Production validation and hosting:

```sh
npm test
npm run build
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort
```

The dist directory is static output. No account, backend, API key or online service is needed.

## Controls and loop

- Left click/drag selects; right click moves, gathers, attacks a visible enemy or sets a production rally point. Shift appends movement waypoints.
- A then click: attack-move. S: stop. H: hold. Q: ability/stance. B: construction for workers or line-unit production for a selected production building.
- Production hotkeys appear on buttons. R: rally. F: focus selection. Home: starting base.
- Ctrl+1–9 assigns groups, number recalls, double-tap centers. Wheel zooms, middle-drag/arrows pan. WASD pans with empty selection or Alt held. Optional edge scrolling works.
- Esc cancels a command or pauses. Save expedition stores one checkpoint; Continue saved expedition restores it. Finished matches offer Watch last replay, with 1×/2×/4× playback.

Workers begin harvesting Prism. Build supply and production, then a Flux extractor on a purple vent; assign workers to it to fund specialists/tech. Field a mixed army, capture Watch Pylons by remaining nearby for three seconds, and destroy enemy command cores. Field Orientation has nine action-validated objectives.

## Astra changes

- Original walkers, vehicles, organic shells and faction architecture; articulated motion, actual 3D menu showcases, visible cargo, readable health/selection, spatial weapon noises and ambient score.
- Textured mineral ground, bridge lanes, physical basalt ridges/building footprints, cached bounded A*, formation slots and collision recovery.
- Real queued movement, production hotkeys, working edge scroll, placement feedback, order decals, hidden-tab pause and graphics-recovery messages.
- Fixed AI scouting: old code counted observing its own headquarters as discovering the player's base. Hidden enemy production alerts and invisible-object picking are also corrected.
- Chorus melee line units, Carapace Guard, regeneration and rooting; non-attacking healers/Chorus scouts; Helix ranged formations/repair.
- Versioned IndexedDB saves and command replays with corruption checks. Existing settings and match history are preserved.

See [verification](docs/VERIFICATION.md), [architecture](docs/ARCHITECTURE.md), and [assets](docs/ASSETS.md).

## Known limitations

- Local AI only; no online lobby, authoritative server, matchmaking or anti-cheat claim.
- WebGL 2 only. No WebGPU, compressed glTF pipeline, authored texture atlases or explicit model LODs.
- A* runs synchronously and caches per unit; not a worker/flow-field system. The 220-unit 60 FPS / 400-unit stress targets are not certified.
- No destructible barriers, brush/high-ground visibility, salvage pods or expansion-oriented AI.
- Instant simulation damage with decorative tracers; not deterministic projectile travel. Abilities share simplified stance/repair/sweep/restoration patterns rather than implementing every bespoke prompt ability. Two upgrade tiers.
- Documented but non-remappable controls. One manual local checkpoint, latest completed replay only, build-specific replay compatibility. No cloud progression, cosmetics mastery or match graphs.
- Matches can be shorter than the prompt's 12–20 minute target; Easy still punishes an undefended base. More human balance testing is needed.
- Chromium was verified on this host; Firefox/Safari and 125%/150% browser scaling are unverified. Video export was unavailable; screenshots and reproducible tests are provided.
