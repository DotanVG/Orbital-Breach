import type { GlobalCursor } from './globalCursor';
import {
  injectWelcomeStyle,
  createWelcomeView,
  startWelcomeEffects,
} from './welcome/welcomeView';
import { enterFullscreen } from './fullscreen';

export class WelcomeScreen {
  public onBreach: (() => void) | null = null;
  public onPrepare: (() => Promise<void>) | null = null;
  public onLoadError: (() => void) | null = null;
  public fullscreenOnClick = false;

  private root: HTMLElement | null = null;
  private stopEffects: (() => void) | null = null;
  private active = false;

  constructor(private readonly cursor: GlobalCursor) {}

  show(): void {
    this.hide();
    injectWelcomeStyle();
    const { root, layer, btn } = createWelcomeView();
    this.root = root;
    this.active = true;
    this.stopEffects = startWelcomeEffects(root, layer, btn);

    // Keep landing navigation out of the game's global keyboard listener.
    root.addEventListener('keydown', (event) => {
      if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.code)) {
        event.stopPropagation();
      }
    });

    btn.addEventListener('mouseenter', () => this.cursor.setHot(true));
    btn.addEventListener('mouseleave', () => this.cursor.setHot(false));
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.textContent = 'Loading…';
      const status = root.querySelector<HTMLElement>('#landing-status')!;
      status.hidden = false;
      status.textContent = 'Loading the game, models and audio…';
      try {
        // Prime audio before fullscreen or orientation permission consumes activation.
        const preparation = this.onPrepare?.();
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
        await preparation;
      } catch {
        this.onLoadError?.();
        return;
      }
      this.fadeOut(() => {
        this.hide();
        document.body.classList.add('game-active');
        this.onBreach?.();
      });
    }, { once: true });
    btn.focus({ preventScroll: true });
  }

  fadeOut(cb: () => void): void {
    if (!this.root) { cb(); return; }
    const root = this.root;
    root.addEventListener('animationend', () => cb(), { once: true });
    root.classList.add('wc-fadeout');
  }

  hide(): void {
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
