import * as THREE from 'three';
import type { AnimatedRig, PoseBoneName, BreathingBoneName, RightArmPoseBoneName } from './playerTypes';

export const ANIM_IDLE_HOLD = 'Alien_IdleHold';
export const ANIM_JUMP = 'Alien_Jump';
export const ANIM_RUN_HOLD = 'Alien_RunHold';
export const ANIM_STANDING = 'Alien_Standing';
export const ANIM_DEATH = 'Alien_Death';
export const ANIM_FADE_SECONDS = 0.16;
export const BREACH_JUMP_TAKEOFF_SPEED = 2.35;

const BREACH_BREATH_SPEED = 1.8;
const BREACH_BREATH_ABDOMEN_Y = 0.012;
const BREACH_BREATH_TORSO_Y = 0.008;
const BREACH_BREATH_NECK_Y = 0.004;

const POSE_BONE_NAMES: PoseBoneName[] = [
  'Hips',
  'Abdomen',
  'Torso',
  'Neck',
  'ShoulderR',
  'UpperArmR',
  'LowerArmR',
  'PalmR',
  'ShoulderL',
  'UpperArmL',
  'LowerArmL',
  'PalmL',
  'UpperLegL',
  'LowerLegL',
  'FootL',
  'UpperLegR',
  'LowerLegR',
  'FootR',
];

const BREATHING_BONE_NAMES: BreathingBoneName[] = ['Abdomen', 'Torso', 'Neck'];

/**
 * Owns animation playback state across all registered rigs (body + helmet).
 * Callers tell it what clip to target each frame; it handles crossfades,
 * mixer ticks, idle breathing, and right-arm pose preservation during jumps.
 */
export class PlayerAnimationController {
  private rigs: AnimatedRig[] = [];
  private currentAnimation: string = ANIM_IDLE_HOLD;
  private breathTime = 0;

  public registerRig(root: THREE.Group, clips: THREE.AnimationClip[]): AnimatedRig {
    const mixer = new THREE.AnimationMixer(root);
    const actions = new Map<string, THREE.AnimationAction>();

    for (const clip of clips) {
      const action = mixer.clipAction(clip);
      action.enabled = true;
      if (clip.name === ANIM_JUMP) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      } else {
        action.setLoop(THREE.LoopRepeat, Infinity);
      }
      actions.set(clip.name, action);
    }

    const rig: AnimatedRig = {
      root,
      mixer,
      actions,
      bones: collectPoseBones(root),
      breathingBasePositions: captureBreathingBasePositions(root),
      frozenJumpRightArmPose: {},
    };
    this.rigs.push(rig);

    const action = actions.get(this.currentAnimation) ?? actions.get(ANIM_IDLE_HOLD);
    if (action) {
      action.reset();
      action.play();
    }

    return rig;
  }

  public getRigs(): AnimatedRig[] {
    return this.rigs;
  }

  public getCurrentAnimation(): string {
    return this.currentAnimation;
  }

  /** Switch to `name` if it differs from the current animation. Crossfades both rigs. */
  public setTargetAnimation(name: string): void {
    if (name === this.currentAnimation) return;

    for (const rig of this.rigs) {
      const next = rig.actions.get(name) ?? rig.actions.get(ANIM_IDLE_HOLD);
      const prev = rig.actions.get(this.currentAnimation);
      if (!next || next === prev) continue;

      prev?.fadeOut(ANIM_FADE_SECONDS);
      next.reset();
      next.fadeIn(ANIM_FADE_SECONDS);
      next.play();
    }
    this.currentAnimation = name;
  }

  /**
   * Hard-reset all rigs to the given animation at time 0 (used when
   * locking the grab pose).
   */
  public snapToAnimation(name: string): void {
    if (this.currentAnimation !== name) {
      this.setTargetAnimation(name);
    }
    for (const rig of this.rigs) {
      rig.mixer.setTime(0);
    }
  }

  public tickMixers(dt: number): void {
    for (const rig of this.rigs) {
      rig.mixer.update(dt);
    }
  }

  public tickBreathing(dt: number): void {
    this.breathTime += dt;
    const breath = 0.5 + 0.5 * Math.sin(this.breathTime * BREACH_BREATH_SPEED);
    for (const rig of this.rigs) {
      this.applyBreathingPosition(
        rig.bones.Abdomen,
        rig.breathingBasePositions.Abdomen,
        BREACH_BREATH_ABDOMEN_Y * breath,
      );
      this.applyBreathingPosition(
        rig.bones.Torso,
        rig.breathingBasePositions.Torso,
        BREACH_BREATH_TORSO_Y * breath,
      );
      this.applyBreathingPosition(
        rig.bones.Neck,
        rig.breathingBasePositions.Neck,
        BREACH_BREATH_NECK_Y * breath,
      );
    }
  }

  public resetBreathing(): void {
    this.breathTime = 0;
    for (const rig of this.rigs) {
      for (const name of BREATHING_BONE_NAMES) {
        this.resetBreathingPosition(rig.bones[name], rig.breathingBasePositions[name]);
      }
    }
  }

  /**
   * Snapshot the right-arm pose (pistol hold) so we can re-apply it after the
   * jump clip, which only animates the legs/torso.
   */
  public captureJumpRightArmPose(): void {
    const bones: RightArmPoseBoneName[] = ['ShoulderR', 'UpperArmR', 'LowerArmR', 'PalmR'];
    for (const rig of this.rigs) {
      const pose: AnimatedRig['frozenJumpRightArmPose'] = {};
      for (const bone of bones) {
        pose[bone] = rig.bones[bone]?.quaternion.clone();
      }
      rig.frozenJumpRightArmPose = pose;
    }
  }

  public restoreJumpRightArmPose(): void {
    const bones: RightArmPoseBoneName[] = ['ShoulderR', 'UpperArmR', 'LowerArmR', 'PalmR'];
    for (const rig of this.rigs) {
      for (const bone of bones) {
        const quat = rig.frozenJumpRightArmPose[bone];
        const target = rig.bones[bone];
        if (quat && target) target.quaternion.copy(quat);
      }
    }
  }

  private applyBreathingPosition(
    bone: THREE.Bone | undefined,
    base: THREE.Vector3 | undefined,
    yOffset: number,
  ): void {
    if (!bone || !base) return;
    bone.position.set(base.x, base.y + yOffset, base.z);
  }

  private resetBreathingPosition(
    bone: THREE.Bone | undefined,
    base: THREE.Vector3 | undefined,
  ): void {
    if (!bone || !base) return;
    bone.position.copy(base);
  }
}

function collectPoseBones(root: THREE.Group): Partial<Record<PoseBoneName, THREE.Bone>> {
  const bones: Partial<Record<PoseBoneName, THREE.Bone>> = {};
  for (const name of POSE_BONE_NAMES) {
    const node = root.getObjectByName(name);
    if (node instanceof THREE.Bone) bones[name] = node;
  }
  return bones;
}

function captureBreathingBasePositions(
  root: THREE.Group,
): Partial<Record<BreathingBoneName, THREE.Vector3>> {
  const positions: Partial<Record<BreathingBoneName, THREE.Vector3>> = {};
  for (const name of BREATHING_BONE_NAMES) {
    const node = root.getObjectByName(name);
    if (node instanceof THREE.Bone) positions[name] = node.position.clone();
  }
  return positions;
}
