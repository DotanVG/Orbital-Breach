import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { classifyHitZoneByColliders, hitZoneCollidersForPhase, orientationFromSnapshot, quaternionFromYawPitchRoll, type HitZoneCollider } from '../shared/hitZoneColliders';
import { applyHit, classifyHitZone, type SharedPlayerState } from '../shared/player-logic';
import { bodyColliderForPhase } from '../shared/bodyCollider';
import { projectileBodyTarget, projectileRadiusForPhase } from '../shared/projectileCollider';
import { BAR_LAUNCH_CLEARANCE } from '../shared/constants';
import { measureHandGripOffset, BAR_GRIP_LOCAL, applyBarHoldPose } from '../client/src/player/playerGrabPose';
import { integrateZeroG } from '../client/src/physics';
import { classifiedWorldFrame, randomOrientation, seededRandom } from './helpers/hitboxOrientation';
import { sampleAlienPose } from './helpers/alienPose';
import staging from './fixtures/stagingHitZoneColliders.json';
vi.mock('../client/src/net/endpoint', () => ({ getColyseusEndpoint: () => null }));
vi.mock('../client/src/match/simulatedPlayerAvatar', () => ({ SimulatedPlayerAvatar: class {} }));
import { toActorSnapshot } from '../client/src/net/client';
import { snapshotOrientation } from '../client/src/match/onlineMatch';
const zoneBones = {body:['Neck','Torso','Abdomen','Hips'],leftArm:['UpperArmL','LowerArmL','PalmL'],rightArm:['UpperArmR','LowerArmR','PalmR'],leftLeg:['UpperLegL','LowerLegL','FootL'],rightLeg:['UpperLegR','LowerLegR','FootR']};
const poses = new Map<string, Awaited<ReturnType<typeof sampleAlienPose>>>();
beforeAll(async()=>{for(const phase of ['BREACH','FLOATING','GRABBING']) poses.set(phase,await sampleAlienPose(phase));});
const random=seededRandom(0x215f1);
const samples=Array.from({length:256},()=>({phase:'FLOATING',q:randomOrientation(random),pos:new Vector3(random()*20-10,random()*20-10,random()*20-10)}));
const gripQ=quaternionFromYawPitchRoll(1.1,0.4,-0.6), q=new Quaternion(gripQ.x,gripQ.y,gripQ.z,gripQ.w), bar=new Vector3(2,1,-3);
const phys={pos:bar.clone(),vel:new Vector3()};
samples.push({phase:'GRABBING',q:q.clone(),pos:phys.pos.clone()});
const forward=new Vector3(0,0,-1).applyQuaternion(q);
phys.pos.addScaledVector(forward,BAR_LAUNCH_CLEARANCE); phys.vel.copy(forward).multiplyScalar(8);
const spin=new Quaternion().setFromAxisAngle(new Vector3(0.7,1.1,-0.8).normalize(),0.045);
for(let f=0;f<120;f++){integrateZeroG(phys,1/60);q.multiply(spin).normalize();samples.push({phase:'FLOATING',pos:phys.pos.clone(),q:q.clone()});}
const measured:any={orientationCount:samples.length,seed:0x215f1,source:'Actual GLB channels sampled by AnimationMixer; no collider-derived bone bindings.',zones:{}};

