import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_RECONNECT_ATTEMPTS, reconnectDelay } from "../client/src/net/reconnect";

vi.mock("../client/src/net/endpoint", () => ({ getColyseusEndpoint: () => null }));
const { NetClient } = await import("../client/src/net/client");
type Client = NonNullable<ConstructorParameters<typeof NetClient>[0]>;
type Room = Awaited<ReturnType<Client["joinById"]>>;

function makeRoom(id = "room-1", sessionId = "pilot-1") {
  const callbacks = {
    leave: () => {},
    error: () => {},
    state: (_state: unknown) => {},
    messages: new Map<string, (event: unknown) => void>(),
  };
  const room = {
    roomId: id, sessionId,
    state: { phase: "LOBBY", members: {}, actors: {}, scoreTeam0: 2 },
    reconnection: { enabled: true },
    onLeave: vi.fn((cb: () => void) => { callbacks.leave = cb; }),
    onError: vi.fn((cb: () => void) => { callbacks.error = cb; }),
    onStateChange: vi.fn((cb: (state: unknown) => void) => { callbacks.state = cb; }),
    onMessage: vi.fn((type: string, cb: (event: unknown) => void) => { callbacks.messages.set(type, cb); }),
    leave: vi.fn(async () => { callbacks.leave(); }),
    send: vi.fn(),
  };
  return { room, callbacks, handle: room as unknown as Room };
}

function makeClient(room: Room) {
  const client = {
    joinOrCreate: vi.fn().mockResolvedValue(room),
    joinById: vi.fn().mockResolvedValue(room),
    create: vi.fn().mockResolvedValue(room),
  };
  return { client, handle: client as unknown as Client };
}

describe("reconnectDelay", () => {
  it("doubles from one second and caps every delay at 30 seconds", () => {
    expect(Array.from({ length: 8 }, (_, i) => reconnectDelay(i, 0.5)))
      .toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });

  it("jitters each attempt within 20 percent without exceeding the cap", () => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const base = 1000 * 2 ** Math.min(attempt, 5);
      expect(reconnectDelay(attempt, 0)).toBe(Math.min(30000, base * 0.8));
      expect(reconnectDelay(attempt, 1)).toBe(Math.min(30000, base * 1.2));
    }
  });
});

