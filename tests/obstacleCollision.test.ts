import { describe,expect,it } from 'vitest';
import { Box3,Quaternion,Vector3 } from 'three';
import { bounceAgainstBoxes } from '../client/src/arena/obstacleCollision';
import { bodyWorldBounds,bodySubsteps } from '../shared/bodyCollider';
import { stepActorWorld } from '../server/src/colyseus/onlineActorSimulation';
const box=new Box3(new Vector3(-1,-1,-1),new Vector3(1,1,1));
describe('body versus obstacle boxes',()=>{
  for(const axis of ['x','y','z'] as const) for(const sign of [-1,1]) it(axis+' contact '+sign+' ends exactly on the obstacle face',()=>{
    const q=new Quaternion().setFromAxisAngle(new Vector3(1,2,3).normalize(),0.7), zero=bodyWorldBounds({x:0,y:0,z:0},q,'FLOATING');
    const center=new Vector3();center[axis]=sign*(1+zero.half[axis]-0.02);
    const s={pos:center.sub(zero.center),vel:new Vector3(0.4,0.5,0.6)};s.vel[axis]=-sign*4;
    const other=s.vel.clone();bounceAgainstBoxes(s,[box],q,'FLOATING');const b=bodyWorldBounds(s.pos,q,'FLOATING');
    expect(b.center[axis]-sign*b.half[axis]).toBeCloseTo(sign,8);expect(s.vel[axis]).toBe(sign*2);
    for(const a of ['x','y','z'] as const) if(a!==axis) expect(s.vel[a]).toBe(other[a]);
  });
  it('does not reflect already separating velocity or an exactly touching body',()=>{
    const s={pos:new Vector3(1.14,0,0),vel:new Vector3(2,0,0)};bounceAgainstBoxes(s,[box]);expect(s.vel.x).toBe(2);
    const before=s.pos.clone();bounceAgainstBoxes(s,[box]);expect(s.pos.distanceTo(before)).toBeLessThan(1e-10);
  });
  it('checks later boxes and resolves a centre/tie overlap without a zero sign',()=>{
    const s={pos:new Vector3(0,0.3455,-0.28),vel:new Vector3(2,0,0)};
    bounceAgainstBoxes(s,[new Box3(new Vector3(9,9,9),new Vector3(10,10,10)),box]);
    const b=bodyWorldBounds(s.pos);expect(Math.abs(b.center.x)-b.half.x).toBeCloseTo(1,8);
  });
  it('thin walls stay solid at maximum speed and large frames; authoritative and predicted stepping agree',()=>{
    const thin=new Box3(new Vector3(-0.005,-4,-4),new Vector3(0.005,4,4));
    const s={pos:new Vector3(-2,0,0),vel:new Vector3(20,0,0)}, actor={phase:'FLOATING',yaw:0,frozen:false,isBot:false,team:0 as const,posX:-2,posY:0,posZ:0,velX:20,velY:0,velZ:0};
    const count=bodySubsteps(s.vel,0.25,'FLOATING');
    for(let i=0;i<count;i++){s.pos.addScaledVector(s.vel,0.25/count);bounceAgainstBoxes(s,[thin],new Quaternion(),'FLOATING');}
    stepActorWorld(actor,0.25,'z',[thin]);
    expect(s.pos.x).toBeLessThan(-0.28);expect(s.vel.x).toBe(-10);expect(actor.posX).toBeCloseTo(s.pos.x,8);expect(actor.velX).toBe(-10);
  });
});
