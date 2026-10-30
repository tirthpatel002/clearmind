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
