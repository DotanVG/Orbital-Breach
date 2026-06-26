import * as THREE from "three";
import { DEFAULT_PLAYER_NAME } from "../../../shared/callSigns";
import {
  type MultiplayerJoinTarget,
  type MultiplayerRoomSnapshot,
} from "../../../shared/multiplayer";
import { Arena } from "../arena/arena";
import { CameraController } from "../camera";
import { InputManager } from "../input";
import { LocalMatch } from "../match/localMatch";
import { OnlineMatch } from "../match/onlineMatch";
import { isTouchDevice } from "../platform";
import { LocalPlayer } from "../player";
import { GunViewModel } from "../render/gun";
import { HUD } from "../render/hud";
import { FirstTimeTutorial } from "../render/hud/tutorial";
import { SceneManager } from "../render/scene";
import { isEmbedMode } from "../embed";
import { KillFeed } from "../ui/kill-feed";
import { initGlobalCursor, type GlobalCursor } from "../ui/globalCursor";
import { MainMenu } from "../ui/menu";
import { MobileControls } from "../ui/mobileControls";
import { RoomBrowser } from "../ui/roomBrowser";
import { WelcomeScreen } from "../ui/welcome";
import { SessionMenu, type SessionSettings } from "../ui/sessionMenu";
import { SoundEngine } from "../audio/SoundEngine";
import {
  resolveCameraViewModeForRound,
  type CameraViewMode,
} from "./cameraViewMode";
import { DebugOverlays } from "./debugOverlays";
import { tickOnlineGame } from "./onlineTick";
import { ProjectileSystem } from "./projectileSystem";
import { RoundController } from "./roundController";
import { tickSoloGame } from "./soloTick";
import type { GameTickContext } from "./tickContext";
import { NetClient } from "../net/client";
import { MultiplayerLobby } from "../ui/multiplayerLobby";
import type { PlaySelection } from "../ui/menu";
import { DebriefScreen, type DebriefData, type DebriefPlayer } from "../ui/debrief";
import { MatchStatsTracker, type ObservedMatchPlayer } from "./matchStatsTracker";
import { getPortalParams, isPortalArrival } from "./portal/vibeJamPortal";
import type { PortalParams } from "./portal/parsePortalParams";
import {
  beginNewRound as beginSoloRound,
  onMatchEnd as handleSoloMatchEnd,
  onRoundTie as handleSoloRoundTie,
  onRoundWin as handleSoloRoundWin,
  returnToMenuFromSolo as leaveSoloToMenu,
  showSoloDebrief as showSoloDebriefFlow,
  startSoloMatch as startSoloMatchFlow,
  startTutorialMatch as startTutorialMatchFlow,
  type GameAppSoloFlowContext,
} from "./gameAppSoloFlow";
import {
  applyFullscreenPreference as applyFullscreenPreferenceFlow,
  applySessionSettings as applySessionSettingsFlow,
  closeSessionMenu as closeSessionMenuFlow,
  handleSessionMenuMainMenu as handleSessionMenuMainMenuFlow,
  openSessionMenu as openSessionMenuFlow,
  requestLeaveOnline as requestLeaveOnlineFlow,
  type GameAppSessionFlowContext,
} from "./gameAppSessionFlow";
import {
  beginOnlineRound as beginOnlineRoundFlow,
  buildOnlineDebrief as buildOnlineDebriefFlow,
  countOtherHumans as countOtherHumansFlow,
  endOnlineGame as endOnlineGameFlow,
  forceLeaveOnline as forceLeaveOnlineFlow,
  getOnlineMatchStatsActors as getOnlineMatchStatsActorsFlow,
  getTrackedOnlineDebriefPlayers as getTrackedOnlineDebriefPlayersFlow,
  returnToMenuFromOnline as returnToMenuFromOnlineFlow,
  returnToOnlineLobbyFromDebrief as returnToOnlineLobbyFromDebriefFlow,
  showMatchDebrief as showMatchDebriefFlow,
  startOnlineLobby as startOnlineLobbyFlow,
  type GameAppOnlineFlowContext,
} from "./gameAppOnlineFlow";
import { startGameApp, wireGameAppCallbacks } from "./gameAppBoot";
import {
  handleScoreboardTabHoldChange as handleScoreboardTabHoldChangeFlow,
  isGameplaySceneActive as isGameplaySceneActiveFlow,
  syncBackgroundInputPolicy as syncBackgroundInputPolicyFlow,
  syncCombatPresentation as syncCombatPresentationFlow,
  syncDesktopOverlayCursor as syncDesktopOverlayCursorFlow,
} from "./gameAppRuntime";
import { applySelectedCameraViewMode as applySelectedCameraViewModeState } from "./gameAppViewState";

