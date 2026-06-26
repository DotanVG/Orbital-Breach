import { MATCH_TEAM_SIZES, type MatchTeamSize } from "../../../shared/match";
import {
  buildInviteUrl,
  getLobbyMemberCounts,
  type LobbyEventMessage,
  type MultiplayerRoomSnapshot,
} from "../../../shared/multiplayer";
import QRCode from "qrcode";
import {
  buildLobbyMarkup,
  describePhase,
  describeQueueState,
  formatLobbyTime,
  getTeamRelationLabel,
  playlistLabel,
  renderRoster,
  renderSummaryCard,
} from "./multiplayerLobbyView";
import { injectMultiplayerLobbyStyle } from "./multiplayerLobbyStyle";

export { getTeamRelationLabel } from "./multiplayerLobbyView";

export class MultiplayerLobby {
  private root: HTMLDivElement;
  private status: HTMLDivElement;
  private phase: HTMLDivElement;
  private meta: HTMLDivElement;
  private score: HTMLDivElement;
  private playlistCard: HTMLDivElement;
  private queueCard: HTMLDivElement;
  private teamCard: HTMLDivElement;
  private readyButton: HTMLButtonElement;
  private switchTeamButton: HTMLButtonElement;
  private fillBotsButton: HTMLButtonElement;
  private clearBotsButton: HTMLButtonElement;
  private settingsButton: HTMLButtonElement;
  private leaveButton: HTMLButtonElement;
  private inviteUrlInput: HTMLInputElement;
  private copyInviteButton: HTMLButtonElement;
  private shareInviteButton: HTMLButtonElement;
  private inviteQrCard: HTMLDivElement;
  private inviteQrImage: HTMLImageElement;
  private inviteNote: HTMLDivElement;
  private inviteQrMeta: HTMLDivElement;
  private teamSizeSelect: HTMLSelectElement;
  private team0Title: HTMLDivElement;
  private team0Relation: HTMLSpanElement;
  private team1Title: HTMLDivElement;
  private team1Relation: HTMLSpanElement;
  private team0Count: HTMLDivElement;
  private team1Count: HTMLDivElement;
  private team0Roster: HTMLDivElement;
  private team1Roster: HTMLDivElement;
  private latestState: MultiplayerRoomSnapshot | null = null;
  private latestInviteUrl = "";
  private inviteQrForUrl = "";
  private inviteQrPendingUrl = "";
  private inviteQrRequestId = 0;

  public onLeaveLobby: (() => void) | null = null;
  public onReadyChange: ((ready: boolean) => void) | null = null;
  public onSwitchTeam: ((team: 0 | 1) => void) | null = null;
  public onFillBots: ((fill: boolean) => void) | null = null;
  public onOpenSettings: (() => void) | null = null;
  public onTeamSizeChange: ((teamSize: MatchTeamSize) => void) | null = null;

