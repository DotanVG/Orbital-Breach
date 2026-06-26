import { DEFAULT_PLAYER_NAME } from "../../../shared/callSigns";
import { getInviteRoomIdFromSearch, type MultiplayerJoinTarget, type MultiplayerRoomSnapshot } from "../../../shared/multiplayer";
import type { App } from "./gameApp";
import type { PlaySelection } from "../ui/menu";
import { buildRoundEndHtml } from "../render/hud";
import { MobileControls } from "../ui/mobileControls";
import * as THREE from "three";
import {
  cleanEmbedUrl,
  disableOnlineProjectiles,
  getOnlineLocalActorId,
  setCelebratingTeam,
  toggleCameraView,
} from "./gameAppViewState";
import {
  createGameTickContext,
  resyncLocalOnlineActorFromLatestSnapshot,
  syncLocalOnlineActor,
} from "./gameAppRuntime";

// ponytail: boot helpers operate on the existing App state bag, upgrade when App is split into owned controllers
export function wireGameAppCallbacks(app: App): void {
  const state = app as any;

  state.match.onEvent = (event: any) => {
    switch (event.type) {
      case "hitConfirm":
        state.hud.triggerHitConfirm(event.team);
        break;
      case "freeze":
        state.killFeed.addKill(
          event.killerName,
          event.killerTeam,
          event.victimName,
          event.victimTeam,
        );
        break;
      case "score":
        state.matchStats.recordBreach(event.scorerId);
        state.killFeed.addScore(event.scorerName, event.scorerTeam);
        break;
      case "roundWin":
        app["onRoundWin"](event.winningTeam, event.reason);
        break;
      case "roundTie":
        app["onRoundTie"]();
        break;
      case "matchEnd":
        app["onMatchEnd"](event.winningTeam, event.finalScore);
        break;
    }
  };
  state.round.onBeginRound = () => app["beginNewRound"]();
  state.round.onCountdownEnd = () => state.arena.setPortalDoorsOpen(true);
  state.round.onRoundTimeout = () => state.match.handleRoundTimeout();
  state.sessionMenu.onLauncherRequest = () => app["openSessionMenu"]();
  state.sessionMenu.onResume = () => app["closeSessionMenu"]();
  state.sessionMenu.onMainMenu = () => {
    void app["handleSessionMenuMainMenu"]();
  };
  state.sessionMenu.onSettingsChange = (settings: any) => {
    const fullscreenPreferenceChanged = settings.fullscreenEnabled !== state.fullscreenPreference;
    app["applySessionSettings"](settings);
    if (fullscreenPreferenceChanged) {
      state.fullscreenPreference = settings.fullscreenEnabled;
      void app["applyFullscreenPreference"](settings.fullscreenEnabled);
    }
  };

  state.debrief.onMainMenu = () => {
    if (state.appMode === "online") {
      void app["forceLeaveOnline"]();
      return;
    }
    app["returnToMenuFromSolo"]();
  };
  state.debrief.onPlayAgain = () => {
    if (state.appMode === "online") {
      app["returnToOnlineLobbyFromDebrief"]();
      return;
    }
    if (state.lastSoloSelection) {
      app["startSoloMatch"](state.lastSoloSelection);
    } else {
      app["returnToMenuFromSolo"]();
    }
  };

  state.net.onStateChange = (snapshot: MultiplayerRoomSnapshot) => {
    if (state.isUserExitingOnline || state.appMode !== "online") return;
    state.latestOnlineSnapshot = snapshot;

    const prev = state.previousOnlinePhase;
    state.previousOnlinePhase = snapshot.phase;

    if (state.onlineMatchConcluding) {
      state.onlineRoundActive = false;
      if (state.onlineGameActive) {
        syncLocalOnlineActor(app, snapshot);
        state.arena.setPortalDoorsOpen(snapshot.phase === "PLAYING");
        state.onlineMatch.applySnapshot(snapshot.actors, snapshot.sessionId);
        state.matchStats.observePlayers(app["getOnlineMatchStatsActors"](snapshot), { accumulateTravel: false });
      }
      return;
    }

    if (!state.onlineGameActive || snapshot.phase === "LOBBY") {
      state.multiplayer.render(snapshot);
    }

    const shouldBeginOnlineRound =
      snapshot.phase === "COUNTDOWN"
      && prev !== "COUNTDOWN"
      && prev !== "PLAYING";

    if (shouldBeginOnlineRound) {
      app["beginOnlineRound"](snapshot);
      state.sound.playCountdown();
    }

    if (snapshot.phase === "LOBBY") {
      if (state.onlineGameActive || state.pendingOnlineDebrief) {
        app["endOnlineGame"]();
      }
      return;
    }

    if (state.onlineGameActive) {
      state.onlineRoundActive = snapshot.phase === "PLAYING";
      syncLocalOnlineActor(app, snapshot);
      state.arena.setPortalDoorsOpen(snapshot.phase === "PLAYING");
      state.onlineMatch.applySnapshot(snapshot.actors, snapshot.sessionId);
      state.matchStats.observePlayers(app["getOnlineMatchStatsActors"](snapshot), {
        accumulateTravel: snapshot.phase === "PLAYING",
      });
    }
  };

  state.net.onLobbyEvent = (event: any) => {
    if (state.isUserExitingOnline || state.appMode !== "online") return;
    state.multiplayer.setStatus(event.text, event.type);
  };

  state.net.onFreezeEvent = (event: any) => {
    if (state.isUserExitingOnline || state.appMode !== "online") return;
    state.killFeed.addKill(event.killerName, event.killerTeam, event.victimName, event.victimTeam);
  };

  state.net.onPlayerLeaveEvent = (event: any) => {
    if (state.isUserExitingOnline || state.appMode !== "online") return;
    state.killFeed.addLeave(event.playerName, event.playerTeam);
  };

  state.net.onRoundResultEvent = (event: any) => {
    if (state.isUserExitingOnline || state.appMode !== "online") return;
    if (!state.onlineGameActive) return;

    if (event.reason === "breach") {
      disableOnlineProjectiles(app);
    } else {
      state.onlineRoundActive = false;
    }
    state.projectiles.clear();
    state.onlineBreachReported = false;

    if (event.outcome === "tie") {
      state.hud.showRoundEnd(buildRoundEndHtml("tie"));
      return;
    }

    if (event.reason === "breach" && event.winningTeam !== null) {
      state.matchStats.recordBreach(event.scorerId);
      state.killFeed.addScore(event.scorerName, event.winningTeam);
    }

    if (event.matchWinner !== null && event.finalScore) {
      setCelebratingTeam(app, event.matchWinner);
      state.onlineMatchConcluding = true;
      state.pendingOnlineDebrief = app["buildOnlineDebrief"](event.matchWinner, event.finalScore);
      state.sessionMenu.close();
      state.hud.showRoundEnd(
        buildRoundEndHtml({
          team: event.matchWinner,
          matchScore: event.finalScore,
        }),
      );
      state.restorePointerLockAfterScoreboard = false;
      state.input.exitPointerLock();
      state.input.setUiBlocked(true);
      state.mobileControls?.hide();
      state.input.setMobileControlsActive(false);
      state.sessionMenu.setLauncherVisible(false);
      if (state.matchEndHandle) {
        clearTimeout(state.matchEndHandle);
      }
      state.matchEndHandle = setTimeout(() => {
        state.matchEndHandle = null;
        const debrief = state.pendingOnlineDebrief;
        state.pendingOnlineDebrief = null;
        if (!debrief || state.appMode !== "online") {
          return;
        }
        app["showMatchDebrief"](debrief);
      }, 4000);
      return;
    }

    if (event.winningTeam !== null) {
      state.hud.showRoundEnd(
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

  state.net.onShotEvent = (event: any) => {
    if (state.isUserExitingOnline || state.appMode !== "online") return;
    if (!state.onlineGameActive || !state.onlineRoundActive) return;
    if (event.ownerId === getOnlineLocalActorId(app)) return;

    state.projectiles.spawn(
      new THREE.Vector3(event.originX, event.originY, event.originZ),
      new THREE.Vector3(event.dirX, event.dirY, event.dirZ),
      event.team,
      event.ownerId,
    );
    state.onlineMatch.triggerRemoteShot(event.ownerId);
    state.sound.playRemoteShot(new THREE.Vector3(event.originX, event.originY, event.originZ));
  };

  state.net.onLeave = () => {
    if (state.isUserExitingOnline) return;
    if (state.appMode !== "online") return;
    void app["requestLeaveOnline"]("server_disconnect");
  };

  state.multiplayer.onLeaveLobby = () => {
    void app["requestLeaveOnline"]("user_exit");
  };
  state.multiplayer.onReadyChange = (ready: boolean) => {
    state.net.setReady(ready);
  };
  state.multiplayer.onSwitchTeam = (team: 0 | 1) => {
    state.net.switchTeam(team);
  };
  state.multiplayer.onFillBots = (fill: boolean) => {
    state.net.fillBots(fill);
  };
  state.multiplayer.onOpenSettings = () => {
    app["openSessionMenu"]();
  };
  state.multiplayer.onTeamSizeChange = (teamSize: number) => {
    state.net.setTeamSize(teamSize);
  };
  state.roomBrowser.onJoinRoom = (roomId: string) => {
    if (!state.pendingOnlineRoomSelection) return;
    const selection = state.pendingOnlineRoomSelection;
    state.menu.fadeOut(() => {
      void app["startOnlineLobby"](selection, { kind: "roomId", roomId });
    });
  };
  state.roomBrowser.onCreateRoom = (target: MultiplayerJoinTarget) => {
    if (!state.pendingOnlineRoomSelection) return;
    const selection = state.pendingOnlineRoomSelection;
    state.menu.fadeOut(() => {
      void app["startOnlineLobby"](selection, target);
    });
  };
  state.roomBrowser.onClose = () => {
    state.pendingOnlineRoomSelection = null;
  };

  if (state.mobile) {
    state.mobileControls = new MobileControls(state.input);
    state.mobileControls.mount();
    state.mobileControls.hide();
    state.mobileControls.onViewToggle = () => {
      toggleCameraView(app);
    };
  } else {
    state.sceneMgr.getRenderer().domElement.addEventListener("mousedown", () => {
      if (state.menu.isVisible() || state.input.isLocked() || state.sessionMenu.isOpen()) return;
      if (state.appMode === "solo" && state.round.getPhase() === "LOBBY") return;
      if (state.appMode === "online" && !state.onlineGameActive) return;
      state.input.lockPointer(state.sceneMgr.getRenderer().domElement);
    });
  }

  state.tickCtx = createGameTickContext(app);
}

export function startGameApp(app: App): void {
  const state = app as any;

  state.menu.onPlaySolo = (selection: PlaySelection) => {
    app["startSoloMatch"](selection);
  };
  state.menu.onPlayOnline = (selection: PlaySelection) => {
    void app["startOnlineLobby"](selection);
  };
  state.menu.onBrowseOnline = (selection: PlaySelection) => {
    state.pendingOnlineRoomSelection = selection;
    void state.roomBrowser.show({
      inviteRoomId: getInviteRoomIdFromSearch(window.location.search),
      defaultTeamSize: selection.teamSize,
    });
  };
  state.menu.onOpenInstructions = () => {
    app["openSessionMenu"]("instructions");
  };
  state.menu.onOpenSettings = () => {
    app["openSessionMenu"]();
  };
  state.menu.onOpenCredits = () => {
    app["openSessionMenu"]("credits");
  };
  state.menu.onPlayTutorial = (selection: PlaySelection) => {
    app["startTutorialMatch"](selection);
  };

  if (state.portalArrivalPending) {
    state.cursor.hide();
    app["startSoloMatch"]({
      name: state.portalParams.username?.trim() || DEFAULT_PLAYER_NAME,
      teamSize: 1,
      noBots: true,
    });
  } else if (state.embedMode) {
    cleanEmbedUrl();
    state.menu.show();
  } else {
    state.welcome.onBreach = () => { state.menu.show(); };
    state.welcome.fullscreenOnClick = state.fullscreenPreference;
    state.welcome.show();
  }

  const unlockAudio = (): void => {
    void state.sound.unlock().then(() => {
      state.sound.startMusic();
      document.removeEventListener("pointerdown", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
      document.removeEventListener("touchstart", unlockAudio);
    }).catch((err: unknown) => {
      console.warn("[GameApp] Audio unlock failed:", err);
    });
  };
  document.addEventListener("pointerdown", unlockAudio);
  document.addEventListener("keydown", unlockAudio);
  document.addEventListener("touchstart", unlockAudio, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      state.sound.tryResumeMusic();
      resyncLocalOnlineActorFromLatestSnapshot(app);
    }
  });
  window.addEventListener("pageshow", (e: PageTransitionEvent) => {
    if (e.persisted) state.sound.tryResumeMusic();
  });

  requestAnimationFrame((timestamp) => app["loop"](timestamp));
}
