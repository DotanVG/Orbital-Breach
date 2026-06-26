import type { DebriefScreen } from "../ui/debrief";
import type { InputManager } from "../input";
import type { GlobalCursor } from "../ui/globalCursor";
import type { MobileControls } from "../ui/mobileControls";
import type { SessionMenu, SessionSettings } from "../ui/sessionMenu";
import type { SoundEngine } from "../audio/SoundEngine";
import type { DebugOverlays } from "./debugOverlays";
import { isApparentFullscreen, isFullscreen, leaveFullscreen, requestFullscreen } from "../ui/fullscreen";
import { showConfirmDialog } from "../ui/confirmDialog";

export interface GameAppSessionFlowContext {
  appMode: "menu" | "solo" | "online";
  countOtherHumans(): number;
  debrief: DebriefScreen;
  forceLeaveOnline(): Promise<void>;
  fullscreenPreference: boolean;
  helpVisible: boolean;
  input: InputManager;
  mobile: boolean;
  mobileControls: MobileControls | null;
  onlineGameActive: boolean;
  onlineMatchConcluding: boolean;
  requestLeaveOnline(reason: "user_exit" | "server_disconnect" | "join_failed"): Promise<void>;
  returnToMenuFromSolo(): void;
  sessionMenu: SessionMenu;
  sound: SoundEngine;
  debugOverlays: DebugOverlays;
}

let f11HintTimer: ReturnType<typeof setTimeout> | null = null;

export function openSessionMenu(
  app: GameAppSessionFlowContext,
  view: "settings" | "instructions" | "credits" = "settings",
): void {
  if (app.sessionMenu.isOpen() || app.debrief.isVisible() || app.onlineMatchConcluding) return;

  const inMenu = app.appMode === "menu";
  const inLiveMatch = app.appMode === "solo" || app.onlineGameActive;
  const title = inMenu
    ? "Flight Settings"
    : app.appMode === "solo"
      ? "Solo Flight Menu"
      : app.onlineGameActive
        ? "Live Match Menu"
        : "Lobby Menu";
  const subtitle = inMenu
    ? "Tune mouse and audio before launch. Close settings to continue from the main menu."
    : inLiveMatch
      ? app.mobile
        ? "Resume when you are ready, or return straight to the main menu."
        : "Resume when you are ready, then click the arena to recapture mouse look."
      : "Step back to the room shell or return all the way to the main menu.";
  const resumeLabel = inMenu
    ? "Close Settings"
    : app.appMode === "solo" || app.onlineGameActive
      ? "Resume Match"
      : "Back To Lobby";
  const mainMenuLabel = inMenu ? null : "Return To Main Menu";

  app.input.exitPointerLock();
  app.input.setUiBlocked(true);
  if (app.mobile) {
    app.mobileControls?.hide();
    app.input.setMobileControlsActive(false);
  }

  app.sessionMenu.open({
    title,
    subtitle,
    resumeLabel,
    mainMenuLabel,
  }, view);
}

export function closeSessionMenu(app: GameAppSessionFlowContext): void {
  if (!app.sessionMenu.isOpen()) return;

  app.sessionMenu.close();
  app.input.setUiBlocked(false);

  if (!app.mobile) return;
  if (app.onlineMatchConcluding || app.debrief.isVisible()) {
    app.input.setMobileControlsActive(false);
    app.mobileControls?.hide();
    return;
  }
  if (app.appMode === "solo" || app.onlineGameActive) {
    app.input.setMobileControlsActive(true);
    app.mobileControls?.show();
    return;
  }

  app.mobileControls?.hide();
  app.input.setMobileControlsActive(false);
}

export async function handleSessionMenuMainMenu(app: GameAppSessionFlowContext): Promise<void> {
  closeSessionMenu(app);
  if (app.appMode === "solo") {
    app.returnToMenuFromSolo();
    return;
  }
  if (app.appMode === "online") {
    await app.requestLeaveOnline("user_exit");
  }
}

export async function requestLeaveOnline(
  app: Pick<GameAppSessionFlowContext, "countOtherHumans" | "forceLeaveOnline"> & { isUserExitingOnline: boolean },
  reason: "user_exit" | "server_disconnect" | "join_failed",
): Promise<void> {
  if (app.isUserExitingOnline) return;

  if (reason === "user_exit" && app.countOtherHumans() > 0) {
    const confirmed = await showConfirmDialog({
      title: "Leave online room?",
      body: "Other players are still in this room. Are you sure you want to leave?",
      confirmLabel: "LEAVE",
      cancelLabel: "CANCEL",
    });
    if (!confirmed) return;
  }

  await app.forceLeaveOnline();
}

export function applySessionSettings(
  app: Pick<GameAppSessionFlowContext, "input" | "sound" | "debugOverlays">,
  settings: SessionSettings,
): void {
  app.input.mouseSensitivity = settings.mouseSensitivity;
  app.sound.setMusicVolume(settings.musicVolume);
  app.sound.setSfxVolume(settings.sfxVolume);
  app.sound.setMusicEnabled(settings.soundtrackEnabled);
  app.debugOverlays.setCollisionVisVisible(settings.collisionVisEnabled);
}

export async function applyFullscreenPreference(
  app: Pick<GameAppSessionFlowContext, "sessionMenu">,
  enabled: boolean,
): Promise<void> {
  const inApiFullscreen = isFullscreen();

  if (!enabled && !inApiFullscreen && isApparentFullscreen()) {
    app.sessionMenu.syncFullscreenFromBrowser(false);
    showF11ExitHint();
    return;
  }

  const applied = enabled
    ? (inApiFullscreen || await requestFullscreen())
    : (!inApiFullscreen || await leaveFullscreen());

  if (!applied) {
    app.sessionMenu.syncFullscreenFromBrowser();
  }
}

function showF11ExitHint(): void {
  const existing = document.getElementById("ob-f11-hint");
  if (existing) return;

  const el = document.createElement("div");
  el.id = "ob-f11-hint";
  el.textContent = "Press F11 to exit fullscreen";
  Object.assign(el.style, {
    position: "fixed",
    top: "72px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "99999",
    padding: "8px 20px",
    background: "rgba(4,6,14,0.88)",
    border: "1px solid rgba(0,229,255,0.4)",
    color: "#00e5ff",
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: "12px",
    letterSpacing: "0.12em",
    borderRadius: "4px",
    pointerEvents: "none",
    transition: "opacity 0.4s ease",
    opacity: "1",
  });
  document.body.appendChild(el);

  if (f11HintTimer !== null) clearTimeout(f11HintTimer);
  f11HintTimer = setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 400);
    f11HintTimer = null;
  }, 3000);
}
