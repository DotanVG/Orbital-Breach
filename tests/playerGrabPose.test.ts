import { describe, expect, it } from 'vitest';
import { Group, Quaternion, Vector3 } from 'three';
import { applyBarHoldPose, measureHandGripOffset, BAR_GRIP_LOCAL } from '../client/src/player/playerGrabPose';
import { sampleAlienPose } from './helpers/alienPose';
import { BAR_RADIUS } from '../shared/constants';
import { ANIM_STANDING } from '../client/src/player/playerAnimationController';
describe('left-handed bar hold on the real rig',()=>{
  it('keeps only the left palm on the bar and the right arm in its idle-hold aiming orientation',async()=>{
    const {root,bones,rig}=await sampleAlienPose('GRABBING');
    const radius=(name:string)=>Math.hypot(bones.get(name)!.y-BAR_GRIP_LOCAL.y,bones.get(name)!.z-BAR_GRIP_LOCAL.z);
    expect(radius('PalmL')-BAR_RADIUS).toBeGreaterThanOrEqual(0);
    expect(radius('PalmL')-BAR_RADIUS).toBeLessThanOrEqual(.03);
    expect(radius('PalmR')-BAR_RADIUS).toBeGreaterThan(.10);
    const aiming=await sampleAlienPose('BREACH');
    aiming.animation.snapToAnimation(ANIM_STANDING);
    for(const name of ['ShoulderR','UpperArmR','LowerArmR','PalmR'] as const) {
      aiming.rig.bones[name]!.quaternion.copy(aiming.rig.floatReferenceRightArmPose[name]!);
    }
    const palmAim=aiming.root.getObjectByName('PalmR')!.getWorldQuaternion(new Quaternion()).normalize();
    expect(root.getObjectByName('PalmR')!.getWorldQuaternion(new Quaternion()).normalize().angleTo(palmAim)).toBeLessThan(1e-6);
    for(const name of ['UpperArmR','LowerArmR'] as const) {
      expect(root.getObjectByName(name)!.quaternion.toArray()).toEqual(rig.floatReferenceRightArmPose[name]!.toArray());
    }
  });
  it('restores both arm chains after a launch/other animation without mutating reference quaternions',async()=>{
    const {root,rig}=await sampleAlienPose('GRABBING');
    const held=['L','R'].map(side=>measureHandGripOffset(root,side as 'L'|'R')!.clone());
    const reference=Object.values(rig.standingReferencePose).map(q=>q.toArray());
    for(const bone of Object.values(rig.bones)) bone!.quaternion.copy(new Quaternion(0.5,0.5,0.5,0.5));
    applyBarHoldPose([rig]);
    for(const [i,side] of ['L','R'].entries()) expect(measureHandGripOffset(root,side as 'L'|'R')!.distanceTo(held[i])).toBeLessThan(1e-8);
    expect(Object.values(rig.standingReferencePose).map(q=>q.toArray())).toEqual(reference);
  });
  it('locks the same real rig after swimming at different animation times',async()=>{
    const held=await sampleAlienPose('GRABBING');
    for(const time of [0,.3,1.2]) {
      const p=await sampleAlienPose('FLOATING',time);
      p.animation.snapToAnimation(ANIM_STANDING);
      p.animation.resetBreathing();
      applyBarHoldPose([p.rig]);
      p.root.updateWorldMatrix(true,true);
      for(const [name,position] of held.bones) expect(p.root.getObjectByName(name)!.getWorldPosition(new Vector3()).distanceTo(position),name).toBeLessThan(1e-5);
    }
  });
  it('solves the same player-local grips under a translated, rolling visual root',async()=>{
    const {root,rig}=await sampleAlienPose('GRABBING');
    const before=['L','R'].map(side=>measureHandGripOffset(root,side as 'L'|'R')!.clone());
    const parent=new Group();parent.position.set(8,-3,11);parent.quaternion.setFromAxisAngle(new Vector3(1,2,3).normalize(),1.4);parent.add(root);
    for(let i=0;i<60;i++) applyBarHoldPose([rig]);
    for(const [i,side] of ['L','R'].entries()) expect(measureHandGripOffset(root,side as 'L'|'R')!.distanceTo(before[i])).toBeLessThan(1e-7);
  });
});
