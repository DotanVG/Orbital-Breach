import { describe, expect, it } from "vitest";

import {
  MAX_HIT_REPORT_DISTANCE,
  PLAYER_UPDATE_STALE_MS,
  bounceActorInArena,
  integrateZeroGActor,
  isActorInEnemyBreachRoom,
  isHitReportDistancePlausible,
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

    expect(actor.posX).toBeCloseTo(25.2, 5);
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

  it("rejects breach claims made from the arena or the actor's own breach room", () => {
    const goalSigns = { team0: 1 as const, team1: -1 as const };

    // Arena center — nowhere near a breach room.
    expect(isActorInEnemyBreachRoom(makeActor({ team: 0, posX: 0 }), "x", goalSigns)).toBe(false);
    // Inside the actor's OWN breach room (team 0 defends +x side).
    expect(isActorInEnemyBreachRoom(makeActor({ team: 0, posX: 23 }), "x", goalSigns)).toBe(false);
    // Same position is a valid breach for the OTHER team.
    expect(isActorInEnemyBreachRoom(makeActor({ team: 1, posX: 23 }), "x", goalSigns)).toBe(true);
    // Off-axis or out of the room's vertical bounds never counts.
    expect(isActorInEnemyBreachRoom(makeActor({ team: 0, posX: -23, posZ: 30 }), "x", goalSigns)).toBe(false);
    expect(isActorInEnemyBreachRoom(makeActor({ team: 0, posX: -23, posY: 30 }), "x", goalSigns)).toBe(false);
  });
});

describe("isHitReportDistancePlausible", () => {
  it("accepts hits within the arena's reachable extent", () => {
    const shooter = makeActor({ posX: -20, posY: -20, posZ: -20 });
    const target = makeActor({ posX: 20, posY: 20, posZ: 20 });
    expect(isHitReportDistancePlausible(shooter, target)).toBe(true);
    expect(isHitReportDistancePlausible(shooter, shooter)).toBe(true);
  });

  it("rejects hit reports on targets beyond the arena diagonal", () => {
    const shooter = makeActor({ posX: 0, posY: 0, posZ: 0 });
    const target = makeActor({ posX: MAX_HIT_REPORT_DISTANCE + 1, posY: 0, posZ: 0 });
    expect(isHitReportDistancePlausible(shooter, target)).toBe(false);
  });

  it("treats the maximum distance itself as plausible", () => {
    const shooter = makeActor();
    const target = makeActor({ posX: MAX_HIT_REPORT_DISTANCE });
    expect(isHitReportDistancePlausible(shooter, target)).toBe(true);
  });

  it("distinguishes distances just inside and just outside the maximum", () => {
    const shooter = makeActor();

    expect(
      isHitReportDistancePlausible(
        shooter,
        makeActor({ posX: MAX_HIT_REPORT_DISTANCE - 1e-6 }),
      ),
    ).toBe(true);
    expect(
      isHitReportDistancePlausible(
        shooter,
        makeActor({ posX: MAX_HIT_REPORT_DISTANCE + 1e-6 }),
      ),
    ).toBe(false);
  });
});
