import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface ContactShadowDecalProps {
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  isGrounded?: boolean;
}

/**
 * Procedural feathered circular radial shadow texture
 */
function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
  gradient.addColorStop(0.35, 'rgba(0, 0, 0, 0.65)');
  gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.25)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

export const ContactShadowDecal: React.FC<ContactShadowDecalProps> = ({ playerPosRef }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  const shadowTex = useMemo(() => createContactShadowTexture(), []);

  useFrame(() => {
    if (!meshRef.current || !materialRef.current || !playerPosRef?.current) return;

    const pPos = playerPosRef.current;
    // Track ground baseline under player
    meshRef.current.position.x = pPos.x;
    meshRef.current.position.z = pPos.z;

    // Height offset above ground surface
    const heightAboveGround = Math.max(0, pPos.y);
    meshRef.current.position.y = 0.012; // Flush above pavement, avoiding z-fighting

    // Scale and fade out smoothly as player jumps or falls
    const distFactor = THREE.MathUtils.clamp(1.0 - heightAboveGround / 2.5, 0.0, 1.0);
    const targetScale = THREE.MathUtils.lerp(0.5, 1.35, distFactor);
    meshRef.current.scale.set(targetScale, targetScale, 1.0);

    materialRef.current.opacity = THREE.MathUtils.lerp(0.0, 0.72, distFactor);
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1.3, 1.3]} />
      <meshBasicMaterial
        ref={materialRef}
        map={shadowTex}
        transparent
        opacity={0.7}
        depthWrite={false}
      />
    </mesh>
  );
};