  public constructor() {
    injectMultiplayerLobbyStyle();

    this.root = document.createElement("div");
    this.root.className = "ob-mp-root";
    this.root.innerHTML = buildLobbyMarkup();
    document.body.appendChild(this.root);

    this.status = this.query("#mp-status");
    this.phase = this.query("#mp-phase");
    this.meta = this.query("#mp-meta");
    this.score = this.query("#mp-score");
    this.playlistCard = this.query("#mp-playlist-card");
    this.queueCard = this.query("#mp-queue-card");
    this.teamCard = this.query("#mp-team-card");
    this.readyButton = this.query("#mp-ready");
    this.switchTeamButton = this.query("#mp-switch-team");
    this.fillBotsButton = this.query("#mp-fill-bots");
    this.clearBotsButton = this.query("#mp-clear-bots");
    this.settingsButton = this.query("#mp-settings");
    this.leaveButton = this.query("#mp-leave");
    this.inviteUrlInput = this.query("#mp-invite-url");
    this.copyInviteButton = this.query("#mp-copy-invite");
    this.shareInviteButton = this.query("#mp-share-invite");
    this.inviteQrCard = this.query("#mp-qr-card");
    this.inviteQrImage = this.query("#mp-invite-qr");
    this.inviteNote = this.query("#mp-invite-note");
    this.inviteQrMeta = this.query("#mp-invite-qr-meta");
    this.teamSizeSelect = this.query("#mp-team-size");
    this.team0Title = this.query("#mp-team0-title");
    this.team0Relation = this.query("#mp-team0-relation");
    this.team1Title = this.query("#mp-team1-title");
    this.team1Relation = this.query("#mp-team1-relation");
    this.team0Count = this.query("#mp-team0-count");
    this.team1Count = this.query("#mp-team1-count");
    this.team0Roster = this.query("#mp-team0-roster");
    this.team1Roster = this.query("#mp-team1-roster");

    this.teamSizeSelect.innerHTML = MATCH_TEAM_SIZES.map((size) =>
      `<option value="${size}">${playlistLabel(size)}</option>`).join("");

    this.readyButton.addEventListener("click", () => {
      const state = this.latestState;
      if (!state) return;
      const self = this.getSelf(state);
      this.onReadyChange?.(!self?.ready);
    });
    this.switchTeamButton.addEventListener("click", () => {
      const state = this.latestState;
      if (!state) return;
      this.onSwitchTeam?.(state.selfTeam === 0 ? 1 : 0);
    });
    this.fillBotsButton.addEventListener("click", () => this.onFillBots?.(true));
    this.clearBotsButton.addEventListener("click", () => this.onFillBots?.(false));
    this.settingsButton.addEventListener("click", () => this.onOpenSettings?.());
    this.leaveButton.addEventListener("click", () => this.onLeaveLobby?.());
    this.copyInviteButton.addEventListener("click", () => {
      void this.copyInviteUrl();
    });
    this.shareInviteButton.addEventListener("click", () => {
      void this.shareInviteUrl();
    });
    this.teamSizeSelect.addEventListener("change", () => {
      const teamSize = Number(this.teamSizeSelect.value);
      if (MATCH_TEAM_SIZES.includes(teamSize as MatchTeamSize)) {
        this.onTeamSizeChange?.(teamSize as MatchTeamSize);
      }
    });
  }

  public showConnecting(playerName: string): void {
    this.root.style.display = "flex";
    this.phase.textContent = "Handshake";
    this.meta.textContent = "Establishing room session";
    this.score.textContent = "0 - 0";
    this.playlistCard.innerHTML = renderSummaryCard("playlist", "Connecting", "Contacting the online room.");
    this.queueCard.innerHTML = renderSummaryCard("queue", "Assembling", "Waiting for the queue state.");
    this.teamCard.innerHTML = renderSummaryCard("team", "Seat", "Finding your squad slot.");
    this.team0Title.textContent = "Cyan squad";
    this.team0Relation.textContent = "Friendly";
    this.team1Title.textContent = "Magenta squad";
    this.team1Relation.textContent = "Hostile";
    this.team0Count.textContent = "Loading";
    this.team1Count.textContent = "Loading";
    this.team0Roster.innerHTML = `<div class="ob-mp-empty">Joining room...</div>`;
    this.team1Roster.innerHTML = `<div class="ob-mp-empty">Joining room...</div>`;
    this.inviteUrlInput.value = "";
    this.inviteQrImage.removeAttribute("src");
    this.inviteQrCard.classList.add("ob-mp-qr-card--loading");
    this.inviteNote.textContent = "Invite tools will activate as soon as the room session is established.";
    this.inviteQrMeta.textContent = "QR pending connection";
    this.copyInviteButton.disabled = true;
    this.shareInviteButton.disabled = true;
    this.setStatus(`Connecting ${playerName} to the live queue...`, "info", true);
  }

  public show(): void {
    this.root.style.display = "flex";
  }

