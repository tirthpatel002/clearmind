// Sign-in and sign-out. These run before authentication.
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthProvider } from "../auth.js";
import { HttpError, sendJson } from "../http.js";
import type { Workspace } from "../workspace.js";

export async function signIn(res: ServerResponse, auth: AuthProvider, body: any, ws?: Workspace | null): Promise<void> {
  const id = String(body.userId ?? "");
  if (ws && !ws.byId.has(id)) throw new HttpError(403, "not a workspace user");
  const cookie = auth.signIn(id);
  sendJson(res, 200, ws ? { user: id, viewer: ws.viewer(id), profile: ws.byId.get(id) } : { user: id }, { "Set-Cookie": cookie });
}

export function signOut(res: ServerResponse, auth: AuthProvider): void {
  sendJson(res, 200, { ok: true }, { "Set-Cookie": auth.signOut() });
}

/** Who is signed in (req.viewer, already resolved by the app). */
export function whoAmI(req: IncomingMessage, res: ServerResponse, ws?: Workspace | null): void {
  const v = req.viewer;
  sendJson(res, 200, { workspace: !!ws, viewer: v ?? null, profile: ws && v ? ws.byId.get(v.id) ?? null : null });
}
