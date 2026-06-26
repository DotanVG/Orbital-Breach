import { afterEach, describe, expect, it, vi } from "vitest";
import type { HitReportMessage } from "../shared/multiplayer";
import type * as ActorDamageModule from "../server/src/colyseus/actorDamage";
import type * as OnlineActorSimulationModule from "../server/src/colyseus/onlineActorSimulation";

const applyHitToOnlineActor = vi.fn(() => false);
const isActorInEnemyBreachRoom = vi.fn(() => true);

vi.mock("../server/src/colyseus/actorDamage", async () => {
  const actual = await vi.importActual<typeof ActorDamageModule>("../server/src/colyseus/actorDamage");
  return {
    ...actual,
    applyHitToOnlineActor,
  };
});

vi.mock("../server/src/colyseus/onlineActorSimulation", async () => {
  const actual = await vi.importActual<typeof OnlineActorSimulationModule>("../server/src/colyseus/onlineActorSimulation");
  return {
    ...actual,
    isActorInEnemyBreachRoom,
  };
});

import { OrbitalLobbyRoom } from "../server/src/colyseus/OrbitalLobbyRoom";
import { ActorState, OrbitalLobbyState } from "../server/src/colyseus/state";

type RoomWithInternals = OrbitalLobbyRoom & {
  handleBreachReportMessage: (client: { sessionId: string }) => void;
  handleHitReportMessage: (client: { sessionId: string }, message: HitReportMessage) => void;
};

function createRoom(): OrbitalLobbyRoom {
  const room = new OrbitalLobbyRoom();
  room.state = new OrbitalLobbyState();
  room.state.phase = "PLAYING";
  room.broadcast = vi.fn() as typeof room.broadcast;
  room.setMetadata = vi.fn().mockResolvedValue(undefined) as typeof room.setMetadata;
  return room;
}

function addActor(
  room: OrbitalLobbyRoom,
  id: string,
  options: { name: string; team: 0 | 1; posX?: number; posY?: number; posZ?: number },
): void {
  const actor = new ActorState();
  actor.id = id;
  actor.name = options.name;
  actor.team = options.team;
  actor.posX = options.posX ?? 0;
  actor.posY = options.posY ?? 0;
  actor.posZ = options.posZ ?? 0;
  room.state.actors.set(id, actor);
}

describe("OrbitalLobbyRoom report throttling", () => {
  afterEach(() => {
    vi.useRealTimers();
    applyHitToOnlineActor.mockClear();
    isActorInEnemyBreachRoom.mockClear();
  });

  it("drops hit_report spam from the same client inside the throttle window", () => {
    vi.useFakeTimers();
    const room = createRoom();
    const roomWithInternals = room as RoomWithInternals;
    addActor(room, "shooter", { name: "Shooter", team: 0, posX: 0 });
    addActor(room, "target", { name: "Target", team: 1, posX: 1 });
    const message: HitReportMessage = {
      targetId: "target",
      zone: "body",
      impX: 0,
      impY: 0,
      impZ: 0,
    };

    roomWithInternals.handleHitReportMessage({ sessionId: "shooter" }, message);
    roomWithInternals.handleHitReportMessage({ sessionId: "shooter" }, message);

    expect(applyHitToOnlineActor).toHaveBeenCalledTimes(1);
  });

  it("allows hit_report again after the throttle window passes", () => {
    vi.useFakeTimers();
    const room = createRoom();
    const roomWithInternals = room as RoomWithInternals;
    addActor(room, "shooter", { name: "Shooter", team: 0, posX: 0 });
    addActor(room, "target", { name: "Target", team: 1, posX: 1 });
    const message: HitReportMessage = {
      targetId: "target",
      zone: "body",
      impX: 0,
      impY: 0,
      impZ: 0,
    };

    roomWithInternals.handleHitReportMessage({ sessionId: "shooter" }, message);
    vi.advanceTimersByTime(50);
    roomWithInternals.handleHitReportMessage({ sessionId: "shooter" }, message);

    expect(applyHitToOnlineActor).toHaveBeenCalledTimes(2);
  });

  it("drops breach_report spam from the same client inside the throttle window", () => {
    vi.useFakeTimers();
    const room = createRoom();
    const roomWithInternals = room as RoomWithInternals;
    addActor(room, "runner", { name: "Runner", team: 0, posX: -23 });

    roomWithInternals.handleBreachReportMessage({ sessionId: "runner" });
    roomWithInternals.handleBreachReportMessage({ sessionId: "runner" });

    expect(isActorInEnemyBreachRoom).toHaveBeenCalledTimes(1);
  });

  it("allows breach_report again after the throttle window passes", () => {
    vi.useFakeTimers();
    const room = createRoom();
    const roomWithInternals = room as RoomWithInternals;
    addActor(room, "runner", { name: "Runner", team: 0, posX: -23 });

    roomWithInternals.handleBreachReportMessage({ sessionId: "runner" });
    vi.advanceTimersByTime(50);
    roomWithInternals.handleBreachReportMessage({ sessionId: "runner" });

    expect(isActorInEnemyBreachRoom).toHaveBeenCalledTimes(2);
  });
});
