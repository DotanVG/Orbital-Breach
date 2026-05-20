import { describe, it, expect } from 'vitest';
import { generateArenaLayout } from '../shared/arena-gen';
import { ARENA_SIZE } from '../shared/constants';

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

  it('generates at least several obstacles', () => {
    for (let s = 0; s < 20; s++) {
      const layout = generateArenaLayout(s);
      // Gate-blocker (1) + at least 2 mid-band pairs (4) + 1 outer-band pair (2) = at least 7
      expect(layout.obstacles.length).toBeGreaterThanOrEqual(7);
    }
  });

  it('always contains a gate-blocker diamond_huge at the center', () => {
    for (let s = 0; s < 50; s++) {
      const layout = generateArenaLayout(s);
      const blocker = layout.obstacles.find(o => o.archetype === 'diamond_huge');
      expect(blocker).toBeDefined();
      expect(blocker!.pos.x).toBeCloseTo(0);
      expect(blocker!.pos.y).toBeCloseTo(0);
      expect(blocker!.pos.z).toBeCloseTo(0);
    }
  });

  it('records the seed used', () => {
    const layout = generateArenaLayout(98765);
    expect(layout.seed).toBe(98765);
  });

  it('includes wallBars', () => {
    const layout = generateArenaLayout(555);
    expect(Array.isArray(layout.wallBars)).toBe(true);
    // 4 non-portal walls × 9 bars (3×3 grid) = 36 total
    expect(layout.wallBars.length).toBe(36);
  });

  it('keeps all obstacles within the arena bounds', () => {
    const half = ARENA_SIZE / 2;
    for (let s = 0; s < 30; s++) {
      const layout = generateArenaLayout(s);
      for (const obs of layout.obstacles) {
        const rx = obs.size.x / 2;
        const ry = obs.size.y / 2;
        const rz = obs.size.z / 2;
        // Center must be within arena minus half-extents with some clearance
        expect(Math.abs(obs.pos.x) + rx).toBeLessThanOrEqual(half + 0.01);
        expect(Math.abs(obs.pos.y) + ry).toBeLessThanOrEqual(half + 0.01);
        expect(Math.abs(obs.pos.z) + rz).toBeLessThanOrEqual(half + 0.01);
      }
    }
  });
});
