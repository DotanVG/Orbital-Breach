export interface MenuGestureRoute {
  embedMode: boolean;
  portalArrival: boolean;
  fullscreenPreference: boolean;
}

/** Fullscreen still needs a user gesture. Embed and portal entry do not take one. */
export function shouldRequestFullscreenOnMenuGesture(route: MenuGestureRoute): boolean {
  return route.fullscreenPreference && !route.embedMode && !route.portalArrival;
}

export interface MenuEntryGestureOptions {
  requestFullscreenOnGesture: boolean;
  isMenuVisible: () => boolean;
  unlockAudio: () => Promise<void>;
  requestFullscreen: () => void;
  target?: EventTarget;
}

/**
 * Audio unlock stays on the first pointer, key, or touch.
 * Fullscreen is a separate menu click or tap, so typing a call sign does not enter fullscreen.
 */
export function armMenuEntryGesture(options: MenuEntryGestureOptions): () => void {
  const target = options.target ?? document;
  let audioListening = true;
  let fullscreenListening = options.requestFullscreenOnGesture;

  const stopAudio = (): void => {
    if (!audioListening) return;
    audioListening = false;
    target.removeEventListener('pointerdown', onAudio);
    target.removeEventListener('keydown', onAudio);
    target.removeEventListener('touchstart', onAudio);
  };

  const stopFullscreen = (): void => {
    if (!fullscreenListening) return;
    fullscreenListening = false;
    target.removeEventListener('pointerdown', onFullscreen);
    target.removeEventListener('touchstart', onFullscreen);
    target.removeEventListener('click', onFullscreen);
  };

  const onAudio = (): void => {
    void options.unlockAudio().then(stopAudio, () => {
      // Keep listening so a later gesture can retry audio unlock.
    });
  };

  const onFullscreen = (): void => {
    if (!options.isMenuVisible()) return;
    options.requestFullscreen();
    stopFullscreen();
  };

  target.addEventListener('pointerdown', onAudio);
  target.addEventListener('keydown', onAudio);
  target.addEventListener('touchstart', onAudio, { passive: true });
  if (options.requestFullscreenOnGesture) {
    target.addEventListener('pointerdown', onFullscreen);
    target.addEventListener('touchstart', onFullscreen, { passive: true });
    target.addEventListener('click', onFullscreen);
  }

  return () => {
    stopAudio();
    stopFullscreen();
  };
}
