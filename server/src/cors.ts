// Origin allowlist shared by Colyseus matchmaking and the express probe routes.
// Every pattern is anchored so lookalike hosts (e.g. evil-itch.io.attacker.com) never match.

const DEFAULT_ORIGINS = ["https://orbital-breach.vercel.app"];

const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
];

const ORIGIN_PATTERNS: RegExp[] = [
  // Vercel deployment + branch-alias URLs for this project only, e.g.
  // orbital-breach-2o12vnqic-dotanvgs-projects.vercel.app, orbital-breach-git-staging-dotanvgs-projects.vercel.app
  /^https:\/\/orbital-breach-[a-z0-9-]+-dotanvgs-projects\.vercel\.app$/,
  /^https:\/\/([a-z0-9-]+\.)*itch\.io$/,
  /^https:\/\/([a-z0-9-]+\.)+itch\.zone$/,
  /^https:\/\/([a-z0-9-]+\.)+hwcdn\.net$/,
  // itch desktop app
  /^itch-cave:\/\/[a-z0-9._-]+$/i,
];

export function parseOriginList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function createOriginMatcher(extraOrigins: string[], isProd: boolean): (origin: string | null | undefined) => boolean {
  const exact = new Set([...DEFAULT_ORIGINS, ...extraOrigins, ...(isProd ? [] : DEV_ORIGINS)]);
  return (origin) => {
    if (!origin) return false;
    // Sandboxed iframes / the itch desktop app send the literal "null" origin.
    if (origin === "null") return true;
    return exact.has(origin) || ORIGIN_PATTERNS.some((re) => re.test(origin));
  };
}

export function buildCorsHeaders(origin: string | null | undefined, isAllowed: (origin: string | null | undefined) => boolean): Record<string, string> {
  const headers: Record<string, string> = { Vary: "Origin" };
  if (!origin || !isAllowed(origin)) return headers;
  return {
    ...headers,
    "Access-Control-Allow-Origin": origin,
    // ponytail: @colyseus/sdk 0.17 fetches /matchmake with credentials:"include", so browsers
    // reject the response without this. Only ever sent with an exact allowlisted origin, never "*".
    // Drop it once the client passes credentials:"omit".
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
  };
}
