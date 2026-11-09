import { describe, expect, it } from "vitest";
import { getVictoryLayout, getVictoryMotion, shouldTickCombat } from "../client/src/game/victoryPresentationState";

describe("getVictoryLayout", () => {
  it("anchors WINS 72.5 percent from the bottom above the dancer on desktop and phones", () => {
    for (const aspect of [16 / 9, 844 / 390, 393 / 852]) {
      const layout = getVictoryLayout(aspect);
      expect(layout.titleY).toBe(0.275);
      expect(layout.characterY).toBeGreaterThan(layout.titleY + 0.1);
      expect(layout.characterX).toBe(aspect < 1 ? 0.5 : 0.26);
    }
  });
});

describe("getVictoryMotion", () => {
  it("advances dance and camera together without a combat clock", () => {
    const frame = getVictoryMotion(2, 0.02, false);
    expect(frame.elapsed).toBeCloseTo(2.02);
    expect(frame.animationDt).toBe(0.02);
    expect(frame.orbitAngle).toBeCloseTo(0.25 + 2.02 * 0.35);
  });

  it("holds a stable pose and camera for reduced motion, including a live change", () => {
    expect(getVictoryMotion(15, 0.02, true)).toEqual({
      elapsed: 15, animationDt: 0, orbitAngle: 0.25,
    });
  });
});

describe("shouldTickCombat", () => {
  it("stops solo and online combat during celebration before and after statistics", () => {
    for (const mode of ["solo", "online"] as const) {
      for (const statsVisible of [false, true]) {
        expect(shouldTickCombat(mode, true, statsVisible, true)).toBe(false);
      }
    }
  });

  it("preserves ordinary gameplay and menu lifecycle gating", () => {
    expect(shouldTickCombat("solo", false, false, false)).toBe(true);
    expect(shouldTickCombat("online", false, false, true)).toBe(true);
    expect(shouldTickCombat("online", false, false, false)).toBe(false);
    expect(shouldTickCombat("menu", false, false, true)).toBe(false);
    expect(shouldTickCombat("solo", false, true, true)).toBe(false);
  });
});
