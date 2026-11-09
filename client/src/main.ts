import { inject } from "@vercel/analytics";
import { injectSpeedInsights } from "@vercel/speed-insights";
import { trackLandingVisitOnce } from "./analytics/analytics";
import { App } from "./app";
import { wakeBackend } from "./net/wakeBackend";
import { initGlobalCursor } from "./ui/globalCursor";

inject({ mode: import.meta.env.DEV ? "development" : "production" });
injectSpeedInsights();
trackLandingVisitOnce();
wakeBackend();

const cursor = initGlobalCursor();

function showFailure(): void {
  const status = document.createElement("p");
  status.id = "boot-status";
  status.setAttribute("role", "status");
  status.style.cssText = "position:fixed;z-index:30;top:1.25rem;left:1.25rem;right:1.25rem;margin:0;color:#e4edf5;font:1rem/1.5 system-ui,sans-serif";
  status.textContent = "The game could not load. Check your connection and that your browser supports WebGL, then reload to retry.";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Reload to retry";
  button.onclick = () => location.reload();
  status.append(button);
  document.body.append(status);
}

try {
  const app = new App(cursor);
  app.start();
  document.body.classList.add("game-active");
} catch {
  cursor.hide();
  showFailure();
}
