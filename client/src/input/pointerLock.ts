/**
 * Pointer Lock is missing on iOS Safari and some WebKit builds.
 * Calling the absent methods throws TypeError, so every entry checks first.
 * Touch controls do not use this API.
 */

type PointerLockTarget = {
  requestPointerLock?: () => void | Promise<void>;
};

type PointerLockHost = {
  pointerLockElement?: unknown;
  exitPointerLock?: () => void | Promise<void>;
  addEventListener?: (type: string, listener: EventListener) => void;
  removeEventListener?: (type: string, listener: EventListener) => void;
};

export function requestPointerLock(target: PointerLockTarget): void {
  if (typeof target.requestPointerLock !== 'function') return;
  void target.requestPointerLock();
}

export function exitPointerLock(host: PointerLockHost): void {
  if (typeof host.exitPointerLock !== 'function') return;
  if (!host.pointerLockElement) return;
  void host.exitPointerLock();
}

export function isPointerLocked(host: PointerLockHost): boolean {
  return host.pointerLockElement != null;
}

/** Subscribe to pointerlockchange only when the Pointer Lock API exists. */
export function onPointerLockChange(listener: EventListener, host: PointerLockHost): () => void {
  if (typeof host.exitPointerLock !== 'function' || typeof host.addEventListener !== 'function') {
    return () => {};
  }
  host.addEventListener('pointerlockchange', listener);
  return () => {
    if (typeof host.removeEventListener !== 'function') return;
    host.removeEventListener('pointerlockchange', listener);
  };
}
