import { useEffect, useRef } from "react";
import { BUILDINGS, heightAt, LANDMARKS } from "../game/world";
import type { Snapshot, V2 } from "../game/types";
export function TacticalMap({
  snapshot,
  full = false,
  onMarker,
}: {
  snapshot: Snapshot;
  full?: boolean;
  onMarker?: (point: V2) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = full ? 620 : 210,
      scale = size / 1200;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#467c81";
    ctx.fillRect(0, 0, size, size);
    for (let z = -600; z < 600; z += 16)
      for (let x = -600; x < 600; x += 16) {
        const h = heightAt(x, z);
        if (h < 0) continue;
        ctx.fillStyle = h < 5 ? "#c2bd94" : h > 35 ? "#9ca685" : "#899e77";
        ctx.fillRect(
          (x + 600) * scale,
          (z + 600) * scale,
          16 * scale + 1,
          16 * scale + 1,
        );
      }
    ctx.strokeStyle = "#e2d8b055";
    ctx.lineWidth = full ? 1 : 0.5;
    for (let i = 1; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo((i * size) / 6, 0);
      ctx.lineTo((i * size) / 6, size);
      ctx.moveTo(0, (i * size) / 6);
      ctx.lineTo(size, (i * size) / 6);
      ctx.stroke();
    }
    for (const b of BUILDINGS) {
      ctx.fillStyle = "#e3d8ba";
      ctx.fillRect(
        (b.x - b.width / 2 + 600) * scale,
        (b.z - b.depth / 2 + 600) * scale,
        b.width * scale,
        b.depth * scale,
      );
    }
    const circle = (
      x: number,
      z: number,
      r: number,
      color: string,
      dashed = false,
    ) => {
      ctx.strokeStyle = color;
      ctx.setLineDash(dashed ? [5, 4] : []);
      ctx.lineWidth = full ? 2 : 1.5;
      ctx.beginPath();
      ctx.arc((x + 600) * scale, (z + 600) * scale, r * scale, 0, Math.PI * 2);
      ctx.stroke();
    };
    const s = snapshot.storm;
    circle(s.x, s.z, s.radius, "#d6b5ff");
    circle(s.nextX, s.nextZ, s.nextRadius, "#ffebbb", true);
    ctx.setLineDash([]);
    if (full) {
      ctx.font = "600 14px Barlow";
      ctx.textAlign = "center";
      for (const landmark of LANDMARKS) {
        ctx.fillStyle = "#183d40bb";
        ctx.fillRect(
          (landmark.x + 600) * scale - 65,
          (landmark.z + 600) * scale - 7,
          130,
          21,
        );
        ctx.fillStyle = "#fff3d3";
        ctx.fillText(
          landmark.name,
          (landmark.x + 600) * scale,
          (landmark.z + 600) * scale + 8,
        );
      }
    }
    ctx.fillStyle = "#f2bd69";
    ctx.beginPath();
    ctx.arc(
      (snapshot.marker.x + 600) * scale,
      (snapshot.marker.z + 600) * scale,
      full ? 5 : 3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    const p = snapshot.player;
    ctx.save();
    ctx.translate((p.x + 600) * scale, (p.z + 600) * scale);
    ctx.rotate(-p.yaw);
    ctx.beginPath();
    ctx.moveTo(0, full ? 8 : 5);
    ctx.lineTo(-5, -5);
    ctx.lineTo(5, -5);
    ctx.closePath();
    ctx.fillStyle = "#fff7d7";
    ctx.fill();
    ctx.strokeStyle = "#284e4e";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }, [snapshot, full]);
  return (
    <canvas
      ref={ref}
      width={full ? 620 : 210}
      height={full ? 620 : 210}
      aria-label={
        full
          ? "Highwake tactical map. Click to set your landing marker."
          : "Minimap showing your position, current storm and next safe circle."
      }
      onClick={(event) => {
        if (!onMarker) return;
        const r = event.currentTarget.getBoundingClientRect();
        onMarker({
          x: ((event.clientX - r.left) / r.width) * 1200 - 600,
          z: ((event.clientY - r.top) / r.height) * 1200 - 600,
        });
      }}
    />
  );
}
