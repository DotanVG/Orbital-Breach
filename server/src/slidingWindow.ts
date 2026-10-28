/** At most `limit` hits per `windowMs` for each key. Hits exactly `windowMs` old no longer count. */
export interface SlidingWindowLimiter {
  allow(key: string, now: number): boolean;
  forget(key: string): void;
}

export function createSlidingWindowLimiter(limit: number, windowMs: number): SlidingWindowLimiter {
  const stamps = new Map<string, number[]>();
  return {
    allow(key, now) {
      const start = now - windowMs;
      const recent: number[] = [];
      const prev = stamps.get(key);
      if (prev) {
        for (const stamp of prev) {
          if (stamp > start) recent.push(stamp);
        }
      }
      if (recent.length >= limit) {
        stamps.set(key, recent);
        return false;
      }
      recent.push(now);
      stamps.set(key, recent);
      return true;
    },
    forget(key) {
      stamps.delete(key);
    },
  };
}
