import { MATCH_TEAM_SIZES, type MatchTeamSize } from "../../../shared/match";
import {
  getMaxPlayersForTeamSize,
  getRoomStatus,
  getTeamSizeForMaxPlayers,
  sanitizeRoomName,
  type MultiplayerCreateRoomTarget,
  type MultiplayerRoomDirectoryEntry,
  type MultiplayerRoomVisibility,
} from "../../../shared/multiplayer";
import { fetchPublicRoomDirectory } from "../net/roomDirectory";
import { injectDesignTokens } from "./designTokens";
import { escapeHtml } from "./escapeHtml";

const MAX_PLAYER_OPTIONS = MATCH_TEAM_SIZES.map((teamSize) => getMaxPlayersForTeamSize(teamSize));

const CSS = `
  .ob-rb-root {
    position: fixed;
    inset: 0;
    z-index: 360;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 18px;
    background: rgba(2, 6, 16, 0.78);
    backdrop-filter: blur(16px);
    color: #ebf7ff;
    overflow: hidden;
  }

  .ob-rb-root * {
    box-sizing: border-box;
  }

  .ob-rb-root::before,
  .ob-rb-root::after {
    content: "";
    position: absolute;
    pointer-events: none;
  }

  .ob-rb-root::before {
    inset: -28px;
    background: url("/assets/marketing/orbital-breach-bg.png") center / cover no-repeat;
    filter: blur(18px);
    opacity: 0.36;
    transform: scale(1.04);
  }

  .ob-rb-root::after {
    inset: 0;
    background: rgba(1, 4, 8, 0.58);
  }

  .ob-rb-shell {
    position: relative;
    z-index: 1;
    width: min(1100px, calc(100vw - 36px));
    max-height: calc(100dvh - 28px);
    overflow: auto;
    padding: 22px;
    border: 1px solid rgba(210, 220, 240, 0.16);
    background:
      radial-gradient(circle at top left, rgba(127, 252, 255, 0.08), rgba(127, 252, 255, 0) 22%),
      radial-gradient(circle at bottom right, rgba(255, 125, 248, 0.08), rgba(255, 125, 248, 0) 26%),
      rgba(6, 10, 20, 0.96);
    box-shadow: 0 26px 72px rgba(0, 0, 0, 0.45);
  }

  .ob-rb-topbar,
  .ob-rb-panel,
  .ob-rb-room {
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
  }

  .ob-rb-topbar {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 18px;
    margin-bottom: 16px;
  }

  .ob-rb-kicker,
  .ob-rb-meta,
  .ob-rb-label,
  .ob-rb-button,
  .ob-rb-field input,
  .ob-rb-field select,
  .ob-rb-status,
  .ob-rb-badge,
  .ob-rb-empty {
    font-family: "JetBrains Mono", monospace;
    text-transform: uppercase;
  }

  .ob-rb-kicker,
  .ob-rb-label,
  .ob-rb-meta,
  .ob-rb-status {
    color: #9aa5b8;
    font-size: 11px;
    letter-spacing: 0.12em;
  }

  .ob-rb-title {
    margin-top: 8px;
    font-size: clamp(30px, 4vw, 42px);
    font-family: "Cormorant Garamond", serif;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .ob-rb-copy {
    margin-top: 8px;
    max-width: 560px;
    color: #d6edf5;
    line-height: 1.55;
  }

  .ob-rb-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: flex-start;
    justify-content: flex-end;
  }

  .ob-rb-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.9fr);
    gap: 16px;
  }

  .ob-rb-panel {
    padding: 16px;
  }

  .ob-rb-panel-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: baseline;
  }

  .ob-rb-panel-title {
    font-size: 22px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .ob-rb-status {
    margin-top: 12px;
    min-height: 18px;
  }

  .ob-rb-room-list {
    display: grid;
    gap: 12px;
    margin-top: 14px;
  }

  .ob-rb-room {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    padding: 14px;
  }

  .ob-rb-room-head {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: baseline;
  }

  .ob-rb-room-name {
    font-size: 20px;
    font-family: "Cormorant Garamond", serif;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .ob-rb-room-meta {
    margin-top: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .ob-rb-badge {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 0 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    font-size: 10px;
    letter-spacing: 0.08em;
  }

  .ob-rb-badge--open {
    color: #dffcff;
    border-color: rgba(127, 252, 255, 0.22);
    background: rgba(127, 252, 255, 0.08);
  }

  .ob-rb-badge--busy {
    color: #ffd8b2;
    border-color: rgba(255, 190, 140, 0.22);
    background: rgba(255, 190, 140, 0.08);
  }

  .ob-rb-room-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
    min-width: 156px;
  }

  .ob-rb-empty {
    margin-top: 14px;
    padding: 18px;
    border: 1px dashed rgba(255, 255, 255, 0.12);
    color: #c9d5e8;
    letter-spacing: 0.08em;
  }

  .ob-rb-form {
    display: grid;
    gap: 14px;
    margin-top: 16px;
  }

  .ob-rb-field {
    display: grid;
    gap: 6px;
  }

  .ob-rb-field input,
  .ob-rb-field select {
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: #effcff;
    outline: none;
    font-size: 12px;
    letter-spacing: 0.08em;
  }

  .ob-rb-field select option {
    color: #effcff;
    background: #071019;
  }

  .ob-rb-button {
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: #effcff;
    cursor: pointer;
    font-size: 12px;
    letter-spacing: 0.08em;
    transition: transform 0.14s ease, border-color 0.18s ease, background 0.18s ease;
  }

  .ob-rb-button:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: rgba(255, 255, 255, 0.24);
    background: rgba(255, 255, 255, 0.07);
  }

  .ob-rb-button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .ob-rb-button--primary {
    border-color: rgba(127, 252, 255, 0.26);
    background: rgba(127, 252, 255, 0.08);
  }

  .ob-rb-button--danger {
    border-color: rgba(255, 125, 248, 0.28);
  }

  .ob-rb-button--wide {
    width: 100%;
  }

  .ob-rb-invite {
    margin-top: 14px;
    padding: 14px;
    border: 1px solid rgba(127, 252, 255, 0.16);
    background: rgba(127, 252, 255, 0.05);
  }

  .ob-rb-invite-copy {
    margin-top: 8px;
    color: #d8f7ff;
    line-height: 1.5;
  }

  .ob-rb-invite-code {
    margin-top: 10px;
    font-size: 12px;
    color: #7ffcff;
    letter-spacing: 0.12em;
  }

  @media (max-width: 880px) {
    .ob-rb-grid {
      grid-template-columns: 1fr;
    }

    .ob-rb-room {
      grid-template-columns: 1fr;
    }

    .ob-rb-room-actions,
    .ob-rb-actions {
      justify-content: flex-start;
    }
  }
`;

