import { describe, expect, it } from 'vitest';
import { bindBoundsEntry, buildBindBvh, queryBindBvh } from '../client/src/player/bindPoseBvh';

describe('bind-pose BVH candidate selection',()=>{
  const positions=Float64Array.from(Array.from({length:20},(_,i)=>[i*2,0,0,i*2+1,0,0,i*2,1,0]).flat());
  const indices=Uint32Array.from({length:60},(_,i)=>i);
  const tree=buildBindBvh(positions,indices,Array.from({length:20},(_,i)=>i));
  it('orders entries inclusively and rejects invalid or out-of-segment bounds',()=>{
    const min={x:0,y:0,z:0},max={x:1,y:1,z:1};
    expect(bindBoundsEntry({x:0,y:0,z:-1},{x:0,y:0,z:1},min,max)).toBe(.5);
    expect(bindBoundsEntry(min,max,min,max)).toBe(0);
    expect(bindBoundsEntry({x:2,y:0,z:-1},{x:2,y:0,z:1},min,max)).toBe(Infinity);
    expect(bindBoundsEntry({x:NaN,y:0,z:-1},max,min,max)).toBe(Infinity);
  });
  it('keeps hit and grazing triangles, deduplicates repeated bone membership and rejects distant leaves',()=>{
    const output=new Set<number>(),stack=[];
    const start={x:0,y:0,z:-1},end={x:0,y:0,z:1},pad={x:0,y:0,z:0};
    queryBindBvh(tree,start,end,pad,output,stack);
    expect(output.has(0)).toBe(true);expect(output.size).toBeLessThan(5);
    const before=output.size;queryBindBvh(tree,start,end,pad,output,stack);expect(output.size).toBe(before);
    output.clear();queryBindBvh(tree,{x:-1,y:0,z:-1},{x:-1,y:0,z:1},pad,output,stack);expect(output.size).toBe(0);
  });
  it('uses displacement padding only to retain candidates, including endpoint and start-inside probes',()=>{
    const output=new Set<number>(),stack=[];
    queryBindBvh(tree,{x:-.1,y:0,z:0},{x:-.1,y:0,z:1},{x:.1,y:0,z:0},output,stack);
    expect(output.has(0)).toBe(true);
    output.clear();queryBindBvh(tree,{x:0,y:0,z:-1},{x:0,y:0,z:0},{x:0,y:0,z:0},output,stack);
    expect(output.has(0)).toBe(true);
    output.clear();queryBindBvh(tree,{x:NaN,y:0,z:-1},{x:0,y:0,z:1},{x:0,y:0,z:0},output,stack);
    expect(output.size).toBe(0);
  });
  it('visits near leaves first and prunes the far leaf after an exact-contact visitor shortens the segment',()=>{
    const start={x:-1,y:.1,z:0},end={x:40,y:.1,z:0},seen:number[]=[];
    queryBindBvh(tree,start,end,node=>node,new Set(),[],triangles=>{
      seen.push(...triangles);end.x=1;
    },{x:0,y:0,z:0});
    expect(seen).toContain(0);expect(Math.max(...seen)).toBeLessThan(5);
  });
});
