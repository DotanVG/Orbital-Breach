import * as THREE from 'three';
import { BREACH_ROOM_D, BREACH_ROOM_H, BREACH_ROOM_W } from '../../../shared/constants';
import { makeBreachRoomMaterial, type BreachSurface } from '../render/materials';

/**
 * Build the 5 solid walls (floor, ceiling, two sides, back) of a breach
 * room into `group`. The open face is on `openAxis` × `openSign`.
 *
 * Walls are placed in LOCAL coordinates — `group` is already positioned
 * at the room center by the caller.
 */
export function buildBreachWalls(
  group: THREE.Group,
  team: 0 | 1,
  openAxis: 'x' | 'y' | 'z',
  openSign: 1 | -1,
): void {
  const hw = BREACH_ROOM_W / 2;
  const hh = BREACH_ROOM_H / 2;
  const hd = BREACH_ROOM_D / 2;

  const addWall = (
    surface: BreachSurface,
    w: number, h: number,
    px: number, py: number, pz: number,
    rx: number, ry: number, rz: number,
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      makeBreachRoomMaterial(team, surface),
    );
    mesh.position.set(px, py, pz);
    mesh.rotation.set(rx, ry, rz);
    group.add(mesh);
  };

  if (openAxis === 'z') {
    addWall('floor', BREACH_ROOM_W, BREACH_ROOM_D, 0, -hh, 0, -Math.PI / 2, 0, 0);
    addWall('ceiling', BREACH_ROOM_W, BREACH_ROOM_D, 0, hh, 0, Math.PI / 2, 0, 0);
    addWall('side', BREACH_ROOM_D, BREACH_ROOM_H, -hw, 0, 0, 0, Math.PI / 2, 0);
    addWall('side', BREACH_ROOM_D, BREACH_ROOM_H, hw, 0, 0, 0, -Math.PI / 2, 0);
    const backZ = openSign * -hd;
    addWall('back', BREACH_ROOM_W, BREACH_ROOM_H, 0, 0, backZ, 0, openSign === 1 ? Math.PI : 0, 0);
  } else if (openAxis === 'x') {
    addWall('floor', BREACH_ROOM_D, BREACH_ROOM_W, 0, -hh, 0, -Math.PI / 2, 0, 0);
    addWall('ceiling', BREACH_ROOM_D, BREACH_ROOM_W, 0, hh, 0, Math.PI / 2, 0, 0);
    addWall('side', BREACH_ROOM_D, BREACH_ROOM_H, 0, 0, -hw, 0, 0, Math.PI / 2);
    addWall('side', BREACH_ROOM_D, BREACH_ROOM_H, 0, 0, hw, 0, 0, -Math.PI / 2);
    const backX = openSign * -hd;
    addWall('back', BREACH_ROOM_W, BREACH_ROOM_H, backX, 0, 0, 0, openSign === 1 ? Math.PI / 2 : -Math.PI / 2, 0);
  } else {
    addWall('floor', BREACH_ROOM_W, BREACH_ROOM_W, 0, -hh, 0, -Math.PI / 2, 0, 0);
    addWall('ceiling', BREACH_ROOM_W, BREACH_ROOM_W, 0, hh, 0, Math.PI / 2, 0, 0);
    addWall('side', BREACH_ROOM_W, BREACH_ROOM_D, -hw, 0, 0, 0, Math.PI / 2, 0);
    addWall('side', BREACH_ROOM_W, BREACH_ROOM_D, hw, 0, 0, 0, -Math.PI / 2, 0);
    const backY = openSign * -hd;
    addWall('back', BREACH_ROOM_W, BREACH_ROOM_W, 0, backY, 0, openSign === 1 ? 0 : Math.PI, 0, 0);
  }
}
