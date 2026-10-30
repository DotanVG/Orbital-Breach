import type { ConnectionStatus } from "../net/client";

/** A small status chip above the lobby or match, without replacing either. */
export class ConnectionNotice {
  private root = document.createElement("div");
  private text = document.createElement("span");
  private retry = document.createElement("button");

  public constructor(onRetry: () => void) {
    this.root.id = "connection-status";
    this.root.setAttribute("role", "status");
    this.root.setAttribute("aria-live", "polite");
    this.root.style.cssText = "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:10000;padding:8px 12px;border-radius:6px;background:rgba(12,16,24,.9);color:#fff;font:14px sans-serif;display:none;align-items:center;gap:10px";
    this.retry.type = "button";
    this.retry.textContent = "Retry";
    this.retry.style.cssText = "font:inherit;color:inherit;background:transparent;border:1px solid #9ca3af;border-radius:4px;padding:4px 8px;cursor:pointer";
    this.retry.onclick = onRetry;
    this.root.append(this.text, this.retry);
    document.body.appendChild(this.root);
  }

  public render(status: ConnectionStatus): void {
    const lost = status === "lost";
    this.root.style.display = lost || status === "reconnecting" ? "flex" : "none";
    this.text.textContent = lost ? "Connection lost" : "Reconnecting…";
    this.retry.hidden = !lost;
  }
}
