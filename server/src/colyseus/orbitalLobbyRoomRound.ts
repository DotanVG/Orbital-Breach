import {
  canStartLobbyRound,
  MULTIPLAYER_COUNTDOWN_SECONDS,
  MULTIPLAYER_ROUND_END_SECONDS,
  MULTIPLAYER_ROUND_SECONDS,
} from "../../../shared/multiplayer";
import type { MatchTeamSize } from "../../../shared/match";
import { findMatchWinner } from "../../../shared/match-flow";
import {
  clearActors,
  resolveOnlineBotCollisions,
  spawnActors,
  tickBots,
  tickStaleHumanActors,
} from "./orbitalLobbyRoomActors";
import {
  getMemberSnapshots,
  refreshRoomMetadata,
  resetLobbyReadiness,
  resetScore,
} from "./orbitalLobbyRoomState";
import { ActorState } from "./state";

const MATCH_POINT_TARGET = 5;
const MATCH_TICK_MS = 50;

type RoundRoomBag = any;

// ponytail: helper modules operate on the existing Room instance bag, upgrade when OrbitalLobbyRoom is replaced by owned services
export function syncLobbyFlow(room: unknown): void {
  const internal = room as RoundRoomBag;
  void refreshRoomMetadata(internal);

  if (internal.state.phase === "ROUND_END") {
    return;
  }

  if (internal.state.phase === "COUNTDOWN") {
    if (!canStartLobbyRound(getMemberSnapshots(internal), internal.state.teamSize as MatchTeamSize)) {
      cancelCountdown(internal);
    }
    return;
  }

  if (
    internal.state.phase === "LOBBY"
    && canStartLobbyRound(getMemberSnapshots(internal), internal.state.teamSize as MatchTeamSize)
  ) {
    startCountdown(internal);
  }
}

export function startCountdown(room: unknown): void {
  const internal = room as RoundRoomBag;
  clearTimers(internal);
  if (internal.state.matchComplete) {
    resetScore(internal);
    internal.state.matchComplete = false;
  }
  prepareCountdownRound(internal);
  internal.state.phase = "COUNTDOWN";
  internal.state.countdownRemaining = MULTIPLAYER_COUNTDOWN_SECONDS;
  void internal.lock();
  void refreshRoomMetadata(internal);

  internal.countdownTimer = setInterval(() => {
    internal.state.countdownRemaining = Math.max(0, internal.state.countdownRemaining - 1);
    if (internal.state.countdownRemaining <= 0) {
      clearCountdownTimer(internal);
      beginRoundPlay(internal);
    }
  }, 1000);
}

export function cancelCountdown(room: unknown): void {
  const internal = room as RoundRoomBag;
  clearCountdownTimer(internal);
  revertPreparedCountdownRound(internal);
  internal.state.phase = "LOBBY";
  internal.state.countdownRemaining = 0;
  internal.state.roundTimeRemaining = 0;
  void internal.unlock();
  void refreshRoomMetadata(internal);
}

export function beginRoundPlay(room: unknown): void {
  const internal = room as RoundRoomBag;
  internal.countdownPreparedRound = false;
  internal.state.phase = "PLAYING";
  internal.state.countdownRemaining = 0;
  internal.state.roundTimeRemaining = MULTIPLAYER_ROUND_SECONDS;
  internal.roundResolved = false;
  void refreshRoomMetadata(internal);

  internal.roundTimer = setInterval(() => {
    internal.state.roundTimeRemaining = Math.max(0, internal.state.roundTimeRemaining - 1);
    if (internal.state.roundTimeRemaining <= 0) {
      clearRoundTimer(internal);
      if (!internal.roundResolved) {
        internal.roundResolved = true;
        internal.broadcast("round_result_event", {
          outcome: "tie",
          winningTeam: null,
          matchWinner: null,
          reason: "timeout",
          scorerName: "Time",
        });
        finishRound(internal, null);
      }
    }
  }, 1000);

  internal.matchTick = setInterval(() => {
    tickBots(internal, MATCH_TICK_MS / 1000);
    tickStaleHumanActors(internal, MATCH_TICK_MS / 1000);
    resolveOnlineBotCollisions(internal);
  }, MATCH_TICK_MS);
}

export function finishRound(room: unknown, matchWinner: 0 | 1 | null): void {
  const internal = room as RoundRoomBag;
  clearRoundTimer(internal);
  clearMatchTick(internal);

  internal.state.phase = "ROUND_END";
  internal.state.countdownRemaining = 0;
  internal.state.roundTimeRemaining = 0;
  void refreshRoomMetadata(internal);

  internal.roundEndTimer = setTimeout(() => {
    internal.roundEndTimer = null;
    internal.countdownPreparedRound = false;

    if (
      matchWinner === null
      && canStartLobbyRound(getMemberSnapshots(internal), internal.state.teamSize as MatchTeamSize)
    ) {
      startCountdown(internal);
      return;
    }

    internal.state.phase = "LOBBY";
    internal.state.countdownRemaining = 0;
    internal.state.roundTimeRemaining = 0;
    if (matchWinner !== null) {
      internal.state.matchComplete = true;
      resetLobbyReadiness(internal);
      internal.broadcast("lobby_event", {
        type: "info",
        text: "Match complete. Review the debrief, then ready up to start the next one.",
      });
    }
    void internal.unlock();
    void refreshRoomMetadata(internal);
    syncLobbyFlow(internal);
  }, MULTIPLAYER_ROUND_END_SECONDS * 1000);
}

