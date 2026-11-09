import { ARENA_SIZE, MAX_LAUNCH_SPEED, BREACH_ROOM_D, BREACH_ROOM_H, BREACH_ROOM_W } from './constants';
import { IDENTITY_QUATERNION, normalizeQuaternion, rotateByQuaternion, type QuaternionLike } from './hitZoneColliders';
import { v3, type Vec3 } from './vec3';
import { bodyPartsForPhase } from './bodyParts';

export interface BodyCollider { center: Vec3; half: Vec3 }
// CPU-skinned Alien_IdleHold envelope with helmet clearance, metres in player-local space.
// Includes the pistol-holding arms, never the T-pose arm span.
export const STANDING_BODY: BodyCollider = { center: { x: 0, y: -0.3455, z: 0.26 }, half: { x: 0.15, y: 0.2965, z: 0.17 } };
// CPU-skinned swim supports: fit the head/torso/legs first, then retain only
// enough asymmetric arm clearance to limit swinging fingertips to a 3 cm graze.
// A symmetric motion envelope leaves the pistol side ~15 cm from a wall.
export const FLOATING_BODY: BodyCollider = { center: { x: -0.0515, y: -0.56525, z: 0.14 }, half: { x: 0.2385, y: 0.17575, z: 0.30 } };
// Reclined surface hold: CPU-skinned body + all 9,920 helmet-asset vertices,
// with 1 mm support padding on every face. Local +X follows the bar.
export const HANGING_BODY: BodyCollider = {"center":{"x":0.02575,"y":-0.47792,"z":0.16177},"half":{"x":0.17304,"y":0.16377,"z":0.26828}};
// Freeze crossfades can start upright, hanging or anywhere in the swim cycle.
// Their union cannot fit each individual pose tightly; preserve non-penetration.
export const FROZEN_BODY: BodyCollider = { center: { x: 0.0035, y: -0.414, z: 0.2015 }, half: { x: 0.3335, y: 0.359, z: 0.3605 } };
export function bodyColliderForPhase(phase = 'BREACH'): BodyCollider {
  if (phase === 'FROZEN') return FROZEN_BODY;
  return phase === 'GRABBING' || phase === 'AIMING' ? HANGING_BODY
    : phase === 'FLOATING' ? FLOATING_BODY : STANDING_BODY;
}
export function bodyWorldBounds(pos: Vec3, orientation: QuaternionLike = IDENTITY_QUATERNION, phase = 'BREACH'): BodyCollider {
  const q = normalizeQuaternion(orientation);
  const min = { x: Infinity, y: Infinity, z: Infinity }, max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const part of bodyPartsForPhase(phase)) {
    const center = v3.add(pos, rotateByQuaternion(q, part.center));
    const axes = AXES.map(a => rotateByQuaternion(q, { x: 0, y: 0, z: 0, [a]: part.half[a] }));
    for (const a of AXES) {
      const support = axes.reduce((sum, axis) => sum + Math.abs(axis[a]), 0);
      min[a] = Math.min(min[a], center[a] - support);
      max[a] = Math.max(max[a], center[a] + support);
    }
  }
  return { center: v3.scale(v3.add(min, max), 0.5), half: v3.scale(v3.sub(max, min), 0.5) };
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
/** A separating diamond face proves the rigid body is in empty AABB corner
 * space. Retain conservative box collision when no such separation exists.
 * `diamond` is the FULL octahedron envelope, never the inset bounce box. */
export function bodyClearsDiamond(pos: Vec3, q: QuaternionLike, phase: string, diamond: CollisionBox): boolean {
  const rotation = normalizeQuaternion(q), half = v3.scale(v3.sub(diamond.max, diamond.min), 0.5);
  const diamondCenter = v3.scale(v3.add(diamond.min, diamond.max), 0.5);
  return bodyPartsForPhase(phase).every(body => {
    const relative = v3.sub(v3.add(pos,rotateByQuaternion(rotation,body.center)),diamondCenter);
    const axes = AXES.map(a => rotateByQuaternion(rotation,{x:0,y:0,z:0,[a]:body.half[a]}));
    for (const x of [-1,1]) for (const y of [-1,1]) for (const z of [-1,1]) {
      const normal={x:x/half.x,y:y/half.y,z:z/half.z};
      const support=axes.reduce((sum,axis)=>sum+Math.abs(v3.dot(normal,axis)),0);
      if (v3.dot(normal,relative)-support > 1+1e-6) return true;
    }
    return false;
  });
}

