import { afterEach, describe, expect, it, vi } from "vitest";
import { OrbitalLobbyRoom } from "../server/src/colyseus/OrbitalLobbyRoom";
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
    addMember(room, "bot-0", { name: "CY-BOT-01", team: 0, isBot: true });
    addActor(room, "human-1", { name: "Alpha", team: 0 });
    addActor(room, "human-2", { name: "Bravo", team: 1 });
    addActor(room, "bot-0", { name: "CY-BOT-01", team: 0, isBot: true });

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
    addMember(room, "bot-0", { name: "CY-BOT-01", team: 0, isBot: true });
    addMember(room, "bot-1", { name: "MG-BOT-01", team: 1, isBot: true });
    addActor(room, "human-1", { name: "Alpha", team: 0 });
    addActor(room, "bot-0", { name: "CY-BOT-01", team: 0, isBot: true });
    addActor(room, "bot-1", { name: "MG-BOT-01", team: 1, isBot: true });

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
  it("reclaims a stale same-name human slot and actor before seating a rejoin", () => {
    const room = createRoom();
    room.state.phase = "LOBBY";

    addMember(room, "old-session", { name: "Alpha", team: 0 });
    addActor(room, "old-session", { name: "Alpha", team: 0 });

    room.onJoin({ sessionId: "new-session" } as never, { name: "Alpha" });

    expect(room.state.members.has("old-session")).toBe(false);
    expect(room.state.actors.has("old-session")).toBe(false);
    expect(room.state.members.has("new-session")).toBe(true);
    expect(room.state.members.get("new-session")?.team).toBe(0);
  });

  it("reclaims a bot seat when a human joins a bot-filled lobby", () => {
    const room = createRoom();
    room.state.phase = "LOBBY";

    addMember(room, "bot-0", { name: "CY-BOT-01", team: 0, isBot: true });
    addMember(room, "bot-1", { name: "MG-BOT-01", team: 1, isBot: true });

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

    addMember(room, "bot-0", { name: "CY-BOT-01", team: 0, isBot: true });
    addMember(room, "bot-1", { name: "MG-BOT-01", team: 1, isBot: true });
    addActor(room, "bot-0", { name: "CY-BOT-01", team: 0, isBot: true });
    addActor(room, "bot-1", { name: "MG-BOT-01", team: 1, isBot: true });

    room.onJoin({ sessionId: "human-1" } as never, { name: "Alpha" });

    expect(room.state.members.has("human-1")).toBe(true);
    expect(room.state.members.has("bot-0")).toBe(false);
    expect(room.state.actors.has("bot-0")).toBe(false);
    expect(room.state.actors.has("bot-1")).toBe(true);
  });
});
