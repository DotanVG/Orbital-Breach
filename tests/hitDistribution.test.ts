import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Vector3 } from 'three';
import { bodyColliderForPhase } from '../shared/bodyCollider';
import { classifyHitZoneByColliders, hitZoneCollidersForPhase, type HitZoneCollider } from '../shared/hitZoneColliders';
import { projectileBodyTarget } from '../shared/projectileCollider';
import { segmentSphereHitPoint } from '../client/src/game/projectileActorCollision';
import { randomOrientation, seededRandom } from './helpers/hitboxOrientation';
import baseline from './fixtures/hitZones36f81cc.json';

const zones = ['head','body','leftArm','rightArm','leftLeg','rightLeg'] as const;
const phases = ['BREACH','FLOATING','GRABBING'] as const;
// +/-3 percentage points (12-18%) allows pose occlusion and asymmetric pistol/
// grip anatomy, rather than pretending all four limbs have equal silhouettes.
// 60,000 shots gives <0.3 pp 95% binomial sampling error near 15%; the tolerance
// is a gameplay allowance, not sampling noise. No zone weighting or relabeling.
const shots = 60000, seed = 0x124126;

describe('deterministic production sphere-contact hit shares', () => {
  it('keeps head <=40% and each limb at 15% +/-3 pp in every active pose', () => {
    expect(baseline.source).toMatch(/^36f81cc[0-9a-f]{33}$/);
    const results: Record<string, unknown> = {};
    for (const phase of phases) {
      const rng=seededRandom(seed), orientations=Array.from({length:256},()=>randomOrientation(rng));
      const counts=Object.fromEntries(['before','after'].map(v=>[v,Object.fromEntries(zones.map(z=>[z,0]))]));
      for(let i=0;i<shots;i++) {
        const q=orientations[i%orientations.length], playerPos=new Vector3(2,-3,4);
        const z=rng()*2-1, azimuth=rng()*2*Math.PI, r=Math.sqrt(1-z*z);
        const direction=new Vector3(r*Math.cos(azimuth),r*Math.sin(azimuth),z);
        const u=new Vector3().crossVectors(direction,Math.abs(z)<.9?new Vector3(0,0,1):new Vector3(0,1,0)).normalize();
        const v=new Vector3().crossVectors(direction,u), diskRadius=Math.sqrt(rng()), angle=rng()*Math.PI*2;
        for(const version of ['before','after'] as const) {
          const table=version==='before'?baseline[phase] as HitZoneCollider[]:hitZoneCollidersForPhase(phase);
          const localCenter=bodyColliderForPhase(phase).center;
          const radius=version==='after'?projectileBodyTarget(playerPos,q,phase).radius:Math.max(...table.map(c=>
            new Vector3().copy(c.position).distanceTo(localCenter)+(c.shape==='sphere'?c.size.x:Math.hypot(c.size.x,c.size.y,c.size.z))));
          const center=new Vector3().copy(localCenter).applyQuaternion(q).add(playerPos);
          const offset=u.clone().multiplyScalar(Math.cos(angle)*diskRadius*radius).addScaledVector(v,Math.sin(angle)*diskRadius*radius);
          const start=center.clone().add(offset).addScaledVector(direction,-radius-4);
          const end=center.clone().add(offset).addScaledVector(direction,radius+4);
          const impact=segmentSphereHitPoint(start,end,center,radius)!;
          expect(impact).not.toBeNull();
          counts[version][classifyHitZoneByColliders(impact,playerPos,q,table)]++;
        }
      }
      const shares=Object.fromEntries(Object.entries(counts).map(([v,hits])=>[v,Object.fromEntries(zones.map(z=>[z,hits[z]*100/shots]))]));
      console.log(phase+' hit shares (%) BEFORE / AFTER',shares);
      expect(Object.values(counts.before).reduce((a,b)=>a+b,0)).toBe(shots);
      expect(Object.values(counts.after).reduce((a,b)=>a+b,0)).toBe(shots);
      expect(shares.after.head).toBeLessThanOrEqual(40);
      expect(shares.after.body).toBeGreaterThan(2);
      for(const zone of zones.slice(2)) expect(shares.after[zone],phase+' '+zone).toBeGreaterThanOrEqual(12);
      for(const zone of zones.slice(2)) expect(shares.after[zone],phase+' '+zone).toBeLessThanOrEqual(18);
      results[phase]={counts,sharesPercent:shares};
    }
    if(process.env.HIT_SHARE_QA_DIR) {
      mkdirSync(process.env.HIT_SHARE_QA_DIR,{recursive:true});
      writeFileSync(join(process.env.HIT_SHARE_QA_DIR,'HIT_SHARES.json'),JSON.stringify({baselineCommit:baseline.source,shotsPerPose:shots,seed,orientationCount:256,limbTolerancePercentagePoints:3,method:'Isotropic directions, uniform projected-disk aim offsets; identical normalized shots at each production sphere, actual segmentSphereHitPoint then nearest signed-distance zone. Synthetic exposure, not live player aim.',results},null,2));
    }
  },30000);
});
