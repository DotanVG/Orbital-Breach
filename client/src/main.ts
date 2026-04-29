import { inject } from "@vercel/analytics";
import { trackLandingVisitOnce } from "./analytics/analytics";
import { App } from "./app";
import { wakeBackend } from "./net/wakeBackend";

inject({ mode: import.meta.env.DEV ? "development" : "production" });
trackLandingVisitOnce();
wakeBackend();
new App().start();
