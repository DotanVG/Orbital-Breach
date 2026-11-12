import { describe, expect, it } from 'vitest';
import { Box3, Matrix3, Matrix4, Quaternion, Vector3 } from 'three';
import { OBB } from '../client/node_modules/three/examples/jsm/math/OBB.js';
import { advanceBodyWorld, bodyColliderForPhase, bodySubsteps, bodyWorldBounds, bounceBodyBoxes } from '../shared/bodyCollider';
import { bodyPartsForPhase } from '../shared/bodyParts';
import { randomOrientation, seededRandom } from './helpers/hitboxOrientation';

// Independent installed Three.js SAT oracle; no renderer/scene objects.
function intersections(pos: Vector3,q: Quaternion,phase: string,box: Box3): number {
  const rotation=new Matrix3().setFromMatrix4(new Matrix4().makeRotationFromQuaternion(q));
  return bodyPartsForPhase(phase).filter(p=>new OBB(new Vector3().copy(p.center).applyQuaternion(q).add(pos),new Vector3().copy(p.half).multiplyScalar(1-1e-7),rotation).intersectsBox3(box)).length;
}

describe('compound environment body',()=>{
  it('has six physical parts, independent of damage volumes, preserving planar supports',()=>{
    for(const phase of ['BREACH','FLOATING','GRABBING','FROZEN']) {
      const parts=bodyPartsForPhase(phase), envelope=bodyColliderForPhase(phase), b=bodyWorldBounds(new Vector3(),new Quaternion(),phase);
      expect(parts.map(p=>p.zone)).toEqual(['head','body','leftArm','rightArm','leftLeg','rightLeg']);
      for(const a of ['x','y','z'] as const) {
        expect(b.center[a]).toBeCloseTo(envelope.center[a],12);expect(b.half[a]).toBeCloseTo(envelope.half[a],12);
      }
    }
    expect(bodyPartsForPhase('AIMING')).toBe(bodyPartsForPhase('GRABBING'));
    expect(bodyPartsForPhase('RESPAWNING')).toBe(bodyPartsForPhase('BREACH'));
  });
  it('allows small obstacles in empty envelope corners through full rotations',()=>{
    const rng=seededRandom(126);
    for(let i=0;i<64;i++) {
      const q=i===0?new Quaternion():randomOrientation(rng), pos=new Vector3(2,1,3);
      const center=new Vector3(.17,-.41,.42).applyQuaternion(q).add(pos), box=new Box3().setFromCenterAndSize(center,new Vector3(.004,.004,.004));
      expect(intersections(pos,q,'FLOATING',box)).toBe(0);
      const state={pos:pos.clone(),vel:new Vector3(1,2,3)};
      bounceBodyBoxes(state,[box],q,'FLOATING');expect(state.pos.toArray()).toEqual(pos.toArray());expect(state.vel.toArray()).toEqual([1,2,3]);
    }
  });
  it('resolves every part against a small obstacle and stays at rest without repeated corrections',()=>{
    const rng=seededRandom(124);
    for(const phase of ['BREACH','FLOATING','GRABBING','FROZEN']) for(let i=0;i<12;i++) {
      const q=randomOrientation(rng);
      for(const p of bodyPartsForPhase(phase)) {
        const center=new Vector3().copy(p.center).applyQuaternion(q), box=new Box3().setFromCenterAndSize(center,new Vector3(.02,.02,.02));
        const state={pos:new Vector3(),vel:new Vector3()};
        expect(intersections(state.pos,q,phase,box)).toBeGreaterThan(0);
        bounceBodyBoxes(state,[box],q,phase);
        expect(state.pos.length()).toBeGreaterThan(0);
        expect(intersections(state.pos,q,phase,box)).toBe(0);
        const resolved=state.pos.clone();
        for(let frame=0;frame<20;frame++) advanceBodyWorld(state,1/60,q,phase,[box]);
        expect(state.pos.distanceTo(resolved)).toBeLessThan(1e-8);
      }
    }
  });
  it('does not skip even zero-thickness walls at maximum launch speed or long frames',()=>{
    const rng=seededRandom(224);
    for(const phase of ['FLOATING','FROZEN']) for(let i=0;i<8;i++) for(const axis of ['x','y','z'] as const) for(const sign of [-1,1]) {
      const q=randomOrientation(rng),box=new Box3(new Vector3(-8,-8,-8),new Vector3(8,8,8));box.min[axis]=box.max[axis]=0;
      const state={pos:new Vector3(),vel:new Vector3()};state.pos[axis]=sign*2;state.vel[axis]=-sign*20;
      const dt=.25, steps=bodySubsteps(state.vel,dt,phase);
      for(let step=0;step<steps;step++) {
        advanceBodyWorld(state,dt/steps,q,phase,[box]);
        expect(sign*bodyWorldBounds(state.pos,q,phase).center[axis]).toBeGreaterThan(0);
        expect(intersections(state.pos,q,phase,box)).toBe(0);
      }
      expect(state.vel[axis]).toBe(sign*10);
    }
  });
});
