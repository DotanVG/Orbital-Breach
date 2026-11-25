import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { lazyHitSurfaces } from '/src/player/hitSurface.ts';
import { ProjectileSystem } from '/src/game/projectileSystem.ts';
import { PlayerAnimationController, ANIM_FLOAT } from '/src/player/playerAnimationController.ts';
import { applyFloatArmTilt } from '/src/player/playerAimPose.ts';
import { ALIEN_SCALE, ALIEN_OFFSET_Y, ALIEN_OFFSET_Z, ALIEN_ROTATION_Y } from '/src/player/alienTransform.ts';

const loader=new GLTFLoader(),actors=[];
for(let i=0;i<8;i++) {
  // Tiny transforms extracted from the original browser-poses capture:
  // identity rotations, x=-10.5,-7.5,...,10.5; y=z=0.
  const wrapper=new THREE.Group(),animation=new PlayerAnimationController();
  wrapper.position.x=-10.5+i*3;
  for(const asset of ['Alien','Alien_Helmet']) {
    const {scene,animations}=await loader.loadAsync(`/models/${asset}.glb`);
    scene.scale.setScalar(ALIEN_SCALE);scene.position.set(0,ALIEN_OFFSET_Y,ALIEN_OFFSET_Z);scene.rotation.y=ALIEN_ROTATION_Y;
    wrapper.add(scene);animation.registerRig(scene,animations);
  }
  animation.setTargetAnimation(ANIM_FLOAT);animation.tickMixers(1);
  animation.restoreFloatRightArmPose();applyFloatArmTilt(animation.getRigs());wrapper.updateMatrixWorld(true);
  let head;
  wrapper.traverse(node=>{if(!head && node.isBone && node.name==='Head') head=node;});
  if(!head) throw Error('Head bone missing');
  const query=lazyHitSurfaces(wrapper);query.enableDiagnostics?.();
  actors.push({wrapper,animation,head,query});
}

window.runBoneBvhBench=()=>{
  const results={};
  const totals=()=>actors.reduce((sum,a)=>({vertices:sum.vertices+a.query.skinnedVertexCount,triangles:sum.triangles+a.query.candidateTriangleCount,bones:sum.bones+(a.query.boneMatrixUpdateCount??0)}),{vertices:0,triangles:0,bones:0});
  for(const [mode,every] of [['hit',1],['miss',1],['hit',10],['miss',10]]) {
    const system=new ProjectileSystem(new THREE.Scene()),times=[],zones={};
    let actorHits=0,shots=0,before;
    for(let frame=-40;frame<240;frame++) {
      for(const a of actors) {
        a.animation.tickMixers(1/60);a.animation.restoreFloatRightArmPose();applyFloatArmTilt(a.animation.getRigs());a.wrapper.updateMatrixWorld(true);
      }
      const targets=actors.map((a,i)=>({id:String(i),active:true,team:i%2,getSurfaces:a.query}));
      if(frame%every===0) for(let i=0;i<8;i++) {
        const origin=actors[(i+1)%8].head.getWorldPosition(new THREE.Vector3());origin.z-=.4;
        if(mode==='miss') origin.y+=4;
        system.spawn(origin,new THREE.Vector3(0,0,1),i%2,String(i));
        if(frame>=0) shots++;
      }
      if(frame===0) before=totals();
      const start=performance.now();
      system.update(1/60,[],[],targets,()=>{},hit=>{
        if(frame>=0) {actorHits++;zones[hit.zone]=(zones[hit.zone]||0)+1;}
      });
      if(frame>=0) times.push(performance.now()-start);
    }
    const after=totals();system.clear();
    results[`${mode}_every${every}`]={times,zones,actorHits,shots,vertices:after.vertices-before.vertices,triangles:after.triangles-before.triangles,bones:after.bones-before.bones,sampledPadNodes:actors.reduce((n,a)=>n+(a.query.sampledPadNodeCount??0),0)};
  }
  return results;
};
window.ready=true;
