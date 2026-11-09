import * as THREE from 'three';
import type { AnimatedRig } from './playerTypes';
import { getFloatLimbRotation } from './playerAimPose';

export const DEFAULT_LEFT_HAND_GRIP_LOCAL = new THREE.Vector3(-0.27, -0.322, 0.287);
/** Player-local midpoint of the settled hold; not a second mesh shift. */
export const BAR_GRIP_LOCAL = new THREE.Vector3(0, -0.20, 0.50);
const HAND_SPACING = 0.036;

/** Canonical standing rig + two short CCD chains. Never accumulate last frame's pose. */
export function applyBarHoldPose(rigs: AnimatedRig[]): void {
  for (const rig of rigs) {
    for (const [name, base] of Object.entries(rig.standingReferencePose)) {
      const bone = rig.bones[name as keyof typeof rig.bones];
      if (bone) bone.quaternion.copy(base);
    }
    rig.bones.UpperArmL?.quaternion.multiply(new THREE.Quaternion().setFromEuler(getFloatLimbRotation('LeftArmHanging')));
    for (const side of ['L', 'R'] as const) {
      const upper = rig.bones[`UpperArm${side}`];
      const lower = rig.bones[`LowerArm${side}`];
      if (!upper || !lower || !rig.bones[`Shoulder${side}`] || !rig.root) continue;
      const target = BAR_GRIP_LOCAL.clone();
      target.x = (side === 'L' ? -1 : 1) * HAND_SPACING / 2;
      if (rig.root.parent) rig.root.parent.localToWorld(target);
      // Both grips stay < 2 cm from the shared tip for any world bar axis.
      for (let step = 0; step < 32; step++) {
        for (const bone of [lower, upper, rig.bones[`Shoulder${side}`]!]) {
          rig.root.updateWorldMatrix(true, true);
          const grip = measureHandGripWorld(rig.root, side);
          if (!grip) break;
          const joint = bone.getWorldPosition(new THREE.Vector3());
          const from = grip.sub(joint).normalize();
          const to = target.clone().sub(joint).normalize();
          const delta = new THREE.Quaternion().setFromUnitVectors(from, to);
          const world = bone.getWorldQuaternion(new THREE.Quaternion());
          const parent = bone.parent!.getWorldQuaternion(new THREE.Quaternion());
          bone.quaternion.copy(parent.invert().multiply(delta).multiply(world));
        }
      }
    }
  }
}

function measureHandGripWorld(root: THREE.Group, side: 'L' | 'R'): THREE.Vector3 | null {
  const palm = root.getObjectByName(`Palm${side}`);
  const finger = root.getObjectByName(`MiddleFinger4${side}`);
  if (!palm || !finger) return null;
  const p = palm.getWorldPosition(new THREE.Vector3());
  const f = finger.getWorldPosition(new THREE.Vector3());
  const grip = p.clone().lerp(f, 0.64);
  const thumb = root.getObjectByName(`Thumb3${side}`);
  if (thumb) grip.lerp(thumb.getWorldPosition(new THREE.Vector3()), 0.16);
  return grip.addScaledVector(f.sub(p).normalize(), 0.01);
}

export function measureHandGripOffset(root: THREE.Group | null, side: 'L' | 'R'): THREE.Vector3 | null {
  if (!root) return null;
  root.updateWorldMatrix(true, true);
  const grip = measureHandGripWorld(root, side);
  if (!grip) return null;
  return root.worldToLocal(grip).applyMatrix4(root.matrix);
}

export function measureLeftHandGripOffset(root: THREE.Group | null): THREE.Vector3 | null {
  return measureHandGripOffset(root, 'L');
}

export function measureBarGripOffset(root: THREE.Group | null): THREE.Vector3 | null {
  const left = measureHandGripOffset(root, 'L');
  const right = measureHandGripOffset(root, 'R');
  return left && right ? left.add(right).multiplyScalar(0.5) : left;
}
