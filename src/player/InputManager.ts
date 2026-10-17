export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  interact: boolean;
  map: boolean;
  menu: boolean;
  // Normalized analog axis [-1 .. 1]
  moveX: number;
  moveZ: number;
  // Mouse / Touch rotation deltas
  lookDeltaX: number;
  lookDeltaY: number;
  zoomDelta: number;
  isPointerLocked: boolean;
}

class InputManagerClass {
  private state: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    interact: false,
    map: false,
    menu: false,
    moveX: 0,
    moveZ: 0,
    lookDeltaX: 0,
    lookDeltaY: 0,
    zoomDelta: 0,
    isPointerLocked: false,
  };

  private listeners: Set<(s: InputState) => void> = new Set();
  private initialized = false;
  private canvasElement?: HTMLElement;
  private uiBlocking = false;
  private pressedKeys = new Set<string>();

  public init(canvasElement?: HTMLElement): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;
    this.canvasElement = canvasElement;

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('blur', this.reset);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    document.addEventListener('focusin', this.handleFocusIn);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);

    if (canvasElement) {
      canvasElement.addEventListener('click', this.requestPointerLock);
    }
  }

  public dispose(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('blur', this.reset);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    document.removeEventListener('focusin', this.handleFocusIn);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    this.canvasElement?.removeEventListener('click', this.requestPointerLock);
    this.reset();
    this.canvasElement = undefined;
    this.state.isPointerLocked = false;
    this.state.lookDeltaX = 0;
    this.state.lookDeltaY = 0;
    this.state.zoomDelta = 0;
    this.initialized = false;
  }

  public getState(): InputState {
    return this.state;
  }

  public isUIBlocked(): boolean {
    return this.uiBlocking;
  }

  public setUIBlocking(blocked: boolean): void {
    if (this.uiBlocking === blocked) return;
    this.uiBlocking = blocked;
    this.reset();
    if (blocked) this.exitPointerLock();
  }

  public reset = (): void => {
    this.pressedKeys.clear();
    Object.assign(this.state, {
      forward: false, backward: false, left: false, right: false,
      jump: false, sprint: false, interact: false, menu: false,
      moveX: 0, moveZ: 0, lookDeltaX: 0, lookDeltaY: 0, zoomDelta: 0,
    });
    this.notify();
  };

  private isEditable(target: EventTarget | null): boolean {
    return target instanceof HTMLElement &&
      (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) this.reset();
  };

  private handleFocusIn = (event: FocusEvent): void => {
    if (this.isEditable(event.target)) this.reset();
  };

  public consumeLookDelta(): { dx: number; dy: number } {
    const dx = this.state.lookDeltaX;
    const dy = this.state.lookDeltaY;
    this.state.lookDeltaX = 0;
    this.state.lookDeltaY = 0;
    return { dx, dy };
  }

  public consumeZoomDelta(): number {
    const dz = this.state.zoomDelta;
    this.state.zoomDelta = 0;
    return dz;
  }

  public addVirtualZoomDelta(dz: number): void {
    if (this.uiBlocking) return;
    this.state.zoomDelta += dz;
  }

  public requestPointerLock = (): void => {
    if (!this.uiBlocking && typeof document !== 'undefined' && !document.pointerLockElement) {
      const request = this.canvasElement?.requestPointerLock?.();
      request?.catch(() => { /* The browser can refuse lock after Escape or without a user gesture. */ });
    }
  };

  public exitPointerLock = (): void => {
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  };

  private handlePointerLockChange = (): void => {
    this.state.isPointerLocked = document.pointerLockElement === this.canvasElement;
    this.state.lookDeltaX = 0;
    this.state.lookDeltaY = 0;
    this.notify();
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat || this.isEditable(e.target)) return;
    if (this.uiBlocking && e.code !== 'KeyM' && e.code !== 'Escape') return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    this.updateKey(e.code, true);
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.updateKey(e.code, false);
  };

  private updateKey(code: string, isDown: boolean): void {
    if (isDown) this.pressedKeys.add(code);
    else this.pressedKeys.delete(code);
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        this.state.forward = isDown;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.state.backward = isDown;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.state.left = isDown;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.state.right = isDown;
        break;
      case 'Space':
        this.state.jump = isDown;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.state.sprint = isDown;
        break;
      case 'KeyE':
        this.state.interact = isDown;
        break;
      case 'KeyM':
        if (isDown) this.state.map = !this.state.map;
        break;
      case 'Escape':
        this.state.menu = isDown;
        break;
    }

    // Keep aliases independent: releasing an arrow must not release a held WASD key.
    this.state.forward = this.pressedKeys.has('KeyW') || this.pressedKeys.has('ArrowUp');
    this.state.backward = this.pressedKeys.has('KeyS') || this.pressedKeys.has('ArrowDown');
    this.state.left = this.pressedKeys.has('KeyA') || this.pressedKeys.has('ArrowLeft');
    this.state.right = this.pressedKeys.has('KeyD') || this.pressedKeys.has('ArrowRight');
    this.state.sprint = this.pressedKeys.has('ShiftLeft') || this.pressedKeys.has('ShiftRight');

    // Recompute digital move axis
    let z = 0;
    let x = 0;
    if (this.state.forward) z -= 1;
    if (this.state.backward) z += 1;
    if (this.state.left) x -= 1;
    if (this.state.right) x += 1;

    // Normalize if diagonal
    if (x !== 0 && z !== 0) {
      const invLen = 1 / Math.SQRT2;
      x *= invLen;
      z *= invLen;
    }

    this.state.moveX = x;
    this.state.moveZ = z;
    this.notify();
  }

  private handleMouseMove = (e: MouseEvent): void => {
    if (this.state.isPointerLocked && !this.uiBlocking) {
      this.state.lookDeltaX += e.movementX;
      this.state.lookDeltaY += e.movementY;
    }
  };

  // Direct injection for mobile touch joystick
  public setVirtualMovement(moveX: number, moveZ: number): void {
    if (this.uiBlocking) return;
    this.state.moveX = moveX;
    this.state.moveZ = moveZ;
    this.state.forward = moveZ < -0.15;
    this.state.backward = moveZ > 0.15;
    this.state.left = moveX < -0.15;
    this.state.right = moveX > 0.15;
    this.notify();
  }

  public addVirtualLookDelta(dx: number, dy: number): void {
    if (this.uiBlocking) return;
    this.state.lookDeltaX += dx;
    this.state.lookDeltaY += dy;
  }

  public setVirtualAction(action: 'jump' | 'sprint' | 'interact' | 'map', active: boolean): void {
    if (this.uiBlocking && action !== 'map') return;
    if (action === 'map') {
      if (active) this.state.map = !this.state.map;
    } else {
      this.state[action] = active;
    }
    this.notify();
  }

  public subscribe(listener: (s: InputState) => void): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const snapshot = { ...this.state };
    this.listeners.forEach((l) => l(snapshot));
  }
}

export const InputManager = new InputManagerClass();
