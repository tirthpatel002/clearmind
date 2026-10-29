// Sign-in and sign-out. These run before authentication.
import type { ServerResponse } from "node:http";
import type { AuthProvider } from "../auth.js";
import { sendJson } from "../http.js";

export async function signIn(res: ServerResponse, auth: AuthProvider, body: any): Promise<void> {
  const cookie = auth.signIn(String(body.userId ?? ""));
  sendJson(res, 200, { user: String(body.userId) }, { "Set-Cookie": cookie });
}

export function signOut(res: ServerResponse, auth: AuthProvider): void {
  sendJson(res, 200, { ok: true }, { "Set-Cookie": auth.signOut() });
}
