import { GRAB_RADIUS } from "../../../shared/constants";
import type { SharedArenaQuery } from "../../../shared/player-logic";
import type { DamageState, PlayerPhase } from "../../../shared/schema";
import type { Vec3 } from "../../../shared/vec3";
import { v3 } from "../../../shared/vec3";

const DEFAULT_WORLD_UP = { x: 0, y: 1, z: 0 } as const;
const MAX_FOCUS_RANGE = 26;

type BotArchetype = "sprinter" | "hunter" | "drifter" | "anchor" | "rookie";

export interface BotSnapshot {
  currentBreachTeam: 0 | 1;
  damage: DamageState;
  phase: PlayerPhase;
  pos: Vec3;
  rot: { yaw: number; pitch: number };
  team: 0 | 1;
}

export interface EnemySnapshot {
  id: string;
  phase: PlayerPhase;
  pos: Vec3;
  team: 0 | 1;
}

export interface BotCommand {
  aimHeld: boolean;
  fire: boolean;
  grab: boolean;
  lookPitch: number;
  lookYaw: number;
  targetBar: Vec3 | null;
  walkAxes: { x: number; z: number };
}

export interface BarSelectionTuning {
  directionWeight?: number;
  distanceWeight?: number;
  lateralBias?: number;
  verticalBias?: number;
  noiseSeed?: number;
  pathNoise?: number;
}

export interface BotPersonality {
  aimNoise: number;
  aimReleaseMax: number;
  aimReleaseMin: number;
  archetype: BotArchetype;
  barDirectionWeight: number;
  barDistanceWeight: number;
  barLateralBias: number;
  barVerticalBias: number;
  breachForwardBias: number;
  breachStrafeAmplitude: number;
  breachWeaveSpeed: number;
  decisionInterval: number;
  enemyFocusBias: number;
  fireCooldown: number;
  fireRange: number;
  grabDecisionDelay: number;
  launchChargeSeconds: number;
  pathNoise: number;
  rngSeed: number;
  weaveOffset: number;
}

export function pickPreferredBar(
  botPos: Vec3,
  bars: Vec3[],
  preferredDirection: Vec3,
  tuning: BarSelectionTuning = {},
): Vec3 | null {
  const preferred = v3.normalize(preferredDirection);
  const lateralRaw = v3.cross(DEFAULT_WORLD_UP, preferred);
  const lateral = v3.lengthSq(lateralRaw) > 1e-6
    ? v3.normalize(lateralRaw)
    : { x: 1, y: 0, z: 0 };
  let bestBar: Vec3 | null = null;
  let bestScore = -Infinity;

  for (const bar of bars) {
    const toBar = v3.sub(bar, botPos);
    const distance = v3.length(toBar);
    if (distance <= 1e-6) return v3.clone(bar);

    const normal = v3.normalize(toBar);
    const directionScore = v3.dot(normal, preferred);
    const distanceScore = 1 / Math.max(distance, 0.001);
    const lateralScore = v3.dot(normal, lateral);
    const verticalScore = normal.y;
    const noiseScore = sampleBarNoise(bar, tuning.noiseSeed ?? 0);
    const score = directionScore * (tuning.directionWeight ?? 3)
      + distanceScore * (tuning.distanceWeight ?? 1)
      + lateralScore * (tuning.lateralBias ?? 0)
      + verticalScore * (tuning.verticalBias ?? 0)
      + noiseScore * (tuning.pathNoise ?? 0);

    if (score > bestScore) {
      bestScore = score;
      bestBar = v3.clone(bar);
    }
  }

  return bestBar;
}

function directionToRotation(dir: Vec3): { yaw: number; pitch: number } {
  const normal = v3.normalize(dir);
  return {
    yaw: Math.atan2(-normal.x, -normal.z),
    pitch: Math.asin(Math.max(-1, Math.min(1, normal.y))),
  };
}

function breachExitDirection(arena: SharedArenaQuery, team: 0 | 1): Vec3 {
  const axis = arena.getBreachOpenAxis(team);
  const sign = arena.getBreachOpenSign(team);
  return axis === "x"
    ? { x: sign, y: 0, z: 0 }
    : axis === "y"
      ? { x: 0, y: sign, z: 0 }
      : { x: 0, y: 0, z: sign };
}

function findNearestEnemy(
  bot: BotSnapshot,
  enemies: EnemySnapshot[],
  maxDistance = MAX_FOCUS_RANGE,
): EnemySnapshot | null {
  let best: EnemySnapshot | null = null;
  let bestDistance = maxDistance;

  for (const enemy of enemies) {
    if (enemy.team === bot.team) continue;
    if (enemy.phase === "FROZEN" || enemy.phase === "RESPAWNING") continue;
    const distance = v3.dist(bot.pos, enemy.pos);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = enemy;
    }
  }

  return best;
}

