import type { Vec3 } from '../../../../shared/vec3';

export function formatDistance(metres: number): string {
  if (!Number.isFinite(metres)) return '—';
  return `${Math.max(0, Math.round(metres))} m`;
}

/** Camera-space point to a label-safe screen position, including targets behind us. */
export function placeDestination(point: Vec3, width: number, height: number, fov: number) {
  const halfHeight = height / 2;
  const focalLength = halfHeight / Math.tan(fov * Math.PI / 360);
  const depth = Math.max(0.001, Math.abs(point.z));
  let dx = point.x * focalLength / depth;
  let dy = -point.y * focalLength / depth;
  const limitX = Math.max(1, width / 2 - 110);
  const limitY = Math.max(1, halfHeight - 105);
  const edge = point.z >= 0 || Math.abs(dx) > limitX || Math.abs(dy) > limitY;
  if (edge) {
    // A target directly behind has no lateral direction; choose a stable right turn.
    if (Math.abs(dx) + Math.abs(dy) < 0.001) dx = 1;
    const scale = Math.max(Math.abs(dx) / limitX, Math.abs(dy) / limitY);
    dx /= scale;
    dy /= scale;
  }
  return {
    x: width / 2 + dx,
    y: halfHeight + dy,
    edge,
    angle: Math.atan2(dy, dx) * 180 / Math.PI + 90,
  };
}
