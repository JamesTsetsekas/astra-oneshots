# Local game launcher

From the workspace root, run `node outputs/arcade/serve.mjs` and open http://127.0.0.1:4160. From this folder, `npm start` does the same thing.

This serves existing production builds on separate loopback-only ports. The Breachline child process serves its production game plus optional `/relay` WebSocket endpoint. Existing servers are never terminated by this launcher. Ctrl+C closes only servers and child processes it started.

Run `node outputs/arcade/verify.mjs` from the workspace while the launcher is active to check all production entrypoints, entry assets, screenshot routes, URL rejection, and the local relay handshake. The UI retries readiness during a cold start and includes a manual refresh control.

See [the collection guide](../GAME-COLLECTION.md) for all eight projects, controls, rebuild instructions, verification evidence, and scope limits.
