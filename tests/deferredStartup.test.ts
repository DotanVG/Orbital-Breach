import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { manager, construct, setContext, wakeBackend, canvas } = vi.hoisted(() => ({
  manager: { onLoad: undefined as (() => void) | undefined, onError: undefined as (() => void) | undefined },
  construct: vi.fn(),
  setContext: vi.fn(),
  wakeBackend: vi.fn(),
  canvas: { setAttribute: vi.fn() },
}));
vi.mock('three', () => ({ DefaultLoadingManager: manager, AudioContext: { setContext } }));
vi.mock('../client/src/game/gameApp', () => ({ App: class { constructor(cursor: unknown) { construct(cursor); } } }));
vi.mock('../client/src/net/wakeBackend', () => ({ wakeBackend }));

import { prepareGame } from '../client/src/app';
import type { GlobalCursor } from '../client/src/ui/globalCursor';

describe('deferred game preparation', () => {
  const cursor = {} as GlobalCursor;
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    vi.clearAllMocks();
    manager.onLoad = undefined;
    manager.onError = undefined;
    vi.stubGlobal('document', { querySelector: () => canvas });
  });

  it('does no game construction on import and waits for model/texture readiness after entry', async () => {
    expect(construct).not.toHaveBeenCalled();
    const previousLoad = vi.fn();
    manager.onLoad = previousLoad;
    const context = {} as AudioContext;
    const ready = vi.fn();
    const loading = prepareGame(cursor, context).then(ready);
    expect(construct).toHaveBeenCalledExactlyOnceWith(cursor);
    expect(setContext).toHaveBeenCalledExactlyOnceWith(context);
    expect(wakeBackend).toHaveBeenCalledOnce();
    await Promise.resolve();
    expect(ready).not.toHaveBeenCalled();
    manager.onLoad!();
    await loading;
    expect(ready).toHaveBeenCalledOnce();
    expect(manager.onLoad).toBe(previousLoad);
    expect(canvas.setAttribute).toHaveBeenCalledWith('aria-label', 'Orbital Breach game');
  });

  it('rejects failed assets and restores loading hooks for the readable retry path', async () => {
    const previousError = vi.fn();
    manager.onError = previousError;
    const loading = prepareGame(cursor);
    const failure = expect(loading).rejects.toThrow('Game assets could not load');
    manager.onError!();
    await failure;
    expect(manager.onError).toBe(previousError);
    expect(setContext).not.toHaveBeenCalled();
  });
});
