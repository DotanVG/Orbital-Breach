import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  classifyHitZoneByColliders,
  cloneColliders,
  defaultHitZoneColliders,
  IDENTITY_QUATERNION,
  isQuaternionLike,
  normalizeQuaternion,
  quaternionFromYawPitchRoll,
  type HitZoneCollider,
  type QuaternionLike,
} from "../shared/hitZoneColliders";
import type { Vec3 } from "../shared/vec3";

function toPlainQuat(q: THREE.Quaternion): QuaternionLike {
  return { x: q.x, y: q.y, z: q.z, w: q.w };
}

// Representative local-space points, one per zone, taken from the
// defaultHitZoneColliders layout (local +X is the model's LEFT side).
const localZonePoints: Array<{ zone: string; point: Vec3 }> = [
  { zone: "head", point: { x: 0, y: -0.16, z: 0 } },
  { zone: "body", point: { x: 0, y: -0.45, z: 0 } },
  { zone: "leftArm", point: { x: 0.17, y: -0.4, z: 0.0175 } },
  { zone: "rightArm", point: { x: -0.17, y: -0.4, z: 0.0175 } },
  { zone: "leftLeg", point: { x: -0.0975, y: -0.66, z: -0.01 } },
  { zone: "rightLeg", point: { x: 0.0975, y: -0.66, z: -0.01 } },
];

describe("cloneColliders", () => {
  it("deep-copies positions, sizes, and rotations", () => {
    const clones = cloneColliders(defaultHitZoneColliders);
    expect(clones).toEqual(defaultHitZoneColliders);
    expect(clones[0]).not.toBe(defaultHitZoneColliders[0]);

    clones[0].position.x = 99;
    clones[0].size.y = 99;
    clones[0].rotation.z = 99;
    expect(defaultHitZoneColliders[0].position.x).toBe(0);
    expect(defaultHitZoneColliders[0].size.y).toBe(0.15);
    expect(defaultHitZoneColliders[0].rotation.z).toBe(0);
  });
});

describe("isQuaternionLike", () => {
  it("accepts objects with numeric x/y/z/w", () => {
    expect(isQuaternionLike(IDENTITY_QUATERNION)).toBe(true);
    expect(isQuaternionLike({ x: 0.1, y: 0.2, z: 0.3, w: 0.9 })).toBe(true);
  });

  it("rejects Vec3 facings, primitives, and partial objects", () => {
    expect(isQuaternionLike({ x: 0, y: 0, z: -1 })).toBe(false); // legacy facing
    expect(isQuaternionLike(null)).toBe(false);
    expect(isQuaternionLike(undefined)).toBe(false);
    expect(isQuaternionLike("quat")).toBe(false);
    expect(isQuaternionLike({ x: 0, y: 0, z: 0, w: "1" })).toBe(false);
  });
});

describe("normalizeQuaternion", () => {
  it("rescales a non-unit quaternion to unit length", () => {
    const n = normalizeQuaternion({ x: 0, y: 0, z: 0, w: 2 });
    expect(n).toEqual({ x: 0, y: 0, z: 0, w: 1 });

    const skew = normalizeQuaternion({ x: 3, y: 0, z: 4, w: 0 });
    expect(Math.hypot(skew.x, skew.y, skew.z, skew.w)).toBeCloseTo(1, 10);
    expect(skew.x).toBeCloseTo(0.6, 10);
    expect(skew.z).toBeCloseTo(0.8, 10);
  });

  it("falls back to identity for zero or non-finite input", () => {
    expect(normalizeQuaternion({ x: 0, y: 0, z: 0, w: 0 })).toEqual(IDENTITY_QUATERNION);
    expect(normalizeQuaternion({ x: NaN, y: 0, z: 0, w: 1 })).toEqual(IDENTITY_QUATERNION);
    expect(normalizeQuaternion({ x: Infinity, y: 0, z: 0, w: 1 })).toEqual(IDENTITY_QUATERNION);
  });
});

describe("quaternionFromYawPitchRoll", () => {
  it("matches THREE's YXZ euler order for combined rotations", () => {
    const cases: Array<[number, number, number]> = [
      [0, 0, 0],
      [Math.PI / 2, 0, 0],
      [0.7, 0.3, -0.5],
      [-1.2, 0.9, 2.1],
    ];
    for (const [yaw, pitch, roll] of cases) {
      const ours = quaternionFromYawPitchRoll(yaw, pitch, roll);
      const theirs = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, "YXZ"));
      expect(ours.x).toBeCloseTo(theirs.x, 10);
      expect(ours.y).toBeCloseTo(theirs.y, 10);
      expect(ours.z).toBeCloseTo(theirs.z, 10);
      expect(ours.w).toBeCloseTo(theirs.w, 10);
    }
  });

  it("defaults pitch and roll to zero", () => {
    expect(quaternionFromYawPitchRoll(1.1)).toEqual(quaternionFromYawPitchRoll(1.1, 0, 0));
  });
});

