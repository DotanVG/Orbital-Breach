import { CloseCode, ErrorCode, MatchMakeError, ServerError } from "@colyseus/sdk";

export const MAX_RECONNECT_ATTEMPTS = 8;

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
