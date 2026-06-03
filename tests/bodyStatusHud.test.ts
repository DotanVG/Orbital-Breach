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
