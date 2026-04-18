import * as THREE from "three";

const DEFAULT_RECONCILE_SHARPNESS = 14;
const DEFAULT_MAX_LEAD_SECONDS = 0.14;

export function reconcileScalar(
  current: number,
  target: number,
  dt: number,
  sharpness = DEFAULT_RECONCILE_SHARPNESS,
): number {
  if (!isFinite(current) || !isFinite(target)) return target;
  if (dt <= 0) return current;
  const alpha = 1 - Math.exp(-sharpness * dt);
  return current + (target - current) * alpha;
}

export function reconcileAngle(
  current: number,
  target: number,
  dt: number,
  sharpness = DEFAULT_RECONCILE_SHARPNESS,
): number {
  return current + shortestAngleDelta(current, target) * (1 - Math.exp(-sharpness * Math.max(0, dt)));
}

export function reconcileVector(
  current: THREE.Vector3,
  target: THREE.Vector3,
  dt: number,
  sharpness = DEFAULT_RECONCILE_SHARPNESS,
  snapDistance = 2.5,
): THREE.Vector3 {
  if (current.distanceToSquared(target) >= snapDistance * snapDistance) {
    current.copy(target);
    return current;
  }

  current.x = reconcileScalar(current.x, target.x, dt, sharpness);
  current.y = reconcileScalar(current.y, target.y, dt, sharpness);
  current.z = reconcileScalar(current.z, target.z, dt, sharpness);
  return current;
}

export function predictPosition(
  authoritativePos: THREE.Vector3,
  authoritativeVel: THREE.Vector3,
  ageSeconds: number,
  maxLeadSeconds = DEFAULT_MAX_LEAD_SECONDS,
): THREE.Vector3 {
  const clampedAge = Math.max(0, Math.min(maxLeadSeconds, ageSeconds));
  return authoritativePos.clone().addScaledVector(authoritativeVel, clampedAge);
}

function shortestAngleDelta(current: number, target: number): number {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}
