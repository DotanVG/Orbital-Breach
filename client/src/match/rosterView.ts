import type { EnemyPlayerInfo, FullPlayerInfo, PlayerPhase } from "../../../shared/schema";

export interface RosterActor {
  id: string;
  name: string;
  team: 0 | 1;
  isBot: boolean;
  kills: number;
  deaths: number;
  phase: PlayerPhase;
  frozen: boolean;
  ping?: number;
}

export interface HudRosters {
  ownTeam: FullPlayerInfo[];
  enemyTeam: EnemyPlayerInfo[];
}

export function buildHudRosters(
  localActorId: string,
  localTeam: 0 | 1,
  actors: RosterActor[],
): HudRosters {
  const sorted = [...actors].sort((a, b) => {
    if (a.team !== b.team) return a.team - b.team;

    const aIsLocal = a.id === localActorId;
    const bIsLocal = b.id === localActorId;
    if (aIsLocal !== bIsLocal) return aIsLocal ? -1 : 1;

    if (a.isBot !== b.isBot) return a.isBot ? 1 : -1;
    if (a.kills !== b.kills) return b.kills - a.kills;
    if (a.deaths !== b.deaths) return a.deaths - b.deaths;
    return a.name.localeCompare(b.name);
  });

  const ownTeam = sorted
    .filter((actor) => actor.team === localTeam)
    .map<FullPlayerInfo>((actor) => ({
      id: actor.id,
      name: actor.name,
      frozen: actor.frozen || actor.phase === "FROZEN",
      kills: actor.kills,
      deaths: actor.deaths,
      ping: actor.ping ?? 0,
      isBot: actor.isBot,
    }));

  const enemyTeam = sorted
    .filter((actor) => actor.team !== localTeam)
    .map<EnemyPlayerInfo>((actor) => ({
      id: actor.id,
      name: actor.name,
      kills: actor.kills,
      deaths: actor.deaths,
      ping: actor.ping ?? 0,
      isBot: actor.isBot,
    }));

  return { ownTeam, enemyTeam };
}
