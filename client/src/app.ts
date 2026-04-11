import * as THREE from 'three';
import { Arena } from './arena/arena';
import { CameraController } from './camera';
import { InputManager } from './input';
import { LocalPlayer } from './player';
import { Projectile } from './projectile';
import { HUD, type GamePhase } from './render/hud';
import { SceneManager } from './render/scene';
import { GunViewModel } from './render/gun';
import { MainMenu } from './ui/menu';
import { generateArenaLayout } from './arena/states';
import { FEATURE_FLAGS } from './featureFlags';
import { COUNTDOWN_SECONDS, ROUND_END_DELAY, GRAB_RADIUS } from '../../shared/constants';
import type { FullPlayerInfo, EnemyPlayerInfo } from '../../shared/schema';

void THREE;

export class App {
  private sceneMgr: SceneManager;
  private input: InputManager;
  private cam: CameraController;
  private player: LocalPlayer;
  private arena: Arena;
  private hud: HUD;
  private menu: MainMenu;

  private phase: GamePhase = 'LOBBY';
  private countdownTimer = COUNTDOWN_SECONDS;
  private lastTime = 0;
  private projectiles: Projectile[] = [];
  private gun: GunViewModel;
  private thirdPerson = false;

  public constructor() {
    this.sceneMgr = new SceneManager();
    this.input = new InputManager();
    this.cam = new CameraController(this.sceneMgr.getCamera());
    this.arena = new Arena(this.sceneMgr.getScene());
    this.player = new LocalPlayer(this.sceneMgr.getScene());
    this.hud = new HUD();
    this.menu = new MainMenu();

    // Camera must be in the scene graph for parented children (gun model) to render
    this.sceneMgr.getScene().add(this.sceneMgr.getCamera());
    this.gun = new GunViewModel(this.sceneMgr.getCamera());

    // Wire round-win callback
    this.player.onRoundWin = (team) => this.onRoundWin(team);
  }

  public start(): void {
    this.menu.show();
    this.menu.onPlay = () => {
      this.input.lockPointer(this.sceneMgr.getRenderer().domElement);
      this.beginNewRound();
    };

    requestAnimationFrame((t) => this.loop(t));
  }

  // ── Round flow ────────────────────────────────────────────────────

  private beginNewRound(): void {
    this.hud.hideRoundEnd();
    this.cam.resetZeroGFlip();   // reset zero-G seed so first breach exit re-seeds from gravity orientation
    // Clear projectiles from previous round
    for (const p of this.projectiles) p.dispose();
    this.projectiles = [];
    const layout = generateArenaLayout();
    this.arena.loadLayout(layout);

    this.player.resetForNewRound(this.arena);

    // Orient camera to face the portal opening
    // getYawForward() = (-sin(yaw), 0, -cos(yaw)); solve for desired facing direction
    const openAxis = this.arena.getBreachOpenAxis(this.player.team);
    const openSign = this.arena.getBreachOpenSign(this.player.team);
    let targetYaw = 0;
    if (openAxis === 'z') {
      targetYaw = openSign === 1 ? Math.PI : 0;
    } else if (openAxis === 'x') {
      targetYaw = openSign === 1 ? -Math.PI / 2 : Math.PI / 2;
    }
    this.cam.setYaw(targetYaw);
    this.cam.setPitch(0);

    this.arena.setPortalDoorsOpen(false);  // doors closed during countdown
    this.phase = 'COUNTDOWN';
    this.countdownTimer = COUNTDOWN_SECONDS;
  }

  private onRoundWin(team: 0 | 1): void {
    if (this.phase !== 'PLAYING') {
      return;
    }
    this.phase = 'ROUND_END';
    const label = team === 0 ? 'CYAN WINS' : 'MAGENTA WINS';
    this.hud.showRoundEnd(label);
    setTimeout(() => this.beginNewRound(), ROUND_END_DELAY * 1000);
  }

  // ── Game loop ─────────────────────────────────────────────────────

  private loop(timestamp: number): void {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.033); // cap at ~30fps min
    this.lastTime = timestamp;

