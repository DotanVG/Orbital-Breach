import { afterEach, describe, expect, it, vi } from 'vitest';
import { holdBootCoverUntilMenuPresented, revealBootCoverNow } from '../client/src/ui/bootCover';

describe('boot cover', () => {
  const classes = new Set<string>();

  afterEach(() => {
    classes.clear();
    vi.unstubAllGlobals();
  });

  function installDocument(): void {
    classes.add('boot-cover');
    vi.stubGlobal('document', {
      body: {
        classList: {
          contains: (name: string) => classes.has(name),
          remove: (name: string) => classes.delete(name),
        },
      },
    });
  }

  it('keeps the cover through the menu fade and lifts it when that fade ends', () => {
    installDocument();
    vi.stubGlobal('getComputedStyle', () => ({ animationName: 'ob-menuFadeIn' }));
    const menu = new EventTarget();

    holdBootCoverUntilMenuPresented(menu as HTMLElement);

    expect(classes.has('boot-cover')).toBe(true);
    menu.dispatchEvent(new Event('animationend'));
    expect(classes.has('boot-cover')).toBe(false);
  });

  it('lifts the cover immediately when the menu does not animate', () => {
    installDocument();
    vi.stubGlobal('getComputedStyle', () => ({ animationName: 'none' }));

    holdBootCoverUntilMenuPresented(new EventTarget() as HTMLElement);

    expect(classes.has('boot-cover')).toBe(false);
  });

  it('lifts the cover immediately for a route with no menu', () => {
    installDocument();

    revealBootCoverNow();

    expect(classes.has('boot-cover')).toBe(false);
  });

  it('lifts the cover when reduced motion starts matching during the fade', () => {
    installDocument();
    vi.stubGlobal('getComputedStyle', () => ({ animationName: 'ob-menuFadeIn' }));
    const query = {
      matches: false,
      addEventListener: (_type: string, callback: () => void) => {
        query.notify = callback;
      },
      removeEventListener: () => {
        query.notify = null;
      },
      notify: null as null | (() => void),
    };
    vi.stubGlobal('matchMedia', () => query);
    const menu = new EventTarget();

    holdBootCoverUntilMenuPresented(menu as HTMLElement);

    expect(classes.has('boot-cover')).toBe(true);
    query.matches = true;
    query.notify?.();
    expect(classes.has('boot-cover')).toBe(false);
    query.notify?.();
    expect(classes.has('boot-cover')).toBe(false);
  });

  it('lifts the cover when reduced motion cancels the fade', () => {
    installDocument();
    vi.stubGlobal('getComputedStyle', () => ({ animationName: 'ob-menuFadeIn' }));
    const menu = new EventTarget();

    holdBootCoverUntilMenuPresented(menu as HTMLElement);

    expect(classes.has('boot-cover')).toBe(true);
    menu.dispatchEvent(new Event('animationcancel'));
    expect(classes.has('boot-cover')).toBe(false);
  });

  it('lifts the cover when Play removes the menu before the fade ends', () => {
    installDocument();
    vi.stubGlobal('getComputedStyle', () => ({ animationName: 'ob-menuFadeIn' }));
    const notifications: Array<() => void> = [];
    class RemovalObserver {
      constructor(callback: () => void) {
        notifications.push(callback);
      }
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('MutationObserver', RemovalObserver);
    const menu = new EventTarget() as HTMLElement;
    let connected = true;
    Object.defineProperty(menu, 'isConnected', { configurable: true, get: () => connected });

    holdBootCoverUntilMenuPresented(menu);

    expect(classes.has('boot-cover')).toBe(true);
    connected = false;
    for (const notify of notifications) notify();
    expect(classes.has('boot-cover')).toBe(false);
    for (const notify of notifications) notify();
    menu.dispatchEvent(new Event('animationcancel'));
    expect(classes.has('boot-cover')).toBe(false);
  });
});
