import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const cacheRules = config.headers.filter((entry: { headers: { key: string }[] }) =>
  entry.headers.some((header) => header.key === "Cache-Control"),
);
const rule = cacheRules.find((entry: { headers: { value: string }[] }) =>
  entry.headers.some((header) => header.value.includes("immutable")),
);

describe("immutable asset caching", () => {
  it("matches Vite hashes without caching mutable public files or HTML", () => {
    expect(rule.headers).toEqual([
      { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
    ]);
    const matches = new RegExp(`^${rule.source}$`);
    for (const asset of ["/assets/index-e-mNKYTO.js", "/assets/index-1234_abZ.css", "/assets/logo-AbCd1234.webp"]) {
      expect(matches.test(asset), asset).toBe(true);
    }
    for (const asset of ["/", "/index.html", "/analytics.js", "/assets/script.js", "/assets/marketing/orbital-breach-bg.png", "/assets/marketing/og-image.jpg", "/models/Alien.glb", "/audio/laser-1.wav"]) {
      expect(matches.test(asset), asset).toBe(false);
    }
  });
});

describe("unversioned model and audio caching", () => {
  it("uses a one-hour max-age because those files are not content-hashed", () => {
    const moderate = "public, max-age=3600";
    for (const source of ["/models/(.*)", "/audio/(.*)"]) {
      const entry = cacheRules.find((rule: { source: string }) => rule.source === source);
      expect(entry?.headers).toEqual([{ key: "Cache-Control", value: moderate }]);
      const matches = new RegExp(`^${source}$`);
      expect(matches.test(source === "/models/(.*)" ? "/models/Alien.glb" : "/audio/laser-1.wav")).toBe(true);
      expect(matches.test(source === "/models/(.*)" ? "/models/Ray Gun.glb" : "/audio/main-theme.ogg")).toBe(true);
      expect(entry.headers[0].value).not.toMatch(/immutable/i);
    }
  });
});
