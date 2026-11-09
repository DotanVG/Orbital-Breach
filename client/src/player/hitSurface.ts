import { SkinnedMesh, Vector3, type Object3D } from 'three';
import { hitZoneForBone, indexHitSurface, type HitSurface } from '../../../shared/projectileCollider';
import type { HitZone } from '../../../shared/player-logic';

const topology = new WeakMap<SkinnedMesh, Pick<HitSurface, 'indices' | 'zones'>>();

/** Sample body AND helmet triangles. A hidden first-person root still takes
 * hits; guns/name tags are not skinned surfaces. Called lazily once per target
 * per projectile update, never once per bullet. */
export function sampleHitSurfaces(root: Object3D): HitSurface[] {
  root.updateWorldMatrix(true, true);
  root.updateMatrixWorld(true); // refresh SkinnedMesh.bindMatrixInverse too
  const surfaces: HitSurface[] = [];
  const point = new Vector3();
  root.traverse(node => {
    if (!(node instanceof SkinnedMesh)) return;
    node.skeleton.update();
    const count=node.geometry.attributes.position.count;
    let data=topology.get(node);
    if (!data) {
      const index=node.geometry.index;
      const indices=Uint32Array.from({length:index?.count ?? count},(_,i)=>index ? index.getX(i) : i);
      const skin=node.geometry.attributes.skinIndex, weights=node.geometry.attributes.skinWeight;
      const vertexZones=Array.from({length:count},(_,i)=>{
        let dominant=0;
        for(let k=1;k<4;k++) if(weights.getComponent(i,k)>weights.getComponent(i,dominant)) dominant=k;
        return hitZoneForBone(node.skeleton.bones[skin.getComponent(i,dominant)].name);
      });
      const zones: HitZone[]=[];
      for(let i=0;i<indices.length;i+=3) {
        const a=vertexZones[indices[i]],b=vertexZones[indices[i+1]],c=vertexZones[indices[i+2]];
        // Include every head/helmet vertex's incident triangles in head. Other
        // seams use majority ownership; stable index order breaks three-way ties.
        zones.push(a==='head'||b==='head'||c==='head' ? 'head' : b===c ? b : a);
      }
      data={indices,zones}; topology.set(node,data);
    }
    const positions=new Float64Array(count*3);
    for(let i=0;i<count;i++) {
      node.getVertexPosition(i,point).applyMatrix4(node.matrixWorld);
      point.toArray(positions,i*3);
    }
    surfaces.push(indexHitSurface({positions,...data}));
  });
  return surfaces;
}

export function lazyHitSurfaces(root: Object3D): () => HitSurface[] {
  let surfaces: HitSurface[] | undefined;
  return () => surfaces ??= sampleHitSurfaces(root);
}
