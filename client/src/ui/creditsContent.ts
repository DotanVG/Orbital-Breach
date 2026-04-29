export const GITHUB_REPO_URL = "https://github.com/DotanVG/Zero-G-Arena";
export const ITCH_IO_URL = "https://dotanv.itch.io/";
export const NOAM_SOUNDCLOUD_URL = "https://soundcloud.com/ouzana";

export interface CreditEntry {
  title: string;
  detail: string;
}

export const ASSET_CREDITS: CreditEntry[] = [
  {
    title: "Alien Model",
    detail: "Alien.glb and Alien_Helmet.glb power the player and bot character rigs.",
  },
  {
    title: "Freeze Pistol Model",
    detail: "Ray Gun.glb is used for the first-person and third-person freeze pistol.",
  },
];

export const AUDIO_CREDITS: CreditEntry[] = [
  {
    title: "Noam Ouzana",
    detail: "Music and sound effects, including the main theme, laser shots, and countdown audio.",
  },
];
