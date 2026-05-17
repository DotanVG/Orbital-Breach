import { describe, expect, it } from "vitest";

import {
  PLAYER_UPDATE_STALE_MS,
  bounceActorInArena,
  integrateZeroGActor,
  isActorInEnemyBreachRoom,
  shouldServerSimulateHumanActor,
  type ServerSimulatedOnlineActor,
} from "../server/src/colyseus/onlineActorSimulation";

function makeActor(overrides: Partial<ServerSimulatedOnlineActor> = {}): ServerSimulatedOnlineActor {
  return {
    frozen: false,
    isBot: false,
    phase: "FLOATING",
    posX: 0,
    posY: 0,
    posZ: 0,
    team: 0,
    velX: 0,
    velY: 0,
    velZ: 0,
    ...overrides,
  };
}

describe("onlineActorSimulation", () => {
  it("hands floating human actors to the server after updates go stale", () => {
    expect(shouldServerSimulateHumanActor(makeActor(), PLAYER_UPDATE_STALE_MS - 1)).toBe(false);
    expect(shouldServerSimulateHumanActor(makeActor(), PLAYER_UPDATE_STALE_MS)).toBe(true);
    expect(shouldServerSimulateHumanActor(makeActor({ phase: "GRABBING" }), PLAYER_UPDATE_STALE_MS)).toBe(false);
    expect(shouldServerSimulateHumanActor(makeActor({ frozen: true }), PLAYER_UPDATE_STALE_MS)).toBe(false);
  });

  it("continues zero-g drift and preserves portal-room bounds", () => {
    const actor = makeActor({
      posX: 24.9,
      velX: 4,
    });

    integrateZeroGActor(actor, 0.5);
    bounceActorInArena(actor, "x");

    expect(actor.posX).toBeCloseTo(25.65, 5);
    expect(actor.velX).toBeLessThan(0);
  });

  it("detects when a drifting actor reaches the enemy breach room", () => {
    const goalSigns = { team0: 1 as const, team1: -1 as const };
    const actor = makeActor({
      team: 0,
      posX: -23,
      posY: 0,
      posZ: 0,
    });

    expect(isActorInEnemyBreachRoom(actor, "x", goalSigns)).toBe(true);
    expect(isActorInEnemyBreachRoom(makeActor({ team: 0, posX: 19 }), "x", goalSigns)).toBe(false);
  });
});
