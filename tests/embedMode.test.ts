import { describe, expect, it } from "vitest";

import { isEmbedMode } from "../client/src/embed";

describe("isEmbedMode", () => {
  it("returns true when embed is explicitly enabled", () => {
    expect(isEmbedMode("?embed=1")).toBe(true);
  });

  it("returns false for missing or disabled embed params", () => {
    expect(isEmbedMode("")).toBe(false);
    expect(isEmbedMode("?embed=0")).toBe(false);
    expect(isEmbedMode("?embed=true")).toBe(false);
  });

  it("handles embed alongside other query params", () => {
    expect(isEmbedMode("?roomId=abc&embed=1")).toBe(true);
  });
});
