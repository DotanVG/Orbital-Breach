import { isApparentFullscreen, isFullscreenSupported, onFullscreenChange } from "./fullscreen";
import { getInstructionsContent } from "./instructionsContent";
import { buildSessionMenuMarkup } from "./sessionMenuView";
import { injectSessionMenuStyle } from "./sessionMenuStyle";
import { isTouchDevice } from "../platform";

export { buildInstructionsHtml } from "./sessionMenuView";

export interface SessionSettings {
  mouseSensitivity: number;
  musicVolume: number;
  soundtrackEnabled: boolean;
  fullscreenEnabled: boolean;
  sfxVolume: number;
  defaultCameraMode: "first" | "third";
  collisionVisEnabled: boolean;
}

export interface SessionMenuConfig {
  mainMenuLabel?: string | null;
  resumeLabel?: string | null;
  subtitle: string;
  title: string;
}

type SessionMenuView = "settings" | "instructions" | "credits";

export const SESSION_MENU_GEAR_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

const STORAGE_KEYS = {
  mouseSensitivity: "orbital_mouse_sensitivity",
  musicVolume: "orbital_music_volume",
  soundtrackEnabled: "orbital_soundtrack_enabled",
  fullscreenEnabled: "orbital_fullscreen_enabled",
  sfxVolume: "orbital_sfx_volume",
  defaultCameraMode: "orbital_default_camera_mode",
  collisionVisEnabled: "orbital_collision_vis",
} as const;

const DEFAULT_SETTINGS: SessionSettings = {
  mouseSensitivity: 0.002,
  soundtrackEnabled: true,
  fullscreenEnabled: true,
  musicVolume: 60,
  sfxVolume: 50,
  defaultCameraMode: "first",
  collisionVisEnabled: false,
};

export class SessionMenu {
  private readonly launcher: HTMLButtonElement;
  private readonly root: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly subtitle: HTMLDivElement;
  private readonly resumeButton: HTMLButtonElement;
  private readonly mainMenuButton: HTMLButtonElement;
  private readonly settingsView: HTMLDivElement;
  private readonly instructionsView: HTMLDivElement;
  private readonly creditsView: HTMLDivElement;
  private readonly openInstructionsButton: HTMLButtonElement;
  private readonly openCreditsButton: HTMLButtonElement;
  private readonly backToSettingsFromInstructionsButton: HTMLButtonElement;
  private readonly backToSettingsButton: HTMLButtonElement;
  private readonly sensitivityInput: HTMLInputElement;
  private readonly sensitivityValue: HTMLSpanElement;
  private readonly soundtrackInput: HTMLInputElement;
  private readonly soundtrackValue: HTMLSpanElement;
  private readonly fullscreenInput: HTMLInputElement;
  private readonly fullscreenValue: HTMLSpanElement;
  private readonly musicInput: HTMLInputElement;
  private readonly musicValue: HTMLSpanElement;
  private readonly sfxInput: HTMLInputElement;
  private readonly sfxValue: HTMLSpanElement;
  private readonly cameraSelect: HTMLSelectElement;
  private readonly collisionVisInput: HTMLInputElement;
  private readonly collisionVisValue: HTMLSpanElement;
  private readonly disposeFullscreenListener: () => void;
  private settings = loadSettings();
  private currentConfig: SessionMenuConfig | null = null;

  public onLauncherRequest: (() => void) | null = null;
  public onMainMenu: (() => void) | null = null;
  public onResume: (() => void) | null = null;
  public onSettingsChange: ((settings: SessionSettings) => void) | null = null;

