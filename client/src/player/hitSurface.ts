import { Box3, Matrix4, SkinnedMesh, Vector3, type Object3D } from 'three';
import { hitZoneForBone, indexHitSurface, segmentIntersectsBounds, type HitSurface } from '../../../shared/projectileCollider';
import type { HitZone } from '../../../shared/player-logic';
import type { Vec3 } from '../../../shared/vec3';
import { segmentIntersectsCapsule } from './boneCapsule';

const topology = new WeakMap<SkinnedMesh, Pick<HitSurface, 'indices' | 'zones'>>();

function topologyFor(mesh: SkinnedMesh): Pick<HitSurface, 'indices' | 'zones'> {
  const count=mesh.geometry.attributes.position.count;
  let data=topology.get(mesh);
  if (!data) {
    const index=mesh.geometry.index;
    const indices=Uint32Array.from({length:index?.count ?? count},(_,i)=>index ? index.getX(i) : i);
    const skin=mesh.geometry.attributes.skinIndex, weights=mesh.geometry.attributes.skinWeight;
    const vertexZones=Array.from({length:count},(_,i)=>{
      let dominant=0;
      for(let k=1;k<4;k++) if(weights.getComponent(i,k)>weights.getComponent(i,dominant)) dominant=k;
      return hitZoneForBone(mesh.skeleton.bones[skin.getComponent(i,dominant)].name);
    });
    const zones: HitZone[]=[];
    for(let i=0;i<indices.length;i+=3) {
      const a=vertexZones[indices[i]],b=vertexZones[indices[i+1]],c=vertexZones[indices[i+2]];
      // Every head vertex's incident triangles stay head; other seams use majority.
      zones.push(a==='head'||b==='head'||c==='head' ? 'head' : b===c ? b : a);
    }
    data={indices,zones}; topology.set(mesh,data);
  }
  return data;
}

/** Sample body AND helmet triangles. A hidden first-person root still takes
 * hits; guns/name tags are not skinned surfaces. Full native-skin oracle/debug
 * sampler; projectiles use lazy patches below. */
export function sampleHitSurfaces(root: Object3D): HitSurface[] {
  root.updateWorldMatrix(true, true);
  root.updateMatrixWorld(true); // refresh SkinnedMesh.bindMatrixInverse too
  const surfaces: HitSurface[] = [];
  const point = new Vector3();
  root.traverse(node => {
    if (!(node instanceof SkinnedMesh)) return;
    node.skeleton.update();
    const count=node.geometry.attributes.position.count;
    const data=topologyFor(node);
    const positions=new Float64Array(count*3);
    for(let i=0;i<count;i++) {
      node.getVertexPosition(i,point).applyMatrix4(node.matrixWorld);
      point.toArray(positions,i*3);
    }
    surfaces.push(indexHitSurface({positions,...data}));
  });
  return surfaces;
}

interface BoneEnvelope { boxes: Map<number, Box3>; minSum: number; maxSum: number; safe: boolean }
interface MeshEnvelope { whole: BoneEnvelope; chunks: BoneEnvelope[]; owners: Uint16Array; bones: Map<number, BoneEnvelope> }
interface BoneCapsule { start: Vector3; end: Vector3; radius: number }
const envelopes = new WeakMap<SkinnedMesh, MeshEnvelope>();
interface FrameMesh {
  owner: object;
  positions: Float64Array;
  sampled: Uint8Array;
  chunks: Map<number, { surface: HitSurface; indices: Uint32Array }>;
  bounds: Map<number, Box3>;
  bounded: Set<number>;
  whole: Box3;
  skinMatrices: Matrix4[];
  envelopeMatrices: Matrix4[];
  toWorld: Matrix4;
  capsules: Map<number, BoneCapsule>;
  capsulesReady: boolean;
  boneHits: Uint8Array;
}
const frameMeshes = new WeakMap<SkinnedMesh, FrameMesh>();
const envelopeBox = new Box3();
const bindPoint = new Vector3(), bonePoint = new Vector3();
const capsuleBox = new Box3(), toBone = new Matrix4();

/** Each owner includes ALL vertices/influences of its triangles, including
 * blended seams. The weighted convex envelope encloses the entire triangle.
 * Capsules only filter work; topologyFor remains the sole zone authority. */
