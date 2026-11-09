import type { HitZone } from "./player-logic";
import type { Vec3 } from "./vec3";
import { v3 } from "./vec3";

export type ColliderShape = "box" | "sphere" | "capsule";

export interface QuaternionLike {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface HitZoneCollider {
  id: string;
  zone: HitZone;
  shape: ColliderShape;
  position: Vec3;
  size: Vec3;
  rotation: Vec3;
}

export const IDENTITY_QUATERNION: QuaternionLike = {
  x: 0,
  y: 0,
  z: 0,
  w: 1,
};

/** CPU-sampled Alien.glb runtime poses (asset transform included once).
 * Boxes are half-extents; joint means locate limb centres, never the physics anchor.
 * Model left is -X after ALIEN_ROTATION_Y=PI (F1).
 */
export const defaultHitZoneColliders: HitZoneCollider[] = [
  {"id":"head","zone":"head","shape":"sphere","position":{"x":-0.00037,"y":-0.18192,"z":0.24174},"size":{"x":0.16731,"y":0.16731,"z":0.16731},"rotation":{"x":0,"y":0,"z":0}},
  {"id":"body","zone":"body","shape":"box","position":{"x":-0.00018,"y":-0.44016,"z":0.28132},"size":{"x":0.078,"y":0.14142,"z":0.055},"rotation":{"x":0,"y":0,"z":0}},
  {"id":"leftArm","zone":"leftArm","shape":"box","position":{"x":-0.10286,"y":-0.39013,"z":0.28134},"size":{"x":0.02587,"y":0.07808,"z":0.02362},"rotation":{"x":0,"y":0,"z":0}},
  {"id":"rightArm","zone":"rightArm","shape":"box","position":{"x":0.11281,"y":-0.35792,"z":0.23172},"size":{"x":0.036,"y":0.04577,"z":0.06926},"rotation":{"x":0,"y":0,"z":0}},
  {"id":"leftLeg","zone":"leftLeg","shape":"box","position":{"x":-0.06964,"y":-0.56299,"z":0.2828},"size":{"x":0.025,"y":0.07856,"z":0.03},"rotation":{"x":0,"y":0,"z":0}},
  {"id":"rightLeg","zone":"rightLeg","shape":"box","position":{"x":0.07514,"y":-0.56389,"z":0.28248},"size":{"x":0.025,"y":0.07766,"z":0.03},"rotation":{"x":0,"y":0,"z":0}}
];
export const floatingHitZoneColliders: HitZoneCollider[] = [
  {"id":"head","zone":"head","shape":"sphere","position":{"x":-0.00942,"y":-0.5594,"z":-0.03713},"size":{"x":0.16735,"y":0.16735,"z":0.16735},"rotation":{"x":0,"y":0,"z":0}},
  {"id":"body","zone":"body","shape":"box","position":{"x":-0.00146,"y":-0.58464,"z":0.22576},"size":{"x":0.078,"y":0.03178,"z":0.14071},"rotation":{"x":0,"y":0,"z":0}},
  {"id":"leftArm","zone":"leftArm","shape":"box","position":{"x":-0.13604,"y":-0.55084,"z":0.08598},"size":{"x":0.06273,"y":0.121,"z":0.125},"rotation":{"x":0,"y":0,"z":0}},
  {"id":"rightArm","zone":"rightArm","shape":"box","position":{"x":0.11064,"y":-0.6092,"z":0.07477},"size":{"x":0.03666,"y":0.04977,"z":0.06687},"rotation":{"x":0,"y":0,"z":0}},
  {"id":"leftLeg","zone":"leftLeg","shape":"box","position":{"x":-0.05399,"y":-0.59524,"z":0.35248},"size":{"x":0.025,"y":0.055,"z":0.08402},"rotation":{"x":0,"y":0,"z":0}},
  {"id":"rightLeg","zone":"rightLeg","shape":"box","position":{"x":0.05211,"y":-0.59088,"z":0.35201},"size":{"x":0.03115,"y":0.06,"z":0.08551},"rotation":{"x":0,"y":0,"z":0}}
];
export const grabbingHitZoneColliders: HitZoneCollider[] = [
  {"id":"head","zone":"head","shape":"sphere","position":{"x":0.00025,"y":-0.50174,"z":0.05071},"size":{"x":0.16724,"y":0.16724,"z":0.16724},"rotation":{"x":0,"y":0,"z":0}},
  {"id":"body","zone":"body","shape":"box","position":{"x":0.00153,"y":-0.52772,"z":0.30116},"size":{"x":0.078,"y":0.05054,"z":0.12293},"rotation":{"x":0,"y":0,"z":0}},
  {"id":"leftArm","zone":"leftArm","shape":"box","position":{"x":-0.05477,"y":-0.40212,"z":0.28543},"size":{"x":0.01888,"y":0.06278,"z":0.04625},"rotation":{"x":0,"y":0,"z":0}},
  {"id":"rightArm","zone":"rightArm","shape":"box","position":{"x":0.12639,"y":-0.50877,"z":0.23174},"size":{"x":0.05186,"y":0.03928,"z":0.04819},"rotation":{"x":0,"y":0,"z":0}},
  {"id":"leftLeg","zone":"leftLeg","shape":"box","position":{"x":-0.06826,"y":-0.57323,"z":0.32228},"size":{"x":0.025,"y":0.07433,"z":0.05448},"rotation":{"x":0,"y":0,"z":0}},
  {"id":"rightLeg","zone":"rightLeg","shape":"box","position":{"x":0.0761,"y":-0.57414,"z":0.31956},"size":{"x":0.025,"y":0.07342,"z":0.05233},"rotation":{"x":0,"y":0,"z":0}},
  {"id":"handL","zone":"leftArm","shape":"box","position":{"x":-0.06704,"y":-0.35517,"z":0.3694},"size":{"x":0.06134,"y":0.02651,"z":0.06509},"rotation":{"x":0,"y":0,"z":0}},
  {"id":"handR","zone":"rightArm","shape":"box","position":{"x":0.17728,"y":-0.50025,"z":0.14389},"size":{"x":0.02517,"y":0.06074,"z":0.06366},"rotation":{"x":0,"y":0,"z":0}}
];
export function hitZoneCollidersForPhase(phase = 'BREACH'): readonly HitZoneCollider[] {
  return phase === 'GRABBING' || phase === 'AIMING' ? grabbingHitZoneColliders
    : phase === 'FLOATING' || phase === 'FROZEN' ? floatingHitZoneColliders : defaultHitZoneColliders;
}

export function cloneColliders(src: HitZoneCollider[]): HitZoneCollider[] {
  return src.map((collider) => ({
    ...collider,
    position: { ...collider.position },
    size: { ...collider.size },
    rotation: { ...collider.rotation },
  }));
}

export function isQuaternionLike(value: unknown): value is QuaternionLike {
  if (!value || typeof value !== "object") return false;
  const q = value as Partial<QuaternionLike>;
  return typeof q.x === "number"
    && typeof q.y === "number"
    && typeof q.z === "number"
    && typeof q.w === "number";
}

export function normalizeQuaternion(q: QuaternionLike): QuaternionLike {
  const length = Math.hypot(q.x, q.y, q.z, q.w);
  if (!isFinite(length) || length <= 1e-8) return { ...IDENTITY_QUATERNION };
  return {
    x: q.x / length,
    y: q.y / length,
    z: q.z / length,
    w: q.w / length,
  };
}

export function quaternionFromYawPitchRoll(
  yaw: number,
  pitch = 0,
  roll = 0,
): QuaternionLike {
  const halfYaw = yaw * 0.5;
  const halfPitch = pitch * 0.5;
  const halfRoll = roll * 0.5;

  const yawQuat = {
    x: 0,
    y: Math.sin(halfYaw),
    z: 0,
    w: Math.cos(halfYaw),
  };
  const pitchQuat = {
    x: Math.sin(halfPitch),
    y: 0,
    z: 0,
    w: Math.cos(halfPitch),
  };
  const rollQuat = {
    x: 0,
    y: 0,
    z: Math.sin(halfRoll),
    w: Math.cos(halfRoll),
  };

  return normalizeQuaternion(multiplyQuaternions(multiplyQuaternions(yawQuat, pitchQuat), rollQuat));
}

export function classifyHitZoneByColliders(
  impactPoint: Vec3,
  playerPos: Vec3,
  orientation: QuaternionLike,
  colliders: readonly HitZoneCollider[] = defaultHitZoneColliders,
): HitZone {
  const localPoint = worldPointToPlayerLocal(impactPoint, playerPos, orientation);

  let bestZone: HitZone = colliders[0]?.zone ?? "body";
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const collider of colliders) {
    const colliderPoint = toColliderLocalPoint(localPoint, collider);
    const distance = signedDistanceToCollider(colliderPoint, collider);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestZone = collider.zone;
    }
  }

  return bestZone;
}

