import * as THREE from "three";
import { DEFAULT_PLAYER_NAME } from "../../../shared/callSigns";
import { generateArenaLayout } from "../../../shared/arena-gen";
import {
  getInviteRoomIdFromSearch,
  MULTIPLAYER_INVITE_PARAM,
  type MultiplayerJoinTarget,
  type MultiplayerRoomSnapshot,
} from "../../../shared/multiplayer";
import type { Arena } from "../arena/arena";
import type { CameraController } from "../camera";
import type { DebriefData, DebriefPlayer, DebriefScreen } from "../ui/debrief";
import type { DebugOverlays } from "./debugOverlays";
import type { GunViewModel } from "../render/gun";
import { buildRoundEndHtml, type HUD } from "../render/hud";
import type { InputManager } from "../input";
import type { KillFeed } from "../ui/kill-feed";
import type { MainMenu, PlaySelection } from "../ui/menu";
import type { MatchStatsTracker, ObservedMatchPlayer } from "./matchStatsTracker";
import type { MobileControls } from "../ui/mobileControls";
import type { MultiplayerLobby } from "../ui/multiplayerLobby";
import type { NetClient } from "../net/client";
import type { OnlineMatch } from "../match/onlineMatch";
import type { LocalPlayer } from "../player";
import type { ProjectileSystem } from "./projectileSystem";
import type { RoomBrowser } from "../ui/roomBrowser";
import type { GlobalCursor } from "../ui/globalCursor";
import type { SessionMenu } from "../ui/sessionMenu";
import type { SoundEngine } from "../audio/SoundEngine";
import type { FirstTimeTutorial } from "../render/hud/tutorial";
import { cameraYawFacingBreachOpening } from "./cameraYawFromBreach";
import { clearVibeJamPortals } from "./portal/vibeJamPortal";
import { resolveCameraViewModeForRound } from "./cameraViewMode";
import type { App } from "./gameApp";
import {
  applySelectedCameraViewMode,
  clearCelebrationState,
  resetCameraViewModeToDefault,
} from "./gameAppViewState";

const ONLINE_MATCH_DEBRIEF_DELAY_MS = 4000;

export interface GameAppOnlineFlowContext {
  appMode: "menu" | "solo" | "online";
  arena: Arena;
  cam: CameraController;
  cursor: GlobalCursor;
  debrief: DebriefScreen;
  debugOverlays: DebugOverlays;
  helpVisible: boolean;
  gun: GunViewModel;
  hud: HUD;
  input: InputManager;
  isUserExitingOnline: boolean;
  killFeed: KillFeed;
  latestOnlineSnapshot: MultiplayerRoomSnapshot | null;
  matchEndHandle: ReturnType<typeof setTimeout> | null;
  matchStats: MatchStatsTracker;
  menu: MainMenu;
  mobile: boolean;
  mobileControls: MobileControls | null;
  multiplayer: MultiplayerLobby;
  net: NetClient;
  onlineBreachReported: boolean;
  onlineGameActive: boolean;
  onlineMatch: OnlineMatch;
  onlineMatchConcluding: boolean;
  onlinePlayerName: string;
  onlineRoundActive: boolean;
  onlineSessionToken: number;
  pendingOnlineDebrief: DebriefData | null;
  pendingOnlineRoomSelection: PlaySelection | null;
  player: LocalPlayer;
  playerUpdateTimer: number;
  previousOnlinePhase: MultiplayerRoomSnapshot["phase"] | null;
  projectiles: ProjectileSystem;
  requestLeaveOnline(reason: "user_exit" | "server_disconnect" | "join_failed"): Promise<void>;
  roomBrowser: RoomBrowser;
  sceneMgr: { getRenderer(): { domElement: HTMLElement } };
  selectedCameraViewMode: ReturnType<typeof resolveCameraViewModeForRound>;
  sessionMenu: SessionMenu;
  showMatchDebrief(data: DebriefData): void;
  sound: SoundEngine;
  syncBackgroundInputPolicy(): void;
  tutorial: FirstTimeTutorial;
}

