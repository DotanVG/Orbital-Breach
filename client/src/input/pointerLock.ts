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
};

export function requestPointerLock(target: PointerLockTarget): void {
  if (typeof target.requestPointerLock !== 'function') return;
  // Legacy implementations return void; modern ones may reject (e.g. denied activation).
  void target.requestPointerLock()?.catch(() => {});
}

export function exitPointerLock(host: PointerLockHost): void {
  if (typeof host.exitPointerLock !== 'function') return;
  if (!host.pointerLockElement) return;
  void host.exitPointerLock()?.catch(() => {});
}

export function isPointerLocked(host: PointerLockHost): boolean {
  return host.pointerLockElement != null;
}
