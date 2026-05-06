import { MATCH_TEAM_SIZES, type MatchTeamSize } from "./match";
import type { HitZone } from "./player-logic";

export const MULTIPLAYER_ROOM_NAME = "orbital_lobby";
export const MULTIPLAYER_BROWSER_ROOM_NAME = "orbital_browser_lobby";
export const MULTIPLAYER_COUNTDOWN_SECONDS = 5;
export const MULTIPLAYER_ROUND_SECONDS = 120;
export const MULTIPLAYER_ROUND_END_SECONDS = 4;
export const MULTIPLAYER_DEFAULT_TEAM_SIZE: MatchTeamSize = 5;
export const MULTIPLAYER_INVITE_PARAM = "roomId";
export const MULTIPLAYER_ROOM_NAME_MAX_LENGTH = 24;

export type MultiplayerRoomPhase = "LOBBY" | "COUNTDOWN" | "PLAYING" | "ROUND_END";
export type LobbyTeam = 0 | 1;
export type MultiplayerRoomListing = "quick" | "browser";
export type MultiplayerRoomVisibility = "public" | "private";
export type MultiplayerRoomStatus = "Lobby Open" | "Full" | "Countdown" | "Live" | "Round End";

export interface MultiplayerCreateRoomTarget {
  kind: "create";
  roomName: string;
  listing: MultiplayerRoomListing;
  visibility: MultiplayerRoomVisibility;
  teamSize: MatchTeamSize;
}

export type MultiplayerJoinTarget =
  | { kind: "quick" }
  | { kind: "roomId"; roomId: string }
  | MultiplayerCreateRoomTarget;

export interface MultiplayerJoinOptions {
  name: string;
  target?: MultiplayerJoinTarget;
}

export interface LobbyMemberSnapshot {
  id: string;
  name: string;
  team: LobbyTeam;
  ready: boolean;
  connected: boolean;
  isBot: boolean;
}

export interface OnlineActorSnapshot {
  id: string;
  name: string;
  team: 0 | 1;
  isBot: boolean;
  posX: number;
  posY: number;
  posZ: number;
  velX: number;
  velY: number;
  velZ: number;
  yaw: number;
  phase: string;
  frozen: boolean;
  leftArm: boolean;
  rightArm: boolean;
  leftLeg: boolean;
  rightLeg: boolean;
  kills: number;
  deaths: number;
}

export interface MultiplayerRoomSnapshot {
  roomId: string;
  roomName: string;
  sessionId: string;
  selfTeam: LobbyTeam;
  phase: MultiplayerRoomPhase;
  matchComplete: boolean;
  visibility: MultiplayerRoomVisibility;
  listing: MultiplayerRoomListing;
  countdownRemaining: number;
  roundTimeRemaining: number;
  score: {
    team0: number;
    team1: number;
  };
  roundNumber: number;
  teamSize: MatchTeamSize;
  maxPlayers: number;
  members: LobbyMemberSnapshot[];
  actors: OnlineActorSnapshot[];
}

export interface MultiplayerRoomDirectoryEntry {
  roomId: string;
  roomName: string;
  phase: MultiplayerRoomPhase;
  status: MultiplayerRoomStatus;
  listing: MultiplayerRoomListing;
  visibility: MultiplayerRoomVisibility;
  currentPlayers: number;
  maxPlayers: number;
  teamSize: MatchTeamSize;
  joinable: boolean;
}

export interface PlayerUpdateMessage {
  posX: number;
  posY: number;
  posZ: number;
  velX: number;
  velY: number;
  velZ: number;
  yaw: number;
  phase: string;
  frozen: boolean;
  leftArm: boolean;
  rightArm: boolean;
  leftLeg: boolean;
  rightLeg: boolean;
  kills: number;
  deaths: number;
}

export interface HitReportMessage {
  targetId: string;
  zone: HitZone;
  impX: number;
  impY: number;
  impZ: number;
}

export interface ShotEventMessage {
  ownerId: string;
  team: 0 | 1;
  originX: number;
  originY: number;
  originZ: number;
  dirX: number;
  dirY: number;
  dirZ: number;
}

export interface BreachReportMessage {
  scorerTeam: 0 | 1;
  scorerName: string;
}

export interface FreezeEventMessage {
  targetId: string;
  killerName: string;
  killerTeam: 0 | 1;
  victimName: string;
  victimTeam: 0 | 1;
}

