import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { createSmoothBeveledBoxGeometry } from '../rendering/SmoothWorldGeometries';

interface StreetSignProps {
  position: [number, number, number];
  rotationY?: number;
  label: string;
  direction?: 'N' | 'S' | 'E' | 'W';
  accent?: string;
}

const SIGN_BEVEL_GEO = createSmoothBeveledBoxGeometry(0.08, 2);

export const StreetSign: React.FC<StreetSignProps> = React.memo(
  ({ position, rotationY = 0, label, direction = 'N', accent = '#f59e0b' }) => {
    const texture = useMemo(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#070a12';
      ctx.fillRect(0, 0, 512, 128);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 5;
      ctx.strokeRect(6, 6, 500, 116);

      ctx.fillStyle = accent;
      ctx.font = '700 22px monospace';
      ctx.fillText(`SECTOR WAYFINDING // ${direction}`, 24, 42);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 32px sans-serif';
      ctx.fillText(label.toUpperCase().slice(0, 22), 24, 92);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    }, [accent, direction, label]);

    useEffect(() => () => texture.dispose(), [texture]);

    const poleHeight = Math.max(3.2, position[1] - 0.18);

    return (
      <group position={position} rotation={[0, rotationY, 0]}>
        {/* Grounded Smooth Cylindrical Mast */}
        <mesh position={[0, -poleHeight * 0.5, 0]}>
          <cylinderGeometry args={[0.065, 0.09, poleHeight, 14]} />
          <meshStandardMaterial color="#111827" metalness={0.88} roughness={0.22} />
        </mesh>
        {/* Stepped Sidewalk Base Pedestal */}
        <mesh position={[0, -poleHeight + 0.09, 0]}>
          <cylinderGeometry args={[0.18, 0.24, 0.18, 16]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.24} />
        </mesh>
        {/* Smooth Beveled Sign Housing */}
        <mesh geometry={SIGN_BEVEL_GEO} scale={[3.4, 0.86, 0.12]}>
          <meshStandardMaterial color="#0b0f19" metalness={0.88} roughness={0.24} />
        </mesh>
        <mesh position={[0, 0, 0.068]}>
          <planeGeometry args={[3.2, 0.72]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
      </group>
    );
  }
);
