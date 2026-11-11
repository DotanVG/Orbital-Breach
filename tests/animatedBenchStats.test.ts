import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

const { stats } = createRequire(import.meta.url)('../scripts/qa/animated-mesh-bench.cjs');

it('uses nearest-rank frame percentiles and a per-frame mean, independent of frame order', () => {
  const frames=Array.from({length:100},(_,i)=>100-i);
  expect(stats(frames)).toEqual({mean:50.5,p95:95,p99:99});
  expect(stats([3])).toEqual({mean:3,p95:3,p99:3});
  expect(frames[0]).toBe(100);
});
