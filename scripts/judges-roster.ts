// Workspace-visible judge roster built from the per-judge Tavily file frontmatter (subject, subjectRole); no network.
// The per-judge research files are private to each judge, so without this a judge cannot answer "who are the judges?".
// Usage: tsx scripts/judges-roster.ts [--tavily <dir>]   (seed-build calls writeRoster before ingesting)
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseFrontmatter } from "@clearmind/core";

const groupOf = (company: string) => /nvidia/i.test(company) ? "NVIDIA" : /tavily/i.test(company) ? "Tavily" : /nebius/i.test(company) ? "Nebius" : company || "Other";

export function writeRoster(tavilyDir: string): string | null {
  const jd = join(tavilyDir, "judges");
  if (!existsSync(jd)) return null;
  const judges: { name: string; role: string; company: string }[] = [];
  for (const slug of readdirSync(jd).sort()) {
    const files = existsSync(join(jd, slug)) ? readdirSync(join(jd, slug)).filter((f) => f.endsWith(".md")).sort() : [];
    for (const f of files) {
      const d = parseFrontmatter(readFileSync(join(jd, slug, f), "utf8")).data;
      if (String(d.mock) === "true" || !d.subject) continue;
      const sr = String(d.subjectRole ?? ""), i = sr.lastIndexOf(", ");
      judges.push({ name: String(d.subject), role: i > 0 ? sr.slice(0, i) : sr, company: i > 0 ? sr.slice(i + 2) : "" });
      break;
    }
  }
  if (!judges.length) return null;
  const groups = new Map<string, typeof judges>();
  for (const j of judges) (groups.get(groupOf(j.company)) ?? groups.set(groupOf(j.company), []).get(groupOf(j.company))!).push(j);
  const order = [...groups.keys()].sort((a, b) => groups.get(b)!.length - groups.get(a)!.length || a.localeCompare(b));
  const out = [
    "---",
    "title: \"Nebius hackathon judges (roster)\"",
    "group: judges",
    "visibleTo: [\"workspace\"]",
    "generatedFrom: \"tavily/judges/*/ frontmatter (subject, subjectRole); public name, title and company only\"",
    "---",
    "",
    `# Who are the judges? Nebius hackathon judge roster (${judges.length} judges)`,
    "",
    `The judges of the Nebius hackathon are ${judges.length} people: ${order.map((g) => `${groups.get(g)!.length} from ${g}`).join(", ")}.`,
    "",
    ...order.flatMap((g) => [`${g} judges (${groups.get(g)!.length}):`, ...groups.get(g)!.map((j) => `- ${j.name}, ${j.role}${j.company ? `, ${j.company}` : ""}`), ""]),
  ].join("\n");
  const file = join(tavilyDir, "judges-roster.md");
  writeFileSync(file, out);
  return file;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf("--tavily");
  const f = writeRoster(resolve(i > 0 ? process.argv[i + 1]! : join(import.meta.dirname, "..", "tavily")));
  console.log(f ? `wrote ${f}` : "no judge files");
}
