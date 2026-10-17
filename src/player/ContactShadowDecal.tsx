import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { KinematicCollisionSolver } from './KinematicCollision';

interface ContactShadowDecalProps {
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  isGrounded?: boolean;
}

export const ContactShadowDecal: React.FC<ContactShadowDecalProps> = ({ playerPosRef }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  const shadowTex = useMemo(() => {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.82)');
    grad.addColorStop(0.4, 'rgba(0, 0, 0, 0.55)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }, []);

  useEffect(() => () => shadowTex.dispose(), [shadowTex]);

  useFrame(() => {
    if (!meshRef.current || !matRef.current || !playerPosRef?.current) return;
    const p = playerPosRef.current;
    const ground = KinematicCollisionSolver.getGroundHeightAt(p.x, p.z, p.y);
    const h = Math.max(0, p.y - ground.height);
    const factor = THREE.MathUtils.clamp(1.0 - h / 2.5, 0.0, 1.0);

    meshRef.current.position.set(p.x, ground.height + 0.012, p.z);
    meshRef.current.scale.setScalar(THREE.MathUtils.lerp(0.5, 1.3, factor));
    matRef.current.opacity = THREE.MathUtils.lerp(0.0, 0.7, factor);
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1.3, 1.3]} />
      <meshBasicMaterial ref={matRef} map={shadowTex} transparent opacity={0.7} depthWrite={false} />
    </mesh>
  );
};
