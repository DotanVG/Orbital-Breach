import { HITBOX_OFFSET_Y, HITBOX_RADIUS } from "../../../shared/constants";
import { FEATURE_FLAGS } from "../featureFlags";
import type { ProjectileHitEvent } from "../match/localMatch";
import {
  applyCameraAndGun,
  computeNearBar,
  tickCameraLook,
  updateMobileHudControls,
  type GameTickContext,
} from "./tickContext";
import { buildShotFromCamera } from "./weaponFire";

const PLAYER_UPDATE_RATE = 0.05; // 20hz

/** Per-frame update for online (Colyseus) gameplay. */
export function tickOnlineGame(ctx: GameTickContext, dt: number): void {
  tickCameraLook(ctx, dt);

  ctx.input.updateFireCooldown(dt);
  ctx.player.update(ctx.input, ctx.cam, ctx.arena, dt);
  ctx.arena.update(dt);

  ctx.onlineMatch.update(dt);

  tickOnlineWeaponFire(ctx);

  const localActorId = ctx.getOnlineLocalActorId();
  const localCentre = ctx.player.getPosition().clone();
  localCentre.y += HITBOX_OFFSET_Y;
  const localTarget = {
    active: ctx.player.phase !== "RESPAWNING" && ctx.player.phase !== "BREACH" && !ctx.player.damage.frozen,
    id: localActorId,
    pos: localCentre,
    radius: HITBOX_RADIUS,
    team: ctx.player.team,
  };
  const allTargets = [localTarget, ...ctx.onlineMatch.getProjectileTargets()];

  ctx.projectiles.update(
    dt,
    ctx.arena.getObstacleBulletAABBs(),
    ctx.arena.getPortalBarrierAABBs(),
    allTargets,
    (hitPos, color) => ctx.arena.triggerPortalImpact(hitPos, color),
    (hit) => handleOnlineProjectileHit(ctx, hit),
  );

  checkOnlineBreachScore(ctx);
  ctx.debugOverlays.tickCollisionVis(ctx.input, () => ctx.match.getMatchStatsActors(ctx.player));

  ctx.playerUpdateTimer -= dt;
  if (ctx.playerUpdateTimer <= 0) {
    ctx.playerUpdateTimer = PLAYER_UPDATE_RATE;
    sendOnlinePlayerUpdate(ctx);
  }

  if (FEATURE_FLAGS.thirdPersonLookBehind && ctx.input.consumeThirdPersonToggle()) {
    ctx.toggleCameraView();
  }

  applyCameraAndGun(ctx, dt);
  updateOnlineHud(ctx, dt);
}

function tickOnlineWeaponFire(ctx: GameTickContext): void {
  const inZeroG = ctx.player.phase === "FLOATING"
    || ctx.player.phase === "GRABBING"
    || ctx.player.phase === "AIMING";

  if (!ctx.onlineGameActive || !ctx.onlineRoundActive) return;
  if (!ctx.input.canControlGame() || !inZeroG) return;
  if (!ctx.player.canFire() || !ctx.input.consumeFire()) return;

  const useThirdPersonMuzzle = ctx.thirdPerson
    || (FEATURE_FLAGS.thirdPersonLookBehind && ctx.input.isSelfieHeld());
  const shot = buildShotFromCamera(ctx.player, ctx.cam, ctx.gun, useThirdPersonMuzzle);
  if (!shot) return;

  const localActorId = ctx.getOnlineLocalActorId();
  ctx.projectiles.spawn(shot.origin, shot.direction, ctx.player.team, localActorId);
  ctx.sound.playLocalShot();
  ctx.net.sendShot({
    ownerId: localActorId,
    team: ctx.player.team,
    originX: shot.origin.x,
    originY: shot.origin.y,
    originZ: shot.origin.z,
    dirX: shot.direction.x,
    dirY: shot.direction.y,
    dirZ: shot.direction.z,
  });
  ctx.player.triggerArmRecoil();
  ctx.tutorial.noteShotFired();
}

