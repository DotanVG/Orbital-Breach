export interface GlobalCursor {
  show(): void;
  hide(): void;
  setHot(hot: boolean): void;
  dispose(): void;
}

const STYLE = `
  .gc-cursor {
    position: fixed; top: 0; left: 0; z-index: 9999;
    width: 28px; height: 28px;
    transform: translate(-50%, -50%);
    pointer-events: none;
    mix-blend-mode: screen;
    color: var(--ob-cyan, #00e5ff);
  }
  .gc-cursor::before {
    content: ""; position: absolute; inset: 0; border-radius: 50%;
    border: 1px solid var(--ob-cyan, #00e5ff);
    transition: transform .2s ease, border-color .2s ease;
  }
  .gc-cursor::after {
    content: ""; position: absolute;
    width: 3px; height: 3px; left: 50%; top: 50%;
    transform: translate(-50%,-50%);
    border-radius: 50%;
    background: var(--ob-cyan, #00e5ff);
    box-shadow: 0 0 8px var(--ob-cyan, #00e5ff);
  }
  .gc-cursor.gc-hot::before { transform: scale(1.7); border-color: var(--ob-magenta, #ff00ff); }
  .gc-cursor.gc-hot::after  { background: var(--ob-magenta, #ff00ff); box-shadow: 0 0 10px var(--ob-magenta, #ff00ff); }
  .gc-cursor svg { position: absolute; inset: -6px; width: 40px; height: 40px; opacity: .6; }
  .gc-cursor.gc-hidden { display: none; }
`;

export function initGlobalCursor(): GlobalCursor {
  if (window.matchMedia('(pointer: coarse)').matches) {
    return { show: () => {}, hide: () => {}, setHot: () => {}, dispose: () => {} };
  }

  document.body.style.cursor = 'none';

  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.className = 'gc-cursor';
  el.innerHTML = `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width=".8">
    <line x1="20" y1="0"  x2="20" y2="10"/>
    <line x1="20" y1="30" x2="20" y2="40"/>
    <line x1="0"  y1="20" x2="10" y2="20"/>
    <line x1="30" y1="20" x2="40" y2="20"/>
  </svg>`;
  document.body.appendChild(el);

  let mx = window.innerWidth / 2;
  let my = window.innerHeight / 2;
  let cx = mx;
  let cy = my;
  let rafId = 0;

  const onMove = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; };
  const onDown = () => el.classList.add('gc-hot');
  const onUp   = () => el.classList.remove('gc-hot');
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);

  const tick = () => {
    cx += (mx - cx) * 0.25;
    cy += (my - cy) * 0.25;
    el.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%)`;
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  return {
    show()         { el.classList.remove('gc-hidden'); document.body.style.cursor = 'none'; },
    hide()         { el.classList.add('gc-hidden'); document.body.style.cursor = ''; },
    setHot(hot)    { el.classList.toggle('gc-hot', hot); },
    dispose() {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      el.remove();
      style.remove();
    },
  };
}
