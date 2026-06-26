import { MATCH_POINT_TARGET } from "../../../shared/constants";
import { findMatchWinner } from "../../../shared/match-flow";
import { DEFAULT_PLAYER_NAME } from "../../../shared/callSigns";
import { generateArenaLayout } from "../../../shared/arena-gen";
import type { Arena } from "../arena/arena";
import type { CameraController } from "../camera";
import type { DebugOverlays } from "./debugOverlays";
import type { ProjectileSystem } from "./projectileSystem";
import type { RoundController } from "./roundController";
import { cameraYawFacingBreachOpening } from "./cameraYawFromBreach";
import { buildRoundEndHtml, type HUD } from "../render/hud";
import type { MatchStatsTracker } from "./matchStatsTracker";
import type { FirstTimeTutorial } from "../render/hud/tutorial";
import type { KillFeed } from "../ui/kill-feed";
import type { MainMenu } from "../ui/menu";
import type { DebriefData, DebriefScreen } from "../ui/debrief";
import type { SessionMenu } from "../ui/sessionMenu";
import type { SoundEngine } from "../audio/SoundEngine";
import type { GlobalCursor } from "../ui/globalCursor";
import type { MobileControls } from "../ui/mobileControls";
import type { InputManager } from "../input";
import type { LocalMatch } from "../match/localMatch";
import type { LocalPlayer } from "../player";
import type { PortalParams } from "./portal/parsePortalParams";
import {
  PORTAL_ARRIVAL_SPAWN,
  clearVibeJamPortals,
  configureOutboundPortal,
  configurePortalArrivalSpawn,
  initVibeJamPortal,
} from "./portal/vibeJamPortal";
import type { PlaySelection } from "../ui/menu";
import type { App } from "./gameApp";
import {
  clearCelebrationState,
  resetCameraViewModeToDefault,
  setCelebratingTeam,
} from "./gameAppViewState";

export interface GameAppSoloFlowContext {
  appMode: "menu" | "solo" | "online";
  cursor: GlobalCursor;
  arena: Arena;
  cam: CameraController;
  debugOverlays: DebugOverlays;
  debrief: DebriefScreen;
  helpVisible: boolean;
  hud: HUD;
  input: InputManager;
  killFeed: KillFeed;
  lastSoloSelection: PlaySelection | null;
  match: LocalMatch;
  matchEndHandle: ReturnType<typeof setTimeout> | null;
  matchOver: boolean;
  matchStats: MatchStatsTracker;
  menu: MainMenu;
  mobile: boolean;
  mobileControls: MobileControls | null;
  onlineBreachReported: boolean;
  player: LocalPlayer;
  portalArrivalPending: boolean;
  portalParams: PortalParams;
  projectiles: ProjectileSystem;
  round: RoundController;
  sceneMgr: { getScene(): THREE.Scene; getRenderer(): { domElement: HTMLCanvasElement } };
  sessionMenu: SessionMenu;
  sound: SoundEngine;
  tutorial: FirstTimeTutorial;
  showMatchDebrief(data: DebriefData): void;
  syncBackgroundInputPolicy(): void;
}

import * as THREE from "three";

export function beginNewRound(app: GameAppSoloFlowContext): void {
  clearCelebrationState(app as unknown as App);
  app.hud.hideRoundEnd();
  app.projectiles.clear();
  clearVibeJamPortals();

  const layout = generateArenaLayout();
  app.arena.loadLayout(layout);
  app.debugOverlays.onLayoutLoaded(app.arena);

  const arrivalThisRound = app.portalArrivalPending;
  const arrivalCenter = app.arena.getBreachRoomCenter(app.player.team);
  const arrivalOpenAxis = app.arena.getBreachOpenAxis(app.player.team);
  const arrivalOpenSign = app.arena.getBreachOpenSign(app.player.team);
  configurePortalArrivalSpawn(arrivalCenter, arrivalOpenAxis, arrivalOpenSign);

  const enemyTeam = (1 - app.player.team) as 0 | 1;
  configureOutboundPortal(
    app.arena.getBreachRoomCenter(enemyTeam),
    app.arena.getBreachOpenAxis(enemyTeam),
    app.arena.getBreachOpenSign(enemyTeam),
  );

  app.match.resetForRound(
    app.arena,
    app.player,
    arrivalThisRound ? PORTAL_ARRIVAL_SPAWN : undefined,
  );

  const openAxis = app.arena.getBreachOpenAxis(app.player.team);
  const openSign = app.arena.getBreachOpenSign(app.player.team);
  app.cam.resetForBreachSpawn(cameraYawFacingBreachOpening(openAxis, openSign));

  initVibeJamPortal(app.sceneMgr.getScene(), app.portalParams);
  app.match.addOutboundVibeJamPortal(app.portalParams);

  app.arena.setPortalDoorsOpen(false);
  if (arrivalThisRound) {
    app.round.startCountdown();
    app.round.tick(999);
    cleanPortalUrl(app);
    app.portalArrivalPending = false;
    return;
  }

  app.round.startCountdown();
  app.sound.playCountdown();
}

