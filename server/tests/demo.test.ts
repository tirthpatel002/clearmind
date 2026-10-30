import { describe, expect, it } from "vitest";
import { bm25, numbers, rrf } from "../src/routes/demo.js";

describe("demo routes helpers", () => {
  it("bm25 ranks keyword matches and drops non-matches", () => {
    const r = bm25("standup time", [{ id: "a", text: "Team standup is at 10:00" }, { id: "b", text: "Gym run" }, { id: "c", text: "standup moved, new time 11:00" }]);
    expect(r.map((x) => x.id)).toEqual(["c", "a"]);
  });
  it("rrf fuses two rankings", () => {
    const f = rrf([[{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }]], 60);
    expect(f[0]!.id).toBe("b");
    expect(f[0]!.score).toBeCloseTo(1 / 62 + 1 / 61, 6);
  });
  it("numbers reports unavailable without an eval dir", () => {
    expect(numbers("/nonexistent")).toEqual({ available: false });
  });
});

import { isPhone, redactText } from "../src/redact.js";
describe("redaction", () => {
  it("redacts international phone numbers and emails", () => {
    const r = redactText("Dr. Rao: call +91 98765 43210 or email clinic@example.com");
    expect(r.text).toBe("Dr. Rao: call [REDACTED:phone] or email [REDACTED:email]");
    expect(r.detections.map((d) => d.detector).sort()).toEqual(["email", "phone"]);
  });
  it("handles other international formats", () => {
    for (const p of ["+44 20 7946 0958", "+1 (415) 555-0132", "+91-98765-43210", "098765 43210"]) expect(redactText(`call ${p} today`).text).toBe("call [REDACTED:phone] today");
  });
  it("leaves dates, times and small numbers alone", () => {
    for (const s of ["on 2026-10-28 at 11:00", "ran 5 km in 31 minutes", "order #4471 for 2 people", "flight 6E 2134"]) expect(redactText(s).text).toBe(s);
    expect(isPhone("2026-10-28")).toBe(false);
  });
});
