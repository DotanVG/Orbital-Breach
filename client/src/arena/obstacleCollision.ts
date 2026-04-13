import * as THREE from 'three';
import { PLAYER_RADIUS } from '../../../shared/constants';
import type { PhysicsState } from '../physics';

/**
 * AABB bounce: for each obstacle box, if the player center is inside the
 * box inflated by PLAYER_RADIUS, push them out along the shallowest
 * penetration axis and reflect velocity on that axis with a 0.5 damp.
 *
 * Called for FLOATING and FROZEN players from `updateFloating` /
 * `updateFrozen`. BREACH-phase players are clamped instead, in
 * `clampBreachRoom`.
 */
export function bounceAgainstBoxes(state: PhysicsState, boxes: THREE.Box3[]): void {
  for (const box of boxes) {
    const minX = box.min.x - PLAYER_RADIUS;
    const minY = box.min.y - PLAYER_RADIUS;
    const minZ = box.min.z - PLAYER_RADIUS;
    const maxX = box.max.x + PLAYER_RADIUS;
    const maxY = box.max.y + PLAYER_RADIUS;
    const maxZ = box.max.z + PLAYER_RADIUS;

    if (
      state.pos.x < minX || state.pos.x > maxX ||
      state.pos.y < minY || state.pos.y > maxY ||
      state.pos.z < minZ || state.pos.z > maxZ
    ) continue;

    const overlaps = {
      x: Math.min(state.pos.x - minX, maxX - state.pos.x),
      y: Math.min(state.pos.y - minY, maxY - state.pos.y),
      z: Math.min(state.pos.z - minZ, maxZ - state.pos.z),
    };

    let minAx: 'x' | 'y' | 'z' = 'x';
    if (overlaps.y < overlaps[minAx]) minAx = 'y';
    if (overlaps.z < overlaps[minAx]) minAx = 'z';

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const centers = { x: centerX, y: centerY, z: centerZ };

    const dir = Math.sign(state.pos[minAx] - centers[minAx]);
    state.pos[minAx] += dir * overlaps[minAx];
    state.vel[minAx] *= -0.5;
  }
}
