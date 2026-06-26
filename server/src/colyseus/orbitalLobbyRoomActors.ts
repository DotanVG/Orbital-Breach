import {
  ACTOR_COLLISION_RADIUS,
  BREACH_ROOM_H,
  MAX_SPEED,
  PLAYER_RADIUS,
} from "../../../shared/constants";
import type {
  FreezeEventMessage,
  HitReportMessage,
  PlayerUpdateMessage,
  ShotEventMessage,
} from "../../../shared/multiplayer";
import {
  generateSpawnPositions,
  resolveActorCollisions,
  type CollisionBody,
  type HitZone,
} from "../../../shared/player-logic";
import { generateArenaLayout } from "../../../shared/arena-gen";
import { applyHitToOnlineActor, isHitZone, normalizeAuthoritativePhase } from "./actorDamage";
import {
  bounceActorInArena,
  integrateZeroGActor,
  isActorInEnemyBreachRoom,
  isHitReportDistancePlausible,
  shouldServerSimulateHumanActor,
} from "./onlineActorSimulation";
import { ActorState } from "./state";
import { breachExitYaw, clampFinite, makeServerArenaQuery, normalizeDirection, POS_CLAMP } from "./orbitalLobbyRoomUtils";

const BOT_RESPAWN_SECONDS = 5;
const MAX_KILLS = 9999;
const VEL_CLAMP = MAX_SPEED * 4;
const PLAYER_UPDATE_MIN_MS = 40;

type ActorRoomBag = any;

// ponytail: helper modules operate on the existing Room instance bag, upgrade when OrbitalLobbyRoom is replaced by owned services
export function handlePlayerUpdateMessage(
  room: unknown,
  client: { sessionId: string },
  message: PlayerUpdateMessage,
): void {
  const internal = room as ActorRoomBag;
  if (internal.state.phase !== "PLAYING" && internal.state.phase !== "ROUND_END") return;
  const actor = internal.state.actors.get(client.sessionId);
  if (!actor || actor.isBot) return;

  const now = Date.now();
  const last = internal.lastPlayerUpdate.get(client.sessionId) ?? 0;
  if (now - last < PLAYER_UPDATE_MIN_MS) return;
  internal.lastPlayerUpdate.set(client.sessionId, now);

  actor.posX = clampFinite(Number(message.posX), -POS_CLAMP, POS_CLAMP);
  actor.posY = clampFinite(Number(message.posY), -POS_CLAMP, POS_CLAMP);
  actor.posZ = clampFinite(Number(message.posZ), -POS_CLAMP, POS_CLAMP);
  actor.velX = clampFinite(Number(message.velX), -VEL_CLAMP, VEL_CLAMP);
  actor.velY = clampFinite(Number(message.velY), -VEL_CLAMP, VEL_CLAMP);
  actor.velZ = clampFinite(Number(message.velZ), -VEL_CLAMP, VEL_CLAMP);
  actor.yaw = clampFinite(Number(message.yaw), -Math.PI * 2, Math.PI * 2);
  const rawPhase = String(message.phase ?? "");
  const prevPhase = actor.phase;
  actor.phase = normalizeAuthoritativePhase(rawPhase, actor);
  if (actor.phase === "BREACH" && prevPhase !== "BREACH") {
    actor.leftArm = false;
    actor.rightArm = false;
    actor.leftLeg = false;
    actor.rightLeg = false;
  }

  if (
    internal.state.phase === "PLAYING"
    && !internal.roundResolved
    && !actor.frozen
    && isActorInEnemyBreachRoom(actor, internal.botGoalAxis, internal.botGoalSigns)
  ) {
    actor.phase = "BREACH";
    internal.awardOnlineRoundPoint(actor.team, actor.id, actor.name, "breach");
  }
}

