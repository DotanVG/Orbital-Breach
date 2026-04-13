import type { EnemyPlayerInfo, FullPlayerInfo } from '../../../../shared/schema';

/**
 * Build the inner HTML for the TAB-held scoreboard. Extracted as a pure
 * string builder so the HUD controller can stay focused on show/hide
 * orchestration.
 */
export function buildScoreboardHtml(own: FullPlayerInfo[], enemy: EnemyPlayerInfo[]): string {
  const header = (cols: string[]) =>
    `<tr style="color:#88aacc;border-bottom:1px solid #334;">${cols.map((c) => `<th style="padding:2px 10px;text-align:left;">${c}</th>`).join('')}</tr>`;

  const ownRows = own.map((p) =>
    `<tr>
      <td style="padding:2px 10px;">${p.name}</td>
      <td style="padding:2px 10px;color:${p.frozen ? '#ff5555' : '#55ff55'}">${p.frozen ? 'FROZEN' : 'ACTIVE'}</td>
      <td style="padding:2px 10px;">${p.kills}</td>
      <td style="padding:2px 10px;">${p.deaths}</td>
      <td style="padding:2px 10px;">${p.ping}ms</td>
    </tr>`).join('');

  const enemyRows = enemy.map((p) =>
    `<tr>
      <td style="padding:2px 10px;">${p.name}</td>
      <td style="padding:2px 10px;">—</td>
      <td style="padding:2px 10px;">${p.kills}</td>
      <td style="padding:2px 10px;">${p.deaths}</td>
      <td style="padding:2px 10px;">${p.ping}ms</td>
    </tr>`).join('');

  return `<table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr><th colspan="5" style="color:#00ffff;font-size:14px;padding:4px 10px;text-align:left;">▲ OWN TEAM</th></tr>
      ${header(['Name', 'Status', 'K', 'D', 'Ping'])}
    </thead>
    <tbody>${ownRows}</tbody>
    <thead>
      <tr><th colspan="5" style="color:#ff55ff;font-size:14px;padding:8px 10px 4px;text-align:left;">▼ ENEMY TEAM</th></tr>
      ${header(['Name', '', 'K', 'D', 'Ping'])}
    </thead>
    <tbody>${enemyRows}</tbody>
  </table>`;
}
