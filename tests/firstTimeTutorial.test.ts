import { describe, expect, it, vi } from "vitest";

import {
  FirstTimeTutorial,
  FIRST_MATCH_STORAGE_KEY,
  guidanceOpacity,
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

// Full-match completion is independent from the four tutorial objectives.
describe('match guidance visibility', () => {
  it('keeps the entire first match visible even after onboarding and across rounds', () => {
    const storage=new MemoryStorage(); storage.setItem(FIRST_TIME_TUTORIAL_STORAGE_KEY,'done');
    const tutorial=new FirstTimeTutorial(storage); tutorial.beginMatch(); tutorial.beginRun();
    expect(tutorial.updateGuidance(120,true,false)).toBe(1);
    tutorial.beginRun(); expect(tutorial.updateGuidance(120,true,false)).toBe(1);
    tutorial.completeMatch(); expect(tutorial.updateGuidance(120,true,false)).toBe(1);
    expect(storage.getItem(FIRST_MATCH_STORAGE_KEY)).toBe('done');
  });
  it('shows later matches, pulses twice, softly fades, then stays hidden', () => {
    expect(guidanceOpacity(0,false,false)).toBe(1);
    expect(guidanceOpacity(3.9,false,false)).toBe(1);
    expect(guidanceOpacity(4.2,false,false)).toBeCloseTo(.35);
    expect(guidanceOpacity(4.4,false,false)).toBeCloseTo(1);
    expect(guidanceOpacity(4.6,false,false)).toBeCloseTo(.35);
    expect(guidanceOpacity(4.8,false,false)).toBeCloseTo(1);
    expect(guidanceOpacity(5.425,false,false)).toBeCloseTo(.125);
    expect(guidanceOpacity(6.05,false,false)).toBeCloseTo(0);
    expect(guidanceOpacity(90,false,false)).toBe(0);
    expect(guidanceOpacity(90,true,false)).toBe(1);
  });
  it('keeps reduced-motion guidance steady before the same soft fade', () => {
    for(const t of [4,4.1,4.2,4.4,4.6,4.8]) expect(guidanceOpacity(t,false,true)).toBeCloseTo(1);
    expect(guidanceOpacity(5.425,false,true)).toBeCloseTo(.125);
    expect(guidanceOpacity(6.05,false,true)).toBeCloseTo(0);
  });
  it('persists completion across instances and resets timing only at a new match', () => {
    const storage=new MemoryStorage(); storage.setItem(FIRST_TIME_TUTORIAL_STORAGE_KEY,'done');
    const first=new FirstTimeTutorial(storage); first.beginMatch(); first.completeMatch();
    const later=new FirstTimeTutorial(storage); later.beginMatch(); later.beginRun();
    expect(later.updateGuidance(7,true,false)).toBe(0);
    later.beginRun(); expect(later.updateGuidance(0,true,false)).toBe(0);
    later.beginMatch(); expect(later.updateGuidance(0,true,false)).toBe(1);
  });
  it('protects tutorial replay for the whole session and does not count it as the first normal match', () => {
    const storage=new MemoryStorage(); const tutorial=new FirstTimeTutorial(storage);
    tutorial.beginMatch(true); tutorial.beginRun();
    expect(tutorial.updateGuidance(120,true,false)).toBe(1);
    tutorial.completeMatch(); expect(storage.getItem(FIRST_MATCH_STORAGE_KEY)).toBeNull();
    storage.setItem(FIRST_MATCH_STORAGE_KEY,'done');
    tutorial.beginMatch(true); expect(tutorial.updateGuidance(120,true,false)).toBe(1);
  });
  it('protects unfinished onboarding and pauses the timer outside a live round', () => {
    const storage=new MemoryStorage(); storage.setItem(FIRST_MATCH_STORAGE_KEY,'done');
    const tutorial=new FirstTimeTutorial(storage); tutorial.beginMatch(); tutorial.beginRun();
    expect(tutorial.updateGuidance(90,true,false)).toBe(1);
    storage.setItem(FIRST_TIME_TUTORIAL_STORAGE_KEY,'done'); tutorial.beginRun(); tutorial.dismissIntro();
    expect(tutorial.updateGuidance(90,false,false)).toBe(1);
    expect(tutorial.updateGuidance(7,true,false)).toBe(0);
  });
  it('works when the browser blocks both localStorage access and writes', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    try {
      const tutorial=new FirstTimeTutorial(); tutorial.beginMatch(); tutorial.completeMatch();
      tutorial.beginMatch();
      // Complete onboarding using the same guarded fallback store.
      tutorial.beginRun(); tutorial.dismissIntro(); tutorial.noteShotFired();
      tutorial.update(makeContext({phase:'GRABBING'})); tutorial.update(makeContext({phase:'FLOATING'}));
      tutorial.update(makeContext({phase:'BREACH',currentBreachTeam:1}));
      expect(tutorial.updateGuidance(7,true,false)).toBe(0);
    } finally { vi.unstubAllGlobals(); }
  });
});
