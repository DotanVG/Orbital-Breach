import { Box3, Matrix4, SkinnedMesh, Vector3, type Object3D } from 'three';
import { BONE_BVH_PADDING } from './boneBvhPadding';
import { bindBoundsEntry, buildBindBvh, queryBindBvh, type BindBvh } from './bindPoseBvh';
import { hitZoneForBone, indexHitSurface, segmentHitSurface, segmentIntersectsBounds, type HitSurface } from '../../../shared/projectileCollider';
import type { HitZone } from '../../../shared/player-logic';
import type { Vec3 } from '../../../shared/vec3';

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
 * sampler; projectiles use the candidate BVHs below. */
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

interface Influence { bone: number; minWeight: number; maxWeight: number; count: number }
interface Displacement { influences: Influence[]; sumError: number; radius: Vector3; bounds: Box3; pad: Vector3; frame: number }
interface BoneTree { bone: number; tree: BindBvh; padding: Map<BindBvh,Displacement>; fixedPad: number; queryPad: Vector3 }
interface Palette {
  mesh: SkinnedMesh;
  skin: Matrix4[];
  forward: Matrix4[];
  inverse: Matrix4[];
  radii: number[];
  relative: Map<number,Map<number,Matrix4>>;
}
interface MeshState {
  mesh: SkinnedMesh;
  palette: Palette;
  trees: BoneTree[];
  positions: Float64Array;
  sampled: Uint8Array;
  candidates: Set<number>;
  indices: Uint32Array;
  zones: HitZone[];
  native: boolean;
  bindMatrix: Matrix4;
}
const owners=new WeakMap<SkinnedMesh,object>();
const bindPoint=new Vector3(),bonePoint=new Vector3();

/** Preserve Three.js's double-precision operation order (not GPU Float32 matrices). */
function skinHitVertex(mesh: SkinnedMesh, matrices: Matrix4[], index: number, point: Vector3): Vector3 {
  const attributes=mesh.geometry.attributes;
  bindPoint.fromBufferAttribute(attributes.position,index).applyMatrix4(mesh.bindMatrix);
  point.set(0,0,0);
  for(let slot=0;slot<4;slot++) {
    const weight=attributes.skinWeight.getComponent(index,slot);
    if(weight!==0) point.addScaledVector(bonePoint.copy(bindPoint).applyMatrix4(matrices[attributes.skinIndex.getComponent(index,slot)]),weight);
  }
  return point.applyMatrix4(mesh.bindMatrixInverse);
}

