import { COUNTDOWN_SECONDS, ROUND_END_DELAY } from '../../../shared/constants';
import type { GamePhase } from '../render/hud';

/**
 * Tracks round lifecycle state: LOBBY → COUNTDOWN → PLAYING → ROUND_END.
 *
 * This class owns the timer and phase transitions; scheduling the actual
 * "new round" effects (arena regen, player reset, etc.) stays in the caller
 * via the `onBeginRound` callback so domain wiring lives in one place.
 */
export class RoundController {
  private phase: GamePhase = 'LOBBY';
  private countdownTimer = COUNTDOWN_SECONDS;

  public onBeginRound: (() => void) | null = null;
  public onCountdownEnd: (() => void) | null = null;

  public getPhase(): GamePhase {
    return this.phase;
  }

  public getCountdown(): number {
    return this.countdownTimer;
  }

  public startCountdown(): void {
    this.phase = 'COUNTDOWN';
    this.countdownTimer = COUNTDOWN_SECONDS;
  }

  public tick(dt: number): void {
    if (this.phase !== 'COUNTDOWN') return;
    this.countdownTimer -= dt;
    if (this.countdownTimer <= 0) {
      this.countdownTimer = 0;
      this.phase = 'PLAYING';
      this.onCountdownEnd?.();
    }
  }

  public endRound(): void {
    this.phase = 'ROUND_END';
    setTimeout(() => {
      this.onBeginRound?.();
    }, ROUND_END_DELAY * 1000);
  }

  public isPlaying(): boolean {
    return this.phase === 'PLAYING';
  }
}
