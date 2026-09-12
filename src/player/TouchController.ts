import { InputManager } from './InputManager';

export interface TouchState {
  joystickActive: boolean;
  joystickOrigin: { x: number; y: number };
  joystickCurrent: { x: number; y: number };
  touchLookActive: boolean;
  lastTouchLook: { x: number; y: number };
  isPinching: boolean;
  pinchDistance: number;
}

export class TouchController {
  private static instance: TouchController;
  public state: TouchState = {
    joystickActive: false,
    joystickOrigin: { x: 0, y: 0 },
    joystickCurrent: { x: 0, y: 0 },
    touchLookActive: false,
    lastTouchLook: { x: 0, y: 0 },
    isPinching: false,
    pinchDistance: 0,
  };

  private movementTouchId: number | null = null;
  private lookTouchId: number | null = null;
  private pinchSecondaryTouchId: number | null = null;
  private maxRadius = 55; // Joystick radius pixels

  public static getInstance(): TouchController {
    if (!TouchController.instance) {
      TouchController.instance = new TouchController();
    }
    return TouchController.instance;
  }

  public handleTouchStart = (e: TouchEvent): void => {
    const halfWidth = window.innerWidth * 0.45; // Left 45% of screen is joystick

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      // 1. Left side -> virtual movement joystick
      if (touch.clientX < halfWidth) {
        if (this.movementTouchId === null) {
          this.movementTouchId = touch.identifier;
          this.state.joystickActive = true;
          this.state.joystickOrigin = { x: touch.clientX, y: touch.clientY };
          this.state.joystickCurrent = { x: touch.clientX, y: touch.clientY };
        }
      }
      // 2. Right side -> look camera drag or second finger for pinch
      else {
        if (this.lookTouchId === null) {
          this.lookTouchId = touch.identifier;
          this.state.touchLookActive = true;
          this.state.lastTouchLook = { x: touch.clientX, y: touch.clientY };
        } else if (this.pinchSecondaryTouchId === null) {
          // Second finger on look side triggers pinch zoom
          this.pinchSecondaryTouchId = touch.identifier;
          const primaryTouch = Array.from(e.touches).find((t) => t.identifier === this.lookTouchId);
          if (primaryTouch) {
            this.state.isPinching = true;
            this.state.pinchDistance = Math.hypot(
              touch.clientX - primaryTouch.clientX,
              touch.clientY - primaryTouch.clientY
            );
          }
        }
      }
    }
  };

  public handleTouchMove = (e: TouchEvent): void => {
    // 1. Handle pinch zoom if two fingers on right side
    if (this.state.isPinching && this.lookTouchId !== null && this.pinchSecondaryTouchId !== null) {
      const t1 = Array.from(e.touches).find((t) => t.identifier === this.lookTouchId);
      const t2 = Array.from(e.touches).find((t) => t.identifier === this.pinchSecondaryTouchId);

      if (t1 && t2) {
        const currentPinch = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        if (this.state.pinchDistance > 0) {
          const pinchDelta = (this.state.pinchDistance - currentPinch) * 0.035;
          InputManager.addVirtualZoomDelta(pinchDelta);
        }
        this.state.pinchDistance = currentPinch;
      }
    }

    // 2. Process all touch movements independently (simultaneous joystick + look)
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      // Left thumb steering joystick
      if (touch.identifier === this.movementTouchId) {
        this.state.joystickCurrent = { x: touch.clientX, y: touch.clientY };

        const dx = touch.clientX - this.state.joystickOrigin.x;
        const dy = touch.clientY - this.state.joystickOrigin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let normX = 0;
        let normZ = 0;

        if (dist > 0) {
          const clampedDist = Math.min(dist, this.maxRadius);
          normX = (dx / dist) * (clampedDist / this.maxRadius);
          normZ = (dy / dist) * (clampedDist / this.maxRadius);
        }

        InputManager.setVirtualMovement(normX, normZ);
      }
      // Right thumb orbiting camera
      else if (touch.identifier === this.lookTouchId) {
        if (!this.state.isPinching) {
          const dx = (touch.clientX - this.state.lastTouchLook.x) * 1.8;
          const dy = (touch.clientY - this.state.lastTouchLook.y) * 1.8;

          InputManager.addVirtualLookDelta(dx, dy);
          this.state.lastTouchLook = { x: touch.clientX, y: touch.clientY };
        }
      }
    }
  };

  public handleTouchEnd = (e: TouchEvent): void => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      if (touch.identifier === this.movementTouchId) {
        this.movementTouchId = null;
        this.state.joystickActive = false;
        InputManager.setVirtualMovement(0, 0);
      } else if (touch.identifier === this.lookTouchId) {
        this.lookTouchId = null;
        this.state.touchLookActive = false;
        this.state.isPinching = false;
        this.state.pinchDistance = 0;
      } else if (touch.identifier === this.pinchSecondaryTouchId) {
        this.pinchSecondaryTouchId = null;
        this.state.isPinching = false;
        this.state.pinchDistance = 0;
      }
    }
  };
}
