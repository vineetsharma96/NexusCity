export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
  interact: boolean;
  map: boolean;
  moveX: number;
  moveZ: number;
  lookDeltaX: number;
  lookDeltaY: number;
  zoomDelta: number;
  isPointerLocked: boolean;
}

type InputListener = (state: InputState) => void;

type KeyAction = 'forward' | 'backward' | 'left' | 'right' | 'sprint' | 'jump' | 'interact';

const KEY_TO_ACTION: Record<string, KeyAction> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  Space: 'jump',
  KeyE: 'interact',
};

function isEditableElement(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as HTMLElement;
  const tag = (el.tagName || '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(el.isContentEditable);
}

class InputManagerImpl {
  private state: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jump: false,
    interact: false,
    map: false,
    moveX: 0,
    moveZ: 0,
    lookDeltaX: 0,
    lookDeltaY: 0,
    zoomDelta: 0,
    isPointerLocked: false,
  };

  private heldCodes = new Set<string>();
  private virtualActions: Record<'sprint' | 'jump' | 'interact', boolean> = {
    sprint: false,
    jump: false,
    interact: false,
  };
  private virtualMapPressed = false;
  private virtualMoveX = 0;
  private virtualMoveZ = 0;
  private uiBlocked = false;
  private domElement: HTMLElement | null = null;
  private isDraggingLook = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private listeners = new Set<InputListener>();

  private cloneState(): InputState {
    return { ...this.state };
  }

  private syncActionsFromHeld(): void {
    if (this.uiBlocked) {
      this.state.forward = false;
      this.state.backward = false;
      this.state.left = false;
      this.state.right = false;
      this.state.sprint = false;
      this.state.jump = false;
      this.state.interact = false;
      this.state.moveX = 0;
      this.state.moveZ = 0;
      return;
    }

    const hasAction = (act: KeyAction): boolean => {
      for (const code of this.heldCodes) {
        if (KEY_TO_ACTION[code] === act) return true;
      }
      return false;
    };

    this.state.forward = hasAction('forward');
    this.state.backward = hasAction('backward');
    this.state.left = hasAction('left');
    this.state.right = hasAction('right');
    this.state.sprint = hasAction('sprint') || this.virtualActions.sprint;
    this.state.jump = hasAction('jump') || this.virtualActions.jump;
    this.state.interact = hasAction('interact') || this.virtualActions.interact;
    this.recomputeAxes();
  }

  private releaseGameplayInputs(): void {
    this.heldCodes.clear();
    this.virtualActions = { sprint: false, jump: false, interact: false };
    this.virtualMapPressed = false;
    this.virtualMoveX = 0;
    this.virtualMoveZ = 0;
    this.isDraggingLook = false;
    this.state.lookDeltaX = 0;
    this.state.lookDeltaY = 0;
    this.state.zoomDelta = 0;
    this.syncActionsFromHeld();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (isEditableElement(e.target)) return;
    if (e.code === 'KeyM') {
      if (!e.repeat) {
        this.state.map = !this.state.map;
        this.notify();
      }
      return;
    }
    if (this.uiBlocked) return;
    if (KEY_TO_ACTION[e.code]) {
      this.heldCodes.add(e.code);
      this.syncActionsFromHeld();
      this.notify();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (KEY_TO_ACTION[e.code]) {
      this.heldCodes.delete(e.code);
      this.syncActionsFromHeld();
      this.notify();
    }
  };

  private onWindowBlur = () => {
    this.releaseGameplayInputs();
    this.notify();
  };

  private onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.hidden) {
      this.releaseGameplayInputs();
      this.notify();
    }
  };

  private onFocusIn = (e: FocusEvent) => {
    if (isEditableElement(e.target)) {
      this.releaseGameplayInputs();
      this.notify();
    }
  };

  private onMouseDown = (e: MouseEvent) => {
    if (this.uiBlocked) return;
    if (e.button === 0 && !this.state.isPointerLocked) {
      this.isDraggingLook = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    }
  };

  private onMouseUp = () => {
    this.isDraggingLook = false;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.uiBlocked) return;
    if (this.state.isPointerLocked) {
      this.state.lookDeltaX += e.movementX;
      this.state.lookDeltaY += e.movementY;
    } else if (this.isDraggingLook) {
      this.state.lookDeltaX += e.clientX - this.lastMouseX;
      this.state.lookDeltaY += e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    }
  };

  private onPointerLockChange = () => {
    this.state.isPointerLocked = document.pointerLockElement === this.domElement;
    if (this.state.isPointerLocked) this.isDraggingLook = false;
    this.notify();
  };

  private recomputeAxes(): void {
    if (this.uiBlocked) {
      this.state.moveX = 0;
      this.state.moveZ = 0;
      return;
    }
    const kbX = (this.state.right ? 1 : 0) - (this.state.left ? 1 : 0);
    const kbZ = (this.state.forward ? 1 : 0) - (this.state.backward ? 1 : 0);

    if (Math.abs(this.virtualMoveX) > 0.01 || Math.abs(this.virtualMoveZ) > 0.01) {
      this.state.moveX = this.virtualMoveX;
      this.state.moveZ = this.virtualMoveZ;
    } else {
      this.state.moveX = kbX;
      this.state.moveZ = kbZ;
    }
  }

  public init(domElement: HTMLElement): void {
    this.dispose();
    this.domElement = domElement;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    domElement.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    document.addEventListener('focusin', this.onFocusIn);
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    if (this.domElement) {
      this.domElement.removeEventListener('mousedown', this.onMouseDown);
    }
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    document.removeEventListener('focusin', this.onFocusIn);
    this.domElement = null;
  }

  public requestPointerLock = (): void => {
    if (this.uiBlocked || !this.domElement?.requestPointerLock) return;
    try {
      const p = this.domElement.requestPointerLock() as unknown as Promise<void>;
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch { /* Ignore pointer lock errors, as they are non-critical and often caused by missing user interaction. */ }
  };

  public setUIBlocking(blocked: boolean): void {
    if (this.uiBlocked === blocked) return;
    this.uiBlocked = blocked;
    this.releaseGameplayInputs();
    if (blocked && typeof document !== 'undefined' && document.pointerLockElement === this.domElement) {
      document.exitPointerLock?.();
    }
    this.notify();
  }

  public isUIBlocked(): boolean {
    return this.uiBlocked;
  }

  public reset(): void {
    this.releaseGameplayInputs();
    this.state.map = false;
    this.notify();
  }

  public setVirtualMovement(x: number, z: number): void {
    if (this.uiBlocked) {
      this.virtualMoveX = 0;
      this.virtualMoveZ = 0;
      this.recomputeAxes();
      return;
    }
    this.virtualMoveX = Math.max(-1, Math.min(1, x));
    this.virtualMoveZ = Math.max(-1, Math.min(1, z));
    this.recomputeAxes();
    this.notify();
  }

  public addLookDelta(dx: number, dy: number): void {
    if (this.uiBlocked) return;
    this.state.lookDeltaX += dx;
    this.state.lookDeltaY += dy;
  }

  public addZoomDelta(dz: number): void {
    if (this.uiBlocked) return;
    this.state.zoomDelta += dz;
  }

  public setVirtualAction(action: 'sprint' | 'jump' | 'interact' | 'map', pressed: boolean): void {
    if (action === 'map') {
      if (pressed && !this.virtualMapPressed) {
        this.state.map = !this.state.map;
        this.virtualMapPressed = true;
        this.notify();
      } else if (!pressed) {
        this.virtualMapPressed = false;
      }
      return;
    }
    if (this.uiBlocked && pressed) return;
    this.virtualActions[action] = pressed;
    this.syncActionsFromHeld();
    this.notify();
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

  public getState(): InputState {
    return this.cloneState();
  }

  public subscribe(listener: InputListener): () => void {
    this.listeners.add(listener);
    listener(this.cloneState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const snap = this.cloneState();
    this.listeners.forEach((l) => l({ ...snap }));
  }
}

export const InputManager = new InputManagerImpl();
