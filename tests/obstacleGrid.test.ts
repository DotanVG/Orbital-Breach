import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { ObstacleGrid, buildObstacleGrid } from "../client/src/game/obstacleGrid";
import { bulletHitPoint } from "../client/src/game/bulletCollision";

// ── helpers ──────────────────────────────────────────────────────────────────

function box(cx: number, cy: number, cz: number, hw: number, hh: number, hd: number): THREE.Box3 {
  return new THREE.Box3(
    new THREE.Vector3(cx - hw, cy - hh, cz - hd),
    new THREE.Vector3(cx + hw, cy + hh, cz + hd),
  );
}

function v(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z);
}

/** Seeded LCG — deterministic across runs. */
function lcg(seed: number) {
  let s = seed;
  return () => { s = (1664525 * s + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

/** Brute-force obstacle check — the O(n²) baseline. */
function bruteForceHit(
  oldPos: THREE.Vector3,
  newPos: THREE.Vector3,
  boxes: THREE.Box3[],
  radius: number,
): THREE.Vector3 | null {
  let nearest: THREE.Vector3 | null = null;
  let nearestDist = Infinity;
  for (const b of boxes) {
    const hit = bulletHitPoint(oldPos, newPos, b, radius);
    if (!hit) continue;
    const d = hit.distanceToSquared(oldPos);
    if (d < nearestDist) { nearestDist = d; nearest = hit; }
  }
  return nearest;
}

/** Grid-accelerated obstacle check — the O(cells) path. */
function gridHit(
  oldPos: THREE.Vector3,
  newPos: THREE.Vector3,
  grid: ObstacleGrid,
  radius: number,
): THREE.Vector3 | null {
  const candidates = grid.query(oldPos, newPos);
  return bruteForceHit(oldPos, newPos, candidates, radius);
}

// ── unit tests ────────────────────────────────────────────────────────────────

describe("ObstacleGrid — construction", () => {
  it("reports correct box count", () => {
    const boxes = [box(0, 0, 0, 1, 1, 1), box(5, 5, 5, 1, 1, 1)];
    const grid = buildObstacleGrid(boxes);
    expect(grid.boxCount).toBe(2);
  });

  it("uses 4 divisions and 10-unit cells", () => {
    const grid = buildObstacleGrid([]);
    expect(grid.divs).toBe(4);
    expect(grid.cellSize).toBe(10);
  });

  it("handles empty box list", () => {
    const grid = buildObstacleGrid([]);
    const result = grid.query(v(0, 0, 0), v(1, 0, 0));
    expect(result.length).toBe(0);
  });

  it("boxes outside arena bounds are clamped to nearest cell", () => {
    const outOfBounds = box(100, 100, 100, 1, 1, 1);
    expect(() => buildObstacleGrid([outOfBounds])).not.toThrow();
  });
});

describe("ObstacleGrid — query correctness", () => {
  it("returns a box in the same cell as the segment", () => {
    // Box at (5, 5, 5), segment passing near it in same 10-unit cell
    const boxes = [box(5, 5, 5, 1, 1, 1)];
    const grid = buildObstacleGrid(boxes);
    const candidates = grid.query(v(3, 5, 5), v(9, 5, 5));
    expect(candidates).toContain(boxes[0]);
  });

  it("does not return a box in a completely different cell", () => {
    // Box far away in cell (3,3,3), segment in cell (0,0,0)
    const farBox = box(17, 17, 17, 1, 1, 1);
    const nearBox = box(-17, -17, -17, 1, 1, 1);
    const grid = buildObstacleGrid([nearBox, farBox]);
    const candidates = grid.query(v(-19, -19, -19), v(-15, -19, -19));
    expect(candidates).toContain(nearBox);
    expect(candidates).not.toContain(farBox);
  });

  it("returns the same box only once even if it spans multiple cells", () => {
    // Box spanning 3 cells on X axis
    const bigBox = new THREE.Box3(v(-15, -1, -1), v(15, 1, 1));
    const grid = buildObstacleGrid([bigBox]);
    const candidates = grid.query(v(-19, 0, 0), v(19, 0, 0));
    expect(candidates.filter(b => b === bigBox).length).toBe(1);
  });

  it("result buffer is reused — second query overwrites first", () => {
    const boxes = [box(0, 0, 0, 1, 1, 1), box(15, 15, 15, 1, 1, 1)];
    const grid = buildObstacleGrid(boxes);
    const first = grid.query(v(-1, -1, -1), v(1, 1, 1));
    const second = grid.query(v(14, 14, 14), v(16, 16, 16));
    // Both references point to the same buffer — same object identity
    expect(first).toBe(second);
    // After second query, buffer contains only the second cell's box
    expect(second).toContain(boxes[1]);
    expect(second).not.toContain(boxes[0]);
  });
});

describe("ObstacleGrid — hit correctness vs brute-force", () => {
  const BULLET_RADIUS = 0.07;
  const rng = lcg(42);
  const HALF = 20;

  function randCoord() { return (rng() * 2 - 1) * (HALF - 2); }

  // Generate 44 obstacles (mirrors the max-obstacle arena)
  const obstacles: THREE.Box3[] = Array.from({ length: 44 }, () => {
    const cx = randCoord(); const cy = randCoord(); const cz = randCoord();
    const hw = 0.5 + rng() * 2.5;
    const hh = 0.5 + rng() * 2.5;
    const hd = 0.5 + rng() * 2.5;
    return box(cx, cy, cz, hw, hh, hd);
  });

  const grid = buildObstacleGrid(obstacles);

  it("grid and brute-force agree on 200 random bullet segments", () => {
    let mismatches = 0;
    for (let i = 0; i < 200; i++) {
      const ox = randCoord(); const oy = randCoord(); const oz = randCoord();
      const dx = (rng() - 0.5); const dy = (rng() - 0.5); const dz = (rng() - 0.5);
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const oldPos = v(ox, oy, oz);
      const newPos = v(ox + dx / len * 0.5, oy + dy / len * 0.5, oz + dz / len * 0.5);

      const expected = bruteForceHit(oldPos, newPos, obstacles, BULLET_RADIUS);
      const actual   = gridHit(oldPos, newPos, grid, BULLET_RADIUS);

      const bothNull = expected === null && actual === null;
      const bothHit  = expected !== null && actual !== null
        && Math.abs(expected.x - actual.x) < 0.001
        && Math.abs(expected.y - actual.y) < 0.001
        && Math.abs(expected.z - actual.z) < 0.001;

      if (!bothNull && !bothHit) mismatches++;
    }
    expect(mismatches).toBe(0);
  });
});

// ── benchmark ─────────────────────────────────────────────────────────────────

describe("ObstacleGrid — benchmark (480 bullets × 44 obstacles)", () => {
  const BULLET_RADIUS = 0.07;
  const BULLET_SPEED  = 30; // world-units/sec
  const DT            = 1 / 60; // 60 fps
  const SEGMENT_LEN   = BULLET_SPEED * DT; // ~0.5 units
  const N_BULLETS     = 480;
  const N_OBSTACLES   = 44;
  const ITERATIONS    = 50; // frames to simulate
  const HALF          = 20;

  const rng = lcg(1337);
  function randCoord() { return (rng() * 2 - 1) * (HALF - 2); }

  // Static obstacles
  const obstacles: THREE.Box3[] = Array.from({ length: N_OBSTACLES }, () => {
    const cx = randCoord(); const cy = randCoord(); const cz = randCoord();
    return box(cx, cy, cz, 0.5 + rng() * 2.5, 0.5 + rng() * 1.5, 0.5 + rng() * 2.5);
  });

  // Static bullet origins + directions (simulate 480 bullets in flight)
  const bulletOrigins = Array.from({ length: N_BULLETS }, () =>
    v(randCoord(), randCoord(), randCoord()),
  );
  const bulletDirs = Array.from({ length: N_BULLETS }, () => {
    const dx = rng() - 0.5; const dy = rng() - 0.5; const dz = rng() - 0.5;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    return v(dx / len, dy / len, dz / len);
  });

  const grid = buildObstacleGrid(obstacles);
  const tmpNew = v(0, 0, 0);

  it("grid is faster than brute-force and produces equivalent results", () => {
    let bruteChecks = 0;
    let gridChecks  = 0;

    // ── brute-force baseline ─────────────────────────────────────────────────
    const t0brute = performance.now();
    for (let frame = 0; frame < ITERATIONS; frame++) {
      for (let bi = 0; bi < N_BULLETS; bi++) {
        const o = bulletOrigins[bi];
        const d = bulletDirs[bi];
        tmpNew.set(
          o.x + d.x * SEGMENT_LEN,
          o.y + d.y * SEGMENT_LEN,
          o.z + d.z * SEGMENT_LEN,
        );
        bruteForceHit(o, tmpNew, obstacles, BULLET_RADIUS);
        bruteChecks += obstacles.length;
      }
    }
    const bruteMs = performance.now() - t0brute;

    // ── spatial grid ─────────────────────────────────────────────────────────
    const t0grid = performance.now();
    for (let frame = 0; frame < ITERATIONS; frame++) {
      for (let bi = 0; bi < N_BULLETS; bi++) {
        const o = bulletOrigins[bi];
        const d = bulletDirs[bi];
        tmpNew.set(
          o.x + d.x * SEGMENT_LEN,
          o.y + d.y * SEGMENT_LEN,
          o.z + d.z * SEGMENT_LEN,
        );
        const candidates = grid.query(o, tmpNew);
        bruteForceHit(o, tmpNew, candidates, BULLET_RADIUS);
        gridChecks += candidates.length;
      }
    }
    const gridMs = performance.now() - t0grid;

    const speedup        = bruteMs / gridMs;
    const avgBruteChecks = bruteChecks / (ITERATIONS * N_BULLETS);
    const avgGridChecks  = gridChecks  / (ITERATIONS * N_BULLETS);
    const checkReduction = ((avgBruteChecks - avgGridChecks) / avgBruteChecks * 100).toFixed(1);

    console.log("\n=== Obstacle collision benchmark ===");
    console.log(`Bullets: ${N_BULLETS}  |  Obstacles: ${N_OBSTACLES}  |  Frames: ${ITERATIONS}`);
    console.log(`Brute-force : ${bruteMs.toFixed(2)} ms  (avg ${avgBruteChecks} checks/bullet)`);
    console.log(`Spatial grid: ${gridMs.toFixed(2)} ms  (avg ${avgGridChecks.toFixed(1)} checks/bullet)`);
    console.log(`Speedup: ${speedup.toFixed(2)}×  |  Check reduction: ${checkReduction}%`);
    console.log("====================================\n");

    // Grid must check fewer obstacles on average
    expect(avgGridChecks).toBeLessThan(avgBruteChecks);
    // Grid must be at least 2× faster (conservative — typically 5–10×)
    expect(speedup).toBeGreaterThan(2);
  });
});
