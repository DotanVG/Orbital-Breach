import type { MatchTeamSize } from "../../../shared/match";
import type { MultiplayerRoomSnapshot } from "../../../shared/multiplayer";

const CYAN = "#7ffcff";
const MAGENTA = "#ff7df8";

export function buildLobbyMarkup(): string {
  return `
    <div class="ob-mp-shell">
      <div class="ob-mp-header">
        <div>
          <div class="ob-mp-kicker">Online queue</div>
          <div class="ob-mp-title">Orbital Breach</div>
          <div class="ob-mp-subtitle">
            Balance the squads, ready the room, and deploy straight into the live round cycle.
          </div>
        </div>

        <div class="ob-mp-phase-block">
          <div id="mp-phase" class="ob-mp-phase">Lobby Open</div>
          <div id="mp-meta" class="ob-mp-meta"></div>
          <div id="mp-score" class="ob-mp-score">0 - 0</div>
        </div>
      </div>

      <div class="ob-mp-body">
        <div id="mp-status" class="ob-mp-status"></div>

        <div class="ob-mp-controls">
          <label class="ob-mp-select-wrap">
            <span class="ob-mp-select-label">Playlist</span>
            <select id="mp-team-size" class="ob-mp-select"></select>
          </label>

          <button id="mp-ready" class="ob-mp-button ob-mp-button--ready">Ready Check</button>
          <button id="mp-switch-team" class="ob-mp-button ob-mp-button--switch">Move Team</button>
          <button id="mp-fill-bots" class="ob-mp-button ob-mp-button--bots">Fill Lobby</button>
          <button id="mp-clear-bots" class="ob-mp-button ob-mp-button--clear">Humans Only</button>
          <button id="mp-settings" class="ob-mp-button ob-mp-button--settings">Settings</button>
          <button id="mp-leave" class="ob-mp-button ob-mp-button--leave">Main Menu</button>
        </div>

        <div class="ob-mp-invite">
          <div class="ob-mp-invite-head">
            <div>
              <div class="ob-mp-card-label">Invite</div>
              <div class="ob-mp-invite-title">Share This Room</div>
            </div>
            <div id="mp-invite-qr-meta" class="ob-mp-roster-meta">Waiting for room id</div>
          </div>

          <div class="ob-mp-invite-grid">
            <div class="ob-mp-invite-main">
              <span class="ob-mp-select-label">Direct URL</span>
              <input id="mp-invite-url" class="ob-mp-invite-url" readonly />
              <div class="ob-mp-invite-actions">
                <button id="mp-copy-invite" class="ob-mp-button">Copy Link</button>
                <button id="mp-share-invite" class="ob-mp-button">Share</button>
              </div>
              <div id="mp-invite-note" class="ob-mp-invite-note"></div>
            </div>

            <div id="mp-qr-card" class="ob-mp-qr-card">
              <img id="mp-invite-qr" alt="Room invite QR code" />
              <div class="ob-mp-qr-loader" aria-hidden="true">
                <div class="ob-mp-qr-spinner"></div>
              </div>
            </div>
          </div>
        </div>

        <div style="display:none">
          <div id="mp-playlist-card"></div>
          <div id="mp-queue-card"></div>
          <div id="mp-team-card"></div>
        </div>

        <div class="ob-mp-briefing-layout">
          <div class="ob-mp-brief-panel ob-mp-brief-panel--cyan">
            <div class="ob-mp-panel-head">
              <h3 class="ob-mp-panel-title">Team Cyan <span class="ob-mp-panel-idx">// 01</span></h3>
              <span id="mp-team0-relation">Friendly</span>
            </div>
            <div class="ob-mp-brief-team-head">
              <span id="mp-team0-title" class="ob-mp-brief-team-name" style="color:${CYAN}">Cyan</span>
              <span id="mp-team0-count" class="ob-mp-brief-team-count"></span>
            </div>
            <div id="mp-team0-roster" class="ob-mp-brief-roster"></div>
          </div>

          <div class="ob-mp-stage-preview">
            <div class="ob-mp-stage-head">
              <h2 class="ob-mp-stage-title">Zero-G Arena</h2>
              <div class="ob-mp-stage-meta">Orbital Station</div>
            </div>
            <div class="ob-mp-map">
              <div class="ob-mp-map-inner">
                <svg class="ob-mp-arena-svg" viewBox="-200 -200 400 400">
                  <rect x="-190" y="-190" width="380" height="380" fill="none" stroke="rgba(210,220,240,0.1)"/>
                  <line x1="0" y1="-190" x2="0" y2="190" stroke="rgba(210,220,240,0.05)" stroke-dasharray="2 4"/>
                  <line x1="-190" y1="0" x2="190" y2="0" stroke="rgba(210,220,240,0.05)" stroke-dasharray="2 4"/>
                  <g stroke="rgba(210,220,240,0.25)" fill="none">
                    <path d="M -170 -130 L -80 -130 L -80 -60 L -170 -60 Z"/>
                    <path d="M 170 130 L 80 130 L 80 60 L 170 60 Z"/>
                  </g>
                  <text x="-125" y="-142" text-anchor="middle" font-family="JetBrains Mono" font-size="8" fill="oklch(0.82 0.15 210)" letter-spacing="2">CYAN BREACH</text>
                  <text x="125" y="150" text-anchor="middle" font-family="JetBrains Mono" font-size="8" fill="oklch(0.72 0.25 330)" letter-spacing="2">MAGENTA BREACH</text>
                  <circle cx="-80" cy="-95" r="10" fill="none" stroke="oklch(0.82 0.15 210)" stroke-opacity="0.7"/>
                  <circle cx="-80" cy="-95" r="3" fill="oklch(0.82 0.15 210)"/>
                  <circle cx="80" cy="95" r="10" fill="none" stroke="oklch(0.72 0.25 330)" stroke-opacity="0.7"/>
                  <circle cx="80" cy="95" r="3" fill="oklch(0.72 0.25 330)"/>
                  <g stroke="rgba(210,220,240,0.18)">
                    <line x1="-40" y1="-40" x2="40" y2="40"/>
                    <line x1="40" y1="-40" x2="-40" y2="40"/>
                    <line x1="-60" y1="0" x2="60" y2="0"/>
                    <line x1="0" y1="-60" x2="0" y2="60"/>
                  </g>
                  <circle cx="0" cy="0" r="4" fill="rgba(210,220,240,0.3)"/>
                  <circle cx="0" cy="0" r="18" fill="none" stroke="rgba(210,220,240,0.1)"/>
                  <circle cx="0" cy="0" r="45" fill="none" stroke="rgba(210,220,240,0.05)"/>
                  <path d="M -80 -95 Q -20 0 80 95" fill="none" stroke="oklch(0.82 0.15 210)" stroke-opacity="0.35" stroke-dasharray="3 4"/>
                  <text x="-185" y="185" font-family="JetBrains Mono" font-size="7" fill="rgba(87,99,122,1)">400m</text>
                  <text x="148" y="-178" font-family="JetBrains Mono" font-size="7" fill="rgba(87,99,122,1)">&#8593; ZENITH</text>
                </svg>
              </div>
            </div>
            <div class="ob-mp-loadout-row">
              <div class="ob-mp-loadout-item">
                <span class="ob-mp-loadout-key">Weapon</span>
                <span class="ob-mp-loadout-val">Freeze Pistol</span>
              </div>
              <div class="ob-mp-loadout-item">
                <span class="ob-mp-loadout-key">Module</span>
                <span class="ob-mp-loadout-val">Grip Glove</span>
              </div>
              <div class="ob-mp-loadout-item">
                <span class="ob-mp-loadout-key">Mode</span>
                <span class="ob-mp-loadout-val">Freeze &amp; Breach</span>
              </div>
            </div>
          </div>

          <div class="ob-mp-brief-panel ob-mp-brief-panel--magenta">
            <div class="ob-mp-panel-head">
              <h3 class="ob-mp-panel-title">Team Magenta <span class="ob-mp-panel-idx" style="color:oklch(0.72 0.25 330)">// 02</span></h3>
              <span id="mp-team1-relation">Hostile</span>
            </div>
            <div class="ob-mp-brief-team-head">
              <span id="mp-team1-title" class="ob-mp-brief-team-name" style="color:${MAGENTA}">Magenta</span>
              <span id="mp-team1-count" class="ob-mp-brief-team-count"></span>
            </div>
            <div id="mp-team1-roster" class="ob-mp-brief-roster"></div>

            <div class="ob-mp-rule"></div>

            <div class="ob-mp-mission-brief">
              <p><strong>Objective.</strong> Slip a pilot through the opposing portal. Freeze shots disable movement for the remainder of the round.</p>
              <p><strong>Scoring.</strong> Each successful breach scores one point. First team to fill their round quota wins the match.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderSummaryCard(label: string, value: string, copy: string): string {
  return `
    <div class="ob-mp-card-label">${escapeHtml(label)}</div>
    <div class="ob-mp-card-value">${escapeHtml(value)}</div>
    <div class="ob-mp-card-copy">${escapeHtml(copy)}</div>
  `;
}

export function renderRoster(
  members: MultiplayerRoomSnapshot["members"],
  sessionId: string,
  team: 0 | 1,
): string {
  if (members.length === 0) {
    return `<div class="ob-mp-empty">Open lane</div>`;
  }

  return members.map((member, i) => {
    const isSelf = member.id === sessionId;
    const selfCls = isSelf
      ? (team === 1 ? "ob-mp-brief-row--self-magenta" : "ob-mp-brief-row--self-cyan")
      : "";
    const pendingCls = !member.ready ? "ob-mp-brief-row--pending" : "";
    const dotCls = !member.ready
      ? "ob-mp-brief-ready-dot--pending"
      : team === 1 ? "ob-mp-brief-ready-dot--magenta" : "";
    const slot = String(i + 1).padStart(2, "0");
    const nameLabel = escapeHtml(member.name)
      + (member.isBot ? `<small style="opacity:.4;font-size:8px;letter-spacing:1px"> [bot]</small>` : "");
    return `
      <div class="ob-mp-brief-row ${selfCls} ${pendingCls}">
        <span class="ob-mp-brief-slot">${slot}</span>
        <span>${nameLabel}</span>
        <span class="ob-mp-brief-kd">${member.connected ? "—" : "dc"}</span>
        <span class="ob-mp-brief-ready-dot ${dotCls}"></span>
      </div>
    `;
  }).join("");
}

export function getTeamRelationLabel(selfTeam: 0 | 1, targetTeam: 0 | 1): "Friendly" | "Hostile" {
  return selfTeam === targetTeam ? "Friendly" : "Hostile";
}

export function describePhase(state: MultiplayerRoomSnapshot): string {
  switch (state.phase) {
    case "COUNTDOWN":
      return `Ready Check · ${Math.ceil(state.countdownRemaining)}`;
    case "PLAYING":
      return `Round Live · ${formatLobbyTime(state.roundTimeRemaining)}`;
    case "ROUND_END":
      return "Round Complete";
    default:
      return "Lobby Open";
  }
}

export function describeQueueState(state: MultiplayerRoomSnapshot, humans: number): string {
  if (state.phase === "COUNTDOWN") {
    return "Both squads are full and the ready check passed.";
  }
  if (state.phase === "PLAYING") {
    return "Match is live. Menu access and settings stay available between points.";
  }
  if (state.phase === "ROUND_END") {
    return "Point resolved. The next round will auto-cycle while the room stays checked in.";
  }
  if (state.matchComplete) {
    return "Match complete. Teams stay together in-room until everyone explicitly readies again.";
  }
  if (humans === 0) {
    return "Waiting for pilots to join the room.";
  }
  return "Bots can backfill open seats until more humans connect.";
}

export function playlistLabel(size: MatchTeamSize): string {
  switch (size) {
    case 1:
      return "1v1 Duel";
    case 2:
      return "2v2 Duos";
    case 5:
      return "5v5 Squads";
    case 10:
      return "10v10 Rush";
    case 20:
      return "20v20 War";
  }
}

export function formatLobbyTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
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
