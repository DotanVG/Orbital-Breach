export const MAX_RECONNECT_ATTEMPTS = 8;

/** Zero-based attempt, with +/-20% jitter and a hard 30 second cap. */
export function reconnectDelay(attempt: number, random = Math.random()): number {
  return Math.min(30_000, Math.round(1_000 * 2 ** Math.min(attempt, 5) * (0.8 + random * 0.4)));
}
