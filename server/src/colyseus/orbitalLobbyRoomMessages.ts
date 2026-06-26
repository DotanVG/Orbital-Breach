import type { Client } from "@colyseus/core";
import {
  canJoinMultiplayerRoom,
  getMaxPlayersForTeamSize,
  isMatchTeamSizeValue,
  MULTIPLAYER_DEFAULT_TEAM_SIZE,
  sanitizeRoomName,
  type FillBotsMessage,
  type HitReportMessage,
  type MultiplayerRoomListing,
  type MultiplayerRoomVisibility,
  type PlayerUpdateMessage,
  type SetReadyMessage,
  type SetTeamSizeMessage,
  type ShotEventMessage,
  type SwitchTeamMessage,
} from "../../../shared/multiplayer";
import type { MatchTeamSize } from "../../../shared/match";
import {
  clearActors,
  handleBreachReportMessage,
  handleHitReportMessage,
  handlePlayerUpdateMessage,
  handleShotEventMessage,
  removePresence,
} from "./orbitalLobbyRoomActors";
import {
  ensureSeatForHuman,
  fillBotsToLobbySize,
  getHumanMembers,
  getJoinTeamForHuman,
  hasHumanMembers,
  refreshRoomMetadata,
  removeAllBots,
  resetLobbyReadiness,
  resetScore,
  sendError,
  sendInfo,
  trimBotsToTeamSize,
} from "./orbitalLobbyRoomState";
import { cancelRoundFlow, checkTeamDisconnectWin, syncLobbyFlow } from "./orbitalLobbyRoomRound";
import { LobbyMemberState } from "./state";
import { sanitizePlayerName } from "./orbitalLobbyRoomUtils";

type RoomClient = Client;
type MessageRoomBag = any;

interface OrbitalLobbyCreateOptions {
  roomName?: string;
  listing?: MultiplayerRoomListing;
  visibility?: MultiplayerRoomVisibility;
  teamSize?: MatchTeamSize;
}

// ponytail: helper modules operate on the existing Room instance bag, upgrade when OrbitalLobbyRoom is replaced by owned services
export function configureRoom(room: unknown, options?: OrbitalLobbyCreateOptions): void {
  const internal = room as MessageRoomBag;
  internal.listing = options?.listing === "browser" ? "browser" : "quick";
  internal.visibility = options?.visibility === "private" ? "private" : "public";
  internal.state.roomName = sanitizeRoomName(options?.roomName);
  internal.state.listing = internal.listing;
  internal.state.visibility = internal.visibility;
  internal.state.teamSize = isMatchTeamSizeValue(Number(options?.teamSize))
    ? Number(options?.teamSize)
    : MULTIPLAYER_DEFAULT_TEAM_SIZE;
  internal.state.maxPlayers = getMaxPlayersForTeamSize(internal.state.teamSize as MatchTeamSize);
  internal.maxClients = internal.state.maxPlayers;
  void internal.setPrivate(internal.visibility === "private");
  void refreshRoomMetadata(internal);
}

export function assertCanJoin(room: unknown): true {
  const internal = room as MessageRoomBag;
  if (!canJoinMultiplayerRoom(internal.state.phase)) {
    throw new Error("A match is already in progress. Wait for the lobby before joining.");
  }

  return true;
}

export function onJoinRoom(
  room: unknown,
  client: RoomClient,
  options?: { name?: string },
): void {
  const internal = room as MessageRoomBag;
  const playerName = sanitizePlayerName(options?.name);
  const joinTeam = getJoinTeamForHuman(internal);
  if (joinTeam === null) {
    throw new Error("That room is full right now.");
  }
  ensureSeatForHuman(internal, joinTeam);

  const member = new LobbyMemberState();
  member.id = client.sessionId;
  member.sessionId = client.sessionId;
  member.name = playerName;
  member.team = joinTeam;
  member.ready = false;
  member.connected = true;
  member.isBot = false;

  internal.state.members.set(client.sessionId, member);
  internal.broadcast("lobby_event", {
    type: "info",
    text: `${member.name} joined the room.`,
  });
  syncLobbyFlow(internal);
}

