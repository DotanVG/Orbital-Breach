import type { EnemyPlayerInfo, FullPlayerInfo } from "../../../../shared/schema";

export interface ScoreboardRenderOptions {
  ownTeamId: 0 | 1;
  showPing: boolean;
}

export function buildScoreboardHtml(
  own: FullPlayerInfo[],
  enemy: EnemyPlayerInfo[],
  options: ScoreboardRenderOptions,
): string {
  const enemyTeamId = options.ownTeamId === 0 ? 1 : 0;

  return `
    <div class="ob-scoreboard">
      <div class="ob-scoreboard__meta">
        <div>Combat roster</div>
        <div>${options.showPing ? "Ping shown for live rooms" : "Solo skirmish telemetry"}</div>
      </div>

      <div class="ob-scoreboard__grid">
        ${buildPanel({
          players: own,
          teamId: options.ownTeamId,
          title: "Your squad",
          subtitle: "Friendly telemetry",
          showPing: options.showPing,
          showFrozenState: true,
        })}
        ${buildPanel({
          players: enemy,
          teamId: enemyTeamId,
          title: "Opposition",
          subtitle: "Partial recon feed",
          showPing: options.showPing,
          showFrozenState: false,
        })}
      </div>
    </div>
  `;
}

function buildPanel(options: {
  players: Array<FullPlayerInfo | EnemyPlayerInfo>;
  teamId: 0 | 1;
  title: string;
  subtitle: string;
  showPing: boolean;
  showFrozenState: boolean;
}): string {
  const panelClass = options.teamId === 0 ? "ob-scoreboard__panel--cyan" : "ob-scoreboard__panel--magenta";
  const rosterLabel = `${teamName(options.teamId)} // ${options.title}`;
  const summary = `${options.players.length} ${options.players.length === 1 ? "pilot" : "pilots"}`;

  const headers = [
    `<th>Name</th>`,
    `<th class="ob-scoreboard__cell--numeric">K</th>`,
    `<th class="ob-scoreboard__cell--numeric">D</th>`,
    `<th class="ob-scoreboard__cell--numeric">Freeze</th>`,
    options.showPing ? `<th class="ob-scoreboard__cell--ping">Ping</th>` : "",
  ].join("");

  const rows = options.players.length > 0
    ? options.players.map((player, index) => buildRow(player, index, options.showFrozenState, options.showPing)).join("")
    : `<div class="ob-scoreboard__empty">No pilots tracked.</div>`;

  return `
    <section class="ob-scoreboard__panel ${panelClass}">
      <div class="ob-scoreboard__header">
        <div>
          <div class="ob-scoreboard__title">${rosterLabel}</div>
          <div class="ob-scoreboard__subtitle">${options.subtitle}</div>
        </div>
        <div class="ob-scoreboard__summary">${summary}</div>
      </div>

      ${options.players.length > 0 ? `
        <table class="ob-scoreboard__table">
          <thead>
            <tr>${headers}</tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      ` : rows}
    </section>
  `;
}

function buildRow(
  player: FullPlayerInfo | EnemyPlayerInfo,
  index: number,
  showFrozenState: boolean,
  showPing: boolean,
): string {
  const isBot = player.isBot;
  const showYou = showFrozenState && index === 0 && !isBot;
  const badges = [
    showYou ? `<span class="ob-scoreboard__badge ob-scoreboard__badge--you">YOU</span>` : "",
    isBot ? `<span class="ob-scoreboard__badge ob-scoreboard__badge--bot">BOT</span>` : "",
  ].join("");

  const freezeCell = showFrozenState
    ? renderFreezeBadge(Boolean((player as FullPlayerInfo).frozen))
    : `<span class="ob-scoreboard__freeze ob-scoreboard__freeze--hidden">Hidden</span>`;

  const pingCell = showPing
    ? `<td class="ob-scoreboard__cell--ping">${formatPing(player.ping)}</td>`
    : "";

  return `
    <tr>
      <td>
        <div class="ob-scoreboard__name">
          <span class="ob-scoreboard__name-text">${escapeHtml(player.name)}</span>
          ${badges}
        </div>
      </td>
      <td class="ob-scoreboard__cell--numeric">${player.kills}</td>
      <td class="ob-scoreboard__cell--numeric">${player.deaths}</td>
      <td class="ob-scoreboard__cell--numeric">${freezeCell}</td>
      ${pingCell}
    </tr>
  `;
}

function renderFreezeBadge(frozen: boolean): string {
  if (frozen) {
    return `<span class="ob-scoreboard__freeze ob-scoreboard__freeze--frozen">Frozen</span>`;
  }

  return `<span class="ob-scoreboard__freeze ob-scoreboard__freeze--clear">Clear</span>`;
}

function formatPing(ping: number): string {
  return ping > 0 ? `${Math.round(ping)}ms` : "—";
}

function teamName(teamId: 0 | 1): string {
  return teamId === 0 ? "Cyan" : "Magenta";
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
