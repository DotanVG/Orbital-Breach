import { PLAYER_RADIUS } from '../../../shared/constants';
import type { QuaternionLike } from '../../../shared/hitZoneColliders';
import {
  classifyHitZone as classifySharedHitZone,
  type HitZone,
} from '../../../shared/player-logic';

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/**
 * Pure hit-zone classification.
 *
 * Returns the body zone that a shot at `impactPoint` landed on, relative to a
 * player at `playerPos`. A quaternion orientation uses the symmetric colliders
 * so the zone follows the alien's full rotation. A facing vector keeps the
 * legacy yaw-only heuristic.
 */
export function classifyHitZone(
  impactPoint: Vec3Like,
  playerPos: Vec3Like,
  playerFacing: Vec3Like | QuaternionLike,
  hitOffsetY = 0,
  hitRadius = PLAYER_RADIUS,
): HitZone {
  return classifySharedHitZone(
    impactPoint,
    playerPos,
    playerFacing,
    hitOffsetY,
    hitRadius,
  );
}
