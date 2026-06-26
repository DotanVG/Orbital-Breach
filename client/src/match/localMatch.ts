import * as THREE from "three";
import { HITBOX_OFFSET_Y, HITBOX_RADIUS, MATCH_POINT_TARGET } from "../../../shared/constants";
import { DEFAULT_PLAYER_NAME } from "../../../shared/callSigns";
import { findMatchWinner } from "../../../shared/match-flow";
import type { SoloMatchConfig } from "../../../shared/match";
import type { EnemyPlayerInfo, FullPlayerInfo } from "../../../shared/schema";
import {
  classifyHitZone,
  findFullFreezeWinner,
  generateSpawnPositions,
} from "../../../shared/player-logic";
import { Arena } from "../arena/arena";
import { CameraController } from "../camera";
import { addOutboundVibeJamPortal } from "../game/portal/vibeJamPortal";
import type { PortalParams } from "../game/portal/parsePortalParams";
import { LocalPlayer } from "../player";
import {
  buildEnemySnapshots,
  buildScoreActors,
  findBotById,
  getActorMeta,
  getTeamActorCount,
  recordFreezeKill,
  resolveLocalActorOverlap,
} from "./localMatchActors";
import { ArenaQueryAdapter } from "./arenaQueryAdapter";
import { buildBarGraph, type BarRouteGraph } from "./botBrain";
import {
  applyHitToBot,
  buildBots,
  resetBotsForRound,
  settleSpawnOnFloor,
  tickBot,
  tickBotPassive,
} from "./localMatchBots";
import {
  LOCAL_PLAYER_ID,
  type BotState,
  type LocalMatchEvent,
  type LocalMatchStatsActor,
  type ProjectileActorTarget,
  type ProjectileHitEvent,
  type SpawnProjectileEvent,
} from "./localMatchTypes";
import {
  buildLocalHudRosters,
  buildLocalMatchStatsActors,
  buildLocalProjectileTargets,
} from "./localMatchView";

export type {
  LocalMatchEvent,
  LocalMatchStatsActor,
  ProjectileActorTarget,
  ProjectileHitEvent,
  SpawnProjectileEvent,
} from "./localMatchTypes";

export class LocalMatch {
  private barGraph: BarRouteGraph = buildBarGraph([]);
  private bots: BotState[] = [];
  private celebratingTeam: 0 | 1 | null = null;
  private config: SoloMatchConfig = { humanName: DEFAULT_PLAYER_NAME, humanTeam: 0, teamSize: 1 };
  private roundResolved = false;
  private roundSeed = 0;
  private score = { team0: 0, team1: 0 };

  public onEvent: ((event: LocalMatchEvent) => void) | null = null;

  public constructor(private scene: THREE.Scene) {}

  public startNewGame(config: SoloMatchConfig): void {
    this.dispose();
    this.config = config;
    this.celebratingTeam = null;
    this.score = { team0: 0, team1: 0 };
    this.roundResolved = false;
    this.roundSeed = 0;
    this.bots = buildBots(this.scene, config);
  }

  public resetForRound(
    arena: Arena,
    player: LocalPlayer,
    humanSpawnOverride?: { x: number; y: number; z: number },
  ): void {
    this.celebratingTeam = null;
    this.roundResolved = false;
    this.roundSeed += 1;

    const query = new ArenaQueryAdapter(arena);
    this.barGraph = buildBarGraph(query.getAllBarGrabPoints());

    const team0Slots = generateSpawnPositions(
      0,
      getTeamActorCount(this.config, this.bots, 0),
      query,
      this.roundSeed * 11 + 7,
    ).map((slot) => settleSpawnOnFloor(slot, query, 0));
    const team1Slots = generateSpawnPositions(
      1,
      getTeamActorCount(this.config, this.bots, 1),
      query,
      this.roundSeed * 17 + 13,
    ).map((slot) => settleSpawnOnFloor(slot, query, 1));

    if (this.config.humanTeam === 0) {
      player.resetForNewRound(arena, humanSpawnOverride ?? team0Slots.shift());
    } else {
      player.resetForNewRound(arena, humanSpawnOverride ?? team1Slots.shift());
    }

    resetBotsForRound(this.bots.filter((bot) => bot.team === 0), team0Slots, this.roundSeed, query);
    resetBotsForRound(this.bots.filter((bot) => bot.team === 1), team1Slots, this.roundSeed, query);
  }