export class RoomBrowser {
  private readonly root: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private readonly roomList: HTMLDivElement;
  private readonly inviteCard: HTMLDivElement;
  private readonly roomNameInput: HTMLInputElement;
  private readonly visibilitySelect: HTMLSelectElement;
  private readonly maxPlayersSelect: HTMLSelectElement;
  private readonly createButton: HTMLButtonElement;
  private readonly refreshButton: HTMLButtonElement;
  private inviteRoomId: string | null = null;
  private readonly listenerAbort = new AbortController();
  private disposeRootListeners: (() => void) | null = null;

  public onJoinRoom: ((roomId: string) => void) | null = null;
  public onCreateRoom: ((target: MultiplayerCreateRoomTarget) => void) | null = null;
  public onClose: (() => void) | null = null;

  public constructor() {
    injectStyle();

    this.root = document.createElement("div");
    this.root.className = "ob-rb-root";
    this.root.innerHTML = buildMarkup();
    document.body.appendChild(this.root);

    this.status = this.query("#rb-status");
    this.roomList = this.query("#rb-room-list");
    this.inviteCard = this.query("#rb-invite");
    this.roomNameInput = this.query("#rb-room-name");
    this.visibilitySelect = this.query("#rb-visibility");
    this.maxPlayersSelect = this.query("#rb-max-players");
    this.createButton = this.query("#rb-create");
    this.refreshButton = this.query("#rb-refresh");

    this.maxPlayersSelect.innerHTML = MAX_PLAYER_OPTIONS
      .map((players) => `<option value="${players}">${players} Players</option>`)
      .join("");
    const listenerOptions = { signal: this.listenerAbort.signal };

    const closeButton = this.query<HTMLButtonElement>("#rb-close");
    const handleClose = (): void => {
      this.hide();
      this.onClose?.();
    };
    const handleRefresh = (): void => {
      void this.refresh();
    };
    const handleCreate = (): void => {
      this.handleCreate();
    };
    const handleInviteClick = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.closest("[data-join-invite]") && this.inviteRoomId) {
        this.onJoinRoom?.(this.inviteRoomId);
      }
    };
    const handleRoomListClick = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const button = target.closest<HTMLButtonElement>("[data-room-id]");
      const roomId = button?.dataset["roomId"];
      if (roomId) {
        this.onJoinRoom?.(roomId);
      }
    };

    closeButton.addEventListener("click", handleClose, listenerOptions);
    this.refreshButton.addEventListener("click", handleRefresh, listenerOptions);
    this.createButton.addEventListener("click", handleCreate, listenerOptions);
    this.inviteCard.addEventListener("click", handleInviteClick, listenerOptions);
    this.roomList.addEventListener("click", handleRoomListClick, listenerOptions);

    this.disposeRootListeners = () => {
      closeButton.removeEventListener("click", handleClose);
      this.refreshButton.removeEventListener("click", handleRefresh);
      this.createButton.removeEventListener("click", handleCreate);
      this.inviteCard.removeEventListener("click", handleInviteClick);
      this.roomList.removeEventListener("click", handleRoomListClick);
    };
  }

  public async show(options?: { inviteRoomId?: string | null; defaultTeamSize?: MatchTeamSize }): Promise<void> {
    this.inviteRoomId = options?.inviteRoomId?.trim() || null;
    if (options?.defaultTeamSize) {
      this.maxPlayersSelect.value = String(getMaxPlayersForTeamSize(options.defaultTeamSize));
    }

    this.renderInviteCard();
    this.root.style.display = "flex";
    await this.refresh();
  }

  public hide(): void {
    this.root.style.display = "none";
    this.setStatus("");
  }

  public dispose(): void {
    this.listenerAbort.abort();
    this.disposeRootListeners?.();
    this.disposeRootListeners = null;
    this.root.remove();
  }

  private async refresh(): Promise<void> {
    this.refreshButton.disabled = true;
    this.roomList.innerHTML = `<div class="ob-rb-empty">Refreshing room directory...</div>`;
    this.setStatus("Fetching public lobbies...");

    try {
      const rooms = await fetchPublicRoomDirectory();
      this.renderRoomList(rooms);
      this.setStatus(rooms.length > 0 ? "Public rooms updated." : "No public rooms are currently advertised.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Room directory request failed.";
      this.roomList.innerHTML = `<div class="ob-rb-empty">${escapeHtml(message)}</div>`;
      this.setStatus(message);
    } finally {
      this.refreshButton.disabled = false;
    }
  }

  private handleCreate(): void {
    const teamSize = getTeamSizeForMaxPlayers(Number(this.maxPlayersSelect.value));
    if (!teamSize) {
      this.setStatus("Choose a supported player cap before creating a room.");
      return;
    }

    const visibility = this.visibilitySelect.value === "private" ? "private" : "public";
    this.onCreateRoom?.({
      kind: "create",
      listing: "browser",
      visibility,
      roomName: sanitizeRoomName(this.roomNameInput.value),
      teamSize,
    });
  }

  private renderInviteCard(): void {
    if (!this.inviteRoomId) {
      this.inviteCard.style.display = "none";
      this.inviteCard.innerHTML = "";
      return;
    }

    this.inviteCard.style.display = "block";
    this.inviteCard.innerHTML = `
      <div class="ob-rb-label">Invite Link Detected</div>
      <div class="ob-rb-invite-copy">
        A direct room invite is active in this URL. Join the targeted lobby immediately or browse the public list first.
      </div>
      <div class="ob-rb-invite-code">${escapeHtml(this.inviteRoomId)}</div>
      <div class="ob-rb-actions" style="margin-top:12px;justify-content:flex-start;">
        <button class="ob-rb-button ob-rb-button--primary" data-join-invite>Join Invite</button>
      </div>
    `;
  }

  private renderRoomList(rooms: MultiplayerRoomDirectoryEntry[]): void {
    if (rooms.length === 0) {
      this.roomList.innerHTML = `<div class="ob-rb-empty">No public custom rooms are currently available. Create one to start the directory.</div>`;
      return;
    }

    this.roomList.innerHTML = rooms.map((room) => renderRoomCard(room)).join("");
  }

  private setStatus(text: string): void {
    this.status.textContent = text;
  }

  private query<T extends HTMLElement>(selector: string): T {
    return this.root.querySelector<T>(selector) as T;
  }
}

