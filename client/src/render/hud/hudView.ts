/**
 * Static DOM structure for the in-game HUD. Mutable nodes are addressed by
 * `id`, while the overall look is driven by a single injected stylesheet so
 * the menu, tutorial, scoreboard, and combat HUD share the same token set.
 */
const HUD_MARKUP = `
  <div id="hud-score-wrap" class="ob-score-cluster">
    <div class="ob-score-pill">
      <div id="hud-score-team0" class="ob-team-orb ob-team-orb--cyan"></div>
      <div id="hud-score" class="ob-score-value">0 - 0</div>
      <div id="hud-score-team1" class="ob-team-orb ob-team-orb--magenta"></div>
    </div>

    <div id="hud-round-timer" class="ob-round-timer">02:00</div>
  </div>

  <div id="hud-countdown" class="ob-countdown">10</div>
  <div id="hud-objective" class="ob-objective"></div>
  <div id="hud-crosshair" class="ob-crosshair"></div>

  <div id="hud-grab" class="ob-prompt ob-prompt--grab">[E] GRAB BAR</div>

  <div id="hud-power-wrap" class="ob-power-wrap">
    <div class="ob-power-track">
      <div id="hud-power-bar" class="ob-power-bar"></div>
    </div>
    <div id="hud-power-label" class="ob-power-label">POWER 0%</div>
  </div>

  <div id="hud-damage" class="ob-damage-panel"></div>

  <div id="hud-tutorial" class="ob-tutorial">
    <div id="hud-tutorial-step" class="ob-tutorial__eyebrow">FIRST FLIGHT 1/4</div>
    <div id="hud-tutorial-title" class="ob-tutorial__title"></div>
    <div id="hud-tutorial-body" class="ob-tutorial__body"></div>
  </div>

  <div id="hud-round-end" class="ob-round-end"></div>
  <div id="hud-tab" class="ob-scoreboard-overlay"></div>

  <div id="hud-help" class="ob-help-overlay">
    <div class="ob-help-panel">
      <div class="ob-help-header">
        <div class="ob-help-title">Controls</div>
        <div class="ob-help-close">[H] Close</div>
      </div>
      <div class="ob-help-grid">
        <div class="ob-help-row"><span class="ob-help-key">LMB</span><span class="ob-help-desc">Freeze shot</span></div>
        <div class="ob-help-row"><span class="ob-help-key">E</span><span class="ob-help-desc">Grab bar</span></div>
        <div class="ob-help-row"><span class="ob-help-key">Space + Mouse ↕</span><span class="ob-help-desc">Aim launch power</span></div>
        <div class="ob-help-row"><span class="ob-help-key">Space release</span><span class="ob-help-desc">Slingshot into zero-G</span></div>
        <div class="ob-help-row"><span class="ob-help-key">Tab</span><span class="ob-help-desc">Scoreboard</span></div>
        <div class="ob-help-row"><span class="ob-help-key">Esc</span><span class="ob-help-desc">Session menu</span></div>
        <div class="ob-help-row"><span class="ob-help-key">V</span><span class="ob-help-desc">Third-person toggle</span></div>
        <div class="ob-help-row ob-help-row--goal">Float through the enemy portal to breach and score</div>
      </div>
    </div>
  </div>
`;

