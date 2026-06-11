import { describe, expect, it } from "vitest";
import { v3 } from "../shared/vec3";

describe("v3.zero", () => {
  it("returns a fresh origin vector each call", () => {
    const a = v3.zero();
    expect(a).toEqual({ x: 0, y: 0, z: 0 });
    expect(v3.zero()).not.toBe(a);
  });
});

describe("v3.clone", () => {
  it("copies components into a new object", () => {
    const src = { x: 1, y: 2, z: 3 };
    const copy = v3.clone(src);
    expect(copy).toEqual(src);
    expect(copy).not.toBe(src);
  });
});

describe("v3.add", () => {
  it("adds componentwise", () => {
    expect(v3.add({ x: 1, y: 2, z: 3 }, { x: -1, y: 10, z: 0.5 })).toEqual({ x: 0, y: 12, z: 3.5 });
  });
});

describe("v3.sub", () => {
  it("subtracts componentwise", () => {
    expect(v3.sub({ x: 1, y: 2, z: 3 }, { x: 3, y: 2, z: 1 })).toEqual({ x: -2, y: 0, z: 2 });
  });
});

describe("v3.scale", () => {
  it("multiplies every component by the scalar", () => {
    expect(v3.scale({ x: 1, y: -2, z: 0.5 }, 4)).toEqual({ x: 4, y: -8, z: 2 });
  });
});

describe("v3.addScaled", () => {
  it("computes a + b * s without mutating inputs", () => {
    const a = { x: 1, y: 1, z: 1 };
    const b = { x: 2, y: 0, z: -2 };
    expect(v3.addScaled(a, b, 0.5)).toEqual({ x: 2, y: 1, z: 0 });
    expect(a).toEqual({ x: 1, y: 1, z: 1 });
    expect(b).toEqual({ x: 2, y: 0, z: -2 });
  });
});

describe("v3.dot", () => {
  it("is zero for orthogonal vectors and |a|^2 for self", () => {
    expect(v3.dot({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBe(0);
    expect(v3.dot({ x: 2, y: 3, z: 6 }, { x: 2, y: 3, z: 6 })).toBe(49);
  });
});

describe("v3.cross", () => {
  it("follows the right-hand rule on the basis vectors", () => {
    expect(v3.cross({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toEqual({ x: 0, y: 0, z: 1 });
    expect(v3.cross({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: -1 });
  });
});

describe("v3.length", () => {
  it("matches lengthSq on a 3-4-12 triple", () => {
    const v = { x: 3, y: 4, z: 12 };
    expect(v3.lengthSq(v)).toBe(169);
    expect(v3.length(v)).toBe(13);
  });
});

describe("v3.normalize", () => {
  it("returns a unit vector in the same direction", () => {
    const n = v3.normalize({ x: 0, y: 3, z: 4 });
    expect(n.x).toBeCloseTo(0, 6);
    expect(n.y).toBeCloseTo(0.6, 6);
    expect(n.z).toBeCloseTo(0.8, 6);
  });

  it("returns the zero vector for degenerate input instead of NaN", () => {
    expect(v3.normalize({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 0 });
    expect(v3.normalize({ x: 1e-12, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe("v3.dist", () => {
  it("measures Euclidean distance between points", () => {
    const a = { x: 1, y: 2, z: 3 };
    const b = { x: 4, y: 6, z: 3 };
    expect(v3.distSq(a, b)).toBe(25);
    expect(v3.dist(a, b)).toBe(5);
    expect(v3.dist(a, a)).toBe(0);
  });
});
