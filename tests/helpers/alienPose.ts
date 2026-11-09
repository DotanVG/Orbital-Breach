import { readFileSync } from 'node:fs';
import { Box3, Group, Vector3, SkinnedMesh } from 'three';
import { GLTFLoader } from '../../client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { ALIEN_OFFSET_Y, ALIEN_OFFSET_Z, ALIEN_ROTATION_Y, ALIEN_SCALE } from '../../client/src/player/alienTransform';
import { PlayerAnimationController, ANIM_DEATH, ANIM_FLOAT, ANIM_STANDING } from '../../client/src/player/playerAnimationController';
import { applyFloatArmTilt } from '../../client/src/player/playerAimPose';
import { applyBarHoldPose } from '../../client/src/player/playerGrabPose';

/** Real glTF channels + CPU skinning. No textures, browser, renderer or collider input. */
async function loadRig(asset: string) {
  const bytes = readFileSync(new URL(`../../client/public/models/${asset}.glb`, import.meta.url));
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const bin = bytes.subarray(28 + jsonLength);
  gltf.buffers[0].uri = `data:application/octet-stream;base64,${bin.toString('base64')}`;
  delete gltf.images; delete gltf.textures; delete gltf.materials;
  for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  // FileLoader's streaming progress event is absent in Node 22.
  globalThis.ProgressEvent ??= class extends Event { constructor(type: string) { super(type); } } as typeof ProgressEvent;
  const { scene: root, animations } = await new GLTFLoader().parseAsync(JSON.stringify(gltf), '');
  root.scale.setScalar(ALIEN_SCALE);
  root.position.set(0, ALIEN_OFFSET_Y, ALIEN_OFFSET_Z);
  root.rotation.y = ALIEN_ROTATION_Y;
  return { root, animations };
}

export async function sampleAlienPose(phase = 'BREACH', time = 0, frozenFrom = 'BREACH', originTime = 0) {
  const {root, animations} = await loadRig('Alien');
  // Only hold samples need the second asset; retaining it in hundreds of swim
  // envelope samples would duplicate the entire body mesh in memory.
  const helmet = phase === 'GRABBING' || phase === 'AIMING' || (phase === 'FROZEN' && frozenFrom === 'GRABBING') ? await loadRig('Alien_Helmet') : null;
  const helmetRoot = helmet?.root ?? new Group();
  const animation = new PlayerAnimationController();
  const rig = animation.registerRig(root, animations);
  const helmetRig = helmet ? animation.registerRig(helmetRoot, helmet.animations) : null;
  if (phase === 'GRABBING' || phase === 'AIMING') {
    animation.snapToAnimation(ANIM_STANDING);
    animation.tickMixers(0); // snapToAnimation has no crossfade; runtime locks frame zero
    animation.resetBreathing();
    applyBarHoldPose(animation.getRigs());
  } else if (phase === 'FROZEN') {
    if (frozenFrom === 'FLOATING') {
      animation.setTargetAnimation(ANIM_FLOAT);
      animation.tickMixers(1 + originTime);
      animation.restoreFloatRightArmPose();
      applyFloatArmTilt([rig]);
    } else if (frozenFrom === 'GRABBING') {
      animation.snapToAnimation(ANIM_STANDING);
      animation.tickMixers(0);
      animation.resetBreathing();
      applyBarHoldPose(animation.getRigs());
    }
    animation.setTargetAnimation(ANIM_DEATH);
    animation.tickMixers(time);
  } else if (phase === 'FLOATING') {
    animation.setTargetAnimation(ANIM_FLOAT);
    animation.tickMixers(1 + time);
    animation.restoreFloatRightArmPose();
    applyFloatArmTilt([rig]);
  } else {
    animation.tickMixers(time);
  }
  root.updateMatrixWorld(true);
  const bones = new Map<string, Vector3>();
  root.traverse(node => { if (node.type === 'Bone') bones.set(node.name, node.getWorldPosition(new Vector3())); });
  const vertices: Vector3[] = [];
  const headVertices: Vector3[] = [];
  const coreVertices: Vector3[] = [];
  const handVertices = { L: [] as Vector3[], R: [] as Vector3[] };
  root.traverse(node => {
    if (!(node instanceof SkinnedMesh)) return;
    node.skeleton.update();
    const coreBones=node.skeleton.bones.map(b=>/^(Head|Neck|Torso|Abdomen|Hips|UpperLeg[LR]|LowerLeg[LR]|Foot[LR])$/.test(b.name));
    const handSides=node.skeleton.bones.map(b=>/^(Palm|.*Finger[1-4]|Thumb[1-3])[LR]$/.test(b.name) ? b.name.slice(-1) : '');
    for (let i = 0; i < node.geometry.attributes.position.count; i++) {
      const vertex = node.getVertexPosition(i, new Vector3()).applyMatrix4(node.matrixWorld);
      vertices.push(vertex);
      const indices = node.geometry.attributes.skinIndex, weights = node.geometry.attributes.skinWeight;
      let coreWeight=0;
      let dominant = 0;
      for(let k=0;k<4;k++) {
        if (weights.getComponent(i,k) > weights.getComponent(i,dominant)) dominant = k;
        const index=indices.getComponent(i,k);
        if(coreBones[index]) coreWeight+=weights.getComponent(i,k);
      }
      const dominantIndex=indices.getComponent(i,dominant);
      if(node.skeleton.bones[dominantIndex].name === 'Head') headVertices.push(vertex);
      if(coreWeight>0.5) coreVertices.push(vertex);
      const side = handSides[dominantIndex];
      if (side === 'L' || side === 'R') handVertices[side].push(vertex);
    }
  });
  helmetRoot.updateMatrixWorld(true);
  const helmetVertices: Vector3[] = [];
  helmetRoot.traverse(node => {
    if (!(node instanceof SkinnedMesh)) return;
    node.skeleton.update();
    for (let i = 0; i < node.geometry.attributes.position.count; i++) helmetVertices.push(node.getVertexPosition(i, new Vector3()).applyMatrix4(node.matrixWorld));
  });
  return { root, rig, helmetRoot, helmetRig, bones, vertices, headVertices, coreVertices, handVertices, helmetVertices, bounds: new Box3().setFromPoints(phase === 'GRABBING' || phase === 'AIMING' ? [...vertices,...helmetVertices] : vertices), animation };
}