export function onRoundWin(
  app: GameAppSoloFlowContext,
  team: 0 | 1,
  reason: "breach" | "fullFreeze",
): void {
  if (!app.round.isPlaying()) return;
  app.projectiles.clear();
  const score = app.match.getScore();
  const matchWinner = findMatchWinner(score, MATCH_POINT_TARGET);
  app.hud.showRoundEnd(
    matchWinner !== null
      ? buildRoundEndHtml({ team, matchScore: score })
      : reason === "fullFreeze"
        ? buildRoundEndHtml({ team, kind: "freeze", enemyTeam: (1 - team) as 0 | 1 })
        : buildRoundEndHtml({ team }),
  );
  app.round.endRound();
}

export function onRoundTie(app: GameAppSoloFlowContext): void {
  if (!app.round.isPlaying()) return;
  app.projectiles.clear();
  app.hud.showRoundEnd(buildRoundEndHtml("tie"));
  app.round.endRound();
}

export function onMatchEnd(
  app: GameAppSoloFlowContext,
  winningTeam: 0 | 1,
  finalScore: { team0: number; team1: number },
): void {
  app.matchOver = true;
  setCelebratingTeam(app as unknown as App, winningTeam);
  app.round.cancelPendingRestart();
  if (app.matchEndHandle) clearTimeout(app.matchEndHandle);
  app.matchEndHandle = setTimeout(() => {
    app.matchEndHandle = null;
    showSoloDebrief(app, winningTeam, finalScore);
  }, 4000);
}

export function showSoloDebrief(
  app: GameAppSoloFlowContext,
  winningTeam: 0 | 1,
  finalScore: { team0: number; team1: number },
): void {
  const playerTeam = app.player.team;
  app.matchStats.observePlayers(app.match.getMatchStatsActors(app.player), { accumulateTravel: false });

  const teamSize = app.lastSoloSelection?.teamSize ?? 1;
  const sizeLabelMap: Record<number, string> = {
    1: "1v1 Duel",
    2: "2v2 Duos",
    5: "5v5 Squads",
    10: "10v10 Rush",
    20: "20v20 War",
  };

  app.showMatchDebrief({
    winningTeam,
    score: finalScore,
    players: app.matchStats.buildPlayers(),
    awards: app.matchStats.buildAwards(),
    playerTeam,
    secondaryActionLabel: "Main Menu",
    primaryActionLabel: "Play Again",
    matchLabel: `${sizeLabelMap[teamSize] ?? "Solo"} · ${finalScore.team0} – ${finalScore.team1}`,
  });
}

export function returnToMenuFromSolo(app: GameAppSoloFlowContext): void {
  app.sound.stopCountdown();
  app.sessionMenu.close();
  clearCelebrationState(app as unknown as App);
  app.debrief.hide();
  app.appMode = "menu";
  app.syncBackgroundInputPolicy();
  app.cursor.show();
  app.matchOver = false;
  app.projectiles.clear();
  clearVibeJamPortals();
  app.hud.setVisible(false);
  app.hud.hideRoundEnd();
  app.killFeed.setVisible(false);
  app.input.exitPointerLock();
  app.mobileControls?.hide();
  app.input.setMobileControlsActive(false);
  app.input.setUiBlocked(false);
  app.match.dispose();
  app.sessionMenu.setLauncherVisible(false);
  app.menu.show();
}

export function startTutorialMatch(app: GameAppSoloFlowContext, selection: PlaySelection): void {
  app.tutorial.forceRestart();
  startSoloMatch(app, { ...selection, teamSize: 1, noBots: true });
}

export function startSoloMatch(app: GameAppSoloFlowContext, selection: PlaySelection): void {
  app.lastSoloSelection = selection;
  app.debrief.hide();
  clearCelebrationState(app as unknown as App);
  app.appMode = "solo";
  app.syncBackgroundInputPolicy();
  app.cursor.hide();
  app.matchOver = false;
  app.onlineBreachReported = false;
  app.helpVisible = false;
  app.matchStats.reset();
  app.tutorial.beginRun();
  app.killFeed.setLocalPlayerName(selection.name);
  resetCameraViewModeToDefault(app as unknown as App);
  if (app.matchEndHandle) {
    clearTimeout(app.matchEndHandle);
    app.matchEndHandle = null;
  }
  app.hud.setVisible(true);
  app.killFeed.setVisible(true);
  app.input.setUiBlocked(false);
  app.sessionMenu.setLauncherVisible(true);

  app.player.setTeam(0);
  app.portalParams = {
    ...app.portalParams,
    color: app.portalParams.color ?? "cyan",
    team: app.portalParams.team ?? "0",
    username: selection.name,
  };
  app.match.startNewGame({
    humanName: selection.name,
    humanTeam: 0,
    teamSize: selection.teamSize,
    noBots: selection.noBots,
  });

  if (app.mobile) {
    app.input.setMobileControlsActive(true);
    app.mobileControls?.show();
  } else if (!app.portalArrivalPending) {
    app.input.lockPointer(app.sceneMgr.getRenderer().domElement);
  }

  beginNewRound(app);
}

function cleanPortalUrl(app: Pick<GameAppSoloFlowContext, never>): void {
  if (typeof window === "undefined" || !window.location.search) return;
  history.replaceState(null, "", window.location.pathname);
}
