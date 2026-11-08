import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  armMenuEntryGesture,
  shouldRequestFullscreenOnMenuGesture,
} from '../client/src/ui/entryGesture';

describe('menu entry gesture policy', () => {
  it('requests fullscreen only for a normal visit with the preference enabled', () => {
    expect(shouldRequestFullscreenOnMenuGesture({
      embedMode: false,
      portalArrival: false,
      fullscreenPreference: true,
    })).toBe(true);
    expect(shouldRequestFullscreenOnMenuGesture({
      embedMode: false,
      portalArrival: false,
      fullscreenPreference: false,
    })).toBe(false);
  });

  it('keeps embed and portal routes from requesting fullscreen on the menu gesture', () => {
    for (const route of [
      { embedMode: true, portalArrival: false },
      { embedMode: false, portalArrival: true },
      { embedMode: true, portalArrival: true },
    ]) {
      expect(shouldRequestFullscreenOnMenuGesture({ ...route, fullscreenPreference: true })).toBe(false);
    }
  });
});

describe('armMenuEntryGesture', () => {
  function arm(overrides: Partial<Parameters<typeof armMenuEntryGesture>[0]> = {}) {
    const target = new EventTarget();
    const unlockAudio = vi.fn(() => Promise.resolve());
    const requestFullscreen = vi.fn(() => Promise.resolve(true));
    const dispose = armMenuEntryGesture({
      requestFullscreenOnGesture: true,
      isMenuVisible: () => true,
      unlockAudio,
      requestFullscreen,
      target,
      ...overrides,
    });
    return { target, unlockAudio, requestFullscreen, dispose };
  }

  function dispatch(target: EventTarget, type: string): void {
    target.dispatchEvent(new Event(type));
  }

  it('does nothing until a user gesture', () => {
    const { unlockAudio, requestFullscreen } = arm();
    expect(unlockAudio).not.toHaveBeenCalled();
    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  it('unlocks audio and requests fullscreen on the menu pointer or touch gesture', async () => {
    for (const type of ['pointerdown', 'touchstart']) {
      const { target, unlockAudio, requestFullscreen } = arm();
      dispatch(target, type);
      expect(requestFullscreen).toHaveBeenCalledOnce();
      expect(unlockAudio).toHaveBeenCalledOnce();
      await Promise.resolve();
      dispatch(target, type);
      expect(requestFullscreen).toHaveBeenCalledOnce();
      expect(unlockAudio).toHaveBeenCalledOnce();
    }
  });

  it('still fullscreens the later menu click after typing unlocks audio', async () => {
    const { target, unlockAudio, requestFullscreen } = arm();
    dispatch(target, 'keydown');
    await Promise.resolve();
    expect(unlockAudio).toHaveBeenCalledOnce();
    expect(requestFullscreen).not.toHaveBeenCalled();

    dispatch(target, 'click');
    expect(requestFullscreen).toHaveBeenCalledOnce();
    expect(unlockAudio).toHaveBeenCalledOnce();
  });

  it('fullscreens a keyboard-activated menu click without treating typing as fullscreen', async () => {
    const { target, unlockAudio, requestFullscreen } = arm();
    dispatch(target, 'keydown');
    expect(requestFullscreen).not.toHaveBeenCalled();
    expect(unlockAudio).toHaveBeenCalledOnce();
    await Promise.resolve();

    const clickOnly = arm();
    dispatch(clickOnly.target, 'click');
    expect(clickOnly.requestFullscreen).toHaveBeenCalledOnce();
    expect(clickOnly.unlockAudio).not.toHaveBeenCalled();
  });

  it('unlocks audio without fullscreen when the preference, route, or menu does not allow it', async () => {
    for (const overrides of [
      { requestFullscreenOnGesture: false },
      { isMenuVisible: () => false },
    ]) {
      const { target, unlockAudio, requestFullscreen } = arm(overrides);
      dispatch(target, 'pointerdown');
      expect(requestFullscreen).not.toHaveBeenCalled();
      expect(unlockAudio).toHaveBeenCalledOnce();
      await Promise.resolve();
    }
  });

  it('retries one rejected menu fullscreen gesture, then keeps the successful entry', async () => {
    const requestFullscreen = vi.fn<() => Promise<boolean>>()
      .mockRejectedValueOnce(new DOMException('injected rejection', 'NotAllowedError'))
      .mockResolvedValueOnce(true);
    const { target } = arm({ requestFullscreen });

    dispatch(target, 'pointerdown');
    await Promise.resolve();
    await Promise.resolve();
    expect(requestFullscreen).toHaveBeenCalledOnce();

    dispatch(target, 'pointerdown');
    await Promise.resolve();
    await Promise.resolve();
    expect(requestFullscreen).toHaveBeenCalledTimes(2);

    dispatch(target, 'pointerdown');
    expect(requestFullscreen).toHaveBeenCalledTimes(2);
  });

  it('does not start a second fullscreen request while the first is still pending', async () => {
    let settle: (entered: boolean) => void = () => {};
    const requestFullscreen = vi.fn(() => new Promise<boolean>((resolve) => {
      settle = resolve;
    }));
    const { target } = arm({ requestFullscreen });

    dispatch(target, 'pointerdown');
    dispatch(target, 'click');
    expect(requestFullscreen).toHaveBeenCalledOnce();

    settle(false);
    await Promise.resolve();
    dispatch(target, 'click');
    await Promise.resolve();
    expect(requestFullscreen).toHaveBeenCalledTimes(2);
  });

  it('retries audio after a rejected unlock and requests fullscreen only once', async () => {
    const unlockAudio = vi.fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('blocked'))
      .mockResolvedValueOnce(undefined);
    const { target, requestFullscreen } = arm({ unlockAudio });

    dispatch(target, 'pointerdown');
    await Promise.resolve();
    expect(requestFullscreen).toHaveBeenCalledOnce();
    expect(unlockAudio).toHaveBeenCalledOnce();

    dispatch(target, 'pointerdown');
    await Promise.resolve();
    expect(unlockAudio).toHaveBeenCalledTimes(2);
    expect(requestFullscreen).toHaveBeenCalledOnce();

    dispatch(target, 'pointerdown');
    expect(unlockAudio).toHaveBeenCalledTimes(2);
  });
});

describe('entry wiring', () => {
  it('keeps boot free of landing controls and arms fullscreen from the game menu gesture', () => {
    const main = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8');
    const gameApp = readFileSync(new URL('../client/src/game/gameApp.ts', import.meta.url), 'utf8');
    const menuQa = readFileSync(new URL('../scripts/qa/menu-responsive.mjs', import.meta.url), 'utf8');
    expect(main).not.toMatch(/AudioContext|enterFullscreen|requestFullscreen|#landing|#wc-btn|WelcomeScreen|prepareGame/);
    expect(menuQa).not.toMatch(/#wc-btn|#landing/);
    expect(menuQa).toContain('#menu-root');
    expect(menuQa).toContain('#btn-play-solo');
    expect(gameApp).toContain('armMenuEntryGesture');
    expect(gameApp).toContain('shouldRequestFullscreenOnMenuGesture');
    expect(gameApp).toMatch(/portalArrivalPending[\s\S]*embedMode[\s\S]*menu\.show\(\)/);
  });
});
