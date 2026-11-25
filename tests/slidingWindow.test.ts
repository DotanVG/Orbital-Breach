import { describe, expect, it } from "vitest";
import { createSlidingWindowLimiter } from "../server/src/slidingWindow";

describe("createSlidingWindowLimiter", () => {
  it("allows up to the limit inside the window and then rejects", () => {
    const allow = createSlidingWindowLimiter(2, 1000);
    expect(allow.allow("a", 0)).toBe(true);
    expect(allow.allow("a", 10)).toBe(true);
    expect(allow.allow("a", 20)).toBe(false);
  });

  it("counts keys separately", () => {
    const allow = createSlidingWindowLimiter(1, 1000);
    expect(allow.allow("a", 0)).toBe(true);
    expect(allow.allow("b", 0)).toBe(true);
    expect(allow.allow("a", 1)).toBe(false);
  });

  it("lets a hit through once the oldest falls outside the window", () => {
    const allow = createSlidingWindowLimiter(1, 1000);
    expect(allow.allow("a", 0)).toBe(true);
    expect(allow.allow("a", 1000)).toBe(true);
    expect(allow.allow("a", 1000)).toBe(false);
  });

  it("forgets a key so the next hit is allowed", () => {
    const limiter = createSlidingWindowLimiter(1, 1000);
    expect(limiter.allow("a", 0)).toBe(true);
    limiter.forget("a");
    expect(limiter.allow("a", 1)).toBe(true);
  });

  it("prunes keys whose hits are all outside the window", () => {
    const limiter = createSlidingWindowLimiter(2, 1000);
    limiter.allow("a", 0);
    limiter.allow("b", 500);
    limiter.prune(1000);
    expect(limiter.size).toBe(1);
    limiter.prune(1500);
    expect(limiter.size).toBe(0);
  });
});