export class App {
  private appMode: "menu" | "solo" | "online" = "menu";
  private onlineGameActive = false;
  private onlineRoundActive = false;
  private onlineSessionToken = 0;
  private isUserExitingOnline = false;
  private matchOver = false;
  private helpVisible = false;
  private lastSoloSelection: PlaySelection | null = null;
  private matchEndHandle: ReturnType<typeof setTimeout> | null = null;
  private pendingOnlineDebrief: DebriefData | null = null;
  private pendingOnlineRoomSelection: PlaySelection | null = null;
  private onlineMatchConcluding = false;
  private playerUpdateTimer = 0;
  private latestOnlineSnapshot: MultiplayerRoomSnapshot | null = null;
  private previousOnlinePhase: MultiplayerRoomSnapshot["phase"] | null = null;
  private onlinePlayerName = DEFAULT_PLAYER_NAME;
  private onlineBreachReported = false;
  private combatPresentationActive = false;
  private embedMode = false;
  private portalArrivalPending = false;
  private restorePointerLockAfterScoreboard = false;

  private arena: Arena;
  private cam: CameraController;
  private cursor!: GlobalCursor;
  private debugOverlays: DebugOverlays;
  private gun: GunViewModel;
  private hud: HUD;
  private input: InputManager;
  private killFeed = new KillFeed();
  private lastTime = 0;
  private match: LocalMatch;
  private menu: MainMenu;
  private readonly matchStats = new MatchStatsTracker();
  private roomBrowser = new RoomBrowser();
  private welcome!: WelcomeScreen;
  private debrief = new DebriefScreen();
  private multiplayer = new MultiplayerLobby();
  private onlineMatch: OnlineMatch;
  private readonly mobile = isTouchDevice();
  private mobileControls: MobileControls | null = null;
  private net = new NetClient();
  private portalParams: PortalParams;
  private player: LocalPlayer;
  private projectiles: ProjectileSystem;
  private round = new RoundController();
  private sceneMgr: SceneManager;
  private sessionMenu = new SessionMenu();
  private sound!: SoundEngine;
  private tickCtx!: GameTickContext;
  private fullscreenPreference = false;
  private thirdPerson = false;
  private selectedCameraViewMode: CameraViewMode;
  private victoryOrbitAngle = 0;
  private tutorial = new FirstTimeTutorial();

  public constructor() {
    this.portalParams = getPortalParams();
    this.embedMode = isEmbedMode();
    this.portalArrivalPending = isPortalArrival();
    this.sceneMgr = new SceneManager();
    this.sound = new SoundEngine(this.sceneMgr.getCamera(), this.sceneMgr.getScene());
    this.input = new InputManager();
    this.input.onTabHoldChange = (held) => {
      handleScoreboardTabHoldChangeFlow(this, held);
    };
    syncBackgroundInputPolicyFlow(this);
    this.cam = new CameraController(this.sceneMgr.getCamera());
    this.arena = new Arena(this.sceneMgr.getScene());
    this.player = new LocalPlayer(this.sceneMgr.getScene());
    this.player.onFullyFrozen = () => this.sound.playHit();
    this.hud = new HUD();
    this.menu = new MainMenu();
    this.cursor = initGlobalCursor();
    this.welcome = new WelcomeScreen(this.cursor);
    this.projectiles = new ProjectileSystem(this.sceneMgr.getScene());
    this.match = new LocalMatch(this.sceneMgr.getScene());
    this.onlineMatch = new OnlineMatch(this.sceneMgr.getScene());
    this.debugOverlays = new DebugOverlays(this.sceneMgr.getScene());
    this.hud.setVisible(false);
    this.killFeed.setVisible(false);
    this.sessionMenu.setLauncherVisible(false);
    const initialSettings = this.sessionMenu.getSettings();
    this.selectedCameraViewMode = resolveCameraViewModeForRound(
      initialSettings.defaultCameraMode,
      null,
    );
    this.fullscreenPreference = initialSettings.fullscreenEnabled;
    applySelectedCameraViewModeState(this, this.selectedCameraViewMode);
    this.applySessionSettings(initialSettings);

    this.sceneMgr.getScene().add(this.sceneMgr.getCamera());
    this.gun = new GunViewModel(this.sceneMgr.getCamera());

    wireGameAppCallbacks(this);

  }

  public start(): void {
    startGameApp(this);
  }

  private loop(timestamp: number): void {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.033);
    this.lastTime = timestamp;
    const gameplayActive = isGameplaySceneActiveFlow(this);

    if (this.input.consumeMenuToggle()) {
      if (this.sessionMenu.isOpen()) {
        this.closeSessionMenu();
      } else if (this.appMode !== "menu") {
        this.openSessionMenu();
      }
    }

    if (this.input.consumeHelpPressed() && this.appMode !== "menu") {
      this.helpVisible = !this.helpVisible;
    }

    if (gameplayActive && this.appMode === "solo") {
      tickSoloGame(this.tickCtx, dt);
    } else if (gameplayActive && this.appMode === "online" && this.onlineGameActive) {
      tickOnlineGame(this.tickCtx, dt);
    }

