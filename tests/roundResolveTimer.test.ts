import { afterEach, describe, expect, it, vi } from "vitest";
import { OrbitalLobbyRoom } from "../server/src/colyseus/OrbitalLobbyRoom";
import { ActorState, LobbyMemberState, OrbitalLobbyState } from "../server/src/colyseus/state";

function createRoom(): OrbitalLobbyRoom {
  const room = new OrbitalLobbyRoom();
  room.state = new OrbitalLobbyState();
  room.state.phase = "PLAYING";
  room.broadcast = vi.fn() as typeof room.broadcast;
  room.setMetadata = vi.fn().mockResolvedValue(undefined) as typeof room.setMetadata;
  room.unlock = vi.fn().mockResolvedValue(undefined) as typeof room.unlock;
  return room;
}

function seat(room: OrbitalLobbyRoom, id: string, team: 0 | 1): void {
  const member = new LobbyMemberState();
  member.id = id;
  member.sessionId = id;
  member.name = id;
  member.team = team;
  member.connected = true;
  room.state.members.set(id, member);

  const actor = new ActorState();
  actor.id = id;
  actor.name = id;
  actor.team = team;
  room.state.actors.set(id, actor);
}

describe("round resolve timer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("still finishes the round three seconds after a point", () => {
    vi.useFakeTimers();
    const room = createRoom();
    seat(room, "cyan", 0);
    seat(room, "magenta", 1);

    room.onLeave({ sessionId: "cyan" } as never);
    expect(room.state.phase).toBe("PLAYING");

    vi.advanceTimersByTime(2999);
    expect(room.state.phase).toBe("PLAYING");
    vi.advanceTimersByTime(1);
    expect(room.state.phase).toBe("ROUND_END");
  });

  it("clears the three-second round-end timeout on dispose", () => {
    vi.useFakeTimers();
    const room = createRoom();
    seat(room, "cyan", 0);
    seat(room, "magenta", 1);

    room.onLeave({ sessionId: "cyan" } as never);
    room.onDispose();
    vi.advanceTimersByTime(10_000);

    expect(room.state.phase).toBe("PLAYING");
  });
});