export function createBotPersonality(id: string, team: 0 | 1): BotPersonality {
  const seeded = createSeededRandom(hashString(`${id}:${team}`));
  const archetypes: BotArchetype[] = ["sprinter", "hunter", "drifter", "anchor", "rookie"];
  const archetype = archetypes[Math.floor(seeded() * archetypes.length)];
  const sideBias = seeded() < 0.5 ? -1 : 1;
  const profile = createArchetypeProfile(archetype, seeded, sideBias);
  profile.rngSeed = hashString(`${id}:${team}:rng`);
  return profile;
}

export class BotBrain {
  private aimProgress = 0;
  private decisionTimer = 0;
  private fireCooldown = 0;
  private grabDelay = 0;
  private lastPhase: PlayerPhase | null = null;
  private releaseThreshold = 0;
  private roamTime = 0;
  private rngState = 0;
  private selectedBar: Vec3 | null = null;

  public constructor(
    private readonly personality: BotPersonality = createBotPersonality("bot-default", 0),
  ) {
    this.rngState = personality.rngSeed >>> 0;
    this.releaseThreshold = this.randomReleaseThreshold();
  }

  public tick(
    bot: BotSnapshot,
    arena: SharedArenaQuery,
    bars: Vec3[],
    enemies: EnemySnapshot[],
    dt: number,
  ): BotCommand {
    this.roamTime += dt;
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.decisionTimer = Math.max(0, this.decisionTimer - dt);

    if (bot.phase !== this.lastPhase) {
      this.handlePhaseChange(bot.phase);
      this.lastPhase = bot.phase;
    }

    const enemyPortal = arena.getBreachRoomCenter((1 - bot.team) as 0 | 1);
    const preferredBar = this.choosePreferredBar(bot.pos, bars, v3.sub(enemyPortal, bot.pos));
    const focusEnemy = findNearestEnemy(
      bot,
      enemies,
      Math.min(MAX_FOCUS_RANGE, this.personality.fireRange * (0.8 + this.personality.enemyFocusBias)),
    );
    const firingEnemy = findNearestEnemy(bot, enemies, this.personality.fireRange);

    let aimDir = v3.sub(enemyPortal, bot.pos);
    if (preferredBar) aimDir = v3.sub(preferredBar, bot.pos);
    if (focusEnemy) aimDir = v3.sub(focusEnemy.pos, bot.pos);
    aimDir = this.applyAimNoise(aimDir);

    let look = directionToRotation(aimDir);
    let walkAxes = { x: 0, z: 0 };
    let grab = false;
    let aimHeld = false;

    if (bot.phase === "BREACH") {
      look = directionToRotation(breachExitDirection(arena, bot.currentBreachTeam));
      walkAxes = {
        x: Math.max(
          -1,
          Math.min(
            1,
            Math.sin(this.roamTime * this.personality.breachWeaveSpeed + this.personality.weaveOffset)
              * this.personality.breachStrafeAmplitude,
          ),
        ),
        z: this.personality.breachForwardBias,
      };
    } else if (bot.phase === "FLOATING") {
      if (preferredBar && v3.dist(bot.pos, preferredBar) <= GRAB_RADIUS * 1.15 && !bot.damage.leftArm) {
        grab = true;
      }
    } else if (bot.phase === "GRABBING") {
      this.grabDelay = Math.max(0, this.grabDelay - dt);
      aimHeld = this.grabDelay <= 0 && !bot.damage.frozen && !bot.damage.leftArm;
    } else if (bot.phase === "AIMING") {
      this.aimProgress = Math.min(1, this.aimProgress + dt / this.personality.launchChargeSeconds);
      aimHeld = this.aimProgress < this.releaseThreshold;
      if (!aimHeld) {
        this.aimProgress = 0;
        this.releaseThreshold = this.randomReleaseThreshold();
      }
      const targetDir = focusEnemy
        ? v3.sub(focusEnemy.pos, bot.pos)
        : v3.sub(enemyPortal, bot.pos);
      look = directionToRotation(this.applyAimNoise(targetDir));
    } else if (bot.phase === "FROZEN") {
      this.aimProgress = 0;
      this.selectedBar = null;
    }

    let fire = false;
    if (!bot.damage.rightArm && firingEnemy && this.fireCooldown <= 0) {
      fire = true;
      this.fireCooldown = this.personality.fireCooldown;
      look = directionToRotation(this.applyAimNoise(v3.sub(firingEnemy.pos, bot.pos)));
    }

    return {
      aimHeld,
      fire,
      grab,
      lookPitch: look.pitch,
      lookYaw: look.yaw,
      targetBar: preferredBar,
      walkAxes,
    };
  }

