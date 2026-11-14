import { describe, expect, it } from "vitest";
import { Metadata, Encoder, Reflection } from "../server/node_modules/@colyseus/schema";
import { ActorState, LobbyMemberState, OrbitalLobbyState } from "../server/src/colyseus/state";

// These are the original defineTypes field order and codecs. Reordering a field
// changes its wire index, even when server and client types still compile.
const memberFields = {
  id: "string", sessionId: "string", name: "string", team: "number",
  ready: "boolean", connected: "boolean", isBot: "boolean",
};
const actorFields = {
  id: "string", name: "string", team: "number", isBot: "boolean",
  posX: "number", posY: "number", posZ: "number", velX: "number", velY: "number", velZ: "number",
  yaw: "number", orientX: "number", orientY: "number", orientZ: "number", orientW: "number",
  phase: "string", frozen: "boolean", leftArm: "boolean", rightArm: "boolean",
  leftLeg: "boolean", rightLeg: "boolean", kills: "number", deaths: "number", frozenTimer: "number",
};
const roomFields = {
  roomName: "string", visibility: "string", listing: "string", phase: "string", matchComplete: "boolean",
  countdownRemaining: "number", roundTimeRemaining: "number", scoreTeam0: "number", scoreTeam1: "number",
  teamSize: "number", maxPlayers: "number", roundNumber: "number",
  members: { map: LobbyMemberState }, actors: { map: ActorState },
};

describe("schema declaration migration", () => {
  it.each([
    [LobbyMemberState, memberFields], [ActorState, actorFields], [OrbitalLobbyState, roomFields],
  ] as const)("preserves each field's wire index and codec", (state, fields) => {
    expect(Object.entries(Metadata.getFields(state))).toEqual(Object.entries(fields));
  });

  it("preserves defaults and independently allocated maps", () => {
    expect(new LobbyMemberState().toJSON()).toEqual({
      id: "", sessionId: "", name: "", team: 0, ready: false, connected: true, isBot: false,
    });
    expect(new ActorState().toJSON()).toEqual(Object.fromEntries(Object.entries(actorFields).map(([key, type]) => [
      key, key === "phase" ? "BREACH" : key === "orientW" ? 1 : type === "number" ? 0 : type === "boolean" ? false : "",
    ])));
    const first = new OrbitalLobbyState();
    const second = new OrbitalLobbyState();
    expect(first.toJSON()).toEqual({
      roomName: "Orbital Lobby", visibility: "public", listing: "quick", phase: "LOBBY", matchComplete: false,
      countdownRemaining: 0, roundTimeRemaining: 0, scoreTeam0: 0, scoreTeam1: 0, teamSize: 5, maxPlayers: 10,
      roundNumber: 0, members: {}, actors: {},
    });
    expect(first.members).not.toBe(second.members);
    expect(first.actors).not.toBe(second.actors);
  });

  it("reflects and decodes a full state and later patches with the existing codecs", () => {
    const state = new OrbitalLobbyState();
    const member = new LobbyMemberState();
    Object.assign(member, { id: "pilot", name: "Pilot", team: 1 });
    const actor = new ActorState();
    Object.assign(actor, { id: "pilot", team: 1, posX: 42, kills: 3, frozen: true });
    state.members.set("pilot", member);
    state.actors.set("pilot", actor);
    const encoder = new Encoder(state);
    const decoder = Reflection.decode(Reflection.encode(encoder));
    decoder.decode(encoder.encodeAll());
    expect(decoder.state.toJSON()).toEqual(state.toJSON());
    encoder.discardChanges();
    member.connected = false;
    actor.posX = 84;
    decoder.decode(encoder.encode());
    expect(decoder.state.toJSON()).toEqual(state.toJSON());
  });
});
