import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { LightingManager } from '../lighting/LightingManager';
import { CityDistrict } from '../city/CityDistrict';
import { PlayerController } from '../player/PlayerController';
import { NPCCrowd } from '../npc/NPCCrowd';
import { BuildingEntrance } from '../city/BuildingEntrance';
import { ProceduralInterior } from '../city/ProceduralInterior';
import { NavigationRibbon } from '../map/NavigationRibbon';
import { WorldManager } from '../world/WorldManager';
import { RainParticles } from '../city/RainParticles';
import { TrafficSystem } from '../city/TrafficSystem';
import { TrafficLightGantry } from '../city/TrafficLightGantry';
import { CrosswalkMarkings } from '../city/CrosswalkMarkings';
import { ParkSanctuary } from '../city/ParkSanctuary';
import { InteriorManager, InteriorState } from '../world/InteriorManager';
import { QualityManager, QualitySettings } from '../rendering/QualityManager';
import { PerformanceMonitor } from '../rendering/PerformanceMonitor';
import { InputManager } from '../player/InputManager';
import { NaturalClouds } from '../environment/NaturalClouds';
import { DirtParticles } from '../city/DirtParticles';
import { AtmosphericDetails } from '../city/AtmosphericDetails';
import { INTERIOR_DESTINATIONS } from '../world/InteriorDestinations';
import { AudioManager } from '../audio/AudioManager';

// Inner component to hook into R3F render loop for telemetry and dynamic updates
const SceneFrameLoop: React.FC = () => {
  const { gl, camera } = useThree();
  const perf = PerformanceMonitor.getInstance();

  useFrame(() => {
    perf.update(gl);
    (window as any).__NEXUS_CAMERA__ = camera;
  });

  return null;
};

export interface SceneProps {
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
}

export const Scene: React.FC<SceneProps> = ({ playerPosRef: externalPosRef }) => {
  const [quality, setQuality] = useState<QualitySettings>(QualityManager.current);
  const [interiorState, setInteriorState] = useState<InteriorState>(() =>
    InteriorManager.getInstance().getState()
  );

  const internalPosRef = useRef(new THREE.Vector3(0, 0.2, 10));
  const playerPosRef = externalPosRef || internalPosRef;
  const teleportFnRef = useRef<((pos: THREE.Vector3) => void) | null>(null);

  useEffect(() => {
    const unsubQ = QualityManager.subscribe(setQuality);
    const unsubInt = InteriorManager.getInstance().subscribe((state) => {
      setInteriorState(state);
      AudioManager.getInstance().setInteriorMode(state.current !== 'NONE');
    });
    return () => {
      unsubQ();
      unsubInt();
    };
  }, []);

  const handleTeleport = (newPos: THREE.Vector3) => {
    if (teleportFnRef.current) {
      teleportFnRef.current(newPos);
    }
  };

  const handleExitInterior = () => {
    InteriorManager.getInstance().exit(handleTeleport);
  };

  const isWorldMode = interiorState.worldMode === 'WORLD_ACTIVE' || interiorState.worldMode === 'INTERIOR_TRANSITION_IN';
  const isInteriorMode = interiorState.worldMode === 'INTERIOR_ACTIVE' || interiorState.worldMode === 'INTERIOR_TRANSITION_OUT';

  return (
    <Canvas
      shadows={quality.shadows}
      dpr={quality.dpr}
      camera={{ position: [0, 8, 16], fov: 60, near: 0.1, far: Math.max(3500, quality.drawDistance * 1.5) }}
      gl={{
        antialias: quality.name !== 'LITE',
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
      }}
      onCreated={({ gl }) => {
        InputManager.init(gl.domElement);
      }}
      style={{ width: '100vw', height: '100vh' }}
    >
      <SceneFrameLoop />
      <LightingManager quality={quality} playerPosRef={playerPosRef} />

      {/* ========================================================
          WORLD ROOT: Exterior Metropolis Infrastructure & Simulation
          ======================================================== */}
      <group name="worldRoot" visible={interiorState.worldMode !== 'INTERIOR_ACTIVE'}>
        {(isWorldMode || interiorState.worldMode === 'INTERIOR_TRANSITION_OUT') && (
          <>
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

            {/* 11 Enterable Building Entrances Across City Districts */}
            {Object.entries(INTERIOR_DESTINATIONS).map(([id, dest]) => (
              <BuildingEntrance
                key={id}
                id={id}
                name={dest.name}
                type={dest.interiorId}
                position={dest.entrancePosition}
                rotationY={dest.entranceRotationY}
                interactionPosition={dest.interactionPosition}
                playerPosRef={playerPosRef}
                onTeleport={handleTeleport}
              />
            ))}
          </>
        )}
      </group>

      {/* ========================================================
          INTERIOR ROOT: Procedural Interior Facilities & Dedicated Rig
          ======================================================== */}
      <group name="interiorRoot" visible={isInteriorMode}>
        {interiorState.current !== 'NONE' && (
          <ProceduralInterior
            type={interiorState.current}
            onExit={handleExitInterior}
          />
        )}
      </group>

      <PlayerController
        playerPosRef={playerPosRef}
        registerTeleport={(fn) => {
          teleportFnRef.current = fn;
        }}
      />
    </Canvas>
  );
};
