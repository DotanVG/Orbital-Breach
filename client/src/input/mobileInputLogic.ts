/**
 * Pure stateless helpers extracted from InputManager's mobile-input paths.
 * Having them separate makes them unit-testable without a browser environment.
 */

export interface MobileLookState {
  touchLookDx: number;
  touchLookDy: number;
  aimDy: number;
}

/**
 * Route a touch look delta into the correct accumulator.
 * When aiming is active, dy charges launch power (aimDy); otherwise it pans the camera.
 */
export function applyMobileLookDelta(
  state: MobileLookState,
  aimingActive: boolean,
  dx: number,
  dy: number,
): void {
  state.touchLookDx += dx;
  if (aimingActive) {
    state.aimDy += dy;
  } else {
    state.touchLookDy += dy;
  }
}

/**
 * Merge keyboard walk axes with mobile joystick axes, clamped to [-1, 1].
 */
export function mergeWalkAxes(
  keyX: number,
  keyZ: number,
  mobileX: number,
  mobileZ: number,
): { x: number; z: number } {
  return {
    x: Math.max(-1, Math.min(1, keyX + mobileX)),
    z: Math.max(-1, Math.min(1, keyZ + mobileZ)),
  };
}

