import { PLAYER_RADIUS } from '../../../shared/constants';
import {
  classifyHitZone as classifySharedHitZone,
  type HitZone,
} from "../../../shared/player-logic";
import type { QuaternionLike } from "../../../shared/hitZoneColliders";

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/**
 * Pure hit-zone classification.
 *
 * Returns the body zone that a shot at `impactPoint` landed on, relative to a
 * player at `playerPos` facing `playerFacing`. Legs are split into left/right
 * so 1 vs 2 leg hits can throttle launch power independently.
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
