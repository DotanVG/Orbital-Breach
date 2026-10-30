import type { ConnectionStatus } from "../net/client";

/** A small status chip above the lobby or match, without replacing either. */
export class ConnectionNotice {
  private root = document.createElement("div");
  private text = document.createElement("span");
  private retry = document.createElement("button");
  private back = document.createElement("button");
  private messageTimer: ReturnType<typeof setTimeout> | null = null;

  public constructor(onRetry: () => void, onBack: () => void) {
    this.root.id = "connection-status";
    this.root.dataset.testid = "connection-status";
    this.root.setAttribute("role", "status");
    this.root.setAttribute("aria-live", "polite");
    this.root.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);z-index:360;box-sizing:border-box;max-width:calc(100vw - 24px);width:max-content;padding:8px 12px;border-radius:6px;background:rgba(12,16,24,.9);color:#fff;font:14px sans-serif;display:none;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px";
    const style = document.createElement("style");
    style.textContent = `
      #connection-status { top: 108px; }
      body:has(.ob-session-root[style*="display: flex"]) #connection-status,
      body:has(#hud-tab[style*="display: block"]) #connection-status { visibility: hidden; }
      @media (max-width: 950px) {
        body:has(.ob-mp-root[style*="display: flex"]) #connection-status { top: calc(64px + env(safe-area-inset-top, 0px)); }
        body:has(#connection-status[data-active="true"]) .ob-mp-root { padding-top: calc(128px + env(safe-area-inset-top, 0px)); }
        body:has(#connection-status[data-active="true"]) .ob-mp-shell { max-height: calc(100dvh - 144px - env(safe-area-inset-top, 0px)); }
      }
      @media (max-width: 640px) {
        body:has(#connection-status[data-active="true"]) #hud-tutorial { visibility: hidden; }
      }
    `;
    document.head.appendChild(style);
    this.retry.type = "button";
    this.retry.textContent = "Retry";
    this.retry.style.cssText = "font:inherit;color:inherit;background:transparent;border:1px solid #9ca3af;border-radius:4px;padding:4px 8px;cursor:pointer";
    this.retry.onclick = onRetry;
    this.back.type = "button";
    this.back.textContent = "Back to menu";
    this.back.style.cssText = this.retry.style.cssText;
    this.back.onclick = onBack;
    this.root.append(this.text, this.retry, this.back);
    document.body.appendChild(this.root);
  }

  public render(status: ConnectionStatus): void {
    if (this.messageTimer !== null) clearTimeout(this.messageTimer);
    this.messageTimer = null;
    const lost = status === "lost";
    this.root.dataset.active = String(lost || status === "reconnecting");
    this.root.style.display = lost || status === "reconnecting" ? "flex" : "none";
    this.text.textContent = lost ? "Connection lost" : "Reconnecting…";
    this.retry.hidden = !lost;
    this.back.hidden = !lost;
  }

  public showMessage(message: string): void {
    this.render("disconnected");
    this.text.textContent = message;
    this.root.style.display = "flex";
    this.messageTimer = setTimeout(() => this.render("disconnected"), 5_000);
  }
}
