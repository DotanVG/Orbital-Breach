import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

const {stats}=createRequire(import.meta.url)('../scripts/qa/bone-bvh-bench.cjs');

it('reports mean and nearest-rank p95/p99 without mutating frame samples',()=>{
  const frames=Array.from({length:100},(_,i)=>100-i),before=[...frames];
  expect(stats(frames)).toEqual({mean:50.5,p95:95,p99:99});
  expect(frames).toEqual(before);
});

it('keeps fractional milliseconds in short measured windows',()=>{
  expect(stats([.1,.4,.2,.3])).toEqual({mean:.25,p95:.4,p99:.4});
});
