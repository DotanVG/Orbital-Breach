import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { LocalPlayer } from '../client/src/player/localPlayer';
import { CameraController } from '../client/src/camera';
import { Arena } from '../client/src/arena/arena';
import { BarObject } from '../client/src/arena/bar';
import type { InputManager } from '../client/src/input';
import type { PlayerPhase } from '../shared/schema';
import { PlayerAnimationController } from '../client/src/player/playerAnimationController';
import { breachRoomFloorY } from '../client/src/player/playerSpawn';
import { integrateBreachRoom } from '../client/src/physics';
import { BREACH_GRAVITY, BREACH_JUMP_SPEED, BREACH_WALK_SPEED } from '../shared/constants';
import { applyArmRecoil, applyFloatArmTilt, getFloatLimbRotation } from '../client/src/player/playerAimPose';

const allocations = vi.hoisted(() => ({ Vector3: 0, Quaternion: 0, Euler: 0 }));
vi.mock('three', async (importOriginal) => {
  const three = await importOriginal<typeof import('three')>();
  return {
    ...three,
    Vector3: class extends three.Vector3 {
      constructor(...args: ConstructorParameters<typeof three.Vector3>) { super(...args); allocations.Vector3++; }
    },
    Quaternion: class extends three.Quaternion {
      constructor(...args: ConstructorParameters<typeof three.Quaternion>) { super(...args); allocations.Quaternion++; }
    },
    Euler: class extends three.Euler {
      constructor(...args: ConstructorParameters<typeof three.Euler>) { super(...args); allocations.Euler++; }
    },
  };
});
// No asset/network I/O: exercise update math using a small in-memory rig.
vi.mock('../client/src/player/alienRenderAsset', () => ({ loadAlienRenderClone: () => new Promise(() => {}) }));
vi.mock('../client/src/player/playerThirdPersonGun', () => ({ ThirdPersonGun: class {} }));

type Internals = {
  animation: PlayerAnimationController;
  visualQuaternion: THREE.Quaternion;
  grabPoseLocked: boolean;
  respawnTimer: number;
  recoilTimer: number;
  leftHandGripLocal: THREE.Vector3;
  grabHandGripLocal: THREE.Vector3 | null;
  computeVisualQuaternion(cam: CameraController, dt: number): THREE.Quaternion;
  lockGripToBar(q: THREE.Quaternion): void;
};

function fixture(phase: PlayerPhase) {
  const scene = new THREE.Scene();
  const player = new LocalPlayer(scene);
  const internals = player as unknown as Internals;
  const root = new THREE.Group();
  for (const name of ['Hips', 'Torso', 'UpperArmR', 'PalmR', 'UpperArmL']) {
    const bone = new THREE.Bone(); bone.name = name; root.add(bone);
  }
  internals.animation.registerRig(root, []);
  const arena = new Arena(scene);
  const center = new THREE.Vector3(0, 0, -23);
  (arena as unknown as { breachRooms: object[] }).breachRooms.push({ center, openAxis: 'z', openSign: 1 });
  const bar = new BarObject(scene, new THREE.Vector3(10, 10, 10), { x: 0, y: 1, z: 0 });
  (arena as unknown as { barObjects: BarObject[] }).barObjects.push(bar);
  const cam = new CameraController(new THREE.PerspectiveCamera());
  cam.applyMouseDelta(200, 80, 0.002);
  const input = {
    isJumping: () => false, getWalkAxes: () => ({ x: 0.4, z: 0.6 }),
    consumeGrab: () => false, isAiming: () => phase === 'AIMING', consumeAimDelta: () => ({ dy: 0 }),
  } as unknown as InputManager;
  player.phase = phase;
  player.phys.pos.set(0, phase === 'BREACH' ? breachRoomFloorY(0) : 0, phase === 'BREACH' ? -23 : 0);
  if (phase === 'GRABBING' || phase === 'AIMING') {
    player.grabbedBarPos = new THREE.Vector3(1, 2, 3);
    internals.grabPoseLocked = true;
  }
  internals.respawnTimer = 100;
  return { player, internals, cam, arena, input };
}

