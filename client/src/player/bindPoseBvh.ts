import type { Vec3 } from '../../../shared/vec3';

/** Flat immutable topology, with per-tree traversal scratch. Leaves hold <=4 triangles. */
export interface BindBvh {
  bounds: Float32Array;
  nodes: Int32Array; // left, right, first triangle, triangle count (zero for branches)
  triangles: Uint32Array;
  stack: Int32Array;
  ray: Float64Array;
}

/** Segment entry parameter, or Infinity for a reject (also invalid input). */
export function bindBoundsEntry(start: Vec3, end: Vec3, min: Vec3, max: Vec3, pad?: Vec3): number {
  let lo=0,hi=1;
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

/** Median split at load; outward rounding preserves the double-precision bind bounds. */
export function buildBindBvh(positions: Float64Array, indices: Uint32Array, triangles: number[]): BindBvh {
  const bounds:number[]=[],nodes:number[]=[],ordered:number[]=[];
  const build=(list:number[]):number=>{
    const node=nodes.length/4,offset=bounds.length;
    nodes.push(-1,-1,0,0);bounds.push(Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity);
    for(const t of list) for(let k=0;k<3;k++) for(let axis=0;axis<3;axis++) {
      const value=positions[indices[t*3+k]*3+axis];
      bounds[offset+axis]=Math.min(bounds[offset+axis],value);
      bounds[offset+3+axis]=Math.max(bounds[offset+3+axis],value);
    }
    if(list.length<=4) {
      nodes[node*4+2]=ordered.length;nodes[node*4+3]=list.length;ordered.push(...list);
    } else {
      let axis=0;
      for(let a=1;a<3;a++) if(bounds[offset+3+a]-bounds[offset+a]>bounds[offset+3+axis]-bounds[offset+axis]) axis=a;
      const center=(t:number)=>positions[indices[t*3]*3+axis]+positions[indices[t*3+1]*3+axis]+positions[indices[t*3+2]*3+axis];
      list.sort((a,b)=>center(a)-center(b));const mid=list.length>>1;
      nodes[node*4]=build(list.slice(0,mid));nodes[node*4+1]=build(list.slice(mid));
    }
    return node;
  };
  build(triangles);
  for(let i=0;i<bounds.length;i++) {
    const value=bounds[i],error=Math.abs(value)*2**-23+1e-7;
    bounds[i]=Math.fround(value+(i%6<3?-error:error));
  }
  return {bounds:Float32Array.from(bounds),nodes:Int32Array.from(nodes),triangles:Uint32Array.from(ordered),stack:new Int32Array(nodes.length/4),ray:new Float64Array(9)};
}

/** ray = start xyz, inverse direction xyz, displacement pad xyz. */
export function flatBoundsEntry(bounds: Float32Array, node: number, ray: Float64Array, limit: number): number {
  let lo=0,hi=limit;const offset=node*6;
  for(let axis=0;axis<3;axis++) {
    const s=ray[axis],inverse=ray[3+axis],pad=ray[6+axis];
    const low=bounds[offset+axis]-pad,high=bounds[offset+3+axis]+pad;
    if(inverse===Infinity) {if(s<low || s>high) return Infinity;}
    else {
      const a=(low-s)*inverse,b=(high-s)*inverse;
      lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));
      if(lo>hi) return Infinity;
    }
  }
  return lo<=hi?lo:Infinity;
}

/** Allocation-free traversal, including leaf ranges and stack. A visitor may
 * return a smaller contact parameter; inverse directions remain valid. */
export function queryBindBvh(tree: BindBvh, start: Vec3, end: Vec3, padding: Vec3 | ((node: number) => {min: Vec3; max: Vec3}), output: Set<number>, visit?: (triangles: Uint32Array, first: number, count: number) => number): void {
  const {ray,stack,nodes,bounds,triangles}=tree;
  const certificate=typeof padding==='function'?padding:undefined;
  ray[0]=start.x;ray[1]=start.y;ray[2]=start.z;
  ray[6]=certificate?0:(padding as Vec3).x;ray[7]=certificate?0:(padding as Vec3).y;ray[8]=certificate?0:(padding as Vec3).z;
  for(let a=0;a<3;a++) {
    const d=(a===0?end.x:a===1?end.y:end.z)-ray[a];
    if(!Number.isFinite(ray[a]) || !Number.isFinite(d)) return;
    ray[3+a]=Math.abs(d)<1e-14?Infinity:1/d;
  }
  const entry=(node:number,limit:number)=>{
    if(!certificate) return flatBoundsEntry(bounds,node,ray,limit);
    const box=certificate(node);
    return bindBoundsEntry(start,end,box.min,box.max);
  };
  let size=1,limit=1;stack[0]=0;
  while(size) {
    const node=stack[--size],offset=node*4;
    if(entry(node,limit)>limit) continue;
    const count=nodes[offset+3],first=nodes[offset+2];
    if(count) {
      if(visit) limit=Math.min(limit,visit(triangles,first,count));
      else for(let i=first;i<first+count;i++) output.add(triangles[i]);
    } else {
      const left=nodes[offset],right=nodes[offset+1];
      const a=entry(left,limit),b=entry(right,limit);
      if(a<b) {if(b<=limit) stack[size++]=right;if(a<=limit) stack[size++]=left;}
      else {if(a<=limit) stack[size++]=left;if(b<=limit) stack[size++]=right;}
    }
  }
}
