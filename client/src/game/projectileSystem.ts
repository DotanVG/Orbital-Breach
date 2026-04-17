import * as THREE from "three";
import { ARENA_SIZE } from "../../../shared/constants";
import { Projectile } from "../projectile";
import { bulletHitPoint } from "./bulletCollision";
import { segmentSphereHitPoint } from "./projectileActorCollision";

const BULLET_RADIUS = 0.07;
const FLASH_DURATION = 0.13;
const ARENA_LIMIT = ARENA_SIZE / 2;

const OBS_INTENSITY = 5.0;
const OBS_DIST = 6.0;
const PORTAL_INTENSITY = 9.0;
const PORTAL_DIST = 9.0;
const WALL_INTENSITY = 5.0;
const WALL_DIST = 6.0;

const SPARK_DURATION = 0.32;
const SPARK_COUNT = 22;

interface HitFlash {
  light: THREE.PointLight;
  age: number;
}

interface SparkBurst {
  points: THREE.Points;
  positions: Float32Array;
  velocities: Float32Array;
  age: number;
}

export interface ProjectileActorTarget {
  active: boolean;
  id: string;
  pos: THREE.Vector3;
  radius: number;
  team: 0 | 1;
}

export interface ProjectileActorHit {
  direction: THREE.Vector3;
  impactPoint: THREE.Vector3;
  ownerId: string;
  targetId: string;
}

type CollisionHit =
  | { kind: "actor"; point: THREE.Vector3; distance: number; targetId: string }
  | { kind: "obstacle"; point: THREE.Vector3; distance: number }
  | { kind: "portal"; point: THREE.Vector3; distance: number };

export class ProjectileSystem {
  private projectiles: Projectile[] = [];
  private flashes: HitFlash[] = [];
  private sparks: SparkBurst[] = [];

  public constructor(private readonly scene: THREE.Scene) {}

  public spawn(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    team: 0 | 1,
    ownerId: string,
  ): void {
    this.projectiles.push(new Projectile(this.scene, origin, direction, team, ownerId));
  }

