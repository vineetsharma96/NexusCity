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

  public init(canvasElement?: HTMLElement): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
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
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    this.initialized = false;
  }

  public getState(): InputState {
    return this.state;
  }

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
    this.state.zoomDelta += dz;
  }

  public requestPointerLock = (): void => {
    if (typeof document !== 'undefined' && !document.pointerLockElement) {
      document.body.requestPointerLock?.();
    }
  };

  public exitPointerLock = (): void => {
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  };

  private handlePointerLockChange = (): void => {
    this.state.isPointerLocked = !!document.pointerLockElement;
    this.notify();
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    this.updateKey(e.code, true);
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.updateKey(e.code, false);
  };

  private updateKey(code: string, isDown: boolean): void {
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
    if (this.state.isPointerLocked) {
      this.state.lookDeltaX += e.movementX;
      this.state.lookDeltaY += e.movementY;
    }
  };

  // Direct injection for mobile touch joystick
  public setVirtualMovement(moveX: number, moveZ: number): void {
    this.state.moveX = moveX;
    this.state.moveZ = moveZ;
    this.state.forward = moveZ < -0.15;
    this.state.backward = moveZ > 0.15;
    this.state.left = moveX < -0.15;
    this.state.right = moveX > 0.15;
    this.notify();
  }

  public addVirtualLookDelta(dx: number, dy: number): void {
    this.state.lookDeltaX += dx;
    this.state.lookDeltaY += dy;
  }

  public setVirtualAction(action: 'jump' | 'sprint' | 'interact' | 'map', active: boolean): void {
    if (action === 'map' && active) {
      this.state.map = !this.state.map;
    } else {
      this.state[action] = active;
    }
    this.notify();
  }

  public subscribe(listener: (s: InputState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.state));
  }
}

export const InputManager = new InputManagerClass();
