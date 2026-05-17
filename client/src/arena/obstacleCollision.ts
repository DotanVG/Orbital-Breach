import * as THREE from 'three';
import type { PhysicsState } from '../physics';

/**
 * AABB bounce: for each obstacle box, if the player center is inside the
 * box inflated by `padding`, push them out along the shallowest penetration
 * axis and reflect velocity on that axis with a 0.5 damp.
 *
 * Called for FLOATING and FROZEN players from `updateFloating` /
 * `updateFrozen`. BREACH-phase players are clamped instead, in
 * `clampBreachRoom`.
 *
 * Pass a small `padding` (e.g. 0.05) for tight player-vs-diamond collision
 * so the alien model visually presses against the crystal surface.
 */
export function bounceAgainstBoxes(state: PhysicsState, boxes: THREE.Box3[], padding = 0.05): void {
  for (const box of boxes) {
    const minX = box.min.x - padding;
    const minY = box.min.y - padding;
    const minZ = box.min.z - padding;
    const maxX = box.max.x + padding;
    const maxY = box.max.y + padding;
    const maxZ = box.max.z + padding;

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
