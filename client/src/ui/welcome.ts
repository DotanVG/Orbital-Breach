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

  private root: HTMLDivElement | null = null;
  private stopEffects: (() => void) | null = null;
  private active = false;
  private cancelFade: (() => void) | null = null;

  constructor(private readonly cursor: GlobalCursor) {}

  show(): void {
    this.hide();
    injectWelcomeStyle();
    const { root, layer, btn } = createWelcomeView();
    this.root = root;
    this.active = true;
    this.stopEffects = startWelcomeEffects(root, layer, btn);

    btn.addEventListener('mouseenter', () => this.cursor.setHot(true));
    btn.addEventListener('mouseleave', () => this.cursor.setHot(false));
    let breached = false;
    btn.addEventListener('click', () => {
      if (breached) return;
      breached = true;
      if (this.fullscreenOnClick) enterFullscreen();
      this.fadeOut(() => {
        this.hide();
        this.onBreach?.();
      });
    });
  }

  fadeOut(cb: () => void): void {
    this.cancelFade?.();
    if (!this.root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cb();
      return;
    }
    const root = this.root;
    let completed = false;
    const finish = () => {
      if (completed) return;
      cancel();
      cb();
    };
    const timer = setTimeout(finish, 450); // 300 ms CSS fade + 150 ms margin.
    const cancel = () => {
      completed = true;
      clearTimeout(timer);
      root.removeEventListener('animationend', finish);
      this.cancelFade = null;
    };
    this.cancelFade = cancel;
    root.addEventListener('animationend', finish, { once: true });
    root.classList.add('wc-fadeout');
  }

  hide(): void {
    this.cancelFade?.();
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
