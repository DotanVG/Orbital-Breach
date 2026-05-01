import { track as vercelTrack } from "@vercel/analytics";

type AnalyticsValue = string | number | boolean | null | undefined;
type AnalyticsProperties = Record<string, AnalyticsValue>;
type DeviceType = "desktop" | "mobile" | "tablet";
type Orientation = "landscape" | "portrait";

declare global {
  interface Window {
    __orbitalBreachLandingVisitTracked?: boolean;
  }
}

function readQueryParam(searchParams: URLSearchParams, key: string): string | null {
  const value = searchParams.get(key);
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getDocumentReferrerHost(): string | null {
  if (typeof document === "undefined" || document.referrer.length === 0) return null;

  try {
    return new URL(document.referrer).host || null;
  } catch {
    return null;
  }
}

function getViewportSize(): { width: number; height: number } {
  const viewport = window.visualViewport;
  if (viewport) {
    return {
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
    };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function getOrientation(width: number, height: number): Orientation {
  return width >= height ? "landscape" : "portrait";
}

function getDeviceType(width: number): DeviceType {
  const userAgent = navigator.userAgent.toLowerCase();
  const isTabletUa = /ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(userAgent);
  if (isTabletUa) return "tablet";

  const isMobileUa = /mobi|android|iphone|ipod/i.test(userAgent);
  if (isMobileUa) return "mobile";

  if (navigator.maxTouchPoints > 0) {
    if (width < 768) return "mobile";
    if (width < 1024) return "tablet";
  }

  return "desktop";
}

function getLandingVisitProperties(): AnalyticsProperties {
  const searchParams = new URLSearchParams(window.location.search);
  const { width, height } = getViewportSize();

  return {
    path: window.location.pathname,
    ref: readQueryParam(searchParams, "ref"),
    utm_source: readQueryParam(searchParams, "utm_source"),
    utm_medium: readQueryParam(searchParams, "utm_medium"),
    utm_campaign: readQueryParam(searchParams, "utm_campaign"),
    utm_content: readQueryParam(searchParams, "utm_content"),
    documentReferrerHost: getDocumentReferrerHost(),
    deviceType: getDeviceType(width),
    orientation: getOrientation(width, height),
    viewportWidth: width,
    viewportHeight: height,
  };
}

export function track(eventName: string, properties?: AnalyticsProperties): void {
  if (typeof window === "undefined") return;

  if (import.meta.env.DEV) {
    console.info(`[analytics] ${eventName}`, properties ?? {});
  }

  try {
    vercelTrack(eventName, properties);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`[analytics] failed to track ${eventName}`, error);
    }
  }
}

export function trackLandingVisitOnce(): void {
  if (typeof window === "undefined" || window.__orbitalBreachLandingVisitTracked) return;

  window.__orbitalBreachLandingVisitTracked = true;
  track("landing_visit", getLandingVisitProperties());
}
