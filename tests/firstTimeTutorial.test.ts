import { describe, expect, it } from "vitest";

import {
  FirstTimeTutorial,
  FIRST_TIME_TUTORIAL_STORAGE_KEY,
  type TutorialContext,
} from "../client/src/render/hud/tutorial";

class MemoryStorage {
  private values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function makeContext(overrides: Partial<TutorialContext> = {}): TutorialContext {
  return {
    currentBreachTeam: 0,
    frozen: false,
    inRound: true,
    mobile: false,
    phase: "FLOATING",
    team: 0,
    ...overrides,
  };
}

describe("FirstTimeTutorial", () => {
  it("walks through the grab, launch, fire, and breach prompts once", () => {
    const storage = new MemoryStorage();
    const tutorial = new FirstTimeTutorial(storage);

    tutorial.beginRun();

    expect(tutorial.update(makeContext())?.title).toBe("Grab a bar");
    expect(tutorial.update(makeContext({ phase: "GRABBING" }))?.title).toBe("Launch into zero-G");
    expect(tutorial.update(makeContext({ phase: "FLOATING" }))?.title).toBe("Fire a freeze shot");

    tutorial.noteShotFired();
    expect(tutorial.update(makeContext({ phase: "FLOATING" }))?.title).toBe("Breach to score");
    expect(tutorial.update(makeContext({ phase: "BREACH", currentBreachTeam: 1 }))).toBeNull();
    expect(storage.getItem(FIRST_TIME_TUTORIAL_STORAGE_KEY)).toBe("done");
  });

  it("stays silent after completion has been stored", () => {
    const storage = new MemoryStorage();
    storage.setItem(FIRST_TIME_TUTORIAL_STORAGE_KEY, "done");

    const tutorial = new FirstTimeTutorial(storage);
    tutorial.beginRun();

    expect(tutorial.update(makeContext())).toBeNull();
  });
});
