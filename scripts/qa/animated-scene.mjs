import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ProjectileSystem } from '/src/game/projectileSystem.ts';
import { PlayerAnimationController, ANIM_FLOAT } from '/src/player/playerAnimationController.ts';
import { applyFloatArmTilt } from '/src/player/playerAimPose.ts';
import { ALIEN_OFFSET_Y, ALIEN_OFFSET_Z, ALIEN_ROTATION_Y, ALIEN_SCALE } from '/src/player/alienTransform.ts';
// The runner injects the variant's own target import and adapter here.
__TARGET_IMPORT__

const { actors: placements } = await (await fetch('/__poses')).json();
if (placements.length !== 8) throw Error('Expected eight actor placements');
const loader = new GLTFLoader();
async function loadRig(url) {
  const { scene: root, animations } = await loader.loadAsync(url);
  root.scale.setScalar(ALIEN_SCALE);
  root.position.set(0, ALIEN_OFFSET_Y, ALIEN_OFFSET_Z);
  root.rotation.y = ALIEN_ROTATION_Y;
  return { root, animations };
}
const actors = [];
for (const placement of placements) {
  const body = await loadRig('/models/Alien.glb');
  const helmet = await loadRig('/models/Alien_Helmet.glb');
  const wrapper = new THREE.Group();
  wrapper.add(body.root, helmet.root);
  wrapper.position.fromArray(placement.position);
  wrapper.quaternion.fromArray(placement.quaternion);
  const animation = new PlayerAnimationController();
  animation.registerRig(body.root, body.animations);
  animation.registerRig(helmet.root, helmet.animations);
  animation.setTargetAnimation(ANIM_FLOAT);
  animation.tickMixers(1);
  animation.restoreFloatRightArmPose();
  applyFloatArmTilt(animation.getRigs());
  wrapper.updateMatrixWorld(true);
  actors.push({ wrapper, animation, head: body.root.getObjectByName('Head'), ...targetState(wrapper) });
}

window.measure = ({ warmup, ticks, cases }) => {
  const results = {};
  for (const [mode, fireEvery] of cases) {
    const system = new ProjectileSystem(new THREE.Scene());
    const frames = [], zoneCounts = {};
    let actorHits = 0, spawnedShots = 0;
    for (let t = -warmup; t < ticks; t++) {
      for (const a of actors) {
        a.animation.tickMixers(1 / 60);
        a.animation.restoreFloatRightArmPose();
        applyFloatArmTilt(a.animation.getRigs());
        a.wrapper.updateMatrixWorld(true);
      }
      const targets = actors.map((a, i) => ({ id: String(i), team: i % 2, active: true, ...targetFields(a) }));
      if (t % fireEvery === 0) for (let i = 0; i < actors.length; i++) {
        if (t >= 0) spawnedShots++;
        const aim = actors[(i + 1) % 8].head.getWorldPosition(new THREE.Vector3());
        aim.z -= .4;
        if (mode === 'miss') aim.y += 4;
        system.spawn(aim, new THREE.Vector3(0, 0, 1), i % 2, String(i));
      }
      // Match the original timing boundary: setup, mixer and matrix work above
      // are excluded; collision, effects and the hit callback are included.
      const start = performance.now();
      system.update(1 / 60, [], [], targets, () => {}, hit => {
        if (t >= 0) {
          actorHits++;
          const zone = hit.zone ?? 'unclassified'; // sphere baseline has no zone API
          zoneCounts[zone] = (zoneCounts[zone] ?? 0) + 1;
        }
      });
      if (t >= 0) frames.push(performance.now() - start);
    }
    system.clear();
    results[`${mode}_every${fireEvery}`] = { frames, actorHits, spawnedShots, zoneCounts };
  }
  return results;
};
window.ready = true;
