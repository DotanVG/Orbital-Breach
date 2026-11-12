import { Box3, Matrix4, SkinnedMesh, Vector3, type Object3D } from 'three';
import { bindBoundsEntry, buildBindBvh, queryBindBvh, type BindBvh } from './bindPoseBvh';
import { sampleBoneNodePads } from './boneBvhClipPads';
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

interface Influence { matrix: Matrix4; minWeight: number; maxWeight: number; count: number }
interface Displacement { influences: Influence[]; sumError: number; radius: Vector3; bounds: Box3; min: Vector3; max: Vector3; frame: number; sampledPad?: Vector3 }
interface BoneTree { bone: number; tree: BindBvh; padding: Displacement[]; reject: {bone: number; center: Vector3; half: Vector3}[]; broad: Box3; broadFrame: number[] }
interface Palette {
  mesh: SkinnedMesh;
  skin: Matrix4[];
  forward: Matrix4[];
  inverse: Matrix4[];
  prepareSkin: (bone: number) => void;
  skinFrame: number[];
  inverseFrame: number[];
  relativeFrame: number[];
  rayQuery: number[];
  rayStart: Vector3[];
  rayEnd: Vector3[];
  singular: boolean[];
  radii: number[];
  relative: Map<number,Map<number,Matrix4>>;
}
interface MeshState {
  mesh: SkinnedMesh;
  palette: Palette;
  trees: BoneTree[];
  positions: Float64Array;
  sampled: Uint8Array;
  candidates: Uint8Array;
  candidateCount: number;
  triangleOrder: number[];
  indices: Uint32Array;
  zones: HitZone[];
  native: boolean;
  bindMatrix: Matrix4;
}
// Bind only the dirty flag to descendant events. A detached asset must not
// retain the old root/query through an event-listener closure.
function invalidateHitHierarchy(this: {dirty: boolean}): void {this.dirty=true;}

interface TransformEnvelope { node: Object3D; parent: Object3D | null; translation: number; minScale: number; maxScale: number }

// Any rotation is allowed. Translation/scale budgets are checked once before a
// frame's coarse reject. Outside them we retain tight runtime certificates.
function transformEnvelope(node: Object3D): TransformEnvelope {
  return {node,parent:node.parent,translation:node.position.length()*1.35+.02,
    minScale:Math.min(Math.abs(node.scale.x),Math.abs(node.scale.y),Math.abs(node.scale.z))*.999-1e-8,
    maxScale:Math.max(Math.abs(node.scale.x),Math.abs(node.scale.y),Math.abs(node.scale.z))*1.001+1e-8};
}

const owners=new WeakMap<SkinnedMesh,object>();
const bindPoint=new Vector3(),bonePoint=new Vector3();

/** Preserve Three.js's double-precision operation order (not GPU Float32 matrices). */
function skinHitVertex(mesh: SkinnedMesh, palette: Palette, index: number, point: Vector3): Vector3 {
  const attributes=mesh.geometry.attributes;
  bindPoint.fromBufferAttribute(attributes.position,index).applyMatrix4(mesh.bindMatrix);
  point.set(0,0,0);
  for(let slot=0;slot<4;slot++) {
    const weight=attributes.skinWeight.getComponent(index,slot);
    if(weight!==0) {
      const bone=attributes.skinIndex.getComponent(index,slot);palette.prepareSkin(bone);
      point.addScaledVector(bonePoint.copy(bindPoint).applyMatrix4(palette.skin[bone]),weight);
    }
  }
  return point.applyMatrix4(mesh.bindMatrixInverse);
}

