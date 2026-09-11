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
  private maxRadius = 55; // Joystick radius pixels

  public static getInstance(): TouchController {
    if (!TouchController.instance) {
      TouchController.instance = new TouchController();
    }
    return TouchController.instance;
  }

  public handleTouchStart = (e: TouchEvent): void => {
    // Check for two-finger pinch gesture
    if (e.touches.length >= 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      this.state.isPinching = true;
      this.state.pinchDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      return;
    }

    const halfWidth = window.innerWidth / 2;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      // Left half of screen -> virtual movement joystick
      if (touch.clientX < halfWidth && this.movementTouchId === null) {
        this.movementTouchId = touch.identifier;
        this.state.joystickActive = true;
        this.state.joystickOrigin = { x: touch.clientX, y: touch.clientY };
        this.state.joystickCurrent = { x: touch.clientX, y: touch.clientY };
      }
      // Right half of screen -> look camera drag
      else if (touch.clientX >= halfWidth && this.lookTouchId === null) {
        this.lookTouchId = touch.identifier;
        this.state.touchLookActive = true;
        this.state.lastTouchLook = { x: touch.clientX, y: touch.clientY };
      }
    }
  };

  public handleTouchMove = (e: TouchEvent): void => {
    // Handle pinch zoom
    if (e.touches.length >= 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentPinch = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      if (this.state.isPinching && this.state.pinchDistance > 0) {
        const pinchDelta = (this.state.pinchDistance - currentPinch) * 0.035;
        InputManager.addVirtualZoomDelta(pinchDelta);
      }
      this.state.pinchDistance = currentPinch;
      this.state.isPinching = true;
      return;
    }

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

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
      } else if (touch.identifier === this.lookTouchId) {
        const dx = (touch.clientX - this.state.lastTouchLook.x) * 1.6;
        const dy = (touch.clientY - this.state.lastTouchLook.y) * 1.6;

        InputManager.addVirtualLookDelta(dx, dy);
        this.state.lastTouchLook = { x: touch.clientX, y: touch.clientY };
      }
    }
  };

  public handleTouchEnd = (e: TouchEvent): void => {
    if (e.touches.length < 2) {
      this.state.isPinching = false;
      this.state.pinchDistance = 0;
    }

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      if (touch.identifier === this.movementTouchId) {
        this.movementTouchId = null;
        this.state.joystickActive = false;
        InputManager.setVirtualMovement(0, 0);
      } else if (touch.identifier === this.lookTouchId) {
        this.lookTouchId = null;
        this.state.touchLookActive = false;
      }
    }
  };
}