  public hide(): void {
    this.root.style.display = "none";
    this.latestState = null;
  }

  public setStatus(text: string, kind: LobbyEventMessage["type"], connecting = false): void {
    this.status.textContent = text;
    this.status.classList.toggle("ob-mp-status--connecting", connecting);
    this.status.style.color = kind === "error" ? "#ffb1c0" : "#dffcff";
    this.status.style.borderColor = kind === "error"
      ? "rgba(255, 120, 150, 0.38)"
      : "rgba(127, 252, 255, 0.16)";
    this.status.style.boxShadow = kind === "error"
      ? "0 0 0 1px rgba(255, 120, 150, 0.08) inset"
      : "0 0 0 1px rgba(127, 252, 255, 0.05) inset";
  }

  public render(state: MultiplayerRoomSnapshot): void {
    this.latestState = state;
    this.show();
    const counts = getLobbyMemberCounts(state.members);
    const self = this.getSelf(state);
    const isLobby = state.phase === "LOBBY";
    const selfTeamLabel = state.selfTeam === 0 ? "Cyan squad" : "Magenta squad";
    const readyHumans = state.members.filter((member) => !member.isBot && member.ready).length;

    this.phase.textContent = describePhase(state);
    this.meta.textContent =
      `${state.roomName} · ${state.roomId} · ${playlistLabel(state.teamSize)} · Round ${Math.max(1, state.roundNumber || 1)}`;
    this.score.textContent = `${state.score.team0} - ${state.score.team1}`;
    this.teamSizeSelect.value = String(state.teamSize);

    this.readyButton.disabled = !self || !isLobby;
    this.readyButton.textContent = self?.ready ? "Cancel Ready" : "Ready Check";
    this.switchTeamButton.disabled = !self || !isLobby;
    this.switchTeamButton.textContent = state.selfTeam === 0 ? "Move To Magenta" : "Move To Cyan";
    this.fillBotsButton.disabled = !isLobby;
    this.fillBotsButton.textContent = "Fill Lobby";
    this.clearBotsButton.disabled = !isLobby;
    this.clearBotsButton.textContent = "Humans Only";
    this.settingsButton.disabled = false;
    this.settingsButton.textContent = "Settings";
    this.teamSizeSelect.disabled = !isLobby;

    this.playlistCard.innerHTML = renderSummaryCard(
      "playlist",
      playlistLabel(state.teamSize),
      state.phase === "LOBBY"
        ? "Choose the playlist size before the ready check starts."
        : "Playlist is locked while the round cycle is active.",
    );
    this.queueCard.innerHTML = renderSummaryCard(
      "queue",
      `${readyHumans}/${counts.humans} ready`,
      describeQueueState(state, counts.humans),
    );
    this.teamCard.innerHTML = renderSummaryCard(
      "seat",
      selfTeamLabel,
      `Cyan ${counts.team0}/${state.teamSize} · Magenta ${counts.team1}/${state.teamSize}`,
    );

    if (state.phase === "COUNTDOWN") {
      this.setStatus(`Ready check passed. Deployment in ${Math.ceil(state.countdownRemaining)}...`, "info");
    } else if (state.phase === "PLAYING") {
      this.setStatus(`Round live. ${formatLobbyTime(state.roundTimeRemaining)} remaining.`, "info");
    } else if (state.phase === "ROUND_END") {
      this.setStatus("Round complete. Rebuilding the arena for the next point...", "info");
    } else if (state.matchComplete) {
      this.setStatus("Match complete. Review the debrief, then ready up to launch the next match.", "info");
    } else {
      this.setStatus("Connected. Form up, balance the squads, and lock ready when both sides are full.", "info");
    }

    const team0Members = state.members.filter((member) => member.team === 0);
    const team1Members = state.members.filter((member) => member.team === 1);

    this.team0Title.textContent = "Cyan squad";
    this.team0Relation.textContent = getTeamRelationLabel(state.selfTeam, 0);
    this.team1Title.textContent = "Magenta squad";
    this.team1Relation.textContent = getTeamRelationLabel(state.selfTeam, 1);
    this.team0Count.textContent = `${team0Members.length}/${state.teamSize} queued`;
    this.team1Count.textContent = `${team1Members.length}/${state.teamSize} queued`;
    this.team0Roster.innerHTML = renderRoster(team0Members, state.sessionId, 0);
    this.team1Roster.innerHTML = renderRoster(team1Members, state.sessionId, 1);
    void this.renderInvite(state);
  }

