import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { bounceArena, clampBreachRoom, integrateZeroG } from '../client/src/physics';
import { bodyWorldBounds, bodySubsteps, breachFloorAnchorY, clampBodyBreach } from '../shared/bodyCollider';
import { bounceActorInArena } from '../server/src/colyseus/onlineActorSimulation';
import { randomOrientation, seededRandom } from './helpers/hitboxOrientation';
import { sampleAlienPose } from './helpers/alienPose';
const state=(p:number[],v=[0,0,0])=>({pos:new Vector3(...p),vel:new Vector3(...v)});
describe('body world bounds',()=>{
  it('preserves true zero-G drift and caps speed at 20 m/s',()=>{
    const s=state([1,2,3],[2,-4,6]); integrateZeroG(s,0.5); expect(s.pos.toArray()).toEqual([2,0,6]);expect(s.vel.toArray()).toEqual([2,-4,6]);
    s.vel.set(40,0,0);integrateZeroG(s,1);expect(s.vel.length()).toBeCloseTo(20);
  });
  it('floor places the actual idle mesh feet within 1 cm; catches a 0.8 m anchor-margin mutant',async()=>{
    const pose=await sampleAlienPose();
    const oracle=(clamp:typeof clampBreachRoom)=>{const s=state([0,-8,23],[0,-9,0]);clamp(s,new Vector3(0,0,23),'z',-1);expect(Math.abs(s.pos.y+pose.bounds.min.y+3)).toBeLessThan(0.01);expect(s.vel.y).toBe(0);};
    oracle(clampBreachRoom);
    expect(()=>oracle((s)=>{s.pos.y=-3+0.8;s.vel.y=0;})).toThrow();
    expect(breachFloorAnchorY(0)).toBeCloseTo(-2.358,6);
  });
  it('side/ceiling/back contacts put the body support on each wall plane, not a radius margin',()=>{
    const q=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI/2);
    const s=state([9,8,-9],[4,5,-6]);clampBreachRoom(s,new Vector3(),'z',1,false,q);
    const b=bodyWorldBounds(s.pos,q);
    expect(b.center.x+b.half.x).toBeCloseTo(4,8);expect(b.center.y+b.half.y).toBeCloseTo(3,8);expect(b.center.z-b.half.z).toBeCloseTo(-3,8);
    expect(s.vel.toArray()).toEqual([0,0,0]);
    expect(Math.abs(s.pos.x-(4-0.8))).toBeGreaterThan(0.1);
  });
  it('leaves either portal-facing side open and seals closed breach doors',()=>{
    for(const axis of ['x','z'] as const) for(const sign of [-1,1] as const){
      const s=state([0,0,0]);s.pos[axis]=sign*9;s.vel[axis]=sign*2;
      clampBreachRoom(s,new Vector3(),axis,sign,true);expect(s.pos[axis]).toBe(sign*9);
      clampBreachRoom(s,new Vector3(),axis,sign,false);const b=bodyWorldBounds(s.pos);expect(b.center[axis]+sign*b.half[axis]).toBeCloseTo(sign*3,8);expect(s.vel[axis]).toBe(0);
    }
  });
  it('requires the entire rotated body to fit the portal opening',()=>{
    const q=new Quaternion();
    for(const open of [false,true]){
      const s=state([0,0,20.2],[0,0,5]);bounceArena(s,'z','x',{positive:open,negative:false},q,'FLOATING');
      expect(s.vel.z).toBe(open?5:-5);
    }
    const tooWide=state([3.9,0,20.2],[0,0,5]);bounceArena(tooWide,'z','x',{positive:true,negative:true},q,'FLOATING');expect(tooWide.vel.z).toBe(-5);
    const tooHigh=state([0,3.5,20.2],[0,0,5]);bounceArena(tooHigh,'z','x',{positive:true,negative:true},q,'FLOATING');expect(tooHigh.vel.z).toBe(-5);
  });
  it('server and client arena contacts match over random full orientations, phases, axes and door states',()=>{
    const rng=seededRandom(215);
    for(let i=0;i<100;i++) for(const phase of ['FLOATING','FROZEN','GRABBING','BREACH']) for(const axis of ['x','z'] as const){
      const q=phase==='BREACH'?new Quaternion().setFromAxisAngle(new Vector3(0,1,0),rng()*6):randomOrientation(rng);
      const s=state([(rng()-.5)*54,(rng()-.5)*46,(rng()-.5)*54],[2,-3,4]), actor={phase,yaw:0,frozen:phase==='FROZEN',isBot:false,team:0 as const,posX:s.pos.x,posY:s.pos.y,posZ:s.pos.z,velX:2,velY:-3,velZ:4,orientX:q.x,orientY:q.y,orientZ:q.z,orientW:q.w};
      // BREACH uses yaw on both sides, discarding any pitch/roll in stale snapshots.
      if(phase==='BREACH') actor.yaw=2*Math.atan2(q.y,q.w);
      const faces={positive:i%2===0,negative:i%3===0};
      bounceArena(s,axis,axis==='x'?'z':'x',actor.frozen?undefined:faces,q,phase);bounceActorInArena(actor,axis,faces);
      expect(new Vector3(actor.posX,actor.posY,actor.posZ).distanceTo(s.pos)).toBeLessThan(1e-10);expect([actor.velX,actor.velY,actor.velZ]).toEqual(s.vel.toArray());
    }
  });
  it('the pure breach helper and client wrapper use identical bounds',()=>{
    const a=state([9,-9,9],[1,-2,3]), b=structuredClone({pos:{x:9,y:-9,z:9},vel:{x:1,y:-2,z:3}});
    clampBreachRoom(a,new Vector3(),'x',1,false);clampBodyBreach(b,{x:0,y:0,z:0},'x',1,false);
    expect(a.pos.toArray()).toEqual([b.pos.x,b.pos.y,b.pos.z]);
    expect(bodySubsteps({x:20,y:0,z:0},0.05,'BREACH')).toBeGreaterThan(10);
  });
});
