import { describe, expect, it } from "vitest";
import { createBotPersonality, pickPreferredBar } from "../client/src/match/botBrain";

describe("pickPreferredBar", () => {
  it("prefers bars aligned with the portal direction", () => {
    const choice = pickPreferredBar(
      { x: 0, y: 0, z: 0 },
      [
        { x: -4, y: 0, z: 0 },
        { x: 0, y: 0, z: -6 },
        { x: 0, y: 0, z: 4 },
      ],
      { x: 0, y: 0, z: -1 },
    );

    expect(choice).toEqual({ x: 0, y: 0, z: -6 });
  });

  it("can bias different bots toward different lanes", () => {
    const leftChoice = pickPreferredBar(
      { x: 0, y: 0, z: 0 },
      [
        { x: -4, y: 0, z: -8 },
        { x: 4, y: 0, z: -8 },
      ],
      { x: 0, y: 0, z: -1 },
      { lateralBias: -2 },
    );
    const rightChoice = pickPreferredBar(
      { x: 0, y: 0, z: 0 },
      [
        { x: -4, y: 0, z: -8 },
        { x: 4, y: 0, z: -8 },
      ],
      { x: 0, y: 0, z: -1 },
      { lateralBias: 2 },
    );

    expect(leftChoice).not.toBeNull();
    expect(rightChoice).not.toBeNull();
    expect(leftChoice).not.toEqual(rightChoice);
  });
});

describe("createBotPersonality", () => {
  it("is deterministic for the same bot id", () => {
    const first = createBotPersonality("bot-magenta-3", 1);
    const second = createBotPersonality("bot-magenta-3", 1);

    expect(first).toEqual(second);
  });

  it("creates materially different behavior profiles across bots", () => {
    const first = createBotPersonality("bot-cyan-0", 0);
    const second = createBotPersonality("bot-cyan-1", 0);

    expect(
      first.archetype === second.archetype
        && first.launchChargeSeconds === second.launchChargeSeconds
        && first.barLateralBias === second.barLateralBias,
    ).toBe(false);
  });
});
