export const MENU_VIEW_STYLE_LAYOUT = `  .menu-root {
    position: fixed; inset: 0; z-index: 10;
    display: grid; place-items: center;
    background: radial-gradient(ellipse at 50% 120%, #0d1426 0%, var(--ob-ink-0) 55%, #03060d 100%);
    animation: ob-menuFadeIn .35s ease-out both;
    cursor: none;
  }
  .menu-root * { box-sizing: border-box; }

  /* ── MAIN CONTENT ── */
  .ob-main-wrap {
    position: relative; z-index: 8;
    display: grid; grid-template-columns: 1fr;
    justify-items: center; gap: 28px;
    width: min(900px, 90vw);
    text-align: center;
    color: var(--ob-fg);
    padding: 80px 0 60px;
  }

  .ob-tag {
    font-family: var(--ob-mono); font-size: 10px; letter-spacing: 8px;
    color: var(--ob-fg-faint); text-transform: uppercase;
    display: inline-flex; align-items: center; gap: 14px;
  }
  .ob-tag::before, .ob-tag::after {
    content: ""; width: 40px; height: 1px; background: var(--ob-line-2);
  }

  .ob-title {
    font-family: var(--ob-serif); font-weight: 300;
    font-size: clamp(44px, 8.2vw, 110px);
    letter-spacing: .02em; line-height: .95;
    margin: 0; color: #fff;
    text-shadow: 0 0 40px rgba(255,255,255,.05);
    white-space: nowrap; text-transform: uppercase;
    position: relative;
  }
  .ob-letter {
    position: relative; z-index: 1;
    display: inline-block;
    transition: transform .4s cubic-bezier(.2,.7,.2,1), text-shadow .4s;
    will-change: transform;
  }
  .ob-subtitle {
    font-family: var(--ob-mono); font-size: 11px; letter-spacing: 6px;
    color: var(--ob-fg-dim); text-transform: uppercase;
    display: flex; align-items: center; gap: 18px; justify-content: center;
  }
  .ob-pulse {
    width: 6px; height: 6px; background: var(--ob-magenta); border-radius: 50%;
    box-shadow: 0 0 10px var(--ob-magenta);
    animation: ob-pulseDot 1.8s ease-in-out infinite;
    flex-shrink: 0;
  }

  /* ── CALLSIGN ── */
  .ob-callsign { display: grid; gap: 8px; justify-items: center; }
  .ob-callsign-label {
    font-family: var(--ob-mono); font-size: 9px; letter-spacing: 6px;
    color: var(--ob-fg-faint); text-transform: uppercase;
  }
  .ob-callsign-box {
    position: relative; display: flex; align-items: center;
    border: 1px solid var(--ob-line-2);
    background: rgba(10,14,26,.6); backdrop-filter: blur(8px);
    padding: 14px 22px; min-width: 340px;
    transition: border-color .25s, box-shadow .25s;
  }
  .ob-callsign-box:hover { border-color: rgba(255,255,255,.2); }
  .ob-callsign-box:focus-within {
    border-color: var(--ob-cyan);
    box-shadow: 0 0 0 1px var(--ob-cyan-soft), 0 0 40px rgba(120,200,255,.06);
  }
  .ob-callsign-box:has(input.menu-input--error) {
    border-color: rgba(255,115,156,.56) !important;
    box-shadow: 0 0 0 2px rgba(255,115,156,.12) !important;
  }
  .ob-callsign-prefix {
    font-family: var(--ob-mono); font-size: 10px; letter-spacing: 3px;
    color: var(--ob-fg-faint); margin-right: 12px; text-transform: uppercase;
    white-space: nowrap;
  }
  .ob-callsign-box input {
    flex: 1; background: transparent; border: none; outline: none;
    color: var(--ob-fg); font-family: var(--ob-serif); font-size: 20px;
    letter-spacing: .12em; text-align: left;
    caret-color: var(--ob-cyan); cursor: text;
  }
  .ob-callsign-box input::placeholder { color: var(--ob-fg-faint); }
  .ob-bracket {
    position: absolute; top: -5px; bottom: -5px; width: 10px;
    border: 1px solid var(--ob-cyan); opacity: 0; transition: opacity .25s;
  }
  .ob-bracket.ob-l { left: -5px;  border-right: none; }
  .ob-bracket.ob-r { right: -5px; border-left:  none; }
  .ob-callsign-box:focus-within .ob-bracket { opacity: .8; }
  .ob-name-error {
    min-height: 18px; color: #ff8eb7;
    font-family: var(--ob-mono); font-size: 11px; letter-spacing: 2px;
    text-align: center;
  }

  /* ── MATCH GRID ── */
  .ob-match-grid {
    display: grid; grid-template-columns: repeat(5, 1fr);
    gap: 14px; width: 100%; max-width: 880px;
  }
  .ob-match-card {
    position: relative; padding: 20px 12px 18px;
    background: rgba(10,14,26,.5); backdrop-filter: blur(6px);
    border: 1px solid var(--ob-line); cursor: none;
    transition: border-color .3s, background .3s, transform .3s;
    text-align: center; overflow: hidden;
    color: var(--ob-fg); font-family: var(--ob-serif);
  }
  .ob-match-card::before {
    content: ""; position: absolute; inset: 0;
    background: linear-gradient(180deg, transparent, var(--ob-cyan-soft));
    opacity: 0; transition: opacity .3s;
  }
  .ob-match-card:hover { border-color: rgba(255,255,255,.25); transform: translateY(-2px); }
  .ob-match-card:hover::before { opacity: .5; }
  .ob-match-card.ob-selected { border-color: var(--ob-cyan); background: rgba(30,60,90,.35); }
  .ob-match-card.ob-selected::before { opacity: 1; }
  .ob-card-size {
    font-family: var(--ob-serif); font-size: 30px; font-weight: 300;
    color: var(--ob-fg); letter-spacing: .02em; position: relative; z-index: 1;
  }
  .ob-card-size em { font-style: normal; color: var(--ob-fg-faint); font-size: 17px; margin: 0 3px; }
  .ob-card-name {
    font-family: var(--ob-mono); font-size: 9px; letter-spacing: 3px;
    color: var(--ob-fg-dim); text-transform: uppercase; margin-top: 5px;
    position: relative; z-index: 1;
  }
  .ob-card-bots {
    font-family: var(--ob-mono); font-size: 8px; letter-spacing: 2px;
    color: var(--ob-fg-faint); text-transform: uppercase; margin-top: 8px;
    position: relative; z-index: 1;
  }

  /* ── LAUNCH BUTTONS ── */
  .ob-launch-row,
  .ob-settings-row {
    display: flex;
    gap: 16px;
    justify-content: center;
    width: 100%;
  }
  .ob-settings-row { margin-top: -4px; }
  .ob-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: min(194px, 100%);
    min-height: 56px;
    padding: 18px 38px;
    background: rgba(10,14,26,.55); backdrop-filter: blur(8px);
    border: 1px solid var(--ob-line-2); color: var(--ob-fg);
    font-family: var(--ob-mono); font-size: 11px; letter-spacing: 5px;
    text-transform: uppercase; cursor: none;
    transition: border-color .25s, background .25s, color .25s, transform .25s;
    overflow: hidden;
  }
  .ob-btn-label {
    position: relative;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100%;
  }
  .ob-btn-arrow { font-family: var(--ob-serif); font-size: 16px; letter-spacing: 0; transition: transform .3s; }
  .ob-btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    transition: transform .3s ease;
  }
  .ob-btn-icon svg { width: 16px; height: 16px; }
  .ob-btn::before {
    content: ""; position: absolute; inset: 0;
    opacity: 0; transition: opacity .3s; z-index: 1;
  }
  .ob-btn-primary::before  { background: radial-gradient(circle at var(--mx,50%) var(--my,50%), var(--ob-magenta-soft), transparent 60%); }
  .ob-btn-secondary::before{ background: radial-gradient(circle at var(--mx,50%) var(--my,50%), var(--ob-cyan-soft),    transparent 60%); }
  .ob-btn-online::before   { background: radial-gradient(circle at var(--mx,50%) var(--my,50%), rgba(255, 210, 112, .2), rgba(255, 92, 208, .1) 42%, transparent 68%); }
  .ob-btn-utility::before  { background: radial-gradient(circle at var(--mx,50%) var(--my,50%), rgba(140,225,255,.12), transparent 62%); }
  .ob-btn:hover { border-color: rgba(255,255,255,.4); transform: translateY(-1px); }
  .ob-btn:hover::before { opacity: 1; }
  .ob-btn:hover .ob-btn-arrow { transform: translateX(6px); }
  .ob-btn:hover .ob-btn-icon { transform: rotate(18deg) scale(1.06); }
  .ob-btn-primary:hover  { color: oklch(0.88 0.12 60);  border-color: var(--ob-magenta); }
  .ob-btn-secondary:hover{ color: var(--ob-cyan); border-color: var(--ob-cyan); }
  .ob-btn-online:hover {
    color: #ffd670;
    border-color: rgba(255, 214, 112, .82);
    background:
      linear-gradient(135deg, rgba(255, 92, 208, .14), rgba(255, 214, 112, .08)),
      rgba(18, 12, 24, .72);
    box-shadow:
      0 0 0 1px rgba(255, 92, 208, .26) inset,
      0 14px 34px rgba(255, 92, 208, .14);
  }
  .ob-btn-utility:hover  { color: var(--ob-cyan); border-color: rgba(140,225,255,.42); }
  .ob-btn:focus-visible { outline: 2px solid var(--ob-cyan); outline-offset: 3px; }
  .ob-btn-corner {
    position: absolute; width: 8px; height: 8px; z-index: 3;
    border: 1px solid currentColor; opacity: .5;
  }
  .ob-btn-corner.ob-tl { top: 4px; left: 4px;   border-right: none; border-bottom: none; }
  .ob-btn-corner.ob-tr { top: 4px; right: 4px;   border-left:  none; border-bottom: none; }
  .ob-btn-corner.ob-bl { bottom: 4px; left: 4px;  border-right: none; border-top:    none; }
  .ob-btn-corner.ob-br { bottom: 4px; right: 4px; border-left:  none; border-top:    none; }

  /* ── TUTORIAL BUTTON ── */
  .ob-link-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center;
    width: 100%;
  }
  .ob-link-chip-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }
  .ob-link-chip-icon svg { width: 18px; height: 18px; }
  .ob-link-chip {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 42px;
    padding: 0 18px;
    border: 1px solid rgba(210,220,240,.16);
    background: rgba(10,14,26,.44);
    color: var(--ob-fg-dim);
    text-decoration: none;
    font-family: var(--ob-mono);
    font-size: 10px;
    letter-spacing: 3px;
    text-transform: uppercase;
    transition: border-color .25s, color .25s, transform .25s, background .25s;
  }
  .ob-link-chip:hover {
    border-color: rgba(140,225,255,.42);
    color: var(--ob-cyan);
    background: rgba(12,20,36,.74);
    transform: translateY(-1px);
  }
  .ob-link-chip:focus-visible { outline: 2px solid var(--ob-cyan); outline-offset: 3px; }
  .ob-link-chip-arrow { font-family: var(--ob-serif); font-size: 14px; letter-spacing: 0; }

  .ob-tutorial-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
    max-width: 880px;
    padding: 16px 38px;
    background: rgba(255, 125, 248, 0.06);
    border: 1px solid rgba(255, 125, 248, 0.28);
    color: var(--ob-fg);
    font-family: var(--ob-mono);
    text-transform: uppercase;
    cursor: none;
    overflow: hidden;
    transition: border-color .25s, background .25s, transform .25s;
  }
  .ob-tutorial-btn::before {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at var(--mx,50%) var(--my,50%), var(--ob-magenta-soft), transparent 60%);
    opacity: 0;
    transition: opacity .3s;
    z-index: 1;
  }
  .ob-tutorial-btn:hover {
    border-color: var(--ob-magenta);
    background: rgba(255, 125, 248, 0.1);
    transform: translateY(-1px);
  }
  .ob-tutorial-btn:hover::before { opacity: 1; }
  .ob-tutorial-btn-main {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    position: relative;
    z-index: 2;
  }
  .ob-tutorial-btn-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 5px;
    color: var(--ob-magenta);
  }
  .ob-tutorial-btn-sub {
    font-size: 9px;
    letter-spacing: 3px;
    color: var(--ob-fg-faint);
  }
  .ob-tutorial-btn-arrow {
    font-family: var(--ob-serif);
    font-size: 20px;
    color: var(--ob-magenta);
    letter-spacing: 0;
    position: relative;
    z-index: 2;
    transition: transform .3s;
  }
  .ob-tutorial-btn:hover .ob-tutorial-btn-arrow { transform: translateX(6px); }

  /* hidden select keeps controller wiring intact */
  .ob-match-select-hidden { display: none; }

  /* ── RESPONSIVE ── */
  @media (max-width: 920px) {
    .ob-topbar-right .ob-clock { display: none; }
  }
  @media (max-width: 640px) {
    .ob-match-grid   { grid-template-columns: repeat(3, 1fr); }
    .ob-launch-row   { flex-direction: column; align-items: center; }
    .ob-settings-row { margin-top: 0; flex-wrap: wrap; }
    .ob-link-row     { gap: 8px; }
    .ob-callsign-box { min-width: 0; width: 90vw; }
    .menu-root       { cursor: auto; overflow-y: auto; overflow-x: hidden; align-items: start; }

    .ob-topbar  { padding-left: 16px; padding-right: 16px; padding-top: calc(14px + env(safe-area-inset-top, 0px)); }
    .ob-bottombar { padding-left: 16px; padding-right: 16px;
                    padding-bottom: max(14px, env(safe-area-inset-bottom, 14px)); }
    .ob-hud-corner { display: none; }
    .ob-main-wrap {
      gap: 18px;
      padding: 0 0 max(70px, calc(50px + env(safe-area-inset-bottom, 0px)));
      padding-top: calc(64px + env(safe-area-inset-top, 0px));
      width: min(640px, 96vw);
    }
    .ob-title { font-size: clamp(36px, 10vw, 64px); }
    .ob-match-card { padding: 14px 8px 12px; }
    .ob-card-size  { font-size: 22px; }
    .ob-tutorial-btn { padding: 12px 18px; }
    .ob-tutorial-btn-sub { display: none; }
    .ob-btn { width: min(320px, 100%); padding: 16px 24px; }
  }
  @media (max-width: 420px) {
    .ob-match-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .ob-title      { font-size: clamp(30px, 9vw, 48px); white-space: normal; text-align: center; }
    .ob-subtitle   { font-size: 9px; letter-spacing: 4px; }
    .ob-tag        { font-size: 8px; letter-spacing: 5px; }
    .ob-topbar-brand { font-size: 11px; letter-spacing: 4px; }
    .ob-topbar-brand em { display: none; }
  }

  /* ── Mobile landscape (short viewport) ── */
  @media (max-height: 500px) {
    .ob-main-wrap {
      gap: 12px;
      padding: 52px 0 max(60px, calc(44px + env(safe-area-inset-bottom, 0px)));
      padding-top: calc(52px + env(safe-area-inset-top, 0px));
    }
    .menu-root { overflow-y: auto; }
    .ob-title  { font-size: clamp(28px, 6vw, 56px); }
    .ob-subtitle, .ob-tag { display: none; }
    .ob-callsign-label { display: none; }
    .ob-match-grid { gap: 8px; }
    .ob-match-card { padding: 10px 8px; }
    .ob-card-size  { font-size: 18px; }
    .ob-card-bots  { display: none; }
    .ob-tutorial-btn { padding: 10px 14px; }
    .ob-tutorial-btn-sub { display: none; }
    .ob-btn { width: min(280px, 100%); padding: 12px 20px; }
  }
  @media (max-height: 700px) and (min-height: 501px) {
    .ob-main-wrap { gap: 18px; padding: 60px 0 40px; }
    .ob-title { font-size: clamp(34px, 7vw, 80px); }
  }

  /* ── Touch: no-hover transition tweak for orbit ── */
  @media (hover: none) {
    .ob-title-waves { display: none !important; }
    .ob-orbit-tilt  { transition: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .ob-ring, .ob-stars i, .ob-pulse, .menu-root { animation: none !important; }
    .ob-title-waves { display: none; }
  }
`;

