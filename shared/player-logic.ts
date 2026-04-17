import type { DamageState, PlayerPhase } from "./schema";
import {
  BREACH_ROOM_D,
  BREACH_ROOM_H,
  LEGS_HIT_LAUNCH_FACTOR,
  MAX_LAUNCH_SPEED,
  PLAYER_RADIUS,
} from "./constants";
import type { Vec3 } from "./vec3";
import { v3 } from "./vec3";

export type HitZone = "head" | "body" | "rightArm" | "leftArm" | "legs";

export interface BarGrabPoint {
  pos: Vec3;
  normal?: Vec3;
}

export interface SharedArenaQuery {
  getBreachRoomCenter(team: 0 | 1): Vec3;
  getBreachOpenAxis(team: 0 | 1): "x" | "y" | "z";
  getBreachOpenSign(team: 0 | 1): 1 | -1;
  isGoalDoorOpen(team: 0 | 1): boolean;
  isInBreachRoom(pos: Vec3, team: 0 | 1): boolean;
  isDeepInBreachRoom(pos: Vec3, team: 0 | 1, depth: number): boolean;
  getNearestBar(pos: Vec3, radius: number): BarGrabPoint | null;
}

export interface SharedPlayerState {
  damage: DamageState;
  deaths: number;
  grabbedBarPos: Vec3 | null;
  launchPower: number;
  phase: PlayerPhase;
  vel: Vec3;
}

export function classifyHitZone(
  impactPoint: Vec3,
  playerPos: Vec3,
  playerFacing: Vec3,
): HitZone {
  const local = v3.sub(impactPoint, playerPos);
  const yRel = local.y / PLAYER_RADIUS;

  if (yRel > 0.55) return "head";
  if (yRel > -0.2) {
    const worldUp = { x: 0, y: 1, z: 0 };
    const right = v3.normalize(v3.cross(playerFacing, worldUp));
    const xProj = v3.dot(local, right);
    if (xProj > 0.4) return "rightArm";
    if (xProj < -0.4) return "leftArm";
    return "body";
  }
  return "legs";
}

export function maxLaunchPower(damage: DamageState): number {
  return damage.legs
    ? MAX_LAUNCH_SPEED * LEGS_HIT_LAUNCH_FACTOR
    : MAX_LAUNCH_SPEED;
}

export function applyHit(
  state: SharedPlayerState,
  zone: HitZone,
  impulse: Vec3,
): boolean {
  state.vel = v3.add(state.vel, impulse);

  switch (zone) {
    case "head":
    case "body":
      if (!state.damage.frozen) {
        state.damage.frozen = true;
        state.deaths += 1;
      }
      state.phase = "FROZEN";
      state.grabbedBarPos = null;
      return true;
    case "rightArm":
      state.damage.rightArm = true;
      return false;
    case "leftArm":
      state.damage.leftArm = true;
      if (state.phase === "GRABBING" || state.phase === "AIMING") {
        state.phase = "FLOATING";
        state.grabbedBarPos = null;
      }
      return false;
    case "legs":
      state.damage.legs = true;
      state.launchPower = Math.min(state.launchPower, maxLaunchPower(state.damage));
      return false;
  }
}

export function spawnPosition(
  team: 0 | 1,
  arena: Pick<SharedArenaQuery, "getBreachRoomCenter" | "getBreachOpenAxis" | "getBreachOpenSign">,
): Vec3 {
  const center = arena.getBreachRoomCenter(team);
  const openAxis = arena.getBreachOpenAxis(team);
  const openSign = arena.getBreachOpenSign(team);
  const floorY = center.y - BREACH_ROOM_H / 2 + PLAYER_RADIUS + 0.1;
  const backOffset = BREACH_ROOM_D / 2 - PLAYER_RADIUS - 0.5;
  const pos = { x: center.x, y: floorY, z: center.z };
  pos[openAxis] -= openSign * backOffset;
  return pos;
}
