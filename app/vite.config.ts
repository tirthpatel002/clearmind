// Dev: `pnpm dev` serves the app on 5173 and proxies /api to the server (CLEARMIND_API, default 127.0.0.1:8790).
// Prod: `pnpm build` writes app/dist, which the server serves on its own port.
// The memory map uses Consona Transformium (AGPL-3.0-only), read from a local checkout:
// TRANSFORMIUM_DIR, default ~/work/consona-transformium. It is not vendored into this repo.
import { homedir } from "node:os";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const tf = process.env.TRANSFORMIUM_DIR ?? resolve(homedir(), "work/consona-transformium");
// Transformium's own deps (zod, zod-to-json-schema), installed next to the checkout, not into it.
const tfDeps = process.env.TRANSFORMIUM_DEPS ?? resolve(homedir(), "work/transformium-deps/node_modules");

export default defineConfig({
  resolve: { alias: { "@transformium/core/engine": resolve(tf, "packages/core/src/engine/index.ts"), "zod-to-json-schema": resolve(tfDeps, "zod-to-json-schema"), zod: resolve(tfDeps, "zod") } },
  // Relative asset paths, so the same build works at "/" (served by the API server) and under a sub-path such as
  // projects.tirthkpatel.com/clearmind/ (static host). CLEARMIND_BASE overrides, e.g. "/clearmind/".
  base: process.env.CLEARMIND_BASE ?? "./",
  build: { outDir: "dist", emptyOutDir: true, target: "es2022" },
  server: {
    host: "127.0.0.1",
    fs: { allow: [".", tf] },
    proxy: { "/api": process.env.CLEARMIND_API ?? "http://127.0.0.1:8790" },
  },
});
