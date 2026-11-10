import { afterEach, describe, expect, it, vi } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { advanceBodyWorld, bodySubsteps, bodySweepFraction, bodyWorldBounds } from '../shared/bodyCollider';
import * as bodyParts from '../shared/bodyParts';
import { DIAMOND_SPECS } from '../shared/arena-gen';
import { ARENA_SIZE, MAX_LAUNCH_SPEED, PLAYER_DIAMOND_AABB_INSET } from '../shared/constants';

const axes = ['x', 'y', 'z'] as const;
const orientations = [new Quaternion(), new Quaternion().setFromAxisAngle(new Vector3(1, 2, 3).normalize(), .7),
  new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2)];
const poses = ['BREACH', 'FLOATING', 'GRABBING', 'FROZEN'];
const cases = poses.flatMap(phase => bodyParts.bodyPartsForPhase(phase).map(part => ({ phase, part })));

afterEach(() => vi.restoreAllMocks());

describe('swept compound world integration', () => {
  it('only skips fine steps when the entire swept compound is clear', () => {
    const bounds = bodyWorldBounds(new Vector3(), new Quaternion(), 'FLOATING');
    const velocity = { x: 20, y: 0, z: 0 };
    const box = { min: { x: .6, y: -1, z: -1 }, max: { x: .61, y: 1, z: 1 } };
    expect(bodySweepFraction(bounds, velocity, .05, [])).toBe(1);
    expect(bodySweepFraction(bounds, velocity, .05, [box])).toBeCloseTo(.413, 10);
    expect(bodySweepFraction(bounds, { x: -20, y: 0, z: 0 }, .05, [box])).toBe(1);
    expect(bodySweepFraction({ center: { x: 19, y: 0, z: 0 }, half: bounds.half }, velocity, .05, [])).toBeCloseTo(1-bounds.half.x, 10);
    expect(bodySweepFraction(bounds, { x: 0, y: 0, z: 0 }, 0, [
      { min: { ...bounds.center }, max: { x: 1, y: 1, z: 1 } },
    ])).toBe(0);
    const state = { pos: new Vector3(), vel: new Vector3(20, 0, 0) };
    advanceBodyWorld(state, .05, new Quaternion(), 'FLOATING', []);
    expect(state.pos.toArray()).toEqual([1, 0, 0]);
    expect(state.vel.toArray()).toEqual([20, 0, 0]);
  });

  it('uses ray entry/exit times, including parallel separation, initial overlap and portal fallback', () => {
    const bounds = { center: { x: 0, y: 0, z: 0 }, half: { x: .1, y: .1, z: .1 } };
    const box = { min: { x: .5, y: -.1, z: -.1 }, max: { x: .6, y: .1, z: .1 } };
    // The combined swept AABB intersects, but the diagonal ray misses the box.
    expect(bodySweepFraction(bounds, { x: 1, y: 1, z: 0 }, 1, [box])).toBe(1);
    expect(bodySweepFraction(bounds, { x: 0, y: 1, z: 0 }, 1, [box])).toBe(1);
    expect(bodySweepFraction(bounds, { x: 1, y: 0, z: 0 }, 1, [box])).toBeCloseTo(.4, 12);
    expect(bodySweepFraction(bounds, { x: -1, y: 0, z: 0 }, 1, [box])).toBe(1);
    expect(bodySweepFraction(bounds, { x: 20, y: 0, z: 0 }, 0, [box])).toBe(1);
    expect(bodySweepFraction({ ...bounds, center: { x: .5, y: 0, z: 0 } }, { x: 1, y: 0, z: 0 }, 1, [box])).toBe(0);
    expect(bodySweepFraction({ ...bounds, center: { x: 20, y: 0, z: 0 } }, { x: -1, y: 0, z: 0 }, 1, [])).toBe(0);
  });

  // Isolate each real part so a larger/leading part cannot mask its tunnelling.
  // Geometry and fine-step spacing remain the production values for that part.
  for (const { phase, part } of cases) it(`${phase} ${part.zone}: 20 m/s cannot cross real walls or the thinnest inset obstacle`, () => {
    vi.spyOn(bodyParts, 'bodyPartsForPhase').mockReturnValue([part]);
    const spec = DIAMOND_SPECS.diamond_wide;
    const half = { x: spec.rx * PLAYER_DIAMOND_AABB_INSET, y: spec.ry * PLAYER_DIAMOND_AABB_INSET,
      z: spec.rz * PLAYER_DIAMOND_AABB_INSET };
    // Minimum over every real archetype: 4 m * .70 = 2.8 m (wide diamond Y).
    expect(half.y * 2).toBe(Math.min(...Object.values(DIAMOND_SPECS).flatMap(s =>
      [s.rx, s.ry, s.rz].map(r => 2 * r * PLAYER_DIAMOND_AABB_INSET))));
    const box = { min: { x: -half.x, y: -half.y, z: -half.z }, max: half };
    for (const q of orientations) for (const dt of [.05, .25]) for (const sign of [-1, 1]) {
      const local = bodyWorldBounds(new Vector3(), q, phase);
      for (const a of axes) {
        // Arena and breach walls are mathematical planes (0 m thickness),
        // not finite stand-in slabs. Exercise the actual arena clamp.
        const pos = new Vector3().copy(local.center).negate();
        pos[a] += sign * (ARENA_SIZE / 2 - local.half[a] - .137);
        const vel = new Vector3(); vel[a] = sign * MAX_LAUNCH_SPEED;
        const state = { pos, vel };
        advanceBodyWorld(state, dt, q, phase, []);
        const end = bodyWorldBounds(state.pos, q, phase);
        expect(sign * end.center[a] + end.half[a]).toBeLessThanOrEqual(ARENA_SIZE / 2 + 1e-8);
        expect(state.vel[a]).toBe(-sign * MAX_LAUNCH_SPEED);

        // Also put that zero-thickness plane through the OBB/SAT path, so
        // passing the end-of-step arena clamp cannot hide a skipped part.
        const slab = { min: { x: -20, y: -20, z: -20 }, max: { x: 20, y: 20, z: 20 } };
        slab.min[a] = slab.max[a] = 0;
        const near = new Vector3().copy(local.center).negate();
        near[a] += sign * (local.half[a] + .137);
        const incoming = new Vector3(); incoming[a] = -sign * MAX_LAUNCH_SPEED;
        const contact = { pos: near, vel: incoming };
        advanceBodyWorld(contact, dt, q, phase, [slab]);
        const stopped = bodyWorldBounds(contact.pos, q, phase);
        expect(sign * stopped.center[a] - stopped.half[a]).toBeGreaterThanOrEqual(-1e-8);
        expect(contact.vel[a]).toBe(sign * MAX_LAUNCH_SPEED / 2);
      }
      const pos = new Vector3().copy(local.center).negate();
      pos.y += sign * (half.y + local.half.y + .137);
      const state = { pos, vel: new Vector3(0, -sign * MAX_LAUNCH_SPEED, 0) };
      const count = bodySubsteps(state.vel, dt, phase);
      expect(MAX_LAUNCH_SPEED * dt / count).toBeLessThanOrEqual(Math.min(part.half.x, part.half.y, part.half.z) / 2);
      advanceBodyWorld(state, dt, q, phase, [box]);
      const end = bodyWorldBounds(state.pos, q, phase);
      expect(sign * end.center.y - end.half.y).toBeGreaterThanOrEqual(half.y - 1e-8);
      expect(state.vel.y).toBe(sign * MAX_LAUNCH_SPEED / 2);
    }
  });
});
