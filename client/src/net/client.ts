import { Client as ColyseusClient, type Room } from "@colyseus/sdk";
import { DEFAULT_PLAYER_NAME } from "../../../shared/callSigns";
import { getColyseusEndpoint } from "./endpoint";
import { MAX_RECONNECT_ATTEMPTS, reconnectDelay, isAbnormalClose, isTransportError } from "./reconnect";
import { isMatchTeamSize, type MatchTeamSize } from "../../../shared/match";
import {
  getMaxPlayersForTeamSize,
  MULTIPLAYER_BROWSER_ROOM_NAME,
  MULTIPLAYER_DEFAULT_TEAM_SIZE,
  MULTIPLAYER_ROOM_NAME,
  type BreachReportMessage,
  type FillBotsMessage,
  type FreezeEventMessage,
  type HitReportMessage,
  type LobbyEventMessage,
  type LobbyMemberSnapshot,
  type LobbyTeam,
  type MultiplayerJoinOptions,
  type MultiplayerRoomSnapshot,
  type OnlineActorSnapshot,
  type PlayerLeaveEventMessage,
  type PlayerUpdateMessage,
  type RoundResultEventMessage,
  type SetReadyMessage,
  type SetTeamSizeMessage,
  type ShotEventMessage,
  type SwitchTeamMessage,
} from "../../../shared/multiplayer";

// Production reads VITE_COLYSEUS_ENDPOINT; dev defaults to same-origin so Vite
// proxies /matchmake HTTP and /ws WebSocket to the local game server.
// WebSocket endpoint is taken from the seat reservation's publicAddress field (set by the server).
const SERVER_URL = getColyseusEndpoint();

type ColyseusRoomState = {
  roomName: string;
  visibility: string;
  listing: string;
  phase: string;
  matchComplete: boolean;
  countdownRemaining: number;
  roundTimeRemaining: number;
  scoreTeam0: number;
  scoreTeam1: number;
  teamSize: number;
  maxPlayers: number;
  roundNumber: number;
  members: unknown;
  actors: unknown;
};

export type ConnectionStatus = "disconnected" | "connected" | "reconnecting" | "lost";

export class NetClient {
  private room: Room | null = null;
  private options: MultiplayerJoinOptions | null = null;
  private generation = 0;
  private attempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private status: ConnectionStatus = "disconnected";
  private inMatch = false;
  private attemptTimeout: ReturnType<typeof setTimeout> | null = null;

  public constructor(
    private readonly client: ColyseusClient | null = SERVER_URL ? new ColyseusClient(SERVER_URL) : null,
  ) {}

  public onStateChange: ((snapshot: MultiplayerRoomSnapshot) => void) | null = null;
  public onLobbyEvent: ((event: LobbyEventMessage) => void) | null = null;
  public onLeave: (() => void) | null = null;
  public onServerDisconnect: (() => void) | null = null;
  public onJoinError: ((error: unknown) => void) | null = null;
  public onConnectionStatus: ((status: ConnectionStatus) => void) | null = null;
  public onFreezeEvent: ((event: FreezeEventMessage) => void) | null = null;
  public onPlayerLeaveEvent: ((event: PlayerLeaveEventMessage) => void) | null = null;
  public onRoundResultEvent: ((event: RoundResultEventMessage) => void) | null = null;
  public onShotEvent: ((event: ShotEventMessage) => void) | null = null;

  public async connect(options: MultiplayerJoinOptions): Promise<MultiplayerRoomSnapshot | null> {
    const cleanup = this.disconnect(false);
    const generation = this.generation;
    await cleanup;
    if (generation !== this.generation) return null;
    this.options = options;
    return this.attemptConnect(generation);
  }

  private async attemptConnect(generation: number): Promise<MultiplayerRoomSnapshot | null> {
    try {
      if (!this.options) return null;
      if (!this.client) throw new Error("Online multiplayer endpoint not configured.");
      const room = await this.connectToTarget(this.options);
      // A late handshake must never resurrect a session the user has left.
      if (generation !== this.generation) {
        await this.leaveRoom(room, false);
        return null;
      }
      this.attachRoom(room);
      this.options = { name: this.options.name, target: { kind: "roomId", roomId: room.roomId } };
      const snapshot = buildSnapshot(room, room.state as ColyseusRoomState);
      this.inMatch = snapshot.phase !== "LOBBY";
      this.attempts = 0;
      this.setStatus("connected");
      return snapshot;
    } catch (error) {
      if (generation !== this.generation) return null;
      if (!isTransportError(error)) throw error;
      this.scheduleReconnect();
      return null;
    }
  }