function buildMeshState(mesh: SkinnedMesh, palette: Palette, envelopes: Map<Object3D,TransformEnvelope>): MeshState {
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
    const tree=buildBindBvh(positions,data.indices,triangles);
    // A convex skin blend lies in the union AABB of all influencing bind
    // boxes transformed by their current joints. Reject only: never damage.
    const reject=new Map<number,Box3>();
    for(const t of triangles) for(let k=0;k<3;k++) {
      const v=data.indices[t*3+k];
      for(let slot=0;slot<4;slot++) if(skinWeight.getComponent(v,slot)>0) {
        const b=skinIndex.getComponent(v,slot);
        let bounds=reject.get(b);if(!bounds) {bounds=new Box3();reject.set(b,bounds);}
        point.fromBufferAttribute(position,v).applyMatrix4(mesh.bindMatrix).applyMatrix4(mesh.skeleton.boneInverses[b]);
        bounds.expandByPoint(point);
      }
    }
    let relative=palette.relative.get(bone);
    if(!relative) {relative=new Map();palette.relative.set(bone,relative);}
    // Restore the tight per-node interval certificate on the flat topology.
    const padding:Displacement[]=[];
    const measure=(node:number):number[]=>{
      const offset=node*4,count=tree.nodes[offset+3],first=tree.nodes[offset+2];
      const triangles=count?Array.from(tree.triangles.subarray(first,first+count)):[...measure(tree.nodes[offset]),...measure(tree.nodes[offset+1])];
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
          if(!influence) {influence={matrix:relative!.get(b)!,minWeight:Infinity,maxWeight:0,count:0};influences.set(b,influence);}
          influence.minWeight=Math.min(influence.minWeight,w);influence.maxWeight=Math.max(influence.maxWeight,w);influence.count++;
        }
        sumError=Math.max(sumError,Math.abs(sum-1));
      }
      for(const influence of influences.values()) if(influence.count<triangles.length*3) influence.minWeight=0;
      const offsetBounds=node*6,b=tree.bounds;
      padding[node]={influences:[...influences.values()],sumError,radius,bounds:new Box3(),
        min:new Vector3(b[offsetBounds],b[offsetBounds+1],b[offsetBounds+2]),max:new Vector3(b[offsetBounds+3],b[offsetBounds+4],b[offsetBounds+5]),frame:-1};
      return triangles;
    };
    measure(0);
    trees.push({bone,tree,padding,reject:[...reject].map(([bone,box])=>({bone,center:box.getCenter(new Vector3()),half:box.getSize(new Vector3()).multiplyScalar(.5)})),broad:new Box3(),broadFrame:[-1,-1,-1]});
  }
  if(!native) {
    const sampled=sampleBoneNodePads(mesh,trees,data.indices);
    for(let g=0;g<trees.length;g++) for(let n=0;n<trees[g].padding.length;n++) {
      const certificate=trees[g].padding[n],pad=sampled?.[g][n];
      // Only owner-rigid, exactly unit-weight nodes have a sample-independent
      // proof here. Other nodes KEEP the tight runtime certificate. A sampled
      // pad never replaces a tighter bound or admits extra candidate vertices.
      if(pad && !certificate.influences.length && certificate.sumError===0) certificate.sampledPad=pad;
    }
  }
  return {mesh,palette,trees,positions:new Float64Array(positions.length),sampled:new Uint8Array(position.count),candidates:new Uint8Array(data.zones.length),candidateCount:0,triangleOrder:[],indices:new Uint32Array(data.indices.length),zones:[],native,bindMatrix:mesh.bindMatrix.clone()};
}

/** With D_j=inverse(owner)*influence_j-I, skin(p)=p+sum(w_j*D_j*p).
 * Split each weight interval at its midpoint: the mean affine transform moves
 * the node bind box; interval residuals conservatively pad it. Cached once
 * per visited node and pose; rigid owner-only nodes need no relative palette.
 * This bounds procedural translation/scale without skinning vertices.
 */