export function beginOnlineRound(app: GameAppOnlineFlowContext, snapshot: MultiplayerRoomSnapshot): void {
  if (app.onlineMatchConcluding || app.debrief.isVisible()) return;

  clearCelebrationState(app as unknown as App);
  if (snapshot.roundNumber === 1 && snapshot.score.team0 === 0 && snapshot.score.team1 === 0) {
    app.matchStats.reset();
  }

  app.onlineGameActive = true;
  app.onlineRoundActive = snapshot.phase === "PLAYING";
  app.onlineBreachReported = false;
  app.playerUpdateTimer = 0;
  app.tutorial.beginRun();
  app.cursor.hide();
  applySelectedCameraViewMode(
    app as unknown as App,
    resolveCameraViewModeForRound(
      app.sessionMenu.getSettings().defaultCameraMode,
      app.selectedCameraViewMode,
    ),
  );

  app.multiplayer.hide();
  app.hud.setVisible(true);
  app.killFeed.setVisible(true);
  app.hud.hideRoundEnd();

  const layout = generateArenaLayout(snapshot.roundNumber);
  app.arena.loadLayout(layout);
  app.debugOverlays.onLayoutLoaded(app.arena);
  app.projectiles.clear();

  app.player.setTeam(snapshot.selfTeam);
  const selfActor = snapshot.actors.find((actor) => actor.id === snapshot.sessionId);
  app.player.kills = selfActor?.kills ?? 0;
  app.player.deaths = selfActor?.deaths ?? 0;
  app.player.resetForNewRound(
    app.arena,
    selfActor ? { x: selfActor.posX, y: selfActor.posY, z: selfActor.posZ } : undefined,
  );
  if (selfActor) {
    app.player.applyAuthoritativeOnlineState(selfActor);
  }

  const openAxis = app.arena.getBreachOpenAxis(app.player.team);
  const openSign = app.arena.getBreachOpenSign(app.player.team);
  app.cam.resetForBreachSpawn(cameraYawFacingBreachOpening(openAxis, openSign));

  app.arena.setPortalDoorsOpen(snapshot.phase === "PLAYING");
  app.onlineMatch.applySnapshot(snapshot.actors, snapshot.sessionId);
  app.matchStats.observePlayers(getOnlineMatchStatsActors(snapshot), { accumulateTravel: false });

  if (!app.mobile) return;
  const menuOpen = app.sessionMenu.isOpen();
  app.input.setMobileControlsActive(!menuOpen);
  if (menuOpen) app.mobileControls?.hide();
  else app.mobileControls?.show();
}

export function endOnlineGame(app: GameAppOnlineFlowContext): void {
  app.sound.stopCountdown();
  app.sessionMenu.close();
  clearCelebrationState(app as unknown as App);
  app.onlineGameActive = false;
  app.onlineRoundActive = false;
  app.onlineBreachReported = false;

  app.onlineMatch.dispose();
  app.projectiles.clear();
  app.killFeed.setVisible(false);
  app.input.exitPointerLock();
  app.input.setUiBlocked(false);
  app.mobileControls?.hide();
  app.input.setMobileControlsActive(false);
  app.cursor.show();

  if (app.latestOnlineSnapshot) {
    app.multiplayer.render(app.latestOnlineSnapshot);
  }
  app.hud.setVisible(false);
  app.hud.hideRoundEnd();
}

export function countOtherHumans(app: Pick<GameAppOnlineFlowContext, "latestOnlineSnapshot">): number {
  const snap = app.latestOnlineSnapshot;
  if (!snap) return 0;
  return snap.members.filter((member) => !member.isBot && member.id !== snap.sessionId).length;
}

export async function forceLeaveOnline(
  app: Pick<GameAppOnlineFlowContext, "isUserExitingOnline" | "onlineSessionToken"> & {
    returnToMenuFromOnline(): Promise<void>;
  },
): Promise<void> {
  if (app.isUserExitingOnline) return;
  app.isUserExitingOnline = true;
  app.onlineSessionToken += 1;
  try {
    await app.returnToMenuFromOnline();
  } finally {
    app.isUserExitingOnline = false;
  }
}

