import { describe, expect, it } from "vitest";
import { GITHUB_ICON_SVG, ITCH_ICON_SVG } from "../client/src/ui/linkIcons";

describe("external link icons", () => {
  it("uses the official GitHub mark instead of the old sketch icon", () => {
    expect(GITHUB_ICON_SVG).toContain('viewBox="0 0 16 16"');
    expect(GITHUB_ICON_SVG).toContain('fill="currentColor"');
    expect(GITHUB_ICON_SVG).toContain("M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656");
    expect(GITHUB_ICON_SVG).not.toContain("<circle");
    expect(GITHUB_ICON_SVG).not.toContain("stroke-linecap");
  });

  it("leaves the itch.io icon unchanged", () => {
    expect(ITCH_ICON_SVG).toContain('viewBox="0 0 18 18"');
    expect(ITCH_ICON_SVG).toContain("M11.5 9.5l1.5.5-1.5.5");
  });
});
