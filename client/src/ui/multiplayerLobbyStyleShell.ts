export const MULTIPLAYER_LOBBY_STYLE_SHELL = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300&family=JetBrains+Mono:wght@300;400;500&display=swap');

  .ob-mp-root {
    --mp-cyan: oklch(0.82 0.15 210);
    --mp-magenta: oklch(0.72 0.25 330);
    --mp-panel: rgba(7, 10, 18, 0.82);
    --mp-panel-strong: rgba(7, 10, 18, 0.94);
    --mp-border: rgba(210, 220, 240, 0.16);
    --mp-muted: #9aa5b8;
    position: fixed;
    inset: 0;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background:
      radial-gradient(circle at top, rgba(18, 41, 64, 0.82), rgba(4, 8, 18, 0.94) 55%, rgba(0, 0, 0, 0.98)),
      linear-gradient(180deg, rgba(0, 0, 0, 0.28), rgba(0, 0, 0, 0.44));
    z-index: 350;
    color: #e8ecf4;
    font-family: "Cormorant Garamond", serif;
    overflow: hidden;
  }

  .ob-mp-root * {
    box-sizing: border-box;
  }

  .ob-mp-root::before,
  .ob-mp-root::after {
    content: "";
    position: absolute;
    pointer-events: none;
  }

  .ob-mp-root::before {
    inset: -28px;
    background: url("/assets/marketing/orbital-breach-bg.png") center / cover no-repeat;
    filter: blur(18px);
    opacity: 0.34;
    transform: scale(1.04);
  }

  .ob-mp-root::after {
    inset: 0;
    background: rgba(1, 4, 8, 0.56);
  }

  .ob-mp-shell {
    position: relative;
    z-index: 1;
    width: min(1120px, calc(100vw - 32px));
    max-height: calc(100dvh - 32px);
    overflow: auto;
    border: 1px solid var(--mp-border);
    border-radius: 0;
    background:
      radial-gradient(circle at top left, rgba(127, 252, 255, 0.11), rgba(127, 252, 255, 0) 24%),
      radial-gradient(circle at bottom right, rgba(255, 125, 248, 0.12), rgba(255, 125, 248, 0) 28%),
      var(--mp-panel);
    box-shadow: 0 28px 80px rgba(0, 0, 0, 0.42);
    backdrop-filter: blur(16px);
  }

  .ob-mp-header,
  .ob-mp-status,
  .ob-mp-controls,
  .ob-mp-summary-card,
  .ob-mp-team {
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
  }

  .ob-mp-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 18px;
    padding: 22px 24px 18px;
    border-radius: 0;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0)),
      var(--mp-panel-strong);
  }

  .ob-mp-kicker,
  .ob-mp-phase,
  .ob-mp-meta,
  .ob-mp-card-label,
  .ob-mp-team-meta,
  .ob-mp-badge,
  .ob-mp-roster-meta,
  .ob-mp-button,
  .ob-mp-select,
  .ob-mp-empty {
    font-family: "JetBrains Mono", monospace;
    text-transform: uppercase;
  }

  .ob-mp-kicker {
    color: var(--mp-muted);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.18em;
  }

  .ob-mp-title {
    margin-top: 10px;
    font-size: clamp(34px, 4vw, 50px);
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 0.95;
    text-transform: uppercase;
  }

  .ob-mp-subtitle {
    margin-top: 10px;
    max-width: 620px;
    color: #d6edf5;
    font-size: 15px;
    line-height: 1.6;
  }

  .ob-mp-phase-block {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }

  .ob-mp-phase {
    display: inline-flex;
    align-items: center;
    min-height: 32px;
    padding: 0 12px;
    border-radius: 2px;
    color: #defdff;
    background: rgba(127, 252, 255, 0.12);
    border: 1px solid rgba(127, 252, 255, 0.2);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
  }

  .ob-mp-meta {
    color: var(--mp-muted);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-align: right;
  }

  .ob-mp-score {
    font-size: 34px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-shadow: 0 0 16px rgba(127, 252, 255, 0.16);
  }

  .ob-mp-body {
    padding: 18px 24px 24px;
  }

  .ob-mp-status {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 13px 15px;
    border-radius: 0;
    font-size: 14px;
    line-height: 1.5;
  }

  .ob-mp-status::before {
    content: "";
    width: 8px;
    height: 8px;
    flex: 0 0 auto;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 14px currentColor;
    opacity: 0.72;
  }

  .ob-mp-status--connecting {
    animation: ob-mp-status-pulse 1.8s ease-in-out infinite;
  }

  .ob-mp-status--connecting::before {
    animation: ob-mp-status-dot 1.1s ease-in-out infinite;
  }

  .ob-mp-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 16px;
    padding: 14px;
    border-radius: 0;
  }

  .ob-mp-invite {
    margin-top: 16px;
    padding: 16px;
    border: 1px solid rgba(127, 252, 255, 0.12);
    background: rgba(255, 255, 255, 0.03);
  }

  .ob-mp-invite-head {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: baseline;
  }

  .ob-mp-invite-title {
    margin-top: 6px;
    font-size: 24px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .ob-mp-invite-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 170px;
    gap: 16px;
    align-items: start;
    margin-top: 14px;
  }

  .ob-mp-invite-main {
    display: grid;
    gap: 10px;
  }

  .ob-mp-invite-url {
    min-height: 44px;
    width: 100%;
    padding: 0 12px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: #effcff;
    font-family: "JetBrains Mono", monospace;
    font-size: 12px;
    letter-spacing: 0.04em;
  }

  .ob-mp-invite-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .ob-mp-invite-note {
    color: #c7d6ec;
    font-size: 13px;
    line-height: 1.5;
  }

  .ob-mp-qr-card {
    position: relative;
    display: grid;
    gap: 10px;
    justify-items: center;
    align-items: center;
    min-height: 162px;
    padding: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
  }

  .ob-mp-qr-card img {
    width: 140px;
    height: 140px;
    background: white;
  }

  .ob-mp-qr-card--loading img {
    opacity: 0;
  }

  .ob-mp-qr-loader {
    position: absolute;
    inset: 10px;
    display: none;
    place-items: center;
    background:
      linear-gradient(180deg, rgba(7, 10, 18, 0.76), rgba(7, 10, 18, 0.9)),
      repeating-linear-gradient(135deg, rgba(127, 252, 255, 0.09) 0 1px, transparent 1px 9px);
    border: 1px dashed rgba(127, 252, 255, 0.22);
  }

  .ob-mp-qr-card--loading .ob-mp-qr-loader {
    display: grid;
  }

  .ob-mp-qr-spinner {
    width: 40px;
    height: 40px;
    border: 2px solid rgba(127, 252, 255, 0.16);
    border-top-color: #7ffcff;
    border-right-color: rgba(255, 125, 248, 0.78);
    border-radius: 50%;
    animation: ob-mp-spin 0.9s linear infinite;
    box-shadow: 0 0 18px rgba(127, 252, 255, 0.12);
  }

  @keyframes ob-mp-spin {
    to { transform: rotate(360deg); }
  }

  @keyframes ob-mp-status-pulse {
    0%, 100% { filter: brightness(1); }
    50% { filter: brightness(1.28); }
  }

  @keyframes ob-mp-status-dot {
    0%, 100% { transform: scale(0.82); opacity: 0.42; }
    50% { transform: scale(1.18); opacity: 1; }
  }

`;