function displacementBounds(node: {min: Vec3; max: Vec3}, group: Displacement): Box3 {
  const x=(node.min.x+node.max.x)/2,y=(node.min.y+node.max.y)/2,z=(node.min.z+node.max.z)/2;
  const hx=(node.max.x-node.min.x)/2,hy=(node.max.y-node.min.y)/2,hz=(node.max.z-node.min.z)/2;
  for(let axis=0;axis<3;axis++) {
    let a=axis===0?1:0,b=axis===1?1:0,c=axis===2?1:0,d=0,error=group.radius.getComponent(axis)*group.sumError+1e-7;
    for(const influence of group.influences) {
      const e=influence.matrix.elements;
      const da=e[axis]-(axis===0?1:0),db=e[4+axis]-(axis===1?1:0),dc=e[8+axis]-(axis===2?1:0),dd=e[12+axis];
      const mean=(influence.minWeight+influence.maxWeight)/2,half=(influence.maxWeight-influence.minWeight)/2;
      a+=mean*da;b+=mean*db;c+=mean*dc;d+=mean*dd;
      error+=half*(Math.abs(da*x+db*y+dc*z+dd)+Math.abs(da)*hx+Math.abs(db)*hy+Math.abs(dc)*hz);
    }
    const center=a*x+b*y+c*z+d,extent=Math.abs(a)*hx+Math.abs(b)*hy+Math.abs(c)*hz+error;
    group.bounds.min.setComponent(axis,center-extent);group.bounds.max.setComponent(axis,center+extent);
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
  readonly posePreparationCount?: number;
  readonly coarseRejectCount?: number;
  readonly fallbackPadCount?: number;
  readonly sampledPadNodeCount?: number;
};
const queries=new WeakMap<Object3D,HitSurfaceQuery>();

/** Bone-local bind BVHs only nominate triangles. Original mesh/triangle order
 * and the native skinning formula retain first-contact/zone tie behaviour. */
export function lazyHitSurfaces(root: Object3D): HitSurfaceQuery {
  const existing=queries.get(root);if(existing) return existing;
  const owner={},palettes:Palette[]=[],states:MeshState[]=[],envelopes=new Map<Object3D,TransformEnvelope>();
  const register=(node:SkinnedMesh)=>{
    let palette=palettes.find(p=>p.mesh.skeleton.bones.length===node.skeleton.bones.length && p.mesh.skeleton.bones.every((b,i)=>b===node.skeleton.bones[i] && p.mesh.skeleton.boneInverses[i].equals(node.skeleton.boneInverses[i])) && p.mesh.bindMatrix.equals(node.bindMatrix));
    if(!palette) {
      palette={mesh:node,skin:node.skeleton.bones.map(()=>new Matrix4()),forward:node.skeleton.bones.map(()=>new Matrix4()),inverse:node.skeleton.bones.map(()=>new Matrix4()),skinFrame:node.skeleton.bones.map(()=>-1),inverseFrame:node.skeleton.bones.map(()=>-1),relativeFrame:node.skeleton.bones.map(()=>-1),rayQuery:node.skeleton.bones.map(()=>-1),rayStart:node.skeleton.bones.map(()=>new Vector3()),rayEnd:node.skeleton.bones.map(()=>new Vector3()),singular:node.skeleton.bones.map(()=>false),prepareSkin:()=>{},radii:node.skeleton.bones.map(()=>0),relative:new Map()};
      const p=palette;
      p.prepareSkin=i=>{
        if(p.skinFrame[i]===frame) return;p.skinFrame[i]=frame;
        p.skin[i].multiplyMatrices(p.mesh.skeleton.bones[i].matrixWorld,p.mesh.skeleton.boneInverses[i]);
        p.forward[i].copy(p.skin[i]).multiply(p.mesh.bindMatrix);
        if(diagnostics) boneMatrixUpdateCount++;
      };
      palettes.push(palette);
    }
    states.push(buildMeshState(node,palette,envelopes));
  };
  root.traverse(node=>{if(node instanceof SkinnedMesh) register(node);});
  const jobs=states.flatMap(state=>state.trees.map(group=>({state,group,entry:Infinity,refined:false})));
  let stable=false,prepared=false,nativeRequired=false,diagnostics=false,full:HitSurface[]|undefined;
  const signature:number[]=[],objects:Object3D[]=[],meshes:SkinnedMesh[]=[];
  let skinnedVertexCount=0,candidateTriangleCount=0,boneMatrixUpdateCount=0,posePreparationCount=0,coarseRejectCount=0,fallbackPadCount=0,frame=0;
  const broad=new Box3(),point=new Vector3(),localStart=new Vector3(),localEnd=new Vector3();
  const surfaces:HitSurface[]=[];
  const leafIndices=new Uint32Array(48),leafZones:HitZone[]=[];
  const leafViews=Array.from({length:17},(_,i)=>leafIndices.subarray(0,i*3));
  const leafSurface:HitSurface={positions:new Float64Array(0),indices:leafIndices,zones:leafZones},leafSurfaces=[leafSurface];
  const triangleOrder=(a:number,b:number)=>a-b;
  let queryId=0;
  let envelopeValid=false,coarsePrepared=false,coarseRadius=Infinity;
  const hierarchy={dirty:false};
  const watched=new WeakSet<Object3D>(),coarse=new Box3();
  const invalidateHierarchy=invalidateHitHierarchy.bind(hierarchy);
  const watch=(node:Object3D)=>{
    if(watched.has(node)) return;watched.add(node);
    node.addEventListener('childadded',invalidateHierarchy);node.addEventListener('childremoved',invalidateHierarchy);
  };
  const rebuildCoarse=()=>{
    root.traverse(watch);coarseRadius=0;
    for(const palette of palettes) for(let b=0;b<palette.radii.length;b++) {
      if(!palette.radii[b]) continue;
      let reach=palette.radii[b],node:Object3D|null=palette.mesh.skeleton.bones[b];
      while(node && node!==root) {
        let e=envelopes.get(node);if(!e) {e=transformEnvelope(node);envelopes.set(node,e);}
        reach=e.translation+e.maxScale*reach;node=node.parent;
      }
      coarseRadius=node?Math.max(coarseRadius,reach):Infinity;
    }
    hierarchy.dirty=false;coarsePrepared=false;
  };
  rebuildCoarse();
  const checkEnvelope=()=>{
    for(const e of envelopes.values()) {
      const n=e.node,p=n.position,s=n.scale,qError=Math.abs(n.quaternion.lengthSq()-1);
      // A malformed quaternion or manually supplied matrix cannot use the
      // rotation proof. Normal matrix/TRS queries still take the exact fallback.
      if(n.parent!==e.parent || !n.matrixAutoUpdate || !n.matrixWorldAutoUpdate || !(p.lengthSq()<=e.translation*e.translation) ||
        !(Math.min(Math.abs(s.x),Math.abs(s.y),Math.abs(s.z))*(1-2*qError)>=e.minScale) ||
        !(Math.max(Math.abs(s.x),Math.abs(s.y),Math.abs(s.z))*(1+2*qError)<=e.maxScale) ||
        !Number.isFinite(qError) || qError>1e-3 || e.minScale<=0) return false;
    }
    return true;
  };
  const coarseMayIntersect=(start:Vec3,end:Vec3)=>{
    // Unframed/debug callers retain the full signature fallback. Within the
    // projectile frame, far misses check only the all-rotation envelope and
    // root ancestors, never traverse the hierarchy or rebuild the pose AABB.
    if(!stable || hierarchy.dirty || states.some(s=>s.native || s.mesh.bindMode!=='attached' || !s.mesh.bindMatrix.equals(s.bindMatrix))) return true;
    if(!coarsePrepared) {
      envelopeValid=checkEnvelope();coarsePrepared=true;
      if(!envelopeValid) return true;
      root.updateWorldMatrix(true,false);
      const e=root.matrixWorld.elements,r=coarseRadius;
      const rx=r*Math.hypot(e[0],e[4],e[8]),ry=r*Math.hypot(e[1],e[5],e[9]),rz=r*Math.hypot(e[2],e[6],e[10]);
      coarse.min.set(e[12]-rx,e[13]-ry,e[14]-rz);coarse.max.set(e[12]+rx,e[13]+ry,e[14]+rz);
      const magnitude=Math.max(Math.abs(e[12])+rx,Math.abs(e[13])+ry,Math.abs(e[14])+rz,1);
      coarse.expandByScalar(magnitude*1e-6+1e-7);
    }
    const accepted=!envelopeValid || segmentIntersectsBounds(start,end,coarse.min,coarse.max);
    if(!accepted && diagnostics) coarseRejectCount++;
    return accepted;
  };
  let numberCursor=0,objectCursor=0,meshCursor=0,changed=false;
  const rememberNumber=(value:number)=>{if(signature[numberCursor]!==value) changed=true;signature[numberCursor++]=value;};
  const remember=(node:Object3D)=>{
    if(objects[objectCursor]!==node) changed=true;objects[objectCursor++]=node;
    const p=node.position,q=node.quaternion,s=node.scale;
    rememberNumber(p.x);rememberNumber(p.y);rememberNumber(p.z);
    rememberNumber(q.x);rememberNumber(q.y);rememberNumber(q.z);rememberNumber(q.w);
    rememberNumber(s.x);rememberNumber(s.y);rememberNumber(s.z);
    if(!node.matrixAutoUpdate) for(const n of node.matrix.elements) rememberNumber(n);
    if(!node.matrixWorldAutoUpdate) for(const n of node.matrixWorld.elements) rememberNumber(n);
  };
  const rememberChild=(node:Object3D)=>{
    remember(node);
    if(node instanceof SkinnedMesh) {
      meshes[meshCursor++]=node;
      for(const n of node.bindMatrix.elements) rememberNumber(n);
      if(node.morphTargetInfluences) for(const n of node.morphTargetInfluences) rememberNumber(n);
    }
  };
  const prepare=()=>{
    if(stable && prepared && !hierarchy.dirty) return;
    if(diagnostics) posePreparationCount++;
    numberCursor=0;objectCursor=0;meshCursor=0;changed=false;
    for(let parent=root.parent;parent;parent=parent.parent) remember(parent);
    root.traverse(rememberChild);
    if(signature.length!==numberCursor || objects.length!==objectCursor) changed=true;
    signature.length=numberCursor;objects.length=objectCursor;meshes.length=meshCursor;
    // Assets arrive asynchronously; a query may already exist for an empty
    // avatar root. Rebuild only when its actual skinned primitive list changes.
    if(meshes.length!==states.length || meshes.some((mesh,i)=>mesh!==states[i].mesh)) {
      states.length=0;palettes.length=0;jobs.length=0;envelopes.clear();changed=true;
      for(const mesh of meshes) register(mesh);
      for(const state of states) for(const group of state.trees) jobs.push({state,group,entry:Infinity,refined:false});
      rebuildCoarse();
    }
    if(hierarchy.dirty) {rebuildCoarse();changed=true;}
    if(!coarsePrepared) envelopeValid=checkEnvelope();
    prepared=true;
    if(!changed && states.every(s=>owners.get(s.mesh)===owner)) return;
    full=undefined;frame++;
    root.updateWorldMatrix(true,false);root.updateMatrixWorld(true);
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
  const prepareInverse=(palette:Palette,bone:number)=>{
    palette.prepareSkin(bone);
    if(palette.inverseFrame[bone]!==frame) {
      palette.singular[bone]=palette.forward[bone].determinant()===0;
      palette.inverse[bone].copy(palette.forward[bone]).invert();palette.inverseFrame[bone]=frame;
    }
  };
  const boundsFor=(group:BoneTree,palette:Palette,node:number)=>{
    const bounds=group.padding[node];
    if(bounds.frame!==frame) {
      if(!bounds.influences.length && bounds.sumError===0) {
        // Analytically rigid in owner space for every clip/overlay. Intersect
        // the sampled box with the tighter exact rigid certificate (1e-7).
        bounds.bounds.min.copy(bounds.min).addScalar(-1e-7);bounds.bounds.max.copy(bounds.max).addScalar(1e-7);
        bounds.frame=frame;return bounds.bounds;
      }
      if(bounds.influences.length && palette.relativeFrame[group.bone]!==frame) {
        const matrices=palette.relative.get(group.bone)!;
        for(const [other,matrix] of matrices) {palette.prepareSkin(other);matrix.multiplyMatrices(palette.inverse[group.bone],palette.forward[other]);}
        palette.relativeFrame[group.bone]=frame;
      }
      displacementBounds(bounds,bounds);
      // Near-unit weights add the inverse ray's affine translation as well.
      const inverse=palette.inverse[group.bone].elements,error=bounds.sumError;
      bounds.bounds.expandByVector(point.set(error*Math.abs(inverse[12]),error*Math.abs(inverse[13]),error*Math.abs(inverse[14])));
      bounds.frame=frame;
      if(diagnostics && !envelopeValid) fallbackPadCount++;
    }
    return bounds.bounds;
  };
  const prepareRay=(palette:Palette,bone:number,start:Vec3,end:Vec3)=>{
    if(palette.rayQuery[bone]===queryId) return;
    prepareInverse(palette,bone);
    palette.rayStart[bone].copy(start).applyMatrix4(palette.inverse[bone]);
    palette.rayEnd[bone].copy(end).applyMatrix4(palette.inverse[bone]);
    palette.rayQuery[bone]=queryId;
  };
  const rootMayIntersect=(group:BoneTree,palette:Palette,start:Vec3,end:Vec3)=>{
    let lo=0,hi=1;
    // Keep each tree's own boxes and compute axes only until a separating slab
    // rejects. A later ray can lazily fill the remaining axes in the same pose.
    for(let axis=0;axis<3;axis++) {
      if(group.broadFrame[axis]!==frame) {
        let min=Infinity,max=-Infinity;
        for(const {bone,center,half} of group.reject) {
          const e=palette.mesh.skeleton.bones[bone].matrixWorld.elements;
          const c=e[axis]*center.x+e[4+axis]*center.y+e[8+axis]*center.z+e[12+axis];
          const r=Math.abs(e[axis])*half.x+Math.abs(e[4+axis])*half.y+Math.abs(e[8+axis])*half.z;
          min=Math.min(min,c-r);max=Math.max(max,c+r);
        }
        const guard=Math.max(Math.abs(min),Math.abs(max),1)*1e-6+1e-7;
        group.broad.min.setComponent(axis,min-guard);group.broad.max.setComponent(axis,max+guard);group.broadFrame[axis]=frame;
      }
      const s=axis===0?start.x:axis===1?start.y:start.z,d=(axis===0?end.x:axis===1?end.y:end.z)-s;
      if(!Number.isFinite(s) || !Number.isFinite(d)) return Infinity;
      const min=group.broad.min.getComponent(axis),max=group.broad.max.getComponent(axis);
      if(Math.abs(d)<1e-14) {if(s<min || s>max) return Infinity;}
      else {
        const a=(min-s)/d,b=(max-s)/d;
        lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));
        if(lo>hi) return Infinity;
      }
    }
    return lo;
  };
  const query:HitSurfaceQuery=(start,end)=>{
    surfaces.length=0;
    if(start && end && !coarseMayIntersect(start,end)) return surfaces;
    prepare();
    if(!start || !end) return full??=sampleHitSurfaces(root);
    surfaces.length=0;
    if(broad.isEmpty() || !segmentIntersectsBounds(start,end,broad.min,broad.max)) return surfaces;
    if(nativeRequired) return sampleHitSurfaces(root);
    let closest=1;queryId++;
    for(const state of states) {state.candidates.fill(0);state.candidateCount=0;}
    for(const job of jobs) {
      job.refined=false;
      job.entry=rootMayIntersect(job.group,job.state.palette,start,end);
    }
    // Integer comparator results avoid boxing fractional entry differences.
    jobs.sort((a,b)=>a.entry>b.entry?1:a.entry<b.entry?-1:0);
    for(let j=0;j<jobs.length;j++) {
      const job=jobs[j],{state,group}=job;
      if(job.entry>closest+1e-9) break;
      const {mesh,palette}=state,data=topologyFor(mesh);
      if(!job.refined) {
        prepareRay(palette,group.bone,start,end);
        const bounds=boundsFor(group,palette,0);
        job.entry=palette.singular[group.bone] ? job.entry : Math.max(job.entry,bindBoundsEntry(palette.rayStart[group.bone],palette.rayEnd[group.bone],bounds.min,bounds.max));
        job.refined=true;
        // Refine only the next conservative root. Its tighter entry may move
        // behind another root; retain global near-first order before skinning.
        let k=j;
        while(k+1<jobs.length && jobs[k+1].entry<job.entry) {jobs[k]=jobs[k+1];k++;}
        jobs[k]=job;
        if(k!==j) {j--;continue;}
        if(job.entry>closest+1e-9) break;
      }
      localStart.copy(palette.rayStart[group.bone]);localEnd.copy(palette.rayEnd[group.bone]);
      const visit=(triangles:Uint32Array,first:number,length:number)=>{
        let count=0;leafZones.length=0;
        for(let i=first;i<first+length;i++) {
          const t=triangles[i];
          if(state.candidates[t]) continue;
          state.candidates[t]=1;state.triangleOrder[state.candidateCount++]=t;leafZones.push(data.zones[t]);
          for(let k=0;k<3;k++) {
            const v=data.indices[t*3+k];leafIndices[count++]=v;
            if(!state.sampled[v]) {
              skinHitVertex(mesh,palette,v,point).applyMatrix4(mesh.matrixWorld).toArray(state.positions,v*3);
              state.sampled[v]=1;if(diagnostics) skinnedVertexCount++;
            }
          }
        }
        if(count) {
          leafSurface.positions=state.positions;leafSurface.indices=leafViews[count/3];
          const hit=segmentHitSurface(start,end,leafSurfaces);
          if(hit && hit.t<closest) closest=hit.t;
        }
        return Math.min(1,closest+1e-9);
      };
      if(palette.singular[group.bone]) {
        // An inverse ray is undefined at singular scales: exact native candidates.
        for(let t=0;t<data.zones.length;t++) {leafIndices[0]=t;visit(leafIndices,0,1);}
        continue;
      }
      queryBindBvh(group.tree,localStart,localEnd,node=>boundsFor(group,palette,node),undefined,visit,Math.min(1,closest+1e-9));
    }
    // Restore asset mesh/triangle ordering for exact first-contact ties.
    for(const state of states) {
      if(!state.candidateCount) continue;
      const data=topologyFor(state.mesh),triangles=state.triangleOrder;let count=0;
      triangles.length=state.candidateCount;triangles.sort(triangleOrder);
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
  query.mayIntersect=(start,end)=>{if(!coarseMayIntersect(start,end)) return false;prepare();return !broad.isEmpty() && segmentIntersectsBounds(start,end,broad.min,broad.max);};
  query.beginFrame=()=>{stable=true;prepared=false;coarsePrepared=false;};query.endFrame=()=>{stable=false;prepared=false;coarsePrepared=false;};
  query.enableDiagnostics=()=>{diagnostics=true;};
  Object.defineProperties(query,{skinnedVertexCount:{get:()=>skinnedVertexCount},candidateTriangleCount:{get:()=>candidateTriangleCount},boneMatrixUpdateCount:{get:()=>boneMatrixUpdateCount},posePreparationCount:{get:()=>posePreparationCount},coarseRejectCount:{get:()=>coarseRejectCount},fallbackPadCount:{get:()=>fallbackPadCount},sampledPadNodeCount:{get:()=>states.reduce((sum,s)=>sum+s.trees.reduce((n,g)=>n+g.padding.filter(p=>p.sampledPad).length,0),0)}});
  queries.set(root,query);return query;
}
