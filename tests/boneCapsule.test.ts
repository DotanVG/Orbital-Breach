import { describe, expect, it } from 'vitest';
import { segmentIntersectsCapsule } from '../client/src/player/boneCapsule';

const a={x:0,y:-1,z:0},b={x:0,y:1,z:0};
describe('finite segment vs conservative bone capsule',()=>{
  it.each([
    [{x:-2,y:0,z:0},{x:2,y:0,z:0},true],
    [{x:-2,y:0,z:.5},{x:2,y:0,z:.5},true],
    [{x:-2,y:0,z:.501},{x:2,y:0,z:.501},false],
    [{x:0,y:1.5,z:0},{x:0,y:2,z:0},true],
    [{x:0,y:1.501,z:0},{x:0,y:2,z:0},false],
    [{x:0,y:0,z:0},{x:0,y:0,z:0},true],
    [{x:1,y:0,z:0},{x:1,y:0,z:0},false],
    [{x:0,y:-2,z:.2},{x:0,y:2,z:.2},true],
    [{x:1,y:-2,z:0},{x:1,y:2,z:0},false],
    [{x:-2,y:0,z:0},{x:-1,y:0,z:0},false],
  ])('handles side/cap/parallel/point/finite shots %#',(from,to,hit)=>{
    expect(segmentIntersectsCapsule(from,to,a,b,.5)).toBe(hit);
    expect(segmentIntersectsCapsule(to,from,b,a,.5)).toBe(hit);
  });
  it('handles a zero-length bone as a sphere and bypasses unsupported envelopes',()=>{
    expect(segmentIntersectsCapsule({x:0,y:-2,z:0},{x:0,y:2,z:0},a,a,.5)).toBe(true);
    expect(segmentIntersectsCapsule({x:1,y:-2,z:0},{x:1,y:2,z:0},a,a,.5)).toBe(false);
    expect(segmentIntersectsCapsule(a,b,a,b,Infinity)).toBe(true);
    expect(segmentIntersectsCapsule({...a,x:NaN},b,a,b,1)).toBe(false);
  });
});
