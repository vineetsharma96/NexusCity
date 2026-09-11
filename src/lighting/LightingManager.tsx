import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { QualitySettings } from '../rendering/QualityManager';
import { TimeSystem, TimeLightingState } from '../world/TimeSystem';
import { WeatherSystem, WeatherState } from '../world/WeatherSystem';

interface LightingManagerProps {
  quality: QualitySettings;
}

export const LightingManager: React.FC<LightingManagerProps> = ({ quality }) => {
  const { scene } = useThree();
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight>(null);
  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const fogRef = useRef<THREE.Fog>(null);

  const [lighting, setLighting] = useState<TimeLightingState>(() =>
    TimeSystem.getInstance().getState()
  );
  const [weather, setWeather] = useState<WeatherState>(() =>
    WeatherSystem.getInstance().getState()
  );

  useEffect(() => {
    const unsubTime = TimeSystem.getInstance().subscribe(setLighting);
    const unsubWeather = WeatherSystem.getInstance().subscribe(setWeather);
    return () => {
      unsubTime();
      unsubWeather();
    };
  }, []);

  useFrame((_, delta) => {
    // Advance continuous time system & weather simulation
    TimeSystem.getInstance().update(delta);
    WeatherSystem.getInstance().update(delta);

    // 1. Calculate blended sky & fog colors
    const baseSky = new THREE.Color(lighting.skyColor);
    const stormySky = new THREE.Color('#050810');
    const lightningSky = new THREE.Color('#cce8ff');

    const effectiveSky = baseSky.clone().lerp(stormySky, weather.skyDarkness);
    if (weather.lightningIntensity > 0.01) {
      effectiveSky.lerp(lightningSky, weather.lightningIntensity * 0.85);
    }

    if (scene.background instanceof THREE.Color) {
      scene.background.copy(effectiveSky);
    }

    // 2. Dynamic Fog adjustment
    const baseFog = new THREE.Color(lighting.fogColor);
    const weatherFog = new THREE.Color(weather.fogColorTint);
    const effectiveFogColor = baseFog.clone().lerp(weatherFog, Math.min(1.0, (weather.fogDensityMultiplier - 1.0) / 2.0));
    if (weather.lightningIntensity > 0.01) {
      effectiveFogColor.lerp(lightningSky, weather.lightningIntensity * 0.7);
    }

    const baseNear = 75;
    const baseFar = quality.drawDistance;
    const effectiveNear = Math.max(12, baseNear / weather.fogDensityMultiplier);
    const effectiveFar = Math.max(48, baseFar / weather.fogDensityMultiplier);

    if (fogRef.current) {
      fogRef.current.near = effectiveNear;
      fogRef.current.far = effectiveFar;
      fogRef.current.color.copy(effectiveFogColor);
    }

    // 3. Directional celestial light (Sun/Moon + Lightning flash)
    if (dirLightRef.current) {
      dirLightRef.current.position.copy(lighting.celestialPosition);

      const celestialDimming = 1.0 - weather.skyDarkness * 0.65;
      const lightningBoost = weather.lightningIntensity * 5.0;
      dirLightRef.current.intensity = (lighting.celestialIntensity * celestialDimming) + lightningBoost;

      if (weather.lightningIntensity > 0.05) {
        dirLightRef.current.color.set('#e0f2fe');
      } else {
        dirLightRef.current.color.set(lighting.celestialColor);
      }
    }

    // 4. Hemisphere light (sky irradiance + ground bounce)
    if (hemiLightRef.current) {
      const hemiDim = 1.0 - weather.skyDarkness * 0.45;
      hemiLightRef.current.color.copy(effectiveSky);
      hemiLightRef.current.groundColor.set(lighting.hemiGroundColor);
      hemiLightRef.current.intensity = (lighting.isNight ? 0.65 : 1.25) * hemiDim + weather.lightningIntensity * 1.2;
    }

    // 5. Ambient fill light
    if (ambientLightRef.current) {
      const ambDim = 1.0 - weather.skyDarkness * 0.5;
      ambientLightRef.current.intensity = lighting.ambientIntensity * ambDim + weather.lightningIntensity * 1.5;
    }
  });

  return (
    <>
      {/* Dynamic sky and distance fog */}
      <color attach="background" args={[lighting.skyColor]} />
      <fog ref={fogRef} attach="fog" args={[lighting.fogColor, 75, quality.drawDistance]} />

      {/* Hemisphere light */}
      <hemisphereLight
        ref={hemiLightRef}
        args={[lighting.hemiSkyColor, lighting.hemiGroundColor, 1.2]}
      />

      {/* Primary directional celestial light (Sun or Moon) */}
      <directionalLight
        ref={dirLightRef}
        position={[lighting.celestialPosition.x, lighting.celestialPosition.y, lighting.celestialPosition.z]}
        intensity={lighting.celestialIntensity}
        color={lighting.celestialColor}
        castShadow={quality.shadows}
        shadow-mapSize-width={quality.shadowMapSize}
        shadow-mapSize-height={quality.shadowMapSize}
        shadow-camera-near={0.5}
        shadow-camera-far={quality.drawDistance * 0.65}
        shadow-camera-left={-95}
        shadow-camera-right={95}
        shadow-camera-top={95}
        shadow-camera-bottom={-95}
        shadow-bias={-0.0003}
      />

      {/* Ambient fill light */}
      <ambientLight ref={ambientLightRef} intensity={lighting.ambientIntensity} color="#182a4d" />
    </>
  );
};
