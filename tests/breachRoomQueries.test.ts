import { describe, it, expect } from 'vitest';
import {
  isInBreachRoom,
  isDeepInBreachRoom,
} from '../client/src/arena/breachRoomQueries';
import {
  BREACH_ROOM_D,
  BREACH_ROOM_H,
  BREACH_ROOM_W,
} from '../shared/constants';

const roomZ = { center: { x: 0, y: 0, z: 23 }, openAxis: 'z' as const };
const roomX = { center: { x: 23, y: 0, z: 0 }, openAxis: 'x' as const };

describe('isInBreachRoom', () => {
  it('accepts room center', () => {
    expect(isInBreachRoom({ x: 0, y: 0, z: 23 }, roomZ)).toBe(true);
  });

  it('rejects points past the depth face', () => {
    const depthEdge = 23 + BREACH_ROOM_D / 2;
    expect(isInBreachRoom({ x: 0, y: 0, z: depthEdge + 0.01 }, roomZ)).toBe(false);
    expect(isInBreachRoom({ x: 0, y: 0, z: depthEdge - 0.01 }, roomZ)).toBe(true);
  });

  it('rejects points past width or height', () => {
    expect(isInBreachRoom({ x: BREACH_ROOM_W / 2, y: 0, z: 23 }, roomZ)).toBe(false);
    expect(isInBreachRoom({ x: 0, y: BREACH_ROOM_H / 2, z: 23 }, roomZ)).toBe(false);
  });

  it('works for x-axis rooms with swapped perpendicular axis', () => {
    expect(isInBreachRoom({ x: 23, y: 0, z: BREACH_ROOM_W / 2 - 0.01 }, roomX)).toBe(true);
    expect(isInBreachRoom({ x: 23, y: 0, z: BREACH_ROOM_W / 2 + 0.01 }, roomX)).toBe(false);
  });
});

describe('isDeepInBreachRoom', () => {
  it('requires the player to be at least minDepth past the open face', () => {
    const openFace = 23 - BREACH_ROOM_D / 2;
    // 0.5 into the room — fails a 1.0 minDepth check, passes a 0.4.
    expect(isDeepInBreachRoom({ x: 0, y: 0, z: openFace + 0.5 }, roomZ, 1.0)).toBe(false);
    expect(isDeepInBreachRoom({ x: 0, y: 0, z: openFace + 0.5 }, roomZ, 0.4)).toBe(true);
  });

  it('still rejects out-of-bounds lateral positions', () => {
    expect(isDeepInBreachRoom({ x: 0, y: BREACH_ROOM_H, z: 23 }, roomZ, 0.5)).toBe(false);
  });
});