function buildMeshState(mesh: SkinnedMesh, palette: Palette): MeshState {
  const data=topologyFor(mesh),{position,skinIndex,skinWeight}=mesh.geometry.attributes;
  const positions=new Float64Array(position.count*3),point=new Vector3();
  const lists=new Map<number,number[]>();
  let native=!!mesh.geometry.morphAttributes.position?.length || mesh.bindMode!=='attached';
  for(let v=0;v<position.count;v++) {
    point.fromBufferAttribute(position,v).toArray(positions,v*3);
    let sum=0;
    for(let k=0;k<4;k++) {
      const w=skinWeight.getComponent(v,k),b=skinIndex.getComponent(v,k);
      sum+=w;
      if(!Number.isFinite(w) || w<0) native=true;
      if(w>0) {
        point.fromBufferAttribute(position,v).applyMatrix4(mesh.bindMatrix).applyMatrix4(mesh.skeleton.boneInverses[b]);
        palette.radii[b]=Math.max(palette.radii[b],point.length());
      }
    }
    // The broad sphere union assumes a convex combination; unsupported weights
    // take the native oracle rather than risking a false miss.
    if(Math.abs(sum-1)>1e-6) native=true;
  }
  for(let t=0;t<data.indices.length/3;t++) {
    const bones=new Set<number>(); let dominant=0,weight=-Infinity;
    for(let k=0;k<3;k++) for(let slot=0;slot<4;slot++) {
      const v=data.indices[t*3+k],w=skinWeight.getComponent(v,slot),b=skinIndex.getComponent(v,slot);
      if(w>=.1) bones.add(b);
      if(w>weight) {weight=w;dominant=b;}
    }
    if(!bones.size) bones.add(dominant);
    for(const b of bones) {
      if(!lists.has(b)) lists.set(b,[]);
      lists.get(b)!.push(t);
    }
  }
  const trees: BoneTree[]=[];
  for(const [bone,triangles] of lists) {
    const tree=buildBindBvh(positions,data.indices,triangles),padding=new Map<BindBvh,Displacement>();
    let relative=palette.relative.get(bone);
    if(!relative) {relative=new Map();palette.relative.set(bone,relative);}
    const measure=(node:BindBvh):number[]=>{
      const triangles=node.triangles ?? [...measure(node.left!),...measure(node.right!)];
      const influences=new Map<number,Influence>(),radius=new Vector3();let sumError=0;
      for(const t of triangles) for(let k=0;k<3;k++) {
        const v=data.indices[t*3+k];point.fromBufferAttribute(position,v);
        radius.x=Math.max(radius.x,Math.abs(point.x));radius.y=Math.max(radius.y,Math.abs(point.y));radius.z=Math.max(radius.z,Math.abs(point.z));
        let sum=0;
        for(let slot=0;slot<4;slot++) {
          const b=skinIndex.getComponent(v,slot);
          if(Array.from({length:slot},(_,k)=>skinIndex.getComponent(v,k)).includes(b)) continue;
          let w=0;for(let k=slot;k<4;k++) if(skinIndex.getComponent(v,k)===b) w+=skinWeight.getComponent(v,k);
          sum+=w;
          if(w<=0 || b===bone) continue;
          if(!relative!.has(b)) relative!.set(b,new Matrix4());
          let influence=influences.get(b);
          if(!influence) {influence={bone:b,minWeight:Infinity,maxWeight:0,count:0};influences.set(b,influence);}
          influence.minWeight=Math.min(influence.minWeight,w);influence.maxWeight=Math.max(influence.maxWeight,w);influence.count++;
        }
        sumError=Math.max(sumError,Math.abs(sum-1));
      }
      for(const influence of influences.values()) if(influence.count<triangles.length*3) influence.minWeight=0;
      padding.set(node,{influences:[...influences.values()],sumError,radius,bounds:new Box3(),pad:new Vector3(),frame:-1});
      return triangles;
    };
    measure(tree);trees.push({bone,tree,padding,fixedPad:BONE_BVH_PADDING[mesh.skeleton.bones[bone].name]??0,queryPad:new Vector3()});
  }
  return {mesh,palette,trees,positions:new Float64Array(positions.length),sampled:new Uint8Array(position.count),candidates:new Set(),indices:new Uint32Array(data.indices.length),zones:[],native,bindMatrix:mesh.bindMatrix.clone()};
}

/** With D_j=inverse(owner)*influence_j-I, skin(p)=p+sum(w_j*D_j*p).
 * Split each weight interval at its midpoint: the mean affine transform moves
 * the bind box; interval residuals conservatively pad it. Constant-weight
 * leaves therefore have no deformation slack. This bounds every pose (also
 * procedural translation/scale), without sampling or skinning vertices.
 */
