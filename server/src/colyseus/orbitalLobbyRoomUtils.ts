import { DEFAULT_PLAYER_NAME } from "../../../shared/callSigns";
import { ARENA_SIZE } from "../../../shared/constants";
import { isCallSignClean } from "../../../shared/profanity";
import { breachRoomCenter } from "./onlineActorSimulation";

export const POS_CLAMP = ARENA_SIZE * 4;

export function sanitizePlayerName(rawName?: string): string {
  const trimmed = rawName?.trim().replace(/[^\x20-\x7E]/g, "").slice(0, 16);
  if (!trimmed || trimmed.length === 0) return DEFAULT_PLAYER_NAME;
  return isCallSignClean(trimmed) ? trimmed : DEFAULT_PLAYER_NAME;
}

export function clampFinite(value: number, min: number, max: number): number {
  if (!isFinite(value)) return 0;
  return Math.min(max, Math.max(min, value));
}

export function normalizeDirection(
  x: number,
  y: number,
  z: number,
): { x: number; y: number; z: number } | null {
  const length = Math.hypot(x, y, z);
  if (!isFinite(length) || length < 1e-5) return null;
  return {
    x: x / length,
    y: y / length,
    z: z / length,
  };
}

export function breachExitYaw(axis: "x" | "y" | "z", openSign: 1 | -1): number {
  const dx = axis === "x" ? openSign : 0;
  const dz = axis === "z" ? openSign : 0;
  return Math.atan2(-dx, -dz);
}

export function makeServerArenaQuery(
  goalAxis: "x" | "y" | "z",
  goalSigns: { team0: 1 | -1; team1: 1 | -1 },
) {
  const center0 = breachRoomCenter(goalAxis, goalSigns.team0);
  const center1 = breachRoomCenter(goalAxis, goalSigns.team1);
  const openSign0 = (-goalSigns.team0) as 1 | -1;
  const openSign1 = (-goalSigns.team1) as 1 | -1;
  return {
    getBreachRoomCenter: (team: 0 | 1) => (team === 0 ? center0 : center1),
    getBreachOpenAxis: (_team: 0 | 1) => goalAxis,
    getBreachOpenSign: (team: 0 | 1) => (team === 0 ? openSign0 : openSign1),
  };
}
