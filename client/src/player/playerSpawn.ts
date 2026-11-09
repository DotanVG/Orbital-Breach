import { spawnPosition } from '../../../shared/player-logic';
import { breachFloorAnchorY } from '../../../shared/bodyCollider';
export interface Vec3Like { x: number; y: number; z: number }
export type SpawnPosition = Vec3Like;
export function computeBreachSpawnPosition(center: Vec3Like, openAxis: 'x'|'y'|'z', openSign: 1|-1): SpawnPosition {
  return spawnPosition(0, { getBreachRoomCenter: () => center, getBreachOpenAxis: () => openAxis, getBreachOpenSign: () => openSign });
}
export const breachRoomFloorY = breachFloorAnchorY;
