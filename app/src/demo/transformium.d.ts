// Consona Transformium is resolved by vite.config.ts from a local read-only checkout (AGPL-3.0-only, not vendored).
declare module "@transformium/core/engine" {
  export function transformium(target: unknown, opts?: Record<string, unknown>): any;
}