  public constructor() {
    injectSessionMenuStyle();
    const instructionsContent = getInstructionsContent(isTouchDevice());

    this.launcher = document.createElement("button");
    this.launcher.type = "button";
    this.launcher.className = "ob-session-launcher";
    this.launcher.setAttribute("aria-label", "Settings");
    this.launcher.innerHTML = SESSION_MENU_GEAR_ICON;
    this.launcher.addEventListener("click", () => this.onLauncherRequest?.());
    document.body.appendChild(this.launcher);

    this.root = document.createElement("div");
    this.root.className = "ob-session-root";
    this.root.innerHTML = buildSessionMenuMarkup(instructionsContent);
    document.body.appendChild(this.root);

    this.title = this.query("#session-menu-title");
    this.subtitle = this.query("#session-menu-subtitle");
    this.resumeButton = this.query("#session-menu-resume");
    this.mainMenuButton = this.query("#session-menu-main");
    this.settingsView = this.query("#session-menu-settings-view");
    this.instructionsView = this.query("#session-menu-instructions-view");
    this.creditsView = this.query("#session-menu-credits-view");
    this.openInstructionsButton = this.query("#session-menu-open-instructions");
    this.openCreditsButton = this.query("#session-menu-open-credits");
    this.backToSettingsFromInstructionsButton = this.query("#session-menu-back-to-settings-from-instructions");
    this.backToSettingsButton = this.query("#session-menu-back-to-settings");
    this.sensitivityInput = this.query("#session-menu-sensitivity");
    this.sensitivityValue = this.query("#session-menu-sensitivity-value");
    this.soundtrackInput = this.query("#session-menu-soundtrack");
    this.soundtrackValue = this.query("#session-menu-soundtrack-value");
    this.fullscreenInput = this.query("#session-menu-fullscreen");
    this.fullscreenValue = this.query("#session-menu-fullscreen-value");
    this.musicInput = this.query("#session-menu-music");
    this.musicValue = this.query("#session-menu-music-value");
    this.sfxInput = this.query("#session-menu-sfx");
    this.sfxValue = this.query("#session-menu-sfx-value");
    this.cameraSelect = this.query("#session-menu-camera");
    this.collisionVisInput = this.query("#session-menu-collisionvis");
    this.collisionVisValue = this.query("#session-menu-collisionvis-value");

    this.resumeButton.addEventListener("click", () => this.onResume?.());
    this.mainMenuButton.addEventListener("click", () => this.onMainMenu?.());
    this.openInstructionsButton.addEventListener("click", () => this.showView("instructions"));
    this.openCreditsButton.addEventListener("click", () => this.showView("credits"));
    this.backToSettingsFromInstructionsButton.addEventListener("click", () => this.showView("settings"));
    this.backToSettingsButton.addEventListener("click", () => this.showView("settings"));

    this.sensitivityInput.addEventListener("input", () => {
      this.settings.mouseSensitivity = Number(this.sensitivityInput.value) / 10000;
      this.persistSettings();
      this.renderSettings();
      this.onSettingsChange?.(this.getSettings());
    });
    this.soundtrackInput.addEventListener("change", () => {
      this.settings.soundtrackEnabled = this.soundtrackInput.checked;
      this.persistSettings();
      this.renderSettings();
      this.onSettingsChange?.(this.getSettings());
    });
    this.fullscreenInput.addEventListener("change", () => {
      this.settings.fullscreenEnabled = this.fullscreenInput.checked;
      this.persistSettings();
      this.renderSettings();
      this.onSettingsChange?.(this.getSettings());
    });
    this.musicInput.addEventListener("input", () => {
      this.settings.musicVolume = Number(this.musicInput.value);
      this.persistSettings();
      this.renderSettings();
      this.onSettingsChange?.(this.getSettings());
    });
    this.sfxInput.addEventListener("input", () => {
      this.settings.sfxVolume = Number(this.sfxInput.value);
      this.persistSettings();
      this.renderSettings();
      this.onSettingsChange?.(this.getSettings());
    });
    this.cameraSelect.addEventListener("change", () => {
      this.settings.defaultCameraMode = this.cameraSelect.value === "third" ? "third" : "first";
      this.persistSettings();
      this.renderSettings();
      this.onSettingsChange?.(this.getSettings());
    });
    this.collisionVisInput.addEventListener("change", () => {
      this.settings.collisionVisEnabled = this.collisionVisInput.checked;
      this.persistSettings();
      this.renderSettings();
      this.onSettingsChange?.(this.getSettings());
    });
    this.disposeFullscreenListener = onFullscreenChange(() => {
      this.syncFullscreenFromBrowser();
    });

    this.renderSettings();
  }

  public getSettings(): SessionSettings {
    return { ...this.settings };
  }

  public isOpen(): boolean {
    return this.root.style.display === "flex";
  }

  public open(config: SessionMenuConfig, initialView: SessionMenuView = "settings"): void {
    this.currentConfig = config;
    this.title.textContent = config.title;
    this.subtitle.textContent = config.subtitle;

    if (config.resumeLabel) {
      this.resumeButton.style.display = "flex";
      this.resumeButton.textContent = config.resumeLabel;
    } else {
      this.resumeButton.style.display = "none";
    }

    if (config.mainMenuLabel) {
      this.mainMenuButton.style.display = "flex";
      this.mainMenuButton.textContent = config.mainMenuLabel;
    } else {
      this.mainMenuButton.style.display = "none";
    }

    const actions = this.root.querySelector<HTMLElement>(".ob-session-actions");
    actions?.classList.toggle(
      "ob-session-actions--single",
      !config.resumeLabel || !config.mainMenuLabel,
    );

    this.showView(initialView);
    this.root.style.display = "flex";
  }

  public close(): void {
    this.showView("settings");
    this.root.style.display = "none";
  }

  public setLauncherVisible(visible: boolean): void {
    this.launcher.style.display = visible ? "inline-flex" : "none";
  }

  public syncFullscreenFromBrowser(notify = true): void {
    const fullscreenEnabled = isFullscreenSupported() && isApparentFullscreen();
    if (this.settings.fullscreenEnabled === fullscreenEnabled) {
      this.renderSettings();
      return;
    }

    this.settings.fullscreenEnabled = fullscreenEnabled;
    this.persistSettings();
    this.renderSettings();
    if (notify) this.onSettingsChange?.(this.getSettings());
  }

