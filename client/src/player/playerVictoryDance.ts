import * as THREE from 'three';
import type { AnimatedRig, PoseBoneName } from './playerTypes';

const DANCE_SWAY_SPEED = 7.5;
const DANCE_BOUNCE_SPEED = 15;
const DANCE_TWIST_SPEED = 11;

export function applyVictoryDancePose(rigs: AnimatedRig[], elapsed: number): void {
  const sway = Math.sin(elapsed * DANCE_SWAY_SPEED);
  const bounce = 0.5 + 0.5 * Math.sin(elapsed * DANCE_BOUNCE_SPEED);
  const twist = Math.sin(elapsed * DANCE_TWIST_SPEED);

  for (const rig of rigs) {
    rotateBone(rig.bones.Hips, 0, 0.28 * sway, 0.06 * twist);
    rotateBone(rig.bones.Torso, 0.12 + 0.1 * bounce, 0, 0.1 * sway);
    rotateBone(rig.bones.Abdomen, 0.08 * bounce, 0.08 * sway, 0);
    rotateBone(rig.bones.Neck, -0.08 * sway, 0.12 * sway, 0);

    rotateBone(rig.bones.ShoulderL, 0.55 + 0.18 * sway, 0, -0.3 - 0.08 * bounce);
    rotateBone(rig.bones.UpperArmL, 0.65 + 0.22 * sway, 0.18, -0.5 - 0.08 * bounce);
    rotateBone(rig.bones.LowerArmL, 0.24 + 0.1 * bounce, -0.12, -0.22);
    rotateBone(rig.bones.PalmL, 0.18 * bounce, 0, -0.12 * sway);

    rotateBone(rig.bones.ShoulderR, 0.55 - 0.18 * sway, 0, 0.3 + 0.08 * bounce);
    rotateBone(rig.bones.UpperArmR, 0.65 - 0.22 * sway, -0.18, 0.5 + 0.08 * bounce);
    rotateBone(rig.bones.LowerArmR, 0.24 + 0.1 * bounce, 0.12, 0.22);
    rotateBone(rig.bones.PalmR, 0.18 * bounce, 0, 0.12 * sway);

    rotateBone(rig.bones.UpperLegL, 0.1 + 0.16 * bounce, 0, -0.16 * sway);
    rotateBone(rig.bones.LowerLegL, -0.22 * bounce, 0, 0.06 * sway);
    rotateBone(rig.bones.FootL, -0.05 - 0.08 * bounce, 0, 0);

    rotateBone(rig.bones.UpperLegR, 0.1 + 0.16 * (1 - bounce), 0, 0.16 * sway);
    rotateBone(rig.bones.LowerLegR, -0.22 * (1 - bounce), 0, -0.06 * sway);
    rotateBone(rig.bones.FootR, -0.05 - 0.08 * (1 - bounce), 0, 0);
  }
}

function rotateBone(
  bone: THREE.Bone | undefined,
  x: number,
  y: number,
  z: number,
): void {
  if (!bone) return;
  bone.quaternion.multiply(quatFromEuler(x, y, z));
}

function quatFromEuler(x: number, y: number, z: number): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ'));
}
