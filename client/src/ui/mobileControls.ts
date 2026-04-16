import { InputManager } from '../input';

const CSS = `
  .mob-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    pointer-events: none;
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
  }
  .mob-look {
    position: absolute;
    inset: 0;
    pointer-events: all;
    touch-action: none;
  }
  .mob-joystick-zone {
    position: absolute;
    bottom: calc(48px + env(safe-area-inset-bottom, 0px));
    left: 24px;
    width: 128px;
    height: 128px;
    pointer-events: all;
    touch-action: none;
    z-index: 1;
  }
  .mob-joystick-base {
    width: 128px;
    height: 128px;
    border-radius: 64px;
    background: rgba(0, 255, 255, 0.07);
    border: 2px solid rgba(0, 255, 255, 0.22);
    position: relative;
  }
  .mob-joystick-thumb {
    position: absolute;
    width: 50px;
    height: 50px;
    border-radius: 25px;
    background: rgba(0, 255, 255, 0.28);
    border: 2px solid rgba(0, 255, 255, 0.55);
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  .mob-btn {
    position: absolute;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: all;
    touch-action: none;
    font-family: 'Share Tech Mono', monospace;
    font-size: 10px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    transition: background 0.08s ease, border-color 0.08s ease;
    -webkit-tap-highlight-color: transparent;
    z-index: 1;
  }
  .mob-btn-fire {
    width: 80px;
    height: 80px;
    bottom: calc(48px + env(safe-area-inset-bottom, 0px));
    right: 28px;
    background: rgba(255, 50, 100, 0.15);
    border: 2px solid rgba(255, 50, 100, 0.38);
    color: rgba(255, 120, 150, 0.8);
  }
  .mob-btn-fire.mob-pressed {
    background: rgba(255, 50, 100, 0.45);
    border-color: rgba(255, 50, 100, 0.8);
  }
  .mob-btn-jump {
    width: 64px;
    height: 64px;
    bottom: calc(148px + env(safe-area-inset-bottom, 0px));
    right: 40px;
    background: rgba(0, 255, 255, 0.12);
    border: 2px solid rgba(0, 255, 255, 0.28);
    color: rgba(0, 220, 255, 0.75);
  }
  .mob-btn-jump.mob-pressed {
    background: rgba(0, 255, 255, 0.35);
    border-color: rgba(0, 255, 255, 0.65);
  }
  .mob-btn-grab {
    width: 60px;
    height: 60px;
    bottom: calc(52px + env(safe-area-inset-bottom, 0px));
    right: 128px;
    background: rgba(255, 200, 0, 0.12);
    border: 2px solid rgba(255, 200, 0, 0.28);
    color: rgba(255, 200, 0, 0.75);
  }
  .mob-btn-grab.mob-pressed {
    background: rgba(255, 200, 0, 0.38);
    border-color: rgba(255, 200, 0, 0.65);
  }
`;

export class MobileControls {
  private container: HTMLDivElement;
  private lookArea: HTMLDivElement;
  private joystickBase: HTMLDivElement;
  private joystickThumb: HTMLDivElement;
  private fireBtn: HTMLDivElement;
  private jumpBtn: HTMLDivElement;
  private grabBtn: HTMLDivElement;

  private joystickPointerId = -1;
  private joystickCenterX = 0;
  private joystickCenterY = 0;
  private readonly JOYSTICK_RADIUS = 52;

  private lookPointers = new Map<number, { x: number; y: number }>();

  private styleEl: HTMLStyleElement | null = null;
  private input: InputManager;

