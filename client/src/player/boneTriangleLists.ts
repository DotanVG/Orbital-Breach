interface SkinAttribute { getComponent(vertex: number, slot: number): number }

/** Triangle ownership is the sum of its three vertices' weights per bone.
 * Equal sums choose the lowest bone index. Each triangle appears exactly once,
 * in original index order within its owner. Ownership never assigns hit zones. */
export function boneTriangleLists(indices: Uint32Array, skinIndex: SkinAttribute, skinWeight: SkinAttribute): Map<number, Uint32Array> {
  const lists = new Map<number, number[]>();
  const sums = new Map<number, number>();
  for (let first = 0; first < indices.length; first += 3) {
    sums.clear();
    for (let k = 0; k < 3; k++) for (let slot = 0; slot < 4; slot++) {
      const vertex = indices[first + k], bone = skinIndex.getComponent(vertex, slot);
      sums.set(bone, (sums.get(bone) ?? 0) + skinWeight.getComponent(vertex, slot));
    }
    let owner = skinIndex.getComponent(indices[first], 0), largest = -Infinity;
    for (const [bone, sum] of sums) if (sum > largest || (sum === largest && bone < owner)) {
      owner = bone; largest = sum;
    }
    let list = lists.get(owner);
    if (!list) { list = []; lists.set(owner, list); }
    list.push(first / 3);
  }
  return new Map([...lists].map(([bone, triangles]) => [bone, Uint32Array.from(triangles)]));
}
