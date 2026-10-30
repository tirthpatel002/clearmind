import { mkdtempSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig, type Viewer } from "@clearmind/core";
import { createApp } from "../src/index.js";

// The viewer comes from req.viewer (here: a test resolver keyed on a test-only cookie, standing in for tenancy's session).
let base = "", close = async () => {}, cookie = "";
const viewers: Record<string, Viewer> = { a: { id: "p-a" }, b: { id: "p-b" }, g: { id: "guest" }, admin: { id: "admin", admin: true } };
const as = (v: string) => ({ cookie: `${cookie}; tv=${v}` });
const get = async (p: string, v: string) => (await fetch(base + p, { headers: as(v) })).json() as Promise<any>;
const post = (p: string, body: unknown, v: string) => fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json", ...as(v) }, body: JSON.stringify(body) });

beforeAll(async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "cm-papi-"));
  const app = createApp(loadConfig({ overrides: { dataDir } }), {
    offline: true, appDir: mkdtempSync(join(tmpdir(), "cm-web-")),
    resolveViewer: (req) => viewers[/tv=(\w+)/.exec(req.headers.cookie ?? "")?.[1] ?? "g"],
  });
  const srv = createServer((req, res) => void app.handle(req, res));
  await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  cookie = (await post("/api/session", { userId: "ws1" }, "admin")).headers.get("set-cookie")!.split(";")[0]!;
  close = async () => { srv.close(); await app.close(); };
});
afterAll(() => close());

describe("visibility over the API", () => {
  it("isolates private items per viewer on every read route", async () => {
    await post("/api/memories", { text: "Shared fact: the demo room is Hall 3" }, "admin");
    const r = await post("/api/memories", { text: "Zephyrine Quillfeather keeps the vault code 4242", visibleTo: ["p-b"] }, "b");
    const priv = await r.json() as any;
    expect(priv.visibleTo).toEqual(["p-b"]);
    // a restricted viewer cannot share into someone else's private space
    const sneaky = await (await post("/api/memories", { text: "A tries to write as B only", visibleTo: ["p-b"] }, "a")).json() as any;
    expect(sneaky.visibleTo).toBeUndefined();
    for (const v of ["a", "g"]) {
      const all = JSON.stringify([
        await get("/api/memories?status=all", v), await get("/api/memories?q=vault", v), await get("/api/graph", v),
        await get("/api/entities", v), await get("/api/entities/links", v), await get("/api/insights", v), await get("/api/state", v),
        await get(`/api/memories/${priv.id}/history`, v),
        (await get("/api/entities/search?q=Zephyrine", v)).hits,
        await get("/api/demo/graph", v), await get("/api/demo/timeline", v), await get("/api/demo/privacy", v),
        await get("/api/demo/insights", v), await get("/api/demo/learning", v), await get("/api/demo/inspect?q=vault%20code", v),
      ]);
      expect(all).not.toMatch(/4242|Zephyrine/);
    }
    expect(JSON.stringify(await get("/api/memories", "b"))).toMatch(/4242/);
    expect(JSON.stringify(await get("/api/entities", "b"))).toMatch(/Zephyrine/);
    expect(JSON.stringify(await get("/api/demo/graph", "b"))).toMatch(/4242/);
    expect((await post("/api/demo/forget", { id: priv.id }, "a")).status).toBe(404);
    expect(JSON.stringify(await get("/api/memories", "admin"))).toMatch(/4242/);
    expect(JSON.stringify(await get("/api/memories", "g"))).toMatch(/Hall 3/);
    expect((await get("/api/state", "g")).memories.active).toBe(2); // shared + A's workspace write
    expect((await get("/api/state", "admin")).memories.active).toBe(3);
  });
});
