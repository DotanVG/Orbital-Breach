import { readFileSync } from 'node:fs';
import { Box3, Vector3, SkinnedMesh } from 'three';
import { GLTFLoader } from '../../client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { ALIEN_OFFSET_Y, ALIEN_OFFSET_Z, ALIEN_ROTATION_Y, ALIEN_SCALE } from '../../client/src/player/alienTransform';
import { PlayerAnimationController, ANIM_DEATH, ANIM_FLOAT, ANIM_STANDING } from '../../client/src/player/playerAnimationController';
import { applyFloatArmTilt } from '../../client/src/player/playerAimPose';
import { applyBarHoldPose } from '../../client/src/player/playerGrabPose';

/** Real glTF channels + CPU skinning. No textures, browser, renderer or collider input. */
export async function sampleAlienPose(phase = 'BREACH', time = 0, frozenFrom = 'BREACH', originTime = 0) {
  const bytes = readFileSync(new URL('../../client/public/models/Alien.glb', import.meta.url));
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
  const animation = new PlayerAnimationController();
  const rig = animation.registerRig(root, animations);
  if (phase === 'GRABBING' || phase === 'AIMING') {
    animation.snapToAnimation(ANIM_STANDING);
    animation.tickMixers(1); // finish the crossfade just as a settled hold
    animation.resetBreathing();
    applyBarHoldPose([rig]);
  } else if (phase === 'FROZEN') {
    if (frozenFrom === 'FLOATING') {
      animation.setTargetAnimation(ANIM_FLOAT);
      animation.tickMixers(1 + originTime);
      animation.restoreFloatRightArmPose();
      applyFloatArmTilt([rig]);
    } else if (frozenFrom === 'GRABBING') {
      animation.snapToAnimation(ANIM_STANDING);
      animation.tickMixers(1);
      animation.resetBreathing();
      applyBarHoldPose([rig]);
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
  root.traverse(node => {
    if (!(node instanceof SkinnedMesh)) return;
    node.skeleton.update();
    const coreBones=node.skeleton.bones.map(b=>/^(Head|Neck|Torso|Abdomen|Hips|UpperLeg[LR]|LowerLeg[LR]|Foot[LR])$/.test(b.name));
    const headBones=node.skeleton.bones.map(b=>b.name === 'Head');
    for (let i = 0; i < node.geometry.attributes.position.count; i++) {
      const vertex = node.getVertexPosition(i, new Vector3()).applyMatrix4(node.matrixWorld);
      vertices.push(vertex);
      const indices = node.geometry.attributes.skinIndex, weights = node.geometry.attributes.skinWeight;
      let headWeight=0, coreWeight=0;
      for(let k=0;k<4;k++) {
        const index=indices.getComponent(i,k);
        if(headBones[index]) headWeight+=weights.getComponent(i,k);
        if(coreBones[index]) coreWeight+=weights.getComponent(i,k);
      }
      if(headWeight>0.5) headVertices.push(vertex);
      if(coreWeight>0.5) coreVertices.push(vertex);
    }
  });
  return { root, rig, bones, vertices, headVertices, coreVertices, bounds: new Box3().setFromPoints(vertices), animation };
}
