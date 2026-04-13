/**
 * Pick the initial camera yaw so that the player spawns in their breach
 * room looking straight at the portal opening.
 *
 * getYawForward() = (-sin(yaw), 0, -cos(yaw)) in camera.ts, so yaw=0 faces
 * −z, yaw=π faces +z, yaw=−π/2 faces +x, yaw=+π/2 faces −x.
 */
export function cameraYawFacingBreachOpening(
  openAxis: 'x' | 'y' | 'z',
  openSign: 1 | -1,
): number {
  if (openAxis === 'z') {
    return openSign === 1 ? Math.PI : 0;
  }
  if (openAxis === 'x') {
    return openSign === 1 ? -Math.PI / 2 : Math.PI / 2;
  }
  return 0;
}