  public getLaunchChargeSeconds(): number {
    return this.personality.launchChargeSeconds;
  }

  private applyAimNoise(dir: Vec3): Vec3 {
    if (this.personality.aimNoise <= 1e-4) return dir;
    return {
      x: dir.x + Math.sin(this.roamTime * 2.7 + this.personality.weaveOffset) * this.personality.aimNoise,
      y: dir.y + Math.cos(this.roamTime * 1.9 + this.personality.weaveOffset * 0.7) * this.personality.aimNoise * 0.45,
      z: dir.z + Math.sin(this.roamTime * 2.1 - this.personality.weaveOffset * 0.4) * this.personality.aimNoise,
    };
  }

  private choosePreferredBar(botPos: Vec3, bars: Vec3[], preferredDirection: Vec3): Vec3 | null {
    const shouldRepath = !this.selectedBar
      || this.decisionTimer <= 0
      || v3.dist(botPos, this.selectedBar) <= GRAB_RADIUS * 1.4;

    if (shouldRepath) {
      this.selectedBar = pickPreferredBar(botPos, bars, preferredDirection, {
        directionWeight: this.personality.barDirectionWeight,
        distanceWeight: this.personality.barDistanceWeight,
        lateralBias: this.personality.barLateralBias,
        verticalBias: this.personality.barVerticalBias,
        noiseSeed: this.personality.weaveOffset,
        pathNoise: this.personality.pathNoise,
      });
      this.decisionTimer = this.personality.decisionInterval;
    }

    return this.selectedBar ? v3.clone(this.selectedBar) : null;
  }

  private handlePhaseChange(phase: PlayerPhase): void {
    if (phase === "GRABBING") {
      this.grabDelay = this.personality.grabDecisionDelay;
      this.aimProgress = 0;
      return;
    }

    if (phase === "AIMING") {
      this.aimProgress = 0;
      this.releaseThreshold = this.randomReleaseThreshold();
      return;
    }

    if (phase !== "FLOATING") {
      this.selectedBar = null;
    }
  }