describe('independent pose and 377-orientation guard',()=>{
  it('pins the asset, runtime pose and launch/spin sequence',()=>{
    expect(createHash('sha256').update(readFileSync(new URL('../client/public/models/Alien.glb',import.meta.url))).digest('hex')).toBe('5d333be0d7a08fca56823c20bde25642e8332b923ff1cddba3fc42df6841463c');
    expect(samples).toHaveLength(377); expect(samples[257].pos.distanceTo(samples[256].pos)).toBeGreaterThan(BAR_LAUNCH_CLEARANCE);
    expect(samples.at(-1)!.q.angleTo(samples[256].q)).toBeGreaterThan(0.1);
  });
  for(const phase of ['BREACH','FLOATING','GRABBING']) {
    it(phase+': top/front/side projections contain real bones and centre on limb segments',()=>{
      const pose=poses.get(phase)!, table=hitZoneCollidersForPhase(phase);
      for(const [zone,names] of Object.entries(zoneBones)) {
        const c=table.find(c=>c.id===zone)!, pts=names.map(n=>pose.bones.get(n)!);
        const center=pts.reduce((s,p)=>s.add(p),new Vector3()).multiplyScalar(1/pts.length);
        for(const axes of [['x','z'],['x','y'],['z','y']] as const) for(const a of axes) {
          expect(Math.abs(c.position[a]-center[a]),phase+' '+zone+' centroid '+a).toBeLessThanOrEqual(0.03);
          for(const point of pts) expect(Math.abs(point[a]-c.position[a]),zone+' contains '+a).toBeLessThanOrEqual(c.size[a]+0.02);
        }
        measured.zones[phase+':'+zone]={centroidErrorM:center.distanceTo(new Vector3().copy(c.position))};
      }
      const head=table[0], mean=pose.headVertices.reduce((s,p)=>s.add(p),new Vector3()).multiplyScalar(1/pose.headVertices.length);
      expect(mean.distanceTo(new Vector3().copy(head.position))).toBeLessThan(0.03);
      expect(pose.bones.get('Head')!.distanceTo(new Vector3().copy(head.position))).toBeLessThan(head.size.x+0.02);
      const torso=pose.bones.get('Torso')!, body=bodyColliderForPhase(phase);
      for(const axis of ['x','z'] as const) expect(Math.abs(body.center[axis]-torso[axis])).toBeLessThanOrEqual(phase==='BREACH'?0.03:body.half[axis]);
      for(const vertex of pose.vertices) for(const a of ['x','y','z'] as const) expect(Math.abs(vertex[a]-body.center[a])).toBeLessThanOrEqual(body.half[a]+(phase==='FLOATING'?0.03:0.01));
    });
  }
  it('floating body bounds swimming grazes and hit zones still enclose their bones',async()=>{
    const half=bodyColliderForPhase('FLOATING');
    let maxOutside=0;
    const needed={x:0,y:0,z:0};
    const zoneNeeded=Object.fromEntries(Object.keys(zoneBones).map(z=>[z,{x:0,y:0,z:0}]));
    for(let frame=0;frame<=16;frame++) {
      const pose=await sampleAlienPose('FLOATING',frame/8);
      for(const p of pose.vertices) for(const a of ['x','y','z'] as const) {needed[a]=Math.max(needed[a],Math.abs(p[a]-half.center[a]));maxOutside=Math.max(maxOutside,Math.abs(p[a]-half.center[a])-half.half[a]);}
      for(const [zone,names] of Object.entries(zoneBones)) for(const name of names) for(const a of ['x','y','z'] as const) {
        const c=hitZoneCollidersForPhase('FLOATING').find(c=>c.id===zone)!;
        zoneNeeded[zone][a]=Math.max(zoneNeeded[zone][a],Math.abs(pose.bones.get(name)![a]-c.position[a]));
        expect(Math.abs(pose.bones.get(name)![a]-c.position[a])).toBeLessThanOrEqual(c.size[a]+0.02);
      }
    }
    measured.swimmingEnvelopeOutsideM=maxOutside;
    measured.swimmingRequiredHalf=needed; measured.swimmingZoneEnvelope=zoneNeeded;
    expect(maxOutside).toBeLessThanOrEqual(0.03);
  });
  it('frozen world bounds enclose upright/swimming origins and the death crossfade',async()=>{
    const body=bodyColliderForPhase('FROZEN');
    const samples=[poses.get('BREACH')!,poses.get('FLOATING')!];
    for(let i=0;i<=4;i++) samples.push(await sampleAlienPose('FROZEN',i/100));
    for(const pose of samples) for(const p of pose.vertices) for(const a of ['x','y','z'] as const) expect(Math.abs(p[a]-body.center[a])).toBeLessThanOrEqual(body.half[a]+0.01);
  });
  it('both palms stay outside the bar surface, including after 600 stable frames',()=>{
    const pose=poses.get('GRABBING')!, midpoint=BAR_GRIP_LOCAL;
    const before=[...pose.bones].map(([n,p])=>[n,p.toArray()]);
    for(let i=0;i<600;i++) applyBarHoldPose([pose.rig]);
    for(const side of ['L','R'] as const) {
      const p=measureHandGripOffset(pose.root,side)!;
      const palm=pose.root.getObjectByName('Palm'+side)!.getWorldPosition(new Vector3());
      expect(Math.hypot(palm.y-midpoint.y,palm.z-midpoint.z)).toBeGreaterThanOrEqual(0.1);
      expect(Math.hypot(palm.y-midpoint.y,palm.z-midpoint.z)).toBeLessThanOrEqual(0.135);
      expect(p.distanceTo(new Vector3().copy(hitZoneCollidersForPhase('GRABBING').find(c=>c.id==='hand'+side)!.position))).toBeLessThan(0.06);
    }
    pose.root.updateMatrixWorld(true);
    for(const [name,point] of before as [string,number[]][]) expect(pose.root.getObjectByName(name)!.getWorldPosition(new Vector3()).distanceTo(new Vector3(...point))).toBeLessThan(1e-8);
    measured.palms= ['L','R'].map(side=>measureHandGripOffset(pose.root,side as 'L'|'R')!.distanceTo(midpoint));
  });
  it('all zone frames rigidly attach across 377 orientations and classify matching impacts',()=>{
    for(const {pos,q,phase} of samples) {
      const pose=poses.get(phase)!, root=new Matrix4().compose(pos,q,new Vector3(1,1,1));
      for(const c of hitZoneCollidersForPhase(phase)) {
        const actual=classifiedWorldFrame(pos,q).multiply(new Matrix4().makeTranslation(c.position.x,c.position.y,c.position.z));
        const expected=root.clone().multiply(new Matrix4().makeTranslation(c.position.x,c.position.y,c.position.z));
        expect(new Vector3().setFromMatrixPosition(actual).distanceTo(new Vector3().setFromMatrixPosition(expected))).toBeLessThan(1e-8);
        expect(new Quaternion().setFromRotationMatrix(actual).angleTo(q)).toBeLessThan(1e-6);
        const point=new Vector3().copy(c.position).applyQuaternion(q).add(pos);
        expect(classifyHitZone(point,pos,q,undefined,undefined,phase),phase+' '+c.id).toBe(c.zone);
      }
      // Independent F1: transformed arm-bone laterality, not collider-derived binds.
      const left=pose.bones.get('UpperArmL')!.clone().applyMatrix4(root),right=pose.bones.get('UpperArmR')!.clone().applyMatrix4(root);
      for(const side of ['leftArm','rightArm']) {
        const c=hitZoneCollidersForPhase(phase).find(c=>c.id===side)!;
        const center=new Vector3().copy(c.position).applyMatrix4(root);
        expect(center.distanceTo(side==='leftArm'?left:right)).toBeLessThan(center.distanceTo(side==='leftArm'?right:left));
      }
    }
    measured.F1='PASS'; measured.rigidAttachment='PASS';
  });
  it('left-arm damage drops the grip and right-arm damage preserves it',()=>{
    for(const {pos,q} of samples) for(const side of ['leftArm','rightArm'] as const){
      const c=hitZoneCollidersForPhase('GRABBING').find(c=>c.id===side)!;
      const point=new Vector3().copy(c.position).applyQuaternion(q).add(pos);
      const state:SharedPlayerState={phase:'GRABBING',grabbedBarPos:{x:2,y:1,z:-3},launchPower:8,deaths:0,vel:{x:0,y:0,z:0},damage:{frozen:false,leftArm:false,rightArm:false,leftLeg:false,rightLeg:false}};
      const zone=classifyHitZone(point,pos,q,undefined,undefined,state.phase); expect(zone).toBe(side);
      expect(applyHit(state,zone,{x:0,y:0,z:0})).toBe(false);
      expect(state.phase).toBe(side==='leftArm'?'FLOATING':'GRABBING'); expect(state.grabbedBarPos===null).toBe(side==='leftArm');
    }
    measured.grabDrop='PASS';
  });
  it('L1: both production snapshot adapters fall back to yaw for missing/invalid orientation',()=>{
    for(const missing of [{},{orientX:undefined},{orientX:0},{orientX:0,orientY:0,orientZ:0,orientW:0},{orientX:NaN,orientY:0,orientZ:0,orientW:1}]){
      const raw={yaw:Math.PI,...missing};
      for(const q of [orientationFromSnapshot(raw),snapshotOrientation(raw),snapshotOrientation(toActorSnapshot(raw))]) expect(q).toMatchObject(quaternionFromYawPitchRoll(Math.PI));
    }
    for(const {q} of samples){const out=snapshotOrientation(toActorSnapshot({phase:"FLOATING",yaw:2.3,orientX:q.x,orientY:q.y,orientZ:q.z,orientW:q.w}));expect(out.angleTo(q)).toBeLessThan(1e-6);}
    expect(snapshotOrientation({phase:'BREACH',yaw:Math.PI,orientX:0,orientY:0,orientZ:0,orientW:1})).toMatchObject(quaternionFromYawPitchRoll(Math.PI));
    measured.L1='PASS';
  });
  it('broadphase encloses every zone at every orientation with a rotated centre',()=>{
    for(const {pos,q,phase} of [...samples,{pos:new Vector3(2,3,4),q:new Quaternion(),phase:'BREACH'}]){
      const sphere=projectileBodyTarget(pos,q,phase);
      const expected=new Vector3().copy(bodyColliderForPhase(phase).center).applyQuaternion(q).add(pos);
      expect(expected.distanceTo(new Vector3().copy(sphere.center))).toBeLessThan(1e-9);
      for(const c of hitZoneCollidersForPhase(phase)) for(const x of [-1,1]) for(const y of [-1,1]) for(const z of [-1,1]){
        const corner=c.shape==='sphere'?new Vector3(x,y,z).normalize().multiplyScalar(c.size.x):new Vector3(x*c.size.x,y*c.size.y,z*c.size.z);
        const point=corner.add(c.position).applyQuaternion(q).add(pos);
        expect(point.distanceTo(expected)).toBeLessThanOrEqual(sphere.radius+1e-8);
      }
    }
  });
});

