import { isTouchDevice } from "../../platform";
import type { MatchTeamSize } from "../../../../shared/match";

/**
 * Main menu DOM view: injects the stylesheet on first use, builds the
 * menu element from HTML, and exposes the mutable handles (name input,
 * play buttons, fade-target root) the controller needs.
 */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Oxanium:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');

  @keyframes menuFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes menuRise {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes orbDrift {
    0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
    50% { transform: translate3d(0, -14px, 0) scale(1.04); }
  }

  .menu-root {
    --menu-cyan: #74f5ff;
    --menu-magenta: #ff82ef;
    --menu-text: #f4fdff;
    --menu-muted: #8da7bc;
    --menu-panel: rgba(5, 12, 18, 0.76);
    --menu-panel-strong: rgba(4, 10, 15, 0.9);
    --menu-border: rgba(130, 232, 255, 0.18);
    position: fixed;
    inset: 0;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(18px, 3vw, 36px);
    background:
      radial-gradient(circle at 14% 18%, rgba(116, 245, 255, 0.14), rgba(116, 245, 255, 0) 28%),
      radial-gradient(circle at 82% 18%, rgba(255, 130, 239, 0.16), rgba(255, 130, 239, 0) 30%),
      linear-gradient(180deg, rgba(4, 10, 16, 0.98), rgba(3, 8, 13, 0.94));
    color: var(--menu-text);
    z-index: 300;
    font-family: "Oxanium", sans-serif;
    animation: menuFadeIn 0.35s ease-out both;
  }

  .menu-root * {
    box-sizing: border-box;
  }

  .menu-orb {
    position: absolute;
    width: 32vw;
    height: 32vw;
    min-width: 240px;
    min-height: 240px;
    max-width: 460px;
    max-height: 460px;
    border-radius: 50%;
    filter: blur(30px);
    opacity: 0.6;
    animation: orbDrift 12s ease-in-out infinite;
  }

  .menu-orb--cyan {
    left: -10vw;
    top: -10vw;
    background: radial-gradient(circle, rgba(116, 245, 255, 0.2), rgba(116, 245, 255, 0.02) 62%, transparent 76%);
  }

  .menu-orb--magenta {
    right: -10vw;
    bottom: -12vw;
    background: radial-gradient(circle, rgba(255, 130, 239, 0.22), rgba(255, 130, 239, 0.03) 62%, transparent 76%);
    animation-delay: 2s;
  }

  .menu-corner {
    position: absolute;
    width: 20px;
    height: 20px;
    border-color: rgba(116, 245, 255, 0.26);
    border-style: solid;
  }

  .menu-corner--tl { top: 18px; left: 18px; border-width: 1px 0 0 1px; }
  .menu-corner--tr { top: 18px; right: 18px; border-width: 1px 1px 0 0; }
  .menu-corner--bl { bottom: 18px; left: 18px; border-width: 0 0 1px 1px; }
  .menu-corner--br { bottom: 18px; right: 18px; border-width: 0 1px 1px 0; }

  .menu-grid {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(320px, 430px);
    gap: clamp(26px, 5vw, 60px);
    width: min(1120px, 100%);
    align-items: center;
  }

  .menu-brand,
  .menu-console {
    position: relative;
    border: 1px solid var(--menu-border);
    border-radius: 30px;
    background:
      linear-gradient(135deg, rgba(116, 245, 255, 0.07), rgba(255, 130, 239, 0.05)),
      var(--menu-panel);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(14px);
    animation: menuRise 0.45s ease-out both;
  }

  .menu-brand {
    padding: clamp(26px, 4vw, 44px);
    overflow: hidden;
  }

  .menu-console {
    padding: 22px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0)),
      var(--menu-panel-strong);
    animation-delay: 0.08s;
  }

  .menu-kicker,
  .menu-console-kicker,
  .menu-label,
  .menu-controls-title,
  .menu-btn__eyebrow,
  .menu-version {
    font-family: "Space Mono", monospace;
    text-transform: uppercase;
  }

  .menu-kicker {
    color: var(--menu-muted);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.22em;
  }

  .menu-title {
    margin-top: 14px;
    font-size: clamp(52px, 9vw, 102px);
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 0.9;
    text-transform: uppercase;
    text-shadow: 0 0 30px rgba(116, 245, 255, 0.16);
  }

  .menu-title span {
    display: block;
  }

  .menu-title span:last-child {
    color: transparent;
    background: linear-gradient(90deg, var(--menu-cyan), #f2f7ff 55%, var(--menu-magenta));
    -webkit-background-clip: text;
    background-clip: text;
  }

  .menu-subtitle {
    margin-top: 12px;
    color: #d9f2fb;
    font-size: 20px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .menu-description {
    max-width: 560px;
    margin: 18px 0 0;
    color: #d5e9f4;
    font-size: 16px;
    line-height: 1.7;
  }

  .menu-highlights {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 22px;
  }

  .menu-chip {
    display: inline-flex;
    align-items: center;
    min-height: 34px;
    padding: 0 12px;
    border-radius: 999px;
    color: #d8f8ff;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-family: "Space Mono", monospace;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .menu-controls {
    margin-top: 26px;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .menu-controls-title {
    color: var(--menu-muted);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.18em;
  }

  .menu-controls-copy {
    margin-top: 12px;
    color: #d8edf5;
    font-size: 13px;
    line-height: 1.9;
  }

  .menu-key {
    display: inline-flex;
    align-items: center;
    min-height: 22px;
    padding: 0 7px;
    border-radius: 999px;
    color: #dffcff;
    background: rgba(116, 245, 255, 0.12);
    border: 1px solid rgba(116, 245, 255, 0.2);
    font-family: "Space Mono", monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    vertical-align: middle;
  }

  .menu-console-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .menu-console-kicker {
    color: var(--menu-muted);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.2em;
  }

  .menu-console-note {
    color: #d6edf5;
    font-size: 12px;
    line-height: 1.5;
    text-align: right;
  }

  .menu-section + .menu-section {
    margin-top: 16px;
  }

  .menu-label {
    display: block;
    margin-bottom: 8px;
    color: var(--menu-muted);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
  }

  .menu-input {
    width: 100%;
    min-height: 54px;
    padding: 0 16px;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
    color: var(--menu-text);
    font-family: "Oxanium", sans-serif;
    font-size: 18px;
    letter-spacing: 0.06em;
    outline: none;
    transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
    appearance: none;
  }

  .menu-input::placeholder {
    color: #5f7689;
  }

  .menu-input:hover:not(:focus) {
    border-color: rgba(255, 255, 255, 0.18);
  }

  .menu-input:focus {
    border-color: rgba(116, 245, 255, 0.42);
    box-shadow: 0 0 0 3px rgba(116, 245, 255, 0.12);
    background: rgba(255, 255, 255, 0.05);
  }

  .menu-input option {
    color: var(--menu-text);
    background: #071019;
  }

  .menu-input--error {
    border-color: rgba(255, 115, 156, 0.56) !important;
    box-shadow: 0 0 0 3px rgba(255, 115, 156, 0.12) !important;
  }

  .menu-name-error {
    min-height: 18px;
    margin-top: 7px;
    color: #ff8eb7;
    font-size: 12px;
    line-height: 1.4;
  }

  .menu-divider {
    height: 1px;
    margin: 18px 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.12), transparent);
  }

  .menu-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .menu-btn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 4px;
    min-height: 88px;
    padding: 14px 16px;
    border-radius: 22px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: var(--menu-text);
    cursor: pointer;
    text-align: left;
    transition: transform 0.14s ease, border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
  }

  .menu-btn:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.24);
    background: rgba(255, 255, 255, 0.06);
    box-shadow: 0 16px 28px rgba(0, 0, 0, 0.2);
  }

  .menu-btn:active {
    transform: translateY(0);
  }

  .menu-btn:focus-visible {
    outline: 2px solid rgba(116, 245, 255, 0.48);
    outline-offset: 3px;
  }

  .menu-btn--primary {
    background: linear-gradient(135deg, rgba(116, 245, 255, 0.16), rgba(116, 245, 255, 0.05));
    border-color: rgba(116, 245, 255, 0.26);
  }

  .menu-btn--secondary {
    background: linear-gradient(135deg, rgba(255, 130, 239, 0.16), rgba(255, 130, 239, 0.05));
    border-color: rgba(255, 130, 239, 0.26);
  }

  .menu-btn__eyebrow {
    color: var(--menu-muted);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.16em;
  }

  .menu-btn__title {
    font-size: 19px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .menu-actions-note {
    margin-top: 14px;
    color: #cfe4ee;
    font-size: 12px;
    line-height: 1.55;
  }

  .menu-version {
    position: absolute;
    left: 18px;
    bottom: 14px;
    color: rgba(141, 167, 188, 0.7);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.16em;
  }

  @media (max-width: 920px) {
    .menu-grid {
      grid-template-columns: 1fr;
    }

    .menu-console {
      max-width: none;
    }
  }

  @media (max-width: 640px) {
    .menu-root {
      padding: 12px;
    }

    .menu-brand,
    .menu-console {
      border-radius: 24px;
    }

    .menu-brand {
      padding: 20px;
    }

    .menu-console {
      padding: 18px;
    }

    .menu-title {
      font-size: 42px;
    }

    .menu-subtitle {
      font-size: 16px;
    }

    .menu-description {
      font-size: 14px;
      line-height: 1.6;
    }

    .menu-input {
      min-height: 48px;
      font-size: 16px;
    }

    .menu-actions {
      grid-template-columns: 1fr;
    }

    .menu-btn {
      min-height: 74px;
    }

    .menu-controls-copy {
      font-size: 12px;
      line-height: 1.8;
    }
  }

  @media (max-height: 720px) {
    .menu-brand {
      padding-top: 20px;
      padding-bottom: 22px;
    }

    .menu-title {
      font-size: clamp(38px, 7vw, 72px);
    }

    .menu-subtitle {
      margin-top: 10px;
      font-size: 17px;
    }

    .menu-description {
      margin-top: 14px;
      font-size: 14px;
    }

    .menu-highlights {
      margin-top: 16px;
    }

    .menu-controls {
      margin-top: 18px;
      padding-top: 16px;
    }

    .menu-input {
      min-height: 48px;
    }

    .menu-btn {
      min-height: 74px;
      padding-top: 12px;
      padding-bottom: 12px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .menu-root,
    .menu-brand,
    .menu-console,
    .menu-orb {
      animation: none !important;
    }
  }
`;

export interface MenuElements {
  container: HTMLDivElement;
  root: HTMLElement;
  nameInput: HTMLInputElement;
  nameError: HTMLElement;
  matchSizeSelect: HTMLSelectElement;
  playSoloButton: HTMLButtonElement;
  playOnlineButton: HTMLButtonElement;
}

export function injectMenuStyle(): HTMLStyleElement {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
  return style;
}

export function createMenuView(savedName: string, matchSize: MatchTeamSize): MenuElements {
  const mobile = isTouchDevice();
  const controlsHtml = mobile
    ? `Drag screen to look &nbsp;&middot;&nbsp; Left stick moves in the breach room<br>
       <span class="menu-key">GRAB</span> Catch a rail &nbsp;&middot;&nbsp;
       <span class="menu-key">LAUNCH</span> Hold and drag down to charge<br>
       <span class="menu-key">FIRE</span> Freeze shot &nbsp;&middot;&nbsp;
       <span class="menu-key">3RD / 1ST</span> Swap view`
    : `<span class="menu-key">WASD</span> Move in breach room &nbsp;&middot;&nbsp;
       <span class="menu-key">E</span> Grab / release rail &nbsp;&middot;&nbsp;
       <span class="menu-key">SPACE</span> Jump or charge launch<br>
       <span class="menu-key">LMB</span> Freeze shot &nbsp;&middot;&nbsp;
       <span class="menu-key">V</span> Third person &nbsp;&middot;&nbsp;
       <span class="menu-key">B</span> Selfie view &nbsp;&middot;&nbsp;
       <span class="menu-key">ESC</span> Release cursor`;

  const container = document.createElement("div");
  container.innerHTML = `
    <div class="menu-root" id="menu-root">
      <div class="menu-orb menu-orb--cyan"></div>
      <div class="menu-orb menu-orb--magenta"></div>

      <span class="menu-corner menu-corner--tl"></span>
      <span class="menu-corner menu-corner--tr"></span>
      <span class="menu-corner menu-corner--bl"></span>
      <span class="menu-corner menu-corner--br"></span>

      <div class="menu-grid">
        <section class="menu-brand">
          <div class="menu-kicker">Zero-G squad skirmish</div>
          <div class="menu-title">
            <span>Orbital</span>
            <span>Breach</span>
          </div>
          <div class="menu-subtitle">Freeze. Slingshot. Breach.</div>

          <p class="menu-description">
            Freeze their movement, sling off arena rails, and punch through the enemy portal
            before your squad gets stranded in open zero-G.
          </p>

          <div class="menu-highlights">
            <span class="menu-chip">Vibe Jam 2026 build</span>
            <span class="menu-chip">Solo bots 1v1 to 20v20</span>
            <span class="menu-chip">5-round match point</span>
          </div>

          <div class="menu-controls">
            <div class="menu-controls-title">Flight controls</div>
            <div class="menu-controls-copy">${controlsHtml}</div>
          </div>
        </section>

        <section class="menu-console">
          <div class="menu-console-header">
            <div class="menu-console-kicker">Pre-flight console</div>
            <div class="menu-console-note">Press Enter any time to launch straight into solo.</div>
          </div>

          <div class="menu-section">
            <label class="menu-label" for="menu-name">Call Sign</label>
            <input
              class="menu-input"
              id="menu-name"
              type="text"
              placeholder="ENTER NAME"
              maxlength="16"
              value="${escapeHtml(savedName)}"
              autocomplete="off"
              spellcheck="false"
            />
            <div class="menu-name-error" id="menu-name-error" aria-live="polite"></div>
          </div>

          <div class="menu-section">
            <label class="menu-label" for="menu-match-size">Solo Match Size</label>
            <select class="menu-input" id="menu-match-size" aria-label="Solo match size">
              <option value="1" ${matchSize === 1 ? "selected" : ""}>1v1 Skirmish</option>
              <option value="2" ${matchSize === 2 ? "selected" : ""}>2v2 Duos</option>
              <option value="5" ${matchSize === 5 ? "selected" : ""}>5v5 Squad Clash</option>
              <option value="10" ${matchSize === 10 ? "selected" : ""}>10v10 Arena Rush</option>
              <option value="20" ${matchSize === 20 ? "selected" : ""}>20v20 Zero-G War</option>
            </select>
          </div>

          <div class="menu-divider"></div>

          <div class="menu-actions">
            <button class="menu-btn menu-btn--primary" id="btn-play-solo">
              <span class="menu-btn__eyebrow">Fastest route</span>
              <span class="menu-btn__title">Play Solo</span>
            </button>
            <button class="menu-btn menu-btn--secondary" id="btn-play-online">
              <span class="menu-btn__eyebrow">Live room</span>
              <span class="menu-btn__title">Play Online</span>
            </button>
          </div>

          <div class="menu-actions-note">
            Solo drops you in immediately. Online opens the shared lobby and match setup flow.
          </div>
        </section>
      </div>

      <div class="menu-version">v0.1.0 &middot; Orbital Breach</div>
    </div>
  `;
  document.body.appendChild(container);

  return {
    container,
    root: container.querySelector<HTMLElement>("#menu-root")!,
    nameInput: container.querySelector<HTMLInputElement>("#menu-name")!,
    nameError: container.querySelector<HTMLElement>("#menu-name-error")!,
    matchSizeSelect: container.querySelector<HTMLSelectElement>("#menu-match-size")!,
    playSoloButton: container.querySelector<HTMLButtonElement>("#btn-play-solo")!,
    playOnlineButton: container.querySelector<HTMLButtonElement>("#btn-play-online")!,
  };
}

function escapeHtml(raw: string): string {
  return raw.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return ch;
    }
  });
}
