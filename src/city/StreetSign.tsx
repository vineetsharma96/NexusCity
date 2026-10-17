import React, { useMemo } from 'react';
import * as THREE from 'three';

const SIGN_WIDTH = 4.8;
const SIGN_HEIGHT = 1.05;
const SIGN_TEXTURE_WIDTH = 768;
const SIGN_TEXTURE_HEIGHT = 168;
const signTextureCache = new Map<string, THREE.CanvasTexture>();
const signPanelGeometry = new THREE.BoxGeometry(SIGN_WIDTH, SIGN_HEIGHT, 0.08);
const signPostGeometry = new THREE.CylinderGeometry(0.055, 0.075, 3.65, 8);

export interface StreetSignProps {
  position: [number, number, number];
  rotationY?: number;
  label: string;
  direction?: 'N' | 'E' | 'S' | 'W';
  accent?: string;
}

function getSignTexture(label: string, direction: StreetSignProps['direction'], accent: string) {
  const key = `${label}|${direction ?? ''}|${accent}`;
  const cached = signTextureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = SIGN_TEXTURE_WIDTH;
  canvas.height = SIGN_TEXTURE_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create street sign canvas');

  context.fillStyle = '#07111f';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = accent;
  context.lineWidth = 8;
  context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  context.fillStyle = 'rgba(0, 240, 255, 0.1)';
  context.fillRect(18, 18, canvas.width - 36, canvas.height - 36);

  context.textBaseline = 'middle';
  context.font = '700 40px Arial, sans-serif';
  context.fillStyle = '#f1fbff';
  context.shadowColor = accent;
  context.shadowBlur = 10;
  context.fillText(label.toUpperCase(), 38, 78, 570);
  context.shadowBlur = 0;

  context.font = '600 18px Arial, sans-serif';
  context.fillStyle = accent;
  context.fillText('DISTRICT 01 // WAYFINDING', 40, 128);

  if (direction) {
    context.strokeStyle = accent;
    context.fillStyle = accent;
    context.lineWidth = 8;
    context.beginPath();
    if (direction === 'E') {
      context.moveTo(670, 84); context.lineTo(724, 84); context.lineTo(704, 64);
      context.moveTo(724, 84); context.lineTo(704, 104);
    } else if (direction === 'W') {
      context.moveTo(724, 84); context.lineTo(670, 84); context.lineTo(690, 64);
      context.moveTo(670, 84); context.lineTo(690, 104);
    } else if (direction === 'N') {
      context.moveTo(697, 110); context.lineTo(697, 56); context.lineTo(677, 76);
      context.moveTo(697, 56); context.lineTo(717, 76);
    } else {
      context.moveTo(697, 56); context.lineTo(697, 110); context.lineTo(677, 90);
      context.moveTo(697, 110); context.lineTo(717, 90);
    }
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  signTextureCache.set(key, texture);
  return texture;
}

export const StreetSign: React.FC<StreetSignProps> = ({
  position,
  rotationY = 0,
  label,
  direction,
  accent = '#00f0ff',
}) => {
  const texture = useMemo(() => getSignTexture(label, direction, accent), [label, direction, accent]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={signPostGeometry} position={[0, -1.83, 0]} castShadow>
        <meshStandardMaterial color="#17263a" metalness={0.9} roughness={0.28} />
      </mesh>
      <mesh geometry={signPanelGeometry} castShadow>
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.58, 0]} scale={[1.08, 0.07, 1.15]}>
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
    </group>
  );
};
