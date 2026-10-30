// Reflect: Clearmind derives higher-level INSIGHTS from raw memories on its own.
// Deterministic miners find candidate clusters (time/frequency habits, repeated requests, agent-run
// workflows and failure signatures, security findings); the reader model only words a cluster as one
// statement and must cite ids from that cluster's evidence. No evidence, no insight.
import { createHash } from "node:crypto";
import { redactText } from "./redact.js";

export type InsightKind = "habit" | "usage" | "workflow" | "failure" | "security";
export type InsightStatus = "new" | "confirmed" | "retired";
export interface MemRow { id: string; text: string; createdAt: string; tags: string[] }
export interface Insight {
  id: string; sig: string; kind: InsightKind; statement: string; confidence: number; severity?: "low" | "medium" | "high";
  evidence: string[]; firstSeen: string; lastSeen: string; status: InsightStatus; retiredReason?: string;
  method: string; stats: Record<string, unknown>; derivedAt: string; memoryId?: string;
  relations?: { type: "fixed-by" | "caused-by" | "same-signature"; from: string; to: string }[];
}
export interface Candidate extends Omit<Insight, "id" | "statement" | "status" | "derivedAt"> { fallback: string; prompt: string; retire?: string }

// ---------- helpers ----------
const IST = 330 * 60e3;
const local = (iso: string) => new Date(Date.parse(iso) + IST);
const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const daypart = (h: number) => (h >= 5 && h < 12 ? "morning" : h >= 12 && h < 17 ? "afternoon" : h >= 17 && h < 22 ? "evening" : "night");
const isoWeek = (d: Date) => Math.floor((d.getTime() / 86400e3 + 3) / 7);
const STOP = new Set("the a an and or but of to in on at for with from by is was were be been are it its this that then than so as into about after before over under up down out off just very also there their them they she her his him he you your yours our we i me my mine had has have did does do done not no yes all any some each other more most only own same can will would could should get got went go going around about usually today tonight yesterday tomorrow week weeks day days time times morning evening afternoon night next last one two three four five six minutes hour hours min".split(" "));
const MONTHS = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)$/;
export function terms(s: string): string[] {
  return (s.toLowerCase().match(/[a-z][a-z'-]+/g) ?? []).filter((t) => t.length > 2 && !STOP.has(t) && !MONTHS.test(t) && !DAY.some((d) => d.toLowerCase() === t));
}
const sentences = (s: string) => s.split(/(?<=[.!?])\s+(?=[A-Z])/).map((x) => x.trim()).filter(Boolean);
/** Wilson score lower bound (95%) for k successes of n. */
export function wilson(k: number, n: number, z = 1.96) {
  if (!n) return 0;
  const p = k / n, d = 1 + (z * z) / n;
  return Math.max(0, (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d);
}
const sig = (...p: string[]) => createHash("sha1").update(p.join("|")).digest("hex").slice(0, 12);
const minutes = (h: number, m: number) => h * 60 + m;
const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(Math.round(min % 60)).padStart(2, "0")}`;
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)]! : 0; };
const span = (rows: MemRow[]) => { const t = rows.map((r) => r.createdAt).sort(); return { firstSeen: t[0]!, lastSeen: t[t.length - 1]! }; };

/** A sentence-level event: its time is an explicit hh:mm in the sentence when present, else the memory's time. */
interface Ev { mem: MemRow; text: string; day: Date; min: number; week: number; terms: Set<string>; timed: boolean }
function events(rows: MemRow[]): Ev[] {
  const out: Ev[] = [];
  for (const m of rows) {
    const d = local(m.createdAt);
    const ss = sentences(m.text);
    // a diary/journal entry is written at the end of the day: its log time is not the time of the events in it
    const summary = ss.length > 1 || /^(journal|diary|daily (?:log|note)|day summary)\b/i.test(m.text);
    for (const s of ss) {
      const t = s.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
      const min = t ? minutes(+t[1]!, +t[2]!) : minutes(d.getUTCHours(), d.getUTCMinutes());
      // an untimed sentence inside a multi-sentence note (a journal/summary) has no reliable time of day
      out.push({ mem: m, text: s, day: d, min, week: isoWeek(d), terms: new Set(terms(s)), timed: !!t || !summary });
    }
  }
  return out;
}

// ---------- (a) habits: recurring activity in a weekday x daypart slot ----------
export function mineHabits(rows: MemRow[], o = { minWeeks: 3, minRate: 0.6, minLift: 2, maxGlobalShare: 0.2 }): Candidate[] {
  const evs = events(rows.filter((r) => !r.tags.includes("insight") && !r.tags.includes("agent-run")));
  const days = new Set(evs.map((e) => e.day.toISOString().slice(0, 10)));
  const weeksFor = (w: number) => new Set([...days].filter((d) => new Date(d).getUTCDay() === w).map((d) => isoWeek(new Date(d)))).size;
  // structural words that appear everywhere (e.g. "journal", "chat") are not activities
  const df = new Map<string, number>(); for (const e of evs) for (const t of e.terms) df.set(t, (df.get(t) ?? 0) + 1);
  const generic = new Set([...df].filter(([, n]) => n / evs.length > o.maxGlobalShare).map(([t]) => t));
  const part = (e: Ev) => (e.timed ? daypart(Math.floor(e.min / 60)) : "day");
  const out: Candidate[] = [];
  for (let w = 0; w < 7; w++) for (const dp of ["morning", "afternoon", "evening", "night", "day"]) {
    const inSlot = evs.filter((e) => e.day.getUTCDay() === w && part(e) === dp);
    const peers = evs.filter((e) => e.day.getUTCDay() !== w && part(e) === dp); // same daypart, other weekdays
    const nWeeks = weeksFor(w); if (!inSlot.length || nWeeks < o.minWeeks) continue;
    const byTerm = new Map<string, Ev[]>();
    for (const e of inSlot) for (const t of e.terms) if (!generic.has(t)) (byTerm.get(t) ?? byTerm.set(t, []).get(t)!).push(e);
    const peerDays = new Set(peers.map((e) => e.day.toISOString().slice(0, 10))).size || 1;
    const strong: { t: string; evs: Ev[]; weeks: number }[] = [];
    for (const [t, es] of byTerm) {
      const weeks = new Set(es.map((e) => e.week)).size;
      if (weeks < o.minWeeks || weeks / nWeeks < o.minRate) continue;
      // lift: share of this weekday's weeks with the term vs share of other weekdays' days with it (same daypart)
      const peerHit = new Set(peers.filter((e) => e.terms.has(t)).map((e) => e.day.toISOString().slice(0, 10))).size;
      const lift = (weeks / nWeeks) / Math.max(0.5 / peerDays, peerHit / peerDays);
      if (lift >= o.minLift) strong.push({ t, evs: es, weeks });
    }
    const groups: { terms: string[]; evs: Set<Ev> }[] = [];
    for (const s of strong.sort((a, b) => b.evs.length - a.evs.length)) {
      const set = new Set(s.evs);
      const g = groups.find((g) => { const i = [...set].filter((e) => g.evs.has(e)).length; return i / (set.size + g.evs.size - i) >= 0.6; });
      if (g) { g.terms.push(s.t); for (const e of set) g.evs.add(e); } else groups.push({ terms: [s.t], evs: set });
    }
    for (const g of groups) {
      if (g.terms.length < 2) continue; // one shared word is not an activity
      const es = [...g.evs], weeks = new Set(es.map((e) => e.week)).size;
      const mems = [...new Map(es.map((e) => [e.mem.id, e.mem])).values()];
      const typical = dp === "day" ? null : fmt(median(es.map((e) => e.min)));
      const when = dp === "day" ? `${DAY[w]}s` : `${DAY[w]} ${dp}s`;
      const conf = Number(wilson(weeks, nWeeks).toFixed(2));
      out.push({
        sig: sig("habit", String(w), dp, g.terms.slice(0, 3).sort().join(",")), kind: "habit", confidence: conf, evidence: mems.map((m) => m.id), ...span(mems),
        method: `weekday x daypart frequency: ${weeks}/${nWeeks} ${DAY[w]}s, lift >= ${o.minLift} vs other weekdays, Wilson lower bound`, stats: { weekday: DAY[w], daypart: dp, weeks, weeksObserved: nWeeks, typicalTime: typical, terms: g.terms.slice(0, 8) },
        fallback: `On ${when} (${weeks} of ${nWeeks} weeks${typical ? `, typically around ${typical}` : ""}) Maya's notes mention: ${g.terms.slice(0, 6).join(", ")}.`,
        prompt: `Pattern found by frequency mining: on ${weeks} of ${nWeeks} ${DAY[w]}s${dp === "day" ? "" : `, in the ${dp} (typically around ${typical})`}, these terms recur far more than on other days: ${g.terms.slice(0, 8).join(", ")}. Evidence sentences:\n${es.slice(0, 8).map((e) => `[${e.mem.id}] ${e.text}`).join("\n")}`,
      });
    }
  }
  return out;
}

