import { describe, expect, it } from 'vitest';
import { boneTriangleLists } from '../client/src/player/boneTriangleLists';

const attribute = (rows: number[][]) => ({ getComponent: (vertex: number, slot: number) => rows[vertex][slot] });

describe('per-bone triangle ownership', () => {
  it('sums all three vertices, keeps every triangle once, and preserves index order within each bone', () => {
    const indices = Uint32Array.from([0, 1, 2, 3, 4, 5, 0, 2, 1]);
    const skin = attribute(Array.from({ length: 6 }, () => [7, 2, 0, 0]));
    const weights = attribute([[.9, .1, 0, 0], [.2, .8, 0, 0], [.2, .8, 0, 0],
      [.8, .2, 0, 0], [.8, .2, 0, 0], [.8, .2, 0, 0]]);
    const lists = boneTriangleLists(indices, skin, weights);
    expect([...lists.get(2)!]).toEqual([0, 2]);
    expect([...lists.get(7)!]).toEqual([1]);
    expect([...lists.values()].flatMap(v => [...v]).sort()).toEqual([0, 1, 2]);
  });

  it('breaks equal summed weights by the lowest bone index regardless of influence order', () => {
    const indices = Uint32Array.from([0, 1, 2]);
    for (const bones of [[9, 3, 0, 0], [3, 9, 0, 0]]) {
      const lists = boneTriangleLists(indices, attribute([bones, bones, bones]),
        attribute(Array.from({ length: 3 }, () => [.5, .5, 0, 0])));
      expect([...lists.keys()]).toEqual([3]);
      expect([...lists.get(3)!]).toEqual([0]);
    }
    expect(boneTriangleLists(new Uint32Array(), attribute([]), attribute([])).size).toBe(0);
  });
});
