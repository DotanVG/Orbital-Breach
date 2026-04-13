import * as THREE from 'three';
import { Projectile } from '../projectile';

/**
 * Owns the list of visual projectiles in the scene. Responsible for ticking
 * them, culling dead ones, and disposing everything on round reset.
 *
 * Projectiles here are client-visual only — the server is authoritative for
 * hits. See `projectile.ts` for the single-projectile behavior.
 */
export class ProjectileSystem {
  private projectiles: Projectile[] = [];

  public constructor(private readonly scene: THREE.Scene) {}

  public spawn(origin: THREE.Vector3, direction: THREE.Vector3, color: number): void {
    this.projectiles.push(new Projectile(this.scene, origin, direction, color));
  }

  public update(dt: number): void {
    for (const p of this.projectiles) p.update(dt);
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  public clear(): void {
    for (const p of this.projectiles) p.dispose();
    this.projectiles = [];
  }
}