// ---------- (a2) usage: repeated requests to Clearmind ----------
export function mineUsage(rows: MemRow[], minCount = 3): Candidate[] {
  const by = new Map<string, { m: MemRow; min: number; w: number }[]>();
  for (const m of rows) for (const q of m.text.matchAll(/asked\s+["“]([^"”]{6,120})["”]/gi)) {
    const k = q[1]!.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
    const d = local(m.createdAt);
    (by.get(k) ?? by.set(k, []).get(k)!).push({ m, min: minutes(d.getUTCHours(), d.getUTCMinutes()), w: d.getUTCDay() });
  }
  const out: Candidate[] = [];
  for (const [q, xs] of by) {
    if (xs.length < minCount) continue;
    const wd = new Map<number, number>(); for (const x of xs) wd.set(x.w, (wd.get(x.w) ?? 0) + 1);
    const days = [...wd].sort((a, b) => b[1] - a[1]).map(([w]) => DAY[w]!);
    const weekdaysOnly = xs.every((x) => x.w >= 1 && x.w <= 5);
    const t = fmt(median(xs.map((x) => x.min)));
    const spread = Math.round(median(xs.map((x) => Math.abs(x.min - median(xs.map((y) => y.min))))));
    const mems = xs.map((x) => x.m);
    out.push({
      sig: sig("usage", q), kind: "usage", confidence: Number(Math.min(0.99, 1 - 1 / (1 + xs.length / 3)).toFixed(2)), evidence: mems.map((m) => m.id), ...span(mems),
      method: "repeated-request count + median time of day", stats: { request: q, count: xs.length, typicalTime: t, spreadMin: spread, days: weekdaysOnly ? "weekdays" : days.slice(0, 3).join(", ") },
      fallback: `Maya asks "${q}" repeatedly (${xs.length} times), usually around ${t} on ${weekdaysOnly ? "weekdays" : days.slice(0, 2).join(" and ")}.`,
      prompt: `Repeated request mined from chat logs: "${q}" asked ${xs.length} times, median time ${t} IST (median deviation ${spread} min), on ${weekdaysOnly ? "weekdays only" : days.join(", ")}. Sample evidence:\n${mems.slice(0, 6).map((m) => `[${m.id}] ${m.text.slice(0, 220)}`).join("\n")}`,
    });
  }
  return out;
}

// ---------- (b) web-agent workflows and failure signatures ----------
export interface Run { mem: MemRow; task: string; site: string; outcome: string; mins: number | null; steps: string[]; error: string | null; fix: string | null; at: string }
/** Parses "key: value | key: value" run logs (any agent that logs this way). */
export function parseRun(m: MemRow): Run | null {
  const f: Record<string, string> = {};
  for (const part of m.text.split(/\s+\|\s+/)) { const x = part.match(/^([a-z][a-z -]{1,20}):\s*([\s\S]+)$/i); if (x) f[x[1]!.toLowerCase().trim()] = x[2]!.trim(); }
  if (!f.task || !f.outcome) return null;
  const steps = (f.steps ?? "").split(/\s*\d+\)\s*/).map((s) => s.trim()).filter(Boolean);
  const mins = f.duration ? parseFloat(f.duration) : null;
  return { mem: m, task: f.task, site: f.site ?? "", outcome: f.outcome.toLowerCase(), mins: Number.isFinite(mins!) ? mins : null, steps, error: f.error ?? null, fix: f.fix ?? null, at: m.createdAt };
}
const normErr = (e: string) => e.toLowerCase().replace(/[;,].*$/, "").replace(/\d+(\.\d+)?/g, "N").trim();
export function mineWorkflows(rows: MemRow[]): Candidate[] {
  const runs = rows.map(parseRun).filter((r): r is Run => !!r).sort((a, b) => (a.at < b.at ? -1 : 1));
  const out: Candidate[] = [];
  const tasks = new Map<string, Run[]>(); for (const r of runs) (tasks.get(r.task) ?? tasks.set(r.task, []).get(r.task)!).push(r);
  for (const [task, rs] of tasks) {
    const ok = rs.filter((r) => r.outcome.startsWith("succ")), bad = rs.filter((r) => !r.outcome.startsWith("succ"));
    // failure signatures and what fixed them
    const sigs = new Map<string, Run[]>(); for (const r of bad) if (r.error) (sigs.get(normErr(r.error)) ?? sigs.set(normErr(r.error), []).get(normErr(r.error))!).push(r);
    for (const [e, fs] of sigs) {
      const last = fs[fs.length - 1]!;
      const fixRun = ok.find((r) => r.at > last.at && r.fix);
      const after = fixRun ? ok.filter((r) => r.at >= fixRun.at).length : 0;
      const laterFail = fixRun ? bad.some((r) => r.at > fixRun.at && r.error && normErr(r.error) === e) : false;
      const fixed = !!fixRun && !laterFail;
      const ev = [...fs, ...(fixRun ? [fixRun] : [])].map((r) => r.mem);
      const rel = [
        ...fs.slice(1).map((r) => ({ type: "same-signature" as const, from: fs[0]!.mem.id, to: r.mem.id })),
        ...(fixRun ? fs.map((r) => ({ type: "fixed-by" as const, from: r.mem.id, to: fixRun.mem.id })) : []),
      ];
      out.push({
        sig: sig("failure", task, e), kind: "failure", confidence: Number((1 - 1 / (2 + fs.length + after)).toFixed(2)), evidence: ev.map((m) => m.id), ...span(ev),
        method: "failure-signature grouping (normalised error) + first later success with a fix", relations: rel,
        stats: { task, site: fs[0]!.site, signature: e, failures: fs.length, lastFailure: last.at, fixed, fix: fixRun?.fix ?? null, fixedAt: fixRun?.at ?? null, successesAfterFix: after },
        fallback: `${task} on ${fs[0]!.site} failed ${fs.length} time(s) with "${e}"${fixed ? `; fixed: ${fixRun!.fix} (${after} successful run(s) since)` : "; not fixed yet"}.`,
        prompt: `Agent task "${task}" on ${fs[0]!.site}. Failure signature "${e}" occurred ${fs.length} time(s), last at ${last.at}. ${fixed ? `First later success applied this fix: "${fixRun!.fix}", and ${after} run(s) succeeded since, with no repeat of the failure.` : "No later fix found yet."} Write it as a lesson learned (what fails, why, and what to do). Evidence runs:\n${ev.map((m) => `[${m.id}] ${m.text.slice(0, 420)}`).join("\n")}`,
      });
    }
    // fastest reusable workflow: a step sequence used by >= 2 successful runs and faster than the rest
    const bySteps = new Map<string, Run[]>(); for (const r of ok) { const k = r.steps.join(" > ").toLowerCase(); (bySteps.get(k) ?? bySteps.set(k, []).get(k)!).push(r); }
    const variants = [...bySteps].filter(([, v]) => v.length >= 2 && v.every((r) => r.mins !== null)).map(([k, v]) => ({ k, v, med: median(v.map((r) => r.mins!)) })).sort((a, b) => a.med - b.med);
    const best = variants[0];
    if (best) {
      const rest = ok.filter((r) => !best.v.includes(r) && r.mins !== null);
      const restMed = rest.length ? median(rest.map((r) => r.mins!)) : null;
      const firstFix = best.v.map((r) => r.fix).find(Boolean) ?? ok.find((r) => r.fix && r.steps.join(" > ").toLowerCase() === best.k)?.fix ?? null;
      const ev = [...best.v, ...rest.slice(0, 3)].map((r) => r.mem);
      out.push({
        sig: sig("workflow", task, best.k), kind: "workflow", confidence: Number(wilson(best.v.length, best.v.length + bad.length).toFixed(2)), evidence: ev.map((m) => m.id), ...span(ev),
        method: "successful step-sequence clustering, fastest median duration", stats: { task, site: best.v[0]!.site, steps: best.v[0]!.steps, runs: best.v.length, medianMin: best.med, otherMedianMin: restMed, successRate: `${ok.length}/${rs.length}`, introducedBy: firstFix },
        fallback: `Fastest way to do ${task}: ${best.v[0]!.steps.join(" -> ")} (median ${best.med} min over ${best.v.length} runs${restMed !== null ? ` vs ${restMed} min otherwise` : ""}).`,
        prompt: `Agent task "${task}" on ${best.v[0]!.site}: ${ok.length}/${rs.length} runs succeeded. The fastest repeated step sequence (${best.v.length} runs, median ${best.med} min${restMed !== null ? `, vs ${restMed} min for other successful runs` : ""}) is: ${best.v[0]!.steps.join(" -> ")}.${firstFix ? ` It was introduced by: "${firstFix}".` : ""} Write it as a reusable workflow with the key steps. Evidence:\n${ev.map((m) => `[${m.id}] ${m.text.slice(0, 380)}`).join("\n")}`,
      });
    }
  }
  return out;
}

