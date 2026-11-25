import { readFileSync } from 'node:fs';
import { Matrix4, Quaternion, Vector3 } from 'three';
import {
  ALIEN_OFFSET_Y, ALIEN_OFFSET_Z, ALIEN_ROTATION_Y, ALIEN_SCALE,
} from '../../client/src/player/alienTransform';
import type { PoseBoneName } from '../../client/src/player/playerTypes';
import { worldPointToPlayerLocal, type QuaternionLike } from '../../shared/hitZoneColliders';
import type { Vec3 } from '../../shared/vec3';

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

// Shoemake sampling: Haar-uniform SO(3), rather than uniform Euler angles.
export function randomOrientation(random: () => number): Quaternion {
  const u = random(), a = 2 * Math.PI * random(), b = 2 * Math.PI * random();
  return new Quaternion(
    Math.sqrt(1 - u) * Math.sin(a), Math.sqrt(1 - u) * Math.cos(a),
    Math.sqrt(u) * Math.sin(b), Math.sqrt(u) * Math.cos(b),
  );
}

interface GltfNode {
  name?: string;
  children?: number[];
  matrix?: number[];
  translation?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
}

/** Decode only glTF node TRS; no scene, renderer, textures, or socket I/O. */
export function readRestBones(): Map<PoseBoneName, Matrix4> {
  const bytes = readFileSync(new URL('../../client/public/models/Alien.glb', import.meta.url));
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const nodes = gltf.nodes as GltfNode[];
  const parents = new Map<number, number>();
  nodes.forEach((node, parent) => node.children?.forEach((child) => parents.set(child, parent)));
  function nodeWorld(index: number): Matrix4 {
    const node = nodes[index];
    const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
      new Vector3(...(node.translation ?? [0, 0, 0])),
      new Quaternion(...(node.rotation ?? [0, 0, 0, 1])),
      new Vector3(...(node.scale ?? [1, 1, 1])),
    );
    const parent = parents.get(index);
    return parent === undefined ? local : nodeWorld(parent).multiply(local);
  }
  const asset = new Matrix4().compose(
    new Vector3(0, ALIEN_OFFSET_Y, ALIEN_OFFSET_Z),
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), ALIEN_ROTATION_Y),
    new Vector3(ALIEN_SCALE, ALIEN_SCALE, ALIEN_SCALE),
  );
  return new Map(nodes.map((node, index) => [
    // GLTFLoader sanitizes e.g. UpperArm.L to UpperArmL (PropertyBinding).
    (node.name ?? '').replaceAll('.', '') as PoseBoneName,
    asset.clone().multiply(nodeWorld(index)),
  ]));
}

/** Recover the world frame from the *production* inverse hit transform.
 * A dropped pitch/roll, sign, or 2w term here also breaks classification. */
export function classifiedWorldFrame(pos: Vec3, q: QuaternionLike): Matrix4 {
  const origin = new Vector3().copy(worldPointToPlayerLocal({ x: 0, y: 0, z: 0 }, pos, q));
  const axes = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)]
    .map((point) => new Vector3().copy(worldPointToPlayerLocal(point, pos, q)).sub(origin));
  return new Matrix4().makeBasis(axes[0], axes[1], axes[2]).setPosition(origin).invert();
}
