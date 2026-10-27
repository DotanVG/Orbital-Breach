import type { GlobalCursor } from './globalCursor';
import {
  injectWelcomeStyle,
  createWelcomeView,
  startWelcomeEffects,
} from './welcome/welcomeView';
import { enterFullscreen } from './fullscreen';

export class WelcomeScreen {
  public onBreach: (() => void) | null = null;
  public fullscreenOnClick = false;

  private root: HTMLElement | null = null;
  private stopEffects: (() => void) | null = null;
  private active = false;

  // Capture even BODY-targeted navigation before the game's global listener.
  private readonly handleNavigationKeyDown = (event: KeyboardEvent): void => {
    if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.code)) {
      event.stopPropagation();
    }
  };

  constructor(private readonly cursor: GlobalCursor) {}

  show(): void {
    this.hide();
    injectWelcomeStyle();
    const { root, layer, btn } = createWelcomeView();
    this.root = root;
    this.active = true;
    this.stopEffects = startWelcomeEffects(root, layer, btn);

    window.addEventListener('keydown', this.handleNavigationKeyDown, true);

    btn.addEventListener('mouseenter', () => this.cursor.setHot(true));
    btn.addEventListener('mouseleave', () => this.cursor.setHot(false));
    btn.addEventListener('click', () => {
      if (this.fullscreenOnClick) enterFullscreen();
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        'requestPermission' in DeviceOrientationEvent &&
        typeof (DeviceOrientationEvent as { requestPermission?: () => Promise<string> }).requestPermission === 'function'
      ) {
        (DeviceOrientationEvent as { requestPermission: () => Promise<string> })
          .requestPermission()
          .catch(() => {});
      }
      this.fadeOut(() => {
        this.hide();
        document.body.classList.add('game-active');
        this.onBreach?.();
      });
    });
    btn.focus({ preventScroll: true });
  }

  fadeOut(cb: () => void): void {
    if (!this.root) { cb(); return; }
    const root = this.root;
    root.addEventListener('animationend', () => cb(), { once: true });
    root.classList.add('wc-fadeout');
  }

  hide(): void {
    window.removeEventListener('keydown', this.handleNavigationKeyDown, true);
    this.stopEffects?.();
    this.stopEffects = null;
    this.root?.remove();
    this.root = null;
    this.active = false;
  }

  isVisible(): boolean {
    return this.active;
  }
}
