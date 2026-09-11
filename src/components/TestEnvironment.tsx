import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ProceduralTextures } from '../core/ProceduralTextures';

export const TestEnvironment: React.FC = () => {
  const beaconRingsRef = useRef<THREE.Group>(null);
  const beaconCoreRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  // Procedural textures
  const groundTexture = useMemo(() => ProceduralTextures.getPlazaGridTexture(), []);
  const facadeTexture = useMemo(() => ProceduralTextures.getBuildingFacadeTexture(0.7), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (beaconRingsRef.current) {
      beaconRingsRef.current.rotation.y = t * 0.4;
      beaconRingsRef.current.rotation.x = Math.sin(t * 0.5) * 0.15;
    }
    if (beaconCoreRef.current) {
      beaconCoreRef.current.position.y = 4.5 + Math.sin(t * 1.5) * 0.35;
      beaconCoreRef.current.rotation.y = -t * 0.8;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 2.5 + Math.sin(t * 3) * 0.8;
    }
  });

  return (
    <group name="NexusFoundationEnvironment">
      {/* 1. Main Plaza Floor (160x160m) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial
          map={groundTexture}
          roughness={0.4}
          metalness={0.7}
        />
      </mesh>

      {/* Grid perimeter warning trim */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[98, 100, 64]} />
        <meshBasicMaterial color="#00f0ff" transparent opacity={0.4} wireframe />
      </mesh>

      {/* 2. Central Nexus Hologram Monolith */}
      <group position={[0, 0, 0]}>
        {/* Base Pedestal */}
        <mesh position={[0, 0.4, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[5, 6, 0.8, 12]} />
          <meshStandardMaterial color="#0b1324" metalness={0.9} roughness={0.2} />
        </mesh>

        {/* Inner glow ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.82, 0]}>
          <ringGeometry args={[3.8, 4.6, 32]} />
          <meshBasicMaterial color="#00f0ff" />
        </mesh>

        {/* Floating animated crystal core */}
        <mesh ref={beaconCoreRef} position={[0, 4.5, 0]} castShadow>
          <octahedronGeometry args={[1.5, 0]} />
          <meshStandardMaterial
            color="#00f0ff"
            emissive="#00f0ff"
            emissiveIntensity={1.8}
            metalness={0.2}
            roughness={0.1}
            wireframe={false}
          />
        </mesh>

        {/* Orbiting holographic energy rings */}
        <group ref={beaconRingsRef} position={[0, 4.5, 0]}>
          <mesh rotation={[Math.PI / 4, 0, 0]}>
            <torusGeometry args={[2.6, 0.05, 16, 64]} />
            <meshBasicMaterial color="#00ffaa" />
          </mesh>
          <mesh rotation={[-Math.PI / 4, 0, 0]}>
            <torusGeometry args={[3.2, 0.05, 16, 64]} />
            <meshBasicMaterial color="#ff0077" />
          </mesh>
          <mesh rotation={[0, Math.PI / 3, 0]}>
            <torusGeometry args={[3.8, 0.04, 16, 64]} />
            <meshBasicMaterial color="#00f0ff" />
          </mesh>
        </group>

        {/* Core dynamic neon light source */}
        <pointLight
          ref={lightRef}
          position={[0, 4.5, 0]}
          color="#00f0ff"
          distance={35}
          decay={2}
          intensity={2.5}
        />
      </group>

      {/* 3. Four Quadrant Monolithic Sci-Fi Towers */}
      {/* Tower A (North-East) */}
      <group position={[35, 0, 35]}>
        <mesh position={[0, 24, 0]} castShadow receiveShadow>
          <boxGeometry args={[16, 48, 16]} />
          <meshStandardMaterial
            map={facadeTexture}
            roughness={0.3}
            metalness={0.8}
          />
        </mesh>
        {/* Tiered upper deck */}
        <mesh position={[0, 52, 0]} castShadow receiveShadow>
          <boxGeometry args={[10, 8, 10]} />
          <meshStandardMaterial color="#070c18" metalness={0.85} roughness={0.3} />
        </mesh>
        {/* Rooftop spire */}
        <mesh position={[0, 60, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.8, 8, 8]} />
          <meshBasicMaterial color="#ff0077" />
        </mesh>
        {/* Vertical neon edge strips */}
        <mesh position={[8.05, 24, 8.05]}>
          <boxGeometry args={[0.15, 48, 0.15]} />
          <meshBasicMaterial color="#00f0ff" />
        </mesh>
      </group>

      {/* Tower B (North-West) */}
      <group position={[-35, 0, 35]}>
        <mesh position={[0, 32, 0]} castShadow receiveShadow>
          <boxGeometry args={[14, 64, 14]} />
          <meshStandardMaterial
            map={facadeTexture}
            roughness={0.3}
            metalness={0.8}
          />
        </mesh>
        {/* Vertical beacon line */}
        <mesh position={[-7.05, 32, 0]}>
          <boxGeometry args={[0.2, 64, 0.6]} />
          <meshBasicMaterial color="#00ffaa" />
        </mesh>
      </group>

      {/* Tower C (South-West) */}
      <group position={[-40, 0, -40]}>
        <mesh position={[0, 18, 0]} castShadow receiveShadow>
          <boxGeometry args={[20, 36, 18]} />
          <meshStandardMaterial
            map={facadeTexture}
            roughness={0.4}
            metalness={0.7}
          />
        </mesh>
        {/* Skybridge cantilever */}
        <mesh position={[8, 30, 0]} castShadow receiveShadow>
          <boxGeometry args={[16, 3, 6]} />
          <meshStandardMaterial color="#091325" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* Tower D (South-East) */}
      <group position={[40, 0, -40]}>
        <mesh position={[0, 28, 0]} castShadow receiveShadow>
          <boxGeometry args={[18, 56, 18]} />
          <meshStandardMaterial
            map={facadeTexture}
            roughness={0.3}
            metalness={0.8}
          />
        </mesh>
      </group>

      {/* 4. Raised Observation Promenade & Ramps */}
      <group position={[0, 0, -25]}>
        {/* Raised Platform (Width: 30, Height: 4, Depth: 12) */}
        <mesh position={[0, 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[30, 4, 12]} />
          <meshStandardMaterial color="#091326" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* Safety Glass Balustrade */}
        <mesh position={[0, 4.8, 5.9]}>
          <boxGeometry args={[30, 1.6, 0.1]} />
          <meshPhysicalMaterial
            color="#00f0ff"
            transparent
            opacity={0.35}
            roughness={0.1}
            transmission={0.8}
          />
        </mesh>

        {/* West Access Ramp */}
        <mesh position={[-18, 1.9, 0]} rotation={[0, 0, -0.22]} castShadow receiveShadow>
          <boxGeometry args={[10, 0.4, 6]} />
          <meshStandardMaterial color="#0d1933" metalness={0.7} roughness={0.4} />
        </mesh>

        {/* East Access Ramp */}
        <mesh position={[18, 1.9, 0]} rotation={[0, 0, 0.22]} castShadow receiveShadow>
          <boxGeometry args={[10, 0.4, 6]} />
          <meshStandardMaterial color="#0d1933" metalness={0.7} roughness={0.4} />
        </mesh>
      </group>

      {/* 5. Interactive Terminal Pedestal */}
      <group position={[0, 0, 12]}>
        <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.4, 0.6, 1.2, 8]} />
          <meshStandardMaterial color="#080f1e" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Holographic Console Screen */}
        <mesh position={[0, 1.3, 0]} rotation={[-Math.PI / 6, 0, 0]}>
          <boxGeometry args={[0.8, 0.5, 0.05]} />
          <meshStandardMaterial
            color="#00f0ff"
            emissive="#00f0ff"
            emissiveIntensity={1.2}
          />
        </mesh>
      </group>
    </group>
  );
};
