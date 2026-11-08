/** Hides the gameplay canvas and HUD until the direct menu has actually appeared. */
export function holdBootCoverUntilMenuPresented(menuRoot: HTMLElement): void {
  const reveal = (): void => {
    document.body.classList.remove('boot-cover');
  };
  const animationName = getComputedStyle(menuRoot).animationName;
  if (!animationName || animationName.split(',').every((name) => name.trim() === 'none')) {
    reveal();
    return;
  }
  const onEnd = (event: Event): void => {
    if (event.target !== menuRoot) return;
    menuRoot.removeEventListener('animationend', onEnd);
    reveal();
  };
  menuRoot.addEventListener('animationend', onEnd);
}

/** Portal arrival has no menu fade, so the match view is the presentation. */
export function revealBootCoverNow(): void {
  document.body.classList.remove('boot-cover');
}
