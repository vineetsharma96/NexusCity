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
import { InteriorManager, InteriorState } from '../world/InteriorManager';
import { QualityManager, QualitySettings } from '../rendering/QualityManager';
import { PerformanceMonitor } from '../rendering/PerformanceMonitor';
import { InputManager } from '../player/InputManager';

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
  const internalPosRef = useRef(new THREE.Vector3(0, 0.2, 10));
  const playerPosRef = externalPosRef || internalPosRef;
  const teleportFnRef = useRef<((pos: THREE.Vector3) => void) | null>(null);

  const [interiorState, setInteriorState] = useState<InteriorState>(() =>
    InteriorManager.getInstance().getState()
  );

  useEffect(() => {
    const unsubQ = QualityManager.subscribe(setQuality);
    const unsubInt = InteriorManager.getInstance().subscribe(setInteriorState);
    return () => {
      unsubQ();
      unsubInt();
    };
  }, []);

  const handleTeleport = (pos: THREE.Vector3) => {
    if (teleportFnRef.current) {
      teleportFnRef.current(pos);
    }
  };

  const handleExitInterior = () => {
    InteriorManager.getInstance().exit(handleTeleport);
  };

  return (
    <Canvas
      shadows={quality.shadows}
      dpr={quality.dpr}
      camera={{ position: [0, 8, 16], fov: 60, near: 0.1, far: quality.drawDistance }}
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

      {/* Exterior City District & Entrances */}
      <CityDistrict seed={847291} />
      <NavigationRibbon />
      <WorldManager playerPosRef={playerPosRef} />
      {interiorState.current === 'NONE' && <TrafficSystem playerPosRef={playerPosRef} />}
      {interiorState.current === 'NONE' && <RainParticles playerPosRef={playerPosRef} />}

      {/* Enterable Building Entrance 1: Nexus Advanced Labs (East Avenue) */}
      <BuildingEntrance
        id="nexus_labs"
        name="Nexus Advanced Labs"
        type="LAB"
        position={new THREE.Vector3(15.2, 0.18, 32)}
        rotationY={-Math.PI / 2}
        playerPosRef={playerPosRef}
        onTeleport={handleTeleport}
      />

      {/* Enterable Building Entrance 2: Cyber Lounge & Cafe (West Avenue) */}
      <BuildingEntrance
        id="cyber_lounge"
        name="Neon Velocity Lounge"
        type="LOUNGE"
        position={new THREE.Vector3(-15.2, 0.18, 32)}
        rotationY={Math.PI / 2}
        playerPosRef={playerPosRef}
        onTeleport={handleTeleport}
      />

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
