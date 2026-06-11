import {
  BREACH_ROOM_D,
  BREACH_ROOM_H,
  BREACH_ROOM_W,
} from "../../../shared/constants";
import type { ShotEventMessage } from "../../../shared/multiplayer";
import {
  bounceActorInArena,
  breachRoomCenter,
  integrateZeroGActor,
  isActorInEnemyBreachRoom,
  type ServerSimulatedOnlineActor,
} from "./onlineActorSimulation";

/** Minimal actor shape the bot brain needs; ActorState satisfies it. */
export interface BotActor extends ServerSimulatedOnlineActor {
  id: string;
  name: string;
  rightArm: boolean;
  yaw: number;
}

/** Match-level effects the bot brain triggers but does not own. */
export interface BotCombatHooks<TActor extends BotActor> {
  /** Freeze `target`, credit `shooter`, broadcast the event, check win. */
  applyFreeze(shooter: TActor, target: TActor): void;
  awardBreachPoint(bot: TActor): void;
  broadcastShot(event: ShotEventMessage): void;
  isRoundResolved(): boolean;
}

export interface BotPersonality {
  tier: number;
  launchSpeed: number;
  fireDelay: number;
  angleNoise: number;
  maxRange: number;
}

export function botPersonality(idHash: number): BotPersonality {
  const tier = idHash % 5;
  return {
    tier,
    launchSpeed: 6 + tier * 2,      // 6..14
    fireDelay: 3.0 - tier * 0.4,    // 3.0..1.4s
    angleNoise: 0.45 - tier * 0.08, // 0.45..0.13
    maxRange: 15 + tier * 5,        // 15..35
  };
}

export function botIdHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

interface OnlineBotTargetCandidate {
  team: 0 | 1;
  frozen: boolean;
  phase: string;
  posX: number;
  posY: number;
  posZ: number;
}

export function isOnlineActorTargetableByBot(
  botTeam: 0 | 1,
  actor: OnlineBotTargetCandidate,
  goalAxis: "x" | "z",
  goalSigns: { team0: 1 | -1; team1: 1 | -1 },
): boolean {
  if (actor.team === botTeam || actor.frozen || actor.phase === "RESPAWNING") {
    return false;
  }

  return getOnlineActorBreachTeam(actor, goalAxis, goalSigns) === null;
}

export function getOnlineActorBreachTeam(
  actor: Pick<OnlineBotTargetCandidate, "posX" | "posY" | "posZ">,
  goalAxis: "x" | "z",
  goalSigns: { team0: 1 | -1; team1: 1 | -1 },
): 0 | 1 | null {
  return isPointInsideBreachRoom(actor, breachRoomCenter(goalAxis, goalSigns.team0), goalAxis)
    ? 0
    : isPointInsideBreachRoom(actor, breachRoomCenter(goalAxis, goalSigns.team1), goalAxis)
      ? 1
      : null;
}

function isPointInsideBreachRoom(
  pos: Pick<OnlineBotTargetCandidate, "posX" | "posY" | "posZ">,
  center: { x: number; y: number; z: number },
  goalAxis: "x" | "z",
): boolean {
  if (Math.abs(pos.posY - center.y) >= BREACH_ROOM_H / 2) return false;

  const depthPos = goalAxis === "x" ? pos.posX : pos.posZ;
  const depthCenter = goalAxis === "x" ? center.x : center.z;
  if (Math.abs(depthPos - depthCenter) >= BREACH_ROOM_D / 2) return false;

  const perpPos = goalAxis === "x" ? pos.posZ : pos.posX;
  const perpCenter = goalAxis === "x" ? center.z : center.x;
  return Math.abs(perpPos - perpCenter) < BREACH_ROOM_W / 2;
}

/**
 * Server-side bot brain for online matches: launch out of the breach
 * room, drift through the arena, fire at the nearest targetable enemy,
 * and claim a breach when reaching the enemy room. Match-level effects
 * (scoring, freezing, broadcasting) go through BotCombatHooks.
 */
export class BotController<TActor extends BotActor> {
  private launchTimers = new Map<string, number>();
  private fireTimers = new Map<string, number>();

  public registerBot(id: string): void {
    const idHash = botIdHash(id);
    const p = botPersonality(idHash);
    this.launchTimers.set(id, 1.5 + (idHash % 30) * 0.1);
    this.fireTimers.set(id, p.fireDelay * (0.5 + (idHash % 10) * 0.05));
  }

  public remove(id: string): void {
    this.launchTimers.delete(id);
    this.fireTimers.delete(id);
  }

  public clear(): void {
    this.launchTimers.clear();
    this.fireTimers.clear();
  }

