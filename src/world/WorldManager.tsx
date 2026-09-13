import React from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ChunkManager } from './ChunkManager';
import { SkylineSilhouettes } from '../city/SkylineSilhouettes';
import { StreamedCityChunks } from '../city/StreamedCityChunks';

interface WorldManagerProps {
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
}

export const WorldManager: React.FC<WorldManagerProps> = ({ playerPosRef }) => {
  useFrame(() => {
    ChunkManager.getInstance().updatePlayerPosition(playerPosRef.current);
  });

  return (
    <group name="WorldManagerLayer">
      {/* Procedural Streamed Chunks with Dynamic LOD (180m to 850m) */}
      <StreamedCityChunks />

      {/* Distant Instanced Skyline Silhouettes (850m to 2200m) */}
      <SkylineSilhouettes />
    </group>
  );
};
