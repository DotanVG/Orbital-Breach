export const GITHUB_REPO_URL = "https://github.com/DotanVG/Zero-G-Arena";
export const ITCH_IO_URL = "https://dotanv.itch.io/";
export const NOAM_SOUNDCLOUD_URL = "https://soundcloud.com/ouzana";

export interface CreditEntry {
  title: string;
  detail: string;
  url?: string;
}

export const ASSET_CREDITS: CreditEntry[] = [
  {
    title: "Animated Alien",
    detail: "Alien.glb and Alien_Helmet.glb — player and bot character rigs. By Quaternius.",
    url: "https://quaternius.com/packs/animatedalien.html",
  },
  {
    title: "Sci-Fi Gun Pack — Pistol",
    detail: "Ray Gun.glb — first-person and third-person freeze pistol. By Quaternius.",
    url: "https://quaternius.com/packs/scifigun.html",
  },
];

export const AUDIO_CREDITS: CreditEntry[] = [
  {
    title: "Noam Ouzana",
    detail: "Main theme, hit SFX, laser shots, and countdown audio.",
  },
];
