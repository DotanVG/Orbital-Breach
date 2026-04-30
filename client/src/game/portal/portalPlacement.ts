import * as THREE from "three";
import { BREACH_ROOM_D } from "../../../../shared/constants";

export interface PortalWallTransform {
  normal: THREE.Vector3;
  position: THREE.Vector3;
}

export function computeBreachRoomPortalTransform(
  center: THREE.Vector3,
  openAxis: "x" | "y" | "z",
  openSign: 1 | -1,
): PortalWallTransform {
  const normal = new THREE.Vector3();
  normal[openAxis] = openSign;

  const position = center.clone();
  position[openAxis] = center[openAxis] - openSign * (BREACH_ROOM_D / 2 - 0.08);
  position.y = center.y + 0.2;

  return { normal, position };
}
