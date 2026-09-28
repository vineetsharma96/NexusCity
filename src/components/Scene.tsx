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
  const [isContextLost, setIsContextLost] = useState(false);

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
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Context Lost Visual Guard Banner */}
      {isContextLost && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(4, 7, 20, 0.85)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            color: '#00f0ff',
            fontFamily: 'monospace',
            letterSpacing: '1px',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: 800 }}>
            ⚠️ WEBGL CONTEXT INTERRUPTED
          </div>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Re-acquiring GPU hardware pipeline...
          </div>
        </div>
      )}

      <Canvas
        shadows={quality.shadows}
        dpr={quality.dpr}
        camera={{
          position: [0, 8, 16],
          fov: 60,
          near: 0.1,
          far: Math.min(2500, Math.max(1000, quality.drawDistance * 1.3)),
        }}
        gl={{
          antialias: quality.antiAliasing,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.12,
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          if (quality.shadows) {
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
          }

          const handleLost = (event: Event) => {
            event.preventDefault();
            console.warn('[Scene] WebGL context lost event captured; standing by for restoration');
            setIsContextLost(true);
          };

          const handleRestored = () => {
            console.info('[Scene] WebGL context restored successfully.');
            setIsContextLost(false);
          };

          gl.domElement.addEventListener('webglcontextlost', handleLost, false);
          gl.domElement.addEventListener('webglcontextrestored', handleRestored, false);

          InputManager.init(gl.domElement);
        }}
        style={{ width: '100%', height: '100%' }}
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
        {quality.particleDensity > 0.05 && <RainParticles playerPosRef={playerPosRef} />}
        {quality.cloudsEnabled && <NaturalClouds />}
        {quality.windParticlesEnabled && quality.particleDensity > 0.05 && (
          <DirtParticles playerPosRef={playerPosRef} />
        )}
        <AtmosphericDetails playerPosRef={playerPosRef} />
        <NPCCrowd playerPosRef={playerPosRef} />

        <PlayerController
          playerPosRef={playerPosRef}
          registerTeleport={(fn) => {
            teleportFnRef.current = fn;
          }}
        />
      </Canvas>
    </div>
  );
};
