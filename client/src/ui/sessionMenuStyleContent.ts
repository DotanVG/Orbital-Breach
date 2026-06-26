export const SESSION_MENU_STYLE_CONTENT = `  .ob-session-instructions-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 16px;
  }

  .ob-session-instruction-item,
  .ob-session-control-row {
    min-width: 0;
    border: 1px solid rgba(210, 220, 240, 0.08);
    background:
      radial-gradient(circle at top left, rgba(127, 252, 255, 0.07), transparent 42%),
      radial-gradient(circle at bottom right, rgba(255, 125, 248, 0.07), transparent 44%),
      rgba(255, 255, 255, 0.02);
  }

  .ob-session-instruction-item {
    padding: 14px 16px;
  }

  .ob-session-instruction-item--wide {
    grid-column: 1 / -1;
  }

  .ob-session-instruction-title,
  .ob-session-control-key {
    font-family: "JetBrains Mono", monospace;
    color: #7ffcff;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .ob-session-instruction-item:nth-child(even) .ob-session-instruction-title,
  .ob-session-control-row:nth-child(even) .ob-session-control-key {
    color: #ff9df8;
  }

  .ob-session-instruction-body {
    margin-top: 8px;
    color: #d7e7ee;
    font-size: 16px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .ob-session-control-list {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.25fr);
    gap: 8px;
    margin-top: 16px;
  }

  .ob-session-control-row {
    display: contents;
  }

  .ob-session-control-key,
  .ob-session-control-action {
    min-width: 0;
    padding: 11px 12px;
    border: 1px solid rgba(210, 220, 240, 0.08);
    background: rgba(255, 255, 255, 0.02);
    overflow-wrap: anywhere;
  }

  .ob-session-control-action {
    color: #cfe3ed;
    font-size: 15px;
    line-height: 1.35;
  }

  .ob-session-card-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 16px;
  }

  .ob-session-inline-button {
    min-height: 42px;
    padding: 0 16px;
    border: 1px solid rgba(127, 252, 255, 0.22);
    background: rgba(127, 252, 255, 0.05);
    color: #effcff;
    cursor: pointer;
    font-family: "JetBrains Mono", monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    transition: border-color 0.2s, background 0.2s, transform 0.2s;
  }

  .ob-session-inline-button:hover {
    border-color: rgba(127, 252, 255, 0.48);
    background: rgba(127, 252, 255, 0.1);
    transform: translateY(-1px);
  }

  .ob-session-inline-button--ghost {
    border-color: rgba(210, 220, 240, 0.16);
    background: rgba(255, 255, 255, 0.03);
  }

  .ob-session-inline-button--ghost:hover {
    border-color: rgba(210, 220, 240, 0.3);
    background: rgba(255, 255, 255, 0.06);
  }

  .ob-session-credit-list {
    display: grid;
    gap: 12px;
    margin-top: 16px;
  }

  .ob-session-credit-item {
    padding: 14px 16px;
    border: 1px solid rgba(210, 220, 240, 0.08);
    background: rgba(255, 255, 255, 0.02);
  }

  .ob-session-credit-name {
    color: #effcff;
    font-family: "JetBrains Mono", monospace;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .ob-session-credit-detail {
    margin-top: 8px;
    color: #cfe3ed;
    font-size: 16px;
    line-height: 1.45;
  }
  .ob-session-credit-link {
    display: inline-block;
    margin-top: 6px;
    font-size: 11px;
    letter-spacing: 2px;
    color: var(--ob-cyan, #00e5ff);
    text-decoration: none;
    overflow-wrap: anywhere;
    word-break: break-word;
    opacity: .7;
    transition: opacity .2s;
  }
  .ob-session-credit-link:hover { opacity: 1; }

  .ob-session-link-grid {
    display: grid;
    gap: 12px;
    margin-top: 16px;
  }

  .ob-session-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
    border: 1px solid rgba(210, 220, 240, 0.08);
    background: rgba(255, 255, 255, 0.02);
    color: #effcff;
    text-decoration: none;
    font-family: "JetBrains Mono", monospace;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    transition: border-color 0.2s, background 0.2s, transform 0.2s;
  }

  .ob-session-link:hover {
    border-color: rgba(127, 252, 255, 0.42);
    background: rgba(127, 252, 255, 0.06);
    transform: translateY(-1px);
  }

  .ob-session-link:focus-visible {
    outline: 1px solid rgba(127, 252, 255, 0.5);
    outline-offset: 2px;
  }

  @media (max-width: 640px) {
    .ob-session-actions {
      grid-template-columns: 1fr;
    }

    .ob-session-instructions-grid,
    .ob-session-control-list {
      grid-template-columns: 1fr;
    }

    .ob-session-launcher {
      top: 10px;
      right: 10px;
      font-size: 9px;
      min-height: 32px;
      padding: 0 12px;
    }

    .ob-session-root {
      padding: 10px;
      padding-top: calc(10px + env(safe-area-inset-top, 0px));
      padding-bottom: max(70px, calc(54px + env(safe-area-inset-bottom, 0px)));
      align-items: flex-start;
    }

    .ob-session-panel {
      width: 100%;
      max-height: calc(
        100dvh
        - (10px + env(safe-area-inset-top, 0px))
        - max(70px, calc(54px + env(safe-area-inset-bottom, 0px)))
      );
    }

    .ob-session-header,
    .ob-session-actions,
    .ob-session-settings {
      padding: 14px 16px;
    }
  }

  @media (max-height: 500px) {
    .ob-session-root {
      padding: 8px;
      padding-top: calc(8px + env(safe-area-inset-top, 0px));
      padding-bottom: max(54px, calc(44px + env(safe-area-inset-bottom, 0px)));
      align-items: flex-start;
    }

    .ob-session-panel {
      max-height: calc(100dvh - (8px + env(safe-area-inset-top, 0px)) - max(54px, calc(44px + env(safe-area-inset-bottom, 0px))));
    }

    .ob-session-title {
      font-size: clamp(20px, 4vw, 30px);
    }

    .ob-session-header,
    .ob-session-actions,
    .ob-session-settings {
      padding: 10px 14px;
    }
  }
`;

