import React, { useRef, useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { WindSystem } from '../world/WindSystem';
import { TimeSystem, TimeLightingState } from '../world/TimeSystem';
import { WeatherSystem, WeatherState } from '../world/WeatherSystem';

interface CloudCluster {
  x: number;
  y: number;
  z: number;
  baseScale: number;
  puffs: {
    offset: THREE.Vector3;
    scale: THREE.Vector3;
    rot: THREE.Euler;
  }[];
}

export const NaturalClouds: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const [timeLighting, setTimeLighting] = useState<TimeLightingState>(() =>
    TimeSystem.getInstance().getState()
  );
  const [weather, setWeather] = useState<WeatherState>(() =>
    WeatherSystem.getInstance().getState()
  );

  useEffect(() => {
    const unsubTime = TimeSystem.getInstance().subscribe(setTimeLighting);
    const unsubWeather = WeatherSystem.getInstance().subscribe(setWeather);
    return () => {
      unsubTime();
      unsubWeather();
    };
  }, []);

  // Generate 42 natural cloud clusters, each with 5-7 overlapping soft billowy puffs
  const { clusters, totalPuffs } = useMemo(() => {
    const clusterList: CloudCluster[] = [];
    const numClusters = 42;
    let puffCount = 0;

    for (let i = 0; i < numClusters; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 100 + Math.random() * 1200;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = 210 + Math.random() * 120; // 210m to 330m altitude
      const baseScale = 45 + Math.random() * 55;

      const numPuffs = 5 + Math.floor(Math.random() * 4);
      const puffs: CloudCluster['puffs'] = [];

      for (let j = 0; j < numPuffs; j++) {
        puffs.push({
          offset: new THREE.Vector3(
            (Math.random() - 0.5) * baseScale * 1.6,
            (Math.random() - 0.5) * baseScale * 0.45,
            (Math.random() - 0.5) * baseScale * 1.2
          ),
          scale: new THREE.Vector3(
            baseScale * (0.6 + Math.random() * 0.7),
            baseScale * (0.35 + Math.random() * 0.4),
            baseScale * (0.6 + Math.random() * 0.7)
          ),
          rot: new THREE.Euler(
            Math.random() * 0.3,
            Math.random() * Math.PI,
            Math.random() * 0.3
          ),
        });
      }

      puffCount += numPuffs;
      clusterList.push({ x, y, z, baseScale, puffs });
    }

    return { clusters: clusterList, totalPuffs: puffCount };
  }, []);

  // Shared geometry for soft cloud puff
  const geometry = useMemo(() => {
    return new THREE.DodecahedronGeometry(1.0, 2);
  }, []);

  // Cloud material with soft shading and atmospheric blending
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.95,
      metalness: 0.05,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    });
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const cloudColor = useMemo(() => new THREE.Color(), []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    const wind = WindSystem.getInstance().getVector();
    const driftSpeed = 0.25; // Clouds drift at high altitude
    const worldRadius = 1400;

    // Determine cloud color based on time and weather
    if (weather.lightningIntensity > 0.05) {
      cloudColor.set('#e0f2fe'); // flash bright lightning blue-white
    } else if (weather.currentWeather === 'HEAVY_RAIN' || weather.currentWeather === 'RAIN') {
      cloudColor.set(timeLighting.isNight ? '#0b101a' : '#222b3a'); // dark stormy slate
    } else if (timeLighting.isNight) {
      cloudColor.set('#10182b'); // deep nocturnal indigo
    } else if (timeLighting.phase === 'SUNSET' || timeLighting.phase === 'DAWN') {
      cloudColor.set('#f59e0b'); // golden amber sunset rim
    } else {
      cloudColor.set('#e2e8f0'); // bright silver-white day cumulus
    }

    material.color.copy(cloudColor);
    material.opacity = weather.currentWeather === 'HEAVY_RAIN' ? 0.94 : weather.currentWeather === 'CLOUDY' ? 0.88 : 0.78;

    let instanceIdx = 0;

    for (const cluster of clusters) {
      // Drift cloud cluster with wind
      cluster.x += wind.x * driftSpeed * delta;
      cluster.z += wind.z * driftSpeed * delta;

      // Wrap around world boundary
      if (cluster.x > worldRadius) cluster.x -= worldRadius * 2;
      else if (cluster.x < -worldRadius) cluster.x += worldRadius * 2;

      if (cluster.z > worldRadius) cluster.z -= worldRadius * 2;
      else if (cluster.z < -worldRadius) cluster.z += worldRadius * 2;

      // Storms lower cloud base
      const currentY = weather.currentWeather === 'HEAVY_RAIN' ? cluster.y * 0.82 : cluster.y;

      for (const puff of cluster.puffs) {
        dummy.position.set(
          cluster.x + puff.offset.x,
          currentY + puff.offset.y,
          cluster.z + puff.offset.z
        );
        dummy.rotation.copy(puff.rot);
        dummy.scale.copy(puff.scale);
        dummy.updateMatrix();

        meshRef.current.setMatrixAt(instanceIdx, dummy.matrix);
        instanceIdx++;
      }
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, totalPuffs]}
        frustumCulled={false}
      />
    </group>
  );
};