  public tick(
    dt: number,
    actors: Iterable<TActor>,
    goalAxis: "x" | "z",
    goalSigns: { team0: 1 | -1; team1: 1 | -1 },
    hooks: BotCombatHooks<TActor>,
  ): void {
    const allActors = Array.from(actors);

    for (const actor of allActors) {
      if (!actor.isBot) continue;
      if (actor.frozen) continue; // stay frozen until round end

      const idHash = botIdHash(actor.id);
      const p = botPersonality(idHash);

      if (actor.phase === "BREACH") {
        const launchTimer = this.launchTimers.get(actor.id);
        if (launchTimer === undefined) continue;
        const nextLaunchTimer = launchTimer - dt;
        this.launchTimers.set(actor.id, nextLaunchTimer);
        if (nextLaunchTimer <= 0) {
          const dx = -actor.posX + (Math.random() - 0.5) * p.angleNoise * 6;
          const dy = -actor.posY + (Math.random() - 0.5) * p.angleNoise * 3;
          const dz = -actor.posZ + (Math.random() - 0.5) * p.angleNoise * 6;
          const len = Math.hypot(dx, dy, dz) || 1;
          actor.velX = (dx / len) * p.launchSpeed;
          actor.velY = (dy / len) * p.launchSpeed;
          actor.velZ = (dz / len) * p.launchSpeed;
          actor.phase = "FLOATING";
          const horizLen = Math.hypot(dx, dz);
          if (horizLen > 0.01) {
            actor.yaw = Math.atan2(-dx / horizLen, -dz / horizLen);
          }
        }
        continue;
      }

      if (actor.phase === "FLOATING") {
        integrateZeroGActor(actor, dt);
        bounceActorInArena(actor, goalAxis);

        const horizSpeed = Math.hypot(actor.velX, actor.velZ);
        if (horizSpeed > 0.5) {
          actor.yaw = Math.atan2(-actor.velX, -actor.velZ);
        }

        if (!hooks.isRoundResolved() && isActorInEnemyBreachRoom(actor, goalAxis, goalSigns)) {
          hooks.awardBreachPoint(actor);
        }

        const fireTimer = this.fireTimers.get(actor.id) ?? p.fireDelay;
        const nextFireTimer = fireTimer - dt;
        if (nextFireTimer <= 0) {
          this.tryFire(actor, p, allActors, goalAxis, goalSigns, hooks);
          this.fireTimers.set(actor.id, p.fireDelay * (0.8 + Math.random() * 0.4));
        } else {
          this.fireTimers.set(actor.id, nextFireTimer);
        }
      }
    }
  }

  private tryFire(
    bot: TActor,
    p: BotPersonality,
    actors: TActor[],
    goalAxis: "x" | "z",
    goalSigns: { team0: 1 | -1; team1: 1 | -1 },
    hooks: BotCombatHooks<TActor>,
  ): void {
    if (bot.rightArm || bot.frozen) return;
    const enemy = this.findNearestEnemy(bot, actors, goalAxis, goalSigns);
    if (!enemy) return;
    const dx = enemy.posX - bot.posX;
    const dy = enemy.posY - bot.posY;
    const dz = enemy.posZ - bot.posZ;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq > p.maxRange * p.maxRange) return;
    const dist = Math.sqrt(distSq);
    const nx = dx / dist + (Math.random() - 0.5) * p.angleNoise;
    const ny = dy / dist + (Math.random() - 0.5) * p.angleNoise;
    const nz = dz / dist + (Math.random() - 0.5) * p.angleNoise;
    const nLen = Math.hypot(nx, ny, nz) || 1;
    hooks.broadcastShot({
      ownerId: bot.id,
      team: bot.team,
      originX: bot.posX,
      originY: bot.posY,
      originZ: bot.posZ,
      dirX: nx / nLen,
      dirY: ny / nLen,
      dirZ: nz / nLen,
    });
    const rangeFactor = 1 - (dist / p.maxRange) * 0.5;
    const hitChance = (0.35 + p.tier * 0.1) * rangeFactor;
    if (Math.random() > hitChance || enemy.frozen) return;
    hooks.applyFreeze(bot, enemy);
  }

  private findNearestEnemy(
    bot: TActor,
    actors: TActor[],
    goalAxis: "x" | "z",
    goalSigns: { team0: 1 | -1; team1: 1 | -1 },
  ): TActor | null {
    let nearest: TActor | null = null;
    let nearestDistSq = Infinity;
    for (const actor of actors) {
      if (!isOnlineActorTargetableByBot(bot.team, actor, goalAxis, goalSigns)) continue;
      const dx = actor.posX - bot.posX;
      const dy = actor.posY - bot.posY;
      const dz = actor.posZ - bot.posZ;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = actor;
      }
    }
    return nearest;
  }
}
