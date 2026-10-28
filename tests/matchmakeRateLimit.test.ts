import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import {
  installMatchmakeRateLimit,
  isMatchmakePath,
  requestClientIp,
} from "../server/src/matchmakeRateLimit";

describe("isMatchmakePath", () => {
  it("matches the matchmake prefix only", () => {
    expect(isMatchmakePath("/matchmake")).toBe(true);
    expect(isMatchmakePath("/matchmake/joinOrCreate/orbital_lobby")).toBe(true);
    expect(isMatchmakePath("/health")).toBe(false);
    expect(isMatchmakePath("/matchmake-extra")).toBe(false);
  });
});

describe("requestClientIp", () => {
  it("uses the socket peer unless a proxy is trusted", () => {
    const req = {
      headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.8" },
      socket: { remoteAddress: "127.0.0.1" },
    } as http.IncomingMessage;
    expect(requestClientIp(req, false)).toBe("127.0.0.1");
    expect(requestClientIp(req, true)).toBe("10.0.0.8");
  });
});

describe("installMatchmakeRateLimit", () => {
  it("caps /matchmake per IP and leaves other routes alone", async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
    });
    installMatchmakeRateLimit(server, {
      trustProxy: false,
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
