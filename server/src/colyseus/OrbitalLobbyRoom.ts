import { Room, type Client } from "@colyseus/core";
import type {
  FillBotsMessage,
  HitReportMessage,
  MultiplayerRoomListing,
  MultiplayerRoomVisibility,
  PlayerUpdateMessage,
  SetReadyMessage,
  SetTeamSizeMessage,
  ShotEventMessage,
  SwitchTeamMessage,
} from "../../../shared/multiplayer";
import type { MatchTeamSize } from "../../../shared/match";
import { BotController, type BotCombatHooks } from "./botAI";
import { freezeActorFromShot } from "./orbitalLobbyRoomActors";
import {
  assertCanJoin,
  configureRoom,
  handleBreachReport,
  handleFillBotsMessage,
  handleHitReport,
  handlePlayerUpdate,
  handleReadyMessage,
  handleSetTeamSizeMessage,
  handleShotEvent,
  handleSwitchTeamMessage,
  onJoinRoom,
  onLeaveRoom,
} from "./orbitalLobbyRoomMessages";
import { awardOnlineRoundPoint, checkFullFreezeWin, clearTimers } from "./orbitalLobbyRoomRound";
import { ActorState, OrbitalLobbyState } from "./state";

type RoomClient = Client;

interface OrbitalLobbyCreateOptions {
  roomName?: string;
  listing?: MultiplayerRoomListing;
  visibility?: MultiplayerRoomVisibility;
  teamSize?: MatchTeamSize;
}

export class OrbitalLobbyRoom extends Room<{ state: OrbitalLobbyState }> {
  public maxClients = 32;
  public autoDispose = true;
  public patchRate = 50;

  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private roundTimer: ReturnType<typeof setInterval> | null = null;
  private roundEndTimer: ReturnType<typeof setTimeout> | null = null;
  private matchTick: ReturnType<typeof setInterval> | null = null;
  private botCounters: Record<0 | 1, number> = { 0: 0, 1: 0 };
  private botSpawnYaw: Record<0 | 1, number> = { 0: 0, 1: 0 };
  private bots = new BotController<ActorState>();
  private botGoalAxis: "x" | "z" = "x";
  private botGoalSigns: { team0: 1 | -1; team1: 1 | -1 } = { team0: 1, team1: -1 };
  private readonly botHooks: BotCombatHooks<ActorState> = {
    applyFreeze: (shooter, target) => {
      if (freezeActorFromShot(this, shooter, target, "body")) {
        this.checkFullFreezeWin();
      }
    },
    awardBreachPoint: (bot) => this.awardOnlineRoundPoint(bot.team, bot.id, bot.name, "breach"),
    broadcastShot: (event) => this.broadcast("shot_event", event),
    isRoundResolved: () => this.roundResolved,
  };
  private countdownPreparedRound = false;
  private roundResolved = false;
  private lastPlayerUpdate = new Map<string, number>();
  private listing: MultiplayerRoomListing = "quick";
  private visibility: MultiplayerRoomVisibility = "public";

  public onCreate(options?: OrbitalLobbyCreateOptions): void {
    this.state = new OrbitalLobbyState();
    configureRoom(this, options);

    this.onMessage("ready", (client, message: SetReadyMessage) => {
      handleReadyMessage(this, client, message);
    });
    this.onMessage("switch_team", (client, message: SwitchTeamMessage) => {
      handleSwitchTeamMessage(this, client, message);
    });
    this.onMessage("set_team_size", (client, message: SetTeamSizeMessage) => {
      handleSetTeamSizeMessage(this, client, message);
    });
    this.onMessage("fill_bots", (_client, message: FillBotsMessage) => {
      handleFillBotsMessage(this, message);
    });
    this.onMessage("player_update", (client, message: PlayerUpdateMessage) => {
      handlePlayerUpdate(this, client, message);
    });
    this.onMessage("shot_event", (client, message: ShotEventMessage) => {
      handleShotEvent(this, client, message);
    });
    this.onMessage("hit_report", (client, message: HitReportMessage) => {
      handleHitReport(this, client, message);
    });
    this.onMessage("breach_report", (client) => {
      handleBreachReport(this, client);
    });

    void this.unlock();
  }

  public onAuth(): true {
    return assertCanJoin(this);
  }

  public onJoin(client: RoomClient, options?: { name?: string }): void {
    onJoinRoom(this, client, options);
  }

  public onLeave(client: RoomClient): void {
    onLeaveRoom(this, client);
  }

  public onDispose(): void {
    clearTimers(this);
  }

  private checkFullFreezeWin(): void {
    checkFullFreezeWin(this);
  }

  private awardOnlineRoundPoint(
    team: 0 | 1,
    scorerId: string | null,
    scorerName: string,
    reason: "breach" | "fullFreeze" | "disconnect",
  ): void {
    awardOnlineRoundPoint(this, team, scorerId, scorerName, reason);
  }
}
