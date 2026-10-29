// Small HTTP helpers: JSON bodies, JSON replies and typed errors.
import type { IncomingMessage, ServerResponse } from "node:http";

export class HttpError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

/** Read a JSON body of at most `max` characters ({} when empty). */
export async function readJson(req: IncomingMessage, max: number): Promise<any> {
  let s = "";
  for await (const chunk of req) {
    s += chunk;
    if (s.length > max) throw new HttpError(413, "body too large");
  }
  try {
    return s ? JSON.parse(s) : {};
  } catch {
    throw new HttpError(400, "body is not JSON");
  }
}

export function sendJson(res: ServerResponse, code: number, data: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers });
  res.end(JSON.stringify(data));
}
