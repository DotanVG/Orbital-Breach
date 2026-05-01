import { describe, expect, it } from "vitest";
import { buildPublicRoomDirectory } from "../server/src/colyseus/roomDirectory";
import {
  buildInviteUrl,
  getInviteRoomIdFromSearch,
  getMaxPlayersForTeamSize,
  getRoomStatus,
  getTeamSizeForMaxPlayers,
  MULTIPLAYER_BROWSER_ROOM_NAME,
} from "../shared/multiplayer";

describe("buildPublicRoomDirectory", () => {
  it("includes only public browser rooms and preserves joinable lobby rooms", () => {
    const rooms = buildPublicRoomDirectory([
      {
        roomId: "browser-open",
        name: MULTIPLAYER_BROWSER_ROOM_NAME,
        locked: false,
        clients: 3,
        metadata: {
          listing: "browser",
          visibility: "public",
          roomName: "Dock Ring",
          phase: "LOBBY",
          currentPlayers: 3,
          maxPlayers: 10,
          teamSize: 5,
        },
      },
      {
        roomId: "browser-live",
        name: MULTIPLAYER_BROWSER_ROOM_NAME,
        locked: true,
        clients: 10,
        metadata: {
          listing: "browser",
          visibility: "public",
          roomName: "Hot Zone",
          phase: "PLAYING",
          currentPlayers: 10,
          maxPlayers: 10,
          teamSize: 5,
        },
      },
      {
        roomId: "private-room",
        name: MULTIPLAYER_BROWSER_ROOM_NAME,
        locked: false,
        clients: 1,
        metadata: {
          listing: "browser",
          visibility: "private",
          roomName: "Quiet Hangar",
          phase: "LOBBY",
          currentPlayers: 1,
          maxPlayers: 4,
          teamSize: 2,
        },
      },
      {
        roomId: "quick-room",
        name: "orbital_lobby",
        locked: false,
        clients: 2,
        metadata: {
          listing: "quick",
          visibility: "public",
          roomName: "Quick Match",
          phase: "LOBBY",
          currentPlayers: 2,
          maxPlayers: 10,
          teamSize: 5,
        },
      },
    ]);

    expect(rooms).toHaveLength(2);
    expect(rooms[0]).toMatchObject({
      roomId: "browser-open",
      roomName: "Dock Ring",
      joinable: true,
      status: "Lobby Open",
    });
    expect(rooms[1]).toMatchObject({
      roomId: "browser-live",
      roomName: "Hot Zone",
      joinable: false,
      status: "Live",
    });
  });
});

describe("multiplayer invite and cap helpers", () => {
  it("maps team sizes to total caps and back", () => {
    expect(getMaxPlayersForTeamSize(5)).toBe(10);
    expect(getTeamSizeForMaxPlayers(10)).toBe(5);
    expect(getTeamSizeForMaxPlayers(7)).toBeNull();
  });

  it("builds and parses direct invite URLs", () => {
    const url = buildInviteUrl("abc123", "https://orbital-breach.vercel.app", "/");
    expect(url).toBe("https://orbital-breach.vercel.app/?roomId=abc123");
    expect(getInviteRoomIdFromSearch("?roomId=abc123")).toBe("abc123");
    expect(getInviteRoomIdFromSearch("")).toBeNull();
  });

  it("derives room status from phase and availability", () => {
    expect(getRoomStatus("LOBBY", 2, 10, false)).toBe("Lobby Open");
    expect(getRoomStatus("LOBBY", 10, 10, true)).toBe("Full");
    expect(getRoomStatus("COUNTDOWN", 10, 10, true)).toBe("Countdown");
    expect(getRoomStatus("PLAYING", 10, 10, true)).toBe("Live");
    expect(getRoomStatus("ROUND_END", 10, 10, true)).toBe("Round End");
  });
});
