import { FEATURE_FLAGS } from "../featureFlags";
import type { App } from "./gameApp";
import {
  isThirdPersonCameraView,
  resolveCameraViewModeForRound,
  toggleCameraViewMode,
  type CameraViewMode,
} from "./cameraViewMode";

// ponytail: view-state helpers operate on the existing App state bag, upgrade when App is split into owned controllers
export function disableOnlineProjectiles(app: App): void {
  const state = app as any;
  state.onlineRoundActive = false;
  state.projectiles.clear();
}

export function cleanEmbedUrl(): void {
  if (typeof window === "undefined") return;
  if (!window.location.search) return;
  history.replaceState(null, "", window.location.pathname);
}

export function cleanPortalUrl(app: App): void {
  const state = app as any;
  if (state.portalUrlCleaned || typeof window === "undefined") return;
  if (!window.location.search) return;
  history.replaceState(null, "", window.location.pathname);
  state.portalUrlCleaned = true;
}

export function getOnlineLocalActorId(app: App): string {
  const state = app as any;
  return state.net.getSessionId() ?? "local-player";
}

export function setCelebratingTeam(app: App, team: 0 | 1): void {
  const state = app as any;
  const playerWins = state.player.team === team && !state.player.damage.frozen;
  state.player.setVictoryDanceActive(playerWins);
  if (playerWins) {
    state.thirdPerson = true;
  }
  state.match.setCelebratingTeam(team);
  state.onlineMatch.setCelebratingTeam(team);
}

export function clearCelebrationState(app: App): void {
  const state = app as any;
  state.player.setVictoryDanceActive(false);
  state.thirdPerson = isThirdPersonCameraView(state.selectedCameraViewMode);
  state.victoryOrbitAngle = 0;
  state.match.setCelebratingTeam(null);
  state.onlineMatch.setCelebratingTeam(null);
}

export function isRearViewCameraActive(app: App): boolean {
  const state = app as any;
  return FEATURE_FLAGS.thirdPersonLookBehind && state.input.isSelfieHeld();
}

export function applySelectedCameraViewMode(app: App, mode: CameraViewMode): void {
  const state = app as any;
  state.selectedCameraViewMode = mode;
  state.thirdPerson = isThirdPersonCameraView(mode);
}

export function resetCameraViewModeToDefault(app: App): void {
  const state = app as any;
  applySelectedCameraViewMode(
    app,
    resolveCameraViewModeForRound(state.sessionMenu.getSettings().defaultCameraMode, null),
  );
}

export function toggleCameraView(app: App): void {
  const state = app as any;
  applySelectedCameraViewMode(app, toggleCameraViewMode(state.selectedCameraViewMode));
}
