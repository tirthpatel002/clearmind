// Pluggable identity. LocalAuth is a stub for single-machine use: the user id comes from a signed cookie
// (set by POST /api/session) or, when configured, a default user. Swap in a real provider by implementing AuthProvider.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { validUserId } from "@clearmind/core";

export interface AuthProvider {
  /** The signed-in user for this request, or null. */
  identify(req: IncomingMessage): string | null;
  /** The user from a valid session only (no default fallback), or null. */
  session?(req: IncomingMessage): string | null;
  /** Start a session; returns a Set-Cookie header value. Providers without local sessions may throw. */
  signIn(userId: string): string;
  signOut(): string;
}

const COOKIE = "cm_session";

export class LocalAuth implements AuthProvider {
  private key: Buffer;

  constructor(private o: { defaultUser: string | null; secret?: Buffer }) {
    this.key = o.secret ?? randomBytes(32);
  }

  private sign(u: string): string {
    return createHmac("sha256", this.key).update(u).digest("base64url");
  }

  identify(req: IncomingMessage): string | null {
    return this.session(req) ?? this.o.defaultUser;
  }

  session(req: IncomingMessage): string | null {
    const c = new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`).exec(req.headers.cookie ?? "")?.[1];
    if (c) {
      const [u, sig] = decodeURIComponent(c).split(".");
      if (u && sig && validUserId(u)) {
        const a = Buffer.from(sig);
        const b = Buffer.from(this.sign(u));
        if (a.length === b.length && timingSafeEqual(a, b)) return u;
      }
    }
    return null;
  }

  signIn(userId: string): string {
    if (!validUserId(userId)) throw new Error("user id: letters, numbers, . _ - (max 64)");
    return `${COOKIE}=${encodeURIComponent(`${userId}.${this.sign(userId)}`)}; Path=/; HttpOnly; SameSite=Strict`;
  }

  signOut(): string {
    return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
  }
}

/** Fixed-window limiter per key. */
export class RateLimiter {
  private hits = new Map<string, { start: number; n: number }>();

  constructor(
    private perMin: number,
    private now: () => number = Date.now,
  ) {}

  take(key: string): boolean {
    const t = this.now();
    const h = this.hits.get(key);
    if (!h || t - h.start >= 60_000) {
      this.hits.set(key, { start: t, n: 1 });
      return true;
    }
    if (h.n >= this.perMin) return false;
    h.n++;
    return true;
  }
}
