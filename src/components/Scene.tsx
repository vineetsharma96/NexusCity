import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { LightingManager } from '../lighting/LightingManager';
import { CityDistrict } from '../city/CityDistrict';
import { PlayerController } from '../player/PlayerController';
import { NPCCrowd } from '../npc/NPCCrowd';
import { WorldManager } from '../world/WorldManager';
import { RainParticles } from '../city/RainParticles';
import { SteamVentSystem } from '../city/SteamVentSystem';
import { FallingLeavesSystem } from '../city/FallingLeavesSystem';
import { TrafficSystem } from '../city/TrafficSystem';
import { TrafficLightGantry } from '../city/TrafficLightGantry';
import { ParkSanctuary } from '../city/ParkSanctuary';
import { QualityManager, QualitySettings } from '../rendering/QualityManager';
import { PerformanceMonitor } from '../rendering/PerformanceMonitor';
import { InputManager } from '../player/InputManager';
import { NaturalClouds } from '../environment/NaturalClouds';
import { PostProcessingManager } from '../rendering/PostProcessingManager';
import { TimeSystem } from '../world/TimeSystem';
import { RideableTransitLayer } from '../vehicle/RideableTransitLayer';
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

const SceneFrameLoop: React.FC = () => {
  const { gl, camera } = useThree();
  const perf = PerformanceMonitor.getInstance();
  const readyFrame = useRef<number | null>(null);
  const firstFrame = useRef(false);

  useEffect(() => {
    const autoReset = gl.info.autoReset;
    gl.info.autoReset = false;
    (window as unknown as { __NEXUS_CAMERA__?: THREE.Camera }).__NEXUS_CAMERA__ = camera;
    return () => {
      gl.info.autoReset = autoReset;
      if (readyFrame.current !== null) cancelAnimationFrame(readyFrame.current);
      firstFrame.current = false;
      (window as unknown as { __NEXUS_WORLD_READY__?: boolean }).__NEXUS_WORLD_READY__ = false;
      delete (window as unknown as { __NEXUS_CAMERA__?: THREE.Camera }).__NEXUS_CAMERA__;
    };
  }, [camera, gl]);

  useFrame((_, delta) => {
    perf.update(gl);
    gl.info.reset();
    if (!firstFrame.current) {
      firstFrame.current = true;
      readyFrame.current = requestAnimationFrame(() => {
        (window as unknown as { __NEXUS_WORLD_READY__?: boolean }).__NEXUS_WORLD_READY__ = true;
        window.dispatchEvent(new Event('nexus:world-ready'));
      });
    }

    const timeState = TimeSystem.getInstance().getState();
    const targetExposure = timeState.exposureTarget ?? (timeState.isNight ? 1.32 : timeState.phase === 'SUNSET' ? 1.22 : 1.08);
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
    return QualityManager.subscribe(setQuality);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {isContextLost && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'grid',
            placeContent: 'center',
            gap: 16,
            padding: 24,
            background: 'rgba(7, 9, 14, 0.96)',
            textAlign: 'center',
          }}
        >
          <h2>Graphics session interrupted</h2>
          <p>Waiting for the browser to restore the WebGL context.</p>
          <button
            className="cyber-btn cyber-btn-primary"
            onClick={() => {
              QualityManager.setPreset('LITE');
              window.location.reload();
            }}
          >
            Restart in Lite Mode
          </button>
        </div>
      )}
      <Canvas
        shadows={quality.shadows}
        dpr={quality.dpr}
        camera={{
          position: [0, 8, 16],
          fov: 60,
          near: 0.1,
          far: Math.min(3500, Math.max(1000, quality.drawDistance * 1.3)),
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
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <InputLifecycle onContextChange={setIsContextLost} />
        <SceneFrameLoop />
        <PostProcessingManager quality={quality} />
        <LightingManager quality={quality} playerPosRef={playerPosRef} />

        <CityDistrict seed={847291} />
        <InteractiveTerminals teleportRef={teleportFnRef} />
        <NavigationRibbon />
        <WorldManager playerPosRef={playerPosRef} />
        {quality.trafficEnabled && <TrafficSystem playerPosRef={playerPosRef} />}
        <RideableTransitLayer playerPosRef={playerPosRef} />
        <TrafficLightGantry position={[0, 0, 0]} />
        <ParkSanctuary position={[75, 0, 75]} />
        {quality.streetFurnitureEnabled && <SteamVentSystem playerPosRef={playerPosRef} />}
        {quality.vegetationEnabled && <FallingLeavesSystem playerPosRef={playerPosRef} seed={847291} />}
        {quality.particlesDensity > 0.02 &&
          (quality.rainParticlesEnabled || quality.windParticlesEnabled) && (
            <RainParticles playerPosRef={playerPosRef} />
          )}
        {quality.cloudsEnabled && <NaturalClouds />}
        {quality.npcsEnabled && <NPCCrowd playerPosRef={playerPosRef} />}

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
