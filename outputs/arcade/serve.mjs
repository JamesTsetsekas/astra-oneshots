import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.dirname(root);
export const games = [
  {
    id: "shardfront",
    name: "Shardfront",
    genre: "REAL-TIME STRATEGY",
    folder: "shardfront-rts",
    port: 4173,
    tag: "REMADE",
    description: "Build an outpost. Command the mineral frontier.",
    image: "astra-production.png",
  },
  {
    id: "ashfall",
    name: "Ashfall Covenant",
    genre: "ACTION RPG",
    folder: "ashfall-covenant-arpg",
    port: 4174,
    tag: "REMADE",
    description:
      "Two heroes. One ruined covenant. Earn your way through the ash.",
    image: "astra-final-world.png",
  },
  {
    id: "breachline",
    name: "Breachline",
    genre: "ARCADE FPS",
    folder: "breachline-fps",
    port: 4176,
    tag: "REBUILT",
    description:
      "Fast movement, readable gunfights, and a match worth finishing.",
    image: "combat-verified.png",
  },
  {
    id: "protocol",
    name: "Last Protocol",
    genre: "TACTICAL FPS",
    folder: "last-protocol-fps",
    port: 4177,
    tag: "NEW",
    description: "Buy with purpose. Hold an angle. Every round counts.",
    image: "gameplay-verified.png",
  },
  {
    id: "crownfall",
    name: "Crownfall",
    genre: "BATTLE ARENA",
    folder: "crownfall-moba",
    port: 4178,
    tag: "NEW",
    description: "Choose a hero. Break the defenses. Take the Crown.",
    image: "astra-gameplay.png",
  },
  {
    id: "skybreak",
    name: "Skybreak",
    genre: "BATTLE ROYALE",
    folder: "skybreak-br",
    port: 4179,
    tag: "NEW",
    description: "Drop in, gear up, and outlast the closing sky.",
    image: "skybreak-gameplay.png",
  },
  {
    id: "meridian",
    name: "Meridian Run",
    genre: "OPEN-WORLD ADVENTURE",
    folder: "meridian-run",
    port: 4187,
    tag: "NEW",
    description: "One courier. A stolen contract. A city that remembers.",
    image: "meridian-final-gameplay.png",
  },
  {
    id: "farestorm",
    name: "Farestorm",
    genre: "ARCADE DRIVING",
    folder: "farestorm",
    port: 4180,
    tag: "APPROVED BUILD",
    description: "Catch a fare. Chase the coast. Make every second pay.",
    image: "docs/final-gameplay.png",
  },
];
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
};
function file(res, filename) {
  if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  res.writeHead(200, {
    "Content-Type": mime[path.extname(filename)] ?? "application/octet-stream",
    "Cache-Control":
      path.extname(filename) === ".html" || filename.endsWith("sw.js")
        ? "no-store"
        : "public, max-age=300",
    "X-Content-Type-Options": "nosniff",
  });
  fs.createReadStream(filename).pipe(res);
}
function staticHandler(directory) {
  return (req, res) => {
    let url;
    try {
      url = new URL(req.url, "http://127.0.0.1");
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    let relative;
    try {
      relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    } catch {
      res.writeHead(400);
      res.end("Invalid URL");
      return;
    }
    const filename = path.resolve(directory, relative || "index.html");
    if (filename !== directory && !filename.startsWith(directory + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (fs.existsSync(filename) && fs.statSync(filename).isFile())
      file(res, filename);
    else if (!path.extname(relative))
      file(res, path.join(directory, "index.html"));
    else {
      res.writeHead(404);
      res.end("Missing asset");
    }
  };
}
const servers = [],
  children = [];
async function relayReady(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(1200),
    });
    const health = await response.json();
    return response.ok && health.game === "breachline" && health.relay === true;
  } catch {
    return false;
  }
}
for (const game of games) {
  const dist = path.join(output, game.folder, "dist");
  if (!fs.existsSync(path.join(dist, "index.html"))) {
    console.log(`${game.name}: no production build yet.`);
    continue;
  }
  if (game.id === "breachline") {
    let existing = false;
    try {
      const response = await fetch(`http://127.0.0.1:${game.port}/`, {
        signal: AbortSignal.timeout(1000),
      });
      existing = response.ok;
    } catch {}
    if (existing) {
      console.log(
        (await relayReady(game.port))
          ? "Breachline: using existing game + relay server on 4176."
          : "Breachline: port4176 already responds; leaving it untouched. Optional relay not confirmed. Stop that server and restart this launcher for the bundled relay.",
      );
    } else {
      const child = spawn(
        process.execPath,
        ["--import", "tsx", "server/index.ts"],
        {
          cwd: path.join(output, game.folder),
          env: { ...process.env, PORT: String(game.port) },
          windowsHide: true,
          stdio: "inherit",
        },
      );
      children.push(child);
      child.on("error", (error) =>
        console.error("Breachline local relay: " + error.message),
      );
      child.on("exit", (code) => {
        if (code)
          console.error(
            `Breachline server exited with code ${code}. See its log above.`,
          );
      });
      console.log(
        "Breachline: starting local static + optional relay server on 4176.",
      );
    }
    continue;
  }
  const server = http.createServer(staticHandler(dist));
  server.on("error", (e) => {
    if (e.code === "EADDRINUSE")
      console.log(`${game.name}: using existing local server on ${game.port}.`);
    else console.error(`${game.name}: ${e.message}`);
  });
  server.listen(game.port, "127.0.0.1", () => {
    servers.push(server);
    console.log(`${game.name}: http://127.0.0.1:${game.port}`);
  });
}
const launcher = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, "http://127.0.0.1");
  } catch {
    res.writeHead(400);
    res.end("Invalid URL");
    return;
  }
  if (url.pathname === "/api/games") {
    const entries = await Promise.all(
      games.map(async (game) => {
        let running = false;
        try {
          const response = await fetch(`http://127.0.0.1:${game.port}/`, {
            signal: AbortSignal.timeout(1600),
          });
          running =
            response.ok &&
            (await response.text())
              .toLowerCase()
              .replace(/[^a-z]/g, "")
              .includes(game.name.toLowerCase().replace(/[^a-z]/g, ""));
        } catch {}
        return {
          ...game,
          running,
          built: fs.existsSync(
            path.join(output, game.folder, "dist/index.html"),
          ),
          screenshot: fs.existsSync(path.join(output, game.folder, game.image)),
          relayReady:
            game.id === "breachline" ? await relayReady(game.port) : undefined,
        };
      }),
    );
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(entries));
    return;
  }
  if (url.pathname.startsWith("/screenshots/")) {
    const game = games.find((g) => g.id === url.pathname.split("/")[2]);
    if (game) file(res, path.join(output, game.folder, game.image));
    else {
      res.writeHead(404);
      res.end();
    }
    return;
  }
  staticHandler(root)(req, res);
});
launcher.on("error", (e) => console.error("Collection launcher: " + e.message));
launcher.listen(4160, "127.0.0.1", () =>
  console.log(
    "\nASTRA GAME COLLECTION → http://127.0.0.1:4160\nAll servers bind only to your computer. Ctrl+C stops servers started by this launcher.",
  ),
);
function stop() {
  for (const server of servers) server.close();
  for (const child of children) child.kill();
  launcher.close();
}
process.on("SIGINT", () => {
  stop();
  process.exit();
});
process.on("SIGTERM", () => {
  stop();
  process.exit();
});
