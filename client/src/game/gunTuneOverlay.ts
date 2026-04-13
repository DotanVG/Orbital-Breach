import type { ThirdPersonGunTuningState } from '../player/playerThirdPersonGun';

/**
 * Dev-only tuning overlay for the third-person gun. Shown only when the
 * thirdPersonGunTuning feature flag is on AND the player has the tuning
 * mode toggled on (P key).
 */
export class GunTuneOverlay {
  private readonly element: HTMLDivElement;

  public constructor() {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.right = '16px';
    overlay.style.bottom = '16px';
    overlay.style.zIndex = '30';
    overlay.style.maxWidth = '320px';
    overlay.style.padding = '10px 12px';
    overlay.style.border = '1px solid rgba(0, 255, 255, 0.5)';
    overlay.style.borderRadius = '8px';
    overlay.style.background = 'rgba(2, 8, 20, 0.82)';
    overlay.style.color = '#cfffff';
    overlay.style.font = '12px/1.45 monospace';
    overlay.style.whiteSpace = 'pre-line';
    overlay.style.pointerEvents = 'none';
    overlay.style.display = 'none';
    document.body.appendChild(overlay);
    this.element = overlay;
  }

  public render(tuning: ThirdPersonGunTuningState, featureFlagOn: boolean): void {
    if (!featureFlagOn || !tuning.enabled) {
      this.element.style.display = 'none';
      return;
    }

    this.element.style.display = 'block';
    this.element.textContent = [
      'Gun Tune: ON',
      '',
      `Offset  x:${tuning.offset.x.toFixed(3)}  y:${tuning.offset.y.toFixed(3)}  z:${tuning.offset.z.toFixed(3)}`,
      `Rotate  x:${tuning.rotation.x.toFixed(3)}  y:${tuning.rotation.y.toFixed(3)}  z:${tuning.rotation.z.toFixed(3)}`,
      '',
      'Arrows/PageUp/PageDown: move',
      'I/K J/L U/O: rotate',
      'Shift: fine step',
      'Enter: print values',
      'Backspace: reset',
      'P: close tuner',
    ].join('\n');
  }
}
