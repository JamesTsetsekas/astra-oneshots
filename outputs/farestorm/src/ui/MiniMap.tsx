import { useEffect, useRef } from "react";
import { DESTINATIONS, ROADS } from "../game/world";
import type { GameSnapshot, GhostSample, Replay } from "../game/types";

const palette: Record<string, string> = {
  short: "#99ed94",
  medium: "#ffc65a",
  long: "#f1a0df",
  special: "#66e9eb",
};
const points = ROADS.flatMap((road) => road.points);
const minX =
  Math.min(...points.map((p) => p.x), ...DESTINATIONS.map((p) => p.x)) - 55;
const maxX =
  Math.max(...points.map((p) => p.x), ...DESTINATIONS.map((p) => p.x)) + 55;
const minZ =
  Math.min(...points.map((p) => p.z), ...DESTINATIONS.map((p) => p.z)) - 55;
const maxZ =
  Math.max(...points.map((p) => p.z), ...DESTINATIONS.map((p) => p.z)) + 55;

export function MiniMap({
  snapshot,
  full = false,
  replay,
  sample,
  className = "",
}: {
  snapshot?: GameSnapshot;
  full?: boolean;
  replay?: Replay;
  sample?: GhostSample;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = full ? 800 : 420;
    canvas.width = size;
    canvas.height = size;
    const player = sample ?? snapshot?.vehicle;
    const extent = Math.max(maxX - minX, maxZ - minZ);
    const scale = (size - 48) / (full ? extent : 460);
    const centerX = full || !player ? (maxX + minX) / 2 : player.x;
    const centerZ = full || !player ? (maxZ + minZ) / 2 : player.z;
    const xy = (p: { x: number; z: number }): [number, number] => [
      size / 2 + (p.x - centerX) * scale,
      size / 2 - (p.z - centerZ) * scale,
    ];
    ctx.fillStyle = "#123f44";
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "#1c5255";
    ctx.lineWidth = 1;
    for (let n = 0; n <= size; n += 35) {
      ctx.beginPath();
      ctx.moveTo(n, 0);
      ctx.lineTo(n, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, n);
      ctx.lineTo(size, n);
      ctx.stroke();
    }
    for (const road of ROADS) {
      ctx.beginPath();
      road.points.forEach((p, i) => {
        const [x, y] = xy(p);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = road.elevated ? "#719399" : "#537b7e";
      ctx.lineWidth = Math.max(full ? 3 : 6, road.width * scale * 0.66);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }
    if (replay?.samples.length) {
      ctx.beginPath();
      replay.samples.forEach((p, i) => {
        const [x, y] = xy(p);
        if (!i) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = "#ffbb68";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    if (snapshot?.route.length) {
      ctx.beginPath();
      snapshot.route.forEach((p, i) => {
        const [x, y] = xy(p);
        if (!i) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = "#fff0ba";
      ctx.lineWidth = full ? 5 : 6;
      ctx.stroke();
    }
    if (full) {
      for (const d of DESTINATIONS) {
        const [x, y] = xy(d);
        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "600 11px Barlow";
        ctx.fillStyle = "#dbebdc";
        ctx.textAlign = "center";
        ctx.fillText(d.name, x, y - 9);
      }
    }
    for (const p of snapshot?.passengers.filter((p) => p.active) ?? []) {
      const [x, y] = xy(p);
      ctx.fillStyle = palette[p.tier];
      ctx.strokeStyle = "#123f44";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, full ? 6 : 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (snapshot?.activeFare) {
      const [x, y] = xy(snapshot.activeFare.destination);
      ctx.beginPath();
      ctx.arc(x, y, full ? 11 : 14, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffb257";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = "#fff8df";
      ctx.fillRect(x - 4, y - 4, 8, 8);
    }
    if (player) {
      const [x, y] = xy(player);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(player.heading);
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(8, 8);
      ctx.lineTo(0, 4);
      ctx.lineTo(-8, 8);
      ctx.closePath();
      ctx.fillStyle = "#ff775f";
      ctx.strokeStyle = "#fff8e7";
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.font = "700 17px Barlow";
    ctx.textAlign = "right";
    ctx.fillStyle = "#e3f0db";
    ctx.fillText("N", size - 18, 30);
  }, [snapshot, full, replay, sample]);
  return (
    <canvas
      ref={ref}
      className={`mini-map ${full ? "full-map-canvas" : ""} ${className}`}
      aria-label={
        replay
          ? "Recorded route replay map"
          : full
            ? "Map of Galeport with destination markers and route"
            : "Nearby roads, passengers and route"
      }
    />
  );
}
