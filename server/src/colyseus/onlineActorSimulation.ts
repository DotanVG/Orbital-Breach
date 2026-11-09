import { bounceBodyArena, advanceBodyWorld, type CollisionBox, type PortalFaces } from '../../../shared/bodyCollider';
import { orientationFromSnapshot, quaternionFromYawPitchRoll } from '../../../shared/hitZoneColliders';
import {
  ARENA_SIZE,
  BREACH_ROOM_D,
  BREACH_ROOM_H,
  BREACH_ROOM_W,
  MAX_LAUNCH_SPEED,
} from "../../../shared/constants";

export const PLAYER_UPDATE_STALE_MS = 250;

export interface ServerSimulatedOnlineActor {
  yaw?: number;
  orientX?: number; orientY?: number; orientZ?: number; orientW?: number;
  frozen: boolean;
  isBot: boolean;
  phase: string;
  posX: number;
  posY: number;
  posZ: number;
  team: 0 | 1;
  velX: number;
  velY: number;
  velZ: number;
}

export function shouldServerSimulateHumanActor(
  actor: Pick<ServerSimulatedOnlineActor, "frozen" | "isBot" | "phase">,
  lastUpdateAgeMs: number,
): boolean {
  return !actor.isBot
    && !actor.frozen
    && actor.phase === "FLOATING"
    && lastUpdateAgeMs >= PLAYER_UPDATE_STALE_MS;
}

export function integrateZeroGActor(actor: ServerSimulatedOnlineActor, dt: number): void {
  const speed = Math.hypot(actor.velX, actor.velY, actor.velZ);
  if (speed > MAX_LAUNCH_SPEED) {
    const scale = MAX_LAUNCH_SPEED / speed;
    actor.velX *= scale;
    actor.velY *= scale;
    actor.velZ *= scale;
  }

  actor.posX += actor.velX * dt;
  actor.posY += actor.velY * dt;
  actor.posZ += actor.velZ * dt;
}

export function bounceActorInArena(actor: ServerSimulatedOnlineActor, goalAxis: 'x'|'z', faces: PortalFaces = { positive: true, negative: true }): void {
  const state = { pos: { x: actor.posX, y: actor.posY, z: actor.posZ }, vel: { x: actor.velX, y: actor.velY, z: actor.velZ } };
  const q = actor.phase === 'BREACH' ? quaternionFromYawPitchRoll(actor.yaw ?? 0) : orientationFromSnapshot({ ...actor, yaw: actor.yaw ?? 0 });
  bounceBodyArena(state, q, actor.phase, goalAxis, goalAxis === 'x' ? 'z' : 'x', actor.frozen ? undefined : faces);
  actor.posX=state.pos.x; actor.posY=state.pos.y; actor.posZ=state.pos.z;
  actor.velX=state.vel.x; actor.velY=state.vel.y; actor.velZ=state.vel.z;
}
/** Substep authoritative bots/stale humans against the same inset boxes as prediction. */
export function stepActorWorld(actor: ServerSimulatedOnlineActor, dt: number, goalAxis: 'x'|'z', boxes: readonly CollisionBox[] = [], faces?: PortalFaces): void {
  const state={pos:{x:actor.posX,y:actor.posY,z:actor.posZ},vel:{x:actor.velX,y:actor.velY,z:actor.velZ}};
  const q=actor.phase === 'BREACH' ? quaternionFromYawPitchRoll(actor.yaw ?? 0) : orientationFromSnapshot({...actor,yaw:actor.yaw ?? 0});
  advanceBodyWorld(state,dt,q,actor.phase,boxes,actor.frozen?undefined:goalAxis,faces??{positive:true,negative:true});
  actor.posX=state.pos.x; actor.posY=state.pos.y; actor.posZ=state.pos.z;
  actor.velX=state.vel.x; actor.velY=state.vel.y; actor.velZ=state.vel.z;
}

export function breachRoomCenter(
  goalAxis: "x" | "y" | "z",
  sign: 1 | -1,
): { x: number; y: number; z: number } {
  const center = { x: 0, y: 0, z: 0 };
  center[goalAxis] = sign * (ARENA_SIZE / 2 + BREACH_ROOM_D / 2);
  return center;
}

// Longest legitimate shooter→target separation: the full arena diagonal
// including both breach rooms. Anything beyond this cannot be a real hit.
export const MAX_HIT_REPORT_DISTANCE = Math.hypot(
  ARENA_SIZE + 2 * BREACH_ROOM_D,
  ARENA_SIZE,
  ARENA_SIZE,
);

export function isHitReportDistancePlausible(
  shooter: Pick<ServerSimulatedOnlineActor, "posX" | "posY" | "posZ">,
  target: Pick<ServerSimulatedOnlineActor, "posX" | "posY" | "posZ">,
): boolean {
  const dx = target.posX - shooter.posX;
  const dy = target.posY - shooter.posY;
  const dz = target.posZ - shooter.posZ;
  return dx * dx + dy * dy + dz * dz <= MAX_HIT_REPORT_DISTANCE * MAX_HIT_REPORT_DISTANCE;
}

export function isActorInEnemyBreachRoom(
  actor: Pick<ServerSimulatedOnlineActor, "posX" | "posY" | "posZ" | "team">,
  goalAxis: "x" | "z",
  goalSigns: { team0: 1 | -1; team1: 1 | -1 },
): boolean {
  const enemyTeam = (actor.team === 0 ? 1 : 0) as 0 | 1;
  const enemySign = enemyTeam === 0 ? goalSigns.team0 : goalSigns.team1;
  const perpAxis: "x" | "z" = goalAxis === "x" ? "z" : "x";
  const goalPos = goalAxis === "x" ? actor.posX : actor.posZ;
  const perpPos = perpAxis === "x" ? actor.posX : actor.posZ;
  const arenaEdge = enemySign * (ARENA_SIZE / 2);
  const roomBack = enemySign * (ARENA_SIZE / 2 + BREACH_ROOM_D);
  const inDepth = enemySign > 0
    ? goalPos > arenaEdge && goalPos < roomBack
    : goalPos < arenaEdge && goalPos > roomBack;

  return inDepth
    && Math.abs(actor.posY) < BREACH_ROOM_H / 2
    && Math.abs(perpPos) < BREACH_ROOM_W / 2;
}
