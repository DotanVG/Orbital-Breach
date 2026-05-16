import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const itchIndex = readFileSync(path.resolve(__dirname, "../itch/index.html"), "utf8");

function cssRuleFor(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = itchIndex.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`Missing CSS rule for ${selector}`);
  return match[1];
}

describe("itch index cursor styles", () => {
  it("keeps the desktop cursor visible on the embed entry page", () => {
    expect(cssRuleFor(".wc-root")).not.toContain("cursor: none");
    expect(cssRuleFor(".wc-root")).toContain("cursor: auto");
  });

  it("uses normal pointer affordance for the breach button", () => {
    expect(cssRuleFor(".wc-btn")).not.toContain("cursor: none");
    expect(cssRuleFor(".wc-btn")).toContain("cursor: pointer");
  });
});
