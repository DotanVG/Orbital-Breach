import { ARENA_SIZE, MAX_LAUNCH_SPEED, BREACH_ROOM_D, BREACH_ROOM_H, BREACH_ROOM_W } from './constants';
import { IDENTITY_QUATERNION, normalizeQuaternion, rotateByQuaternion, type QuaternionLike } from './hitZoneColliders';
import type { Vec3 } from './vec3';

export interface BodyCollider { center: Vec3; half: Vec3 }
// CPU-skinned Alien_IdleHold envelope with helmet clearance, metres in player-local space.
// Includes the pistol-holding arms, never the T-pose arm span.
export const STANDING_BODY: BodyCollider = { center: { x: 0, y: -0.3455, z: 0.26 }, half: { x: 0.15, y: 0.2965, z: 0.17 } };
export const FLOATING_BODY: BodyCollider = { center: { x: 0, y: -0.535, z: 0.21 }, half: { x: 0.32, y: 0.235, z: 0.37 } };
export const HANGING_BODY: BodyCollider = { center: { x: 0, y: -0.3455, z: 0.33 }, half: { x: 0.12, y: 0.2965, z: 0.23 } };
// Freeze crossfades can start upright or swimming: enclose both body poses.
export const FROZEN_BODY: BodyCollider = { center: {x:0,y:-0.4,z:0.2}, half: {x:0.32,y:0.4,z:0.38} };
export function bodyColliderForPhase(phase = 'BREACH'): BodyCollider {
  if (phase === 'FROZEN') return FROZEN_BODY;
  return phase === 'GRABBING' || phase === 'AIMING' ? HANGING_BODY
    : phase === 'FLOATING' ? FLOATING_BODY : STANDING_BODY;
}
export function bodyWorldBounds(pos: Vec3, orientation: QuaternionLike = IDENTITY_QUATERNION, phase = 'BREACH'): BodyCollider {
  const body = bodyColliderForPhase(phase), q = normalizeQuaternion(orientation);
  const offset = rotateByQuaternion(q, body.center);
  const axes = [rotateByQuaternion(q, { x: body.half.x, y: 0, z: 0 }), rotateByQuaternion(q, { x: 0, y: body.half.y, z: 0 }), rotateByQuaternion(q, { x: 0, y: 0, z: body.half.z })];
  return { center: { x: pos.x + offset.x, y: pos.y + offset.y, z: pos.z + offset.z }, half: {
    x: axes.reduce((s,a)=>s+Math.abs(a.x),0), y: axes.reduce((s,a)=>s+Math.abs(a.y),0), z: axes.reduce((s,a)=>s+Math.abs(a.z),0),
  } };
}
export const breachFloorAnchorY = (centerY: number): number => centerY - BREACH_ROOM_H / 2 - STANDING_BODY.center.y + STANDING_BODY.half.y;
export interface BodyPhysicsState { pos: Vec3; vel: Vec3 }
export interface CollisionBox { min: Vec3; max: Vec3 }
const AXES = ['x','y','z'] as const;
export interface PortalFaces { positive: boolean; negative: boolean }

