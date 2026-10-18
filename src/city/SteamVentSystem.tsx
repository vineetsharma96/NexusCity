import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { WindSystem } from '../world/WindSystem';
import { QualityManager } from '../rendering/QualityManager';

interface SteamVentSystemProps {
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
}

interface VentSource {
  id: string;
  position: [number, number, number];
  rotationY: number;
  accentColor: string;
  smokeTint: string;
  intensity: number;
}

interface SmokeParticle {
  ventIndex: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxLife: number;
  baseScale: number;
  rotSpeed: number;
  phase: number;
}

const VENT_SOURCES: VentSource[] = [
  // Central Avenue & Intersection Street Steam Vents
  { id: 'vent_central_nw', position: [-5.6, 0.03, -22], rotationY: 0, accentColor: '#38bdf8', smokeTint: '#cbd5e1', intensity: 1.0 },
  { id: 'vent_central_se', position: [5.6, 0.03, 22], rotationY: 0, accentColor: '#f59e0b', smokeTint: '#e2e8f0', intensity: 1.05 },
  { id: 'vent_central_ne', position: [22, 0.03, -5.6], rotationY: Math.PI / 2, accentColor: '#38bdf8', smokeTint: '#cbd5e1', intensity: 0.95 },
  { id: 'vent_central_sw', position: [-22, 0.03, 5.6], rotationY: Math.PI / 2, accentColor: '#10b981', smokeTint: '#cbd5e1', intensity: 0.95 },
  { id: 'vent_north_ave_1', position: [-5.6, 0.03, -52], rotationY: 0, accentColor: '#38bdf8', smokeTint: '#cbd5e1', intensity: 1.1 },
  { id: 'vent_south_ave_1', position: [5.6, 0.03, 52], rotationY: 0, accentColor: '#f43f5e', smokeTint: '#e2e8f0', intensity: 1.1 },
  { id: 'vent_west_alley', position: [-52, 0.03, -5.6], rotationY: Math.PI / 2, accentColor: '#f59e0b', smokeTint: '#cbd5e1', intensity: 1.0 },
  { id: 'vent_east_sanctuary_entry', position: [36, 0.03, 5.6], rotationY: Math.PI / 2, accentColor: '#10b981', smokeTint: '#ccfbf1', intensity: 1.0 },
  // Central Park Sanctuary Geothermal Spring Steam Vents
  { id: 'vent_park_spring_sw', position: [56, 0.26, 92], rotationY: 0.4, accentColor: '#10b981', smokeTint: '#a7f3d0', intensity: 1.2 },
  { id: 'vent_park_spring_se', position: [94, 0.26, 92], rotationY: -0.4, accentColor: '#38bdf8', smokeTint: '#bae6fd', intensity: 1.2 },
];

const PARTICLES_PER_VENT = 36;
const TOTAL_SMOKE_PARTICLES = VENT_SOURCES.length * PARTICLES_PER_VENT;