function updateBoneCapsules(mesh: SkinnedMesh, state: FrameMesh, envelope: MeshEnvelope): void {
  for (const [bone, skin] of envelope.bones) {
    let capsule=state.capsules.get(bone);
    if(!capsule) { capsule={start:new Vector3(),end:new Vector3(),radius:0}; state.capsules.set(bone,capsule); }
    if(!skin.safe) { capsule.radius=Infinity; continue; }
    const world=mesh.skeleton.bones[bone].matrixWorld;
    toBone.copy(world).invert().multiply(state.toWorld);
    envelopeBounds(skin,state.envelopeMatrices,toBone,capsuleBox);
    const min=capsuleBox.min,max=capsuleBox.max;
    capsule.start.addVectors(min,max).multiplyScalar(.5);
    capsule.end.copy(capsule.start);
    // Longest bone-local axis keeps fingers, limbs and the helmet compact.
    const x=max.x-min.x,y=max.y-min.y,z=max.z-min.z;
    const axis=x>y && x>z ? 'x' : y>z ? 'y' : 'z';
    capsule.start[axis]=min[axis]; capsule.end[axis]=max[axis];
    const radialSq=(axis==='x'?0:x*x)+(axis==='y'?0:y*y)+(axis==='z'?0:z*z);
    // Gershgorin bound on A^T A: exact for uniform scale/rotation, safe for
    // nonuniform ancestor scale and shear (max column length alone is unsafe).
    const e=world.elements;
    const xx=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],yy=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],zz=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];
    const xy=Math.abs(e[0]*e[4]+e[1]*e[5]+e[2]*e[6]),xz=Math.abs(e[0]*e[8]+e[1]*e[9]+e[2]*e[10]),yz=Math.abs(e[4]*e[8]+e[5]*e[9]+e[6]*e[10]);
    capsule.radius=Math.sqrt(radialSq*Math.max(xx+xy+xz,yy+xy+yz,zz+xz+yz))*.5+1e-8;
    capsule.start.applyMatrix4(world); capsule.end.applyMatrix4(world);
    if(world.determinant()===0) capsule.radius=Infinity;
  }
  state.capsulesReady=true;
}

/** Same weighted bone positions as Three.js, with pose-invariant matrix
 * products prepared once per frame instead of once per vertex/influence. */
function skinHitVertex(mesh: SkinnedMesh, matrices: Matrix4[], index: number, point: Vector3): Vector3 {
  if(mesh.geometry.morphAttributes.position?.length) return mesh.getVertexPosition(index,point);
  const attributes=mesh.geometry.attributes;
  bindPoint.fromBufferAttribute(attributes.position,index).applyMatrix4(mesh.bindMatrix);
  point.set(0,0,0);
  for(let slot=0;slot<4;slot++) {
    const weight=attributes.skinWeight.getComponent(index,slot);
    if(weight!==0) point.addScaledVector(bonePoint.copy(bindPoint).applyMatrix4(matrices[attributes.skinIndex.getComponent(index,slot)]),weight);
  }
  return point.applyMatrix4(mesh.bindMatrixInverse);
}

// A weighted vertex is a convex combination of its bone-transformed positions,
// scaled by its actual weight sum. Bounding those positions needs no skinning.
function boneEnvelope(mesh: SkinnedMesh, indices: Uint32Array): BoneEnvelope {
  const boxes=new Map<number,Box3>(), point=new Vector3();
  const {position,skinIndex,skinWeight}=mesh.geometry.attributes;
  let minSum=Infinity,maxSum=-Infinity,safe=!mesh.geometry.morphAttributes.position?.length;
  for (const i of new Set(indices)) {
    point.fromBufferAttribute(position,i);
    let sum=0;
    for(let k=0;k<4;k++) {
      const w=skinWeight.getComponent(i,k), bone=skinIndex.getComponent(i,k);
      if (!Number.isFinite(w) || w<0) safe=false;
      sum+=w;
      if(w>0) {
        if(!boxes.has(bone)) boxes.set(bone,new Box3());
        boxes.get(bone)!.expandByPoint(point);
      }
    }
    minSum=Math.min(minSum,sum); maxSum=Math.max(maxSum,sum);
  }
  return {boxes,minSum,maxSum,safe:safe && minSum>0};
}

/** Affine AABB transform by centre/extents; avoids transforming eight corners. */
function affineBounds(source: Box3, matrix: Matrix4, target: Box3): Box3 {
  const x=(source.min.x+source.max.x)/2,y=(source.min.y+source.max.y)/2,z=(source.min.z+source.max.z)/2;
  const hx=(source.max.x-source.min.x)/2,hy=(source.max.y-source.min.y)/2,hz=(source.max.z-source.min.z)/2,e=matrix.elements;
  const cx=e[0]*x+e[4]*y+e[8]*z+e[12],cy=e[1]*x+e[5]*y+e[9]*z+e[13],cz=e[2]*x+e[6]*y+e[10]*z+e[14];
  const rx=Math.abs(e[0])*hx+Math.abs(e[4])*hy+Math.abs(e[8])*hz;
  const ry=Math.abs(e[1])*hx+Math.abs(e[5])*hy+Math.abs(e[9])*hz;
  const rz=Math.abs(e[2])*hx+Math.abs(e[6])*hy+Math.abs(e[10])*hz;
  target.min.set(cx-rx,cy-ry,cz-rz);target.max.set(cx+rx,cy+ry,cz+rz);
  return target;
}

