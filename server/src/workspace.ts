// Single-workspace users: a JSON file (auth.workspaceUsers / CLEARMIND_WORKSPACE_USERS) listing who may sign in.
// Everyone shares the owner's store; each request carries a viewer that core read paths filter on.
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { validUserId } from "@clearmind/core";

export type Role = "admin" | "member" | "guest";
export interface WorkspaceUser { id: string; name: string; role: Role; title?: string; org?: string; avatar?: string }
export interface Viewer { id: string; admin?: boolean }

declare module "node:http" {
  interface IncomingMessage {
    /** Who is looking; set for every API request (undefined = not signed in). */
    viewer?: Viewer;
  }
}

export class Workspace {
  readonly byId = new Map<string, WorkspaceUser>();

  constructor(users: WorkspaceUser[]) {
    for (const u of users) {
      if (!validUserId(u?.id)) throw new Error(`workspace users: bad id ${JSON.stringify(u?.id)}`);
      if (!["admin", "member", "guest"].includes(u.role)) throw new Error(`workspace users: bad role for ${u.id}`);
      if (typeof u.name !== "string" || !u.name) throw new Error(`workspace users: ${u.id} needs a name`);
      if (this.byId.has(u.id)) throw new Error(`workspace users: duplicate id ${u.id}`);
      this.byId.set(u.id, u);
    }
  }

  /** Where self-added users persist (in the data dir, never the repo file); null = adding disabled. */
  private addedFile: string | null = null;
  private nextNo = 1;
  private addedIds = new Set<string>();

  static load(file: string, addedFile?: string): Workspace {
    const j = JSON.parse(readFileSync(file, "utf8"));
    const ws = new Workspace(Array.isArray(j) ? j : j.users);
    if (addedFile) ws.attachAdded(addedFile);
    return ws;
  }

  /** Load previously self-added users from `file` and persist new ones there. */
  attachAdded(file: string): this {
    this.addedFile = file;
    if (existsSync(file)) {
      const j = JSON.parse(readFileSync(file, "utf8"));
      this.nextNo = Math.max(1, Number(j.next) || 1);
      for (const u of j.users ?? []) if (validUserId(u?.id) && !this.byId.has(u.id) && typeof u.name === "string") { this.byId.set(u.id, { id: u.id, name: u.name, role: "member" }); this.addedIds.add(u.id); }
    }
    return this;
  }

  get canAdd(): boolean { return !!this.addedFile; }

  /** Create a member from a display name: id = user-<slug>-<NNNN>, number from a persisted counter (never reused). */
  add(rawName: unknown): WorkspaceUser {
    if (!this.addedFile) throw new Error("adding users is disabled");
    const name = typeof rawName === "string" ? rawName.trim().replace(/\s+/g, " ") : "";
    if (!name || name.length > 60) throw new Error("name must be 1-60 characters");
    const slug = name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "") || "user";
    let id: string;
    do id = `user-${slug}-${String(this.nextNo++).padStart(4, "0")}`; while (this.byId.has(id) || !validUserId(id));
    const u: WorkspaceUser = { id, name, role: "member" };
    this.byId.set(id, u);
    this.addedIds.add(id);
    const tmp = this.addedFile + ".tmp";
    writeFileSync(tmp, JSON.stringify({ next: this.nextNo, users: [...this.addedIds].map((i) => ({ id: i, name: this.byId.get(i)!.name })) }, null, 1));
    renameSync(tmp, this.addedFile);
    return u;
  }

  /** The public list: no avatar URLs beyond what the file holds, nothing else. */
  list(): Omit<WorkspaceUser, never>[] {
    return [...this.byId.values()].map(({ id, name, role, title, org, avatar }) => ({ id, name, role, title, org, avatar }));
  }

  viewer(id: string | null): Viewer | undefined {
    const u = id ? this.byId.get(id) : undefined;
    return u ? { id: u.id, admin: u.role === "admin" } : undefined;
  }
}
