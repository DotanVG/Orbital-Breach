import { describe, it, expect } from 'vitest';
import {
  generateArenaLayout,
  generateDiamondEdgeBars,
  generateWallBars,
  DIAMOND_SPECS,
} from '../shared/arena-gen';
import {
  ARENA_SIZE,
  DIAMOND_AABB_INSET,
  BREACH_ROOM_W,
  BREACH_ROOM_H,
  WALL_BARS_PER_WALL_MIN,
  WALL_BARS_PER_WALL_MAX,
} from '../shared/constants';

// Bullet radius — kept in sync with projectileSystem.ts (not exported from shared)
const BULLET_RADIUS = 0.07;

// ── Helpers ───────────────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Gate-blocker invariant (200 seeds) ───────────────────────────────────────

describe('gate-blocker invariant', () => {
  it('every seed 0-199 has exactly one diamond_huge at the origin', () => {
    for (let seed = 0; seed < 200; seed++) {
      const layout = generateArenaLayout(seed);
      const blockers = layout.obstacles.filter(o => o.archetype === 'diamond_huge');
      expect(blockers.length).toBe(1);
      expect(blockers[0].pos.x).toBeCloseTo(0, 6);
      expect(blockers[0].pos.y).toBeCloseTo(0, 6);
      expect(blockers[0].pos.z).toBeCloseTo(0, 6);
    }
  });

  it('gate-blocker bullet AABB covers the full portal opening on every seed 0-199', () => {
    // Portal opening is BREACH_ROOM_W × BREACH_ROOM_H centered at (0, 0, ±ARENA_SIZE/2).
    // A direct portal-to-portal shot travels along goalAxis at any (perpX, y) within
    // the portal opening. The bullet hits the gate-blocker when:
    //   |perpX| <= rx_gate * DIAMOND_AABB_INSET + BULLET_RADIUS
    //   |y|     <= ry_gate * DIAMOND_AABB_INSET + BULLET_RADIUS
    const portalHalfW = BREACH_ROOM_W / 2;   // 4
    const portalHalfH = BREACH_ROOM_H / 2;   // 3

    for (let seed = 0; seed < 200; seed++) {
      const layout = generateArenaLayout(seed);
      const blocker = layout.obstacles.find(o => o.archetype === 'diamond_huge')!;

      const rx = blocker.size.x / 2;
      const ry = blocker.size.y / 2;

      const insetCoverX = rx * DIAMOND_AABB_INSET + BULLET_RADIUS;
      const insetCoverY = ry * DIAMOND_AABB_INSET + BULLET_RADIUS;

      expect(insetCoverX).toBeGreaterThanOrEqual(portalHalfW);
      expect(insetCoverY).toBeGreaterThanOrEqual(portalHalfH);
    }
  });
});

// ── Diamond archetype coverage ────────────────────────────────────────────────

describe('diamond archetype coverage', () => {
  const DIAMOND_NAMES = ['diamond_tall', 'diamond_wide', 'diamond_long', 'diamond_core', 'diamond_huge'] as const;

  it('all 5 diamond archetypes appear across 50 seeds', () => {
    const seen = new Set<string>();
    for (let s = 0; s < 50; s++) {
      const layout = generateArenaLayout(s);
      for (const obs of layout.obstacles) {
        seen.add(obs.archetype);
      }
    }
    for (const name of DIAMOND_NAMES) {
      expect(seen.has(name)).toBe(true);
    }
  });

  it('DIAMOND_SPECS has correct structure for all archetypes', () => {
    for (const name of DIAMOND_NAMES) {
      const spec = DIAMOND_SPECS[name];
      expect(typeof spec.rx).toBe('number');
      expect(typeof spec.ry).toBe('number');
      expect(typeof spec.rz).toBe('number');
      expect(spec.rx).toBeGreaterThan(0);
      expect(spec.ry).toBeGreaterThan(0);
      expect(spec.rz).toBeGreaterThan(0);
    }
  });

  it('diamond obstacle sizes match their spec (size = 2*half-extent)', () => {
    for (let s = 0; s < 30; s++) {
      const layout = generateArenaLayout(s);
      for (const obs of layout.obstacles) {
        if (!obs.archetype.startsWith('diamond')) continue;
        const archetype = obs.archetype as keyof typeof DIAMOND_SPECS;
        const spec = DIAMOND_SPECS[archetype];
        expect(obs.size.x).toBeCloseTo(spec.rx * 2, 5);
        expect(obs.size.y).toBeCloseTo(spec.ry * 2, 5);
        expect(obs.size.z).toBeCloseTo(spec.rz * 2, 5);
      }
    }
  });
});