describe('seeded uniform sphere contact distribution',()=>{
  it('reports staging versus each production v2 pose without tuning targets',()=>{
    const count=60000, rng=seededRandom(0x215d157), layouts=['staging','BREACH','FLOATING','GRABBING'];
    const counts=Object.fromEntries(layouts.map(k=>[k,{head:0,body:0,leftArm:0,rightArm:0,leftLeg:0,rightLeg:0}]));
    for(let i=0;i<count;i++){
      const y=2*rng()-1, theta=2*Math.PI*rng(),r=Math.sqrt(1-y*y), n=new Vector3(r*Math.cos(theta),y,r*Math.sin(theta)), q=samples[i%256].q;
      for(const layout of layouts){
        const center=layout==='staging'?new Vector3(0,-0.35,0):new Vector3().copy(bodyColliderForPhase(layout).center).applyQuaternion(q);
        const radius=layout==='staging'?0.42:projectileRadiusForPhase(layout);
        const impact=n.clone().multiplyScalar(radius).add(center);
        const table=layout==='staging'?staging.colliders as HitZoneCollider[]:hitZoneCollidersForPhase(layout);
        counts[layout][classifyHitZoneByColliders(impact,{x:0,y:0,z:0},q,table)]++;
      }
    }
    const rates=Object.fromEntries(Object.entries(counts).map(([k,h])=>[k,{head:100*h.head/count,body:100*h.body/count,arms:100*(h.leftArm+h.rightArm)/count,legs:100*(h.leftLeg+h.rightLeg)/count}]));
    for(const h of Object.values(counts)) expect(Object.values(h).reduce((a,b)=>a+b,0)).toBe(count);
    if(process.env.HITBOX_QA_DIR) writeFileSync(join(process.env.HITBOX_QA_DIR,'HIT_DISTRIBUTION.json'),JSON.stringify({seed:0x215d157,sampleCount:count,orientationCount:256,method:'Uniform world-space first-contact normals; same seed and 256 Haar SO(3) orientations. Each layout uses its own production broadphase centre/radius. Nearest signed distance, not live aim or historical heuristic.',stagingSource:staging.source,counts,ratesPercent:rates},null,2));
  });
});
afterAll(()=>{if(process.env.HITBOX_QA_DIR){mkdirSync(process.env.HITBOX_QA_DIR,{recursive:true});writeFileSync(join(process.env.HITBOX_QA_DIR,'ORIENTATION_RESULTS.json'),JSON.stringify(measured,null,2));}});
