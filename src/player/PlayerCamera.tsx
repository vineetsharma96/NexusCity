import React, { useRef, useEffect, useMemo } from 'react';
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

  // Focus offset (chest/head height)
  const focusOffset = useMemo(() => new THREE.Vector3(0, 1.45, 0), []);
  const currentFocus = useRef(targetPos.clone().add(focusOffset));

  // Spherical coordinate state: [radius, phi, theta]
  const desiredRadius = useRef(8.0);
  const currentRadius = useRef(8.0);
  const spherical = useRef(new THREE.Spherical(8.0, 1.25, 0)); // phi: vertical angle, theta: horizontal yaw

  const mouseSensitivity = 0.0022;

  // Reusable vectors for cinematic calculations
  const cinematicCamPos = useMemo(() => new THREE.Vector3(), []);
  const cinematicLookAt = useMemo(() => new THREE.Vector3(), []);
  const targetFocus = useMemo(() => new THREE.Vector3(), []);
  const freeOffset = useMemo(() => new THREE.Vector3(), []);
  const rayDirection = useMemo(() => new THREE.Vector3(), []);
  const ray = useMemo(() => new THREE.Ray(), []);
  const boxTarget = useMemo(() => new THREE.Box3(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const finalPosition = useMemo(() => new THREE.Vector3(), []);
  const wasCinematic = useRef(false);

  // Zoom control via scroll wheel
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (InputManager.isUIBlocked()) return;
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
      wasCinematic.current = true;
      InputManager.consumeLookDelta();
      InputManager.consumeZoomDelta();
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

    // 2. Follow player focus point smoothly
    const vehicleState = VehicleInteractionSystem.getInstance().getState();
    targetFocus.copy(targetPos).add(focusOffset);
    if (wasCinematic.current) {
      currentFocus.current.copy(targetFocus);
      freeOffset.copy(camera.position).sub(targetFocus);
      spherical.current.setFromVector3(freeOffset);
      desiredRadius.current = THREE.MathUtils.clamp(spherical.current.radius, 3.5, 18);
      currentRadius.current = spherical.current.radius;
      wasCinematic.current = false;
    } else if (currentFocus.current.distanceToSquared(targetFocus) > 400) {
      // Fast travel should move the camera with the player, not sweep through city blocks.
      currentFocus.current.copy(targetFocus);
    } else {
      currentFocus.current.lerp(targetFocus, 1 - Math.exp(-Math.max(0, delta) * 10));
    }

    // 3. Collision-Aware Spring-Arm Raycast
    spherical.current.radius = vehicleState.mode === 'RIDING'
      ? THREE.MathUtils.clamp(desiredRadius.current + 2.5, 5.5, 20)
      : desiredRadius.current;
    freeOffset.setFromSpherical(spherical.current);

    // Raycast from focus to desiredPos
    const rayDir = rayDirection.copy(freeOffset).normalize();
    const maxDist = spherical.current.radius;
    let actualDist = maxDist;

    // Use getAllBoxes to inspect both static world colliders AND active building/prop colliders
    const boxes = KinematicCollisionSolver.getAllBoxes();
    ray.set(currentFocus.current, rayDir);

    for (const b of boxes) {
      boxTarget.min.copy(b.min);
      boxTarget.max.copy(b.max);
      const hit = ray.intersectBox(boxTarget, hitPoint);
      if (hit) {
        const hitDist = currentFocus.current.distanceTo(hitPoint);
        if (hitDist < actualDist) {
          // Pull camera in front of obstacle with cushion
          actualDist = Math.max(0.2, hitDist - 0.25);
        }
      }
    }

    // Smoothly interpolate radius to avoid snapping
    currentRadius.current = actualDist < currentRadius.current
      ? actualDist
      : THREE.MathUtils.damp(currentRadius.current, actualDist, 12, Math.max(0, delta));
    const finalOffset = rayDir.multiplyScalar(currentRadius.current);
    const finalPos = finalPosition.copy(currentFocus.current).add(finalOffset);

    // Ensure camera never sinks below street floor
    if (finalPos.y < 0.4) {
      finalPos.y = 0.4;
    }

    // 4. Position and orient camera
    camera.position.copy(finalPos);
    camera.lookAt(currentFocus.current);
  });

  return null;
};