// ---------- (c) security and privacy findings ----------
const PW = /\b(?:password|passcode|passwd|pwd)\b(?:\s+(?:is|was|set to|=|:))?\s*["'“]?([^\s"'”,]{6,64})/gi;
const URL_RE = /\bhttps?:\/\/([a-z0-9.-]+)(\/[^\s"'”<>)]*)?/gi;
const RISK_PERM = /(read and change all (?:your )?data|all websites|read(?:,)? (?:and )?send (?:email|gmail|mail)|full access to (?:your )?(?:account|email|drive|files)|access to (?:all )?(?:your )?(?:contacts|files|email))/i;
const RESOLVE = /\b(revoked|rotated|removed|uninstalled|changed (?:the|my) password|reset (?:the|my) password|reported (?:it|the email))\b/i;
const registrable = (h: string) => h.split(".").slice(-2).join(".");
export function mineSecurity(rows: MemRow[]): Candidate[] {
  const out: Candidate[] = [];
  const resolvedBy = (m: MemRow, needle: string) => rows.find((x) => x.createdAt > m.createdAt && RESOLVE.test(x.text) && x.text.toLowerCase().includes(needle.toLowerCase()));
  // secrets pasted into chat (detector-based: API keys, tokens, cards)
  for (const m of rows) {
    const det = redactText(m.text).detections.filter((d) => ["api_key", "card", "private_key", "jwt", "aws_key", "secret"].includes(d.detector));
    if (!det.length) continue;
    const res = resolvedBy(m, "key");
    out.push({ sig: sig("security", "secret", m.id), kind: "security", severity: "high", confidence: 0.95, evidence: [m.id], ...span([m]), method: `secret detectors (${det.map((d) => d.detector).join(", ")})`,
      stats: { finding: "secret-in-chat", detectors: det.map((d) => d.detector) }, retire: res ? `resolved by ${res.id}` : undefined,
      fallback: `A secret (${det.map((d) => d.detector).join(", ")}) was pasted into chat; rotate it and redact the memory.`,
      prompt: `Security detector found a ${det.map((d) => d.detector).join(", ")} in a chat message (value redacted here): [${m.id}] ${redactText(m.text).text}\nWrite a short warning with the recommended action (rotate, redact).` });
  }
  // plaintext and reused passwords
  const pw = new Map<string, MemRow[]>();
  for (const m of rows) for (const x of m.text.matchAll(PW)) { const h = sig(x[1]!); (pw.get(h) ?? pw.set(h, []).get(h)!).push(m); }
  for (const [h, ms] of pw) {
    const services = [...new Set(ms.flatMap((m) => m.text.match(/\b[A-Z][a-z]+[A-Z][a-z]+\b|\b[a-z0-9-]+\.(?:com|example|in|io)\b/g) ?? []))];
    const reused = ms.length >= 2 && services.length >= 2;
    const res = resolvedBy(ms[ms.length - 1]!, "password");
    out.push({ sig: sig("security", "password", h), kind: "security", severity: reused ? "high" : "medium", confidence: reused ? 0.9 : 0.8, evidence: ms.map((m) => m.id), ...span(ms),
      method: "password-phrase extraction + hash comparison across memories (values never shown)", stats: { finding: reused ? "password-reuse" : "plaintext-password", services, occurrences: ms.length }, retire: res ? `resolved by ${res.id}` : undefined,
      fallback: reused ? `The same password is reused for ${services.join(" and ")} and was stored in chat in plain text.` : "A password was stored in chat in plain text.",
      prompt: `Detector: the same password string (hash ${h}, value withheld) appears in ${ms.length} memories${reused ? `, for different services: ${services.join(", ")}` : ""}. Evidence (passwords masked):\n${ms.map((m) => `[${m.id}] ${m.text.replace(PW, "password [MASKED]")}`).join("\n")}\nWrite a warning (${reused ? "password reuse" : "plaintext password"}) and the fix.` });
  }
  // phishing-like links: lookalike of a trusted domain, risky TLD, urgency; repeated = higher severity
  const trusted = new Set<string>(); for (const m of rows) for (const e of m.text.matchAll(/@([a-z0-9-]+\.[a-z.]+)/gi)) if (!/\.top$|\.xyz$|\.zip$/.test(e[1]!)) trusted.add(registrable(e[1]!.toLowerCase()));
  const brands = [...trusted].map((d) => d.split(".")[0]!).filter((b) => b.length >= 4);
  const hosts = new Map<string, MemRow[]>();
  for (const m of rows) for (const u of m.text.matchAll(URL_RE)) {
    const host = u[1]!.toLowerCase(), reg = registrable(host);
    const look = brands.some((b) => host.replace(/-/g, "").includes(b) && !trusted.has(reg));
    const tld = /\.(top|xyz|zip|click|country|gq|tk)$/.test(host) || /\.top\./.test(host);
    const lure = /verify|login|account|password|bank/i.test(u[0]!) && /(within \d+ hours|on hold|action required|urgent|suspended)/i.test(m.text);
    if ((look ? 1 : 0) + (tld ? 1 : 0) + (lure ? 1 : 0) >= 2) (hosts.get(host) ?? hosts.set(host, []).get(host)!).push(m);
  }
  for (const [host, ms] of hosts) out.push({ sig: sig("security", "phish", host), kind: "security", severity: ms.length >= 2 ? "high" : "medium", confidence: Number(Math.min(0.97, 0.6 + 0.15 * ms.length).toFixed(2)), evidence: ms.map((m) => m.id), ...span(ms),
    method: "URL heuristics: lookalike of a trusted sender domain + risky TLD + urgency/credential lure; repeats raise severity", stats: { finding: "phishing-link", host, emails: ms.length, trustedDomains: [...trusted] },
    fallback: `${ms.length} phishing-like emails link to ${host}, a lookalike of a trusted domain asking for bank details; do not click and report it.`,
    prompt: `Detector flagged ${ms.length} message(s) linking to ${host} (lookalike of trusted domains ${[...trusted].join(", ")}, risky TLD, urgency + credential lure). Evidence:\n${ms.map((m) => `[${m.id}] ${m.text}`).join("\n")}\nWrite a short security warning.` });
  // unusual sign-in locations: a place in a sign-in alert that never appears in the user's other memories
  for (const m of rows) {
    if (!/\b(sign-in|signed in|sign in|login|log-in)\b/i.test(m.text) || !/(wasn'?t you|not you|security)/i.test(m.text)) continue;
    const unseen = (p: string) => !rows.some((x) => x.id !== m.id && p.split(/,?\s+/).some((t) => new RegExp(`\\b${t}\\b`).test(x.text)));
    const place = [...m.text.matchAll(/\bfrom ([A-Z][a-z]+(?:,? [A-Z][a-z]+)?)\b/g)].map((x) => x[1]!).find(unseen);
    if (!place) continue;
    const res = resolvedBy(m, "password");
    out.push({ sig: sig("security", "login", m.id), kind: "security", severity: "high", confidence: 0.85, evidence: [m.id], ...span([m]), method: "sign-in alert location vs places in the user's own history",
      stats: { finding: "unusual-login", place }, retire: res ? `resolved by ${res.id}` : undefined,
      fallback: `Unusual sign-in from ${place}, a place never seen in your history; reset the password and check sessions.`,
      prompt: `A sign-in alert reports a login from ${place}; that place never appears in the user's other memories. Evidence:\n[${m.id}] ${m.text}\nWrite a short security warning with actions.` });
  }
  // risky permissions granted to apps/extensions
  for (const m of rows) {
    const p = m.text.match(RISK_PERM); if (!p || !/\b(allow|allowed|granted|accepted|approved)\b/i.test(m.text)) continue;
    const app = m.text.match(/['"“]([^'"”]{2,40})['"”]/)?.[1] ?? "an app";
    const res = resolvedBy(m, app);
    out.push({ sig: sig("security", "perm", m.id), kind: "security", severity: "medium", confidence: 0.8, evidence: [m.id], ...span([m]), method: "risky-permission phrase + grant verb",
      stats: { finding: "risky-permission", app, permission: p[1] }, retire: res ? `resolved by ${res.id}` : undefined,
      fallback: `${app} was granted broad permissions (${p[1]}); review or remove it.`,
      prompt: `Detector: ${app} was granted the permission "${p[1]}". Evidence:\n[${m.id}] ${m.text}\nWrite a short risk note with the recommended action.` });
  }
  return out;
}

export function mineAll(rows: MemRow[]): Candidate[] {
  const raw = rows.filter((r) => !r.tags.includes("insight"));
  const d = (iso: string) => local(iso).toISOString().slice(0, 10);
  // every prompt states the observed period so the wording cannot stretch or shrink it
  return [...mineHabits(raw), ...mineUsage(raw), ...mineWorkflows(raw), ...mineSecurity(raw)].map((c) => ({ ...c, prompt: `Observed period: ${d(c.firstSeen)} to ${d(c.lastSeen)}.\n${c.prompt}` }));
}

export const REFLECT_SYSTEM = `You turn ONE mined pattern into ONE insight about the user (Maya). Use only the evidence lines given; do not invent details. Describe the recurring pattern, not details that occur only once. Keep the counts, period and times exactly as given. Reply with JSON only: {"statement": "<one or two sentences, at most 45 words, specific (times, sites, counts)>", "cite": ["<ids from the evidence that support it>"]}.`;

/** Merge freshly mined candidates with the previous insight set: new / confirmed / retired. */
export function reconcile(prev: Insight[], fresh: (Candidate & { statement: string })[], now: string): Insight[] {
  const old = new Map(prev.map((i) => [i.sig, i]));
  const out: Insight[] = [];
  for (const c of fresh) {
    const p = old.get(c.sig); old.delete(c.sig);
    const { fallback: _f, prompt: _p, retire, ...rest } = c;
    const status: InsightStatus = retire ? "retired" : p && p.status !== "retired" ? "confirmed" : "new";
    out.push({ ...rest, id: p?.id ?? `INS-${c.sig}`, status, ...(retire ? { retiredReason: retire } : {}), derivedAt: now, memoryId: p?.memoryId });
  }
  for (const p of old.values()) out.push(p.status === "retired" ? p : { ...p, status: "retired", retiredReason: "no longer supported by the data", derivedAt: now });
  return out;
}
