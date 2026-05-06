type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export function enterFullscreen(): void {
  void requestFullscreen();
}

export async function requestFullscreen(): Promise<boolean> {
  if (!isFullscreenSupported()) return false;
  const el = document.documentElement as FullscreenElement;
  const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
  if (!request) return false;

  try {
    await request.call(el);
    return isFullscreen();
  } catch {
    return false;
  }
}

export function exitFullscreen(): void {
  void leaveFullscreen();
}

export async function leaveFullscreen(): Promise<boolean> {
  if (typeof document === "undefined") return false;
  if (!isFullscreen()) return true;

  const fullscreenDocument = document as FullscreenDocument;
  const exit = fullscreenDocument.exitFullscreen ?? fullscreenDocument.webkitExitFullscreen;
  if (!exit) return false;

  try {
    await exit.call(fullscreenDocument);
    return !isFullscreen();
  } catch {
    return false;
  }
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
  const fullscreenDocument = document as FullscreenDocument & {
    fullscreenEnabled?: boolean;
    webkitFullscreenEnabled?: boolean;
  };
  const enabled = fullscreenDocument.fullscreenEnabled ?? fullscreenDocument.webkitFullscreenEnabled;
  if (enabled === false) return false;
  const el = document.documentElement as FullscreenElement | undefined;
  return Boolean(el?.requestFullscreen ?? el?.webkitRequestFullscreen);
}
