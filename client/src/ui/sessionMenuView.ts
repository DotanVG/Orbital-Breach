import {
  ASSET_CREDITS,
  AUDIO_CREDITS,
  GITHUB_REPO_URL,
  ITCH_IO_URL,
  NOAM_SOUNDCLOUD_URL,
} from "./creditsContent";
import type { InstructionsContent } from "./instructionsContent";
import { GITHUB_ICON_SVG, ITCH_ICON_SVG } from "./linkIcons";

export function buildSessionMenuMarkup(instructionsContent: InstructionsContent): string {
  return `
    <div class="ob-session-panel">
      <div class="ob-session-header">
        <div class="ob-session-kicker">Session Menu</div>
        <div id="session-menu-title" class="ob-session-title"></div>
        <div id="session-menu-subtitle" class="ob-session-subtitle"></div>
      </div>

      <div class="ob-session-actions">
        <button id="session-menu-resume" type="button" class="ob-session-button ob-session-button--resume"></button>
        <button id="session-menu-main" type="button" class="ob-session-button ob-session-button--exit"></button>
      </div>

      <div class="ob-session-settings">
        <div id="session-menu-settings-view" class="ob-session-view">
          <section class="ob-session-settings-card">
            <div class="ob-session-settings-title">Flight Settings</div>
            <div class="ob-session-note">Changes apply immediately.</div>

            <div class="ob-session-field">
              <div class="ob-session-field-head">
                <span class="ob-session-field-label">Mouse Sensitivity</span>
                <span id="session-menu-sensitivity-value" class="ob-session-value"></span>
              </div>
              <input id="session-menu-sensitivity" class="ob-session-range" type="range" min="5" max="40" step="1" />
            </div>

            <div class="ob-session-field">
              <div class="ob-session-field-head">
                <span class="ob-session-field-label">Soundtrack</span>
                <span id="session-menu-soundtrack-value" class="ob-session-value"></span>
              </div>
              <label class="ob-session-toggle">
                <span class="ob-session-toggle-copy">Play music during menus and matches.</span>
                <input id="session-menu-soundtrack" class="ob-session-checkbox" type="checkbox" />
              </label>
            </div>

            <div class="ob-session-field">
              <div class="ob-session-field-head">
                <span class="ob-session-field-label">Fullscreen</span>
                <span id="session-menu-fullscreen-value" class="ob-session-value"></span>
              </div>
              <label class="ob-session-toggle">
                <span class="ob-session-toggle-copy">Use fullscreen when this browser allows it.</span>
                <input id="session-menu-fullscreen" class="ob-session-checkbox" type="checkbox" />
              </label>
            </div>

            <div class="ob-session-field">
              <div class="ob-session-field-head">
                <span class="ob-session-field-label">Music Level</span>
                <span id="session-menu-music-value" class="ob-session-value"></span>
              </div>
              <input id="session-menu-music" class="ob-session-range" type="range" min="0" max="100" step="1" />
            </div>

            <div class="ob-session-field">
              <div class="ob-session-field-head">
                <span class="ob-session-field-label">SFX Level</span>
                <span id="session-menu-sfx-value" class="ob-session-value"></span>
              </div>
              <input id="session-menu-sfx" class="ob-session-range" type="range" min="0" max="100" step="1" />
            </div>

            <div class="ob-session-field">
              <div class="ob-session-field-head">
                <span class="ob-session-field-label">Default Camera</span>
              </div>
              <select id="session-menu-camera" class="ob-session-select">
                <option value="first">First Person</option>
                <option value="third">Third Person</option>
              </select>
            </div>

            <div class="ob-session-field">
              <div class="ob-session-field-head">
                <span class="ob-session-field-label">Collision Debug</span>
                <span id="session-menu-collisionvis-value" class="ob-session-value"></span>
              </div>
              <label class="ob-session-toggle">
                <span class="ob-session-toggle-copy">Overlay wireframe collision volumes — player sphere, obstacle AABBs, grab bars, breach room bounds. Press [ in-game to toggle.</span>
                <input id="session-menu-collisionvis" class="ob-session-checkbox" type="checkbox" />
              </label>
            </div>
          </section>

          <section class="ob-session-settings-card">
            <div class="ob-session-settings-title">Instructions</div>
            <div class="ob-session-note">Review objective, round flow, and scoring before launch.</div>
            <div class="ob-session-card-actions">
              <button id="session-menu-open-instructions" type="button" class="ob-session-inline-button">Open Instructions</button>
            </div>
          </section>

          <section class="ob-session-settings-card">
            <div class="ob-session-settings-title">Credits</div>
            <div class="ob-session-note">View music, sound, asset, and project credits.</div>
            <div class="ob-session-card-actions">
              <button id="session-menu-open-credits" type="button" class="ob-session-inline-button">Open Credits</button>
            </div>
          </section>
        </div>

        <div id="session-menu-instructions-view" class="ob-session-view" hidden>
          ${buildInstructionsHtml(instructionsContent)}

          <div class="ob-session-card-actions">
            <button id="session-menu-back-to-settings-from-instructions" type="button" class="ob-session-inline-button ob-session-inline-button--ghost">Back To Settings</button>
          </div>
        </div>

        <div id="session-menu-credits-view" class="ob-session-view" hidden>
          <section class="ob-session-settings-card">
            <div class="ob-session-settings-title">Project Links</div>
            <div class="ob-session-note">External pages open in a new tab.</div>
            <div class="ob-session-link-grid">
              <a class="ob-session-link" href="${GITHUB_REPO_URL}" target="_blank" rel="noreferrer noopener">
                ${GITHUB_ICON_SVG}
                <span>GITHUB REPO</span>
                <span>&nearr;</span>
              </a>
              <a class="ob-session-link" href="${ITCH_IO_URL}" target="_blank" rel="noreferrer noopener">
                ${ITCH_ICON_SVG}
                <span>DOTANV.ITCH.IO</span>
                <span>&nearr;</span>
              </a>
            </div>
          </section>

          <section class="ob-session-settings-card">
            <div class="ob-session-settings-title">Audio Credits</div>
            <div class="ob-session-note">Original soundtrack and sound design for Orbital Breach.</div>
            <div class="ob-session-credit-list">
              ${AUDIO_CREDITS.map((credit) => `
                <article class="ob-session-credit-item">
                  <div class="ob-session-credit-name">${escapeHtml(credit.title)}</div>
                  <div class="ob-session-credit-detail">${escapeHtml(credit.detail)}</div>
                </article>
              `).join("")}
            </div>
            <div class="ob-session-link-grid">
              <a class="ob-session-link" href="${NOAM_SOUNDCLOUD_URL}" target="_blank" rel="noreferrer noopener">
                <span>NOAM OUZANA — SOUNDCLOUD</span>
                <span>&nearr;</span>
              </a>
            </div>
          </section>

          <section class="ob-session-settings-card">
            <div class="ob-session-settings-title">Asset Credits</div>
            <div class="ob-session-note">3D assets featured in Orbital Breach.</div>
            <div class="ob-session-credit-list">
              ${ASSET_CREDITS.map((credit) => `
                <article class="ob-session-credit-item">
                  <div class="ob-session-credit-name">${escapeHtml(credit.title)}</div>
                  <div class="ob-session-credit-detail">${escapeHtml(credit.detail)}</div>
                  ${credit.url ? `<a class="ob-session-credit-link" href="${escapeHtml(credit.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(credit.url)} &nearr;</a>` : ""}
                </article>
              `).join("")}
            </div>
          </section>

          <div class="ob-session-card-actions">
            <button id="session-menu-back-to-settings" type="button" class="ob-session-inline-button ob-session-inline-button--ghost">Back To Settings</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function buildInstructionsHtml(content: InstructionsContent): string {
  const controlsHtml = content.controls.length > 0
    ? `
      <section class="ob-session-settings-card">
        <div class="ob-session-settings-title">Controls</div>
        <div class="ob-session-note">Keyboard and mouse bindings from the quick reference.</div>
        <div class="ob-session-control-list">
          ${content.controls.map((control) => `
            <div class="ob-session-control-row">
              <div class="ob-session-control-key">${escapeHtml(control.input)}</div>
              <div class="ob-session-control-action">${escapeHtml(control.action)}</div>
            </div>
          `).join("")}
        </div>
      </section>
    `
    : "";

  return `
    ${controlsHtml}

    <section class="ob-session-settings-card">
      <div class="ob-session-settings-title">Objective</div>
      <div class="ob-session-note">Cyan and Magenta fight to breach the opposing room.</div>
      <div class="ob-session-instructions-grid">
        ${content.objective.map((item) => buildInstructionItem(item)).join("")}
      </div>
    </section>

    <section class="ob-session-settings-card">
      <div class="ob-session-settings-title">Round Flow</div>
      <div class="ob-session-note">From breach-room launch to zero-G freeze fight.</div>
      <div class="ob-session-instructions-grid">
        ${content.roundFlow.map((item) => buildInstructionItem(item)).join("")}
      </div>
    </section>

    <section class="ob-session-settings-card">
      <div class="ob-session-settings-title">Winning</div>
      <div class="ob-session-note">How rounds score, how matches end, and what happens on timeout.</div>
      <div class="ob-session-instructions-grid">
        ${content.winningScenarios.map((item) => buildInstructionItem(item, true)).join("")}
      </div>
    </section>
  `;
}

function buildInstructionItem(item: { title: string; body: string }, wide = false): string {
  return `
    <article class="ob-session-instruction-item${wide ? " ob-session-instruction-item--wide" : ""}">
      <div class="ob-session-instruction-title">${escapeHtml(item.title)}</div>
      <div class="ob-session-instruction-body">${escapeHtml(item.body)}</div>
    </article>
  `;
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
      case "\"":
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return ch;
    }
  });
}
