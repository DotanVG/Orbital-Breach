import { describe, expect, it, vi } from "vitest";
import { parseClientMsg, sendEvent, sendState } from "../server/src/net/messageCodec";
import type { ServerStateMsg } from "../shared/schema";

// WebSocket readyState constants (per the WHATWG spec, mirrored by `ws`).
// Importing `ws` here would require it at the repo root, so use the raw values.
const OPEN = 1;
const CLOSING = 2;
const CLOSED = 3;

type SendableSocket = Parameters<typeof sendState>[0];

function fakeSocket(readyState: number) {
  return { readyState, send: vi.fn() } as unknown as SendableSocket & {
    send: ReturnType<typeof vi.fn>;
  };
}

const stateMsg: ServerStateMsg = {
  t: "state",
  seq: 1,
  players: [],
  score: { team0: 0, team1: 0 },
  arenaState: "A",
  phase: "LOBBY",
};

describe("parseClientMsg", () => {
  it("parses a well-formed client message", () => {
    const msg = parseClientMsg('{"t":"input","seq":3}');
    expect(msg).toEqual({ t: "input", seq: 3 });
  });

  it("returns null for invalid JSON", () => {
    expect(parseClientMsg("{not json")).toBeNull();
  });

  it("returns null for JSON that is not an object", () => {
    expect(parseClientMsg('"input"')).toBeNull();
    expect(parseClientMsg("42")).toBeNull();
    expect(parseClientMsg("null")).toBeNull();
  });

  it("returns null when the type tag is missing or not a string", () => {
    expect(parseClientMsg("{}")).toBeNull();
    expect(parseClientMsg('{"t":7}')).toBeNull();
  });
});

describe("sendState", () => {
  it("serializes the snapshot to an open socket", () => {
    const ws = fakeSocket(OPEN);
    sendState(ws, stateMsg);
    expect(ws.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(ws.send.mock.calls[0][0] as string)).toEqual(stateMsg);
  });

  it("drops the frame when the socket is not open", () => {
    const ws = fakeSocket(CLOSED);
    sendState(ws, stateMsg);
    expect(ws.send).not.toHaveBeenCalled();
  });
});

describe("sendEvent", () => {
  it("wraps type and data in an event envelope", () => {
    const ws = fakeSocket(OPEN);
    sendEvent(ws, "score", { team: 1 });
    expect(JSON.parse(ws.send.mock.calls[0][0] as string)).toEqual({
      t: "event",
      type: "score",
      data: { team: 1 },
    });
  });

  it("drops the event when the socket is closing", () => {
    const ws = fakeSocket(CLOSING);
    sendEvent(ws, "score", { team: 0 });
    expect(ws.send).not.toHaveBeenCalled();
  });
});
