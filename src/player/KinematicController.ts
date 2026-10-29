import * as THREE from 'three';
import { InputManager } from './InputManager';
import { KinematicCollisionSolver } from './KinematicCollision';
import { AudioManager } from '../audio/AudioManager';

export type GaitState = 'IDLE' | 'WALK' | 'RUN' | 'JUMP_UP' | 'FALL';

export interface KinematicState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotationY: number;
  speed: number;
  bankAngle: number;
  isGrounded: boolean;
  gait: GaitState;
}

export class KinematicController {
  public position = new THREE.Vector3(0, 0.2, 10);
  public velocity = new THREE.Vector3(0, 0, 0);
  public rotationY = 0;
  public bankAngle = 0;
  public isGrounded = true;

  private readonly walkSpeed = 6.8;
  private readonly runSpeed = 14.2;
  private readonly accel = 36.0;
  private readonly decel = 28.0;
  private readonly airControl = 0.45;
  private readonly jumpForce = 10.8;
  private readonly gravity = -26.0;
  public readonly playerRadius = 0.45;
  public readonly playerHeight = 1.8;

  private stepTimer = 0;
  private jumpHeldLastFrame = false;

  // Reusable vectors to avoid allocations in update loop
  private readonly _forward = new THREE.Vector3();
  private readonly _right = new THREE.Vector3();
  private readonly _moveDir = new THREE.Vector3();
  private readonly _currentHorizVel = new THREE.Vector3();
  private readonly _targetHorizVel = new THREE.Vector3();
  private readonly _previousPos = new THREE.Vector3();
  private readonly _nextPos = new THREE.Vector3();

  public resetMotion(): void {
    this.velocity.set(0, 0, 0);
    this.bankAngle = 0;
    this.stepTimer = 0;
  }

  public update(delta: number, cameraYaw: number): KinematicState {
    const dt = Math.min(Math.max(delta, 0), 0.05);
    const input = InputManager.getState();
    const audio = AudioManager.getInstance();

    this._forward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    this._right.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));

    this._moveDir.set(0, 0, 0)
      .addScaledVector(this._right, input.moveX)
      .addScaledVector(this._forward, input.moveZ);

    const inputLen = this._moveDir.length();
    if (inputLen > 0.01) this._moveDir.normalize();

    const targetMaxSpeed = input.sprint ? this.runSpeed : this.walkSpeed;
    const targetSpeed = inputLen > 0.01 ? targetMaxSpeed * Math.min(1, inputLen) : 0;

    this._currentHorizVel.set(this.velocity.x, 0, this.velocity.z);
    this._targetHorizVel.copy(this._moveDir).multiplyScalar(targetSpeed);

    const controlMult = this.isGrounded ? 1.0 : this.airControl;
    const rate = (inputLen > 0.01 ? this.accel : this.decel) * controlMult;

    this._currentHorizVel.lerp(this._targetHorizVel, 1 - Math.exp(-rate * dt));
    this.velocity.x = this._currentHorizVel.x;
    this.velocity.z = this._currentHorizVel.z;

    this._previousPos.copy(this.position);
    this._nextPos.copy(this.position);
    this._nextPos.x += this.velocity.x * dt;
    this._nextPos.z += this.velocity.z * dt;

    const resolvedPos = KinematicCollisionSolver.resolveHorizontal(
      this._nextPos,
      this.playerRadius,
      this.playerHeight,
      this._previousPos
    );
    this.position.x = resolvedPos.x;
    this.position.z = resolvedPos.z;
    if (dt > 0) {
      this.velocity.x = (resolvedPos.x - this._previousPos.x) / dt;
      this.velocity.z = (resolvedPos.z - this._previousPos.z) / dt;
    }

    const groundInfo = KinematicCollisionSolver.getGroundHeightAt(this.position.x, this.position.z, this.position.y);
    const groundY = groundInfo.height;
    const jumpJustPressed = input.jump && !this.jumpHeldLastFrame;
    this.jumpHeldLastFrame = input.jump;

    if (this.isGrounded && this.position.y > groundY + 0.08) {
      this.isGrounded = false;
    }

    if (this.isGrounded) {
      this.position.y = groundY;
      this.velocity.y = 0;

      if (jumpJustPressed) {
        this.velocity.y = this.jumpForce;
        this.isGrounded = false;
        audio.playJump();
      }
    } else {
      this.velocity.y += this.gravity * dt;
      this.position.y += this.velocity.y * dt;

      if (this.velocity.y > 0) {
        const ceilingY = KinematicCollisionSolver.getCeilingHeightAt(
          this.position.x,
          this.position.z,
          this._previousPos.y,
          this.playerRadius,
          this.playerHeight
        );
        const maxBottomY = ceilingY - this.playerHeight;
        if (this.position.y >= maxBottomY) {
          this.position.y = Math.max(groundY, maxBottomY);
          this.velocity.y = 0;
        }
      }

      if (this.position.y <= groundY) {
        this.position.y = groundY;
        if (this.velocity.y < -4.0) audio.playLand();
        this.velocity.y = 0;
        this.isGrounded = true;
      }
    }

    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (horizSpeed > 0.25) {
      const targetAngle = Math.atan2(this.velocity.x, this.velocity.z);
      let diff = targetAngle - this.rotationY;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;

      this.rotationY += diff * (1 - Math.exp(-16 * dt));
      const targetBank = THREE.MathUtils.clamp(-diff * (horizSpeed / this.runSpeed) * 0.35, -0.25, 0.25);
      this.bankAngle = THREE.MathUtils.lerp(this.bankAngle, targetBank, 1 - Math.exp(-12 * dt));
    } else {
      this.bankAngle = THREE.MathUtils.lerp(this.bankAngle, 0, 1 - Math.exp(-12 * dt));
    }

    let gait: GaitState = 'IDLE';
    if (!this.isGrounded) {
      gait = this.velocity.y > 0 ? 'JUMP_UP' : 'FALL';
    } else if (horizSpeed > 0.25) {
      gait = input.sprint && horizSpeed > this.walkSpeed * 0.9 ? 'RUN' : 'WALK';
      const stepInterval = gait === 'RUN' ? 0.28 : 0.44;
      this.stepTimer += dt;
      if (this.stepTimer >= stepInterval) {
        this.stepTimer = 0;
        audio.playFootstep(gait === 'RUN');
      }
    } else {
      this.stepTimer = 0.2;
    }

    return {
      position: this.position,
      velocity: this.velocity,
      rotationY: this.rotationY,
      speed: horizSpeed,
      bankAngle: this.bankAngle,
      isGrounded: this.isGrounded,
      gait,
    };
  }
}