function handleOnlineProjectileHit(ctx: GameTickContext, hit: ProjectileHitEvent): void {
  const localActorId = ctx.getOnlineLocalActorId();
  if (hit.targetId === localActorId) {
    return;
  }

  if (hit.ownerId === localActorId) {
    const zone = ctx.onlineMatch.classifyHitZone(hit.targetId, hit.impactPoint);
    if (!zone) return;
    ctx.net.sendHitReport({
      targetId: hit.targetId,
      zone,
      impX: 0,
      impY: 0,
      impZ: 0,
    });
    ctx.hud.triggerHitConfirm(ctx.player.team);
  }
}

function checkOnlineBreachScore(ctx: GameTickContext): void {
  if (!ctx.onlineGameActive) return;
  if (ctx.onlineBreachReported || ctx.player.damage.frozen) return;
  if (ctx.player.phase !== "FLOATING" && ctx.player.phase !== "BREACH") return;

  const enemyTeam = (1 - ctx.player.team) as 0 | 1;
  if (!ctx.arena.isGoalDoorOpen(enemyTeam)) return;
  const reachedEnemyBreach = ctx.player.phase === "BREACH"
    ? ctx.arena.isInBreachRoom(ctx.player.getPosition(), enemyTeam)
    : ctx.arena.isDeepInBreachRoom(ctx.player.getPosition(), enemyTeam, 1.0);
  if (!reachedEnemyBreach) return;

  ctx.player.currentBreachTeam = enemyTeam;
  ctx.player.phase = "BREACH";
  ctx.onlineBreachReported = true;
  ctx.disableOnlineProjectiles();

  ctx.net.sendBreachReport({
    scorerTeam: ctx.player.team,
    scorerName: ctx.onlinePlayerName,
  });
}

function sendOnlinePlayerUpdate(ctx: GameTickContext): void {
  const pos = ctx.player.getPosition();
  const vel = ctx.player.phys.vel;
  const orientation = ctx.player.getVisualQuaternion();
  ctx.net.sendPlayerUpdate({
    posX: pos.x,
    posY: pos.y,
    posZ: pos.z,
    velX: vel.x,
    velY: vel.y,
    velZ: vel.z,
    yaw: ctx.cam.getYaw(),
    orientX: orientation.x,
    orientY: orientation.y,
    orientZ: orientation.z,
    orientW: orientation.w,
    phase: ctx.player.phase,
    frozen: ctx.player.damage.frozen,
    leftArm: ctx.player.damage.leftArm,
    rightArm: ctx.player.damage.rightArm,
    leftLeg: ctx.player.damage.leftLeg,
    rightLeg: ctx.player.damage.rightLeg,
    kills: ctx.player.kills,
    deaths: ctx.player.deaths,
  });
}

function updateOnlineHud(ctx: GameTickContext, dt: number): void {
  const snap = ctx.latestOnlineSnapshot;
  if (!snap) return;

  const sessionId = ctx.getOnlineLocalActorId();

  const nearBar = computeNearBar(ctx);
  updateMobileHudControls(ctx, nearBar);

  const rosters = ctx.onlineMatch.getHudRosters(
    sessionId,
    ctx.onlinePlayerName,
    ctx.player.team,
    ctx.player.kills,
    ctx.player.deaths,
    ctx.player.damage.frozen,
    ctx.player.phase,
  );

  ctx.hud.update({
    score: snap.score,
    phase: snap.phase,
    countdown: snap.countdownRemaining,
    roundTimeRemaining: snap.roundTimeRemaining,
    playerPhase: ctx.player.phase,
    launchPower: ctx.player.launchPower,
    maxLaunchPower: ctx.player.maxLaunchPower(),
    nearBar,
    damage: ctx.player.damage,
    showPing: true,
    tabHeld: ctx.input.isTabHeld(),
    ownTeam: rosters.ownTeam,
    enemyTeam: rosters.enemyTeam,
    tutorialPrompt: ctx.tutorial.update({
      currentBreachTeam: ctx.player.currentBreachTeam,
      frozen: ctx.player.damage.frozen,
      inRound: snap.phase === "COUNTDOWN" || snap.phase === "PLAYING",
      mobile: ctx.mobile,
      phase: ctx.player.phase,
      team: ctx.player.team,
    }),
    helpVisible: ctx.helpVisible,
    dt,
    team: ctx.player.team,
  });
}
