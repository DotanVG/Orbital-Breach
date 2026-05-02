import { afterEach, describe, expect, it } from "vitest";

import { isFullscreen, isFullscreenSupported } from "../client/src/ui/fullscreen";

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

describe("fullscreen utilities", () => {
  afterEach(() => {
    if (originalDocument) {
      Object.defineProperty(globalThis, "document", originalDocument);
    } else {
      Reflect.deleteProperty(globalThis, "document");
    }
  });

  it("detects standard fullscreen state", () => {
    const fullscreenElement = {};
    installDocument({
      documentElement: {},
      fullscreenElement,
    });

    expect(isFullscreen()).toBe(true);
  });

  it("detects webkit fullscreen state", () => {
    const fullscreenElement = {};
    installDocument({
      documentElement: {},
      fullscreenElement: null,
      webkitFullscreenElement: fullscreenElement,
    });

    expect(isFullscreen()).toBe(true);
  });

  it("detects fullscreen support from standard and webkit APIs", () => {
    installDocument({
      documentElement: {
        requestFullscreen: () => {},
      },
    });
    expect(isFullscreenSupported()).toBe(true);

    installDocument({
      documentElement: {
        webkitRequestFullscreen: () => {},
      },
    });
    expect(isFullscreenSupported()).toBe(true);
  });

  it("returns false when the fullscreen APIs are unavailable", () => {
    installDocument({
      documentElement: {},
      fullscreenElement: null,
    });

    expect(isFullscreen()).toBe(false);
    expect(isFullscreenSupported()).toBe(false);
  });
});

function installDocument(documentMock: Record<string, unknown>): void {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: documentMock,
  });
}
