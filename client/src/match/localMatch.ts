import * as THREE from "three";
import { BOT_NAMES, GRAB_RADIUS, PLAYER_RADIUS } from "../../../shared/constants";
import { getSoloBotFill, type SoloMatchConfig } from "../../../shared/match";
import { classifyHitZone, maxLaunchPower, spawnPosition } from "../../../shared/player-logic";
import type { EnemyPlayerInfo, FullPlayerInfo, PlayerPhase, DamageState } from "../../../shared/schema";
import type { Vec3 } from "../../../shared/vec3";
import { v3 } from "../../../shared/vec3";
import { Arena } from "../arena/arena";
import { CameraController } from "../camera";
import {
  bounceArena,
  clampBreachRoom,
  integrateBreachRoom,
  integrateZeroG,
  type PhysicsState,
} from "../physics";
import { LocalPlayer } from "../player";
import { ArenaQueryAdapter } from "./arenaQueryAdapter";
import { BotBrain, createBotPersonality } from "./botBrain";
import { buildHudRosters } from "./rosterView";
import { SimulatedPlayerAvatar } from "./simulatedPlayerAvatar";

const LOCAL_PLAYER_ID = "local-player";

export interface ProjectileActorTarget {
  active: boolean;
  id: string;
  pos: THREE.Vector3;
  radius: number;
  team: 0 | 1;
}

export interface ProjectileHitEvent {
  direction: THREE.Vector3;
  impactPoint: THREE.Vector3;
  ownerId: string;
  targetId: string;
}

export interface SpawnProjectileEvent {
  direction: THREE.Vector3;
  origin: THREE.Vector3;
  ownerId: string;
  team: 0 | 1;
}

interface BotState {
  avatar: SimulatedPlayerAvatar;
  brain: BotBrain;
  currentBreachTeam: 0 | 1;
  damage: DamageState;
  deaths: number;
  grabbedBarPos: THREE.Vector3 | null;
  id: string;
  isBot: true;
  kills: number;
  launchPower: number;
  name: string;
  phase: PlayerPhase;
  phys: PhysicsState;
  rot: { yaw: number; pitch: number };
  team: 0 | 1;
}

export class LocalMatch {
  private bots: BotState[] = [];
  private config: SoloMatchConfig = { humanName: "You", humanTeam: 0, teamSize: 1 };
  private score = { team0: 0, team1: 0 };

  public onScore: ((team: 0 | 1, scorerName: string) => void) | null = null;

  public constructor(private scene: THREE.Scene) {}

  public startNewGame(config: SoloMatchConfig): void {
    this.config = config;
    this.score = { team0: 0, team1: 0 };
    this.rebuildBots();
  }

  public resetForRound(arena: Arena): void {
    const query = new ArenaQueryAdapter(arena);
    for (const bot of this.bots) {
      const spawn = spawnPosition(bot.team, query);
      bot.currentBreachTeam = bot.team;
      bot.damage = createDamageState();
      bot.grabbedBarPos = null;
      bot.launchPower = 0;
      bot.phase = "BREACH";
      bot.phys.pos.set(spawn.x, spawn.y, spawn.z);
      bot.phys.vel.set(0, 0, 0);
      bot.rot = exitRotation(query, bot.team);
      bot.avatar.update(bot.phys.pos, bot.phase, bot.rot.yaw, 0, 0);
    }
  }

  public dispose(): void {
    for (const bot of this.bots) {
      bot.avatar.dispose(this.scene);
    }
    this.bots = [];
  }

  public tick(
    dt: number,
    arena: Arena,
    player: LocalPlayer,
    isRoundPlaying: boolean,
  ): SpawnProjectileEvent[] {
    const shots: SpawnProjectileEvent[] = [];
    const query = new ArenaQueryAdapter(arena);
    const bars = query.getAllBarGrabPoints();
    const actors = [
      {
        id: LOCAL_PLAYER_ID,
        phase: player.phase,
        pos: toVec3(player.getPosition()),
        team: this.config.humanTeam,
      },
      ...this.bots.map((bot) => ({
        id: bot.id,
        phase: bot.phase,
        pos: toVec3(bot.phys.pos),
        team: bot.team,
      })),
    ];

    for (const bot of this.bots) {
      if (isRoundPlaying) {
        this.tickBot(bot, dt, arena, query, bars, actors, shots);
      }
      bot.avatar.update(bot.phys.pos, bot.phase, bot.rot.yaw, dt, bot.phys.vel.length());
    }

    return shots;
  }

