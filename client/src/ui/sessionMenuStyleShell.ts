export const SESSION_MENU_STYLE_SHELL = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300&family=JetBrains+Mono:wght@300;400;500&display=swap');

  .ob-session-launcher {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 420;
    display: none;
    align-items: center;
    justify-content: center;
    min-height: 38px;
    padding: 0 16px;
    border-radius: 0;
    border: 1px solid rgba(127, 252, 255, 0.22);
    background: rgba(4, 9, 14, 0.82);
    color: #effcff;
    cursor: pointer;
    font-family: "JetBrains Mono", monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    backdrop-filter: blur(12px);
    transition: border-color 0.2s, background 0.2s;
  }

  .ob-session-launcher:hover {
    border-color: rgba(127, 252, 255, 0.5);
    background: rgba(7, 15, 28, 0.92);
  }

  .ob-session-root {
    position: fixed;
    inset: 0;
    z-index: 430;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 18px;
    background:
      radial-gradient(circle at top, rgba(16, 36, 54, 0.74), rgba(3, 8, 14, 0.92) 56%, rgba(2, 4, 7, 0.98)),
      linear-gradient(180deg, rgba(0, 0, 0, 0.34), rgba(0, 0, 0, 0.6));
    color: #effcff;
    font-family: "Cormorant Garamond", serif;
    overflow: hidden;
  }

  .ob-session-root * {
    box-sizing: border-box;
  }

  .ob-session-root::before,
  .ob-session-root::after {
    content: "";
    position: absolute;
    pointer-events: none;
  }

  .ob-session-root::before {
    inset: -28px;
    background: url("/assets/marketing/orbital-breach-bg.png") center / cover no-repeat;
    filter: blur(18px);
    opacity: 0.34;
    transform: scale(1.04);
  }

  .ob-session-root::after {
    inset: 0;
    background: rgba(1, 4, 8, 0.54);
  }

  .ob-session-panel {
    position: relative;
    z-index: 1;
  }

  .ob-session-panel {
    width: min(620px, calc(100vw - 36px));
    max-height: calc(100dvh - 36px);
    overflow: auto;
    border-radius: 0;
    border: 1px solid rgba(210, 220, 240, 0.16);
    background:
      radial-gradient(circle at top left, rgba(127, 252, 255, 0.07), rgba(127, 252, 255, 0) 30%),
      radial-gradient(circle at bottom right, rgba(255, 125, 248, 0.07), rgba(255, 125, 248, 0) 32%),
      rgba(5, 11, 17, 0.96);
    box-shadow: 0 28px 80px rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(16px);
  }

  .ob-session-header,
  .ob-session-actions,
  .ob-session-settings {
    padding: 20px 22px;
  }

  .ob-session-header {
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .ob-session-kicker,
  .ob-session-subtitle,
  .ob-session-button,
  .ob-session-field-label,
  .ob-session-value,
  .ob-session-note,
  .ob-session-toggle-copy {
    font-family: "JetBrains Mono", monospace;
    text-transform: uppercase;
  }

  .ob-session-kicker {
    color: #8ea8ba;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.18em;
  }

  .ob-session-title {
    margin-top: 10px;
    font-size: clamp(28px, 4vw, 42px);
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 0.95;
    text-transform: uppercase;
  }

  .ob-session-subtitle {
    margin-top: 12px;
    color: #cfe3ed;
    font-size: 11px;
    letter-spacing: 0.12em;
    line-height: 1.7;
  }

  .ob-session-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .ob-session-actions.ob-session-actions--single {
    grid-template-columns: minmax(0, 1fr);
  }

  .ob-session-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    position: relative;
    min-height: 50px;
    border-radius: 0;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.03);
    color: #effcff;
    cursor: pointer;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-align: center;
    transition: border-color 0.2s, background 0.2s, transform 0.2s;
  }

  .ob-session-button:hover {
    border-color: rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.06);
    transform: translateY(-1px);
  }

  .ob-session-button--resume {
    border-color: rgba(127, 252, 255, 0.28);
  }

  .ob-session-button--resume:hover {
    border-color: rgba(127, 252, 255, 0.55);
    color: oklch(0.88 0.12 210);
  }

  .ob-session-button--exit {
    border-color: rgba(255, 140, 160, 0.28);
  }

  .ob-session-button--exit:hover {
    border-color: rgba(255, 140, 160, 0.55);
    color: #ffb1c0;
  }

  .ob-session-settings {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .ob-session-settings-card {
    border-radius: 0;
    border: 1px solid rgba(210, 220, 240, 0.08);
    background: rgba(255, 255, 255, 0.02);
    padding: 16px;
  }

  .ob-session-settings-title {
    font-family: "Cormorant Garamond", serif;
    font-size: 22px;
    font-weight: 300;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .ob-session-note {
    margin-top: 8px;
    color: #8ea8ba;
    font-size: 10px;
    letter-spacing: 0.12em;
    line-height: 1.6;
  }

  .ob-session-field + .ob-session-field {
    margin-top: 16px;
  }

  .ob-session-field-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
  }

  .ob-session-field-label {
    color: #dffcff;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
  }

  .ob-session-value {
    color: #8ea8ba;
    font-size: 10px;
    letter-spacing: 0.12em;
  }

  .ob-session-range {
    width: 100%;
    margin-top: 10px;
    accent-color: #7ffcff;
  }

  .ob-session-toggle {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: center;
    margin-top: 10px;
    padding: 12px 14px;
    border-radius: 0;
    border: 1px solid rgba(210, 220, 240, 0.08);
    background: rgba(255, 255, 255, 0.02);
  }

  .ob-session-toggle-copy {
    color: #cfe3ed;
    font-size: 10px;
    letter-spacing: 0.1em;
    line-height: 1.7;
  }

  .ob-session-checkbox {
    width: 20px;
    height: 20px;
    accent-color: #7ffcff;
  }

  .ob-session-select {
    width: 100%;
    margin-top: 10px;
    padding: 8px 10px;
    border-radius: 0;
    border: 1px solid rgba(210, 220, 240, 0.16);
    background: rgba(255, 255, 255, 0.04);
    color: #effcff;
    font-family: "JetBrains Mono", monospace;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    accent-color: #7ffcff;
    cursor: pointer;
  }

  .ob-session-select:focus {
    outline: 1px solid rgba(127, 252, 255, 0.4);
  }

  .ob-session-view[hidden] {
    display: none !important;
  }

`;