function injectStyle(): void {
  injectDesignTokens();
  if (document.getElementById("orbital-room-browser-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "orbital-room-browser-style";
  style.textContent = CSS;
  document.head.appendChild(style);
}

function buildMarkup(): string {
  return `
    <div class="ob-rb-shell">
      <div class="ob-rb-topbar">
        <div>
          <div class="ob-rb-kicker">Server Browser</div>
          <div class="ob-rb-title">Rooms & Invites</div>
          <div class="ob-rb-copy">
            Browse public custom lobbies, create your own room, or join a direct invite without losing the existing quick-join flow.
          </div>
        </div>

        <div class="ob-rb-actions">
          <button id="rb-refresh" class="ob-rb-button">Refresh</button>
          <button id="rb-close" class="ob-rb-button ob-rb-button--danger">Close</button>
        </div>
      </div>

      <div class="ob-rb-grid">
        <section class="ob-rb-panel">
          <div class="ob-rb-panel-head">
            <div>
              <div class="ob-rb-kicker">Public Rooms</div>
              <div class="ob-rb-panel-title">Join A Lobby</div>
            </div>
            <div id="rb-status" class="ob-rb-status"></div>
          </div>

          <div id="rb-invite" class="ob-rb-invite" style="display:none"></div>
          <div id="rb-room-list" class="ob-rb-room-list"></div>
        </section>

        <section class="ob-rb-panel">
          <div class="ob-rb-kicker">Create Room</div>
          <div class="ob-rb-panel-title">Advertise Or Go Private</div>

          <div class="ob-rb-form">
            <label class="ob-rb-field">
              <span class="ob-rb-label">Room Name</span>
              <input id="rb-room-name" maxlength="24" value="Orbital Lobby" />
            </label>

            <label class="ob-rb-field">
              <span class="ob-rb-label">Visibility</span>
              <select id="rb-visibility">
                <option value="public">Public Listing</option>
                <option value="private">Private Invite Only</option>
              </select>
            </label>

            <label class="ob-rb-field">
              <span class="ob-rb-label">Max Players</span>
              <select id="rb-max-players"></select>
            </label>

            <button id="rb-create" class="ob-rb-button ob-rb-button--primary ob-rb-button--wide">Create Room</button>
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderRoomCard(room: MultiplayerRoomDirectoryEntry): string {
  const status = getRoomStatus(room.phase, room.currentPlayers, room.maxPlayers, !room.joinable);
  const badgeClass = room.joinable ? "ob-rb-badge ob-rb-badge--open" : "ob-rb-badge ob-rb-badge--busy";

  return `
    <div class="ob-rb-room">
      <div>
        <div class="ob-rb-room-head">
          <div class="ob-rb-room-name">${escapeHtml(room.roomName)}</div>
          <span class="${badgeClass}">${escapeHtml(status)}</span>
        </div>
        <div class="ob-rb-room-meta">
          <span class="ob-rb-badge">${room.currentPlayers}/${room.maxPlayers} Players</span>
          <span class="ob-rb-badge">${room.teamSize}v${room.teamSize}</span>
          <span class="ob-rb-badge">${escapeHtml(room.roomId)}</span>
        </div>
      </div>

      <div class="ob-rb-room-actions">
        <button class="ob-rb-button ${room.joinable ? "ob-rb-button--primary" : ""}" data-room-id="${escapeHtml(room.roomId)}" ${room.joinable ? "" : "disabled"}>
          ${room.joinable ? "Join Room" : "Unavailable"}
        </button>
      </div>
    </div>
  `;
}
