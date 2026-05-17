import * as THREE from "three";
import { ACTOR_COLLISION_RADIUS, GRAB_RADIUS, PLAYER_RADIUS } from "../../../shared/constants";
import type { Arena } from "../arena/arena";

// Color scheme — each layer has a distinct hue so volumes are easy to read at a glance.
// NOTE: PLAYER_RADIUS is a sphere approximation. For a tighter fit, this should be
// replaced with a capsule collider (cylinder + two hemispheres) matching the alien
// model's actual proportions (tall and narrow). The sphere over-extends horizontally,
// causing the visible floating gap above surfaces.
const COL_PLAYER_SPHERE    = 0x00ff44; // green   — player PLAYER_RADIUS sphere
const COL_ACTOR_COLLISION  = 0xff00ff; // magenta — actor-actor ACTOR_COLLISION_RADIUS sphere (other actors)
const COL_OBSTACLE_PLAYER  = 0xff3333; // red     — player-bounce AABB (70% inset)
const COL_OBSTACLE_BULLET  = 0xff8800; // orange  — bullet AABB (65% inset)
const COL_OBSTACLE_FULL    = 0xffffff; // white   — camera/full AABB
const COL_ARENA_WALL       = 0x3388ff; // blue    — arena wall bounds
const COL_BREACH_ROOM      = 0x00ffff; // cyan    — breach room wall bounds
const COL_GRAB_BAR         = 0xffff00; // yellow  — grab bar cylinder

const SPHERE_SEGS = 8;

// Cylinders represent the grab radius at each bar position (oriented along Y).
// The real grab test is a sphere of GRAB_RADIUS — we show radius=GRAB_RADIUS, height=0.25.
const BAR_CYL_HEIGHT = 0.25;

function makeSphereMesh(radius: number, color: number): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, SPHERE_SEGS, SPHERE_SEGS / 2);
  const mat = new THREE.MeshBasicMaterial({ color, wireframe: true });
  return new THREE.Mesh(geo, mat);
}

function makeCylMesh(radius: number, height: number, color: number): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(radius, radius, height, 10, 1, true);
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

  // Dynamic actor meshes — two per actor (player physics sphere + actor-actor sphere)
  // Index 0 = local player; rest = bots.
  // For the local player, actor-collision sphere is green (self-reference redundant);
  // for other actors it's magenta so opponents are visually distinct.
  private actorPhysMeshes: THREE.Mesh[] = [];
  private actorCollMeshes: THREE.Mesh[] = [];

  public constructor(private scene: THREE.Scene) {
    this.group.visible = false;
    scene.add(this.group);
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public setVisible(v: boolean): void {
    this.visible = v;
    this.group.visible = v;
  }

  public toggle(): void {
    this.setVisible(!this.visible);
  }

  public onLayoutLoaded(arena: Arena): void {
    this.clearStatic();

    for (const box of arena.getPlayerCollisionAABBs()) {
      this.addStatic(makeBox3Helper(box, COL_OBSTACLE_PLAYER));
    }
    for (const box of arena.getObstacleBulletAABBs()) {
      this.addStatic(makeBox3Helper(box, COL_OBSTACLE_BULLET));
    }
    for (const box of arena.getObstacleAABBs()) {
      this.addStatic(makeBox3Helper(box, COL_OBSTACLE_FULL));
    }
    for (const box of arena.getArenaWallAABBs()) {
      this.addStatic(makeBox3Helper(box, COL_ARENA_WALL));
    }
    for (const box of arena.getBreachRoomWallAABBs()) {
      this.addStatic(makeBox3Helper(box, COL_BREACH_ROOM));
    }
    for (const pos of arena.getAllBarGrabPoints()) {
      const mesh = makeCylMesh(GRAB_RADIUS, BAR_CYL_HEIGHT, COL_GRAB_BAR);
      mesh.position.copy(pos);
      this.addStatic(mesh);
    }
  }

  public updateActors(positions: THREE.Vector3[]): void {
    const count = positions.length;

    while (this.actorPhysMeshes.length < count) {
      const idx = this.actorPhysMeshes.length;
      const pm = makeSphereMesh(PLAYER_RADIUS, COL_PLAYER_SPHERE);
      // Index 0 is local player — use green for both; other actors get magenta collision sphere.
      const collColor = idx === 0 ? COL_PLAYER_SPHERE : COL_ACTOR_COLLISION;
      const cm = makeSphereMesh(ACTOR_COLLISION_RADIUS, collColor);
      this.group.add(pm, cm);
      this.actorPhysMeshes.push(pm);
      this.actorCollMeshes.push(cm);
    }
    while (this.actorPhysMeshes.length > count) {
      this.removeActorMeshPair();
    }

    for (let i = 0; i < count; i++) {
      this.actorPhysMeshes[i].position.copy(positions[i]);
      this.actorCollMeshes[i].position.copy(positions[i]);
    }
  }

  public dispose(): void {
    this.clearStatic();
    while (this.actorPhysMeshes.length > 0) this.removeActorMeshPair();
    this.scene.remove(this.group);
  }

  private removeActorMeshPair(): void {
    const pm = this.actorPhysMeshes.pop()!;
    const cm = this.actorCollMeshes.pop()!;
    this.group.remove(pm, cm);
    disposeMesh(pm);
    disposeMesh(cm);
  }

  private addStatic(obj: THREE.Object3D): void {
    this.group.add(obj);
    this.staticObjects.push(obj);
  }

  private clearStatic(): void {
    for (const obj of this.staticObjects) {
      this.group.remove(obj);
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
        disposeMesh(obj as THREE.Mesh);
      }
    }
    this.staticObjects = [];
  }
}

function disposeMesh(m: THREE.Mesh | THREE.LineSegments): void {
  m.geometry.dispose();
  const mat = m.material;
  if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
  else mat.dispose();
}
