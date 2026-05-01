type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export function enterFullscreen(): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement as FullscreenElement;
  const requestFullscreen = el.requestFullscreen ?? el.webkitRequestFullscreen;
  void requestFullscreen?.call(el);
}

export function exitFullscreen(): void {
  if (typeof document === "undefined") return;
  const fullscreenDocument = document as FullscreenDocument;
  const exit = fullscreenDocument.exitFullscreen ?? fullscreenDocument.webkitExitFullscreen;
  void exit?.call(fullscreenDocument);
}

export function isFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  const fullscreenDocument = document as FullscreenDocument;
  return Boolean(fullscreenDocument.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement);
}

export function onFullscreenChange(cb: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  document.addEventListener("fullscreenchange", cb);
  document.addEventListener("webkitfullscreenchange", cb);
  return () => {
    document.removeEventListener("fullscreenchange", cb);
    document.removeEventListener("webkitfullscreenchange", cb);
  };
}

export function isFullscreenSupported(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.documentElement as FullscreenElement | undefined;
  return Boolean(el?.requestFullscreen ?? el?.webkitRequestFullscreen);
}