/** Inverse of the visual root's full rigid transform, shared by hit queries. */
export function worldPointToPlayerLocal(
  point: Vec3,
  playerPos: Vec3,
  orientation: QuaternionLike,
): Vec3 {
  return rotateByQuaternion(
    conjugateQuaternion(normalizeQuaternion(orientation)),
    v3.sub(point, playerPos),
  );
}

/** Old/partial snapshots follow yaw until a complete orientation arrives. */
export function orientationFromSnapshot(actor: {
  yaw: number;
  orientX?: unknown;
  orientY?: unknown;
  orientZ?: unknown;
  orientW?: unknown;
}): QuaternionLike {
  const components = [actor.orientX, actor.orientY, actor.orientZ, actor.orientW];
  if (!components.every((value) => typeof value === "number" && Number.isFinite(value))) {
    return quaternionFromYawPitchRoll(actor.yaw);
  }
  const [x, y, z, w] = components as number[];
  if (Math.hypot(x, y, z, w) <= 1e-8) return quaternionFromYawPitchRoll(actor.yaw);
  return normalizeQuaternion({ x, y, z, w });
}

function toColliderLocalPoint(point: Vec3, collider: HitZoneCollider): Vec3 {
  const relative = v3.sub(point, collider.position);
  if (
    collider.rotation.x === 0
    && collider.rotation.y === 0
    && collider.rotation.z === 0
  ) {
    return relative;
  }

  const rotation = quaternionFromYawPitchRoll(
    collider.rotation.y,
    collider.rotation.x,
    collider.rotation.z,
  );
  return rotateByQuaternion(conjugateQuaternion(rotation), relative);
}

