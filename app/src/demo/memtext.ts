// Display helpers for ingested chunks: their text starts with a context header
// ("path | section A > B | lines 96-100 | markdown", then "section:", "file about:", "file headings:" ... lines).
// Rows show the real content first and a small source chip; the full text stays in detail views.
const HDR = /^(depends on directories|used by directories|section|file about|file headings|headings|about|signatures?|subdirectories|files|file|kind|language|symbols?|exports?|imports?)\s*:/i;
export interface MemDisplay { body: string; chip: string; about: string }
export function splitMem(raw: unknown): MemDisplay {
  const text = String(raw ?? "");
  const lines = text.replace(/\r/g, "").split("\n");
  const first = lines[0] ?? "";
  if (!first.includes(" | ")) return { body: text, chip: "", about: "" };
  let i = 1, about = "";
  for (; i < lines.length; i++) {
    const l = lines[i]!.trim();
    if (!l || !HDR.test(l)) break;
    const m = /^(?:file )?about\s*:\s*(.*)$/i.exec(l); if (m) about = m[1]!;
  }
  let rest = lines.slice(i).join("\n").trim();
  // drop a leading markdown heading that just repeats the section title, when there is more content
  const rl = rest.split("\n"); if (rl.length > 1 && /^#{1,6}\s/.test(rl[0]!)) rest = rl.slice(1).join("\n").trim();
  const parts = first.split(" | ").map((s) => s.trim());
  const path = parts[0] ?? "", file = path.replace(/\/$/, "").split("/").pop() || path;
  const ln = parts.find((p) => /^lines \d+/.test(p))?.replace(/^lines (\d+)-(\d+)$/, "lines $1–$2");
  const sec = parts.find((p) => p.startsWith("section "))?.slice(8);
  const crumb = sec ? sec.split(" > ").slice(-2).map((s) => (s.length > 40 ? s.slice(0, 39) + "…" : s)).join(" › ")
    : parts.slice(1).find((p) => !/^lines /.test(p) && !/^(markdown|typescript|javascript|python|text|json|tsx|css|html|yaml)$/i.test(p));
  const chip = [file + (path.endsWith("/") ? "/" : ""), ln, crumb].filter(Boolean).join(" · ");
  return { body: rest || about || lines.slice(1).join(" ").trim() || first, chip, about };
}
/** One-line form of the real content (no header). */
export function memLine(raw: unknown, max = 140): string {
  const b = splitMem(raw).body.replace(/\s+/g, " ").trim();
  return b.length > max ? b.slice(0, max - 1) + "…" : b;
}
