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

export const defaultHitZoneColliders: HitZoneCollider[] = [
  {
    id: "col_1",
    zone: "head",
    shape: "sphere",
    position: { x: 0, y: -0.16, z: 0 },
    size: { x: 0.15, y: 0.15, z: 0.15 },
    rotation: { x: 0, y: 0, z: 0 },
  },
  {
    id: "col_2",
    zone: "body",
    shape: "box",
    position: { x: 0, y: -0.45, z: 0 },
    size: { x: 0.11, y: 0.114, z: 0.088 },
    rotation: { x: 0, y: 0, z: 0 },
  },
  {
    id: "col_3",
    zone: "leftArm",
    shape: "box",
    position: { x: 0.1375, y: -0.4, z: 0.0175 },
    size: { x: 0.051, y: 0.115, z: 0.093 },
    rotation: { x: 0, y: 0, z: 0 },
  },
  {
    id: "col_4",
    zone: "rightArm",
    shape: "box",
    position: { x: -0.1375, y: -0.4, z: 0.0175 },
    size: { x: 0.051, y: 0.115, z: 0.093 },
    rotation: { x: 0, y: 0, z: 0 },
  },
  {
    id: "col_5",
    zone: "leftLeg",
    shape: "box",
    position: { x: -0.0975, y: -0.64, z: -0.01 },
    size: { x: 0.033, y: 0.104, z: 0.035 },
    rotation: { x: 0, y: 0, z: 0 },
  },
  {
    id: "col_6",
    zone: "rightLeg",
    shape: "box",
    position: { x: 0.0975, y: -0.64, z: -0.01 },
    size: { x: 0.033, y: 0.104, z: 0.035 },
    rotation: { x: 0, y: 0, z: 0 },
  },
];

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
  const normalizedOrientation = normalizeQuaternion(orientation);
  const localPoint = rotateByQuaternion(
    conjugateQuaternion(normalizedOrientation),
    v3.sub(impactPoint, playerPos),
  );

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

function rotateByQuaternion(q: QuaternionLike, point: Vec3): Vec3 {
  const qVec = { x: q.x, y: q.y, z: q.z };
  const uv = v3.cross(qVec, point);
  const uuv = v3.cross(qVec, uv);
  return v3.add(point, v3.addScaled(v3.scale(uv, q.w), uuv, 2));
}
