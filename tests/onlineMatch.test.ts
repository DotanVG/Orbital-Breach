import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OnlineActorSnapshot } from "../shared/multiplayer";

const avatarUpdate = vi.fn();
const avatarDispose = vi.fn();

vi.mock("../client/src/match/simulatedPlayerAvatar", () => ({
  SimulatedPlayerAvatar: class {
    private readonly team: 0 | 1;
    public constructor(_scene: unknown, team: 0 | 1) {
      this.team = team;
    }
    public dispose(): void {
      avatarDispose(this.team);
    }
    public triggerArmRecoil(): void {}
    public update(...args: unknown[]): void {
      avatarUpdate(this.team, ...args);
    }
  },
}));

import { OnlineMatch } from "../client/src/match/onlineMatch";

describe("OnlineMatch", () => {
  const scene = {} as never;

  beforeEach(() => {
    avatarUpdate.mockClear();
    avatarDispose.mockClear();
  });

  it("routes celebration only to remote actors on the winning team", () => {
    const match = new OnlineMatch(scene);
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

  it("disposes remote actors that disappear from the authoritative snapshot", () => {
    const match = new OnlineMatch(scene);
    match.applySnapshot(
      [
        createActor("remote-cyan", 0),
        createActor("remote-magenta", 1),
      ],
      "local-player",
    );

    match.applySnapshot([createActor("remote-magenta", 1)], "local-player");

    expect(avatarDispose).toHaveBeenCalledTimes(1);
    expect(avatarDispose).toHaveBeenCalledWith(0);

    avatarUpdate.mockClear();
    match.update(1 / 60);
    expect(avatarUpdate.mock.calls.map(([team]) => team)).toEqual([1]);

    match.dispose();
  });

  it("forwards full remote orientation to avatar updates instead of yaw only", () => {
    const match = new OnlineMatch(scene);
    match.applySnapshot(
      [
        createActor("remote-rolled", 1, {
          orientX: 0,
          orientY: 0,
          orientZ: Math.sin(Math.PI / 4),
          orientW: Math.cos(Math.PI / 4),
        }),
      ],
      "local-player",
    );

    avatarUpdate.mockClear();
    match.update(1 / 60);

    expect(avatarUpdate).toHaveBeenCalledTimes(1);
    expect(avatarUpdate.mock.calls[0][4].toArray()).toEqual([
      0,
      0,
      Math.sin(Math.PI / 4),
      Math.cos(Math.PI / 4),
    ]);

    match.dispose();
  });
});

function createActor(
  id: string,
  team: 0 | 1,
  orientation?: { orientX: number; orientY: number; orientZ: number; orientW: number },
): OnlineActorSnapshot {
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
    orientX: 0,
    orientY: 0,
    orientZ: 0,
    orientW: 1,
    phase: "BREACH",
    frozen: false,
    leftArm: false,
    rightArm: false,
    leftLeg: false,
    rightLeg: false,
    kills: 0,
    deaths: 0,
    ...(orientation ?? {}),
  } as OnlineActorSnapshot;
}