  public recordHumanScore(team: 0 | 1): void {
    if (team === 0) this.score.team0 += 1;
    else this.score.team1 += 1;
  }

  public getScore(): { team0: number; team1: number } {
    return { ...this.score };
  }

  public getHudRosters(player: LocalPlayer): { ownTeam: FullPlayerInfo[]; enemyTeam: EnemyPlayerInfo[] } {
    const actors = [
      {
        id: LOCAL_PLAYER_ID,
        name: this.config.humanName,
        team: this.config.humanTeam,
        isBot: false,
        kills: player.kills,
        deaths: player.deaths,
        phase: player.phase,
        frozen: player.damage.frozen,
        ping: 0,
      },
      ...this.bots.map((bot) => ({
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

    return buildHudRosters(LOCAL_PLAYER_ID, this.config.humanTeam, actors);
  }

  public getProjectileTargets(player: LocalPlayer): ProjectileActorTarget[] {
    return [
      {
        active: player.phase !== "RESPAWNING" && !player.damage.frozen,
        id: LOCAL_PLAYER_ID,
        pos: player.getPosition().clone(),
        radius: PLAYER_RADIUS,
        team: this.config.humanTeam,
      },
      ...this.bots.map((bot) => ({
        active: bot.phase !== "RESPAWNING" && !bot.damage.frozen,
        id: bot.id,
        pos: bot.phys.pos.clone(),
        radius: PLAYER_RADIUS,
        team: bot.team,
      })),
    ];
  }

  public handleProjectileHit(
    event: ProjectileHitEvent,
    player: LocalPlayer,
    camera: CameraController,
  ): void {
    const impulse = event.direction.clone().normalize().multiplyScalar(3);
    if (event.targetId === LOCAL_PLAYER_ID) {
      const zone = LocalPlayer.classifyHitZone(
        event.impactPoint,
        player.getPosition(),
        camera.getForward(),
      );
      player.applyHit(zone, impulse);
      return;
    }

    const bot = this.bots.find((candidate) => candidate.id === event.targetId);
    if (!bot) return;

    const zone = classifyHitZone(
      toVec3(event.impactPoint),
      toVec3(bot.phys.pos),
      yawForward(bot.rot.yaw),
    );
    applyHitToBot(bot, zone, impulse);
  }

  private rebuildBots(): void {
    this.dispose();

    const fill = getSoloBotFill(this.config.teamSize, this.config.humanTeam);
    const makeName = (index: number): string => {
      const base = BOT_NAMES[index % BOT_NAMES.length];
      const cycle = Math.floor(index / BOT_NAMES.length);
      return cycle === 0 ? base : `${base}-${cycle + 1}`;
    };

    for (let i = 0; i < fill.team0Bots; i += 1) {
      this.bots.push(createBotState(this.scene, `bot-cyan-${i}`, makeName(i), 0));
    }

    for (let i = 0; i < fill.team1Bots; i += 1) {
      const idx = fill.team0Bots + i;
      this.bots.push(createBotState(this.scene, `bot-magenta-${i}`, makeName(idx), 1));
    }
  }

  private tickBot(
    bot: BotState,
    dt: number,
    arena: Arena,
    query: ArenaQueryAdapter,
    bars: Vec3[],
    actors: Array<{ id: string; phase: PlayerPhase; pos: Vec3; team: 0 | 1 }>,
    shots: SpawnProjectileEvent[],
  ): void {
    if (bot.phase === "FROZEN") {
      integrateFloating(bot, arena, dt);
      return;
    }

    const command = bot.brain.tick(
      {
        currentBreachTeam: bot.currentBreachTeam,
        damage: bot.damage,
        phase: bot.phase,
        pos: toVec3(bot.phys.pos),
        rot: bot.rot,
        team: bot.team,
      },
      query,
      bars,
      actors.filter((actor) => actor.id !== bot.id && actor.team !== bot.team),
      dt,
    );

    bot.rot.yaw = command.lookYaw;
    bot.rot.pitch = command.lookPitch;

    if (command.fire && !bot.damage.rightArm) {
      const forward = directionFromRotation(bot.rot.yaw, bot.rot.pitch);
      shots.push({
        direction: forward.clone(),
        origin: bot.phys.pos.clone().addScaledVector(forward, PLAYER_RADIUS + 0.25),
        ownerId: bot.id,
        team: bot.team,
      });
    }

    switch (bot.phase) {
      case "BREACH":
        this.updateBotBreach(bot, command, arena, query, dt);
        break;
      case "FLOATING":
        this.updateBotFloating(bot, command, arena, query, dt);
        break;
      case "GRABBING":
        if (!bot.grabbedBarPos) {
          bot.phase = "FLOATING";
          return;
        }
        bot.phys.vel.set(0, 0, 0);
        bot.phys.pos.copy(bot.grabbedBarPos);
        if (command.aimHeld) {
          bot.phase = "AIMING";
          bot.launchPower = 0;
        }
        break;
      case "AIMING":
        if (!bot.grabbedBarPos) {
          bot.phase = "FLOATING";
          return;
        }
        bot.phys.vel.set(0, 0, 0);
        bot.phys.pos.copy(bot.grabbedBarPos);
        bot.launchPower = Math.min(
          maxLaunchPower(bot.damage),
          bot.launchPower + (maxLaunchPower(bot.damage) * dt) / bot.brain.getLaunchChargeSeconds(),
        );
        if (!command.aimHeld) {
          launchBot(bot);
        }
        break;
      default:
        break;
    }

    const enemyTeam = (1 - bot.team) as 0 | 1;
    if (
      bot.phase === "FLOATING"
      && !bot.damage.frozen
      && arena.isGoalDoorOpen(enemyTeam)
      && arena.isDeepInBreachRoom(bot.phys.pos, enemyTeam, 1.0)
    ) {
      bot.currentBreachTeam = enemyTeam;
      bot.phase = "BREACH";
      bot.phys.vel.y = 0;
      bot.kills += 1;
      if (bot.team === 0) this.score.team0 += 1;
      else this.score.team1 += 1;
      this.onScore?.(bot.team, bot.name);
    }
  }

  private updateBotBreach(
    bot: BotState,
    command: ReturnType<BotBrain["tick"]>,
    arena: Arena,
    query: ArenaQueryAdapter,
    dt: number,
  ): void {
    const center = arena.getBreachRoomCenter(bot.currentBreachTeam);
    const openAxis = arena.getBreachOpenAxis(bot.currentBreachTeam);
    const openSign = arena.getBreachOpenSign(bot.currentBreachTeam);
    const yawForwardVec = new THREE.Vector3(-Math.sin(bot.rot.yaw), 0, -Math.cos(bot.rot.yaw));
    const yawRightVec = new THREE.Vector3(Math.cos(bot.rot.yaw), 0, -Math.sin(bot.rot.yaw));

    integrateBreachRoom(
      bot.phys,
      command.walkAxes,
      yawForwardVec,
      yawRightVec,
      false,
      isOnBreachGround(bot, center.y),
      dt,
    );
    clampBreachRoom(bot.phys, center, openAxis, openSign, arena.isGoalDoorOpen(bot.currentBreachTeam));

    if (
      command.grab
      && !bot.damage.leftArm
      && arena.isGoalDoorOpen(bot.currentBreachTeam)
    ) {
      const nearest = query.getNearestBar(toVec3(bot.phys.pos), GRAB_RADIUS);
      if (nearest) {
        bot.grabbedBarPos = toThree(nearest.pos);
        bot.phase = "GRABBING";
      }
    }

    if (!arena.isInBreachRoom(bot.phys.pos, bot.currentBreachTeam)) {
      bot.phase = "FLOATING";
    }
  }

  private updateBotFloating(
    bot: BotState,
    command: ReturnType<BotBrain["tick"]>,
    arena: Arena,
    query: ArenaQueryAdapter,
    dt: number,
  ): void {
    integrateFloating(bot, arena, dt);

    if (arena.isInBreachRoom(bot.phys.pos, bot.team)) {
      bot.currentBreachTeam = bot.team;
      bot.phase = "BREACH";
      bot.phys.vel.y = 0;
      return;
    }

    if (command.grab && !bot.damage.leftArm && command.targetBar) {
      const nearest = query.getNearestBar(toVec3(bot.phys.pos), GRAB_RADIUS);
      if (nearest) {
        bot.grabbedBarPos = toThree(nearest.pos);
        bot.phase = "GRABBING";
      }
    }
  }
}

function createDamageState(): DamageState {
  return {
    frozen: false,
    leftArm: false,
    legs: false,
    rightArm: false,
  };
}

function createBotState(scene: THREE.Scene, id: string, name: string, team: 0 | 1): BotState {
  const personality = createBotPersonality(id, team);
  return {
    avatar: new SimulatedPlayerAvatar(scene, team),
    brain: new BotBrain(personality),
    currentBreachTeam: team,
    damage: createDamageState(),
    deaths: 0,
    grabbedBarPos: null,
    id,
    isBot: true,
    kills: 0,
    launchPower: 0,
    name,
    phase: "BREACH",
    phys: { pos: new THREE.Vector3(), vel: new THREE.Vector3() },
    rot: { yaw: 0, pitch: 0 },
    team,
  };
}

function exitRotation(query: ArenaQueryAdapter, team: 0 | 1): { yaw: number; pitch: number } {
  const dir = directionToYawPitch(query.getBreachOpenAxis(team), query.getBreachOpenSign(team));
  return { yaw: dir.yaw, pitch: 0 };
}

function directionToYawPitch(axis: "x" | "y" | "z", sign: 1 | -1): { yaw: number; pitch: number } {
  const dir = axis === "x"
    ? new THREE.Vector3(sign, 0, 0)
    : axis === "y"
      ? new THREE.Vector3(0, sign, 0)
      : new THREE.Vector3(0, 0, sign);
  return {
    yaw: Math.atan2(-dir.x, -dir.z),
    pitch: Math.asin(Math.max(-1, Math.min(1, dir.y))),
  };
}

function integrateFloating(bot: BotState, arena: Arena, dt = 0): void {
  const goalAxis = arena.getBreachOpenAxis(bot.team);
  const perpAxis: "x" | "z" = goalAxis === "z" ? "x" : "z";
  const team0FaceSign = (-arena.getBreachOpenSign(0)) as 1 | -1;
  const team1FaceSign = (-arena.getBreachOpenSign(1)) as 1 | -1;
  const portalFacesOpen = {
    positive:
      (team0FaceSign === 1 && arena.isGoalDoorOpen(0))
      || (team1FaceSign === 1 && arena.isGoalDoorOpen(1)),
    negative:
      (team0FaceSign === -1 && arena.isGoalDoorOpen(0))
      || (team1FaceSign === -1 && arena.isGoalDoorOpen(1)),
  };

  integrateZeroG(bot.phys, dt);
  bounceArena(bot.phys, goalAxis, perpAxis, portalFacesOpen);
  arena.bounceObstacles(bot.phys);
}

function isOnBreachGround(bot: BotState, centerY: number): boolean {
  const floorY = centerY - 3 + PLAYER_RADIUS;
  return bot.phys.pos.y <= floorY + 0.08;
}

function directionFromRotation(yaw: number, pitch: number): THREE.Vector3 {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return new THREE.Vector3(-sy * cp, sp, -cy * cp).normalize();
}

function launchBot(bot: BotState): void {
  const forward = directionFromRotation(bot.rot.yaw, bot.rot.pitch);
  bot.phys.pos.addScaledVector(forward, PLAYER_RADIUS + 0.8);
  bot.phys.vel.copy(forward).multiplyScalar(bot.launchPower);
  bot.grabbedBarPos = null;
  bot.launchPower = 0;
  bot.phase = "FLOATING";
}

function applyHitToBot(bot: BotState, zone: ReturnType<typeof classifyHitZone>, impulse: THREE.Vector3): void {
  bot.phys.vel.add(impulse);

  switch (zone) {
    case "head":
    case "body":
      if (!bot.damage.frozen) {
        bot.damage.frozen = true;
        bot.deaths += 1;
      }
      bot.phase = "FROZEN";
      bot.grabbedBarPos = null;
      break;
    case "rightArm":
      bot.damage.rightArm = true;
      break;
    case "leftArm":
      bot.damage.leftArm = true;
      if (bot.phase === "GRABBING" || bot.phase === "AIMING") {
        bot.phase = "FLOATING";
        bot.grabbedBarPos = null;
      }
      break;
    case "legs":
      bot.damage.legs = true;
      bot.launchPower = Math.min(bot.launchPower, maxLaunchPower(bot.damage));
      break;
  }
}

function toVec3(vec: THREE.Vector3): Vec3 {
  return { x: vec.x, y: vec.y, z: vec.z };
}

function toThree(vec: Vec3): THREE.Vector3 {
  return new THREE.Vector3(vec.x, vec.y, vec.z);
}

function yawForward(yaw: number): Vec3 {
  return v3.normalize({ x: -Math.sin(yaw), y: 0, z: -Math.cos(yaw) });
}