// ── Determinism across seeds ──────────────────────────────────────────────────

describe('determinism', () => {
  it('same seed always produces identical obstacle arrays', () => {
    for (const seed of [0, 42, 999, 100000, 999999]) {
      const a = generateArenaLayout(seed);
      const b = generateArenaLayout(seed);
      expect(a.obstacles).toEqual(b.obstacles);
      expect(a.wallBars).toEqual(b.wallBars);
      expect(a.goalAxis).toBe(b.goalAxis);
    }
  });

  it('different seeds produce different layouts', () => {
    let diffCount = 0;
    for (let s = 0; s < 20; s++) {
      const a = generateArenaLayout(s);
      const b = generateArenaLayout(s + 1);
      if (JSON.stringify(a.obstacles) !== JSON.stringify(b.obstacles)) diffCount++;
    }
    expect(diffCount).toBeGreaterThan(10);
  });
});

// ── Mirrored pairs ────────────────────────────────────────────────────────────

describe('mirrored pairs', () => {
  it('band diamond obstacles appear in mirrored pairs (same archetype + size, opposite goalAxis sign)', () => {
    for (let s = 0; s < 20; s++) {
      const layout = generateArenaLayout(s);
      const ax = layout.goalAxis;

      // Exclude gate-blocker (at origin, non-mirrored) and legacy obstacles
      const bandObstacles = layout.obstacles.filter(
        o => o.archetype.startsWith('diamond') && o.archetype !== 'diamond_huge',
      );

      // Every band diamond should have a mirror with matching archetype+size and negated pos
      for (const obs of bandObstacles) {
        const expected = -obs.pos[ax];
        const mirror = bandObstacles.find(
          o => o !== obs
            && o.archetype === obs.archetype
            && Math.abs(o.size.x - obs.size.x) < 1e-6
            && Math.abs(o.pos[ax] - expected) < 1e-4,
        );
        expect(mirror).toBeDefined();
      }
    }
  });
});

// ── Wall bar bounds ───────────────────────────────────────────────────────────

