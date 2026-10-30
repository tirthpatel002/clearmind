#!/usr/bin/env node
// The `clearmind` command: `serve` starts the web server; every other command is the core data CLI.
import { parseArgs, runCli } from "@clearmind/core";
import { serve } from "./index.js";

async function main(argv = process.argv.slice(2)): Promise<number> {
  const { pos, f } = parseArgs(argv);
  if (pos[0] !== "serve") return runCli(argv);
  await serve({
    offline: f.offline === "true",
    accessTokenFile: f["access-token-file"],
    overrides: {
      dataDir: f.dir,
      port: f.port ? Number(f.port) : undefined,
      host: f.host,
      "auth.defaultUser": f.user ?? f.owner,
      "auth.workspaceUsers": f["workspace-users"],
    },
  });
  return 0;
}

main().then((code) => {
  process.exitCode = code;
});
