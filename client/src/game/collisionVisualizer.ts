import * as THREE from "three";
import { ACTOR_COLLISION_RADIUS, PLAYER_RADIUS } from "../../../shared/constants";
import type { Arena } from "../arena/arena";

const COL_OBSTACLE_FULL   = 0xff3333; // red   — full AABB (camera)
const COL_OBSTACLE_PLAYER = 0xffff00; // yellow — player-bounce AABB
const COL_OBSTACLE_BULLET = 0xff8800; // orange — bullet AABB
const COL_ARENA_WALL      = 0x3388ff; // blue   — arena walls
const COL_BREACH_ROOM     = 0xff44ff; // magenta — breach room walls
const COL_ACTOR_PHYSICS   = 0x00ff44; // green  — player/bot PLAYER_RADIUS sphere
const COL_ACTOR_COLLISION = 0x00ffff; // cyan   — actor-actor ACTOR_COLLISION_RADIUS sphere
const COL_GRAB_BAR        = 0xffff88; // yellow-white — grab bar point

const SPHERE_SEGS = 8;
const BAR_VIS_RADIUS = 0.12;

function makeSphereMesh(radius: number, color: number): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, SPHERE_SEGS, SPHERE_SEGS / 2);
  const mat = new THREE.MeshBasicMaterial({ color, wireframe: true });
  return new THREE.Mesh(geo, mat);
}

function makeBox3Helper(box: THREE.Box3, color: number): THREE.Box3Helper {
  return new THREE.Box3Helper(box, new THREE.Color(color));
}

export class CollisionVisualizer {
  private visible = false;
  private group = new THREE.Group();

  // Static objects rebuilt on layout load
  private staticObjects: THREE.Object3D[] = [];

  // Dynamic actor spheres (player + bots), two per actor (physics + collision)
  private actorPhysMeshes: THREE.Mesh[] = [];
  private actorCollMeshes: THREE.Mesh[] = [];

  public constructor(private scene: THREE.Scene) {
    this.group.visible = false;
    scene.add(this.group);
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public toggle(): void {
    this.visible = !this.visible;
    this.group.visible = this.visible;
  }

  public onLayoutLoaded(arena: Arena): void {
    this.clearStatic();

    for (const box of arena.getObstacleAABBs()) {
      this.addStatic(makeBox3Helper(box, COL_OBSTACLE_FULL));
    }
    for (const box of arena.getPlayerCollisionAABBs()) {
      this.addStatic(makeBox3Helper(box, COL_OBSTACLE_PLAYER));
    }
    for (const box of arena.getObstacleBulletAABBs()) {
      this.addStatic(makeBox3Helper(box, COL_OBSTACLE_BULLET));
    }
    for (const box of arena.getArenaWallAABBs()) {
      this.addStatic(makeBox3Helper(box, COL_ARENA_WALL));
    }
    for (const box of arena.getBreachRoomWallAABBs()) {
      this.addStatic(makeBox3Helper(box, COL_BREACH_ROOM));
    }
    for (const pos of arena.getAllBarGrabPoints()) {
      const mesh = makeSphereMesh(BAR_VIS_RADIUS, COL_GRAB_BAR);
      mesh.position.copy(pos);
      this.addStatic(mesh);
    }
  }

  public updateActors(positions: THREE.Vector3[]): void {
    const count = positions.length;

    // Grow mesh arrays if needed
    while (this.actorPhysMeshes.length < count) {
      const pm = makeSphereMesh(PLAYER_RADIUS, COL_ACTOR_PHYSICS);
      const cm = makeSphereMesh(ACTOR_COLLISION_RADIUS, COL_ACTOR_COLLISION);
      this.group.add(pm, cm);
      this.actorPhysMeshes.push(pm);
      this.actorCollMeshes.push(cm);
    }
    // Shrink if actors left
    while (this.actorPhysMeshes.length > count) {
      const pm = this.actorPhysMeshes.pop()!;
      const cm = this.actorCollMeshes.pop()!;
      this.group.remove(pm, cm);
      (pm.material as THREE.Material).dispose();
      pm.geometry.dispose();
      (cm.material as THREE.Material).dispose();
      cm.geometry.dispose();
    }

    for (let i = 0; i < count; i++) {
      this.actorPhysMeshes[i].position.copy(positions[i]);
      this.actorCollMeshes[i].position.copy(positions[i]);
    }
  }

  public dispose(): void {
    this.clearStatic();
    for (let i = 0; i < this.actorPhysMeshes.length; i++) {
      const pm = this.actorPhysMeshes[i];
      const cm = this.actorCollMeshes[i];
      (pm.material as THREE.Material).dispose();
      pm.geometry.dispose();
      (cm.material as THREE.Material).dispose();
      cm.geometry.dispose();
    }
    this.actorPhysMeshes = [];
    this.actorCollMeshes = [];
    this.scene.remove(this.group);
  }

  private addStatic(obj: THREE.Object3D): void {
    this.group.add(obj);
    this.staticObjects.push(obj);
  }

  private clearStatic(): void {
    for (const obj of this.staticObjects) {
      this.group.remove(obj);
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
        obj.geometry.dispose();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else mat.dispose();
      }
    }
    this.staticObjects = [];
  }
}
