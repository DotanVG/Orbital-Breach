import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  applyVictoryDancePose,
  resetVictoryDancePose,
} from "../client/src/player/playerVictoryDance";
import type { AnimatedRig, PoseBoneName } from "../client/src/player/playerTypes";

describe("applyVictoryDancePose", () => {
  it("applies the wave from a stable base pose instead of accumulating rotation", () => {
    const rig = createRig(["ShoulderL", "UpperArmL", "LowerArmL", "PalmL"]);

    applyVictoryDancePose([rig], 0.5);
    const firstPose = cloneBoneQuaternions(rig);

    for (let i = 0; i < 20; i += 1) {
      applyVictoryDancePose([rig], 0.5);
    }

    expect(cloneBoneQuaternions(rig)).toEqualQuaternions(firstPose);
  });

  it("recaptures the base pose after reset", () => {
    const rig = createRig(["UpperArmL"]);

    applyVictoryDancePose([rig], 0.25);
    const firstBasePose = rig.bones.UpperArmL!.quaternion.clone();

    resetVictoryDancePose([rig]);
    rig.bones.UpperArmL!.quaternion.setFromEuler(new THREE.Euler(0.4, -0.2, 0.1));
    applyVictoryDancePose([rig], 0.25);

    expect(rig.bones.UpperArmL!.quaternion.equals(firstBasePose)).toBe(false);
  });
});

expect.extend({
  toEqualQuaternions(
    actual: Record<string, THREE.Quaternion>,
    expected: Record<string, THREE.Quaternion>,
  ) {
    for (const [name, expectedQuat] of Object.entries(expected)) {
      const actualQuat = actual[name];
      if (!actualQuat || Math.abs(actualQuat.dot(expectedQuat)) < 1 - 1e-10) {
        return {
          pass: false,
          message: () => `${name} quaternion changed between identical dance pose applications`,
        };
      }
    }
    return {
      pass: true,
      message: () => "quaternions matched",
    };
  },
});

declare module "vitest" {
  // Default must match vitest's own `Assertion<T = any>` declaration exactly,
  // or TS2428 "identical type parameters" fires under tsconfig.test.json.
  interface Assertion<T = any> {
    toEqualQuaternions(expected: Record<string, THREE.Quaternion>): T;
  }
  interface AsymmetricMatchersContaining {
    toEqualQuaternions(expected: Record<string, THREE.Quaternion>): unknown;
  }
}

function createRig(names: PoseBoneName[]): AnimatedRig {
  const root = new THREE.Group();
  const bones: Partial<Record<PoseBoneName, THREE.Bone>> = {};

  for (const name of names) {
    const bone = new THREE.Bone();
    bone.name = name;
    root.add(bone);
    bones[name] = bone;
  }

  return {
    root,
    mixer: new THREE.AnimationMixer(root),
    actions: new Map(),
    bones,
    breathingBasePositions: {},
    frozenJumpRightArmPose: {},
    floatReferenceRightArmPose: {},
  };
}

function cloneBoneQuaternions(rig: AnimatedRig): Record<string, THREE.Quaternion> {
  const quaternions: Record<string, THREE.Quaternion> = {};
  for (const [name, bone] of Object.entries(rig.bones)) {
    if (bone) quaternions[name] = bone.quaternion.clone();
  }
  return quaternions;
}
