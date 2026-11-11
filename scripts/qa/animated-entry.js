import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { lazyHitSurfaces } from '/src/player/hitSurface.ts';
import { ProjectileSystem } from '/src/game/projectileSystem.ts';
import { PlayerAnimationController, ANIM_FLOAT } from '/src/player/playerAnimationController.ts';
import { applyFloatArmTilt } from '/src/player/playerAimPose.ts';
import { ALIEN_OFFSET_Y, ALIEN_OFFSET_Z, ALIEN_ROTATION_Y, ALIEN_SCALE } from '/src/player/alienTransform.ts';

const transforms = await (await fetch('/__transforms')).json();
const loader = new GLTFLoader();
const actors = [];
for (const transform of transforms) {
  const wrapper = new THREE.Group();
  wrapper.position.fromArray(transform.position);
  wrapper.quaternion.fromArray(transform.quaternion);
  const animation = new PlayerAnimationController();
  for (const asset of ['Alien', 'Alien_Helmet']) {
    const { scene, animations } = await loader.loadAsync(`/models/${asset}.glb`);
    scene.scale.setScalar(ALIEN_SCALE);
    scene.position.set(0, ALIEN_OFFSET_Y, ALIEN_OFFSET_Z);
    scene.rotation.y = ALIEN_ROTATION_Y;
    wrapper.add(scene);
    animation.registerRig(scene, animations);
  }
  animation.setTargetAnimation(ANIM_FLOAT);
  animation.tickMixers(1);
  animation.restoreFloatRightArmPose();
  applyFloatArmTilt(animation.getRigs());
  wrapper.updateMatrixWorld(true);
  let head;
  wrapper.traverse(n => { if (!head && n.isBone && n.name === 'Head') head = n; });
  actors.push({ wrapper, animation, head, getSurfaces: lazyHitSurfaces(wrapper) });
}

window.measure = ({ warmup, frames, profile }) => {
  const results = {};
  for (const [mode, every] of [['hit', 1], ['miss', 1], ['hit', 10], ['miss', 10]]) {
    const system = new ProjectileSystem(new THREE.Scene());
    const times = [], zones = {};
    let actorHits = 0, shots = 0, initialVertices = 0;
    globalThis.__profile = profile ? { times: {}, calls: {}, counts: {} } : undefined;
    for (let frame = -warmup; frame < frames; frame++) {
      for (const actor of actors) {
        actor.animation.tickMixers(1 / 60);
        actor.animation.restoreFloatRightArmPose();
        applyFloatArmTilt(actor.animation.getRigs());
        actor.wrapper.updateMatrixWorld(true);
      }
      const targets = actors.map((a, i) => ({ id: String(i), team: i % 2, active: true, getSurfaces: a.getSurfaces }));
      if (frame % every === 0) for (let i = 0; i < 8; i++) {
        const origin = actors[(i + 1) % 8].head.getWorldPosition(new THREE.Vector3());
        origin.z -= .4;
        if (mode === 'miss') origin.y += 4;
        system.spawn(origin, new THREE.Vector3(0, 0, 1), i % 2, String(i));
        if (frame >= 0) shots++;
      }
      if (frame === 0 && profile) globalThis.__profile = { times: {}, calls: {}, counts: {} };
      if (frame === 0) initialVertices = actors.reduce((n, a) => n + a.getSurfaces.skinnedVertexCount, 0);
      const start = performance.now();
      system.update(1 / 60, [], [], targets, () => {}, hit => {
        if (frame >= 0) { actorHits++; zones[hit.zone] = (zones[hit.zone] || 0) + 1; }
      });
      if (frame >= 0) times.push(performance.now() - start);
    }
    system.clear();
    results[`${mode}_every${every}`] = { times, actorHits, shots, zones,
      skinnedVertices: actors.reduce((n, a) => n + a.getSurfaces.skinnedVertexCount, 0) - initialVertices,
      profile: globalThis.__profile };
  }
  return results;
};
window.ready = true;
