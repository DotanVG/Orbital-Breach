import { describe, it, expect } from 'vitest';
import { generateArenaLayout } from '../shared/arena-gen';
import { ARENA_SIZE, OBSTACLE_MIN, OBSTACLE_MAX } from '../shared/constants';

describe('generateArenaLayout', () => {
  it('is deterministic for the same seed', () => {
    const a = generateArenaLayout(12345);
    const b = generateArenaLayout(12345);
    expect(a).toEqual(b);
  });

  it('diverges with different seeds', () => {
    const a = generateArenaLayout(1);
    const b = generateArenaLayout(2);
    expect(a).not.toEqual(b);
  });

  it('picks goalAxis from {x, z} only', () => {
    for (let s = 0; s < 40; s++) {
      const layout = generateArenaLayout(s);
      expect(['x', 'z']).toContain(layout.goalAxis);
    }
  });

  it('assigns team0 = -1 and team1 = 1 goal signs', () => {
    const layout = generateArenaLayout(42);
    expect(layout.goalSigns).toEqual({ team0: -1, team1: 1 });
  });

  it('generates an even number of obstacles in the allowed range', () => {
    for (let s = 0; s < 20; s++) {
      const layout = generateArenaLayout(s);
      expect(layout.obstacles.length % 2).toBe(0);
      const halfCount = layout.obstacles.length / 2;
      expect(halfCount).toBeGreaterThanOrEqual(Math.floor(OBSTACLE_MIN / 2));
      expect(halfCount).toBeLessThanOrEqual(OBSTACLE_MAX);
    }
  });

  it('mirrors obstacles on the goal axis for symmetry', () => {
    const layout = generateArenaLayout(7777);
    const ax = layout.goalAxis;
    for (let i = 0; i < layout.obstacles.length; i += 2) {
      const a = layout.obstacles[i];
      const b = layout.obstacles[i + 1];
      expect(a.size).toEqual(b.size);
      expect(a.pos[ax]).toBeCloseTo(-b.pos[ax]);
    }
  });

  it('keeps obstacles clear of the portal lanes', () => {
    const layout = generateArenaLayout(321);
    const ax = layout.goalAxis;
    const safeLimit = ARENA_SIZE / 2 - 7;
    for (const obs of layout.obstacles) {
      expect(Math.abs(obs.pos[ax])).toBeLessThanOrEqual(safeLimit * 0.85 + 1e-9);
    }
  });

  it('records the seed used', () => {
    const layout = generateArenaLayout(98765);
    expect(layout.seed).toBe(98765);
  });
});
