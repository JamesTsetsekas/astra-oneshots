# Architecture and rules boundary

| Source             | Responsibility                                                                         |
| ------------------ | -------------------------------------------------------------------------------------- |
| `src/game/data.ts` | Twelve weapons, five utilities, prices, map boxes, vaults, rulesets and callouts       |
| `navigation.ts`    | Shared capsule collision, exact ray-box occlusion, A\* and corner-safe smoothing       |
| `simulation.ts`    | Seeded movement/combat, grenades, purchases/refunds, objective, economy, AI and rounds |
| `runtime.ts`       | 64Hz accumulator, input, mouse capture, pause/blur, teammate-only spectating           |
| `renderer.ts`      | Batched campus, original gun/hands/actor geometry, opaque smoke, Cipher and VFX        |
| `audio.ts`         | One bounded reusable graph, synthesis, pan/distance/occluded footsteps, Cipher beeps   |
| `ui/App.tsx`       | Menus, setup, buy, settings, HUD/map, scoreboard, round/result/history                 |

`ProtocolMatch.step(1/64)` owns local mutable match truth. Presentation never awards damage or money. Purchases validate phase, buy-zone position, funds, equipment limits, side and deduplicated transaction ID. LIFO receipts restore the complete previous inventory. Dropping invalidates receipts to prevent refunded equipment duplication. Dropped primary magazines and reserve counts persist.

This is **local simulation authority**, not network authority: a modified browser can modify its own Practice game. Production omits `window.__protocolDebug`; development exposes only copied snapshots. Public competitive play would need isolated authoritative rooms, per-viewer visibility filtering, timestamped input schemas, replay/result integrity, rate limits and transport security. None is claimed here.

## Bots

Collision-safe A\* paths, sight/FOV/smoke checks, reaction delay, recoil/spread and shared combat rules. Attackers choose a site with an opposite-lane lurker. Defenders split sites and mid; visible teammate contact permits rotation without reading the attacker's site plan. Bots stop to fire, reload, deploy smoke/flash, recover/arm, hold and retake/disarm. Capsule separation prevents overlapping firing stacks.

The smaller planner lacks fakes, deliberate saves, uncertain audio-memory search, grenade libraries and sophisticated trades. Difficulty adjusts reaction/aim; prepared angle holds acquire visible targets sooner. These are practice opponents.

## Map, presentation and persistence

Both sites have multiple ground entries and perimeter/mid connections. The canopy/gantry is visual architecture, not an accessible upper floor. Collision is shared across movement, navigation, rays and grenades; small decorative details are nonblocking. Smoke uses an opaque rendered boundary and matching horizontal perception radius, with no quality advantage. Dark flash changes tint, not time or obscuration.

Static geometry is merged by material; actor limbs and viewmodel pieces are batched separately. Exit disposes per-match materials/geometries; the small shared palette remains reusable.

`protocol.settings` saves preferences and `protocol.history` stores30 completed results locally. No account, rating, telemetry, secrets or endpoint exists. Static HTTP suffices; a production host should supply security headers.
