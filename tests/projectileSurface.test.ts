import { describe, expect, it } from 'vitest';
import { hitZoneForBone, indexHitSurface, segmentHitSurface, type HitSurface } from '../shared/projectileCollider';
const triangle=(z:number,zone:HitSurface['zones'][number]='body'):HitSurface=>({positions:new Float64Array([-1,-1,z,1,-1,z,0,1,z]),indices:new Uint32Array([0,1,2]),zones:[zone]});
const start={x:0,y:0,z:-2},end={x:0,y:0,z:2};
describe('first contact with damage surfaces',()=>{
  it('chooses the first triangle, not nearest zone or array order',()=>{
    expect(segmentHitSurface(start,end,[triangle(1,'head'),triangle(-1,'leftArm')])).toEqual({point:{x:0,y:0,z:-1},zone:'leftArm',t:.25});
  });
  it('does not hit empty space inside a former enclosing sphere',()=>{
    expect(segmentHitSurface({x:.9,y:.9,z:-2},{x:.9,y:.9,z:2},[triangle(0)])).toBeNull();
  });
  it('tests only the segment and handles parallel, degenerate and invalid shots',()=>{
    for(const [a,b] of [[start,{...end,z:-1}],[start,start],[{x:NaN,y:0,z:0},end]]) expect(segmentHitSurface(a,b,[triangle(0)])).toBeNull();
    expect(segmentHitSurface(start,end,[{...triangle(0),positions:new Float64Array(9)}])).toBeNull();
  });
  it('is double-sided and returns an exit if spawned inside a closed surface',()=>{
    expect(segmentHitSurface(end,start,[triangle(0)])?.zone).toBe('body');
    expect(segmentHitSurface({x:0,y:0,z:0},end,[triangle(-1),triangle(1,'head')])?.zone).toBe('head');
  });
  it('keeps surface starts/endpoints and rejects triangles behind a nearer surface',()=>{
    expect(segmentHitSurface({x:0,y:0,z:0},end,[triangle(0)])?.t).toBeCloseTo(0);
    expect(segmentHitSurface(start,{x:0,y:0,z:0},[triangle(0)])?.t).toBe(1);
  });
  it('maps actual skeleton names to six unchanged damage identities',()=>{
    const names={Head:'head',Neck:'body',Torso:'body',Hips:'body',UpperArmL:'leftArm',PalmR:'rightArm',MiddleFinger1L:'leftArm',UpperLegL:'leftLeg',FootR:'rightLeg',ToeR:'rightLeg'};
    for(const [name,zone] of Object.entries(names)) expect(hitZoneForBone(name)).toBe(zone);
  });
  it('caps every patch below staging and preserves exact intersections, including large triangles',()=>{
    const mesh=triangle(0),indexed=indexHitSurface(mesh);
    // This synthetic triangle is >0.30 m: no broadphase is used for it.
    expect(indexed.patches?.[0].min).toBeUndefined();
    const small={...mesh,positions:Float64Array.from(mesh.positions,v=>v*.1)};
    const prepared=indexHitSurface(small);
    for(const p of prepared.patches!) if(p.min && p.max) expect(Math.hypot(p.max.x-p.min.x,p.max.y-p.min.y,p.max.z-p.min.z)/2).toBeLessThanOrEqual(.30);
    for(let x=-.2;x<=.2;x+=.01) {
      const a={...start,x},b={...end,x};
      expect(segmentHitSurface(a,b,[prepared])).toEqual(segmentHitSurface(a,b,[small]));
      expect(segmentHitSurface(a,b,[indexed])).toEqual(segmentHitSurface(a,b,[mesh]));
    }
  });
});
