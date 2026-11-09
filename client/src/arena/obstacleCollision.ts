import type * as THREE from 'three';
import type { PhysicsState } from '../physics';
import { bounceBodyBoxes } from '../../../shared/bodyCollider';
import { IDENTITY_QUATERNION, type QuaternionLike } from '../../../shared/hitZoneColliders';
export function bounceAgainstBoxes(state: PhysicsState, boxes: THREE.Box3[], orientation: QuaternionLike = IDENTITY_QUATERNION, phase = 'BREACH'): void {
  bounceBodyBoxes(state, boxes, orientation, phase);
}
