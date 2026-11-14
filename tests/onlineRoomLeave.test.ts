import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PLAYER_NAME } from "../shared/callSigns";
import { buildBotName, MULTIPLAYER_COUNTDOWN_SECONDS } from "../shared/multiplayer";
import { RECONNECTION_GRACE_SECONDS, OrbitalLobbyRoom } from "../server/src/colyseus/OrbitalLobbyRoom";
import { ActorState, LobbyMemberState, OrbitalLobbyState } from "../server/src/colyseus/state";

function createRoom(): OrbitalLobbyRoom {
  const room = new OrbitalLobbyRoom();
  room.state = new OrbitalLobbyState();
  room.state.teamSize = 1;
  room.state.maxPlayers = 2;
  room.broadcast = vi.fn() as typeof room.broadcast;
  room.setMetadata = vi.fn().mockResolvedValue(undefined) as typeof room.setMetadata;
  return room;
}

function addMember(
  room: OrbitalLobbyRoom,
  id: string,
  options: { name: string; team: 0 | 1; isBot?: boolean; ready?: boolean },
): void {
  const member = new LobbyMemberState();
  member.id = id;
  member.sessionId = options.isBot ? "" : id;
  member.name = options.name;
  member.team = options.team;
  member.ready = options.ready ?? true;
  member.connected = true;
  member.isBot = options.isBot ?? false;
  room.state.members.set(id, member);
}

function addActor(
  room: OrbitalLobbyRoom,
  id: string,
  options: { name: string; team: 0 | 1; isBot?: boolean; phase?: string },
): void {
  const actor = new ActorState();
  actor.id = id;
  actor.name = options.name;
  actor.team = options.team;
  actor.isBot = options.isBot ?? false;
  actor.phase = options.phase ?? "FLOATING";
  room.state.actors.set(id, actor);
}

describe("OrbitalLobbyRoom onLeave", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("removes the departing human from roster and live actors without touching bots", () => {
    const room = createRoom();
    room.state.phase = "PLAYING";

    addMember(room, "human-1", { name: "Alpha", team: 0 });
    addMember(room, "human-2", { name: "Bravo", team: 1 });
    addMember(room, "bot-0", { name: buildBotName(0, 0), team: 0, isBot: true });
    addActor(room, "human-1", { name: "Alpha", team: 0 });
    addActor(room, "human-2", { name: "Bravo", team: 1 });
    addActor(room, "bot-0", { name: buildBotName(0, 0), team: 0, isBot: true });

    room.onLeave({ sessionId: "human-1" } as never);

    expect(room.state.members.has("human-1")).toBe(false);
    expect(room.state.actors.has("human-1")).toBe(false);
    expect(room.state.members.has("human-2")).toBe(true);
    expect(room.state.actors.has("human-2")).toBe(true);
    expect(room.state.members.has("bot-0")).toBe(true);
    expect(room.state.actors.has("bot-0")).toBe(true);
    expect(room.state.phase).toBe("PLAYING");
    expect(room.broadcast).toHaveBeenCalledWith("player_leave_event", {
      playerId: "human-1",
      playerName: "Alpha",
      playerTeam: 0,
    });
  });

  it("awards a technical round win when one team fully disconnects during play", () => {
    vi.useFakeTimers();
    const room = createRoom();
    room.state.phase = "PLAYING";

    addMember(room, "human-1", { name: "Alpha", team: 0 });
    addMember(room, "human-2", { name: "Bravo", team: 1 });
    addActor(room, "human-1", { name: "Alpha", team: 0 });
    addActor(room, "human-2", { name: "Bravo", team: 1 });

    room.onLeave({ sessionId: "human-1" } as never);

    expect(room.state.scoreTeam1).toBe(1);
    expect(room.broadcast).toHaveBeenCalledWith("round_result_event", expect.objectContaining({
      outcome: "win",
      winningTeam: 1,
      reason: "disconnect",
      scorerName: "Magenta Team",
    }));
  });

  it("clears bots, actors, and round state when the room loses its last human", () => {
    const room = createRoom();
    room.state.phase = "PLAYING";
    room.state.matchComplete = true;
    room.state.scoreTeam0 = 3;
    room.state.scoreTeam1 = 2;
    room.state.roundNumber = 4;
    room.state.countdownRemaining = 2;
    room.state.roundTimeRemaining = 18;

    addMember(room, "human-1", { name: "Alpha", team: 0 });
    addMember(room, "bot-0", { name: buildBotName(0, 0), team: 0, isBot: true });
    addMember(room, "bot-1", { name: buildBotName(1, 1), team: 1, isBot: true });
    addActor(room, "human-1", { name: "Alpha", team: 0 });
    addActor(room, "bot-0", { name: buildBotName(0, 0), team: 0, isBot: true });
    addActor(room, "bot-1", { name: buildBotName(1, 1), team: 1, isBot: true });

    room.onLeave({ sessionId: "human-1" } as never);

    expect(Array.from(room.state.members.keys())).toEqual([]);
    expect(Array.from(room.state.actors.keys())).toEqual([]);
    expect(room.state.phase).toBe("LOBBY");
    expect(room.state.matchComplete).toBe(false);
    expect(room.state.scoreTeam0).toBe(0);
    expect(room.state.scoreTeam1).toBe(0);
    expect(room.state.roundNumber).toBe(0);
    expect(room.state.countdownRemaining).toBe(0);
    expect(room.state.roundTimeRemaining).toBe(0);
  });
});

