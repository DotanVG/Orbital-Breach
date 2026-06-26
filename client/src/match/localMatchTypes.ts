import * as THREE from "three";
import type { DamageState, PlayerPhase } from "../../../shared/schema";
import type { Vec3 } from "../../../shared/vec3";
import type { PhysicsState } from "../physics";
import { BotBrain } from "./botBrain";
import { SimulatedPlayerAvatar } from "./simulatedPlayerAvatar";

export const LOCAL_PLAYER_ID = "local-player";

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

export interface LocalMatchStatsActor {
  id: string;
  name: string;
  team: 0 | 1;
  isBot: boolean;
  isSelf: boolean;
  freezes: number;
  frozen: number;
  position: Vec3;
}

export type LocalMatchEvent =
  | {
    type: "hitConfirm";
    team: 0 | 1;
  }
  | {
    type: "freeze";
    killerName: string;
    killerTeam: 0 | 1;
    victimName: string;
    victimTeam: 0 | 1;
  }
  | {
    type: "score";
    scorerId: string;
    scorerName: string;
    scorerTeam: 0 | 1;
  }
  | {
    type: "roundTie";
  }
  | {
    reason: "breach" | "fullFreeze";
    type: "roundWin";
    winningTeam: 0 | 1;
  }
  | {
    type: "matchEnd";
    winningTeam: 0 | 1;
    finalScore: { team0: number; team1: number };
  };

export interface BotState {
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
  breachEntryCarry: THREE.Vector3;
  breachEntryCarryTimer: number;
  rot: { yaw: number; pitch: number };
  team: 0 | 1;
}
