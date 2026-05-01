import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // Orbital Breach ships as a single-entry Three.js game, so the main
    // production bundle is expected to exceed Vite's generic 500 kB warning.
    chunkSizeWarningLimit: 1200,
  },
  server: {
    proxy: {
      "/matchmake": {
        target: "http://localhost:2567",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:2567",
        ws: true,
        changeOrigin: true,
      },
    }
  }
});
