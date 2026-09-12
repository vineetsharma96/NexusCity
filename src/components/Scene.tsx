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
    const unsubInt = InteriorManager.getInstance().subscribe(setInteriorState);
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
      {interiorState.current === 'NONE' && <NaturalClouds />}
      {interiorState.current === 'NONE' && <DirtParticles playerPosRef={playerPosRef} />}

      {/* 11 Enterable Building Entrances Across City Districts */}
      {interiorState.current === 'NONE' && (
        <>
          {/* 1. Nexus Advanced Labs */}
          <BuildingEntrance
            id="nexus_labs"
            name="Nexus Advanced Labs"
            type="LAB"
            position={new THREE.Vector3(15.2, 0.18, 32)}
            rotationY={-Math.PI / 2}
            playerPosRef={playerPosRef}
            onTeleport={handleTeleport}
          />

          {/* 2. Neon Velocity Lounge */}
          <BuildingEntrance
            id="cyber_lounge"
            name="Neon Velocity Lounge"
            type="LOUNGE"
            position={new THREE.Vector3(-15.2, 0.18, 32)}
            rotationY={Math.PI / 2}
            playerPosRef={playerPosRef}
            onTeleport={handleTeleport}
          />

          {/* 3. Krom-Doc Augmentation Clinic */}
          <BuildingEntrance
            id="ripperdoc_clinic"
            name="Krom-Doc Clinic"
            type="CLINIC"
            position={new THREE.Vector3(-15.2, 0.18, -32)}
            rotationY={Math.PI / 2}
            playerPosRef={playerPosRef}
            onTeleport={handleTeleport}
          />

          {/* 4. Black-Ice Netrunner Safehouse */}
          <BuildingEntrance
            id="netrunner_den"
            name="Black-Ice Safehouse"
            type="NETRUNNER_DEN"
            position={new THREE.Vector3(15.2, 0.18, -32)}
            rotationY={-Math.PI / 2}
            playerPosRef={playerPosRef}
            onTeleport={handleTeleport}
          />

          {/* 5. Tokyo-Neo Synth-Ramen Diner */}
          <BuildingEntrance
            id="ramen_diner"
            name="Tokyo-Neo Ramen"
            type="RAMEN_DINER"
            position={new THREE.Vector3(32, 0.18, 15.2)}
            rotationY={Math.PI}
            playerPosRef={playerPosRef}
            onTeleport={handleTeleport}
          />

          {/* 6. Aero-Cargo Drone Repair Bay */}
          <BuildingEntrance
            id="drone_hangar"
            name="Aero-Cargo Drone Bay"
            type="DRONE_HANGAR"
            position={new THREE.Vector3(32, 0.18, -15.2)}
            rotationY={Math.PI}
            playerPosRef={playerPosRef}
            onTeleport={handleTeleport}
          />

          {/* 7. Apex Tower Sky Observation Penthouse */}
          <BuildingEntrance
            id="sky_penthouse"
            name="Apex Sky Penthouse"
            type="PENTHOUSE"
            position={new THREE.Vector3(-32, 0.18, 15.2)}
            rotationY={0}
            playerPosRef={playerPosRef}
            onTeleport={handleTeleport}
          />

          {/* 8. Megacorp Secure Data Vault */}
          <BuildingEntrance
            id="server_vault"
            name="Megacorp Data Vault"
            type="SERVER_VAULT"
            position={new THREE.Vector3(-32, 0.18, -15.2)}
            rotationY={0}
            playerPosRef={playerPosRef}
            onTeleport={handleTeleport}
          />

          {/* 9. Biosphere Hydroponic Flora Lab */}
          <BuildingEntrance
            id="biosphere_greenhouse"
            name="Biosphere Flora Lab"
            type="GREENHOUSE"
            position={new THREE.Vector3(42, 0.18, 75)}
            rotationY={-Math.PI / 2}
            playerPosRef={playerPosRef}
            onTeleport={handleTeleport}
          />

          {/* 10. Hyperloop Metro Transit Hub */}
          <BuildingEntrance
            id="metro_station"
            name="Hyperloop Metro Hub"
            type="METRO_STATION"
            position={new THREE.Vector3(0, 0.18, 52)}
            rotationY={0}
            playerPosRef={playerPosRef}
            onTeleport={handleTeleport}
          />

          {/* 11. Cyber-Strike 2099 Retro Arcade */}
          <BuildingEntrance
            id="cyber_arcade"
            name="Cyber-Strike Arcade"
            type="ARCADE"
            position={new THREE.Vector3(0, 0.18, -52)}
            rotationY={Math.PI}
            playerPosRef={playerPosRef}
            onTeleport={handleTeleport}
          />
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
