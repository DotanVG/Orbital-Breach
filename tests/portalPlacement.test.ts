import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { BREACH_ROOM_D } from "../shared/constants";
import { computeBreachRoomPortalTransform } from "../client/src/game/portal/portalPlacement";

describe("computeBreachRoomPortalTransform", () => {
  it("places the cyan-room portal on the breach back wall", () => {
    const { normal, position } = computeBreachRoomPortalTransform(
      new THREE.Vector3(0, 0, -23),
      "z",
      1,
    );

    expect(normal.toArray()).toEqual([0, 0, 1]);
    expect(position.x).toBeCloseTo(0);
    expect(position.y).toBeCloseTo(0.2);
    expect(position.z).toBeCloseTo(-23 - (BREACH_ROOM_D / 2 - 0.08));
  });

  it("mirrors the portal position for the opposite breach sign", () => {
    const { normal, position } = computeBreachRoomPortalTransform(
      new THREE.Vector3(0, 0, 23),
      "z",
      -1,
    );

    expect(normal.toArray()).toEqual([0, 0, -1]);
    expect(position.z).toBeCloseTo(23 + (BREACH_ROOM_D / 2 - 0.08));
  });

  it("supports x-axis breach rooms", () => {
    const { normal, position } = computeBreachRoomPortalTransform(
      new THREE.Vector3(23, 0, 0),
      "x",
      -1,
    );

    expect(normal.toArray()).toEqual([-1, 0, 0]);
    expect(position.x).toBeCloseTo(23 + (BREACH_ROOM_D / 2 - 0.08));
    expect(position.z).toBeCloseTo(0);
  });
});