export function checkFullFreezeWin(room: unknown): void {
  const internal = room as RoundRoomBag;
  if (internal.roundResolved || internal.state.phase !== "PLAYING") return;

  const actors = Array.from(internal.state.actors.values()) as ActorState[];
  const team0 = actors.filter((actor) => actor.team === 0);
  const team1 = actors.filter((actor) => actor.team === 1);
  if (team0.length === 0 || team1.length === 0) return;

  if (team0.every((actor) => actor.frozen)) {
    awardOnlineRoundPoint(internal, 1, null, "Magenta Team", "fullFreeze");
  } else if (team1.every((actor) => actor.frozen)) {
    awardOnlineRoundPoint(internal, 0, null, "Cyan Team", "fullFreeze");
  }
}

export function checkTeamDisconnectWin(room: unknown): void {
  const internal = room as RoundRoomBag;
  if (internal.roundResolved || internal.state.phase !== "PLAYING") return;

  const actors = Array.from(internal.state.actors.values()) as ActorState[];
  const team0HumanActive = actors.some((actor) => actor.team === 0 && !actor.isBot);
  const team1HumanActive = actors.some((actor) => actor.team === 1 && !actor.isBot);

  if (team0HumanActive === team1HumanActive) return;

  const winningTeam = team0HumanActive ? 0 : 1;
  awardOnlineRoundPoint(
    internal,
    winningTeam,
    null,
    winningTeam === 0 ? "Cyan Team" : "Magenta Team",
    "disconnect",
  );
}

export function awardOnlineRoundPoint(
  room: unknown,
  team: 0 | 1,
  scorerId: string | null,
  scorerName: string,
  reason: "breach" | "fullFreeze" | "disconnect",
): void {
  const internal = room as RoundRoomBag;
  if (internal.roundResolved) return;
  internal.roundResolved = true;

  if (team === 0) {
    internal.state.scoreTeam0 += 1;
  } else {
    internal.state.scoreTeam1 += 1;
  }

  const matchWinner = findMatchWinner(
    {
      team0: internal.state.scoreTeam0,
      team1: internal.state.scoreTeam1,
    },
    MATCH_POINT_TARGET,
  );

  const resultEvent: any = {
    outcome: "win",
    winningTeam: team,
    matchWinner,
    reason,
    scorerId: scorerId ?? undefined,
    scorerName,
  };
  if (matchWinner !== null) {
    resultEvent.finalScore = {
      team0: internal.state.scoreTeam0,
      team1: internal.state.scoreTeam1,
    };
  }
  internal.broadcast("round_result_event", resultEvent);

  setTimeout(() => {
    finishRound(internal, matchWinner);
  }, 3000);
}

export function clearTimers(room: unknown): void {
  const internal = room as RoundRoomBag;
  clearCountdownTimer(internal);
  clearRoundTimer(internal);
  clearMatchTick(internal);
  if (internal.roundEndTimer) {
    clearTimeout(internal.roundEndTimer);
    internal.roundEndTimer = null;
  }
}

export function cancelRoundFlow(room: unknown): void {
  const internal = room as RoundRoomBag;
  clearTimers(internal);
  internal.countdownPreparedRound = false;
}

function prepareCountdownRound(room: RoundRoomBag): void {
  room.state.roundNumber += 1;
  room.state.roundTimeRemaining = MULTIPLAYER_ROUND_SECONDS;
  room.roundResolved = false;
  room.countdownPreparedRound = true;
  spawnActors(room);
}

function revertPreparedCountdownRound(room: RoundRoomBag): void {
  if (!room.countdownPreparedRound) return;
  room.countdownPreparedRound = false;
  room.state.roundNumber = Math.max(0, room.state.roundNumber - 1);
  clearActors(room);
}

function clearCountdownTimer(room: RoundRoomBag): void {
  if (room.countdownTimer) {
    clearInterval(room.countdownTimer);
    room.countdownTimer = null;
  }
}

function clearRoundTimer(room: RoundRoomBag): void {
  if (room.roundTimer) {
    clearInterval(room.roundTimer);
    room.roundTimer = null;
  }
}

function clearMatchTick(room: RoundRoomBag): void {
  if (room.matchTick) {
    clearInterval(room.matchTick);
    room.matchTick = null;
  }
}
