import { AnimationMixer, Matrix4, SkinnedMesh, Vector3, type AnimationClip, type BufferGeometry, type Object3D } from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { BindBvh } from './bindPoseBvh';

const clipsByRoot=new WeakMap<Object3D,AnimationClip[]>();
const samplesByGeometry=new WeakMap<BufferGeometry,{clips:AnimationClip[]; pads:Vector3[][]}>();

/** Register the actual asset clips, without changing playback or the live pose. */
export function registerHitClips(root:Object3D,clips:AnimationClip[]):void {clipsByRoot.set(root,clips);}

/** Load-time trial only. Samples are NOT a conservative proof between samples,
 * during crossfades, or under procedural overlays. The caller must retain its
 * certificate unless a separate proof admits this node's pad. Shared render
 * clones reuse samples; no live mixer, matrix, skeleton or pose is modified. */
export function sampleBoneNodePads(mesh:SkinnedMesh,groups:readonly {bone:number;tree:BindBvh}[],indices:Uint32Array):Vector3[][] | undefined {
  let source:Object3D|null=mesh,clips:AnimationClip[]|undefined;
  while(source && !(clips=clipsByRoot.get(source))) source=source.parent;
  if(!source || !clips?.length) return;
  const cached=samplesByGeometry.get(mesh.geometry);
  if(cached?.clips===clips) return cached.pads;
  const sampledRoot=clone(source),mixer=new AnimationMixer(sampledRoot);
  let sampled:SkinnedMesh|undefined;
  sampledRoot.traverse(n=>{if(n instanceof SkinnedMesh && n.geometry===mesh.geometry) sampled=n;});
  if(!sampled) return;
  const target=sampled,vertexCount=mesh.geometry.attributes.position.count;
  const groupsData=groups.map(({bone,tree})=>({bone,tree,vertices:[...new Set(Array.from(tree.triangles).flatMap(t=>[indices[t*3],indices[t*3+1],indices[t*3+2]]))],displacement:new Float64Array(vertexCount*3)}));
  const world=new Float64Array(vertexCount*3),point=new Vector3(),bind=new Vector3(),weighted=new Vector3(),inverse=new Matrix4();
  const skin=target.skeleton.bones.map(()=>new Matrix4()),attributes=target.geometry.attributes;
  try {
    for(const clip of clips) {
      mixer.stopAllAction();const action=mixer.clipAction(clip);action.reset().play();
      // A bounded 4 Hz load-time trial. Increasing density cannot establish
      // conservativeness, so blended nodes still use runtime certificates.
      for(let frame=0;frame<=Math.ceil(clip.duration*4);frame++) {
        mixer.setTime(Math.min(frame/4,clip.duration));sampledRoot.updateMatrixWorld(true);
        for(let b=0;b<skin.length;b++) skin[b].multiplyMatrices(target.skeleton.bones[b].matrixWorld,target.skeleton.boneInverses[b]);
        for(let v=0;v<vertexCount;v++) {
          bind.fromBufferAttribute(attributes.position,v).applyMatrix4(target.bindMatrix);point.set(0,0,0);
          for(let slot=0;slot<4;slot++) {
            const weight=attributes.skinWeight.getComponent(v,slot);
            if(weight) point.addScaledVector(weighted.copy(bind).applyMatrix4(skin[attributes.skinIndex.getComponent(v,slot)]),weight);
          }
          point.applyMatrix4(target.bindMatrixInverse).applyMatrix4(target.matrixWorld).toArray(world,v*3);
        }
        for(const group of groupsData) {
          inverse.multiplyMatrices(target.skeleton.bones[group.bone].matrixWorld,target.skeleton.boneInverses[group.bone]).multiply(target.bindMatrix).invert();
          for(const v of group.vertices) {
            point.fromArray(world,v*3).applyMatrix4(inverse);bind.fromBufferAttribute(mesh.geometry.attributes.position,v);
            for(let a=0;a<3;a++) group.displacement[v*3+a]=Math.max(group.displacement[v*3+a],Math.abs(point.getComponent(a)-bind.getComponent(a)));
          }
        }
      }
    }
    const pads=groupsData.map(({tree,displacement})=>{
      const result:Vector3[]=[];
      const measure=(n:number):Vector3=>{
        const pad=new Vector3(),offset=n*4,count=tree.nodes[offset+3],first=tree.nodes[offset+2];
        if(count) for(let t=first;t<first+count;t++) for(let k=0;k<3;k++) for(let a=0;a<3;a++) pad.setComponent(a,Math.max(pad.getComponent(a),displacement[indices[tree.triangles[t]*3+k]*3+a]));
        else pad.copy(measure(tree.nodes[offset])).max(measure(tree.nodes[offset+1]));
        result[n]=pad;return pad;
      };
      measure(0);
      // Margin is a trial heuristic, never the safety proof.
      for(const pad of result) pad.multiplyScalar(1.1).addScalar(1e-5);
      return result;
    });
    samplesByGeometry.set(mesh.geometry,{clips,pads});return pads;
  } finally {mixer.stopAllAction();mixer.uncacheRoot(sampledRoot);}
}
