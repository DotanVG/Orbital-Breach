import * as THREE from 'three';
import { GRAB_RADIUS } from '../../../shared/constants';
import { bodyPartsForPhase } from '../../../shared/bodyParts';
import { hitZoneCollidersForPhase, IDENTITY_QUATERNION, type QuaternionLike, type HitZoneCollider } from '../../../shared/hitZoneColliders';
import type { Arena } from '../arena/arena';
import { buildMesh } from './colliderEditor';
interface DebugActor { position: {x:number;y:number;z:number}; orientation?: QuaternionLike; phase?: string }
interface ActorMeshes { root: THREE.Group; bodies: THREE.Mesh[]; reach: THREE.Mesh; label: THREE.Sprite; zones: THREE.Mesh[]; source?: readonly HitZoneCollider[] }
export class CollisionVisualizer {
  private visible=false;
  private group=new THREE.Group();
  private staticObjects: THREE.Box3Helper[]=[];
  private actors: ActorMeshes[]=[];
  public constructor(private scene: THREE.Scene) { this.group.visible=false; scene.add(this.group); }
  public isVisible(): boolean { return this.visible; }
  public setVisible(v: boolean): void { this.visible=v; this.group.visible=v; }
  public toggle(): void { this.setVisible(!this.visible); }
  public onLayoutLoaded(arena: Arena): void {
    this.clearStatic();
    for(const [boxes,color] of [[arena.getPlayerCollisionAABBs(),0xff3333],[arena.getObstacleBulletAABBs(),0xff8800],[arena.getObstacleAABBs(),0xffffff],[arena.getArenaWallAABBs(),0x3388ff],[arena.getBreachRoomWallAABBs(),0x00ffff]] as const) {
      for(const box of boxes) { const h=new THREE.Box3Helper(box,new THREE.Color(color)); this.group.add(h); this.staticObjects.push(h); }
    }
  }
  public updateActors(actors: DebugActor[]): void {
    while(this.actors.length>actors.length) this.removeActor();
    while(this.actors.length<actors.length) {
      const root=new THREE.Group();
      const bodies=Array.from({length:6},()=>new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0x00ff44,wireframe:true,depthTest:false})));
      const reach=new THREE.Mesh(new THREE.SphereGeometry(GRAB_RADIUS,16,8),new THREE.MeshBasicMaterial({color:0xffff00,wireframe:true,transparent:true,opacity:0.08,depthWrite:false}));
      reach.name='grab reach';
      const canvas=document.createElement('canvas'); canvas.width=256; canvas.height=32;
      const ctx=canvas.getContext('2d')!; ctx.fillStyle='#ffff66'; ctx.font='20px monospace'; ctx.fillText('grab reach (3 m)',4,24);
      const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthTest:false}));
      label.scale.set(1.8,0.225,1);
      root.add(...bodies); this.group.add(root,reach,label); this.actors.push({root,bodies,reach,label,zones:[]});
    }
    actors.forEach((actor,i)=>{
      const a=this.actors[i], parts=bodyPartsForPhase(actor.phase), source=hitZoneCollidersForPhase(actor.phase);
      a.root.position.copy(actor.position); a.root.quaternion.copy(actor.orientation??IDENTITY_QUATERNION);
      a.bodies.forEach((mesh,j)=>{const p=parts[j];mesh.position.copy(p.center);mesh.scale.set(p.half.x*2,p.half.y*2,p.half.z*2);mesh.name=p.zone+' world';});
      a.reach.position.copy(actor.position); a.label.position.copy(actor.position); a.label.position.y+=GRAB_RADIUS;
      if(a.source!==source) {
        for(const mesh of a.zones) { a.root.remove(mesh); disposeMesh(mesh); }
        a.zones=source.map(c=>{ const m=buildMesh(c); m.position.copy(c.position); m.rotation.set(c.rotation.x,c.rotation.y,c.rotation.z,'YXZ'); m.name=c.id; (m.material as THREE.MeshBasicMaterial).depthTest=false; a.root.add(m); return m; });
        a.source=source;
      }
    });
  }
  public dispose(): void { this.clearStatic(); while(this.actors.length) this.removeActor(); this.scene.remove(this.group); }
  private removeActor(): void {
    const a=this.actors.pop()!; this.group.remove(a.root,a.reach,a.label);
    for(const m of [...a.bodies,a.reach,...a.zones]) disposeMesh(m);
    (a.label.material as THREE.SpriteMaterial).map?.dispose(); (a.label.material as THREE.SpriteMaterial).dispose();
  }
  private clearStatic(): void { for(const h of this.staticObjects) { this.group.remove(h); h.geometry.dispose(); (h.material as THREE.Material).dispose(); } this.staticObjects=[]; }
}
function disposeMesh(m: THREE.Mesh): void { m.geometry.dispose(); for(const mat of Array.isArray(m.material)?m.material:[m.material]) mat.dispose(); }
