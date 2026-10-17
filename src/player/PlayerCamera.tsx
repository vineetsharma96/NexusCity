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
      spherical.current.theta -= dx * 0.0022;
      spherical.current.phi = THREE.MathUtils.clamp(
        spherical.current.phi - dy * 0.0022,
        0.2,
        Math.PI / 2 + 0.15
      );
    }

    onYawChange?.(spherical.current.theta);

    const vState = VehicleInteractionSystem.getInstance().getState();
    targetFocus.copy(targetPos).add(focusOffset);

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
      currentFocus.current.lerp(targetFocus, 1 - Math.exp(-Math.max(0, delta) * 10));
    }

    spherical.current.radius =
      vState.mode === 'RIDING' ? THREE.MathUtils.clamp(desiredRadius.current + 2.5, 5.5, 20) : desiredRadius.current;
    freeOffset.setFromSpherical(spherical.current);
    rayDir.copy(freeOffset).normalize();

    let actualDist = spherical.current.radius;
    const boxes = KinematicCollisionSolver.getAllBoxes();
    ray.set(currentFocus.current, rayDir);

    for (const b of boxes) {
      boxTarget.min.copy(b.min);
      boxTarget.max.copy(b.max);
      if (ray.intersectBox(boxTarget, hitPoint)) {
        const d = currentFocus.current.distanceTo(hitPoint);
        if (d < actualDist) actualDist = Math.max(0.2, d - 0.25);
      }
    }

    currentRadius.current =
      actualDist < currentRadius.current
        ? actualDist
        : THREE.MathUtils.damp(currentRadius.current, actualDist, 12, Math.max(0, delta));

    finalPos.copy(currentFocus.current).addScaledVector(rayDir, currentRadius.current);
    if (finalPos.y < 0.4) finalPos.y = 0.4;

    camera.position.copy(finalPos);
    camera.lookAt(currentFocus.current);
  });

  return null;
};