  private nextRandom(): number {
    this.rngState = (this.rngState + 0x6d2b79f5) >>> 0;
    let t = this.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  private randomReleaseThreshold(): number {
    return this.personality.aimReleaseMin
      + this.nextRandom() * (this.personality.aimReleaseMax - this.personality.aimReleaseMin);
  }
}

function createArchetypeProfile(
  archetype: BotArchetype,
  seeded: () => number,
  sideBias: 1 | -1,
): BotPersonality {
  const base = {
    aimNoise: 0.2,
    aimReleaseMax: 0.88,
    aimReleaseMin: 0.7,
    archetype,
    barDirectionWeight: 3,
    barDistanceWeight: 1,
    barLateralBias: sideBias * 0.25,
    barVerticalBias: 0,
    breachForwardBias: 1,
    breachStrafeAmplitude: 0.18,
    breachWeaveSpeed: 1.6,
    decisionInterval: 0.4,
    enemyFocusBias: 0.5,
    fireCooldown: 0.55,
    fireRange: 18,
    grabDecisionDelay: 0.12,
    launchChargeSeconds: 0.9,
    pathNoise: 0.08,
    rngSeed: 0,
    weaveOffset: seeded() * Math.PI * 2,
  } satisfies BotPersonality;

  if (archetype === "sprinter") {
    base.aimNoise = 0.3 + seeded() * 0.12;
    base.barDistanceWeight = 1.4 + seeded() * 0.4;
    base.barLateralBias = sideBias * (0.15 + seeded() * 0.3);
    base.breachStrafeAmplitude = 0.2 + seeded() * 0.12;
    base.decisionInterval = 0.18 + seeded() * 0.16;
    base.enemyFocusBias = 0.38 + seeded() * 0.16;
    base.fireCooldown = 0.42 + seeded() * 0.18;
    base.fireRange = 15 + seeded() * 2.5;
    base.grabDecisionDelay = 0.02 + seeded() * 0.08;
    base.launchChargeSeconds = 0.58 + seeded() * 0.18;
    base.pathNoise = 0.16 + seeded() * 0.14;
  } else if (archetype === "hunter") {
    base.aimNoise = 0.05 + seeded() * 0.08;
    base.aimReleaseMin = 0.74 + seeded() * 0.06;
    base.aimReleaseMax = 0.86 + seeded() * 0.08;
    base.barDirectionWeight = 3.2 + seeded() * 0.7;
    base.barDistanceWeight = 0.7 + seeded() * 0.35;
    base.barVerticalBias = -0.18 + seeded() * 0.36;
    base.breachStrafeAmplitude = 0.08 + seeded() * 0.08;
    base.decisionInterval = 0.22 + seeded() * 0.18;
    base.enemyFocusBias = 0.82 + seeded() * 0.18;
    base.fireCooldown = 0.34 + seeded() * 0.14;
    base.fireRange = 20 + seeded() * 4;
    base.grabDecisionDelay = 0.04 + seeded() * 0.1;
    base.launchChargeSeconds = 0.74 + seeded() * 0.16;
    base.pathNoise = 0.04 + seeded() * 0.06;
  } else if (archetype === "drifter") {
    base.aimNoise = 0.26 + seeded() * 0.24;
    base.aimReleaseMin = 0.62 + seeded() * 0.06;
    base.aimReleaseMax = 0.82 + seeded() * 0.1;
    base.barDirectionWeight = 2.1 + seeded() * 0.55;
    base.barDistanceWeight = 0.95 + seeded() * 0.4;
    base.barLateralBias = sideBias * (0.72 + seeded() * 0.4);
    base.barVerticalBias = -0.45 + seeded() * 0.9;
    base.breachStrafeAmplitude = 0.44 + seeded() * 0.22;
    base.breachWeaveSpeed = 1.2 + seeded() * 0.7;
    base.decisionInterval = 0.38 + seeded() * 0.32;
    base.enemyFocusBias = 0.22 + seeded() * 0.16;
    base.fireCooldown = 0.62 + seeded() * 0.22;
    base.fireRange = 13 + seeded() * 3;
    base.grabDecisionDelay = 0.12 + seeded() * 0.2;
    base.launchChargeSeconds = 0.88 + seeded() * 0.26;
    base.pathNoise = 0.22 + seeded() * 0.18;
  } else if (archetype === "anchor") {
    base.aimNoise = 0.1 + seeded() * 0.16;
    base.aimReleaseMin = 0.78 + seeded() * 0.08;
    base.aimReleaseMax = 0.9 + seeded() * 0.06;
    base.barDirectionWeight = 3.6 + seeded() * 0.7;
    base.barDistanceWeight = 0.45 + seeded() * 0.22;
    base.barLateralBias = sideBias * (0.06 + seeded() * 0.12);
    base.barVerticalBias = -0.1 + seeded() * 0.2;
    base.breachForwardBias = 0.82 + seeded() * 0.1;
    base.breachStrafeAmplitude = 0.04 + seeded() * 0.08;
    base.decisionInterval = 0.36 + seeded() * 0.2;
    base.enemyFocusBias = 0.48 + seeded() * 0.18;
    base.fireCooldown = 0.44 + seeded() * 0.18;
    base.fireRange = 18 + seeded() * 3;
    base.grabDecisionDelay = 0.08 + seeded() * 0.12;
    base.launchChargeSeconds = 0.92 + seeded() * 0.16;
    base.pathNoise = 0.02 + seeded() * 0.05;
  } else {
    base.aimNoise = 0.48 + seeded() * 0.28;
    base.aimReleaseMin = 0.58 + seeded() * 0.08;
    base.aimReleaseMax = 0.84 + seeded() * 0.12;
    base.barDirectionWeight = 2.05 + seeded() * 0.4;
    base.barDistanceWeight = 1.1 + seeded() * 0.35;
    base.barLateralBias = sideBias * (0.28 + seeded() * 0.22);
    base.barVerticalBias = -0.24 + seeded() * 0.5;
    base.breachForwardBias = 0.72 + seeded() * 0.16;
    base.breachStrafeAmplitude = 0.16 + seeded() * 0.14;
    base.breachWeaveSpeed = 0.95 + seeded() * 0.45;
    base.decisionInterval = 0.58 + seeded() * 0.34;
    base.enemyFocusBias = 0.12 + seeded() * 0.22;
    base.fireCooldown = 0.74 + seeded() * 0.26;
    base.fireRange = 11 + seeded() * 4;
    base.grabDecisionDelay = 0.18 + seeded() * 0.28;
    base.launchChargeSeconds = 1 + seeded() * 0.24;
    base.pathNoise = 0.16 + seeded() * 0.18;
  }

  return base;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleBarNoise(bar: Vec3, seed: number): number {
  const wave = Math.sin(bar.x * 12.9898 + bar.y * 78.233 + bar.z * 37.719 + seed * 0.001);
  return (wave - Math.floor(wave)) * 2 - 1;
}
