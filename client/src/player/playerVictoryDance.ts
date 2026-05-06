import * as THREE from 'three';
import type { AnimatedRig, PoseBoneName } from './playerTypes';

const DANCE_SWAY_SPEED = 4.2;
const DANCE_BOUNCE_SPEED = 8.4;
const DANCE_TWIST_SPEED = 5.6;
const ARM_WAVE_SPEED = 4.8;

const victoryBasePoses = new WeakMap<AnimatedRig, Partial<Record<PoseBoneName, THREE.Quaternion>>>();

export function applyVictoryDancePose(rigs: AnimatedRig[], elapsed: number): void {
  const sway = Math.sin(elapsed * DANCE_SWAY_SPEED);
  const bounce = 0.5 + 0.5 * Math.sin(elapsed * DANCE_BOUNCE_SPEED);
  const twist = Math.sin(elapsed * DANCE_TWIST_SPEED);
  const armWave = Math.sin(elapsed * ARM_WAVE_SPEED);

  for (const rig of rigs) {
    const basePose = getVictoryBasePose(rig);

    rotateBone(rig, basePose, 'Hips', 0, 0.28 * sway, 0.06 * twist);
    rotateBone(rig, basePose, 'Torso', 0.12 + 0.1 * bounce, 0, 0.1 * sway);
    rotateBone(rig, basePose, 'Abdomen', 0.08 * bounce, 0.08 * sway, 0);
    rotateBone(rig, basePose, 'Neck', -0.08 * sway, 0.12 * sway, 0);

    rotateBone(rig, basePose, 'ShoulderL', 0.95, 0.08 * armWave, -0.36);
    rotateBone(rig, basePose, 'UpperArmL', 1.05, 0.2 + 0.28 * armWave, -0.48);
    rotateBone(rig, basePose, 'LowerArmL', 0.5, -0.12 + 0.18 * armWave, -0.2);
    rotateBone(rig, basePose, 'PalmL', 0.08 * bounce, 0.18 * armWave, -0.1);

    rotateBone(rig, basePose, 'ShoulderR', 0.55 - 0.18 * sway, 0, 0.3 + 0.08 * bounce);
    rotateBone(rig, basePose, 'UpperArmR', 0.65 - 0.22 * sway, -0.18, 0.5 + 0.08 * bounce);
    rotateBone(rig, basePose, 'LowerArmR', 0.24 + 0.1 * bounce, 0.12, 0.22);
    rotateBone(rig, basePose, 'PalmR', 0.18 * bounce, 0, 0.12 * sway);

    rotateBone(rig, basePose, 'UpperLegL', 0.1 + 0.16 * bounce, 0, -0.16 * sway);
    rotateBone(rig, basePose, 'LowerLegL', -0.22 * bounce, 0, 0.06 * sway);
    rotateBone(rig, basePose, 'FootL', -0.05 - 0.08 * bounce, 0, 0);

    rotateBone(rig, basePose, 'UpperLegR', 0.1 + 0.16 * (1 - bounce), 0, 0.16 * sway);
    rotateBone(rig, basePose, 'LowerLegR', -0.22 * (1 - bounce), 0, -0.06 * sway);
    rotateBone(rig, basePose, 'FootR', -0.05 - 0.08 * (1 - bounce), 0, 0);
  }
}

export function resetVictoryDancePose(rigs: AnimatedRig[]): void {
  for (const rig of rigs) {
    victoryBasePoses.delete(rig);
  }
}

function getVictoryBasePose(
  rig: AnimatedRig,
): Partial<Record<PoseBoneName, THREE.Quaternion>> {
  let basePose = victoryBasePoses.get(rig);
  if (basePose) return basePose;

  basePose = {};
  for (const [name, bone] of Object.entries(rig.bones) as [PoseBoneName, THREE.Bone | undefined][]) {
    if (bone) basePose[name] = bone.quaternion.clone();
  }
  victoryBasePoses.set(rig, basePose);
  return basePose;
}

function rotateBone(
  rig: AnimatedRig,
  basePose: Partial<Record<PoseBoneName, THREE.Quaternion>>,
  name: PoseBoneName,
  x: number,
  y: number,
  z: number,
): void {
  const bone = rig.bones[name];
  if (!bone) return;
  const base = basePose[name];
  if (base) bone.quaternion.copy(base);
  bone.quaternion.multiply(quatFromEuler(x, y, z));
}

function quatFromEuler(x: number, y: number, z: number): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ'));
}