export async function startOnlineLobby(
  app: GameAppOnlineFlowContext,
  selection: PlaySelection,
  target?: MultiplayerJoinTarget,
): Promise<void> {
  app.pendingOnlineRoomSelection = null;
  app.roomBrowser.hide();
  const inviteRoomId = getInviteRoomId();
  const resolvedTarget = target ?? getInviteJoinTarget() ?? { kind: "quick" };
  const shouldClearInviteParam =
    resolvedTarget.kind === "roomId"
    && inviteRoomId !== null
    && resolvedTarget.roomId === inviteRoomId;

  app.appMode = "online";
  app.syncBackgroundInputPolicy();
  app.onlinePlayerName = selection.name;
  app.killFeed.setLocalPlayerName(selection.name);
  app.onlineGameActive = false;
  app.onlineRoundActive = false;
  app.onlineBreachReported = false;
  app.onlineMatchConcluding = false;
  app.matchStats.reset();
  app.pendingOnlineDebrief = null;
  if (app.matchEndHandle) {
    clearTimeout(app.matchEndHandle);
    app.matchEndHandle = null;
  }
  app.previousOnlinePhase = null;
  app.latestOnlineSnapshot = null;
  app.projectiles.clear();
  app.hud.setVisible(false);
  app.killFeed.setVisible(false);
  app.input.setUiBlocked(false);
  app.input.exitPointerLock();
  app.mobileControls?.hide();
  app.input.setMobileControlsActive(false);
  app.sessionMenu.setLauncherVisible(true);
  resetCameraViewModeToDefault(app as unknown as App);
  app.multiplayer.showConnecting(selection.name);

  app.isUserExitingOnline = false;
  const myToken = ++app.onlineSessionToken;

  try {
    const snapshot = await app.net.connect({
      name: selection.name,
      target: resolvedTarget,
    });
    if (myToken !== app.onlineSessionToken || app.isUserExitingOnline || app.appMode !== "online") {
      try { await app.net.disconnect(); } catch {}
      return;
    }

    if (shouldClearInviteParam) clearInviteRoomIdFromUrl();
    app.latestOnlineSnapshot = snapshot;
    app.previousOnlinePhase = snapshot.phase;
    if (snapshot.phase === "COUNTDOWN") {
      beginOnlineRound(app, snapshot);
    } else {
      app.multiplayer.render(snapshot);
    }
  } catch (error) {
    console.error("Failed to connect to the multiplayer room.", error);
    if (myToken !== app.onlineSessionToken || app.isUserExitingOnline || app.appMode !== "online") {
      return;
    }
    const message = error instanceof Error && error.message.trim().length > 0
      ? error.message
      : "Could not reach the Colyseus server. Check that the server is running.";
    app.multiplayer.setStatus(message, "error");
    await app.requestLeaveOnline("join_failed");
  }
}

export async function returnToMenuFromOnline(app: GameAppOnlineFlowContext): Promise<void> {
  app.pendingOnlineRoomSelection = null;
  app.roomBrowser.hide();
  app.sessionMenu.close();
  app.debrief.hide();
  clearCelebrationState(app as unknown as App);
  app.matchStats.reset();
  app.appMode = "menu";
  app.syncBackgroundInputPolicy();
  app.onlineGameActive = false;
  app.onlineRoundActive = false;
  app.cursor.show();
  app.onlineBreachReported = false;
  app.onlineMatchConcluding = false;
  app.pendingOnlineDebrief = null;
  app.latestOnlineSnapshot = null;
  app.previousOnlinePhase = null;
  app.helpVisible = false;
  if (app.matchEndHandle) {
    clearTimeout(app.matchEndHandle);
    app.matchEndHandle = null;
  }
  app.onlineMatch.dispose();
  app.multiplayer.hide();
  clearVibeJamPortals();
  app.hud.setVisible(false);
  app.hud.hideRoundEnd();
  app.killFeed.setVisible(false);
  app.mobileControls?.hide();
  app.input.setMobileControlsActive(false);
  app.input.setUiBlocked(false);
  app.input.exitPointerLock();
  app.sessionMenu.setLauncherVisible(false);
  app.gun.setVisible(false);
  app.gun.setFrozenTint(null);
  app.player.setWorldModelVisible(false);
  app.player.setThirdPersonGunVisible(false);
  app.player.setThirdPersonGunFrozenTint(null);

  app.menu.show();
  const disconnectPromise = app.net.disconnect().catch((error) => {
    console.warn("Multiplayer disconnect raised an error.", error);
  });
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1500));
  await Promise.race([disconnectPromise, timeout]);
}

