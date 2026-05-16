import { describe, expect, it } from "vitest";
import { BOT_CALL_SIGN_POOL, DEFAULT_PLAYER_NAME } from "../shared/callSigns";
import {
  buildBotName,
  canJoinMultiplayerRoom,
  canStartLobbyRound,
  getPreferredJoinTeam,
} from "../shared/multiplayer";
import { MATCH_TEAM_SIZES } from "../shared/match";

describe("getPreferredJoinTeam", () => {
  it("balances new humans onto the less populated side", () => {
    expect(getPreferredJoinTeam([])).toBe(0);
    expect(getPreferredJoinTeam([{ team: 0 }, { team: 1 }])).toBe(0);
    expect(getPreferredJoinTeam([{ team: 0 }, { team: 0 }, { team: 1 }])).toBe(1);
  });
});

describe("canStartLobbyRound", () => {
  it("requires all connected humans to be ready and both teams filled", () => {
    expect(canStartLobbyRound([
      { team: 0, ready: true, isBot: false, connected: true },
      { team: 1, ready: false, isBot: false, connected: true },
      { team: 0, ready: false, isBot: true, connected: true },
      { team: 1, ready: false, isBot: true, connected: true },
    ], 2)).toBe(false);

    expect(canStartLobbyRound([
      { team: 0, ready: true, isBot: false, connected: true },
      { team: 1, ready: true, isBot: false, connected: true },
      { team: 0, ready: false, isBot: true, connected: true },
      { team: 1, ready: false, isBot: true, connected: true },
    ], 2)).toBe(true);
  });
});

describe("buildBotName", () => {
  it("uses the approved space-themed call sign pool without numbers or reserved game terms", () => {
    expect(buildBotName(0, 0)).toBe("Pulsar");
    expect(buildBotName(2, 1)).toBe("Quasar");
    expect(BOT_CALL_SIGN_POOL.length).toBeGreaterThanOrEqual(39);
    expect(new Set(BOT_CALL_SIGN_POOL).size).toBe(BOT_CALL_SIGN_POOL.length);
    expect(BOT_CALL_SIGN_POOL.every((name) => !/\d/.test(name))).toBe(true);
    expect(BOT_CALL_SIGN_POOL.every((name) => !/(orbit|breacher)/i.test(name))).toBe(true);
    expect(DEFAULT_PLAYER_NAME).toBe("Nova");
  });
});

describe("canJoinMultiplayerRoom", () => {
  it("only allows fresh joins from the lobby", () => {
    expect(canJoinMultiplayerRoom("LOBBY")).toBe(true);
    expect(canJoinMultiplayerRoom("COUNTDOWN")).toBe(false);
    expect(canJoinMultiplayerRoom("PLAYING")).toBe(false);
    expect(canJoinMultiplayerRoom("ROUND_END")).toBe(false);
  });
});

describe("MATCH_TEAM_SIZES", () => {
  it("includes the 2v2 duos variant for online playlists", () => {
    expect(MATCH_TEAM_SIZES).toContain(2);
  });
});
