import { beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type { OnlineActorSnapshot } from "../shared/multiplayer";

const avatarUpdate = vi.fn();

vi.mock("../client/src/match/simulatedPlayerAvatar", () => ({
  SimulatedPlayerAvatar: class {
    private readonly team: 0 | 1;
    public constructor(_scene: THREE.Scene, team: 0 | 1) {
      this.team = team;
    }
    public dispose(): void {}
    public triggerArmRecoil(): void {}
    public update(...args: unknown[]): void {
      avatarUpdate(this.team, ...args);
    }
  },
}));

import { OnlineMatch } from "../client/src/match/onlineMatch";

describe("OnlineMatch", () => {
  beforeEach(() => {
    avatarUpdate.mockClear();
  });

  it("routes celebration only to remote actors on the winning team", () => {
    const match = new OnlineMatch(new THREE.Scene());
    match.applySnapshot(
      [
        createActor("remote-cyan", 0),
        createActor("remote-magenta", 1),
      ],
      "local-player",
    );

    avatarUpdate.mockClear();
    match.setCelebratingTeam(1);
    match.update(1 / 60);

    const team0Flags = avatarUpdate.mock.calls
      .filter(([team]) => team === 0)
      .map((call) => call.at(-1));
    const team1Flags = avatarUpdate.mock.calls
      .filter(([team]) => team === 1)
      .map((call) => call.at(-1));

    expect(team0Flags).toEqual([false]);
    expect(team1Flags).toEqual([true]);

    match.dispose();
  });
});

function createActor(id: string, team: 0 | 1): OnlineActorSnapshot {
  return {
    id,
    name: id,
    team,
    isBot: false,
    posX: team === 0 ? -5 : 5,
    posY: 0,
    posZ: 0,
    velX: 0,
    velY: 0,
    velZ: 0,
    yaw: 0,
    phase: "BREACH",
    frozen: false,
    leftArm: false,
    rightArm: false,
    leftLeg: false,
    rightLeg: false,
    kills: 0,
    deaths: 0,
  };
}
