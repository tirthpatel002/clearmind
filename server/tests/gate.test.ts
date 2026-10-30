import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { accessGate, resolveAccessToken } from "../src/gate.js";

const TOKEN = "abcDEFghjkMNpqrs";
const ok = (_q: IncomingMessage, s: ServerResponse) => { s.writeHead(200, { "Content-Type": "text/plain" }); s.end("app"); };
const servers: Array<() => void> = [];
async function start(token: string | undefined) {
  const gate = accessGate(token);
  const srv = createServer((q, s) => { if (gate(q, s)) ok(q, s); });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  servers.push(() => srv.close());
  return `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
}
let base = "";
beforeAll(async () => { base = await start(TOKEN); });
afterAll(() => servers.forEach((c) => c()));
const get = (p: string, cookie = "") => fetch(base + p, { redirect: "manual", headers: cookie ? { cookie } : {} });

describe("access gate", () => {
  it("no token → 403 HTML page, and JSON for /api", async () => {
    const r = await get("/");
    expect(r.status).toBe(403);
    expect(await r.text()).toContain("Access required");
    for (const p of ["/assets/main.js", "/favicon.ico", "/index.html"]) expect((await get(p)).status).toBe(403);
    const a = await get("/api/demo/config");
    expect(a.status).toBe(403);
    expect(await a.json()).toEqual({ error: "access token required" });
  });
  it("wrong token → 403", async () => {
    expect((await get("/?token=abcDEFghjkMNpqrX")).status).toBe(403);
    expect((await get("/?token=short")).status).toBe(403);
    expect((await get("/", "cm_access=forged")).status).toBe(403);
  });
  it("correct token → 302 without the param, HttpOnly cookie; cookie → 200", async () => {
    const r = await get(`/?x=1&token=${TOKEN}`);
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("/?x=1");
    const sc = r.headers.get("set-cookie") ?? "";
    expect(sc).toMatch(/cm_access=/);
    expect(sc).toMatch(/HttpOnly/);
    expect(sc).toMatch(/SameSite=Lax/);
    expect(sc).not.toContain(TOKEN);
    expect(sc).not.toMatch(/Secure/);
    const https = await fetch(base + `/?token=${TOKEN}`, { redirect: "manual", headers: { "x-forwarded-proto": "https" } });
    expect(https.headers.get("set-cookie")).toMatch(/Secure/);
    const px = await fetch(base + `/?token=${TOKEN}`, { redirect: "manual", headers: { "x-forwarded-prefix": "/clearmind" } });
    expect(px.headers.get("location")).toBe("/clearmind/");
    const cookie = sc.split(";")[0];
    const ok2 = await get("/api/demo/config", cookie);
    expect(ok2.status).toBe(200);
    expect(await ok2.text()).toBe("app");
  });
  it("gate is off when unconfigured", async () => {
    const off = await start(resolveAccessToken({ env: {} }));
    expect((await fetch(off + "/")).status).toBe(200);
    expect((await fetch(off + "/api/x")).status).toBe(200);
  });
});