  constructor(input: InputManager) {
    this.input = input;

    this.styleEl = document.createElement('style');
    this.styleEl.textContent = CSS;
    document.head.appendChild(this.styleEl);

    this.container = document.createElement('div');
    this.container.className = 'mob-overlay';

    // Look area covers the full screen; joystick and buttons sit on top (z-index: 1)
    this.lookArea = document.createElement('div');
    this.lookArea.className = 'mob-look';
    this.container.appendChild(this.lookArea);

    // Joystick
    const joystickZone = document.createElement('div');
    joystickZone.className = 'mob-joystick-zone';
    this.joystickBase = document.createElement('div');
    this.joystickBase.className = 'mob-joystick-base';
    this.joystickThumb = document.createElement('div');
    this.joystickThumb.className = 'mob-joystick-thumb';
    this.joystickBase.appendChild(this.joystickThumb);
    joystickZone.appendChild(this.joystickBase);
    this.container.appendChild(joystickZone);

    // Buttons (appended after look area → higher implicit z-index within same stacking context)
    this.fireBtn = this.makeBtn('mob-btn-fire', 'FIRE');
    this.jumpBtn = this.makeBtn('mob-btn-jump', 'JUMP');
    this.grabBtn = this.makeBtn('mob-btn-grab', 'GRAB');
    this.container.appendChild(this.fireBtn);
    this.container.appendChild(this.jumpBtn);
    this.container.appendChild(this.grabBtn);

    this.bindLookArea();
    this.bindJoystick();
    this.bindButton(this.fireBtn,
      () => this.input.setMobileFireHeld(true),
      () => this.input.setMobileFireHeld(false),
    );
    this.bindButton(this.jumpBtn,
      () => this.input.setMobileJumpHeld(true),
      () => this.input.setMobileJumpHeld(false),
    );
    this.bindButton(this.grabBtn,
      () => this.input.pressMobileGrab(),
      () => { /* grab is one-shot, no release action */ },
    );
  }

  public mount(): void {
    document.body.appendChild(this.container);
  }

  public show(): void {
    this.container.style.display = '';
  }

  public hide(): void {
    this.container.style.display = 'none';
    this.input.setMobileFireHeld(false);
    this.input.setMobileJumpHeld(false);
    this.input.setMobileMoveAxes(0, 0);
  }

  public isVisible(): boolean {
    return this.container.style.display !== 'none';
  }

  private makeBtn(className: string, label: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = `mob-btn ${className}`;
    el.textContent = label;
    return el;
  }

  private bindLookArea(): void {
    this.lookArea.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.lookArea.setPointerCapture(e.pointerId);
      this.lookPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });

    this.lookArea.addEventListener('pointermove', (e) => {
      const prev = this.lookPointers.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      this.input.setMobileLookDelta(dx, dy);
      this.lookPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });

    const endLook = (e: PointerEvent): void => {
      this.lookPointers.delete(e.pointerId);
    };
    this.lookArea.addEventListener('pointerup', endLook);
    this.lookArea.addEventListener('pointercancel', endLook);
  }

  private bindJoystick(): void {
    this.joystickBase.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation(); // don't let look area pick up this touch
      if (this.joystickPointerId !== -1) return;
      this.joystickPointerId = e.pointerId;
      this.joystickBase.setPointerCapture(e.pointerId);
      const rect = this.joystickBase.getBoundingClientRect();
      this.joystickCenterX = rect.left + rect.width / 2;
      this.joystickCenterY = rect.top + rect.height / 2;
      this.updateJoystick(e.clientX, e.clientY);
    });

    this.joystickBase.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joystickPointerId) return;
      this.updateJoystick(e.clientX, e.clientY);
    });

    const endJoystick = (e: PointerEvent): void => {
      if (e.pointerId !== this.joystickPointerId) return;
      this.joystickPointerId = -1;
      this.joystickThumb.style.transform = 'translate(-50%, -50%)';
      this.input.setMobileMoveAxes(0, 0);
    };
    this.joystickBase.addEventListener('pointerup', endJoystick);
    this.joystickBase.addEventListener('pointercancel', endJoystick);
  }

  private updateJoystick(clientX: number, clientY: number): void {
    const dx = clientX - this.joystickCenterX;
    const dy = clientY - this.joystickCenterY;
    const len = Math.sqrt(dx * dx + dy * dy);
    const clamped = Math.min(len, this.JOYSTICK_RADIUS);
    const nx = len > 0 ? dx / len : 0;
    const ny = len > 0 ? dy / len : 0;

    this.joystickThumb.style.transform =
      `translate(calc(-50% + ${nx * clamped}px), calc(-50% + ${ny * clamped}px))`;

    // normX: right = +1 (strafe right), normZ: up on screen = +1 (forward)
    this.input.setMobileMoveAxes(
      nx * (clamped / this.JOYSTICK_RADIUS),
      -ny * (clamped / this.JOYSTICK_RADIUS),
    );
  }

  private bindButton(
    el: HTMLDivElement,
    onDown: () => void,
    onUp: () => void,
  ): void {
    const active = new Set<number>();

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      active.add(e.pointerId);
      el.classList.add('mob-pressed');
      onDown();
    });

    const end = (e: PointerEvent): void => {
      active.delete(e.pointerId);
      if (active.size === 0) {
        el.classList.remove('mob-pressed');
        onUp();
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
}
