import { bounceBodyArena, clampBodyBreach } from '../../shared/bodyCollider';
import { IDENTITY_QUATERNION, type QuaternionLike } from '../../shared/hitZoneColliders';
import * as THREE from 'three';
import {
  ZERO_G_DAMPING,
  MAX_LAUNCH_SPEED,
  BREACH_GRAVITY,
  BREACH_JUMP_SPEED,
  BREACH_WALK_SPEED,
} from '../../shared/constants';
import { clampMagnitude } from './util/math';

export interface PhysicsState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
}

const walkHorizontal = new THREE.Vector3();
const walkForward = new THREE.Vector3();

/**
 * Zero-G drift integration - near-frictionless momentum.
 * Used by FLOATING, GRABBING (vel clamped to 0 by player), and FROZEN players.
 */
export function integrateZeroG(state: PhysicsState, dt: number): void {
  state.vel.multiplyScalar(ZERO_G_DAMPING);
  clampMagnitude(state.vel, MAX_LAUNCH_SPEED);
  state.pos.addScaledVector(state.vel, dt);
}

/**
 * Bounce off arena cube walls (±ARENA_SIZE/2 on each axis).
 * Used for all players inside the arena.
 */
/**
 * Bounce off arena cube walls (±ARENA_SIZE/2 on each axis).
 * On the portal axis the wall is solid EXCEPT within the portal opening
 * (BREACH_ROOM_W wide × BREACH_ROOM_H tall, centred at origin on that face).
 *
 * @param portalAxis     - goal axis ('x' or 'z'); both ± faces have portal openings
 * @param portalPerpAxis - horizontal axis perpendicular to portalAxis
 */
export function bounceArena(
  state: PhysicsState,
  portalAxis?: 'x' | 'y' | 'z',
  portalPerpAxis?: 'x' | 'z',
  portalFacesOpen?: { positive: boolean; negative: boolean },
  orientation: QuaternionLike = IDENTITY_QUATERNION,
  phase = 'BREACH',
): void {
  bounceBodyArena(state, orientation, phase, portalAxis, portalPerpAxis, portalFacesOpen);
}

/**
 * Breach room movement: gravity + WASD walk on XZ plane.
 * Used when player.phase === 'BREACH'.
 */
export function integrateBreachRoom(
  state: PhysicsState,
  walkAxes: { x: number; z: number },
  yawFwd: THREE.Vector3,
  yawRight: THREE.Vector3,
  jumping: boolean,
  onGround: boolean,
  carryVelocity: THREE.Vector3,
  dt: number,
): void {
  // Horizontal: WASD always responsive
  const h = walkHorizontal
    .copy(yawRight)
    .multiplyScalar(walkAxes.x)
    .add(walkForward.copy(yawFwd).multiplyScalar(walkAxes.z));
  if (h.length() > 0) h.normalize();
  state.vel.x = h.x * BREACH_WALK_SPEED + carryVelocity.x;
  state.vel.z = h.z * BREACH_WALK_SPEED + carryVelocity.z;

  // Vertical: pure upward jump — no forward force
  if (jumping && onGround) {
    state.vel.y = BREACH_JUMP_SPEED;
  }
  state.vel.y += BREACH_GRAVITY * dt;
  state.pos.addScaledVector(state.vel, dt);
}

/**
 * Clamp player inside breach room AABB, leaving the portal face open.
 *
 * @param openAxis  - which axis the portal faces ('x', 'y', or 'z')
 * @param openSign  - 1 = open on positive side, -1 = open on negative side
 */
export function clampBreachRoom(
  state: PhysicsState,
  center: THREE.Vector3,
  openAxis: 'x' | 'y' | 'z',
  openSign: 1 | -1,
  portalOpen = true,
  orientation: QuaternionLike = IDENTITY_QUATERNION,
  phase = 'BREACH',
): void {
  clampBodyBreach(state, center, openAxis, openSign, portalOpen, orientation, phase);
}
