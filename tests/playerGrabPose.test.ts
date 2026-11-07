import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyBarHoldPose } from '../client/src/player/playerGrabPose';
import { resetFloatLimbRotation, setFloatLimbRotation } from '../client/src/player/playerAimPose';
import type { AnimatedRig, PoseBoneName } from '../client/src/player/playerTypes';

// Quaternion-only inputs: no scene graph, renderer, assets or mixer I/O.
function fixture() {
  const names: PoseBoneName[] = [
    'Hips', 'Abdomen', 'Torso', 'Neck',
    'ShoulderL', 'UpperArmL', 'LowerArmL', 'PalmL',
    'UpperLegL', 'LowerLegL', 'FootL', 'UpperLegR', 'LowerLegR', 'FootR',
    'ShoulderR', 'UpperArmR', 'LowerArmR', 'PalmR',
  ];
  const bones = Object.fromEntries(names.map(name => [name, {
    quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, -0.3, 0.1)),
  }]));
  const standingReferencePose = Object.fromEntries(names.map(name => [name, bones[name].quaternion.clone()]));
  return { bones, standingReferencePose } as unknown as AnimatedRig;
}

function snapshot(rig: AnimatedRig) {
  return Object.fromEntries(Object.entries(rig.bones).map(([name, bone]) => [name, bone!.quaternion.toArray()]));
}

afterEach(() => resetFloatLimbRotation('LeftArmHanging'));

describe('applyBarHoldPose', () => {
  it('keeps the hold identical over 600 frames when a constant clip skips bone writes', () => {
    const rig = fixture();
    applyBarHoldPose([rig]);
    const held = snapshot(rig);
    for (let frame = 0; frame < 600; frame++) applyBarHoldPose([rig]);
    expect(snapshot(rig)).toEqual(held);
  });

  it('returns to the same hold after launch or another animation changes the bones', () => {
    const rig = fixture();
    applyBarHoldPose([rig]);
    const held = snapshot(rig);
    for (const name of ['ShoulderL', 'UpperArmL', 'LowerArmL', 'PalmL'] as const) {
      rig.bones[name]!.quaternion.setFromEuler(new THREE.Euler(-1.2, 0.7, 2.4));
    }
    applyBarHoldPose([rig]);
    expect(snapshot(rig)).toEqual(held);
  });

  it('preserves the pistol arm and its reference quaternions', () => {
    const rig = fixture();
    const before = snapshot(rig);
    const reference = Object.values(rig.standingReferencePose).map(q => q.toArray());
    applyBarHoldPose([rig]);
    for (const name of ['ShoulderR', 'UpperArmR', 'LowerArmR', 'PalmR'] as const) {
      expect(rig.bones[name]!.quaternion.toArray()).toEqual(before[name]);
    }
    expect(Object.values(rig.standingReferencePose).map(q => q.toArray())).toEqual(reference);
  });

  it('applies left-arm tuning once without accumulating it on subsequent frames', () => {
    const rig = fixture();
    applyBarHoldPose([rig]);
    const untuned = rig.bones.UpperArmL!.quaternion.clone();
    const tuning = new THREE.Euler(0.1, -0.2, 0.3);
    setFloatLimbRotation('LeftArmHanging', tuning);
    applyBarHoldPose([rig]);
    const expected = untuned.multiply(new THREE.Quaternion().setFromEuler(tuning));
    expect(rig.bones.UpperArmL!.quaternion.angleTo(expected)).toBeLessThan(1e-7);
    for (let frame = 0; frame < 600; frame++) applyBarHoldPose([rig]);
    expect(rig.bones.UpperArmL!.quaternion.angleTo(expected)).toBeLessThan(1e-7);
  });
});
