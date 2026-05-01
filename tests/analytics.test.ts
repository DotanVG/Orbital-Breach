import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalGlobals = {
  window: Object.getOwnPropertyDescriptor(globalThis, "window"),
  document: Object.getOwnPropertyDescriptor(globalThis, "document"),
  navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
};

function installBrowserGlobals(options?: {
  pathname?: string;
  search?: string;
  referrer?: string;
  width?: number;
  height?: number;
  userAgent?: string;
  maxTouchPoints?: number;
}): void {
  const pathname = options?.pathname ?? "/";
  const search = options?.search ?? "";
  const referrer = options?.referrer ?? "";
  const width = options?.width ?? 1280;
  const height = options?.height ?? 720;
  const userAgent = options?.userAgent ?? "Mozilla/5.0";
  const maxTouchPoints = options?.maxTouchPoints ?? 0;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      innerWidth: width,
      innerHeight: height,
      location: {
        pathname,
        search,
      },
      visualViewport: {
        width,
        height,
      },
    },
  });

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      referrer,
    },
  });

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      maxTouchPoints,
      userAgent,
    },
  });
}

describe("analytics", () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    restoreBrowserGlobals();
    vi.resetModules();
  });

  it("tracks landing_visit once per page load with landing source fields", async () => {
    installBrowserGlobals({
      search: "?ref=vibejam&utm_source=jam&utm_medium=social&utm_campaign=launch&utm_content=hero",
      referrer: "https://example.com/some/path?x=1",
      width: 390,
      height: 844,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      maxTouchPoints: 5,
    });

    const { trackLandingVisitOnce } = await import("../client/src/analytics/analytics");

    trackLandingVisitOnce();
    trackLandingVisitOnce();

    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    expect(consoleInfoSpy).toHaveBeenCalledWith("[analytics] landing_visit", {
      path: "/",
      ref: "vibejam",
      utm_source: "jam",
      utm_medium: "social",
      utm_campaign: "launch",
      utm_content: "hero",
      documentReferrerHost: "example.com",
      deviceType: "mobile",
      orientation: "portrait",
      viewportWidth: 390,
      viewportHeight: 844,
    });
  });
});

function restoreBrowserGlobals(): void {
  restoreGlobal("window", originalGlobals.window);
  restoreGlobal("document", originalGlobals.document);
  restoreGlobal("navigator", originalGlobals.navigator);
}

function restoreGlobal(name: "window" | "document" | "navigator", descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
  } else {
    Reflect.deleteProperty(globalThis, name);
  }
}
