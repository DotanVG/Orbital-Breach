import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const itchIndex = readFileSync(path.join(repoRoot, "itch/index.html"), "utf8");
const soundEngine = readFileSync(path.join(repoRoot, "client/src/audio/SoundEngine.ts"), "utf8");

describe("asset cleanup regressions", () => {
  it("uses the canonical deployed art asset for the itch shell", () => {
    expect(itchIndex).toContain("https://orbital-breach.vercel.app/orbital-breach-art.png");
    expect(itchIndex).not.toContain("./orbital-breach-art.png");
    expect(existsSync(path.join(repoRoot, "client/public/orbital-breach-art.png"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "itch/orbital-breach-art.png"))).toBe(false);
  });

  it("loads countdown audio from the ogg asset", () => {
    expect(soundEngine).toContain("countdown: '/audio/countdown.ogg'");
    expect(existsSync(path.join(repoRoot, "client/public/audio/countdown.ogg"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "client/public/audio/countdown.wav"))).toBe(false);
  });
});
