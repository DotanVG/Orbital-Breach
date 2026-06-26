import { MULTIPLAYER_LOBBY_STYLE_BRIEFING } from "./multiplayerLobbyStyleBriefing";
import { MULTIPLAYER_LOBBY_STYLE_ROSTER } from "./multiplayerLobbyStyleRoster";
import { MULTIPLAYER_LOBBY_STYLE_SHELL } from "./multiplayerLobbyStyleShell";

const CSS = `${MULTIPLAYER_LOBBY_STYLE_SHELL}${MULTIPLAYER_LOBBY_STYLE_ROSTER}${MULTIPLAYER_LOBBY_STYLE_BRIEFING}`;

let styleInjected = false;

export function injectMultiplayerLobbyStyle(): void {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
}
