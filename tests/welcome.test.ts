import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createWelcomeView, injectWelcomeStyle, startWelcomeEffects, stopEffects, enterFullscreen } = vi.hoisted(() => ({
  createWelcomeView: vi.fn(),
  injectWelcomeStyle: vi.fn(),
  startWelcomeEffects: vi.fn(),
  stopEffects: vi.fn(),
  enterFullscreen: vi.fn(),
}));
vi.mock('../client/src/ui/welcome/welcomeView', () => ({ createWelcomeView, injectWelcomeStyle, startWelcomeEffects }));
vi.mock('../client/src/ui/fullscreen', () => ({ enterFullscreen }));

import { WelcomeScreen } from '../client/src/ui/welcome';

describe('original Click-to-BREACH screen', () => {
  let root: EventTarget & { remove: ReturnType<typeof vi.fn>; classList: { add: ReturnType<typeof vi.fn> } };
  let btn: EventTarget;
  const cursor = { show: vi.fn(), hide: vi.fn(), setHot: vi.fn(), dispose: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    root = Object.assign(new EventTarget(), { remove: vi.fn(), classList: { add: vi.fn() } });
    btn = new EventTarget();
    createWelcomeView.mockReturnValue({ root, layer: {}, btn });
    startWelcomeEffects.mockReturnValue(stopEffects);
  });

  it('keeps the original full-screen art, parallax, and button without SEO body copy', () => {
    const view = readFileSync(new URL('../client/src/ui/welcome/welcomeView.ts', import.meta.url), 'utf8');
    expect(view).toContain('position: fixed; inset: 0; z-index: 20');
    expect(view).toContain("url('/orbital-breach-art.webp')");
    expect(view).toContain("url('/orbital-breach-art.png')");
    expect(view).toContain('data-depth="0.012"');
    expect(view).toContain('<button class="wc-btn" id="wc-btn">');
    expect(view).toContain('Click to BREACH');
    expect(view).not.toMatch(/#landing|id="landing"|visually-hidden|sr-only|<(?:main|h1|h2|p|section|details|noscript)\b/i);
  });

  it('shows the screen and keeps the original cursor hover effects', () => {
    const screen = new WelcomeScreen(cursor);
    expect(screen.isVisible()).toBe(false);
    screen.show();
    expect(screen.isVisible()).toBe(true);
    expect(injectWelcomeStyle).toHaveBeenCalledOnce();
    expect(startWelcomeEffects).toHaveBeenCalledOnce();
    btn.dispatchEvent(new Event('mouseenter'));
    expect(cursor.setHot).toHaveBeenLastCalledWith(true);
    btn.dispatchEvent(new Event('mouseleave'));
    expect(cursor.setHot).toHaveBeenLastCalledWith(false);
  });

  it.each([false, true])('requests fullscreen only on the welcome click when preference is %s, then opens the menu after fading', (preference) => {
    const screen = new WelcomeScreen(cursor);
    const showMenu = vi.fn();
    screen.onBreach = showMenu;
    screen.fullscreenOnClick = preference;
    screen.show();
    expect(enterFullscreen).not.toHaveBeenCalled();
    btn.dispatchEvent(new Event('pointerdown'));
    btn.dispatchEvent(new Event('keydown'));
    expect(enterFullscreen).not.toHaveBeenCalled();
    btn.dispatchEvent(new Event('click'));
    expect(enterFullscreen).toHaveBeenCalledTimes(preference ? 1 : 0);
    expect(root.classList.add).toHaveBeenCalledExactlyOnceWith('wc-fadeout');
    expect(showMenu).not.toHaveBeenCalled();
    root.dispatchEvent(new Event('animationend'));
    expect(stopEffects).toHaveBeenCalledOnce();
    expect(root.remove).toHaveBeenCalledOnce();
    expect(screen.isVisible()).toBe(false);
    expect(showMenu).toHaveBeenCalledOnce();
  });
});
