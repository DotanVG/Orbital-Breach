export class KillFeed {
  private container: HTMLDivElement;
  private localPlayerName = "";

  public setLocalPlayerName(name: string): void {
    this.localPlayerName = name;
  }

  public constructor() {
    this.container = document.createElement("div");
    Object.assign(this.container.style, {
      position: "fixed",
      top: "60px",
      right: "16px",
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: "4px",
      pointerEvents: "none",
      zIndex: "100",
      fontFamily: "monospace",
      fontSize: "13px",
    });
    document.body.appendChild(this.container);
  }

  public setVisible(visible: boolean): void {
    this.container.style.display = visible ? "flex" : "none";
  }

  public addKill(killerName: string, killerTeam: 0 | 1, victimName: string, victimTeam: 0 | 1): void {
    const entry = document.createElement("div");
    const killerColor = killerTeam === 0 ? "#00ffff" : "#ff00ff";
    const victimColor = victimTeam === 0 ? "#00ffff" : "#ff00ff";
    const killerLabel = this.localPlayerName && killerName === this.localPlayerName
      ? `<span style="color:${killerColor};text-shadow:0 0 6px ${killerColor};font-weight:bold">YOU</span>`
      : `<span style="color:${killerColor};text-shadow:0 0 6px ${killerColor}">${killerName}</span>`;
    const victimLabel = this.localPlayerName && victimName === this.localPlayerName
      ? `<span style="color:${victimColor};text-shadow:0 0 6px ${victimColor};font-weight:bold">YOU</span>`
      : `<span style="color:${victimColor};text-shadow:0 0 6px ${victimColor}">${victimName}</span>`;

    entry.innerHTML =
      killerLabel
      + `<span style="color:#888;margin:0 6px">froze</span>`
      + victimLabel;

    Object.assign(entry.style, {
      background: "rgba(0,0,0,0.55)",
      border: "1px solid #333",
      borderRadius: "4px",
      padding: "2px 8px",
      transition: "opacity 0.5s ease",
      opacity: "1",
    });

    this.container.appendChild(entry);
    setTimeout(() => { entry.style.opacity = "0"; }, 3500);
    setTimeout(() => { entry.remove(); }, 4000);
  }

  public addScore(scorerName: string, scorerTeam: 0 | 1): void {
    const color = scorerTeam === 0 ? "#00ffff" : "#ff00ff";
    const entry = document.createElement("div");
    const displayName = this.localPlayerName && scorerName === this.localPlayerName ? "YOU" : scorerName;
    entry.innerHTML =
      `<span style="color:${color};text-shadow:0 0 8px ${color};font-weight:bold">${displayName} BREACHED!</span>`;

    Object.assign(entry.style, {
      background: "rgba(0,0,0,0.65)",
      border: `1px solid ${color}`,
      borderRadius: "4px",
      padding: "3px 10px",
      transition: "opacity 0.5s ease",
      opacity: "1",
    });

    this.container.appendChild(entry);
    setTimeout(() => { entry.style.opacity = "0"; }, 4500);
    setTimeout(() => { entry.remove(); }, 5000);
  }

  public addLeave(playerName: string, playerTeam: 0 | 1): void {
    const color = playerTeam === 0 ? "#00ffff" : "#ff00ff";
    const entry = document.createElement("div");
    const displayName = this.localPlayerName && playerName === this.localPlayerName ? "YOU" : playerName;
    entry.innerHTML =
      `<span style="color:${color};text-shadow:0 0 6px ${color};font-weight:bold">${escapeHtml(displayName)}</span>`
      + `<span style="color:#c8c8c8;margin-left:6px">Player left</span>`;

    Object.assign(entry.style, {
      background: "rgba(88,92,99,0.78)",
      border: "1px solid rgba(180,185,194,0.45)",
      borderRadius: "4px",
      padding: "3px 10px",
      transition: "opacity 0.5s ease",
      opacity: "1",
    });

    this.container.prepend(entry);
    setTimeout(() => { entry.style.opacity = "0"; }, 4500);
    setTimeout(() => { entry.remove(); }, 5000);
  }
}

function escapeHtml(raw: string): string {
  return raw.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return ch;
    }
  });
}
