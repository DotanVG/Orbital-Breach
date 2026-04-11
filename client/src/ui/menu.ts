/**
 * Main Menu — neon laser-tag space aesthetic.
 * Rendered as DOM over the Three.js scene (canvas renders behind at z-index 0).
 * Solo-only for now; multiplayer callbacks wired in Feature 5.
 */

const CSS = `
  @keyframes glowPulse {
    0%,100% { text-shadow: 0 0 10px #00ffff, 0 0 30px #00ffff88; }
    50%      { text-shadow: 0 0 20px #00ffff, 0 0 60px #00ffff, 0 0 80px #00ffff44; }
  }
  @keyframes flicker {
    0%,96%,98%,100% { opacity:1; }
    97%,99%         { opacity:0.7; }
  }
  @keyframes scanline {
    0%   { background-position: 0 0; }
    100% { background-position: 0 4px; }
  }
  @keyframes menuFadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .menu-root {
    position: fixed; inset: 0;
    background: rgba(8,12,20,0.92);
    background-image: repeating-linear-gradient(
      0deg, transparent, transparent 3px, rgba(0,255,255,0.018) 3px, rgba(0,255,255,0.018) 4px
    );
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-family: monospace; color: #aaa; z-index: 300;
    animation: scanline 0.1s linear infinite, menuFadeIn 0.35s ease-out both;
  }
  .menu-title {
    font-size: 52px; letter-spacing: 12px; font-weight: bold;
    color: #00ffff; animation: glowPulse 2.5s ease-in-out infinite, flicker 8s infinite;
    margin-bottom: 6px;
  }
  .menu-subtitle {
    font-size: 13px; letter-spacing: 6px; color: #4477bb; margin-bottom: 48px;
    text-transform: uppercase;
  }
  .menu-section { margin-bottom: 28px; text-align: center; }
  .menu-label {
    font-size: 10px; letter-spacing: 4px; color: #556; margin-bottom: 12px;
    text-transform: uppercase;
  }
  .menu-input {
    background: rgba(0,0,0,0.5); border: 1px solid #334;
    color: #0cf; font-family: monospace; font-size: 14px;
    padding: 10px 18px; outline: none; letter-spacing: 2px;
    border-radius: 2px; width: 220px; text-align: center;
  }
  .menu-input:focus { border-color: #00ffff88; }
  .menu-divider {
    width: 300px; height: 1px;
    background: linear-gradient(90deg, transparent, #224, transparent);
    margin: 4px 0 28px;
  }
  .menu-btn {
    background: rgba(0,255,255,0.06);
    border: 1px solid #00ffff55;
    color: #00cccc; font-family: monospace; font-size: 15px;
    letter-spacing: 4px; padding: 14px 48px; cursor: pointer;
    text-transform: uppercase; transition: all 0.15s ease;
    border-radius: 2px;
  }
  .menu-btn:hover {
    background: rgba(0,255,255,0.18); border-color: #00ffff;
    color: #00ffff; text-shadow: 0 0 12px #00ffff;
    box-shadow: 0 0 24px rgba(0,255,255,0.2) inset, 0 0 12px rgba(0,255,255,0.1);
  }
  .menu-controls {
    margin-top: 32px; font-size: 11px; color: #334; letter-spacing: 2px;
    line-height: 1.9; text-align: center;
  }
  .menu-controls span { color: #557; }
  .menu-version {
    position: fixed; bottom: 12px; right: 16px;
    font-size: 10px; color: #223; letter-spacing: 2px; font-family: monospace;
  }
`;

export class MainMenu {
  private el: HTMLDivElement | null = null;
  private styleEl: HTMLStyleElement | null = null;

  public onPlay: (() => void) | null = null;

  public show(): void {
    this.hide();
    this._injectStyle();

    const savedName = localStorage.getItem('orbital_player_name') ?? '';

    this.el = document.createElement('div');
    this.el.innerHTML = `
      <div class="menu-root" id="menu-root">
        <div class="menu-title">ORBITAL BREACH</div>
        <div class="menu-subtitle">Zero-G Arena Shooter · Vibe Jam 2026</div>

        <div class="menu-section">
          <div class="menu-label">Call Sign</div>
          <input class="menu-input" id="menu-name" type="text"
            placeholder="ENTER NAME" maxlength="16" value="${savedName}" autocomplete="off" />
        </div>

        <div class="menu-divider"></div>

        <div class="menu-section">
          <button class="menu-btn" id="btn-play">PLAY SOLO</button>
        </div>

        <div class="menu-controls">
          <span>WASD</span> Move in breach room &nbsp;·&nbsp;
          <span>E</span> Grab bar &nbsp;·&nbsp;
          <span>SPACE</span> Jump / charge launch<br>
          <span>LMB</span> Fire freeze pistol &nbsp;·&nbsp;
          <span>MOUSE</span> Look &nbsp;·&nbsp;
          <span>ESC</span> Release cursor
        </div>

        <div class="menu-version">v0.1.0 · ORBITAL BREACH</div>
      </div>
    `;
    document.body.appendChild(this.el);

    const nameInput = this.el.querySelector<HTMLInputElement>('#menu-name')!;
    nameInput.addEventListener('input', () => {
      const v = nameInput.value.trim();
      if (v) localStorage.setItem('orbital_player_name', v);
    });

    this.el.querySelector('#btn-play')!.addEventListener('click', () => {
      this._saveName();
      this.fadeOut(() => this.onPlay?.());
    });
  }

  public hide(): void {
    this.el?.remove();
    this.el = null;
  }

  public fadeOut(cb?: () => void): void {
    const root = this.el?.querySelector<HTMLElement>('#menu-root');
    if (!root) { cb?.(); return; }
    root.style.transition = 'opacity 0.22s ease-out, transform 0.22s ease-out';
    root.style.opacity = '0';
    root.style.transform = 'translateY(-6px)';
    root.style.pointerEvents = 'none';
    setTimeout(() => { this.hide(); cb?.(); }, 240);
  }

  public isVisible(): boolean { return this.el !== null; }

  public dispose(): void {
    this.hide();
    this.styleEl?.remove();
    this.styleEl = null;
  }

  private _saveName(): void {
    const input = this.el?.querySelector<HTMLInputElement>('#menu-name');
    const name = input?.value.trim();
    if (name) localStorage.setItem('orbital_player_name', name);
  }

  private _injectStyle(): void {
    if (this.styleEl) return;
    this.styleEl = document.createElement('style');
    this.styleEl.textContent = CSS;
    document.head.appendChild(this.styleEl);
  }
}
