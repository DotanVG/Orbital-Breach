import { CloseCode, ErrorCode, MatchMakeError, ServerError } from "@colyseus/sdk";

export const MAX_RECONNECT_ATTEMPTS = 8;
export const MAX_SESSION_RECONNECT_ATTEMPTS = 6;
// Leave time for the last handshake before the server's 20-second reservation expires.
export const SESSION_RECONNECT_TIMEOUT_MS = 18_000;

// Cumulative fire times: 0.5s, 1.5s, 3.5s, 7s, 12s, 16s (sum 16s < 18s budget).
// The 12s attempt lands just after the lobby server typically notices a drop (~11.7s).
const SESSION_RECONNECT_DELAYS_MS = [500, 1_000, 2_000, 3_500, 5_000, 4_000] as const;

export function sessionReconnectDelay(attempt: number): number {
  return SESSION_RECONNECT_DELAYS_MS[Math.min(Math.max(attempt, 0), SESSION_RECONNECT_DELAYS_MS.length - 1)];
}

const FATAL_ROOM_ERRORS: readonly number[] = [
  ErrorCode.MATCHMAKE_NO_HANDLER, ErrorCode.MATCHMAKE_INVALID_CRITERIA,
  ErrorCode.MATCHMAKE_INVALID_ROOM_ID, ErrorCode.MATCHMAKE_UNHANDLED,
  ErrorCode.MATCHMAKE_EXPIRED, ErrorCode.AUTH_FAILED, ErrorCode.APPLICATION_ERROR,
  CloseCode.NORMAL_CLOSURE, CloseCode.CONSENTED, CloseCode.SERVER_SHUTDOWN,
  CloseCode.WITH_ERROR, CloseCode.FAILED_TO_RECONNECT,
];

/** INVALID_PAYLOAD is a message warning; unknown application codes need not end a room. */
export function isFatalRoomError(code: number): boolean {
  return FATAL_ROOM_ERRORS.includes(code);
}

/** Only transport closures can recover by retrying the same room. */
export function isAbnormalClose(code: number): boolean {
  return [1001, 1005, 1006, 1011, 1012, 1013, 4010].includes(code);
}

/** Codes that end session recovery immediately. Compared by numeric code only. */
const FINAL_RECONNECT_CODES: readonly number[] = [
  CloseCode.NORMAL_CLOSURE,
  CloseCode.CONSENTED,
  CloseCode.SERVER_SHUTDOWN,
  CloseCode.WITH_ERROR,
  ErrorCode.MATCHMAKE_NO_HANDLER,
  ErrorCode.MATCHMAKE_INVALID_CRITERIA,
  ErrorCode.MATCHMAKE_INVALID_ROOM_ID,
  ErrorCode.MATCHMAKE_UNHANDLED,
  ErrorCode.AUTH_FAILED,
  ErrorCode.APPLICATION_ERROR,
];

function numericCode(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function reconnectErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  return numericCode(error.code);
}

export function reconnectErrorDataCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("data" in error)) return undefined;
  const data = error.data;
  if (!data || typeof data !== "object" || !("code" in data)) return undefined;
  return numericCode(data.code);
}

/** Intentional leave, kick, or room disposed / not found. No message-string matching. */
export function isFinalReconnectRejection(error: unknown): boolean {
  const code = reconnectErrorCode(error);
  const dataCode = reconnectErrorDataCode(error);
  return (code !== undefined && FINAL_RECONNECT_CODES.includes(code))
    || (dataCode !== undefined && FINAL_RECONNECT_CODES.includes(dataCode));
}

export function isTransportError(error: unknown): boolean {
  if (error instanceof TypeError) return true; // Browser fetch network failure.
  // SDK HTTP wraps fetch failures, then matchmaking wraps them again. Actual
  // HTTP/server rejections have numeric codes; failed browser fetches have none.
  if ((error instanceof MatchMakeError || error instanceof ServerError) && error.code === undefined) return true;
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return typeof error.code === "number"
    && ([502, 503, 504].includes(error.code) || isAbnormalClose(error.code));
}

/** Zero-based attempt, with +/-20% jitter and a hard 30 second cap. */
export function reconnectDelay(attempt: number, random = Math.random()): number {
  return Math.min(30_000, Math.round(1_000 * 2 ** Math.min(attempt, 5) * (0.8 + random * 0.4)));
}
