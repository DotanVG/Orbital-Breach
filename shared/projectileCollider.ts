import { bodyColliderForPhase, bodyWorldBounds } from './bodyCollider';
import { hitZoneCollidersForPhase, type QuaternionLike } from './hitZoneColliders';
import type { Vec3 } from './vec3';
/** Conservative sphere enclosing every corner/rotation of every phase-selected zone. */
export function projectileRadiusForPhase(phase = 'BREACH'): number {
  const center=bodyColliderForPhase(phase).center;
  return Math.max(...hitZoneCollidersForPhase(phase).map(c =>
    Math.hypot(c.position.x-center.x,c.position.y-center.y,c.position.z-center.z)
      + (c.shape === 'sphere' ? c.size.x : c.shape === 'capsule' ? c.size.x+c.size.y : Math.hypot(c.size.x,c.size.y,c.size.z))));
}
export function projectileBodyTarget(pos: Vec3, orientation: QuaternionLike, phase = 'BREACH'): { center: Vec3; radius: number } {
  return { center: bodyWorldBounds(pos,orientation,phase).center, radius: projectileRadiusForPhase(phase) };
}
