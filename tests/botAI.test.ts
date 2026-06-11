import { describe, expect, it } from "vitest";
import { botIdHash, botPersonality } from "../server/src/colyseus/botAI";

describe("botIdHash", () => {
  it("is deterministic and non-negative", () => {
    expect(botIdHash("bot-0-0")).toBe(botIdHash("bot-0-0"));
    expect(botIdHash("bot-0-0")).toBeGreaterThanOrEqual(0);
    expect(botIdHash("")).toBe(0);
  });

  it("varies with the id", () => {
    expect(botIdHash("bot-0-1")).not.toBe(botIdHash("bot-0-2"));
  });
});

describe("botPersonality", () => {
  it("derives the tier from the hash modulo 5", () => {
    expect(botPersonality(0).tier).toBe(0);
    expect(botPersonality(7).tier).toBe(2);
    expect(botPersonality(14).tier).toBe(4);
  });

  it("scales stats within the documented ranges across tiers", () => {
    for (let tier = 0; tier < 5; tier += 1) {
      const p = botPersonality(tier);
      expect(p.launchSpeed).toBe(6 + tier * 2);
      expect(p.fireDelay).toBeCloseTo(3.0 - tier * 0.4, 10);
      expect(p.angleNoise).toBeCloseTo(0.45 - tier * 0.08, 10);
      expect(p.maxRange).toBe(15 + tier * 5);
    }
    expect(botPersonality(0).launchSpeed).toBe(6);
    expect(botPersonality(4).launchSpeed).toBe(14);
  });
});
