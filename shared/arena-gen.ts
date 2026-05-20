import {
  ARENA_SIZE,
} from './constants';
import type { ObstacleNetDef, BarDef, WallBarDef, DiamondArchetype } from './schema';

export interface GeneratedLayout {
  obstacles: ObstacleNetDef[];
  goalAxis: 'x' | 'y' | 'z';
  goalSigns: { team0: 1 | -1; team1: 1 | -1 };
  seed: number;
  wallBars: WallBarDef[];
}

// ── Mulberry32 RNG ────────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function randSign(rng: () => number): 1 | -1 {
  return rng() < 0.5 ? 1 : -1;
}

// ── Diamond archetypes: [rx, ry, rz] half-extents ────────────────────────────
// size stored in ObstacleNetDef = [2*rx, 2*ry, 2*rz] (full bounding box).

export interface DiamondSpec {
  rx: number; ry: number; rz: number;
}

export const DIAMOND_SPECS: Record<DiamondArchetype, DiamondSpec> = {
  diamond_tall:  { rx: 2.5,  ry: 5.5,  rz: 2.5  },  // 5×11×5 AABB
  diamond_wide:  { rx: 5.5,  ry: 2.0,  rz: 5.5  },  // 11×4×11 AABB
  diamond_long:  { rx: 2.5,  ry: 3.0,  rz: 6.0  },  // 5×6×12 AABB
  diamond_core:  { rx: 3.5,  ry: 3.5,  rz: 3.5  },  // 7×7×7 AABB
  diamond_huge:  { rx: 7.0,  ry: 5.0,  rz: 7.0  },  // 14×10×14 AABB — gate-blocker only
};

const BAND_DIAMOND_ARCHETYPES: readonly DiamondArchetype[] = [
  'diamond_tall', 'diamond_wide', 'diamond_long', 'diamond_core',
] as const;

// ── Octahedron edge bars ──────────────────────────────────────────────────────
// Unit octahedron vertices (scaled by rx, ry, rz in generation):
// Top=(0,1,0), Bot=(0,-1,0), +X=(1,0,0), -X=(-1,0,0), +Z=(0,0,1), -Z=(0,0,-1)
// 12 edges connect: Top/Bot to each of ±X, ±Z; and ±X to ±Z (equatorial).

const OCT_VERTICES = [
  [  0,  1,  0 ],  // 0 top
  [  0, -1,  0 ],  // 1 bot
  [  1,  0,  0 ],  // 2 +x
  [ -1,  0,  0 ],  // 3 -x
  [  0,  0,  1 ],  // 4 +z
  [  0,  0, -1 ],  // 5 -z
] as const;

const OCT_EDGES = [
  [0, 2], [0, 3], [0, 4], [0, 5],   // top to equatorial
  [1, 2], [1, 3], [1, 4], [1, 5],   // bot to equatorial
  [2, 4], [2, 5], [3, 4], [3, 5],   // equatorial ring
] as const;

/**
 * Generate grab bars at each of the 12 octahedron edge midpoints, scaled to
 * the given diamond half-extents. Bars are always in local space (relative to
 * obstacle center). goalAxis bar normals are flipped for mirrored obstacles.
 */
export function generateDiamondEdgeBars(rx: number, ry: number, rz: number): BarDef[] {
  const bars: BarDef[] = [];

  for (const [a, b] of OCT_EDGES) {
    const va = OCT_VERTICES[a];
    const vb = OCT_VERTICES[b];

    // Midpoint of the edge in scaled space
    const mx = ((va[0] + vb[0]) / 2) * rx;
    const my = ((va[1] + vb[1]) / 2) * ry;
    const mz = ((va[2] + vb[2]) / 2) * rz;

    // Outward normal: normalized midpoint direction
    const len = Math.sqrt(mx * mx + my * my + mz * mz);
    if (len < 1e-6) continue;
    const nx = mx / len;
    const ny = my / len;
    const nz = mz / len;

    // Bar center sits slightly proud of the surface
    const SURFACE_OFFSET = 0.18;
    bars.push({
      localPos: { x: mx + nx * SURFACE_OFFSET, y: my + ny * SURFACE_OFFSET, z: mz + nz * SURFACE_OFFSET },
      normal:   { x: nx, y: ny, z: nz },
    });
  }

  return bars;
}

