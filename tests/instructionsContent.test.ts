import { describe, expect, it } from "vitest";

import { getInstructionsContent } from "../client/src/ui/instructionsContent";

describe("getInstructionsContent", () => {
  it("includes README-derived desktop controls", () => {
    const content = getInstructionsContent(false);
    const inputs = content.controls.map((control) => control.input);

    expect(inputs).toEqual(
      expect.arrayContaining([
        "Mouse",
        "WASD",
        "E",
        "Space",
        "Left mouse button",
        "Tab",
        "Esc",
      ]),
    );
  });

  it("omits desktop key bindings for mobile instructions", () => {
    const content = getInstructionsContent(true);

    expect(content.controls).toEqual([]);
    expect(content.title).toBe("Mobile Instructions");
  });

  it("explains scoring, match wins, and timeout ties in both variants", () => {
    for (const isMobile of [false, true]) {
      const content = getInstructionsContent(isMobile);
      const text = [
        ...content.roundFlow,
        ...content.winningScenarios,
      ].map((item) => item.body).join(" ");

      expect(text).toContain("Freeze all enemies on the opposing team");
      expect(text).toContain("Cross the enemy breach portal");
      expect(text).toContain("first team to 5 round wins");
      expect(text).toContain("120-second round timer expires");
      expect(text).toContain("tie and no point is awarded");
    }
  });
});
