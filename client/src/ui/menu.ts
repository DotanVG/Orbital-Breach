import { createMenuView, injectMenuStyle, type MenuElements } from './menu/menuView';
import { isTouchDevice } from '../platform';

const STORAGE_KEY = 'orbital_player_name';

/**
 * MainMenu controller: injects the style once, mounts/unmounts the view
 * element, wires up the play button + name-input persistence, and drives
 * the fade-out transition before handing off to the game.
 */
export class MainMenu {
  private menu: MenuElements | null = null;
  private styleEl: HTMLStyleElement | null = null;

  public onPlay: (() => void) | null = null;

  public show(): void {
    this.hide();
    if (!this.styleEl) {
      this.styleEl = injectMenuStyle();
    }

    const savedName = localStorage.getItem(STORAGE_KEY) ?? '';
    const elements = createMenuView(savedName);
    this.menu = elements;

    elements.nameInput.addEventListener('input', () => {
      const v = elements.nameInput.value.trim();
      if (v) localStorage.setItem(STORAGE_KEY, v);
    });
    // Skip auto-focus on mobile to avoid unwanted virtual keyboard on load
    if (!isTouchDevice()) {
      elements.nameInput.focus();
    }

    elements.playButton.addEventListener('click', () => {
      this.saveName();
      this.fadeOut(() => this.onPlay?.());
    });
  }

  public hide(): void {
    this.menu?.container.remove();
    this.menu = null;
  }

  public fadeOut(cb?: () => void): void {
    const root = this.menu?.root;
    if (!root) { cb?.(); return; }
    root.style.transition = 'opacity 0.22s ease-out, transform 0.22s ease-out';
    root.style.opacity = '0';
    root.style.transform = 'translateY(-6px)';
    root.style.pointerEvents = 'none';
    setTimeout(() => { this.hide(); cb?.(); }, 240);
  }

  public isVisible(): boolean {
    return this.menu !== null;
  }

  public dispose(): void {
    this.hide();
    this.styleEl?.remove();
    this.styleEl = null;
  }

  private saveName(): void {
    const name = this.menu?.nameInput.value.trim();
    if (name) localStorage.setItem(STORAGE_KEY, name);
  }
}