export function showMatchDebrief(app: GameAppOnlineFlowContext, data: DebriefData): void {
  if (app.matchEndHandle) {
    clearTimeout(app.matchEndHandle);
    app.matchEndHandle = null;
  }

  app.sessionMenu.close();
  app.input.exitPointerLock();
  app.input.setUiBlocked(true);
  app.mobileControls?.hide();
  app.input.setMobileControlsActive(false);
  app.sessionMenu.setLauncherVisible(false);
  app.hud.setVisible(false);
  app.hud.hideRoundEnd();
  app.killFeed.setVisible(false);
  app.cursor.show();
  app.debrief.show(data);
}

export function buildOnlineDebrief(
  app: Pick<GameAppOnlineFlowContext, "latestOnlineSnapshot" | "net" | "player" | "onlinePlayerName" | "matchStats">,
  winningTeam: 0 | 1,
  finalScore: { team0: number; team1: number },
): DebriefData {
  const snapshot = app.latestOnlineSnapshot;
  const sessionId = app.net.getSessionId() ?? "local-player";
  const playerTeam = snapshot?.selfTeam ?? app.player.team;
  const teamSize = snapshot?.teamSize ?? 1;
  const sizeLabelMap: Record<number, string> = {
    1: "1v1 Duel",
    2: "2v2 Duos",
    5: "5v5 Squads",
    10: "10v10 Rush",
    20: "20v20 War",
  };

  if (snapshot) {
    app.matchStats.observePlayers(getOnlineMatchStatsActors(snapshot), { accumulateTravel: false });
  }

  return {
    winningTeam,
    score: finalScore,
    players: getTrackedOnlineDebriefPlayers(app, sessionId, playerTeam),
    awards: app.matchStats.buildAwards(),
    playerTeam,
    secondaryActionLabel: "Main Menu",
    primaryActionLabel: "Return To Lobby",
    matchLabel: `${sizeLabelMap[teamSize] ?? `${teamSize}v${teamSize}`} Online · ${finalScore.team0} – ${finalScore.team1}`,
  };
}

export function getOnlineMatchStatsActors(snapshot: MultiplayerRoomSnapshot): ObservedMatchPlayer[] {
  return snapshot.actors.map((actor) => ({
    id: actor.id,
    name: actor.name,
    team: actor.team,
    isBot: actor.isBot,
    isSelf: actor.id === snapshot.sessionId,
    freezes: actor.kills,
    frozen: actor.deaths,
    position: {
      x: actor.posX,
      y: actor.posY,
      z: actor.posZ,
    },
  }));
}

export function getTrackedOnlineDebriefPlayers(
  app: Pick<GameAppOnlineFlowContext, "matchStats" | "onlinePlayerName" | "player">,
  sessionId: string,
  playerTeam: 0 | 1,
): DebriefPlayer[] {
  const trackedPlayers = app.matchStats.buildPlayers();
  if (trackedPlayers.length > 0) {
    return trackedPlayers;
  }

  return [{
    id: sessionId,
    name: app.onlinePlayerName,
    team: playerTeam,
    breaches: 0,
    freezes: app.player.kills,
    frozen: app.player.deaths,
    travelDistance: 0,
    isBot: false,
    isSelf: true,
  }];
}

export function returnToOnlineLobbyFromDebrief(app: GameAppOnlineFlowContext): void {
  clearCelebrationState(app as unknown as App);
  app.onlineMatchConcluding = false;
  app.onlineGameActive = false;
  app.onlineRoundActive = false;
  app.matchStats.reset();
  app.input.setUiBlocked(false);
  app.onlineMatch.dispose();
  app.projectiles.clear();
  app.sessionMenu.setLauncherVisible(true);
  app.hud.hideRoundEnd();

  if (app.latestOnlineSnapshot) {
    app.multiplayer.render(app.latestOnlineSnapshot);
    return;
  }

  app.multiplayer.show();
}

function getInviteRoomId(): string | null {
  return getInviteRoomIdFromSearch(window.location.search);
}

function getInviteJoinTarget(): MultiplayerJoinTarget | null {
  const roomId = getInviteRoomId();
  return roomId ? { kind: "roomId", roomId } : null;
}

function clearInviteRoomIdFromUrl(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(MULTIPLAYER_INVITE_PARAM)) return;
  url.searchParams.delete(MULTIPLAYER_INVITE_PARAM);
  window.history.replaceState({}, "", url);
}