const HUD_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300&family=JetBrains+Mono:wght@300;400;500&display=swap');

  .ob-hud-root {
    --hud-cyan: oklch(0.82 0.15 210);
    --hud-cyan-soft: oklch(0.82 0.15 210 / 0.14);
    --hud-magenta: oklch(0.72 0.25 330);
    --hud-magenta-soft: oklch(0.72 0.25 330 / 0.22);
    --hud-team: var(--hud-cyan);
    --hud-team-soft: var(--hud-cyan-soft);
    --hud-team-glow: oklch(0.82 0.15 210 / 0.38);
    --hud-text: #e8ecf4;
    --hud-muted: #9aa5b8;
    --hud-panel: rgba(7, 10, 18, 0.76);
    --hud-panel-strong: rgba(7, 10, 18, 0.92);
    --hud-panel-border: rgba(210, 220, 240, 0.16);
    --hud-shadow: 0 18px 44px rgba(0, 0, 0, 0.34);
    position: fixed;
    inset: 0;
    display: none;
    pointer-events: none;
    user-select: none;
    color: var(--hud-text);
    font-family: "Cormorant Garamond", serif;
  }

  .ob-hud-root * {
    box-sizing: border-box;
  }

  .ob-hud-root--cyan {
    --hud-team: var(--hud-cyan);
    --hud-team-soft: var(--hud-cyan-soft);
    --hud-team-glow: oklch(0.82 0.15 210 / 0.38);
  }

  .ob-hud-root--magenta {
    --hud-team: var(--hud-magenta);
    --hud-team-soft: var(--hud-magenta-soft);
    --hud-team-glow: oklch(0.72 0.25 330 / 0.42);
  }

  .ob-score-cluster {
    position: absolute;
    left: 50%;
    top: 18px;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .ob-score-pill,
  .ob-round-timer,
  .ob-objective,
  .ob-prompt,
  .ob-power-wrap,
  .ob-damage-panel,
  .ob-tutorial,
  .ob-scoreboard-overlay {
    background:
      linear-gradient(135deg, rgba(116, 245, 255, 0.07), rgba(255, 130, 239, 0.05)),
      var(--hud-panel);
    border: 1px solid var(--hud-panel-border);
    box-shadow: var(--hud-shadow);
    backdrop-filter: blur(12px);
  }

  .ob-score-pill {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 11px 18px;
    border-radius: 999px;
  }

  .ob-team-orb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.6);
  }

  .ob-team-orb--cyan {
    background: radial-gradient(circle, rgba(203, 255, 255, 1) 0%, rgba(116, 245, 255, 0.96) 34%, rgba(116, 245, 255, 0.24) 72%, rgba(116, 245, 255, 0) 100%);
    box-shadow: 0 0 18px rgba(116, 245, 255, 0.75);
  }

  .ob-team-orb--magenta {
    background: radial-gradient(circle, rgba(255, 226, 252, 1) 0%, rgba(255, 130, 239, 0.95) 34%, rgba(255, 130, 239, 0.22) 72%, rgba(255, 130, 239, 0) 100%);
    box-shadow: 0 0 18px rgba(255, 130, 239, 0.68);
  }

  .ob-score-value {
    min-width: 112px;
    font-family: "Cormorant Garamond", serif;
    font-size: 26px;
    font-weight: 400;
    letter-spacing: 0.22em;
    text-align: center;
    text-transform: uppercase;
    text-shadow: 0 0 18px oklch(0.82 0.15 210 / 0.25);
  }

  .ob-round-timer {
    display: none;
    padding: 7px 13px 6px;
    border-radius: 4px;
    color: #e8ecf4;
    font-family: "JetBrains Mono", monospace;
    font-size: 13px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .ob-countdown {
    display: none;
    position: absolute;
    left: 50%;
    top: 38%;
    transform: translate(-50%, -50%);
    font-family: "Cormorant Garamond", serif;
    font-size: 92px;
    font-weight: 300;
    letter-spacing: 0.08em;
    text-shadow: 0 0 40px oklch(0.82 0.15 210 / 0.9);
  }

  .ob-objective {
    display: none;
    position: absolute;
    left: 50%;
    top: 58%;
    transform: translate(-50%, -50%);
    max-width: min(620px, 82vw);
    padding: 10px 16px;
    border-radius: 4px;
    font-family: "JetBrains Mono", monospace;
    font-size: 12px;
    font-weight: 400;
    letter-spacing: 0.22em;
    line-height: 1.45;
    text-align: center;
    text-transform: uppercase;
    white-space: normal;
  }

  .ob-crosshair {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ffffff;
    opacity: 0.85;
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
  }

  .ob-prompt {
    display: none;
    position: absolute;
    left: 50%;
    bottom: 27%;
    transform: translateX(-50%);
    padding: 10px 16px;
    border-radius: 999px;
    font-size: 15px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-align: center;
  }

  .ob-power-wrap {
    display: none;
    position: absolute;
    left: 50%;
    bottom: 20%;
    transform: translateX(-50%);
    width: min(280px, 72vw);
    padding: 11px 12px 10px;
    border-radius: 18px;
  }

  .ob-power-track {
    height: 12px;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .ob-power-bar {
    width: 0;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, rgba(116, 245, 255, 0.98), rgba(255, 223, 127, 0.92));
    box-shadow: 0 0 18px rgba(116, 245, 255, 0.3);
  }

  .ob-power-label {
    margin-top: 7px;
    color: var(--hud-team);
    font-family: "JetBrains Mono", monospace;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-align: center;
    text-transform: uppercase;
    text-shadow: 0 0 8px var(--hud-team-glow);
  }

  .ob-damage-panel {
    position: absolute;
    left: 18px;
    bottom: 18px;
    display: none;
    width: min(260px, calc(100vw - 36px));
    padding: 14px;
    border-radius: 24px;
  }

  .ob-body-status {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .ob-body-status__header {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .ob-body-status__eyebrow,
  .ob-body-status__footer,
  .ob-body-status__legend,
  .ob-body-status__metric,
  .ob-body-status__part span {
    font-family: "JetBrains Mono", monospace;
    text-transform: uppercase;
  }

  .ob-body-status__eyebrow {
    color: var(--hud-muted);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
  }

  .ob-body-status__title {
    color: var(--hud-text);
    font-size: 24px;
    line-height: 1;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .ob-body-status__detail {
    color: var(--hud-team);
    font-size: 13px;
    letter-spacing: 0.06em;
    text-shadow: 0 0 12px var(--hud-team-glow);
  }

  .ob-body-status__diagram {
    position: relative;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-template-rows: repeat(4, auto);
    justify-items: center;
    align-items: center;
    gap: 7px 10px;
    padding: 14px 12px;
    border-radius: 18px;
    background:
      radial-gradient(circle at top, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0) 45%),
      rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .ob-body-status__part {
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    min-width: 40px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(157, 184, 200, 0.1);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
  }

  .ob-body-status__part span {
    position: absolute;
    top: calc(100% + 4px);
    color: var(--hud-muted);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.1em;
    white-space: nowrap;
  }

  .ob-body-status__part--head {
    grid-column: 2;
    grid-row: 1;
    width: 36px;
    height: 36px;
    border-radius: 999px;
  }

  .ob-body-status__part--leftArm {
    grid-column: 1;
    grid-row: 2;
    width: 28px;
    height: 74px;
    border-radius: 18px;
  }

  .ob-body-status__part--core {
    grid-column: 2;
    grid-row: 2 / span 2;
    width: 58px;
    height: 98px;
    border-radius: 28px;
  }

  .ob-body-status__part--rightArm {
    grid-column: 3;
    grid-row: 2;
    width: 28px;
    height: 74px;
    border-radius: 18px;
  }

  .ob-body-status__part--leftLeg {
    grid-column: 2;
    grid-row: 4;
    justify-self: end;
    width: 24px;
    height: 82px;
    margin-right: 18px;
    border-radius: 18px;
  }

  .ob-body-status__part--rightLeg {
    grid-column: 2;
    grid-row: 4;
    justify-self: start;
    width: 24px;
    height: 82px;
    margin-left: 18px;
    border-radius: 18px;
  }

  .ob-body-status__part--clear {
    background: linear-gradient(180deg, rgba(157, 184, 200, 0.22), rgba(157, 184, 200, 0.08));
    border-color: rgba(157, 184, 200, 0.24);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.04),
      0 0 16px rgba(157, 184, 200, 0.06);
  }

  .ob-body-status__part--partial {
    background: linear-gradient(180deg, rgba(255, 176, 77, 0.85), rgba(255, 121, 63, 0.4));
    border-color: rgba(255, 193, 122, 0.78);
    box-shadow:
      inset 0 0 0 1px rgba(255, 248, 231, 0.08),
      0 0 18px rgba(255, 162, 71, 0.28);
  }

  .ob-body-status__part--critical {
    background: linear-gradient(180deg, rgba(255, 130, 239, 0.96), rgba(116, 245, 255, 0.32));
    border-color: rgba(255, 190, 247, 0.8);
    box-shadow:
      inset 0 0 0 1px rgba(255, 240, 252, 0.12),
      0 0 22px rgba(255, 130, 239, 0.34);
  }

  .ob-body-status__footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 10px;
    color: var(--hud-muted);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
  }

  .ob-body-status__metric {
    color: var(--hud-text);
    margin-right: auto;
  }

  .ob-body-status__legend {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .ob-body-status__swatch {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.18);
  }

  .ob-body-status__swatch--clear {
    background: rgba(157, 184, 200, 0.26);
  }

  .ob-body-status__swatch--partial {
    background: rgba(255, 176, 77, 0.86);
  }

  .ob-body-status__swatch--critical {
    background: rgba(255, 130, 239, 0.9);
  }

  .ob-tutorial {
    display: none;
    position: absolute;
    left: 18px;
    top: 104px;
    width: min(320px, calc(100vw - 36px));
    padding: 14px 15px 15px;
    border-radius: 22px;
  }

  .ob-tutorial--cyan {
    border-color: rgba(116, 245, 255, 0.3);
    box-shadow:
      var(--hud-shadow),
      0 0 0 1px rgba(116, 245, 255, 0.08) inset;
  }

  .ob-tutorial--magenta {
    border-color: rgba(255, 130, 239, 0.34);
    box-shadow:
      var(--hud-shadow),
      0 0 0 1px rgba(255, 130, 239, 0.08) inset;
  }

  .ob-tutorial__eyebrow {
    color: var(--hud-team);
    font-family: "JetBrains Mono", monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .ob-tutorial__title {
    margin-top: 6px;
    color: var(--hud-team);
    font-family: "Cormorant Garamond", serif;
    font-size: 22px;
    font-weight: 400;
    letter-spacing: 0.06em;
  }

  .ob-tutorial__body {
    margin-top: 6px;
    color: var(--hud-team);
    font-size: 13px;
    line-height: 1.55;
    text-shadow: 0 0 10px var(--hud-team-glow);
  }

  .ob-round-end {
    display: none;
    position: absolute;
    inset: 0;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.18em;
    padding: 24px;
    background: linear-gradient(180deg, rgba(2, 8, 14, 0.38), rgba(2, 8, 14, 0.64));
    font-size: clamp(34px, 5vw, 56px);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-align: center;
    text-transform: uppercase;
    text-shadow: 0 0 34px rgba(255, 255, 255, 0.28);
  }
  .ob-round-end__line {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.32em;
  }
  .ob-round-end__team--cyan {
    color: oklch(0.82 0.15 210);
    text-shadow: 0 0 34px oklch(0.82 0.15 210 / 0.5);
  }
  .ob-round-end__team--magenta {
    color: oklch(0.72 0.25 330);
    text-shadow: 0 0 34px oklch(0.72 0.25 330 / 0.5);
  }
  .ob-round-end__text,
  .ob-round-end__score {
    color: #e8ecf4;
  }

  .ob-scoreboard-overlay {
    display: none;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(920px, 94vw);
    max-height: 80vh;
    overflow: auto;
    padding: 18px;
    border-radius: 28px;
    background:
      radial-gradient(circle at top, rgba(116, 245, 255, 0.12), rgba(116, 245, 255, 0) 34%),
      radial-gradient(circle at bottom right, rgba(255, 130, 239, 0.12), rgba(255, 130, 239, 0) 28%),
      var(--hud-panel-strong);
  }

  .ob-scoreboard {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .ob-scoreboard__meta {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    color: var(--hud-muted);
    font-family: "JetBrains Mono", monospace;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .ob-scoreboard__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .ob-scoreboard__panel {
    border-radius: 22px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
    overflow: hidden;
  }

  .ob-scoreboard__panel--cyan {
    box-shadow: 0 0 0 1px rgba(116, 245, 255, 0.06) inset;
  }

  .ob-scoreboard__panel--magenta {
    box-shadow: 0 0 0 1px rgba(255, 130, 239, 0.06) inset;
  }

  .ob-scoreboard__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px 13px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .ob-scoreboard__title {
    font-size: 19px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .ob-scoreboard__subtitle {
    margin-top: 2px;
    color: var(--hud-muted);
    font-family: "JetBrains Mono", monospace;
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .ob-scoreboard__summary {
    color: var(--hud-muted);
    font-family: "JetBrains Mono", monospace;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-align: right;
    text-transform: uppercase;
  }

  .ob-scoreboard__table {
    width: 100%;
    border-collapse: collapse;
  }

  .ob-scoreboard__table thead th {
    padding: 10px 16px;
    color: var(--hud-muted);
    font-family: "JetBrains Mono", monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-align: left;
    text-transform: uppercase;
  }

  .ob-scoreboard__table tbody tr {
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .ob-scoreboard__table td {
    padding: 12px 16px;
    font-size: 14px;
    vertical-align: middle;
  }

  .ob-scoreboard__cell--numeric,
  .ob-scoreboard__cell--ping {
    width: 1%;
    white-space: nowrap;
    text-align: center;
    font-family: "JetBrains Mono", monospace;
  }

  .ob-scoreboard__name {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .ob-scoreboard__name-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ob-scoreboard__badge {
    display: inline-flex;
    align-items: center;
    height: 20px;
    padding: 0 7px;
    border-radius: 999px;
    font-family: "JetBrains Mono", monospace;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .ob-scoreboard__badge--you {
    color: #dffcff;
    background: rgba(116, 245, 255, 0.16);
    border: 1px solid rgba(116, 245, 255, 0.34);
  }

  .ob-scoreboard__badge--bot {
    color: #ced9e8;
    background: rgba(157, 184, 200, 0.12);
    border: 1px solid rgba(157, 184, 200, 0.22);
  }

  .ob-scoreboard__freeze {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 86px;
    height: 26px;
    padding: 0 10px;
    border-radius: 999px;
    font-family: "JetBrains Mono", monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .ob-scoreboard__freeze--clear {
    color: #dffcff;
    background: rgba(116, 245, 255, 0.16);
    border: 1px solid rgba(116, 245, 255, 0.28);
  }

  .ob-scoreboard__freeze--frozen {
    color: #ffe3f7;
    background: rgba(255, 130, 239, 0.18);
    border: 1px solid rgba(255, 130, 239, 0.3);
  }

  .ob-scoreboard__freeze--hidden {
    color: rgba(157, 184, 200, 0.78);
    background: rgba(157, 184, 200, 0.08);
    border: 1px solid rgba(157, 184, 200, 0.14);
  }

  .ob-scoreboard__empty {
    padding: 18px 16px 20px;
    color: var(--hud-muted);
    font-family: "JetBrains Mono", monospace;
    font-size: 12px;
    letter-spacing: 0.12em;
    text-align: center;
    text-transform: uppercase;
  }

  @media (max-width: 820px) {
    .ob-scoreboard__grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .ob-score-cluster {
      top: 12px;
      gap: 6px;
    }

    .ob-score-pill {
      padding: 10px 14px;
      gap: 10px;
    }

    .ob-score-value {
      min-width: 90px;
      font-size: 20px;
      letter-spacing: 0.16em;
    }

    .ob-round-timer {
      font-size: 11px;
      letter-spacing: 0.14em;
    }

    .ob-countdown {
      font-size: 68px;
    }

    .ob-objective {
      top: 60%;
      max-width: 92vw;
      padding: 9px 12px;
      font-size: 11px;
      letter-spacing: 0.16em;
      line-height: 1.4;
    }

    .ob-tutorial {
      top: 110px;
      padding: 12px 13px 13px;
    }

    .ob-tutorial__title {
      font-size: 17px;
    }

    .ob-tutorial__body {
      font-size: 12px;
      line-height: 1.5;
    }

    .ob-prompt {
      bottom: 29%;
      width: min(92vw, 420px);
      padding: 9px 12px;
      font-size: 13px;
      line-height: 1.35;
    }

    .ob-power-wrap {
      bottom: 18%;
      width: min(86vw, 320px);
    }

    .ob-damage-panel {
      left: 12px;
      bottom: 12px;
      width: min(220px, calc(100vw - 24px));
      padding: 12px;
    }

    .ob-body-status__title {
      font-size: 19px;
    }

    .ob-body-status__detail {
      font-size: 12px;
    }

    .ob-body-status__diagram {
      gap: 6px 8px;
      padding: 12px 10px;
    }

    .ob-body-status__part span {
      font-size: 7px;
    }

    .ob-body-status__part--head {
      width: 30px;
      height: 30px;
    }

    .ob-body-status__part--leftArm,
    .ob-body-status__part--rightArm {
      width: 24px;
      height: 64px;
    }

    .ob-body-status__part--core {
      width: 48px;
      height: 84px;
    }

    .ob-body-status__part--leftLeg,
    .ob-body-status__part--rightLeg {
      width: 20px;
      height: 70px;
    }

    .ob-body-status__part--leftLeg {
      margin-right: 14px;
    }

    .ob-body-status__part--rightLeg {
      margin-left: 14px;
    }

    .ob-scoreboard-overlay {
      width: 96vw;
      padding: 12px;
      border-radius: 22px;
    }

    .ob-scoreboard__meta {
      flex-direction: column;
      align-items: flex-start;
    }

    .ob-scoreboard__header {
      padding: 12px 14px;
    }

    .ob-scoreboard__table thead th,
    .ob-scoreboard__table td {
      padding-left: 12px;
      padding-right: 12px;
    }
  }

  @media (max-height: 620px) {
    .ob-objective {
      top: 62%;
    }

    .ob-tutorial {
      top: 90px;
    }

    .ob-prompt {
      bottom: 24%;
    }

    .ob-power-wrap {
      bottom: 16%;
    }
  }

  /* ── HELP OVERLAY ── */
  .ob-help-overlay {
    position: absolute;
    inset: 0;
    display: none;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    z-index: 80;
    pointer-events: auto;
  }
  .ob-help-overlay.ob-help-visible {
    display: flex;
  }
  .ob-help-panel {
    background: rgba(7, 10, 18, 0.97);
    border: 1px solid rgba(210, 220, 240, 0.16);
    padding: 24px 28px;
    min-width: 320px;
    max-width: min(480px, 92vw);
  }
  .ob-help-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 18px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(210, 220, 240, 0.08);
  }
  .ob-help-title {
    font-family: "Cormorant Garamond", serif;
    font-size: 24px;
    font-weight: 300;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #e8ecf4;
  }
  .ob-help-close {
    font-family: "JetBrains Mono", monospace;
    font-size: 9px;
    letter-spacing: 0.12em;
    color: var(--hud-muted);
    text-transform: uppercase;
  }
  .ob-help-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .ob-help-row {
    display: flex;
    align-items: center;
    gap: 14px;
    font-family: "JetBrains Mono", monospace;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .ob-help-key {
    min-width: 120px;
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(210, 220, 240, 0.1);
    color: var(--hud-cyan);
    text-align: center;
    flex-shrink: 0;
    font-size: 9px;
  }
  .ob-help-desc {
    color: var(--hud-muted);
  }
  .ob-help-row--goal {
    margin-top: 6px;
    padding-top: 12px;
    border-top: 1px solid rgba(210, 220, 240, 0.06);
    color: var(--hud-magenta);
    font-size: 10px;
    letter-spacing: 0.1em;
  }

  @media (prefers-reduced-motion: reduce) {
    .ob-score-pill,
    .ob-round-timer,
    .ob-objective,
    .ob-prompt,
    .ob-power-wrap,
    .ob-damage-panel,
    .ob-tutorial,
    .ob-scoreboard-overlay {
      backdrop-filter: none;
    }
  }
`;

let hudStyleInjected = false;

function injectHudStyle(): void {
  if (hudStyleInjected) return;
  hudStyleInjected = true;
  const style = document.createElement("style");
  style.textContent = HUD_CSS;
  document.head.appendChild(style);
}

export interface HudElements {
  root: HTMLDivElement;
  scoreWrap: HTMLDivElement;
  countdown: HTMLDivElement;
  objective: HTMLDivElement;
  crosshair: HTMLDivElement;
  score: HTMLDivElement;
  scoreTeam0: HTMLDivElement;
  scoreTeam1: HTMLDivElement;
  roundTimer: HTMLDivElement;
  grab: HTMLDivElement;
  powerWrap: HTMLDivElement;
  powerBar: HTMLDivElement;
  powerLabel: HTMLDivElement;
  damage: HTMLDivElement;
  tutorial: HTMLDivElement;
  tutorialStep: HTMLDivElement;
  tutorialTitle: HTMLDivElement;
  tutorialBody: HTMLDivElement;
  roundEnd: HTMLDivElement;
  tab: HTMLDivElement;
  help: HTMLDivElement;
}

export function createHudView(): HudElements {
  injectHudStyle();

  const root = document.createElement("div");
  root.className = "ob-hud-root";
  root.innerHTML = HUD_MARKUP;
  document.body.appendChild(root);

  const q = <T extends HTMLElement = HTMLDivElement>(id: string): T =>
    root.querySelector<T>(`#${id}`) as T;

  return {
    root,
    scoreWrap: q("hud-score-wrap"),
    countdown: q("hud-countdown"),
    objective: q("hud-objective"),
    crosshair: q("hud-crosshair"),
    score: q("hud-score"),
    scoreTeam0: q("hud-score-team0"),
    scoreTeam1: q("hud-score-team1"),
    roundTimer: q("hud-round-timer"),
    grab: q("hud-grab"),
    powerWrap: q("hud-power-wrap"),
    powerBar: q("hud-power-bar"),
    powerLabel: q("hud-power-label"),
    damage: q("hud-damage"),
    tutorial: q("hud-tutorial"),
    tutorialStep: q("hud-tutorial-step"),
    tutorialTitle: q("hud-tutorial-title"),
    tutorialBody: q("hud-tutorial-body"),
    roundEnd: q("hud-round-end"),
    tab: q("hud-tab"),
    help: q("hud-help"),
  };
}
