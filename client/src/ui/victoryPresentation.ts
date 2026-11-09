import * as THREE from "three";
import { getVictoryLayout, getVictoryMotion } from "../game/victoryPresentationState";
import { SimulatedPlayerAvatar } from "../match/simulatedPlayerAvatar";

/** An end-screen-only scene. It never ticks players, AI, projectiles or networking. */
export class VictoryPresentation {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
  private readonly avatar: SimulatedPlayerAvatar;
  private readonly title = document.createElement("div");
  private readonly reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  private readonly origin = new THREE.Vector3();
  private readonly size = new THREE.Vector2();
  private readonly damage = { frozen: false, leftArm: false, rightArm: false, leftLeg: false, rightLeg: false };
  private elapsed = 0;

  public constructor(team: 0 | 1) {
    this.scene.background = new THREE.Color(0x080c14);
    this.scene.scale.setScalar(2.5);
    this.scene.add(new THREE.HemisphereLight(0xc9e6ff, 0x283047, 3));
    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(3, 5, 4);
    this.scene.add(light);
    // Reuse the game's team-colored model and established victory pose.
    this.avatar = new SimulatedPlayerAvatar(this.scene, team, "", true);
    this.title.className = "ob-victory-title";
    this.title.setAttribute("role", "status");
    this.title.textContent = `${team === 0 ? "CYAN" : "MAGENTA"} WINS`;
    this.title.style.cssText = `position:fixed;z-index:440;transform:translate(-50%,-50%);pointer-events:none;
      white-space:nowrap;font:600 clamp(18px,5vh,48px)/1.1 "JetBrains Mono",monospace;
      letter-spacing:.08em;color:${team === 0 ? "#60efff" : "#ff77df"};text-shadow:0 2px 18px #000;`;
    document.body.appendChild(this.title);
  }

  public render(renderer: THREE.WebGLRenderer, dt: number): void {
    renderer.getSize(this.size);
    const { x: width, y: height } = this.size;
    const layout = getVictoryLayout(width / height);
    const motion = getVictoryMotion(this.elapsed, dt, this.reducedMotion.matches);
    this.elapsed = motion.elapsed;
    this.avatar.update(this.origin, this.damage, "BREACH", 0, motion.animationDt, 0, true);
    this.camera.aspect = width / height;
    const radius = width < height ? 7.5 : 4;
    this.camera.position.set(Math.sin(motion.orbitAngle) * radius, 1.2, Math.cos(motion.orbitAngle) * radius);
    this.camera.lookAt(this.origin);
    this.camera.setViewOffset(width, height,
      (0.5 - layout.characterX) * width, (0.5 - layout.characterY) * height, width, height);
    this.title.style.left = `${layout.characterX * 100}%`;
    this.title.style.top = `${layout.titleY * 100}%`;
    renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    this.title.remove();
    this.avatar.dispose(this.scene);
    this.scene.clear();
  }
}
