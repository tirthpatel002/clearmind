#!/usr/bin/env node
// Entry point for the data CLI: `tsx src/cli-main.ts <command>`.
import { main } from "./cli.js";

main().then((code) => {
  process.exitCode = code;
});
