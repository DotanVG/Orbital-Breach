import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { InputManager } from "../client/src/input";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

describe("InputManager listener teardown", () => {
  afterEach(() => {
    restoreGlobal("window", originalWindow);
    restoreGlobal("document", originalDocument);
  });

  it("unregisters global listeners on dispose and ignores future input", () => {
    const windowMock = new TrackingTarget();
    const documentMock = new TrackingDocument();
    installGlobal("window", windowMock);
    installGlobal("document", documentMock);

    const input = new InputManager();

    windowMock.dispatchEvent(new KeyboardLikeEvent("keydown", { code: "KeyW" }));
    expect(input.getWalkAxes()).toEqual({ x: 0, z: 1 });

    input.dispose();
    expect(input.getWalkAxes()).toEqual({ x: 0, z: 0 });

    windowMock.dispatchEvent(new KeyboardLikeEvent("keydown", { code: "KeyD" }));
    expect(input.getWalkAxes()).toEqual({ x: 0, z: 0 });

    expect(windowMock.addedTypes).toEqual([
      "keydown",
      "keyup",
      "mousemove",
      "mousedown",
      "mouseup",
      "blur",
    ]);
    expect(windowMock.removedTypes).toEqual(windowMock.addedTypes);
    expect(documentMock.addedTypes).toEqual(["visibilitychange"]);
    expect(documentMock.removedTypes).toEqual(documentMock.addedTypes);
  });
});

describe("event listener cleanup hotspots", () => {
  const repoRoot = path.resolve(__dirname, "..");
  const cleanupExpectations = [
    {
      relPath: "client/src/input.ts",
      minimumRemovals: 7,
      requiredSnippets: ["removeGlobalListeners", "public dispose(): void"],
    },
    {
      relPath: "client/src/ui/mobileControls.ts",
      minimumRemovals: 23,
      requiredSnippets: ["listenerCleanups", "public dispose(): void"],
    },
    {
      relPath: "client/src/ui/sessionMenu.ts",
      minimumRemovals: 14,
      requiredSnippets: ["disposeRootListeners", "public dispose(): void"],
    },
    {
      relPath: "client/src/ui/menu.ts",
      minimumRemovals: 10,
      requiredSnippets: ["disposeMenuListeners", "public dispose(): void"],
    },
    {
      relPath: "client/src/ui/multiplayerLobby.ts",
      minimumRemovals: 9,
      requiredSnippets: ["disposeRootListeners", "public dispose(): void"],
    },
    {
      relPath: "client/src/ui/roomBrowser.ts",
      minimumRemovals: 5,
      requiredSnippets: ["disposeRootListeners", "public dispose(): void"],
    },
    {
      relPath: "client/src/ui/debrief.ts",
      minimumRemovals: 2,
      requiredSnippets: ["disposeActionListeners", "public dispose(): void"],
    },
    {
      relPath: "client/src/audio/SoundEngine.ts",
      minimumRemovals: 2,
      requiredSnippets: ["remoteShotCleanups", "public dispose(): void"],
    },
  ] as const;

  for (const expectation of cleanupExpectations) {
    it(`keeps teardown wiring in ${expectation.relPath}`, () => {
      const source = readFileSync(path.join(repoRoot, expectation.relPath), "utf8");
      const removeCount = source.match(/removeEventListener\s*\(/g)?.length ?? 0;

      for (const snippet of expectation.requiredSnippets) {
        expect(source).toContain(snippet);
      }
      expect(removeCount).toBeGreaterThanOrEqual(expectation.minimumRemovals);
    });
  }
});

function installGlobal(name: "window" | "document", value: object): void {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value,
  });
}

function restoreGlobal(
  name: "window" | "document",
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
    return;
  }

  Reflect.deleteProperty(globalThis, name);
}

class TrackingTarget extends EventTarget {
  public readonly addedTypes: string[] = [];
  public readonly removedTypes: string[] = [];

  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    this.addedTypes.push(type);
    super.addEventListener(type, listener, options);
  }

  override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void {
    this.removedTypes.push(type);
    super.removeEventListener(type, listener, options);
  }
}

class TrackingDocument extends TrackingTarget {
  public activeElement: { tagName?: string } | null = null;
  public hidden = false;
}

class KeyboardLikeEvent extends Event {
  public readonly code: string;
  public readonly repeat: boolean;

  constructor(type: string, init: { code: string; repeat?: boolean }) {
    super(type, { cancelable: true });
    this.code = init.code;
    this.repeat = init.repeat ?? false;
  }
}
