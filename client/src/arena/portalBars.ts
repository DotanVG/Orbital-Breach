import * as THREE from 'three';
import { ARENA_SIZE, BREACH_ROOM_H, BREACH_ROOM_W } from '../../../shared/constants';
import { BarObject } from './bar';

/**
 * Two grab bars on the ARENA SIDE of each portal opening — left and right
 * rim. Players can grab these while floating toward a portal to control
 * their approach. Bars are appended to `bars` in place.
 */
export function placePortalArenaBars(
  scene: THREE.Scene,
  bars: BarObject[],
  goalAxis: 'x' | 'y' | 'z',
  goalSigns: { team0: 1 | -1; team1: 1 | -1 },
): void {
  // Player standing floor is at center.y - BREACH_ROOM_H/2 = -3, so 1.6u
  // above the floor works out to y = -BREACH_ROOM_H/2 + 1.6.
  const barY = -BREACH_ROOM_H / 2 + 1.6;

  for (const team of [0, 1] as const) {
    const sign = team === 0 ? goalSigns.team0 : goalSigns.team1;
    const wallPos = sign * (ARENA_SIZE / 2 - 0.5);

    if (goalAxis === 'z') {
      bars.push(new BarObject(scene,
        new THREE.Vector3(-BREACH_ROOM_W / 2, barY, wallPos),
        { x: 1, y: 0, z: 0 }));
      bars.push(new BarObject(scene,
        new THREE.Vector3(BREACH_ROOM_W / 2, barY, wallPos),
        { x: -1, y: 0, z: 0 }));
    } else if (goalAxis === 'x') {
      bars.push(new BarObject(scene,
        new THREE.Vector3(wallPos, barY, -BREACH_ROOM_W / 2),
        { x: 0, y: 0, z: 1 }));
      bars.push(new BarObject(scene,
        new THREE.Vector3(wallPos, barY, BREACH_ROOM_W / 2),
        { x: 0, y: 0, z: -1 }));
    }
  }
}
