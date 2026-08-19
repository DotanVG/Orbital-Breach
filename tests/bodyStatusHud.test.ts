import { describe, expect, it } from "vitest";

import {
  buildBodyStatusHtml,
  damageStateSignature,
  getBodyStatusParts,
  getBodyStatusSummary,
} from "../client/src/render/hud/bodyStatus";
import type { DamageState } from "../shared/schema";

function makeDamageState(overrides: Partial<DamageState> = {}): DamageState {
  return {
    frozen: false,
    leftArm: false,
    rightArm: false,
    leftLeg: false,
    rightLeg: false,
    ...overrides,
  };
}

describe("body status HUD", () => {
  it("shows a nominal silhouette when the player is undamaged", () => {
    const damage = makeDamageState();

    expect(getBodyStatusSummary(damage)).toEqual({
      title: "Systems Nominal",
      detail: "No freeze damage",
      mobility: "Launch 100%",
    });
    expect(getBodyStatusParts(damage).every((part) => part.tone === "clear")).toBe(true);
    expect(buildBodyStatusHtml(damage)).toContain("Body Status");
  });

  it("marks only damaged limbs as partially frozen", () => {
    const damage = makeDamageState({ leftArm: true, rightLeg: true });
    const parts = getBodyStatusParts(damage);

    expect(getBodyStatusSummary(damage)).toEqual({
      title: "Partial Freeze",
      detail: "2 limbs impaired",
      mobility: "Launch 75%",
    });
    expect(parts.find((part) => part.id === "leftArm")?.tone).toBe("partial");
    expect(parts.find((part) => part.id === "rightLeg")?.tone).toBe("partial");
    expect(parts.find((part) => part.id === "core")?.tone).toBe("clear");
  });

  it("promotes the whole silhouette to critical when the player is frozen", () => {
    const damage = makeDamageState({
      frozen: true,
      leftArm: true,
      rightArm: true,
      leftLeg: true,
      rightLeg: true,
    });
    const parts = getBodyStatusParts(damage);
    const html = buildBodyStatusHtml(damage);

    expect(getBodyStatusSummary(damage)).toEqual({
      title: "Pilot Frozen",
      detail: "Core systems locked",
      mobility: "Launch offline",
    });
    expect(parts.every((part) => part.tone === "critical")).toBe(true);
    expect(html).toContain("ob-body-status__part--critical");
  });

  it("tracks body status signatures for cheap HUD rerenders", () => {
    expect(damageStateSignature(makeDamageState())).toBe("00000");
    expect(
      damageStateSignature(makeDamageState({ frozen: true, leftArm: true, rightLeg: true })),
    ).toBe("11001");
  });
});

describe("getBodyStatusSummary — wording and mobility ladder", () => {
  it("uses singular wording for exactly one impaired limb", () => {
    expect(getBodyStatusSummary(makeDamageState({ rightArm: true }))).toEqual({
      title: "Partial Freeze",
      detail: "1 limb impaired",
      mobility: "Launch 100%",
    });
  });

  it("steps mobility down with leg damage: 100% → 75% → 50%", () => {
    expect(getBodyStatusSummary(makeDamageState({ leftArm: true, rightArm: true })).mobility)
      .toBe("Launch 100%"); // arms never cost launch power
    expect(getBodyStatusSummary(makeDamageState({ leftLeg: true })).mobility).toBe("Launch 75%");
    expect(getBodyStatusSummary(makeDamageState({ rightLeg: true })).mobility).toBe("Launch 75%");
    expect(getBodyStatusSummary(makeDamageState({ leftLeg: true, rightLeg: true })).mobility)
      .toBe("Launch 50%");
  });

  it("reports frozen even when no individual limbs are flagged (head/body hit)", () => {
    const summary = getBodyStatusSummary(makeDamageState({ frozen: true }));
    expect(summary.title).toBe("Pilot Frozen");
    expect(summary.mobility).toBe("Launch offline");
  });
});

describe("damageStateSignature — rerender gating", () => {
  it("is collision-free across all 32 damage combinations", () => {
    const signatures = new Set<string>();
    for (let mask = 0; mask < 32; mask += 1) {
      signatures.add(damageStateSignature(makeDamageState({
        frozen: (mask & 1) !== 0,
        leftArm: (mask & 2) !== 0,
        rightArm: (mask & 4) !== 0,
        leftLeg: (mask & 8) !== 0,
        rightLeg: (mask & 16) !== 0,
      })));
    }
    expect(signatures.size).toBe(32);
  });
});

describe("getBodyStatusParts — diagram layout", () => {
  it("keeps the mirror-view part order: L Arm reads screen-left of R Arm", () => {
    const ids = getBodyStatusParts(makeDamageState()).map((part) => part.id);
    expect(ids).toEqual(["head", "leftArm", "core", "rightArm", "leftLeg", "rightLeg"]);
    expect(ids.indexOf("leftArm")).toBeLessThan(ids.indexOf("rightArm"));
    expect(ids.indexOf("leftLeg")).toBeLessThan(ids.indexOf("rightLeg"));
  });

  it("never marks head or core as partial — torso hits freeze outright", () => {
    const damage = makeDamageState({ leftArm: true, rightArm: true, leftLeg: true, rightLeg: true });
    const parts = getBodyStatusParts(damage);
    expect(parts.find((part) => part.id === "head")?.tone).toBe("clear");
    expect(parts.find((part) => part.id === "core")?.tone).toBe("clear");
  });
});

describe("buildBodyStatusHtml — tone classes", () => {
  it("renders each part with its own tone modifier class", () => {
    const html = buildBodyStatusHtml(makeDamageState({ leftArm: true }));
    expect(html).toContain("ob-body-status__part--leftArm ob-body-status__part--partial");
    expect(html).toContain("ob-body-status__part--rightArm ob-body-status__part--clear");
    expect(html).not.toContain("ob-body-status__part--critical");
  });

  it("includes the legend and summary copy", () => {
    const html = buildBodyStatusHtml(makeDamageState({ leftLeg: true }));
    expect(html).toContain("Partial Freeze");
    expect(html).toContain("1 limb impaired");
    expect(html).toContain("Launch 75%");
    expect(html).toContain("ob-body-status__swatch--clear");
    expect(html).toContain("ob-body-status__swatch--partial");
    expect(html).toContain("ob-body-status__swatch--critical");
  });
});
