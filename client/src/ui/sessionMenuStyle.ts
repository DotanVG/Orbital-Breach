import { SESSION_MENU_STYLE_CONTENT } from "./sessionMenuStyleContent";
import { SESSION_MENU_STYLE_SHELL } from "./sessionMenuStyleShell";

const CSS = `${SESSION_MENU_STYLE_SHELL}${SESSION_MENU_STYLE_CONTENT}`;

let styleInjected = false;

export function injectSessionMenuStyle(): void {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
}
