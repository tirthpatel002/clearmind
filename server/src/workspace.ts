// Single-workspace users: a JSON file (auth.workspaceUsers / CLEARMIND_WORKSPACE_USERS) listing who may sign in.
// Everyone shares the owner's store; each request carries a viewer that core read paths filter on.
import { readFileSync } from "node:fs";
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

  static load(file: string): Workspace {
    const j = JSON.parse(readFileSync(file, "utf8"));
    return new Workspace(Array.isArray(j) ? j : j.users);
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
