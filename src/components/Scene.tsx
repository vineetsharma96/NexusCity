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
import { INTERIOR_DESTINATIONS } from '../world/InteriorDestinations';
import { AudioManager } from '../audio/AudioManager';

// Inner component to hook into R3F render loop for telemetry and dynamic updates
const SceneFrameLoop: React.FC = () => {
  const { gl } = useThree();
  const perf = PerformanceMonitor.getInstance();

  useFrame(() => {
    perf.update(gl);
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

      {/* Exterior City District & Infrastructure */}
      <CityDistrict seed={847291} />
      <NavigationRibbon />
      <WorldManager playerPosRef={playerPosRef} />
      {interiorState.current === 'NONE' && <TrafficSystem playerPosRef={playerPosRef} />}
      {interiorState.current === 'NONE' && <TrafficLightGantry position={[0, 0, 0]} />}
      {interiorState.current === 'NONE' && <CrosswalkMarkings position={[0, 0, 0]} />}
      {interiorState.current === 'NONE' && <ParkSanctuary position={[75, 0, 75]} />}
      {interiorState.current === 'NONE' && <RainParticles playerPosRef={playerPosRef} />}
      {interiorState.current === 'NONE' && quality.cloudsEnabled && <NaturalClouds />}
      {interiorState.current === 'NONE' && quality.windParticlesEnabled && <DirtParticles playerPosRef={playerPosRef} />}

      {/* 11 Enterable Building Entrances Across City Districts */}
      {interiorState.current === 'NONE' && (
        <>
          {Object.entries(INTERIOR_DESTINATIONS).map(([id, dest]) => {
            const rotY =
              id === 'nexus_labs' || id === 'netrunner_den' || id === 'biosphere_greenhouse'
                ? -Math.PI / 2
                : id === 'cyber_lounge' || id === 'ripperdoc_clinic'
                ? Math.PI / 2
                : id === 'ramen_diner' || id === 'drone_hangar' || id === 'cyber_arcade'
                ? Math.PI
                : 0;

            return (
              <BuildingEntrance
                key={id}
                id={id}
                name={dest.name}
                type={dest.interiorId}
                position={dest.entrancePosition}
                rotationY={rotY}
                playerPosRef={playerPosRef}
                onTeleport={handleTeleport}
              />
            );
          })}
        </>
      )}

      {/* Procedural Interior Room when inside */}
      <ProceduralInterior
        type={interiorState.current}
        onExit={handleExitInterior}
      />

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
