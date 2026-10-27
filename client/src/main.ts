import { inject } from "@vercel/analytics";
import { injectSpeedInsights } from "@vercel/speed-insights";
import { trackLandingVisitOnce } from "./analytics/analytics";
import { App } from "./app";
import { wakeBackend } from "./net/wakeBackend";

inject({ mode: import.meta.env.DEV ? "development" : "production" });
injectSpeedInsights();
trackLandingVisitOnce();
wakeBackend();
try {
  new App().start();
  const canvas = document.querySelector('canvas')!;
  canvas.setAttribute('role', 'region');
  canvas.setAttribute('aria-label', 'Orbital Breach game');

  // Embed and portal arrivals already bypass the welcome screen.
  const landing = document.querySelector<HTMLElement>('#landing')!;
  if (!landing.classList.contains('wc-root')) {
    landing.remove();
    document.body.classList.add('game-active');
  }
} catch (error) {
  const status = document.querySelector<HTMLElement>('#landing-status')!;
  status.hidden = false;
  status.textContent = 'The game could not load. Check that your browser supports WebGL, then reload this page to try again.';
  document.querySelector<HTMLButtonElement>('#wc-btn')!.disabled = true;
  console.error('[Orbital Breach] Startup failed:', error);
}
