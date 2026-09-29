# Farestorm

An original arcade taxi game set in Galeport, a bright coastal city. Choose a storm cab, pick up passengers, find the fast route, bank stylish driving and race the shift clock.

## Run locally

Requires Node.js 22.12 or later and npm. From this folder:

```powershell
npm install
npm run dev
```

Open **http://127.0.0.1:4180/**. Click into the game and start a shift to enable audio. The browser needs WebGL 2 and hardware acceleration.

```powershell
npm test
npm run build
npm run preview
```

`npm run build` checks TypeScript and produces `dist/`. Preview serves the production build at the same local address. Stop the development server before starting preview on port 4180.

## Driving

| Action | Keyboard | Standard gamepad |
| --- | --- | --- |
| Accelerate | W / Up | Right trigger |
| Brake / reverse | S / Down | Left trigger |
| Steer | A / D or Left / Right | Left stick |
| Handbrake / drift | Space | A / Cross |
| Tailwind | Shift | B / Circle |
| Interact | E; pickups also board when stopped | X / Square |
| Look back | X | Y / Triangle or right-stick press |
| Free glance | Right-mouse drag; Q / Z left, V right | Right stick |
| Cycle camera | C | D-pad Right |
| Map | M | D-pad Left |
| Reset | Hold R | Hold Back / Select |
| Horn | H | D-pad Up |
| Pause | Escape | Menu / Start |

Stop inside a passenger ring to board. The destination marker and route guide appear while the passenger is on board. Stop inside the destination ring to deliver. The green, amber and magenta passenger markers indicate short, medium and long trips.

For **Surge Start**, release the brake at low speed and press throttle within 220 milliseconds. For **Snap Drift**, steer and tap the handbrake above 35 km/h. During a drift, tap brake and return to throttle for a **Grip Turn**. Skill School teaches these moves individually.

## Modes and local progress

- **Arcade Shift:** 60 seconds initially; successful fares add time.
- **Quick Shift:** a fixed five-minute drive.
- **Time Trial:** six authored passenger chains with fixed seeds and medal times.
- **Skill School:** ten lessons from first acceleration through a complete fare.

Three handling models, 24 passenger personalities, 32 destinations and 18 shortcuts are defined in source. Local records, medals, discovered shortcuts, completed lessons, settings and the latest recorded ghost are stored in the browser. The Records screen can export a ghost. Clearing browser data removes local progress.

The save layer validates structure and checksums, keeps a previous record, and attempts recovery after corruption. If IndexedDB is unavailable it attempts localStorage; failure is reported. Checksums detect damaged saves and provide no cheat protection.

## Deployment and offline play

Publish `dist/` to an HTTPS static host at its domain root. No backend, API keys, accounts or environment variables are required. Serve JavaScript, CSS, WASM, fonts and images with their proper content types. Use a short cache lifetime for `index.html` and `sw.js`, and long immutable caching for hashed `/assets/` files.

The production build registers a service worker; development does not. On installation it fetches the shell and recursively discovers bundled JS, CSS, fonts, artwork and WASM assets. Offline use requires a successful initial download. The worker reports failed installation through the browser; it does not replace missing assets with a false success. See the [verification ledger](docs/verification.md) for tested environments and the offline test status.

The current configuration assumes hosting at `/`. To deploy under a subdirectory, update Vite's `base`, manifest URLs, service-worker scope and cache URLs together.

## Source and implementation notes

- [Architecture and replay format](docs/architecture.md)
- [Handling and scoring](docs/handling-and-scoring.md)
- [Browser, accessibility and performance checks](docs/verification.md)
- [Verified leaderboard design](docs/leaderboard-design.md)
- [Asset credits and licenses](docs/asset-licenses.md)

The city, vehicles and effects are constructed from original procedural geometry, with generated original menu artwork. Audio is an original Web Audio composition and synthesizer. This build uses local records and ghosts. The optional verified online leaderboard is a documented extension and is not connected to a service.

No assets, city layout, names, music, passengers or vehicle designs from an existing taxi game are included.
