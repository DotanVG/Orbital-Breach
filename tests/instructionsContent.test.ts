import { describe, expect, it } from "vitest";

import { getInstructionsContent } from "../client/src/ui/instructionsContent";
import { buildInstructionsHtml } from "../client/src/ui/sessionMenu";

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
    expect(content.title).toBe("INSTRUCTIONS");
  });

  it("uses a unified title in both variants", () => {
    for (const isMobile of [false, true]) {
      const content = getInstructionsContent(isMobile);

      expect(content.title).toBe("INSTRUCTIONS");
      expect(content.title).not.toContain("Desktop");
      expect(content.title).not.toContain("Mobile");
    }
  });

  it("explains independent round wins, match wins, and timeout ties in both variants", () => {
    for (const isMobile of [false, true]) {
      const content = getInstructionsContent(isMobile);
      const text = [
        ...content.objective,
        ...content.roundFlow,
        ...content.winningScenarios,
      ].map((item) => `${item.title} ${item.body}`).join(" ");

      expect(text).toContain("breaching the enemy room or freezing every enemy pilot");
      expect(text).toContain("FREEZE TO SCORE");
      expect(text).toContain("Freeze all enemy players to score a round instantly");
      expect(text).toContain("A round is won when a player breaches the enemy room");
      expect(text).toContain("A round is also won when every enemy player is frozen");
      expect(text).toContain("First team to score 5 wins the match");
      expect(text).toContain("120-second round timer expires");
      expect(text).toContain("tie and no point is awarded");
      expect(text).not.toContain("open their breach portal");
      expect(text).not.toContain("after the enemy team has been fully frozen");
    }
  });

  it("renders controls before mechanics when desktop controls are available", () => {
    const html = buildInstructionsHtml(getInstructionsContent(false));

    expect(html.indexOf("Controls")).toBeGreaterThanOrEqual(0);
    expect(html.indexOf("Controls")).toBeLessThan(html.indexOf("Objective"));
    expect(html.indexOf("Controls")).toBeLessThan(html.indexOf("Round Flow"));
    expect(html.indexOf("Controls")).toBeLessThan(html.indexOf("Winning"));
    expect(html).not.toContain("Desktop Controls");
  });

  it("keeps mobile instructions readable without an empty controls section", () => {
    const html = buildInstructionsHtml(getInstructionsContent(true));

    expect(html).not.toContain("ob-session-control-list");
    expect(html.indexOf("Objective")).toBeGreaterThanOrEqual(0);
    expect(html.indexOf("Round Flow")).toBeGreaterThan(html.indexOf("Objective"));
  });
});