function envelopeBounds(envelope: BoneEnvelope, matrices: Matrix4[], toWorld: Matrix4, bound=new Box3()): Box3 {
  if(!envelope.safe) return bound.set(new Vector3(-Infinity,-Infinity,-Infinity),new Vector3(Infinity,Infinity,Infinity));
  bound.makeEmpty();
  for(const [bone,local] of envelope.boxes) {
    bound.union(affineBounds(local,matrices[bone],envelopeBox));
  }
  for(const axis of ['x','y','z'] as const) {
    const a=bound.min[axis]*envelope.minSum,b=bound.min[axis]*envelope.maxSum;
    const c=bound.max[axis]*envelope.minSum,d=bound.max[axis]*envelope.maxSum;
    bound.min[axis]=Math.min(a,b,c,d); bound.max[axis]=Math.max(a,b,c,d);
  }
  // Numerical guard only; this enclosing box can reject, never award damage.
  return affineBounds(bound,toWorld,bound).expandByScalar(1e-8);
}

export type HitSurfaceQuery = ((start?: Vec3, end?: Vec3) => readonly HitSurface[]) & {
  mayIntersect?: (start: Vec3, end: Vec3) => boolean;
  beginFrame?: () => void;
  endFrame?: () => void;
  readonly skinnedVertexCount?: number;
};

const queries = new WeakMap<Object3D, HitSurfaceQuery>();

/** Reuse the root's query across target lists and unchanged poses.
 * Bone/world matrix changes invalidate cached bounds and skinned vertices.
 * Whole-actor, per-bone capsules and patch envelopes reject BEFORE skinning. */
