import { BREACH_ROOM_D, BREACH_ROOM_H, BREACH_ROOM_W } from '../../../shared/constants';

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface BreachRoomBounds {
  center: Vec3Like;
  openAxis: 'x' | 'y' | 'z';
}

/**
 * True when `pos` lies inside the breach room volume. Depth runs along
 * `openAxis`; height is always world-Y; the perpendicular horizontal axis
 * carries width.
 *
 * Uses strict inequality at the boundaries to preserve the exact semantics
 * of the original Arena.isInBreachRoom implementation.
 */
export function isInBreachRoom(pos: Vec3Like, bounds: BreachRoomBounds): boolean {
  const { center, openAxis } = bounds;
  if (Math.abs(pos.y - center.y) >= BREACH_ROOM_H / 2) return false;
  if (Math.abs(getAxis(pos, openAxis) - getAxis(center, openAxis)) >= BREACH_ROOM_D / 2) return false;
  const perpAxis: 'x' | 'z' = openAxis === 'x' ? 'z' : 'x';
  if (Math.abs(getAxis(pos, perpAxis) - getAxis(center, perpAxis)) >= BREACH_ROOM_W / 2) return false;
  return true;
}

/**
 * True when `pos` is at least `minDepth` units past the open face of the
 * breach room — used for win detection and gravity activation.
 */
export function isDeepInBreachRoom(
  pos: Vec3Like,
  bounds: BreachRoomBounds,
  minDepth: number,
): boolean {
  const { center, openAxis } = bounds;
  if (Math.abs(getAxis(pos, openAxis) - getAxis(center, openAxis)) >= BREACH_ROOM_D / 2 - minDepth) {
    return false;
  }
  for (const axis of ['x', 'y', 'z'] as const) {
    if (axis === openAxis) continue;
    const half = axis === 'y' ? BREACH_ROOM_H / 2 : BREACH_ROOM_W / 2;
    if (Math.abs(getAxis(pos, axis) - getAxis(center, axis)) >= half) return false;
  }
  return true;
}

function getAxis(v: Vec3Like, axis: 'x' | 'y' | 'z'): number {
  return axis === 'x' ? v.x : axis === 'y' ? v.y : v.z;
}
