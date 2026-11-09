import { afterAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import {
  classifyHitZoneByColliders, defaultHitZoneColliders, orientationFromSnapshot,
  quaternionFromYawPitchRoll, type HitZoneCollider,
} from '../shared/hitZoneColliders';
import { applyHit, type HitZone, type SharedPlayerState } from '../shared/player-logic';
import { HITBOX_OFFSET_Y, HITBOX_RADIUS, PLAYER_RADIUS } from '../shared/constants';
import type { PoseBoneName } from '../client/src/player/playerTypes';
import { DEFAULT_LEFT_HAND_GRIP_LOCAL } from '../client/src/player/playerGrabPose';
import { integrateZeroG } from '../client/src/physics';
import { classifiedWorldFrame, randomOrientation, readRestBones, seededRandom } from './helpers/hitboxOrientation';
import bindings from './fixtures/alienColliderBindings.json';
import staging from './fixtures/stagingHitZoneColliders.json';

vi.mock('../client/src/net/endpoint', () => ({ getColyseusEndpoint: () => null }));
// Only pure exported adapters are called; never construct an avatar/scene/socket.
vi.mock('../client/src/match/simulatedPlayerAvatar', () => ({ SimulatedPlayerAvatar: class {} }));
import { toActorSnapshot } from '../client/src/net/client';
import { snapshotOrientation } from '../client/src/match/onlineMatch';

const zones = Object.keys(bindings.bindings) as HitZone[];
const bones = readRestBones();
const random = seededRandom(0x215f1);
const samples = Array.from({ length: 256 }, () => ({
  phase: 'FLOATING', q: randomOrientation(random),
  pos: new Vector3(random() * 20 - 10, random() * 20 - 10, random() * 20 - 10),
}));
const perZone = Object.fromEntries(zones.map((zone) => [zone, {
  pass: false, maxPositionErrorM: 0, maxAngleErrorDeg: 0, classificationPass: false,
}])) as Record<HitZone, { pass: boolean; maxPositionErrorM: number; maxAngleErrorDeg: number; classificationPass: boolean }>;
const results = {
  seed: 0x215f1, randomOrientationCount: 256, orientationCount: 0,
  sequence: [] as string[], tolerancePositionM: 0.01, toleranceAngleDeg: 1,
  measurement: 'Rigid visual-root rotation relative to frozen GLB rest-bone collider bindings; not animated skeletal hitboxes or equality with raw joint origins.',
  maxPositionErrorM: 0, maxAngleErrorDeg: 0, zones: perZone,
  F1: 'FAIL', L1: 'FAIL', grabDrop: 'FAIL',
  rawBoneOriginOffsetsM: Object.fromEntries(zones.map((zone) => [zone, bindings.bindings[zone].rawBoneOriginOffsetM])),
  absoluteBonePoseComparison: {
    pass: false,
    note: 'Authored volumes are offset from joint origins and axes. The passing guard above measures preservation of frozen rest-bone bindings, not absolute center/axis equality.',
    zones: Object.fromEntries(zones.map((zone) => {
      const bone = bones.get(bindings.bindings[zone].bone as PoseBoneName)!;
      const collider = defaultHitZoneColliders.find((item) => item.zone === zone)!;
      const positionErrorM = new Vector3().setFromMatrixPosition(bone).distanceTo(new Vector3().copy(collider.position));
      const angleErrorDeg = new Quaternion().setFromRotationMatrix(new Matrix4().extractRotation(bone))
        .normalize().angleTo(new Quaternion()) * 180 / Math.PI;
      return [zone, { positionErrorM, angleErrorDeg, pass: positionErrorM <= 0.01 && angleErrorDeg <= 1 }];
    })),
  },
};

function grabbedState(): SharedPlayerState {
  return {
    phase: 'GRABBING', grabbedBarPos: { x: 2, y: 1, z: -3 }, vel: { x: 0, y: 0, z: 0 },
    launchPower: 8, deaths: 0,
    damage: { frozen: false, leftArm: false, rightArm: false, leftLeg: false, rightLeg: false },
  };
}

// Physics-like GRABBING -> launch -> spinning FLOATING sequence. Same launch
// displacement/power as LocalPlayer.launch; integrate the real zero-G physics.
const gripQ = new Quaternion().setFromEuler(new Euler(0.4, 1.1, -0.6, 'YXZ'));
const bar = new Vector3(2, 1, -3);
const phys = { pos: bar.clone().sub(DEFAULT_LEFT_HAND_GRIP_LOCAL.clone().applyQuaternion(gripQ)), vel: new Vector3() };
samples.push({ phase: 'GRABBING', pos: phys.pos.clone(), q: gripQ.clone() });
const forward = new Vector3(0, 0, -1).applyQuaternion(gripQ);
phys.pos.addScaledVector(forward, PLAYER_RADIUS + 0.8);
phys.vel.copy(forward).multiplyScalar(8);
const spin = new Quaternion().setFromAxisAngle(new Vector3(0.7, 1.1, -0.8).normalize(), 0.045);
for (let frame = 0; frame < 120; frame++) {
  integrateZeroG(phys, 1 / 60);
  gripQ.multiply(spin).normalize();
  samples.push({ phase: 'FLOATING', pos: phys.pos.clone(), q: gripQ.clone() });
}
results.orientationCount = samples.length;
results.sequence = samples.slice(256).map((sample) => sample.phase);

describe('hitbox orientation guard', () => {
  it('pins real GLB rest-bone data and the left gripping hand', () => {
    const asset = readFileSync(new URL('../client/public/models/Alien.glb', import.meta.url));
    expect(createHash('sha256').update(asset).digest('hex')).toBe(bindings.assetSha256);
    expect(new Vector3().setFromMatrixPosition(bones.get('UpperArmL')!).x).toBeLessThan(0);
    expect(new Vector3().setFromMatrixPosition(bones.get('UpperArmR')!).x).toBeGreaterThan(0);
    expect(DEFAULT_LEFT_HAND_GRIP_LOCAL.x).toBeLessThan(0);
    expect(results.orientationCount).toBeGreaterThanOrEqual(200);
    expect(new Set(samples.map((sample) => sample.phase))).toEqual(new Set(['FLOATING', 'GRABBING']));
    const grab = samples[256];
    expect(DEFAULT_LEFT_HAND_GRIP_LOCAL.clone().applyQuaternion(grab.q).add(grab.pos).distanceTo(bar)).toBeLessThan(1e-10);
    expect(samples[257].pos.distanceTo(grab.pos)).toBeGreaterThan(PLAYER_RADIUS + 0.8);
    expect(samples.at(-1)!.q.angleTo(grab.q)).toBeGreaterThan(0.1);
  });

  for (const zone of zones) {
    it(`${zone}: world position and rotation follow its real rest-bone binding within 1 cm / 1 degree`, () => {
      const collider = defaultHitZoneColliders.find((item) => item.zone === zone)!;
      const binding = bindings.bindings[zone];
      const bone = bones.get(binding.bone as PoseBoneName)!;
      expect(bone).toBeDefined();
      const boneToCollider = new Matrix4().fromArray(binding.boneToCollider);
      for (const { pos, q, phase } of samples) {
        const visualRoot = new Matrix4().compose(pos, q, new Vector3(1, 1, 1));
        const boneWorld = visualRoot.clone().multiply(bone);
        const expected = boneWorld.clone().multiply(boneToCollider);
        const localRotation = quaternionFromYawPitchRoll(collider.rotation.y, collider.rotation.x, collider.rotation.z);
        const actual = classifiedWorldFrame(pos, q).multiply(new Matrix4().compose(
          new Vector3().copy(collider.position),
          new Quaternion(localRotation.x, localRotation.y, localRotation.z, localRotation.w), new Vector3(1, 1, 1),
        ));
        const center = new Vector3().setFromMatrixPosition(expected);
        const positionError = new Vector3().setFromMatrixPosition(actual).distanceTo(center);
        const angleError = new Quaternion().setFromRotationMatrix(actual).normalize()
          .angleTo(new Quaternion().setFromRotationMatrix(expected).normalize()) * 180 / Math.PI;
        perZone[zone].maxPositionErrorM = Math.max(perZone[zone].maxPositionErrorM, positionError);
        perZone[zone].maxAngleErrorDeg = Math.max(perZone[zone].maxAngleErrorDeg, angleError);
        expect(positionError, `${zone} ${phase}`).toBeLessThanOrEqual(0.01);
        expect(angleError, `${zone} ${phase}`).toBeLessThanOrEqual(1);
        // World-space impact at the bone-anchored limb volume center.
        expect(classifyHitZoneByColliders(center, pos, q), `${zone} ${phase}`).toBe(zone);
        // Asymmetric probes also exercise rotation of each box, not only its center.
        for (const direction of [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)]) {
          direction.multiplyScalar(0.01).applyMatrix4(expected);
          expect(classifyHitZoneByColliders(direction, pos, q)).toBe(zone);
        }
      }
      perZone[zone].pass = true;
      perZone[zone].classificationPass = true;
    });
  }

  it('F1: left/right arm centers stay nearer the matching real UpperArm bones at every orientation', () => {
    for (const { pos, q } of samples) {
      const root = new Matrix4().compose(pos, q, new Vector3(1, 1, 1));
      const left = new Vector3().setFromMatrixPosition(root.clone().multiply(bones.get('UpperArmL')!));
      const right = new Vector3().setFromMatrixPosition(root.clone().multiply(bones.get('UpperArmR')!));
      for (const zone of ['leftArm', 'rightArm'] as const) {
        const center = new Vector3().copy(defaultHitZoneColliders.find((c) => c.zone === zone)!.position).applyQuaternion(q).add(pos);
        expect(center.distanceTo(zone === 'leftArm' ? left : right))
          .toBeLessThan(center.distanceTo(zone === 'leftArm' ? right : left));
      }
    }
    results.F1 = 'PASS';
  });

  it('leftArm world hits drop the left-hand grab; rightArm hits preserve it', () => {
    for (const { pos, q } of samples) {
      for (const zone of ['leftArm', 'rightArm'] as const) {
        const state = grabbedState();
        const hit = new Vector3().copy(defaultHitZoneColliders.find((c) => c.zone === zone)!.position).applyQuaternion(q).add(pos);
        const classified = classifyHitZoneByColliders(hit, pos, q);
        expect(classified).toBe(zone);
        expect(applyHit(state, classified, { x: 0, y: 0, z: 0 })).toBe(false);
        expect(state.damage[zone]).toBe(true);
        expect(state.phase).toBe(zone === 'leftArm' ? 'FLOATING' : 'GRABBING');
        expect(state.grabbedBarPos === null).toBe(zone === 'leftArm');
        expect(state.damage.frozen).toBe(false);
      }
    }
    results.grabDrop = 'PASS';
  });

  it('L1: both production snapshot adapters use yaw for absent, undefined, partial or invalid orient', () => {
    for (const missing of [{}, { orientX: undefined, orientY: undefined, orientZ: undefined, orientW: undefined },
      { orientX: 0 }, { orientX: 0, orientY: 0, orientZ: 0, orientW: 0 },
      { orientX: NaN, orientY: 0, orientZ: 0, orientW: 1 }]) {
      const raw = { yaw: Math.PI, ...missing };
      const parsed = toActorSnapshot(raw);
      for (const q of [orientationFromSnapshot(raw), snapshotOrientation(raw), snapshotOrientation(parsed)]) {
        expect(q).toMatchObject(quaternionFromYawPitchRoll(raw.yaw));
        const collider = defaultHitZoneColliders.find((c) => c.zone === 'leftArm')!;
        const hit = new Vector3().copy(collider.position).applyQuaternion(new Quaternion(q.x, q.y, q.z, q.w));
        expect(classifyHitZoneByColliders(hit, { x: 0, y: 0, z: 0 }, q)).toBe('leftArm');
        expect(classifyHitZoneByColliders(hit, { x: 0, y: 0, z: 0 }, new Quaternion())).toBe('rightArm');
      }
    }
    for (const { q } of samples) {
      const actor = { yaw: 2.3, orientX: q.x, orientY: q.y, orientZ: q.z, orientW: q.w };
      const out = snapshotOrientation(toActorSnapshot(actor));
      expect(out.angleTo(q)).toBeLessThan(1e-6);
      expect(snapshotOrientation({ yaw: 2.3, orientX: 0, orientY: 0, orientZ: 0, orientW: 1 }).w).toBe(1);
    }
    results.L1 = 'PASS';
  });
});

