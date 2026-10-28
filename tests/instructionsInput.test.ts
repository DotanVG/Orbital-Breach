import { describe, expect, it } from 'vitest';
import { canOpenInstructions, isInstructionsActivationKey } from '../client/src/input/instructionsInput';

describe('canOpenInstructions', () => {
  it('allows the playing scene with no competing overlay', () => {
    expect(canOpenInstructions(true, false, false)).toBe(true);
  });

  it('ignores H outside gameplay (menu, lobby, debrief)', () => {
    expect(canOpenInstructions(false, false, false)).toBe(false);
  });

  it('rejects the match-end celebration while the arena is still active', () => {
    expect(canOpenInstructions(true, false, true)).toBe(false);
  });

  it('does not let H steal input from the session menu', () => {
    expect(canOpenInstructions(true, true, false)).toBe(false);
  });
});

describe('isInstructionsActivationKey', () => {
  it.each(['Space', 'Enter', 'NumpadEnter'])('reserves %s for gameplay on the launcher', code => {
    expect(isInstructionsActivationKey(code)).toBe(true);
  });

  it.each(['KeyH', 'Escape', 'Tab', 'KeyE'])('preserves %s handling', code => {
    expect(isInstructionsActivationKey(code)).toBe(false);
  });
});
