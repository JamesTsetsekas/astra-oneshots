# Architecture and local relay security

`data.ts` holds immutable original weapon/kit/cover tables. `navigation.ts` derives blocked cells, A* routes and exact ray/AABB slabs from those same cover dimensions. `match.ts` owns seeded mutable match state and imports no renderer/DOM package. `simulation.ts` is the stable re-export boundary. `renderer.ts` consumes snapshots; React owns menus and 12.5Hz HUD updates. `runtime.ts` samples pointer/keyboard input and advances Practice at fixed 60Hz. A read-only inspector exists only behind `import.meta.env.DEV`, for repeatable browser input QA; the production build omits it.

## Relay protocol

Client messages are bounded JSON under 4096 bytes:

- `join {name,loadout}`: validated kit, server-assigned team, existing bot replacement.
- `input {input:{x,z,yaw,pitch,fire,ads,sprint,crouch,seq,...oneShotActions}}`: monotonic sequence, sanitized booleans/axes, finite yaw, clamped pitch. No hit/damage/score claims accepted.
- `loadout {loadout}`: server validation; applies at next respawn, not as an instant mid-life refill.

Server sends `welcome {id,snapshot}` then `snapshot {snapshot,ack}` at 20Hz. Snapshot schema is the TypeScript `Snapshot` type in `game/match.ts`. All movement/combat is authoritative on the room. Client rendering interpolates remote transforms visually, but there is **no local prediction/reconciliation or history rewind**.

The local server accepts 12 sockets, closes overflow, enforces 120 messages/second/socket, stops controls after 250ms without a valid newer input, caps WebSocket queued output, closes malformed origins, and binds 127.0.0.1. Static paths are confined to `dist`, invalid encodings/directories fail safely, and responses carry CSP, frame denial, MIME protection, no-referrer and restricted permissions. No secrets or external accounts are used. `npm audit --omit=dev` reported zero vulnerabilities on 2026-09-28.

## Public deployment prerequisites

This is not a hardened public service. Add TLS/WSS, explicit origin configuration, authentication and reconnect reservations, version handshake, bounded binary/delta snapshots, legal enemy interest filtering, view/input cadence analytics, server hit history with measured rewind, shared abuse quotas, observability without player content, signed idempotent room results, durable profiles and moderation. Current snapshots contain enemy transforms; UI minimap hides unspotted enemies, but modified clients could read snapshots. Never claim client-side hiding is an anti-cheat boundary.

The full JSON snapshot measured about 10.3KB with twelve idle humans; at 20Hz it exceeds the source prompt's bandwidth target. This is intentionally documented rather than mislabeled as production netcode. A single local room is provided, not a multi-region fleet.

## Replay / reproducibility

`MatchSimulation(seed,duration,scoreLimit,difficulty)` has deterministic seeded random choices. Replaying the same fixed-step input sequence produces the same state; unit fixtures verify it. `tools/browser-driver.js` is an input QA driver, **not** an end-user replay recorder. A full indexed replay UI and server replay log remain future work.
