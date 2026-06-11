import {
  ARENA_SIZE,
  BREACH_ROOM_D,
  BREACH_ROOM_H,
  BREACH_ROOM_W,
  MAX_LAUNCH_SPEED,
  PLAYER_RADIUS,
} from "../../../shared/constants";

export const PLAYER_UPDATE_STALE_MS = 250;

export interface ServerSimulatedOnlineActor {
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

export function bounceActorInArena(
  actor: ServerSimulatedOnlineActor,
  goalAxis: "x" | "z",
): void {
  const half = ARENA_SIZE / 2 - PLAYER_RADIUS;
  const perpAxis: "x" | "z" = goalAxis === "x" ? "z" : "x";

  if (actor.posY < -half) {
    actor.posY = -half;
    actor.velY = Math.abs(actor.velY);
  } else if (actor.posY > half) {
    actor.posY = half;
    actor.velY = -Math.abs(actor.velY);
  }

  if (perpAxis === "x") {
    if (actor.posX < -half) {
      actor.posX = -half;
      actor.velX = Math.abs(actor.velX);
    } else if (actor.posX > half) {
      actor.posX = half;
      actor.velX = -Math.abs(actor.velX);
    }
  } else {
    if (actor.posZ < -half) {
      actor.posZ = -half;
      actor.velZ = Math.abs(actor.velZ);
    } else if (actor.posZ > half) {
      actor.posZ = half;
      actor.velZ = -Math.abs(actor.velZ);
    }
  }

  const perpPos = perpAxis === "x" ? actor.posX : actor.posZ;
  const inPortal = Math.abs(actor.posY) < BREACH_ROOM_H / 2 - PLAYER_RADIUS
    && Math.abs(perpPos) < BREACH_ROOM_W / 2 - PLAYER_RADIUS;
  const maxDepth = ARENA_SIZE / 2 + BREACH_ROOM_D - PLAYER_RADIUS;

  if (goalAxis === "x") {
    if (actor.posX < -half) {
      if (inPortal) {
        if (actor.posX < -maxDepth) {
          actor.posX = -maxDepth;
          actor.velX = Math.abs(actor.velX);
        }
      } else {
        actor.posX = -half;
        actor.velX = Math.abs(actor.velX);
      }
    } else if (actor.posX > half) {
      if (inPortal) {
        if (actor.posX > maxDepth) {
          actor.posX = maxDepth;
          actor.velX = -Math.abs(actor.velX);
        }
      } else {
        actor.posX = half;
        actor.velX = -Math.abs(actor.velX);
      }
    }
  } else {
    if (actor.posZ < -half) {
      if (inPortal) {
        if (actor.posZ < -maxDepth) {
          actor.posZ = -maxDepth;
          actor.velZ = Math.abs(actor.velZ);
        }
      } else {
        actor.posZ = -half;
        actor.velZ = Math.abs(actor.velZ);
      }
    } else if (actor.posZ > half) {
      if (inPortal) {
        if (actor.posZ > maxDepth) {
          actor.posZ = maxDepth;
          actor.velZ = -Math.abs(actor.velZ);
        }
      } else {
        actor.posZ = half;
        actor.velZ = -Math.abs(actor.velZ);
      }
    }
  }
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
