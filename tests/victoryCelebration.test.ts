import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  getVictoryDanceFacing,
  shouldUseVictoryRearView,
} from "../client/src/game/victoryCelebration";

describe("getVictoryDanceFacing", () => {
  it("keeps the dance upright while preserving the camera yaw", () => {
    const cameraQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0.45, 1.1, -0.35, "YXZ"),
    );

    const danceFacing = getVictoryDanceFacing(cameraQuat);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(danceFacing);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(danceFacing);

    expect(forward.y).toBeCloseTo(0, 6);
    expect(up.x).toBeCloseTo(0, 6);
    expect(up.y).toBeCloseTo(1, 6);
    expect(up.z).toBeCloseTo(0, 6);

    const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraQuat);
    const flatCameraForward = new THREE.Vector3(cameraForward.x, 0, cameraForward.z).normalize();
    expect(forward.x).toBeCloseTo(flatCameraForward.x, 6);
    expect(forward.z).toBeCloseTo(flatCameraForward.z, 6);
  });
});

describe("shouldUseVictoryRearView", () => {
  it("forces the rear view while the local victory dance is active", () => {
    expect(shouldUseVictoryRearView(false, true)).toBe(true);
    expect(shouldUseVictoryRearView(true, false)).toBe(true);
    expect(shouldUseVictoryRearView(false, false)).toBe(false);
  });
});
