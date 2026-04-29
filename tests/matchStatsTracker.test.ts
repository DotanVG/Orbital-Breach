import { describe, expect, it } from "vitest";

import {
  MatchStatsTracker,
  buildDebriefAwards,
} from "../client/src/game/matchStatsTracker";

describe("MatchStatsTracker", () => {
  it("tracks breaches, freeze totals, and travel distance from observed players", () => {
    const tracker = new MatchStatsTracker();

    tracker.observePlayers([
      {
        id: "self",
        name: "Pilot",
        team: 0,
        isBot: false,
        isSelf: true,
        freezes: 0,
        frozen: 0,
        position: { x: 0, y: 0, z: 0 },
      },
    ], { accumulateTravel: false });

    tracker.recordBreach("self");
    tracker.observePlayers([
      {
        id: "self",
        name: "Pilot",
        team: 0,
        isBot: false,
        isSelf: true,
        freezes: 2,
        frozen: 0,
        position: { x: 3, y: 4, z: 0 },
      },
    ], { accumulateTravel: true });

    const [player] = tracker.buildPlayers();
    expect(player.breaches).toBe(1);
    expect(player.freezes).toBe(2);
    expect(player.frozen).toBe(0);
    expect(player.travelDistance).toBeCloseTo(5, 5);
  });

  it("resets all tracked stats between matches", () => {
    const tracker = new MatchStatsTracker();
    tracker.observePlayers([
      {
        id: "self",
        name: "Pilot",
        team: 0,
        isBot: false,
        isSelf: true,
        freezes: 1,
        frozen: 1,
        position: { x: 1, y: 0, z: 0 },
      },
    ], { accumulateTravel: false });
    tracker.recordBreach("self");

    tracker.reset();

    expect(tracker.buildPlayers()).toEqual([]);
    expect(tracker.buildAwards()).toEqual([
      { key: "Round Complete", value: "-", note: "match concluded" },
    ]);
  });
});

describe("buildDebriefAwards", () => {
  it("assigns iron, moon walker, portal ace, and freeze awards from tracked players", () => {
    const awards = buildDebriefAwards([
      {
        id: "self",
        name: "Pilot",
        team: 0,
        breaches: 2,
        freezes: 3,
        frozen: 0,
        travelDistance: 32,
        isBot: false,
        isSelf: true,
      },
      {
        id: "ally",
        name: "Wing",
        team: 0,
        breaches: 4,
        freezes: 1,
        frozen: 2,
        travelDistance: 58,
        isBot: false,
        isSelf: false,
      },
    ]);

    expect(awards).toEqual([
      { key: "Portal Ace", value: "Wing", note: "4 breaches scored" },
      { key: "Deep Freeze", value: "Pilot", note: "3 freezes landed" },
      { key: "Iron Pilot", value: "Pilot", note: "no freezes taken" },
      { key: "Moon Walker", value: "Wing", note: "58.0m travelled" },
    ]);
  });
});
