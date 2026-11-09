import * as THREE from 'three';
import type { AnimatedRig } from './playerTypes';
import { BAR_RADIUS } from '../../../shared/constants';

export const DEFAULT_LEFT_HAND_GRIP_LOCAL = new THREE.Vector3(-0.27, -0.322, 0.287);
/** Bar axis at the exposed tip, in the rigid player frame (not a palm target).
 * Local +X follows the bar towards its tip; the body hangs on the -Y side.
 * The reclined torso keeps this alien's large helmet behind the raised hands.
 */
export const BAR_GRIP_LOCAL = new THREE.Vector3(0.07, -0.22, 0.32);
const HAND_SPACING = 0.12;
const holdRight = new THREE.Vector3();
const holdUp = new THREE.Vector3();
const holdForward = new THREE.Vector3();
const holdBasis = new THREE.Matrix4();

/** Canonical standing rig + two short CCD chains. Never accumulate last frame's pose. */
export function applyBarHoldPose(rigs: AnimatedRig[]): void {
  for (const rig of rigs) {
    for (const [name, base] of Object.entries(rig.standingReferencePose)) {
      const bone = rig.bones[name as keyof typeof rig.bones];
      if (bone) bone.quaternion.copy(base);
    }
    rig.root.updateWorldMatrix(true, true);
    const abdomen = rig.bones.Abdomen!;
    const frame = rig.root.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
    const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0).applyQuaternion(frame), -1.35);
    abdomen.quaternion.copy(abdomen.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(tilt).multiply(abdomen.getWorldQuaternion(new THREE.Quaternion())));
    for (const side of ['L', 'R'] as const) {
      const upper = rig.bones[`UpperArm${side}`];
      const lower = rig.bones[`LowerArm${side}`];
      if (!upper || !lower || !rig.bones[`Shoulder${side}`] || !rig.root) continue;
      const target = BAR_GRIP_LOCAL.clone();
      target.y -= BAR_RADIUS + 0.025;
      target.x = (side === 'L' ? -1 : 1) * HAND_SPACING / 2;
      if (rig.root.parent) rig.root.parent.localToWorld(target);
      // Solve palm BONES below the surface; fingers extend tangentially around it.
      for (let step = 0; step < 32; step++) {
        for (const bone of [lower, upper, rig.bones[`Shoulder${side}`]!]) {
          rig.root.updateWorldMatrix(true, true);
          const grip = rig.bones[`Palm${side}`]?.getWorldPosition(new THREE.Vector3());
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
      rig.root.updateWorldMatrix(true, true);
      const palm = rig.bones[`Palm${side}`]!;
      const finger = rig.root.getObjectByName(`MiddleFinger1${side}`)!;
      const alongHand = finger.getWorldPosition(new THREE.Vector3()).sub(palm.getWorldPosition(new THREE.Vector3())).normalize();
      const tangent = new THREE.Vector3(0,-0.4,1).normalize().applyQuaternion(frame);
      const wristTurn = new THREE.Quaternion().setFromUnitVectors(alongHand,tangent);
      palm.quaternion.copy(palm.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(wristTurn).multiply(palm.getWorldQuaternion(new THREE.Quaternion())));
      rig.root.updateWorldMatrix(true,true);
      const roll = new THREE.Quaternion().setFromAxisAngle(tangent, THREE.MathUtils.degToRad(side === 'L' ? 200 : 140));
      palm.quaternion.copy(palm.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(roll).multiply(palm.getWorldQuaternion(new THREE.Quaternion())));
      // Curl each digit along an exterior arc, preserving bone lengths. Aiming
      // only the wrist sends the fingertips away from the cylinder or through it.
      for (const names of [[1,2,3,4].map(i=>`MiddleFinger${i}${side}`),[1,2,3,4].map(i=>`PinkyFinger${i}${side}`),[1,2,3].map(i=>`Thumb${i}${side}`)]) {
        for(let i=0;i<names.length-1;i++) {
          rig.root.updateWorldMatrix(true,true);
          const joint=rig.root.getObjectByName(names[i])!;
          const next=rig.root.getObjectByName(names[i+1])!;
          const origin=joint.getWorldPosition(new THREE.Vector3());
          const tip=next.getWorldPosition(new THREE.Vector3());
          const local=origin.clone(), localTip=tip.clone();
          if(rig.root.parent) {rig.root.parent.worldToLocal(local);rig.root.parent.worldToLocal(localTip);}
          const radius=Math.max(BAR_RADIUS+.04,Math.hypot(local.y-BAR_GRIP_LOCAL.y,local.z-BAR_GRIP_LOCAL.z));
          const dx=localTip.x-local.x, length=localTip.distanceTo(local);
          const angle=Math.atan2(local.z-BAR_GRIP_LOCAL.z,BAR_GRIP_LOCAL.y-local.y)+2*Math.asin(Math.min(1,Math.sqrt(Math.max(0,length*length-dx*dx))/(2*radius)));
          const target=new THREE.Vector3(localTip.x,BAR_GRIP_LOCAL.y-radius*Math.cos(angle),BAR_GRIP_LOCAL.z+radius*Math.sin(angle));
          if(rig.root.parent) rig.root.parent.localToWorld(target);
          const turn=new THREE.Quaternion().setFromUnitVectors(tip.sub(origin).normalize(),target.sub(origin).normalize());
          joint.quaternion.copy(joint.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(turn).multiply(joint.getWorldQuaternion(new THREE.Quaternion())));
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

/** Preserve the preferred up as far as possible, with a stable fallback for vertical bars. */
export function barHoldQuaternion(preferred: THREE.Quaternion, direction: THREE.Vector3, target = new THREE.Quaternion()): THREE.Quaternion {
  const right = holdRight.copy(direction).normalize();
  const up = holdUp.set(0,1,0).applyQuaternion(preferred);
  up.addScaledVector(right,-up.dot(right));
  if (up.lengthSq() < 1e-8) {
    up.set(0,0,1).applyQuaternion(preferred);
    up.addScaledVector(right,-up.dot(right));
  }
  up.normalize();
  const forward = holdForward.crossVectors(right,up);
  return target.setFromRotationMatrix(holdBasis.makeBasis(right,up,forward));
}
