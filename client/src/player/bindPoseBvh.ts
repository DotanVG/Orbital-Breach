import { segmentIntersectsBounds } from '../../../shared/projectileCollider';
import type { Vec3 } from '../../../shared/vec3';

export interface BindBvh {
  min: Vec3;
  max: Vec3;
  left?: BindBvh;
  right?: BindBvh;
  triangles?: number[];
}

/** Segment entry parameter, or Infinity for a reject (also invalid input). */
export function bindBoundsEntry(start: Vec3, end: Vec3, min: Vec3, max: Vec3): number {
  let lo=0,hi=1;
  for(const axis of ['x','y','z'] as const) {
    const d=end[axis]-start[axis];
    if(!Number.isFinite(start[axis]) || !Number.isFinite(d)) return Infinity;
    if(Math.abs(d)<1e-14) {
      if(start[axis]<min[axis] || start[axis]>max[axis]) return Infinity;
    } else {
      const a=(min[axis]-start[axis])/d,b=(max[axis]-start[axis])/d;
      lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));
    }
  }
  return lo<=hi ? lo : Infinity;
}

/** Median split of triangle centroids; triangle IDs retain the asset's order. */
export function buildBindBvh(positions: Float64Array, indices: Uint32Array, triangles: number[]): BindBvh {
  const min={x:Infinity,y:Infinity,z:Infinity},max={x:-Infinity,y:-Infinity,z:-Infinity};
  for(const t of triangles) for(let k=0;k<3;k++) {
    const v=indices[t*3+k]*3;
    min.x=Math.min(min.x,positions[v]); max.x=Math.max(max.x,positions[v]);
    min.y=Math.min(min.y,positions[v+1]); max.y=Math.max(max.y,positions[v+1]);
    min.z=Math.min(min.z,positions[v+2]); max.z=Math.max(max.z,positions[v+2]);
  }
  if(triangles.length<=4) return {min,max,triangles};
  const sizes=[max.x-min.x,max.y-min.y,max.z-min.z];
  const axis=sizes.indexOf(Math.max(...sizes));
  const center=(t:number)=>positions[indices[t*3]*3+axis]+positions[indices[t*3+1]*3+axis]+positions[indices[t*3+2]*3+axis];
  triangles.sort((a,b)=>center(a)-center(b));
  const mid=triangles.length>>1;
  return {min,max,left:buildBindBvh(positions,indices,triangles.slice(0,mid)),right:buildBindBvh(positions,indices,triangles.slice(mid))};
}

/** Reusable traversal scratch; pad is reject-only and never changes triangles. */
export function queryBindBvh(tree: BindBvh, start: Vec3, end: Vec3, padding: Vec3 | ((node: BindBvh) => {min: Vec3; max: Vec3}), output: Set<number>, stack: BindBvh[], visit?: (triangles: readonly number[]) => void, fixedPadding?: Vec3): void {
  stack.length=0; stack.push(tree);
  const min={x:0,y:0,z:0},max={x:0,y:0,z:0};
  while(stack.length) {
    const node=stack.pop()!;
    if(fixedPadding) {
      min.x=node.min.x-fixedPadding.x; min.y=node.min.y-fixedPadding.y; min.z=node.min.z-fixedPadding.z;
      max.x=node.max.x+fixedPadding.x; max.y=node.max.y+fixedPadding.y; max.z=node.max.z+fixedPadding.z;
      if(!segmentIntersectsBounds(start,end,min,max)) continue;
    }
    if(typeof padding==='function') {
      const bounds=padding(node);
      if(!segmentIntersectsBounds(start,end,bounds.min,bounds.max)) continue;
    } else {
      min.x=node.min.x-padding.x; min.y=node.min.y-padding.y; min.z=node.min.z-padding.z;
      max.x=node.max.x+padding.x; max.y=node.max.y+padding.y; max.z=node.max.z+padding.z;
      if(!segmentIntersectsBounds(start,end,min,max)) continue;
    }
    if(node.triangles) {
      if(visit) visit(node.triangles);
      else for(const t of node.triangles) output.add(t);
    } else if(typeof padding==='function') {
      const left=padding(node.left!),right=padding(node.right!);
      const a=bindBoundsEntry(start,end,left.min,left.max),b=bindBoundsEntry(start,end,right.min,right.max);
      if(a<b) {if(b!==Infinity) stack.push(node.right!);if(a!==Infinity) stack.push(node.left!);}
      else {if(a!==Infinity) stack.push(node.left!);if(b!==Infinity) stack.push(node.right!);}
    } else { stack.push(node.right!,node.left!); }
  }
}