export interface PlayerLeaveEventMessage {
  playerId: string;
  playerName: string;
  playerTeam: 0 | 1;
}

export interface RoundResultEventMessage {
  outcome: "tie" | "win";
  winningTeam: 0 | 1 | null;
  matchWinner: 0 | 1 | null;
  reason: "breach" | "fullFreeze" | "disconnect" | "timeout";
  scorerId?: string;
  scorerName: string;
  finalScore?: {
    team0: number;
    team1: number;
  };
}

export interface SetReadyMessage {
  ready: boolean;
}

export interface SwitchTeamMessage {
  team: LobbyTeam;
}

export interface SetTeamSizeMessage {
  teamSize: MatchTeamSize;
}

export interface FillBotsMessage {
  fill: boolean;
}

export interface LobbyEventMessage {
  type: "error" | "info";
  text: string;
}

export function isMatchTeamSizeValue(value: number): value is MatchTeamSize {
  return MATCH_TEAM_SIZES.includes(value as MatchTeamSize);
}

export function getLobbyMemberCounts(members: Pick<LobbyMemberSnapshot, "team" | "isBot">[]): {
  team0: number;
  team1: number;
  humans: number;
} {
  let team0 = 0;
  let team1 = 0;
  let humans = 0;

  for (const member of members) {
    if (member.team === 0) {
      team0 += 1;
    } else {
      team1 += 1;
    }

    if (!member.isBot) {
      humans += 1;
    }
  }

  return { team0, team1, humans };
}

export function getPreferredJoinTeam(
  members: Pick<LobbyMemberSnapshot, "team">[],
): LobbyTeam {
  let team0 = 0;
  let team1 = 0;
  for (const member of members) {
    if (member.team === 0) {
      team0 += 1;
    } else {
      team1 += 1;
    }
  }
  return team0 <= team1 ? 0 : 1;
}

export function canStartLobbyRound(
  members: Pick<LobbyMemberSnapshot, "team" | "ready" | "isBot" | "connected">[],
  teamSize: MatchTeamSize,
): boolean {
  const humans = members.filter((member) => !member.isBot && member.connected);
  if (humans.length === 0) {
    return false;
  }

  if (humans.some((member) => !member.ready)) {
    return false;
  }

  const counts = getLobbyMemberCounts(members);
  return counts.team0 === teamSize && counts.team1 === teamSize;
}

export function clampLobbyBotFill(memberCount: number, teamSize: MatchTeamSize): number {
  return Math.max(0, Math.min(teamSize, teamSize - memberCount));
}

export function buildBotName(botIndex: number, team: LobbyTeam): string {
  const prefix = team === 0 ? "CY" : "MG";
  return `${prefix}-BOT-${String(botIndex + 1).padStart(2, "0")}`;
}

export function canJoinMultiplayerRoom(phase: MultiplayerRoomPhase): boolean {
  return phase === "LOBBY";
}

export function getMaxPlayersForTeamSize(teamSize: MatchTeamSize): number {
  return teamSize * 2;
}

export function getTeamSizeForMaxPlayers(maxPlayers: number): MatchTeamSize | null {
  if (maxPlayers % 2 !== 0) {
    return null;
  }

  const teamSize = maxPlayers / 2;
  return isMatchTeamSizeValue(teamSize) ? teamSize : null;
}

export function getRoomStatus(
  phase: MultiplayerRoomPhase,
  currentPlayers: number,
  maxPlayers: number,
  locked = false,
): MultiplayerRoomStatus {
  switch (phase) {
    case "COUNTDOWN":
      return "Countdown";
    case "PLAYING":
      return "Live";
    case "ROUND_END":
      return "Round End";
    case "LOBBY":
    default:
      return locked || currentPlayers >= maxPlayers ? "Full" : "Lobby Open";
  }
}

export function sanitizeRoomName(raw: string | null | undefined): string {
  const value = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MULTIPLAYER_ROOM_NAME_MAX_LENGTH);

  return value || "Orbital Lobby";
}

export function getInviteRoomIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const roomId = params.get(MULTIPLAYER_INVITE_PARAM)?.trim();
  return roomId ? roomId : null;
}

export function buildInviteUrl(roomId: string, origin: string, pathname = "/"): string {
  const url = new URL(pathname, origin);
  url.searchParams.set(MULTIPLAYER_INVITE_PARAM, roomId);
  return url.toString();
}