describe("classifyHitZoneByColliders", () => {
  it("classifies every zone at identity orientation", () => {
    for (const { zone, point } of localZonePoints) {
      expect(
        classifyHitZoneByColliders(point, { x: 0, y: 0, z: 0 }, IDENTITY_QUATERNION),
      ).toBe(zone);
    }
  });

  it("is rotation-invariant: world hits rotated with THREE classify like their local points", () => {
    const playerPos = { x: 4, y: -2, z: 7 };
    const orientations = [
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 3, 0, "YXZ")),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.8, -1.1, 0.4, "YXZ")),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2, "YXZ")), // pure roll
    ];

    for (const quat of orientations) {
      for (const { zone, point } of localZonePoints) {
        const world = new THREE.Vector3(point.x, point.y, point.z)
          .applyQuaternion(quat)
          .add(new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z));
        const impact = { x: world.x, y: world.y, z: world.z };
        expect(
          classifyHitZoneByColliders(impact, playerPos, toPlainQuat(quat)),
          `${zone} under orientation (${quat.x.toFixed(2)}, ${quat.y.toFixed(2)}, ${quat.z.toFixed(2)}, ${quat.w.toFixed(2)})`,
        ).toBe(zone);
      }
    }
  });

  it("tolerates an unnormalized orientation from the wire", () => {
    const unit = toPlainQuat(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 4, 0, "YXZ")),
    );
    const scaled = { x: unit.x * 5, y: unit.y * 5, z: unit.z * 5, w: unit.w * 5 };
    for (const { point } of localZonePoints) {
      const world = new THREE.Vector3(point.x, point.y, point.z)
        .applyQuaternion(new THREE.Quaternion(unit.x, unit.y, unit.z, unit.w));
      const impact = { x: world.x, y: world.y, z: world.z };
      expect(classifyHitZoneByColliders(impact, { x: 0, y: 0, z: 0 }, scaled)).toBe(
        classifyHitZoneByColliders(impact, { x: 0, y: 0, z: 0 }, unit),
      );
    }
  });

  it("falls back to body when the collider list is empty", () => {
    expect(
      classifyHitZoneByColliders({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, IDENTITY_QUATERNION, []),
    ).toBe("body");
  });

  it("supports capsule colliders", () => {
    const colliders: HitZoneCollider[] = [
      {
        id: "cap",
        zone: "body",
        shape: "capsule",
        position: { x: 0, y: 0, z: 0 },
        size: { x: 0.2, y: 0.5, z: 0 }, // radius 0.2, half-height 0.5
        rotation: { x: 0, y: 0, z: 0 },
      },
      {
        id: "far-sphere",
        zone: "head",
        shape: "sphere",
        position: { x: 0, y: 2, z: 0 },
        size: { x: 0.1, y: 0.1, z: 0.1 },
        rotation: { x: 0, y: 0, z: 0 },
      },
    ];
    // Inside the capsule's upper hemisphere cap.
    expect(
      classifyHitZoneByColliders({ x: 0, y: 0.6, z: 0 }, { x: 0, y: 0, z: 0 }, IDENTITY_QUATERNION, colliders),
    ).toBe("body");
    // Right next to the sphere instead.
    expect(
      classifyHitZoneByColliders({ x: 0, y: 1.95, z: 0 }, { x: 0, y: 0, z: 0 }, IDENTITY_QUATERNION, colliders),
    ).toBe("head");
  });

  it("honors per-collider rotation when measuring distance", () => {
    // A long box rotated 90 degrees of yaw lies along Z, not X. A point on
    // the Z axis is inside it only if the rotation is applied.
    const colliders: HitZoneCollider[] = [
      {
        id: "rotated-box",
        zone: "leftArm",
        shape: "box",
        position: { x: 0, y: 0, z: 0 },
        size: { x: 1.0, y: 0.1, z: 0.1 },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
      },
      {
        id: "ref-sphere",
        zone: "head",
        shape: "sphere",
        position: { x: 0, y: 0.5, z: 0 },
        size: { x: 0.2, y: 0.2, z: 0.2 },
        rotation: { x: 0, y: 0, z: 0 },
      },
    ];
    const probe = { x: 0, y: 0.3, z: 0.8 };
    expect(
      classifyHitZoneByColliders(probe, { x: 0, y: 0, z: 0 }, IDENTITY_QUATERNION, colliders),
    ).toBe("leftArm");
    // Same point against the unrotated variant lands closer to the sphere.
    const unrotated = cloneColliders(colliders);
    unrotated[0].rotation.y = 0;
    expect(
      classifyHitZoneByColliders(probe, { x: 0, y: 0, z: 0 }, IDENTITY_QUATERNION, unrotated),
    ).toBe("head");
  });
});
