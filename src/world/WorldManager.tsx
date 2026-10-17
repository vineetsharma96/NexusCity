import React, { useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ChunkManager } from './ChunkManager';
import { SkylineSilhouettes } from '../city/SkylineSilhouettes';
import { StreamedCityChunks } from '../city/StreamedCityChunks';
import { EmergencyAlertSystem } from './EmergencyAlertSystem';
import { LivingCityEventSystem } from './LivingCityEventSystem';
import { TerminalSystem } from '../interaction/TerminalSystem';
import { MissionSystem } from '../gameplay/MissionSystem';
import { DistrictGenerator } from '../city/DistrictGenerator';

interface WorldManagerProps {
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
}

export const WorldManager: React.FC<WorldManagerProps> = ({ playerPosRef }) => {
  useEffect(() => {
    const alerts = EmergencyAlertSystem.getInstance();
    alerts.start();
    return () => alerts.stop();
  }, []);

  useFrame((_, delta) => {
    ChunkManager.getInstance().updatePlayerPosition(playerPosRef.current);
    const events = LivingCityEventSystem.getInstance();
    events.update(delta);
    MissionSystem.getInstance().update(
      DistrictGenerator.getDistrictAt(playerPosRef.current.x, playerPosRef.current.z).type,
      events.getState(),
    );
    TerminalSystem.getInstance().update();
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
