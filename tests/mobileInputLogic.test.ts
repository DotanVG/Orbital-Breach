import { describe, it, expect } from 'vitest';
import {
  applyMobileLookDelta,
  mergeWalkAxes,
  type MobileLookState,
} from '../client/src/input/mobileInputLogic';

function makeState(overrides?: Partial<MobileLookState>): MobileLookState {
  return { touchLookDx: 0, touchLookDy: 0, aimDy: 0, ...overrides };
}

describe('applyMobileLookDelta', () => {
  it('routes dx to touchLookDx in both modes', () => {
    const s = makeState();
    applyMobileLookDelta(s, false, 10, 0);
    expect(s.touchLookDx).toBe(10);
  });

  it('routes dy to touchLookDy when not aiming', () => {
    const s = makeState();
    applyMobileLookDelta(s, false, 0, 5);
    expect(s.touchLookDy).toBe(5);
    expect(s.aimDy).toBe(0);
  });

  it('routes dy to aimDy when aiming active', () => {
    const s = makeState();
    applyMobileLookDelta(s, true, 0, 5);
    expect(s.aimDy).toBe(5);
    expect(s.touchLookDy).toBe(0);
  });

  it('accumulates multiple calls', () => {
    const s = makeState();
    applyMobileLookDelta(s, false, 3, 4);
    applyMobileLookDelta(s, false, 1, 2);
    expect(s.touchLookDx).toBe(4);
    expect(s.touchLookDy).toBe(6);
  });

  it('switches routing mid-drag when aimingActive changes', () => {
    const s = makeState();
    applyMobileLookDelta(s, false, 0, 10);
    applyMobileLookDelta(s, true, 0, 20);
    expect(s.touchLookDy).toBe(10);
    expect(s.aimDy).toBe(20);
  });

  it('negative dx accumulates correctly', () => {
    const s = makeState({ touchLookDx: 5 });
    applyMobileLookDelta(s, false, -8, 0);
    expect(s.touchLookDx).toBe(-3);
  });
});

describe('mergeWalkAxes', () => {
  it('returns keyboard axis when no mobile input', () => {
    expect(mergeWalkAxes(1, 0, 0, 0)).toEqual({ x: 1, z: 0 });
  });

  it('returns mobile axis when no keyboard input', () => {
    expect(mergeWalkAxes(0, 0, 0.5, 0.8)).toEqual({ x: 0.5, z: 0.8 });
  });

  it('sums keyboard and mobile axes', () => {
    expect(mergeWalkAxes(0.5, 0, 0.3, 0)).toEqual({ x: 0.8, z: 0 });
  });

  it('clamps sum to 1 when both push same direction', () => {
    expect(mergeWalkAxes(1, 0, 1, 0)).toEqual({ x: 1, z: 0 });
  });

  it('clamps sum to -1 when both push negative direction', () => {
    expect(mergeWalkAxes(-1, 0, -0.8, 0)).toEqual({ x: -1, z: 0 });
  });

  it('does not clamp when inputs cancel out', () => {
    expect(mergeWalkAxes(1, 0, -1, 0)).toEqual({ x: 0, z: 0 });
  });

  it('handles diagonal inputs independently on both axes', () => {
    const result = mergeWalkAxes(0.6, 0.4, 0.3, 0.5);
    expect(result.x).toBeCloseTo(0.9);
    expect(result.z).toBeCloseTo(0.9);
  });
});

