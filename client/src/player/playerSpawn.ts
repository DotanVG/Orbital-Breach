import { BREACH_ROOM_D, BREACH_ROOM_H, PLAYER_RADIUS } from '../../../shared/constants';

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface SpawnPosition {
  x: number;
  y: number;
  z: number;
}

/**
 * Pure helper: compute the player's spawn position at the back of the given
 * breach room, facing toward the portal. Extracted so it can be covered by
 * deterministic unit tests without needing a Three.js scene.
 */
export function computeBreachSpawnPosition(
  center: Vec3Like,
  openAxis: 'x' | 'y' | 'z',
  openSign: 1 | -1,
): SpawnPosition {
  const floorY = center.y - BREACH_ROOM_H / 2 + PLAYER_RADIUS + 0.1;
  const backOffset = BREACH_ROOM_D / 2 - PLAYER_RADIUS - 0.5;
  const pos: SpawnPosition = { x: center.x, y: floorY, z: center.z };
  pos[openAxis] -= openSign * backOffset;
  return pos;
}

export function breachRoomFloorY(centerY: number): number {
  return centerY - BREACH_ROOM_H / 2 + PLAYER_RADIUS;
}
