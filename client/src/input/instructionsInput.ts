export function canOpenInstructions(
  gameplayActive: boolean,
  sessionMenuOpen: boolean,
  matchEnding: boolean,
): boolean {
  return gameplayActive && !sessionMenuOpen && !matchEnding;
}

export function isInstructionsActivationKey(code: string): boolean {
  return code === 'Space';
}
