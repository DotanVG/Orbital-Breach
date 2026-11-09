import { createSlidingWindowLimiter, type SlidingWindowLimiter } from "../slidingWindow";

export type { SlidingWindowLimiter };

/**
 * Shot broadcasts per client. Shared FIRE_RATE is 6/s; 20/s leaves room for
 * jitter without letting one socket flood the room.
 */
export const SHOT_EVENT_LIMIT_PER_SECOND = 20;

/** Ready, team switch, team size, and bot fill. Well above a person clicking. */
export const LOBBY_ACTION_LIMIT_PER_SECOND = 10;

export const MESSAGE_RATE_WINDOW_MS = 1000;

export function createMessageLimiter(limit: number): SlidingWindowLimiter {
  return createSlidingWindowLimiter(limit, MESSAGE_RATE_WINDOW_MS);
}