describe('seeded hit distribution measurement', () => {
  it('records identical uniform sphere-contact impact sampling for both layouts', () => {
    const random = seededRandom(0x215d157);
    const count = 60000;
    const counts = { staging: Object.fromEntries(zones.map((z) => [z, 0])), pr215: Object.fromEntries(zones.map((z) => [z, 0])) };
    for (let index = 0; index < count; index++) {
      // Uniform normals on the production broadphase sphere: equivalent to
      // radial incoming rays whose first contacts are these impact points.
      const y = 2 * random() - 1, theta = 2 * Math.PI * random();
      const r = Math.sqrt(1 - y * y);
      const impact = new Vector3(r * Math.cos(theta), y, r * Math.sin(theta)).multiplyScalar(HITBOX_RADIUS);
      impact.y += HITBOX_OFFSET_Y;
      const q = samples[index % 256].q;
      for (const [layout, colliders] of [['staging', staging.colliders], ['pr215', defaultHitZoneColliders]] as const) {
        counts[layout][classifyHitZoneByColliders(impact, { x: 0, y: 0, z: 0 }, q, colliders as HitZoneCollider[])]++;
      }
    }
    const rates = Object.fromEntries(Object.entries(counts).map(([layout, hits]) => [layout, {
      head: hits.head / count * 100, body: hits.body / count * 100,
      arms: (hits.leftArm + hits.rightArm) / count * 100,
      legs: (hits.leftLeg + hits.rightLeg) / count * 100,
    }]));
    for (const hits of Object.values(counts)) expect(Object.values(hits).reduce((a, b) => a + b, 0)).toBe(count);
    if (process.env.HITBOX_QA_DIR) {
      mkdirSync(process.env.HITBOX_QA_DIR, { recursive: true });
      writeFileSync(join(process.env.HITBOX_QA_DIR, 'HIT_DISTRIBUTION.json'), JSON.stringify({
        seed: 0x215d157, sampleCount: count, orientationCount: 256,
        method: 'Identical uniform first-contact points on radius 0.42 sphere at world offset (0,-0.35,0); 256 seeded SO(3) actor orientations. Nearest signed-distance collider classification for both layouts; not historical staging heuristic or live aim statistics.',
        stagingSource: staging.source, counts, ratesPercent: rates,
      }, null, 2) + '\n');
    }
  });
});

afterAll(() => {
  results.maxPositionErrorM = Math.max(...zones.map((zone) => perZone[zone].maxPositionErrorM));
  results.maxAngleErrorDeg = Math.max(...zones.map((zone) => perZone[zone].maxAngleErrorDeg));
  if (process.env.HITBOX_QA_DIR) {
    mkdirSync(process.env.HITBOX_QA_DIR, { recursive: true });
    writeFileSync(join(process.env.HITBOX_QA_DIR, 'ORIENTATION_RESULTS.json'), JSON.stringify(results, null, 2) + '\n');
  }
});
