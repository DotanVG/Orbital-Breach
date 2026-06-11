import { FEATURE_FLAGS } from "../featureFlags";
import {
  checkPortalCollisions,
  updateVibeJamPortals,
} from "./portal/vibeJamPortal";
import {
  applyCameraAndGun,
  computeNearBar,
  tickCameraLook,
  updateMobileHudControls,
  type GameTickContext,
} from "./tickContext";
import { buildShotFromCamera } from "./weaponFire";

/** Per-frame update for solo (local match vs bots) gameplay. */
export function tickSoloGame(ctx: GameTickContext, dt: number): void {
  tickCameraLook(ctx, dt);

  ctx.round.tick(dt);

  ctx.input.updateFireCooldown(dt);
  ctx.player.update(ctx.input, ctx.cam, ctx.arena, dt);
  ctx.arena.update(dt);

  const botShots = ctx.match.tick(dt, ctx.arena, ctx.player, ctx.round.isPlaying());
  for (const shot of botShots) {
    ctx.projectiles.spawn(shot.origin, shot.direction, shot.team, shot.ownerId);
    ctx.sound.playRemoteShot(shot.origin);
  }

  tickWeaponFire(ctx);
  ctx.projectiles.update(
    dt,
    ctx.arena.getObstacleBulletAABBs(),
    ctx.arena.getPortalBarrierAABBs(),
    ctx.match.getProjectileTargets(ctx.player),
    (hitPos, color) => ctx.arena.triggerPortalImpact(hitPos, color),
    (hit) => ctx.match.handleProjectileHit(hit, ctx.player, ctx.cam),
  );
  ctx.debugOverlays.tickGunTuning(ctx.input, ctx.player);
  ctx.debugOverlays.tickCollisionVis(ctx.input, () => ctx.match.getMatchStatsActors(ctx.player));
  ctx.debugOverlays.tickColliderEditor(ctx.input, ctx.player);
  ctx.matchStats.observePlayers(ctx.match.getMatchStatsActors(ctx.player), {
    accumulateTravel: ctx.round.isPlaying(),
  });

  checkPortalCollisions(ctx.player.getPosition(), ctx.player.phys.vel.y);
  updateVibeJamPortals(ctx.sceneMgr.getCamera().position, dt);

  if (FEATURE_FLAGS.thirdPersonLookBehind && ctx.input.consumeThirdPersonToggle()) {
    ctx.toggleCameraView();
  }

  applyCameraAndGun(ctx, dt);
  updateSoloHud(ctx, dt);
  ctx.debugOverlays.renderTuningOverlay(ctx.player);
}

function tickWeaponFire(ctx: GameTickContext): void {
  const inZeroG = ctx.player.phase === "FLOATING"
    || ctx.player.phase === "GRABBING"
    || ctx.player.phase === "AIMING";

  if (!ctx.round.isPlaying()) return;
  if (!ctx.input.canControlGame() || !inZeroG) return;
  if (!ctx.player.canFire() || !ctx.input.consumeFire()) return;

  const useThirdPersonMuzzle = ctx.thirdPerson
    || (FEATURE_FLAGS.thirdPersonLookBehind && ctx.input.isSelfieHeld());
  const shot = buildShotFromCamera(ctx.player, ctx.cam, ctx.gun, useThirdPersonMuzzle);
  if (!shot) return;

  ctx.projectiles.spawn(shot.origin, shot.direction, ctx.player.team, "local-player");
  ctx.sound.playLocalShot();
  ctx.player.triggerArmRecoil();
  ctx.tutorial.noteShotFired();
}

function updateSoloHud(ctx: GameTickContext, dt: number): void {
  const nearBar = computeNearBar(ctx);
  updateMobileHudControls(ctx, nearBar);

  const rosters = ctx.match.getHudRosters(ctx.player);
  ctx.hud.update({
    score: ctx.match.getScore(),
    phase: ctx.round.getPhase(),
    countdown: ctx.round.getCountdown(),
    roundTimeRemaining: ctx.round.getRoundTimeRemaining(),
    playerPhase: ctx.player.phase,
    launchPower: ctx.player.launchPower,
    maxLaunchPower: ctx.player.maxLaunchPower(),
    nearBar,
    damage: ctx.player.damage,
    showPing: false,
    tabHeld: ctx.input.isTabHeld(),
    ownTeam: rosters.ownTeam,
    enemyTeam: rosters.enemyTeam,
    tutorialPrompt: ctx.tutorial.update({
      currentBreachTeam: ctx.player.currentBreachTeam,
      frozen: ctx.player.damage.frozen,
      inRound: ctx.round.getPhase() === "COUNTDOWN" || ctx.round.getPhase() === "PLAYING",
      mobile: ctx.mobile,
      phase: ctx.player.phase,
      team: ctx.player.team,
    }),
    helpVisible: ctx.helpVisible,
    dt,
    team: ctx.player.team,
  });
}
