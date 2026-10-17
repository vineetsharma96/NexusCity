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

  public resetMotion(): void {
    this.velocity.set(0, 0, 0);
    this.bankAngle = 0;
    this.stepTimer = 0;
  }

  public update(delta: number, cameraYaw: number): KinematicState {
    const dt = Math.min(Math.max(delta, 0), 0.05);
    const input = InputManager.getState();
    const audio = AudioManager.getInstance();

    const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));

    const moveDir = new THREE.Vector3()
      .addScaledVector(right, input.moveX)
      .addScaledVector(forward, input.moveZ);

    const inputLen = moveDir.length();
    if (inputLen > 0.01) moveDir.normalize();

    const targetMaxSpeed = input.sprint ? this.runSpeed : this.walkSpeed;
    const targetSpeed = inputLen > 0.01 ? targetMaxSpeed * Math.min(1, inputLen) : 0;

    const currentHorizVel = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
    const targetHorizVel = moveDir.clone().multiplyScalar(targetSpeed);

    const controlMult = this.isGrounded ? 1.0 : this.airControl;
    const rate = (inputLen > 0.01 ? this.accel : this.decel) * controlMult;

    currentHorizVel.lerp(targetHorizVel, 1 - Math.exp(-rate * dt));
    this.velocity.x = currentHorizVel.x;
    this.velocity.z = currentHorizVel.z;

    const previousPos = this.position.clone();
    const nextPos = this.position.clone();
    nextPos.x += this.velocity.x * dt;
    nextPos.z += this.velocity.z * dt;

    const resolvedPos = KinematicCollisionSolver.resolveHorizontal(
      nextPos,
      this.playerRadius,
      this.playerHeight,
      previousPos
    );
    this.position.x = resolvedPos.x;
    this.position.z = resolvedPos.z;
    if (dt > 0) {
      this.velocity.x = (resolvedPos.x - previousPos.x) / dt;
      this.velocity.z = (resolvedPos.z - previousPos.z) / dt;
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
          previousPos.y,
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