describe("OrbitalLobbyRoom onJoin", () => {
  it("allows two human players with the same name to join together", () => {
    const room = createRoom();
    room.state.phase = "LOBBY";
    room.state.teamSize = 2;
    room.state.maxPlayers = 4;

    addMember(room, "first-session", { name: "Alpha", team: 0 });
    addActor(room, "first-session", { name: "Alpha", team: 0 });

    room.onJoin({ sessionId: "second-session" } as never, { name: "Alpha" });

    expect(room.state.members.has("first-session")).toBe(true);
    expect(room.state.actors.has("first-session")).toBe(true);
    expect(room.state.members.has("second-session")).toBe(true);
    expect(room.state.members.get("second-session")?.team).toBe(1);
  });

  it("reclaims a bot seat when a human joins a bot-filled lobby", () => {
    const room = createRoom();
    room.state.phase = "LOBBY";

    addMember(room, "bot-0", { name: buildBotName(0, 0), team: 0, isBot: true });
    addMember(room, "bot-1", { name: buildBotName(1, 1), team: 1, isBot: true });

    room.onJoin({ sessionId: "human-1" } as never, { name: "Alpha" });

    const members = Array.from(room.state.members.values());
    expect(members).toHaveLength(2);
    expect(room.state.members.has("human-1")).toBe(true);
    expect(members.filter((member) => member.isBot)).toHaveLength(1);
    expect(room.setMetadata).toHaveBeenLastCalledWith(expect.objectContaining({
      currentPlayers: 2,
      maxPlayers: 2,
    }));
  });

  it("removes a reclaimed bot actor when seating a human during countdown", () => {
    const room = createRoom();
    room.state.phase = "COUNTDOWN";

    addMember(room, "bot-0", { name: buildBotName(0, 0), team: 0, isBot: true });
    addMember(room, "bot-1", { name: buildBotName(1, 1), team: 1, isBot: true });
    addActor(room, "bot-0", { name: buildBotName(0, 0), team: 0, isBot: true });
    addActor(room, "bot-1", { name: buildBotName(1, 1), team: 1, isBot: true });

    room.onJoin({ sessionId: "human-1" } as never, { name: "Alpha" });

    expect(room.state.members.has("human-1")).toBe(true);
    expect(room.state.members.has("bot-0")).toBe(false);
    expect(room.state.actors.has("bot-0")).toBe(false);
    expect(room.state.actors.has("bot-1")).toBe(true);
  });

  it("falls back to the default call sign when the requested name is blank", () => {
    const room = createRoom();
    room.state.phase = "LOBBY";

    room.onJoin({ sessionId: "human-1" } as never, { name: "   " });

    expect(room.state.members.get("human-1")?.name).toBe(DEFAULT_PLAYER_NAME);
  });

  it("falls back to the default call sign for profanity hidden behind unicode separators", () => {
    const room = createRoom();
    room.state.phase = "LOBBY";

    room.onJoin({ sessionId: "human-1" } as never, { name: "n\u200Bi\u200Bgger" });

    expect(room.state.members.get("human-1")?.name).toBe(DEFAULT_PLAYER_NAME);
  });

  it("preserves ASCII payload-like names for downstream HTML escaping", () => {
    const room = createRoom();
    room.state.phase = "LOBBY";
    const payload = "<svg onload=a()>";

    expect(payload.length).toBe(16);
    room.onJoin({ sessionId: "human-1" } as never, { name: payload });

    expect(room.state.members.get("human-1")?.name).toBe(payload);
  });
});