function signedDistanceToCollider(point: Vec3, collider: HitZoneCollider): number {
  switch (collider.shape) {
    case "sphere":
      return v3.length(point) - collider.size.x;
    case "capsule":
      return signedDistanceToCapsule(point, collider.size.x, collider.size.y);
    case "box":
    default:
      return signedDistanceToBox(point, collider.size);
  }
}

function signedDistanceToCapsule(point: Vec3, radius: number, halfHeight: number): number {
  const clampedY = Math.max(-halfHeight, Math.min(halfHeight, point.y));
  const radial = {
    x: point.x,
    y: point.y - clampedY,
    z: point.z,
  };
  return v3.length(radial) - radius;
}

function signedDistanceToBox(point: Vec3, halfExtents: Vec3): number {
  const dx = Math.abs(point.x) - halfExtents.x;
  const dy = Math.abs(point.y) - halfExtents.y;
  const dz = Math.abs(point.z) - halfExtents.z;

  const outside = {
    x: Math.max(dx, 0),
    y: Math.max(dy, 0),
    z: Math.max(dz, 0),
  };
  const outsideDistance = v3.length(outside);
  const insideDistance = Math.min(Math.max(dx, Math.max(dy, dz)), 0);
  return outsideDistance + insideDistance;
}

function conjugateQuaternion(q: QuaternionLike): QuaternionLike {
  return {
    x: -q.x,
    y: -q.y,
    z: -q.z,
    w: q.w,
  };
}

function multiplyQuaternions(a: QuaternionLike, b: QuaternionLike): QuaternionLike {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

export function rotateByQuaternion(q: QuaternionLike, point: Vec3): Vec3 {
  // v' = v + 2w(u × v) + 2(u × (u × v)), where u = q.xyz.
  // The 2w factor is required — without it the rotation under-rotates and
  // shrinks the vector for any angle other than 0 or 180 degrees (where w = 0),
  // which silently misclassifies hits on yaw'd/rolling aliens.
  const qVec = { x: q.x, y: q.y, z: q.z };
  const uv = v3.cross(qVec, point);
  const uuv = v3.cross(qVec, uv);
  return v3.add(point, v3.addScaled(v3.scale(uv, 2 * q.w), uuv, 2));
}
