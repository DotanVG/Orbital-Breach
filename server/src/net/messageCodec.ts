import type {
  ClientMessage,
  ServerEventMsg,
  ServerStateMsg,
} from "../../../shared/schema";
import WebSocket from "ws";

/**
 * Wire-format adapters between raw WebSocket frames and typed message
 * objects. Keeping these in one place lets the room/sim code stay in
 * plain-object terms and means a future transport (e.g. Colyseus,
 * DataChannel) only has to re-implement this one module.
 */
export function parseClientMsg(raw: string): ClientMessage | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "t" in parsed &&
      typeof (parsed as { t?: unknown }).t === "string"
    ) {
      return parsed as ClientMessage;
    }
  } catch {
    return null;
  }
  return null;
}

export function sendState(ws: WebSocket, msg: ServerStateMsg): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function sendEvent(
  ws: WebSocket,
  type: ServerEventMsg["type"],
  data: unknown,
): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ t: "event", type, data } satisfies ServerEventMsg));
  }
}