    if (this.input.isLocked()) {
      // ── CRITICAL ORDER: mode switches BEFORE consumeMouseDelta ──
      this.input.setAimingMode(this.player.phase === 'AIMING');
      // Zero-G free-look in arena; gravity mode inside breach rooms
      this.cam.setZeroGMode(this.player.phase !== 'BREACH');

      // Advance orientation transition (breach→zero-G slerp)
      this.cam.tickTransition(dt);

      const { dx, dy } = this.input.consumeMouseDelta();
      // dy will be 0 when aiming (InputManager routes it to aimDy instead)
      this.cam.applyMouseDelta(dx, dy, this.input.mouseSensitivity);

      // Countdown
      if (this.phase === 'COUNTDOWN') {
        this.countdownTimer -= dt;
        if (this.countdownTimer <= 0) {
          this.countdownTimer = 0;
          this.phase = 'PLAYING';
          this.arena.setPortalDoorsOpen(true);  // doors open when round starts
        }
      }

      // Player + arena update (runs during countdown too — players can move in breach room)
      this.input.updateFireCooldown(dt);
      this.player.update(this.input, this.cam, this.arena, dt);
      this.arena.update(dt);

      // Weapon: fire projectile on LMB (only while playing, player can fire, and gravity is off —
      // i.e. player is floating or hanging a bar, never inside a breach/gravity room)
      const inZeroG = this.player.phase === 'FLOATING'
        || this.player.phase === 'GRABBING'
        || this.player.phase === 'AIMING';
      if (this.phase === 'PLAYING' && inZeroG && this.player.canFire() && this.input.consumeFire()) {
        // Spawn bullet at the tip of the gun (right (+X), down (-Y), forward (-Z) relative to camera)
        const camQuat = this.cam.getQuaternion();
        const gunTipOffset = new THREE.Vector3(0.2, -0.22, -0.6).applyQuaternion(camQuat);
        const origin = this.player.getPosition().clone().add(gunTipOffset);
        
        // Determine center of screen in the distance to aim perfectly
        const target = this.player.getPosition().clone().addScaledVector(this.cam.getForward(), 60.0);
        const direction = target.sub(origin).normalize();

        const color  = this.player.team === 0 ? 0x00ffff : 0xff00ff;
        this.projectiles.push(
          new Projectile(this.sceneMgr.getScene(), origin, direction, color),
        );
      }

      // Update and cull dead projectiles
      for (const p of this.projectiles) p.update(dt);
      this.projectiles = this.projectiles.filter(p => !p.dead);

      // Third person toggle & selfie hold
      if (FEATURE_FLAGS.thirdPersonLookBehind && this.input.consumeThirdPersonToggle()) {
        this.thirdPerson = !this.thirdPerson;
      }
      const isSelfie = FEATURE_FLAGS.thirdPersonLookBehind && this.input.isSelfieHeld();

      // Camera follows player
      this.cam.apply(this.player.getPosition(), this.thirdPerson, isSelfie);

      // Gun visible only while a round is active, player is alive, and we are in 1st person
      const gunVisible = this.phase !== 'LOBBY' 
        && this.player.phase !== 'RESPAWNING' 
        && !this.thirdPerson 
        && !isSelfie;
      this.gun.setVisible(gunVisible);

      // HUD update
      let nearBar = this.arena.getNearestBar(this.player.getPosition(), GRAB_RADIUS) !== null;
      if (this.player.phase === 'BREACH' && !this.arena.isGoalDoorOpen(this.player.currentBreachTeam)) {
        nearBar = false;
      }
      const inBreach = this.arena.isInBreachRoom(this.player.getPosition(), this.player.team);
      const maxPower = this.player.maxLaunchPower();

      // Solo mode: build mock scoreboard data (will be replaced by server data in Phase 2)
      const ownTeam: FullPlayerInfo[] = [{
        id: 'local',
        name: 'You',
        frozen: this.player.damage.frozen,
        kills: this.player.kills,
        deaths: this.player.deaths,
        ping: 0,
      }];
      const enemyTeam: EnemyPlayerInfo[] = [];

      this.hud.update({
        score: { team0: this.player.kills, team1: 0 },
        phase: this.phase,
        countdown: this.countdownTimer,
        playerPhase: this.player.phase,
        launchPower: this.player.launchPower,
        maxLaunchPower: maxPower,
        nearBar,
        inBreach,
        damage: this.player.damage,
        tabHeld: this.input.isTabHeld(),
        ownTeam,
        enemyTeam,
      });
    }

    this.sceneMgr.render();
    requestAnimationFrame((t) => this.loop(t));
  }
}
