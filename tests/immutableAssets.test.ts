import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const rule = config.headers.find((entry: { headers: { key: string }[] }) =>
  entry.headers.some((header) => header.key === "Cache-Control"),
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
    for (const asset of ["/", "/index.html", "/analytics.js", "/assets/script.js", "/assets/marketing/orbital-breach-bg.png", "/assets/marketing/og-image.jpg", "/models/Alien.glb"]) {
      expect(matches.test(asset), asset).toBe(false);
    }
  });
});