export function handleShotEventMessage(
  room: unknown,
  client: { sessionId: string },
  message: ShotEventMessage,
): void {
  const internal = room as ActorRoomBag;
  if (internal.state.phase !== "PLAYING" || internal.roundResolved) return;

  const actor = internal.state.actors.get(client.sessionId);
  if (!actor || actor.frozen || actor.rightArm || actor.phase === "RESPAWNING") return;

  const direction = normalizeDirection(
    Number(message.dirX),
    Number(message.dirY),
    Number(message.dirZ),
  );
  if (!direction) return;

  const shotEvent: ShotEventMessage = {
    ownerId: actor.id,
    team: actor.team,
    originX: clampFinite(Number(message.originX), -POS_CLAMP, POS_CLAMP),
    originY: clampFinite(Number(message.originY), -POS_CLAMP, POS_CLAMP),
    originZ: clampFinite(Number(message.originZ), -POS_CLAMP, POS_CLAMP),
    dirX: direction.x,
    dirY: direction.y,
    dirZ: direction.z,
  };
  internal.broadcast("shot_event", shotEvent);
}

export function handleHitReportMessage(
  room: unknown,
  client: { sessionId: string },
  message: HitReportMessage,
): void {
  const internal = room as ActorRoomBag;
  if (internal.state.phase !== "PLAYING" || internal.roundResolved) return;

  const shooter = internal.state.actors.get(client.sessionId);
  if (!shooter || shooter.frozen || shooter.rightArm || shooter.phase === "RESPAWNING") return;

  const targetId = String(message.targetId ?? "").slice(0, 64);
  const target = internal.state.actors.get(targetId);
  if (!target || target.frozen || target.team === shooter.team) return;
  if (!isHitZone(message.zone)) return;
  if (!isHitReportDistancePlausible(shooter, target)) return;

  if (freezeActorFromShot(internal, shooter, target, message.zone)) {
    internal.checkFullFreezeWin();
  }
}

export function handleBreachReportMessage(
  room: unknown,
  client: { sessionId: string },
): void {
  const internal = room as ActorRoomBag;
  if (internal.state.phase !== "PLAYING" || internal.roundResolved) return;

  const actor = internal.state.actors.get(client.sessionId);
  if (!actor || actor.frozen) return;
  if (!isActorInEnemyBreachRoom(actor, internal.botGoalAxis, internal.botGoalSigns)) return;

  actor.phase = "BREACH";
  internal.awardOnlineRoundPoint(actor.team, actor.id, actor.name, "breach");
}

export function spawnActors(room: unknown): void {
  const internal = room as ActorRoomBag;
  clearActors(internal);

  const layout = generateArenaLayout(internal.state.roundNumber);
  const { goalAxis, goalSigns } = layout;
  internal.botGoalAxis = goalAxis as "x" | "z";
  internal.botGoalSigns = goalSigns;

  const openSign0 = (-goalSigns.team0) as 1 | -1;
  const openSign1 = (-goalSigns.team1) as 1 | -1;
  internal.botSpawnYaw[0] = breachExitYaw(goalAxis, openSign0);
  internal.botSpawnYaw[1] = breachExitYaw(goalAxis, openSign1);

  const arenaQuery = makeServerArenaQuery(goalAxis, goalSigns);
  const roundSeed = internal.state.roundNumber;
  const memberList = Array.from(internal.state.members.values()) as Array<{ team: 0 | 1 }>;
  const team0Count = memberList.filter((member) => member.team === 0).length;
  const team1Count = memberList.filter((member) => member.team === 1).length;
  const slots0 = generateSpawnPositions(0, team0Count, arenaQuery, roundSeed * 11 + 7);
  const slots1 = generateSpawnPositions(1, team1Count, arenaQuery, roundSeed * 17 + 13);
  const center0 = arenaQuery.getBreachRoomCenter(0);
  const center1 = arenaQuery.getBreachRoomCenter(1);
  const floorY0 = center0.y - BREACH_ROOM_H / 2 + PLAYER_RADIUS + 0.08;
  const floorY1 = center1.y - BREACH_ROOM_H / 2 + PLAYER_RADIUS + 0.08;

  let team0Index = 0;
  let team1Index = 0;

  for (const member of internal.state.members.values()) {
    const actor = new ActorState();
    actor.id = member.id;
    actor.name = member.name;
    actor.team = member.team;
    actor.isBot = member.isBot;
    actor.phase = "BREACH";
    actor.frozen = false;
    actor.leftArm = false;
    actor.rightArm = false;
    actor.leftLeg = false;
    actor.rightLeg = false;
    actor.kills = 0;
    actor.deaths = 0;
    actor.yaw = internal.botSpawnYaw[member.team];

    if (member.team === 0) {
      const slot = slots0[team0Index] ?? slots0[slots0.length - 1] ?? center0;
      actor.posX = slot.x;
      actor.posY = floorY0;
      actor.posZ = slot.z;
      team0Index += 1;
    } else {
      const slot = slots1[team1Index] ?? slots1[slots1.length - 1] ?? center1;
      actor.posX = slot.x;
      actor.posY = floorY1;
      actor.posZ = slot.z;
      team1Index += 1;
    }

    if (member.isBot) {
      internal.bots.registerBot(member.id);
    }

    internal.state.actors.set(member.id, actor);
  }
}

