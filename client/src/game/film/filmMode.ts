import * as THREE from 'three';
import { BotBrain, createBotPersonality } from '../../match/botBrain';
import type { BotState, LocalMatchEvent } from '../../match/localMatch';
import type { GameTickContext } from '../tickContext';
import type { MultiplayerLobby } from '../../ui/multiplayerLobby';
import { directorCamera, FILM_CAMERAS, filmResponse, parseFilmOptions, type FilmCamera } from './filmOptions';
import { filmShots } from './filmShots';

type FilmOptions = NonNullable<ReturnType<typeof parseFilmOptions>>;

/** Dev-only director. Pilots and projectiles always run through LocalMatch. */
export class FilmMode {
  public readonly options: FilmOptions;
  public ready = false;
  public held: boolean;
  public readonly events: { time: number; type: string; actor?: string }[] = [];
  public readonly frames: number[] = [];
  private elapsed = 0;
  private warmFrames = 0;
  private shotAge = 0;
  private targetAge = 99;
  private targetId = '';
  private mode: FilmCamera;
  private initialized = false;
  private staged = false;
  private accumulator = 0;
  private readonly reel = filmShots(Number(new URLSearchParams(location.search).get('film_from') ?? 0),
    new URLSearchParams(location.search).get('film_reel') ?? '');
  private pendingCamera: FilmCamera | null = null;
  private reelIndex = 0;
  private reelStart = 0;
  private reelDistance = 0;
  private readonly reelPose = new THREE.Vector3();
  private readonly manifest: object[] = [];
  private readonly reelTelemetry = document.createElement('script');
  private readonly firing = new Map<string, { direction: THREE.Vector3; until: number }>();
  private readonly shotCounts = new Map<string, number>();
  private readonly previous = new Map<string, string>();
  private readonly keys = new Set<string>();
  private readonly velocity = new THREE.Vector3();
  private readonly mount = new THREE.PerspectiveCamera();
  private readonly position = new THREE.Vector3();
  private readonly forward = new THREE.Vector3(0, 0, -1);
  private readonly side = new THREE.Vector3(1, 0, 0);
  private readonly focus = new THREE.Vector3();
  private readonly ray = new THREE.Ray();
  private readonly hit = new THREE.Vector3();
  private readonly expanded = new THREE.Box3();
  private readonly minimal = document.createElement('div');
  private readonly telemetry = document.createElement('script');
  private readonly style = document.createElement('style');
  private readonly savedProjection: { fov: number; near: number; far: number };
  private readonly savedPixelRatio: number;
  private gunTint: number | null | undefined;
  private readonly keyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    this.keys.add(e.code);
    const index = Number(e.key) - 1;
    if (index >= 0 && index < FILM_CAMERAS.length) this.setCamera(FILM_CAMERAS[index]);
    if (e.code === 'KeyP') { if (this.held) this.play(); else this.held = true; }
    if (e.code === 'KeyR') this.restart();
    if (e.code === 'KeyF') this.options.director = !this.options.director;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  };
  private readonly keyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private readonly blur = () => { this.keys.clear(); };
  private readonly mouse = (e: MouseEvent) => {
    if (this.mode !== 'free-fly' || e.buttons !== 2) return;
    const rotation = new THREE.Euler().setFromQuaternion(this.mount.quaternion, 'YXZ');
    rotation.y -= e.movementX * 0.002;
    rotation.x = THREE.MathUtils.clamp(rotation.x - e.movementY * 0.002, -1.5, 1.5);
    this.mount.quaternion.setFromEuler(rotation);
  };
  private readonly contextMenu = (e: Event) => { if (this.mode === 'free-fly') e.preventDefault(); };

  constructor(private readonly ctx: GameTickContext, options: FilmOptions, private readonly restart: () => void) {
    this.options = options;
    if (this.reel.length) this.applyShot();
    this.mode = options.camera;
    this.held = options.hold;
    const camera = ctx.sceneMgr.getCamera();
    this.savedProjection = { fov: camera.fov, near: camera.near, far: camera.far };
    this.savedPixelRatio = ctx.sceneMgr.getRenderer().getPixelRatio();
    camera.fov = 68;
    camera.near = 0.06;
    camera.updateProjectionMatrix();
    ctx.sceneMgr.getRenderer().setPixelRatio(1);
    // Dynamic point-light counts compile shader variants during hits; emissive VFX remain visible.
    ctx.projectiles.setHitFlashLights(false);
    this.style.textContent = `body.ob-film > :not(canvas):not(script):not(style):not(.ob-film-score) { visibility:hidden !important; }
      body.ob-film canvas { cursor:none !important; }
      .ob-film-score { position:fixed;top:28px;left:0;right:0;text-align:center;color:white;font:24px monospace;pointer-events:none;z-index:99999; }
      .ob-film-score::after { content:'+';position:fixed;top:calc(50% - 10px);left:calc(50% - 7px);font:20px monospace;opacity:.65; }`;
    document.head.append(this.style);
    this.minimal.className = 'ob-film-score';
    document.body.append(this.minimal);
    this.telemetry.id = 'film-telemetry';
    this.telemetry.type = 'application/json';
    document.body.append(this.telemetry);
    this.reelTelemetry.id = 'film-reel';
    this.reelTelemetry.type = 'application/json';
    document.body.append(this.reelTelemetry);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.blur);
    window.addEventListener('mousemove', this.mouse);
    window.addEventListener('contextmenu', this.contextMenu);
    Object.assign(window, { __film: this });
  }

  public play(): void {
    this.held = false;
    if (this.ctx.round.getPhase() === 'COUNTDOWN') this.ctx.round.tick(Math.max(0, this.ctx.round.getCountdown() - 0.75));
    this.elapsed = 0;
    this.frames.length = 0;
    this.events.length = 0;
  }

  public showLobby(lobby: MultiplayerLobby): void {
    this.held = true;
    lobby.render({
      roomId: 'film-local', roomName: 'Orbital Breach · Premiere', sessionId: 'film-spectator',
      selfTeam: 0, phase: 'LOBBY', matchComplete: false, visibility: 'public', listing: 'browser',
      countdownRemaining: 0, roundTimeRemaining: 120, score: { team0: 0, team1: 0 },
      roundNumber: 1, teamSize: 5, maxPlayers: 10,
      members: this.ctx.match.getSpectatorActors().map(a => ({ id: a.id, name: a.name, team: a.team, ready: true, connected: true, isBot: true })),
      actors: [],
    });
    lobby.show();
  }

  public setCamera(mode: FilmCamera): void {
    if (!FILM_CAMERAS.includes(mode)) return;
    this.mode = mode;
    this.shotAge = 0;
    this.pendingCamera = null;
    // One exponential handoff owns both the pose and follow response.
    this.log(`camera:${mode}`);
  }

  public onRound(): void {
    this.staged = false;
    this.previous.clear();
    this.pendingCamera = null;
    this.firing.clear();
    this.shotCounts.clear();
    this.accumulator = 0;
    this.targetAge = 99;
    this.log('round-start');
    if (!['launch', 'menu', 'lobby'].includes(this.options.scenario)) {
      const actors = this.ctx.match.getSpectatorActors();
      this.stage(actors);
      this.staged = true;
      for (const a of actors) a.avatar.update(a.phys.pos, a.damage, a.phase, a.rot.yaw, 0, 0);
    }
  }

  public onEvent(event: LocalMatchEvent): void {
    const type = event.type === 'roundWin' ? event.reason : event.type;
    this.log(type);
    if (event.type === 'score') this.targetId = event.scorerId;
    const next = this.options.director ? directorCamera(type, this.shotAge, this.mode) : null;
    if (this.options.director && !next && ['roundWin', 'matchEnd'].includes(event.type)) {
      this.pendingCamera = directorCamera(type, 2.5, this.mode);
    }
    if (next) {
      if (event.type === 'freeze') this.targetId = this.ctx.match.getSpectatorActors().find(a => a.name === event.killerName)?.id ?? this.targetId;
      this.targetAge = 0;
      this.setCamera(next);
    }
  }

  private log(type: string, actor?: string): void {
    this.events.push({ time: this.elapsed, type, actor });
  }

  public tick(realDt: number, gameplayActive = true): void {
    const ctx = this.ctx;
    if (!this.held) this.elapsed += realDt;
    this.frames.push(realDt * 1000);
    if (this.frames.length > 18000) this.frames.shift();
    this.shotAge += realDt;
    this.targetAge += realDt;
    if (!this.held && this.options.director) {
      if (this.pendingCamera && this.shotAge >= 2.5) this.setCamera(this.pendingCamera);
      else if (this.shotAge >= 6.5) this.setCamera(this.mode === 'orbit' ? 'chase' : 'orbit');
    }
    realDt = Math.max(0, Math.min(realDt, 0.1));
    const dt = this.options.scenario === 'war' ? 1 / 60 : 1 / 120;
    const actors = ctx.match.getSpectatorActors();
    this.ready = ++this.warmFrames > 180 && actors.every(a => a.avatar.isReady());
    if (this.warmFrames === 180) {
      // Reassert the drawing buffer after headed Chrome applies a capture viewport override.
      ctx.sceneMgr.getRenderer().setSize(window.innerWidth, window.innerHeight);
      ctx.sceneMgr.getRenderer().resetState();
    }
    if (!this.held && gameplayActive && !['menu', 'lobby'].includes(this.options.scenario)) this.accumulator += realDt * this.options.timescale;
    while (!this.held && this.accumulator >= dt) {
      this.accumulator -= dt;
      ctx.round.tick(dt);
      if (ctx.round.isPlaying() && !this.staged) {
        this.stage(actors);
        this.staged = true;
      }
      ctx.arena.update(dt);
      const shots = ctx.match.tick(dt, ctx.arena, ctx.player, ctx.round.isPlaying());
      for (const shot of shots) {
        if (this.options.scenario === 'freeze') {
          // Bias the bot's existing shot toward legs first, then torso. Hits still use real projectiles.
          const count = this.shotCounts.get(shot.ownerId) ?? 0;
          this.shotCounts.set(shot.ownerId, count + 1);
          const enemy = actors.filter(a => a.team !== shot.team && !a.damage.frozen)
            .sort((a, b) => shot.direction.angleTo(a.phys.pos.clone().sub(shot.origin))
              - shot.direction.angleTo(b.phys.pos.clone().sub(shot.origin)))[0];
          if (enemy) shot.direction.copy(enemy.phys.pos).add(new THREE.Vector3(0, count < 2 ? -0.65 : -0.35, 0)).sub(shot.origin).normalize();
        }
        ctx.projectiles.spawn(shot.origin, shot.direction, shot.team, shot.ownerId);
        ctx.sound.playRemoteShot(shot.origin);
        this.log('shot', shot.ownerId);
        this.firing.set(shot.ownerId, { direction: shot.direction.clone(), until: this.elapsed + 1.5 / this.options.timescale });
      }
      ctx.projectiles.update(dt, ctx.arena.getObstacleBulletAABBs(), ctx.arena.getPortalBarrierAABBs(),
        ctx.match.getProjectileTargets(ctx.player), (pos, color) => ctx.arena.triggerPortalImpact(pos, color),
        hit => ctx.match.handleProjectileHit(hit, ctx.player, ctx.cam));
      ctx.matchStats.observePlayers(ctx.match.getMatchStatsActors(ctx.player), { accumulateTravel: ctx.round.isPlaying() });
      for (const actor of actors) {
        const state = `${actor.phase}:${Object.values(actor.damage).join(',')}`;
        const previous = this.previous.get(actor.id);
        if (previous && previous !== state) {
          if (this.options.scenario === 'launch' && actor.phase === 'GRABBING') {
            // Keep the real grab/charge, then bias the existing brain to launch through the arena.
            const profile = createBotPersonality(actor.id, actor.team);
            profile.routeLengthMin = profile.routeLengthMax = 0;
            profile.barLateralBias = profile.barVerticalBias = 0;
            profile.aimNoise = 0.025;
            actor.brain = new BotBrain(profile);
            actor.brain.resetForRound(this.options.seed);
          }
          const type = previous.startsWith('AIMING') && actor.phase === 'FLOATING' ? 'launch'
            : actor.damage.frozen ? 'freeze' : state.split(':')[1] !== previous.split(':')[1] ? 'limb-hit' : 'phase';
          this.log(type, actor.id);
          const next = this.options.director ? directorCamera(type, this.shotAge, this.mode) : null;
          if (next) { this.targetId = actor.id; this.targetAge = 0; this.setCamera(next); }
        }
        this.previous.set(actor.id, state);
      }
    }
    this.camera(actors, realDt);
    const uiShot = !gameplayActive || ['lobby', 'menu'].includes(this.options.scenario);
    document.body.classList.toggle('ob-film', !uiShot && this.options.hud !== '1');
    this.minimal.style.display = !uiShot && this.options.hud === 'min' ? '' : 'none';
    const score = ctx.match.getScore();
    this.minimal.textContent = `${score.team0}  :  ${score.team1}`;
    if (this.warmFrames % 30 === 0) {
      const sorted = [...this.frames.slice(-600)].sort((a, b) => a - b);
      this.telemetry.textContent = JSON.stringify({ ready: this.ready, held: this.held, elapsed: this.elapsed,
        camera: this.mode, target: this.targetId, score, actors: actors.length, phase: ctx.round.getPhase(),
        cameraPosition: ctx.sceneMgr.getCamera().position.toArray(),
        p50: sorted[Math.floor(sorted.length * .5)], p95: sorted[Math.floor(sorted.length * .95)],
        events: this.events, positions: actors.map(a => ({ id: a.id, phase: a.phase, pos: a.phys.pos.toArray() })) });
    }
    this.captureReel(gameplayActive);
  }

  private applyShot(): void {
    const shot = this.reel[this.reelIndex];
    Object.assign(this.options, { scenario: shot.scenario, camera: shot.camera, seed: shot.seed,
      timescale: shot.scale, director: shot.director, hud: '0', hold: true });
    this.mode = shot.camera;
    this.held = true;
    this.ready = false;
    this.initialized = false;
    this.warmFrames = 0;
    this.elapsed = 0;
    this.shotAge = 0;
    this.reelStart = 0;
    this.reelDistance = 0;
  }

  private captureReel(gameplayActive: boolean): void {
    const shot = this.reel[this.reelIndex];
    if (!shot) return;
    if (!this.reelStart && this.ready) {
      this.play();
      this.reelStart = Date.now();
      this.reelPose.copy(this.ctx.sceneMgr.getCamera().position);
    }
    if (!this.reelStart) return;
    const pose = this.ctx.sceneMgr.getCamera().position;
    this.reelDistance += pose.distanceTo(this.reelPose);
    this.reelPose.copy(pose);
    if (this.elapsed < shot.seconds) {
      if (shot.director && !gameplayActive) this.restart();
      return;
    }
    const frames = [...this.frames].sort((a, b) => a - b);
    this.manifest.push({ ...shot, start: this.reelStart, end: Date.now(), events: [...this.events],
      p50: frames[Math.floor(frames.length * .5)], p95: frames[Math.floor(frames.length * .95)],
      over33ms: frames.filter(t => t > 33.4).length, frames: frames.length, cameraTravel: this.reelDistance });
    this.reelIndex++;
    this.reelTelemetry.textContent = JSON.stringify({ complete: this.reelIndex === this.reel.length, shots: this.manifest });
    if (this.reelIndex === this.reel.length) { this.held = true; return; }
    this.applyShot();
    if (!this.reel[this.reelIndex].debrief) this.restart();
  }

  private stage(actors: readonly BotState[]): void {
    const scenario = this.options.scenario;
    if (scenario === 'launch') {
      // The opening jump is a setup impulse; navigation and every launch stay bot-owned.
      for (const a of actors) if (a.phase === 'BREACH') a.phys.vel.y = 7;
    }
    for (const actor of actors) {
      const profile = createBotPersonality(actor.id, actor.team);
      if (['freeze', 'fullfreeze', 'war'].includes(scenario)) {
        profile.fireRange = 28;
        profile.fireCooldown = scenario === 'war' ? 0.5 : 1.1;
        profile.enemyFocusBias = 1;
        profile.shotSpreadBase = 0.018;
        profile.aimNoise = 0.025;
      }
      if (['breach', 'victory'].includes(scenario)) {
        profile.routeLengthMin = profile.routeLengthMax = 0;
        profile.aimNoise = 0;
        profile.aimReleaseMin = profile.aimReleaseMax = 1;
        profile.launchChargeSeconds = 1.7;
        profile.enemyFocusBias = 0;
        profile.fireRange = 0;
        profile.barLateralBias = profile.barVerticalBias = 0;
      }
      actor.brain = new BotBrain(profile);
      actor.brain.resetForRound(this.options.seed);
    }
    if (['freeze', 'fullfreeze', 'war'].includes(scenario)) {
      // Place opposing squads in a clear combat volume, then let existing brains fight.
      const boxes = this.ctx.arena.getObstacleAABBs();
      const center = new THREE.Vector3();
      outer: for (let y = 2; y <= 14; y += 4) for (let z = -10; z <= 10; z += 5) {
        center.set(0, y, z);
        const volume = new THREE.Box3().setFromCenterAndSize(center, new THREE.Vector3(18, 4, 6));
        if (!boxes.some(box => box.intersectsBox(volume))) break outer;
      }
      actors.forEach((actor, i) => {
        actor.phase = 'FLOATING';
        actor.phys.pos.copy(center).add(new THREE.Vector3(actor.team === 0 ? -6 : 6, (i % 3) * 0.8, (i % 5 - 2) * 1.3));
        actor.phys.vel.set(0, 0.15, actor.team === 0 ? 0.8 : -0.8);
        actor.rot.yaw = actor.team === 0 ? -Math.PI / 2 : Math.PI / 2;
      });
    }
    if (['breach', 'victory'].includes(scenario)) {
      const actor = actors[0];
      if (actor) {
        const center = this.ctx.arena.getBreachRoomCenter(1);
        const axis = this.ctx.arena.getBreachOpenAxis(1);
        const sign = this.ctx.arena.getBreachOpenSign(1);
        actor.phys.pos.copy(center);
        actor.phys.pos[axis] += sign * 9;
        actor.grabbedBarPos = actor.phys.pos.clone();
        actor.phase = 'GRABBING';
        // ponytail: staged rail anchor, upgrade when authored film arena layouts exist.
      }
    }
    if (scenario === 'fullfreeze') {
      const enemies = actors.filter(a => a.team === 1);
      enemies.slice(1).forEach(a => { a.damage.frozen = true; a.phase = 'FROZEN'; });
    }
    if (scenario === 'victory') {
      // A match-point setup; the bot must still earn the fifth point through a real breach.
      this.ctx.match.setSpectatorScore({ team0: 4, team1: 2 });
    }
    this.log(`setup:${scenario}`);
  }

  private camera(actors: readonly BotState[], dt: number): void {
    const ctx = this.ctx;
    const camera = ctx.sceneMgr.getCamera();
    const current = actors.find(a => a.id === this.targetId);
    let target = this.options.target !== 'auto' ? actors.find(a => a.id === this.options.target) : current;
    if (!target || (this.options.target === 'auto' && this.targetAge > 4 && (target.damage.frozen || this.options.director) && !ctx.player.isVictoryDanceActive())) {
      const interest = (a: BotState) => {
        const enemy = ctx.arena.getBreachRoomCenter((1 - a.team) as 0 | 1);
        return (a.damage.frozen ? -100 : 0) + (a.phase === 'AIMING' ? 25 : 0) + ((this.firing.get(a.id)?.until ?? 0) > this.elapsed ? 12 : 0) + Math.min(15, a.phys.vel.length())
          + Math.max(0, 20 - a.phys.pos.distanceTo(enemy)) + (a.id === this.targetId ? 5 : 0);
      };
      target = [...actors].sort((a, b) => interest(b) - interest(a))[0];
      if (target && target.id !== this.targetId) { this.targetAge = 0; this.log('target', target.id); }
    }
    if (!target) { ctx.gun.setVisible(false); return; }
    this.targetId = target.id;
    for (const a of actors) a.avatar.setSpectatorVisible(this.mode !== 'bot-pov' || a.id !== target.id, this.options.hud === '1');
    this.forward.set(-Math.sin(target.rot.yaw) * Math.cos(target.rot.pitch), Math.sin(target.rot.pitch), -Math.cos(target.rot.yaw) * Math.cos(target.rot.pitch));
    const firing = this.firing.get(target.id);
    if (firing && firing.until > this.elapsed && target.phase !== 'AIMING') this.forward.copy(firing.direction);
    this.focus.copy(target.phys.pos);
    const t = this.elapsed;
    const celebrating = this.options.scenario === 'victory' && ctx.player.isVictoryDanceActive();
    if (this.mode === 'bot-pov') {
      this.position.copy(this.focus).add(new THREE.Vector3(0, 0.03 + Math.sin(t * 1.7) * 0.012, 0));
      this.mount.position.copy(this.position);
      this.mount.lookAt(this.focus.clone().addScaledVector(this.forward, 12));
    } else if (this.mode === 'chase' || this.mode === 'side-track') {
      if (this.mode === 'side-track' && target.phys.vel.lengthSq() > 1) this.forward.copy(target.phys.vel).normalize();
      this.side.crossVectors(this.forward, THREE.Object3D.DEFAULT_UP).normalize();
      this.position.copy(this.focus).addScaledVector(this.forward, this.mode === 'chase' ? celebrating ? -2.2 : -3.8 : -2)
        .addScaledVector(this.side, this.mode === 'chase' ? 0.65 : celebrating ? 3 : 6);
      this.position.y += celebrating ? 0.65 : this.mode === 'chase' ? 1 : 2;
      this.mount.position.copy(this.position);
      this.mount.lookAt(this.focus.clone().addScaledVector(this.forward, celebrating ? 0 : this.mode === 'chase' ? 4 : 0.8));
    } else if (this.mode === 'orbit') {
      const war = this.options.scenario === 'war';
      this.focus.copy(target.phys.pos);
      if (war) {
        this.focus.set(0, 0, 0);
        for (const actor of actors) this.focus.add(actor.phys.pos);
        this.focus.divideScalar(actors.length);
      }
      const radius = war ? 12 : celebrating ? 3 : 6;
      this.position.copy(this.focus).add(new THREE.Vector3(Math.sin(t * 0.13) * radius, war ? 7 : celebrating ? 1.2 : 3, Math.cos(t * 0.13) * radius));
      this.mount.position.copy(this.position);
      this.mount.lookAt(this.focus);
    } else if (this.mode === 'portal-cam') {
      const center = ctx.arena.getBreachRoomCenter((1 - target.team) as 0 | 1);
      const axis = ctx.arena.getBreachOpenAxis((1 - target.team) as 0 | 1);
      const sign = ctx.arena.getBreachOpenSign((1 - target.team) as 0 | 1);
      this.position.copy(center);
      this.position[axis] -= sign * 1.4;
      this.position.y += 1.4;
      this.mount.position.copy(this.position);
      this.focus.copy(center);
      this.focus[axis] += sign * 12;
      this.mount.lookAt(this.focus);
    } else {
      if (!this.initialized) { this.mount.position.copy(target.phys.pos).add(new THREE.Vector3(0, 3, 5)); this.mount.lookAt(target.phys.pos); }
      const direction = new THREE.Vector3(Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA')),
        Number(this.keys.has('Space')) - Number(this.keys.has('ControlLeft')),
        Number(this.keys.has('KeyS')) - Number(this.keys.has('KeyW'))).applyQuaternion(this.mount.quaternion);
      this.velocity.lerp(direction.multiplyScalar(this.keys.has('ShiftLeft') ? 14 : 6), filmResponse(5, dt));
      this.mount.position.addScaledVector(this.velocity, dt);
      this.position.copy(this.mount.position);
    }
    // Constrain target mount and the final smoothed segment, including lateral flybys.
    const boxes = ctx.arena.getThirdPersonCameraCollisionAABBs();
    if (this.mode !== 'bot-pov' && this.mode !== 'free-fly' && this.mode !== 'portal-cam') this.constrain(this.focus, this.position, boxes);
    this.mount.position.copy(this.position);
    const blend = this.initialized ? filmResponse(this.shotAge < 0.9 ? 3.5 : this.mode === 'bot-pov' ? 16 : 6, dt) : 1;
    camera.position.lerp(this.position, blend);
    camera.quaternion.slerp(this.mount.quaternion, blend);
    if (this.mode !== 'bot-pov' && this.mode !== 'portal-cam') this.constrain(this.focus, camera.position, boxes);
    this.initialized = true;
    ctx.player.setWorldModelVisible(false);
    ctx.player.setThirdPersonGunVisible(false);
    ctx.gun.setVisible(this.mode === 'bot-pov');
    const tint = target.damage.frozen || target.damage.rightArm ? target.team === 0 ? 0xff00ff : 0x00ffff : null;
    if (tint !== this.gunTint) { ctx.gun.setFrozenTint(tint); this.gunTint = tint; }
  }

  private constrain(origin: THREE.Vector3, position: THREE.Vector3, boxes: THREE.Box3[]): void {
    const direction = position.clone().sub(origin);
    let distance = direction.length();
    if (distance < 0.001) return;
    this.ray.set(origin, direction.normalize());
    for (const box of boxes) {
      this.expanded.copy(box).expandByScalar(0.22);
      if (this.expanded.containsPoint(origin)) continue;
      if (this.ray.intersectBox(this.expanded, this.hit)) distance = Math.min(distance, Math.max(0, origin.distanceTo(this.hit) - 0.05));
    }
    position.copy(origin).addScaledVector(direction, distance);
  }

  public dispose(): void {
    this.ctx.match.getSpectatorActors().forEach(a => a.avatar.setSpectatorVisible(true, true));
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.blur);
    window.removeEventListener('mousemove', this.mouse);
    window.removeEventListener('contextmenu', this.contextMenu);
    document.body.classList.remove('ob-film');
    this.style.remove(); this.minimal.remove(); this.telemetry.remove(); this.reelTelemetry.remove();
    Object.assign(this.ctx.sceneMgr.getCamera(), this.savedProjection);
    this.ctx.sceneMgr.getRenderer().setPixelRatio(this.savedPixelRatio);
    this.ctx.projectiles.setHitFlashLights(true);
    this.ctx.sceneMgr.getCamera().updateProjectionMatrix();
    delete (window as Window & { __film?: FilmMode }).__film;
  }
}
