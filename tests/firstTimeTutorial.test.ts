import { describe, expect, it } from "vitest";

import {
  FirstTimeTutorial,
  FIRST_TIME_TUTORIAL_STORAGE_KEY,
  INTRO_STORAGE_KEY,
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

  it('remembers a shot and breach completed before grab and launch', () => {
    const tutorial = new FirstTimeTutorial(new MemoryStorage());
    tutorial.beginRun();
    tutorial.noteShotFired();
    const prompt = tutorial.update(makeContext({ phase: 'BREACH', currentBreachTeam: 1 }));
    expect(prompt?.cue).toBe('grab');
    expect(prompt?.completed).toEqual([false, false, true, true]);
    tutorial.update(makeContext({ phase: 'GRABBING' }));
    expect(tutorial.update(makeContext({ phase: 'FLOATING' }))).toBeNull();
  });

  it('keeps completed objectives across round starts without treating spawn as a launch', () => {
    const tutorial = new FirstTimeTutorial(new MemoryStorage());
    tutorial.beginRun();
    tutorial.noteShotFired();
    tutorial.update(makeContext({ phase: 'GRABBING' }));
    tutorial.beginRun();
    const prompt = tutorial.update(makeContext({ phase: 'FLOATING' }));
    expect(prompt?.cue).toBe('launch');
    expect(prompt?.completed).toEqual([true, false, true, false]);
  });

  it('does not count frozen attachment or hide later steps permanently while frozen', () => {
    const tutorial = new FirstTimeTutorial(new MemoryStorage());
    tutorial.beginRun();
    expect(tutorial.update(makeContext({ phase: 'GRABBING', frozen: true }))).toBeNull();
    expect(tutorial.update(makeContext())?.completed).toEqual([false, false, false, false]);
  });

  it('auto-dismisses the short intro and remembers its first view', () => {
    const storage = new MemoryStorage();
    const tutorial = new FirstTimeTutorial(storage);
    tutorial.beginRun();
    expect(tutorial.isIntroVisible()).toBe(true);
    tutorial.update(makeContext({ dt: 7 }));
    expect(tutorial.isIntroVisible()).toBe(false);
    expect(storage.getItem(INTRO_STORAGE_KEY)).toBe('seen');
    const revisit = new FirstTimeTutorial(storage);
    revisit.beginRun();
    expect(revisit.isIntroVisible()).toBe(false);
  });

  it('supports one-tap dismissal and explicit tutorial replay', () => {
    const tutorial = new FirstTimeTutorial(new MemoryStorage());
    tutorial.beginRun();
    tutorial.dismissIntro();
    expect(tutorial.isIntroVisible()).toBe(false);
    tutorial.noteShotFired();
    tutorial.forceRestart();
    expect(tutorial.update(makeContext())?.completed).toEqual([false, false, false, false]);
    expect(tutorial.isIntroVisible()).toBe(true);
  });

  it('replays even after completion was persisted on an earlier visit', () => {
    const storage = new MemoryStorage();
    storage.setItem(FIRST_TIME_TUTORIAL_STORAGE_KEY, 'done');
    storage.setItem(INTRO_STORAGE_KEY, 'seen');
    const tutorial = new FirstTimeTutorial(storage);
    tutorial.beginRun();
    expect(tutorial.update(makeContext())).toBeNull();
    tutorial.forceRestart();
    tutorial.beginRun();
    expect(tutorial.update(makeContext())?.completed).toEqual([false, false, false, false]);
    expect(tutorial.isIntroVisible()).toBe(true);
    expect(storage.getItem(FIRST_TIME_TUTORIAL_STORAGE_KEY)).not.toBe('done');
  });
});
