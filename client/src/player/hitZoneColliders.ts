import type { HitZone } from './playerTypes';

export type ColliderShape = 'box' | 'sphere' | 'capsule';

export interface HitZoneCollider {
  id: string;
  zone: HitZone;
  shape: ColliderShape;
  /** Offset from player physics origin (feet-level y=0 for typical spawn, but origin is at body center) */
  position: { x: number; y: number; z: number };
  /** box: half-extents xyz; sphere: x=radius (y,z unused); capsule: x=radius, y=half-height */
  size: { x: number; y: number; z: number };
  /** Euler angles in radians (XYZ order) */
  rotation: { x: number; y: number; z: number };
}

let _nextId = 1;
function nextId(): string { return `col_${_nextId++}`; }

/**
 * Starting collider set for the alien model.
 * Player physics origin is at the center of the PLAYER_RADIUS (0.8) sphere.
 * HITBOX_OFFSET_Y = -0.35 means the hit sphere centre is 0.35 units below origin.
 * These are rough defaults — use ] (collider editor) to tune them in-game.
 */
export const defaultHitZoneColliders: HitZoneCollider[] = [
  {
    id: nextId(), zone: 'head', shape: 'sphere',
    position: { x: 0, y: 0.12, z: 0 },
    size:     { x: 0.18, y: 0.18, z: 0.18 },
    rotation: { x: 0, y: 0, z: 0 },
  },
  {
    id: nextId(), zone: 'body', shape: 'box',
    position: { x: 0, y: -0.18, z: 0 },
    size:     { x: 0.19, y: 0.23, z: 0.14 },
    rotation: { x: 0, y: 0, z: 0 },
  },
  {
    id: nextId(), zone: 'leftArm', shape: 'box',
    position: { x: -0.33, y: -0.14, z: 0 },
    size:     { x: 0.13, y: 0.21, z: 0.10 },
    rotation: { x: 0, y: 0, z: 0 },
  },
  {
    id: nextId(), zone: 'rightArm', shape: 'box',
    position: { x: 0.33, y: -0.14, z: 0 },
    size:     { x: 0.13, y: 0.21, z: 0.10 },
    rotation: { x: 0, y: 0, z: 0 },
  },
  {
    id: nextId(), zone: 'leftLeg', shape: 'box',
    position: { x: -0.13, y: -0.54, z: 0 },
    size:     { x: 0.10, y: 0.23, z: 0.10 },
    rotation: { x: 0, y: 0, z: 0 },
  },
  {
    id: nextId(), zone: 'rightLeg', shape: 'box',
    position: { x: 0.13, y: -0.54, z: 0 },
    size:     { x: 0.10, y: 0.23, z: 0.10 },
    rotation: { x: 0, y: 0, z: 0 },
  },
];

export function makeCollider(zone: HitZone, shape: ColliderShape): HitZoneCollider {
  return {
    id: nextId(), zone, shape,
    position: { x: 0, y: 0, z: 0 },
    size:     { x: 0.15, y: 0.15, z: 0.15 },
    rotation: { x: 0, y: 0, z: 0 },
  };
}

export function cloneColliders(src: HitZoneCollider[]): HitZoneCollider[] {
  return src.map(c => ({
    ...c,
    position: { ...c.position },
    size:     { ...c.size },
    rotation: { ...c.rotation },
  }));
}

export function serializeColliders(colliders: HitZoneCollider[]): string {
  return JSON.stringify(colliders, null, 2);
}
