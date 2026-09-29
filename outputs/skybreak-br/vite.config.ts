import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { host: "127.0.0.1", port: 4179, strictPort: true },
  build: {
    chunkSizeWarningLimit: 2200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Group only imported modules; never pull Babylon's all-features barrel into the graph.
          if (id.includes("@babylonjs/core")) return "babylon";
          if (id.includes("@dimforge/rapier3d-compat")) return "physics";
        },
      },
    },
  },
});
