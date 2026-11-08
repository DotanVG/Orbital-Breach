export {
  cloneColliders,
  defaultHitZoneColliders,
  type ColliderShape,
  type HitZoneCollider,
} from "../../../shared/hitZoneColliders";

import type { HitZone } from "./playerTypes";
import type { ColliderShape, HitZoneCollider } from "../../../shared/hitZoneColliders";

let nextColliderId = 7;

export function makeCollider(zone: HitZone, shape: ColliderShape): HitZoneCollider {
  return {
    id: `col_${nextColliderId++}`,
    zone,
    shape,
    position: { x: 0, y: 0, z: 0 },
    size: { x: 0.15, y: 0.15, z: 0.15 },
    rotation: { x: 0, y: 0, z: 0 },
  };
}

export function serializeColliders(colliders: HitZoneCollider[]): string {
  return JSON.stringify(colliders, null, 2);
}
