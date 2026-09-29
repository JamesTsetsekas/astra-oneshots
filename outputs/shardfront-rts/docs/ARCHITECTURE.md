# Architecture and command protocol

- `simulation.ts`: fixed 20 Hz clock, seeded randomness, validated commands, economy, AI, combat, visibility, results and serialization. Rendering never decides damage/resources.
- `data.ts` / `types.ts`: balance tables, prerequisite data, entity and command schemas.
- `world.ts`: shared ridge/blocker metadata and bounded eight-neighbor A*. Diagonal corner cutting is rejected; target/topology/timeouts invalidate route caches.
- `art.ts`: original procedural models/terrain; static geometry merged by material, articulated parts retained separately.
- `runtime.ts`: rendering, camera, input, control groups, minimap/fog, visual/audio effects, settings and lifecycle. UI snapshots are throttled.
- `storage.ts`: IndexedDB `shardfront-astra/records`, versioned JSON, FNV-1a integrity checks, fallback storage. A checksum detects corruption; it is not authentication.
- `ui`: menus, data-driven command cards, pause/save/replay, settings and results. Transient per-frame data stays outside React.

Recorded command: `{tick, kind, selected, args}`. Kinds are move, target, gather, stop, hold, ability, rally, build, train, research, cancel and group. Handlers validate selected ownership, visibility, affordability, supply, prerequisites and placement. Replay starts from GameOptions/seed and replays the recorded stream at deterministic ticks while AI runs normally.

Save v2 also captures entities, navigation, nodes, pylons, timers, RNG, economy, events and AI memory. Restore rejects incompatible versions, invalid coordinates and unknown entity types. State hashes cover positions/health/orders/queues, resources, economy, pylons and outcome. Cross-build deterministic compatibility is not promised.

Future online play must move authority into a trusted match process, authenticate seats, schema-validate/rate-limit commands, reject ownership/visibility violations and fog-filter snapshots before transmission. This local build does not implement or pretend to connect to that infrastructure.
