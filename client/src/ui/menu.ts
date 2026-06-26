import { createMenuView, injectMenuStyle, type MenuElements } from './menu/menuView';
import { isTouchDevice } from '../platform';
import { isMatchTeamSize, type MatchTeamSize } from '../../../shared/match';
import { validateCallSign } from '../../../shared/profanity';
import { DEFAULT_PLAYER_NAME } from '../../../shared/callSigns';

const STORAGE_KEY = 'orbital_player_name';
const MATCH_SIZE_STORAGE_KEY = 'orbital_match_size';

export interface PlaySelection {
  name: string;
  noBots?: boolean;
  teamSize: MatchTeamSize;
}

export class MainMenu {
  private menu: MenuElements | null = null;
  private styleEl: HTMLStyleElement | null = null;
  private menuListenerAbort: AbortController | null = null;
  private disposeMenuListeners: (() => void) | null = null;

  public onPlaySolo: ((selection: PlaySelection) => void) | null = null;
  public onPlayOnline: ((selection: PlaySelection) => void) | null = null;
  public onBrowseOnline: ((selection: PlaySelection) => void) | null = null;
  public onOpenInstructions: (() => void) | null = null;
  public onOpenSettings: (() => void) | null = null;
  public onOpenCredits: (() => void) | null = null;
  public onPlayTutorial: ((selection: PlaySelection) => void) | null = null;

  public show(): void {
    this.hide();
    if (!this.styleEl) {
      this.styleEl = injectMenuStyle();
    }

    const savedName = localStorage.getItem(STORAGE_KEY) ?? '';
    const savedSize = Number(localStorage.getItem(MATCH_SIZE_STORAGE_KEY) ?? '1');
    const elements = createMenuView(
      savedName,
      isMatchTeamSize(savedSize) ? savedSize : 1,
    );
    this.menu = elements;
    const listenerAbort = new AbortController();
    this.menuListenerAbort = listenerAbort;
    const listenerOptions = { signal: listenerAbort.signal };

    const handleNameInput = (): void => {
      const v = elements.nameInput.value.trim();
      if (v) localStorage.setItem(STORAGE_KEY, v);
      this.validateName(elements);
    };
    const handleMatchSizeChange = (): void => {
      localStorage.setItem(MATCH_SIZE_STORAGE_KEY, elements.matchSizeSelect.value);
    };
    const handlePlaySolo = (): void => {
      if (!this.checkNameBeforePlay(elements)) return;
      const selection = this.saveSelection();
      this.fadeOut(() => this.onPlaySolo?.(selection));
    };
    const handlePlayOnline = (): void => {
      if (!this.checkNameBeforePlay(elements)) return;
      const selection = this.saveSelection();
      this.fadeOut(() => this.onPlayOnline?.(selection));
    };
    const handleBrowseRooms = (): void => {
      if (!this.checkNameBeforePlay(elements)) return;
      this.onBrowseOnline?.(this.saveSelection());
    };
    const handleOpenInstructions = (): void => {
      this.onOpenInstructions?.();
    };
    const handleOpenSettings = (): void => {
      this.onOpenSettings?.();
    };
    const handleOpenCredits = (): void => {
      this.onOpenCredits?.();
    };
    const handlePlayTutorial = (): void => {
      if (!this.checkNameBeforePlay(elements)) return;
      const name = this.menu?.nameInput.value.trim() || DEFAULT_PLAYER_NAME;
      this.fadeOut(() => this.onPlayTutorial?.({ name, teamSize: 1, noBots: true }));
    };
    const handleRootKeyDown = (ev: KeyboardEvent): void => {
      if (ev.key !== 'Enter') return;
      const target = ev.target;
      if (
        target instanceof HTMLElement
        && (target.closest('button') || target.closest('select'))
      ) {
        return;
      }
      ev.preventDefault();
      elements.playSoloButton.click();
    };

    // Validate name on every keystroke
    elements.nameInput.addEventListener('input', handleNameInput, listenerOptions);
    elements.matchSizeSelect.addEventListener('change', handleMatchSizeChange, listenerOptions);
    if (!isTouchDevice()) {
      elements.nameInput.focus();
    }

    elements.playSoloButton.addEventListener('click', handlePlaySolo, listenerOptions);
    elements.playOnlineButton.addEventListener('click', handlePlayOnline, listenerOptions);
    elements.browseRoomsButton.addEventListener('click', handleBrowseRooms, listenerOptions);
    elements.openInstructionsButton.addEventListener('click', handleOpenInstructions, listenerOptions);
    elements.openSettingsButton.addEventListener('click', handleOpenSettings, listenerOptions);
    elements.openCreditsButton.addEventListener('click', handleOpenCredits, listenerOptions);
    elements.playTutorialButton.addEventListener('click', handlePlayTutorial, listenerOptions);

    // Enter anywhere in the menu triggers PLAY SOLO (quickest path).
    // Using the root container so it also fires while the name input is focused.
    elements.root.addEventListener('keydown', handleRootKeyDown, listenerOptions);

    this.disposeMenuListeners = () => {
      elements.nameInput.removeEventListener('input', handleNameInput);
      elements.matchSizeSelect.removeEventListener('change', handleMatchSizeChange);
      elements.playSoloButton.removeEventListener('click', handlePlaySolo);
      elements.playOnlineButton.removeEventListener('click', handlePlayOnline);
      elements.browseRoomsButton.removeEventListener('click', handleBrowseRooms);
      elements.openInstructionsButton.removeEventListener('click', handleOpenInstructions);
      elements.openSettingsButton.removeEventListener('click', handleOpenSettings);
      elements.openCreditsButton.removeEventListener('click', handleOpenCredits);
      elements.playTutorialButton.removeEventListener('click', handlePlayTutorial);
      elements.root.removeEventListener('keydown', handleRootKeyDown);
    };
  }

  public hide(): void {
    this.menuListenerAbort?.abort();
    this.menuListenerAbort = null;
    this.disposeMenuListeners?.();
    this.disposeMenuListeners = null;
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

  private validateName(elements: MenuElements): string | null {
    const raw = elements.nameInput.value;
    // Empty field is fine until the player tries to submit
    if (raw.trim().length === 0) {
      elements.nameError.textContent = '';
      elements.nameInput.classList.remove('menu-input--error');
      return null;
    }
    const err = validateCallSign(raw);
    elements.nameError.textContent = err ?? '';
    elements.nameInput.classList.toggle('menu-input--error', err !== null);
    return err;
  }

  /** Returns true when the name is acceptable and play can proceed. */
  private checkNameBeforePlay(elements: MenuElements): boolean {
    const raw = elements.nameInput.value.trim();
    const nameForValidation = raw.length === 0 ? DEFAULT_PLAYER_NAME : raw;
    const err = validateCallSign(nameForValidation);
    if (err) {
      elements.nameError.textContent = err;
      elements.nameInput.classList.add('menu-input--error');
      elements.nameInput.focus();
      return false;
    }
    elements.nameError.textContent = '';
    elements.nameInput.classList.remove('menu-input--error');
    return true;
  }

  private saveSelection(): PlaySelection {
    const name = this.menu?.nameInput.value.trim();
    const matchSizeValue = Number(this.menu?.matchSizeSelect.value ?? '1');
    const teamSize = isMatchTeamSize(matchSizeValue) ? matchSizeValue : 1;
    const finalName = name || DEFAULT_PLAYER_NAME;
    localStorage.setItem(STORAGE_KEY, finalName);
    localStorage.setItem(MATCH_SIZE_STORAGE_KEY, String(teamSize));
    return { name: finalName, teamSize };
  }
}
