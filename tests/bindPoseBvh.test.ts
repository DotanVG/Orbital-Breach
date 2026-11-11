import { describe, expect, it } from 'vitest';
import { bindBoundsEntry, buildBindBvh, flatBoundsEntry, queryBindBvh } from '../client/src/player/bindPoseBvh';
import { segmentIntersectsBounds } from '../shared/projectileCollider';
import { seededRandom } from './helpers/hitboxOrientation';

describe('bind-pose BVH candidate selection',()=>{
  const positions=Float64Array.from(Array.from({length:20},(_,i)=>[i*2,0,0,i*2+1,0,0,i*2,1,0]).flat());
  const indices=Uint32Array.from({length:60},(_,i)=>i);
  const tree=buildBindBvh(positions,indices,Array.from({length:20},(_,i)=>i));
  it('packs outward-rounded bounds and 2-4 triangle leaves without losing bind vertices',()=>{
    expect(tree.bounds).toBeInstanceOf(Float32Array);expect(tree.nodes).toBeInstanceOf(Int32Array);
    expect([...tree.triangles].sort((a,b)=>a-b)).toEqual(Array.from({length:20},(_,i)=>i));
    for(let n=0;n<tree.nodes.length/4;n++) {
      const count=tree.nodes[n*4+3],first=tree.nodes[n*4+2];
      if(!count) continue;
      expect(count).toBeGreaterThanOrEqual(2);expect(count).toBeLessThanOrEqual(4);
      for(let t=first;t<first+count;t++) for(let k=0;k<3;k++) for(let a=0;a<3;a++) {
        const value=positions[indices[tree.triangles[t]*3+k]*3+a];
        expect(tree.bounds[n*6+a]).toBeLessThanOrEqual(value);expect(tree.bounds[n*6+3+a]).toBeGreaterThanOrEqual(value);
      }
    }
  });
  it('matches the scalar slab for seeded inverse-direction rays and shortened contact limits',()=>{
    const random=seededRandom(0x129f),ray=new Float64Array(9);
    const bounds=Float32Array.from([-1,-2,-3,1,2,3]),pad={x:.2,y:.3,z:.4};
    for(let i=0;i<2048;i++) {
      const start={x:random()*8-4,y:random()*8-4,z:random()*8-4},end={x:random()*8-4,y:random()*8-4,z:random()*8-4};
      if(i%3===0) end.x=start.x;if(i%7===0) end.z=start.z+1e-15;
      const limit=random();
      for(let a=0;a<3;a++) {
        const key=(['x','y','z'] as const)[a],d=end[key]-start[key];
        ray[a]=start[key];ray[3+a]=Math.abs(d)<1e-14?Infinity:1/d;ray[6+a]=pad[key];
      }
      const clipped={x:start.x+(end.x-start.x)*limit,y:start.y+(end.y-start.y)*limit,z:start.z+(end.z-start.z)*limit};
      const expected=bindBoundsEntry(start,clipped,{x:-1,y:-2,z:-3},{x:1,y:2,z:3},pad);
      const actual=flatBoundsEntry(bounds,0,ray,limit);
      expect(actual!==Infinity).toBe(expected!==Infinity);
      if(Number.isFinite(expected)) expect(actual).toBeCloseTo(expected*limit,12);
    }
  });
  it('orders entries inclusively and rejects invalid or out-of-segment bounds',()=>{
    const min={x:0,y:0,z:0},max={x:1,y:1,z:1};
    expect(bindBoundsEntry({x:0,y:0,z:-1},{x:0,y:0,z:1},min,max)).toBe(.5);
    expect(bindBoundsEntry(min,max,min,max)).toBe(0);
    expect(bindBoundsEntry({x:2,y:0,z:-1},{x:2,y:0,z:1},min,max)).toBe(Infinity);
    expect(bindBoundsEntry({x:NaN,y:0,z:-1},max,min,max)).toBe(Infinity);
  });
  it('matches the existing slab oracle for seeded padded, parallel and degenerate segments',()=>{
    const random=seededRandom(0x129bb),vector=()=>({x:random()*6-3,y:random()*6-3,z:random()*6-3});
    for(let i=0;i<4096;i++) {
      const min=vector(),size=vector(),pad={x:random(),y:random(),z:random()};
      const max={x:min.x+Math.abs(size.x),y:min.y+Math.abs(size.y),z:min.z+Math.abs(size.z)};
      const start=i%5===0?{...min}:vector(),end=i%7===0?{...start}:vector();
      if(i%3===0) end.x=start.x;
      if(i%11===0) end.z=start.z+1e-15;
      const low={x:min.x-pad.x,y:min.y-pad.y,z:min.z-pad.z},high={x:max.x+pad.x,y:max.y+pad.y,z:max.z+pad.z};
      expect(bindBoundsEntry(start,end,min,max,pad)!==Infinity).toBe(segmentIntersectsBounds(start,end,low,high));
      expect(bindBoundsEntry(start,end,min,max,pad)).toBe(bindBoundsEntry(start,end,low,high));
    }
  });
  it('keeps hit and grazing triangles, deduplicates repeated bone membership and rejects distant leaves',()=>{
    const output=new Set<number>();
    const start={x:0,y:0,z:-1},end={x:0,y:0,z:1},pad={x:0,y:0,z:0};
    queryBindBvh(tree,start,end,pad,output);
    expect(output.has(0)).toBe(true);expect(output.size).toBeLessThanOrEqual(4);
    const before=output.size;queryBindBvh(tree,start,end,pad,output);expect(output.size).toBe(before);
    output.clear();queryBindBvh(tree,{x:-1,y:0,z:-1},{x:-1,y:0,z:1},pad,output);expect(output.size).toBe(0);
  });
  it('uses displacement padding only to retain candidates, including endpoint and start-inside probes',()=>{
    const output=new Set<number>();
    queryBindBvh(tree,{x:-.1,y:0,z:0},{x:-.1,y:0,z:1},{x:.1,y:0,z:0},output);
    expect(output.has(0)).toBe(true);
    output.clear();queryBindBvh(tree,{x:0,y:0,z:-1},{x:0,y:0,z:0},{x:0,y:0,z:0},output);
    expect(output.has(0)).toBe(true);
    output.clear();queryBindBvh(tree,{x:NaN,y:0,z:-1},{x:0,y:0,z:1},{x:0,y:0,z:0},output);
    expect(output.size).toBe(0);
  });
  it('visits near leaves first and prunes the far leaf after an exact-contact visitor shortens the segment',()=>{
    const start={x:-1,y:.1,z:0},end={x:40,y:.1,z:0},seen:number[]=[];
    queryBindBvh(tree,start,end,{x:0,y:0,z:0},new Set(),(triangles,first,count)=>{
      for(let i=first;i<first+count;i++) seen.push(triangles[i]);
      return 2/41;
    });
    expect(seen).toContain(0);expect(Math.max(...seen)).toBeLessThanOrEqual(4);
  });
  it('uses per-node certificates instead of the undeformed flat bounds and preserves pruning',()=>{
    const output=new Set<number>(),start={x:0,y:.1,z:4},end={x:40,y:.1,z:4},seen:number[]=[];
    const certificate=(n:number)=>({min:{x:tree.bounds[n*6],y:tree.bounds[n*6+1],z:tree.bounds[n*6+2]+4},max:{x:tree.bounds[n*6+3],y:tree.bounds[n*6+4],z:tree.bounds[n*6+5]+4}});
    queryBindBvh(tree,start,end,certificate,output,(triangles,first,count)=>{
      for(let i=first;i<first+count;i++) seen.push(triangles[i]);
      return 1/40;
    });
    expect(seen).toContain(0);expect(Math.max(...seen)).toBeLessThanOrEqual(4);
    queryBindBvh(tree,{...start,z:0},{...end,z:0},certificate,output);
    expect(output.size).toBe(0);
  });
});
