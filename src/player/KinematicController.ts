import * as THREE from 'three';
import { InputManager } from './InputManager';
import { KinematicCollisionSolver } from './KinematicCollision';
import { AudioManager } from '../audio/AudioManager';
import { VehicleInteractionSystem } from '../vehicle/VehicleInteractionSystem';

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
  public readonly gravity = -25.0;
  public readonly jumpImpulse = 10.5;
  public readonly playerRadius = 0.45;
  public readonly playerHeight = 1.8;

  // Ground and jump timing
  public isGrounded: boolean = true;
  private coyoteTimer: number = 0;
  private readonly coyoteTime = 0.18; // seconds
  private jumpBuffer: number = 0;
  private jumpWasDown = false;
  private footstepTimer: number = 0;
  private readonly inputDirection = new THREE.Vector3();
  private readonly worldDirection = new THREE.Vector3();
  private readonly candidatePosition = new THREE.Vector3();
  private readonly upAxis = new THREE.Vector3(0, 1, 0);

  public gait: MovementGait = 'IDLE';
  public isMoving: boolean = false;

  public resetMotion(): void {
    this.velocity.set(0, 0, 0);
    this.bankAngle = 0;
    this.isMoving = false;
    this.jumpBuffer = 0;
    this.jumpWasDown = InputManager.getState().jump;
    this.footstepTimer = 0.22;
  }

  public update(delta: number, cameraYaw: number): KinematicState {
    const input = InputManager.getState();
    const dt = Math.max(0, Math.min(delta, 0.05));

    // 1. Calculate Camera-Relative Movement Vector
    const moveX = input.moveX;
    const moveZ = input.moveZ;
    const isMoving = Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05;
    this.isMoving = isMoving;

    const inputDir = this.inputDirection.set(moveX, 0, moveZ);
    if (inputDir.lengthSq() > 1) {
      inputDir.normalize();
    }

    // Rotate input direction by camera yaw
    const worldDir = this.worldDirection.copy(inputDir).applyAxisAngle(this.upAxis, cameraYaw);

    // Target speed based on sprint input
    const vehicleMultiplier = VehicleInteractionSystem.getInstance().getMovementMultiplier();
    const maxSpeed = (input.sprint ? this.sprintSpeed : this.walkSpeed) * vehicleMultiplier;
    const targetVelX = isMoving ? worldDir.x * maxSpeed : 0;
    const targetVelZ = isMoving ? worldDir.z * maxSpeed : 0;

    // 2. Horizontal Acceleration / Deceleration (smooth momentum curves)
    const accelRate = isMoving ? (input.sprint ? 42.0 : 34.0) : 26.0;
    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, targetVelX, accelRate, dt);
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, targetVelZ, accelRate, dt);

    let horizontalSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);

    // 3. Smooth Facing Direction & Dynamic Lean / Bank Angle on Turns
    let turnRate = 0;
    if (isMoving && horizontalSpeed > 0.4) {
      this.targetRotationY = Math.atan2(this.velocity.x, this.velocity.z);
      let angleDiff = this.targetRotationY - this.rotationY;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      turnRate = angleDiff;
      const handlingMultiplier = VehicleInteractionSystem.getInstance().getState().upgrades.handling && vehicleMultiplier > 1 ? 1.25 : 1;
      this.rotationY += angleDiff * Math.min(1.0, dt * 18.0 * handlingMultiplier);
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
    const wasGrounded = this.isGrounded;

    if (onFloor && this.velocity.y <= 0.1) {
      this.isGrounded = true;
      this.coyoteTimer = this.coyoteTime;
      this.position.y = groundInfo.height;
      this.velocity.y = 0;

      // Detect landing impact after airborne phase
      if (!wasGrounded) {
        AudioManager.getInstance().playLand(groundInfo.surface);
      }
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
      this.isGrounded = false;
      this.velocity.y += this.gravity * dt;
    }

    // 5. Jump Impulse
    this.jumpBuffer = input.jump && !this.jumpWasDown ? 0.12 : Math.max(0, this.jumpBuffer - dt);
    this.jumpWasDown = input.jump;
    if (this.jumpBuffer > 0 && this.coyoteTimer > 0) {
      this.velocity.y = this.jumpImpulse;
      this.coyoteTimer = 0;
      this.isGrounded = false;
      this.jumpBuffer = 0;
      AudioManager.getInstance().playJump();
    }

    // 6. Apply Movement & Horizontal Collision Resolution
    const candidatePos = this.candidatePosition.copy(this.position);
    candidatePos.x += this.velocity.x * dt;
    candidatePos.z += this.velocity.z * dt;
    candidatePos.y += this.velocity.y * dt;

    // Evaluate the destination floor before walls so low curbs and ramps can be stepped onto.
    const destinationGround = KinematicCollisionSolver.getGroundHeightAt(candidatePos.x, candidatePos.z, this.position.y);
    if (this.isGrounded && destinationGround.height > candidatePos.y && destinationGround.height - this.position.y <= 0.6) {
      candidatePos.y = destinationGround.height;
    }

    // Stop an ascending capsule at the underside of a platform rather than ejecting it sideways.
    if (this.velocity.y > 0) {
      for (const box of KinematicCollisionSolver.getAllBoxes()) {
        if (candidatePos.x + this.playerRadius <= box.min.x || candidatePos.x - this.playerRadius >= box.max.x ||
            candidatePos.z + this.playerRadius <= box.min.z || candidatePos.z - this.playerRadius >= box.max.z) continue;
        if (this.position.y + this.playerHeight <= box.min.y && candidatePos.y + this.playerHeight > box.min.y) {
          candidatePos.y = box.min.y - this.playerHeight;
          this.velocity.y = 0;
        }
      }
    }

    // Resolve against obstacles
    const resolvedPos = KinematicCollisionSolver.resolveHorizontal(
      candidatePos,
      this.playerRadius,
      this.playerHeight,
      this.position
    );

    // Sample after horizontal resolution; the old floor may be a ledge we have just left.
    const resolvedGround = KinematicCollisionSolver.getGroundHeightAt(resolvedPos.x, resolvedPos.z, Math.max(this.position.y, resolvedPos.y));
    if (resolvedPos.y <= resolvedGround.height + 0.001 && this.velocity.y <= 0) {
      if (!this.isGrounded) AudioManager.getInstance().playLand(resolvedGround.surface);
      resolvedPos.y = resolvedGround.height;
      this.velocity.y = 0;
      this.isGrounded = true;
    } else if (resolvedPos.y > resolvedGround.height + 0.08) {
      this.isGrounded = false;
    }

    if (dt > 0) {
      this.velocity.x = (resolvedPos.x - this.position.x) / dt;
      this.velocity.z = (resolvedPos.z - this.position.z) / dt;
      horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    }
    this.position.copy(resolvedPos);

    // Use actual movement so pushing into a wall does not animate or sound like walking.
    if (this.isGrounded && horizontalSpeed > 0.8) {
      const strideTime = input.sprint ? 0.30 : 0.48;
      this.footstepTimer += dt;
      if (this.footstepTimer >= strideTime) {
        this.footstepTimer = 0;
        AudioManager.getInstance().playFootstep(resolvedGround.surface, input.sprint);
      }
    } else {
      this.footstepTimer = 0.22;
    }

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
