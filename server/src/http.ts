// Small HTTP helpers: JSON bodies, JSON replies and typed errors.
import type { IncomingMessage, ServerResponse } from "node:http";
import { gzipSync, createGzip } from "node:zlib";

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
  sendBody(res, code, JSON.stringify(data), { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers });
}

/** Whether the client accepts gzip (res.req is the request this response answers). */
export const acceptsGzip = (res: ServerResponse) => /\bgzip\b/.test(String(res.req?.headers?.["accept-encoding"] ?? ""));

/** End a response, gzipped (level 4) when the client accepts it and the body is over 1 KB. */
export function sendBody(res: ServerResponse, code: number, body: string | Buffer, headers: Record<string, string>): void {
  const buf = typeof body === "string" ? Buffer.from(body) : body;
  if (buf.length > 1024 && acceptsGzip(res)) {
    res.writeHead(code, { ...headers, "Content-Encoding": "gzip", Vary: "Accept-Encoding" });
    res.end(gzipSync(buf, { level: 4 }));
    return;
  }
  res.writeHead(code, { ...headers, Vary: "Accept-Encoding" });
  res.end(buf);
}

/** A route reply streamed as Server-Sent Events: `meta` first, then one `batch` per yielded object, then `done`. */
export class SseReply {
  constructor(
    readonly meta: () => Promise<Record<string, unknown>>,
    readonly batches: () => AsyncIterable<Record<string, unknown>>,
  ) {}
}

/** Write an SseReply: flushes after each event, yields to the event loop between batches, stops when the client goes. */
export async function sendSse(req: IncomingMessage, res: ServerResponse, r: SseReply): Promise<void> {
  let closed = false;
  req.on("close", () => { closed = true; });
  const gzip = /\bgzip\b/.test(String(req.headers["accept-encoding"] ?? ""));
  res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no", ...(gzip ? { "Content-Encoding": "gzip", Vary: "Accept-Encoding" } : {}) });
  res.flushHeaders?.();
  const gz = gzip ? createGzip({ level: 4 }) : null;
  if (gz) gz.pipe(res);
  const send = (event: string, data: unknown) => {
    if (closed) return;
    const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    if (gz) { gz.write(chunk); gz.flush(); } else res.write(chunk);
  };
  try {
    send("meta", await r.meta());
    for await (const b of r.batches()) {
      if (closed) break;
      send("batch", b);
      await new Promise<void>((ok) => setImmediate(ok));
    }
    send("done", {});
  } catch (e) {
    send("error", { message: (e as Error).message });
  }
  if (gz) gz.end(); else if (!closed) res.end();
}