export function lazyHitSurfaces(root: Object3D): HitSurfaceQuery {
  const existing=queries.get(root);
  if(existing) return existing;
  const owner={};
  let stablePose=false,prepared=false;
  let skinnedVertexCount=0;
  let signature: number[] = [], meshes: SkinnedMesh[] = [], bounds: Box3[] = [];
  let objects: Object3D[] = [];
  let states: FrameMesh[] = [];
  let full: HitSurface[] | undefined;
  const prepare=()=>{
    if(stablePose && prepared) return;
    const next: number[]=[], current: SkinnedMesh[]=[], currentObjects: Object3D[]=[];
    const remember=(node: Object3D)=>{
      currentObjects.push(node);
      const p=node.position,q=node.quaternion,s=node.scale;
      next.push(p.x,p.y,p.z,q.x,q.y,q.z,q.w,s.x,s.y,s.z);
      if(!node.matrixAutoUpdate) next.push(...node.matrix.elements);
    };
    for(let parent=root.parent;parent;parent=parent.parent) remember(parent);
    root.traverse(node=>{
      remember(node);
      if(!(node instanceof SkinnedMesh)) return;
      current.push(node);
      next.push(...node.bindMatrix.elements);
      next.push(...(node.morphTargetInfluences ?? []));
    });
    prepared=true;
    if(currentObjects.length===objects.length && currentObjects.every((n,i)=>n===objects[i]) && next.length===signature.length && next.every((v,i)=>v===signature[i]) && states.every(s=>s.owner===owner)) return;
    objects=currentObjects; meshes=current; signature=next; full=undefined;
    root.updateWorldMatrix(true,true); root.updateMatrixWorld(true);
    states=meshes.map(mesh=>{
      if(!envelopes.has(mesh)) {
        const index=mesh.geometry.index;
        const indices=Uint32Array.from({length:index?.count ?? mesh.geometry.attributes.position.count},(_,i)=>index?index.getX(i):i);
        const chunks: BoneEnvelope[]=[];
        for(let i=0;i<indices.length;i+=192) chunks.push(boneEnvelope(mesh,indices.subarray(i,i+192)));
        const owners=new Uint16Array(indices.length/3), groups=new Map<number,number[]>();
        const skin=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
        for(let t=0;t<owners.length;t++) {
          const vertex=indices[t*3]; let slot=0;
          for(let k=1;k<4;k++) if(weights.getComponent(vertex,k)>weights.getComponent(vertex,slot)) slot=k;
          const bone=skin.getComponent(vertex,slot); owners[t]=bone;
          if(!groups.has(bone)) groups.set(bone,[]);
          groups.get(bone)!.push(indices[t*3],indices[t*3+1],indices[t*3+2]);
        }
        const bones=new Map<number,BoneEnvelope>();
        for(const [bone,vertices] of groups) bones.set(bone,boneEnvelope(mesh,Uint32Array.from(vertices)));
        envelopes.set(mesh,{whole:boneEnvelope(mesh,indices),chunks,owners,bones});
      }
      let state=frameMeshes.get(mesh);
      if(!state) {
        state={owner,positions:new Float64Array(mesh.geometry.attributes.position.count*3),sampled:new Uint8Array(mesh.geometry.attributes.position.count),chunks:new Map(),bounds:new Map(),bounded:new Set(),whole:new Box3(),skinMatrices:mesh.skeleton.bones.map(()=>new Matrix4()),envelopeMatrices:mesh.skeleton.bones.map(()=>new Matrix4()),toWorld:new Matrix4(),capsules:new Map(),capsulesReady:false,boneHits:new Uint8Array(mesh.skeleton.bones.length)};
        frameMeshes.set(mesh,state);
      }
      state.owner=owner; state.sampled.fill(0); state.bounded.clear(); state.capsulesReady=false;
      mesh.skeleton.bones.forEach((bone,i)=>state!.skinMatrices[i].multiplyMatrices(bone.matrixWorld,mesh.skeleton.boneInverses[i]));
      state.skinMatrices.forEach((matrix,i)=>state!.envelopeMatrices[i].copy(matrix).multiply(mesh.bindMatrix));
      state.toWorld.multiplyMatrices(mesh.matrixWorld,mesh.bindMatrixInverse);
      envelopeBounds(envelopes.get(mesh)!.whole,state.envelopeMatrices,state.toWorld,state.whole);
      return state;
    });
    bounds=states.map(s=>s.whole);
  };
  const query: HitSurfaceQuery=(start,end)=>{
    prepare();
    if(!start || !end) return full ??= sampleHitSurfaces(root);
    const surfaces: HitSurface[]=[],point=new Vector3();
    meshes.forEach((mesh,m)=>{
      if(!segmentIntersectsBounds(start,end,bounds[m].min,bounds[m].max)) return;
      // Topology/zone ownership is shared with the unoptimized sampler.
      if(!topology.has(mesh)) {
        // Populate ownership without skinning this mesh (see sampler helper).
        topologyFor(mesh);
      }
      const data=topology.get(mesh)!,state=states[m],envelopeData=envelopes.get(mesh)!,chunks=envelopeData.chunks;
      if(!state.capsulesReady) updateBoneCapsules(mesh,state,envelopeData);
      state.boneHits.fill(0);
      let any=false;
      for(const [bone,capsule] of state.capsules) {
        if(segmentIntersectsCapsule(start,end,capsule.start,capsule.end,capsule.radius)) { state.boneHits[bone]=1; any=true; }
      }
      if(!any) return;
      chunks.forEach((envelope,c)=>{
        const first=c*192,last=Math.min(first+192,data.indices.length);
        let selected=false;
        for(let i=first;i<last;i+=3) if(state.boneHits[envelopeData.owners[i/3]]) { selected=true; break; }
        if(!selected) return;
        let bound=state.bounds.get(c);
        if(!bound) { bound=new Box3(); state.bounds.set(c,bound); }
        if(!state.bounded.has(c)) { envelopeBounds(envelope,state.envelopeMatrices,state.toWorld,bound); state.bounded.add(c); }
        if(!segmentIntersectsBounds(start,end,bound.min,bound.max)) return;
        let cached=state.chunks.get(c);
        if(!cached) {
          const indices=new Uint32Array(last-first);
          cached={surface:{positions:state.positions,indices,zones:[]},indices};
          state.chunks.set(c,cached);
        }
        const surface=cached.surface,zones=surface.zones as HitZone[];
        let count=0;
        for(let t=first;t<last;t+=3) if(state.boneHits[envelopeData.owners[t/3]]) {
          zones[count/3]=data.zones[t/3];
          for(let k=0;k<3;k++) {
            const i=data.indices[t+k]; cached.indices[count++]=i;
            if(!state.sampled[i]) {
              skinHitVertex(mesh,state.skinMatrices,i,point).applyMatrix4(mesh.matrixWorld).toArray(state.positions,i*3);
              skinnedVertexCount++; state.sampled[i]=1;
            }
          }
        }
        zones.length=count/3;
        surface.indices=cached.indices.subarray(0,count);
        surfaces.push(surface);
      });
    });
    return surfaces;
  };
  query.mayIntersect=(start,end)=>{prepare();return bounds.some(b=>segmentIntersectsBounds(start,end,b.min,b.max));};
  // Avatar animation/pose updates precede this synchronous projectile pass.
  // No traversal/signature scan per distant projectile; unlock even on callback errors.
  query.beginFrame=()=>{stablePose=true;prepared=false;};
  query.endFrame=()=>{stablePose=false;prepared=false;};
  Object.defineProperty(query,'skinnedVertexCount',{get:()=>skinnedVertexCount});
  queries.set(root,query);
  return query;
}
