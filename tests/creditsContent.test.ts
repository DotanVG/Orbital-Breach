import { describe, expect, it } from "vitest";
import {
  ASSET_CREDITS,
  AUDIO_CREDITS,
  GITHUB_REPO_URL,
  ITCH_IO_URL,
  NOAM_SOUNDCLOUD_URL,
} from "../client/src/ui/creditsContent";

describe("credits content", () => {
  it("publishes the required external URLs", () => {
    expect(GITHUB_REPO_URL).toBe("https://github.com/DotanVG/Zero-G-Arena");
    expect(ITCH_IO_URL).toBe("https://dotanv.itch.io/");
    expect(NOAM_SOUNDCLOUD_URL).toBe("https://soundcloud.com/ouzana");
  });

  it("includes alien and pistol asset credits", () => {
    expect(ASSET_CREDITS.some((credit) => /alien/i.test(credit.title))).toBe(true);
    expect(ASSET_CREDITS.some((credit) => /pistol/i.test(credit.title))).toBe(true);
  });

  it("includes the Noam Ouzana audio credit", () => {
    expect(AUDIO_CREDITS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Noam Ouzana",
        }),
      ]),
    );
  });
});
