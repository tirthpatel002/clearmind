// Dev: `pnpm dev` serves the app on 5173 and proxies /api to the server (CLEARMIND_API, default 127.0.0.1:8790).
// Prod: `pnpm build` writes app/dist, which the server serves on its own port.
import { defineConfig } from "vite";

export default defineConfig({
  build: { outDir: "dist", emptyOutDir: true, target: "es2022" },
  server: {
    host: "127.0.0.1",
    proxy: { "/api": process.env.CLEARMIND_API ?? "http://127.0.0.1:8790" },
  },
});
