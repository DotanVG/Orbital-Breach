import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode, MatchMakeError, ServerError } from "@colyseus/sdk";
import { MAX_RECONNECT_ATTEMPTS, reconnectDelay } from "../client/src/net/reconnect";

vi.mock("../client/src/net/endpoint", () => ({ getColyseusEndpoint: () => null }));
const { NetClient } = await import("../client/src/net/client");
type Client = NonNullable<ConstructorParameters<typeof NetClient>[0]>;
type Room = Awaited<ReturnType<Client["joinById"]>>;

function makeRoom(id = "room-1", sessionId = "pilot-1") {
  const callbacks = {
    leave: (_code = 1006) => {},
    error: (_code?: number, _message?: string) => {},
    state: (_state: unknown) => {},
    messages: new Map<string, (event: unknown) => void>(),
  };
  const room = {
    roomId: id, sessionId,
    state: { phase: "LOBBY", members: {}, actors: {}, scoreTeam0: 2 },
    reconnection: { enabled: true },
    onLeave: vi.fn((cb: (code?: number) => void) => { callbacks.leave = cb; }),
    onError: vi.fn((cb: (code?: number, message?: string) => void) => { callbacks.error = cb; }),
    onStateChange: vi.fn((cb: (state: unknown) => void) => { callbacks.state = cb; }),
    onMessage: vi.fn((type: string, cb: (event: unknown) => void) => { callbacks.messages.set(type, cb); }),
    leave: vi.fn(async () => { callbacks.leave(1006); }),
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

  it.each([502, 503, 504])('retries matchmaking HTTP %s and recovers the same invite room', async code => {
    const first = makeRoom();
    const { client, handle } = makeClient(first.handle);
    client.joinById.mockRejectedValueOnce(new MatchMakeError('Gateway unavailable', code));
    const net = new NetClient(handle);
    const status = vi.fn(); net.onConnectionStatus = status;
    await expect(net.connect({ name: 'Pilot', target: { kind: 'roomId', roomId: 'room-1' } })).resolves.toBeNull();
    expect(status).toHaveBeenLastCalledWith('reconnecting');
    await vi.advanceTimersByTimeAsync(1000);
    expect(client.joinById).toHaveBeenNthCalledWith(2, 'room-1', { name: 'Pilot' });
    expect(net.getSessionId()).toBe('pilot-1');
    expect(status).toHaveBeenLastCalledWith('connected');
    await net.disconnect();
  });

  it.each([502, 503, 504])('bounds repeated SDK HTTP %s failures to the existing retry budget', async code => {
    const first = makeRoom();
    const { client, handle } = makeClient(first.handle);
    client.joinOrCreate.mockRejectedValue(new ServerError(code, 'Gateway unavailable'));
    const net = new NetClient(handle);
    const status = vi.fn(); net.onConnectionStatus = status;
    await expect(net.connect({ name: 'Pilot' })).resolves.toBeNull();
    await vi.runAllTimersAsync();
    expect(client.joinOrCreate).toHaveBeenCalledTimes(1 + MAX_RECONNECT_ATTEMPTS);
    expect(status).toHaveBeenLastCalledWith('lost');
    expect(vi.getTimerCount()).toBe(0);
    await net.disconnect();
  });

  it.each([ErrorCode.INVALID_PAYLOAD, 9999])('keeps a joined room usable after nonfatal onError %s', async code => {
    const first = makeRoom();
    const { client, handle } = makeClient(first.handle);
    const net = new NetClient(handle);
    const ended = vi.fn(); net.onServerDisconnect = ended;
    const state = vi.fn(); net.onStateChange = state;
    await net.connect({ name: 'Pilot' });
    first.callbacks.error(code, 'Message rejected');
    await vi.runAllTimersAsync();
    expect(net.getSessionId()).toBe('pilot-1');
    expect(first.room.leave).not.toHaveBeenCalled();
    expect(client.joinById).not.toHaveBeenCalled();
    expect(ended).not.toHaveBeenCalled();
    net.setReady(true);
    expect(first.room.send).toHaveBeenCalledWith('ready', { ready: true });
    first.callbacks.state(first.room.state);
    expect(state).toHaveBeenCalledTimes(1);
    first.callbacks.leave(4000);
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it.each([ErrorCode.AUTH_FAILED, ErrorCode.MATCHMAKE_INVALID_ROOM_ID, ErrorCode.APPLICATION_ERROR])(
    'disconnects on known fatal room error %s', async code => {
      const first = makeRoom();
      const { client, handle } = makeClient(first.handle);
      const net = new NetClient(handle);
      const ended = vi.fn(); net.onServerDisconnect = ended;
      await net.connect({ name: 'Pilot' });
      first.callbacks.error(code, 'Session rejected');
      await vi.runAllTimersAsync();
      expect(net.getSessionId()).toBeNull();
      expect(ended).toHaveBeenCalledTimes(1);
      expect(client.joinById).not.toHaveBeenCalled();
    },
  );

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
    client.joinOrCreate.mockImplementation(() => { throw new TypeError("Failed to fetch"); });
    const net = new NetClient(handle);
    await expect(net.connect({ name: "Pilot" })).resolves.toBeNull();
    await net.disconnect();
    const missing = new NetClient(null);
    const status = vi.fn(); missing.onConnectionStatus = status;
    await expect(missing.connect({ name: "Pilot" })).rejects.toThrow("endpoint not configured");
    expect(status).not.toHaveBeenCalledWith("reconnecting");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("catches send and leave failures, rejoins the same room, and resets the backoff", async () => {
    const first = makeRoom();
    const second = makeRoom("room-1", "pilot-2");
    const { client, handle } = makeClient(first.handle);
    client.joinById.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue(second.handle);
    const net = new NetClient(handle);
    const snapshots = vi.fn(); net.onStateChange = snapshots;
    await net.connect({ name: "Pilot", target: { kind: "create", roomName: "Test", listing: "browser", visibility: "private", teamSize: 1 } });
    first.room.send.mockImplementation(() => { throw new TypeError("closed socket"); });
    first.room.leave.mockRejectedValue(new Error("closed socket"));
    expect(() => net.setReady(true)).not.toThrow();
    expect(net.getSessionId()).toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    expect(client.joinById).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(client.joinById).toHaveBeenLastCalledWith("room-1", { name: "Pilot" });
    expect(client.create).toHaveBeenCalledTimes(1);
    expect(snapshots).toHaveBeenLastCalledWith(expect.objectContaining({ sessionId: "pilot-2", score: { team0: 2, team1: 0 } }));
    first.callbacks.leave(1006); first.callbacks.error(); first.callbacks.state(first.room.state);
    first.callbacks.messages.get("lobby_event")?.({ text: "stale" });
    expect(net.getSessionId()).toBe("pilot-2");
    second.callbacks.leave(1006);
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
    first.callbacks.leave(1006);
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
    first.callbacks.leave(1006); first.callbacks.error();
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


describe("DOT-56 fix round 1 regressions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it.each([
    [522, "room not found"], [524, "expired invite"], [4212, "room full"],
    [4213, "room locked"], [526, "join during active match"], [525, "bad invite"], [500, "HTTP server error"],
  ])("fails fast on join rejection %s (%s), without reconnecting", async (code, message) => {
    const { handle: room } = makeRoom();
    const { client, handle } = makeClient(room);
    const error = Object.assign(new Error(message), { code });
    client.joinById.mockRejectedValue(error);
    const net = new NetClient(handle);
    const status = vi.fn(); net.onConnectionStatus = status;
    await expect(net.connect({ name: "Pilot", target: { kind: "roomId", roomId: "bad" } })).rejects.toBe(error);
    await vi.runAllTimersAsync();
    expect(client.joinById).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalledWith("reconnecting");
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([1000, 4000, 4001, 4002, 4003, 4403])("consented/server close %s returns to menu without retry", async code => {
    const first = makeRoom();
    const { client, handle } = makeClient(first.handle);
    const net = new NetClient(handle);
    const ended = vi.fn(); net.onServerDisconnect = ended;
    const status = vi.fn(); net.onConnectionStatus = status;
    await net.connect({ name: "Pilot" });
    first.callbacks.leave(code);
    await vi.runAllTimersAsync();
    expect(ended).toHaveBeenCalledTimes(1);
    expect(client.joinById).not.toHaveBeenCalled();
    expect(status).not.toHaveBeenCalledWith("reconnecting");
    net.retry();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([1001, 1005, 1006, 1011, 1012, 1013, 4010])("abnormal close %s retries the same room", async code => {
    const first = makeRoom();
    const { client, handle } = makeClient(first.handle);
    const net = new NetClient(handle);
    await net.connect({ name: "Pilot" });
    first.callbacks.leave(code);
    await vi.advanceTimersByTimeAsync(1000);
    expect(client.joinById).toHaveBeenCalledExactlyOnceWith("room-1", { name: "Pilot" });
    await net.disconnect();
  });

  it("surfaces server rejection after an initial transport failure through onJoinError", async () => {
    const first = makeRoom();
    const { client, handle } = makeClient(first.handle);
    const error = Object.assign(new Error("Room expired"), { code: 524 });
    client.joinById.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockRejectedValue(error);
    const net = new NetClient(handle);
    const failed = vi.fn(); net.onJoinError = failed;
    await net.connect({ name: "Pilot", target: { kind: "roomId", roomId: "bad" } });
    await vi.runAllTimersAsync();
    expect(client.joinById).toHaveBeenCalledTimes(2);
    expect(failed).toHaveBeenCalledExactlyOnceWith(error);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["COUNTDOWN", "PLAYING", "ROUND_END"])("mid-match %s drop makes one quick attempt then stops", async phase => {
    const first = makeRoom();
    const { client, handle } = makeClient(first.handle);
    const net = new NetClient(handle);
    const status = vi.fn(); net.onConnectionStatus = status;
    await net.connect({ name: "Pilot" });
    first.room.state.phase = phase;
    first.callbacks.state(first.room.state);
    client.joinById.mockRejectedValue(new TypeError("Failed to fetch"));
    first.callbacks.leave(1006);
    await vi.advanceTimersByTimeAsync(999);
    expect(client.joinById).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(client.joinById).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenLastCalledWith("lost");
    await vi.runAllTimersAsync();
    expect(client.joinById).toHaveBeenCalledTimes(1);
  });

  it("times out a stalled mid-match handshake at five seconds and closes late success", async () => {
    const first = makeRoom();
    const late = makeRoom("room-1", "late-pilot");
    const { client, handle } = makeClient(first.handle);
    const net = new NetClient(handle);
    const status = vi.fn(); net.onConnectionStatus = status;
    await net.connect({ name: "Pilot" });
    first.room.state.phase = "PLAYING";
    first.callbacks.state(first.room.state);
    let finish!: (room: Room) => void;
    client.joinById.mockReturnValue(new Promise<Room>(resolve => { finish = resolve; }));
    first.callbacks.leave(1006);
    await vi.advanceTimersByTimeAsync(4999);
    expect(status).toHaveBeenLastCalledWith("reconnecting");
    await vi.advanceTimersByTimeAsync(1);
    expect(status).toHaveBeenLastCalledWith("lost");
    finish(late.handle);
    await vi.advanceTimersByTimeAsync(0);
    expect(late.room.leave).toHaveBeenCalledWith(false);
    expect(net.getSessionId()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("server onError is terminal rather than a transport retry", async () => {
    const first = makeRoom();
    const { client, handle } = makeClient(first.handle);
    const net = new NetClient(handle);
    const ended = vi.fn(); net.onServerDisconnect = ended;
    await net.connect({ name: "Pilot" });
    (first.callbacks.error as (code: number) => void)(526);
    await vi.runAllTimersAsync();
    expect(ended).toHaveBeenCalledTimes(1);
    expect(client.joinById).not.toHaveBeenCalled();
  });
});


describe("DOT-56 fix round 1 SDK transport preservation", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.spyOn(Math, "random").mockReturnValue(0.5); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
  it.each(["MatchMakeError", "ServerError"])("retries SDK-wrapped fetch failure from %s", async kind => {
    const first = makeRoom();
    const { client, handle } = makeClient(first.handle);
    const error = kind === "MatchMakeError"
      ? new MatchMakeError("Failed to fetch", undefined as unknown as number)
      : new ServerError(undefined as unknown as number, "Failed to fetch");
    client.joinOrCreate.mockRejectedValueOnce(error);
    const net = new NetClient(handle);
    await expect(net.connect({ name: "Pilot" })).resolves.toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    expect(client.joinOrCreate).toHaveBeenCalledTimes(2);
    expect(net.getSessionId()).toBe("pilot-1");
    await net.disconnect();
  });
});