function displacementBounds(node: BindBvh, group: Displacement, relative: Map<number,Matrix4>): Box3 {
  const x=(node.min.x+node.max.x)/2,y=(node.min.y+node.max.y)/2,z=(node.min.z+node.max.z)/2;
  const hx=(node.max.x-node.min.x)/2,hy=(node.max.y-node.min.y)/2,hz=(node.max.z-node.min.z)/2;
  for(let axis=0;axis<3;axis++) {
    let a=axis===0?1:0,b=axis===1?1:0,c=axis===2?1:0,d=0,error=group.radius.getComponent(axis)*group.sumError+1e-7;
    for(const influence of group.influences) {
      const e=relative.get(influence.bone)!.elements;
      const da=e[axis]-(axis===0?1:0),db=e[4+axis]-(axis===1?1:0),dc=e[8+axis]-(axis===2?1:0),dd=e[12+axis];
      const mean=(influence.minWeight+influence.maxWeight)/2,half=(influence.maxWeight-influence.minWeight)/2;
      a+=mean*da;b+=mean*db;c+=mean*dc;d+=mean*dd;
      error+=half*(Math.abs(da*x+db*y+dc*z+dd)+Math.abs(da)*hx+Math.abs(db)*hy+Math.abs(dc)*hz);
    }
    const center=a*x+b*y+c*z+d,extent=Math.abs(a)*hx+Math.abs(b)*hy+Math.abs(c)*hz+error;
    group.bounds.min.setComponent(axis,center-extent);group.bounds.max.setComponent(axis,center+extent);
    const da=a-(axis===0?1:0),db=b-(axis===1?1:0),dc=c-(axis===2?1:0);
    group.pad.setComponent(axis,Math.abs(da*x+db*y+dc*z+d)+Math.abs(da)*hx+Math.abs(db)*hy+Math.abs(dc)*hz+error);
  }
  return group.bounds;
}

export type HitSurfaceQuery = ((start?: Vec3, end?: Vec3) => readonly HitSurface[]) & {
  mayIntersect?: (start: Vec3, end: Vec3) => boolean;
  beginFrame?: () => void;
  endFrame?: () => void;
  enableDiagnostics?: () => void;
  readonly skinnedVertexCount?: number;
  readonly candidateTriangleCount?: number;
  readonly boneMatrixUpdateCount?: number;
};
const queries=new WeakMap<Object3D,HitSurfaceQuery>();

/** Bone-local bind BVHs only nominate triangles. Original mesh/triangle order
 * and the native skinning formula retain first-contact/zone tie behaviour. */