    syncCombatPresentationFlow(this, gameplayActive);
    syncDesktopOverlayCursorFlow(this, gameplayActive);
    this.sceneMgr.render();
    requestAnimationFrame((nextTimestamp) => this.loop(nextTimestamp));
  }

  // ── Online game lifecycle ───────────────────────────────────────────────────

  private beginOnlineRound(snapshot: MultiplayerRoomSnapshot): void {
    beginOnlineRoundFlow(this as unknown as GameAppOnlineFlowContext, snapshot);
  }
  private endOnlineGame(): void {
    endOnlineGameFlow(this as unknown as GameAppOnlineFlowContext);
  }
  private beginNewRound(): void {
    beginSoloRound(this as unknown as GameAppSoloFlowContext);
  }
  private onRoundWin(team: 0 | 1, reason: "breach" | "fullFreeze"): void {
    handleSoloRoundWin(this as unknown as GameAppSoloFlowContext, team, reason);
  }
  private onRoundTie(): void {
    handleSoloRoundTie(this as unknown as GameAppSoloFlowContext);
  }
  private onMatchEnd(
    winningTeam: 0 | 1,
    finalScore: { team0: number; team1: number },
  ): void {
    handleSoloMatchEnd(this as unknown as GameAppSoloFlowContext, winningTeam, finalScore);
  }
  private showSoloDebrief(
    winningTeam: 0 | 1,
    finalScore: { team0: number; team1: number },
  ): void {
    showSoloDebriefFlow(this as unknown as GameAppSoloFlowContext, winningTeam, finalScore);
  }
  private returnToMenuFromSolo(): void {
    leaveSoloToMenu(this as unknown as GameAppSoloFlowContext);
  }
  private openSessionMenu(view: "settings" | "instructions" | "credits" = "settings"): void {
    openSessionMenuFlow(this as unknown as GameAppSessionFlowContext, view);
  }
  private closeSessionMenu(): void {
    closeSessionMenuFlow(this as unknown as GameAppSessionFlowContext);
  }
  private async handleSessionMenuMainMenu(): Promise<void> {
    await handleSessionMenuMainMenuFlow(this as unknown as GameAppSessionFlowContext);
  }
  private countOtherHumans(): number {
    return countOtherHumansFlow(this as unknown as GameAppOnlineFlowContext);
  }
  private async requestLeaveOnline(
    reason: "user_exit" | "server_disconnect" | "join_failed",
  ): Promise<void> {
    await requestLeaveOnlineFlow(this as unknown as GameAppSessionFlowContext & { isUserExitingOnline: boolean }, reason);
  }
  private async forceLeaveOnline(): Promise<void> {
    await forceLeaveOnlineFlow(this as unknown as GameAppSessionFlowContext & {
      isUserExitingOnline: boolean;
      onlineSessionToken: number;
      returnToMenuFromOnline(): Promise<void>;
    });
  }
  private applySessionSettings(settings: SessionSettings): void {
    applySessionSettingsFlow(this as unknown as GameAppSessionFlowContext, settings);
  }
  private async applyFullscreenPreference(enabled: boolean): Promise<void> {
    await applyFullscreenPreferenceFlow(this as unknown as GameAppSessionFlowContext, enabled);
  }

  // ── Solo match start ────────────────────────────────────────────────────────

  private startTutorialMatch(selection: PlaySelection): void {
    startTutorialMatchFlow(this as unknown as GameAppSoloFlowContext, selection);
  }
  private startSoloMatch(selection: PlaySelection): void {
    startSoloMatchFlow(this as unknown as GameAppSoloFlowContext, selection);
  }
  private async startOnlineLobby(
    selection: PlaySelection,
    target?: MultiplayerJoinTarget,
  ): Promise<void> {
    await startOnlineLobbyFlow(this as unknown as GameAppOnlineFlowContext, selection, target);
  }
  private async returnToMenuFromOnline(): Promise<void> {
    await returnToMenuFromOnlineFlow(this as unknown as GameAppOnlineFlowContext);
  }
  private showMatchDebrief(data: DebriefData): void {
    showMatchDebriefFlow(this as unknown as GameAppOnlineFlowContext, data);
  }
  private buildOnlineDebrief(
    winningTeam: 0 | 1,
    finalScore: { team0: number; team1: number },
  ): DebriefData {
    return buildOnlineDebriefFlow(this as unknown as GameAppOnlineFlowContext, winningTeam, finalScore);
  }
  private getOnlineMatchStatsActors(snapshot: MultiplayerRoomSnapshot): ObservedMatchPlayer[] {
    return getOnlineMatchStatsActorsFlow(snapshot);
  }
  private getTrackedOnlineDebriefPlayers(sessionId: string, playerTeam: 0 | 1): DebriefPlayer[] {
    return getTrackedOnlineDebriefPlayersFlow(this as unknown as GameAppOnlineFlowContext, sessionId, playerTeam);
  }
  private returnToOnlineLobbyFromDebrief(): void {
    returnToOnlineLobbyFromDebriefFlow(this as unknown as GameAppOnlineFlowContext);
  }
}
