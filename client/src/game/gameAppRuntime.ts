import type { App } from "./gameApp";
import type { GameTickContext } from "./tickContext";
import { getScoreboardCursorTransition } from "./scoreboardCursor";
import { shouldShowDesktopOverlayCursor } from "./overlayCursor";
import { clearVibeJamPortals } from "./portal/vibeJamPortal";
import {
  disableOnlineProjectiles,
  getOnlineLocalActorId,
  isRearViewCameraActive,
  toggleCameraView,
} from "./gameAppViewState";

// ponytail: runtime helpers operate on the existing App state bag, upgrade when App is split into owned controllers
export function createGameTickContext(app: App): GameTickContext {
  const state = app as any;
  return {
    arena: state.arena,
    cam: state.cam,
    debugOverlays: state.debugOverlays,
    gun: state.gun,
    hud: state.hud,
    input: state.input,
    match: state.match,
    matchStats: state.matchStats,
    mobile: state.mobile,
    mobileControls: state.mobileControls,
    net: state.net,
    onlineMatch: state.onlineMatch,
    player: state.player,
    projectiles: state.projectiles,
    round: state.round,
    sceneMgr: state.sceneMgr,
    sound: state.sound,
    tutorial: state.tutorial,

    get helpVisible() { return state.helpVisible; },
    get latestOnlineSnapshot() { return state.latestOnlineSnapshot; },
    get onlineBreachReported() { return state.onlineBreachReported; },
    set onlineBreachReported(value: boolean) { state.onlineBreachReported = value; },
    get onlineGameActive() { return state.onlineGameActive; },
    get onlinePlayerName() { return state.onlinePlayerName; },
    get onlineRoundActive() { return state.onlineRoundActive; },
    get playerUpdateTimer() { return state.playerUpdateTimer; },
    set playerUpdateTimer(value: number) { state.playerUpdateTimer = value; },
    get thirdPerson() { return state.thirdPerson; },
    get victoryOrbitAngle() { return state.victoryOrbitAngle; },
    set victoryOrbitAngle(value: number) { state.victoryOrbitAngle = value; },

    disableOnlineProjectiles: () => disableOnlineProjectiles(app),
    getOnlineLocalActorId: () => getOnlineLocalActorId(app),
    isRearViewCameraActive: () => isRearViewCameraActive(app),
    toggleCameraView: () => toggleCameraView(app),
    updateGunVisibility: (isSelfie: boolean) => updateGunVisibility(app, isSelfie),
  };
}

export function updateGunVisibility(app: App, isSelfie: boolean): void {
  const state = app as any;
  const phase = state.round.getPhase();
  const playerAlive = state.player.phase !== "RESPAWNING";
  const roundActive = state.appMode === "online" ? state.onlineGameActive : phase !== "LOBBY";
  state.player.setWorldModelVisible(playerAlive && (state.thirdPerson || isSelfie));

  state.player.setThirdPersonGunVisible(
    roundActive && playerAlive && (state.thirdPerson || isSelfie),
  );
  state.gun.setVisible(roundActive && playerAlive && !state.thirdPerson && !isSelfie);

  const incapacitated = state.player.damage.frozen || state.player.damage.rightArm;
  const enemyColor = state.player.team === 0 ? 0xff00ff : 0x00ffff;
  const tint = incapacitated ? enemyColor : null;
  state.gun.setFrozenTint(tint);
  state.player.setThirdPersonGunFrozenTint(tint);
}

export function syncLocalOnlineActor(app: App, snapshot: any): void {
  const state = app as any;
  const selfActor = snapshot.actors.find((actor: any) => actor.id === snapshot.sessionId);
  if (!selfActor) return;
  if (document.hidden) {
    state.player.applyAuthoritativeOnlineMotion(selfActor);
  }
  state.player.applyAuthoritativeOnlineState(selfActor);
}

export function resyncLocalOnlineActorFromLatestSnapshot(app: App): void {
  const state = app as any;
  if (state.appMode !== "online" || !state.onlineGameActive) return;
  const snapshot = state.latestOnlineSnapshot;
  if (!snapshot) return;

  const selfActor = snapshot.actors.find((actor: any) => actor.id === snapshot.sessionId);
  if (!selfActor) return;

  state.player.applyAuthoritativeOnlineMotion(selfActor);
  state.player.applyAuthoritativeOnlineState(selfActor);
}

export function syncBackgroundInputPolicy(app: App): void {
  const state = app as any;
  state.input.setBackgroundStateClearingEnabled(state.appMode !== "online");
}

export function isGameplaySceneActive(app: App): boolean {
  const state = app as any;
  return !state.debrief.isVisible()
    && (state.appMode === "solo" || (state.appMode === "online" && state.onlineGameActive));
}

export function handleScoreboardTabHoldChange(app: App, held: boolean): void {
  const state = app as any;
  const transition = getScoreboardCursorTransition(held, {
    desktop: !state.mobile,
    gameplayActive: isGameplaySceneActive(app),
    pointerLocked: state.input.isLocked(),
    restorePointerLockAfterScoreboard: state.restorePointerLockAfterScoreboard,
    sessionMenuOpen: state.sessionMenu.isOpen(),
  });
  state.restorePointerLockAfterScoreboard = transition.nextRestorePointerLockAfterScoreboard;

  if (transition.showCursor) state.cursor.show();
  if (transition.hideCursor) state.cursor.hide();
  if (transition.exitPointerLock) state.input.exitPointerLock();
  if (transition.requestPointerLock) state.input.lockPointer(state.sceneMgr.getRenderer().domElement);
}

export function syncCombatPresentation(app: App, gameplayActive: boolean): void {
  const state = app as any;
  if (!gameplayActive) {
    if (state.combatPresentationActive) {
      state.projectiles.clear();
      clearVibeJamPortals();
      state.arena.setPortalDoorsOpen(false);
    }
    state.gun.setVisible(false);
    state.gun.setFrozenTint(null);
    state.player.setWorldModelVisible(false);
    state.player.setThirdPersonGunVisible(false);
    state.player.setThirdPersonGunFrozenTint(null);
  }

  state.combatPresentationActive = gameplayActive;
}

export function syncDesktopOverlayCursor(app: App, gameplayActive: boolean): void {
  const state = app as any;
  if (!gameplayActive) return;
  if (shouldShowDesktopOverlayCursor({
    gameplayActive,
    mobile: state.mobile,
    sessionMenuOpen: state.sessionMenu.isOpen(),
    tabHeld: state.input.isTabHeld(),
  })) {
    state.cursor.show();
  } else {
    state.cursor.hide();
  }
}
