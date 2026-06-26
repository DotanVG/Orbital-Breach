import * as THREE from "three";
import { getBotCallSign } from "../../../shared/callSigns";
import { GRAB_RADIUS, PLAYER_RADIUS } from "../../../shared/constants";
import { getSoloBotFill, type SoloMatchConfig } from "../../../shared/match";
import {
  classifyHitZone,
  maxLaunchPower,
} from "../../../shared/player-logic";
import type { DamageState } from "../../../shared/schema";
import type { Vec3 } from "../../../shared/vec3";
import { Arena } from "../arena/arena";
import { type BarRouteGraph, BotBrain, createBotPersonality } from "./botBrain";
import {
  integrateFrozenBotDrift,
  stepBotBreachPhysics,
  tickBotFloatingPassive,
  updateBotBreach,
  updateBotFloating,
} from "./localMatchBotMovement";
import type { EnemySnapshot } from "./localMatchActors";
import { ArenaQueryAdapter } from "./arenaQueryAdapter";
import { type BotState, type SpawnProjectileEvent } from "./localMatchTypes";
import { SimulatedPlayerAvatar } from "./simulatedPlayerAvatar";

export function buildBots(scene: THREE.Scene, config: SoloMatchConfig): BotState[] {
  if (config.noBots) return [];

  const bots: BotState[] = [];
  const fill = getSoloBotFill(config.teamSize, config.humanTeam);
  for (let i = 0; i < fill.team0Bots; i += 1) {
    bots.push(createBotState(scene, `bot-cyan-${i}`, getBotCallSign(i), 0));
  }

  for (let i = 0; i < fill.team1Bots; i += 1) {
    const idx = fill.team0Bots + i;
    bots.push(createBotState(scene, `bot-magenta-${i}`, getBotCallSign(idx), 1));
  }

  return bots;
}

export function settleSpawnOnFloor(
  spawn: Vec3,
  query: ArenaQueryAdapter,
  team: 0 | 1,
): Vec3 {
  const center = query.getBreachRoomCenter(team);
  const floorY = center.y - 3 + PLAYER_RADIUS + 0.08;
  return {
    x: spawn.x,
    y: floorY,
    z: spawn.z,
  };
}

export function resetBotsForRound(
  bots: BotState[],
  spawnSlots: Vec3[],
  roundSeed: number,
  query: ArenaQueryAdapter,
): void {
  for (let i = 0; i < bots.length; i += 1) {
    const bot = bots[i];
    const spawn = spawnSlots[i] ?? spawnSlots[spawnSlots.length - 1] ?? { x: 0, y: 0, z: 0 };
    bot.currentBreachTeam = bot.team;
    bot.damage = createDamageState();
    bot.grabbedBarPos = null;
    bot.launchPower = 0;
    bot.phase = "BREACH";
    bot.phys.pos.set(spawn.x, spawn.y, spawn.z);
    bot.phys.vel.set(0, 0, 0);
    bot.breachEntryCarry.set(0, 0, 0);
    bot.breachEntryCarryTimer = 0;
    bot.rot = exitRotation(query, bot.team);
    bot.brain.resetForRound(roundSeed * 37 + i * 13 + bot.team);
    bot.avatar.update(bot.phys.pos, bot.damage, bot.phase, bot.rot.yaw, 0, 0);
  }
}

export function applyHitToBot(
  bot: BotState,
  zone: ReturnType<typeof classifyHitZone>,
  impulse: THREE.Vector3,
): boolean {
  bot.phys.vel.add(impulse);

  switch (zone) {
    case "head":
    case "body":
      return promoteBotToFullFreeze(bot);
    case "rightArm":
      bot.damage.rightArm = true;
      if (allBotLimbsDamaged(bot)) return promoteBotToFullFreeze(bot);
      return false;
    case "leftArm":
      bot.damage.leftArm = true;
      if (bot.phase === "GRABBING" || bot.phase === "AIMING") {
        bot.phase = "FLOATING";
        bot.grabbedBarPos = null;
      }
      if (allBotLimbsDamaged(bot)) return promoteBotToFullFreeze(bot);
      return false;
    case "leftLeg":
      bot.damage.leftLeg = true;
      bot.launchPower = Math.min(bot.launchPower, maxLaunchPower(bot.damage));
      if (allBotLimbsDamaged(bot)) return promoteBotToFullFreeze(bot);
      return false;
    case "rightLeg":
      bot.damage.rightLeg = true;
      bot.launchPower = Math.min(bot.launchPower, maxLaunchPower(bot.damage));
      if (allBotLimbsDamaged(bot)) return promoteBotToFullFreeze(bot);
      return false;
  }
}

