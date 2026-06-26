import type { Client as ColyseusClient, Room } from "@colyseus/sdk";
import { describe, expect, it, vi } from "vitest";

Object.defineProperty(globalThis, "location", {
  value: new URL("http://localhost"),
  configurable: true,
});

const { NetClient } = await import("../client/src/net/client");

function createState() {
  return {
    roomName: "Orbital Lobby",
    visibility: "public",
    listing: "quick",
    phase: "LOBBY",
    matchComplete: false,
    countdownRemaining: 0,
    roundTimeRemaining: 0,
    scoreTeam0: 0,
    scoreTeam1: 0,
    teamSize: 1,
    maxPlayers: 2,
    roundNumber: 1,
    members: {
      self: {
        id: "session-1",
        name: "Pilot",
        team: 0,
        ready: false,
        connected: true,
        isBot: false,
      },
    },
    actors: {},
  };
}

function createRoom(overrides?: Partial<Room>): Room {
  const room = {
    roomId: "room-1",
    sessionId: "session-1",
    state: createState(),
    onStateChange: vi.fn(),
    onMessage: vi.fn(),
    onLeave: vi.fn(),
    leave: vi.fn().mockResolvedValue(undefined),
    send: vi.fn(),
    ...overrides,
  };
  return room as Room;
}

function createClient(room: Room, overrides?: Partial<ColyseusClient>): ColyseusClient {
  const client = {
    joinOrCreate: vi.fn().mockResolvedValue(room),
    joinById: vi.fn().mockResolvedValue(room),
    create: vi.fn().mockResolvedValue(room),
    ...overrides,
  };
  return client as ColyseusClient;
}

describe("NetClient", () => {
  it("turns send failures into a reconnectable connection error instead of throwing through the caller", async () => {
    const room = createRoom({
      send: vi.fn(() => {
        throw new Error("socket gone");
      }),
    });
    const net = new NetClient(createClient(room));
    const onConnectionError = vi.fn();
    const onLeave = vi.fn();
    net.onConnectionError = onConnectionError;
    net.onLeave = onLeave;

    await net.connect({ name: "Pilot" });

    expect(() => net.setReady(true)).not.toThrow();
    expect(onConnectionError).toHaveBeenCalledTimes(1);
    expect(onConnectionError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect(onLeave).not.toHaveBeenCalled();
    expect(net.getSessionId()).toBe(null);
  });

  it("normalizes generic connect failures into a stable user-facing error", async () => {
    const room = createRoom();
    const net = new NetClient(createClient(room, {
      joinOrCreate: vi.fn().mockRejectedValue(new Error("Failed to fetch")),
    }));

    await expect(net.connect({ name: "Pilot" })).rejects.toThrow(
      "Could not reach the online room. Check that the server is running.",
    );
  });

  it("swallows disconnect failures after clearing the local room handle", async () => {
    const room = createRoom({
      leave: vi.fn().mockRejectedValue(new Error("WebSocket is not open")),
    });
    const net = new NetClient(createClient(room));

    await net.connect({ name: "Pilot" });

    await expect(net.disconnect()).resolves.toBeUndefined();
    expect(net.getSessionId()).toBe(null);
  });

  it("suppresses room leave callbacks during intentional disconnects", async () => {
    let leaveHandler: (() => void) | null = null;
    const room = createRoom({
      onLeave: vi.fn((cb: () => void) => {
        leaveHandler = cb;
      }),
      leave: vi.fn().mockImplementation(async () => {
        leaveHandler?.();
      }),
    });
    const net = new NetClient(createClient(room));
    const onLeave = vi.fn();
    net.onLeave = onLeave;

    await net.connect({ name: "Pilot" });
    await net.disconnect();

    expect(onLeave).not.toHaveBeenCalled();
    expect(net.getSessionId()).toBe(null);
  });
});
