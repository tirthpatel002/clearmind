import { describe, expect, it } from "vitest";
import { mineHabits, mineSecurity, mineUsage, mineWorkflows, parseRun, reconcile, wilson } from "../src/reflect.js";
import type { MemRow } from "../src/reflect.js";

const IST = (d: string, t: string) => new Date(Date.parse(`${d}T${t}:00+05:30`)).toISOString();
let n = 0; const row = (createdAt: string, text: string, tags: string[] = []): MemRow => ({ id: `M${String(n++).padStart(11, "0")}`, text, createdAt, tags });
const days = (start: string, count: number) => Array.from({ length: count }, (_, i) => new Date(Date.parse(start) + i * 86400e3).toISOString().slice(0, 10));

describe("reflect miners", () => {
  it("wilson lower bound grows with evidence", () => { expect(wilson(3, 3)).toBeLessThan(wilson(10, 10)); expect(wilson(0, 5)).toBe(0); });
  it("finds a weekday-evening habit and ignores everyday activities", () => {
    const rows: MemRow[] = [];
    for (const d of days("2026-01-05", 35)) {
      rows.push(row(IST(d, "08:00"), "Drank coffee and read the news."));
      if (new Date(d).getUTCDay() === 3) rows.push(row(IST(d, "18:40"), "At 18:40 went rock climbing with Ana at the Granite Wall gym."));
    }
    const h = mineHabits(rows);
    expect(h).toHaveLength(1);
    expect(h[0]!.stats.weekday).toBe("Wednesday");
    expect(h[0]!.stats.daypart).toBe("evening");
    expect(h[0]!.evidence.length).toBe(5);
  });
  it("counts repeated requests with their usual time", () => {
    const rows = days("2026-01-05", 5).map((d) => row(IST(d, "07:30"), `Maya asked "summarise my inbox" on the phone.`));
    const u = mineUsage(rows);
    expect(u[0]!.stats.count).toBe(5);
    expect(u[0]!.stats.typicalTime).toBe("07:30");
  });
  it("links a failure signature to the run that fixed it, and finds the fastest workflow", () => {
    const L = (d: string, o: string, mins: number, steps: string, extra = "") => row(IST(d, "10:00"), `Agent run | task: pay-bill | site: power.example | outcome: ${o} | duration: ${mins} min | steps: ${steps}${extra ? ` | ${extra}` : ""}`, ["agent-run"]);
    const slow = "1) open site 2) log in 3) type account 4) pay";
    const rows = [L("2026-02-01", "success", 9, slow), L("2026-02-08", "failed", 4, slow, "error: captcha after 2 failed logins"), L("2026-02-09", "success", 3, "1) open site 2) use saved session 3) pay", "fix: reuse the saved session"), L("2026-02-15", "success", 2, "1) open site 2) use saved session 3) pay")];
    expect(parseRun(rows[1]!)!.error).toContain("captcha");
    const w = mineWorkflows(rows);
    const f = w.find((c) => c.kind === "failure")!;
    expect(f.stats.fixed).toBe(true);
    expect(f.relations!.some((r) => r.type === "fixed-by" && r.to === rows[2]!.id)).toBe(true);
    const best = w.find((c) => c.kind === "workflow")!;
    expect(best.stats.medianMin).toBeLessThan(9);
  });
  it("flags secrets, reused passwords, lookalike links, unusual logins and risky permissions", () => {
    const rows = [
      row(IST("2026-03-01", "09:00"), "Email from Acme IT <it@acmecorp.example>: the laptop refresh is next week."),
      row(IST("2026-03-02", "09:00"), "Here is the key sk_" + "live_FAKEabcdef0123456789abcd for the webhook."),
      row(IST("2026-03-03", "09:00"), "Remember my ShopKart login, password is Tiger#9911."),
      row(IST("2026-03-04", "09:00"), "Use it for BankEasy too, password Tiger#9911."),
      row(IST("2026-03-05", "09:00"), "Payroll: your salary is on hold, verify within 24 hours at http://acmecorp-pay.verify.example.top/login"),
      row(IST("2026-03-06", "03:00"), "Security alert: new sign-in from Lagos, Nigeria. If this wasn't you, reset your password."),
      row(IST("2026-03-07", "09:00"), "Installed the 'PageBuddy' extension and clicked Allow so it can read and change all data on all websites."),
    ];
    const f = mineSecurity(rows).map((c) => c.stats.finding);
    expect(f).toEqual(expect.arrayContaining(["secret-in-chat", "password-reuse", "phishing-link", "unusual-login", "risky-permission"]));
  });
  it("reconcile marks new, confirmed and retired", () => {
    const c = { sig: "a", kind: "habit" as const, confidence: 0.5, evidence: ["X"], firstSeen: "t", lastSeen: "t", method: "", stats: {}, fallback: "", prompt: "", statement: "s" };
    const one = reconcile([], [c], "n1");
    expect(one[0]!.status).toBe("new");
    expect(reconcile(one, [c], "n2")[0]!.status).toBe("confirmed");
    expect(reconcile(one, [], "n2")[0]!.status).toBe("retired");
  });
});