  private getSelf(state: MultiplayerRoomSnapshot) {
    return state.members.find((member) => member.id === state.sessionId) ?? null;
  }

  private async renderInvite(state: MultiplayerRoomSnapshot): Promise<void> {
    const inviteUrl = buildInviteUrl(state.roomId, window.location.origin, window.location.pathname);
    this.latestInviteUrl = inviteUrl;
    this.inviteUrlInput.value = inviteUrl;
    this.inviteNote.textContent = state.visibility === "private"
      ? "Private lobbies stay off the public room list. Share this URL, the native share sheet, or the QR code to bring other pilots in."
      : "Public lobbies stay visible in the room browser, and this direct invite still drops friends into the same room.";
    this.inviteQrMeta.textContent = `${state.visibility === "private" ? "Private" : "Public"} · ${state.maxPlayers} Max Players`;
    this.copyInviteButton.disabled = false;
    this.shareInviteButton.disabled = false;

    if (this.inviteQrForUrl === inviteUrl && this.inviteQrImage.getAttribute("src")) {
      this.inviteQrCard.classList.remove("ob-mp-qr-card--loading");
      return;
    }
    if (this.inviteQrPendingUrl === inviteUrl) {
      return;
    }

    const requestId = ++this.inviteQrRequestId;
    this.inviteQrPendingUrl = inviteUrl;
    this.inviteQrCard.classList.add("ob-mp-qr-card--loading");

    try {
      const qrSrc = await QRCode.toDataURL(inviteUrl, {
        margin: 1,
        width: 140,
        color: {
          dark: "#06121d",
          light: "#ffffff",
        },
      });
      if (requestId !== this.inviteQrRequestId || this.latestInviteUrl !== inviteUrl) {
        return;
      }
      this.inviteQrForUrl = inviteUrl;
      this.inviteQrImage.src = qrSrc;
      this.inviteQrCard.classList.remove("ob-mp-qr-card--loading");
    } catch {
      if (requestId !== this.inviteQrRequestId || this.latestInviteUrl !== inviteUrl) {
        return;
      }
      this.inviteQrForUrl = "";
      this.inviteQrImage.removeAttribute("src");
      this.inviteQrMeta.textContent = "QR generation unavailable";
      this.inviteQrCard.classList.remove("ob-mp-qr-card--loading");
    } finally {
      if (this.inviteQrPendingUrl === inviteUrl) {
        this.inviteQrPendingUrl = "";
      }
    }
  }

  private async copyInviteUrl(): Promise<void> {
    if (!this.latestInviteUrl || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(this.latestInviteUrl);
      this.setStatus("Invite URL copied to the clipboard.", "info");
    } catch {
      this.setStatus("Copy failed for the invite URL.", "error");
    }
  }

  private async shareInviteUrl(): Promise<void> {
    if (!this.latestInviteUrl) {
      return;
    }

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Orbital Breach Invite",
          text: "Join my Orbital Breach room.",
          url: this.latestInviteUrl,
        });
        this.setStatus("Invite sent through the system share sheet.", "info");
      } catch {
        this.setStatus("Share cancelled or unavailable for this room invite.", "error");
      }
      return;
    }

    await this.copyInviteUrl();
  }

  private query<T extends HTMLElement>(selector: string): T {
    return this.root.querySelector<T>(selector) as T;
  }
}
