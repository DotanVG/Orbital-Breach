import { describe, it, expect } from 'vitest';
import { cameraYawFacingBreachOpening } from '../client/src/game/cameraYawFromBreach';

describe('cameraYawFacingBreachOpening', () => {
  it('z-axis openings face along ±z', () => {
    expect(cameraYawFacingBreachOpening('z', -1)).toBe(0);
    expect(cameraYawFacingBreachOpening('z', 1)).toBe(Math.PI);
  });

  it('x-axis openings face along ±x', () => {
    expect(cameraYawFacingBreachOpening('x', -1)).toBe(Math.PI / 2);
    expect(cameraYawFacingBreachOpening('x', 1)).toBe(-Math.PI / 2);
  });

  it('y-axis openings fall back to 0 yaw', () => {
    expect(cameraYawFacingBreachOpening('y', 1)).toBe(0);
    expect(cameraYawFacingBreachOpening('y', -1)).toBe(0);
  });
});
