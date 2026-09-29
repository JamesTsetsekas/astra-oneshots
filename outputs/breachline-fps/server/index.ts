import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { extname, resolve, sep } from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import { MatchSimulation, idleInput, type Input } from "../src/game/simulation";
import { defaultLoadouts, validLoadout } from "../src/game/data";

const port = Number(process.env.PORT || 4196);
const dist = resolve(import.meta.dirname, "..", "dist");
const mime: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};
const http = createServer((req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://127.0.0.1:* ws://localhost:*; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  );
  let route: string;
  try {
    route = decodeURIComponent((req.url || "/").split("?")[0]);
  } catch {
    res.writeHead(400);
    res.end("Invalid URL");
    return;
  }
  if (route === "/health" && req.method === "GET") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ game: "breachline", relay: true }));
    return;
  }
  const target = resolve(dist, `.${route === "/" ? "/index.html" : route}`);
  if (
    !target.startsWith(dist + sep) ||
    !existsSync(target) ||
    !statSync(target).isFile()
  ) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  res.setHeader(
    "Content-Type",
    mime[extname(target)] || "application/octet-stream",
  );
  res.setHeader(
    "Cache-Control",
    target.endsWith("index.html") ? "no-cache" : "public, max-age=86400",
  );
  res.end(readFileSync(target));
});
const sockets = new Map<
  WebSocket,
  {
    id: string;
    messages: number;
    windowStart: number;
    ack: number;
    lastInput: number;
  }
>();
let match = new MatchSimulation();
match.fillBots();
const wss = new WebSocketServer({
  server: http,
  path: "/relay",
  maxPayload: 4096,
});

wss.on("connection", (socket, req) => {
  if (req.headers.origin) {
    try {
      if (
        !["127.0.0.1", "localhost"].includes(
          new URL(req.headers.origin).hostname,
        )
      ) {
        socket.close(1008, "Origin not allowed");
        return;
      }
    } catch {
      socket.close(1008, "Invalid origin");
      return;
    }
  }
  if (match.winner && sockets.size === 0) {
    match = new MatchSimulation();
    match.fillBots();
  }
  if (sockets.size >= 12) {
    socket.close(1013, "Room full");
    return;
  }
  const id = `guest-${randomUUID()}`;
  const seat = {
    id,
    messages: 0,
    windowStart: Date.now(),
    ack: 0,
    lastInput: Date.now(),
  };
  sockets.set(socket, seat);
  socket.send(
    JSON.stringify({ type: "welcome", id, snapshot: match.snapshot() }),
  );
  socket.on("message", (raw) => {
    const now = Date.now();
    if (now - seat.windowStart > 1000) {
      seat.messages = 0;
      seat.windowStart = now;
    }
    if (++seat.messages > 120) {
      socket.close(1008, "Message quota exceeded");
      return;
    }
    try {
      const message = JSON.parse(raw.toString()) as {
        type?: string;
        name?: string;
        loadout?: unknown;
        input?: Input;
      };
      if (message.type === "join") {
        if (message.loadout && !validLoadout(message.loadout)) {
          socket.send(
            JSON.stringify({
              type: "error",
              message: "Invalid loadout. Reset your local kits and retry.",
            }),
          );
          return;
        }
        if (!match.players.has(id))
          match.addHuman(
            id,
            String(message.name || "Guest").slice(0, 22),
            validLoadout(message.loadout)
              ? message.loadout
              : defaultLoadouts[0],
          );
      } else if (message.type === "input" && message.input) {
        const seq = Number(message.input.seq);
        if (!Number.isSafeInteger(seq) || seq <= seat.ack) return;
        match.setInput(id, message.input);
        seat.ack = seq;
        seat.lastInput = now;
      } else if (message.type === "loadout" && validLoadout(message.loadout)) {
        match.setLoadout(id, message.loadout);
      }
    } catch {
      /* Ignore malformed client messages. */
    }
  });
  socket.on("close", () => {
    sockets.delete(socket);
    match.removeHuman(id);
  });
});

setInterval(() => {
  for (const seat of sockets.values())
    if (Date.now() - seat.lastInput > 250) {
      const p = match.players.get(seat.id);
      if (p)
        match.setInput(seat.id, { ...idleInput(), yaw: p.yaw, pitch: p.pitch });
    }
  if (sockets.size) match.step(1 / 60);
}, 1000 / 60);
setInterval(() => {
  const snapshot = match.snapshot();
  for (const [socket, seat] of sockets)
    if (socket.readyState === socket.OPEN && socket.bufferedAmount < 128000)
      socket.send(
        JSON.stringify({ type: "snapshot", snapshot, ack: seat.ack }),
      );
}, 50);
http.listen(port, "127.0.0.1", () =>
  console.log(`Breachline server at http://127.0.0.1:${port}`),
);
