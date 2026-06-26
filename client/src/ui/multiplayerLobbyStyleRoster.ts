export const MULTIPLAYER_LOBBY_STYLE_ROSTER = `  .ob-mp-select-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 172px;
  }

  .ob-mp-select-label {
    color: var(--mp-muted);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .ob-mp-select,
  .ob-mp-button {
    min-height: 44px;
    border-radius: 0;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: #effcff;
    font-size: 12px;
    letter-spacing: 0.08em;
  }

  .ob-mp-select {
    padding: 0 12px;
    outline: none;
    appearance: none;
  }

  .ob-mp-select option {
    color: #effcff;
    background: #071019;
  }

  .ob-mp-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 14px;
    cursor: pointer;
    font-weight: 700;
    transition: transform 0.14s ease, border-color 0.18s ease, background 0.18s ease;
  }

  .ob-mp-button:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: rgba(255, 255, 255, 0.24);
    background: rgba(255, 255, 255, 0.06);
  }

  .ob-mp-button:disabled,
  .ob-mp-select:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .ob-mp-button--ready {
    border-color: rgba(127, 252, 255, 0.26);
    box-shadow: 0 0 18px rgba(127, 252, 255, 0.08) inset;
  }

  .ob-mp-button--switch {
    border-color: rgba(255, 125, 248, 0.26);
    box-shadow: 0 0 18px rgba(255, 125, 248, 0.08) inset;
  }

  .ob-mp-button--bots {
    border-color: rgba(118, 255, 179, 0.24);
  }

  .ob-mp-button--clear {
    border-color: rgba(255, 209, 102, 0.24);
  }

  .ob-mp-button--leave {
    border-color: rgba(255, 140, 160, 0.24);
  }

  .ob-mp-button--settings {
    border-color: rgba(127, 252, 255, 0.24);
  }

  .ob-mp-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-top: 16px;
  }

  .ob-mp-summary-card {
    padding: 14px 16px;
    border-radius: 0;
  }

  .ob-mp-card-label {
    color: var(--mp-muted);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.16em;
  }

  .ob-mp-card-value {
    margin-top: 6px;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .ob-mp-card-copy {
    margin-top: 6px;
    color: #cfe3ed;
    font-size: 13px;
    line-height: 1.45;
  }

  .ob-mp-rosters {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    margin-top: 16px;
  }

  .ob-mp-team {
    padding: 16px;
    border-radius: 0;
  }

  .ob-mp-team--cyan {
    box-shadow: 0 0 0 1px rgba(127, 252, 255, 0.08) inset;
  }

  .ob-mp-team--magenta {
    box-shadow: 0 0 0 1px rgba(255, 125, 248, 0.08) inset;
  }

  .ob-mp-team-header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .ob-mp-team-title {
    font-family: "Cormorant Garamond", serif;
    font-size: 26px;
    font-weight: 300;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .ob-mp-team-meta {
    margin-top: 3px;
    color: var(--mp-muted);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
  }

  .ob-mp-team-count {
    font-family: "JetBrains Mono", monospace;
    font-size: 11px;
    color: var(--mp-muted);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    text-align: right;
  }

  .ob-mp-roster {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 14px;
  }

  .ob-mp-roster-card {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    padding: 12px 13px;
    border-radius: 0;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .ob-mp-roster-card--self {
    box-shadow: 0 0 0 1px rgba(127, 252, 255, 0.08) inset;
  }

  .ob-mp-roster-name {
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 0.03em;
  }

  .ob-mp-roster-meta {
    margin-top: 4px;
    color: var(--mp-muted);
    font-size: 10px;
    letter-spacing: 0.12em;
  }

  .ob-mp-roster-badges {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;
  }

  .ob-mp-badge {
    display: inline-flex;
    align-items: center;
    min-height: 22px;
    padding: 0 8px;
    border-radius: 2px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
  }

  .ob-mp-badge--self {
    color: #dffcff;
    background: rgba(127, 252, 255, 0.16);
    border: 1px solid rgba(127, 252, 255, 0.28);
  }

  .ob-mp-badge--human {
    color: #dfe9f4;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .ob-mp-badge--bot {
    color: #d8ffe7;
    background: rgba(118, 255, 179, 0.12);
    border: 1px solid rgba(118, 255, 179, 0.2);
  }

  .ob-mp-badge--ready {
    color: #e0fbff;
    background: rgba(127, 252, 255, 0.16);
    border: 1px solid rgba(127, 252, 255, 0.24);
  }

  .ob-mp-badge--waiting {
    color: #ffecc8;
    background: rgba(255, 209, 102, 0.12);
    border: 1px solid rgba(255, 209, 102, 0.2);
  }

  .ob-mp-empty {
    padding: 18px 14px;
    border-radius: 0;
    color: var(--mp-muted);
    background: rgba(255, 255, 255, 0.03);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    font-size: 11px;
    letter-spacing: 0.14em;
    text-align: center;
  }

  @media (max-width: 920px) {
    .ob-mp-summary {
      grid-template-columns: 1fr;
    }

    .ob-mp-rosters {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 680px) {
    .ob-mp-header {
      grid-template-columns: 1fr;
    }

    .ob-mp-phase-block {
      align-items: flex-start;
    }

    .ob-mp-meta {
      text-align: left;
    }

    .ob-mp-controls {
      flex-direction: column;
      align-items: stretch;
    }

    .ob-mp-select-wrap {
      min-width: 0;
    }

    .ob-mp-button,
    .ob-mp-select {
      width: 100%;
    }

    .ob-mp-roster-card {
      flex-direction: column;
      align-items: flex-start;
    }

    .ob-mp-roster-badges {
      justify-content: flex-start;
    }

    .ob-mp-invite-grid {
      grid-template-columns: 1fr;
    }
  }

`;

