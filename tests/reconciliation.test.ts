import * as THREE from "three";
import { describe, expect, it } from "vitest";

import {
  predictPosition,
  reconcileAngle,
  reconcileVector,
} from "../client/src/net/reconciliation";

describe("reconciliation helpers", () => {
  it("predicts forward motion with a capped lead window", () => {
    const pos = new THREE.Vector3(10, 0, -4);
    const vel = new THREE.Vector3(5, 0, 0);

    const predicted = predictPosition(pos, vel, 1.0, 0.2);

    expect(predicted.x).toBeCloseTo(11, 5);
    expect(predicted.y).toBeCloseTo(0, 5);
    expect(predicted.z).toBeCloseTo(-4, 5);
  });

  it("reconciles angles using the shortest wraparound path", () => {
    const current = Math.PI - 0.1;
    const target = -Math.PI + 0.1;

    const next = reconcileAngle(current, target, 0.1, 12);

    expect(next).toBeGreaterThan(current);
  });

  it("snaps vectors when drift gets too large", () => {
    const current = new THREE.Vector3(0, 0, 0);
    const target = new THREE.Vector3(10, 0, 0);

    reconcileVector(current, target, 0.016, 12, 2);

    expect(current.x).toBe(10);
  });
});
