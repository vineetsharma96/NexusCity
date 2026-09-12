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

    // 2. Smoothly follow player focus point
    const targetFocus = targetPos.clone().add(focusOffset);
    currentFocus.current.lerp(targetFocus, THREE.MathUtils.clamp(delta * 10, 0, 1));

    // 3. Collision-Aware Spring-Arm Raycast
    // Desired camera position in free space
    spherical.current.radius = desiredRadius.current;
    const freeOffset = new THREE.Vector3().setFromSpherical(spherical.current);

    // Raycast from focus to desiredPos
    const rayDir = freeOffset.clone().normalize();
    const maxDist = desiredRadius.current;
    let actualDist = maxDist;

    const boxes = KinematicCollisionSolver.getBoxes();
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
          // Pull camera in front of obstacle with 0.3m cushion
          actualDist = Math.max(1.5, hitDist - 0.3);
        }
      }
    }

    // Smoothly interpolate radius to avoid snapping
    currentRadius.current = THREE.MathUtils.lerp(currentRadius.current, actualDist, delta * 12);
    const finalOffset = rayDir.multiplyScalar(currentRadius.current);
    const finalPos = currentFocus.current.clone().add(finalOffset);

    // Ensure camera never sinks below floor
    if (finalPos.y < 0.4) {
      finalPos.y = 0.4;
    }

    // 4. Position and orient camera
    camera.position.copy(finalPos);
    camera.lookAt(currentFocus.current);
  });

  return null;
};
