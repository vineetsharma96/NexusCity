import { InputManager } from './InputManager';

export interface TouchPoint {
  identifier: number;
  clientX: number;
  clientY: number;
}

export interface TouchControllerState {
  joystickActive: boolean;
  joystickOrigin: { x: number; y: number };
  joystickCurrent: { x: number; y: number };
  joystickVector: { x: number; y: number };
  lookActive: boolean;
  pinchActive: boolean;
}

type TouchListener = (state: TouchControllerState) => void;

export class TouchController {
  private static instance: TouchController;
  private moveTouchId: number | null = null;
  private lookTouchId: number | null = null;
  private pinchTouchId: number | null = null;

  private joyOrigin = { x: 0, y: 0 };
  private joyCurrent = { x: 0, y: 0 };
  private joyVector = { x: 0, y: 0 };
  private readonly maxRadius = 56;

  private lastLookPos = { x: 0, y: 0 };
  private lastPinchDist = 0;
  private listeners = new Set<TouchListener>();

  private constructor() {}

  public static getInstance(): TouchController {
    if (!TouchController.instance) {
      TouchController.instance = new TouchController();
    }
    return TouchController.instance;
  }

  public handleTouchStart(e: { changedTouches: ArrayLike<TouchPoint>; touches: ArrayLike<TouchPoint> }): void {
    if (InputManager.isUIBlocked()) return;
    const halfWidth = (typeof window !== 'undefined' ? window.innerWidth : 1280) * 0.45;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.clientX < halfWidth && this.moveTouchId === null) {
        this.moveTouchId = t.identifier;
        this.joyOrigin = { x: t.clientX, y: t.clientY };
        this.joyCurrent = { x: t.clientX, y: t.clientY };
        this.joyVector = { x: 0, y: 0 };
      } else if (this.lookTouchId === null) {
        this.lookTouchId = t.identifier;
        this.lastLookPos = { x: t.clientX, y: t.clientY };
      } else if (this.pinchTouchId === null) {
        this.pinchTouchId = t.identifier;
        const lookTouch = this.findTouch(e.touches, this.lookTouchId);
        if (lookTouch) {
          this.lastPinchDist = Math.hypot(t.clientX - lookTouch.clientX, t.clientY - lookTouch.clientY);
        }
      }
    }
    this.notify();
  }

  public handleTouchMove(e: { changedTouches: ArrayLike<TouchPoint>; touches: ArrayLike<TouchPoint> }): void {
    if (InputManager.isUIBlocked()) return;

    if (this.lookTouchId !== null && this.pinchTouchId !== null) {
      const t1 = this.findTouch(e.touches, this.lookTouchId);
      const t2 = this.findTouch(e.touches, this.pinchTouchId);
      if (t1 && t2) {
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        if (this.lastPinchDist > 0) {
          InputManager.addZoomDelta((this.lastPinchDist - dist) * 0.04);
        }
        this.lastPinchDist = dist;
        this.lastLookPos = { x: t1.clientX, y: t1.clientY };
      }
    }

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this.moveTouchId) {
        const dx = t.clientX - this.joyOrigin.x;
        const dy = t.clientY - this.joyOrigin.y;
        const dist = Math.hypot(dx, dy);
        const clamped = Math.min(dist, this.maxRadius);
        const angle = Math.atan2(dy, dx);

        this.joyCurrent = {
          x: this.joyOrigin.x + Math.cos(angle) * clamped,
          y: this.joyOrigin.y + Math.sin(angle) * clamped,
        };
        const normX = dist > 5 ? (Math.cos(angle) * clamped) / this.maxRadius : 0;
        const normY = dist > 5 ? (Math.sin(angle) * clamped) / this.maxRadius : 0;
        this.joyVector = { x: normX, y: -normY };
        InputManager.setVirtualMovement(normX, -normY);
        InputManager.setVirtualAction('sprint', clamped > this.maxRadius * 0.88);
      } else if (t.identifier === this.lookTouchId && this.pinchTouchId === null) {
        const dx = t.clientX - this.lastLookPos.x;
        const dy = t.clientY - this.lastLookPos.y;
        this.lastLookPos = { x: t.clientX, y: t.clientY };
        InputManager.addLookDelta(dx * 1.4, dy * 1.4);
      }
    }
    this.notify();
  }

  public handleTouchEnd(e: { changedTouches: ArrayLike<TouchPoint>; touches: ArrayLike<TouchPoint> }): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this.moveTouchId) {
        this.moveTouchId = null;
        this.joyVector = { x: 0, y: 0 };
        InputManager.setVirtualMovement(0, 0);
        InputManager.setVirtualAction('sprint', false);
      } else if (t.identifier === this.lookTouchId) {
        if (this.pinchTouchId !== null) {
          const remaining = this.findTouch(e.touches, this.pinchTouchId);
          this.lookTouchId = this.pinchTouchId;
          this.pinchTouchId = null;
          this.lastPinchDist = 0;
          if (remaining) this.lastLookPos = { x: remaining.clientX, y: remaining.clientY };
        } else {
          this.lookTouchId = null;
        }
      } else if (t.identifier === this.pinchTouchId) {
        this.pinchTouchId = null;
        this.lastPinchDist = 0;
        const remaining = this.lookTouchId !== null ? this.findTouch(e.touches, this.lookTouchId) : null;
        if (remaining) this.lastLookPos = { x: remaining.clientX, y: remaining.clientY };
      }
    }
    this.notify();
  }

  private findTouch(touches: ArrayLike<TouchPoint>, id: number): TouchPoint | null {
    for (let i = 0; i < touches.length; i++) {
      if (touches[i].identifier === id) return touches[i];
    }
    return null;
  }

  public reset(): void {
    this.moveTouchId = null;
    this.lookTouchId = null;
    this.pinchTouchId = null;
    this.joyVector = { x: 0, y: 0 };
    this.lastPinchDist = 0;
    InputManager.setVirtualMovement(0, 0);
    InputManager.setVirtualAction('sprint', false);
    this.notify();
  }

  public getState(): TouchControllerState {
    return {
      joystickActive: this.moveTouchId !== null,
      joystickOrigin: this.joyOrigin,
      joystickCurrent: this.joyCurrent,
      joystickVector: this.joyVector,
      lookActive: this.lookTouchId !== null,
      pinchActive: this.pinchTouchId !== null,
    };
  }

  public subscribe(listener: TouchListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }
}
