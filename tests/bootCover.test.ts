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
});
