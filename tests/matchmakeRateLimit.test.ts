import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import {
  createMatchmakeLimiter,
  installMatchmakeRateLimit,
  isMatchmakePath,
  requestClientIp,
  resolveTrustProxyHops,
} from "../server/src/matchmakeRateLimit";

describe("isMatchmakePath", () => {
  it("matches the matchmake prefix only", () => {
    expect(isMatchmakePath("/matchmake")).toBe(true);
    expect(isMatchmakePath("/matchmake/joinOrCreate/orbital_lobby")).toBe(true);
    expect(isMatchmakePath("/health")).toBe(false);
    expect(isMatchmakePath("/matchmake-extra")).toBe(false);
  });
});

describe("resolveTrustProxyHops", () => {
  it("defaults to one hop in production and the socket in development", () => {
    expect(resolveTrustProxyHops(undefined, true)).toBe(1);
    expect(resolveTrustProxyHops("  ", false)).toBe(0);
    expect(resolveTrustProxyHops("2", false)).toBe(2);
  });

  it("rejects a hop count that is not a non-negative integer", () => {
    expect(() => resolveTrustProxyHops("-1", true)).toThrow(/TRUST_PROXY_HOPS/);
    expect(() => resolveTrustProxyHops("1.5", true)).toThrow(/TRUST_PROXY_HOPS/);
  });
});

describe("requestClientIp", () => {
  it("walks X-Forwarded-For by the configured hop count", () => {
    const req = {
      headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.8" },
      socket: { remoteAddress: "127.0.0.1" },
    } as http.IncomingMessage;
    expect(requestClientIp(req, 0)).toBe("127.0.0.1");
    expect(requestClientIp(req, 1)).toBe("10.0.0.8");
    expect(requestClientIp(req, 2)).toBe("1.2.3.4");
    expect(requestClientIp(req, 4)).toBe("1.2.3.4");
  });
});

describe("createMatchmakeLimiter", () => {
  it("drops IP buckets once every hit is outside the window", () => {
    const limiter = createMatchmakeLimiter(5, 1000);
    expect(limiter.allow("1.1.1.1", 0)).toBe(true);
    expect(limiter.allow("2.2.2.2", 500)).toBe(true);
    expect(limiter.size).toBe(2);

    expect(limiter.allow("3.3.3.3", 1000)).toBe(true);
    expect(limiter.size).toBe(2);

    expect(limiter.allow("4.4.4.4", 1500)).toBe(true);
    expect(limiter.size).toBe(2);
  });
});

describe("installMatchmakeRateLimit", () => {
  it("caps /matchmake per IP and leaves other routes alone", async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
    });
    installMatchmakeRateLimit(server, {
      trustProxyHops: 0,
      isAllowedOrigin: () => true,
      max: 2,
      windowMs: 60_000,
      now: () => 1_000,
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const port = (server.address() as AddressInfo).port;

    const status = (path: string) => new Promise<number>((resolve, reject) => {
      const req = http.get({ hostname: "127.0.0.1", port, path }, (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode ?? 0));
      });
      req.on("error", reject);
    });

    try {
      expect(await status("/health")).toBe(200);
      expect(await status("/matchmake/joinOrCreate/orbital_lobby")).toBe(200);
      expect(await status("/matchmake/create/orbital_browser_lobby")).toBe(200);
      expect(await status("/matchmake/join/orbital_lobby")).toBe(429);
      expect(await status("/health")).toBe(200);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    }
  });
});
