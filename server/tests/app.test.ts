import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "@clearmind/core";
import { createApp } from "../src/index.js";

let base = "";
let close: () => Promise<void> = async () => {};

beforeAll(async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "cm-srv-"));
  const appDir = mkdtempSync(join(tmpdir(), "cm-web-"));
  mkdirSync(join(appDir, "assets"));
  writeFileSync(join(appDir, "index.html"), "<!doctype html><title>Clearmind</title>");
  writeFileSync(join(appDir, "assets", "main.js"), "console.log(1)");
  const app = createApp(loadConfig({ overrides: { dataDir } }), { offline: true, appDir });
  const srv = createServer((req, res) => void app.handle(req, res));
  await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  close = async () => {
    srv.close();
    await app.close();
  };
});
afterAll(() => close());

const post = (path: string, body: unknown, cookie = "") =>
  fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify(body) });

describe("server", () => {
  it("serves the web app with a CSP, and its assets", async () => {
    const page = await fetch(base + "/");
    expect(page.status).toBe(200);
    expect(page.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(await page.text()).toContain("Clearmind");
    expect((await fetch(base + "/assets/main.js")).headers.get("content-type")).toContain("javascript");
    expect((await fetch(base + "/assets/..%2f..%2fetc%2fpasswd")).status).toBe(404);
  });

  it("requires sign-in and JSON bodies", async () => {
    const r = await fetch(base + "/api/state");
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: "sign in first", signIn: true });
    const bad = await fetch(base + "/api/memories", { method: "POST", body: "x" });
    expect(bad.status).toBe(415);
  });

  it("keeps users apart", async () => {
    const cookieFor = async (u: string) => (await post("/api/session", { userId: u })).headers.get("set-cookie")!.split(";")[0]!;
    const a = await cookieFor("alice");
    const b = await cookieFor("bob");
    expect((await post("/api/memories", { text: "Alice likes tea", tags: ["food"] }, a)).status).toBe(200);
    const mine: any = await (await fetch(base + "/api/memories", { headers: { cookie: a } })).json();
    const theirs: any = await (await fetch(base + "/api/memories", { headers: { cookie: b } })).json();
    expect(mine.items.map((m: { text: string }) => m.text)).toEqual(["Alice likes tea"]);
    expect(theirs.items).toEqual([]);
    const st: any = await (await fetch(base + "/api/state", { headers: { cookie: a } })).json();
    expect(st.owner).toBe("alice");
    expect(st.memories.active).toBe(1);
  });

  it("returns 404 for unknown API routes", async () => {
    const cookie = (await post("/api/session", { userId: "carol" })).headers.get("set-cookie")!.split(";")[0]!;
    expect((await fetch(base + "/api/nope", { headers: { cookie } })).status).toBe(404);
  });
});
