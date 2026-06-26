import { injectDesignTokens } from "../designTokens";
import { MENU_VIEW_STYLE_CHROME } from "./menuViewStyleChrome";
import { MENU_VIEW_STYLE_LAYOUT } from "./menuViewStyleLayout";

const CSS = `${MENU_VIEW_STYLE_CHROME}${MENU_VIEW_STYLE_LAYOUT}`;

export function injectMenuStyle(): HTMLStyleElement {
  injectDesignTokens();
  let tag = document.getElementById("ob-menu-style") as HTMLStyleElement | null;
  if (tag) return tag;
  tag = document.createElement("style");
  tag.id = "ob-menu-style";
  tag.textContent = CSS;
  document.head.appendChild(tag);
  return tag;
}
