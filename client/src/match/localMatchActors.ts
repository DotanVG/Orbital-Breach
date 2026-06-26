import * as THREE from "three";
import { ACTOR_COLLISION_RADIUS } from "../../../shared/constants";
import type { SoloMatchConfig } from "../../../shared/match";
import { resolveActorCollisions } from "../../../shared/player-logic";
import type { DamageState, PlayerPhase } from "../../../shared/schema";
import type { Vec3 } from "../../../shared/vec3";
import { LocalPlayer } from "../player";
import { LOCAL_PLAYER_ID, type BotState } from "./localMatchTypes";

export interface EnemySnapshot {
  id: string;
  phase: PlayerPhase;
  pos: Vec3;
  team: 0 | 1;
}

export interface ActorDescriptor {
  damage: DamageState;
  id: string;
  name: string;
  phase: PlayerPhase;
  pos: THREE.Vector3;
  team: 0 | 1;
}

export function buildEnemySnapshots(
  config: SoloMatchConfig,
  bots: BotState[],
  player: LocalPlayer,
): Record<0 | 1, EnemySnapshot[]> {
  const actors = [
    {
      id: LOCAL_PLAYER_ID,
      phase: player.phase,
      pos: toVec3(player.getPosition()),
      team: config.humanTeam,
    },
    ...bots.map((bot) => ({
      id: bot.id,
      phase: bot.phase,
      pos: toVec3(bot.phys.pos),
      team: bot.team,
    })),
  ];

  return {
    0: actors.filter((actor) => actor.team === 1),
    1: actors.filter((actor) => actor.team === 0),
  };
}

export function buildScoreActors(
  config: SoloMatchConfig,
  bots: BotState[],
  player: LocalPlayer,
): ActorDescriptor[] {
  return [
    {
      id: LOCAL_PLAYER_ID,
      name: config.humanName,
      team: config.humanTeam,
      damage: player.damage,
      phase: player.phase,
      pos: player.getPosition(),
    },
    ...bots.map((bot) => ({
      id: bot.id,
      name: bot.name,
      team: bot.team,
      damage: bot.damage,
      phase: bot.phase,
      pos: bot.phys.pos,
    })),
  ];
}

export function findBotById(bots: BotState[], id: string): BotState | undefined {
  return bots.find((candidate) => candidate.id === id);
}

export function getActorMeta(
  config: SoloMatchConfig,
  bots: BotState[],
  id: string,
): { name: string; team: 0 | 1 } | null {
  if (id === LOCAL_PLAYER_ID) {
    return {
      name: config.humanName,
      team: config.humanTeam,
    };
  }

  const bot = findBotById(bots, id);
  if (!bot) return null;
  return {
    name: bot.name,
    team: bot.team,
  };
}

export function getTeamActorCount(
  config: SoloMatchConfig,
  bots: BotState[],
  team: 0 | 1,
): number {
  const humanCount = config.humanTeam === team ? 1 : 0;
  const botCount = bots.filter((bot) => bot.team === team).length;
  return humanCount + botCount;
}

export function recordFreezeKill(
  bots: BotState[],
  actorId: string,
  player: LocalPlayer,
): void {
  if (actorId === LOCAL_PLAYER_ID) {
    player.kills += 1;
    return;
  }

  const bot = findBotById(bots, actorId);
  if (bot) {
    bot.kills += 1;
  }
}

export function resolveLocalActorOverlap(
  bots: BotState[],
  player: LocalPlayer,
): void {
  resolveActorCollisions([
    {
      active: player.phase !== "RESPAWNING",
      anchored: isAnchored(player.phase),
      pos: player.getPosition(),
      radius: ACTOR_COLLISION_RADIUS,
      vel: player.phys.vel,
    },
    ...bots.map((bot) => ({
      active: bot.phase !== "RESPAWNING",
      anchored: isAnchored(bot.phase),
      pos: bot.phys.pos,
      radius: ACTOR_COLLISION_RADIUS,
      vel: bot.phys.vel,
    })),
  ]);
}

function toVec3(vec: THREE.Vector3): Vec3 {
  return { x: vec.x, y: vec.y, z: vec.z };
}

function isAnchored(phase: PlayerPhase): boolean {
  return phase === "GRABBING" || phase === "AIMING";
}
