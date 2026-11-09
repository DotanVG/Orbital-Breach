import { beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Box3, Group, Line3, Quaternion, SkinnedMesh, Vector3 } from 'three';
import { BAR_LENGTH, BAR_RADIUS } from '../shared/constants';
import { bodyColliderForPhase } from '../shared/bodyCollider';
import { hitZoneCollidersForPhase } from '../shared/hitZoneColliders';
import { projectileRadiusForPhase } from '../shared/projectileCollider';
import { applyBarHoldPose, BAR_GRIP_LOCAL, barHoldQuaternion } from '../client/src/player/playerGrabPose';
import { sampleAlienPose } from './helpers/alienPose';

const directions = [new Vector3(1,0,0),new Vector3(-1,0,0),new Vector3(0,1,0),new Vector3(0,-1,0),new Vector3(0,0,1),new Vector3(0,0,-1),new Vector3(1,2,3).normalize()];
const orientations = [new Quaternion(),new Quaternion().setFromAxisAngle(new Vector3(1,2,3).normalize(),1.7),new Quaternion().setFromAxisAngle(new Vector3(0,0,1),Math.PI/2)];
let pose: Awaited<ReturnType<typeof sampleAlienPose>>;
const measurements: object[] = [];
beforeAll(async()=>{
  pose = await sampleAlienPose('GRABBING');
  if(process.env.BAR_HANG_QA_DIR) {
    mkdirSync(process.env.BAR_HANG_QA_DIR,{recursive:true});
    writeFileSync(join(process.env.BAR_HANG_QA_DIR,'HANG_RIG_SAMPLE.json'),JSON.stringify({bones:Object.fromEntries(pose.bones),bounds:new Box3().setFromPoints([...pose.vertices,...pose.helmetVertices]),headMean:pose.headVertices.reduce((s,p)=>s.add(p),new Vector3()).divideScalar(pose.headVertices.length)},null,2));
  }
});

