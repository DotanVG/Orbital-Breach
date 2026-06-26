export const MULTIPLAYER_LOBBY_STYLE_BRIEFING = `  /* ===== BRIEFING 3-COLUMN LAYOUT ===== */
  .ob-mp-briefing-layout {
    display: grid;
    grid-template-columns: 280px 1fr 280px;
    gap: 14px;
    margin-top: 14px;
  }

  .ob-mp-brief-panel {
    border: 1px solid var(--mp-border);
    background: rgba(7, 10, 18, 0.55);
    backdrop-filter: blur(10px);
    padding: 16px;
  }
  .ob-mp-brief-panel--cyan  { box-shadow: inset 0 0 0 1px rgba(127, 252, 255, 0.06); }
  .ob-mp-brief-panel--magenta { box-shadow: inset 0 0 0 1px rgba(255, 125, 248, 0.06); }

  .ob-mp-panel-head {
    display: flex; justify-content: space-between; align-items: center;
    font-family: "JetBrains Mono", monospace; font-size: 9px; letter-spacing: 4px;
    color: var(--mp-muted); text-transform: uppercase;
    padding-bottom: 10px; margin-bottom: 12px;
    border-bottom: 1px solid rgba(210, 220, 240, 0.06);
  }
  .ob-mp-panel-title {
    margin: 0; font-family: "JetBrains Mono", monospace; font-weight: 400;
    color: var(--mp-muted); font-size: 9px; letter-spacing: 4px;
  }
  .ob-mp-panel-idx { color: var(--mp-cyan); }

  .ob-mp-brief-team-head {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: 8px;
  }
  .ob-mp-brief-team-name {
    font-family: "Cormorant Garamond", serif;
    font-size: 20px; font-weight: 300; letter-spacing: 0.1em;
  }
  .ob-mp-brief-team-count {
    font-family: "JetBrains Mono", monospace; font-size: 10px;
    color: var(--mp-muted); letter-spacing: 3px;
  }

  .ob-mp-brief-roster {
    display: flex; flex-direction: column; gap: 1px;
  }
  .ob-mp-brief-row {
    display: grid;
    grid-template-columns: 18px 1fr auto auto;
    gap: 10px; align-items: center;
    padding: 8px 8px; border: 1px solid transparent;
    font-family: "JetBrains Mono", monospace; font-size: 10px; letter-spacing: 2px;
    color: var(--mp-muted);
    transition: background 0.2s, border-color 0.2s, color 0.2s;
  }
  .ob-mp-brief-row:hover {
    background: rgba(255, 255, 255, 0.03);
    border-color: var(--mp-border);
    color: #e8ecf4;
  }
  .ob-mp-brief-row--self-cyan    { background: rgba(100, 190, 255, 0.06); border-color: var(--mp-cyan); color: #e8ecf4; }
  .ob-mp-brief-row--self-magenta { background: oklch(0.72 0.25 330 / 0.08); border-color: var(--mp-magenta); color: #e8ecf4; }
  .ob-mp-brief-row--pending      { opacity: 0.5; }
  .ob-mp-brief-slot { font-size: 9px; color: var(--mp-muted); opacity: 0.7; }
  .ob-mp-brief-kd   { font-size: 9px; color: var(--mp-muted); opacity: 0.7; }
  .ob-mp-brief-ready-dot {
    width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
    background: var(--mp-cyan); box-shadow: 0 0 6px var(--mp-cyan);
  }
  .ob-mp-brief-ready-dot--magenta { background: var(--mp-magenta); box-shadow: 0 0 6px var(--mp-magenta); }
  .ob-mp-brief-ready-dot--pending { background: var(--mp-muted); box-shadow: none; opacity: 0.3; }

  /* Stage preview (center) */
  .ob-mp-stage-preview {
    border: 1px solid var(--mp-border);
    background: rgba(7, 10, 18, 0.55);
    backdrop-filter: blur(10px);
    padding: 18px;
    display: grid; grid-template-rows: auto 1fr auto;
    gap: 10px; overflow: hidden;
  }
  .ob-mp-stage-head { display: flex; justify-content: space-between; align-items: baseline; }
  .ob-mp-stage-title {
    margin: 0;
    font-family: "Cormorant Garamond", serif;
    font-weight: 300; font-size: 26px; letter-spacing: 0.06em;
    color: #e8ecf4;
  }
  .ob-mp-stage-meta {
    font-family: "JetBrains Mono", monospace; font-size: 9px; letter-spacing: 3px;
    color: var(--mp-muted); text-transform: uppercase;
  }
  .ob-mp-map { display: grid; place-items: center; padding: 8px 0; }
  .ob-mp-map-inner { width: 100%; max-width: 280px; aspect-ratio: 1; }
  .ob-mp-arena-svg { width: 100%; height: 100%; overflow: visible; }

  .ob-mp-loadout-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .ob-mp-loadout-item {
    border: 1px solid rgba(210, 220, 240, 0.06); padding: 10px 10px;
    font-family: "JetBrains Mono", monospace; font-size: 9px; letter-spacing: 2px;
    text-transform: uppercase; display: grid; gap: 3px;
    transition: border-color 0.2s;
  }
  .ob-mp-loadout-item:hover { border-color: rgba(210, 220, 240, 0.12); }
  .ob-mp-loadout-key { color: var(--mp-muted); font-size: 8px; letter-spacing: 2px; }
  .ob-mp-loadout-val {
    color: #e8ecf4; font-family: "Cormorant Garamond", serif;
    font-size: 13px; letter-spacing: 0.05em; text-transform: none;
  }

  /* Mission briefing (right panel bottom) */
  .ob-mp-rule { height: 1px; background: rgba(210, 220, 240, 0.06); margin: 12px 0; }
  .ob-mp-mission-brief {
    font-family: "Cormorant Garamond", serif; font-size: 13px; line-height: 1.7;
    color: var(--mp-muted);
  }
  .ob-mp-mission-brief p { margin: 0; }
  .ob-mp-mission-brief strong { color: #e8ecf4; font-weight: 400; }

  @media (max-width: 1100px) {
    .ob-mp-briefing-layout { grid-template-columns: 1fr; }
  }

  @media (max-width: 640px) {
    .ob-mp-root {
      padding: 10px;
      padding-top: calc(10px + env(safe-area-inset-top, 0px));
      padding-bottom: max(70px, calc(54px + env(safe-area-inset-bottom, 0px)));
      align-items: flex-start;
    }

    .ob-mp-shell {
      width: 100%;
      max-height: calc(
        100dvh
        - (10px + env(safe-area-inset-top, 0px))
        - max(70px, calc(54px + env(safe-area-inset-bottom, 0px)))
      );
    }

    .ob-mp-briefing-layout { gap: 10px; margin-top: 10px; }
    .ob-mp-brief-panel { padding: 12px; }
    .ob-mp-stage-preview { display: none; }
    .ob-mp-brief-row { font-size: 9px; padding: 6px 6px; }
  }

  @media (max-height: 500px) {
    .ob-mp-root {
      padding: 8px;
      padding-top: calc(8px + env(safe-area-inset-top, 0px));
      padding-bottom: max(54px, calc(44px + env(safe-area-inset-bottom, 0px)));
      align-items: flex-start;
    }

    .ob-mp-shell { max-height: calc(100dvh - (8px + env(safe-area-inset-top, 0px)) - max(54px, calc(44px + env(safe-area-inset-bottom, 0px)))); }
  }
`;

