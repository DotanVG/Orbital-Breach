import { WebSocketServer, WebSocket } from "ws";
import { Room } from "../room";
import { parseClientMsg, sendState } from "./messageCodec";

/**
 * Boots a WebSocket server on `port` and routes every incoming
 * connection into `room`. Domain logic (match state, sim) stays in
 * `Room`; this file only handles framing and connection lifecycle so
 * the transport can be swapped later without touching gameplay code.
 */
export function startWsServer(port: number, room: Room): WebSocketServer {
  const wss = new WebSocketServer({ port });

  wss.on("connection", (ws: WebSocket, req) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const name = url.searchParams.get("name") ?? "Player";
    room.addClient(ws, name);
    sendState(ws, room.sim.getSnapshot());

    ws.on("message", (raw) => {
      const msg = parseClientMsg(raw.toString());
      if (!msg) return;

      if (msg.t === "input") {
        const p = room.clients.get(ws);
        if (p) p.lastInput = msg;
      }
    });

    ws.on("close", () => {
      room.removeClient(ws);
    });

    ws.on("error", () => {
      ws.terminate();
    });
  });

  return wss;
}
