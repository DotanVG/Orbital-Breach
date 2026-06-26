import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const itchIndex = readFileSync(path.join(repoRoot, "itch/index.html"), "utf8");
const soundEngine = readFileSync(path.join(repoRoot, "client/src/audio/SoundEngine.ts"), "utf8");

describe("asset cleanup regressions", () => {
  it("itch shell references local splash art", () => {
    expect(itchIndex).toContain("./orbital-breach-art.png");
    expect(existsSync(path.join(repoRoot, "itch/orbital-breach-art.png"))).toBe(true);
  });

  it("loads countdown audio from the ogg asset", () => {
    expect(soundEngine).toContain("countdown: '/audio/countdown.ogg'");
    expect(existsSync(path.join(repoRoot, "client/public/audio/countdown.ogg"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "client/public/audio/countdown.wav"))).toBe(false);
  });
});
