import * as THREE from "three";
import { ARENA_SIZE } from "../../../shared/constants";

const GRID_DIVS = 4;                          // 4×4×4 = 64 cells
const CELL_SIZE = ARENA_SIZE / GRID_DIVS;     // 10 world-units per cell
const ARENA_HALF = ARENA_SIZE / 2;            // 20

/**
 * Uniform 3-D grid over the arena that maps obstacle boxes to the cells
 * they overlap. Used by ProjectileSystem to cull the obstacle list for
 * each bullet segment check — expected ~10× fewer AABB tests vs brute-force.
 *
 * query() is allocation-free: results are written into a reused internal
 * buffer. Callers must consume the result immediately; the buffer is
 * overwritten on the next query().
 *
 * Build once per round (obstacles are static). Discard on round reset.
 */
export class ObstacleGrid {
  private readonly cells: number[][];    // cellIndex → [boxIndex, ...]
  private readonly boxes: THREE.Box3[];
  private readonly boxGen: Int32Array;   // per-box: query-gen when last emitted
  private queryGen = 0;
  private readonly resultBuf: THREE.Box3[] = [];

  public constructor(boxes: THREE.Box3[]) {
    this.boxes = boxes;
    this.boxGen = new Int32Array(boxes.length);

    const totalCells = GRID_DIVS * GRID_DIVS * GRID_DIVS;
    this.cells = Array.from({ length: totalCells }, () => []);

    for (let bi = 0; bi < boxes.length; bi++) {
      const box = boxes[bi];
      const minCx = clamp(Math.floor((box.min.x + ARENA_HALF) / CELL_SIZE), 0, GRID_DIVS - 1);
      const minCy = clamp(Math.floor((box.min.y + ARENA_HALF) / CELL_SIZE), 0, GRID_DIVS - 1);
      const minCz = clamp(Math.floor((box.min.z + ARENA_HALF) / CELL_SIZE), 0, GRID_DIVS - 1);
      const maxCx = clamp(Math.floor((box.max.x + ARENA_HALF) / CELL_SIZE), 0, GRID_DIVS - 1);
      const maxCy = clamp(Math.floor((box.max.y + ARENA_HALF) / CELL_SIZE), 0, GRID_DIVS - 1);
      const maxCz = clamp(Math.floor((box.max.z + ARENA_HALF) / CELL_SIZE), 0, GRID_DIVS - 1);

      for (let cx = minCx; cx <= maxCx; cx++) {
        for (let cy = minCy; cy <= maxCy; cy++) {
          for (let cz = minCz; cz <= maxCz; cz++) {
            this.cells[cx * GRID_DIVS * GRID_DIVS + cy * GRID_DIVS + cz].push(bi);
          }
        }
      }
    }
  }

  /**
   * Returns candidate obstacle boxes whose grid cells overlap the bullet
   * segment [a → b]. The returned array is the internal result buffer —
   * read it immediately and do not store the reference.
   */
  public query(a: THREE.Vector3, b: THREE.Vector3): THREE.Box3[] {
    const gen = ++this.queryGen;
    this.resultBuf.length = 0;

    const minCx = clamp(Math.floor((Math.min(a.x, b.x) + ARENA_HALF) / CELL_SIZE), 0, GRID_DIVS - 1);
    const minCy = clamp(Math.floor((Math.min(a.y, b.y) + ARENA_HALF) / CELL_SIZE), 0, GRID_DIVS - 1);
    const minCz = clamp(Math.floor((Math.min(a.z, b.z) + ARENA_HALF) / CELL_SIZE), 0, GRID_DIVS - 1);
    const maxCx = clamp(Math.floor((Math.max(a.x, b.x) + ARENA_HALF) / CELL_SIZE), 0, GRID_DIVS - 1);
    const maxCy = clamp(Math.floor((Math.max(a.y, b.y) + ARENA_HALF) / CELL_SIZE), 0, GRID_DIVS - 1);
    const maxCz = clamp(Math.floor((Math.max(a.z, b.z) + ARENA_HALF) / CELL_SIZE), 0, GRID_DIVS - 1);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        for (let cz = minCz; cz <= maxCz; cz++) {
          for (const bi of this.cells[cx * GRID_DIVS * GRID_DIVS + cy * GRID_DIVS + cz]) {
            if (this.boxGen[bi] !== gen) {
              this.boxGen[bi] = gen;
              this.resultBuf.push(this.boxes[bi]);
            }
          }
        }
      }
    }

    return this.resultBuf;
  }

  public get boxCount(): number { return this.boxes.length; }
  public get divs(): number { return GRID_DIVS; }
  public get cellSize(): number { return CELL_SIZE; }
}

export function buildObstacleGrid(boxes: THREE.Box3[]): ObstacleGrid {
  return new ObstacleGrid(boxes);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
