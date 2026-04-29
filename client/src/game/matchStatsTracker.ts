import type { DebriefAward, DebriefPlayer } from "../ui/debrief";

export interface ObservedMatchPlayer {
  id: string;
  name: string;
  team: 0 | 1;
  isBot: boolean;
  isSelf: boolean;
  freezes: number;
  frozen: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
}

interface TrackedMatchPlayer extends DebriefPlayer {
  lastPosition: {
    x: number;
    y: number;
    z: number;
  };
}

const METERS_PER_WORLD_UNIT = 1;

export class MatchStatsTracker {
  private readonly players = new Map<string, TrackedMatchPlayer>();

  public reset(): void {
    this.players.clear();
  }

  public recordBreach(playerId: string | null | undefined): void {
    if (!playerId) return;
    const player = this.players.get(playerId);
    if (!player) return;
    player.breaches += 1;
  }

  public observePlayers(
    players: ObservedMatchPlayer[],
    options: { accumulateTravel: boolean },
  ): void {
    for (const incoming of players) {
      const tracked = this.ensurePlayer(incoming);

      tracked.name = incoming.name;
      tracked.team = incoming.team;
      tracked.isBot = incoming.isBot;
      tracked.isSelf = incoming.isSelf;
      tracked.freezes = Math.max(tracked.freezes, incoming.freezes);
      tracked.frozen = Math.max(tracked.frozen, incoming.frozen);

      if (options.accumulateTravel) {
        tracked.travelDistance += distanceBetween(tracked.lastPosition, incoming.position);
      }

      tracked.lastPosition = { ...incoming.position };
    }
  }

  public buildPlayers(): DebriefPlayer[] {
    return Array.from(this.players.values()).map((player) => ({
      id: player.id,
      name: player.name,
      team: player.team,
      breaches: player.breaches,
      freezes: player.freezes,
      frozen: player.frozen,
      travelDistance: player.travelDistance,
      isBot: player.isBot,
      isSelf: player.isSelf,
    }));
  }

  public buildAwards(): DebriefAward[] {
    return buildDebriefAwards(this.buildPlayers());
  }

  private ensurePlayer(player: ObservedMatchPlayer): TrackedMatchPlayer {
    const existing = this.players.get(player.id);
    if (existing) {
      return existing;
    }

    const tracked: TrackedMatchPlayer = {
      id: player.id,
      name: player.name,
      team: player.team,
      breaches: 0,
      freezes: Math.max(0, player.freezes),
      frozen: Math.max(0, player.frozen),
      travelDistance: 0,
      isBot: player.isBot,
      isSelf: player.isSelf,
      lastPosition: { ...player.position },
    };
    this.players.set(player.id, tracked);
    return tracked;
  }
}

export function buildDebriefAwards(players: DebriefPlayer[]): DebriefAward[] {
  const awards: DebriefAward[] = [];
  const humans = players.filter((player) => !player.isBot);

  const breachLeader = pickBestPlayer(
    players,
    (candidate, currentBest) =>
      candidate.breaches > currentBest.breaches
      || (
        candidate.breaches === currentBest.breaches
        && candidate.freezes > currentBest.freezes
      ),
  );
  if (breachLeader && breachLeader.breaches > 0) {
    awards.push({
      key: "Portal Ace",
      value: breachLeader.name,
      note: `${breachLeader.breaches} breaches scored`,
    });
  }

  const freezeLeader = pickBestPlayer(
    players,
    (candidate, currentBest) =>
      candidate.freezes > currentBest.freezes
      || (
        candidate.freezes === currentBest.freezes
        && candidate.breaches > currentBest.breaches
      ),
  );
  if (freezeLeader && freezeLeader.freezes > 0) {
    awards.push({
      key: "Deep Freeze",
      value: freezeLeader.name,
      note: `${freezeLeader.freezes} freezes landed`,
    });
  }

  const ironPilot = pickBestPlayer(
    humans.filter((player) => player.frozen === 0),
    (candidate, currentBest) =>
      playerImpactScore(candidate) > playerImpactScore(currentBest),
  );
  if (ironPilot) {
    awards.push({
      key: "Iron Pilot",
      value: ironPilot.name,
      note: "no freezes taken",
    });
  }

  const moonWalker = pickBestPlayer(
    players,
    (candidate, currentBest) => candidate.travelDistance > currentBest.travelDistance,
  );
  if (moonWalker && moonWalker.travelDistance > 0) {
    awards.push({
      key: "Moon Walker",
      value: moonWalker.name,
      note: `${formatTravelDistance(moonWalker.travelDistance)} travelled`,
    });
  }

  if (awards.length === 0) {
    awards.push({
      key: "Round Complete",
      value: "-",
      note: "match concluded",
    });
  }

  return awards;
}

function pickBestPlayer(
  players: DebriefPlayer[],
  isBetter: (candidate: DebriefPlayer, currentBest: DebriefPlayer) => boolean,
): DebriefPlayer | null {
  let best: DebriefPlayer | null = null;
  for (const player of players) {
    if (!best || isBetter(player, best)) {
      best = player;
    }
  }
  return best;
}

function playerImpactScore(player: DebriefPlayer): number {
  return player.breaches * 5 + player.freezes * 3 + player.travelDistance * 0.05;
}

function distanceBetween(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) * METERS_PER_WORLD_UNIT;
}

function formatTravelDistance(distance: number): string {
  return `${distance.toFixed(distance >= 100 ? 0 : 1)}m`;
}
