import { afterEach, describe, expect, it, vi } from "vitest";
import { FIRE_RATE } from "../shared/constants";
import type { ShotEventMessage } from "../shared/multiplayer";
import {
  LOBBY_ACTION_LIMIT_PER_SECOND,
  SHOT_EVENT_LIMIT_PER_SECOND,
} from "../server/src/colyseus/messageRateLimit";
import { OrbitalLobbyRoom } from "../server/src/colyseus/OrbitalLobbyRoom";
import { ActorState, LobbyMemberState, OrbitalLobbyState } from "../server/src/colyseus/state";

const rooms: OrbitalLobbyRoom[] = [];

type Handlers = {
  handleShotEventMessage: (client: { sessionId: string }, message: ShotEventMessage) => void;
  handleReadyMessage: (client: { sessionId: string }, message: { ready: boolean }) => void;
  handleSwitchTeamMessage: (client: { sessionId: string }, message: { team: 0 | 1 }) => void;
  handleSetTeamSizeMessage: (client: { sessionId: string }, message: { teamSize: number }) => void;
  handleFillBotsMessage: (client: { sessionId: string }, message: { fill: boolean }) => void;
};

function createRoom(): OrbitalLobbyRoom {
  const room = new OrbitalLobbyRoom();
  room.state = new OrbitalLobbyState();
  room.broadcast = vi.fn() as typeof room.broadcast;
  room.setMetadata = vi.fn().mockResolvedValue(undefined) as typeof room.setMetadata;
  room.lock = vi.fn().mockResolvedValue(undefined) as typeof room.lock;
  room.unlock = vi.fn().mockResolvedValue(undefined) as typeof room.unlock;
  rooms.push(room);
  return room;
}

function handlers(room: OrbitalLobbyRoom): Handlers {
  return room as unknown as Handlers;
}

function addMember(room: OrbitalLobbyRoom, id: string, team: 0 | 1): void {
  const member = new LobbyMemberState();
  member.id = id;
  member.sessionId = id;
  member.name = id;
  member.team = team;
  member.ready = false;
  member.connected = true;
  room.state.members.set(id, member);
}

function addActor(room: OrbitalLobbyRoom, id: string): void {
  const actor = new ActorState();
  actor.id = id;
  actor.name = id;
  actor.phase = "FLOATING";
  room.state.actors.set(id, actor);
}

const shot = (ownerId: string): ShotEventMessage => ({
  ownerId,
  team: 0,
  originX: 0,
  originY: 0,
  originZ: 0,
  dirX: 0,
  dirY: 0,
  dirZ: 1,
});

describe("lobby and shot message throttles", () => {
  afterEach(() => {
    for (const room of rooms) room.onDispose();
    rooms.length = 0;
    vi.useRealTimers();
  });

  it("keeps the shot cap above the fire rate", () => {
    expect(SHOT_EVENT_LIMIT_PER_SECOND).toBeGreaterThan(FIRE_RATE);
    expect(LOBBY_ACTION_LIMIT_PER_SECOND).toBeGreaterThan(2);
  });

  it("broadcasts shots up to the per-client cap and then drops them", () => {
    const room = createRoom();
    room.state.phase = "PLAYING";
    addActor(room, "a");
    addActor(room, "b");
    const api = handlers(room);

    for (let i = 0; i < SHOT_EVENT_LIMIT_PER_SECOND; i += 1) {
      api.handleShotEventMessage({ sessionId: "a" }, shot("a"));
    }
    api.handleShotEventMessage({ sessionId: "a" }, shot("a"));
    api.handleShotEventMessage({ sessionId: "b" }, shot("b"));

    const broadcasts = vi.mocked(room.broadcast).mock.calls.filter((call) => call[0] === "shot_event");
    expect(broadcasts).toHaveLength(SHOT_EVENT_LIMIT_PER_SECOND + 1);
    expect(broadcasts[0]?.[1]).toMatchObject({ ownerId: "a", dirZ: 1 });
  });

  it("allows another shot broadcast after the one-second window", () => {
    vi.useFakeTimers();
    const room = createRoom();
    room.state.phase = "PLAYING";
    addActor(room, "a");
    const api = handlers(room);

    for (let i = 0; i < SHOT_EVENT_LIMIT_PER_SECOND; i += 1) {
      api.handleShotEventMessage({ sessionId: "a" }, shot("a"));
    }
    vi.advanceTimersByTime(1000);
    api.handleShotEventMessage({ sessionId: "a" }, shot("a"));

    const broadcasts = vi.mocked(room.broadcast).mock.calls.filter((call) => call[0] === "shot_event");
    expect(broadcasts).toHaveLength(SHOT_EVENT_LIMIT_PER_SECOND + 1);
  });

  it("drops ready, team switch, team size, and bot fill past the per-client cap", () => {
    const room = createRoom();
    room.state.phase = "LOBBY";
    room.state.teamSize = 2;
    addMember(room, "human", 0);
    const api = handlers(room);
    const client = { sessionId: "human" };

    for (let i = 0; i < LOBBY_ACTION_LIMIT_PER_SECOND; i += 1) {
      api.handleReadyMessage(client, { ready: true });
    }
    api.handleReadyMessage(client, { ready: false });
    expect(room.state.members.get("human")?.ready).toBe(true);

    for (let i = 0; i < LOBBY_ACTION_LIMIT_PER_SECOND; i += 1) {
      api.handleSwitchTeamMessage(client, { team: i % 2 === 0 ? 1 : 0 });
    }
    const teamAfterCap = room.state.members.get("human")?.team;
    api.handleSwitchTeamMessage(client, { team: teamAfterCap === 0 ? 1 : 0 });
    expect(room.state.members.get("human")?.team).toBe(teamAfterCap);

    for (let i = 0; i < LOBBY_ACTION_LIMIT_PER_SECOND; i += 1) {
      api.handleSetTeamSizeMessage(client, { teamSize: 5 });
    }
    api.handleSetTeamSizeMessage(client, { teamSize: 1 });
    expect(room.state.teamSize).toBe(5);

    for (let i = 0; i < LOBBY_ACTION_LIMIT_PER_SECOND; i += 1) {
      api.handleFillBotsMessage(client, { fill: true });
    }
    const withBots = room.state.members.size;
    expect(withBots).toBeGreaterThan(1);
    api.handleFillBotsMessage(client, { fill: false });
    expect(room.state.members.size).toBe(withBots);
  });
});