export function clearActors(room: unknown): void {
  const internal = room as ActorRoomBag;
  internal.state.actors.clear();
  internal.bots.clear();
  internal.lastPlayerUpdate.clear();
}

export function removePresence(room: unknown, id: string): void {
  const internal = room as ActorRoomBag;
  internal.state.actors.delete(id);
  internal.bots.remove(id);
  internal.lastPlayerUpdate.delete(id);
}

export function tickBots(room: unknown, dt: number): void {
  const internal = room as ActorRoomBag;
  if (internal.state.phase !== "PLAYING") return;
  internal.bots.tick(
    dt,
    internal.state.actors.values(),
    internal.botGoalAxis,
    internal.botGoalSigns,
    internal.botHooks,
  );
}

export function tickStaleHumanActors(room: unknown, dt: number): void {
  const internal = room as ActorRoomBag;
  if (internal.state.phase !== "PLAYING") return;

  const now = Date.now();
  for (const actor of internal.state.actors.values() as Iterable<ActorState>) {
    const lastUpdate = internal.lastPlayerUpdate.get(actor.id) ?? now;
    if (!shouldServerSimulateHumanActor(actor, now - lastUpdate)) {
      continue;
    }

    integrateZeroGActor(actor, dt);
    bounceActorInArena(actor, internal.botGoalAxis);

    if (
      !internal.roundResolved
      && isActorInEnemyBreachRoom(actor, internal.botGoalAxis, internal.botGoalSigns)
    ) {
      actor.phase = "BREACH";
      internal.awardOnlineRoundPoint(actor.team, actor.id, actor.name, "breach");
    }
  }
}

export function resolveOnlineBotCollisions(room: unknown): void {
  const internal = room as ActorRoomBag;
  if (internal.state.phase !== "PLAYING") return;

  const bodies: Array<CollisionBody & { id: string; isBot: boolean }> = [];
  for (const actor of internal.state.actors.values() as Iterable<ActorState>) {
    if (actor.frozen) continue;
    bodies.push({
      id: actor.id,
      isBot: actor.isBot,
      pos: { x: actor.posX, y: actor.posY, z: actor.posZ },
      vel: actor.isBot ? { x: actor.velX, y: actor.velY, z: actor.velZ } : undefined,
      radius: ACTOR_COLLISION_RADIUS,
      anchored: !actor.isBot,
    });
  }
  if (bodies.length < 2) return;
  resolveActorCollisions(bodies);
  for (const body of bodies) {
    if (!body.isBot) continue;
    const actor = internal.state.actors.get(body.id);
    if (!actor) continue;
    actor.posX = body.pos.x;
    actor.posY = body.pos.y;
    actor.posZ = body.pos.z;
    if (body.vel) {
      actor.velX = body.vel.x;
      actor.velY = body.vel.y;
      actor.velZ = body.vel.z;
    }
  }
}

export function freezeActorFromShot(
  room: unknown,
  shooter: ActorState,
  target: ActorState,
  zone: HitZone,
): boolean {
  const internal = room as ActorRoomBag;
  if (target.isBot) {
    target.frozen = true;
    target.phase = "FROZEN";
    target.deaths += 1;
  } else {
    const frozen = applyHitToOnlineActor(target, zone);
    if (!frozen) {
      return false;
    }
  }

  target.frozenTimer = BOT_RESPAWN_SECONDS;
  shooter.kills = Math.min(MAX_KILLS, shooter.kills + 1);

  const freezeEvent: FreezeEventMessage = {
    targetId: target.id,
    killerName: shooter.name,
    killerTeam: shooter.team,
    victimName: target.name,
    victimTeam: target.team,
  };
  internal.broadcast("freeze_event", freezeEvent);
  return true;
}