  public dispose(): void {
    this.disposeFullscreenListener();
    this.root.remove();
    this.launcher.remove();
  }

  private persistSettings(): void {
    localStorage.setItem(STORAGE_KEYS.mouseSensitivity, String(this.settings.mouseSensitivity));
    localStorage.setItem(STORAGE_KEYS.musicVolume, String(this.settings.musicVolume));
    localStorage.setItem(STORAGE_KEYS.fullscreenEnabled, String(this.settings.fullscreenEnabled));
    localStorage.setItem(STORAGE_KEYS.sfxVolume, String(this.settings.sfxVolume));
    localStorage.setItem(STORAGE_KEYS.defaultCameraMode, this.settings.defaultCameraMode);
    localStorage.setItem(STORAGE_KEYS.collisionVisEnabled, String(this.settings.collisionVisEnabled));
  }

  private renderSettings(): void {
    this.sensitivityInput.value = String(Math.round(this.settings.mouseSensitivity * 10000));
    this.sensitivityValue.textContent = `${(this.settings.mouseSensitivity * 1000).toFixed(1)}x`;
    this.soundtrackInput.checked = this.settings.soundtrackEnabled;
    this.soundtrackValue.textContent = this.settings.soundtrackEnabled ? "On" : "Off";
    const fullscreenSupported = isFullscreenSupported();
    this.fullscreenInput.checked = this.settings.fullscreenEnabled && fullscreenSupported;
    this.fullscreenInput.disabled = !fullscreenSupported;
    this.fullscreenValue.textContent = fullscreenSupported
      ? (this.settings.fullscreenEnabled ? "On" : "Off")
      : "Unavailable";
    this.musicInput.value = String(this.settings.musicVolume);
    this.musicValue.textContent = `${Math.round(this.settings.musicVolume)}%`;
    this.sfxInput.value = String(this.settings.sfxVolume);
    this.sfxValue.textContent = `${Math.round(this.settings.sfxVolume)}%`;
    this.cameraSelect.value = this.settings.defaultCameraMode;
    this.collisionVisInput.checked = this.settings.collisionVisEnabled;
    this.collisionVisValue.textContent = this.settings.collisionVisEnabled ? "On" : "Off";
  }

  private showView(view: SessionMenuView): void {
    this.settingsView.hidden = view !== "settings";
    this.instructionsView.hidden = view !== "instructions";
    this.creditsView.hidden = view !== "credits";

    if (!this.currentConfig) return;

    if (view === "instructions") {
      const instructionsContent = getInstructionsContent(isTouchDevice());
      this.title.textContent = instructionsContent.title;
      this.subtitle.textContent = instructionsContent.subtitle;
      return;
    }

    if (view === "credits") {
      this.title.textContent = "Credits";
      this.subtitle.textContent = "Music, sound, asset, and project credits for Orbital Breach.";
      return;
    }

    this.title.textContent = this.currentConfig.title;
    this.subtitle.textContent = this.currentConfig.subtitle;
  }

  private query<T extends HTMLElement>(selector: string): T {
    return this.root.querySelector<T>(selector) as T;
  }
}

function loadSettings(): SessionSettings {
  const sensitivity = Number(localStorage.getItem(STORAGE_KEYS.mouseSensitivity) ?? DEFAULT_SETTINGS.mouseSensitivity);
  // Always default music to ON; stale persisted off values silently muted audio.
  localStorage.removeItem(STORAGE_KEYS.soundtrackEnabled);
  const fullscreenEnabled = isFullscreenSupported()
    ? localStorage.getItem(STORAGE_KEYS.fullscreenEnabled)
    : "false";
  const musicVolume = Number(localStorage.getItem(STORAGE_KEYS.musicVolume) ?? DEFAULT_SETTINGS.musicVolume);
  const sfxVolume = Number(localStorage.getItem(STORAGE_KEYS.sfxVolume) ?? DEFAULT_SETTINGS.sfxVolume);
  const savedCameraMode = localStorage.getItem(STORAGE_KEYS.defaultCameraMode);

  return {
    mouseSensitivity: Number.isFinite(sensitivity) ? clamp(sensitivity, 0.0005, 0.004) : DEFAULT_SETTINGS.mouseSensitivity,
    soundtrackEnabled: true,
    fullscreenEnabled: fullscreenEnabled == null ? DEFAULT_SETTINGS.fullscreenEnabled : fullscreenEnabled === "true",
    musicVolume: Number.isFinite(musicVolume) ? clamp(musicVolume, 0, 100) : DEFAULT_SETTINGS.musicVolume,
    sfxVolume: Number.isFinite(sfxVolume) ? clamp(sfxVolume, 0, 100) : DEFAULT_SETTINGS.sfxVolume,
    defaultCameraMode: savedCameraMode === "third" ? "third" : "first",
    collisionVisEnabled: localStorage.getItem(STORAGE_KEYS.collisionVisEnabled) === "true",
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
