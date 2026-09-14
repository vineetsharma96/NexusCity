import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { WeatherSystem, WeatherState } from '../world/WeatherSystem';
import { QualityManager } from '../rendering/QualityManager';

interface RainParticlesProps {
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
}

const DROP_COUNT = 1800;
const SPLASH_COUNT = 90;

export const RainParticles: React.FC<RainParticlesProps> = ({ playerPosRef }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const splashMeshRef = useRef<THREE.InstancedMesh>(null);
  const rainMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const splashMatRef = useRef<THREE.MeshBasicMaterial>(null);

  // Weather state listener
  const weatherRef = useRef<WeatherState>(WeatherSystem.getInstance().getState());

  useEffect(() => {
    return WeatherSystem.getInstance().subscribe((w) => {
      weatherRef.current = w;
    });
  }, []);

  // Raindrop simulation arrays
  const drops = useMemo(() => {
    const data = [];
    for (let i = 0; i < DROP_COUNT; i++) {
      data.push({
        x: (Math.random() - 0.5) * 70,
        y: Math.random() * 32,
        z: (Math.random() - 0.5) * 70,
        speedMult: 0.85 + Math.random() * 0.35,
        length: 0.6 + Math.random() * 0.45,
      });
    }
    return data;
  }, []);

  // Ground splash simulation arrays
  const splashes = useMemo(() => {
    const data = [];
    for (let i = 0; i < SPLASH_COUNT; i++) {
      data.push({
        x: (Math.random() - 0.5) * 40,
        y: 0.04,
        z: (Math.random() - 0.5) * 40,
        life: Math.random(), // 0 to 1
        scale: 0.1,
      });
    }
    return data;
  }, []);

  // Base geometries
  const dropGeo = useMemo(() => new THREE.CylinderGeometry(0.012, 0.016, 0.9, 4), []);
  const splashGeo = useMemo(() => new THREE.RingGeometry(0.05, 0.22, 8), []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const splashDummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, delta) => {
    const weather = weatherRef.current;
    const rainIntensity = weather.rainIntensity;

    // Update material opacities based on rain intensity
    if (rainMatRef.current) {
      rainMatRef.current.opacity = Math.min(0.65, rainIntensity * 0.6);
      rainMatRef.current.visible = rainIntensity > 0.02;
    }
    if (splashMatRef.current) {
      splashMatRef.current.opacity = Math.min(0.45, rainIntensity * 0.4);
      splashMatRef.current.visible = rainIntensity > 0.1;
    }

    if (rainIntensity <= 0.02 || !meshRef.current) return;

    const pPos = playerPosRef.current;
    const wind = weather.windVector;

    // Dynamic density scaling by quality profile
    const density = QualityManager.current.particlesDensity;
    const activeDropCount = Math.max(120, Math.round(DROP_COUNT * density));
    const activeSplashCount = Math.max(10, Math.round(SPLASH_COUNT * density));

    // Orientation quaternion aligning drop along wind vector
    const windDir = wind.clone().normalize();
    const up = new THREE.Vector3(0, -1, 0); // Drop flows down along wind
    const quat = new THREE.Quaternion().setFromUnitVectors(up, windDir);

    // 1. Update Raindrops
    for (let i = 0; i < activeDropCount; i++) {
      const drop = drops[i];

      // Integrate motion
      drop.x += wind.x * delta * drop.speedMult;
      drop.y += wind.y * delta * drop.speedMult;
      drop.z += wind.z * delta * drop.speedMult;

      // Wrap vertically around player
      const bottomLimit = pPos.y - 1;
      const topLimit = pPos.y + 26;

      if (drop.y < bottomLimit) {
        drop.y = topLimit + Math.random() * 6;
        drop.x = pPos.x + (Math.random() - 0.5) * 70;
        drop.z = pPos.z + (Math.random() - 0.5) * 70;
      }

      // Wrap horizontally if drifted too far from player
      if (Math.abs(drop.x - pPos.x) > 38) {
        drop.x = pPos.x + (Math.random() - 0.5) * 70;
      }
      if (Math.abs(drop.z - pPos.z) > 38) {
        drop.z = pPos.z + (Math.random() - 0.5) * 70;
      }

      dummy.position.set(drop.x, drop.y, drop.z);
      dummy.quaternion.copy(quat);
      dummy.scale.set(1, drop.length, 1);
      dummy.updateMatrix();

      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.count = activeDropCount;
    meshRef.current.instanceMatrix.needsUpdate = true;

    // 2. Update Ground Splashes
    if (splashMeshRef.current && rainIntensity > 0.1) {
      for (let i = 0; i < activeSplashCount; i++) {
        const splash = splashes[i];
        splash.life += delta * (2.8 + rainIntensity * 2.0);

        if (splash.life >= 1.0) {
          splash.life = 0;
          splash.x = pPos.x + (Math.random() - 0.5) * 44;
          splash.z = pPos.z + (Math.random() - 0.5) * 44;
          splash.y = 0.04;
        }

        splash.scale = 0.1 + splash.life * 0.7;

        splashDummy.position.set(splash.x, splash.y, splash.z);
        splashDummy.rotation.x = -Math.PI / 2;
        splashDummy.scale.set(splash.scale, splash.scale, 1);
        splashDummy.updateMatrix();

        splashMeshRef.current.setMatrixAt(i, splashDummy.matrix);
      }
      splashMeshRef.current.count = activeSplashCount;
      splashMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group name="RainPrecipitationSystem">
      {/* Falling Rain Streaks */}
      <instancedMesh
        ref={meshRef}
        args={[dropGeo, undefined, DROP_COUNT]}
        frustumCulled={false}
      >
        <meshBasicMaterial
          ref={rainMatRef}
          color="#c8e4ff"
          transparent
          opacity={0.0}
          depthWrite={false}
        />
      </instancedMesh>

      {/* Pavement Ground Splash Discs */}
      <instancedMesh
        ref={splashMeshRef}
        args={[splashGeo, undefined, SPLASH_COUNT]}
        frustumCulled={false}
      >
        <meshBasicMaterial
          ref={splashMatRef}
          color="#d8edff"
          transparent
          opacity={0.0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
    </group>
  );
};
