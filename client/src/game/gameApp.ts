import * as THREE from "three";
import { MATCH_POINT_TARGET } from "../../../shared/constants";
import { generateArenaLayout } from "../../../shared/arena-gen";
import { DEFAULT_PLAYER_NAME } from "../../../shared/callSigns";
import { findMatchWinner } from "../../../shared/match-flow";
import {
  getInviteRoomIdFromSearch,
  MULTIPLAYER_INVITE_PARAM,
  type MultiplayerJoinTarget,
  type MultiplayerRoomSnapshot,
} from "../../../shared/multiplayer";
import { Arena } from "../arena/arena";
import { CameraController } from "../camera";
import { FEATURE_FLAGS } from "../featureFlags";
import { InputManager } from "../input";
import { LocalMatch } from "../match/localMatch";
import { OnlineMatch } from "../match/onlineMatch";
import { isTouchDevice } from "../platform";
import { LocalPlayer } from "../player";
import { GunViewModel } from "../render/gun";
import { buildRoundEndHtml, HUD } from "../render/hud";
import { FirstTimeTutorial } from "../render/hud/tutorial";
import { SceneManager } from "../render/scene";
import { isEmbedMode } from "../embed";
import { KillFeed } from "../ui/kill-feed";
import { initGlobalCursor, type GlobalCursor } from "../ui/globalCursor";
import { isApparentFullscreen, isFullscreen, leaveFullscreen, requestFullscreen } from "../ui/fullscreen";
import { MainMenu } from "../ui/menu";
import { MobileControls } from "../ui/mobileControls";
import { RoomBrowser } from "../ui/roomBrowser";
import { WelcomeScreen } from "../ui/welcome";
import { SessionMenu, type SessionSettings } from "../ui/sessionMenu";
import { SoundEngine } from "../audio/SoundEngine";
import {
  isThirdPersonCameraView,
  resolveCameraViewModeForRound,
  toggleCameraViewMode,
  type CameraViewMode,
} from "./cameraViewMode";
import { cameraYawFacingBreachOpening } from "./cameraYawFromBreach";
import { DebugOverlays } from "./debugOverlays";
import { tickOnlineGame } from "./onlineTick";
import { ProjectileSystem } from "./projectileSystem";
import { RoundController } from "./roundController";
import { tickSoloGame } from "./soloTick";
import { shouldShowDesktopOverlayCursor } from "./overlayCursor";
import type { GameTickContext } from "./tickContext";
import { NetClient } from "../net/client";
import { MultiplayerLobby } from "../ui/multiplayerLobby";
import type { PlaySelection } from "../ui/menu";
import { DebriefScreen, type DebriefData, type DebriefPlayer } from "../ui/debrief";
import { showConfirmDialog } from "../ui/confirmDialog";
import { getScoreboardCursorTransition } from "./scoreboardCursor";
import { MatchStatsTracker, type ObservedMatchPlayer } from "./matchStatsTracker";
import {
  PORTAL_ARRIVAL_SPAWN,
  clearVibeJamPortals,
  configureOutboundPortal,
  configurePortalArrivalSpawn,
  getPortalParams,
  initVibeJamPortal,
  isPortalArrival,
} from "./portal/vibeJamPortal";
import type { PortalParams } from "./portal/parsePortalParams";

