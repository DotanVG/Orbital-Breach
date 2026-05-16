import { afterEach, describe, expect, it } from "vitest";

import {
  isFullscreen,
  isFullscreenSupported,
  leaveFullscreen,
  requestFullscreen,
} from "../client/src/ui/fullscreen";

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

  it("respects browser fullscreenEnabled guards", () => {
    installDocument({
      documentElement: {
        requestFullscreen: () => {},
      },
      fullscreenEnabled: false,
    });

    expect(isFullscreenSupported()).toBe(false);
  });

  it("reports whether a fullscreen request actually entered fullscreen", async () => {
    const documentMock: Record<string, unknown> = {
      documentElement: {
        requestFullscreen: () => {
          documentMock.fullscreenElement = documentMock.documentElement;
          return Promise.resolve();
        },
      },
      fullscreenElement: null,
    };
    installDocument(documentMock);

    await expect(requestFullscreen()).resolves.toBe(true);
    expect(isFullscreen()).toBe(true);
  });

  it("reports rejected fullscreen requests without throwing", async () => {
    installDocument({
      documentElement: {
        requestFullscreen: () => Promise.reject(new Error("denied")),
      },
      fullscreenElement: null,
    });

    await expect(requestFullscreen()).resolves.toBe(false);
    expect(isFullscreen()).toBe(false);
  });

  it("reports whether exiting fullscreen succeeded", async () => {
    const fullscreenElement = {};
    const documentMock: Record<string, unknown> = {
      documentElement: {},
      fullscreenElement,
      exitFullscreen: () => {
        documentMock.fullscreenElement = null;
        return Promise.resolve();
      },
    };
    installDocument(documentMock);

    await expect(leaveFullscreen()).resolves.toBe(true);
    expect(isFullscreen()).toBe(false);
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
