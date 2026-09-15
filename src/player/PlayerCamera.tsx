import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { InputManager } from './InputManager';
import { KinematicCollisionSolver } from './KinematicCollision';
import { CinematicManager } from '../cinematics/CinematicManager';

interface PlayerCameraProps {
  targetPos: THREE.Vector3;
  onYawChange?: (yaw: number) => void;
}

export const PlayerCamera: React.FC<PlayerCameraProps> = ({ targetPos, onYawChange }) => {
  const { camera, gl } = useThree();

  // Focus offset (chest/head height)
  const focusOffset = new THREE.Vector3(0, 1.45, 0);
  const currentFocus = useRef(targetPos.clone().add(focusOffset));

  // Spherical coordinate state: [radius, phi, theta]
  const desiredRadius = useRef(8.0);
  const currentRadius = useRef(8.0);
  const spherical = useRef(new THREE.Spherical(8.0, 1.25, 0)); // phi: vertical angle, theta: horizontal yaw

  const mouseSensitivity = 0.0022;

  // Reusable vectors for cinematic calculations
  const cinematicCamPos = useMemo(() => new THREE.Vector3(), []);
  const cinematicLookAt = useMemo(() => new THREE.Vector3(), []);

  // Zoom control via scroll wheel
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomSpeed = 0.005;
      desiredRadius.current = THREE.MathUtils.clamp(
        desiredRadius.current + e.deltaY * zoomSpeed,
        3.5,
        18.0
      );
    };

    const dom = gl.domElement;
    dom.addEventListener('wheel', handleWheel, { passive: false });
    return () => dom.removeEventListener('wheel', handleWheel);
  }, [gl]);

  useFrame((_, delta) => {
    // 0. Check if Cinematic Intro or Transition is active
    const isCinematicActive = CinematicManager.getInstance().update(
      delta,
      targetPos,
      cinematicCamPos,
      cinematicLookAt
    );

    if (isCinematicActive) {
      camera.position.copy(cinematicCamPos);
      camera.lookAt(cinematicLookAt);
      currentFocus.current.copy(cinematicLookAt);
      return;
    }

    // 1. Consume mouse / touch look deltas & zoom delta
    const { dx, dy } = InputManager.consumeLookDelta();
    const dz = InputManager.consumeZoomDelta();
    if (dz !== 0) {
      desiredRadius.current = THREE.MathUtils.clamp(
        desiredRadius.current + dz,
        3.5,
        18.0
      );
    }
    if (dx !== 0 || dy !== 0) {
      spherical.current.theta -= dx * mouseSensitivity;
      spherical.current.phi -= dy * mouseSensitivity;

      // Clamp vertical pitch (prevent flipping over head or below floor)
      spherical.current.phi = THREE.MathUtils.clamp(
        spherical.current.phi,
        0.2, // ~12 degrees from vertical top
        Math.PI / 2 + 0.15 // slightly below horizontal
      );
    }

    // Report yaw for camera-relative movement
    if (onYawChange) {
      onYawChange(spherical.current.theta);
    }

    // 2. Follow player focus point with instant snap on portal teleportation
    const targetFocus = targetPos.clone().add(focusOffset);
    const isIndoor = targetFocus.y < -50;

    if (currentFocus.current.distanceToSquared(targetFocus) > 225) {
      // Teleport focus point immediately to prevent 80m subterranean ground lerp
      currentFocus.current.copy(targetFocus);
      currentRadius.current = isIndoor ? 3.0 : 8.0;
    } else {
      currentFocus.current.lerp(targetFocus, THREE.MathUtils.clamp(delta * 10, 0, 1));
    }

    // 3. Collision-Aware Spring-Arm Raycast with Indoor Room Constraints
    const effectiveDesiredRadius = isIndoor
      ? THREE.MathUtils.clamp(desiredRadius.current, 2.2, 3.4)
      : desiredRadius.current;

    spherical.current.radius = effectiveDesiredRadius;
    const freeOffset = new THREE.Vector3().setFromSpherical(spherical.current);

    // Raycast from focus to desiredPos
    const rayDir = freeOffset.clone().normalize();
    const maxDist = effectiveDesiredRadius;
    let actualDist = maxDist;

    // Use getAllBoxes to inspect both static world colliders AND active chunk/interior boxes
    const boxes = KinematicCollisionSolver.getAllBoxes();
    const ray = new THREE.Ray(currentFocus.current, rayDir);
    const boxTarget = new THREE.Box3();

    for (const b of boxes) {
      boxTarget.min.copy(b.min);
      boxTarget.max.copy(b.max);
      const hitPoint = new THREE.Vector3();
      const hit = ray.intersectBox(boxTarget, hitPoint);
      if (hit) {
        const hitDist = currentFocus.current.distanceTo(hitPoint);
        if (hitDist < actualDist) {
          // Pull camera in front of obstacle with cushion
          actualDist = Math.max(1.4, hitDist - 0.25);
        }
      }
    }

    // Smoothly interpolate radius to avoid snapping
    currentRadius.current = THREE.MathUtils.lerp(currentRadius.current, actualDist, delta * 12);
    const finalOffset = rayDir.multiplyScalar(currentRadius.current);
    const finalPos = currentFocus.current.clone().add(finalOffset);

    // Ensure camera never sinks below floor or clips above ceiling (interior vs exterior)
    const minFloorY = isIndoor ? -79.6 : 0.4;
    const maxCeilY = isIndoor ? -75.8 : Infinity;
    if (finalPos.y < minFloorY) {
      finalPos.y = minFloorY;
    } else if (finalPos.y > maxCeilY) {
      finalPos.y = maxCeilY;
    }

    // 4. Position and orient camera
    camera.position.copy(finalPos);
    camera.lookAt(currentFocus.current);
  });

  return null;
};
