import { expect, it } from 'vitest';
import { Bone, BufferGeometry, Float32BufferAttribute, Group, MeshBasicMaterial, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3 } from 'three';
import { lazyHitSurfaces, sampleHitSurfaces } from '../client/src/player/hitSurface';
import { segmentHitSurface } from '../shared/projectileCollider';

it('bounds sub-threshold influences, duplicate bone slots and deformation beyond the offline pad',()=>{
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute([-1,-1,0,1,-1,0,0,1,0],3));
  geometry.setAttribute('skinIndex',new Uint16BufferAttribute([0,1,1,0,0,1,1,0,0,1,1,0],4));
  geometry.setAttribute('skinWeight',new Float32BufferAttribute([.9,.04,.06,0,.96,.01,.03,0,.94,.02,.04,0],4));
  geometry.setIndex([0,1,2]);
  const body=new Bone(),head=new Bone();body.name='Body';head.name='Head';body.add(head);
  const mesh=new SkinnedMesh(geometry,new MeshBasicMaterial());mesh.add(body);mesh.bind(new Skeleton([body,head]));
  const root=new Group(),parent=new Group();root.add(mesh);parent.add(root);
  const query=lazyHitSurfaces(root);
  for(const motion of [0,1,7]) {
    head.position.set(4*motion,-2*motion,3*motion);head.rotation.set(motion,.5*motion,.8*motion);head.scale.set(1+motion,.5+motion,2+motion);
    parent.position.set(2*motion,-motion,3*motion);parent.rotation.set(.1*motion,-.2*motion,.3*motion);parent.scale.set(.2+motion,3+motion,1.3+motion);
    const oracle=sampleHitSurfaces(root),p=oracle[0].positions;
    const a=new Vector3().fromArray(p,0),b=new Vector3().fromArray(p,3),c=new Vector3().fromArray(p,6);
    const center=a.clone().add(b).add(c).multiplyScalar(1/3),normal=b.sub(a).cross(c.sub(a)).normalize();
    const from=center.clone().addScaledVector(normal,-2),to=center.clone().addScaledVector(normal,2);
    const expected=segmentHitSurface(from,to,oracle);expect(expected).not.toBeNull();
    expect(query.mayIntersect!(from,to)).toBe(true);
    expect(segmentHitSurface(from,to,query(from,to))).toEqual(expected);
  }
});

it('uses the proven precomputed pad for arbitrary unsampled rotations with exact first-contact parity',()=>{
  const geometry=new BufferGeometry(),positions:number[]=[],weights:number[]=[],indices:number[]=[];
  for(let i=0;i<24;i++) for(const [x,y,z] of [[-.1,-.1,0],[.1,-.1,0],[0,.1,0]]) {
    positions.push(x+(i%4)*.22,y+Math.floor(i/4)*.2,z);
    weights.push(.85,.05,.1,0);indices.push(0,1,1,0);
  }
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('skinIndex',new Uint16BufferAttribute(indices,4));
  geometry.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));
  geometry.setIndex(Array.from({length:72},(_,i)=>i));
  const body=new Bone(),head=new Bone();body.name='Body';head.name='Head';head.position.y=1;body.add(head);
  const mesh=new SkinnedMesh(geometry,new MeshBasicMaterial());mesh.add(body);mesh.bind(new Skeleton([body,head]));
  const root=new Group(),parent=new Group();root.add(mesh);parent.add(root);
  const query=lazyHitSurfaces(root);query.enableDiagnostics!();
  let seed=0x129a,probes=0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  for(let frame=0;frame<64;frame++) {
    body.rotation.set(random()*6,random()*6,random()*6);head.rotation.set(random()*6,random()*6,random()*6);
    parent.position.set(random()*8-4+(frame===63?2e6:0),random()*8-4,random()*8-4);
    parent.rotation.set(random()*6,random()*6,random()*6);parent.scale.set(-.2-random(),.2+random(),.2+random());
    const oracle=sampleHitSurfaces(root),p=oracle[0].positions;
    query.beginFrame!();
    for(let t=0;t<24;t++) {
      const a=new Vector3().fromArray(p,t*9),b=new Vector3().fromArray(p,t*9+3),c=new Vector3().fromArray(p,t*9+6);
      const center=a.clone().add(b).add(c).multiplyScalar(1/3),normal=b.sub(a).cross(c.sub(a)).normalize();
      const from=center.clone().addScaledVector(normal,-2),to=center.clone().addScaledVector(normal,2);
      const expected=segmentHitSurface(from,to,oracle);expect(expected).not.toBeNull();
      expect(query.mayIntersect!(from,to)).toBe(true);
      expect(segmentHitSurface(from,to,query(from,to))).toEqual(expected);probes++;
    }
    query.endFrame!();
  }
  expect(probes).toBe(1536);expect(query.fallbackPadCount).toBe(0);
});
