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

describe("self-added workspace users", () => {
  it("POST /api/workspace/users creates a persisted member with a unique numbered id", async () => {
    const add = (name: unknown) => fetch(base + "/api/workspace/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    const a: any = await (await add("  Jane   Doe ")).json();
    expect(a).toEqual({ id: "user-jane-doe-0001", name: "Jane Doe" });
    const b: any = await (await add("Jane Doe")).json();
    expect(b.id).toBe("user-jane-doe-0002");
    expect((await add("")).status).toBe(400);
    expect((await add("x".repeat(61))).status).toBe(400);
    const list: any = await (await fetch(base + "/api/workspace/users")).json();
    expect(list.users.map((u: any) => u.id)).toEqual(expect.arrayContaining([a.id, b.id]));
    expect(list.users.length).toBe(users.length + 2);
    const s = await fetch(base + "/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: a.id }) });
    const me: any = await s.json();
    expect(me.viewer).toEqual({ id: a.id, admin: false });
    // rate limit: 5 per minute per address
    let limited = false;
    for (let i = 0; i < 6; i++) if ((await add("Spam " + i)).status === 429) limited = true;
    expect(limited).toBe(true);
  });

  it("persists across reloads and never reuses numbers", async () => {
    const { Workspace } = await import("../src/workspace.js");
    const d = mkdtempSync(join(tmpdir(), "cm-wsadd-")), f = join(d, "added.json");
    const w1 = new Workspace(users as any).attachAdded(f);
    expect(w1.add("Ann Lee").id).toBe("user-ann-lee-0001");
    const w2 = new Workspace(users as any).attachAdded(f);
    expect(w2.byId.get("user-ann-lee-0001")?.name).toBe("Ann Lee");
    expect(w2.add("Ann Lee").id).toBe("user-ann-lee-0002");
    expect(w2.viewer("user-ann-lee-0002")).toEqual({ id: "user-ann-lee-0002", admin: false });
    expect(() => w2.add("   ")).toThrow();
  });
});
