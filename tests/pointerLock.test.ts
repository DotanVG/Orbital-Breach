import { afterEach, describe, expect, it } from "vitest";

import { InputManager } from "../client/src/input";
import {
  exitPointerLock,
  onPointerLockChange,
  requestPointerLock,
} from "../client/src/input/pointerLock";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

describe("requestPointerLock", () => {
  it("does nothing when requestPointerLock is missing", () => {
    const canvas = {};
    expect(() => requestPointerLock(canvas)).not.toThrow();
  });

  it("requests a lock when the method exists", () => {
    let calls = 0;
    const canvas = {
      requestPointerLock() {
        calls += 1;
        expect(this).toBe(canvas);
        return Promise.resolve();
      },
    };

    requestPointerLock(canvas);

    expect(calls).toBe(1);
  });
});

describe("exitPointerLock", () => {
  it("does nothing when exitPointerLock is missing", () => {
    const doc = { pointerLockElement: {} };
    expect(() => exitPointerLock(doc)).not.toThrow();
  });

  it("exits an active lock when the method exists", () => {
    let calls = 0;
    const doc = {
      pointerLockElement: {},
      exitPointerLock() {
        calls += 1;
        expect(this).toBe(doc);
        return Promise.resolve();
      },
    };

    exitPointerLock(doc);

    expect(calls).toBe(1);
  });

  it("leaves an unlocked document alone when the method exists", () => {
    let calls = 0;
    const doc = {
      pointerLockElement: null,
      exitPointerLock() {
        calls += 1;
        return Promise.resolve();
      },
    };

    exitPointerLock(doc);

    expect(calls).toBe(0);
  });
});

describe("onPointerLockChange", () => {
  it("does not subscribe when the Pointer Lock API is missing", () => {
    const added: string[] = [];
    const doc = {
      addEventListener(type: string) {
        added.push(type);
      },
      removeEventListener(type: string) {
        added.push(`remove:${type}`);
      },
    };

    const unsubscribe = onPointerLockChange(() => {}, doc);
    unsubscribe();

    expect(added).toEqual([]);
  });

  it("subscribes and unsubscribes when the Pointer Lock API exists", () => {
    const added: string[] = [];
    const removed: string[] = [];
    const doc = {
      exitPointerLock() {
        return Promise.resolve();
      },
      addEventListener(type: string) {
        added.push(type);
      },
      removeEventListener(type: string) {
        removed.push(type);
      },
    };

    const unsubscribe = onPointerLockChange(() => {}, doc);
    expect(added).toEqual(["pointerlockchange"]);
    unsubscribe();
    expect(removed).toEqual(["pointerlockchange"]);
  });
});

describe("InputManager pointer lock", () => {
  afterEach(() => {
    restoreGlobal("window", originalWindow);
    restoreGlobal("document", originalDocument);
  });

  it("does not throw when requestPointerLock and exitPointerLock are missing", () => {
    installBrowser({
      pointerLockElement: {},
    });
    const input = new InputManager();
    const canvas = {} as HTMLCanvasElement;

    expect(() => input.lockPointer(canvas)).not.toThrow();
    expect(() => input.exitPointerLock()).not.toThrow();

    input.dispose();
  });

  it("still requests and exits pointer lock when the API exists", () => {
    let requested = 0;
    let exited = 0;
    installBrowser({
      pointerLockElement: {},
      exitPointerLock() {
        exited += 1;
        return Promise.resolve();
      },
    });
    const input = new InputManager();
    const canvas = {
      requestPointerLock() {
        requested += 1;
        return Promise.resolve();
      },
    } as unknown as HTMLCanvasElement;

    input.lockPointer(canvas);
    input.exitPointerLock();

    expect(requested).toBe(1);
    expect(exited).toBe(1);

    input.dispose();
  });
});

function installBrowser(documentFields: Record<string, unknown>): void {
  installGlobal("window", new EventTarget());
  installGlobal("document", {
    addEventListener() {},
    removeEventListener() {},
    hidden: false,
    activeElement: null,
    ...documentFields,
  });
}

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