describe('real GLB hang clearance (A1–A3)',()=>{
  for (const [di,direction] of directions.entries()) for (const [qi,preferred] of orientations.entries()) {
    it(`A1–A3: bar direction ${di}, visual orientation ${qi}`,()=>{
      const q=barHoldQuaternion(preferred,direction), up=new Vector3(0,1,0).applyQuaternion(q);
      expect(new Vector3(1,0,0).applyQuaternion(q).distanceTo(direction)).toBeLessThan(1e-8);
      const tip=new Vector3(2,-1.4,-19.5), anchor=tip.clone().sub(BAR_GRIP_LOCAL.clone().applyQuaternion(q));
      const world=(v:Vector3)=>v.clone().applyQuaternion(q).add(anchor);
      // Same finite segment as CylinderGeometry: grab tip is 2.5 cm inside its cap.
      const end=tip.clone().addScaledVector(direction,BAR_RADIUS*.25);
      const start=end.clone().addScaledVector(direction,-BAR_LENGTH), segment=new Line3(start,end);
      const distance=(v:Vector3)=>v.distanceTo(segment.closestPointToPoint(v,true,new Vector3()));
      const axisDistance=(v:Vector3)=>v.distanceTo(segment.closestPointToPoint(v,false,new Vector3()));
      const headUp=world(pose.bones.get('Head')!).dot(up);
      const helmetTop=Math.max(...pose.helmetHeadVertices.map(v=>world(v).dot(up)));
      const hands: Record<string,object>={};
      for(const side of ['L'] as const) {
        expect(pose.handVertices[side].length).toBeGreaterThan(100);
        const handMin=Math.min(...pose.handVertices[side].map(v=>axisDistance(world(v))));
        expect(handMin).toBeGreaterThanOrEqual(BAR_RADIUS);
        expect(handMin-BAR_RADIUS).toBeLessThanOrEqual(.03);
        const palm=world(pose.bones.get(`Palm${side}`)!), palmRadius=axisDistance(palm);
        expect(palmRadius).toBeGreaterThanOrEqual(BAR_RADIUS);
        expect(palmRadius).toBeLessThanOrEqual(BAR_RADIUS+.03);
        const along=palm.clone().sub(start).dot(direction);
        expect(along).toBeGreaterThanOrEqual(0); expect(along).toBeLessThanOrEqual(BAR_LENGTH);
        const tips=[...pose.bones].filter(([name])=>new RegExp(`(Finger4|Thumb3)${side}$`).test(name));
        expect(tips.length).toBeGreaterThan(0);
        const tipMin=Math.min(...tips.map(([,v])=>axisDistance(world(v))));
        expect(tipMin).toBeGreaterThanOrEqual(BAR_RADIUS-.02);
        const curlAngles=[1,2,3,4].map(i=>pose.bones.get(`MiddleFinger${i}${side}`)!).map(v=>Math.atan2(v.z-BAR_GRIP_LOCAL.z,BAR_GRIP_LOCAL.y-v.y));
        for(let i=1;i<curlAngles.length;i++) expect(curlAngles[i]).toBeGreaterThan(curlAngles[i-1]);
        const palmAboveHead=palm.dot(up)-headUp;
        expect(palmAboveHead).toBeGreaterThan(0);
        expect(palm.dot(up)).toBeLessThan(tip.dot(up)); // palms on the body-facing surface
        hands[side]={vertexCount:pose.handVertices[side].length,minMeshAxisM:handMin,meshSurfaceGapM:handMin-BAR_RADIUS,palmBoneAxisM:palmRadius,palmAlongSegmentM:along,fingertipAxisM:tipMin,palmAboveHeadM:palmAboveHead,curlAnglesRad:curlAngles};
      }
      // The right hand and its gun keep aiming, well away from the rail.
      const rightPalm = axisDistance(world(pose.bones.get('PalmR')!));
      expect(rightPalm - BAR_RADIUS).toBeGreaterThan(.10);
      expect(Math.min(...pose.handVertices.R.map(v => distance(world(v)))) - BAR_RADIUS).toBeGreaterThan(.10);
      expect(pose.helmetVertices).toHaveLength(9920); // entire helmet asset, including its body/gloves
      expect(pose.headVertices.length).toBeGreaterThan(100);
      const headMin=Math.min(...pose.headVertices.map(v=>distance(world(v))));
      const helmetMin=Math.min(...pose.helmetVertices.map(v=>distance(world(v))));
      expect(headMin).toBeGreaterThanOrEqual(BAR_RADIUS+.02);
      expect(helmetMin).toBeGreaterThanOrEqual(BAR_RADIUS); // helmet asset also includes the gripping glove
      expect(Math.min(...pose.helmetHeadVertices.map(v=>distance(world(v))))).toBeGreaterThanOrEqual(BAR_RADIUS+.02);
      const head=hitZoneCollidersForPhase('GRABBING').find(c=>c.id==='head')!;
      const sphereDistance=distance(world(new Vector3().copy(head.position)));
      expect(sphereDistance).toBeGreaterThan(BAR_RADIUS+head.size.x);
      const barAboveHelmet=tip.dot(up)-helmetTop;
      expect(barAboveHelmet-BAR_RADIUS).toBeGreaterThan(0);
      measurements.push({direction:direction.toArray(),preferred:preferred.toArray(),hands,headVertexSegmentM:headMin,helmetVertexSegmentM:helmetMin,headSphereSegmentM:sphereDistance,headSphereRadiusM:head.size.x,headSphereBarGapM:sphereDistance-head.size.x-BAR_RADIUS,barAxisAboveHelmetTopM:barAboveHelmet,barBottomAboveHelmetTopM:barAboveHelmet-BAR_RADIUS});
    });
  }
  it('fits the complete hang mesh and contains every zone bone, on both client/server phases',async()=>{
    for(const phase of ['GRABBING','AIMING']) {
      const p=phase==='GRABBING'?pose:await sampleAlienPose(phase);
      const b=bodyColliderForPhase(phase), bounds=new Box3().setFromPoints([...p.vertices,...p.helmetVertices]);
      const gaps: number[]=[];
      for(const a of ['x','y','z'] as const) {
        gaps.push(bounds.min[a]-(b.center[a]-b.half[a]),b.center[a]+b.half[a]-bounds.max[a]);
      }
      for(const gap of gaps) {expect(gap).toBeGreaterThanOrEqual(-.03);expect(gap).toBeLessThanOrEqual(.03);}
      const groups={head:['Head'],body:['Neck','Torso','Abdomen','Hips'],leftArm:['UpperArmL','LowerArmL','PalmL'],rightArm:['UpperArmR','LowerArmR','PalmR'],leftLeg:['UpperLegL','LowerLegL','FootL'],rightLeg:['UpperLegR','LowerLegR','FootR'],handL:[...p.bones.keys()].filter(n=>/^(Palm|.*Finger[1-4]|Thumb[1-3])L$/.test(n)),handR:[...p.bones.keys()].filter(n=>/^(Palm|.*Finger[1-4]|Thumb[1-3])R$/.test(n))};
      for(const c of hitZoneCollidersForPhase(phase)) {
        for(const name of groups[c.id as keyof typeof groups]) {
          const bone=p.bones.get(name)!;
          if(c.shape==='sphere') expect(bone.distanceTo(new Vector3().copy(c.position))).toBeLessThanOrEqual(c.size.x);
          else for(const a of ['x','y','z'] as const) expect(Math.abs(bone[a]-c.position[a]),`${c.id} ${name} ${a}`).toBeLessThanOrEqual(c.size[a]);
        }
      }
      measurements.push({phase,body:b,meshFaceGapsM:gaps,zones:hitZoneCollidersForPhase(phase),broadphaseRadiusM:projectileRadiusForPhase(phase)});
    }
    if(process.env.BAR_HANG_QA_DIR) {
      mkdirSync(process.env.BAR_HANG_QA_DIR,{recursive:true});
      writeFileSync(join(process.env.BAR_HANG_QA_DIR,'BAR_HANG_RESULTS.json'),JSON.stringify(measurements,null,2));
    }
  });
  it('keeps body and helmet rigs stable under a translated, rolled parent',()=>{
    const parent=new Group(); parent.position.set(8,-3,11); parent.quaternion.copy(orientations[1]);
    parent.add(pose.root,pose.helmetRoot);
    for(let frame=0;frame<60;frame++) applyBarHoldPose([pose.rig,pose.helmetRig!]);
    for(const [name,point] of pose.bones) {
      const actual=parent.worldToLocal(pose.root.getObjectByName(name)!.getWorldPosition(new Vector3()));
      expect(actual.distanceTo(point),name).toBeLessThan(1e-5);
      const helmet=parent.worldToLocal(pose.helmetRoot.getObjectByName(name)!.getWorldPosition(new Vector3()));
      expect(helmet.distanceTo(point),name+' helmet parity').toBeLessThan(1e-5);
    }
    // Like the renderer, updateMatrixWorld also refreshes SkinnedMesh.bindMatrixInverse.
    parent.updateMatrixWorld(true);
    for(const [root,vertices] of [[pose.root,pose.vertices],[pose.helmetRoot,pose.helmetVertices]] as const) {
      let index=0;
      root.traverse(node=>{
        if(!(node instanceof SkinnedMesh)) return;
        node.skeleton.update();
        for(let i=0;i<node.geometry.attributes.position.count;i++) {
          const actual=parent.worldToLocal(node.getVertexPosition(i,new Vector3()).applyMatrix4(node.matrixWorld));
          expect(actual.distanceTo(vertices[index++])).toBeLessThan(1e-5);
        }
      });
      expect(index).toBe(vertices.length);
    }
  });
});