  public dispose(): void {
    for (const bot of this.bots) {
      bot.avatar.dispose(this.scene);
    }
    this.bots = [];
  }

  public setCelebratingTeam(team: 0 | 1 | null): void {
    this.celebratingTeam = team;
  }

  public getScore(): { team0: number; team1: number } {
    return { ...this.score };
  }

  public getMatchStatsActors(player: LocalPlayer): LocalMatchStatsActor[] {
    return buildLocalMatchStatsActors(this.config, this.bots, player);
  }

  public addOutboundVibeJamPortal(params: PortalParams): void {
    addOutboundVibeJamPortal(this.scene, params);
  }

  public getHudRosters(player: LocalPlayer): { ownTeam: FullPlayerInfo[]; enemyTeam: EnemyPlayerInfo[] } {
    return buildLocalHudRosters(this.config, this.bots, player);
  }

  public getProjectileTargets(player: LocalPlayer): ProjectileActorTarget[] {
    return buildLocalProjectileTargets(this.config, this.bots, player);
  }

  public handleProjectileHit(
    event: ProjectileHitEvent,
    player: LocalPlayer,
    camera: CameraController,
  ): void {
    if (this.roundResolved) return;

    const owner = getActorMeta(this.config, this.bots, event.ownerId);
    const impulse = event.direction.clone().normalize().multiplyScalar(0);

    if (event.targetId === LOCAL_PLAYER_ID) {
      const zone = LocalPlayer.classifyHitZone(
        event.impactPoint,
        player.getPosition(),
        camera.getForward(),
        HITBOX_OFFSET_Y,
        HITBOX_RADIUS,
      );
      const frozen = player.applyHit(zone, impulse);
      if (frozen) {
        if (owner) {
          recordFreezeKill(this.bots, event.ownerId, player);
          this.emitEvent({
            type: "freeze",
            killerName: owner.name,
            killerTeam: owner.team,
            victimName: this.config.humanName,
            victimTeam: this.config.humanTeam,
          });
        }
        this.checkFullFreezeWin(player);
      }
      return;
    }

    const bot = findBotById(this.bots, event.targetId);
    if (!bot) return;

    const zone = classifyHitZone(
      { x: event.impactPoint.x, y: event.impactPoint.y, z: event.impactPoint.z },
      { x: bot.phys.pos.x, y: bot.phys.pos.y, z: bot.phys.pos.z },
      yawForward(bot.rot.yaw),
      HITBOX_OFFSET_Y,
      HITBOX_RADIUS,
    );
    const frozen = applyHitToBot(bot, zone, impulse);
    if (event.ownerId === LOCAL_PLAYER_ID) {
      this.emitEvent({
        type: "hitConfirm",
        team: this.config.humanTeam,
      });
    }
    if (frozen) {
      if (owner) {
        recordFreezeKill(this.bots, event.ownerId, player);
        this.emitEvent({
          type: "freeze",
          killerName: owner.name,
          killerTeam: owner.team,
          victimName: bot.name,
          victimTeam: bot.team,
        });
      }
      this.checkFullFreezeWin(player);
    }
  }

  public handleRoundTimeout(): void {
    if (this.roundResolved) return;
    this.roundResolved = true;
    this.emitEvent({ type: "roundTie" });
  }

