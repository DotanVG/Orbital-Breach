import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { clamp, clampMagnitude, lerp, lerpVec3 } from "../client/src/util/math";

describe("clamp", () => {
  it("returns the value when inside the range", () => {
    expect(clamp(3, 0, 10)).toBe(3);
  });

  it("clamps to min and max at the edges", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe("lerp", () => {
  it("interpolates between endpoints", () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(-4, 4, 0.25)).toBe(-2);
  });

  it("extrapolates outside [0, 1]", () => {
    expect(lerp(0, 10, 2)).toBe(20);
    expect(lerp(0, 10, -1)).toBe(-10);
  });
});

describe("clampMagnitude", () => {
  it("shortens a vector longer than max while keeping its direction", () => {
    const v = new Vector3(3, 4, 0); // length 5
    const out = clampMagnitude(v, 2);
    expect(out).toBe(v); // mutates and returns the same instance
    expect(v.length()).toBeCloseTo(2, 6);
    expect(v.x / v.y).toBeCloseTo(3 / 4, 6);
  });

  it("leaves a vector within max untouched", () => {
    const v = new Vector3(1, 1, 1);
    clampMagnitude(v, 10);
    expect(v.toArray()).toEqual([1, 1, 1]);
  });
});

describe("lerpVec3", () => {
  it("returns a new interpolated vector without mutating inputs", () => {
    const a = new Vector3(0, 0, 0);
    const b = new Vector3(10, -10, 4);
    const mid = lerpVec3(a, b, 0.5);
    expect(mid.toArray()).toEqual([5, -5, 2]);
    expect(a.toArray()).toEqual([0, 0, 0]);
    expect(b.toArray()).toEqual([10, -10, 4]);
  });
});
