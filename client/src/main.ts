import { App } from "./app";
import { wakeBackend } from "./net/wakeBackend";
import { injectSpeedInsights } from "@vercel/speed-insights";

// Initialize Vercel Speed Insights
injectSpeedInsights();

wakeBackend();
new App().start();
