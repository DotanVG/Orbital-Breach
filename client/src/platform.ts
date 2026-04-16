export function isTouchDevice(): boolean {
  return navigator.maxTouchPoints > 0;
}

export function getViewportSize(): { width: number; height: number } {
  const vv = window.visualViewport;
  if (vv) return { width: Math.round(vv.width), height: Math.round(vv.height) };
  return { width: window.innerWidth, height: window.innerHeight };
}
