import type { IncomingMessage, ServerResponse } from "node:http";
import type { Server as HttpServer } from "node:http";
import type { Server as HttpsServer } from "node:https";
import { buildCorsHeaders } from "./cors";
import { createSlidingWindowLimiter } from "./slidingWindow";

/** Join/create bursts from one address. A player uses a handful; this stops floods. */
export const MATCHMAKE_RATE_LIMIT_MAX = 240;
export const MATCHMAKE_RATE_LIMIT_WINDOW_MS = 60_000;

type RequestServer = HttpServer | HttpsServer;

export function isMatchmakePath(pathname: string): boolean {
  return pathname === "/matchmake" || pathname.startsWith("/matchmake/");
}

/**
 * Unset matches the previous behavior: one Render proxy in production, and the
 * socket address in development. `0` ignores X-Forwarded-For. `1` is the
 * right-most forwarded hop. Larger values walk further toward the original client,
 * same as Express `trust proxy` set to that hop count.
 */
export function resolveTrustProxyHops(value: string | undefined, isProd: boolean): number {
  const trimmed = value?.trim() ?? "";
  if (trimmed === "") return isProd ? 1 : 0;
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`TRUST_PROXY_HOPS must be a non-negative integer, received ${JSON.stringify(value)}`);
  }
  return Number(trimmed);
}

/**
 * Closest address first: the TCP peer, then X-Forwarded-For from the right.
 * `trustProxyHops` is how many of those proxies to skip.
 */
export function requestClientIp(req: IncomingMessage, trustProxyHops: number): string {
  const socketAddr = req.socket?.remoteAddress ?? "unknown";
  if (trustProxyHops <= 0) return socketAddr;

  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded.join(",") : forwarded;
  const headerHops = raw ? raw.split(",").map((part) => part.trim()).filter(Boolean) : [];
  if (headerHops.length === 0) return socketAddr;

  const chain = [socketAddr, ...headerHops.reverse()];
  const index = Math.min(trustProxyHops, chain.length - 1);
  return chain[index] ?? socketAddr;
}

export interface MatchmakeLimiter {
  allow(ip: string, now: number): boolean;
  readonly size: number;
}

/** Per-IP window. Each check drops buckets whose hits have all expired. */
export function createMatchmakeLimiter(limit: number, windowMs: number): MatchmakeLimiter {
  const buckets = createSlidingWindowLimiter(limit, windowMs);
  return {
    allow(ip, now) {
      buckets.prune(now);
      return buckets.allow(ip, now);
    },
    get size() {
      return buckets.size;
    },
  };
}

export function installMatchmakeRateLimit(
  server: RequestServer,
  options: {
    trustProxyHops: number;
    isAllowedOrigin: (origin: string | null | undefined) => boolean;
    max?: number;
    windowMs?: number;
    now?: () => number;
  },
): void {
  const limiter = createMatchmakeLimiter(
    options.max ?? MATCHMAKE_RATE_LIMIT_MAX,
    options.windowMs ?? MATCHMAKE_RATE_LIMIT_WINDOW_MS,
  );
  const now = options.now ?? Date.now;
  const listeners = server.listeners("request") as Array<(req: IncomingMessage, res: ServerResponse) => void>;
  server.removeAllListeners("request");
  server.on("request", (req, res) => {
    const pathname = (req.url ?? "/").split("?")[0];
    if (isMatchmakePath(pathname) && !limiter.allow(requestClientIp(req, options.trustProxyHops), now())) {
      const originHeader = req.headers.origin;
      const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
      res.writeHead(429, {
        "Content-Type": "application/json; charset=utf-8",
        ...buildCorsHeaders(origin, options.isAllowedOrigin),
      });
      res.end(JSON.stringify({ ok: false, error: "rate_limited" }));
      return;
    }
    for (const listener of listeners) {
      listener.call(server, req, res);
    }
  });
}