export function tickBot(
  bot: BotState,
  dt: number,
  arena: Arena,
  query: ArenaQueryAdapter,
  barGraph: BarRouteGraph,
  enemies: EnemySnapshot[],
  shots: SpawnProjectileEvent[],
): void {
  if (bot.phase === "FROZEN") {
    integrateFrozenBotDrift(bot, arena, dt);
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
    barGraph,
    enemies,
    dt,
  );

  bot.rot.yaw = command.lookYaw;
  bot.rot.pitch = command.lookPitch;

  if (command.fire && bot.phase !== "BREACH" && !bot.damage.rightArm && command.fireDirection) {
    const forward = toThree(command.fireDirection).normalize();
    shots.push({
      direction: forward.clone(),
      origin: bot.phys.pos.clone().addScaledVector(forward, PLAYER_RADIUS + 0.25),
      ownerId: bot.id,
      team: bot.team,
    });
  }

  switch (bot.phase) {
    case "BREACH":
      updateBotBreach(bot, command, arena, query, dt);
      break;
    case "FLOATING":
      updateBotFloating(bot, command, arena, query, dt);
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
}

export function tickBotPassive(
  bot: BotState,
  arena: Arena,
  dt: number,
): void {
  switch (bot.phase) {
    case "BREACH":
      stepBotBreachPhysics(bot, arena, dt);
      break;
    case "FLOATING":
      tickBotFloatingPassive(bot, arena, dt);
      break;
    case "FROZEN":
      integrateFrozenBotDrift(bot, arena, dt);
      break;
    case "GRABBING":
    case "AIMING":
      if (bot.grabbedBarPos) {
        bot.phys.vel.set(0, 0, 0);
        bot.phys.pos.copy(bot.grabbedBarPos);
      } else {
        bot.phase = "FLOATING";
      }
      break;
    default:
      break;
  }
}

function createDamageState(): DamageState {
  return {
    frozen: false,
    leftArm: false,
    leftLeg: false,
    rightArm: false,
    rightLeg: false,
  };
}

function createBotState(scene: THREE.Scene, id: string, name: string, team: 0 | 1): BotState {
  const personality = createBotPersonality(id, team);
  return {
    avatar: new SimulatedPlayerAvatar(scene, team, name),
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
    breachEntryCarry: new THREE.Vector3(),
    breachEntryCarryTimer: 0,
    rot: { yaw: 0, pitch: 0 },
    team,
  };
}

function allBotLimbsDamaged(bot: BotState): boolean {
  return bot.damage.leftArm && bot.damage.rightArm && bot.damage.leftLeg && bot.damage.rightLeg;
}

function promoteBotToFullFreeze(bot: BotState): true {
  if (!bot.damage.frozen) {
    bot.damage.frozen = true;
    bot.deaths += 1;
  }
  bot.phase = "FROZEN";
  bot.grabbedBarPos = null;
  return true;
}

function launchBot(bot: BotState): void {
  const forward = directionFromRotation(bot.rot.yaw, bot.rot.pitch);
  bot.phys.pos.addScaledVector(forward, PLAYER_RADIUS + 0.8);
  bot.phys.vel.copy(forward).multiplyScalar(bot.launchPower);
  bot.breachEntryCarry.set(0, 0, 0);
  bot.breachEntryCarryTimer = 0;
  bot.grabbedBarPos = null;
  bot.launchPower = 0;
  bot.phase = "FLOATING";
}

function directionFromRotation(yaw: number, pitch: number): THREE.Vector3 {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return new THREE.Vector3(-sy * cp, sp, -cy * cp).normalize();
}

function exitRotation(query: ArenaQueryAdapter, team: 0 | 1): { yaw: number; pitch: number } {
  const axis = query.getBreachOpenAxis(team);
  const sign = query.getBreachOpenSign(team);
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

function toVec3(vec: THREE.Vector3): Vec3 {
  return { x: vec.x, y: vec.y, z: vec.z };
}

function toThree(vec: Vec3): THREE.Vector3 {
  return new THREE.Vector3(vec.x, vec.y, vec.z);
}