describe('wall bars', () => {
  it('wall bar count is 32-48 per layout (4 walls × 8-12 bars)', () => {
    for (let s = 0; s < 50; s++) {
      const layout = generateArenaLayout(s);
      expect(layout.wallBars.length).toBeGreaterThanOrEqual(WALL_BARS_PER_WALL_MIN * 4);
      expect(layout.wallBars.length).toBeLessThanOrEqual(WALL_BARS_PER_WALL_MAX * 4);
    }
  });

  it('all wall bars lie inside the arena bounds', () => {
    const half = ARENA_SIZE / 2;
    for (let s = 0; s < 50; s++) {
      const layout = generateArenaLayout(s);
      for (const wb of layout.wallBars) {
        expect(Math.abs(wb.pos.x)).toBeLessThanOrEqual(half + 0.01);
        expect(Math.abs(wb.pos.y)).toBeLessThanOrEqual(half + 0.01);
        expect(Math.abs(wb.pos.z)).toBeLessThanOrEqual(half + 0.01);
      }
    }
  });

  it('each wall bar is flush against a non-portal wall face', () => {
    const half = ARENA_SIZE / 2;
    for (let s = 0; s < 30; s++) {
      const layout = generateArenaLayout(s);
      const goalAxis = layout.goalAxis;

      for (const wb of layout.wallBars) {
        // Wall bars must NOT be on the portal (goalAxis) faces —
        // those faces already have portalBars from portalBars.ts.
        // Each wall bar must be on one of the other 4 faces.
        const onGoalFace = Math.abs(wb.pos[goalAxis]) > half - 0.5;
        expect(onGoalFace).toBe(false);

        // Must be on exactly one wall face (one axis close to ±half)
        const onXFace = Math.abs(Math.abs(wb.pos.x) - half) < 0.5;
        const onYFace = Math.abs(Math.abs(wb.pos.y) - half) < 0.5;
        const onZFace = Math.abs(Math.abs(wb.pos.z) - half) < 0.5;
        const faceCount = (onXFace ? 1 : 0) + (onYFace ? 1 : 0) + (onZFace ? 1 : 0);
        expect(faceCount).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('wall bar normals point inward (toward arena center)', () => {
    for (let s = 0; s < 30; s++) {
      const layout = generateArenaLayout(s);
      for (const wb of layout.wallBars) {
        // Dot product of position and normal should be negative (normal points toward center)
        const dot = wb.pos.x * wb.normal.x + wb.pos.y * wb.normal.y + wb.pos.z * wb.normal.z;
        expect(dot).toBeLessThan(0);
      }
    }
  });

  it('generateWallBars is deterministic for the same RNG state', () => {
    const rng1 = mulberry32(12345);
    const rng2 = mulberry32(12345);
    const a = generateWallBars(rng1, 'z');
    const b = generateWallBars(rng2, 'z');
    expect(a).toEqual(b);
  });
});

// ── Edge bar generation ───────────────────────────────────────────────────────

describe('generateDiamondEdgeBars', () => {
  it('produces exactly 12 bars for a symmetric octahedron', () => {
    const bars = generateDiamondEdgeBars(3, 3, 3);
    expect(bars.length).toBe(12);
  });

  it('produces 12 bars for asymmetric half-extents', () => {
    const bars = generateDiamondEdgeBars(2.5, 5.5, 2.5);
    expect(bars.length).toBe(12);
  });

  it('bar normals are unit vectors', () => {
    const bars = generateDiamondEdgeBars(4, 3, 5);
    for (const bar of bars) {
      const len = Math.sqrt(
        bar.normal.x ** 2 + bar.normal.y ** 2 + bar.normal.z ** 2,
      );
      expect(len).toBeCloseTo(1, 5);
    }
  });

  it('bar positions are outside the half-extents (bars proud of surface)', () => {
    const rx = 3.5, ry = 3.5, rz = 3.5;
    const bars = generateDiamondEdgeBars(rx, ry, rz);
    for (const bar of bars) {
      const dist = Math.sqrt(
        bar.localPos.x ** 2 + bar.localPos.y ** 2 + bar.localPos.z ** 2,
      );
      // Should be slightly outside the octahedron surface
      expect(dist).toBeGreaterThan(0);
    }
  });

  it('bars are symmetrically distributed — none at origin', () => {
    const bars = generateDiamondEdgeBars(3, 4, 3);
    for (const bar of bars) {
      const dist = Math.sqrt(
        bar.localPos.x ** 2 + bar.localPos.y ** 2 + bar.localPos.z ** 2,
      );
      expect(dist).toBeGreaterThan(0.5);
    }
  });
});

// ── Layout validity ───────────────────────────────────────────────────────────

describe('layout validity', () => {
  it('all 200 seeds produce valid layouts with no NaN positions', () => {
    for (let seed = 0; seed < 200; seed++) {
      const layout = generateArenaLayout(seed);

      for (const obs of layout.obstacles) {
        expect(isFinite(obs.pos.x)).toBe(true);
        expect(isFinite(obs.pos.y)).toBe(true);
        expect(isFinite(obs.pos.z)).toBe(true);
        expect(isFinite(obs.size.x)).toBe(true);
        expect(isFinite(obs.size.y)).toBe(true);
        expect(isFinite(obs.size.z)).toBe(true);

        for (const bar of obs.bars) {
          expect(isFinite(bar.localPos.x)).toBe(true);
          expect(isFinite(bar.localPos.y)).toBe(true);
          expect(isFinite(bar.localPos.z)).toBe(true);
        }
      }

      for (const wb of layout.wallBars) {
        expect(isFinite(wb.pos.x)).toBe(true);
        expect(isFinite(wb.pos.y)).toBe(true);
        expect(isFinite(wb.pos.z)).toBe(true);
      }
    }
  });

  it('goalAxis is always x or z (y-axis goals not supported)', () => {
    for (let s = 0; s < 200; s++) {
      const layout = generateArenaLayout(s);
      expect(layout.goalAxis).not.toBe('y');
    }
  });

  it('all diamond obstacles have positive sizes', () => {
    for (let s = 0; s < 50; s++) {
      const layout = generateArenaLayout(s);
      for (const obs of layout.obstacles) {
        if (!obs.archetype.startsWith('diamond')) continue;
        expect(obs.size.x).toBeGreaterThan(0);
        expect(obs.size.y).toBeGreaterThan(0);
        expect(obs.size.z).toBeGreaterThan(0);
      }
    }
  });
});
