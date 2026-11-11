import type { Vec3 } from '../../../shared/vec3';

export interface BindBvh {
  min: Vec3;
  max: Vec3;
  left?: BindBvh;
  right?: BindBvh;
  triangles?: number[];
}

/** Segment entry parameter, or Infinity for a reject (also invalid input). */
export function bindBoundsEntry(start: Vec3, end: Vec3, min: Vec3, max: Vec3, pad?: Vec3): number {
  let lo=0,hi=1;
  // Numeric axes avoid an array/iterator and dynamic property lookups at every
  // visited node. Optional padding also avoids temporary min/max objects.
  for(let axis=0;axis<3;axis++) {
    const s=axis===0?start.x:axis===1?start.y:start.z;
    const d=(axis===0?end.x:axis===1?end.y:end.z)-s;
    const p=pad ? axis===0?pad.x:axis===1?pad.y:pad.z : 0;
    const low=(axis===0?min.x:axis===1?min.y:min.z)-p;
    const high=(axis===0?max.x:axis===1?max.y:max.z)+p;
    if(!Number.isFinite(s) || !Number.isFinite(d)) return Infinity;
    if(Math.abs(d)<1e-14) {
      if(s<low || s>high) return Infinity;
    } else {
      const a=(low-s)/d,b=(high-s)/d;
      lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));
      if(lo>hi) return Infinity;
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
  while(stack.length) {
    const node=stack.pop()!;
    if(fixedPadding && bindBoundsEntry(start,end,node.min,node.max,fixedPadding)===Infinity) continue;
    if(typeof padding==='function') {
      const bounds=padding(node);
      if(bindBoundsEntry(start,end,bounds.min,bounds.max)===Infinity) continue;
    } else {
      if(bindBoundsEntry(start,end,node.min,node.max,padding)===Infinity) continue;
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
