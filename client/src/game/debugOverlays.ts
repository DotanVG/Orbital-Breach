import * as THREE from "three";
import type { Arena } from "../arena/arena";
import { FEATURE_FLAGS } from "../featureFlags";
import type { InputManager } from "../input";
import type { LocalPlayer } from "../player";
import { ColliderEditor } from "./colliderEditor";
import { CollisionVisualizer } from "./collisionVisualizer";
import { FloatArmTuneOverlay } from "./floatArmTuneOverlay";
import { GunTuneOverlay } from "./gunTuneOverlay";

interface DebugActorSnapshot {
  position: { x: number; y: number; z: number };
}

/**
 * Owns the dev/debug overlay subsystems (collision visualizer, collider
 * editor, gun/limb tuning overlays) and their per-frame ticking, keeping
 * them out of the main App composition.
 */
export class DebugOverlays {
  private readonly colliderEditor: ColliderEditor;
  private readonly collisionVis: CollisionVisualizer;
  private readonly floatArmTuneOverlay = new FloatArmTuneOverlay();
  private readonly gunTuneOverlay = new GunTuneOverlay();

  public constructor(scene: THREE.Scene) {
    this.collisionVis = new CollisionVisualizer(scene);
    this.colliderEditor = new ColliderEditor(scene);
  }

  public setCollisionVisVisible(visible: boolean): void {
    this.collisionVis.setVisible(visible);
  }

  public onLayoutLoaded(arena: Arena): void {
    this.collisionVis.onLayoutLoaded(arena);
  }

  public tickCollisionVis(input: InputManager, getActors: () => DebugActorSnapshot[]): void {
    if (import.meta.env.DEV && input.consumeCollisionVisToggle()) {
      this.collisionVis.toggle();
    }
    if (!this.collisionVis.isVisible()) return;

    const positions = getActors().map((a) => new THREE.Vector3(a.position.x, a.position.y, a.position.z));
    this.collisionVis.updateActors(positions);
  }

  public tickColliderEditor(input: InputManager, player: LocalPlayer): void {
    if (!import.meta.env.DEV) return;
    if (input.consumeColliderEditorToggle()) {
      this.colliderEditor.toggle();
    }
    if (!this.colliderEditor.isVisible()) return;
    const axes = input.getColliderEditorAxes();
    this.colliderEditor.tick(player.getPosition(), axes);
  }

  public tickGunTuning(input: InputManager, player: LocalPlayer): void {
    const tuning = FEATURE_FLAGS.debugTuning;
    if (!tuning.enabled) return;

    if (tuning.target === "Pistol") {
      if (input.consumeGunTuneToggle()) player.toggleThirdPersonGunTuning();
      if (input.consumeGunTuneReset()) player.resetThirdPersonGunTuning();
      if (input.consumeGunTunePrint()) {
        void this.copyDebugTuningToClipboard(player.logThirdPersonGunTuning());
      }

      if (player.isThirdPersonGunTuningEnabled()) {
        const tuningAxes = input.getGunTuneAxes();
        player.nudgeThirdPersonGun(
          tuningAxes.position,
          tuningAxes.rotation,
          tuningAxes.fine,
        );
      }
      return;
    }

    if (!player.isFloatLimbTarget(tuning.target)) return;

    if (input.consumeGunTuneToggle()) player.toggleFloatArmTuning();
    if (input.consumeGunTuneReset()) player.resetFloatLimbTuning(tuning.target);
    if (input.consumeGunTunePrint()) {
      void this.copyDebugTuningToClipboard(player.logFloatLimbTuning(tuning.target));
    }

    if (player.isFloatLimbTuningEnabled()) {
      const tuningAxes = input.getGunTuneAxes();
      player.nudgeFloatLimbRotation(
        tuning.target,
        tuningAxes.rotation,
        tuningAxes.fine,
      );
    }
  }

  public renderTuningOverlay(player: LocalPlayer): void {
    const tuning = FEATURE_FLAGS.debugTuning;

    this.gunTuneOverlay.render(
      player.getThirdPersonGunTuningState(),
      tuning.enabled && tuning.target === "Pistol",
    );

    if (!player.isFloatLimbTarget(tuning.target)) {
      this.floatArmTuneOverlay.render(
        { target: "FloatRightArm", rotation: player.getFloatLimbTuningState("FloatRightArm").rotation },
        false,
        false,
      );
      return;
    }

    this.floatArmTuneOverlay.render(
      player.getFloatLimbTuningState(tuning.target),
      player.isFloatLimbTuningEnabled(),
      tuning.enabled,
    );
  }

  private async copyDebugTuningToClipboard(text: string): Promise<void> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        console.info("[DebugTuning] Copied tuning values to clipboard.");
        return;
      }
    } catch (error) {
      console.warn("[DebugTuning] Clipboard API failed, trying fallback copy.", error);
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    try {
      const copied = document.execCommand("copy");
      if (copied) {
        console.info("[DebugTuning] Copied tuning values to clipboard.");
      } else {
        console.warn("[DebugTuning] Clipboard copy failed; value is still in the console.");
      }
    } catch (error) {
      console.warn("[DebugTuning] Clipboard fallback failed; value is still in the console.", error);
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
