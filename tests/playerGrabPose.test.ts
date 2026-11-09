import { describe, expect, it } from 'vitest';
import { Group, Quaternion, Vector3 } from 'three';
import { applyBarHoldPose, measureBarGripOffset, measureHandGripOffset } from '../client/src/player/playerGrabPose';
import { sampleAlienPose } from './helpers/alienPose';
describe('two-handed bar hold on the real rig',()=>{
  it('puts both hand grips on a shared bar tip within 3 cm',async()=>{
    const {root}=await sampleAlienPose('GRABBING'), center=measureBarGripOffset(root)!;
    for(const side of ['L','R'] as const) expect(measureHandGripOffset(root,side)!.distanceTo(center)).toBeLessThan(0.03);
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
  it('solves the same player-local grips under a translated, rolling visual root',async()=>{
    const {root,rig}=await sampleAlienPose('GRABBING');
    const before=['L','R'].map(side=>measureHandGripOffset(root,side as 'L'|'R')!.clone());
    const parent=new Group();parent.position.set(8,-3,11);parent.quaternion.setFromAxisAngle(new Vector3(1,2,3).normalize(),1.4);parent.add(root);
    for(let i=0;i<60;i++) applyBarHoldPose([rig]);
    for(const [i,side] of ['L','R'].entries()) expect(measureHandGripOffset(root,side as 'L'|'R')!.distanceTo(before[i])).toBeLessThan(1e-7);
  });
});
