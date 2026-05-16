import { describe, expect, it } from "vitest";
import {
  isThirdPersonCameraView,
  resolveCameraViewModeForRound,
  toggleCameraViewMode,
} from "../client/src/game/cameraViewMode";

describe("toggleCameraViewMode", () => {
  it("switches from first-person to third-person", () => {
    expect(toggleCameraViewMode("first")).toBe("third");
  });

  it("switches from third-person back to first-person", () => {
    expect(toggleCameraViewMode("third")).toBe("first");
  });
});

describe("online round camera persistence", () => {
  it("uses the configured default when a new match starts", () => {
    expect(resolveCameraViewModeForRound("third", null)).toBe("third");
    expect(resolveCameraViewModeForRound("first", null)).toBe("first");
  });

  it("keeps a third-person selection into the next round", () => {
    const selectedMode = toggleCameraViewMode("first");

    expect(isThirdPersonCameraView(resolveCameraViewModeForRound("first", selectedMode))).toBe(true);
  });

  it("keeps a first-person selection into the next round", () => {
    const selectedMode = toggleCameraViewMode("third");

    expect(resolveCameraViewModeForRound("third", selectedMode)).toBe("first");
  });
});