export const SteamVentSystem: React.FC<SteamVentSystemProps> = ({ playerPosRef }) => {
  const smokeMeshRef = useRef<THREE.InstancedMesh>(null);
  const windSystem = WindSystem.getInstance();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorObj = useMemo(() => new THREE.Color(), []);
  const prevPlayerPosRef = useRef(new THREE.Vector3());

  const particles = useMemo<SmokeParticle[]>(() => {
    const list: SmokeParticle[] = [];
    for (let vIdx = 0; vIdx < VENT_SOURCES.length; vIdx++) {
      const src = VENT_SOURCES[vIdx];
      for (let i = 0; i < PARTICLES_PER_VENT; i++) {
        const maxLife = 2.4 + (i % 7) * 0.38;
        const frac = i / PARTICLES_PER_VENT;
        list.push({
          ventIndex: vIdx,
          x: src.position[0] + ((i % 3) - 1) * 0.28,
          y: src.position[1] + frac * 4.8,
          z: src.position[2] + (((i * 3) % 3) - 1) * 0.28,
          vx: 0,
          vy: (1.45 + (i % 5) * 0.22) * src.intensity,
          vz: 0,
          age: frac * maxLife,
          maxLife,
          baseScale: 0.24 + (i % 4) * 0.08,
          rotSpeed: ((i % 2 === 0 ? 1 : -1) * (0.4 + (i % 3) * 0.25)),
          phase: i * 1.13 + vIdx * 2.1,
        });
      }
    }
    return list;
  }, []);

  const puffGeo = useMemo(() => new THREE.DodecahedronGeometry(1, 1), []);

  useFrame(({ clock }, delta) => {
    const mesh = smokeMeshRef.current;
    if (!mesh) return;

    const quality = QualityManager.current;
    if (!quality.windParticlesEnabled || quality.particlesDensity <= 0.05) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;

    const dt = Math.min(delta, 0.05);
    const t = clock.getElapsedTime();
    const windVec = windSystem.getVector();
    const gust = windSystem.getGustFactor();
    const pPos = playerPosRef.current;

    const pvx = (pPos.x - prevPlayerPosRef.current.x) / Math.max(0.001, dt);
    const pvz = (pPos.z - prevPlayerPosRef.current.z) / Math.max(0.001, dt);
    prevPlayerPosRef.current.copy(pPos);

    for (let i = 0; i < TOTAL_SMOKE_PARTICLES; i++) {
      const p = particles[i];
      const src = VENT_SOURCES[p.ventIndex];
      p.age += dt;

      if (p.age >= p.maxLife) {
        p.age = 0;
        p.x = src.position[0] + (Math.random() - 0.5) * 0.85;
        p.y = src.position[1] + 0.08;
        p.z = src.position[2] + (Math.random() - 0.5) * 0.55;
        p.vx = (Math.random() - 0.5) * 0.35;
        p.vy = (1.55 + Math.random() * 0.65) * src.intensity;
        p.vz = (Math.random() - 0.5) * 0.35;
      }

      const lifeRatio = p.age / p.maxLife;
      // Height-progressive wind shear: higher smoke puffs catch stronger horizontal wind
      const windInfluence = 0.14 + lifeRatio * 0.38;
      const swirlX = Math.sin(t * 2.1 + p.phase) * (0.35 + lifeRatio * 0.6);
      const swirlZ = Math.cos(t * 1.9 + p.phase) * (0.35 + lifeRatio * 0.6);

      // Character wake interaction: walking through a steam plume parts and swirls the smoke
      const dx = p.x - pPos.x;
      const dy = p.y - (pPos.y + 1.0);
      const dz = p.z - pPos.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < 7.5 && distSq > 0.001) {
        const dist = Math.sqrt(distSq);
        const push = (1 - dist / 2.74) * 6.5;
        p.vx += ((dx / dist) * push + pvx * 0.35) * dt;
        p.vy += 1.2 * push * dt;
        p.vz += ((dz / dist) * push + pvz * 0.35) * dt;
      }

      p.vx *= Math.max(0, 1 - dt * 2.4);
      p.vz *= Math.max(0, 1 - dt * 2.4);

      p.x += (windVec.x * windInfluence + swirlX + p.vx) * dt;
      p.y += p.vy * (1 - lifeRatio * 0.35) * dt;
      p.z += (windVec.z * windInfluence + swirlZ + p.vz) * dt;

      // Billowing expansion and dissipation envelope
      const fadeIn = Math.min(1, lifeRatio * 4.2);
      const fadeOut = Math.max(0, 1 - Math.pow(lifeRatio, 1.45));
      const envelope = fadeIn * fadeOut;
      const radius = p.baseScale * (0.65 + lifeRatio * 2.75 * Math.min(1.5, gust * 0.85)) * envelope;

      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(t * p.rotSpeed, t * p.rotSpeed * 0.8 + p.phase, p.phase);
      dummy.scale.set(radius * 1.15, radius * 0.88, radius * 1.15);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Warm core near nozzle cooling into misty slate/cyan smoke aloft
      colorObj.set(src.accentColor).lerp(new THREE.Color(src.smokeTint), Math.min(1, lifeRatio * 1.35));
      mesh.setColorAt(i, colorObj);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <group name="SteamVentSystemLayer">
      {/* Physical Street & Sanctuary Steam Vent Grates */}
      {VENT_SOURCES.map((v) => (
        <group key={v.id} position={v.position} rotation={[0, v.rotationY, 0]}>
          {/* Heavy Cast-Titanium Outer Frame */}
          <mesh position={[0, 0.015, 0]} receiveShadow>
            <boxGeometry args={[2.2, 0.035, 1.35]} />
            <meshStandardMaterial color="#0f172a" metalness={0.92} roughness={0.25} />
          </mesh>
          {/* Glowing Thermal Chamber Under-Core */}
          <mesh position={[0, 0.022, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.85, 1.0]} />
            <meshBasicMaterial color={v.accentColor} transparent opacity={0.42} />
          </mesh>
          {/* Slotted Louver Bars */}
          {([-0.68, -0.34, 0, 0.34, 0.68] as const).map((lx, idx) => (
            <mesh key={idx} position={[lx, 0.032, 0]}>
              <boxGeometry args={[0.12, 0.02, 1.06]} />
              <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.22} />
            </mesh>
          ))}
          {/* Hazard Trim Strips */}
          <mesh position={[0, 0.034, -0.62]}>
            <boxGeometry args={[2.1, 0.01, 0.06]} />
            <meshBasicMaterial color={v.accentColor} />
          </mesh>
          <mesh position={[0, 0.034, 0.62]}>
            <boxGeometry args={[2.1, 0.01, 0.06]} />
            <meshBasicMaterial color={v.accentColor} />
          </mesh>
        </group>
      ))}

      {/* Instanced Billowing Volumetric Smoke Plumes */}
      <instancedMesh
        ref={smokeMeshRef}
        args={[puffGeo, undefined, TOTAL_SMOKE_PARTICLES]}
        frustumCulled={false}
      >
        <meshStandardMaterial
          color="#ffffff"
          roughness={0.92}
          metalness={0.05}
          transparent
          opacity={0.24}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  );
};
