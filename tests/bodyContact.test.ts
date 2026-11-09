import { beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Box3, Quaternion, Vector3 } from 'three';
import { bodyColliderForPhase, bodySubsteps, bodyWorldBounds, type BodyCollider } from '../shared/bodyCollider';
import { bounceAgainstBoxes } from '../client/src/arena/obstacleCollision';
import { sampleAlienPose } from './helpers/alienPose';

const axes = ['x', 'y', 'z'] as const;
const before: Record<string, BodyCollider> = {
  FLOATING: { center: { x: 0, y: -0.535, z: 0.21 }, half: { x: 0.32, y: 0.235, z: 0.37 } },
  FROZEN: { center: { x: 0, y: -0.4, z: 0.2 }, half: { x: 0.32, y: 0.4, z: 0.38 } },
  GRABBING: { center: { x: 0, y: -0.3455, z: 0.33 }, half: { x: 0.12, y: 0.2965, z: 0.23 } },
};
type Pose = Awaited<ReturnType<typeof sampleAlienPose>>;
const poses: Record<string, Pose[]> = { FLOATING: [], FROZEN: [], GRABBING: [] };

// Reproduce real animation channels, including the entire 0.16 s freeze blend.
// Two seconds cover more than a complete swimming loop; no renderer is involved.
beforeAll(async () => {
  poses.GRABBING.push(await sampleAlienPose('GRABBING'));
  for (let i = 0; i <= 128; i++) poses.FLOATING.push(await sampleAlienPose('FLOATING', i / 64));
  for (const origin of ['BREACH', 'GRABBING', 'FLOATING']) {
    for (let frame = 0; frame <= (origin === 'FLOATING' ? 32 : 0); frame++) {
      for (let blend = 0; blend <= 10; blend++) {
        poses.FROZEN.push(await sampleAlienPose('FROZEN', blend * 0.016, origin, frame / 16));
      }
    }
  }
  if (process.env.BODY_QA_DIR) {
    const measurements: Record<string, unknown> = {};
    for (const phase of ['FLOATING', 'FROZEN', 'GRABBING']) {
      const versions: Record<string, unknown> = {};
      for (const [name, body] of Object.entries({ before: before[phase], after: bodyColliderForPhase(phase) })) {
        versions[name] = Object.fromEntries(axes.map(axis => {
          const negative = poses[phase].map(p => p.bounds.min[axis] - (body.center[axis] - body.half[axis]));
          const positive = poses[phase].map(p => body.center[axis] + body.half[axis] - p.bounds.max[axis]);
          const gaps = [...negative, ...positive];
          const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
          return [axis, { negativeMeanGapM: mean(negative), positiveMeanGapM: mean(positive),
            meanClearanceM: mean(gaps.map(g => Math.max(0, g))), maxClearanceM: Math.max(...gaps),
            maxPenetrationM: Math.max(0, -Math.min(...gaps)) }];
        }));
      }
      measurements[phase] = { samples: poses[phase].length, body: bodyColliderForPhase(phase), ...versions };
    }
    mkdirSync(process.env.BODY_QA_DIR, { recursive: true });
    writeFileSync(join(process.env.BODY_QA_DIR, 'BODY_CONTACT_RESULTS.json'), JSON.stringify(measurements, null, 2));
  }
}, 120000);

describe('CPU-skinned mesh contact with axis-aligned obstacle faces', () => {
  for (const phase of ['FLOATING', 'FROZEN', 'GRABBING']) for (const axis of axes) {
    it(`${phase} ${axis}: resolves the box flush with either face and bounds mesh penetration`, () => {
      const body = bodyColliderForPhase(phase), clearances: number[] = [];
      for (const sign of [-1, 1]) {
        const obstacle = new Box3(new Vector3(-2, -2, -2), new Vector3(2, 2, 2));
        // Start 1 cm inside each expanded obstacle face, with the body centred on
        // its other two axes. Real client resolution must remove that overlap.
        const center = new Vector3(); center[axis] = sign * (2 + body.half[axis] - 0.01);
        const state = { pos: center.sub(body.center), vel: new Vector3() };
        state.vel[axis] = -sign * 20;
        bounceAgainstBoxes(state, [obstacle], new Quaternion(), phase);
        const resolved = bodyWorldBounds(state.pos, new Quaternion(), phase);
        expect(sign * resolved.center[axis] - resolved.half[axis]).toBeCloseTo(2, 10);
        for (const pose of poses[phase]) {
          const meshSupport = sign === 1 ? pose.bounds.min[axis] : pose.bounds.max[axis];
          const gap = sign * (state.pos[axis] + meshSupport) - 2;
          expect(gap, `${phase} ${axis} face ${sign}`).toBeGreaterThanOrEqual(phase === 'FLOATING' ? -0.030001 : -1e-8);
          clearances.push(Math.max(0, gap));
          if (phase === 'GRABBING') expect(gap).toBeLessThanOrEqual(0.02);
          const core = new Box3().setFromPoints(pose.coreVertices);
          expect(core.min[axis]).toBeGreaterThanOrEqual(body.center[axis] - body.half[axis] - 1e-8);
          expect(core.max[axis]).toBeLessThanOrEqual(body.center[axis] + body.half[axis] + 1e-8);
        }
      }
      // Mean positive clearance across sampled frames AND opposing faces of this
      // axis. Never cancel empty space with negative (penetrating) samples.
      if (phase === 'FLOATING') expect(clearances.reduce((a, b) => a + b, 0) / clearances.length).toBeLessThanOrEqual(0.03);
    });
  }
  it('swim substeps follow half the new smallest half-extent at maximum speed', () => {
    const body = bodyColliderForPhase('FLOATING');
    for (const dt of [1 / 60, 1 / 20, 0.25, 1]) {
      const count = bodySubsteps({ x: 20, y: 0, z: 0 }, dt, 'FLOATING');
      expect(20 * dt / count).toBeLessThanOrEqual(Math.min(body.half.x, body.half.y, body.half.z) / 2);
    }
  });
});
