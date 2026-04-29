import {
  canJoinMultiplayerRoom,
  getMaxPlayersForTeamSize,
  getRoomStatus,
  isMatchTeamSizeValue,
  MULTIPLAYER_BROWSER_ROOM_NAME,
  MULTIPLAYER_DEFAULT_TEAM_SIZE,
  type MultiplayerRoomDirectoryEntry,
  type MultiplayerRoomListing,
  type MultiplayerRoomPhase,
  type MultiplayerRoomVisibility,
} from "../../../shared/multiplayer";

type UnknownRecord = Record<string, unknown>;

export function buildPublicRoomDirectory(rooms: unknown[]): MultiplayerRoomDirectoryEntry[] {
  return rooms
    .map((room) => toDirectoryEntry(room))
    .filter((room): room is MultiplayerRoomDirectoryEntry => room !== null)
    .sort(compareDirectoryEntries);
}

function toDirectoryEntry(raw: unknown): MultiplayerRoomDirectoryEntry | null {
  const room = asRecord(raw);
  if (!room) {
    return null;
  }

  const metadata = asRecord(room.metadata);
  if (!metadata) {
    return null;
  }

  if (room.name !== MULTIPLAYER_BROWSER_ROOM_NAME) {
    return null;
  }

  const listing = metadata.listing;
  if (listing !== "browser") {
    return null;
  }

  const visibility = metadata.visibility === "private" ? "private" : "public";
  if (visibility !== "public") {
    return null;
  }

  const teamSize = getTeamSize(metadata.teamSize);
  const maxPlayers = getPositiveInt(metadata.maxPlayers) ?? getMaxPlayersForTeamSize(teamSize);
  const currentPlayers = getPositiveInt(metadata.currentPlayers) ?? getPositiveInt(room.clients) ?? 0;
  const phase = toPhase(metadata.phase);
  const locked = Boolean(room.locked);
  const joinable = canJoinMultiplayerRoom(phase) && !locked && currentPlayers < maxPlayers;

  return {
    roomId: String(room.roomId ?? ""),
    roomName: String(metadata.roomName ?? "Orbital Lobby"),
    phase,
    status: getRoomStatus(phase, currentPlayers, maxPlayers, locked),
    listing,
    visibility,
    currentPlayers,
    maxPlayers,
    teamSize,
    joinable,
  };
}

function getTeamSize(raw: unknown) {
  const value = Number(raw);
  return isMatchTeamSizeValue(value) ? value : MULTIPLAYER_DEFAULT_TEAM_SIZE;
}

function toPhase(raw: unknown): MultiplayerRoomPhase {
  switch (raw) {
    case "COUNTDOWN":
    case "PLAYING":
    case "ROUND_END":
      return raw;
    default:
      return "LOBBY";
  }
}

function getPositiveInt(raw: unknown): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.floor(value);
}

function asRecord(raw: unknown): UnknownRecord | null {
  return raw && typeof raw === "object" ? raw as UnknownRecord : null;
}

function compareDirectoryEntries(a: MultiplayerRoomDirectoryEntry, b: MultiplayerRoomDirectoryEntry): number {
  if (a.joinable !== b.joinable) {
    return a.joinable ? -1 : 1;
  }

  if (a.currentPlayers !== b.currentPlayers) {
    return b.currentPlayers - a.currentPlayers;
  }

  return a.roomName.localeCompare(b.roomName);
}

export interface OrbitalRoomMetadata {
  roomName: string;
  listing: MultiplayerRoomListing;
  visibility: MultiplayerRoomVisibility;
  phase: MultiplayerRoomPhase;
  currentPlayers: number;
  maxPlayers: number;
  teamSize: number;
}