/** Compound OBB vs AABB using separating axes. For each world axis, find
 * forbidden translation intervals, then leave their connected union once.
 * Resolving each limb separately can push two overlapping limbs back and forth.
 * World-axis response preserves the existing restitution and sliding behavior. */
export function bounceBodyBoxes(state: BodyPhysicsState, boxes: readonly CollisionBox[], q: QuaternionLike = IDENTITY_QUATERNION, phase = 'BREACH', padding = 0): void {
  if (!boxes.length) return;
  const bounds = bodyWorldBounds(state.pos,q,phase);
  const rotation = normalizeQuaternion(q);
  const basis = AXES.map(a => ({ x: 0, y: 0, z: 0, [a]: 1 }));
  const localAxes = basis.map(axis => rotateByQuaternion(rotation, axis));
  const normals = [...basis, ...localAxes, ...basis.flatMap(a => localAxes.map(b => v3.cross(a,b)))].filter(n => v3.lengthSq(n) > 1e-12);
  const parts = bodyPartsForPhase(phase).map(part => ({
    center: rotateByQuaternion(rotation, part.center),
    supports: normals.map(n => localAxes.reduce((sum, axis, i) => sum + Math.abs(v3.dot(n,axis)) * part.half[AXES[i]], 0)),
  }));
  for (const box of boxes) {
    if (AXES.some(a => bounds.center[a]+bounds.half[a]+padding <= box.min[a]
      || bounds.center[a]-bounds.half[a]-padding >= box.max[a])) continue;
    const boxCenter = v3.scale(v3.add(box.min,box.max),0.5);
    const half = v3.scale(v3.sub(box.max,box.min),0.5);
    const intervals: Array<Array<[number,number]>> = [[],[],[]];
    let overlaps = false;
    for (const part of parts) {
      const relative = v3.sub(v3.add(state.pos,part.center),boxCenter);
      const distances = normals.map(n => v3.dot(relative,n));
      const supports = normals.map((n,i) => part.supports[i] + AXES.reduce((sum,a) => sum + Math.abs(n[a]) * (half[a]+padding),0));
      if (distances.every((d,i) => Math.abs(d) < supports[i] - 1e-10)) overlaps = true;
      for (let ai=0; ai<3; ai++) {
        let lo = -Infinity, hi = Infinity;
        for (let i=0; i<normals.length; i++) {
          const slope = normals[i][AXES[ai]], d = distances[i], support = supports[i];
          if (Math.abs(slope) < 1e-10) {
            if (Math.abs(d) >= support - 1e-10) { lo=1; hi=0; break; }
          } else {
            const t1=(-support-d)/slope, t2=(support-d)/slope;
            lo=Math.max(lo,Math.min(t1,t2)); hi=Math.min(hi,Math.max(t1,t2));
          }
        }
        if (lo < hi) intervals[ai].push([lo,hi]);
      }
    }
    if (!overlaps) continue;
    let correction = Infinity, axis: 'x'|'y'|'z' = 'x';
    for (let ai=0; ai<3; ai++) {
      let lo=0, hi=0;
      // At most one expansion per part; catches chains in either order.
      for (let pass=0; pass<parts.length; pass++) for (const [a,b] of intervals[ai]) {
        if (a <= hi+1e-10 && b >= lo-1e-10) { lo=Math.min(lo,a); hi=Math.max(hi,b); }
      }
      const delta = -lo <= hi ? lo : hi;
      if (Math.abs(delta) < Math.abs(correction)) { correction=delta; axis=AXES[ai]; }
    }
    state.pos[axis] += correction;
    bounds.center[axis] += correction;
    if (state.vel[axis]*correction < 0) state.vel[axis] *= -0.5;
  }
}
/** Bound displacement by half the smallest support: even zero-thickness slabs cannot be skipped. */
export function bodySubsteps(velocity: Vec3, dt: number, phase = 'BREACH'): number {
  const smallest = Math.min(...bodyPartsForPhase(phase).flatMap(p => AXES.map(a => p.half[a])));
  return Math.max(1, Math.ceil(Math.hypot(velocity.x,velocity.y,velocity.z)*Math.max(0,dt)/(smallest*0.5)));
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
