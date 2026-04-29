import { describe, expect, it } from "vitest";

import { shouldShowDesktopOverlayCursor } from "../client/src/game/overlayCursor";

describe("shouldShowDesktopOverlayCursor", () => {
  it("stays hidden outside active gameplay", () => {
    expect(shouldShowDesktopOverlayCursor({
      gameplayActive: false,
      mobile: false,
      sessionMenuOpen: true,
      tabHeld: true,
    })).toBe(false);
  });

  it("stays hidden on mobile even when gameplay overlays are open", () => {
    expect(shouldShowDesktopOverlayCursor({
      gameplayActive: true,
      mobile: true,
      sessionMenuOpen: true,
      tabHeld: true,
    })).toBe(false);
  });

  it("shows the custom cursor for the session menu during desktop gameplay", () => {
    expect(shouldShowDesktopOverlayCursor({
      gameplayActive: true,
      mobile: false,
      sessionMenuOpen: true,
      tabHeld: false,
    })).toBe(true);
  });

  it("shows the custom cursor for the combat roster during desktop gameplay", () => {
    expect(shouldShowDesktopOverlayCursor({
      gameplayActive: true,
      mobile: false,
      sessionMenuOpen: false,
      tabHeld: true,
    })).toBe(true);
  });

  it("returns to hidden gameplay behavior once overlays close", () => {
    expect(shouldShowDesktopOverlayCursor({
      gameplayActive: true,
      mobile: false,
      sessionMenuOpen: false,
      tabHeld: false,
    })).toBe(false);
  });
});
