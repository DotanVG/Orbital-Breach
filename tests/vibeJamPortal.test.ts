import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BREACH_ROOM_D } from "../shared/constants";
import { computeBackWallPortalTransform } from "../client/src/game/portal/vibeJamPortal";

describe("computeBackWallPortalTransform", () => {
  it("places tutorial return portals on the breach-room back wall and faces them into the room", () => {
    const center = new THREE.Vector3(0, 0, -23);
    const transform = computeBackWallPortalTransform(center, "z", 1);

    expect(transform.position.x).toBe(0);
    expect(transform.position.y).toBeCloseTo(0.2);
    expect(transform.position.z).toBeCloseTo(center.z - (BREACH_ROOM_D / 2 - 0.08));
    expect(transform.normal.toArray()).toEqual([0, 0, 1]);
  });

  it("matches the existing enemy breach outbound portal wall placement style", () => {
    const center = new THREE.Vector3(0, 0, 23);
    const transform = computeBackWallPortalTransform(center, "z", -1);

    expect(transform.position.x).toBe(0);
    expect(transform.position.y).toBeCloseTo(0.2);
    expect(transform.position.z).toBeCloseTo(center.z + (BREACH_ROOM_D / 2 - 0.08));
    expect(transform.normal.toArray()).toEqual([0, 0, -1]);
  });
});
