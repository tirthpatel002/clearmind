import { DatabaseSync } from "node:sqlite";
import { mineAll } from "../server/src/reflect.ts";
const d = new DatabaseSync(process.argv[2] + "/memory.db", { readOnly: true });
const rows = (d.prepare("SELECT lesson_id id,text,created_at createdAt,trigger FROM lessons WHERE status='active' AND user_id=? ORDER BY created_at").all(process.argv[3] ?? "maya") as any[]).map((r) => ({ ...r, tags: String(r.trigger ?? "").split(/\s+/) }));
for (const c of mineAll(rows)) console.log(c.kind, c.severity ?? "", c.confidence, c.evidence.length, "|", c.fallback);
