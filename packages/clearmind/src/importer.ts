// Parsing of import payloads (lines of text, JSON or CSV) into memory items.
import type { ImportFormat, ImportItem } from "./types.js";

const splitTags = (v: unknown): string[] =>
  (Array.isArray(v) ? v.map(String) : String(v ?? "").split(/[;,|]/)).map((t) => t.trim()).filter(Boolean);

/** Parse an import payload into {text,tags,key} items. */
export function parseImport(data: string, format: ImportFormat): ImportItem[] {
  if (format === "text") return parseLines(data);
  if (format === "json") return parseJson(data);
  if (format === "csv") return parseCsvItems(data);
  throw new Error(`import: unknown format ${format}`);
}

function parseLines(data: string): ImportItem[] {
  return data
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean)
    .map((text) => ({ text }));
}

function parseJson(data: string): ImportItem[] {
  let j: unknown;
  try {
    j = JSON.parse(data);
  } catch {
    throw new Error("import: not valid JSON");
  }
  const arr = Array.isArray(j) ? j : Array.isArray((j as any)?.memories) ? (j as any).memories : null;
  if (!arr) throw new Error('import: JSON must be an array or {"memories":[...]}');
  return arr.map((x: any) =>
    typeof x === "string"
      ? { text: x }
      : { text: String(x?.text ?? ""), tags: splitTags(x?.tags ?? x?.scope ?? []), key: x?.key ? String(x.key) : undefined },
  );
}

/** CSV: text[,tags][,key]. With a header row the columns are found by name (text, tags|scope, key). */
function parseCsvItems(data: string): ImportItem[] {
  const rows = parseCsv(data);
  if (!rows.length) return [];
  const head = rows[0]!.map((h) => h.trim().toLowerCase());
  const hasHead = head.includes("text");
  const ti = hasHead ? head.indexOf("text") : 0;
  const gi = hasHead ? head.findIndex((h) => h === "tags" || h === "scope") : 1;
  const ki = hasHead ? head.indexOf("key") : 2;
  return rows.slice(hasHead ? 1 : 0).map((r) => ({
    text: (r[ti] ?? "").trim(),
    tags: gi >= 0 ? splitTags(r[gi]) : [],
    key: ki >= 0 && r[ki]?.trim() ? r[ki]!.trim() : undefined,
  }));
}

/** Minimal RFC 4180 CSV reader (quoted fields, doubled quotes, CRLF). Blank rows are dropped. */
export function parseCsv(s: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const endRow = () => {
    row.push(field);
    field = "";
    if (row.some((x) => x.trim())) out.push(row);
    row = [];
  };
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (quoted) {
      if (c !== '"') field += c;
      else if (s[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      endRow();
    } else field += c;
  }
  endRow();
  return out;
}
