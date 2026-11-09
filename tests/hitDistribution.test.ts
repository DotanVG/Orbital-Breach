import { describe, expect, it } from 'vitest';
import { Group, Vector3 } from 'three';
import { sampleAlienPose } from './helpers/alienPose';
import { sampleHitSurfaces, lazyHitSurfaces } from '../client/src/player/hitSurface';
import { segmentHitSurface } from '../shared/projectileCollider';
import { seededRandom } from './helpers/hitboxOrientation';

describe('current mesh damage geometry',()=>{
  for(const phase of ['BREACH','FLOATING','GRABBING','FROZEN']) it(`${phase}: every head/helmet vertex belongs to the exact head surface`,async()=>{
    const pose=await sampleAlienPose(phase,.08,'FLOATING',.4,true,true);
    const root=new Group();root.add(pose.root,pose.helmetRoot);
    const surfaces=sampleHitSurfaces(root),head=new Set<string>();
    const key=(p:Vector3)=>p.toArray().map(v=>v.toFixed(7)).join(',');
    let count=0;
    for(const s of surfaces) for(let t=0;t<s.zones.length;t++) if(s.zones[t]==='head') {
      for(let k=0;k<3;k++) head.add(key(new Vector3().fromArray(s.positions,s.indices[t*3+k]*3)));
      count++;
    }
    expect(count).toBeGreaterThan(100);
    for(const vertex of [...pose.headVertices,...pose.helmetHeadVertices]) expect(head.has(key(vertex))).toBe(true);
    // Topology and live CPU skinning supply the damage surface directly:
    // zero padding, no phase envelope, no static displaced head centre.
    const lazy=lazyHitSurfaces(root);expect(lazy()).toBe(lazy());
    const shot={x:10,y:10,z:10};expect(segmentHitSurface(shot,{...shot,z:11},surfaces)).toBeNull();
    const counts={head:0,body:0,leftArm:0,rightArm:0,leftLeg:0,rightLeg:0,miss:0};
    const random=seededRandom(0x124126),center=pose.bounds.getCenter(new Vector3());
    const raw=surfaces.map(({patches:_,...surface})=>surface);
    const probes: Array<{a:Vector3;b:Vector3;hit:ReturnType<typeof segmentHitSurface>}> = [];
    for(let i=0;i<2048;i++) {
      const y=2*random()-1,angle=2*Math.PI*random(),r=Math.sqrt(1-y*y);
      const direction=new Vector3(r*Math.cos(angle),y,r*Math.sin(angle));
      const u=new Vector3().crossVectors(direction,new Vector3(0,1,0)).normalize();
      const v=new Vector3().crossVectors(direction,u),disk=.55*Math.sqrt(random()),az=2*Math.PI*random();
      const aim=center.clone().addScaledVector(u,disk*Math.cos(az)).addScaledVector(v,disk*Math.sin(az));
      const a=aim.clone().addScaledVector(direction,-2),b=aim.clone().addScaledVector(direction,2);
      const hit=segmentHitSurface(a,b,surfaces);counts[hit?.zone ?? 'miss']++;
      if(i<64) { expect(hit).toEqual(segmentHitSurface(a,b,raw));probes.push({a,b,hit}); }
    }
    // Accuracy is the invariant. The real helmet exceeds the 40% exposure
    // target; never enlarge limbs or relabel hits to force balance shares.
    for(const count of Object.values(counts)) expect(count).toBeGreaterThan(0);
    for(const surface of surfaces) for(const p of surface.patches!) if(p.min && p.max) {
      expect(new Vector3().subVectors(p.max,p.min).length()/2).toBeLessThanOrEqual(.30);
    }
    root.position.set(2,-3,4);root.rotation.set(.4,1.1,-.6,'YXZ');
    const rotated=sampleHitSurfaces(root);
    for(const {a,b,hit} of probes) {
      const result=segmentHitSurface(a.clone().applyMatrix4(root.matrixWorld),b.clone().applyMatrix4(root.matrixWorld),rotated);
      expect(result?.zone).toBe(hit?.zone);
      // Skeleton boneMatrices are Float32: allow 2 micrometres along this
      // four-metre segment after reskinning under the translated parent.
      if(hit) expect(result?.t).toBeCloseTo(hit.t,6);
    }
  });
});
