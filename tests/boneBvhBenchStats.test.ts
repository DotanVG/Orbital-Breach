import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const {stats}=createRequire(import.meta.url)('../scripts/qa/bone-bvh-bench.cjs');
const {instrument}=createRequire(import.meta.url)('../scripts/qa/bone-bvh-profile.cjs');
const ts=createRequire(import.meta.url)('../client/node_modules/typescript');

it('keeps diagnostic timers opt-in and transforms the current path into valid TypeScript',()=>{
  const source=readFileSync(new URL('../client/src/player/hitSurface.ts',import.meta.url),'utf8');
  expect(source).not.toContain('__boneProfile');
  const result=instrument(source);
  expect(result).toContain('timed("root reject"');expect(result).toContain('timed("palette"');
  const parsed=ts.transpileModule(result,{reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022}});
  expect(parsed.diagnostics).toEqual([]);
  expect(()=>instrument('changed source without anchors')).toThrow('Profile anchor missing');
});

it('reports mean and nearest-rank p95/p99 without mutating frame samples',()=>{
  const frames=Array.from({length:100},(_,i)=>100-i),before=[...frames];
  expect(stats(frames)).toEqual({mean:50.5,p95:95,p99:99});
  expect(frames).toEqual(before);
});

it('keeps fractional milliseconds in short measured windows',()=>{
  expect(stats([.1,.4,.2,.3])).toEqual({mean:.25,p95:.4,p99:.4});
});
