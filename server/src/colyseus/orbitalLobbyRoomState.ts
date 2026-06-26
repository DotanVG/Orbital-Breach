import {
  buildBotName,
  getPreferredJoinTeam,
  type LobbyTeam,
  type MultiplayerRoomListing,
  type MultiplayerRoomPhase,
  type MultiplayerRoomVisibility,
} from "../../../shared/multiplayer";
import type { MatchTeamSize } from "../../../shared/match";
import type { OrbitalRoomMetadata } from "./roomDirectory";
import { LobbyMemberState } from "./state";

type LobbyRoomStateBag = any;

// ponytail: helper modules operate on the existing Room instance bag, upgrade when OrbitalLobbyRoom is replaced by owned services
export function getHumanMembers(room: unknown): LobbyMemberState[] {
  const state = (room as LobbyRoomStateBag).state;
  const members = Array.from(state.members.values()) as LobbyMemberState[];
  return members.filter((member) => !member.isBot);
}

export function getMemberSnapshots(room: unknown): Array<{
  id: string;
  name: string;
  team: LobbyTeam;
  ready: boolean;
  connected: boolean;
  isBot: boolean;
}> {
  const state = (room as LobbyRoomStateBag).state;
  const members = Array.from(state.members.values()) as LobbyMemberState[];
  return members.map((member) => ({
    id: member.id,
    name: member.name,
    team: member.team,
    ready: member.ready,
    connected: member.connected,
    isBot: member.isBot,
  }));
}

export function ensureSeatForHuman(room: unknown, team: LobbyTeam): boolean {
  const internal = room as LobbyRoomStateBag;
  const teamMembers = (Array.from(internal.state.members.values()) as LobbyMemberState[]).filter(
    (member) => member.team === team,
  );
  if (teamMembers.length < internal.state.teamSize) {
    return true;
  }

  const removableBot = teamMembers.find((member: LobbyMemberState) => member.isBot);
  if (!removableBot) {
    return false;
  }

  internal.state.members.delete(removableBot.id);
  internal.state.actors.delete(removableBot.id);
  internal.bots.remove(removableBot.id);
  internal.lastPlayerUpdate.delete(removableBot.id);
  return true;
}

export function getJoinTeamForHuman(room: unknown): LobbyTeam | null {
  const preferredTeam = getPreferredJoinTeam(getMemberSnapshots(room));
  if (hasSeatForHuman(room, preferredTeam)) {
    return preferredTeam;
  }

  const fallbackTeam = preferredTeam === 0 ? 1 : 0;
  return hasSeatForHuman(room, fallbackTeam) ? fallbackTeam : null;
}

export function hasSeatForHuman(room: unknown, team: LobbyTeam): boolean {
  const state = (room as LobbyRoomStateBag).state;
  const teamMembers = (Array.from(state.members.values()) as LobbyMemberState[]).filter(
    (member) => member.team === team,
  );
  return teamMembers.length < state.teamSize || teamMembers.some((member) => member.isBot);
}

export function fillBotsToLobbySize(room: unknown): void {
  fillTeamWithBots(room, 0);
  fillTeamWithBots(room, 1);
}

export function trimBotsToTeamSize(room: unknown): void {
  trimTeamBots(room, 0);
  trimTeamBots(room, 1);
}

export function removeAllBots(room: unknown): void {
  const state = (room as LobbyRoomStateBag).state;
  for (const member of Array.from(state.members.values()) as LobbyMemberState[]) {
    if (member.isBot) {
      state.members.delete(member.id);
    }
  }
}

export function hasHumanMembers(room: unknown): boolean {
  return getHumanMembers(room).length > 0;
}

export function resetLobbyReadiness(room: unknown): void {
  const state = (room as LobbyRoomStateBag).state;
  for (const member of state.members.values() as Iterable<LobbyMemberState>) {
    member.ready = false;
  }
}

export function resetScore(room: unknown): void {
  const state = (room as LobbyRoomStateBag).state;
  state.scoreTeam0 = 0;
  state.scoreTeam1 = 0;
  state.roundNumber = 0;
}

export function sendInfo(client: { send: (type: string, payload: object) => void }, text: string): void {
  client.send("lobby_event", { type: "info", text });
}

export function sendError(client: { send: (type: string, payload: object) => void }, text: string): void {
  client.send("lobby_event", { type: "error", text });
}

export async function refreshRoomMetadata(room: unknown): Promise<void> {
  const internal = room as LobbyRoomStateBag;
  const metadata: OrbitalRoomMetadata = {
    roomName: internal.state.roomName,
    listing: internal.listing as MultiplayerRoomListing,
    visibility: internal.visibility as MultiplayerRoomVisibility,
    phase: internal.state.phase as MultiplayerRoomPhase,
    currentPlayers: internal.state.members.size,
    maxPlayers: internal.state.maxPlayers,
    teamSize: internal.state.teamSize as MatchTeamSize,
  };

  await internal.setMetadata(metadata);
}

function fillTeamWithBots(room: unknown, team: LobbyTeam): void {
  const internal = room as LobbyRoomStateBag;
  const state = internal.state;
  const teamMembers = (Array.from(state.members.values()) as LobbyMemberState[]).filter(
    (member) => member.team === team,
  );
  const missing = Math.max(0, state.teamSize - teamMembers.length);
  for (let index = 0; index < missing; index += 1) {
    const bot = new LobbyMemberState();
    const botId = `bot-${team}-${internal.botCounters[team]}`;
    bot.id = botId;
    bot.sessionId = "";
    bot.name = buildBotName(internal.botCounters[team], team);
    bot.team = team;
    bot.ready = false;
    bot.connected = true;
    bot.isBot = true;
    state.members.set(botId, bot);
    internal.botCounters[team] += 1;
  }
}

function trimTeamBots(room: unknown, team: LobbyTeam): void {
  const state = (room as LobbyRoomStateBag).state;
  const teamMembers = (Array.from(state.members.values()) as LobbyMemberState[]).filter(
    (member) => member.team === team,
  );
  let overflow = Math.max(0, teamMembers.length - state.teamSize);
  if (overflow <= 0) {
    return;
  }

  for (const member of teamMembers as LobbyMemberState[]) {
    if (!member.isBot) {
      continue;
    }

    state.members.delete(member.id);
    overflow -= 1;
    if (overflow <= 0) {
      break;
    }
  }
}
