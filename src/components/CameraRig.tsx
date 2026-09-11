import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { InputManager } from '../player/InputManager';

interface CameraRigProps {
  target?: THREE.Vector3;
  initialDistance?: number;
}

export const CameraRig: React.FC<CameraRigProps> = ({
  target = new THREE.Vector3(0, 1.5, 0),
  initialDistance = 14,
}) => {
  const { camera, gl } = useThree();

  // Spherical coordinate state
  const spherical = useRef(new THREE.Spherical(initialDistance, Math.PI / 3, 0));
  const currentTarget = useRef(target.clone());
  const mouseSensitivity = 0.0022;

  // Zoom control via wheel
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomSpeed = 0.005;
      spherical.current.radius = THREE.MathUtils.clamp(
        spherical.current.radius + e.deltaY * zoomSpeed,
        4,
        35
      );
    };

    const dom = gl.domElement;
    dom.addEventListener('wheel', handleWheel, { passive: false });
    return () => dom.removeEventListener('wheel', handleWheel);
  }, [gl]);

  useFrame((_, delta) => {
    // 1. Consume mouse / touch look deltas
    const { dx, dy } = InputManager.consumeLookDelta();
    if (dx !== 0 || dy !== 0) {
      spherical.current.theta -= dx * mouseSensitivity;
      spherical.current.phi -= dy * mouseSensitivity;
      // Clamp vertical polar angle to prevent flipping
      spherical.current.phi = THREE.MathUtils.clamp(
        spherical.current.phi,
        0.1,
        Math.PI / 2 - 0.02
      );
    }

    // 2. Smoothly track target
    const lerpFactor = THREE.MathUtils.clamp(delta * 8, 0, 1);
    currentTarget.current.lerp(target, lerpFactor);

    // 3. Compute target camera position in world space
    const offset = new THREE.Vector3().setFromSpherical(spherical.current);
    const desiredPos = currentTarget.current.clone().add(offset);

    // Smooth camera position interpolation
    camera.position.lerp(desiredPos, THREE.MathUtils.clamp(delta * 12, 0, 1));
    camera.lookAt(currentTarget.current);
  });

  return null;
};
