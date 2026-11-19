import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { InputManager } from './InputManager';
import { KinematicCollisionSolver } from './KinematicCollision';
import { CinematicManager } from '../cinematics/CinematicManager';
import { VehicleInteractionSystem } from '../vehicle/VehicleInteractionSystem';

interface PlayerCameraProps {
  targetPos: THREE.Vector3;
  onYawChange?: (yaw: number) => void;
}

export const PlayerCamera: React.FC<PlayerCameraProps> = ({ targetPos, onYawChange }) => {
  const { camera, gl } = useThree();
  const focusOffset = useMemo(() => new THREE.Vector3(0, 1.45, 0), []);
  const currentFocus = useRef(targetPos.clone().add(focusOffset));

  const desiredRadius = useRef(8.0);
  const currentRadius = useRef(8.0);
  const spherical = useRef(new THREE.Spherical(8.0, 1.25, 0));

  const cinCamPos = useMemo(() => new THREE.Vector3(), []);
  const cinLookAt = useMemo(() => new THREE.Vector3(), []);
  const targetFocus = useMemo(() => new THREE.Vector3(), []);
  const freeOffset = useMemo(() => new THREE.Vector3(), []);
  const rayDir = useMemo(() => new THREE.Vector3(), []);
  const ray = useMemo(() => new THREE.Ray(), []);
  const boxTarget = useMemo(() => new THREE.Box3(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const finalPos = useMemo(() => new THREE.Vector3(), []);
  const wasCinematic = useRef(false);
  const currentFov = useRef(60);
  const manualOrbitCooldown = useRef(0);
  const rumblePhase = useRef(0);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (InputManager.isUIBlocked()) return;
      e.preventDefault();
      desiredRadius.current = THREE.MathUtils.clamp(desiredRadius.current + e.deltaY * 0.005, 3.5, 18.0);
    };
    const dom = gl.domElement;
    dom.addEventListener('wheel', onWheel, { passive: false });
    return () => dom.removeEventListener('wheel', onWheel);
  }, [gl]);

  useFrame((_, delta) => {
    const dt = Math.min(Math.max(delta, 0), 0.05);
    const isCin = CinematicManager.getInstance().update(delta, targetPos, cinCamPos, cinLookAt);
    if (isCin) {
      wasCinematic.current = true;
      InputManager.consumeLookDelta();
      InputManager.consumeZoomDelta();
      camera.position.copy(cinCamPos);
      camera.lookAt(cinLookAt);
      currentFocus.current.copy(cinLookAt);
      return;
    }

    const { dx, dy } = InputManager.consumeLookDelta();
    const dz = InputManager.consumeZoomDelta();
    if (dz !== 0) {
      desiredRadius.current = THREE.MathUtils.clamp(desiredRadius.current + dz, 3.5, 18.0);
    }
    if (dx !== 0 || dy !== 0) {
      manualOrbitCooldown.current = 2.0;
      spherical.current.theta -= dx * 0.0022;
      spherical.current.phi = THREE.MathUtils.clamp(
        spherical.current.phi - dy * 0.0022,
        0.2,
        Math.PI / 2 + 0.15
      );
    } else if (manualOrbitCooldown.current > 0) {
      manualOrbitCooldown.current = Math.max(0, manualOrbitCooldown.current - dt);
    }

    const vState = VehicleInteractionSystem.getInstance().getState();
    const isRiding = vState.mode === 'RIDING';
    const isCar = isRiding && vState.variant === 'car';
    const telemetry = vState.telemetry;

    // Gentle chase-cam alignment behind the Experimental Car while moving (respects manual mouse orbit)
    if (isCar && manualOrbitCooldown.current <= 0 && telemetry.speedMs > 1.2) {
      const behindTheta = vState.vehicleRotationY + Math.PI;
      const diff = Math.atan2(
        Math.sin(behindTheta - spherical.current.theta),
        Math.cos(behindTheta - spherical.current.theta)
      );
      const chaseRate = telemetry.isReversing ? 1.4 : 3.2;
      spherical.current.theta += diff * (1 - Math.exp(-chaseRate * dt));
      spherical.current.phi = THREE.MathUtils.lerp(spherical.current.phi, 1.24, 1 - Math.exp(-2.2 * dt));
    }

    onYawChange?.(spherical.current.theta);

    // Dynamic acceleration & deceleration screen feel: FOV surge/compression + camera spring lag + subtle micro-rumble
    const posG = isRiding ? Math.max(0, telemetry.longitudinalAccelG) : 0;
    const negG = isRiding ? Math.max(0, -telemetry.longitudinalAccelG) : 0;
    const speedNorm = isRiding ? THREE.MathUtils.clamp(telemetry.speedMs / 36, 0, 1) : 0;

    const targetFov = isRiding
      ? THREE.MathUtils.clamp(
          60 + speedNorm * 8.5 + posG * 4.4 + (telemetry.isBoosting ? 5.0 : 0) - negG * 3.4,
          53.5,
          78.0
        )
      : 60;
    currentFov.current = THREE.MathUtils.damp(currentFov.current, targetFov, 7.5, dt);

    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const perspCam = camera as THREE.PerspectiveCamera;
      if (Math.abs(perspCam.fov - currentFov.current) > 0.015) {
        perspCam.fov = currentFov.current;
        perspCam.updateProjectionMatrix();
      }
    }

    targetFocus.copy(targetPos).add(focusOffset);
    if (isCar) {
      targetFocus.y = targetPos.y + 1.15;
    }

    if (wasCinematic.current) {
      currentFocus.current.copy(targetFocus);
      freeOffset.copy(camera.position).sub(targetFocus);
      spherical.current.setFromVector3(freeOffset);
      desiredRadius.current = THREE.MathUtils.clamp(spherical.current.radius, 3.5, 18);
      currentRadius.current = spherical.current.radius;
      wasCinematic.current = false;
    } else if (currentFocus.current.distanceToSquared(targetFocus) > 400) {
      currentFocus.current.copy(targetFocus);
    } else {
      const focusFollow = isCar ? 15 : 10;
      currentFocus.current.lerp(targetFocus, 1 - Math.exp(-dt * focusFollow));
    }

    const dynLagOffset = isRiding
      ? posG * 0.78 + (telemetry.isBoosting ? 0.55 : 0) - negG * 0.68
      : 0;
    spherical.current.radius = isRiding
      ? THREE.MathUtils.clamp(desiredRadius.current + (isCar ? 1.1 : 2.5) + dynLagOffset, 4.8, 20)
      : desiredRadius.current;
    freeOffset.setFromSpherical(spherical.current);
    rayDir.copy(freeOffset).normalize();

    let actualDist = spherical.current.radius;
    const boxes = KinematicCollisionSolver.getAllBoxes();
    ray.set(currentFocus.current, rayDir);

    let minX = Math.min(currentFocus.current.x, currentFocus.current.x + rayDir.x * actualDist);
    let maxX = Math.max(currentFocus.current.x, currentFocus.current.x + rayDir.x * actualDist);
    let minY = Math.min(currentFocus.current.y, currentFocus.current.y + rayDir.y * actualDist);
    let maxY = Math.max(currentFocus.current.y, currentFocus.current.y + rayDir.y * actualDist);
    let minZ = Math.min(currentFocus.current.z, currentFocus.current.z + rayDir.z * actualDist);
    let maxZ = Math.max(currentFocus.current.z, currentFocus.current.z + rayDir.z * actualDist);

    for (const b of boxes) {
      if (
        maxX < b.min.x ||
        minX > b.max.x ||
        maxY < b.min.y ||
        minY > b.max.y ||
        maxZ < b.min.z ||
        minZ > b.max.z
      ) {
        continue;
      }

      boxTarget.min.copy(b.min);
      boxTarget.max.copy(b.max);
      if (ray.intersectBox(boxTarget, hitPoint)) {
        const d = currentFocus.current.distanceTo(hitPoint);
        if (d < actualDist) {
          actualDist = Math.max(0.2, d - 0.25);
          minX = Math.min(currentFocus.current.x, currentFocus.current.x + rayDir.x * actualDist);
          maxX = Math.max(currentFocus.current.x, currentFocus.current.x + rayDir.x * actualDist);
          minY = Math.min(currentFocus.current.y, currentFocus.current.y + rayDir.y * actualDist);
          maxY = Math.max(currentFocus.current.y, currentFocus.current.y + rayDir.y * actualDist);
          minZ = Math.min(currentFocus.current.z, currentFocus.current.z + rayDir.z * actualDist);
          maxZ = Math.max(currentFocus.current.z, currentFocus.current.z + rayDir.z * actualDist);
        }
      }
    }

    currentRadius.current =
      actualDist < currentRadius.current
        ? actualDist
        : THREE.MathUtils.damp(currentRadius.current, actualDist, 12, dt);

    finalPos.copy(currentFocus.current).addScaledVector(rayDir, currentRadius.current);

    // Subtle high-speed / boost / heavy-braking vertical suspension feedback (zero horizontal shimmer)
    if (isRiding) {
      rumblePhase.current += dt * (24 + speedNorm * 28);
      const rumbleAmp = speedNorm * 0.012 + negG * 0.018 + (telemetry.isBoosting ? 0.016 : 0);
      if (rumbleAmp > 0.004) {
        finalPos.y += Math.sin(rumblePhase.current) * rumbleAmp;
      }
    }

    if (finalPos.y < 0.4) finalPos.y = 0.4;

    camera.position.copy(finalPos);
    camera.lookAt(currentFocus.current);
  });

  return null;
};
