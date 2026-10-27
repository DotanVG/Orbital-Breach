import { afterEach, describe, expect, it, vi } from 'vitest';
import { WelcomeScreen } from '../client/src/ui/welcome';
import { createWelcomeView } from '../client/src/ui/welcome/welcomeView';
import type { GlobalCursor } from '../client/src/ui/globalCursor';

vi.mock('../client/src/ui/welcome/welcomeView', () => ({
  injectWelcomeStyle: vi.fn(),
  createWelcomeView: vi.fn(),
  startWelcomeEffects: vi.fn(() => vi.fn()),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('WelcomeScreen keyboard navigation', () => {
  it('guards navigation from BODY in window capture and removes the guard on hide', () => {
    const windowMock = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('window', windowMock);
    const root = Object.assign(new EventTarget(), { remove: vi.fn() });
    const btn = Object.assign(new EventTarget(), { focus: vi.fn() });
    vi.mocked(createWelcomeView).mockReturnValue({ root, btn } as unknown as ReturnType<typeof createWelcomeView>);
    const welcome = new WelcomeScreen({ setHot: vi.fn() } as unknown as GlobalCursor);

    welcome.show();
    expect(welcome.isVisible()).toBe(true);
    expect(windowMock.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), true);
    const handleKeyDown = windowMock.addEventListener.mock.calls[0][1] as (event: Event) => void;

    for (const code of ['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', 'Enter', 'Space']) {
      const event = new Event('keydown', { bubbles: true, cancelable: true });
      Object.defineProperties(event, { code: { value: code }, target: { value: { tagName: 'BODY' } } });
      handleKeyDown(event);
      expect(event.cancelBubble, code).toBe(code !== 'Enter' && code !== 'Space');
      expect(event.defaultPrevented, code).toBe(false);
    }

    windowMock.removeEventListener.mockClear();
    welcome.hide();
    expect(welcome.isVisible()).toBe(false);
    expect(windowMock.removeEventListener).toHaveBeenCalledWith('keydown', handleKeyDown, true);
    expect(root.remove).toHaveBeenCalledOnce();
  });
});