export function lazyHitSurfaces(root: Object3D): HitSurfaceQuery {
  const existing=queries.get(root);if(existing) return existing;
  const owner={},palettes:Palette[]=[],states:MeshState[]=[];
  const register=(node:SkinnedMesh)=>{
    let palette=palettes.find(p=>p.mesh.skeleton.bones.length===node.skeleton.bones.length && p.mesh.skeleton.bones.every((b,i)=>b===node.skeleton.bones[i] && p.mesh.skeleton.boneInverses[i].equals(node.skeleton.boneInverses[i])) && p.mesh.bindMatrix.equals(node.bindMatrix));
    if(!palette) {
      palette={mesh:node,skin:node.skeleton.bones.map(()=>new Matrix4()),forward:node.skeleton.bones.map(()=>new Matrix4()),inverse:node.skeleton.bones.map(()=>new Matrix4()),radii:node.skeleton.bones.map(()=>0),relative:new Map()};
      palettes.push(palette);
    }
    states.push(buildMeshState(node,palette));
  };
  root.traverse(node=>{if(node instanceof SkinnedMesh) register(node);});
  const jobs=states.flatMap(state=>state.trees.map(group=>({state,group,entry:Infinity})));
  let stable=false,prepared=false,matricesReady=false,nativeRequired=false,diagnostics=false,full:HitSurface[]|undefined;
  let signature:number[]=[],objects:Object3D[]=[];
  let skinnedVertexCount=0,candidateTriangleCount=0,boneMatrixUpdateCount=0,frame=0;
  const broad=new Box3(),point=new Vector3(),localStart=new Vector3(),localEnd=new Vector3();
  const stack:BindBvh[]=[],surfaces:HitSurface[]=[];
  const leafIndices=new Uint32Array(12),leafZones:HitZone[]=[];
  const fullLocalEnd=new Vector3();
  const prepare=()=>{
    if(stable && prepared) return;
    const next:number[]=[],current:Object3D[]=[],meshes:SkinnedMesh[]=[];
    const remember=(node:Object3D)=>{
      current.push(node);const p=node.position,q=node.quaternion,s=node.scale;
      next.push(p.x,p.y,p.z,q.x,q.y,q.z,q.w,s.x,s.y,s.z);
      if(!node.matrixAutoUpdate) next.push(...node.matrix.elements);
    };
    for(let parent=root.parent;parent;parent=parent.parent) remember(parent);
    root.traverse(node=>{remember(node);if(node instanceof SkinnedMesh) {meshes.push(node);next.push(...node.bindMatrix.elements,...(node.morphTargetInfluences??[]));}});
    // Assets arrive asynchronously; a query may already exist for an empty
    // avatar root. Rebuild only when its actual skinned primitive list changes.
    if(meshes.length!==states.length || meshes.some((mesh,i)=>mesh!==states[i].mesh)) {
      states.length=0;palettes.length=0;jobs.length=0;signature=[];
      for(const mesh of meshes) register(mesh);
      for(const state of states) for(const group of state.trees) jobs.push({state,group,entry:Infinity});
    }
    prepared=true;
    if(next.length===signature.length && current.length===objects.length && current.every((n,i)=>n===objects[i]) && next.every((n,i)=>n===signature[i]) && states.every(s=>owners.get(s.mesh)===owner)) return;
    signature=next;objects=current;matricesReady=false;full=undefined;frame++;
    root.updateWorldMatrix(true,true);root.updateMatrixWorld(true);
    broad.makeEmpty();
    for(const state of states) {state.sampled.fill(0);owners.set(state.mesh,owner);}
    if(!palettes.length) return;
    // Actor AABB: union joint-centred conservative spheres. This uses current
    // world matrices directly, BEFORE skin-matrix products, influence-box
    // transforms or BVH queries. Non-unit weight sums need a numerical guard.
    for(const palette of palettes) palette.mesh.skeleton.bones.forEach((bone,i)=>{
      const e=bone.matrixWorld.elements,r=palette.radii[i];if(!r) return;
      const rx=r*Math.hypot(e[0],e[4],e[8]),ry=r*Math.hypot(e[1],e[5],e[9]),rz=r*Math.hypot(e[2],e[6],e[10]);
      broad.expandByPoint(point.set(e[12]-rx,e[13]-ry,e[14]-rz));
      broad.expandByPoint(point.set(e[12]+rx,e[13]+ry,e[14]+rz));
    });
    const magnitude=Math.max(Math.abs(broad.min.x),Math.abs(broad.min.y),Math.abs(broad.min.z),Math.abs(broad.max.x),Math.abs(broad.max.y),Math.abs(broad.max.z),1);
    broad.expandByScalar(magnitude*1e-6+1e-7);
    nativeRequired=states.some(s=>s.native || s.mesh.bindMode!=='attached' || !s.mesh.bindMatrix.equals(s.bindMatrix));
    if(nativeRequired) broad.set(point.set(-Infinity,-Infinity,-Infinity),localEnd.set(Infinity,Infinity,Infinity));
  };
  const prepareMatrices=()=>{
    if(matricesReady) return;matricesReady=true;
    for(const palette of palettes) palette.mesh.skeleton.bones.forEach((bone,i)=>{
      palette.skin[i].multiplyMatrices(bone.matrixWorld,palette.mesh.skeleton.boneInverses[i]);
      palette.forward[i].copy(palette.skin[i]).multiply(palette.mesh.bindMatrix);
      palette.inverse[i].copy(palette.forward[i]).invert();if(diagnostics) boneMatrixUpdateCount++;
    });
    for(const palette of palettes) for(const [bone,matrices] of palette.relative) for(const [other,matrix] of matrices) matrix.multiplyMatrices(palette.inverse[bone],palette.forward[other]);
  };
  const query:HitSurfaceQuery=(start,end)=>{
    prepare();
    if(!start || !end) return full??=sampleHitSurfaces(root);
    surfaces.length=0;
    if(broad.isEmpty() || !segmentIntersectsBounds(start,end,broad.min,broad.max)) return surfaces;
    if(nativeRequired) return sampleHitSurfaces(root);
    prepareMatrices();let closest=1;
    const boundsFor=(group:BoneTree,palette:Palette,node:BindBvh)=>{
      const bounds=group.padding.get(node)!;
      if(bounds.frame!==frame) {displacementBounds(node,bounds,palette.relative.get(group.bone)!);bounds.frame=frame;}
      return bounds.bounds;
    };
    for(const state of states) state.candidates.clear();
    for(const job of jobs) {
      const {palette}=job.state,inverse=palette.inverse[job.group.bone];
      localStart.copy(start).applyMatrix4(inverse);localEnd.copy(end).applyMatrix4(inverse);
      const bounds=boundsFor(job.group,palette,job.group.tree);
      // Offline clip maxima seed a fixed padded BVH. A live displacement
      // certificate expands it for between-sample motion, recoil or any pose
      // outside that capture; the tighter node intervals further reject work.
      job.group.queryPad.setScalar(job.group.fixedPad).max(job.group.padding.get(job.group.tree)!.pad);
      job.entry=palette.forward[job.group.bone].determinant()===0 ? 0 : bindBoundsEntry(localStart,localEnd,bounds.min,bounds.max);
    }
    jobs.sort((a,b)=>a.entry-b.entry);
    for(const {state,group,entry} of jobs) {
      if(entry>closest+1e-9) continue;
      const {mesh,palette}=state,data=topologyFor(mesh),inverse=palette.inverse[group.bone];
      localStart.copy(start).applyMatrix4(inverse);fullLocalEnd.copy(end).applyMatrix4(inverse);
      localEnd.copy(localStart).lerp(fullLocalEnd,Math.min(1,closest+1e-9));
      const visit=(triangles:readonly number[])=>{
        let count=0;leafZones.length=0;
        for(const t of triangles) {
          if(state.candidates.has(t)) continue;
          state.candidates.add(t);leafZones.push(data.zones[t]);
          for(let k=0;k<3;k++) {
            const v=data.indices[t*3+k];leafIndices[count++]=v;
            if(!state.sampled[v]) {
              skinHitVertex(mesh,palette.skin,v,point).applyMatrix4(mesh.matrixWorld).toArray(state.positions,v*3);
              state.sampled[v]=1;if(diagnostics) skinnedVertexCount++;
            }
          }
        }
        if(count) {
          const hit=segmentHitSurface(start,end,[{positions:state.positions,indices:leafIndices.subarray(0,count),zones:leafZones}]);
          if(hit && hit.t<closest) {closest=hit.t;localEnd.copy(localStart).lerp(fullLocalEnd,Math.min(1,closest+1e-9));}
        }
      };
      if(palette.forward[group.bone].determinant()===0) {
        // An inverse ray is undefined at singular scales: exact native candidates.
        for(let t=0;t<data.zones.length;t++) visit([t]);
        continue;
      }
      const padding=(node:BindBvh)=>{
        localEnd.copy(localStart).lerp(fullLocalEnd,Math.min(1,closest+1e-9));
        return boundsFor(group,palette,node);
      };
      queryBindBvh(group.tree,localStart,localEnd,padding,state.candidates,stack,visit,group.queryPad);
    }
    // Restore asset mesh/triangle ordering for exact first-contact ties.
    for(const state of states) {
      const data=topologyFor(state.mesh),triangles=[...state.candidates].sort((a,b)=>a-b);let count=0;
      state.zones.length=0;
      for(const t of triangles) {
        for(let k=0;k<3;k++) state.indices[count++]=data.indices[t*3+k];
        state.zones.push(data.zones[t]);
      }
      if(diagnostics) candidateTriangleCount+=triangles.length;
      if(count) surfaces.push({positions:state.positions,indices:state.indices.subarray(0,count),zones:state.zones});
    }
    return surfaces;
  };
  query.mayIntersect=(start,end)=>{prepare();return !broad.isEmpty() && segmentIntersectsBounds(start,end,broad.min,broad.max);};
  query.beginFrame=()=>{stable=true;prepared=false;};query.endFrame=()=>{stable=false;prepared=false;};
  query.enableDiagnostics=()=>{diagnostics=true;};
  Object.defineProperties(query,{skinnedVertexCount:{get:()=>skinnedVertexCount},candidateTriangleCount:{get:()=>candidateTriangleCount},boneMatrixUpdateCount:{get:()=>boneMatrixUpdateCount}});
  queries.set(root,query);return query;
}
