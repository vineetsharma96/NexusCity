import * as THREE from 'three';
import { InputManager } from './InputManager';
import { KinematicCollisionSolver } from './KinematicCollision';
import { AudioManager } from '../audio/AudioManager';

export type MovementGait = 'IDLE' | 'WALK' | 'RUN' | 'JUMP_UP' | 'FALL' | 'LAND';

export interface KinematicState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotationY: number;
  speed: number;
  isGrounded: boolean;
  gait: MovementGait;
  bankAngle: number;
}

export class KinematicController {
  public position: THREE.Vector3 = new THREE.Vector3(0, 0, 10);
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public rotationY: number = 0;
  public targetRotationY: number = 0;
  public bankAngle: number = 0;

  // Movement physics constants (snappy, responsive cyber-locomotion)
  public readonly walkSpeed = 6.8;
  public readonly sprintSpeed = 14.2;
  public readonly acceleration = 52.0;
  public readonly friction = 38.0;
  public readonly gravity = -25.0;
  public readonly jumpImpulse = 10.5;
  public readonly playerRadius = 0.45;
  public readonly playerHeight = 1.8;

  // Ground and jump timing
  public isGrounded: boolean = true;
  private coyoteTimer: number = 0;
  private readonly coyoteTime = 0.18; // seconds
  private jumpCooldown: number = 0;
  private footstepTimer: number = 0;

  public gait: MovementGait = 'IDLE';

  public update(delta: number, cameraYaw: number): KinematicState {
    const input = InputManager.getState();
    const dt = Math.min(delta, 0.05); // Prevent tunneling on frame hitch

    // 1. Calculate Camera-Relative Movement Vector
    const moveX = input.moveX;
    const moveZ = input.moveZ;
    const isMoving = Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05;

    const inputDir = new THREE.Vector3(moveX, 0, moveZ);
    if (inputDir.lengthSq() > 1) {
      inputDir.normalize();
    }

    // Rotate input direction by camera yaw
    const worldDir = inputDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);

    // Target speed based on sprint input
    const maxSpeed = input.sprint ? this.sprintSpeed : this.walkSpeed;
    const targetVelX = isMoving ? worldDir.x * maxSpeed : 0;
    const targetVelZ = isMoving ? worldDir.z * maxSpeed : 0;

    // 2. Horizontal Acceleration / Deceleration (tighter, more responsive damping)
    const accelRate = isMoving ? this.acceleration : this.friction;
    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, targetVelX, accelRate, dt);
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, targetVelZ, accelRate, dt);

    const horizontalSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);

    // 3. Smooth Facing Direction & Dynamic Lean / Bank Angle on Turns
    let turnRate = 0;
    if (isMoving && horizontalSpeed > 0.4) {
      this.targetRotationY = Math.atan2(this.velocity.x, this.velocity.z);
      let angleDiff = this.targetRotationY - this.rotationY;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      turnRate = angleDiff;
      this.rotationY += angleDiff * Math.min(1.0, dt * 18.0);
    }

    // Compute bank / lean angle into turns proportional to turn rate and speed
    const targetBank = THREE.MathUtils.clamp(-turnRate * (horizontalSpeed / this.sprintSpeed) * 0.45, -0.28, 0.28);
    this.bankAngle = THREE.MathUtils.lerp(this.bankAngle, targetBank, dt * 10);

    // 4. Ground Check & Gravity
    const groundInfo = KinematicCollisionSolver.getGroundHeightAt(
      this.position.x,
      this.position.z,
      this.position.y
    );

    const onFloor = this.position.y <= groundInfo.height + 0.08;

    if (onFloor && this.velocity.y <= 0.1) {
      this.isGrounded = true;
      this.coyoteTimer = this.coyoteTime;
      this.position.y = groundInfo.height;
      this.velocity.y = 0;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
      this.isGrounded = false;
      this.velocity.y += this.gravity * dt;
    }

    // 5. Jump Impulse
    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);
    if (input.jump && this.coyoteTimer > 0 && this.jumpCooldown <= 0) {
      this.velocity.y = this.jumpImpulse;
      this.coyoteTimer = 0;
      this.isGrounded = false;
      this.jumpCooldown = 0.25;
      AudioManager.getInstance().playJump();
    }

    // 5b. Procedural Footstep Audio
    if (this.isGrounded && horizontalSpeed > 0.8) {
      const strideTime = input.sprint ? 0.32 : 0.52;
      this.footstepTimer += dt;
      if (this.footstepTimer >= strideTime) {
        this.footstepTimer = 0;
        AudioManager.getInstance().playFootstep(input.sprint);
      }
    } else {
      this.footstepTimer = 0.24;
    }

    // 6. Apply Movement & Horizontal Collision Resolution
    const candidatePos = this.position.clone();
    candidatePos.x += this.velocity.x * dt;
    candidatePos.z += this.velocity.z * dt;
    candidatePos.y += this.velocity.y * dt;

    // Resolve against obstacles
    const resolvedPos = KinematicCollisionSolver.resolveHorizontal(
      candidatePos,
      this.playerRadius,
      this.playerHeight
    );

    // Prevent sinking below ground
    if (resolvedPos.y < groundInfo.height) {
      resolvedPos.y = groundInfo.height;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    this.position.copy(resolvedPos);

    // 7. Determine Current Animation Gait
    if (!this.isGrounded) {
      if (this.velocity.y > 1.5) {
        this.gait = 'JUMP_UP';
      } else {
        this.gait = 'FALL';
      }
    } else if (horizontalSpeed > 7.5) {
      this.gait = 'RUN';
    } else if (horizontalSpeed > 0.4) {
      this.gait = 'WALK';
    } else {
      this.gait = 'IDLE';
    }

    return {
      position: this.position,
      velocity: this.velocity,
      rotationY: this.rotationY,
      speed: horizontalSpeed,
      isGrounded: this.isGrounded,
      gait: this.gait,
      bankAngle: this.bankAngle,
    };
  }
}