  public tick(
    dt: number,
    arena: Arena,
    player: LocalPlayer,
    isRoundPlaying: boolean,
  ): SpawnProjectileEvent[] {
    const shots: SpawnProjectileEvent[] = [];

    if (isRoundPlaying && !this.roundResolved) {
      const enemySnapshots = buildEnemySnapshots(this.config, this.bots, player);
      const query = new ArenaQueryAdapter(arena);
      for (const bot of this.bots) {
        tickBot(bot, dt, arena, query, this.barGraph, enemySnapshots[bot.team], shots);
      }

      this.checkForBreachScore(arena, player);
      this.checkFullFreezeWin(player);
    } else {
      for (const bot of this.bots) {
        tickBotPassive(bot, arena, dt);
      }
    }

    resolveLocalActorOverlap(this.bots, player);
    for (const bot of this.bots) {
      bot.avatar.update(
        bot.phys.pos,
        bot.damage,
        bot.phase,
        bot.rot.yaw,
        dt,
        bot.phys.vel.length(),
        this.celebratingTeam === bot.team,
      );
    }

    return shots;
  }

  private checkForBreachScore(arena: Pick<Arena, "isGoalDoorOpen" | "isDeepInBreachRoom" | "isInBreachRoom">, player: LocalPlayer): void {
    if (this.roundResolved) return;

    const actors = buildScoreActors(this.config, this.bots, player);
    for (const actor of actors) {
      if ((actor.phase !== "FLOATING" && actor.phase !== "BREACH") || actor.damage.frozen) continue;

      const enemyTeam = (1 - actor.team) as 0 | 1;
      if (!arena.isGoalDoorOpen(enemyTeam)) continue;
      const reachedEnemyBreach = actor.phase === "BREACH"
        ? arena.isInBreachRoom(actor.pos, enemyTeam)
        : arena.isDeepInBreachRoom(actor.pos, enemyTeam, 1.0);
      if (!reachedEnemyBreach) continue;

      if (actor.id === LOCAL_PLAYER_ID) {
        player.currentBreachTeam = enemyTeam;
        player.phase = "BREACH";
      } else {
        const bot = findBotById(this.bots, actor.id);
        if (!bot) continue;
        bot.currentBreachTeam = enemyTeam;
        bot.phase = "BREACH";
      }

      this.awardRoundPoint(actor.team, actor.id, actor.name, "breach");
      return;
    }
  }

  private checkFullFreezeWin(player: LocalPlayer): void {
    if (this.roundResolved) return;

    const winner = findFullFreezeWinner([
      { team: this.config.humanTeam, frozen: player.damage.frozen },
      ...this.bots.map((bot) => ({ team: bot.team, frozen: bot.damage.frozen })),
    ]);
    if (winner === null) return;

    this.roundResolved = true;
    if (winner === 0) this.score.team0 += 1;
    else this.score.team1 += 1;
    this.emitEvent({ type: "roundWin", winningTeam: winner, reason: "fullFreeze" });
    this.maybeEmitMatchEnd();
  }

  private awardRoundPoint(
    team: 0 | 1,
    scorerId: string,
    scorerName: string,
    reason: "breach" | "fullFreeze",
  ): void {
    if (this.roundResolved) return;

    this.roundResolved = true;
    if (team === 0) this.score.team0 += 1;
    else this.score.team1 += 1;
    this.emitEvent({
      type: "score",
      scorerId,
      scorerName,
      scorerTeam: team,
    });
    this.emitEvent({
      type: "roundWin",
      winningTeam: team,
      reason,
    });
    this.maybeEmitMatchEnd();
  }

  private maybeEmitMatchEnd(): void {
    const winner = findMatchWinner(this.score, MATCH_POINT_TARGET);
    if (winner === null) return;
    this.emitEvent({
      type: "matchEnd",
      winningTeam: winner,
      finalScore: { ...this.score },
    });
  }

  private emitEvent(event: LocalMatchEvent): void {
    this.onEvent?.(event);
  }
}

function yawForward(yaw: number): { x: number; y: number; z: number } {
  return { x: -Math.sin(yaw), y: 0, z: -Math.cos(yaw) };
}