describe("OrbitalLobbyRoom fill_bots", () => {
  it("ignores fill_bots messages once the round is already playing", () => {
    const room = createRoom();
    room.state.phase = "PLAYING";
    room.state.teamSize = 2;
    room.state.maxPlayers = 4;

    addMember(room, "human-1", { name: "Alpha", team: 0 });
    addMember(room, "human-2", { name: "Bravo", team: 1 });
    addMember(room, "bot-0", { name: buildBotName(0, 0), team: 0, isBot: true });

    const handleFillBotsMessage = (room as unknown as {
      handleFillBotsMessage(client: { sessionId: string }, message: { fill: boolean }): void;
    }).handleFillBotsMessage.bind(room);

    handleFillBotsMessage({ sessionId: "human-1" }, { fill: false });
    handleFillBotsMessage({ sessionId: "human-1" }, { fill: true });

    expect(Array.from(room.state.members.keys())).toEqual(["human-1", "human-2", "bot-0"]);
    expect(room.setMetadata).not.toHaveBeenCalled();
  });
});

describe("DOT-137 reconnect reservation", () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it.each(["LOBBY", "COUNTDOWN"])("requires the reserved ready player to reconnect before starting from %s", phase => {
    vi.useFakeTimers();
    const room = createRoom();
    addMember(room, "pilot", { name: "Alpha", team: 0 });
    addMember(room, "peer", { name: "Bravo", team: 1 });
    vi.spyOn(room, "allowReconnection").mockReturnValue(undefined as never);
    vi.spyOn(room, "lock").mockResolvedValue(undefined);
    vi.spyOn(room, "unlock").mockResolvedValue(undefined);
    try {
      if (phase === "COUNTDOWN") {
        room.onReconnect({ sessionId: "peer" } as never);
        expect(room.state.phase).toBe("COUNTDOWN");
        vi.advanceTimersByTime(1000);
      }

      room.onDrop({ sessionId: "pilot" } as never, 1006);
      expect(room.state.phase).toBe("LOBBY");
      expect(room.state.countdownRemaining).toBe(0);
      expect(room.state.roundNumber).toBe(0);
      expect(room.state.actors.size).toBe(0);
      expect(room.state.members.get("pilot")).toMatchObject({ connected: false, ready: true, team: 0 });
      expect(() => room.onJoin({ sessionId: "newcomer" } as never, { name: "Charlie" })).toThrow("full");

      // Another lobby update must not restart the countdown using the reserved seat.
      room.onReconnect({ sessionId: "peer" } as never);
      vi.advanceTimersByTime(MULTIPLAYER_COUNTDOWN_SECONDS * 1000);
      expect(room.state.phase).toBe("LOBBY");

      room.onReconnect({ sessionId: "pilot" } as never);
      expect(room.state.members.get("pilot")).toMatchObject({ connected: true, ready: true, team: 0 });
      expect(room.state.phase).toBe("COUNTDOWN");
      expect(room.state.countdownRemaining).toBe(MULTIPLAYER_COUNTDOWN_SECONDS);
      vi.advanceTimersByTime(MULTIPLAYER_COUNTDOWN_SECONDS * 1000);
      expect(room.state.phase).toBe("PLAYING");
    } finally {
      room.onDispose();
    }
  });

  it("keeps the same member, team, actor and score through drop and reconnect", () => {
    const room = createRoom();
    room.state.phase = "PLAYING";
    room.state.scoreTeam0 = 2;
    addMember(room, "pilot", { name: "Alpha", team: 0 });
    addMember(room, "peer", { name: "Bravo", team: 1 });
    addActor(room, "pilot", { name: "Alpha", team: 0 });
    const actor = room.state.actors.get("pilot")!;
    actor.kills = 3;
    actor.posX = 42;
    const reserve = vi.spyOn(room, "allowReconnection").mockReturnValue(undefined as never);
    room.onDrop({ sessionId: "pilot" } as never, 1006);
    expect(reserve).toHaveBeenCalledWith({ sessionId: "pilot" }, RECONNECTION_GRACE_SECONDS);
    expect(room.state.members.get("pilot")?.connected).toBe(false);
    expect(room.state.actors.get("pilot")).toBe(actor);
    expect(room.broadcast).not.toHaveBeenCalled();
    room.onReconnect({ sessionId: "pilot" } as never);
    expect(room.state.members.get("pilot")).toMatchObject({ connected: true, team: 0 });
    expect(room.state.actors.get("pilot")).toMatchObject({ posX: 42, kills: 3 });
    expect(room.state.scoreTeam0).toBe(2);
  });

  it.each([4000, 4002, 4003, 4403])("does not reserve a rejected or intentional departure (%s)", code => {
    const room = createRoom();
    addMember(room, "pilot", { name: "Alpha", team: 0 });
    const reserve = vi.spyOn(room, "allowReconnection");
    room.onDrop({ sessionId: "pilot" } as never, code);
    expect(reserve).not.toHaveBeenCalled();
  });
});
