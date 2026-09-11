import React from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ChunkManager } from './ChunkManager';
import { SkylineSilhouettes } from '../city/SkylineSilhouettes';

interface WorldManagerProps {
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
}

export const WorldManager: React.FC<WorldManagerProps> = ({ playerPosRef }) => {
  useFrame(() => {
    ChunkManager.getInstance().updatePlayerPosition(playerPosRef.current);
  });

  return (
    <group name="WorldManagerLayer">
      {/* Distant Instanced Skyline Silhouettes */}
      <SkylineSilhouettes />
    </group>
  );
};
