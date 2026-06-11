import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { bounceAgainstBoxes } from "../client/src/arena/obstacleCollision";
import type { PhysicsState } from "../client/src/physics";

function makeState(pos: [number, number, number], vel: [number, number, number]): PhysicsState {
  return {
    pos: new THREE.Vector3(...pos),
    vel: new THREE.Vector3(...vel),
  };
}

function unitBoxAtOrigin(): THREE.Box3 {
  return new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
}

describe("bounceAgainstBoxes", () => {
  it("leaves a player outside every box untouched", () => {
    const state = makeState([5, 5, 5], [1, 2, 3]);
    bounceAgainstBoxes(state, [unitBoxAtOrigin()]);
    expect(state.pos.toArray()).toEqual([5, 5, 5]);
    expect(state.vel.toArray()).toEqual([1, 2, 3]);
  });

  it("pushes a penetrating player out along the shallowest axis and damps that velocity axis by -0.5", () => {
    // Near +X face: X penetration is shallowest, so resolution must be on X only.
    const state = makeState([0.9, 0.1, 0.2], [-4, 1, 1]);
    bounceAgainstBoxes(state, [unitBoxAtOrigin()], 0.05);
    expect(state.pos.x).toBeCloseTo(1.05, 5); // box max + padding
    expect(state.pos.y).toBeCloseTo(0.1, 5);
    expect(state.pos.z).toBeCloseTo(0.2, 5);
    expect(state.vel.x).toBeCloseTo(2, 5); // -4 * -0.5
    expect(state.vel.y).toBeCloseTo(1, 5);
    expect(state.vel.z).toBeCloseTo(1, 5);
  });

  it("resolves on Y when Y penetration is shallowest", () => {
    const state = makeState([0.1, -0.9, 0.1], [0, 6, 0]);
    bounceAgainstBoxes(state, [unitBoxAtOrigin()], 0.05);
    expect(state.pos.y).toBeCloseTo(-1.05, 5); // pushed out the -Y face
    expect(state.pos.x).toBeCloseTo(0.1, 5);
    expect(state.pos.z).toBeCloseTo(0.1, 5);
    expect(state.vel.y).toBeCloseTo(-3, 5); // 6 * -0.5
  });

  it("resolves on Z when Z penetration is shallowest", () => {
    const state = makeState([0.1, 0.1, 0.95], [0, 0, -2]);
    bounceAgainstBoxes(state, [unitBoxAtOrigin()], 0.05);
    expect(state.pos.z).toBeCloseTo(1.05, 5);
    expect(state.vel.z).toBeCloseTo(1, 5); // -2 * -0.5
  });

  it("respects the padding parameter when deciding containment", () => {
    // 0.1 outside the raw box face: only collides once padding >= 0.1.
    const grazing = makeState([1.1, 0, 0], [-1, 0, 0]);
    bounceAgainstBoxes(grazing, [unitBoxAtOrigin()], 0.05);
    expect(grazing.pos.x).toBeCloseTo(1.1, 5);
    expect(grazing.vel.x).toBeCloseTo(-1, 5);

    const padded = makeState([1.1, 0, 0], [-1, 0, 0]);
    bounceAgainstBoxes(padded, [unitBoxAtOrigin()], 0.2);
    expect(padded.pos.x).toBeCloseTo(1.2, 5); // box max + padding
    expect(padded.vel.x).toBeCloseTo(0.5, 5);
  });

  it("checks every box in the list, not just the first", () => {
    const farBox = new THREE.Box3(
      new THREE.Vector3(9, -1, -1),
      new THREE.Vector3(11, 1, 1),
    );
    const state = makeState([10.9, 0, 0], [-1, 0, 0]);
    bounceAgainstBoxes(state, [unitBoxAtOrigin(), farBox], 0.05);
    expect(state.pos.x).toBeCloseTo(11.05, 5);
    expect(state.vel.x).toBeCloseTo(0.5, 5);
  });
});
