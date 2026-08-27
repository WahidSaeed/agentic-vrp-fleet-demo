import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// `shared/` is duplicated per-repo (not a package); alias it for clean imports.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@shared": resolve(__dirname, "../shared") } },
  // Serve the captured replay log statically (replay-data/session.json -> /session.json)
  publicDir: resolve(__dirname, "../replay-data"),
  server: { port: 5173 },
});
