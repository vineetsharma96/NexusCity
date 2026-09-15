import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { LightingManager } from '../lighting/LightingManager';
import { CityDistrict } from '../city/CityDistrict';
import { PlayerController } from '../player/PlayerController';
import { NPCCrowd } from '../npc/NPCCrowd';
import { NavigationRibbon } from '../map/NavigationRibbon';
import { WorldManager } from '../world/WorldManager';
import { RainParticles } from '../city/RainParticles';
import { TrafficSystem } from '../city/TrafficSystem';
import { TrafficLightGantry } from '../city/TrafficLightGantry';
import { CrosswalkMarkings } from '../city/CrosswalkMarkings';
import { ParkSanctuary } from '../city/ParkSanctuary';
import { QualityManager, QualitySettings } from '../rendering/QualityManager';
import { PerformanceMonitor } from '../rendering/PerformanceMonitor';
import { InputManager } from '../player/InputManager';
import { NaturalClouds } from '../environment/NaturalClouds';
import { DirtParticles } from '../city/DirtParticles';
import { AtmosphericDetails } from '../city/AtmosphericDetails';
import { PostProcessingManager } from '../rendering/PostProcessingManager';
import { TimeSystem } from '../world/TimeSystem';

// Inner component to hook into R3F render loop for telemetry and dynamic updates
const SceneFrameLoop: React.FC = () => {
  const { gl, camera } = useThree();
  const perf = PerformanceMonitor.getInstance();

  useFrame(() => {
    perf.update(gl);
    (window as any).__NEXUS_CAMERA__ = camera;

    // Dynamic Tone Mapping Exposure based on diurnal phase
    const timeState = TimeSystem.getInstance().getState();
    const targetExposure = timeState.isNight ? 1.35 : timeState.phase === 'SUNSET' ? 1.25 : 1.08;
    gl.toneMappingExposure = THREE.MathUtils.lerp(gl.toneMappingExposure, targetExposure, 0.05);
  });

  return null;
};

export interface SceneProps {
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
}

export const Scene: React.FC<SceneProps> = ({ playerPosRef: externalPosRef }) => {
  const [quality, setQuality] = useState<QualitySettings>(QualityManager.current);

  const internalPosRef = useRef(new THREE.Vector3(0, 0.2, 10));
  const playerPosRef = externalPosRef || internalPosRef;
  const teleportFnRef = useRef<((pos: THREE.Vector3) => void) | null>(null);

  useEffect(() => {
    const unsubQ = QualityManager.subscribe(setQuality);
    return () => {
      unsubQ();
    };
  }, []);

  return (
    <Canvas
      shadows={quality.shadows}
      dpr={quality.dpr}
      camera={{ position: [0, 8, 16], fov: 60, near: 0.1, far: Math.max(3500, quality.drawDistance * 1.5) }}
      gl={{
        antialias: quality.name !== 'LITE',
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.12,
      }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        InputManager.init(gl.domElement);
      }}
      style={{ width: '100vw', height: '100vh' }}
    >
      <SceneFrameLoop />
      <PostProcessingManager quality={quality} />
      <LightingManager quality={quality} playerPosRef={playerPosRef} />

      {/* ========================================================
          CONTINUOUS OUTDOOR METROPOLIS EXPLORATION
          ======================================================== */}
      <CityDistrict seed={847291} />
      <NavigationRibbon />
      <WorldManager playerPosRef={playerPosRef} />
      <TrafficSystem playerPosRef={playerPosRef} />
      <TrafficLightGantry position={[0, 0, 0]} />
      <CrosswalkMarkings position={[0, 0, 0]} />
      <ParkSanctuary position={[75, 0, 75]} />
      <RainParticles playerPosRef={playerPosRef} />
      {quality.cloudsEnabled && <NaturalClouds />}
      {quality.windParticlesEnabled && <DirtParticles playerPosRef={playerPosRef} />}
      <AtmosphericDetails playerPosRef={playerPosRef} />
      <NPCCrowd playerPosRef={playerPosRef} />

      <PlayerController
        playerPosRef={playerPosRef}
        registerTeleport={(fn) => {
          teleportFnRef.current = fn;
        }}
      />
    </Canvas>
  );
};
