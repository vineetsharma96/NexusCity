import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { LightingManager } from '../lighting/LightingManager';
import { CityDistrict } from '../city/CityDistrict';
import { PlayerController } from '../player/PlayerController';
import { NPCCrowd } from '../npc/NPCCrowd';
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
import { RideableTransitLayer } from '../vehicle/RideableTransitLayer';
import { VehicleRepairStations } from '../vehicle/VehicleRepairStations';
import { RooftopShortcutSystem } from '../world/RooftopShortcutSystem';
import { LivingCityEventDisplay } from '../world/LivingCityEventDisplay';
import { InteractiveTerminals } from '../world/InteractiveTerminals';
import { NavigationRibbon } from '../map/NavigationRibbon';

const InputLifecycle: React.FC<{ onContextChange: (lost: boolean) => void }> = ({ onContextChange }) => {
  const { gl } = useThree();

  useEffect(() => {
    InputManager.init(gl.domElement);
    let wasBlocked = false;
    const lost = (event: Event) => {
      event.preventDefault();
      wasBlocked = InputManager.isUIBlocked();
      InputManager.setUIBlocking(true);
      onContextChange(true);
      window.dispatchEvent(new CustomEvent('nexus:webgl-context', { detail: { lost: true } }));
    };
    const restored = () => {
      InputManager.setUIBlocking(wasBlocked);
      onContextChange(false);
      window.dispatchEvent(new CustomEvent('nexus:webgl-context', { detail: { lost: false } }));
    };
    gl.domElement.addEventListener('webglcontextlost', lost);
    gl.domElement.addEventListener('webglcontextrestored', restored);
    return () => {
      InputManager.dispose();
      gl.domElement.removeEventListener('webglcontextlost', lost);
      gl.domElement.removeEventListener('webglcontextrestored', restored);
    };
  }, [gl, onContextChange]);

  return null;
};

// Inner component to hook into R3F render loop for telemetry and dynamic updates
const SceneFrameLoop: React.FC = () => {
  const { gl, camera } = useThree();
  const perf = PerformanceMonitor.getInstance();
  const readyFrame = useRef<number | null>(null);
  const firstFrame = useRef(false);

  useEffect(() => {
    const autoReset = gl.info.autoReset;
    gl.info.autoReset = false;
    (window as any).__NEXUS_CAMERA__ = camera;
    return () => {
      gl.info.autoReset = autoReset;
      if (readyFrame.current !== null) cancelAnimationFrame(readyFrame.current);
      firstFrame.current = false;
      (window as any).__NEXUS_WORLD_READY__ = false;
      delete (window as any).__NEXUS_CAMERA__;
    };
  }, [camera, gl]);

  useFrame((_, delta) => {
    perf.update(gl);
    gl.info.reset();
    if (!firstFrame.current) {
      firstFrame.current = true;
      readyFrame.current = requestAnimationFrame(() => {
        (window as any).__NEXUS_WORLD_READY__ = true;
        window.dispatchEvent(new Event('nexus:world-ready'));
      });
    }

    // Dynamic Tone Mapping Exposure based on diurnal phase
    const timeState = TimeSystem.getInstance().getState();
    const targetExposure = timeState.isNight ? 1.35 : timeState.phase === 'SUNSET' ? 1.25 : 1.08;
    gl.toneMappingExposure = THREE.MathUtils.lerp(gl.toneMappingExposure, targetExposure, 1 - Math.exp(-3 * delta));
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
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
    {isContextLost && <div role="alert" style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'grid', placeContent: 'center', gap: 16, padding: 24, background: 'rgba(5, 8, 17, 0.96)', textAlign: 'center' }}>
      <h2>Graphics session interrupted</h2>
      <p>Waiting for the browser to restore the graphics connection.</p>
      <button className="cyber-btn" onClick={() => { QualityManager.setPreset('LITE'); window.location.reload(); }}>Restart in Lite mode</button>
    </div>}
    <Canvas
      shadows={quality.shadows}
      dpr={quality.dpr}
      camera={{ position: [0, 8, 16], fov: 60, near: 0.1, far: Math.min(3500, Math.max(1000, quality.drawDistance * 1.3)) }}
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
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <InputLifecycle onContextChange={setIsContextLost} />
      <SceneFrameLoop />
      <PostProcessingManager quality={quality} />
      <LightingManager quality={quality} playerPosRef={playerPosRef} />

      {/* ========================================================
          CONTINUOUS OUTDOOR METROPOLIS EXPLORATION
          ======================================================== */}
      <CityDistrict seed={847291} />
      <LivingCityEventDisplay />
      <InteractiveTerminals />
      <NavigationRibbon />
      <WorldManager playerPosRef={playerPosRef} />
      <TrafficSystem playerPosRef={playerPosRef} />
      <RideableTransitLayer playerPosRef={playerPosRef} />
      <VehicleRepairStations />
      <RooftopShortcutSystem teleportRef={teleportFnRef} />
      <TrafficLightGantry position={[0, 0, 0]} />
      <CrosswalkMarkings position={[0, 0, 0]} />
      <ParkSanctuary position={[75, 0, 75]} />
      {quality.particlesDensity > 0.05 && <RainParticles playerPosRef={playerPosRef} />}
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
    </div>
  );
};
