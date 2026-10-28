import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const headers = config.headers.find((rule: { source: string }) => rule.source === "/(.*)").headers;
const value = (key: string): string | undefined =>
  headers.find((header: { key: string }) => header.key === key)?.value;

describe("security headers", () => {
  it("sets MIME and referrer protections", () => {
    expect(value("X-Content-Type-Options")).toBe("nosniff");
    expect(value("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("enforces framing for this origin and the itch embedders", () => {
    const enforced = value("Content-Security-Policy");
    const frameAncestors = "frame-ancestors 'self' https://itch.io https://*.itch.io https://*.itch.zone https://*.hwcdn.net itch-cave:";
    expect(enforced).toContain(frameAncestors);
    expect(enforced?.match(/frame-ancestors/gi)).toEqual(["frame-ancestors"]);
    expect(value("X-Frame-Options")).toBeUndefined();
    expect(value("Content-Security-Policy-Report-Only")).toBe(enforced);
  });
});
