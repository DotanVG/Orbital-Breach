import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { cursor, welcome, prepareGame, start } = vi.hoisted(() => ({
  cursor: {},
  welcome: { show: vi.fn() },
  prepareGame: vi.fn(),
  start: vi.fn(),
}));
vi.mock('../client/node_modules/@vercel/analytics/dist/index.mjs', () => ({ inject: vi.fn() }));
vi.mock('../client/node_modules/@vercel/speed-insights/dist/index.mjs', () => ({ injectSpeedInsights: vi.fn() }));
vi.mock('../client/src/analytics/analytics', () => ({ trackLandingVisitOnce: vi.fn() }));
vi.mock('../client/src/ui/globalCursor', () => ({ initGlobalCursor: () => cursor }));
vi.mock('../client/src/ui/welcome', () => ({ WelcomeScreen: class { constructor() { return welcome; } } }));
vi.mock('../client/src/app', () => ({ prepareGame }));

describe('main startup routing', () => {
  const landing = { remove: vi.fn() };
  const addClass = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('document', {
      querySelector: () => landing,
      body: { classList: { add: addClass } },
    });
    vi.stubGlobal('localStorage', { getItem: () => null });
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(['?embed=1', '?portal=true'])('auto-enters %s after preparation without Start', async (search) => {
    vi.stubGlobal('window', { location: { search } });
    let ready!: (app: { start: typeof start }) => void;
    prepareGame.mockReturnValue(new Promise((resolve) => { ready = resolve; }));

    await import('../client/src/main');
    await vi.dynamicImportSettled();
    expect(prepareGame).toHaveBeenCalledExactlyOnceWith(cursor, undefined);
    expect(welcome.show).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
    expect(landing.remove).not.toHaveBeenCalled();

    ready({ start });
    await vi.dynamicImportSettled();
    expect(start).toHaveBeenCalledExactlyOnceWith(false);
    expect(landing.remove).toHaveBeenCalledOnce();
    expect(addClass).toHaveBeenCalledExactlyOnceWith('game-active');
  });

  it.each(['', '?embed=0&portal=false'])('keeps native entry %s deferred', async (search) => {
    vi.stubGlobal('window', { location: { search } });

    await import('../client/src/main');
    await vi.dynamicImportSettled();
    expect(welcome.show).toHaveBeenCalledOnce();
    expect(prepareGame).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
    expect(landing.remove).not.toHaveBeenCalled();
    expect(addClass).not.toHaveBeenCalled();
  });
});