function mirrorDiamondBars(bars: BarDef[], goalAxis: 'x' | 'y' | 'z'): BarDef[] {
  return bars.map(b => ({
    localPos: {
      x: goalAxis === 'x' ? -b.localPos.x : b.localPos.x,
      y: goalAxis === 'y' ? -b.localPos.y : b.localPos.y,
      z: goalAxis === 'z' ? -b.localPos.z : b.localPos.z,
    },
    normal: {
      x: goalAxis === 'x' ? -b.normal.x : b.normal.x,
      y: goalAxis === 'y' ? -b.normal.y : b.normal.y,
      z: goalAxis === 'z' ? -b.normal.z : b.normal.z,
    },
  }));
}

// ── Gate-blocker (guaranteed center obstacle) ─────────────────────────────────
// Must block ALL direct portal-to-portal bullet paths.
// Portal opening is BREACH_ROOM_W × BREACH_ROOM_H centered at (0, 0, ±ARENA_SIZE/2).
// A direct shot travels along goalAxis at any (perpX, y) within the portal.
// Bullet AABB inset = 0.65. For the gate-blocker AABB to block all such shots:
//   rx_gate * 0.65 + BULLET_RADIUS ≥ BREACH_ROOM_W/2
//   ry_gate * 0.65 + BULLET_RADIUS ≥ BREACH_ROOM_H/2
// With BULLET_RADIUS=0.07, BREACH_ROOM_W=8, BREACH_ROOM_H=6:
//   rx_gate ≥ (4 - 0.07) / 0.65 ≈ 6.05  →  using 7.0
//   ry_gate ≥ (3 - 0.07) / 0.65 ≈ 4.51  →  using 5.0

function makeGateBlocker(): ObstacleNetDef {
  const { rx, ry, rz } = DIAMOND_SPECS['diamond_huge'];
  return {
    pos:       { x: 0, y: 0, z: 0 },
    size:      { x: rx * 2, y: ry * 2, z: rz * 2 },
    archetype: 'diamond_huge',
    bars:      generateDiamondEdgeBars(rx, ry, rz),
  };
}

// ── Diamond pair generation ───────────────────────────────────────────────────

function makeDiamondPair(
  rng: () => number,
  archetype: DiamondArchetype,
  goalAxis: 'x' | 'y' | 'z',
  goalOff: number,           // signed offset on goalAxis
): [ObstacleNetDef, ObstacleNetDef] {
  const { rx, ry, rz } = DIAMOND_SPECS[archetype];
  const perpAxis = goalAxis === 'z' ? 'x' : 'z';

  const maxPerpPos = ARENA_SIZE / 2 - Math.max(rx, rz) - 0.5;
  const maxYPos    = ARENA_SIZE / 2 - ry - 0.5;

  const perpOff = randRange(rng, -maxPerpPos, maxPerpPos);
  const yOff    = randRange(rng, -maxYPos,    maxYPos);

  const pos: Record<string, number> = { x: 0, y: 0, z: 0 };
  pos[goalAxis] = goalOff;
  pos[perpAxis] = perpOff;
  pos['y']      = yOff;

  const bars = generateDiamondEdgeBars(rx, ry, rz);

  const obsA: ObstacleNetDef = {
    pos:       { x: pos.x, y: pos.y, z: pos.z },
    size:      { x: rx * 2, y: ry * 2, z: rz * 2 },
    archetype,
    bars,
  };

  const mirrorPosRecord: Record<string, number> = { ...pos };
  mirrorPosRecord[goalAxis] = -goalOff;

  const obsB: ObstacleNetDef = {
    pos:       { x: mirrorPosRecord.x, y: mirrorPosRecord.y, z: mirrorPosRecord.z },
    size:      { x: rx * 2, y: ry * 2, z: rz * 2 },
    archetype,
    bars:      mirrorDiamondBars(bars, goalAxis),
  };

  return [obsA, obsB];
}

// ── Wall bar generation ───────────────────────────────────────────────────────
// 4 non-portal walls get a deterministic 3×3 grid of 9 bars each (36 total).
// Positions at 1/4, 1/2, 3/4 of arena size on each free axis.

