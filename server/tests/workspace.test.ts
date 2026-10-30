import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "@clearmind/core";
import { createApp } from "../src/index.js";

let base = "";
let close: () => Promise<void> = async () => {};
const users = [
  { id: "admin", name: "Workspace admin", role: "admin" },
  { id: "m-one", name: "Member One", role: "member", title: "Engineer", org: "Acme" },
  { id: "guest", name: "Guest", role: "guest" },
];

beforeAll(async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "cm-ws-"));
  const file = join(dataDir, "users.json");
  writeFileSync(file, JSON.stringify({ users }));
  const app = createApp(loadConfig({ overrides: { dataDir, "auth.defaultUser": "owner", "auth.workspaceUsers": file } }), { offline: true, appDir: dataDir });
  const srv = createServer((req, res) => void app.handle(req, res));
  await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  close = async () => { srv.close(); await app.close(); };
});
afterAll(() => close());

const signIn = (userId: string) =>
  fetch(base + "/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
const cookieOf = (r: Response) => r.headers.get("set-cookie")!.split(";")[0]!;
const session = async (cookie = "") => (await fetch(base + "/api/session", { headers: { cookie } })).json() as Promise<any>;

describe("workspace sign-in", () => {
  it("lists workspace users publicly", async () => {
    const r: any = await (await fetch(base + "/api/workspace/users")).json();
    expect(r.users.map((u: any) => u.id)).toEqual(["admin", "m-one", "guest"]);
    expect(r.users[1]).toMatchObject({ name: "Member One", title: "Engineer", org: "Acme", role: "member" });
  });

  it("requires a session for data, and reports none", async () => {
    expect((await fetch(base + "/api/state")).status).toBe(401);
    expect(await session()).toEqual({ workspace: true, viewer: null, profile: null });
  });

  it("sets and reads a session; viewer reflects the role", async () => {
    const m = await signIn("m-one");
    expect(m.status).toBe(200);
    const s = await session(cookieOf(m));
    expect(s.viewer).toEqual({ id: "m-one", admin: false });
    expect(s.profile.name).toBe("Member One");
    expect((await session(cookieOf(await signIn("admin")))).viewer).toEqual({ id: "admin", admin: true });
    expect((await session(cookieOf(await signIn("guest")))).viewer).toEqual({ id: "guest", admin: false });
  });

  it("everyone reads the owner's store", async () => {
    const st: any = await (await fetch(base + "/api/state", { headers: { cookie: cookieOf(await signIn("m-one")) } })).json();
    expect(st.owner).toBe("owner");
  });

  it("rejects ids not in the users file", async () => {
    const r = await signIn("mallory");
    expect(r.status).toBe(403);
    expect(r.headers.get("set-cookie")).toBeNull();
  });

  it("rejects a tampered cookie", async () => {
    const c = cookieOf(await signIn("m-one"));
    const forged = c.replace("m-one", "admin");
    expect((await session(forged)).viewer).toBeNull();
    expect((await fetch(base + "/api/state", { headers: { cookie: forged } })).status).toBe(401);
    expect((await fetch(base + "/api/state", { headers: { cookie: c + "x" } })).status).toBe(401);
  });

  it("signs out with DELETE", async () => {
    const r = await fetch(base + "/api/session", { method: "DELETE" });
    expect(r.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
