import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  bounceArena,
  clampBreachRoom,
  integrateZeroG,
  type PhysicsState,
} from "../client/src/physics";
import {
  ARENA_SIZE,
  BREACH_ROOM_D,
  BREACH_ROOM_H,
  BREACH_ROOM_W,
  MAX_LAUNCH_SPEED,
  PLAYER_RADIUS,
} from "../shared/constants";

const LIMIT = ARENA_SIZE / 2 - PLAYER_RADIUS;

function makeState(pos: [number, number, number], vel: [number, number, number]): PhysicsState {
  return {
    pos: new THREE.Vector3(...pos),
    vel: new THREE.Vector3(...vel),
  };
}

describe("integrateZeroG", () => {
  it("advances position by velocity with no bleed (true zero-G)", () => {
    const state = makeState([1, 2, 3], [2, -4, 6]);
    integrateZeroG(state, 0.5);
    expect(state.pos.toArray()).toEqual([2, 0, 6]);
    expect(state.vel.toArray()).toEqual([2, -4, 6]);
  });

  it("clamps speed to MAX_LAUNCH_SPEED", () => {
    const state = makeState([0, 0, 0], [MAX_LAUNCH_SPEED * 2, 0, 0]);
    integrateZeroG(state, 1);
    expect(state.vel.length()).toBeCloseTo(MAX_LAUNCH_SPEED, 5);
    expect(state.pos.x).toBeCloseTo(MAX_LAUNCH_SPEED, 5);
  });
});

describe("bounceArena", () => {
  it("reflects velocity off a solid wall and clamps position to the limit", () => {
    const state = makeState([LIMIT + 2, 0, 0], [3, 0, 0]);
    bounceArena(state);
    expect(state.pos.x).toBe(LIMIT);
    expect(state.vel.x).toBe(-3);

    const low = makeState([0, -LIMIT - 1, 0], [0, -2, 0]);
    bounceArena(low);
    expect(low.pos.y).toBe(-LIMIT);
    expect(low.vel.y).toBe(2);
  });

  it("does not re-reflect velocity already pointing back into the arena", () => {
    const state = makeState([LIMIT + 2, 0, 0], [-3, 0, 0]);
    bounceArena(state);
    expect(state.pos.x).toBe(LIMIT);
    expect(state.vel.x).toBe(-3); // sign preserved
  });

  it("lets a player pass through an open portal face within the opening", () => {
    const state = makeState([0, 0, LIMIT + 0.5], [0, 0, 5]);
    bounceArena(state, "z", "x", { positive: true, negative: false });
    expect(state.pos.z).toBeCloseTo(LIMIT + 0.5, 6); // passthrough, no clamp
    expect(state.vel.z).toBe(5);
  });

  it("bounces on the portal face when the door is closed", () => {
    const state = makeState([0, 0, LIMIT + 0.5], [0, 0, 5]);
    bounceArena(state, "z", "x", { positive: false, negative: false });
    expect(state.pos.z).toBe(LIMIT);
    expect(state.vel.z).toBe(-5);
  });

  it("bounces outside the portal opening even when the door is open", () => {
    const wideX = BREACH_ROOM_W / 2 + 1; // outside the opening width
    const state = makeState([wideX, 0, LIMIT + 0.5], [0, 0, 5]);
    bounceArena(state, "z", "x", { positive: true, negative: true });
    expect(state.pos.z).toBe(LIMIT);
    expect(state.vel.z).toBe(-5);
  });
});

describe("clampBreachRoom", () => {
  const center = new THREE.Vector3(0, 0, 0);
  const depthHalf = BREACH_ROOM_D / 2 - PLAYER_RADIUS - 0.3;
  const heightHalf = BREACH_ROOM_H / 2 - PLAYER_RADIUS;
  const widthHalf = BREACH_ROOM_W / 2 - PLAYER_RADIUS;

  it("clamps a player against the side walls and kills outward velocity", () => {
    const state = makeState([widthHalf + 2, 0, 0], [4, 0, 0]);
    clampBreachRoom(state, center, "z", 1);
    expect(state.pos.x).toBeCloseTo(widthHalf, 6);
    expect(state.vel.x).toBe(0);
  });

  it("leaves the portal-facing side open so the player can exit", () => {
    const state = makeState([0, 0, depthHalf + 3], [0, 0, 2]);
    clampBreachRoom(state, center, "z", 1);
    expect(state.pos.z).toBeCloseTo(depthHalf + 3, 6);
    expect(state.vel.z).toBe(2);
  });

  it("seals the portal side when the door is closed", () => {
    const state = makeState([0, 0, depthHalf + 3], [0, 0, 2]);
    clampBreachRoom(state, center, "z", 1, false);
    expect(state.pos.z).toBeCloseTo(depthHalf, 6);
    expect(state.vel.z).toBe(0);
  });

  it("respects the open sign — negative-facing rooms open on the other side", () => {
    const open = makeState([0, 0, -(depthHalf + 3)], [0, 0, -2]);
    clampBreachRoom(open, center, "z", -1);
    expect(open.pos.z).toBeCloseTo(-(depthHalf + 3), 6);

    const sealed = makeState([0, 0, depthHalf + 3], [0, 0, 2]);
    clampBreachRoom(sealed, center, "z", -1);
    expect(sealed.pos.z).toBeCloseTo(depthHalf, 6); // back wall on +Z stays solid
  });

  it("stops a falling player hard at the floor", () => {
    const state = makeState([0, -heightHalf - 5, 0], [0, -9, 0]);
    clampBreachRoom(state, center, "z", 1);
    expect(state.pos.y).toBeCloseTo(-heightHalf, 6);
    expect(state.vel.y).toBe(0);
  });

  it("clamps against the ceiling and zeroes upward velocity", () => {
    const state = makeState([0, heightHalf + 5, 0], [0, 9, 0]);
    clampBreachRoom(state, center, "z", 1);
    expect(state.pos.y).toBeCloseTo(heightHalf, 6);
    expect(state.vel.y).toBe(0);
  });
});
