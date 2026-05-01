import { getColyseusEndpoint } from "./endpoint";
import type { MultiplayerRoomDirectoryEntry } from "../../../shared/multiplayer";

interface RoomDirectoryResponse {
  ok?: boolean;
  rooms?: MultiplayerRoomDirectoryEntry[];
}

export async function fetchPublicRoomDirectory(): Promise<MultiplayerRoomDirectoryEntry[]> {
  const url = getRoomDirectoryUrl();
  if (!url) {
    throw new Error("Online room directory is unavailable because the multiplayer endpoint is not configured.");
  }

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Room directory request failed with ${response.status}.`);
  }

  const data = await response.json() as RoomDirectoryResponse;
  if (!Array.isArray(data.rooms)) {
    throw new Error("Room directory response was malformed.");
  }
  return data.rooms;
}

function getRoomDirectoryUrl(): string | null {
  const endpoint = getColyseusEndpoint();
  if (!endpoint) {
    return null;
  }

  const httpBase = endpoint.replace(/^ws(s?):\/\//i, (_match, secure) => `http${secure}://`);
  return `${httpBase}/rooms`;
}
