import { describe, expect, it } from 'vitest';
import { formatDistance, placeDestination } from '../client/src/render/hud/destination';

describe('formatDistance', () => {
  it('rounds live distances to metres without negative or invalid labels', () => {
    expect(formatDistance(24.6)).toBe('25 m');
    expect(formatDistance(0.1)).toBe('0 m');
    expect(formatDistance(-1)).toBe('0 m');
    expect(formatDistance(Infinity)).toBe('—');
    expect(formatDistance(NaN)).toBe('—');
  });
});

describe('placeDestination', () => {
  it('anchors a visible target at its projected position', () => {
    expect(placeDestination({ x: 0, y: 0, z: -10 }, 1280, 720, 90))
      .toMatchObject({ x: 640, y: 360, edge: false });
    expect(placeDestination({ x: 1, y: 1, z: -10 }, 1280, 720, 90))
      .toMatchObject({ x: 676, y: 324, edge: false });
  });

  it('keeps offscreen labels inside landscape, portrait and short viewports', () => {
    for (const [width, height] of [[1280, 720], [390, 844], [844, 390]]) {
      for (const point of [
        { x: 100, y: 30, z: -1 },
        { x: -100, y: -30, z: -1 },
        { x: 0, y: 0, z: 10 },
        { x: 1, y: 2, z: 0 },
      ]) {
        const marker = placeDestination(point, width, height, 75);
        expect(marker.edge).toBe(true);
        expect(marker.x).toBeGreaterThanOrEqual(110);
        expect(marker.x).toBeLessThanOrEqual(width - 110);
        expect(marker.y).toBeGreaterThanOrEqual(105);
        expect(marker.y).toBeLessThanOrEqual(height - 105);
        expect(Number.isFinite(marker.angle)).toBe(true);
      }
    }
  });

  it('points toward targets behind the camera without mirroring left/right', () => {
    expect(placeDestination({ x: -10, y: 0, z: 10 }, 1280, 720, 75).x).toBe(110);
    expect(placeDestination({ x: 10, y: 0, z: 10 }, 1280, 720, 75).x).toBe(1170);
    expect(placeDestination({ x: 0, y: 0, z: 10 }, 1280, 720, 75).x).toBe(1170);
  });
});
