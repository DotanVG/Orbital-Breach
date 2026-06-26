import * as THREE from "three";
import { GRAB_RADIUS, PLAYER_RADIUS } from "../../../shared/constants";
import type { Vec3 } from "../../../shared/vec3";
import { Arena } from "../arena/arena";
import {
  bounceArena,
  clampBreachRoom,
  integrateBreachRoom,
  integrateZeroG,
} from "../physics";
import type { BotBrain } from "./botBrain";
import { ArenaQueryAdapter } from "./arenaQueryAdapter";
import type { BotState } from "./localMatchTypes";

const BREACH_ENTRY_CARRY_TIME = 0.55;
const BREACH_ENTRY_CARRY_DAMPING_PER_60HZ = 0.9;
const ZERO_CARRY = new THREE.Vector3();

export function integrateFrozenBotDrift(bot: BotState, arena: Arena, dt = 0): void {
  integrateZeroG(bot.phys, dt);
  bounceArena(bot.phys);
  arena.bounceObstacles(bot.phys);
}

export function getEnteredBreachTeam(arena: Arena, pos: THREE.Vector3): 0 | 1 | null {
  if (arena.isInBreachRoom(pos, 0)) return 0;
  if (arena.isInBreachRoom(pos, 1)) return 1;
  return null;
}

export function enterBotBreachRoom(bot: BotState, team: 0 | 1): void {
  bot.currentBreachTeam = team;
  bot.damage.leftArm = false;
  bot.damage.rightArm = false;
  bot.damage.leftLeg = false;
  bot.damage.rightLeg = false;
  bot.phase = "BREACH";
  bot.breachEntryCarry.copy(bot.phys.vel);
  bot.breachEntryCarry.y = 0;
  bot.breachEntryCarryTimer = BREACH_ENTRY_CARRY_TIME;
}

export function updateBotBreach(
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
    bot.breachEntryCarryTimer > 0 ? bot.breachEntryCarry : ZERO_CARRY,
    dt,
  );
  decayBreachEntryCarry(bot, isOnBreachGround(bot, center.y), dt);
  clampBreachRoom(bot.phys, center, openAxis, openSign, arena.isGoalDoorOpen(bot.currentBreachTeam));

  if (command.grab && !bot.damage.leftArm && arena.isGoalDoorOpen(bot.currentBreachTeam)) {
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

export function updateBotFloating(
  bot: BotState,
  command: ReturnType<BotBrain["tick"]>,
  arena: Arena,
  query: ArenaQueryAdapter,
  dt: number,
): void {
  integrateFloating(bot, arena, dt);

  const breachTeam = getEnteredBreachTeam(arena, bot.phys.pos);
  if (breachTeam !== null) {
    enterBotBreachRoom(bot, breachTeam);
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

export function stepBotBreachPhysics(bot: BotState, arena: Arena, dt: number): void {
  const center = arena.getBreachRoomCenter(bot.currentBreachTeam);
  const openAxis = arena.getBreachOpenAxis(bot.currentBreachTeam);
  const openSign = arena.getBreachOpenSign(bot.currentBreachTeam);
  const yawForwardVec = new THREE.Vector3(-Math.sin(bot.rot.yaw), 0, -Math.cos(bot.rot.yaw));
  const yawRightVec = new THREE.Vector3(Math.cos(bot.rot.yaw), 0, -Math.sin(bot.rot.yaw));

  integrateBreachRoom(
    bot.phys,
    { x: 0, z: 0 },
    yawForwardVec,
    yawRightVec,
    false,
    isOnBreachGround(bot, center.y),
    bot.breachEntryCarryTimer > 0 ? bot.breachEntryCarry : ZERO_CARRY,
    dt,
  );
  decayBreachEntryCarry(bot, isOnBreachGround(bot, center.y), dt);
  clampBreachRoom(bot.phys, center, openAxis, openSign, arena.isGoalDoorOpen(bot.currentBreachTeam));
}

export function tickBotFloatingPassive(bot: BotState, arena: Arena, dt: number): void {
  integrateFloating(bot, arena, dt);
  const breachTeam = getEnteredBreachTeam(arena, bot.phys.pos);
  if (breachTeam !== null) {
    enterBotBreachRoom(bot, breachTeam);
  }
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

function toVec3(vec: THREE.Vector3): Vec3 {
  return { x: vec.x, y: vec.y, z: vec.z };
}

function toThree(vec: Vec3): THREE.Vector3 {
  return new THREE.Vector3(vec.x, vec.y, vec.z);
}

function decayBreachEntryCarry(bot: BotState, onGround: boolean, dt: number): void {
  if (onGround) {
    bot.breachEntryCarry.set(0, 0, 0);
    bot.breachEntryCarryTimer = 0;
    return;
  }
  if (bot.breachEntryCarryTimer <= 0) return;
  bot.breachEntryCarryTimer = Math.max(0, bot.breachEntryCarryTimer - dt);
  if (bot.breachEntryCarryTimer === 0) {
    bot.breachEntryCarry.set(0, 0, 0);
    return;
  }
  const damping = Math.pow(BREACH_ENTRY_CARRY_DAMPING_PER_60HZ, dt * 60);
  bot.breachEntryCarry.multiplyScalar(damping);
}
