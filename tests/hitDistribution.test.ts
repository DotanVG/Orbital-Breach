import { describe, expect, it } from 'vitest';
import { Group, SkinnedMesh, Vector3 } from 'three';
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
      expect(segmentHitSurface(a,b,lazy.mayIntersect!(a,b)?lazy(a,b):[])).toEqual(hit);
      if(i<64 && hit) {
        const point=new Vector3().copy(hit.point);
        for(const [from,to] of [[point,b],[a,point],[point,point]]) {
          expect(segmentHitSurface(from,to,lazy.mayIntersect!(from,to)?lazy(from,to):[])).toEqual(segmentHitSurface(from,to,surfaces));
        }
      }
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
    const rotatedQuery=lazyHitSurfaces(root);
    for(const {a,b,hit} of probes) {
      const from=a.clone().applyMatrix4(root.matrixWorld),to=b.clone().applyMatrix4(root.matrixWorld);
      const result=segmentHitSurface(from,to,rotated);
      expect(segmentHitSurface(from,to,rotatedQuery.mayIntersect!(from,to)?rotatedQuery(from,to):[])).toEqual(result);
      expect(result?.zone).toBe(hit?.zone);
      // Skeleton boneMatrices are Float32: allow 2 micrometres along this
      // four-metre segment after reskinning under the translated parent.
      if(hit) expect(result?.t).toBeCloseTo(hit.t,6);
    }
  });
  it('never skins an early-out miss, reuses frame patches and invalidates on pose/frame changes',async()=>{
    const pose=await sampleAlienPose('FLOATING',.08,'FLOATING',.4,true,true);
    const root=new Group();root.add(pose.root,pose.helmetRoot);
    const meshes: SkinnedMesh[]=[];root.traverse(n=>{if(n instanceof SkinnedMesh) meshes.push(n)});
    const query=lazyHitSurfaces(root),a=new Vector3(30,30,-1),b=new Vector3(30,30,1);
    const count=()=>query.skinnedVertexCount!;
    expect(query.mayIntersect!(a,b)).toBe(false);expect(query(a,b)).toEqual([]);expect(count()).toBe(0);
    const target=pose.headVertices[0];a.copy(target).addScalar(-.1);b.copy(target).addScalar(.1);
    expect(query.mayIntersect!(a,b)).toBe(true);
    const first=segmentHitSurface(a,b,query(a,b)),cold=count();expect(cold).toBeGreaterThan(0);
    const raw=sampleHitSurfaces(root),nativePoints=new Set<string>();
    const key=(p:Vector3)=>p.toArray().join(',');
    for(const s of raw) for(let i=0;i<s.positions.length;i+=3) nativePoints.add(key(new Vector3().fromArray(s.positions,i)));
    for(const s of query(a,b)) for(const i of s.indices) expect(nativePoints.has(key(new Vector3().fromArray(s.positions,i*3)))).toBe(true);
    expect(segmentHitSurface(a,b,query(a,b))).toEqual(first);expect(count()).toBe(cold);
    const next=lazyHitSurfaces(root);next(a,b);expect(next.skinnedVertexCount).toBeGreaterThan(0);
    query.beginFrame!();query(a,b);const frameCount=count();query(a,b);expect(count()).toBe(frameCount);query.endFrame!();
    query.beginFrame!();query(a,b);expect(count()).toBeGreaterThan(frameCount);query.endFrame!();
    const before=count();meshes[0].skeleton.bones[0].position.x+=.01;
    const changed=query(a,b);expect(count()).toBeGreaterThan(before);
    expect(segmentHitSurface(a,b,changed)).toEqual(segmentHitSurface(a,b,sampleHitSurfaces(root)));
  });
});