  private attachRoom(room: Room): void {
    // The server does not reserve disconnected seats. Rejoin the same room
    // through matchmaking instead of running a second SDK retry loop.
    room.reconnection.enabled = false;
    this.room = room;
    room.onStateChange((state) => {
      if (this.room !== room) return;
      const snapshot = buildSnapshot(room, state as ColyseusRoomState);
      this.inMatch = snapshot.phase !== "LOBBY";
      this.onStateChange?.(snapshot);
    });
    room.onMessage("lobby_event", (event: LobbyEventMessage) => {
      if (this.room !== room) return;
      this.onLobbyEvent?.(event);
    });
    room.onMessage("freeze_event", (event: FreezeEventMessage) => {
      if (this.room !== room) return;
      this.onFreezeEvent?.(event);
    });
    room.onMessage("player_leave_event", (event: PlayerLeaveEventMessage) => {
      if (this.room !== room) return;
      this.onPlayerLeaveEvent?.(event);
    });
    room.onMessage("round_result_event", (event: RoundResultEventMessage) => {
      if (this.room !== room) return;
      this.onRoundResultEvent?.(event);
    });
    room.onMessage("shot_event", (event: ShotEventMessage) => {
      if (this.room !== room) return;
      this.onShotEvent?.(event);
    });
    room.onLeave((code) => {
      if (this.room !== room) return;
      if (isAbnormalClose(code)) this.scheduleReconnect();
      else this.serverDisconnect();
    });
    room.onError((code) => {
      if (this.room !== room) return;
      // Browser socket errors have no code; matchmaking/application errors do.
      if (code === undefined || isAbnormalClose(code)) this.scheduleReconnect();
      else this.serverDisconnect();
    });
  }

  public async disconnect(consented = true): Promise<void> {
    this.generation += 1;
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.attemptTimeout !== null) clearTimeout(this.attemptTimeout);
    this.attemptTimeout = null;
    this.options = null;
    this.attempts = 0;
    this.inMatch = false;
    const room = this.room;
    this.room = null;
    this.setStatus("disconnected");
    if (room) await this.leaveRoom(room, consented);
  }

  private async leaveRoom(room: Room, consented: boolean): Promise<void> {
    try {
      room.reconnection.enabled = false;
      await room.leave(consented);
    } catch {
      // A closed socket must not interrupt local cleanup or navigation.
    }
  }

  public retry(): void {
    if (this.status !== "lost" || !this.options) return;
    this.attempts = 0;
    this.scheduleReconnect();
  }

  private serverDisconnect(): void {
    void this.disconnect(false);
    this.onServerDisconnect?.();
  }

  private scheduleReconnect(): void {
    const room = this.room;
    this.room = null;
    if (room) void this.leaveRoom(room, false);
    if (!this.options || this.reconnectTimer !== null) return;
    if (this.attempts >= (this.inMatch ? 1 : MAX_RECONNECT_ATTEMPTS)) {
      this.setStatus("lost");
      this.onLeave?.();
      return;
    }
    const generation = this.generation;
    const delay = this.inMatch ? 1_000 : reconnectDelay(this.attempts);
    this.attempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      // Mid-match recovery gets one attempt and a five-second total deadline.
      if (this.inMatch) this.attemptTimeout = setTimeout(() => {
        this.attemptTimeout = null;
        this.generation += 1; // Discard and close any handshake completing later.
        this.setStatus("lost");
        this.onLeave?.();
      }, 4_000);
      void this.attemptConnect(generation).then((snapshot) => {
        if (snapshot && generation === this.generation) this.onStateChange?.(snapshot);
      }).catch((error: unknown) => {
        if (generation !== this.generation) return;
        void this.disconnect(false);
        this.onJoinError?.(error);
      }).finally(() => {
        if (generation !== this.generation) return;
        if (this.attemptTimeout !== null) clearTimeout(this.attemptTimeout);
        this.attemptTimeout = null;
      });
    }, delay);
    this.setStatus("reconnecting");
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.onConnectionStatus?.(status);
  }

  private async connectToTarget(options: MultiplayerJoinOptions): Promise<Room> {
    if (!this.client) {
      throw new Error("Online multiplayer endpoint not configured.");
    }

    const target = options.target ?? { kind: "quick" as const };
    switch (target.kind) {
      case "roomId":
        return this.client.joinById(target.roomId, {
          name: options.name,
        });
      case "create":
        return this.client.create(MULTIPLAYER_BROWSER_ROOM_NAME, {
          name: options.name,
          listing: target.listing,
          visibility: target.visibility,
          roomName: target.roomName,
          teamSize: target.teamSize,
        });
      case "quick":
      default:
        return this.client.joinOrCreate(MULTIPLAYER_ROOM_NAME, {
          name: options.name,
          listing: "quick",
        });
    }
  }

  public getSessionId(): string | null {
    return this.room?.sessionId ?? null;
  }

  public setReady(ready: boolean): void {
    this.send<SetReadyMessage>("ready", { ready });
  }

  public switchTeam(team: LobbyTeam): void {
    this.send<SwitchTeamMessage>("switch_team", { team });
  }

  public setTeamSize(teamSize: MatchTeamSize): void {
    this.send<SetTeamSizeMessage>("set_team_size", { teamSize });
  }

  public fillBots(fill: boolean): void {
    this.send<FillBotsMessage>("fill_bots", { fill });
  }

  public sendPlayerUpdate(message: PlayerUpdateMessage): void {
    this.send<PlayerUpdateMessage>("player_update", message);
  }

  public sendHitReport(message: HitReportMessage): void {
    this.send<HitReportMessage>("hit_report", message);
  }

  public sendShot(message: ShotEventMessage): void {
    this.send<ShotEventMessage>("shot_event", message);
  }

  public sendBreachReport(message: BreachReportMessage): void {
    this.send<BreachReportMessage>("breach_report", message);
  }

  private send<T>(type: string, message: T): void {
    try {
      this.room?.send(type, message);
    } catch (error) {
      if (isTransportError(error)) this.scheduleReconnect();
      else this.serverDisconnect();
    }
  }
}

