import { inject } from "@vercel/analytics";
import { injectSpeedInsights } from "@vercel/speed-insights";
import { trackLandingVisitOnce } from "./analytics/analytics";
import { App } from "./app";
import { wakeBackend } from "./net/wakeBackend";

inject({ mode: import.meta.env.DEV ? "development" : "production" });
injectSpeedInsights();
trackLandingVisitOnce();
wakeBackend();
new App().start();
