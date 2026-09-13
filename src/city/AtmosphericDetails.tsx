import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { WindSystem } from '../world/WindSystem';
import { WeatherSystem } from '../world/WeatherSystem';

interface AtmosphericDetailsProps {
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
}

interface SteamParticle {
  pos: THREE.Vector3;
  ventIdx: number;
  life: number;
  maxLife: number;
  scale: number;
  rot: number;
  rotSpeed: number;
}

interface MistSheet {
  pos: THREE.Vector3;
  basePos: THREE.Vector3;
  scale: THREE.Vector3;
  phase: number;
}

export const AtmosphericDetails: React.FC<AtmosphericDetailsProps> = ({ playerPosRef }) => {
  const steamMeshRef = useRef<THREE.InstancedMesh>(null);
  const mistMeshRef = useRef<THREE.InstancedMesh>(null);

  const steamMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const mistMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const windSystem = WindSystem.getInstance();

  // 1. Street Steam Vents / Manhole Positions
  const steamVents = useMemo(
    () => [
      new THREE.Vector3(12, 0.05, 18),
      new THREE.Vector3(-14, 0.05, -22),
      new THREE.Vector3(26, 0.05, -35),
      new THREE.Vector3(-24, 0.05, 38),
      new THREE.Vector3(0, 0.05, -60),
      new THREE.Vector3(50, 0.05, 12),
      new THREE.Vector3(-55, 0.05, -15),
      new THREE.Vector3(16, 0.05, 85),
    ],
    []
  );

  // 2. Steam Particles Simulation Pool (12 particles per vent = 96 total)
  const STEAM_COUNT = 96;
  const steamParticles = useMemo(() => {
    const list: SteamParticle[] = [];
    for (let i = 0; i < STEAM_COUNT; i++) {
      const ventIdx = i % steamVents.length;
      const vent = steamVents[ventIdx];
      const life = Math.random();
      list.push({
        pos: new THREE.Vector3(
          vent.x + (Math.random() - 0.5) * 0.4,
          vent.y + life * 4.5,
          vent.z + (Math.random() - 0.5) * 0.4
        ),
        ventIdx,
        life,
        maxLife: 2.2 + Math.random() * 1.5,
        scale: 0.3 + life * 1.6,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 1.5,
      });
    }
    return list;
  }, [steamVents]);

  // 3. Low Ground Mist Sheets (36 soft overlapping low-level fog patches)
  const MIST_COUNT = 36;
  const mistSheets = useMemo(() => {
    const list: MistSheet[] = [];
    for (let i = 0; i < MIST_COUNT; i++) {
      const angle = (i / MIST_COUNT) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 15 + Math.random() * 75;
      const bx = Math.cos(angle) * dist;
      const bz = Math.sin(angle) * dist;
      const sx = 18 + Math.random() * 24;
      const sz = 18 + Math.random() * 24;

      list.push({
        basePos: new THREE.Vector3(bx, 0.35 + Math.random() * 0.5, bz),
        pos: new THREE.Vector3(bx, 0.35, bz),
        scale: new THREE.Vector3(sx, 0.6, sz),
        phase: Math.random() * Math.PI * 2,
      });
    }
    return list;
  }, []);

  // Shared Geometries
  const steamGeo = useMemo(() => new THREE.DodecahedronGeometry(0.8, 1), []);
  const mistGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  // Street Props Definitions (Bollards, Recycling Pods, Junction Transformers, Hydrants)
  const streetProps = useMemo(() => {
    return {
      bollards: [
        // Plaza corner bollards
        new THREE.Vector3(14, 0, 14),
        new THREE.Vector3(14, 0, -14),
        new THREE.Vector3(-14, 0, 14),
        new THREE.Vector3(-14, 0, -14),
        new THREE.Vector3(14, 0, 24),
        new THREE.Vector3(-14, 0, 24),
        new THREE.Vector3(14, 0, -24),
        new THREE.Vector3(-14, 0, -24),
      ],
      recyclingPods: [
        { pos: new THREE.Vector3(18.5, 0, 32), rot: -Math.PI / 2 },
        { pos: new THREE.Vector3(-18.5, 0, -32), rot: Math.PI / 2 },
        { pos: new THREE.Vector3(32, 0, 18.5), rot: 0 },
        { pos: new THREE.Vector3(-32, 0, -18.5), rot: Math.PI },
      ],
      junctionBoxes: [
        { pos: new THREE.Vector3(19, 0, -50), rot: -Math.PI / 2 },
        { pos: new THREE.Vector3(-19, 0, 50), rot: Math.PI / 2 },
        { pos: new THREE.Vector3(55, 0, -18), rot: 0 },
      ],
      hydrants: [
        new THREE.Vector3(18.2, 0, 12),
        new THREE.Vector3(-18.2, 0, 12),
        new THREE.Vector3(18.2, 0, -70),
        new THREE.Vector3(-18.2, 0, -70),
      ],
    };
  }, []);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const wind = windSystem.getVector();
    const gust = windSystem.getGustFactor();
    const weather = WeatherSystem.getInstance().getState();
    const pPos = playerPosRef?.current || new THREE.Vector3(0, 0, 0);

    // 1. Update Steam Particles
    if (steamMeshRef.current) {
      for (let i = 0; i < STEAM_COUNT; i++) {
        const p = steamParticles[i];
        p.life += delta / p.maxLife;

        if (p.life >= 1.0) {
          p.life = 0;
          const vent = steamVents[p.ventIdx];
          p.pos.set(
            vent.x + (Math.random() - 0.5) * 0.5,
            vent.y + 0.1,
            vent.z + (Math.random() - 0.5) * 0.5
          );
        }

        // Rise and drift with wind
        p.pos.y += (1.4 + (1.0 - p.life) * 1.8) * delta;
        p.pos.x += wind.x * 0.18 * gust * delta;
        p.pos.z += wind.z * 0.18 * gust * delta;

        p.rot += p.rotSpeed * delta;
        const currentScale = (0.2 + p.life * 1.6) * (1.0 - p.life * 0.3);

        dummy.position.copy(p.pos);
        dummy.rotation.set(p.rot, p.rot * 0.7, 0);
        dummy.scale.setScalar(currentScale);
        dummy.updateMatrix();

        steamMeshRef.current.setMatrixAt(i, dummy.matrix);
      }
      steamMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    // 2. Update Ground Mist Sheets
    if (mistMeshRef.current) {
      // Mist opacity scales up dynamically with fog and rain
      const fogFactor = (weather.fogDensityMultiplier - 1.0) / 3.0; // 0 (clear) to 1.0 (dense fog)
      const targetOpacity = Math.min(0.75, 0.18 + fogFactor * 0.5 + weather.rainIntensity * 0.25);
      if (mistMatRef.current) {
        mistMatRef.current.opacity = targetOpacity;
      }

      for (let j = 0; j < MIST_COUNT; j++) {
        const m = mistSheets[j];
        // Slow organic undulating drift
        const driftX = Math.sin(t * 0.25 + m.phase) * 2.5 + (wind.x * 0.1 * delta);
        const driftZ = Math.cos(t * 0.2 + m.phase) * 2.5 + (wind.z * 0.1 * delta);

        dummy.position.set(
          pPos.x + m.basePos.x + driftX,
          m.basePos.y + Math.sin(t * 0.8 + m.phase) * 0.15,
          pPos.z + m.basePos.z + driftZ
        );
        dummy.rotation.set(-Math.PI / 2, 0, m.phase + t * 0.05);
        dummy.scale.set(m.scale.x, m.scale.z, 1);
        dummy.updateMatrix();

        mistMeshRef.current.setMatrixAt(j, dummy.matrix);
      }
      mistMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group name="AtmosphericEnvironmentLayer">
      {/* 1. Billowing Street Steam Vents */}
      <instancedMesh
        ref={steamMeshRef}
        args={[steamGeo, undefined, STEAM_COUNT]}
      >
        <meshStandardMaterial
          ref={steamMatRef}
          color="#dbeafe"
          emissive="#60a5fa"
          emissiveIntensity={0.15}
          roughness={0.9}
          transparent
          opacity={0.32}
          depthWrite={false}
        />
      </instancedMesh>

      {/* Steam Vent Grating / Manhole Covers on the street surface */}
      {steamVents.map((vent, vIdx) => (
        <group key={`vent-${vIdx}`} position={vent}>
          {/* Circular Cast Iron Rim */}
          <mesh position={[0, 0.01, 0]} receiveShadow>
            <cylinderGeometry args={[0.75, 0.8, 0.04, 16]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.4} />
          </mesh>
          {/* Slotted Vent Grate */}
          <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.65, 12]} />
            <meshStandardMaterial color="#0f172a" metalness={0.95} wireframe />
          </mesh>
          {/* Subtle Warm Amber / Cyan Internal Core Glow */}
          <pointLight
            position={[0, 0.15, 0]}
            color={vIdx % 2 === 0 ? '#38bdf8' : '#fb923c'}
            intensity={0.6}
            distance={4}
            decay={2}
          />
        </group>
      ))}

      {/* 2. Low Rolling Ground Mist Sheets */}
      <instancedMesh
        ref={mistMeshRef}
        args={[mistGeo, undefined, MIST_COUNT]}
      >
        <meshStandardMaterial
          ref={mistMatRef}
          color="#1e293b"
          roughness={0.95}
          transparent
          opacity={0.25}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </instancedMesh>

      {/* 3. Sidewalk Safety Bollards with Neon Rings */}
      {streetProps.bollards.map((bPos, bIdx) => (
        <group key={`bollard-${bIdx}`} position={bPos}>
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.14, 0.16, 0.9, 8]} />
            <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Glowing Top Ring Indicator */}
          <mesh position={[0, 0.82, 0]}>
            <cylinderGeometry args={[0.142, 0.142, 0.06, 8]} />
            <meshBasicMaterial color="#00f0ff" />
          </mesh>
        </group>
      ))}

      {/* 4. Cyber Waste & Recycling Pods */}
      {streetProps.recyclingPods.map((pod, rIdx) => (
        <group key={`pod-${rIdx}`} position={pod.pos} rotation={[0, pod.rot, 0]}>
          <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.1, 1.4, 0.8]} />
            <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.25} />
          </mesh>
          {/* Green Recycling Slot Trim */}
          <mesh position={[0, 0.95, 0.41]}>
            <boxGeometry args={[0.7, 0.15, 0.04]} />
            <meshBasicMaterial color="#10b981" />
          </mesh>
        </group>
      ))}

      {/* 5. High-Voltage Electrical Junction Transformers */}
      {streetProps.junctionBoxes.map((jbox, jIdx) => (
        <group key={`jbox-${jIdx}`} position={jbox.pos} rotation={[0, jbox.rot, 0]}>
          {/* Main Enclosure */}
          <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.6, 1.8, 1.0]} />
            <meshStandardMaterial color="#0f172a" metalness={0.88} roughness={0.3} />
          </mesh>
          {/* Hazard Chevron Warning Stripe */}
          <mesh position={[0, 1.2, 0.51]}>
            <boxGeometry args={[1.2, 0.3, 0.02]} />
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
          {/* Blinking Status LED */}
          <mesh position={[0.5, 1.6, 0.51]}>
            <sphereGeometry args={[0.05, 6, 6]} />
            <meshBasicMaterial color="#00ffaa" />
          </mesh>
        </group>
      ))}

      {/* 6. Fire Hydrants */}
      {streetProps.hydrants.map((hPos, hIdx) => (
        <group key={`hydrant-${hIdx}`} position={hPos}>
          <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.18, 0.22, 0.76, 8]} />
            <meshStandardMaterial color="#dc2626" metalness={0.65} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.78, 0]} castShadow>
            <sphereGeometry args={[0.18, 8, 8]} />
            <meshStandardMaterial color="#ef4444" metalness={0.65} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.45, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.08, 0.08, 0.56, 8]} />
            <meshStandardMaterial color="#991b1b" metalness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
};
