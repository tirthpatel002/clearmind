// Build the demo local (nomic) semantic index for a data dir out of process, so the server only loads it.
// Usage: tsx scripts/local-index.ts --dir <dataDir> --user <owner>
import { Clearmind, loadConfig } from "@clearmind/core";
import { localIndex, entityDocs } from "../server/src/routes/demo.ts";
const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const dir = arg("dir")!, user = arg("user")!;
const cfg = loadConfig({ overrides: { dataDir: dir } });
const cm = Clearmind.fromEnv(dir, user, { offline: true, config: cfg });
const ix = await localIndex(cfg as any, user, entityDocs(cm));
console.log(`local index: ${ix.items.length} items, computed ${ix.computed} in ${ix.computedMs} ms`);
await cm.close();
