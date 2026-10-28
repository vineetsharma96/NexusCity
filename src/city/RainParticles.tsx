import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { WeatherState, WeatherSystem } from '../world/WeatherSystem';
import { WindSystem } from '../world/WindSystem';
import { QualityManager } from '../rendering/QualityManager';

interface RainParticlesProps {
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
}

const BASE_DROP_COUNT = 1500;
const MAX_DROP_COUNT = 2800;
const BASE_SPLASH_COUNT = 220;
const MAX_SPLASH_COUNT = 420;
const BASE_SNOW_COUNT = 1400;
const MAX_SNOW_COUNT = 2600;
const BASE_EMBER_COUNT = 320;
const MAX_EMBER_COUNT = 640;

export const RainParticles: React.FC<RainParticlesProps> = ({ playerPosRef }) => {
  const rainMeshRef = useRef<THREE.InstancedMesh>(null);
  const splashMeshRef = useRef<THREE.InstancedMesh>(null);
  const snowMeshRef = useRef<THREE.InstancedMesh>(null);
  const emberMeshRef = useRef<THREE.InstancedMesh>(null);

  const rainMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const splashMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const snowMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const weatherRef = useRef<WeatherState>(WeatherSystem.getInstance().getState());
  const windSystem = WindSystem.getInstance();
  const prevPlayerPosRef = useRef(new THREE.Vector3());

  useEffect(() => {
    return WeatherSystem.getInstance().subscribe((w) => {
      weatherRef.current = w;
    });
  }, []);

  const drops = useMemo(
    () =>
      Array.from({ length: MAX_DROP_COUNT }, () => ({
        x: (Math.random() - 0.5) * 136,
        y: Math.random() * 32,
        z: (Math.random() - 0.5) * 136,
        speed: 0.85 + Math.random() * 0.35,
        len: 0.65 + Math.random() * 0.4,
      })),
    []
  );

  const splashes = useMemo(
    () =>
      Array.from({ length: MAX_SPLASH_COUNT }, () => ({
        x: (Math.random() - 0.5) * 84,
        z: (Math.random() - 0.5) * 84,
        age: Math.random(),
        speed: 2.2 + Math.random() * 1.8,
        maxRadius: 0.16 + Math.random() * 0.22,
      })),
    []
  );

  const snowflakes = useMemo(
    () =>
      Array.from({ length: MAX_SNOW_COUNT }, () => ({
        x: (Math.random() - 0.5) * 136,
        y: Math.random() * 30,
        z: (Math.random() - 0.5) * 136,
        vx: 0,
        vz: 0,
        fallSpeed: 2.2 + Math.random() * 2.1,
        swayFreq: 1.1 + Math.random() * 1.4,
        swayAmp: 0.65 + Math.random() * 0.95,
        phase: Math.random() * Math.PI * 2,
        scale: 0.55 + Math.random() * 0.95,
        spinSpeed: (Math.random() - 0.5) * 2.4,
      })),
    []
  );

  const embers = useMemo(
    () =>
      Array.from({ length: MAX_EMBER_COUNT }, () => ({
        x: (Math.random() - 0.5) * 140,
        y: 0.3 + Math.random() * 18,
        z: (Math.random() - 0.5) * 140,
        vx: 0,
        vy: 0,
        vz: 0,
        phase: Math.random() * Math.PI * 2,
        scale: 0.06 + Math.random() * 0.08,
      })),
    []
  );

  const dropGeo = useMemo(() => new THREE.CylinderGeometry(0.012, 0.015, 0.9, 4), []);
  const splashGeo = useMemo(() => {
    const g = new THREE.RingGeometry(0.55, 1.0, 12);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const snowGeo = useMemo(() => new THREE.OctahedronGeometry(0.11, 0), []);
  const emberGeo = useMemo(() => new THREE.DodecahedronGeometry(0.45, 0), []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const upVec = useMemo(() => new THREE.Vector3(0, -1, 0), []);
  const combinedRainVec = useMemo(() => new THREE.Vector3(), []);
  const normRainVec = useMemo(() => new THREE.Vector3(), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.getElapsedTime();
    const weather = weatherRef.current;
    const pPos = playerPosRef.current;
    const quality = QualityManager.current;
    const density = quality.particlesDensity;
    const windVec = windSystem.getVector();
    const gust = windSystem.getGustFactor();

    const pvx = (pPos.x - prevPlayerPosRef.current.x) / Math.max(0.001, dt);
    const pvz = (pPos.z - prevPlayerPosRef.current.z) / Math.max(0.001, dt);
    prevPlayerPosRef.current.copy(pPos);

    // 1. Update Falling Rain Streaks (intensity & count linked to weather.rainIntensity)
    const rainIntensity = weather.rainIntensity ?? 0;
    const rainActive = quality.rainParticlesEnabled && density > 0.02 && rainIntensity > 0.02;
    if (rainMatRef.current) {
      rainMatRef.current.opacity = rainActive ? Math.min(0.72, 0.14 + rainIntensity * 0.58) : 0;
      rainMatRef.current.visible = rainActive;
    }

    if (rainMeshRef.current) {
      if (!rainActive) {
        rainMeshRef.current.visible = false;
      } else {
        rainMeshRef.current.visible = true;
        const intensityScale = 0.25 + rainIntensity * 0.75;
        const activeDrops = Math.min(
          drops.length,
          Math.max(60, Math.round(BASE_DROP_COUNT * density * intensityScale))
        );

        const fallBoost = 0.8 + rainIntensity * 0.45;
        // Combine gravity fall with live WindSystem vector so rain slants dynamically with the wind
        combinedRainVec.set(
          (weather.windVector.x + windVec.x * 0.85) * fallBoost,
          (weather.windVector.y - gust * 2.5) * fallBoost,
          (weather.windVector.z + windVec.z * 0.85) * fallBoost
        );
        quat.setFromUnitVectors(upVec, normRainVec.copy(combinedRainVec).normalize());

        for (let i = 0; i < activeDrops; i++) {
          const d = drops[i];
          if (!d) continue;
          d.x += combinedRainVec.x * dt * d.speed;
          d.y += combinedRainVec.y * dt * d.speed;
          d.z += combinedRainVec.z * dt * d.speed;

          if (d.y < pPos.y - 1) {
            d.y = pPos.y + 26 + Math.random() * 5;
            d.x = pPos.x + (Math.random() - 0.5) * 136;
            d.z = pPos.z + (Math.random() - 0.5) * 136;
          } else {
            if (d.x - pPos.x > 68) d.x -= 136;
            else if (d.x - pPos.x < -68) d.x += 136;
            if (d.z - pPos.z > 68) d.z -= 136;
            else if (d.z - pPos.z < -68) d.z += 136;
          }
          dummy.position.set(d.x, d.y, d.z);
          dummy.quaternion.copy(quat);
          dummy.scale.set(1, d.len * (0.75 + rainIntensity * 0.45 + gust * 0.15), 1);
          dummy.updateMatrix();
          rainMeshRef.current.setMatrixAt(i, dummy.matrix);
        }
        rainMeshRef.current.count = activeDrops;
        rainMeshRef.current.instanceMatrix.needsUpdate = true;
      }
    }

    // 2. Update Ground Rain Splash Ripples (linked to weather.rainIntensity)
    const splashActive = rainActive && rainIntensity > 0.06;
    if (splashMatRef.current) {
      splashMatRef.current.opacity = splashActive ? Math.min(0.45, rainIntensity * 0.42) : 0;
      splashMatRef.current.visible = splashActive;
    }
    if (splashMeshRef.current) {
      if (!splashActive) {
        splashMeshRef.current.visible = false;
      } else {
        splashMeshRef.current.visible = true;
        const activeSplashes = Math.min(
          splashes.length,
          Math.max(24, Math.round(BASE_SPLASH_COUNT * density * rainIntensity))
        );
        for (let i = 0; i < activeSplashes; i++) {
          const s = splashes[i];
          if (!s) continue;
          s.age += dt * s.speed * (0.75 + rainIntensity * 0.65);
          if (s.age >= 1.0) {
            s.age = 0;
            s.x = pPos.x + (Math.random() - 0.5) * 76;
            s.z = pPos.z + (Math.random() - 0.5) * 76;
          }
          const radius = Math.max(0.02, s.age * s.maxRadius);
          dummy.position.set(s.x, 0.04, s.z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(radius, 1, radius);
          dummy.updateMatrix();
          splashMeshRef.current.setMatrixAt(i, dummy.matrix);
        }
        splashMeshRef.current.count = activeSplashes;
        splashMeshRef.current.instanceMatrix.needsUpdate = true;
      }
    }

    // 3. Update Falling Crystalline Snowflakes (intensity & swirl linked to weather.snowIntensity)
    const snowIntensity = weather.snowIntensity ?? 0;
    const snowActive = quality.rainParticlesEnabled && density > 0.02 && snowIntensity > 0.02;
    if (snowMatRef.current) {
      snowMatRef.current.opacity = snowActive ? Math.min(0.88, 0.24 + snowIntensity * 0.64) : 0;
      snowMatRef.current.visible = snowActive;
    }

    if (snowMeshRef.current) {
      if (!snowActive) {
        snowMeshRef.current.visible = false;
      } else {
        snowMeshRef.current.visible = true;
        const snowScaleFactor = 0.25 + snowIntensity * 0.75;
        const activeFlakes = Math.min(
          snowflakes.length,
          Math.max(60, Math.round(BASE_SNOW_COUNT * density * snowScaleFactor))
        );
        const fallMult = 0.75 + snowIntensity * 0.85;
        const driftX = weather.windVector.x * 0.45 + windVec.x * 0.65;
        const driftZ = weather.windVector.z * 0.45 + windVec.z * 0.65;

        for (let i = 0; i < activeFlakes; i++) {
          const f = snowflakes[i];
          if (!f) continue;

          // Player wake deflection on falling snowflakes
          const dx = f.x - pPos.x;
          const dy = f.y - (pPos.y + 1.1);
          const dz = f.z - pPos.z;
          const distSq = dx * dx + dy * dy + dz * dz;
          if (distSq < 10.0 && distSq > 0.001) {
            const dist = Math.sqrt(distSq);
            const push = (1 - dist / 3.16) * 4.2;
            f.vx += (dx / dist) * push * dt + pvx * 0.22 * dt;
            f.vz += (dz / dist) * push * dt + pvz * 0.22 * dt;
          }
          f.vx *= Math.max(0, 1 - dt * 2.5);
          f.vz *= Math.max(0, 1 - dt * 2.5);

          const flutterX = Math.sin(t * f.swayFreq + f.phase) * f.swayAmp * gust;
          const flutterZ = Math.cos(t * (f.swayFreq * 0.85) + f.phase) * f.swayAmp * gust;

          f.x += (driftX + flutterX + f.vx) * dt;
          f.y -= f.fallSpeed * fallMult * dt;
          f.z += (driftZ + flutterZ + f.vz) * dt;

          if (f.y < pPos.y - 0.5) {
            f.y = pPos.y + 24 + Math.random() * 6;
            f.x = pPos.x + (Math.random() - 0.5) * 136;
            f.z = pPos.z + (Math.random() - 0.5) * 136;
          } else {
            if (f.x - pPos.x > 68) f.x -= 136;
            else if (f.x - pPos.x < -68) f.x += 136;
            if (f.z - pPos.z > 68) f.z -= 136;
            else if (f.z - pPos.z < -68) f.z += 136;
          }

          dummy.position.set(f.x, f.y, f.z);
          dummy.rotation.set(t * f.spinSpeed + f.phase, t * 0.8 + f.phase, t * 0.5);
          dummy.scale.setScalar(f.scale * (0.85 + snowIntensity * 0.35));
          dummy.updateMatrix();
          snowMeshRef.current.setMatrixAt(i, dummy.matrix);
        }
        snowMeshRef.current.count = activeFlakes;
        snowMeshRef.current.instanceMatrix.needsUpdate = true;
      }
    }

    // 4. Update Wind-Driven Atmospheric Motes (affected by WindSystem & player slipstream)
    if (emberMeshRef.current) {
      if (!quality.windParticlesEnabled || density <= 0.02) {
        emberMeshRef.current.visible = false;
        return;
      }
      emberMeshRef.current.visible = true;
      const activeEmbers = Math.min(
        embers.length,
        Math.max(24, Math.round(BASE_EMBER_COUNT * density))
      );

      for (let i = 0; i < activeEmbers; i++) {
        const e = embers[i];
        if (!e) continue;

        // Player wake deflection on low-floating atmospheric motes
        const dx = e.x - pPos.x;
        const dy = e.y - (pPos.y + 1.0);
        const dz = e.z - pPos.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq < 9.0 && distSq > 0.001) {
          const dist = Math.sqrt(distSq);
          const push = (1 - dist / 3.0) * 5.5;
          e.vx += (dx / dist) * push * dt + pvx * 0.25 * dt;
          e.vy += 1.8 * push * dt;
          e.vz += (dz / dist) * push * dt + pvz * 0.25 * dt;
        }

        e.vx *= Math.max(0, 1 - dt * 3.0);
        e.vy *= Math.max(0, 1 - dt * 3.0);
        e.vz *= Math.max(0, 1 - dt * 3.0);

        e.x += (windVec.x * 0.55 + Math.sin(t * 1.8 + e.phase) * 0.6) * dt * gust + e.vx * dt;
        e.y += (Math.cos(t * 1.4 + e.phase) * 0.35 + windVec.y * 0.25) * dt + e.vy * dt;
        e.z += (windVec.z * 0.55 + Math.cos(t * 1.6 + e.phase) * 0.6) * dt * gust + e.vz * dt;

        if (e.y < 0.25) e.y = 0.25 + Math.random() * 2.5;
        if (e.y > 20) e.y = 2.0 + Math.random() * 8;

        if (e.x - pPos.x > 70) e.x -= 140;
        else if (e.x - pPos.x < -70) e.x += 140;
        if (e.z - pPos.z > 70) e.z -= 140;
        else if (e.z - pPos.z < -70) e.z += 140;

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
      <instancedMesh ref={splashMeshRef} args={[splashGeo, undefined, MAX_SPLASH_COUNT]} frustumCulled={false}>
        <meshBasicMaterial ref={splashMatRef} color="#7dd3fc" transparent opacity={0} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={snowMeshRef} args={[snowGeo, undefined, MAX_SNOW_COUNT]} frustumCulled={false}>
        <meshBasicMaterial ref={snowMatRef} color="#f0f9ff" transparent opacity={0} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={emberMeshRef} args={[emberGeo, undefined, MAX_EMBER_COUNT]} frustumCulled={false}>
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.55} depthWrite={false} />
      </instancedMesh>
    </group>
  );
};
