import type { PlayerPhase } from "../../../../shared/schema";

export const FIRST_TIME_TUTORIAL_STORAGE_KEY = "orbital_first_flight_tutorial_v1";
export const FIRST_MATCH_STORAGE_KEY = "orbital_first_match_completed_v1";
export const INTRO_STORAGE_KEY = "orbital_visual_intro_v1";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface TutorialContext {
  currentBreachTeam: 0 | 1;
  frozen: boolean;
  inRound: boolean;
  mobile: boolean;
  phase: PlayerPhase;
  team: 0 | 1;
  dt?: number;
}

export interface TutorialPrompt {
  cue: "grab" | "launch" | "fire" | "breach";
  completed: boolean[];
  body: string;
  progress: string;
  title: string;
}

type TutorialStep = {
  cue: TutorialPrompt["cue"];
  desktopBody: string;
  mobileBody: string;
  title: string;
};

const STEPS: TutorialStep[] = [
  {
    cue: "grab",
    title: "Grab a bar",
    desktopBody: "Drift onto a rail and press [E] to lock in before you launch.",
    mobileBody: "Drift onto a rail and tap GRAB to lock in before you launch.",
  },
  {
    cue: "launch",
    title: "Launch into zero-G",
    desktopBody: "Hold [SPACE], pull down to charge, then release to slingshot.",
    mobileBody: "Hold LAUNCH, drag down to charge, then release to slingshot.",
  },
  {
    cue: "fire",
    title: "Fire a freeze shot",
    desktopBody: "Click to fire. A frozen enemy stays stranded for the round.",
    mobileBody: "Tap FIRE to shoot. A frozen enemy stays stranded for the round.",
  },
  {
    cue: "breach",
    title: "Breach to score",
    desktopBody: "Float through the enemy portal to win the point for your team.",
    mobileBody: "Drift through the enemy portal to win the point for your team.",
  },
];

/** Seconds since match start: hold, two brief pulses, then a 1.25 s ease-out. */
export function guidanceOpacity(elapsed: number, keepVisible: boolean, reducedMotion: boolean): number {
  if (keepVisible || elapsed < 4) return 1;
  const pulseTime = elapsed - 4;
  if (pulseTime < 0.8) {
    return reducedMotion ? 1 : 1 - 0.65 * Math.sin(Math.PI * pulseTime / 0.4) ** 2;
  }
  const fade = Math.min(1, Math.max(0, (pulseTime - 0.8) / 1.25));
  return (1 - fade) ** 3;
}

export class FirstTimeTutorial {
  private active = false;
  private guidanceElapsed = 0;
  private firstMatch = true;
  private tutorialMatch = false;
  private attachedLastFrame = false;
  private completed = [false, false, false, false];
  private introRemaining = 0;

  public constructor(private storage: StorageLike = resolveStorage()) {}

  public beginMatch(tutorial = false): void {
    this.firstMatch = this.storage.getItem(FIRST_MATCH_STORAGE_KEY) !== 'done';
    this.tutorialMatch = tutorial;
    this.guidanceElapsed = 0;
  }

  public completeMatch(): void {
    if (!this.tutorialMatch) this.storage.setItem(FIRST_MATCH_STORAGE_KEY, 'done');
  }

  public updateGuidance(dt: number, inRound: boolean, reducedMotion: boolean): number {
    const keepVisible = this.firstMatch || this.tutorialMatch || this.active || this.isIntroVisible();
    if (inRound && !keepVisible) this.guidanceElapsed += Math.max(0, dt);
    return guidanceOpacity(this.guidanceElapsed, keepVisible, reducedMotion);
  }

  public forceRestart(): void {
    this.storage.setItem(FIRST_TIME_TUTORIAL_STORAGE_KEY, "");
    this.storage.setItem(INTRO_STORAGE_KEY, "seen");
    this.active = true;
    this.completed.fill(false);
    this.attachedLastFrame = false;
    this.introRemaining = 7;
  }

  public beginRun(): void {
    if (this.isCompleted()) {
      this.active = false;
      return;
    }

    if (!this.active) {
      this.active = true;
      if (this.storage.getItem(INTRO_STORAGE_KEY) !== "seen") {
        this.introRemaining = 7;
        this.storage.setItem(INTRO_STORAGE_KEY, "seen");
      }
    }

    this.attachedLastFrame = false;
  }

  public noteShotFired(): void {
    if (!this.active) return;
    this.completed[2] = true;
  }

  public dismissIntro(): void {
    this.introRemaining = 0;
  }

  public isIntroVisible(): boolean {
    return this.introRemaining > 0;
  }

  public update(context: TutorialContext): TutorialPrompt | null {
    if (!this.active) return null;

    const attachedNow = isAttachedToBar(context.phase);
    // Observe every action, even when an earlier objective is still pending.
    if (!context.frozen && context.inRound) {
      this.completed[0] ||= attachedNow;
      this.completed[1] ||= this.attachedLastFrame && context.phase === "FLOATING";
      this.introRemaining = Math.max(0, this.introRemaining - (context.dt ?? 0));
    }
    this.completed[3] ||= context.phase === "BREACH" && context.currentBreachTeam !== context.team;
    this.attachedLastFrame = attachedNow && !context.frozen && context.inRound;

    const stepIndex = this.completed.indexOf(false);
    if (stepIndex === -1) {
      this.active = false;
      this.introRemaining = 0;
      this.storage.setItem(FIRST_TIME_TUTORIAL_STORAGE_KEY, "done");
    }

    if (!this.active || !context.inRound || context.frozen) {
      return null;
    }

    const step = STEPS[stepIndex];
    if (!step) return null;

    return {
      cue: step.cue,
      completed: [...this.completed],
      progress: `FIRST FLIGHT ${stepIndex + 1}/${STEPS.length}`,
      title: step.title,
      body: context.mobile ? step.mobileBody : step.desktopBody,
    };
  }

  private isCompleted(): boolean {
    return this.storage.getItem(FIRST_TIME_TUTORIAL_STORAGE_KEY) === "done";
  }
}

function isAttachedToBar(phase: PlayerPhase): boolean {
  return phase === "GRABBING" || phase === "AIMING";
}

function resolveStorage(): StorageLike {
  const fallback = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      try {
        return globalThis.localStorage?.getItem(key) ?? fallback.get(key) ?? null;
      } catch { /* Storage may be disabled in an embed. */ }
      return fallback.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      fallback.set(key, value);
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch { /* Keep onboarding usable without persistent storage. */ }
    },
  };
}
