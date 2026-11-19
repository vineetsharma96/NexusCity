import * as THREE from 'three';
import { InputManager } from './InputManager';
import { KinematicCollisionSolver } from './KinematicCollision';
import { AudioManager } from '../audio/AudioManager';
import { PhysicsBodyProfile, WorldPhysicsEngine } from '../world/WorldPhysicsEngine';

export type GaitState = 'IDLE' | 'WALK' | 'RUN' | 'JUMP_UP' | 'FALL';

const PLAYER_PHYSICS_PROFILE: PhysicsBodyProfile = {
  massKg: 75,
  dragCoefficient: 1.05,
  frontalAreaM2: 0.68,
  surfaceFrictionScale: 1.0,
};

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
  private turnDirection = 1;

  // Reusable vectors to avoid allocations in update loop
  private readonly _forward = new THREE.Vector3();
  private readonly _right = new THREE.Vector3();
  private readonly _moveDir = new THREE.Vector3();
  private readonly _currentHorizVel = new THREE.Vector3();
  private readonly _targetHorizVel = new THREE.Vector3();
  private readonly _previousPos = new THREE.Vector3();
  private readonly _nextPos = new THREE.Vector3();

  // ⚡ Bolt Performance Optimization:
  // Reusable vector avoids garbage collection pressure inside the core useFrame update loop.
  // Expect fewer micro-stutters and more consistent frame times as GC sweeps are reduced.
  private readonly _resolvedPos = new THREE.Vector3();

  public resetMotion(): void {
    this.velocity.set(0, 0, 0);
    this.bankAngle = 0;
    this.stepTimer = 0;
  }

  public update(delta: number, cameraYaw: number): KinematicState {
    const dt = Math.min(Math.max(delta, 0), 0.05);
    const input = InputManager.getState();
    const audio = AudioManager.getInstance();
    const worldPhysics = WorldPhysicsEngine.getInstance();
    const surface = worldPhysics.getSurfaceAt(this.position.x, this.position.z);

    this._forward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    this._right.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));

    this._moveDir.set(0, 0, 0)
      .addScaledVector(this._right, input.moveX)
      .addScaledVector(this._forward, input.moveZ);

    const inputLen = this._moveDir.length();
    if (inputLen > 0.01) this._moveDir.normalize();

    // Compute smooth rotational facing before velocity step so forward->backward pivots rotate cleanly
    const prevHorizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    let activeTurnDiff = 0;
    if (inputLen > 0.05 || prevHorizSpeed > 0.45) {
      const targetAngle =
        inputLen > 0.05
          ? Math.atan2(this._moveDir.x, this._moveDir.z)
          : Math.atan2(this.velocity.x, this.velocity.z);

      let diff = Math.atan2(Math.sin(targetAngle - this.rotationY), Math.cos(targetAngle - this.rotationY));

      // Deterministic 180-degree tie-breaker so forward -> backward turns smoothly in one consistent arc
      if (Math.abs(diff) > Math.PI - 0.14) {
        diff = this.turnDirection * Math.abs(diff);
      } else if (Math.abs(diff) > 0.04) {
        this.turnDirection = diff >= 0 ? 1 : -1;
      }

      activeTurnDiff = diff;
      const maxTurnStep = 8.2 * dt; // ~0.38s for a clean, clearly visible 180-degree pivot turn
      const dampedStep = diff * (1 - Math.exp(-10.5 * dt));
      const clampedStep = THREE.MathUtils.clamp(dampedStep, -maxTurnStep, maxTurnStep);
      this.rotationY = Math.atan2(
        Math.sin(this.rotationY + clampedStep),
        Math.cos(this.rotationY + clampedStep)
      );
    }

    const targetMaxSpeed = input.sprint ? this.runSpeed : this.walkSpeed;
    // Gently moderate translational speed mid-180-pivot so the character visibly turns into the new heading
    const pivotScale =
      inputLen > 0.05 && Math.abs(activeTurnDiff) > 1.25
        ? THREE.MathUtils.lerp(0.42, 1.0, 1 - THREE.MathUtils.clamp((Math.abs(activeTurnDiff) - 1.25) / (Math.PI - 1.25), 0, 1))
        : 1.0;
    const targetSpeed = inputLen > 0.01 ? targetMaxSpeed * Math.min(1, inputLen) * pivotScale : 0;

    this._currentHorizVel.set(this.velocity.x, 0, this.velocity.z);
    this._targetHorizVel.copy(this._moveDir).multiplyScalar(targetSpeed);

    // Ground traction scales acceleration/stopping grip smoothly with surface friction (dry vs rain vs snow)
    const gripFactor = this.isGrounded ? Math.max(0.55, Math.min(1.1, surface.frictionMu / 0.85)) : this.airControl;
    const rate = (inputLen > 0.01 ? this.accel : this.decel) * gripFactor;

    this._currentHorizVel.lerp(this._targetHorizVel, 1 - Math.exp(-rate * dt));
    this.velocity.x = this._currentHorizVel.x;
    this.velocity.z = this._currentHorizVel.z;

    // Apply unified WorldPhysicsEngine aerodynamic drag & wind resistance (zero wind push when standing still on ground)
    const windCoupling = !this.isGrounded ? 0.22 : inputLen > 0.05 ? 0.04 : 0;
    worldPhysics.applyWorldForcesToVelocity(
      this.velocity,
      this.position.x,
      this.position.z,
      PLAYER_PHYSICS_PROFILE,
      dt,
      this.isGrounded,
      windCoupling,
      inputLen <= 0.01
    );

    this._previousPos.copy(this.position);
    this._nextPos.copy(this.position);
    this._nextPos.x += this.velocity.x * dt;
    this._nextPos.z += this.velocity.z * dt;

    const resolvedPos = KinematicCollisionSolver.resolveHorizontal(
      this._nextPos,
      this.playerRadius,
      this.playerHeight,
      this._previousPos,
      this._resolvedPos
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
      const targetBank = THREE.MathUtils.clamp(-activeTurnDiff * (horizSpeed / this.runSpeed) * 0.22, -0.18, 0.18);
      this.bankAngle = THREE.MathUtils.lerp(this.bankAngle, targetBank, 1 - Math.exp(-10 * dt));
    } else {
      this.bankAngle = THREE.MathUtils.lerp(this.bankAngle, 0, 1 - Math.exp(-10 * dt));
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
