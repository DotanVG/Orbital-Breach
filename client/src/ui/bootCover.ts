/** Hides the gameplay canvas and HUD until the direct menu has actually appeared. */
export function holdBootCoverUntilMenuPresented(menuRoot: HTMLElement): void {
  let settled = false;
  let removalObserver: MutationObserver | null = null;
  let motionQuery: MediaQueryList | null = null;
  const reveal = (): void => {
    if (settled) return;
    settled = true;
    menuRoot.removeEventListener('animationend', onPresentationEvent);
    menuRoot.removeEventListener('animationcancel', onPresentationEvent);
    removalObserver?.disconnect();
    removalObserver = null;
    motionQuery?.removeEventListener('change', onReducedMotion);
    motionQuery = null;
    document.body.classList.remove('boot-cover');
  };
  const onPresentationEvent = (event: Event): void => {
    if (event.target !== menuRoot) return;
    reveal();
  };
  const onReducedMotion = (): void => {
    if (motionQuery?.matches) reveal();
  };

  const animationName = getComputedStyle(menuRoot).animationName;
  if (!animationName || animationName.split(',').every((name) => name.trim() === 'none')) {
    reveal();
    return;
  }

  menuRoot.addEventListener('animationend', onPresentationEvent);
  // prefers-reduced-motion can set animation:none while the fade is running.
  // That cancels the animation and does not emit animationend.
  menuRoot.addEventListener('animationcancel', onPresentationEvent);
  if (typeof MutationObserver !== 'undefined') {
    removalObserver = new MutationObserver(() => {
      if (!menuRoot.isConnected) reveal();
    });
    removalObserver.observe(document.body, { childList: true, subtree: true });
  }
  if (typeof matchMedia === 'function') {
    motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) {
      reveal();
      return;
    }
    motionQuery.addEventListener('change', onReducedMotion);
  }
}

/** Portal arrival has no menu fade, so the match view is the presentation. */
export function revealBootCoverNow(): void {
  document.body.classList.remove('boot-cover');
}