afterEach(() => vi.restoreAllMocks());

describe('LocalPlayer steady update allocations', () => {
  it.each<PlayerPhase>(['BREACH', 'FLOATING', 'GRABBING', 'AIMING', 'FROZEN', 'RESPAWNING'])(
    'constructs no Vector3, Quaternion or Euler over 60 %s updates', (phase) => {
      const { player, internals, cam, arena, input } = fixture(phase);
      // Keep recoil active throughout the measured updates.
      internals.recoilTimer = 100;
      Object.assign(allocations, { Vector3: 0, Quaternion: 0, Euler: 0 });
      for (let i = 0; i < 60; i++) player.update(input, cam, arena, 1 / 600);
      expect(allocations).toEqual({ Vector3: 0, Quaternion: 0, Euler: 0 });
      expect(player.phase).toBe(phase);
    },
  );

  it('constructs no math objects per victory frame after the base pose is captured', () => {
    const { player, cam, arena, input } = fixture('FLOATING');
    player.setVictoryDanceActive(true);
    player.update(input, cam, arena, 1 / 60);
    Object.assign(allocations, { Vector3: 0, Quaternion: 0, Euler: 0 });
    for (let i = 0; i < 60; i++) player.update(input, cam, arena, 1 / 60);
    expect(allocations).toEqual({ Vector3: 0, Quaternion: 0, Euler: 0 });
  });
});

// Frozen copy of staging's facing math. Deliberately allocates as the old code did.
function oldFacing(phase: PlayerPhase, camera: THREE.Quaternion, previous: THREE.Quaternion, dt: number) {
  if (phase !== 'BREACH' && phase !== 'RESPAWNING' && phase !== 'GRABBING' && phase !== 'AIMING') return previous.copy(camera);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera);
  const flat = new THREE.Vector3(forward.x, 0, forward.z);
  if (flat.lengthSq() < 1e-5) flat.set(0, 0, -1); else flat.normalize();
  const target = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), flat);
  return phase === 'BREACH' || phase === 'RESPAWNING' ? previous.copy(target) : previous.slerp(target, 1 - Math.pow(0.0008, dt));
}

