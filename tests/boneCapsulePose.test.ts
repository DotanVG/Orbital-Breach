import { describe, expect, it } from 'vitest';
import { Group, Vector3 } from 'three';
import { readFileSync } from 'node:fs';
import { sampleAlienPose } from './helpers/alienPose';
import { seededRandom } from './helpers/hitboxOrientation';
import { lazyHitSurfaces, sampleHitSurfaces } from '../client/src/player/hitSurface';
import { segmentHitSurface } from '../shared/projectileCollider';
import { applyFloatArmTilt } from '../client/src/player/playerAimPose';

describe('animated bone capsule rejection',()=>{
  it('preserves first-contact zones across the eight recorded placements as FLOATING advances',async()=>{
    const {actors}=JSON.parse(readFileSync(new URL('../scripts/qa/actor-placements.json',import.meta.url),'utf8'));
    const pose=await sampleAlienPose('FLOATING',0,'FLOATING',0,true,true);
    const root=new Group();root.add(pose.root,pose.helmetRoot);
    const query=lazyHitSurfaces(root),random=seededRandom(0x129);
    let hits=0,misses=0;
    const headBone=pose.root.getObjectByName('Head')!;
    const initial=headBone.getWorldPosition(new Vector3());
    for(let frame=0;frame<actors.length;frame++) {
      pose.animation.tickMixers(1/60);
      pose.animation.restoreFloatRightArmPose();applyFloatArmTilt(pose.animation.getRigs());
      root.position.fromArray(actors[frame].position);root.quaternion.fromArray(actors[frame].quaternion);
      // Also cover nonuniform ancestor scale/shear without weakening rejection.
      if(frame===7) root.scale.set(1.2,.8,1.1);
      const oracle=sampleHitSurfaces(root),head=headBone.getWorldPosition(new Vector3());
      expect(head.distanceTo(initial)).toBeGreaterThan(.001);
      const before=query.skinnedVertexCount!;
      query.beginFrame!();
      for(let i=0;i<192;i++) {
        const aim=new Vector3((random()-.5)*1.2,(random()-.5)*1.8,(random()-.5)*.6).applyMatrix4(root.matrixWorld);
        if(i<16) aim.copy(head).add(new Vector3((random()-.5)*.2,(random()-.5)*.2,0));
        const direction=new Vector3(random()-.5,random()-.5,random()-.5).normalize();
        const a=aim.clone().addScaledVector(direction,-2),b=aim.clone().addScaledVector(direction,2);
        const expected=segmentHitSurface(a,b,oracle);
        const actual=segmentHitSurface(a,b,query.mayIntersect!(a,b)?query(a,b):[]);
        expect(actual).toEqual(expected);
        if(expected) hits++; else misses++;
      }
      expect(query.skinnedVertexCount).toBeGreaterThan(before);
      query.endFrame!();
    }
    expect(hits).toBeGreaterThan(100);expect(misses).toBeGreaterThan(100);
  });
});
