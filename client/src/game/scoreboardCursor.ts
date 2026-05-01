export interface ScoreboardCursorContext {
  desktop: boolean;
  gameplayActive: boolean;
  pointerLocked: boolean;
  restorePointerLockAfterScoreboard: boolean;
  sessionMenuOpen: boolean;
}

export interface ScoreboardCursorTransition {
  exitPointerLock: boolean;
  hideCursor: boolean;
  nextRestorePointerLockAfterScoreboard: boolean;
  requestPointerLock: boolean;
  showCursor: boolean;
}

const NOOP_TRANSITION: ScoreboardCursorTransition = {
  exitPointerLock: false,
  hideCursor: false,
  nextRestorePointerLockAfterScoreboard: false,
  requestPointerLock: false,
  showCursor: false,
};

export function getScoreboardCursorTransition(
  held: boolean,
  context: ScoreboardCursorContext,
): ScoreboardCursorTransition {
  const eligible = context.desktop && context.gameplayActive && !context.sessionMenuOpen;
  if (!eligible) {
    return NOOP_TRANSITION;
  }

  if (held) {
    return {
      exitPointerLock: context.pointerLocked,
      hideCursor: false,
      nextRestorePointerLockAfterScoreboard: context.pointerLocked,
      requestPointerLock: false,
      showCursor: true,
    };
  }

  return {
    exitPointerLock: false,
    hideCursor: true,
    nextRestorePointerLockAfterScoreboard: false,
    requestPointerLock: context.restorePointerLockAfterScoreboard,
    showCursor: false,
  };
}
