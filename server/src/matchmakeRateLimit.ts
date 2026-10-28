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
 * Direct sockets use the TCP peer. Behind one reverse proxy (Render), the
 * right-most X-Forwarded-For hop is the address that proxy observed.
 */
export function requestClientIp(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = req.headers["x-forwarded-for"];
    const raw = Array.isArray(forwarded) ? forwarded.join(",") : forwarded;
    if (raw) {
      const hops = raw.split(",").map((part) => part.trim()).filter(Boolean);
      const client = hops[hops.length - 1];
      if (client) return client;
    }
  }
  return req.socket.remoteAddress ?? "unknown";
}

export function installMatchmakeRateLimit(
  server: RequestServer,
  options: {
    trustProxy: boolean;
    isAllowedOrigin: (origin: string | null | undefined) => boolean;
    max?: number;
    windowMs?: number;
    now?: () => number;
  },
): void {
  const limiter = createSlidingWindowLimiter(
    options.max ?? MATCHMAKE_RATE_LIMIT_MAX,
    options.windowMs ?? MATCHMAKE_RATE_LIMIT_WINDOW_MS,
  );
  const now = options.now ?? Date.now;
  const listeners = server.listeners("request") as Array<(req: IncomingMessage, res: ServerResponse) => void>;
  server.removeAllListeners("request");
  server.on("request", (req, res) => {
    const pathname = (req.url ?? "/").split("?")[0];
    if (isMatchmakePath(pathname) && !limiter.allow(requestClientIp(req, options.trustProxy), now())) {
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
