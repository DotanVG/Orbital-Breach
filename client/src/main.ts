import { inject } from "@vercel/analytics";
import { injectSpeedInsights } from "@vercel/speed-insights";
import { trackLandingVisitOnce } from "./analytics/analytics";
import { isEmbedMode } from "./embed";
import { parsePortalParams } from "./game/portal/parsePortalParams";
import { initGlobalCursor } from "./ui/globalCursor";
import { WelcomeScreen } from "./ui/welcome";

inject({ mode: import.meta.env.DEV ? "development" : "production" });
injectSpeedInsights();
trackLandingVisitOnce();
const cursor = initGlobalCursor();
const welcome = new WelcomeScreen(cursor);
const landing = document.querySelector<HTMLElement>('#landing')!;
const button = document.querySelector<HTMLButtonElement>('#wc-btn')!;
const status = document.querySelector<HTMLElement>('#landing-status')!;

async function loadGame(fromGesture: boolean): Promise<void> {
  let audioContext: AudioContext | undefined;
  if (fromGesture) {
    // Prime audio inside the native click, before the import loses iOS activation.
    const AudioContextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    audioContext = new AudioContextClass();
    void audioContext.resume().catch(() => {});
    const primer = audioContext.createBufferSource();
    primer.buffer = audioContext.createBuffer(1, 1, audioContext.sampleRate);
    primer.connect(audioContext.destination);
    primer.start();
  }
  const { prepareGame } = await import('./app');
  const app = await prepareGame(cursor, audioContext);
  welcome.onBreach = () => app.start(fromGesture);
}

function showFailure(): void {
  status.hidden = false;
  status.textContent = 'The game could not load. Check your connection and that your browser supports WebGL. Reload to retry, then choose Start.';
  button.disabled = false;
  button.removeAttribute('aria-busy');
  button.textContent = 'Reload to retry';
  button.onclick = () => location.reload();
}

welcome.onPrepare = () => loadGame(true);
welcome.onLoadError = showFailure;
try {
  welcome.fullscreenOnClick = localStorage.getItem('orbital_fullscreen_enabled') !== 'false';
  // Preserve automatic entry for embeds and arrivals from another game's portal.
  if (isEmbedMode() || parsePortalParams().portal === true) {
    void loadGame(false).then(() => {
      landing.remove();
      document.body.classList.add('game-active');
      welcome.onBreach?.();
    }).catch(showFailure);
  } else {
    welcome.show();
  }
} catch {
  showFailure();
}
