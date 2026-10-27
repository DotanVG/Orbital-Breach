import { matchMaker, Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import type { ErrorRequestHandler, Request, Response } from "express";
import { MULTIPLAYER_BROWSER_ROOM_NAME, MULTIPLAYER_ROOM_NAME } from "../../shared/multiplayer";
import { OrbitalLobbyRoom } from "./colyseus/OrbitalLobbyRoom";
import { buildPublicRoomDirectory } from "./colyseus/roomDirectory";
import { buildCorsHeaders, createOriginMatcher, parseOriginList } from "./cors";

const PORT = Number(process.env.PORT || 2567);
const NODE_ENV = process.env.NODE_ENV ?? "development";
const IS_PROD = NODE_ENV === "production";

const isAllowedOrigin = createOriginMatcher(parseOriginList(process.env.CLIENT_ORIGIN), IS_PROD);

// Colyseus applies these to every HTTP request (express routes included) and
// answers every OPTIONS preflight itself, so this is the single CORS policy.
// Clear the library defaults (ACAO "*" + credentials, PUT/PATCH/DELETE,
// Authorization), which are merged under getCorsHeaders().
(matchMaker.controller as { DEFAULT_CORS_HEADERS: Record<string, string> }).DEFAULT_CORS_HEADERS = {};
matchMaker.controller.getCorsHeaders = (headers) => buildCorsHeaders(headers.get("origin"), isAllowedOrigin);

async function main(): Promise<void> {
  const transport = new WebSocketTransport();

  // Render terminates TLS in front of Node; let Colyseus advertise the request
  // host in production seat reservations. Dev keeps localhost so direct WS works.
  const publicAddress =
    process.env.PUBLIC_ADDRESS ?? (IS_PROD ? undefined : `localhost:${PORT}`);

  const gameServer = new Server({
    transport,
    ...(publicAddress ? { publicAddress } : {}),
    express: (app) => {
      app.disable("x-powered-by");

      app.use(
        helmet({
          contentSecurityPolicy: false,
          crossOriginResourcePolicy: { policy: "cross-origin" },
        }),
      );

      const probeLimiter = rateLimit({
        windowMs: 60_000,
        max: 60,
        standardHeaders: true,
        legacyHeaders: false,
      });

      const probePayload = () => ({
        ok: true,
        service: "orbital-breach-colyseus",
        time: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
      });

      app.get("/health", probeLimiter, (_req: Request, res: Response) => {
        res.json(probePayload());
      });
      app.get("/wake", probeLimiter, (_req: Request, res: Response) => {
        res.json(probePayload());
      });
      app.get("/rooms", probeLimiter, async (_req: Request, res: Response, next) => {
        try {
          const rooms = await matchMaker.query({ name: MULTIPLAYER_BROWSER_ROOM_NAME });
          res.json({
            ok: true,
            rooms: buildPublicRoomDirectory(rooms as unknown[]),
          });
        } catch (error) {
          next(error);
        }
      });

      const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
        if (!IS_PROD) console.error(err);
        res.status(500).json({
          ok: false,
          error: IS_PROD ? "internal_error" : String(err?.message ?? err),
        });
      };
      app.use(errorHandler);
    },
  });

  // Do not mount @colyseus/monitor in production without auth; it exposes
  // room state, client list, and admin actions to anyone with the URL.
  gameServer.define(MULTIPLAYER_ROOM_NAME, OrbitalLobbyRoom);
  gameServer.define(MULTIPLAYER_BROWSER_ROOM_NAME, OrbitalLobbyRoom);
  await gameServer.listen(PORT);

  console.log(`Colyseus listening on port ${PORT}`);
}

void main().catch((error) => {
  console.error("Failed to start Orbital Breach server.", error);
  process.exitCode = 1;
});
