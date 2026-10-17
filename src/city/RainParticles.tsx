import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { WeatherState, WeatherSystem } from '../world/WeatherSystem';
import { WindSystem } from '../world/WindSystem';
import { QualityManager } from '../rendering/QualityManager';

interface RainParticlesProps {
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
}

const BASE_DROP_COUNT = 1400;
const MAX_DROP_COUNT = 2800;
const BASE_EMBER_COUNT = 320;
const MAX_EMBER_COUNT = 640;

export const RainParticles: React.FC<RainParticlesProps> = ({ playerPosRef }) => {
  const rainMeshRef = useRef<THREE.InstancedMesh>(null);
  const emberMeshRef = useRef<THREE.InstancedMesh>(null);
  const rainMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const weatherRef = useRef<WeatherState>(WeatherSystem.getInstance().getState());
  const windSystem = WindSystem.getInstance();

  useEffect(() => {
    return WeatherSystem.getInstance().subscribe((w) => {
      weatherRef.current = w;
    });
  }, []);

  const drops = useMemo(
    () =>
      Array.from({ length: MAX_DROP_COUNT }, () => ({
        x: (Math.random() - 0.5) * 68,
        y: Math.random() * 30,
        z: (Math.random() - 0.5) * 68,
        speed: 0.85 + Math.random() * 0.35,
        len: 0.65 + Math.random() * 0.4,
      })),
    []
  );

  const embers = useMemo(
    () =>
      Array.from({ length: MAX_EMBER_COUNT }, () => ({
        x: (Math.random() - 0.5) * 76,
        y: 0.3 + Math.random() * 18,
        z: (Math.random() - 0.5) * 76,
        phase: Math.random() * Math.PI * 2,
        scale: 0.06 + Math.random() * 0.08,
      })),
    []
  );

  const dropGeo = useMemo(() => new THREE.CylinderGeometry(0.012, 0.015, 0.9, 4), []);
  const emberGeo = useMemo(() => new THREE.DodecahedronGeometry(0.45, 0), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const upVec = useMemo(() => new THREE.Vector3(0, -1, 0), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const weather = weatherRef.current;
    const pPos = playerPosRef.current;
    const quality = QualityManager.current;
    const density = quality.particlesDensity;

    // 1. Update Rain Streaks
    const rainActive = quality.rainParticlesEnabled && density > 0.02 && weather.rainIntensity > 0.02;
    if (rainMatRef.current) {
      rainMatRef.current.opacity = rainActive ? Math.min(0.62, weather.rainIntensity * 0.58) : 0;
      rainMatRef.current.visible = rainActive;
    }

    if (rainMeshRef.current) {
      if (!rainActive) {
        rainMeshRef.current.visible = false;
      } else {
        rainMeshRef.current.visible = true;
        const activeDrops = Math.min(
          drops.length,
          Math.max(60, Math.round(BASE_DROP_COUNT * density))
        );
        const wind = weather.windVector;
        quat.setFromUnitVectors(upVec, wind.clone().normalize());

        for (let i = 0; i < activeDrops; i++) {
          const d = drops[i];
          if (!d) continue;
          d.x += wind.x * dt * d.speed;
          d.y += wind.y * dt * d.speed;
          d.z += wind.z * dt * d.speed;

          if (d.y < pPos.y - 1) {
            d.y = pPos.y + 26 + Math.random() * 5;
            d.x = pPos.x + (Math.random() - 0.5) * 68;
            d.z = pPos.z + (Math.random() - 0.5) * 68;
          }
          dummy.position.set(d.x, d.y, d.z);
          dummy.quaternion.copy(quat);
          dummy.scale.set(1, d.len, 1);
          dummy.updateMatrix();
          rainMeshRef.current.setMatrixAt(i, dummy.matrix);
        }
        rainMeshRef.current.count = activeDrops;
        rainMeshRef.current.instanceMatrix.needsUpdate = true;
      }
    }

    // 2. Update Wind-Driven Atmospheric Motes
    if (emberMeshRef.current) {
      if (!quality.windParticlesEnabled || density <= 0.02) {
        emberMeshRef.current.visible = false;
        return;
      }
      emberMeshRef.current.visible = true;
      const t = clock.getElapsedTime();
      const windVec = windSystem.getVector();
      const gust = windSystem.getGustFactor();
      const activeEmbers = Math.min(
        embers.length,
        Math.max(24, Math.round(BASE_EMBER_COUNT * density))
      );

      for (let i = 0; i < activeEmbers; i++) {
        const e = embers[i];
        if (!e) continue;
        e.x += (windVec.x * 0.32 + Math.sin(t * 1.8 + e.phase) * 0.6) * dt * gust;
        e.y += Math.cos(t * 1.4 + e.phase) * 0.35 * dt;
        e.z += (windVec.z * 0.32 + Math.cos(t * 1.6 + e.phase) * 0.6) * dt * gust;

        if (e.x - pPos.x > 40) e.x -= 80;
        else if (e.x - pPos.x < -40) e.x += 80;
        if (e.z - pPos.z > 40) e.z -= 80;
        else if (e.z - pPos.z < -40) e.z += 80;

        dummy.position.set(e.x, Math.max(0.2, e.y), e.z);
        dummy.rotation.set(t + e.phase, t * 0.7, 0);
        dummy.scale.setScalar(e.scale);
        dummy.updateMatrix();
        emberMeshRef.current.setMatrixAt(i, dummy.matrix);
      }
      emberMeshRef.current.count = activeEmbers;
      emberMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group name="AtmosphericParticlesLayer">
      <instancedMesh ref={rainMeshRef} args={[dropGeo, undefined, MAX_DROP_COUNT]} frustumCulled={false}>
        <meshBasicMaterial ref={rainMatRef} color="#bae6fd" transparent opacity={0} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={emberMeshRef} args={[emberGeo, undefined, MAX_EMBER_COUNT]} frustumCulled={false}>
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.55} depthWrite={false} />
      </instancedMesh>
    </group>
  );
};