function buildSnapshot(
  room: Room,
  state: ColyseusRoomState,
): MultiplayerRoomSnapshot {
  const members = getMembers(state.members);
  const actors = getActors(state.actors);
  const self = members.find((member) => member.id === room.sessionId);
  const teamSize = isMatchTeamSize(state.teamSize)
    ? state.teamSize
    : MULTIPLAYER_DEFAULT_TEAM_SIZE;

  return {
    roomId: room.roomId,
    roomName: String(state.roomName ?? "Orbital Lobby"),
    sessionId: room.sessionId,
    selfTeam: self?.team ?? 0,
    phase: toRoomPhase(state.phase),
    matchComplete: Boolean(state.matchComplete),
    visibility: state.visibility === "private" ? "private" : "public",
    listing: state.listing === "browser" ? "browser" : "quick",
    countdownRemaining: Number(state.countdownRemaining ?? 0),
    roundTimeRemaining: Number(state.roundTimeRemaining ?? 0),
    score: {
      team0: Number(state.scoreTeam0 ?? 0),
      team1: Number(state.scoreTeam1 ?? 0),
    },
    roundNumber: Number(state.roundNumber ?? 0),
    teamSize,
    maxPlayers: Number(state.maxPlayers ?? getMaxPlayersForTeamSize(teamSize)),
    members,
    actors,
  };
}

function getMembers(rawMembers: unknown): LobbyMemberSnapshot[] {
  const members: LobbyMemberSnapshot[] = [];
  const collection = rawMembers as {
    forEach?: (cb: (value: Record<string, unknown>) => void) => void;
  };

  if (typeof collection?.forEach === "function") {
    collection.forEach((value) => {
      members.push(toLobbyMember(value));
    });
    return members.sort(sortMembers);
  }

  if (rawMembers && typeof rawMembers === "object") {
    for (const value of Object.values(rawMembers as Record<string, Record<string, unknown>>)) {
      members.push(toLobbyMember(value));
    }
  }

  return members.sort(sortMembers);
}

function getActors(rawActors: unknown): OnlineActorSnapshot[] {
  const actors: OnlineActorSnapshot[] = [];
  const collection = rawActors as {
    forEach?: (cb: (value: Record<string, unknown>) => void) => void;
  };

  if (typeof collection?.forEach === "function") {
    collection.forEach((value) => {
      actors.push(toActorSnapshot(value));
    });
    return actors;
  }

  if (rawActors && typeof rawActors === "object") {
    for (const value of Object.values(rawActors as Record<string, Record<string, unknown>>)) {
      actors.push(toActorSnapshot(value));
    }
  }

  return actors;
}

function toLobbyMember(value: Record<string, unknown>): LobbyMemberSnapshot {
  return {
    id: String(value.id ?? ""),
    name: String(value.name ?? DEFAULT_PLAYER_NAME),
    team: value.team === 1 ? 1 : 0,
    ready: Boolean(value.ready),
    connected: Boolean(value.connected),
    isBot: Boolean(value.isBot),
  };
}

function toActorSnapshot(value: Record<string, unknown>): OnlineActorSnapshot {
  return {
    id: String(value.id ?? ""),
    name: String(value.name ?? DEFAULT_PLAYER_NAME),
    team: value.team === 1 ? 1 : 0,
    isBot: Boolean(value.isBot),
    posX: Number(value.posX ?? 0),
    posY: Number(value.posY ?? 0),
    posZ: Number(value.posZ ?? 0),
    velX: Number(value.velX ?? 0),
    velY: Number(value.velY ?? 0),
    velZ: Number(value.velZ ?? 0),
    yaw: Number(value.yaw ?? 0),
    phase: String(value.phase ?? "BREACH"),
    frozen: Boolean(value.frozen),
    leftArm: Boolean(value.leftArm),
    rightArm: Boolean(value.rightArm),
    leftLeg: Boolean(value.leftLeg),
    rightLeg: Boolean(value.rightLeg),
    kills: Number(value.kills ?? 0),
    deaths: Number(value.deaths ?? 0),
  };
}

function sortMembers(a: LobbyMemberSnapshot, b: LobbyMemberSnapshot): number {
  if (a.team !== b.team) {
    return a.team - b.team;
  }
  if (a.isBot !== b.isBot) {
    return a.isBot ? 1 : -1;
  }
  return a.name.localeCompare(b.name);
}

function toRoomPhase(phase: string): MultiplayerRoomSnapshot["phase"] {
  switch (phase) {
    case "COUNTDOWN":
    case "PLAYING":
    case "ROUND_END":
      return phase;
    default:
      return "LOBBY";
  }
}