export function onLeaveRoom(room: unknown, client: RoomClient): void {
  const internal = room as MessageRoomBag;
  const member = internal.state.members.get(client.sessionId);
  if (member) {
    const leavingName = member.name;
    const leavingTeam = member.team;
    internal.state.members.delete(client.sessionId);
    internal.broadcast("lobby_event", {
      type: "info",
      text: `${leavingName} left the room.`,
    });
    internal.broadcast("player_leave_event", {
      playerId: client.sessionId,
      playerName: leavingName,
      playerTeam: leavingTeam,
    });
  }

  removePresence(internal, client.sessionId);

  if (!hasHumanMembers(internal)) {
    removeAllBots(internal);
    resetScore(internal);
    internal.state.matchComplete = false;
    cancelRoundFlow(internal);
    resetLobbyReadiness(internal);
    internal.state.phase = "LOBBY";
    internal.state.countdownRemaining = 0;
    internal.state.roundTimeRemaining = 0;
    clearActors(internal);
  } else {
    checkTeamDisconnectWin(internal);
  }

  syncLobbyFlow(internal);
}

export function handleReadyMessage(
  room: unknown,
  client: RoomClient,
  message: SetReadyMessage,
): void {
  const internal = room as MessageRoomBag;
  if (internal.state.phase !== "LOBBY" && internal.state.phase !== "COUNTDOWN") {
    sendInfo(client, "Ready state can only change from the lobby.");
    return;
  }

  const member = internal.state.members.get(client.sessionId);
  if (!member || member.isBot) {
    return;
  }

  member.ready = Boolean(message.ready);
  syncLobbyFlow(internal);
}

export function handleSwitchTeamMessage(
  room: unknown,
  client: RoomClient,
  message: SwitchTeamMessage,
): void {
  const internal = room as MessageRoomBag;
  if (internal.state.phase !== "LOBBY") {
    sendInfo(client, "Switch teams before the countdown starts.");
    return;
  }

  if (message.team !== 0 && message.team !== 1) {
    sendError(client, "Team must be Cyan or Magenta.");
    return;
  }

  const member = internal.state.members.get(client.sessionId);
  if (!member || member.isBot) {
    return;
  }

  if (member.team === message.team) {
    return;
  }

  if (!ensureSeatForHuman(internal, message.team)) {
    sendError(client, "That team is full right now.");
    return;
  }

  member.team = message.team;
  syncLobbyFlow(internal);
}

export function handleSetTeamSizeMessage(
  room: unknown,
  client: RoomClient,
  message: SetTeamSizeMessage,
): void {
  const internal = room as MessageRoomBag;
  if (internal.state.phase !== "LOBBY") {
    sendInfo(client, "Change the lobby size before the round starts.");
    return;
  }

  const nextTeamSize = Number(message.teamSize);
  if (!isMatchTeamSizeValue(nextTeamSize)) {
    sendError(client, "Unsupported team size.");
    return;
  }

  const humans = getHumanMembers(internal);
  const team0Humans = humans.filter((member) => member.team === 0).length;
  const team1Humans = humans.filter((member) => member.team === 1).length;
  if (team0Humans > nextTeamSize || team1Humans > nextTeamSize) {
    sendError(client, "Move players first before shrinking the lobby.");
    return;
  }

  internal.state.teamSize = nextTeamSize;
  internal.state.maxPlayers = getMaxPlayersForTeamSize(nextTeamSize);
  internal.maxClients = internal.state.maxPlayers;
  trimBotsToTeamSize(internal);
  syncLobbyFlow(internal);
}

export function handleFillBotsMessage(room: unknown, message: FillBotsMessage): void {
  const internal = room as MessageRoomBag;
  if (internal.state.phase !== "LOBBY") {
    return;
  }

  if (message.fill) {
    fillBotsToLobbySize(internal);
  } else {
    removeAllBots(internal);
  }

  syncLobbyFlow(internal);
}

export function handlePlayerUpdate(room: unknown, client: RoomClient, message: PlayerUpdateMessage): void {
  handlePlayerUpdateMessage(room, client, message);
}

export function handleShotEvent(room: unknown, client: RoomClient, message: ShotEventMessage): void {
  handleShotEventMessage(room, client, message);
}

export function handleHitReport(room: unknown, client: RoomClient, message: HitReportMessage): void {
  handleHitReportMessage(room, client, message);
}

export function handleBreachReport(room: unknown, client: RoomClient): void {
  handleBreachReportMessage(room, client);
}