function generateWallBarsForFace(
  wallAxis: 'x' | 'y' | 'z',
  wallSign: 1 | -1,
): WallBarDef[] {
  const half = ARENA_SIZE / 2;
  const bars: WallBarDef[] = [];

  const freeAxes = (['x', 'y', 'z'] as const).filter(a => a !== wallAxis);
  const gridPositions = [-half / 2, 0, half / 2];  // -10, 0, +10

  for (const u of gridPositions) {
    for (const v of gridPositions) {
      const pos: Record<string, number> = { x: 0, y: 0, z: 0 };
      pos[wallAxis] = wallSign * (half - 0.12);
      pos[freeAxes[0]] = u;
      pos[freeAxes[1]] = v;

      const normal: Record<string, number> = { x: 0, y: 0, z: 0 };
      normal[wallAxis] = -wallSign;

      bars.push({
        pos:    { x: pos.x, y: pos.y, z: pos.z },
        normal: { x: normal.x, y: normal.y, z: normal.z },
      });
    }
  }

  return bars;
}

export function generateWallBars(
  _rng: () => number,
  goalAxis: 'x' | 'y' | 'z',
): WallBarDef[] {
  // The portal (goal) axis walls already have bars from portalBars.ts.
  // Generate 3×3 grid wall bars for the remaining 4 faces (9 bars × 4 walls = 36).
  const nonPortalAxes = (['x', 'y', 'z'] as const).filter(a => a !== goalAxis);
  const allBars: WallBarDef[] = [];

  for (const wallAxis of nonPortalAxes) {
    for (const wallSign of [1, -1] as const) {
      allBars.push(...generateWallBarsForFace(wallAxis, wallSign));
    }
  }

  return allBars;
}

// ── Main generator ─────────────────────────────────────────────────────────────

/**
 * Procedurally generate a full arena layout — diamonds only, no legacy shapes.
 *
 * Layout bands (on goalAxis):
 *   1. Gate-blocker   — diamond_huge at (0,0,0), always present, blocks corridor.
 *   2. Mid bands      — 2–3 mirrored diamond pairs at |goalAxis| ∈ [4, 11].
 *   3. Outer bands    — 2–3 mirrored diamond pairs at |goalAxis| ∈ [11, 18].
 *   4. Edge flanks    — 2–3 pairs forced to outer perpAxis zone (walls/corners).
 *   5. Corner pairs   — 1–2 pairs near both outer perpAxis AND outer goalAxis.
 *
 * Wall bars: 8–12 grab bars on each of the 4 non-portal arena walls.
 */
