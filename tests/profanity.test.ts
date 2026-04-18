import { describe, it, expect } from "vitest";
import { isCallSignClean, normalizeCallSign, validateCallSign } from "../shared/profanity";

// ── normalizeCallSign ─────────────────────────────────────────────────────────

describe("normalizeCallSign", () => {
  it("lowercases input", () => {
    expect(normalizeCallSign("ALPHA")).toBe("alpha");
  });

  it("replaces leet digits", () => {
    expect(normalizeCallSign("n1gg3r")).toBe("nigger");
    expect(normalizeCallSign("f4g")).toBe("fag");
    expect(normalizeCallSign("$lut")).toBe("slut");
  });

  it("strips non-alpha after substitution", () => {
    expect(normalizeCallSign("c-u-n-t")).toBe("cunt");
    expect(normalizeCallSign("n.i.g.g.e.r")).toBe("nigger");
  });

  it("handles vv → w substitution", () => {
    expect(normalizeCallSign("vvhore")).toBe("whore");
  });

  it("handles @ → a", () => {
    expect(normalizeCallSign("f@ggot")).toBe("faggot");
  });
});

// ── isCallSignClean ───────────────────────────────────────────────────────────

describe("isCallSignClean — blocked words", () => {
  // Racial slurs
  it("blocks nigger", () => expect(isCallSignClean("nigger")).toBe(false));
  it("blocks nigga", () => expect(isCallSignClean("nigga")).toBe(false));
  it("blocks chink", () => expect(isCallSignClean("chink")).toBe(false));
  it("blocks spic", () => expect(isCallSignClean("spic")).toBe(false));
  it("blocks kike", () => expect(isCallSignClean("kike")).toBe(false));
  it("blocks coon", () => expect(isCallSignClean("coon")).toBe(false));
  it("blocks paki", () => expect(isCallSignClean("paki")).toBe(false));
  it("blocks redskin", () => expect(isCallSignClean("redskin")).toBe(false));
  it("blocks wetback", () => expect(isCallSignClean("wetback")).toBe(false));
  it("blocks gook", () => expect(isCallSignClean("gook")).toBe(false));

  // Gender / sexuality slurs
  it("blocks faggot", () => expect(isCallSignClean("faggot")).toBe(false));
  it("blocks tranny", () => expect(isCallSignClean("tranny")).toBe(false));
  it("blocks dyke", () => expect(isCallSignClean("dyke")).toBe(false));
  it("blocks shemale", () => expect(isCallSignClean("shemale")).toBe(false));
  it("blocks whore", () => expect(isCallSignClean("whore")).toBe(false));
  it("blocks slut", () => expect(isCallSignClean("slut")).toBe(false));
  it("blocks cunt", () => expect(isCallSignClean("cunt")).toBe(false));

  // Ableism
  it("blocks retard", () => expect(isCallSignClean("retard")).toBe(false));
  it("blocks spaz", () => expect(isCallSignClean("spaz")).toBe(false));

  // Hate / harassment
  it("blocks kys", () => expect(isCallSignClean("kys")).toBe(false));
  it("blocks nazi", () => expect(isCallSignClean("nazi")).toBe(false));
  it("blocks pedo", () => expect(isCallSignClean("pedo")).toBe(false));
});

describe("isCallSignClean — leet / symbol evasion", () => {
  it("blocks n1gg3r (leet)", () => expect(isCallSignClean("n1gg3r")).toBe(false));
  it("blocks f4gg0t (leet)", () => expect(isCallSignClean("f4gg0t")).toBe(false));
  it("blocks $lut ($ → s)", () => expect(isCallSignClean("$lut")).toBe(false));
  it("blocks n.i.g.g.e.r (dots)", () => expect(isCallSignClean("n.i.g.g.e.r")).toBe(false));
  it("blocks c-u-n-t (dashes)", () => expect(isCallSignClean("c-u-n-t")).toBe(false));
  it("blocks NIGGER (caps)", () => expect(isCallSignClean("NIGGER")).toBe(false));
  it("blocks vvhore (vv→w)", () => expect(isCallSignClean("vvhore")).toBe(false));
  it("blocks f@gg0t (@ and 0)", () => expect(isCallSignClean("f@gg0t")).toBe(false));
  it("blocks KYS (uppercase)", () => expect(isCallSignClean("KYS")).toBe(false));
});

describe("isCallSignClean — allowed names", () => {
  it("allows Pilot", () => expect(isCallSignClean("Pilot")).toBe(true));
  it("allows StarFox42", () => expect(isCallSignClean("StarFox42")).toBe(true));
  it("allows NovaPilot", () => expect(isCallSignClean("NovaPilot")).toBe(true));
  it("allows ZeroG_Ace", () => expect(isCallSignClean("ZeroG_Ace")).toBe(true));
  it("allows xXx_Destroyer", () => expect(isCallSignClean("xXx_Destroyer")).toBe(true));
  it("allows CyanBlazer", () => expect(isCallSignClean("CyanBlazer")).toBe(true));
  it("allows GhostZero", () => expect(isCallSignClean("GhostZero")).toBe(true));
  it("allows ShadowByte", () => expect(isCallSignClean("ShadowByte")).toBe(true));
  it("allows 1337Ace", () => expect(isCallSignClean("1337Ace")).toBe(true));
  it("allows empty string (empty → skip, handled by validateCallSign)", () =>
    expect(isCallSignClean("")).toBe(true));
});

// ── validateCallSign ──────────────────────────────────────────────────────────

describe("validateCallSign", () => {
  it("returns null for clean names", () => {
    expect(validateCallSign("Pilot")).toBeNull();
    expect(validateCallSign("GhostByte")).toBeNull();
  });

  it("returns error for empty name", () => {
    expect(validateCallSign("")).not.toBeNull();
    expect(validateCallSign("   ")).not.toBeNull();
  });

  it("returns error for name > 16 chars", () => {
    expect(validateCallSign("A".repeat(17))).not.toBeNull();
  });

  it("returns null for name exactly 16 chars", () => {
    expect(validateCallSign("A".repeat(16))).toBeNull();
  });

  it("returns error for profane name", () => {
    expect(validateCallSign("nigger")).not.toBeNull();
    expect(validateCallSign("slut")).not.toBeNull();
  });

  it("error message is a non-empty string", () => {
    const err = validateCallSign("faggot");
    expect(typeof err).toBe("string");
    expect(err!.length).toBeGreaterThan(0);
  });
});
