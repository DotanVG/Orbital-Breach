import { afterEach, describe, expect, it } from "vitest";

import { InputManager } from "../client/src/input";
import {
  exitPointerLock,
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

  it("handles a rejected request without an unhandled rejection", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => { unhandled.push(reason); };
    process.on('unhandledRejection', onUnhandled);
    const rejected = Promise.reject(new Error('Pointer lock denied'));
    try {
      requestPointerLock({ requestPointerLock: () => rejected });
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
      await rejected.catch(() => {});
    }
  });

  it("supports the legacy void-returning request method", () => {
    expect(() => requestPointerLock({ requestPointerLock() {} })).not.toThrow();
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

  it("handles a rejected exit without an unhandled rejection", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => { unhandled.push(reason); };
    process.on('unhandledRejection', onUnhandled);
    const rejected = Promise.reject(new Error('Pointer lock exit denied'));
    try {
      exitPointerLock({ pointerLockElement: {}, exitPointerLock: () => rejected });
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
      await rejected.catch(() => {});
    }
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