export function generateArenaLayout(seed = Date.now()): GeneratedLayout {
  const rng      = mulberry32(seed);
  const goalAxis = pick(rng, ['x', 'z'] as const);
  const perpAxis = goalAxis === 'z' ? 'x' : 'z';

  const obstacles: ObstacleNetDef[] = [];

  // 1. Gate-blocker — always at center, always diamond_huge.
  obstacles.push(makeGateBlocker());

  // 2. Mid-band mirrored pairs (|goalAxis| ∈ [4, 11]).
  const midPairCount = 2 + Math.floor(rng() * 2); // 2 or 3
  for (let i = 0; i < midPairCount; i++) {
    const archetype = pick(rng, BAND_DIAMOND_ARCHETYPES);
    const { rx, ry, rz } = DIAMOND_SPECS[archetype];
    const goalHalfExtent = goalAxis === 'z' ? rz : rx;
    const maxGoalPos = Math.min(11, ARENA_SIZE / 2 - goalHalfExtent - 2);
    const goalOff    = randSign(rng) * randRange(rng, 4, maxGoalPos);
    obstacles.push(...makeDiamondPair(rng, archetype, goalAxis, goalOff));
  }

  // 3. Outer-band mirrored pairs (|goalAxis| ∈ [11, 18]).
  const outerPairCount = 2 + Math.floor(rng() * 2); // 2 or 3
  for (let i = 0; i < outerPairCount; i++) {
    const archetype = pick(rng, BAND_DIAMOND_ARCHETYPES);
    const { rx, ry, rz } = DIAMOND_SPECS[archetype];
    const goalHalfExtent = goalAxis === 'z' ? rz : rx;
    const maxGoalPos = Math.min(18, ARENA_SIZE / 2 - goalHalfExtent - 2);
    const minGoalPos = Math.min(11, maxGoalPos);
    if (minGoalPos >= maxGoalPos) continue;
    const goalOff = randSign(rng) * randRange(rng, minGoalPos, maxGoalPos);
    obstacles.push(...makeDiamondPair(rng, archetype, goalAxis, goalOff));
  }

  // 4. Edge flanks — perpAxis forced into outer 50% zone so diamonds hug side walls.
  const edgeFlankCount = 2 + Math.floor(rng() * 2); // 2 or 3
  for (let i = 0; i < edgeFlankCount; i++) {
    const archetype = pick(rng, BAND_DIAMOND_ARCHETYPES);
    const { rx, ry, rz } = DIAMOND_SPECS[archetype];
    const perpHalfExtent = goalAxis === 'z' ? rx : rz;
    const fullPerpMax = ARENA_SIZE / 2 - perpHalfExtent - 0.5;
    const edgePerpMin = fullPerpMax * 0.5;   // outer 50% of the perpAxis range
    const perpOff     = randSign(rng) * randRange(rng, edgePerpMin, fullPerpMax);
    const goalHalfExtent = goalAxis === 'z' ? rz : rx;
    const maxGoalPos  = ARENA_SIZE / 2 - goalHalfExtent - 2;
    const goalOff     = randSign(rng) * randRange(rng, 0, maxGoalPos);

    // Build the pair manually to use forced perpOff
    const yMax = ARENA_SIZE / 2 - ry - 0.5;
    const yOff = randRange(rng, -yMax, yMax);

    const posA: Record<string, number> = { x: 0, y: yOff, z: 0 };
    posA[goalAxis] = goalOff;
    posA[perpAxis] = perpOff;

    const bars = generateDiamondEdgeBars(rx, ry, rz);

    obstacles.push(
      { pos: { x: posA.x, y: posA.y, z: posA.z }, size: { x: rx * 2, y: ry * 2, z: rz * 2 }, archetype, bars },
      {
        pos: { x: goalAxis === 'x' ? -goalOff : posA.x, y: yOff, z: goalAxis === 'z' ? -goalOff : posA.z },
        size: { x: rx * 2, y: ry * 2, z: rz * 2 },
        archetype,
        bars: mirrorDiamondBars(bars, goalAxis),
      },
    );
  }

  // 5. Corner pairs — high on BOTH perpAxis and outer goalAxis zone.
  const cornerCount = 1 + Math.floor(rng() * 2); // 1 or 2
  for (let i = 0; i < cornerCount; i++) {
    const archetype = pick(rng, BAND_DIAMOND_ARCHETYPES);
    const { rx, ry, rz } = DIAMOND_SPECS[archetype];
    const perpHalfExtent = goalAxis === 'z' ? rx : rz;
    const fullPerpMax    = ARENA_SIZE / 2 - perpHalfExtent - 0.5;
    const perpOff        = randSign(rng) * randRange(rng, fullPerpMax * 0.65, fullPerpMax);
    const goalHalfExtent = goalAxis === 'z' ? rz : rx;
    const maxGoalPos     = Math.min(16, ARENA_SIZE / 2 - goalHalfExtent - 2);
    const minGoalPos     = Math.min(8, maxGoalPos);
    if (minGoalPos >= maxGoalPos) continue;
    const goalOff = randSign(rng) * randRange(rng, minGoalPos, maxGoalPos);

    const yMax = ARENA_SIZE / 2 - ry - 0.5;
    const yOff = randRange(rng, -yMax, yMax);

    const posA: Record<string, number> = { x: 0, y: yOff, z: 0 };
    posA[goalAxis] = goalOff;
    posA[perpAxis] = perpOff;

    const bars = generateDiamondEdgeBars(rx, ry, rz);

    obstacles.push(
      { pos: { x: posA.x, y: posA.y, z: posA.z }, size: { x: rx * 2, y: ry * 2, z: rz * 2 }, archetype, bars },
      {
        pos: { x: goalAxis === 'x' ? -goalOff : posA.x, y: yOff, z: goalAxis === 'z' ? -goalOff : posA.z },
        size: { x: rx * 2, y: ry * 2, z: rz * 2 },
        archetype,
        bars: mirrorDiamondBars(bars, goalAxis),
      },
    );
  }

  // 6. Wall bars on 4 non-portal faces.
  const wallBars = generateWallBars(rng, goalAxis);

  return {
    obstacles,
    goalAxis,
    goalSigns: { team0: -1, team1: 1 },
    seed,
    wallBars,
  };
}
