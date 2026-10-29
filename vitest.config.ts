import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*", "server"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.worktrees/**"],
  },
});
