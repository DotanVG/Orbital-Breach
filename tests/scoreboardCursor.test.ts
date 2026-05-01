import { describe, expect, it } from "vitest";

import { getScoreboardCursorTransition } from "../client/src/game/scoreboardCursor";

describe("getScoreboardCursorTransition", () => {
  it("shows the cursor and exits pointer lock when Tab opens the desktop scoreboard", () => {
    expect(
      getScoreboardCursorTransition(true, {
        desktop: true,
        gameplayActive: true,
        pointerLocked: true,
        restorePointerLockAfterScoreboard: false,
        sessionMenuOpen: false,
      }),
    ).toEqual({
      exitPointerLock: true,
      hideCursor: false,
      nextRestorePointerLockAfterScoreboard: true,
      requestPointerLock: false,
      showCursor: true,
    });
  });

  it("re-locks pointer and hides the cursor when Tab is released", () => {
    expect(
      getScoreboardCursorTransition(false, {
        desktop: true,
        gameplayActive: true,
        pointerLocked: false,
        restorePointerLockAfterScoreboard: true,
        sessionMenuOpen: false,
      }),
    ).toEqual({
      exitPointerLock: false,
      hideCursor: true,
      nextRestorePointerLockAfterScoreboard: false,
      requestPointerLock: true,
      showCursor: false,
    });
  });

  it("ignores scoreboard cursor changes outside desktop gameplay", () => {
    expect(
      getScoreboardCursorTransition(true, {
        desktop: false,
        gameplayActive: true,
        pointerLocked: true,
        restorePointerLockAfterScoreboard: false,
        sessionMenuOpen: false,
      }),
    ).toEqual({
      exitPointerLock: false,
      hideCursor: false,
      nextRestorePointerLockAfterScoreboard: false,
      requestPointerLock: false,
      showCursor: false,
    });
  });

  it("does not try to restore pointer lock while the session menu is open", () => {
    expect(
      getScoreboardCursorTransition(false, {
        desktop: true,
        gameplayActive: true,
        pointerLocked: false,
        restorePointerLockAfterScoreboard: true,
        sessionMenuOpen: true,
      }),
    ).toEqual({
      exitPointerLock: false,
      hideCursor: false,
      nextRestorePointerLockAfterScoreboard: false,
      requestPointerLock: false,
      showCursor: false,
    });
  });
});
