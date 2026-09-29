# Architecture and data

The simulation owns gameplay state. Rendering consumes a snapshot; it must not award score from meshes or camera transforms. React renders menus, settings, HUD and results. Input is sampled once per fixed step. Audio reads the same event stream as the HUD.

## Modules

| Source | Responsibility |
| --- | --- |
| `src/game/types.ts` | Shared state, settings, result and replay contracts |
| `src/game/content.ts` | Taxi tuning, 24 passenger archetypes, ten lessons and six trial chains |
| `src/game/world.ts` | City roads, height model, buildings, destinations and shortcuts |
| `src/game/navigation.ts` | Deterministic legal-road routing and distance calculations |
| `src/game/scoring.ts` | Pulse, Tailwind, style restrictions, event history and score totals |
| `src/game/audio.ts` | Lazy Web Audio initialization, vehicle layers, music and event cues |
| `src/game/persistence.ts` | Validated settings/profile saves, backup recovery and export |
| `public/sw.js` | Production shell/asset precache and offline navigation fallback |

The project keeps the complete procedural city data resident. It does not depend on external model downloads or a runtime asset CDN. The prompt's large-team asset pipeline (GLB authoring, KTX2 textures, HLOD baking and streaming cell production) is not required by this procedural build and is not represented as delivered tooling. Traffic uses kinematic lane followers with Rapier collision contacts and a recovery pause. Dynamic traffic shoves and true lane-changing decisions are not implemented.

## Save contract

IndexedDB database: `farestorm-local`, version 1. Object store: `saves`. Keys: `settings`, `settings:backup`, `profile`, `profile:backup`.

Each record uses this envelope:

```ts
{
  format: 'farestorm-save',
  version: 1,
  writtenAt: number,
  payload: Settings | Profile,
  checksum: string
}
```

Checksum is FNV-1a over the JSON serialization of `{version, payload}`. This detects accidental modifications; it is not authentication. A valid active record becomes the backup in the same write transaction. Reads validate the active payload, then try the backup. An invalid ghost is removed while valid score history is retained. Unknown future envelope versions are rejected. Profile version zero aggregates can migrate to version one by rebuilding totals from valid results.

Writes are serialized within the page so simultaneous result/settings calls do not lose updates. Run IDs prevent duplicate recording, including React effect re-entry. Storage fallback uses the same envelopes inside a localStorage pair. If both storage mechanisms fail, saves reject with an actionable message. Cross-tab scoring updates are not synchronized into one globally ordered profile; play one active shift per browser profile.

The profile retains the newest 60 results, unique shortcut discoveries, lesson IDs, best trial medals, lifetime delivery count, best score and latest valid ghost. Medal updates cannot replace a gold medal with a lower one.

## Replay contract

`Replay.version` is 1. It contains the session options, an array of four-number input frames, timed ghost transforms, and optionally the completed result. Input is recorded at 60 Hz as `[throttle, brake, steer, flags]`: throttle and brake range from 0 to 255, steer from -127 to 127, and flags use bits handbrake=1, boost=2, interact=4, reset=8 and horn=16. Ghost samples are captured at 10 Hz and contain time, chassis-center XYZ position, heading and speed, independent of geometry or UI.

Loader limits are 86,400 input frames and 30,000 ghost samples. Samples must have nondecreasing time and finite bounded transforms. A local ghost is a visual replay, not proof of a legitimate score. Browser/physics revisions can affect regenerated dynamics even with identical inputs; a future verifier must pin the game rules and physics build.

## Audio budget

One AudioContext per game audio instance, created only after a user gesture. Four continuous sources provide fundamental engine, engine harmonic, tire slip and wind. A bounded voice set allows at most 42 transient sources, keeping the total below the prompt's 56-voice limit. Sources disconnect on completion. Dispose stops every source and closes the context.

The original music is a 126 BPM eight-bar arrangement with syncopated bass, backbeat drums, shuffled hats, filtered chord stabs and a sparse lead phrase. Vehicle speed raises musical density. Engine pitch reacts to speed, virtual gear changes and acceleration; drift controls filtered tire noise. Collision/boarding temporarily duck the music. Music and effects sliders operate separate real gain buses, and a master compressor limits peaks. Pause suspends the context, preventing continuing engine sound while the simulation is frozen.

Spoken passenger recordings are not bundled. Original passenger lines appear as subtitles; event cues supply musical feedback. This avoids depending on inconsistent browser speech synthesis voices.

## Offline cache

Service-worker installation scans the built HTML, JS and CSS for same-origin assets and fetches them before activation. It caps precache traversal at 240 resources to catch accidental runaway imports. Navigations prefer the network and fall back to the cached index. Hashed build assets use cache-first lookup. Missing assets fail normally so diagnostics remain visible.

Service-worker installability and offline completeness must be checked against the built preview, with network disabled after initial installation. A development-server screenshot alone does not verify offline support.
