import type { MatchTeamSize } from "../../../../shared/match";
import { GITHUB_REPO_URL, ITCH_IO_URL } from "../creditsContent";
import { GITHUB_ICON_SVG, ITCH_ICON_SVG } from "../linkIcons";
import { SESSION_MENU_GEAR_ICON } from "../sessionMenu";
import { initMenuFx } from "./menuViewFx";

export { injectMenuStyle } from "./menuViewStyle";

export interface MenuElements {
  container: HTMLDivElement;
  root: HTMLElement;
  nameInput: HTMLInputElement;
  nameError: HTMLElement;
  matchSizeSelect: HTMLSelectElement;
  playSoloButton: HTMLButtonElement;
  playOnlineButton: HTMLButtonElement;
  browseRoomsButton: HTMLButtonElement;
  openInstructionsButton: HTMLButtonElement;
  openSettingsButton: HTMLButtonElement;
  openCreditsButton: HTMLButtonElement;
  playTutorialButton: HTMLButtonElement;
}

export function createMenuView(savedName: string, matchSize: MatchTeamSize): MenuElements {
  const cardSizes = [1, 2, 5, 10, 20] as const;
  const matchCardSize: number =
    (cardSizes as readonly number[]).includes(matchSize) ? matchSize : 1;

  function cardHtml(size: number, label: string, bots: string): string {
    return `
      <button class="ob-match-card${matchCardSize === size ? " ob-selected" : ""}" data-card-size="${size}">
        <div class="ob-card-size">${size}<em>v</em>${size}</div>
        <div class="ob-card-name">${label}</div>
        <div class="ob-card-bots">${bots}</div>
      </button>`;
  }

  function btn(id: string, mod: string, label: string, iconHtml?: string): string {
    const adornment = iconHtml
      ? `<span class="ob-btn-icon">${iconHtml}</span>`
      : `<span class="ob-btn-arrow">&rarr;</span>`;
    const onlineClass = id === "btn-play-online" ? " ob-btn-online" : "";
    return `
      <button class="ob-btn ob-btn-${mod}${onlineClass}" id="${id}">
        <span class="ob-btn-corner ob-tl"></span><span class="ob-btn-corner ob-tr"></span>
        <span class="ob-btn-corner ob-bl"></span><span class="ob-btn-corner ob-br"></span>
        <span class="ob-btn-label">${label} ${adornment}</span>
      </button>`;
  }

  function externalLink(label: string, href: string, icon: string): string {
    return `
      <a
        class="ob-link-chip"
        href="${href}"
        target="_blank"
        rel="noreferrer noopener"
      >
        <span class="ob-link-chip-icon">${icon}</span>
        <span>${label}</span>
        <span class="ob-link-chip-arrow">&nearr;</span>
      </a>`;
  }

  const container = document.createElement("div") as HTMLDivElement;
  container.innerHTML = `
    <div class="menu-root" id="menu-root">
      <div class="ob-planet"></div>
      <div class="ob-stars" id="ob-stars"></div>
      <div class="ob-bg-vignette"></div>
      <div class="ob-orbit-stage">
        <div class="ob-orbit-tilt" id="ob-orbit-tilt">
          <div class="ob-ring ob-ring-1">
            <svg viewBox="-200 -200 400 400">
              <g class="ob-ring-ticks"></g>
              <text x="0"    y="-205" text-anchor="middle">R = 4.21 AU · TRAJ 000</text>
              <text x="205"  y="3"    text-anchor="start">090</text>
              <text x="0"    y="213"  text-anchor="middle">180</text>
              <text x="-205" y="3"    text-anchor="end">270</text>
              <circle cx="140"  cy="-140" r="3" class="ob-dot"/>
              <circle cx="-170" cy="85"   r="2" class="ob-dot-warm"/>
            </svg>
          </div>
          <div class="ob-ring ob-ring-2 ob-ring-dashed">
            <svg viewBox="-200 -200 400 400">
              <text x="0" y="-203" text-anchor="middle">ORBITAL TIER II · STANDING BY</text>
            </svg>
          </div>
          <div class="ob-ring ob-ring-3">
            <svg viewBox="-200 -200 400 400">
              <circle cx="0"   cy="-194" r="4"  class="ob-dot"/>
              <circle cx="0"   cy="-194" r="9"  fill="none" stroke="var(--ob-cyan)" stroke-opacity=".4"/>
              <text x="14" y="-188">BREACH α</text>
              <circle cx="165" cy="102"  r="3"  class="ob-dot-warm"/>
              <text x="178" y="108">BREACH β</text>
            </svg>
          </div>
          <div class="ob-ring ob-ring-4 ob-ring-dashed"></div>
          <div class="ob-ring ob-ring-5">
            <svg viewBox="-200 -200 400 400">
              <g id="ob-inner-ticks"></g>
              <text x="0" y="-186" text-anchor="middle">CORE · SYNC 97.4%</text>
            </svg>
          </div>
        </div>
      </div>
      <div class="ob-bg-grain"></div>

      <span class="ob-hud-corner ob-tl"></span>
      <span class="ob-hud-corner ob-tr"></span>
      <span class="ob-hud-corner ob-bl"></span>
      <span class="ob-hud-corner ob-br"></span>

      <div class="ob-topbar">
        <div class="ob-topbar-brand">ORBITAL BREACH <em>v0.6 · ZERO-G ARENA</em></div>
        <div class="ob-topbar-right">
          <span><span class="ob-topbar-dot"></span>LINK SYNC</span>
          <span class="ob-clock" id="ob-clock">00:00:00 UTC</span>
        </div>
      </div>

      <div class="ob-main-wrap">
        <div class="ob-tag">ZERO-G ARENA · STANDING BY</div>

        <h1 class="ob-title" id="ob-title">ORBITAL BREACH</h1>

        <div class="ob-subtitle">
          <span class="ob-pulse"></span>
          <span>Freeze &middot; Slingshot &middot; Breach</span>
          <span class="ob-pulse"></span>
        </div>

        <div class="ob-callsign">
          <div class="ob-callsign-label">Call Sign</div>
          <label class="ob-callsign-box">
            <span class="ob-bracket ob-l"></span>
            <span class="ob-callsign-prefix">[ CS-07 ]</span>
            <input
              type="text"
              id="menu-name"
              maxlength="16"
              placeholder="ENTER CALL SIGN"
              value="${escapeHtml(savedName)}"
              autocomplete="off"
              spellcheck="false"
            />
            <span class="ob-bracket ob-r"></span>
          </label>
          <div class="ob-name-error" id="menu-name-error" aria-live="polite"></div>
        </div>

        <button id="btn-play-tutorial" class="ob-tutorial-btn">
          <span class="ob-btn-corner ob-tl" style="border-color:var(--ob-magenta);opacity:.4;"></span>
          <span class="ob-btn-corner ob-tr" style="border-color:var(--ob-magenta);opacity:.4;"></span>
          <span class="ob-btn-corner ob-bl" style="border-color:var(--ob-magenta);opacity:.4;"></span>
          <span class="ob-btn-corner ob-br" style="border-color:var(--ob-magenta);opacity:.4;"></span>
          <span class="ob-tutorial-btn-main">
            <span class="ob-tutorial-btn-label">Tutorial</span>
            <span class="ob-tutorial-btn-sub">Empty Arena · Bots Off · First Flight Guide</span>
          </span>
          <span class="ob-tutorial-btn-arrow">&rarr;</span>
        </button>

        <div class="ob-match-grid" id="ob-match-grid">
          ${cardHtml(1,  "Skirmish",   "1 bot")}
          ${cardHtml(2,  "Duos",       "3 bots")}
          ${cardHtml(5,  "Squad Clash","9 bots")}
          ${cardHtml(10, "Arena Rush", "19 bots")}
          ${cardHtml(20, "Zero-G War", "39 bots")}
        </div>

        <select class="ob-match-select-hidden" id="menu-match-size" aria-label="Solo match size">
          <option value="1"  ${matchSize === 1  ? "selected" : ""}>1v1 Skirmish</option>
          <option value="2"  ${matchSize === 2  ? "selected" : ""}>2v2 Duos</option>
          <option value="5"  ${matchSize === 5  ? "selected" : ""}>5v5 Squad Clash</option>
          <option value="10" ${matchSize === 10 ? "selected" : ""}>10v10 Arena Rush</option>
          <option value="20" ${matchSize === 20 ? "selected" : ""}>20v20 Zero-G War</option>
        </select>

        <div class="ob-launch-row">
          ${btn("btn-play-solo",   "primary",   "Engage Solo")}
          ${btn("btn-play-online", "secondary", "Join Online")}
        </div>
        <div class="ob-settings-row">
          ${btn("btn-browse-rooms", "utility", "Rooms & Invites")}
          ${btn("btn-open-instructions", "utility", "Instructions")}
          ${btn("btn-open-settings", "utility", "Settings", SESSION_MENU_GEAR_ICON)}
          ${btn("btn-open-credits", "utility", "Credits")}
        </div>
        <div class="ob-link-row" aria-label="External project links">
          ${externalLink("GITHUB REPO", GITHUB_REPO_URL, GITHUB_ICON_SVG)}
          ${externalLink("DOTANV.ITCH.IO", ITCH_IO_URL, ITCH_ICON_SVG)}
        </div>
      </div>

      <div class="ob-bottombar">
        <div class="ob-bottombar-tel">
          <span>CLIENT <b>CY-07</b></span>
          <span>TICK <b>20 Hz</b></span>
        </div>
        <div>© 2026 ORBITAL BREACH</div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  // Keep the existing controller contract: card clicks drive the hidden
  // select so MainMenu storage and change handlers still work unchanged.
  const matchSelect = container.querySelector<HTMLSelectElement>("#menu-match-size")!;
  container.querySelectorAll<HTMLElement>(".ob-match-card").forEach((card) => {
    card.addEventListener("click", () => {
      container.querySelectorAll(".ob-match-card").forEach((c) => c.classList.remove("ob-selected"));
      card.classList.add("ob-selected");
      const size = card.dataset["cardSize"];
      if (size) {
        matchSelect.value = size;
        matchSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  });

  initMenuFx(container);

  return {
    container,
    root:              container.querySelector<HTMLElement>("#menu-root")!,
    nameInput:         container.querySelector<HTMLInputElement>("#menu-name")!,
    nameError:         container.querySelector<HTMLElement>("#menu-name-error")!,
    matchSizeSelect:   matchSelect,
    playSoloButton:    container.querySelector<HTMLButtonElement>("#btn-play-solo")!,
    playOnlineButton:  container.querySelector<HTMLButtonElement>("#btn-play-online")!,
    browseRoomsButton: container.querySelector<HTMLButtonElement>("#btn-browse-rooms")!,
    openInstructionsButton: container.querySelector<HTMLButtonElement>("#btn-open-instructions")!,
    openSettingsButton:container.querySelector<HTMLButtonElement>("#btn-open-settings")!,
    openCreditsButton: container.querySelector<HTMLButtonElement>("#btn-open-credits")!,
    playTutorialButton:container.querySelector<HTMLButtonElement>("#btn-play-tutorial")!,
  };
}

function escapeHtml(raw: string): string {
  return raw.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return ch;
    }
  });
}
