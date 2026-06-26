export const MENU_VIEW_STYLE_CHROME = `
  @keyframes ob-spin       { to { transform: rotate(360deg); } }
  @keyframes ob-twinkle {
    0%,100% { opacity: calc(var(--o) * 0.4); transform: scale(0.8); }
    50%     { opacity: var(--o);             transform: scale(1.1); }
  }
  @keyframes ob-pulseDot {
    0%,100% { opacity: 0.4; transform: scale(0.9); }
    50%     { opacity: 1;   transform: scale(1.15); }
  }
  @keyframes ob-menuFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* ── BACKGROUND LAYERS ── */
  .ob-planet {
    position: fixed; left: 50%; bottom: -52vmin; transform: translateX(-50%);
    width: 120vmin; height: 120vmin; border-radius: 50%;
    background:
      radial-gradient(circle at 35% 30%, rgba(255,190,140,.12), transparent 45%),
      radial-gradient(circle at 50% 50%, #0c1426 0%, #070a12 70%);
    box-shadow:
      inset 0 2vmin 8vmin  rgba(255,180,120,.08),
      inset 0 -6vmin 14vmin rgba(0,0,0,.9),
      0 0 0 1px rgba(255,200,160,.06);
    z-index: 1; pointer-events: none;
  }
  .ob-planet::after {
    content: ""; position: absolute; inset: -1px; border-radius: 50%;
    background: linear-gradient(180deg, rgba(255,210,170,.25) 0%, transparent 14%);
    mix-blend-mode: screen; filter: blur(1px);
  }

  .ob-stars { position: fixed; inset: 0; z-index: 1; pointer-events: none; }
  .ob-stars i {
    position: absolute; width: 1px; height: 1px; background: #fff; border-radius: 50%;
    opacity: var(--o, .6);
    animation: ob-twinkle var(--t, 6s) ease-in-out infinite;
    animation-delay: var(--d, 0s);
  }

  .ob-bg-vignette {
    position: fixed; inset: 0; pointer-events: none; z-index: 2;
    background:
      radial-gradient(ellipse 120% 80% at 50% 110%, transparent 40%, rgba(0,0,0,.75) 85%),
      radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,0,0,.4), transparent 60%);
  }

  .ob-orbit-stage {
    position: fixed; inset: 0; z-index: 2; pointer-events: none;
    display: grid; place-items: center;
    transform-style: preserve-3d;
  }
  .ob-orbit-tilt {
    width: 140vmin; height: 140vmin; position: relative;
    transform-style: preserve-3d;
    transform: rotateX(62deg) rotateZ(0deg);
    transition: transform 1.2s cubic-bezier(.2,.7,.2,1);
  }
  .ob-ring {
    position: absolute; inset: 0; border-radius: 50%;
    border: 1px solid var(--ob-line);
    animation: ob-spin var(--dur, 120s) linear infinite;
  }
  .ob-ring svg  { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  .ob-ring text { font-family: var(--ob-mono); font-size: 9px; fill: var(--ob-fg-faint); letter-spacing: 3px; }
  .ob-tick       { stroke: rgba(210,220,240,.22); stroke-width: 1; }
  .ob-tick-major { stroke: rgba(210,220,240,.50); stroke-width: 1; }
  .ob-dot        { fill: var(--ob-cyan); }
  .ob-dot-warm   { fill: var(--ob-magenta); }
  .ob-ring-1 { inset: 0;    --dur: 240s; }
  .ob-ring-2 { inset: 9%;  --dur: 180s; animation-direction: reverse; }
  .ob-ring-3 { inset: 20%; --dur: 140s; }
  .ob-ring-4 { inset: 32%; --dur:  90s; animation-direction: reverse; }
  .ob-ring-5 { inset: 42%; --dur:  60s; }
  .ob-ring-dashed { border-style: dashed; border-color: rgba(210,220,240,.06); }

  .ob-bg-grain {
    position: fixed; inset: -20%; pointer-events: none; z-index: 6;
    opacity: .06; mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  }

  /* ── CORNER BRACKETS ── */
  .ob-hud-corner {
    position: fixed; width: 44px; height: 44px;
    border: 1px solid var(--ob-line-2); pointer-events: none; z-index: 10;
  }
  .ob-hud-corner.ob-tl { top: 18px; left: 18px; border-right: none; border-bottom: none; }
  .ob-hud-corner.ob-tr { top: 18px; right: 18px; border-left:  none; border-bottom: none; }
  .ob-hud-corner.ob-bl { bottom: 18px; left: 18px;  border-right: none; border-top: none; }
  .ob-hud-corner.ob-br { bottom: 18px; right: 18px; border-left:  none; border-top: none; }

  /* ── TOP / BOTTOM BARS ── */
  .ob-topbar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 10;
    display: flex; justify-content: space-between; align-items: center;
    padding: calc(22px + env(safe-area-inset-top, 0px)) 40px 0;
    font-family: var(--ob-mono); font-size: 10px; letter-spacing: 3px;
    color: var(--ob-fg-dim); text-transform: uppercase;
    pointer-events: none;
  }
  .ob-topbar-brand {
    font-family: var(--ob-serif); font-size: 14px; letter-spacing: 6px;
    color: var(--ob-fg); font-weight: 400;
  }
  .ob-topbar-brand em {
    font-style: normal; color: var(--ob-cyan); margin-left: 8px;
    font-family: var(--ob-mono); font-size: 10px; letter-spacing: 3px;
  }
  .ob-topbar-right { display: flex; gap: 22px; align-items: center; }
  .ob-topbar-dot {
    display: inline-block; width: 6px; height: 6px; border-radius: 50%;
    background: var(--ob-cyan); box-shadow: 0 0 8px var(--ob-cyan);
    margin-right: 8px; vertical-align: middle;
  }

  .ob-bottombar {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 10;
    display: flex; justify-content: space-between; align-items: flex-end;
    padding: 0 40px max(18px, calc(18px + env(safe-area-inset-bottom, 0px)));
    font-family: var(--ob-mono); font-size: 9px; letter-spacing: 3px;
    color: var(--ob-fg-faint); text-transform: uppercase;
    pointer-events: none;
  }
  .ob-bottombar-tel { display: flex; gap: 28px; }
  .ob-bottombar-tel span b { color: var(--ob-fg-dim); font-weight: 400; }

  /* ── MENU ROOT ── */
`;