describe("NetClient reconnect lifecycle (fake transport)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("catches rejected joins, stops after eight retries, and permits manual retry", async () => {
    const { handle: room } = makeRoom();
    const { client, handle } = makeClient(room);
    client.joinOrCreate.mockRejectedValue(new TypeError("Failed to fetch"));
    const net = new NetClient(handle);
    const statuses = vi.fn();
    net.onConnectionStatus = statuses;
    await expect(net.connect({ name: "Pilot" })).resolves.toBeNull();
    await vi.runAllTimersAsync();
    expect(client.joinOrCreate).toHaveBeenCalledTimes(1 + MAX_RECONNECT_ATTEMPTS);
    expect(statuses).toHaveBeenLastCalledWith("lost");
    expect(vi.getTimerCount()).toBe(0);
    client.joinOrCreate.mockResolvedValue(room);
    net.retry(); net.retry();
    await vi.advanceTimersByTimeAsync(999);
    expect(client.joinOrCreate).toHaveBeenCalledTimes(9);
    await vi.advanceTimersByTimeAsync(1);
    expect(client.joinOrCreate).toHaveBeenCalledTimes(10);
    expect(statuses).toHaveBeenLastCalledWith("connected");
    await net.disconnect();
  });

  it("catches synchronous join errors and missing endpoint configuration", async () => {
    const { handle: room } = makeRoom();
    const { client, handle } = makeClient(room);
    client.joinOrCreate.mockImplementation(() => { throw new Error("offline"); });
    const net = new NetClient(handle);
    await expect(net.connect({ name: "Pilot" })).resolves.toBeNull();
    await net.disconnect();
    const missing = new NetClient(null);
    const status = vi.fn(); missing.onConnectionStatus = status;
    await expect(missing.connect({ name: "Pilot" })).resolves.toBeNull();
    expect(status).toHaveBeenLastCalledWith("lost");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("catches send and leave failures, rejoins the same room, and resets the backoff", async () => {
    const first = makeRoom();
    const second = makeRoom("room-1", "pilot-2");
    const { client, handle } = makeClient(first.handle);
    client.joinById.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(second.handle);
    const net = new NetClient(handle);
    const snapshots = vi.fn(); net.onStateChange = snapshots;
    await net.connect({ name: "Pilot", target: { kind: "create", roomName: "Test", listing: "browser", visibility: "private", teamSize: 1 } });
    first.room.send.mockImplementation(() => { throw new Error("closed socket"); });
    first.room.leave.mockRejectedValue(new Error("closed socket"));
    expect(() => net.setReady(true)).not.toThrow();
    expect(net.getSessionId()).toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    expect(client.joinById).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(client.joinById).toHaveBeenLastCalledWith("room-1", { name: "Pilot" });
    expect(client.create).toHaveBeenCalledTimes(1);
    expect(snapshots).toHaveBeenLastCalledWith(expect.objectContaining({ sessionId: "pilot-2", score: { team0: 2, team1: 0 } }));
    first.callbacks.leave(); first.callbacks.error(); first.callbacks.state(first.room.state);
    first.callbacks.messages.get("lobby_event")?.({ text: "stale" });
    expect(net.getSessionId()).toBe("pilot-2");
    second.callbacks.leave();
    await vi.advanceTimersByTimeAsync(999);
    expect(client.joinById).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(client.joinById).toHaveBeenCalledTimes(3);
    await expect(net.disconnect()).resolves.toBeUndefined();
  });

  it("cancels scheduled retries and ignores delayed intentional leave events", async () => {
    const first = makeRoom();
    const { client, handle } = makeClient(first.handle);
    const net = new NetClient(handle);
    await net.connect({ name: "Pilot" });
    first.callbacks.error();
    await net.disconnect();
    first.callbacks.leave();
    await vi.runAllTimersAsync();
    expect(client.joinById).not.toHaveBeenCalled();
    expect(net.getSessionId()).toBeNull();
  });

  it.each(["synchronous", "rejected"])("catches %s disconnect failures without scheduling reconnect", async kind => {
    const first = makeRoom();
    const { handle } = makeClient(first.handle);
    const net = new NetClient(handle);
    const onLeave = vi.fn(); net.onLeave = onLeave;
    await net.connect({ name: "Pilot" });
    if (kind === "synchronous") first.room.leave.mockImplementation(() => { throw new Error("closed"); });
    else first.room.leave.mockRejectedValue(new Error("closed"));
    await expect(net.disconnect()).resolves.toBeUndefined();
    first.callbacks.leave(); first.callbacks.error();
    expect(net.getSessionId()).toBeNull();
    expect(onLeave).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("closes a late handshake after the user exits", async () => {
    const first = makeRoom();
    const { client, handle } = makeClient(first.handle);
    let finish!: (room: Room) => void;
    client.joinOrCreate.mockReturnValue(new Promise<Room>(resolve => { finish = resolve; }));
    const net = new NetClient(handle);
    const pending = net.connect({ name: "Pilot" });
    await Promise.resolve();
    await net.disconnect();
    finish(first.handle);
    await expect(pending).resolves.toBeNull();
    expect(first.room.leave).toHaveBeenCalledWith(false);
    expect(net.getSessionId()).toBeNull();
  });

  it("does not let an older pending connect replace a newer selection", async () => {
    const first = makeRoom();
    const { client, handle } = makeClient(first.handle);
    const net = new NetClient(handle);
    const older = net.connect({ name: "Old" });
    const newer = net.connect({ name: "New" });
    await expect(older).resolves.toBeNull();
    await expect(newer).resolves.toMatchObject({ roomId: "room-1" });
    expect(client.joinOrCreate).toHaveBeenCalledTimes(1);
    expect(client.joinOrCreate).toHaveBeenCalledWith("orbital_lobby", expect.objectContaining({ name: "New" }));
    await net.disconnect();
  });
});
