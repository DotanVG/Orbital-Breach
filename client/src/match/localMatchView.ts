import * as THREE from "three";
import { HITBOX_OFFSET_Y, HITBOX_RADIUS } from "../../../shared/constants";
import type { EnemyPlayerInfo, FullPlayerInfo } from "../../../shared/schema";
import type { SoloMatchConfig } from "../../../shared/match";
import type { Vec3 } from "../../../shared/vec3";
import { buildHudRosters } from "./rosterView";
import type { BotState, LocalMatchStatsActor, ProjectileActorTarget } from "./localMatchTypes";
import { LOCAL_PLAYER_ID } from "./localMatchTypes";
import { LocalPlayer } from "../player";

function toVec3(vec: THREE.Vector3): Vec3 {
  return { x: vec.x, y: vec.y, z: vec.z };
}

export function buildLocalMatchStatsActors(
  config: SoloMatchConfig,
  bots: BotState[],
  player: LocalPlayer,
): LocalMatchStatsActor[] {
  return [
    {
      id: LOCAL_PLAYER_ID,
      name: config.humanName,
      team: config.humanTeam,
      isBot: false,
      isSelf: true,
      freezes: player.kills,
      frozen: player.deaths,
      position: toVec3(player.getPosition()),
    },
    ...bots.map((bot) => ({
      id: bot.id,
      name: bot.name,
      team: bot.team,
      isBot: true,
      isSelf: false,
      freezes: bot.kills,
      frozen: bot.deaths,
      position: toVec3(bot.phys.pos),
    })),
  ];
}

export function buildLocalHudRosters(
  config: SoloMatchConfig,
  bots: BotState[],
  player: LocalPlayer,
): { ownTeam: FullPlayerInfo[]; enemyTeam: EnemyPlayerInfo[] } {
  const actors = [
    {
      id: LOCAL_PLAYER_ID,
      name: config.humanName,
      team: config.humanTeam,
      isBot: false,
      kills: player.kills,
      deaths: player.deaths,
      phase: player.phase,
      frozen: player.damage.frozen,
      ping: 0,
    },
    ...bots.map((bot) => ({
      id: bot.id,
      name: bot.name,
      team: bot.team,
      isBot: true,
      kills: bot.kills,
      deaths: bot.deaths,
      phase: bot.phase,
      frozen: bot.damage.frozen,
      ping: 0,
    })),
  ];

  return buildHudRosters(LOCAL_PLAYER_ID, config.humanTeam, actors);
}

export function buildLocalProjectileTargets(
  config: SoloMatchConfig,
  bots: BotState[],
  player: LocalPlayer,
): ProjectileActorTarget[] {
  const humanCentre = player.getPosition().clone();
  humanCentre.y += HITBOX_OFFSET_Y;
  return [
    {
      active: player.phase !== "RESPAWNING" && player.phase !== "BREACH" && !player.damage.frozen,
      id: LOCAL_PLAYER_ID,
      pos: humanCentre,
      radius: HITBOX_RADIUS,
      team: config.humanTeam,
    },
    ...bots.map((bot) => {
      const botCentre = bot.phys.pos.clone();
      botCentre.y += HITBOX_OFFSET_Y;
      return {
        active: bot.phase !== "RESPAWNING" && bot.phase !== "BREACH" && !bot.damage.frozen,
        id: bot.id,
        pos: botCentre,
        radius: HITBOX_RADIUS,
        team: bot.team,
      };
    }),
  ];
}