/** Same support margins on client and server, with clearance for the entire body. */
export function bounceBodyArena(state: BodyPhysicsState, q: QuaternionLike = IDENTITY_QUATERNION, phase = 'BREACH', portalAxis?: 'x'|'y'|'z', perpAxis?: 'x'|'z', faces?: PortalFaces): void {
  const b = bodyWorldBounds(state.pos,q,phase), edge = ARENA_SIZE/2;
  for (const ax of AXES) {
    const inPortal = ax === portalAxis && perpAxis !== undefined
      && Math.abs(b.center[perpAxis])+b.half[perpAxis] <= BREACH_ROOM_W/2
      && Math.abs(b.center.y)+b.half.y <= BREACH_ROOM_H/2;
    const lo = -edge+b.half[ax], hi = edge-b.half[ax];
    if (b.center[ax] > hi && !(inPortal && faces?.positive)) {
      state.pos[ax] += hi-b.center[ax]; if (state.vel[ax] > 0) state.vel[ax] *= -1;
    }
    if (b.center[ax] < lo && !(inPortal && faces?.negative)) {
      state.pos[ax] += lo-b.center[ax]; if (state.vel[ax] < 0) state.vel[ax] *= -1;
    }
  }
  if (portalAxis && perpAxis) {
    const after = bodyWorldBounds(state.pos,q,phase);
    if (Math.abs(after.center[portalAxis]) > edge) {
      const sign = after.center[portalAxis] > 0 ? 1 : -1;
      const center = { x: 0, y: 0, z: 0 }; center[portalAxis] = sign*(edge+BREACH_ROOM_D/2);
      clampBodyBreach(state,center,portalAxis,sign === 1 ? -1 : 1,true,q,phase);
    }
  }
}
export function clampBodyBreach(state: BodyPhysicsState, center: Vec3, openAxis: 'x'|'y'|'z', openSign: 1|-1, portalOpen = true, q: QuaternionLike = IDENTITY_QUATERNION, phase = 'BREACH'): void {
  const b = bodyWorldBounds(state.pos,q,phase);
  const room = { x: BREACH_ROOM_W/2, y: BREACH_ROOM_H/2, z: BREACH_ROOM_W/2 };
  room[openAxis] = BREACH_ROOM_D/2;
  for (const ax of AXES) {
    const lo = center[ax]-room[ax]+b.half[ax], hi = center[ax]+room[ax]-b.half[ax];
    if (b.center[ax] < lo && !(portalOpen && ax === openAxis && openSign === -1)) {
      state.pos[ax] += lo-b.center[ax]; if (state.vel[ax]<0) state.vel[ax]=0;
    }
    if (b.center[ax] > hi && !(portalOpen && ax === openAxis && openSign === 1)) {
      state.pos[ax] += hi-b.center[ax]; if (state.vel[ax]>0) state.vel[ax]=0;
    }
  }
}
/** Minkowski AABB contact: least penetration axis; reflect only inward speed. */
export function bounceBodyBoxes(state: BodyPhysicsState, boxes: readonly CollisionBox[], q: QuaternionLike = IDENTITY_QUATERNION, phase = 'BREACH', padding = 0): void {
  const b = bodyWorldBounds(state.pos,q,phase);
  for (const box of boxes) {
    let depth = Infinity, axis: 'x'|'y'|'z' = 'x', sign = 1;
    let overlaps = true;
    for (const ax of AXES) {
      const lo = box.min[ax]-b.half[ax]-padding, hi = box.max[ax]+b.half[ax]+padding;
      if (b.center[ax] <= lo || b.center[ax] >= hi) { overlaps=false; break; }
      const near = b.center[ax]-lo, far = hi-b.center[ax];
      if (Math.min(near,far) < depth) { depth=Math.min(near,far); axis=ax; sign=near<=far?-1:1; }
    }
    if (!overlaps) continue;
    state.pos[axis] += sign*depth;
    b.center[axis] += sign*depth;
    if (state.vel[axis]*sign < 0) state.vel[axis] *= -0.5;
  }
}
/** Bound displacement by half the smallest support: even zero-thickness slabs cannot be skipped. */
export function bodySubsteps(velocity: Vec3, dt: number, phase = 'BREACH'): number {
  const h=bodyColliderForPhase(phase).half;
  return Math.max(1, Math.ceil(Math.hypot(velocity.x,velocity.y,velocity.z)*Math.max(0,dt)/(Math.min(h.x,h.y,h.z)*0.5)));
}

/** Shared bounded-displacement integration, including the launch clearance step. */
export function advanceBodyWorld(state: BodyPhysicsState, dt: number, q: QuaternionLike, phase: string, boxes: readonly CollisionBox[], portalAxis?: 'x'|'y'|'z', faces?: PortalFaces): void {
  const speed=Math.hypot(state.vel.x,state.vel.y,state.vel.z);
  if(speed>MAX_LAUNCH_SPEED) for(const a of AXES) state.vel[a]*=MAX_LAUNCH_SPEED/speed;
  const steps=bodySubsteps(state.vel,dt,phase);
  for(let i=0;i<steps;i++) {
    for(const a of AXES) state.pos[a]+=state.vel[a]*dt/steps;
    bounceBodyArena(state,q,phase,portalAxis,portalAxis === 'x' ? 'z' : 'x',faces);
    bounceBodyBoxes(state,boxes,q,phase);
  }
}