const ONLINE_MATCH_DEBRIEF_DELAY_MS = 4000;

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
  private lastOnlineSelection: PlaySelection | null = null;
  private lastOnlineTarget: MultiplayerJoinTarget | null = null;
  private onlineReconnectPending = false;
  private onlineBreachReported = false;
  private combatPresentationActive = false;
  private embedMode = false;
  private portalArrivalPending = false;
  private portalUrlCleaned = false;
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
      this.handleScoreboardTabHoldChange(held);
    };
    this.syncBackgroundInputPolicy();
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
    this.applySelectedCameraViewMode(this.selectedCameraViewMode);
    this.applySessionSettings(initialSettings);

    this.sceneMgr.getScene().add(this.sceneMgr.getCamera());
    this.gun = new GunViewModel(this.sceneMgr.getCamera());

    this.match.onEvent = (event) => {
      switch (event.type) {
        case "hitConfirm":
          this.hud.triggerHitConfirm(event.team);
          break;
        case "freeze":
          this.killFeed.addKill(
            event.killerName,
            event.killerTeam,
            event.victimName,
            event.victimTeam,
          );
          break;
        case "score":
          this.matchStats.recordBreach(event.scorerId);
          this.killFeed.addScore(event.scorerName, event.scorerTeam);
          break;
        case "roundWin":
          this.onRoundWin(event.winningTeam, event.reason);
          break;
        case "roundTie":
          this.onRoundTie();
          break;
        case "matchEnd":
          this.onMatchEnd(event.winningTeam, event.finalScore);
          break;
      }
    };
    this.round.onBeginRound = () => this.beginNewRound();
    this.round.onCountdownEnd = () => this.arena.setPortalDoorsOpen(true);
    this.round.onRoundTimeout = () => this.match.handleRoundTimeout();
    this.sessionMenu.onLauncherRequest = () => this.openSessionMenu();
    this.sessionMenu.onResume = () => this.closeSessionMenu();
    this.sessionMenu.onMainMenu = () => {
      void this.handleSessionMenuMainMenu();
    };
    this.sessionMenu.onSettingsChange = (settings) => {
      const fullscreenPreferenceChanged = settings.fullscreenEnabled !== this.fullscreenPreference;
      this.applySessionSettings(settings);
      if (fullscreenPreferenceChanged) {
        this.fullscreenPreference = settings.fullscreenEnabled;
        void this.applyFullscreenPreference(settings.fullscreenEnabled);
      }
    };

    this.debrief.onMainMenu = () => {
      if (this.appMode === "online") {
        void this.forceLeaveOnline();
        return;
      }
      this.returnToMenuFromSolo();
    };
    this.debrief.onPlayAgain = () => {
      if (this.appMode === "online") {
        this.returnToOnlineLobbyFromDebrief();
        return;
      }
      if (this.lastSoloSelection) {
        this.startSoloMatch(this.lastSoloSelection);
      } else {
        this.returnToMenuFromSolo();
      }
    };

    this.net.onStateChange = (snapshot) => {
      if (this.isUserExitingOnline || this.appMode !== "online") return;
      this.latestOnlineSnapshot = snapshot;

      const prev = this.previousOnlinePhase;
      this.previousOnlinePhase = snapshot.phase;

      if (this.onlineMatchConcluding) {
        this.onlineRoundActive = false;
        if (this.onlineGameActive) {
          this.syncLocalOnlineActor(snapshot);
          this.arena.setPortalDoorsOpen(snapshot.phase === "PLAYING");
          this.onlineMatch.applySnapshot(snapshot.actors, snapshot.sessionId);
          this.matchStats.observePlayers(this.getOnlineMatchStatsActors(snapshot), { accumulateTravel: false });
        }
        return;
      }

      if (!this.onlineGameActive || snapshot.phase === "LOBBY") {
        this.multiplayer.render(snapshot);
      }

      const shouldBeginOnlineRound =
        snapshot.phase === "COUNTDOWN"
        && prev !== "COUNTDOWN"
        && prev !== "PLAYING";

      if (shouldBeginOnlineRound) {
        this.beginOnlineRound(snapshot);
        this.sound.playCountdown();
      }

      if (snapshot.phase === "LOBBY") {
        if (this.onlineGameActive || this.pendingOnlineDebrief) {
          this.endOnlineGame();
        }
        return;
      }

      if (this.onlineGameActive) {
        this.onlineRoundActive = snapshot.phase === "PLAYING";
        this.syncLocalOnlineActor(snapshot);
        this.arena.setPortalDoorsOpen(snapshot.phase === "PLAYING");
        this.onlineMatch.applySnapshot(snapshot.actors, snapshot.sessionId);
        this.matchStats.observePlayers(this.getOnlineMatchStatsActors(snapshot), {
          accumulateTravel: snapshot.phase === "PLAYING",
        });
      }
    };

    this.net.onLobbyEvent = (event) => {
      if (this.isUserExitingOnline || this.appMode !== "online") return;
      this.multiplayer.setStatus(event.text, event.type);
    };

    this.net.onFreezeEvent = (event) => {
      if (this.isUserExitingOnline || this.appMode !== "online") return;
      this.killFeed.addKill(event.killerName, event.killerTeam, event.victimName, event.victimTeam);
    };

    this.net.onPlayerLeaveEvent = (event) => {
      if (this.isUserExitingOnline || this.appMode !== "online") return;
      this.killFeed.addLeave(event.playerName, event.playerTeam);
    };

    this.net.onRoundResultEvent = (event) => {
      if (this.isUserExitingOnline || this.appMode !== "online") return;
      if (!this.onlineGameActive) return;

      if (event.reason === "breach") {
        this.disableOnlineProjectiles();
      } else {
        this.onlineRoundActive = false;
      }
      this.projectiles.clear();
      this.onlineBreachReported = false;

      if (event.outcome === "tie") {
        this.hud.showRoundEnd(buildRoundEndHtml("tie"));
        return;
      }

      if (event.reason === "breach" && event.winningTeam !== null) {
        this.matchStats.recordBreach(event.scorerId);
        this.killFeed.addScore(event.scorerName, event.winningTeam);
      }

      if (event.matchWinner !== null && event.finalScore) {
        this.setCelebratingTeam(event.matchWinner);
        this.onlineMatchConcluding = true;
        this.pendingOnlineDebrief = this.buildOnlineDebrief(event.matchWinner, event.finalScore);
        this.sessionMenu.close();
        this.hud.showRoundEnd(
          buildRoundEndHtml({
            team: event.matchWinner,
            matchScore: event.finalScore,
          }),
        );
        this.restorePointerLockAfterScoreboard = false;
        this.input.exitPointerLock();
        this.input.setUiBlocked(true);
        this.mobileControls?.hide();
        this.input.setMobileControlsActive(false);
        this.sessionMenu.setLauncherVisible(false);
        if (this.matchEndHandle) {
          clearTimeout(this.matchEndHandle);
        }
        this.matchEndHandle = setTimeout(() => {
          this.matchEndHandle = null;
          const debrief = this.pendingOnlineDebrief;
          this.pendingOnlineDebrief = null;
          if (!debrief || this.appMode !== "online") {
            return;
          }
          this.showMatchDebrief(debrief);
        }, ONLINE_MATCH_DEBRIEF_DELAY_MS);
        return;
      }

      if (event.winningTeam !== null) {
        this.hud.showRoundEnd(
          event.reason === "fullFreeze"
            ? buildRoundEndHtml({
              team: event.winningTeam,
              kind: "freeze",
              enemyTeam: (1 - event.winningTeam) as 0 | 1,
            })
            : event.reason === "disconnect"
              ? buildRoundEndHtml({ team: event.winningTeam, kind: "disconnect" })
              : buildRoundEndHtml({ team: event.winningTeam }),
        );
      }
    };

    this.net.onShotEvent = (event) => {
      if (this.isUserExitingOnline || this.appMode !== "online") return;
      if (!this.onlineGameActive || !this.onlineRoundActive) return;
      if (event.ownerId === this.getOnlineLocalActorId()) return;

      this.projectiles.spawn(
        new THREE.Vector3(event.originX, event.originY, event.originZ),
        new THREE.Vector3(event.dirX, event.dirY, event.dirZ),
        event.team,
        event.ownerId,
      );
      this.onlineMatch.triggerRemoteShot(event.ownerId);
      this.sound.playRemoteShot(new THREE.Vector3(event.originX, event.originY, event.originZ));
    };

    this.net.onLeave = () => {
      if (this.isUserExitingOnline) return;
      if (this.appMode !== "online") return;
      this.handleOnlineConnectionFailure(
        "Connection to the online room was lost.",
        "connection_lost",
      );
    };
    this.net.onConnectionError = (error) => {
      if (this.isUserExitingOnline) return;
      if (this.appMode !== "online") return;
      this.handleOnlineConnectionFailure(
        error.message.trim().length > 0
          ? error.message
          : "Connection to the online room was lost.",
        "connection_lost",
      );
    };

    this.multiplayer.onLeaveLobby = () => {
      void this.requestLeaveOnline("user_exit");
    };
    this.multiplayer.onReconnect = () => {
      void this.retryOnlineConnection();
    };
    this.multiplayer.onReturnToMenu = () => {
      void this.forceLeaveOnline();
    };
    this.multiplayer.onReadyChange = (ready) => {
      this.net.setReady(ready);
    };
    this.multiplayer.onSwitchTeam = (team) => {
      this.net.switchTeam(team);
    };
    this.multiplayer.onFillBots = (fill) => {
      this.net.fillBots(fill);
    };
    this.multiplayer.onOpenSettings = () => {
      this.openSessionMenu();
    };
    this.multiplayer.onTeamSizeChange = (teamSize) => {
      this.net.setTeamSize(teamSize);
    };
    this.roomBrowser.onJoinRoom = (roomId) => {
      if (!this.pendingOnlineRoomSelection) return;
      const selection = this.pendingOnlineRoomSelection;
      this.menu.fadeOut(() => {
        void this.startOnlineLobby(selection, { kind: "roomId", roomId });
      });
    };
    this.roomBrowser.onCreateRoom = (target) => {
      if (!this.pendingOnlineRoomSelection) return;
      const selection = this.pendingOnlineRoomSelection;
      this.menu.fadeOut(() => {
        void this.startOnlineLobby(selection, target);
      });
    };
    this.roomBrowser.onClose = () => {
      this.pendingOnlineRoomSelection = null;
    };

    if (this.mobile) {
      this.mobileControls = new MobileControls(this.input);
      this.mobileControls.mount();
      this.mobileControls.hide();
      this.mobileControls.onViewToggle = () => {
        this.toggleCameraView();
      };
    } else {
      this.sceneMgr.getRenderer().domElement.addEventListener("mousedown", () => {
        if (this.menu.isVisible() || this.input.isLocked() || this.sessionMenu.isOpen()) return;
        if (this.appMode === "solo" && this.round.getPhase() === "LOBBY") return;
        if (this.appMode === "online" && !this.onlineGameActive) return;
        this.input.lockPointer(this.sceneMgr.getRenderer().domElement);
      });
    }

    this.tickCtx = this.createTickContext();
  }

  public start(): void {
    this.menu.onPlaySolo = (selection) => {
      this.startSoloMatch(selection);
    };
    this.menu.onPlayOnline = (selection) => {
      void this.startOnlineLobby(selection);
    };
    this.menu.onBrowseOnline = (selection) => {
      this.pendingOnlineRoomSelection = selection;
      void this.roomBrowser.show({
        inviteRoomId: this.getInviteRoomId(),
        defaultTeamSize: selection.teamSize,
      });
    };
    this.menu.onOpenInstructions = () => {
      this.openSessionMenu("instructions");
    };
    this.menu.onOpenSettings = () => {
      this.openSessionMenu();
    };
    this.menu.onOpenCredits = () => {
      this.openSessionMenu("credits");
    };
    this.menu.onPlayTutorial = (selection) => {
      this.startTutorialMatch(selection);
    };

    if (this.portalArrivalPending) {
      this.cursor.hide();
      this.startSoloMatch({
        name: this.portalParams.username?.trim() || DEFAULT_PLAYER_NAME,
        teamSize: 1,
        noBots: true,
      });
    } else if (this.embedMode) {
      this.cleanEmbedUrl();
      this.menu.show();
    } else {
      this.welcome.onBreach = () => { this.menu.show(); };
      this.welcome.fullscreenOnClick = this.fullscreenPreference;
      this.welcome.show();
    }

    const unlockAudio = (): void => {
      void this.sound.unlock().then(() => {
        this.sound.startMusic();
        document.removeEventListener('pointerdown', unlockAudio);
        document.removeEventListener('keydown', unlockAudio);
        document.removeEventListener('touchstart', unlockAudio);
      }).catch((err) => {
        console.warn("[GameApp] Audio unlock failed:", err);
      });
    };
    document.addEventListener('pointerdown', unlockAudio);
    document.addEventListener('keydown', unlockAudio);
    document.addEventListener('touchstart', unlockAudio, { passive: true });

    // Resume music when user returns to tab/app (AudioContext suspends on hide)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.sound.tryResumeMusic();
        this.resyncLocalOnlineActorFromLatestSnapshot();
      }
    });
    // iOS back/forward cache restore — context is suspended on bfcache restore
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) this.sound.tryResumeMusic();
    });

    requestAnimationFrame((timestamp) => this.loop(timestamp));
  }

  // ── Main loop ───────────────────────────────────────────────────────────────

  private loop(timestamp: number): void {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.033);
    this.lastTime = timestamp;
    const gameplayActive = this.isGameplaySceneActive();

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

    this.syncCombatPresentation(gameplayActive);
    this.syncDesktopOverlayCursor(gameplayActive);
    this.sceneMgr.render();
    requestAnimationFrame((nextTimestamp) => this.loop(nextTimestamp));
  }






  private disableOnlineProjectiles(): void {
    this.onlineRoundActive = false;
    this.projectiles.clear();
  }


  // ── Online game lifecycle ───────────────────────────────────────────────────

  private beginOnlineRound(snapshot: MultiplayerRoomSnapshot): void {
    if (this.onlineMatchConcluding || this.debrief.isVisible()) {
      return;
    }

    this.clearCelebrationState();
    if (
      snapshot.roundNumber === 1
      && snapshot.score.team0 === 0
      && snapshot.score.team1 === 0
    ) {
      this.matchStats.reset();
      this.thirdPerson = this.sessionMenu.getSettings().defaultCameraMode === "third";
    }


    this.onlineGameActive = true;
    this.onlineRoundActive = snapshot.phase === "PLAYING";
    this.onlineBreachReported = false;
    this.playerUpdateTimer = 0;
    this.tutorial.beginRun();
    this.cursor.hide();
    this.applySelectedCameraViewMode(resolveCameraViewModeForRound(
      this.sessionMenu.getSettings().defaultCameraMode,
      this.selectedCameraViewMode,
    ));

    if (!this.mobile) {
      this.input.lockPointer(this.sceneMgr.getRenderer().domElement);
    }

    this.multiplayer.hide();
    this.hud.setVisible(true);
    this.killFeed.setVisible(true);
    this.hud.hideRoundEnd();

    const layout = generateArenaLayout(snapshot.roundNumber);
    this.arena.loadLayout(layout);
    this.debugOverlays.onLayoutLoaded(this.arena);
    this.projectiles.clear();

    this.player.setTeam(snapshot.selfTeam);
    const selfActor = snapshot.actors.find((actor) => actor.id === snapshot.sessionId);
    this.player.kills = selfActor?.kills ?? 0;
    this.player.deaths = selfActor?.deaths ?? 0;
    this.player.resetForNewRound(
      this.arena,
      selfActor
        ? { x: selfActor.posX, y: selfActor.posY, z: selfActor.posZ }
        : undefined,
    );
    if (selfActor) {
      this.player.applyAuthoritativeOnlineState(selfActor);
    }

    const openAxis = this.arena.getBreachOpenAxis(this.player.team);
    const openSign = this.arena.getBreachOpenSign(this.player.team);
    this.cam.resetForBreachSpawn(cameraYawFacingBreachOpening(openAxis, openSign));

    this.arena.setPortalDoorsOpen(snapshot.phase === "PLAYING");

    this.onlineMatch.applySnapshot(snapshot.actors, snapshot.sessionId);
    this.matchStats.observePlayers(this.getOnlineMatchStatsActors(snapshot), { accumulateTravel: false });

    if (this.mobile) {
      const menuOpen = this.sessionMenu.isOpen();
      this.input.setMobileControlsActive(!menuOpen);
      if (menuOpen) {
        this.mobileControls?.hide();
      } else {
        this.mobileControls?.show();
      }
    }
    // Pointer lock is acquired on the first canvas click (mousedown handler),
    // not here — requestPointerLock() requires a direct user gesture.
  }

  private endOnlineGame(): void {
    this.sound.stopCountdown();
    this.closeSessionMenu();
    this.clearCelebrationState();
    this.onlineGameActive = false;
    this.onlineRoundActive = false;
    this.onlineBreachReported = false;

    this.onlineMatch.dispose();
    this.projectiles.clear();
    this.killFeed.setVisible(false);
    this.restorePointerLockAfterScoreboard = false;
    this.input.exitPointerLock();
    this.input.setUiBlocked(false);
    this.mobileControls?.hide();
    this.input.setMobileControlsActive(false);
    this.cursor.show();

    const snap = this.latestOnlineSnapshot;
    if (snap) {
      this.multiplayer.render(snap);
    }
    this.hud.setVisible(false);
    this.hud.hideRoundEnd();
  }



  // ── Solo round lifecycle ────────────────────────────────────────────────────

  private beginNewRound(): void {
    this.clearCelebrationState();
    this.hud.hideRoundEnd();
    this.projectiles.clear();
    clearVibeJamPortals();

    const layout = generateArenaLayout();
    this.arena.loadLayout(layout);
    this.debugOverlays.onLayoutLoaded(this.arena);

    const arrivalThisRound = this.portalArrivalPending;
    const arrivalCenter = this.arena.getBreachRoomCenter(this.player.team);
    const arrivalOpenAxis = this.arena.getBreachOpenAxis(this.player.team);
    const arrivalOpenSign = this.arena.getBreachOpenSign(this.player.team);
    configurePortalArrivalSpawn(arrivalCenter, arrivalOpenAxis, arrivalOpenSign);

    const enemyTeam = (1 - this.player.team) as 0 | 1;
    configureOutboundPortal(
      this.arena.getBreachRoomCenter(enemyTeam),
      this.arena.getBreachOpenAxis(enemyTeam),
      this.arena.getBreachOpenSign(enemyTeam),
    );

    this.match.resetForRound(
      this.arena,
      this.player,
      arrivalThisRound ? PORTAL_ARRIVAL_SPAWN : undefined,
    );

    const openAxis = this.arena.getBreachOpenAxis(this.player.team);
    const openSign = this.arena.getBreachOpenSign(this.player.team);
    this.cam.resetForBreachSpawn(cameraYawFacingBreachOpening(openAxis, openSign));

    initVibeJamPortal(this.sceneMgr.getScene(), this.portalParams);
    this.match.addOutboundVibeJamPortal(this.portalParams);

    this.arena.setPortalDoorsOpen(false);
    if (arrivalThisRound) {
      this.round.startCountdown();
      this.round.tick(999);
      this.cleanPortalUrl();
      this.portalArrivalPending = false;
    } else {
      this.round.startCountdown();
      this.sound.playCountdown();
    }
  }

  private onRoundWin(team: 0 | 1, reason: "breach" | "fullFreeze"): void {
    if (!this.round.isPlaying()) return;
    this.projectiles.clear();
    const score = this.match.getScore();
    const matchWinner = findMatchWinner(score, MATCH_POINT_TARGET);
    this.hud.showRoundEnd(
      matchWinner !== null
        ? buildRoundEndHtml({ team, matchScore: score })
        : reason === "fullFreeze"
          ? buildRoundEndHtml({ team, kind: "freeze", enemyTeam: (1 - team) as 0 | 1 })
          : buildRoundEndHtml({ team }),
    );
    this.round.endRound();
  }

  private onRoundTie(): void {
    if (!this.round.isPlaying()) return;
    this.projectiles.clear();
    this.hud.showRoundEnd(buildRoundEndHtml("tie"));
    this.round.endRound();
  }

  private onMatchEnd(
    winningTeam: 0 | 1,
    finalScore: { team0: number; team1: number },
  ): void {
    this.matchOver = true;
    this.setCelebratingTeam(winningTeam);
    this.round.cancelPendingRestart();
    if (this.matchEndHandle) clearTimeout(this.matchEndHandle);
    this.matchEndHandle = setTimeout(() => {
      this.matchEndHandle = null;
      this.showSoloDebrief(winningTeam, finalScore);
    }, 4000);
  }

  private showSoloDebrief(
    winningTeam: 0 | 1,
    finalScore: { team0: number; team1: number },
  ): void {
    const playerTeam = this.player.team;
    this.matchStats.observePlayers(this.match.getMatchStatsActors(this.player), { accumulateTravel: false });

    const teamSize = this.lastSoloSelection?.teamSize ?? 1;
    const sizeLabelMap: Record<number, string> = {
      1: "1v1 Duel", 2: "2v2 Duos", 5: "5v5 Squads", 10: "10v10 Rush", 20: "20v20 War",
    };

    const debriefData: DebriefData = {
      winningTeam,
      score: finalScore,
      players: this.matchStats.buildPlayers(),
      awards: this.matchStats.buildAwards(),
      playerTeam,
      secondaryActionLabel: "Main Menu",
      primaryActionLabel: "Play Again",
      matchLabel: `${sizeLabelMap[teamSize] ?? "Solo"} · ${finalScore.team0} – ${finalScore.team1}`,
    };

    this.showMatchDebrief(debriefData);
  }

  private returnToMenuFromSolo(): void {
    this.sound.stopCountdown();
    this.closeSessionMenu();
    this.clearCelebrationState();
    this.debrief.hide();
    this.appMode = "menu";
    this.syncBackgroundInputPolicy();
    this.cursor.show();
    this.matchOver = false;
    this.projectiles.clear();
    clearVibeJamPortals();
    this.hud.setVisible(false);
    this.hud.hideRoundEnd();
    this.killFeed.setVisible(false);
    this.restorePointerLockAfterScoreboard = false;
    this.input.exitPointerLock();
    this.mobileControls?.hide();
    this.input.setMobileControlsActive(false);
    this.input.setUiBlocked(false);
    this.match.dispose();
    this.sessionMenu.setLauncherVisible(false);
    this.menu.show();
  }

  private openSessionMenu(view: "settings" | "instructions" | "credits" = "settings"): void {
    if (this.sessionMenu.isOpen() || this.debrief.isVisible() || this.onlineMatchConcluding) return;

    const inMenu = this.appMode === "menu";
    const inLiveMatch = this.appMode === "solo" || this.onlineGameActive;
    const title = inMenu
      ? "Flight Settings"
      : this.appMode === "solo"
        ? "Solo Flight Menu"
        : this.onlineGameActive
          ? "Live Match Menu"
          : "Lobby Menu";
    const subtitle = inMenu
      ? "Tune mouse and audio before launch. Close settings to continue from the main menu."
      : inLiveMatch
        ? this.mobile
          ? "Resume when you are ready, or return straight to the main menu."
          : "Resume when you are ready, then click the arena to recapture mouse look."
        : "Step back to the room shell or return all the way to the main menu.";
    const resumeLabel = inMenu
      ? "Close Settings"
      : this.appMode === "solo"
        ? "Resume Match"
        : this.onlineGameActive
          ? "Resume Match"
          : "Back To Lobby";
    const mainMenuLabel = inMenu ? null : "Return To Main Menu";

    this.restorePointerLockAfterScoreboard = false;
    this.input.exitPointerLock();
    this.input.setUiBlocked(true);
    if (this.mobile) {
      this.mobileControls?.hide();
      this.input.setMobileControlsActive(false);
    }

    this.sessionMenu.open({
      title,
      subtitle,
      resumeLabel,
      mainMenuLabel,
    }, view);
  }

  private closeSessionMenu(): void {
    if (!this.sessionMenu.isOpen()) return;

    this.sessionMenu.close();
    this.input.setUiBlocked(false);

    if (!this.mobile) return;

    if (this.onlineMatchConcluding || this.debrief.isVisible()) {
      this.input.setMobileControlsActive(false);
      this.mobileControls?.hide();
      return;
    }

    if (this.appMode === "solo" || this.onlineGameActive) {
      this.input.setMobileControlsActive(true);
      this.mobileControls?.show();
      return;
    }

    this.mobileControls?.hide();
    this.input.setMobileControlsActive(false);
  }

  private async handleSessionMenuMainMenu(): Promise<void> {
    this.closeSessionMenu();
    if (this.appMode === "solo") {
      this.returnToMenuFromSolo();
      return;
    }
    if (this.appMode === "online") {
      await this.requestLeaveOnline("user_exit");
    }
  }

  private countOtherHumans(): number {
    const snap = this.latestOnlineSnapshot;
    if (!snap) return 0;
    return snap.members.filter((m) => !m.isBot && m.id !== snap.sessionId).length;
  }

  private async requestLeaveOnline(reason: "user_exit"): Promise<void> {
    if (this.isUserExitingOnline) return;

    if (reason === "user_exit" && this.countOtherHumans() > 0) {
      const confirmed = await showConfirmDialog({
        title: "Leave online room?",
        body: "Other players are still in this room. Are you sure you want to leave?",
        confirmLabel: "LEAVE",
        cancelLabel: "CANCEL",
      });
      if (!confirmed) return;
    }

    await this.forceLeaveOnline();
  }

  private handleOnlineConnectionFailure(
    message: string,
    reason: "join_failed" | "connection_lost",
  ): void {
    if (this.isUserExitingOnline || this.appMode !== "online") {
      return;
    }

    if (this.onlineReconnectPending) {
      this.multiplayer.showReconnectPrompt({
        title: "Connection Interrupted",
        body: "The room link is still down. Retry the same room or fall back to the main menu.",
        status: message,
      });
      return;
    }

    this.onlineReconnectPending = true;
    this.onlineSessionToken += 1;
    this.closeSessionMenu();
    this.debrief.hide();
    this.clearCelebrationState();
    this.pendingOnlineDebrief = null;
    this.onlineMatchConcluding = false;
    if (this.matchEndHandle) {
      clearTimeout(this.matchEndHandle);
      this.matchEndHandle = null;
    }

    if (this.onlineGameActive) {
      this.endOnlineGame();
    } else if (this.latestOnlineSnapshot) {
      this.multiplayer.render(this.latestOnlineSnapshot);
    } else {
      this.multiplayer.showConnecting(this.onlinePlayerName);
    }

    this.onlineGameActive = false;
    this.onlineRoundActive = false;
    this.onlineBreachReported = false;
    this.killFeed.setVisible(false);
    this.mobileControls?.hide();
    this.input.setMobileControlsActive(false);
    this.input.setUiBlocked(false);
    this.restorePointerLockAfterScoreboard = false;
    this.input.exitPointerLock();
    this.cursor.show();
    this.hud.setVisible(false);
    this.hud.hideRoundEnd();
    this.sessionMenu.setLauncherVisible(true);

    this.multiplayer.showReconnectPrompt({
      title: reason === "join_failed" ? "Handshake Failed" : "Connection Interrupted",
      body: reason === "join_failed"
        ? "The room session never finished opening. Retry the same destination or return to the main menu."
        : "The current room stopped responding. Reconnect to the same lobby or return to the main menu.",
      status: message,
    });
  }

  private async retryOnlineConnection(): Promise<void> {
    if (!this.lastOnlineSelection || !this.lastOnlineTarget) {
      await this.forceLeaveOnline();
      return;
    }

    await this.startOnlineLobby(this.lastOnlineSelection, this.lastOnlineTarget);
  }

  private async forceLeaveOnline(): Promise<void> {
    if (this.isUserExitingOnline) return;
    this.isUserExitingOnline = true;
    this.onlineReconnectPending = false;
    this.onlineSessionToken += 1;
    try {
      await this.returnToMenuFromOnline();
    } finally {
      this.isUserExitingOnline = false;
    }
  }

  private applySessionSettings(settings: SessionSettings): void {
    this.input.mouseSensitivity = settings.mouseSensitivity;
    this.sound.setMusicVolume(settings.musicVolume);
    this.sound.setSfxVolume(settings.sfxVolume);
    this.sound.setMusicEnabled(settings.soundtrackEnabled);
    this.debugOverlays.setCollisionVisVisible(settings.collisionVisEnabled);
  }

  private async applyFullscreenPreference(enabled: boolean): Promise<void> {
    const inApiFullscreen = isFullscreen();

    if (!enabled && !inApiFullscreen && isApparentFullscreen()) {
      // F11 fullscreen can't be exited via the Fullscreen API — revert the checkbox and hint the user.
      this.sessionMenu.syncFullscreenFromBrowser(false);
      showF11ExitHint();
      return;
    }

    const applied = enabled
      ? (inApiFullscreen || await requestFullscreen())
      : (!inApiFullscreen || await leaveFullscreen());

    if (!applied) {
      this.sessionMenu.syncFullscreenFromBrowser();
    }
  }

  private cleanEmbedUrl(): void {
    if (typeof window === "undefined") return;
    if (!window.location.search) return;
    history.replaceState(null, "", window.location.pathname);
  }

  private cleanPortalUrl(): void {
    if (this.portalUrlCleaned || typeof window === "undefined") return;
    if (!window.location.search) return;
    history.replaceState(null, "", window.location.pathname);
    this.portalUrlCleaned = true;
  }

  private getOnlineLocalActorId(): string {
    return this.net.getSessionId() ?? "local-player";
  }

  /**
   * Context handed to the per-frame tick functions in soloTick.ts /
   * onlineTick.ts. Subsystem references are stable; mutable flags are
   * exposed as accessor properties backed by this App's fields.
   */
  private createTickContext(): GameTickContext {
    const app = this;
    return {
      arena: this.arena,
      cam: this.cam,
      debugOverlays: this.debugOverlays,
      gun: this.gun,
      hud: this.hud,
      input: this.input,
      match: this.match,
      matchStats: this.matchStats,
      mobile: this.mobile,
      mobileControls: this.mobileControls,
      net: this.net,
      onlineMatch: this.onlineMatch,
      player: this.player,
      projectiles: this.projectiles,
      round: this.round,
      sceneMgr: this.sceneMgr,
      sound: this.sound,
      tutorial: this.tutorial,

      get helpVisible() { return app.helpVisible; },
      get latestOnlineSnapshot() { return app.latestOnlineSnapshot; },
      get onlineBreachReported() { return app.onlineBreachReported; },
      set onlineBreachReported(value: boolean) { app.onlineBreachReported = value; },
      get onlineGameActive() { return app.onlineGameActive; },
      get onlinePlayerName() { return app.onlinePlayerName; },
      get onlineRoundActive() { return app.onlineRoundActive; },
      get playerUpdateTimer() { return app.playerUpdateTimer; },
      set playerUpdateTimer(value: number) { app.playerUpdateTimer = value; },
      get thirdPerson() { return app.thirdPerson; },
      get victoryOrbitAngle() { return app.victoryOrbitAngle; },
      set victoryOrbitAngle(value: number) { app.victoryOrbitAngle = value; },

      disableOnlineProjectiles: () => this.disableOnlineProjectiles(),
      getOnlineLocalActorId: () => this.getOnlineLocalActorId(),
      isRearViewCameraActive: () => this.isRearViewCameraActive(),
      toggleCameraView: () => this.toggleCameraView(),
      updateGunVisibility: (isSelfie: boolean) => this.updateGunVisibility(isSelfie),
    };
  }

  // ── Solo match start ────────────────────────────────────────────────────────

  private startTutorialMatch(selection: PlaySelection): void {
    this.tutorial.forceRestart();
    this.startSoloMatch({ ...selection, teamSize: 1, noBots: true });
  }

  private startSoloMatch(selection: PlaySelection): void {
    this.lastSoloSelection = selection;
    this.debrief.hide();
    this.clearCelebrationState();
    this.appMode = "solo";
    this.syncBackgroundInputPolicy();
    this.cursor.hide();
    this.matchOver = false;
    this.onlineBreachReported = false;
    this.helpVisible = false;
    this.matchStats.reset();
    this.tutorial.beginRun();
    this.killFeed.setLocalPlayerName(selection.name);
    this.resetCameraViewModeToDefault();
    if (this.matchEndHandle) {
      clearTimeout(this.matchEndHandle);
      this.matchEndHandle = null;
    }
    this.multiplayer.hide();
    this.hud.setVisible(true);
    this.killFeed.setVisible(true);
    this.input.setUiBlocked(false);
    this.sessionMenu.setLauncherVisible(true);

    this.player.setTeam(0);
    this.portalParams = {
      ...this.portalParams,
      color: this.portalParams.color ?? "cyan",
      team: this.portalParams.team ?? "0",
      username: selection.name,
    };
    this.match.startNewGame({
      humanName: selection.name,
      humanTeam: 0,
      teamSize: selection.teamSize,
      noBots: selection.noBots,
    });

    if (this.mobile) {
      this.input.setMobileControlsActive(true);
      this.mobileControls?.show();
    } else if (!this.portalArrivalPending) {
      this.input.lockPointer(this.sceneMgr.getRenderer().domElement);
    }

    this.beginNewRound();
  }

  // ── Online lobby start ──────────────────────────────────────────────────────

  private async startOnlineLobby(
    selection: PlaySelection,
    target?: MultiplayerJoinTarget,
  ): Promise<void> {
    this.pendingOnlineRoomSelection = null;
    this.roomBrowser.hide();
    const inviteRoomId = this.getInviteRoomId();
    const resolvedTarget = target ?? this.getInviteJoinTarget() ?? { kind: "quick" };
    const shouldClearInviteParam =
      resolvedTarget.kind === "roomId"
      && inviteRoomId !== null
      && resolvedTarget.roomId === inviteRoomId;
    this.appMode = "online";
    this.syncBackgroundInputPolicy();
    this.onlinePlayerName = selection.name;
    this.lastOnlineSelection = selection;
    this.lastOnlineTarget = resolvedTarget;
    this.killFeed.setLocalPlayerName(selection.name);
    this.onlineGameActive = false;
    this.onlineRoundActive = false;
    this.onlineReconnectPending = false;
    this.onlineBreachReported = false;
    this.onlineMatchConcluding = false;
    this.matchStats.reset();
    this.pendingOnlineDebrief = null;
    if (this.matchEndHandle) { clearTimeout(this.matchEndHandle); this.matchEndHandle = null; }
    this.previousOnlinePhase = null;
    this.latestOnlineSnapshot = null;
    this.projectiles.clear();
    this.hud.setVisible(false);
    this.killFeed.setVisible(false);
    this.input.setUiBlocked(false);
    this.restorePointerLockAfterScoreboard = false;
    this.input.exitPointerLock();
    this.mobileControls?.hide();
    this.input.setMobileControlsActive(false);
    this.sessionMenu.setLauncherVisible(true);
    this.resetCameraViewModeToDefault();
    this.multiplayer.showConnecting(selection.name);

    this.isUserExitingOnline = false;
    const myToken = ++this.onlineSessionToken;

    try {
      const snapshot = await this.net.connect({
        name: selection.name,
        target: resolvedTarget,
      });
      if (myToken !== this.onlineSessionToken || this.isUserExitingOnline || this.appMode !== "online") {
        try { await this.net.disconnect(); } catch { /* ignore */ }
        return;
      }
      if (shouldClearInviteParam) {
        this.clearInviteRoomIdFromUrl();
      }
      this.latestOnlineSnapshot = snapshot;
      this.previousOnlinePhase = snapshot.phase;
      this.lastOnlineTarget = { kind: "roomId", roomId: snapshot.roomId };
      if (snapshot.phase === "COUNTDOWN") {
        this.beginOnlineRound(snapshot);
      } else {
        this.multiplayer.render(snapshot);
      }
    } catch (error) {
      console.error("Failed to connect to the multiplayer room.", error);
      if (myToken !== this.onlineSessionToken || this.isUserExitingOnline || this.appMode !== "online") {
        return;
      }
      const message = error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "Could not reach the Colyseus server. Check that the server is running.";
      this.handleOnlineConnectionFailure(message, "join_failed");
    }
  }

  private async returnToMenuFromOnline(): Promise<void> {
    this.pendingOnlineRoomSelection = null;
    this.roomBrowser.hide();
    this.closeSessionMenu();
    this.debrief.hide();
    this.clearCelebrationState();
    this.matchStats.reset();
    this.appMode = "menu";
    this.syncBackgroundInputPolicy();
    this.onlineGameActive = false;
    this.onlineRoundActive = false;
    this.cursor.show();
    this.onlineBreachReported = false;
    this.onlineMatchConcluding = false;
    this.pendingOnlineDebrief = null;
    this.latestOnlineSnapshot = null;
    this.previousOnlinePhase = null;
    this.lastOnlineSelection = null;
    this.lastOnlineTarget = null;
    this.onlineReconnectPending = false;
    this.helpVisible = false;
    if (this.matchEndHandle) { clearTimeout(this.matchEndHandle); this.matchEndHandle = null; }
    this.onlineMatch.dispose();
    this.multiplayer.hide();
    clearVibeJamPortals();
    this.hud.setVisible(false);
    this.hud.hideRoundEnd();
    this.killFeed.setVisible(false);
    this.mobileControls?.hide();
    this.input.setMobileControlsActive(false);
    this.input.setUiBlocked(false);
    this.restorePointerLockAfterScoreboard = false;
    this.input.exitPointerLock();
    this.sessionMenu.setLauncherVisible(false);
    this.gun.setVisible(false);
    this.gun.setFrozenTint(null);
    this.player.setWorldModelVisible(false);
    this.player.setThirdPersonGunVisible(false);
    this.player.setThirdPersonGunFrozenTint(null);

    // Show the main menu BEFORE awaiting disconnect. Colyseus's
    // room.leave(true) waits for server ack and can hang for several
    // seconds after a fully-joined session, leaving a black canvas
    // if menu.show() ran after the await.
    this.menu.show();

    const disconnectPromise = this.net.disconnect().catch((error) => {
      console.warn("Multiplayer disconnect raised an error.", error);
    });
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1500));
    await Promise.race([disconnectPromise, timeout]);
  }

  private getInviteRoomId(): string | null {
    return getInviteRoomIdFromSearch(window.location.search);
  }

  private getInviteJoinTarget(): MultiplayerJoinTarget | null {
    const roomId = this.getInviteRoomId();
    return roomId ? { kind: "roomId", roomId } : null;
  }

  private clearInviteRoomIdFromUrl(): void {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(MULTIPLAYER_INVITE_PARAM)) {
      return;
    }

    url.searchParams.delete(MULTIPLAYER_INVITE_PARAM);
    window.history.replaceState({}, "", url);
  }

  // ── Match debrief ───────────────────────────────────────────────────────────

  private showMatchDebrief(data: DebriefData): void {
    if (this.matchEndHandle) {
      clearTimeout(this.matchEndHandle);
      this.matchEndHandle = null;
    }

    this.sessionMenu.close();
    this.restorePointerLockAfterScoreboard = false;
    this.input.exitPointerLock();
    this.input.setUiBlocked(true);
    this.mobileControls?.hide();
    this.input.setMobileControlsActive(false);
    this.sessionMenu.setLauncherVisible(false);
    this.hud.setVisible(false);
    this.hud.hideRoundEnd();
    this.killFeed.setVisible(false);
    this.cursor.show();
    this.debrief.show(data);
  }

  private buildOnlineDebrief(
    winningTeam: 0 | 1,
    finalScore: { team0: number; team1: number },
  ): DebriefData {
    const snapshot = this.latestOnlineSnapshot;
    const sessionId = this.net.getSessionId() ?? "local-player";
    const playerTeam = snapshot?.selfTeam ?? this.player.team;
    const teamSize = snapshot?.teamSize ?? 1;
    const sizeLabelMap: Record<number, string> = {
      1: "1v1 Duel", 2: "2v2 Duos", 5: "5v5 Squads", 10: "10v10 Rush", 20: "20v20 War",
    };

    if (snapshot) {
      this.matchStats.observePlayers(this.getOnlineMatchStatsActors(snapshot), { accumulateTravel: false });
    }

    return {
      winningTeam,
      score: finalScore,
      players: this.getTrackedOnlineDebriefPlayers(sessionId, playerTeam),
      awards: this.matchStats.buildAwards(),
      playerTeam,
      secondaryActionLabel: "Main Menu",
      primaryActionLabel: "Return To Lobby",
      matchLabel: `${sizeLabelMap[teamSize] ?? `${teamSize}v${teamSize}`} Online · ${finalScore.team0} – ${finalScore.team1}`,
    };
  }

  private getOnlineMatchStatsActors(snapshot: MultiplayerRoomSnapshot): ObservedMatchPlayer[] {
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

  private getTrackedOnlineDebriefPlayers(sessionId: string, playerTeam: 0 | 1): DebriefPlayer[] {
    const trackedPlayers = this.matchStats.buildPlayers();
    if (trackedPlayers.length > 0) {
      return trackedPlayers;
    }

    return [{
      id: sessionId,
      name: this.onlinePlayerName,
      team: playerTeam,
      breaches: 0,
      freezes: this.player.kills,
      frozen: this.player.deaths,
      travelDistance: 0,
      isBot: false,
      isSelf: true,
    }];
  }

  private returnToOnlineLobbyFromDebrief(): void {
    this.clearCelebrationState();
    this.onlineMatchConcluding = false;
    this.onlineGameActive = false;
    this.onlineRoundActive = false;
    this.matchStats.reset();
    this.input.setUiBlocked(false);
    this.onlineMatch.dispose();
    this.projectiles.clear();
    this.sessionMenu.setLauncherVisible(true);
    this.hud.hideRoundEnd();

    if (this.latestOnlineSnapshot) {
      this.multiplayer.render(this.latestOnlineSnapshot);
      return;
    }

    this.multiplayer.show();
  }


  private setCelebratingTeam(team: 0 | 1): void {
    const playerWins = this.player.team === team && !this.player.damage.frozen;
    this.player.setVictoryDanceActive(playerWins);
    if (playerWins) {
      this.thirdPerson = true;
    }
    this.match.setCelebratingTeam(team);
    this.onlineMatch.setCelebratingTeam(team);
  }

  private clearCelebrationState(): void {
    this.player.setVictoryDanceActive(false);
    this.thirdPerson = isThirdPersonCameraView(this.selectedCameraViewMode);
    this.victoryOrbitAngle = 0;
    this.match.setCelebratingTeam(null);
    this.onlineMatch.setCelebratingTeam(null);
  }

  private isRearViewCameraActive(): boolean {
    return FEATURE_FLAGS.thirdPersonLookBehind && this.input.isSelfieHeld();
  }

  private applySelectedCameraViewMode(mode: CameraViewMode): void {
    this.selectedCameraViewMode = mode;
    this.thirdPerson = isThirdPersonCameraView(mode);
  }

  private resetCameraViewModeToDefault(): void {
    this.applySelectedCameraViewMode(resolveCameraViewModeForRound(
      this.sessionMenu.getSettings().defaultCameraMode,
      null,
    ));
  }

  private toggleCameraView(): void {
    this.applySelectedCameraViewMode(toggleCameraViewMode(this.selectedCameraViewMode));
  }




  // ── Shared helpers ──────────────────────────────────────────────────────────

  private updateGunVisibility(isSelfie: boolean): void {
    const phase = this.round.getPhase();
    const playerAlive = this.player.phase !== "RESPAWNING";
    const roundActive = this.appMode === "online" ? this.onlineGameActive : phase !== "LOBBY";
    this.player.setWorldModelVisible(playerAlive && (this.thirdPerson || isSelfie));

    this.player.setThirdPersonGunVisible(
      roundActive && playerAlive && (this.thirdPerson || isSelfie),
    );
    this.gun.setVisible(roundActive && playerAlive && !this.thirdPerson && !isSelfie);

    // When the local player is frozen or their right arm is disabled,
    // tint the pistol with the enemy team's colour so the player sees
    // they were hit instead of guessing why shots no longer fire.
    const incapacitated = this.player.damage.frozen || this.player.damage.rightArm;
    const enemyColor = this.player.team === 0 ? 0xff00ff : 0x00ffff;
    const tint = incapacitated ? enemyColor : null;
    this.gun.setFrozenTint(tint);
    this.player.setThirdPersonGunFrozenTint(tint);
  }

  private syncLocalOnlineActor(snapshot: MultiplayerRoomSnapshot): void {
    const selfActor = snapshot.actors.find((actor) => actor.id === snapshot.sessionId);
    if (!selfActor) return;
    if (document.hidden) {
      this.player.applyAuthoritativeOnlineMotion(selfActor);
    }
    this.player.applyAuthoritativeOnlineState(selfActor);
  }

  private resyncLocalOnlineActorFromLatestSnapshot(): void {
    if (this.appMode !== "online" || !this.onlineGameActive) return;
    const snapshot = this.latestOnlineSnapshot;
    if (!snapshot) return;

    const selfActor = snapshot.actors.find((actor) => actor.id === snapshot.sessionId);
    if (!selfActor) return;

    this.player.applyAuthoritativeOnlineMotion(selfActor);
    this.player.applyAuthoritativeOnlineState(selfActor);
  }

  private syncBackgroundInputPolicy(): void {
    this.input.setBackgroundStateClearingEnabled(this.appMode !== "online");
  }

  private isGameplaySceneActive(): boolean {
    return !this.debrief.isVisible()
      && (
        this.appMode === "solo"
        || (this.appMode === "online" && this.onlineGameActive)
      );
  }

  private handleScoreboardTabHoldChange(held: boolean): void {
    const transition = getScoreboardCursorTransition(held, {
      desktop: !this.mobile,
      gameplayActive: this.isGameplaySceneActive(),
      pointerLocked: this.input.isLocked(),
      restorePointerLockAfterScoreboard: this.restorePointerLockAfterScoreboard,
      sessionMenuOpen: this.sessionMenu.isOpen(),
    });
    this.restorePointerLockAfterScoreboard = transition.nextRestorePointerLockAfterScoreboard;

    if (transition.showCursor) {
      this.cursor.show();
    }
    if (transition.hideCursor) {
      this.cursor.hide();
    }
    if (transition.exitPointerLock) {
      this.input.exitPointerLock();
    }
    if (transition.requestPointerLock) {
      this.input.lockPointer(this.sceneMgr.getRenderer().domElement);
    }
  }

  private syncCombatPresentation(gameplayActive: boolean): void {
    if (!gameplayActive) {
      if (this.combatPresentationActive) {
        this.projectiles.clear();
        clearVibeJamPortals();
        this.arena.setPortalDoorsOpen(false);
      }
      this.gun.setVisible(false);
      this.gun.setFrozenTint(null);
      this.player.setWorldModelVisible(false);
      this.player.setThirdPersonGunVisible(false);
      this.player.setThirdPersonGunFrozenTint(null);
    }

    this.combatPresentationActive = gameplayActive;
  }

  private syncDesktopOverlayCursor(gameplayActive: boolean): void {
    if (!gameplayActive) return;
    if (shouldShowDesktopOverlayCursor({
      gameplayActive,
      mobile: this.mobile,
      sessionMenuOpen: this.sessionMenu.isOpen(),
      tabHeld: this.input.isTabHeld(),
    })) {
      this.cursor.show();
    } else {
      this.cursor.hide();
    }
  }
}

let f11HintTimer: ReturnType<typeof setTimeout> | null = null;

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