describe('LocalPlayer math preservation', () => {
  it.each<PlayerPhase>(['BREACH', 'FLOATING', 'GRABBING', 'AIMING', 'FROZEN', 'RESPAWNING'])(
    'matches old facing and grip math across orientations and dt in %s', (phase) => {
      const { internals, player, cam } = fixture(phase);
      const expected = new THREE.Quaternion();
      const camera = new THREE.Quaternion();
      vi.spyOn(cam, 'getQuaternion').mockReturnValue(camera);
      for (const angles of [[0, 0, 0], [0.4, 1.2, -0.7], [Math.PI / 2, 0, 0], [-1.3, -2.8, 2.4]]) {
        camera.setFromEuler(new THREE.Euler(...angles as [number, number, number], 'YXZ'));
        for (const dt of [0, 1 / 144, 1 / 60, 0.2]) {
          oldFacing(phase, camera, expected, dt);
          expect(internals.computeVisualQuaternion(cam, dt).toArray()).toEqual(expected.toArray());
          for (const grip of [null, new THREE.Vector3(-0.7, 0.4, 0.2)]) {
            player.grabbedBarPos = new THREE.Vector3(4, -3, 2);
            internals.grabHandGripLocal = grip;
            const position = player.grabbedBarPos.clone().sub((grip ?? internals.leftHandGripLocal).clone().applyQuaternion(expected));
            internals.lockGripToBar(expected);
            expect(player.phys.pos.toArray()).toEqual(position.toArray());
          }
        }
      }
    },
  );

  it('matches allocating walk integration without modifying either direction', () => {
    for (const yaw of [0, 0.7, -2.8]) for (const axes of [{ x: 0, z: 0 }, { x: 1, z: 1 }, { x: -0.3, z: 0.8 }]) {
      const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      const beforeFwd = fwd.toArray(), beforeRight = right.toArray();
      for (const dt of [0, 1 / 144, 1 / 60, 0.2]) for (const jump of [false, true]) {
        const actual = { pos: new THREE.Vector3(3, 2, -4), vel: new THREE.Vector3(1, -2, 3) };
        const expected = { pos: actual.pos.clone(), vel: actual.vel.clone() };
        const carry = new THREE.Vector3(0.3, 0, -0.8);
        const h = right.clone().multiplyScalar(axes.x).add(fwd.clone().multiplyScalar(axes.z));
        if (h.length() > 0) h.normalize();
        expected.vel.x = h.x * BREACH_WALK_SPEED + carry.x;
        expected.vel.z = h.z * BREACH_WALK_SPEED + carry.z;
        if (jump) expected.vel.y = BREACH_JUMP_SPEED;
        expected.vel.y += BREACH_GRAVITY * dt;
        expected.pos.addScaledVector(expected.vel, dt);
        integrateBreachRoom(actual, axes, fwd, right, jump, true, carry, dt);
        expect(actual.pos.toArray()).toEqual(expected.pos.toArray());
        expect(actual.vel.toArray()).toEqual(expected.vel.toArray());
      }
      expect(fwd.toArray()).toEqual(beforeFwd);
      expect(right.toArray()).toEqual(beforeRight);
    }
  });

  it('matches allocating float and recoil offsets across consecutive calls', () => {
    const { internals } = fixture('FLOATING');
    const rigs = internals.animation.getRigs();
    const arm = rigs[0].bones.UpperArmR!, palm = rigs[0].bones.PalmR!;
    for (const t of [1, 0.5, 0, 0.9]) {
      arm.quaternion.setFromEuler(new THREE.Euler(0.2, -0.4, 0.1));
      palm.quaternion.copy(arm.quaternion);
      const expectedArm = arm.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(getFloatLimbRotation('FloatRightArm')));
      const expectedPalm = palm.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(getFloatLimbRotation('FloatRightPalm')));
      applyFloatArmTilt(rigs);
      expect(arm.quaternion.toArray()).toEqual(expectedArm.toArray());
      expect(palm.quaternion.toArray()).toEqual(expectedPalm.toArray());
      expectedArm.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.3 * t, 0, 0)));
      applyArmRecoil(rigs, t);
      expect(arm.quaternion.toArray()).toEqual(expectedArm.toArray());
    }
  });

  it('keeps camera and arena output ownership independent across calls', () => {
    const { cam, arena } = fixture('BREACH');
    const output = new THREE.Vector3();
    // Supplying an output is opt-in; default calls still return independent values.
    for (const method of ['getForward', 'getYawForward', 'getYawRight'] as const) {
      const expected = cam[method]();
      expect(cam[method](output)).toBe(output);
      expect(output.toArray()).toEqual(expected.toArray());
      output.set(99, 99, 99);
      expect(cam[method]().toArray()).toEqual(expected.toArray());
    }
    for (const team of [0, 1] as const) {
      const expected = arena.getBreachRoomCenter(team);
      expect(arena.getBreachRoomCenter(team, output)).toBe(output);
      expect(output.toArray()).toEqual(expected.toArray());
    }
    const query = new THREE.Vector3(10, 10, 10);
    const expected = arena.getNearestBar(query, 5)!;
    expect(arena.getNearestBar(query, 5, output)).toBe(output);
    expect(output.toArray()).toEqual(expected.toArray());
    arena.getNearestBar(query, 5, output.set(20, 20, 20));
    expect(expected.toArray()).toEqual(output.toArray());
    expect(arena.getNearestBar(query, 0, output)).toBeNull();
  });
});
