import { GRAB_RADIUS } from "../../../shared/constants";
import type { MultiplayerRoomSnapshot } from "../../../shared/multiplayer";
import type { Arena } from "../arena/arena";
import type { SoundEngine } from "../audio/SoundEngine";
import type { CameraController } from "../camera";
import type { InputManager } from "../input";
import type { LocalMatch } from "../match/localMatch";
import type { OnlineMatch } from "../match/onlineMatch";
import type { NetClient } from "../net/client";
import type { LocalPlayer } from "../player";
import type { GunViewModel } from "../render/gun";
import type { HUD } from "../render/hud";
import type { FirstTimeTutorial } from "../render/hud/tutorial";
import type { SceneManager } from "../render/scene";
import type { MobileControls } from "../ui/mobileControls";
import type { DebugOverlays } from "./debugOverlays";
import type { MatchStatsTracker } from "./matchStatsTracker";
import type { ProjectileSystem } from "./projectileSystem";
import type { RoundController } from "./roundController";

/**
 * Everything the per-frame solo/online tick functions need from the App.
 * Subsystem references are stable; the mutable fields are getter/setter
 * properties backed by the App's own state so both sides stay in sync.
 */
export interface GameTickContext {
  arena: Arena;
  cam: CameraController;
  debugOverlays: DebugOverlays;
  gun: GunViewModel;
  hud: HUD;
  input: InputManager;
  match: LocalMatch;
  matchStats: MatchStatsTracker;
  mobile: boolean;
  mobileControls: MobileControls | null;
  net: NetClient;
  onlineMatch: OnlineMatch;
  player: LocalPlayer;
  projectiles: ProjectileSystem;
  round: RoundController;
  sceneMgr: SceneManager;
  sound: SoundEngine;
  tutorial: FirstTimeTutorial;

  // Mutable app state, backed by App fields.
  helpVisible: boolean;
  latestOnlineSnapshot: MultiplayerRoomSnapshot | null;
  onlineBreachReported: boolean;
  onlineGameActive: boolean;
  onlinePlayerName: string;
  onlineRoundActive: boolean;
  playerUpdateTimer: number;
  thirdPerson: boolean;
  victoryOrbitAngle: number;

  // Callbacks into App logic that stays there.
  disableOnlineProjectiles(): void;
  getOnlineLocalActorId(): string;
  isRearViewCameraActive(): boolean;
  toggleCameraView(): void;
  updateGunVisibility(isSelfie: boolean): void;
}

/** Aiming mode, zero-G camera mode, transitions, and mouse look — shared
 *  prelude of both the solo and online ticks. */
export function tickCameraLook(ctx: GameTickContext, dt: number): void {
  ctx.input.setAimingMode(ctx.player.phase === "AIMING");
  ctx.cam.setZeroGMode(ctx.player.phase !== "BREACH");
  ctx.cam.tickTransition(dt);

  const { dx, dy } = ctx.input.consumeMouseDelta();
  ctx.cam.applyMouseDelta(dx, dy, ctx.input.mouseSensitivity);
}

/** Victory-orbit or follow camera plus gun visibility — shared tail of both ticks. */
export function applyCameraAndGun(ctx: GameTickContext, dt: number): void {
  if (ctx.player.isVictoryDanceActive()) {
    ctx.victoryOrbitAngle += 0.7 * dt;
    ctx.cam.applyVictoryOrbit(
      ctx.player.getPosition(),
      ctx.victoryOrbitAngle,
      ctx.arena.getThirdPersonCameraCollisionAABBs(),
    );
    ctx.updateGunVisibility(false);
  } else {
    const isSelfie = ctx.isRearViewCameraActive();
    const cameraCollisionBoxes = ctx.thirdPerson
      ? ctx.arena.getThirdPersonCameraCollisionAABBs()
      : [];
    ctx.cam.apply(ctx.player.getPosition(), ctx.thirdPerson, isSelfie, cameraCollisionBoxes);
    ctx.updateGunVisibility(isSelfie);
  }
}

export function computeNearBar(ctx: GameTickContext): boolean {
  let nearBar = ctx.arena.getNearestBar(ctx.player.getPosition(), GRAB_RADIUS) !== null;
  if (ctx.player.phase === "BREACH" && !ctx.arena.isGoalDoorOpen(ctx.player.currentBreachTeam)) {
    nearBar = false;
  }
  return nearBar;
}

export function updateMobileHudControls(ctx: GameTickContext, nearBar: boolean): void {
  if (!ctx.mobile || !ctx.mobileControls) return;

  const canGrab = !ctx.player.damage.leftArm && !ctx.player.damage.frozen;
  ctx.mobileControls.setPhase(ctx.player.phase);
  ctx.mobileControls.setNearBar(nearBar, canGrab);
  const showPower = ctx.player.phase === "GRABBING" || ctx.player.phase === "AIMING";
  const max = ctx.player.maxLaunchPower();
  const pct = max > 0 ? ctx.player.launchPower / max : 0;
  ctx.mobileControls.setPowerLevel(pct, showPower);
  ctx.mobileControls.setViewMode(ctx.thirdPerson);
}