  public update(
    dt: number,
    solidBoxes: THREE.Box3[],
    portalBoxes: THREE.Box3[],
    actorTargets: ProjectileActorTarget[],
    onPortalHit: (pos: THREE.Vector3, color: number) => void,
    onActorHit: (hit: ProjectileActorHit) => void,
  ): void {
    for (const projectile of this.projectiles) {
      if (projectile.dead) continue;

      const oldPos = projectile.getPosition().clone();
      projectile.update(dt);
      let handledFlash = false;

      if (!projectile.dead) {
        const newPos = projectile.getPosition();
        const direction = new THREE.Vector3().subVectors(newPos, oldPos).normalize();
        const nearestHit = this.findNearestHit(
          projectile,
          oldPos,
          newPos,
          solidBoxes,
          portalBoxes,
          actorTargets,
        );

        if (nearestHit) {
          projectile.dispose();
          handledFlash = true;

          if (nearestHit.kind === "obstacle") {
            this.spawnFlash(nearestHit.point, projectile.getTeamColor(), OBS_INTENSITY, OBS_DIST);
            this.spawnSparks(nearestHit.point, projectile.getTeamColor(), null);
          } else if (nearestHit.kind === "portal") {
            this.spawnFlash(nearestHit.point, projectile.getTeamColor(), PORTAL_INTENSITY, PORTAL_DIST);
            onPortalHit(nearestHit.point, projectile.getTeamColor());
          } else {
            this.spawnFlash(nearestHit.point, projectile.getTeamColor(), OBS_INTENSITY, OBS_DIST);
            this.spawnSparks(nearestHit.point, projectile.getTeamColor(), direction.clone().negate());
            onActorHit({
              direction,
              impactPoint: nearestHit.point,
              ownerId: projectile.getOwnerId(),
              targetId: nearestHit.targetId,
            });
          }
        }
      }

      if (projectile.dead && !handledFlash) {
        const rawPos = projectile.getPosition();
        const wallPos = this.clampToArena(rawPos);
        const isWall = this.isAtArenaBoundary(rawPos);
        this.spawnFlash(wallPos, projectile.getTeamColor(), WALL_INTENSITY, WALL_DIST);
        if (isWall) {
          this.spawnSparks(wallPos, projectile.getTeamColor(), this.inwardWallNormal(wallPos));
        }
      }
    }

    this.projectiles = this.projectiles.filter((projectile) => !projectile.dead);

    for (const flash of this.flashes) {
      flash.age += dt;
      const t = Math.min(flash.age / FLASH_DURATION, 1);
      flash.light.intensity = (flash.light.userData.peak as number) * (1 - t * t);
    }
    for (const flash of this.flashes.filter((item) => item.age >= FLASH_DURATION)) {
      this.scene.remove(flash.light);
      flash.light.dispose();
    }
    this.flashes = this.flashes.filter((item) => item.age < FLASH_DURATION);

    for (const spark of this.sparks) {
      spark.age += dt;
      for (let i = 0; i < SPARK_COUNT; i += 1) {
        spark.positions[i * 3] += spark.velocities[i * 3] * dt;
        spark.positions[i * 3 + 1] += spark.velocities[i * 3 + 1] * dt;
        spark.positions[i * 3 + 2] += spark.velocities[i * 3 + 2] * dt;
      }
      (spark.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      const t = spark.age / SPARK_DURATION;
      (spark.points.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - t * t);
    }
    for (const spark of this.sparks.filter((item) => item.age >= SPARK_DURATION)) {
      this.scene.remove(spark.points);
      spark.points.geometry.dispose();
      (spark.points.material as THREE.Material).dispose();
    }
    this.sparks = this.sparks.filter((item) => item.age < SPARK_DURATION);
  }

  public clear(): void {
    for (const projectile of this.projectiles) projectile.dispose();
    this.projectiles = [];
    for (const flash of this.flashes) {
      this.scene.remove(flash.light);
      flash.light.dispose();
    }
    this.flashes = [];
    for (const spark of this.sparks) {
      this.scene.remove(spark.points);
      spark.points.geometry.dispose();
      (spark.points.material as THREE.Material).dispose();
    }
    this.sparks = [];
  }

  private findNearestHit(
    projectile: Projectile,
    oldPos: THREE.Vector3,
    newPos: THREE.Vector3,
    solidBoxes: THREE.Box3[],
    portalBoxes: THREE.Box3[],
    actorTargets: ProjectileActorTarget[],
  ): CollisionHit | null {
    let nearest: CollisionHit | null = null;

    for (const box of solidBoxes) {
      const hit = bulletHitPoint(oldPos, newPos, box, BULLET_RADIUS);
      if (!hit) continue;
      const distance = hit.distanceToSquared(oldPos);
      if (!nearest || distance < nearest.distance) {
        nearest = { kind: "obstacle", point: hit, distance };
      }
    }

    for (const box of portalBoxes) {
      const hit = bulletHitPoint(oldPos, newPos, box, BULLET_RADIUS);
      if (!hit) continue;
      const distance = hit.distanceToSquared(oldPos);
      if (!nearest || distance < nearest.distance) {
        nearest = { kind: "portal", point: hit, distance };
      }
    }

    for (const actor of actorTargets) {
      if (!actor.active) continue;
      if (actor.team === projectile.getTeam()) continue;
      if (actor.id === projectile.getOwnerId()) continue;
      const hit = segmentSphereHitPoint(oldPos, newPos, actor.pos, actor.radius);
      if (!hit) continue;
      const distance = hit.distanceToSquared(oldPos);
      if (!nearest || distance < nearest.distance) {
        nearest = { kind: "actor", point: hit, distance, targetId: actor.id };
      }
    }

    return nearest;
  }

  private spawnFlash(pos: THREE.Vector3, color: number, intensity: number, dist: number): void {
    const light = new THREE.PointLight(color, intensity, dist, 2);
    light.position.copy(pos);
    light.userData.peak = intensity;
    this.scene.add(light);
    this.flashes.push({ light, age: 0 });
  }

  private spawnSparks(pos: THREE.Vector3, color: number, normal: THREE.Vector3 | null): void {
    const positions = new Float32Array(SPARK_COUNT * 3);
    const velocities = new Float32Array(SPARK_COUNT * 3);

    const nrm = normal ?? new THREE.Vector3(0, 1, 0);
    const t1 = new THREE.Vector3();
    const t2 = new THREE.Vector3();
    if (Math.abs(nrm.x) < 0.9) {
      t1.crossVectors(nrm, new THREE.Vector3(1, 0, 0)).normalize();
    } else {
      t1.crossVectors(nrm, new THREE.Vector3(0, 1, 0)).normalize();
    }
    t2.crossVectors(nrm, t1);

    const phiMax = normal ? Math.PI / 2 : Math.PI;

    for (let i = 0; i < SPARK_COUNT; i += 1) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * phiMax;
      const speed = 2.5 + Math.random() * 5.5;
      const cp = Math.cos(phi);
      const sp = Math.sin(phi);
      const ct = Math.cos(theta);
      const st = Math.sin(theta);

      velocities[i * 3] = (nrm.x * cp + (t1.x * ct + t2.x * st) * sp) * speed;
      velocities[i * 3 + 1] = (nrm.y * cp + (t1.y * ct + t2.y * st) * sp) * speed;
      velocities[i * 3 + 2] = (nrm.z * cp + (t1.z * ct + t2.z * st) * sp) * speed;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      blending: THREE.AdditiveBlending,
      color,
      depthWrite: false,
      opacity: 1,
      size: 0.07,
      transparent: true,
    });
    const points = new THREE.Points(geometry, material);
    this.scene.add(points);
    this.sparks.push({ points, positions, velocities, age: 0 });
  }

  private isAtArenaBoundary(pos: THREE.Vector3): boolean {
    return (
      Math.abs(pos.x) > ARENA_LIMIT - 0.5
      || Math.abs(pos.y) > ARENA_LIMIT - 0.5
      || Math.abs(pos.z) > ARENA_LIMIT - 0.5
    );
  }

  private clampToArena(pos: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3(
      Math.max(-ARENA_LIMIT, Math.min(ARENA_LIMIT, pos.x)),
      Math.max(-ARENA_LIMIT, Math.min(ARENA_LIMIT, pos.y)),
      Math.max(-ARENA_LIMIT, Math.min(ARENA_LIMIT, pos.z)),
    );
  }

  private inwardWallNormal(clampedPos: THREE.Vector3): THREE.Vector3 {
    const ax = Math.abs(clampedPos.x);
    const ay = Math.abs(clampedPos.y);
    const az = Math.abs(clampedPos.z);
    if (ax >= ay && ax >= az) return new THREE.Vector3(-Math.sign(clampedPos.x), 0, 0);
    if (ay >= ax && ay >= az) return new THREE.Vector3(0, -Math.sign(clampedPos.y), 0);
    return new THREE.Vector3(0, 0, -Math.sign(clampedPos.z));
  }
}
